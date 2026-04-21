import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import nacl from 'tweetnacl';
import { supabase } from './supabase';

const APP_WALLET_SALT = process.env.EXPO_PUBLIC_WALLET_SALT ?? 'sniper-shot-embedded-v1';
const SECURE_KEY = (userId: string) => `ew_sk_${userId}`;

// ─── Key derivation ───────────────────────────────────────────────────────────
// Primary: Supabase Edge Function derives SHA-256(userId + WALLET_SALT) server-side.
//          WALLET_SALT never touches the client bundle.
// Fallback: local derivation using EXPO_PUBLIC_WALLET_SALT (client-visible but still
//           requires Supabase RLS + the user's session to access encrypted backup).
async function deriveKey(userId: string): Promise<Uint8Array> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
      const res = await fetch(
        `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/derive-wallet-key`,
        { headers: { Authorization: `Bearer ${session.access_token}` } }
      );
      if (res.ok) {
        const { key } = await res.json() as { key: string };
        if (key?.length === 64) return Buffer.from(key, 'hex');
      }
    }
  } catch { /* network error — fall through */ }

  // Local fallback: same SHA-256 formula, SALT from env
  const hex = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    userId + APP_WALLET_SALT,
    { encoding: Crypto.CryptoEncoding.HEX }
  );
  return Buffer.from(hex, 'hex');
}

// Encrypt with XSalsa20-Poly1305 (authenticated encryption via tweetnacl)
function encrypt(data: Uint8Array, key: Uint8Array): string {
  const nonce = nacl.randomBytes(nacl.secretbox.nonceLength);
  const cipher = nacl.secretbox(data, nonce, key);
  // Store as hex: 24-byte nonce || ciphertext
  return Buffer.from([...nonce, ...cipher]).toString('hex');
}

function decrypt(hex: string, key: Uint8Array): Uint8Array | null {
  const buf = Buffer.from(hex, 'hex');
  const nonce = buf.slice(0, nacl.secretbox.nonceLength);
  const cipher = buf.slice(nacl.secretbox.nonceLength);
  return nacl.secretbox.open(cipher, nonce, key);
}

// ─── Get or create the user's embedded Solana wallet ─────────────────────────
export async function getOrCreateWallet(userId: string): Promise<Keypair> {
  // 1. Fast path: device OS keychain (most secure copy, never leaves the device)
  try {
    const raw = await SecureStore.getItemAsync(SECURE_KEY(userId));
    if (raw) return Keypair.fromSecretKey(bs58.decode(raw));
  } catch { /* SecureStore unavailable on some emulators */ }

  // 2. Cross-device restore from Supabase encrypted backup
  const encKey = await deriveKey(userId);
  try {
    const { data } = await supabase
      .from('wallets')
      .select('encrypted_private_key')
      .eq('user_id', userId)
      .single();

    if (data?.encrypted_private_key) {
      const secretKey = decrypt(data.encrypted_private_key, encKey);
      if (secretKey) {
        const kp = Keypair.fromSecretKey(secretKey);
        await SecureStore.setItemAsync(SECURE_KEY(userId), bs58.encode(kp.secretKey)).catch(() => {});
        return kp;
      }
    }
  } catch { /* first login or network error — generate below */ }

  // 3. Generate a brand-new wallet
  const kp = Keypair.generate();
  const encryptedHex = encrypt(kp.secretKey, encKey);

  await Promise.all([
    SecureStore.setItemAsync(SECURE_KEY(userId), bs58.encode(kp.secretKey)).catch(() => {}),
    supabase.from('wallets').upsert({
      user_id: userId,
      public_key: kp.publicKey.toBase58(),
      encrypted_private_key: encryptedHex,
    }).catch(() => {}),
  ]);

  return kp;
}

// Returns base58 private key for the "Export Key" feature
export async function exportWalletKey(userId: string): Promise<string | null> {
  try {
    const raw = await SecureStore.getItemAsync(SECURE_KEY(userId));
    return raw ?? null;
  } catch { return null; }
}

export async function clearWalletCache(userId: string): Promise<void> {
  await SecureStore.deleteItemAsync(SECURE_KEY(userId)).catch(() => {});
}

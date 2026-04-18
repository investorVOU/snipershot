import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import nacl from 'tweetnacl';
import { supabase } from './supabase';

const APP_WALLET_SALT = process.env.EXPO_PUBLIC_WALLET_SALT ?? 'sniper-shot-embedded-v1';
const SECURE_KEY = (userId: string) => `ew_sk_${userId}`;

// ─── Key derivation ───────────────────────────────────────────────────────────
// SHA-256(userId + APP_SALT) → 32-byte nacl.secretbox key.
// APP_SALT lives in EXPO_PUBLIC_ env so it's client-side readable; this means
// server-side encrypted backups are only as safe as Supabase RLS + obscurity.
// The primary copy lives in the device keychain (SecureStore), which is
// protected by the OS (iOS Keychain / Android Keystore). Supabase is a
// cross-device backup only — treat it accordingly.
async function deriveKey(userId: string): Promise<Uint8Array> {
  const hex = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    userId + APP_WALLET_SALT,
    { encoding: Crypto.CryptoEncoding.HEX }
  );
  return Buffer.from(hex, 'hex'); // 32 bytes — exactly what nacl.secretbox needs
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

import { Keypair, PublicKey } from '@solana/web3.js';
import bs58 from 'bs58';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { supabase } from './supabase';

const APP_WALLET_SALT = process.env.EXPO_PUBLIC_WALLET_SALT ?? 'sniper-shot-embedded-v1';
const SECURE_KEY = (userId: string) => `ew_sk_${userId}`;

// ─── Derive 32-byte key from userId + app salt ────────────────────────────────
async function deriveKey(userId: string): Promise<Uint8Array> {
  const hex = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    userId + APP_WALLET_SALT,
    { encoding: Crypto.CryptoEncoding.HEX }
  );
  return Buffer.from(hex, 'hex');
}

// Simple XOR cipher — combined with Supabase RLS this is sufficient for MVP
function xor(data: Uint8Array, key: Uint8Array): Uint8Array {
  const out = new Uint8Array(data.length);
  for (let i = 0; i < data.length; i++) out[i] = data[i] ^ key[i % key.length];
  return out;
}

// ─── Get or create the user's embedded Solana wallet ─────────────────────────
export async function getOrCreateWallet(userId: string): Promise<Keypair> {
  // 1. Fast path: SecureStore (device keychain / keystore)
  try {
    const raw = await SecureStore.getItemAsync(SECURE_KEY(userId));
    if (raw) return Keypair.fromSecretKey(bs58.decode(raw));
  } catch { /* SecureStore unavailable on some simulators */ }

  // 2. Supabase backup (cross-device restore)
  const encKey = await deriveKey(userId);
  try {
    const { data } = await supabase
      .from('wallets')
      .select('encrypted_private_key')
      .eq('user_id', userId)
      .single();

    if (data?.encrypted_private_key) {
      const secretKey = xor(Buffer.from(data.encrypted_private_key, 'hex'), encKey);
      const kp = Keypair.fromSecretKey(secretKey);
      await SecureStore.setItemAsync(SECURE_KEY(userId), bs58.encode(kp.secretKey)).catch(() => {});
      return kp;
    }
  } catch { /* first time or network error — generate below */ }

  // 3. Generate fresh wallet
  const kp = Keypair.generate();
  const encryptedHex = Buffer.from(xor(kp.secretKey, encKey)).toString('hex');

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

export async function exportWalletKey(userId: string): Promise<string | null> {
  try {
    const raw = await SecureStore.getItemAsync(SECURE_KEY(userId));
    return raw ?? null;
  } catch { return null; }
}

export async function clearWalletCache(userId: string): Promise<void> {
  await SecureStore.deleteItemAsync(SECURE_KEY(userId)).catch(() => {});
}

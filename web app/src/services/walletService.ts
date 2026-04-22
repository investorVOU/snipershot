import nacl from 'tweetnacl'
import bs58 from 'bs58'
import { Keypair } from '@solana/web3.js'

const WALLET_STORAGE_PREFIX = 'snipershot_wallet_'

export interface EmbeddedWallet {
  publicKey: string       // base58 public key (Solana address)
  secretKey: number[]     // 64-byte secret key stored as number array
}

function storageKey(userId: string) {
  return `${WALLET_STORAGE_PREFIX}${userId}`
}

export function loadWallet(userId: string): EmbeddedWallet | null {
  try {
    const raw = localStorage.getItem(storageKey(userId))
    if (!raw) return null
    return JSON.parse(raw) as EmbeddedWallet
  } catch {
    return null
  }
}

export function generateWallet(userId: string): EmbeddedWallet {
  const keypair = nacl.sign.keyPair()
  const wallet: EmbeddedWallet = {
    publicKey: bs58.encode(keypair.publicKey),
    secretKey: Array.from(keypair.secretKey),
  }
  localStorage.setItem(storageKey(userId), JSON.stringify(wallet))
  return wallet
}

export function getOrCreateWallet(userId: string): EmbeddedWallet {
  return loadWallet(userId) ?? generateWallet(userId)
}

export function deleteWallet(userId: string) {
  localStorage.removeItem(storageKey(userId))
}

// Returns the full 64-byte secret key as base58 — this is the format
// Phantom / Backpack accept when importing a private key.
export function exportPrivateKeyBase58(wallet: EmbeddedWallet): string {
  return bs58.encode(new Uint8Array(wallet.secretKey))
}

// Returns the raw secret key bytes for transaction signing
export function getSecretKeyBytes(wallet: EmbeddedWallet): Uint8Array {
  return new Uint8Array(wallet.secretKey)
}

export function getKeypair(wallet: EmbeddedWallet): Keypair {
  return Keypair.fromSecretKey(getSecretKeyBytes(wallet))
}

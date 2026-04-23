import type { EmbeddedWallet } from '../../services/walletService'

export function requireEmbeddedWallet(wallet: EmbeddedWallet | null): EmbeddedWallet {
  if (!wallet) throw new Error('Connect your Axyrion wallet to continue.')
  return wallet
}


import { Buffer } from 'buffer'
import { Connection, VersionedTransaction, type Keypair } from '@solana/web3.js'
import type { EmbeddedWallet } from '../../services/walletService'
import { getKeypair } from '../../services/walletService'

const RPC_URL = import.meta.env.VITE_SOLANA_RPC ?? 'https://api.mainnet-beta.solana.com'

export const sharedConnection = new Connection(RPC_URL, 'confirmed')

export function deserializeVersionedTransaction(base64: string): VersionedTransaction {
  return VersionedTransaction.deserialize(Buffer.from(base64, 'base64'))
}

export function signWithWalletAndExtraSigners(wallet: EmbeddedWallet, tx: VersionedTransaction, extraSigners: Keypair[] = []): VersionedTransaction {
  tx.sign([getKeypair(wallet), ...extraSigners])
  return tx
}

export async function sendAndConfirmVersionedTransaction(tx: VersionedTransaction, connection: Connection = sharedConnection): Promise<string> {
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash()
  const signature = await connection.sendRawTransaction(tx.serialize(), {
    skipPreflight: false,
    preflightCommitment: 'confirmed',
  })
  await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, 'confirmed')
  return signature
}


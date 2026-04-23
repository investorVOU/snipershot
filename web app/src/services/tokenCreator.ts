import { Connection, PublicKey, type ParsedTransactionWithMeta, type ConfirmedSignatureInfo } from '@solana/web3.js'

const RPC_URL = import.meta.env.VITE_SOLANA_RPC ?? 'https://api.mainnet-beta.solana.com'
const connection = new Connection(RPC_URL, 'confirmed')
const creatorCache = new Map<string, Promise<string | null>>()

function getSignerKeys(tx: ParsedTransactionWithMeta): string[] {
  return tx.transaction.message.accountKeys
    .filter((account) => account.signer)
    .map((account) => account.pubkey.toBase58())
}

function pickCreatorFromTx(tx: ParsedTransactionWithMeta, mint: string): string | null {
  const signers = getSignerKeys(tx).filter((key) => key !== mint)
  if (signers.length === 0) return null
  return signers[0] ?? null
}

async function fetchOldestSignature(mint: string): Promise<ConfirmedSignatureInfo | null> {
  let before: string | undefined
  let oldest: ConfirmedSignatureInfo | null = null

  for (let page = 0; page < 20; page += 1) {
    const batch = await connection.getSignaturesForAddress(new PublicKey(mint), { before, limit: 1000 }, 'confirmed')
    if (batch.length === 0) break
    oldest = batch[batch.length - 1] ?? oldest
    if (batch.length < 1000) break
    before = batch[batch.length - 1]?.signature
    if (!before) break
  }

  return oldest
}

async function resolveTokenCreatorAddressInner(mint: string): Promise<string | null> {
  try {
    const oldest = await fetchOldestSignature(mint)
    if (!oldest?.signature) return null

    const tx = await connection.getParsedTransaction(oldest.signature, {
      commitment: 'confirmed',
      maxSupportedTransactionVersion: 0,
    })

    if (!tx) return null
    return pickCreatorFromTx(tx, mint)
  } catch {
    return null
  }
}

export async function resolveTokenCreatorAddress(mint: string): Promise<string | null> {
  if (!mint) return null
  const cached = creatorCache.get(mint)
  if (cached) return cached

  const request = resolveTokenCreatorAddressInner(mint)
  creatorCache.set(mint, request)
  return request
}

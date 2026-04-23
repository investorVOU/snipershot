import { PublicKey, VersionedTransaction } from '@solana/web3.js'
import type { EmbeddedWallet } from '../../services/walletService'
import type { JupiterQuoteRoute, SwapTokenOption } from '../../types'
import { SOL_MINT } from '../tokens/catalog'
import { sharedConnection, signWithWalletAndExtraSigners, sendAndConfirmVersionedTransaction } from '../solana/transactions'

const JUPITER_BASE = 'https://lite-api.jup.ag/swap/v1'
const JUPITER_SWAP_API = `${JUPITER_BASE}/swap`

const mintDecimalsCache = new Map<string, number>([[SOL_MINT, 9]])

export async function getMintDecimals(mint: string): Promise<number> {
  const cached = mintDecimalsCache.get(mint)
  if (cached != null) return cached

  try {
    const info = await sharedConnection.getParsedAccountInfo(new PublicKey(mint), 'confirmed')
    const parsed = info.value?.data
    if (parsed && 'parsed' in parsed) {
      const decimals = Number((parsed.parsed as { info?: { decimals?: number } }).info?.decimals)
      if (Number.isFinite(decimals)) {
        mintDecimalsCache.set(mint, decimals)
        return decimals
      }
    }
  } catch {
    // Fall through to default.
  }

  mintDecimalsCache.set(mint, 9)
  return 9
}

export function toRawAmount(uiAmount: number, decimals: number): number {
  return Math.floor(uiAmount * (10 ** decimals))
}

export function toUiAmount(rawAmount: string | number, decimals: number): number {
  return Number(rawAmount) / (10 ** decimals)
}

export async function fetchJupiterQuote(inputMint: string, outputMint: string, amount: number, slippageBps: number): Promise<JupiterQuoteRoute | null> {
  const params = new URLSearchParams({
    inputMint,
    outputMint,
    amount: String(amount),
    slippageBps: String(slippageBps),
    onlyDirectRoutes: 'false',
  })
  try {
    const res = await fetch(`${JUPITER_BASE}/quote?${params.toString()}`)
    if (!res.ok) return null
    const data = (await res.json()) as JupiterQuoteRoute | { data?: JupiterQuoteRoute[] }
    if ('data' in data) {
      return Array.isArray(data.data) ? (data.data[0] ?? null) : null
    }
    return 'inputMint' in data ? data : null
  } catch {
    return null
  }
}

async function buildSwapTransaction(quoteResponse: JupiterQuoteRoute, userPublicKey: string): Promise<VersionedTransaction> {
  const res = await fetch(JUPITER_SWAP_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      quoteResponse,
      userPublicKey,
      wrapAndUnwrapSol: true,
      dynamicComputeUnitLimit: true,
      dynamicSlippage: true,
    }),
  })
  if (!res.ok) throw new Error(`Jupiter swap build failed: ${res.status}`)
  const data = (await res.json()) as { swapTransaction: string }
  return VersionedTransaction.deserialize(Uint8Array.from(atob(data.swapTransaction), (c) => c.charCodeAt(0)))
}

export async function executeJupiterSwap(inputToken: SwapTokenOption, outputToken: SwapTokenOption, amount: number, slippageBps: number, wallet: EmbeddedWallet): Promise<{ quote: JupiterQuoteRoute; signature: string; outputAmount: number }> {
  const rawAmount = toRawAmount(amount, inputToken.decimals)
  const quote = await fetchJupiterQuote(inputToken.mint, outputToken.mint, rawAmount, slippageBps)
  if (!quote) throw new Error('No route available yet.')
  const tx = await buildSwapTransaction(quote, wallet.publicKey)
  const signed = signWithWalletAndExtraSigners(wallet, tx)
  const signature = await sendAndConfirmVersionedTransaction(signed)
  return {
    quote,
    signature,
    outputAmount: toUiAmount(quote.outAmount, outputToken.decimals),
  }
}

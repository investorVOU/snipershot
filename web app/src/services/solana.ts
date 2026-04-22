import { Buffer } from 'buffer'
import {
  Connection,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
  VersionedTransaction,
} from '@solana/web3.js'
import type { EmbeddedWallet } from './walletService'
import { getKeypair } from './walletService'
import { supabase } from './supabase'

const RPC_URL = import.meta.env.VITE_SOLANA_RPC ?? 'https://api.mainnet-beta.solana.com'
const JUPITER_QUOTE_API = 'https://quote-api.jup.ag/v6'
const JUPITER_SWAP_API = 'https://quote-api.jup.ag/v6/swap'
const NATIVE_MINT = 'So11111111111111111111111111111111111111112'

const connection = new Connection(RPC_URL, 'confirmed')

interface JupiterQuote {
  outAmount: string
}

interface SwapResult {
  txSig: string
  inputAmount: number
  outputAmount: number
}

const mintDecimalsCache = new Map<string, number>()

function userPubkeyForSupabase(userId: string): string {
  return userId
}

export function getConnection(): Connection {
  return connection
}

export function signVersionedTransaction(wallet: EmbeddedWallet, tx: VersionedTransaction): VersionedTransaction {
  const keypair = getKeypair(wallet)
  tx.sign([keypair])
  return tx
}

async function getMintDecimals(mint: string): Promise<number> {
  const cached = mintDecimalsCache.get(mint)
  if (cached != null) return cached

  try {
    const info = await connection.getParsedAccountInfo(new PublicKey(mint), 'confirmed')
    const parsed = info.value?.data
    if (parsed && 'parsed' in parsed) {
      const decimals = Number((parsed.parsed as { info?: { decimals?: number } }).info?.decimals)
      if (Number.isFinite(decimals)) {
        mintDecimalsCache.set(mint, decimals)
        return decimals
      }
    }
  } catch {
    // Fall through to the standard Solana token default.
  }

  mintDecimalsCache.set(mint, 9)
  return 9
}

function toUiAmount(rawAmount: number, decimals: number): number {
  return rawAmount / (10 ** decimals)
}

function toRawAmount(uiAmount: number, decimals: number): number {
  return Math.floor(uiAmount * (10 ** decimals))
}

async function getQuote(inputMint: string, outputMint: string, amount: number, slippageBps: number): Promise<JupiterQuote> {
  const params = new URLSearchParams({
    inputMint,
    outputMint,
    amount: String(amount),
    slippageBps: String(slippageBps),
  })

  const res = await fetch(`${JUPITER_QUOTE_API}/quote?${params.toString()}`)
  if (!res.ok) throw new Error(`Jupiter quote failed: ${res.status}`)
  return (await res.json()) as JupiterQuote
}

async function buildSwapTransaction(quoteResponse: JupiterQuote, userPublicKey: string): Promise<VersionedTransaction> {
  const res = await fetch(JUPITER_SWAP_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      quoteResponse,
      userPublicKey,
      wrapAndUnwrapSol: true,
      dynamicComputeUnitLimit: true,
    }),
  })

  if (!res.ok) throw new Error(`Jupiter swap build failed: ${res.status}`)
  const data = (await res.json()) as { swapTransaction: string }
  const txBuffer = Buffer.from(data.swapTransaction, 'base64')
  return VersionedTransaction.deserialize(txBuffer)
}

async function sendVersionedTransaction(tx: VersionedTransaction): Promise<string> {
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash()
  const signature = await connection.sendRawTransaction(tx.serialize(), {
    skipPreflight: false,
    preflightCommitment: 'confirmed',
  })
  await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, 'confirmed')
  return signature
}

export async function executeBuy(
  wallet: EmbeddedWallet,
  mint: string,
  amountSol: number,
  slippageBps: number
): Promise<SwapResult> {
  const lamports = Math.floor(amountSol * LAMPORTS_PER_SOL)
  const quote = await getQuote(NATIVE_MINT, mint, lamports, slippageBps)
  const tx = await buildSwapTransaction(quote, wallet.publicKey)
  const signed = signVersionedTransaction(wallet, tx)
  const txSig = await sendVersionedTransaction(signed)
  return {
    txSig,
    inputAmount: lamports,
    outputAmount: Number(quote.outAmount),
  }
}

export async function executeSell(
  wallet: EmbeddedWallet,
  mint: string,
  amountTokens: number,
  slippageBps: number
): Promise<SwapResult> {
  const decimals = await getMintDecimals(mint)
  const rawAmount = toRawAmount(amountTokens, decimals)
  const quote = await getQuote(mint, NATIVE_MINT, rawAmount, slippageBps)
  const tx = await buildSwapTransaction(quote, wallet.publicKey)
  const signed = signVersionedTransaction(wallet, tx)
  const txSig = await sendVersionedTransaction(signed)
  return {
    txSig,
    inputAmount: rawAmount,
    outputAmount: Number(quote.outAmount),
  }
}

export async function sendSOL(wallet: EmbeddedWallet, toAddress: string, amountSol: number): Promise<string> {
  const keypair = getKeypair(wallet)
  const toPubkey = new PublicKey(toAddress)
  const lamports = Math.floor(amountSol * LAMPORTS_PER_SOL)
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed')
  const tx = new Transaction({
    recentBlockhash: blockhash,
    feePayer: keypair.publicKey,
  }).add(SystemProgram.transfer({
    fromPubkey: keypair.publicKey,
    toPubkey,
    lamports,
  }))

  tx.sign(keypair)
  const sig = await connection.sendRawTransaction(tx.serialize(), { skipPreflight: false })
  await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, 'confirmed')
  return sig
}

export async function getSolBalance(address: string): Promise<number> {
  const lamports = await connection.getBalance(new PublicKey(address))
  return lamports / LAMPORTS_PER_SOL
}

export async function logWebTrade(params: {
  userId: string
  type: 'buy' | 'sell'
  mint: string
  tokenName: string
  tokenSymbol: string
  tokenImageUri: string
  amountSOL: number
  amountTokens: number
  pricePerToken: number
  txSig: string
}): Promise<void> {
  const timestamp = new Date().toISOString()
  const tradeId = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${params.mint}`
  const primary = {
    user_pubkey: userPubkeyForSupabase(params.userId),
    mint: params.mint,
    token_name: params.tokenName,
    token_symbol: params.tokenSymbol,
    token_image_uri: params.tokenImageUri,
    type: params.type,
    amount_sol: params.amountSOL,
    amount_tokens: params.amountTokens,
    price_per_token: params.pricePerToken,
    tx_sig: params.txSig,
    created_at: timestamp,
  }
  const fallback = {
    id: tradeId,
    timestamp,
    user_pubkey: userPubkeyForSupabase(params.userId),
    token_mint: params.mint,
    token_name: params.tokenName,
    token_symbol: params.tokenSymbol,
    type: params.type,
    amount_sol: params.amountSOL,
    amount_tokens: params.amountTokens,
    price_per_token: params.pricePerToken,
    tx_sig: params.txSig,
    fee_lamports: 0,
  }

  const primaryRes = await supabase.from('trades').insert(primary)
  if (primaryRes.error == null && primaryRes.status >= 200 && primaryRes.status < 300) return

  const fallbackRes = await supabase.from('trades').insert(fallback)
  if (fallbackRes.error) throw fallbackRes.error
}

export async function openWebPosition(params: {
  userId: string
  mint: string
  tokenName: string
  tokenSymbol: string
  tokenImageUri: string
  entryPriceSOL: number
  amountTokens: number
  amountSOL: number
  tradeId?: string
}): Promise<void> {
  const timestamp = new Date().toISOString()
  const primary = {
    user_pubkey: userPubkeyForSupabase(params.userId),
    mint: params.mint,
    token_name: params.tokenName,
    token_symbol: params.tokenSymbol,
    token_image_uri: params.tokenImageUri,
    entry_price_sol: params.entryPriceSOL,
    amount_tokens: params.amountTokens,
    amount_sol: params.amountSOL,
    created_at: timestamp,
  }
  const primaryRes = await supabase.from('positions').upsert(primary, { onConflict: 'user_pubkey,mint' })
  if (primaryRes.error == null && primaryRes.status >= 200 && primaryRes.status < 300) return

  const fallback = {
    mint: params.mint,
    trade_id: params.tradeId ?? (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${params.mint}`),
    user_pubkey: userPubkeyForSupabase(params.userId),
    token_name: params.tokenName,
    token_symbol: params.tokenSymbol,
    image_uri: params.tokenImageUri,
    entry_price_sol: params.entryPriceSOL,
    amount_tokens: params.amountTokens,
    amount_sol_spent: params.amountSOL,
    opened_at: timestamp,
    closed: false,
  }
  const fallbackRes = await supabase.from('positions').insert(fallback)
  if (fallbackRes.error) throw fallbackRes.error
}

export async function closeWebPosition(userId: string, mint: string): Promise<void> {
  const primaryRes = await supabase.from('positions').delete().eq('user_pubkey', userPubkeyForSupabase(userId)).eq('mint', mint)
  if (primaryRes.error == null && primaryRes.status >= 200 && primaryRes.status < 300) return

  const fallbackRes = await supabase
    .from('positions')
    .update({ closed: true, closed_at: new Date().toISOString() })
    .eq('user_pubkey', userPubkeyForSupabase(userId))
    .eq('mint', mint)
    .eq('closed', false)
  if (fallbackRes.error) throw fallbackRes.error
}

export async function buyTokenForUser(params: {
  wallet: EmbeddedWallet
  userId: string
  mint: string
  tokenName: string
  tokenSymbol: string
  tokenImageUri: string
  amountSol: number
  slippageBps: number
}): Promise<string> {
  const result = await executeBuy(params.wallet, params.mint, params.amountSol, params.slippageBps)
  const decimals = await getMintDecimals(params.mint)
  const uiAmountTokens = toUiAmount(result.outputAmount, decimals)
  const pricePerToken = uiAmountTokens > 0 ? params.amountSol / uiAmountTokens : 0

  await logWebTrade({
    userId: params.userId,
    type: 'buy',
    mint: params.mint,
    tokenName: params.tokenName,
    tokenSymbol: params.tokenSymbol,
    tokenImageUri: params.tokenImageUri,
    amountSOL: params.amountSol,
    amountTokens: uiAmountTokens,
    pricePerToken,
    txSig: result.txSig,
  })

  await openWebPosition({
    userId: params.userId,
    mint: params.mint,
    tokenName: params.tokenName,
    tokenSymbol: params.tokenSymbol,
    tokenImageUri: params.tokenImageUri,
    entryPriceSOL: pricePerToken,
    amountTokens: uiAmountTokens,
    amountSOL: params.amountSol,
    tradeId: result.txSig,
  })

  return result.txSig
}

export async function sellTokenForUser(params: {
  wallet: EmbeddedWallet
  userId: string
  mint: string
  tokenName: string
  tokenSymbol: string
  tokenImageUri: string
  amountTokens: number
  slippageBps?: number
}): Promise<string> {
  const result = await executeSell(params.wallet, params.mint, params.amountTokens, params.slippageBps ?? 1500)
  const solReceived = result.outputAmount / LAMPORTS_PER_SOL
  const pricePerToken = params.amountTokens > 0 ? solReceived / params.amountTokens : 0

  await logWebTrade({
    userId: params.userId,
    type: 'sell',
    mint: params.mint,
    tokenName: params.tokenName,
    tokenSymbol: params.tokenSymbol,
    tokenImageUri: params.tokenImageUri,
    amountSOL: solReceived,
    amountTokens: params.amountTokens,
    pricePerToken,
    txSig: result.txSig,
  })

  await closeWebPosition(params.userId, params.mint)
  return result.txSig
}

export type MoralisInterval = '1min' | '5min' | '15min' | '1h' | '4h' | '1d'

export interface MoralisBondingStatus {
  hasGraduated: boolean
  bondingProgress: number
}

export interface MoralisCandle {
  timestamp: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

interface MoralisSwapSide {
  address?: string
  amount?: string
  usdAmount?: number
  usdPrice?: number
}

export interface MoralisSwap {
  blockTime?: string
  totalValueUsd?: number
  bought?: MoralisSwapSide
  sold?: MoralisSwapSide
  tokenIn?: MoralisSwapSide
  tokenOut?: MoralisSwapSide
}

const MORALIS_BASE = 'https://solana-gateway.moralis.io/token/mainnet'

function sanitizeTokenAddress(tokenAddress: string): string {
  return encodeURIComponent(tokenAddress.trim())
}

async function moralisGet<T>(path: string, apiKey: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(`${MORALIS_BASE}${path}`, {
    headers: {
      'X-API-Key': apiKey,
    },
    signal,
  })

  if (!res.ok) {
    throw new Error(`Moralis request failed: ${res.status}`)
  }

  return (await res.json()) as T
}

export async function fetchMoralisBondingStatus(tokenAddress: string, apiKey: string, signal?: AbortSignal): Promise<MoralisBondingStatus> {
  const safeAddress = sanitizeTokenAddress(tokenAddress)
  return moralisGet<MoralisBondingStatus>(`/${safeAddress}/bonding-status`, apiKey, signal)
}

export async function fetchMoralisOHLCV(
  tokenAddress: string,
  apiKey: string,
  timeframe: MoralisInterval,
  limit = 200,
  signal?: AbortSignal
): Promise<MoralisCandle[]> {
  const safeAddress = sanitizeTokenAddress(tokenAddress)
  const url = new URL(`${MORALIS_BASE}/${safeAddress}/ohlcv`)
  url.searchParams.set('timeframe', timeframe)
  url.searchParams.set('limit', String(limit))

  const res = await fetch(url.toString(), {
    headers: {
      'X-API-Key': apiKey,
    },
    signal,
  })

  if (!res.ok) {
    throw new Error(`Moralis OHLCV failed: ${res.status}`)
  }

  return (await res.json()) as MoralisCandle[]
}

export async function fetchMoralisSwaps(
  tokenAddress: string,
  apiKey: string,
  limit = 200,
  signal?: AbortSignal
): Promise<MoralisSwap[]> {
  const safeAddress = sanitizeTokenAddress(tokenAddress)
  const url = new URL(`${MORALIS_BASE}/${safeAddress}/swaps`)
  url.searchParams.set('limit', String(limit))
  url.searchParams.set('order', 'ASC')
  url.searchParams.set('transactionTypes', 'buy,sell')

  const res = await fetch(url.toString(), {
    headers: {
      'X-API-Key': apiKey,
    },
    signal,
  })

  if (!res.ok) {
    throw new Error(`Moralis swaps failed: ${res.status}`)
  }

  const data = (await res.json()) as { result?: MoralisSwap[] }
  return data.result ?? []
}

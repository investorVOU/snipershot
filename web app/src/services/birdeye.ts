import type { TokenOverview, OHLCVBar } from '../types'
import { fetchDexScreenerSnapshot } from './pumpfun'
import { fetchJupiterPrice } from './jupiter'

const BIRDEYE_PROXY = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/birdeye-proxy`
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY ?? ''
const BIRDEYE_KEY = import.meta.env.VITE_BIRDEYE_KEY ?? ''
const BIRDEYE_BASE = 'https://public-api.birdeye.so'
const BIRDEYE_TIMEOUT_MS = 12000
const NEGATIVE_CACHE_TTL_MS = 60_000

const negativeCache = new Map<string, number>()

function cacheKey(path: string, params: Record<string, string>): string {
  const serialized = Object.entries(params)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('&')
  return `${path}?${serialized}`
}

function shouldSkipRequest(key: string): boolean {
  const expiresAt = negativeCache.get(key)
  if (!expiresAt) return false
  if (expiresAt > Date.now()) return true
  negativeCache.delete(key)
  return false
}

function markRequestFailed(key: string) {
  negativeCache.set(key, Date.now() + NEGATIVE_CACHE_TTL_MS)
}

async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs = BIRDEYE_TIMEOUT_MS): Promise<Response> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  return fetch(url, { ...options, signal: ctrl.signal }).finally(() => clearTimeout(timer))
}

async function tryProxy<T>(path: string, params: Record<string, string>): Promise<T | null> {
  const res = await fetchWithTimeout(BIRDEYE_PROXY, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${SUPABASE_ANON}`,
    },
    body: JSON.stringify({ path, params }),
  })

  if (res.status === 400 || res.status === 404) return null
  if (!res.ok) throw new Error(`Birdeye proxy failed: ${res.status}`)
  return (await res.json()) as T
}

async function tryDirect<T>(path: string, params: Record<string, string>): Promise<T | null> {
  if (!BIRDEYE_KEY) return null

  const url = new URL(`${BIRDEYE_BASE}${path}`)
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value))

  const res = await fetchWithTimeout(url.toString(), {
    headers: {
      'X-API-KEY': BIRDEYE_KEY,
      'x-chain': 'solana',
    },
  })

  if (res.status === 400 || res.status === 404) return null
  if (!res.ok) throw new Error(`Birdeye direct failed: ${res.status}`)
  return (await res.json()) as T
}

async function birdeyeGet<T>(path: string, params: Record<string, string>): Promise<T | null> {
  const key = cacheKey(path, params)
  if (shouldSkipRequest(key)) return null

  try {
    const proxied = await tryProxy<T>(path, params)
    if (proxied) return proxied
  } catch {
    // Fall through to direct.
  }

  try {
    const direct = await tryDirect<T>(path, params)
    if (direct) return direct
  } catch {
    // Treat as unavailable and use fallback sources.
  }

  markRequestFailed(key)
  return null
}

interface BirdeyeOverviewResp {
  data?: {
    price?: number
    priceChange1hPercent?: number
    priceChange24hPercent?: number
    mc?: number
    v24hUSD?: number
    liquidity?: number
    holder?: number
    fdv?: number
  }
}

interface BirdeyeHolderResp {
  data?: {
    items?: Array<unknown>
    total?: number
  }
}

interface BirdeyeOHLCVResp {
  data?: {
    items?: Array<{
      unixTime: number
      o: number
      h: number
      l: number
      c: number
      v: number
    }>
  }
}

interface BirdeyePriceResp {
  data?: { value?: number }
}

interface BirdeyeSecurityResp {
  data?: {
    mintAuthority?: string | null
    freezeAuthority?: string | null
    top10HolderPercent?: number
    creatorBalance?: number
    totalSupply?: number
  }
}

export async function fetchTokenOverview(mint: string): Promise<TokenOverview | null> {
  const data = await birdeyeGet<BirdeyeOverviewResp>('/defi/token_overview', { address: mint })
  const d = data?.data
  if (d) {
    return {
      price: d.price ?? 0,
      priceChange1h: d.priceChange1hPercent ?? 0,
      priceChange24h: d.priceChange24hPercent ?? 0,
      marketCap: d.mc ?? 0,
      volume24h: d.v24hUSD ?? 0,
      liquidity: d.liquidity ?? 0,
      holders: d.holder ?? 0,
      fdv: d.fdv ?? 0,
    }
  }

  const fallback = await fetchDexScreenerSnapshot(mint)
  if (!fallback) return null

  return {
    ...fallback.overview,
    holders: 0,
  }
}

export async function fetchTokenHoldersCount(mint: string): Promise<number | null> {
  const data = await birdeyeGet<BirdeyeHolderResp>('/defi/v3/token/holder', {
    address: mint,
    offset: '0',
    limit: '1',
  })
  if (!data?.data) return null
  if (typeof data.data.total === 'number') return data.data.total
  if (Array.isArray(data.data.items)) return data.data.items.length
  return null
}

export async function fetchOHLCV(mint: string, resolution = '1m', limit = 60): Promise<OHLCVBar[]> {
  const to = Math.floor(Date.now() / 1000)
  const seconds = resolution === '1H' ? 3600 : 60
  const from = to - limit * seconds
  const data = await birdeyeGet<BirdeyeOHLCVResp>('/defi/ohlcv', {
    address: mint,
    type: resolution,
    time_from: String(from),
    time_to: String(to),
  })

  return (data?.data?.items ?? []).map((bar) => ({
    time: bar.unixTime,
    open: bar.o,
    high: bar.h,
    low: bar.l,
    close: bar.c,
    volume: bar.v,
  }))
}

export async function fetchPrice(mint: string): Promise<number> {
  const data = await birdeyeGet<BirdeyePriceResp>('/defi/price', { address: mint })
  if (typeof data?.data?.value === 'number') return data.data.value

  const fallback = await fetchDexScreenerSnapshot(mint)
  if (fallback?.overview.price) return fallback.overview.price

  const jupiterPrice = await fetchJupiterPrice(mint)
  return jupiterPrice ?? 0
}

export async function fetchTokenSecurity(mint: string) {
  const data = await birdeyeGet<BirdeyeSecurityResp>('/defi/token_security', { address: mint })
  return data?.data ?? null
}

export interface TrendingToken {
  address: string
  name: string
  symbol: string
  logoURI: string
  price: number
  priceChange24h: number
  volume24h: number
  marketCap: number
}

interface BirdeyeTrendingResp {
  data?: { tokens?: Record<string, unknown>[] }
}

export async function fetchTrendingTokens(limit = 30): Promise<TrendingToken[]> {
  const data = await birdeyeGet<BirdeyeTrendingResp>('/defi/token_trending', {
    sort_by: 'rank',
    sort_type: 'asc',
    offset: '0',
    limit: String(limit),
  })

  return (data?.data?.tokens ?? []).map((token) => ({
    address: (token.address as string) ?? '',
    name: (token.name as string) ?? 'Unknown',
    symbol: (token.symbol as string) ?? '???',
    logoURI: (token.logoURI as string) ?? '',
    price: (token.price as number) ?? 0,
    priceChange24h: (token.price24hChangePercent as number) ?? 0,
    volume24h: (token.volume24hUSD as number) ?? 0,
    marketCap: (token.mc as number) ?? 0,
  }))
}

export async function fetchSOLPrice(): Promise<number> {
  const solMint = 'So11111111111111111111111111111111111111112'
  return fetchPrice(solMint)
}

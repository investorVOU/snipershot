import type { FeedToken } from '../types'

const IS_DEV = import.meta.env.DEV
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? ''
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY ?? ''
const DEX_BASE = 'https://api.dexscreener.com'

async function dexGet<T>(path: string): Promise<T> {
  // 1. Vite dev proxy
  if (IS_DEV) {
    const res = await fetch(`/dexscreener${path}`)
    if (res.ok) return res.json() as Promise<T>
  }
  // 2. Supabase edge proxy
  const res = await fetch(`${SUPABASE_URL}/functions/v1/dexscreener-proxy`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SUPABASE_ANON}` },
    body: JSON.stringify({ path }),
  })
  if (res.ok) return res.json() as Promise<T>
  // 3. Direct (fallback)
  const direct = await fetch(`${DEX_BASE}${path}`)
  if (!direct.ok) throw new Error(`DexScreener ${direct.status}`)
  return direct.json() as Promise<T>
}

export interface DexHotToken {
  address: string
  name: string
  symbol: string
  logoURI: string
  price: number
  priceChange24h: number
  volume24h: number
  marketCap: number
  liquidity: number
  createdAt: number
}

interface DexProfile {
  chainId?: string
  tokenAddress?: string
  icon?: string
  header?: string
  description?: string
}

interface DexBoost {
  chainId?: string
  tokenAddress?: string
  amount?: number
  totalAmount?: number
}

interface DexPair {
  chainId?: string
  pairAddress?: string
  pairCreatedAt?: number
  baseToken?: { address?: string; name?: string; symbol?: string }
  info?: { imageUrl?: string }
  priceUsd?: string
  liquidity?: { usd?: number }
  volume?: { h24?: number }
  priceChange?: { h24?: number }
  fdv?: number
  marketCap?: number
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size))
  return chunks
}

export async function fetchDexHotTokens(limit = 30, chain = 'solana'): Promise<DexHotToken[]> {
  const normalizedChain = chain.toLowerCase()
  const [profiles, boostsLatest, boostsTop] = await Promise.all([
    dexGet<DexProfile[]>('/token-profiles/latest/v1').catch(() => [] as DexProfile[]),
    dexGet<DexBoost[]>('/token-boosts/latest/v1').catch(() => [] as DexBoost[]),
    dexGet<DexBoost[]>('/token-boosts/top/v1').catch(() => [] as DexBoost[]),
  ])

  const addressSet = new Set<string>()
  profiles.forEach((item) => {
    if (item.chainId?.toLowerCase() === normalizedChain && item.tokenAddress) addressSet.add(item.tokenAddress)
  })
  ;[...boostsLatest, ...boostsTop].forEach((item) => {
    if (item.chainId?.toLowerCase() === normalizedChain && item.tokenAddress) addressSet.add(item.tokenAddress)
  })

  const addresses = Array.from(addressSet).slice(0, 60)
  if (addresses.length === 0) return []

  const pairResults = await Promise.all(
    chunk(addresses, 30).map((group) =>
      dexGet<DexPair[]>(`/tokens/v1/${normalizedChain}/${group.join(',')}`).catch(() => [] as DexPair[])
    )
  )

  return pairResults.flat()
    .filter((pair) => (pair.liquidity?.usd ?? 0) > 0)
    .sort((a, b) => ((b.volume?.h24 ?? 0) + (b.liquidity?.usd ?? 0)) - ((a.volume?.h24 ?? 0) + (a.liquidity?.usd ?? 0)))
    .slice(0, limit)
    .map((pair) => ({
      address: pair.baseToken?.address ?? '',
      name: pair.baseToken?.name ?? 'Unknown',
      symbol: pair.baseToken?.symbol ?? '???',
      logoURI: pair.info?.imageUrl ?? '',
      price: Number(pair.priceUsd ?? 0) || 0,
      priceChange24h: pair.priceChange?.h24 ?? 0,
      volume24h: pair.volume?.h24 ?? 0,
      marketCap: pair.marketCap ?? pair.fdv ?? 0,
      liquidity: pair.liquidity?.usd ?? 0,
      createdAt: pair.pairCreatedAt ?? Date.now(),
    }))
}

export function mapDexHotTokenToFeed(token: DexHotToken): FeedToken {
  return {
    mint: token.address,
    name: token.name,
    symbol: token.symbol,
    imageUri: token.logoURI,
    description: '',
    creatorAddress: '',
    createdTimestamp: token.createdAt,
    marketCap: token.marketCap,
    usdMarketCap: token.marketCap,
    solInCurve: 0,
    complete: true,
    twitterUrl: '',
    telegramUrl: '',
    websiteUrl: '',
    totalSupply: 0,
    rugFilter: null,
    rugFilterLoading: true,
    overview: {
      price: token.price,
      priceChange1h: 0,
      priceChange24h: token.priceChange24h,
      marketCap: token.marketCap,
      volume24h: token.volume24h,
      liquidity: token.liquidity,
      holders: 0,
      fdv: token.marketCap,
    },
    sparklineData: [],
    isNewest: false,
    aiRating: null,
    aiRatingLoading: false,
    creatorDumped: false,
    creatorDumpPct: 0,
    fromCache: false,
  }
}

import type { PumpfunToken } from '../types'
import { toHttpUrl } from './format'

// ─── Shared helpers ─────────────────────────────────────────────────────────

async function safeFetch<T>(url: string, timeoutMs = 6000): Promise<T | null> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(url, { signal: ctrl.signal })
    if (!res.ok) return null
    return (await res.json()) as T
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

function extractArray(data: unknown): Record<string, unknown>[] {
  if (!data) return []
  if (Array.isArray(data)) return data as Record<string, unknown>[]
  if (typeof data === 'object') {
    const d = data as Record<string, unknown>
    for (const key of ['data', 'tokens', 'coins', 'results', 'items', 'list']) {
      if (Array.isArray(d[key])) return d[key] as Record<string, unknown>[]
    }
  }
  return []
}

function coerceStr(v: unknown): string {
  return typeof v === 'string' ? v : ''
}

function coerceNum(v: unknown): number {
  return typeof v === 'number' ? v : (typeof v === 'string' ? parseFloat(v) || 0 : 0)
}

function coerceMint(coin: Record<string, unknown>): string {
  return coerceStr(coin.mint ?? coin.address ?? coin.tokenAddress ?? coin.token_address ?? coin.ca ?? '')
}

function coerceTimestamp(coin: Record<string, unknown>): number {
  const raw = coin.created_timestamp ?? coin.createdAt ?? coin.created_at ?? coin.timestamp ?? coin.launch_time
  const n = coerceNum(raw)
  if (!n) return Date.now()
  // Handle both seconds and milliseconds
  return n < 1e12 ? n * 1000 : n
}

function mapGenericCoin(coin: Record<string, unknown>, source: string): PumpfunToken | null {
  const mint = coerceMint(coin)
  if (!mint || mint.length < 32) return null
  return {
    mint,
    name: coerceStr(coin.name ?? coin.token_name ?? ''),
    symbol: coerceStr(coin.symbol ?? coin.ticker ?? coin.token_symbol ?? ''),
    imageUri: toHttpUrl(coerceStr(coin.image_uri ?? coin.imageUri ?? coin.image ?? coin.uri ?? coin.logo ?? '')),
    description: coerceStr(coin.description ?? coin.desc ?? ''),
    creatorAddress: coerceStr(coin.creator ?? coin.traderPublicKey ?? coin.deployer ?? coin.owner ?? ''),
    createdTimestamp: coerceTimestamp(coin),
    marketCap: coerceNum(coin.usd_market_cap ?? coin.marketCap ?? coin.market_cap ?? coin.mcap ?? 0),
    usdMarketCap: coerceNum(coin.usd_market_cap ?? coin.marketCap ?? coin.market_cap ?? 0),
    solInCurve: coerceNum(coin.sol_in_bonding_curve ?? coin.solInCurve ?? coin.sol ?? 0),
    complete: Boolean(coin.complete ?? coin.graduated ?? coin.raydium_pool ?? false),
    twitterUrl: coerceStr(coin.twitter ?? coin.twitter_url ?? coin.twitterUrl ?? ''),
    telegramUrl: coerceStr(coin.telegram ?? coin.telegram_url ?? coin.telegramUrl ?? ''),
    websiteUrl: coerceStr(coin.website ?? coin.website_url ?? coin.websiteUrl ?? ''),
    totalSupply: coerceNum(coin.total_supply ?? coin.totalSupply ?? coin.supply ?? 1_000_000_000),
  }
}

// ─── bags.fm ─────────────────────────────────────────────────────────────────

const BAGS_ENDPOINTS: string[] = [
  // Browser-side Bags endpoints are unstable or blocked by CORS.
  // Keep this empty until a server-side proxy is added.
]

export async function fetchBagsNewTokens(): Promise<PumpfunToken[]> {
  for (const url of BAGS_ENDPOINTS) {
    const data = await safeFetch<unknown>(url)
    if (!data) continue
    const coins = extractArray(data)
    if (coins.length === 0) continue
    const tokens = coins.map((c) => mapGenericCoin(c, 'bags')).filter((t): t is PumpfunToken => t !== null)
    if (tokens.length > 0) return tokens
  }
  return []
}

// ─── bonk.fun ────────────────────────────────────────────────────────────────

const BONKFUN_ENDPOINTS: string[] = [
  // Browser-side Bonk.fun endpoints are unstable or DNS-blocked.
  // Keep this empty until a server-side proxy is added.
]

export async function fetchBonkFunNewTokens(): Promise<PumpfunToken[]> {
  for (const url of BONKFUN_ENDPOINTS) {
    const data = await safeFetch<unknown>(url)
    if (!data) continue
    const coins = extractArray(data)
    if (coins.length === 0) continue
    const tokens = coins.map((c) => mapGenericCoin(c, 'bonkfun')).filter((t): t is PumpfunToken => t !== null)
    if (tokens.length > 0) return tokens
  }
  return []
}

// ─── Combined ────────────────────────────────────────────────────────────────

export async function fetchAllPlatformNewTokens(): Promise<PumpfunToken[]> {
  const [bags, bonk] = await Promise.allSettled([
    fetchBagsNewTokens(),
    fetchBonkFunNewTokens(),
  ])
  return [
    ...(bags.status === 'fulfilled' ? bags.value : []),
    ...(bonk.status === 'fulfilled' ? bonk.value : []),
  ]
}

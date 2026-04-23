import { toHttpUrl } from './format'
import type { PumpfunToken } from '../types'

const PUMPPORTAL_WS = 'wss://pumpportal.fun/api/data'

// NOTE: frontend-api.pump.fun blocks CORS from browsers.
// All token data comes from the PumpPortal WebSocket event stream, which carries
// name/symbol/uri/creator inline, so no HTTP API calls are needed for the live feed.

interface PumpPortalEvent {
  signature: string
  mint: string
  traderPublicKey: string
  txType: string
  name?: string
  symbol?: string
  uri?: string
  marketCapSol?: number
  vSolInBondingCurve?: number
  tokenTotalSupply?: number
  initialBuy?: number
  newTokenCreator?: string
  metadata?: {
    name?: string
    symbol?: string
    image?: string
    description?: string
  }
}

interface MetadataJson {
  name?: string
  symbol?: string
  image?: string
  description?: string
}

interface DexScreenerPair {
  pairCreatedAt?: number
  fdv?: number
  marketCap?: number
  priceUsd?: string
  liquidity?: { usd?: number }
  volume?: { h24?: number }
  priceChange?: { h24?: number; h1?: number }
  info?: {
    imageUrl?: string
    websites?: Array<{ url?: string }>
    socials?: Array<{ type?: string; url?: string }>
  }
  baseToken?: {
    name?: string
    symbol?: string
  }
}

interface DexScreenerResp {
  pairs?: DexScreenerPair[]
}

async function fetchMetaJson(uri: string): Promise<MetadataJson> {
  const url = toHttpUrl(uri)
  if (!url) return {}
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 4000)
  try {
    const res = await fetch(url, { signal: ctrl.signal })
    if (!res.ok) return {}
    return (await res.json()) as MetadataJson
  } catch {
    return {}
  } finally {
    clearTimeout(timer)
  }
}

export type TokenCallback = (token: PumpfunToken) => void

export function subscribePumpPortal(onNewToken: TokenCallback): () => void {
  let ws: WebSocket | null = null
  let closed = false
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null

  const connect = () => {
    if (closed) return
    try {
      ws = new WebSocket(PUMPPORTAL_WS)
    } catch {
      if (!closed) reconnectTimer = setTimeout(connect, 5000)
      return
    }

    ws.onopen = () => {
      ws?.send(JSON.stringify({ method: 'subscribeNewToken' }))
    }

    ws.onmessage = async (msg) => {
      try {
        const event = JSON.parse(msg.data as string) as PumpPortalEvent
        if (!event.mint) return
        if (event.txType !== 'create') return

        let meta: MetadataJson = {}
        if (event.uri) {
          meta = await fetchMetaJson(event.uri)
        }

        const token: PumpfunToken = {
          mint: event.mint,
          name: meta.name ?? event.name ?? 'Unknown',
          symbol: meta.symbol ?? event.symbol ?? '???',
          imageUri: toHttpUrl(meta.image ?? ''),
          description: meta.description ?? '',
          creatorAddress: event.newTokenCreator ?? event.traderPublicKey ?? '',
          createdTimestamp: Date.now(),
          marketCap: event.marketCapSol ?? 0,
          usdMarketCap: 0,
          solInCurve: (event.vSolInBondingCurve ?? 0) / 1_000_000_000,
          complete: false,
          twitterUrl: '',
          telegramUrl: '',
          websiteUrl: '',
          totalSupply: event.tokenTotalSupply ?? 1_000_000_000,
          launchSource: 'pumpfun',
        }

        onNewToken(token)
      } catch {
        // Ignore malformed events.
      }
    }

    ws.onclose = () => {
      if (!closed) reconnectTimer = setTimeout(connect, 3000)
    }

    ws.onerror = () => ws?.close()
  }

  connect()

  return () => {
    closed = true
    if (reconnectTimer) clearTimeout(reconnectTimer)
    ws?.close()
  }
}

export async function fetchRecentTokens(): Promise<PumpfunToken[]> {
  return []
}

export interface DexScreenerSnapshot {
  token: PumpfunToken
  overview: {
    price: number
    priceChange1h: number
    priceChange24h: number
    marketCap: number
    volume24h: number
    liquidity: number
    fdv: number
  }
}

const DEXSCREENER_BASE = 'https://api.dexscreener.com'
const IS_DEV = import.meta.env.DEV
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? ''
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY ?? ''
const DEX_NEGATIVE_CACHE_TTL_MS = 120_000
const dexFailureCache = new Map<string, number>()

function shouldSkipDex(path: string): boolean {
  const expiresAt = dexFailureCache.get(path)
  if (!expiresAt) return false
  if (expiresAt > Date.now()) return true
  dexFailureCache.delete(path)
  return false
}

function markDexFailed(path: string) {
  dexFailureCache.set(path, Date.now() + DEX_NEGATIVE_CACHE_TTL_MS)
}

async function dexscreenerFetch(path: string): Promise<Response | null> {
  if (shouldSkipDex(path)) return null

  // 1. Vite dev proxy (localhost only)
  if (IS_DEV) {
    try {
      const res = await fetch(`/dexscreener${path}`)
      if (res.ok) return res
      if (res.status === 404 || res.status === 429) {
        markDexFailed(path)
        return null
      }
    } catch { /* fall through */ }
  }

  // 2. Supabase edge function proxy (production)
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/dexscreener-proxy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SUPABASE_ANON}` },
      body: JSON.stringify({ path }),
    })
    if (res.ok) return res
    if (res.status === 404 || res.status === 429) {
      markDexFailed(path)
      return null
    }
  } catch { /* fall through */ }

  markDexFailed(path)
  return null
}

export async function fetchDexScreenerSnapshot(mint: string): Promise<DexScreenerSnapshot | null> {
  try {
    const res = await dexscreenerFetch(`/latest/dex/tokens/${mint}`)
    if (!res) return null

    const data = (await res.json()) as DexScreenerResp
    const pair = data.pairs?.find((item) => item.baseToken?.symbol) ?? data.pairs?.[0]
    if (!pair) return null

    const websites = pair.info?.websites ?? []
    const socials = pair.info?.socials ?? []
    const websiteUrl = websites.find((item) => item.url)?.url ?? ''
    const twitterUrl = socials.find((item) => item.type?.toLowerCase() === 'twitter')?.url ?? ''
    const telegramUrl = socials.find((item) => item.type?.toLowerCase() === 'telegram')?.url ?? ''
    const marketCap = pair.marketCap ?? pair.fdv ?? 0
    const price = Number(pair.priceUsd ?? 0) || 0

    return {
      token: {
        mint,
        name: pair.baseToken?.name ?? 'Unknown',
        symbol: pair.baseToken?.symbol ?? '???',
        imageUri: pair.info?.imageUrl ?? '',
        description: '',
        creatorAddress: '',
        createdTimestamp: pair.pairCreatedAt ?? Date.now(),
        marketCap,
        usdMarketCap: marketCap,
        solInCurve: 0,
        complete: false,
        twitterUrl,
        telegramUrl,
        websiteUrl,
        totalSupply: 1_000_000_000,
        launchSource: 'dexscreener',
      },
      overview: {
        price,
        priceChange1h: pair.priceChange?.h1 ?? 0,
        priceChange24h: pair.priceChange?.h24 ?? 0,
        marketCap,
        volume24h: pair.volume?.h24 ?? 0,
        liquidity: pair.liquidity?.usd ?? 0,
        fdv: pair.fdv ?? 0,
      },
    }
  } catch {
    return null
  }
}

export async function fetchTokenByMint(mint: string): Promise<PumpfunToken | null> {
  const snapshot = await fetchDexScreenerSnapshot(mint)
  return snapshot?.token ?? null
}

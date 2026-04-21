import { useState, useEffect, useRef, useCallback } from 'react'
import type { FeedToken, FilterMode, PumpfunToken } from '../types'
import { subscribePumpPortal } from '../services/pumpfun'
import { runRugFilter } from '../services/rugFilter'
import { fetchTokenOverview, fetchOHLCV, fetchTokenHoldersCount } from '../services/birdeye'
import { getAITokenRating } from '../services/groq'

const MAX_FEED_SIZE = 500
const FEED_CACHE_KEY = 'snapshot_feed_cache'
const LIVE_REFRESH_INTERVAL = 30_000

function tokenFromPump(pump: PumpfunToken, isNewest = true): FeedToken {
  return {
    ...pump,
    rugFilter: null,
    rugFilterLoading: true,
    overview: null,
    sparklineData: [],
    isNewest,
    aiRating: null,
    aiRatingLoading: false,
    creatorDumped: false,
    creatorDumpPct: 0,
    fromCache: false,
  }
}

function canRateWithAI(token: FeedToken): boolean {
  return token.rugFilter !== null && token.rugFilter.risk !== 'unknown'
}

export function useTokenFeed(filterMode: FilterMode = 'all') {
  const [tokens, setTokens] = useState<FeedToken[]>([])
  const [cacheLoaded, setCacheLoaded] = useState(false)
  const [connected, setConnected] = useState(false)
  const [liveCount, setLiveCount] = useState(0)

  const rugFilterQueue = useRef<Set<string>>(new Set())
  const overviewFetchQueue = useRef<Set<string>>(new Set())
  const aiRatingQueue = useRef<Set<string>>(new Set())
  const seenMints = useRef<Set<string>>(new Set())
  const refreshTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  // Load cache on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(FEED_CACHE_KEY)
      if (raw) {
        const cached = JSON.parse(raw) as FeedToken[]
        const valid = cached.filter((t) => t.mint && t.name)
        valid.forEach((t) => seenMints.current.add(t.mint))
        setTokens(valid.map((t) => ({ ...t, fromCache: true, rugFilterLoading: !t.rugFilter })))
      }
    } catch { /* ignore */ }
    setCacheLoaded(true)
  }, [])

  // NOTE: fetchRecentTokens (pump.fun HTTP API) is CORS blocked in browsers.
  // Initial feed data comes from localStorage cache + the Supabase launched_tokens
  // table (handled by Feed.tsx Launches tab) + the live WebSocket stream.

  // Subscribe to live feed
  useEffect(() => {
    if (!cacheLoaded) return

    const unsub = subscribePumpPortal((pump) => {
      if (seenMints.current.has(pump.mint)) return
      seenMints.current.add(pump.mint)
      setLiveCount((c) => c + 1)

      const feedToken = tokenFromPump(pump, true)
      setTokens((prev) => {
        const next = [feedToken, ...prev.map((t) => ({ ...t, isNewest: false }))]
        return next.slice(0, MAX_FEED_SIZE)
      })
      setConnected(true)
    })

    return unsub
  }, [cacheLoaded])

  // Rug filter hydration
  useEffect(() => {
    const pending = tokens.filter(
      (t) => t.rugFilterLoading && t.rugFilter === null && !rugFilterQueue.current.has(t.mint)
    ).slice(0, 12)

    if (pending.length === 0) return

    pending.forEach((token) => {
      rugFilterQueue.current.add(token.mint)
      runRugFilter(token.mint)
        .then((result) => {
          setTokens((prev) =>
            prev.map((t) => t.mint === token.mint ? { ...t, rugFilter: result, rugFilterLoading: false } : t)
          )
        })
        .catch(() => {
          setTokens((prev) =>
            prev.map((t) => t.mint === token.mint ? { ...t, rugFilterLoading: false } : t)
          )
        })
        .finally(() => {
          rugFilterQueue.current.delete(token.mint)
        })
    })
  }, [tokens])

  // Overview hydration (MC, liquidity, price)
  useEffect(() => {
    const pending = tokens.filter(
      (t) => !t.rugFilterLoading && !t.overview && !overviewFetchQueue.current.has(t.mint)
    ).slice(0, 12)

    if (pending.length === 0) return

    pending.forEach((token) => {
      overviewFetchQueue.current.add(token.mint)
      Promise.all([fetchTokenOverview(token.mint), fetchOHLCV(token.mint, '1m', 30), fetchTokenHoldersCount(token.mint)])
        .then(([overview, ohlcv, holdersCount]) => {
          const sparklineData = ohlcv.map((b) => b.close)
          const mergedOverview = overview
            ? { ...overview, holders: overview.holders > 0 ? overview.holders : (holdersCount ?? 0) }
            : token.overview
              ? { ...token.overview, holders: token.overview.holders > 0 ? token.overview.holders : (holdersCount ?? 0) }
              : null
          setTokens((prev) =>
            prev.map((t) =>
              t.mint === token.mint
                ? { ...t, overview: mergedOverview, sparklineData: sparklineData.length ? sparklineData : t.sparklineData }
                : t
            )
          )
        })
        .finally(() => {
          overviewFetchQueue.current.delete(token.mint)
        })
    })
  }, [tokens])

  // AI rating for newest tokens
  useEffect(() => {
    const pending = tokens.filter(
      (t) =>
        t.isNewest &&
        !t.aiRating &&
        !t.aiRatingLoading &&
        !aiRatingQueue.current.has(t.mint) &&
        canRateWithAI(t)
    ).slice(0, 3)

    if (pending.length === 0) return

    pending.forEach((token) => {
      if (!canRateWithAI(token) || !token.rugFilter) return
      aiRatingQueue.current.add(token.mint)
      setTokens((prev) => prev.map((t) => t.mint === token.mint ? { ...t, aiRatingLoading: true } : t))

      getAITokenRating(token.name, token.symbol, token.description, token.rugFilter!.score, token.rugFilter!.flags)
        .then((rating) => {
          setTokens((prev) => prev.map((t) => t.mint === token.mint ? { ...t, aiRating: rating, aiRatingLoading: false } : t))
        })
        .catch(() => {
          setTokens((prev) => prev.map((t) => t.mint === token.mint ? { ...t, aiRatingLoading: false } : t))
        })
        .finally(() => {
          aiRatingQueue.current.delete(token.mint)
        })
    })
  }, [tokens])

  // Persist cache
  useEffect(() => {
    if (!cacheLoaded || tokens.length === 0) return
    const timer = setTimeout(() => {
      try {
        const toCache = tokens.slice(0, 100)
        localStorage.setItem(FEED_CACHE_KEY, JSON.stringify(toCache))
      } catch { /* storage full */ }
    }, 2000)
    return () => clearTimeout(timer)
  }, [tokens, cacheLoaded])

  // Live refresh of overview data
  useEffect(() => {
    refreshTimer.current = setInterval(() => {
      const toRefresh = tokens.slice(0, 20)
      toRefresh.forEach((token) => {
        if (overviewFetchQueue.current.has(token.mint)) return
        overviewFetchQueue.current.add(token.mint)
        Promise.all([fetchTokenOverview(token.mint), fetchOHLCV(token.mint, '1m', 30), fetchTokenHoldersCount(token.mint)])
          .then(([overview, ohlcv, holdersCount]) => {
            const sparklineData = ohlcv.map((b) => b.close)
            const mergedOverview = overview
              ? { ...overview, holders: overview.holders > 0 ? overview.holders : (holdersCount ?? 0) }
              : token.overview
                ? { ...token.overview, holders: token.overview.holders > 0 ? token.overview.holders : (holdersCount ?? 0) }
                : null
            setTokens((prev) =>
              prev.map((t) =>
                t.mint === token.mint
                  ? { ...t, overview: mergedOverview, sparklineData: sparklineData.length ? sparklineData : t.sparklineData }
                  : t
              )
            )
          })
          .finally(() => {
            overviewFetchQueue.current.delete(token.mint)
          })
      })
    }, LIVE_REFRESH_INTERVAL)

    return () => {
      if (refreshTimer.current) clearInterval(refreshTimer.current)
    }
  }, [tokens])

  const filteredTokens = tokens.filter((t) => {
    if (filterMode === 'all') return true
    if (!t.rugFilter) return false
    return t.rugFilter.risk === filterMode
  })

  const rateToken = useCallback(async (mint: string) => {
    const token = tokens.find((t) => t.mint === mint)
    if (!token || token.aiRating || token.aiRatingLoading || !canRateWithAI(token) || !token.rugFilter) return
    if (aiRatingQueue.current.has(mint)) return

    aiRatingQueue.current.add(mint)
    setTokens((prev) => prev.map((t) => t.mint === mint ? { ...t, aiRatingLoading: true } : t))

    try {
      const rating = await getAITokenRating(token.name, token.symbol, token.description, token.rugFilter!.score, token.rugFilter!.flags)
      setTokens((prev) => prev.map((t) => t.mint === mint ? { ...t, aiRating: rating, aiRatingLoading: false } : t))
    } catch {
      setTokens((prev) => prev.map((t) => t.mint === mint ? { ...t, aiRatingLoading: false } : t))
    } finally {
      aiRatingQueue.current.delete(mint)
    }
  }, [tokens])

  return { tokens: filteredTokens, allTokens: tokens, connected, liveCount, rateToken }
}

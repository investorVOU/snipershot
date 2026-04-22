import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Zap, Search, X, TrendingUp, TrendingDown, Wifi, WifiOff } from 'lucide-react'
import { useTokenFeed } from '../hooks/useTokenFeed'
import { useWatchlist } from '../hooks/useWatchlist'
import { TokenCard } from '../components/TokenCard'
import { SnipeModal } from '../components/SnipeModal'
import { TickerBar } from '../components/TickerBar'
import { supabase } from '../services/supabase'
import { fetchTrendingTokens, fetchTokenOverview, fetchOHLCV, fetchTokenHoldersCount, type TrendingToken } from '../services/birdeye'
import { runRugFilter } from '../services/rugFilter'
import { getAITokenRating } from '../services/groq'
import { formatMarketCap, toHttpUrl } from '../services/format'
import type { FeedToken, FilterMode } from '../types'
import { useAuth } from '../context/AuthContext'
import { buyTokenForUser } from '../services/solana'
import { fetchDexHotTokens, mapDexHotTokenToFeed, type DexHotToken } from '../services/dexscreener'
import { useTheme } from '../context/ThemeContext'

type FeedTab = 'launches' | 'new' | 'trending'
type McFilter = 'all' | '5k' | '25k' | '100k'
type GraduatedFilter = 'all' | 'graduated'

const PAGE_SIZE = 20
const LAUNCH_MATURITY_MS = 30 * 60 * 1000
const LAUNCHES_CACHE_KEY = 'solmint_launches_cache'

interface LaunchRow {
  mint: string
  name: string | null
  symbol: string | null
  image_uri: string | null
  description: string | null
  creator: string | null
  twitter: string | null
  telegram: string | null
  website: string | null
  created_timestamp: number | null
  sol_in_bonding_curve: number | null
  liquidity: number | null
  market_cap: number | null
  usd_market_cap: number | null
}

function isGraduatedToken(token: Pick<FeedToken, 'complete' | 'overview' | 'solInCurve'>): boolean {
  if (token.complete) return true
  return (token.overview?.liquidity ?? 0) > 0
}

function mapLaunchRow(row: LaunchRow): FeedToken {
  const hasOverviewData = (row.liquidity ?? 0) > 0 || (row.usd_market_cap ?? 0) > 0
  return {
    mint: row.mint,
    name: row.name ?? 'Unknown',
    symbol: row.symbol ?? '???',
    imageUri: row.image_uri ?? '',
    description: row.description ?? '',
    creatorAddress: row.creator ?? '',
    createdTimestamp: row.created_timestamp ?? Date.now(),
    marketCap: row.market_cap ?? 0,
    usdMarketCap: row.usd_market_cap ?? 0,
    solInCurve: row.sol_in_bonding_curve ?? 0,
    complete: (row.liquidity ?? 0) > 0,
    twitterUrl: row.twitter ?? '',
    telegramUrl: row.telegram ?? '',
    websiteUrl: row.website ?? '',
    totalSupply: 0,
    rugFilter: null,
    rugFilterLoading: true,
    overview: hasOverviewData
      ? { price: 0, priceChange1h: 0, priceChange24h: 0, marketCap: row.usd_market_cap ?? 0, volume24h: 0, liquidity: row.liquidity ?? 0, holders: 0, fdv: 0 }
      : null,
    sparklineData: [],
    isNewest: false,
    aiRating: null,
    aiRatingLoading: true,
    creatorDumped: false,
    creatorDumpPct: 0,
    fromCache: true,
  }
}

function canRateWithAI(token: FeedToken): boolean {
  return token.rugFilter !== null && token.rugFilter.risk !== 'unknown'
}

function aiContext(token: FeedToken): string {
  return [
    `price=${token.overview?.price ?? 0}`,
    `marketCap=${token.overview?.marketCap ?? token.usdMarketCap ?? 0}`,
    `liquidity=${token.overview?.liquidity ?? 0}`,
    `volume24h=${token.overview?.volume24h ?? 0}`,
    `holders=${token.overview?.holders ?? 0}`,
    `ageMs=${Math.max(0, Date.now() - token.createdTimestamp)}`,
  ].join(', ')
}

function matchesSearchToken(token: Pick<FeedToken, 'name' | 'symbol' | 'mint'>, query: string): boolean {
  if (!query) return true
  const q = query.trim().toLowerCase()
  return token.name.toLowerCase().includes(q) || token.symbol.toLowerCase().includes(q) || token.mint.toLowerCase().startsWith(q)
}

function matchesSearchTrending(token: TrendingToken | DexHotToken, query: string): boolean {
  if (!query) return true
  const q = query.trim().toLowerCase()
  return token.name.toLowerCase().includes(q) || token.symbol.toLowerCase().includes(q) || token.address.toLowerCase().startsWith(q)
}

const RISK_FILTERS: { key: FilterMode; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'safe', label: 'Safe' },
  { key: 'medium', label: 'Medium' },
  { key: 'risky', label: 'Risky' },
]

const MC_FILTERS: { key: McFilter; label: string }[] = [
  { key: 'all', label: 'Any MC' },
  { key: '5k', label: '$5k+' },
  { key: '25k', label: '$25k+' },
  { key: '100k', label: '$100k+' },
]

export function FeedPage() {
  const { colors } = useTheme()
  const navigate = useNavigate()
  const [tab, setTab] = useState<FeedTab>('launches')
  const [filterMode, setFilterMode] = useState<FilterMode>('all')
  const [mcFilter, setMcFilter] = useState<McFilter>('all')
  const [graduatedFilter, setGraduatedFilter] = useState<GraduatedFilter>('all')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [snipeToken, setSnipeToken] = useState<FeedToken | null>(null)

  // Live feed (New tab)
  const { tokens: liveTokens, allTokens, connected } = useTokenFeed('all')

  // Launches tab
  const [launches, setLaunches] = useState<FeedToken[]>([])
  const [launchesLoading, setLaunchesLoading] = useState(false)
  const launchHydQueue = useRef(new Set<string>())
  const launchesInitialized = useRef(false)

  // Trending tab
  const [trending, setTrending] = useState<Array<TrendingToken | DexHotToken>>([])
  const [trendingLoading, setTrendingLoading] = useState(false)

  const { toggleWatchlist, isWatched } = useWatchlist()
  const { user, wallet, isGuest, openAuthModal } = useAuth()

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LAUNCHES_CACHE_KEY)
      if (!raw) return
      const cached = JSON.parse(raw) as FeedToken[]
      setLaunches(cached.map((token) => ({ ...token, isNewest: false })))
    } catch {
      // Ignore invalid cache.
    }
  }, [])

  const loadLaunches = useCallback(async () => {
    const cutoff = Date.now() - LAUNCH_MATURITY_MS
    if (!launchesInitialized.current) setLaunchesLoading(true)
    const [dbResult, dexTokens] = await Promise.all([
      supabase
        .from('launched_tokens')
        .select('mint,name,symbol,image_uri,description,creator,twitter,telegram,website,created_timestamp,sol_in_bonding_curve,liquidity,market_cap,usd_market_cap')
        .lte('created_timestamp', cutoff)
        .order('created_timestamp', { ascending: false })
        .limit(200),
      fetchDexHotTokens(40, 'solana').catch(() => []),
    ])

    if (dexTokens.length > 0) {
      void supabase.from('launched_tokens').upsert(
        dexTokens.map((token) => ({
          mint: token.address,
          name: token.name,
          symbol: token.symbol,
          image_uri: token.logoURI,
          description: '',
          creator: '',
          twitter: '',
          telegram: '',
          website: '',
          created_timestamp: token.createdAt,
          sol_in_bonding_curve: 0,
          liquidity: token.liquidity,
          market_cap: token.marketCap,
          usd_market_cap: token.marketCap,
          source: 'dexscreener',
          last_signature: '',
          helius_metadata_fetched: false,
          last_seen_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })),
        { onConflict: 'mint' }
      )
    }

    const byMint = new Map<string, FeedToken>()
    ;(dbResult.data as LaunchRow[] | null)?.map(mapLaunchRow).forEach((token) => byMint.set(token.mint, token))
    dexTokens.map(mapDexHotTokenToFeed).forEach((token) => {
      const existing = byMint.get(token.mint)
      byMint.set(token.mint, existing ? { ...token, ...existing, overview: existing.overview ?? token.overview } : token)
    })
    const nextLaunches = Array.from(byMint.values()).sort((a, b) => b.createdTimestamp - a.createdTimestamp)
    setLaunches((prev) => {
      const prevMints = new Set(prev.map((token) => token.mint))
      return nextLaunches.map((token) => ({
        ...token,
        isNewest: launchesInitialized.current && !prevMints.has(token.mint),
      }))
    })
    try {
      localStorage.setItem(LAUNCHES_CACHE_KEY, JSON.stringify(nextLaunches.slice(0, 300)))
    } catch {
      // Ignore cache saturation.
    }
    launchesInitialized.current = true
    setLaunchesLoading(false)
  }, [])

  // Load launches from Supabase
  useEffect(() => {
    if (tab !== 'launches') return
    void loadLaunches()
    const interval = setInterval(() => { void loadLaunches() }, 30_000)
    return () => clearInterval(interval)
  }, [tab, loadLaunches])

  // Hydrate launches (rug filter + overview + AI)
  useEffect(() => {
    if (tab !== 'launches') return
    const batch = launches
      .filter((t) => !launchHydQueue.current.has(t.mint) && (t.rugFilter == null || t.aiRating == null || t.overview == null))
      .slice(0, 4)

    batch.forEach((token) => {
      launchHydQueue.current.add(token.mint)
      Promise.all([
        token.rugFilter ? Promise.resolve(token.rugFilter) : runRugFilter(token.mint),
        token.overview ? Promise.resolve(token.overview) : fetchTokenOverview(token.mint),
        fetchOHLCV(token.mint, '1H', 24),
        fetchTokenHoldersCount(token.mint),
      ]).then(([rugFilter, overview, ohlcv, holdersCount]) => {
        const sparklineData = ohlcv.map((b) => b.close)
        const mergedOverview = overview
          ? { ...overview, holders: overview.holders > 0 ? overview.holders : (holdersCount ?? 0) }
          : token.overview
            ? { ...token.overview, holders: token.overview.holders > 0 ? token.overview.holders : (holdersCount ?? 0) }
            : null
        setLaunches((prev) => prev.map((t) =>
          t.mint === token.mint ? { ...t, rugFilter, rugFilterLoading: false, overview: mergedOverview, sparklineData: sparklineData.length ? sparklineData : t.sparklineData, aiRatingLoading: !token.aiRating && rugFilter.risk !== 'unknown' } : t
        ))
        if (!token.aiRating && canRateWithAI({ ...token, rugFilter })) {
          return getAITokenRating(token.name, token.symbol, token.description, rugFilter.score, rugFilter.flags, aiContext({ ...token, rugFilter, overview: mergedOverview }))
            .then((aiRating) => {
              setLaunches((prev) => prev.map((t) =>
                t.mint === token.mint ? { ...t, aiRating, aiRatingLoading: false } : t
              ))
            })
        }
      }).catch(() => {
        setLaunches((prev) => prev.map((t) =>
          t.mint === token.mint ? { ...t, rugFilterLoading: false, aiRatingLoading: false } : t
        ))
      }).finally(() => launchHydQueue.current.delete(token.mint))
    })
  }, [launches, tab])

  // Load trending
  useEffect(() => {
    if (tab !== 'trending') return
    setTrendingLoading(true)
    Promise.all([
      fetchDexHotTokens(30, 'solana').catch(() => []),
      fetchTrendingTokens(15).catch(() => []),
    ])
      .then(([dex, birdeye]) => setTrending([...dex, ...birdeye]))
      .finally(() => setTrendingLoading(false))
  }, [tab])

  const handleTabChange = (t: FeedTab) => { setTab(t); setPage(1) }
  const handleFilterChange = (f: FilterMode) => { setFilterMode(f); setPage(1) }
  const handleGraduatedChange = (g: GraduatedFilter) => { setGraduatedFilter(g); setPage(1) }

  const applyFilters = useCallback((items: FeedToken[]) => {
    const mcMin = mcFilter === '5k' ? 5000 : mcFilter === '25k' ? 25000 : mcFilter === '100k' ? 100000 : 0
    return items.filter((t) => {
      if (filterMode !== 'all') {
        if (!t.rugFilter) return false
        if (filterMode !== t.rugFilter.risk) return false
      }
      if (mcMin > 0) {
        const mc = t.overview?.marketCap ?? t.usdMarketCap ?? 0
        if (mc < mcMin) return false
      }
      return matchesSearchToken(t, search)
    })
  }, [filterMode, mcFilter, search])

  const cutoff = Date.now() - LAUNCH_MATURITY_MS

  const launchTokens = useMemo(() => {
    const maturedLive = allTokens.filter((t) => t.createdTimestamp <= cutoff)
    const byMint = new Map<string, FeedToken>()
    launches.forEach((t) => byMint.set(t.mint, t))
    maturedLive.forEach((t) => {
      const ex = byMint.get(t.mint)
      byMint.set(t.mint, ex
        ? { ...ex, ...t, overview: t.overview ?? ex.overview, rugFilter: t.rugFilter ?? ex.rugFilter, aiRating: t.aiRating ?? ex.aiRating, sparklineData: t.sparklineData.length ? t.sparklineData : ex.sparklineData }
        : t)
    })
    const all = Array.from(byMint.values()).sort((a, b) => b.createdTimestamp - a.createdTimestamp)
    const graduated = graduatedFilter === 'graduated' ? all.filter(isGraduatedToken) : all
    return applyFilters(graduated)
  }, [launches, allTokens, applyFilters, cutoff, graduatedFilter])

  const newTokens = useMemo(() => {
    return applyFilters(allTokens.filter((t) => t.createdTimestamp > cutoff && !isGraduatedToken(t)))
  }, [allTokens, cutoff, applyFilters])

  const filteredTrending = useMemo(() => {
    const mcMin = mcFilter === '5k' ? 5000 : mcFilter === '25k' ? 25000 : mcFilter === '100k' ? 100000 : 0
    return trending.filter((token) => {
      if (!matchesSearchTrending(token, search)) return false
      if (mcMin > 0 && token.marketCap < mcMin) return false
      return true
    })
  }, [trending, mcFilter, search])

  const activeTokens = tab === 'launches' ? launchTokens : tab === 'new' ? newTokens : []
  const paged = activeTokens.slice(0, PAGE_SIZE * page)

  const newCount = allTokens.filter((t) => !t.fromCache && t.createdTimestamp > cutoff && !isGraduatedToken(t)).length

  return (
    <div className="flex h-screen flex-col">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-dark-border bg-dark-bg/90 backdrop-blur-sm sticky top-0 z-10 flex flex-col gap-2.5">
        {/* Title row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${connected ? 'bg-brand' : 'bg-red-500'} pulse-dot`} />
            <h1 className="text-dark-text font-extrabold text-[22px]">Live Feed</h1>
          </div>
          <div className="flex items-center gap-1.5">
            {connected
              ? <><Wifi size={13} className="text-brand" /><span className="text-brand text-xs font-semibold">Live</span></>
              : <><WifiOff size={13} className="text-dark-faint" /><span className="text-dark-faint text-xs font-semibold">Connecting…</span></>
            }
          </div>
        </div>

        {/* Tab switcher */}
        <div className="flex bg-dark-muted rounded-xl p-[3px] gap-[3px] border border-dark-border">
          {([
            { key: 'launches' as FeedTab, label: 'Launches', count: launchTokens.length, color: '#14f195' },
            { key: 'new' as FeedTab, label: 'New', count: newCount, color: '#9945ff' },
            { key: 'trending' as FeedTab, label: 'Trending', count: null, color: '#f5a623' },
          ]).map(({ key, label, count, color }) => (
            <button
              key={key}
              onClick={() => handleTabChange(key)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-[10px] text-[14px] font-bold transition-colors ${tab === key ? 'bg-dark-card text-dark-text' : 'text-dark-subtext'}`}
            >
              {label}
              {count !== null && (
                <span className="text-[11px] font-bold px-1.5 py-0.5 rounded-lg min-w-[22px] text-center text-white" style={{ backgroundColor: tab === key ? color : colors.border }}>
                  {count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Risk + graduation filters (launches/new only) */}
        {tab !== 'trending' && (
          <div className="flex gap-2 overflow-x-auto pb-0.5 no-scrollbar">
            {RISK_FILTERS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => handleFilterChange(key)}
                className={`flex-shrink-0 px-3.5 py-1.5 rounded-full text-[13px] font-semibold transition-colors ${filterMode === key ? 'bg-brand text-[#08110d]' : 'bg-dark-muted text-dark-subtext hover:text-dark-text'}`}
              >
                {label}
              </button>
            ))}
            {tab === 'launches' && (
              <button
                onClick={() => handleGraduatedChange(graduatedFilter === 'graduated' ? 'all' : 'graduated')}
                className={`flex-shrink-0 px-3.5 py-1.5 rounded-full text-[13px] font-semibold transition-colors border ${graduatedFilter === 'graduated' ? 'bg-[#14f19520] border-[#14f19540] text-[#14f195]' : 'bg-dark-muted border-transparent text-dark-subtext hover:text-dark-text'}`}
              >
                ✓ Graduated
              </button>
            )}
          </div>
        )}
        <div className="flex gap-2 overflow-x-auto pb-0.5 no-scrollbar">
          {MC_FILTERS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => { setMcFilter(key); setPage(1) }}
              className={`flex-shrink-0 px-3.5 py-1.5 rounded-full text-[13px] font-semibold transition-colors ${mcFilter === key ? 'bg-[#9945ff44] text-[#9945ff]' : 'bg-dark-muted text-dark-subtext hover:text-dark-text'}`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-faint" />
          <input
            className="input pl-9 py-2.5 text-sm"
            placeholder="Search name, symbol, or mint…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          />
          {search && (
            <button onClick={() => { setSearch(''); setPage(1) }} className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-faint hover:text-dark-subtext">
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Ticker */}
      <TickerBar tokens={allTokens} />

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {tab === 'trending' ? (
          trendingLoading ? (
            <div className="flex flex-col items-center justify-center h-48 gap-3">
              <div className="w-6 h-6 border-2 border-[#f5a623] border-t-transparent rounded-full animate-spin" />
              <span className="text-dark-subtext text-sm">Loading trending…</span>
            </div>
          ) : (
            <div className="p-3 flex flex-col gap-2">
              {filteredTrending.map((token, i) => {
                const isUp = token.priceChange24h >= 0
                return (
                  <div
                    key={token.address}
                    className="card p-3 flex items-center gap-3 cursor-pointer transition-colors"
                    onClick={() => navigate(`/token/${token.address}`)}
                    onMouseEnter={(event) => { event.currentTarget.style.backgroundColor = colors.surface }}
                    onMouseLeave={(event) => { event.currentTarget.style.backgroundColor = '' }}
                  >
                    <span className="text-dark-subtext font-bold text-sm w-6 text-center">#{i + 1}</span>
                    <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0" style={{ backgroundColor: colors.surface }}>
                      {token.logoURI && <img src={token.logoURI} alt={token.name} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-dark-text font-bold text-sm truncate">{token.name}</div>
                      <div className="text-dark-subtext text-xs">${token.symbol}</div>
                    </div>
                    <div className="text-right">
                      <div className={`font-bold text-sm flex items-center gap-1 justify-end ${isUp ? 'text-[#14f195]' : 'text-red-400'}`}>
                        {isUp ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                        {isUp ? '+' : ''}{token.priceChange24h.toFixed(2)}%
                      </div>
                      <div className="text-dark-subtext text-xs">{formatMarketCap(token.marketCap)}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          )
        ) : paged.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-3">
            {(tab === 'launches' && launchesLoading) || tab === 'new' ? (
              <>
                <div className="w-6 h-6 border-2 border-brand border-t-transparent rounded-full animate-spin" />
                <span className="text-dark-subtext text-sm">{tab === 'launches' ? 'Loading launches…' : 'Scanning for new tokens…'}</span>
              </>
            ) : (
              <>
                <Zap size={28} className="text-dark-subtext opacity-30" />
                <span className="text-dark-subtext text-sm">No tokens found</span>
              </>
            )}
          </div>
        ) : (
          <div className="p-3 flex flex-col gap-2">
            {paged.map((token) => (
              <div key={token.mint} className={token.isNewest ? 'slide-in-right' : ''}>
                <TokenCard
                  token={token}
                  onPress={() => navigate(`/token/${token.mint}`, { state: { token } })}
                  onSnipe={() => setSnipeToken(token)}
                  onWatch={() => toggleWatchlist(token.mint)}
                  isWatched={isWatched(token.mint)}
                />
              </div>
            ))}

            {/* Load more */}
            {paged.length < activeTokens.length && (
              <button
                onClick={() => setPage((p) => p + 1)}
                className="w-full py-3 text-dark-subtext text-sm font-semibold hover:text-dark-text transition-colors flex items-center justify-center gap-2"
              >
                <Zap size={14} /> Load more ({activeTokens.length - paged.length} remaining)
              </button>
            )}
            {paged.length >= activeTokens.length && paged.length > 0 && (
              <p className="text-center text-dark-faint text-xs py-4">{paged.length} tokens shown</p>
            )}
          </div>
        )}
      </div>

      <SnipeModal
        token={snipeToken}
        onClose={() => setSnipeToken(null)}
        wallet={wallet}
        onConfirm={async (mint, amountSol, slippage) => {
          if (!user || isGuest || !wallet) {
            openAuthModal()
            throw new Error('Sign in to trade')
          }
          const token = snipeToken
          if (!token || token.mint !== mint) throw new Error('Token context missing')
          await buyTokenForUser({
            wallet,
            userId: user.id,
            mint,
            tokenName: token.name,
            tokenSymbol: token.symbol,
            tokenImageUri: token.imageUri,
            amountSol,
            slippageBps: slippage * 100,
          })
        }}
      />
    </div>
  )
}

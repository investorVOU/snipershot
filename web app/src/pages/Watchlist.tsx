import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Star, Trash2, Crosshair, RefreshCw, TrendingUp, TrendingDown } from 'lucide-react'
import { useWatchlist } from '../hooks/useWatchlist'
import { fetchTokenByMint } from '../services/pumpfun'
import { fetchTokenOverview } from '../services/birdeye'
import { SnipeModal } from '../components/SnipeModal'
import { RugScoreBadge } from '../components/RugScoreBadge'
import { runRugFilter } from '../services/rugFilter'
import { formatMarketCap, formatPercent, formatAge, toHttpUrl } from '../services/format'
import type { FeedToken } from '../types'
import { useAuth } from '../context/AuthContext'
import { buyTokenForUser } from '../services/solana'

async function hydrateToken(mint: string): Promise<FeedToken | null> {
  const [t, overview, rugFilter] = await Promise.all([
    fetchTokenByMint(mint),
    fetchTokenOverview(mint),
    runRugFilter(mint),
  ])
  if (!t) return null
  return {
    ...t,
    rugFilter,
    rugFilterLoading: false,
    overview: overview ?? null,
    sparklineData: [],
    isNewest: false,
    aiRating: null,
    aiRatingLoading: false,
    creatorDumped: false,
    creatorDumpPct: 0,
    fromCache: false,
  }
}

export function WatchlistPage() {
  const navigate = useNavigate()
  const { watchlist, removeFromWatchlist, toggleWatchlist } = useWatchlist()
  const { user, wallet, isGuest, openAuthModal } = useAuth()
  const [tokens, setTokens] = useState<FeedToken[]>([])
  const [loading, setLoading] = useState(false)
  const [snipeToken, setSnipeToken] = useState<FeedToken | null>(null)

  const load = () => {
    if (watchlist.length === 0) { setTokens([]); return }
    setLoading(true)
    Promise.all(watchlist.slice(0, 50).map(hydrateToken))
      .then((results) => setTokens(results.filter(Boolean) as FeedToken[]))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [watchlist.join(',')])  // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Header */}
      <div className="px-4 pt-5 pb-3 border-b border-dark-border flex items-center justify-between sticky top-0 bg-dark-bg/90 backdrop-blur-sm z-10">
        <div className="flex items-center gap-2">
          <Star size={20} className="text-brand" fill="currentColor" />
          <h1 className="text-dark-text font-extrabold text-[22px]">Watchlist</h1>
          {watchlist.length > 0 && (
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-lg bg-dark-muted text-dark-subtext">{watchlist.length}</span>
          )}
        </div>
        {watchlist.length > 0 && (
          <button onClick={load} disabled={loading} className="text-dark-subtext hover:text-brand transition-colors">
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center h-64 gap-3">
          <div className="w-6 h-6 border-2 border-brand border-t-transparent rounded-full animate-spin" />
          <span className="text-dark-subtext text-sm">Loading watchlist…</span>
        </div>
      ) : watchlist.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 gap-4 px-8 text-center">
          <div className="w-16 h-16 rounded-2xl bg-brand/10 border border-brand/20 flex items-center justify-center">
            <Star size={28} className="text-brand" />
          </div>
          <div>
            <p className="text-dark-text font-semibold mb-1">No tokens watched yet</p>
            <p className="text-dark-subtext text-sm">Tap the star icon on any token in the feed to track it here.</p>
          </div>
        </div>
      ) : (
        <div className="p-3 flex flex-col gap-2 max-w-2xl mx-auto">
          {tokens.map((token) => {
            const mc = token.overview?.marketCap ?? token.usdMarketCap ?? 0
            const p24h = token.overview?.priceChange24h ?? 0
            const imgSrc = toHttpUrl(token.imageUri) || undefined
            const isUp = p24h >= 0

            return (
              <div
                key={token.mint}
                className="card p-4 cursor-pointer hover:bg-[#131c27] transition-colors active:scale-[0.99]"
                onClick={() => navigate(`/token/${token.mint}`, { state: { token } })}
              >
                <div className="flex items-center gap-3">
                  {/* Avatar */}
                  <div className="w-11 h-11 rounded-full bg-dark-muted flex-shrink-0 overflow-hidden">
                    {imgSrc
                      ? <img src={imgSrc} alt={token.name} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
                      : <span className="w-full h-full flex items-center justify-center text-xs font-bold text-dark-subtext">{token.symbol.slice(0, 2)}</span>
                    }
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="text-dark-text font-bold text-[15px] truncate">{token.name}</span>
                      <span className="text-dark-subtext text-xs flex-shrink-0">${token.symbol}</span>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-dark-faint text-[11px]">{formatAge(token.createdTimestamp)}</span>
                      {mc > 0 && (
                        <span className="stat-pill">MC {formatMarketCap(mc)}</span>
                      )}
                      {p24h !== 0 && (
                        <span className={`flex items-center gap-0.5 text-[11px] font-semibold ${isUp ? 'text-[#14f195]' : 'text-red-400'}`}>
                          {isUp ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                          {formatPercent(p24h)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Right side */}
                  <div className="flex items-center gap-2 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                    <RugScoreBadge rugFilter={token.rugFilter} loading={token.rugFilterLoading} size="sm" />
                    <button
                      className="w-8 h-8 rounded-lg border border-[#9945ff55] bg-[#9945ff22] flex items-center justify-center transition-colors hover:bg-[#9945ff33]"
                      onClick={() => toggleWatchlist(token.mint)}
                      title="Remove from watchlist"
                    >
                      <Star size={13} color="#9945ff" fill="#9945ff" />
                    </button>
                    <button
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand text-[#08110d] text-[12px] font-bold hover:opacity-90 transition-opacity"
                      onClick={() => setSnipeToken(token)}
                    >
                      <Crosshair size={12} /> Snipe
                    </button>
                  </div>
                </div>
              </div>
            )
          })}

          {/* Mints with no resolved data */}
          {watchlist
            .filter((m) => !tokens.find((t) => t.mint === m))
            .map((mint) => (
              <div key={mint} className="card p-3 flex items-center justify-between">
                <span className="text-dark-subtext text-xs font-mono">{mint.slice(0, 20)}…</span>
                <button onClick={() => removeFromWatchlist(mint)} className="text-dark-subtext hover:text-red-400 transition-colors p-1">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
        </div>
      )}

      <SnipeModal
        token={snipeToken}
        onClose={() => setSnipeToken(null)}
        wallet={wallet}
        onConfirm={async (mint, amountSol, slippage) => {
          if (!user || isGuest || !wallet) { openAuthModal(); throw new Error('Sign in to trade') }
          const token = tokens.find((item) => item.mint === mint)
          if (!token) throw new Error('Token context missing')
          await buyTokenForUser({
            wallet, userId: user.id, mint,
            tokenName: token.name, tokenSymbol: token.symbol, tokenImageUri: token.imageUri,
            amountSol, slippageBps: slippage * 100,
          })
        }}
      />
    </div>
  )
}

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Star, Trash2 } from 'lucide-react'
import { useWatchlist } from '../hooks/useWatchlist'
import { fetchTokenByMint } from '../services/pumpfun'
import { fetchTokenOverview } from '../services/birdeye'
import { SnipeModal } from '../components/SnipeModal'
import { TokenCard } from '../components/TokenCard'
import type { FeedToken } from '../types'

function tokenToFeed(t: Awaited<ReturnType<typeof fetchTokenByMint>>): FeedToken | null {
  if (!t) return null
  return {
    ...t,
    rugFilter: null,
    rugFilterLoading: false,
    overview: null,
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
  const [tokens, setTokens] = useState<FeedToken[]>([])
  const [loading, setLoading] = useState(false)
  const [snipeToken, setSnipeToken] = useState<FeedToken | null>(null)

  useEffect(() => {
    if (watchlist.length === 0) { setTokens([]); return }
    setLoading(true)
    Promise.all(
      watchlist.slice(0, 50).map((mint) =>
        Promise.all([fetchTokenByMint(mint), fetchTokenOverview(mint)]).then(([t, ov]) => {
          const ft = tokenToFeed(t)
          if (!ft) return null
          return { ...ft, overview: ov ?? null }
        })
      )
    ).then((results) => {
      setTokens(results.filter(Boolean) as FeedToken[])
    }).finally(() => setLoading(false))
  }, [watchlist])

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-4 pt-5 pb-3 border-b border-dark-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Star size={20} className="text-brand" />
          <h1 className="text-dark-text font-bold text-xl">Watchlist</h1>
          {watchlist.length > 0 && (
            <span className="text-dark-subtext text-sm">({watchlist.length})</span>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-6 h-6 border-2 border-brand border-t-transparent rounded-full animate-spin" />
        </div>
      ) : watchlist.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 gap-3 text-dark-subtext">
          <Star size={32} className="opacity-30" />
          <p className="text-sm">No tokens in watchlist yet.</p>
          <p className="text-xs opacity-60">Tap the star icon on any token to add it.</p>
        </div>
      ) : (
        <div className="p-3 flex flex-col gap-2 max-w-2xl mx-auto">
          {tokens.map((token) => (
            <TokenCard
              key={token.mint}
              token={token}
              onPress={() => navigate(`/token/${token.mint}`, { state: { token } })}
              onSnipe={() => setSnipeToken(token)}
              onWatch={() => toggleWatchlist(token.mint)}
              isWatched={true}
            />
          ))}
          {/* Show mints without data */}
          {watchlist.filter((m) => !tokens.find((t) => t.mint === m)).map((mint) => (
            <div key={mint} className="card p-4 flex items-center justify-between">
              <span className="text-dark-subtext text-sm font-mono">{mint.slice(0, 20)}…</span>
              <button onClick={() => removeFromWatchlist(mint)} className="text-dark-subtext hover:text-red-400 transition-colors">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      <SnipeModal token={snipeToken} onClose={() => setSnipeToken(null)} onConfirm={async () => { throw new Error('Connect a Solana wallet to snipe') }} />
    </div>
  )
}

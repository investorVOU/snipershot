import { useState, useEffect } from 'react'
import { Trophy, TrendingUp, TrendingDown, Medal } from 'lucide-react'
import { supabase } from '../services/supabase'
import { useAuth } from '../context/AuthContext'
import { formatSol, shortenAddress } from '../services/format'

interface LeaderboardEntry {
  user_pubkey: string
  total_pnl_sol: number
  win_rate: number
  total_trades: number
  username?: string
}

export function LeaderboardPage() {
  const { user } = useAuth()
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<'all' | '7d' | '24h'>('all')

  useEffect(() => {
    setLoading(true)
    void supabase
      .from('leaderboard')
      .select('user_pubkey, total_pnl_sol, win_rate, total_trades, username')
      .order('total_pnl_sol', { ascending: false })
      .limit(50)
      .then(({ data }) => {
        setEntries(data ?? [])
        setLoading(false)
      })
  }, [period])

  const medals = ['🥇', '🥈', '🥉']

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-4 pt-5 pb-3 border-b border-dark-border">
        <div className="flex items-center gap-2 mb-3">
          <Trophy size={20} className="text-brand" />
          <h1 className="text-dark-text font-bold text-xl">Leaderboard</h1>
        </div>
        <div className="flex gap-1">
          {(['24h', '7d', 'all'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                period === p ? 'bg-brand text-[#08110d]' : 'bg-dark-muted text-dark-subtext hover:text-dark-text'
              }`}
            >
              {p === 'all' ? 'All Time' : p}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 max-w-2xl mx-auto">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-6 h-6 border-2 border-brand border-t-transparent rounded-full animate-spin" />
          </div>
        ) : entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-dark-subtext">
            <Trophy size={32} className="opacity-30" />
            <p className="text-sm">No traders yet. Be the first!</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {entries.map((entry, i) => {
              const isMe = user?.id === entry.user_pubkey
              const rank = i + 1
              return (
                <div
                  key={entry.user_pubkey}
                  className={`card p-4 flex items-center gap-4 ${isMe ? 'border-brand/30 bg-brand/[0.03]' : ''}`}
                >
                  <div className="w-8 text-center">
                    {rank <= 3 ? (
                      <span className="text-xl">{medals[rank - 1]}</span>
                    ) : (
                      <span className="text-dark-subtext font-bold text-sm">#{rank}</span>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-dark-text font-semibold text-sm truncate">
                        {entry.username ?? shortenAddress(entry.user_pubkey)}
                      </span>
                      {isMe && (
                        <span className="text-[10px] bg-brand/10 text-brand px-1.5 py-0.5 rounded font-bold">YOU</span>
                      )}
                    </div>
                    <div className="text-dark-subtext text-xs">{entry.total_trades} trades · {entry.win_rate?.toFixed(0) ?? 0}% win rate</div>
                  </div>

                  <div className={`font-bold text-sm flex items-center gap-1 ${(entry.total_pnl_sol ?? 0) >= 0 ? 'text-[#14f195]' : 'text-red-400'}`}>
                    {(entry.total_pnl_sol ?? 0) >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                    {(entry.total_pnl_sol ?? 0) >= 0 ? '+' : ''}{formatSol(entry.total_pnl_sol ?? 0)}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { BarChart2, TrendingUp, TrendingDown, ArrowUpRight, RefreshCw, Briefcase, Bot, Loader2 } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../services/supabase'
import { fetchPrice } from '../services/birdeye'
import { groqChat } from '../services/groqChat'
import { formatSol, formatPercent, toHttpUrl, formatAge } from '../services/format'

interface Position {
  mint: string
  tokenName: string
  tokenSymbol: string
  tokenImageUri: string
  entryPriceSOL: number
  amountTokens: number
  amountSOLSpent: number
  timestamp: number
  currentPrice?: number
  isLoading?: boolean
}

interface ClosedTrade {
  id: string
  mint: string
  tokenName: string
  tokenSymbol: string
  tokenImageUri: string
  type: 'buy' | 'sell'
  amountSOL: number
  timestamp: number
  txSig: string
}

interface PortfolioSummary {
  totalPnlSOL: number
  openPositions: number
}

interface AIAdvice {
  health: 'STRONG' | 'NEUTRAL' | 'WEAK'
  action: 'HOLD' | 'TAKE_PROFIT' | 'CUT_LOSS' | 'ADD_MORE'
  summary: string
  tips: string[]
}

const HEALTH_COLOR: Record<string, string> = { STRONG: '#14f195', NEUTRAL: '#ffc107', WEAK: '#ef4444' }
const ACTION_COLOR: Record<string, string> = { HOLD: '#9090a0', TAKE_PROFIT: '#14f195', CUT_LOSS: '#ef4444', ADD_MORE: '#9945ff' }

export function PortfolioPage() {
  const navigate = useNavigate()
  const { user, isGuest } = useAuth()
  const [positions, setPositions] = useState<Position[]>([])
  const [closedTrades, setClosedTrades] = useState<ClosedTrade[]>([])
  const [summary, setSummary] = useState<PortfolioSummary>({ totalPnlSOL: 0, openPositions: 0 })
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [aiAdvice, setAiAdvice] = useState<AIAdvice | null>(null)
  const [aiLoading, setAiLoading] = useState(false)

  const loadPositions = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      const { data: posData } = await supabase
        .from('positions')
        .select('*')
        .eq('user_pubkey', user.id)
        .order('created_at', { ascending: false })

      const { data: tradeData } = await supabase
        .from('trades')
        .select('*')
        .eq('user_pubkey', user.id)
        .order('created_at', { ascending: false })
        .limit(50)

      if (posData) {
        const mapped: Position[] = (posData as Record<string, unknown>[]).map((p) => ({
          mint: p.mint as string,
          tokenName: (p.token_name as string) ?? 'Unknown',
          tokenSymbol: (p.token_symbol as string) ?? '???',
          tokenImageUri: (p.token_image_uri as string) ?? '',
          entryPriceSOL: (p.entry_price_sol as number) ?? 0,
          amountTokens: (p.amount_tokens as number) ?? 0,
          amountSOLSpent: (p.amount_sol as number) ?? 0,
          timestamp: new Date((p.created_at as string)).getTime(),
          isLoading: true,
        }))
        setPositions(mapped)

        // Fetch live prices
        mapped.forEach((pos) => {
          fetchPrice(pos.mint).then((price) => {
            setPositions((prev) => prev.map((p) => p.mint === pos.mint ? { ...p, currentPrice: price, isLoading: false } : p))
          }).catch(() => {
            setPositions((prev) => prev.map((p) => p.mint === pos.mint ? { ...p, isLoading: false } : p))
          })
        })

        setSummary({ totalPnlSOL: 0, openPositions: mapped.length })
      }

      if (tradeData) {
        setClosedTrades((tradeData as Record<string, unknown>[]).map((t) => ({
          id: t.id as string,
          mint: t.mint as string,
          tokenName: (t.token_name as string) ?? 'Unknown',
          tokenSymbol: (t.token_symbol as string) ?? '???',
          tokenImageUri: (t.token_image_uri as string) ?? '',
          type: (t.type as 'buy' | 'sell') ?? 'buy',
          amountSOL: (t.amount_sol as number) ?? 0,
          timestamp: new Date((t.created_at as string)).getTime(),
          txSig: (t.tx_sig as string) ?? '',
        })))
      }
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [user])

  useEffect(() => {
    if (user) void loadPositions()
    else setLoading(false)
  }, [user, loadPositions])

  // Recalculate PnL when prices load
  useEffect(() => {
    const total = positions.reduce((sum, p) => {
      if (!p.currentPrice || p.currentPrice === 0) return sum
      const currentValue = (p.amountTokens / 1e9) * p.currentPrice
      return sum + (currentValue - p.amountSOLSpent)
    }, 0)
    setSummary((s) => ({ ...s, totalPnlSOL: total }))
  }, [positions])

  const analyzeWithAI = async () => {
    if (positions.length === 0 || aiLoading) return
    setAiLoading(true)
    try {
      const posData = positions.map((p) => {
        const pnlPct = p.currentPrice && p.entryPriceSOL
          ? ((p.currentPrice - p.entryPriceSOL) / p.entryPriceSOL) * 100
          : 0
        return `${p.tokenSymbol}: entry=${p.entryPriceSOL.toExponential(2)} current=${p.currentPrice?.toExponential(2) ?? 'unknown'} pnl=${pnlPct.toFixed(1)}%`
      }).join(', ')

      const prompt = `Portfolio analysis for Solana memecoins:
${posData}

Respond ONLY with JSON: {"health":"STRONG"|"NEUTRAL"|"WEAK","action":"HOLD"|"TAKE_PROFIT"|"CUT_LOSS"|"ADD_MORE","summary":"1 sentence","tips":["tip1","tip2"]}`

      const raw = await groqChat([{ role: 'user', content: prompt }], 200)
      const match = raw.match(/\{[\s\S]*\}/)
      if (match) setAiAdvice(JSON.parse(match[0]) as AIAdvice)
    } catch { /* silent */ } finally {
      setAiLoading(false)
    }
  }

  const pnlColor = summary.totalPnlSOL >= 0 ? '#14f195' : '#ef4444'

  if (isGuest) return (
    <div className="flex flex-col items-center justify-center h-64 gap-3 px-8">
      <BarChart2 size={32} className="opacity-30 text-dark-subtext" />
      <p className="text-dark-subtext text-sm text-center">Sign in to track your trades and portfolio performance.</p>
      <button onClick={() => navigate('/')} className="btn-primary text-sm">Sign In</button>
    </div>
  )

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-4 pt-5 pb-3 border-b border-dark-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart2 size={20} className="text-brand" />
          <h1 className="text-dark-text font-extrabold text-[22px]">Portfolio</h1>
        </div>
        <button
          onClick={() => { setRefreshing(true); void loadPositions() }}
          disabled={refreshing}
          className="text-dark-subtext hover:text-brand transition-colors"
        >
          <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-6 h-6 border-2 border-brand border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="p-4 flex flex-col gap-4 max-w-2xl mx-auto">
          {/* PnL card */}
          <div className="card p-6 flex flex-col items-center gap-1 text-center">
            <div className="text-dark-subtext text-xs font-semibold">Total Unrealized P&L</div>
            <div className="font-extrabold text-4xl" style={{ color: pnlColor }}>
              {summary.totalPnlSOL >= 0 ? '+' : ''}{formatSol(summary.totalPnlSOL)}
            </div>
            <div className="text-dark-subtext text-xs">{summary.openPositions} open position{summary.openPositions !== 1 ? 's' : ''}</div>
          </div>

          {/* AI Coach */}
          <div className="card p-4 border-[#9945ff44]" style={{ borderColor: '#9945ff44' }}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#9945ff]" />
                <span className="text-dark-text font-semibold text-sm">AI Portfolio Coach</span>
              </div>
              <button
                onClick={analyzeWithAI}
                disabled={aiLoading || positions.length === 0}
                className="text-[#9945ff] text-xs font-semibold hover:opacity-80 transition-opacity disabled:opacity-40 flex items-center gap-1"
              >
                {aiLoading ? <Loader2 size={12} className="animate-spin" /> : <Bot size={12} />}
                {aiAdvice ? 'Refresh' : 'Analyze'}
              </button>
            </div>

            {aiLoading ? (
              <div className="flex items-center gap-2 text-dark-subtext text-sm">
                <Loader2 size={14} className="animate-spin text-[#9945ff]" />
                Analyzing your positions…
              </div>
            ) : aiAdvice ? (
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-3">
                  <span className="font-bold text-sm px-2 py-1 rounded-lg" style={{ backgroundColor: HEALTH_COLOR[aiAdvice.health] + '22', color: HEALTH_COLOR[aiAdvice.health] }}>
                    {aiAdvice.health}
                  </span>
                  <span className="font-bold text-sm px-2 py-1 rounded-lg" style={{ backgroundColor: ACTION_COLOR[aiAdvice.action] + '22', color: ACTION_COLOR[aiAdvice.action] }}>
                    {aiAdvice.action.replace('_', ' ')}
                  </span>
                </div>
                <p className="text-dark-subtext text-sm">{aiAdvice.summary}</p>
                {aiAdvice.tips.map((tip, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs text-dark-subtext">
                    <span className="text-[#9945ff] mt-0.5">•</span>
                    {tip}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-dark-subtext text-xs">{positions.length === 0 ? 'Snipe a token to start tracking.' : 'Click Analyze for AI insights on your positions.'}</p>
            )}
          </div>

          {/* Open positions */}
          {positions.length > 0 && (
            <div>
              <h2 className="text-dark-subtext text-xs font-bold tracking-widest uppercase mb-2">Open Positions</h2>
              <div className="flex flex-col gap-3">
                {positions.map((pos) => {
                  const pnlPct = pos.currentPrice && pos.entryPriceSOL
                    ? ((pos.currentPrice - pos.entryPriceSOL) / pos.entryPriceSOL) * 100
                    : 0
                  const pnlSOL = pos.currentPrice
                    ? ((pos.amountTokens / 1e9) * pos.currentPrice) - pos.amountSOLSpent
                    : 0
                  const c = pnlPct >= 0 ? '#14f195' : '#ef4444'
                  return (
                    <div key={pos.mint} className="card p-4 flex flex-col gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-full bg-[#1a1a2e] flex-shrink-0 overflow-hidden">
                          {pos.tokenImageUri && <img src={toHttpUrl(pos.tokenImageUri)} alt={pos.tokenName} className="w-full h-full object-cover" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-dark-text font-bold">{pos.tokenName}</div>
                          <div className="text-dark-subtext text-xs">${pos.tokenSymbol}</div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-sm" style={{ color: c }}>{pnlPct >= 0 ? '+' : ''}{formatPercent(pnlPct)}</div>
                          <div className="text-xs font-semibold" style={{ color: c }}>{pnlSOL >= 0 ? '+' : ''}{formatSol(pnlSOL)}</div>
                        </div>
                      </div>
                      <div className="flex justify-between border-t border-dark-border pt-3">
                        <MetaItem label="Entry" value={pos.entryPriceSOL.toExponential(2)} />
                        <MetaItem label="Current" value={pos.isLoading ? '…' : pos.currentPrice ? pos.currentPrice.toExponential(2) : '—'} />
                        <MetaItem label="Cost" value={formatSol(pos.amountSOLSpent)} />
                      </div>
                      <button
                        onClick={() => navigate(`/token/${pos.mint}`)}
                        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-red-500/40 bg-red-500/10 text-red-400 text-sm font-bold hover:bg-red-500/20 transition-colors"
                      >
                        <TrendingDown size={14} /> Sell All
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {positions.length === 0 && closedTrades.length === 0 && (
            <div className="card p-10 flex flex-col items-center gap-3 text-dark-subtext">
              <Briefcase size={36} className="opacity-30" />
              <p className="font-semibold">No positions</p>
              <p className="text-xs text-center opacity-70">Snipe a token from the feed to open a position</p>
            </div>
          )}

          {/* Trade history */}
          {closedTrades.length > 0 && (
            <div>
              <h2 className="text-dark-subtext text-xs font-bold tracking-widest uppercase mb-2 mt-2">Trade History</h2>
              <div className="flex flex-col gap-2">
                {closedTrades.map((trade) => (
                  <div key={trade.id} className="card p-3 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-[#1a1a2e] overflow-hidden flex-shrink-0">
                      {trade.tokenImageUri && <img src={toHttpUrl(trade.tokenImageUri)} alt="" className="w-full h-full object-cover" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-dark-text text-sm font-semibold truncate">{trade.tokenName}</span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${trade.type === 'buy' ? 'bg-[#14f19520] text-[#14f195]' : 'bg-red-400/10 text-red-400'}`}>
                          {trade.type.toUpperCase()}
                        </span>
                      </div>
                      <div className="text-dark-subtext text-xs">{formatAge(trade.timestamp)} ago</div>
                    </div>
                    <div className="text-dark-text font-semibold text-sm">{formatSol(trade.amountSOL)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="text-dark-subtext text-[10px]">{label}</span>
      <span className="text-dark-text text-xs font-semibold">{value}</span>
    </div>
  )
}

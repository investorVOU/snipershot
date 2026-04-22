import React, { useEffect, useMemo, useState } from 'react'
import { useParams, useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeft, ExternalLink, Twitter, Globe, MessageCircle, Crosshair, Star, Users, Bot, Send, X } from 'lucide-react'
import type { FeedToken, AITokenRating, TokenOverview } from '../types'
import { fetchDexScreenerSnapshot, fetchTokenByMint } from '../services/pumpfun'
import { fetchTokenOverview, fetchTokenHoldersCount } from '../services/birdeye'
import { runRugFilter } from '../services/rugFilter'
import { getAITokenRating } from '../services/groq'
import { groqChat } from '../services/groqChat'
import { RugScoreBadge } from '../components/RugScoreBadge'
import { AIVerdictBadge } from '../components/AIVerdictBadge'
import { AIVerdictModal } from '../components/AIVerdictModal'
import { SnipeModal } from '../components/SnipeModal'
import { MemeChart, type MemeChartStatus } from '../components/MemeChart'
import { useWatchlist } from '../hooks/useWatchlist'
import { toHttpUrl, formatMarketCap, formatPrice, formatPercent, formatAge, shortenAddress } from '../services/format'
import { useAuth } from '../context/AuthContext'
import { buyTokenForUser, sellTokenForUser } from '../services/solana'
import { supabase } from '../services/supabase'
import { useTheme } from '../context/ThemeContext'

function mergeOverview(overview: TokenOverview | null, holdersCount: number | null): TokenOverview | null {
  if (!overview) return null
  return {
    ...overview,
    holders: overview.holders > 0 ? overview.holders : (holdersCount ?? 0),
  }
}

function canRateWithAI(token: FeedToken | null): token is FeedToken {
  return !!token && !!token.rugFilter && token.rugFilter.risk !== 'unknown'
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

export function TokenDetailPage() {
  const { mint } = useParams<{ mint: string }>()
  const location = useLocation()
  const navigate = useNavigate()
  const { toggleWatchlist, isWatched } = useWatchlist()
  const { user, wallet, isGuest, openAuthModal } = useAuth()
  const { colors, isDark } = useTheme()

  const passedToken = location.state?.token as FeedToken | undefined
  const [token, setToken] = useState<FeedToken | null>(passedToken ?? null)
  const [verdictModal, setVerdictModal] = useState<AITokenRating | null>(null)
  const [snipeOpen, setSnipeOpen] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const [chatMessages, setChatMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([])
  const [loading, setLoading] = useState(!passedToken)
  const [chartStatus, setChartStatus] = useState<MemeChartStatus>('unknown')
  const [positionAmount, setPositionAmount] = useState(0)
  const [selling, setSelling] = useState(false)

  const tokenContext = useMemo(() => {
    if (!token) return ''
    return [
      `Token: ${token.name} (${token.symbol})`,
      `Mint: ${token.mint}`,
      `Price: ${token.overview?.price ?? 0}`,
      `Market Cap: ${token.overview?.marketCap ?? token.usdMarketCap ?? 0}`,
      `24h Volume: ${token.overview?.volume24h ?? 0}`,
      `Liquidity: ${token.overview?.liquidity ?? 0}`,
      `Holders: ${token.overview?.holders ?? 0}`,
      `Rug Score: ${token.rugFilter?.score ?? 'unknown'}`,
      `Risk Flags: ${token.rugFilter?.flags?.join(', ') || 'none'}`,
      `Description: ${token.description || 'none'}`,
    ].join('\n')
  }, [token])

  useEffect(() => {
    if (!mint || passedToken) return

    setLoading(true)
    Promise.all([
      fetchTokenByMint(mint),
      fetchTokenOverview(mint),
      runRugFilter(mint),
      fetchTokenHoldersCount(mint),
      fetchDexScreenerSnapshot(mint),
    ])
      .then(([pump, overview, rugFilter, holdersCount, dexSnapshot]) => {
        const mergedOverview = mergeOverview(
          overview ?? (dexSnapshot ? { ...dexSnapshot.overview, holders: 0 } : null),
          holdersCount
        )
        const base = pump ?? dexSnapshot?.token ?? {
          mint,
          name: mergedOverview ? 'Unknown Token' : `${mint.slice(0, 8)}...`,
          symbol: '???',
          imageUri: '',
          description: '',
          creatorAddress: '',
          createdTimestamp: Date.now(),
          marketCap: mergedOverview?.marketCap ?? 0,
          usdMarketCap: mergedOverview?.marketCap ?? 0,
          solInCurve: 0,
          complete: false,
          twitterUrl: '',
          telegramUrl: '',
          websiteUrl: '',
          totalSupply: 1_000_000_000,
        }

        setToken({
          ...base,
          overview: mergedOverview,
          sparklineData: [],
          rugFilter,
          rugFilterLoading: false,
          aiRating: null,
          aiRatingLoading: false,
          isNewest: false,
          creatorDumped: false,
          creatorDumpPct: 0,
          fromCache: false,
        })
      })
      .finally(() => setLoading(false))
  }, [mint, passedToken])

  useEffect(() => {
    if (!mint || !passedToken) return

    Promise.all([
      fetchTokenOverview(mint),
      fetchTokenHoldersCount(mint),
      fetchDexScreenerSnapshot(mint),
    ]).then(([overview, holdersCount, dexSnapshot]) => {
      const mergedOverview = mergeOverview(
        overview ?? (dexSnapshot ? { ...dexSnapshot.overview, holders: 0 } : null),
        holdersCount
      )
      if (!mergedOverview && holdersCount == null) return

      setToken((prev) => prev ? {
        ...prev,
        overview: mergedOverview ?? (prev.overview ? mergeOverview(prev.overview, holdersCount) : prev.overview),
      } : prev)
    })

    if (!passedToken.rugFilter || passedToken.rugFilter.risk === 'unknown') {
      runRugFilter(mint).then((rugFilter) => {
        setToken((prev) => prev ? { ...prev, rugFilter, rugFilterLoading: false } : prev)
      })
    }
  }, [mint, passedToken])

  useEffect(() => {
    if (!canRateWithAI(token) || token.aiRating || token.aiRatingLoading) return

    const rugFilter = token.rugFilter!
    setToken((prev) => prev ? { ...prev, aiRatingLoading: true } : prev)
    getAITokenRating(token.name, token.symbol, token.description, rugFilter.score, rugFilter.flags, aiContext(token))
      .then((rating) => {
        setToken((prev) => prev ? { ...prev, aiRating: rating, aiRatingLoading: false } : prev)
      })
      .catch(() => {
        setToken((prev) => prev ? { ...prev, aiRatingLoading: false } : prev)
      })
  }, [token])

  useEffect(() => {
    if (!user || !mint) {
      setPositionAmount(0)
      return
    }

    void (async () => {
      try {
        const { data } = await supabase
          .from('positions')
          .select('*')
          .eq('user_pubkey', user.id)
          .eq('mint', mint)

        const openRows = ((data as Record<string, unknown>[] | null) ?? []).filter((row) => row.closed !== true)
        if (openRows.length > 0) {
          const total = openRows.reduce((sum, row) => sum + Number((row.amount_tokens as number) ?? 0), 0)
          setPositionAmount(total)
          return
        }

        const { data: fallbackRows } = await supabase
          .from('positions')
          .select('*')
          .eq('user_pubkey', user.id)
          .eq('mint', mint)
          .eq('closed', false)

        const total = ((fallbackRows as Record<string, unknown>[] | null) ?? []).reduce((sum, row) => sum + Number((row.amount_tokens as number) ?? 0), 0)
        setPositionAmount(total)
      } catch {
        setPositionAmount(0)
      }
    })()
  }, [mint, user])

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center h-screen">
        <div className="flex flex-col items-center gap-3 text-dark-subtext">
          <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin" />
          <span className="text-sm">Loading token...</span>
        </div>
      </div>
    )
  }

  if (!token) {
    return (
      <div className="flex-1 flex items-center justify-center h-screen text-dark-subtext">
        <p>Token not found</p>
      </div>
    )
  }

  const mc = token.overview?.marketCap ?? token.usdMarketCap ?? 0
  const price = token.overview?.price ?? 0
  const p1h = token.overview?.priceChange1h ?? 0
  const p24h = token.overview?.priceChange24h ?? 0
  const vol24h = token.overview?.volume24h ?? 0
  const liquidity = token.overview?.liquidity ?? 0
  const holders = token.overview?.holders ?? 0

  const sendChat = async () => {
    const text = chatInput.trim()
    if (!text || chatLoading) return

    setChatMessages((prev) => [...prev, { role: 'user', content: text }])
    setChatInput('')
    setChatLoading(true)

    try {
      const reply = await groqChat([
        { role: 'system', content: `You are an expert Solana memecoin analyst. Answer concisely using this token context:\n${tokenContext}` },
        ...chatMessages.map((message) => ({ role: message.role, content: message.content })),
        { role: 'user', content: text },
      ], 300)
      setChatMessages((prev) => [...prev, { role: 'assistant', content: reply }])
    } catch {
      setChatMessages((prev) => [...prev, { role: 'assistant', content: 'AI chat is unavailable right now.' }])
    } finally {
      setChatLoading(false)
    }
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="sticky top-0 z-10 bg-dark-bg/90 backdrop-blur-sm border-b border-dark-border px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-dark-subtext hover:text-dark-text transition-colors">
          <ArrowLeft size={20} />
        </button>
        <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0" style={{ backgroundColor: colors.surface }}>
          {toHttpUrl(token.imageUri) && (
            <img src={toHttpUrl(token.imageUri)} alt={token.name} className="w-full h-full object-cover" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-dark-text font-bold truncate">{token.name}</div>
          <div className="text-dark-subtext text-xs">${token.symbol}</div>
        </div>
        <button
          onClick={() => toggleWatchlist(token.mint)}
          className="w-9 h-9 rounded-lg border flex items-center justify-center transition-colors"
          style={{
            backgroundColor: isWatched(token.mint) ? '#9945ff22' : colors.surface,
            borderColor: isWatched(token.mint) ? '#9945ff55' : colors.border,
          }}
        >
          <Star size={15} color={isWatched(token.mint) ? '#9945ff' : colors.textMuted} fill={isWatched(token.mint) ? '#9945ff' : 'none'} />
        </button>
        <button onClick={() => setSnipeOpen(true)} className="btn-primary py-2 text-sm">
          <Crosshair size={14} /> Snipe
        </button>
        <button
          onClick={() => setChatOpen(true)}
          className="px-3 py-2 rounded-lg border text-sm font-semibold transition-colors"
          style={{
            backgroundColor: isDark ? '#9945ff22' : '#9945ff12',
            borderColor: isDark ? '#9945ff44' : '#9945ff2b',
            color: colors.accent,
          }}
        >
          <Bot size={14} className="inline mr-1.5" /> Ask AI
        </button>
      </div>

      <div className="p-4 flex flex-col gap-4 max-w-2xl mx-auto xl:max-w-none">
        <div className="card p-4">
          <div className="flex items-end justify-between mb-3">
            <div>
              <div className="text-dark-subtext text-xs mb-1">Price</div>
              <div className="text-dark-text font-bold text-2xl">{price > 0 ? formatPrice(price) : '—'}</div>
            </div>
            <div className="text-right">
              <div className="text-dark-subtext text-xs mb-1">Age</div>
              <div className="text-dark-text font-semibold">{formatAge(token.createdTimestamp)}</div>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <StatBox label="Market Cap" value={mc > 0 ? formatMarketCap(mc) : '—'} />
            <StatBox label="24h Volume" value={vol24h > 0 ? formatMarketCap(vol24h) : '—'} />
            <StatBox
              label="1h Change"
              value={p1h !== 0 ? formatPercent(p1h) : '—'}
              color={p1h > 0 ? '#14f195' : p1h < 0 ? '#ef4444' : undefined}
            />
            <StatBox label="Liquidity" value={liquidity > 0 ? formatMarketCap(liquidity) : '—'} />
            <StatBox label="Holders" value={holders > 0 ? holders.toLocaleString() : '—'} />
          </div>
        </div>

        <div className="card overflow-hidden p-4">
          <div className="px-0 pt-0 pb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-dark-text font-semibold text-sm">Price Chart</span>
              <span
                className={`px-2 py-1 rounded-full text-[11px] font-semibold ${
                  chartStatus === 'bonding'
                    ? 'bg-yellow-400/10 text-yellow-400 border border-yellow-400/20'
                    : chartStatus === 'graduated'
                      ? 'bg-[#14f19520] text-[#14f195] border border-[#14f19533]'
                      : 'bg-white/5 text-dark-subtext border border-white/10'
                }`}
              >
                {chartStatus === 'bonding' ? 'Bonding Curve' : chartStatus === 'graduated' ? 'Graduated' : 'State Unknown'}
              </span>
            </div>
            <span className={`text-sm font-bold ${p24h > 0 ? 'text-[#14f195]' : p24h < 0 ? 'text-red-400' : 'text-dark-subtext'}`}>
              {p24h !== 0 ? formatPercent(p24h) : ''}
            </span>
          </div>
          <MemeChart
            tokenAddress={token.mint}
            chain="solana"
            moralisApiKey={import.meta.env.VITE_MORALIS_API_KEY}
            height={360}
            onStatusChange={setChartStatus}
          />
        </div>

        <div className="card p-4">
          <h3 className="text-dark-text font-semibold mb-3">Safety Analysis</h3>
          <div className="flex flex-wrap gap-2 mb-3">
            <RugScoreBadge rugFilter={token.rugFilter} loading={token.rugFilterLoading} size="md" />
            <AIVerdictBadge
              aiRating={token.aiRating}
              loading={token.aiRatingLoading}
              creatorDumped={token.creatorDumped}
              creatorDumpPct={token.creatorDumpPct}
              onClick={setVerdictModal}
            />
            {holders > 0 && (
              <span className="stat-pill text-xs">
                <Users size={10} /> {holders.toLocaleString()} holders
              </span>
            )}
          </div>
          {token.rugFilter?.flags && token.rugFilter.flags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {token.rugFilter.flags.map((flag) => (
                <span key={flag} className="px-2 py-0.5 rounded bg-red-400/10 border border-red-400/20 text-red-400 text-xs font-medium">
                  {flag}
                </span>
              ))}
            </div>
          )}
        </div>

        {token.aiRating && (
          <div className="card p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-dark-text font-semibold">AI Analysis</h3>
              <button onClick={() => setVerdictModal(token.aiRating)} className="text-sm font-semibold hover:opacity-80 transition-opacity" style={{ color: colors.accent }}>
                View details
              </button>
            </div>
            <div className="flex items-center gap-3 mb-3">
              <AIVerdictBadge
                aiRating={token.aiRating}
                loading={false}
                creatorDumped={token.creatorDumped}
                creatorDumpPct={token.creatorDumpPct}
                onClick={setVerdictModal}
              />
              <div className="text-dark-subtext text-sm">{token.aiRating.reason}</div>
            </div>
            {token.aiRating.tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {token.aiRating.tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-2 py-1 rounded-lg border text-xs font-semibold"
                    style={{
                      backgroundColor: isDark ? '#9945ff14' : '#9945ff10',
                      borderColor: isDark ? '#9945ff33' : '#9945ff24',
                      color: colors.accent,
                    }}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="card p-4">
          <h3 className="text-dark-text font-semibold mb-3">Token Info</h3>
          {token.description && <p className="text-dark-subtext text-sm leading-relaxed mb-3">{token.description}</p>}
          <div className="space-y-2 text-sm">
            <InfoRow label="Mint" value={shortenAddress(token.mint, 8)} />
            <InfoRow label="Creator" value={shortenAddress(token.creatorAddress, 8)} />
          </div>
          <div className="flex gap-2 mt-3 flex-wrap">
            {token.twitterUrl && (
              <a href={token.twitterUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-dark-muted text-dark-subtext text-xs font-semibold hover:text-dark-text transition-colors">
                <Twitter size={12} /> Twitter
              </a>
            )}
            {token.telegramUrl && (
              <a href={token.telegramUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-dark-muted text-dark-subtext text-xs font-semibold hover:text-dark-text transition-colors">
                <MessageCircle size={12} /> Telegram
              </a>
            )}
            {token.websiteUrl && (
              <a href={token.websiteUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-dark-muted text-dark-subtext text-xs font-semibold hover:text-dark-text transition-colors">
                <Globe size={12} /> Website
              </a>
            )}
            <a
              href={`https://pump.fun/${token.mint}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-dark-muted text-dark-subtext text-xs font-semibold hover:text-dark-text transition-colors"
            >
              <ExternalLink size={12} /> Pump.fun
            </a>
          </div>
        </div>
      </div>

      <AIVerdictModal visible={verdictModal !== null} onClose={() => setVerdictModal(null)} verdict={verdictModal} tokenName={token.name} />
      <SnipeModal
        token={snipeOpen ? token : null}
        wallet={wallet}
        positionTokens={positionAmount}
        onClose={() => setSnipeOpen(false)}
        onConfirm={async (mint, amountSol, slippage) => {
          if (!user || isGuest || !wallet) { openAuthModal(); throw new Error('Sign in to trade') }
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
        onSell={async (mint, amountTokens, slippage) => {
          if (!user || !wallet) { openAuthModal(); throw new Error('Sign in to sell') }
          await sellTokenForUser({
            wallet,
            userId: user.id,
            mint,
            tokenName: token.name,
            tokenSymbol: token.symbol,
            tokenImageUri: token.imageUri,
            amountTokens,
            slippageBps: slippage * 100,
          })
          setPositionAmount(0)
        }}
      />

      {chatOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={() => setChatOpen(false)}>
          <div className="w-full max-w-xl bg-dark-card rounded-2xl border border-dark-border p-4 flex flex-col gap-4 max-h-[80vh]" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bot size={18} style={{ color: colors.accent }} />
                <h3 className="text-dark-text font-semibold">Ask AI about {token.symbol}</h3>
              </div>
              <button onClick={() => setChatOpen(false)} className="text-dark-subtext hover:text-dark-text transition-colors">
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto min-h-[240px] max-h-[420px] flex flex-col gap-3">
              {chatMessages.length === 0 ? (
                <div className="text-dark-subtext text-sm leading-relaxed">
                  Ask about safety, red flags, entry ideas, holder concentration, or overall token quality.
                </div>
              ) : (
                chatMessages.map((message, index) => (
                  <div
                    key={index}
                    className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${message.role === 'user' ? 'self-end bg-brand text-[#08110d]' : 'self-start bg-dark-muted text-dark-text border border-dark-border'}`}
                  >
                    {message.content}
                  </div>
                ))
              )}
              {chatLoading && (
                <div className="self-start bg-dark-muted text-dark-subtext border border-dark-border rounded-xl px-3 py-2 text-sm">
                  Analyzing...
                </div>
              )}
            </div>
            <div className="flex items-end gap-2">
              <textarea
                value={chatInput}
                onChange={(event) => setChatInput(event.target.value)}
                placeholder="Ask about this token..."
                className="flex-1 min-h-[56px] max-h-[120px] bg-dark-muted border border-dark-border rounded-xl px-3 py-3 text-sm text-dark-text placeholder:text-dark-subtext resize-none outline-none"
              />
              <button onClick={sendChat} disabled={!chatInput.trim() || chatLoading} className="w-11 h-11 rounded-xl bg-brand text-[#08110d] font-bold flex items-center justify-center disabled:opacity-50">
                <Send size={16} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function StatBox({ label, value, color }: { label: string; value: string; color?: string }) {
  const { colors } = useTheme()
  return (
    <div className="bg-dark-muted rounded-lg px-3 py-2">
      <div className="text-dark-subtext text-[10px] font-semibold mb-1">{label}</div>
      <div className="font-bold text-sm" style={{ color: color ?? colors.text }}>
        {value}
      </div>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-dark-subtext">{label}</span>
      <span className="text-dark-text font-mono text-xs">{value}</span>
    </div>
  )
}

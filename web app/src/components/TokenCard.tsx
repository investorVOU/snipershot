import { useState } from 'react'
import { Crosshair, ThumbsUp, ThumbsDown, Star, Droplets } from 'lucide-react'
import type { FeedToken, AITokenRating } from '../types'
import { Sparkline } from './Sparkline'
import { RugScoreBadge } from './RugScoreBadge'
import { AIVerdictBadge } from './AIVerdictBadge'
import { AIVerdictModal } from './AIVerdictModal'
import { NarrativeTags } from './NarrativeTags'
import { formatAge, formatMarketCap, toHttpUrl } from '../services/format'
import { useTheme } from '../context/ThemeContext'

interface TokenVotes {
  upvotes: number
  downvotes: number
  userVote: 'up' | 'down' | null
}

interface Props {
  token: FeedToken
  onPress: () => void
  onSnipe: () => void
  onWatch?: () => void
  isWatched?: boolean
}

export function TokenCard({ token, onPress, onSnipe, onWatch, isWatched }: Props) {
  const { colors } = useTheme()
  const [verdictModal, setVerdictModal] = useState<AITokenRating | null>(null)
  const [votes, setVotes] = useState<TokenVotes>({ upvotes: 0, downvotes: 0, userVote: null })

  const sparkData = token.sparklineData ?? []
  const sparkColor =
    sparkData.length >= 2
      ? sparkData[sparkData.length - 1] >= sparkData[0] ? '#14f195' : '#ef4444'
      : '#9945ff'

  const mc = token.overview?.marketCap ?? token.usdMarketCap ?? 0
  const liquidity = token.overview?.liquidity ?? 0
  const isGraduated = token.complete || liquidity > 0

  const vote = (dir: 'up' | 'down') => {
    setVotes((prev) => {
      const same = prev.userVote === dir
      return {
        upvotes: dir === 'up' ? prev.upvotes + (same ? -1 : 1) : prev.upvotes - (prev.userVote === 'up' ? 1 : 0),
        downvotes: dir === 'down' ? prev.downvotes + (same ? -1 : 1) : prev.downvotes - (prev.userVote === 'down' ? 1 : 0),
        userVote: same ? null : dir,
      }
    })
  }

  const imgSrc = toHttpUrl(token.imageUri) || undefined

  return (
    <>
      <div
        className="bg-dark-card rounded-[14px] p-[14px] flex flex-col gap-[10px] cursor-pointer transition-colors active:scale-[0.99]"
        onClick={onPress}
        onMouseEnter={(event) => { event.currentTarget.style.backgroundColor = colors.surface }}
        onMouseLeave={(event) => { event.currentTarget.style.backgroundColor = '' }}
      >
        {/* Top row: avatar · name/stats · sparkline */}
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full flex-shrink-0 overflow-hidden" style={{ backgroundColor: colors.surface }}>
            {imgSrc && (
              <img src={imgSrc} alt={token.name} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
            )}
          </div>

          <div className="flex-1 min-w-0 flex flex-col gap-1">
            <div className="flex items-center gap-1.5">
              <span className="text-[15px] font-bold text-dark-text truncate leading-none">{token.name}</span>
              <span className="text-[12px] font-semibold text-dark-subtext flex-shrink-0">${token.symbol}</span>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] font-medium text-dark-subtext">{formatAge(token.createdTimestamp)}</span>
              <span className="stat-pill">MC {mc > 0 ? formatMarketCap(mc) : '—'}</span>
              {liquidity > 0 && (
                <span className="stat-pill">
                  <Droplets size={8} />
                  {formatMarketCap(liquidity)}
                </span>
              )}
            </div>
          </div>

          {sparkData.length > 1 && (
            <div className="flex-shrink-0">
              <Sparkline data={sparkData} width={72} height={34} color={sparkColor} />
            </div>
          )}
        </div>

        {/* Narrative tags */}
        {!token.rugFilterLoading && (
          <NarrativeTags
            mint={token.mint}
            name={token.name}
            symbol={token.symbol}
            description={token.description}
          />
        )}

        {/* Safety badges */}
        <div className="flex items-center gap-2 flex-wrap">
          <RugScoreBadge rugFilter={token.rugFilter} loading={token.rugFilterLoading} size="sm" />
          <AIVerdictBadge
            aiRating={token.aiRating ?? null}
            loading={token.aiRatingLoading ?? false}
            creatorDumped={token.creatorDumped}
            creatorDumpPct={token.creatorDumpPct}
            onClick={(v) => setVerdictModal(v)}
          />
          <span
            className={`flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-semibold ${
              isGraduated
                ? 'bg-[#14f19520] border-[#14f19540] text-[#14f195]'
                : 'bg-yellow-400/10 border-yellow-400/30 text-yellow-400'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${isGraduated ? 'bg-[#14f195]' : 'bg-yellow-400'}`} />
            {isGraduated ? 'GRADUATED' : 'BONDING CURVE'}
          </span>
          {token.isNewest && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded border bg-[#9945ff20] border-[#9945ff40] text-[#9945ff] text-[10px] font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-[#9945ff] pulse-dot" />
              NEW
            </span>
          )}
        </div>

        {/* Footer: votes · watch · snipe */}
        <div className="flex items-center justify-between gap-2" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center gap-2">
            <button
              className="flex items-center gap-1 rounded-lg border px-2 py-[7px] text-[12px] font-bold transition-colors"
              style={{
                backgroundColor: votes.userVote === 'up' ? '#14f19522' : colors.surface,
                borderColor: votes.userVote === 'up' ? '#14f19555' : colors.border,
                color: votes.userVote === 'up' ? '#14f195' : colors.textMuted,
              }}
              onClick={() => vote('up')}
            >
              <ThumbsUp size={12} />
              {votes.upvotes}
            </button>
            <button
              className="flex items-center gap-1 rounded-lg border px-2 py-[7px] text-[12px] font-bold transition-colors"
              style={{
                backgroundColor: votes.userVote === 'down' ? '#ef444422' : colors.surface,
                borderColor: votes.userVote === 'down' ? '#ef444455' : colors.border,
                color: votes.userVote === 'down' ? '#ef4444' : colors.textMuted,
              }}
              onClick={() => vote('down')}
            >
              <ThumbsDown size={12} />
              {votes.downvotes}
            </button>
          </div>

          <div className="flex items-center gap-2">
            {onWatch && (
              <button
                className="w-8 h-8 rounded-lg border flex items-center justify-center transition-colors"
                style={{
                  backgroundColor: isWatched ? '#9945ff22' : colors.surface,
                  borderColor: isWatched ? '#9945ff55' : colors.border,
                }}
                onClick={onWatch}
              >
                <Star size={13} color={isWatched ? '#9945ff' : colors.textMuted} fill={isWatched ? '#9945ff' : 'none'} />
              </button>
            )}

            <button
              className="flex items-center gap-1.5 px-[14px] py-[7px] rounded-lg bg-brand text-[#08110d] text-[13px] font-bold hover:bg-brand-dark transition-colors"
              onClick={(e) => { e.stopPropagation(); onSnipe() }}
            >
              <Crosshair size={13} />
              Snipe
            </button>
          </div>
        </div>
      </div>

      <AIVerdictModal
        visible={verdictModal !== null}
        onClose={() => setVerdictModal(null)}
        verdict={verdictModal}
        tokenName={token.name}
      />
    </>
  )
}

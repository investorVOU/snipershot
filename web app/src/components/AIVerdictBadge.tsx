import { TrendingUp, TrendingDown, Minus, AlertTriangle, Loader2 } from 'lucide-react'
import type { AITokenRating } from '../types'

interface Props {
  aiRating: AITokenRating | null
  loading: boolean
  creatorDumped?: boolean
  creatorDumpPct?: number
  onClick?: (rating: AITokenRating) => void
}

export function AIVerdictBadge({ aiRating, loading, creatorDumped, creatorDumpPct, onClick }: Props) {
  if (creatorDumped && (creatorDumpPct ?? 0) > 30) {
    return (
      <span className="flex items-center gap-1 px-2 py-0.5 rounded border bg-red-500/10 border-red-500/30 text-red-400 text-[10px] font-semibold">
        <AlertTriangle size={10} />
        Dump {creatorDumpPct?.toFixed(0)}%
      </span>
    )
  }

  if (loading) {
    return (
      <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-white/5 text-white/30 text-[10px] font-semibold animate-pulse">
        <Loader2 size={10} className="animate-spin" />
        AI…
      </span>
    )
  }

  if (!aiRating) return null

  const config = {
    bullish: { color: 'text-[#14f195]', bg: 'bg-[#14f19520]', border: 'border-[#14f19540]', Icon: TrendingUp },
    neutral: { color: 'text-yellow-400', bg: 'bg-yellow-400/10', border: 'border-yellow-400/30', Icon: Minus },
    bearish: { color: 'text-orange-400', bg: 'bg-orange-400/10', border: 'border-orange-400/30', Icon: TrendingDown },
    scam: { color: 'text-red-400', bg: 'bg-red-400/10', border: 'border-red-400/30', Icon: AlertTriangle },
  }[aiRating.verdict]

  const label = { bullish: 'Bullish', neutral: 'Neutral', bearish: 'Bearish', scam: 'SCAM' }[aiRating.verdict]

  return (
    <button
      onClick={() => onClick?.(aiRating)}
      className={`flex items-center gap-1 px-2 py-0.5 rounded border ${config.bg} ${config.border} ${config.color} text-[10px] font-semibold ${onClick ? 'cursor-pointer hover:opacity-80' : 'cursor-default'} transition-opacity`}
    >
      <config.Icon size={10} />
      {label} {aiRating.score}
    </button>
  )
}

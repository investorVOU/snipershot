import { X, TrendingUp, TrendingDown, Minus, AlertTriangle } from 'lucide-react'
import type { AITokenRating } from '../types'

interface Props {
  visible: boolean
  onClose: () => void
  verdict: AITokenRating | null
  tokenName: string
}

export function AIVerdictModal({ visible, onClose, verdict, tokenName }: Props) {
  if (!visible || !verdict) return null

  const config = {
    bullish: { color: '#14f195', bg: '#14f19520', border: '#14f19540', Icon: TrendingUp, label: 'Bullish' },
    neutral: { color: '#facc15', bg: '#facc1520', border: '#facc1540', Icon: Minus, label: 'Neutral' },
    bearish: { color: '#fb923c', bg: '#fb923c20', border: '#fb923c40', Icon: TrendingDown, label: 'Bearish' },
    scam: { color: '#ef4444', bg: '#ef444420', border: '#ef444440', Icon: AlertTriangle, label: 'SCAM' },
  }[verdict.verdict]

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-md bg-dark-card rounded-2xl border border-dark-border p-6 slide-in-right"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-dark-text font-bold text-lg">AI Verdict</h2>
          <button onClick={onClose} className="text-dark-subtext hover:text-dark-text transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="flex items-center gap-3 mb-4">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center border"
            style={{ backgroundColor: config.bg, borderColor: config.border }}
          >
            <config.Icon size={22} color={config.color} />
          </div>
          <div>
            <div className="text-dark-subtext text-sm">{tokenName}</div>
            <div className="font-bold text-xl" style={{ color: config.color }}>{config.label}</div>
          </div>
          <div className="ml-auto text-right">
            <div className="text-dark-subtext text-xs">Score</div>
            <div className="font-bold text-2xl" style={{ color: config.color }}>{verdict.score}</div>
          </div>
        </div>

        <p className="text-dark-subtext text-sm leading-relaxed mb-4">{verdict.reason}</p>

        {verdict.tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {verdict.tags.map((tag) => (
              <span
                key={tag}
                className="px-2.5 py-1 rounded-lg border text-xs font-semibold"
                style={{ backgroundColor: config.bg, borderColor: config.border, color: config.color }}
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

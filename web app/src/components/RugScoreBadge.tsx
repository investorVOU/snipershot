import { Shield, ShieldAlert, ShieldX, ShieldQuestion } from 'lucide-react'
import type { RugFilterResult } from '../types'

interface Props {
  rugFilter: RugFilterResult | null
  loading: boolean
  size?: 'sm' | 'md'
}

export function RugScoreBadge({ rugFilter, loading, size = 'sm' }: Props) {
  const isSmall = size === 'sm'

  if (loading) {
    return (
      <span className={`flex items-center gap-1 px-2 py-0.5 rounded bg-white/5 text-white/30 ${isSmall ? 'text-[10px]' : 'text-xs'} font-semibold animate-pulse`}>
        <ShieldQuestion size={isSmall ? 10 : 12} />
        Analyzing…
      </span>
    )
  }

  if (!rugFilter) return null

  const { risk, score } = rugFilter

  const config = {
    safe: { color: 'text-[#14f195]', bg: 'bg-[#14f19520]', border: 'border-[#14f19540]', Icon: Shield },
    medium: { color: 'text-yellow-400', bg: 'bg-yellow-400/10', border: 'border-yellow-400/30', Icon: ShieldAlert },
    risky: { color: 'text-red-400', bg: 'bg-red-400/10', border: 'border-red-400/30', Icon: ShieldX },
    unknown: { color: 'text-white/40', bg: 'bg-white/5', border: 'border-white/10', Icon: ShieldQuestion },
  }[risk]

  const label = { safe: 'Safe', medium: 'Medium', risky: 'Risky', unknown: '?' }[risk]

  return (
    <span className={`flex items-center gap-1 px-2 py-0.5 rounded border ${config.bg} ${config.border} ${config.color} ${isSmall ? 'text-[10px]' : 'text-xs'} font-semibold`}>
      <config.Icon size={isSmall ? 10 : 12} />
      {label} {score > 0 && `${score}`}
    </span>
  )
}

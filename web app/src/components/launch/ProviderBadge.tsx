import { launchProviderLabel } from '../../lib/utils/launch'
import type { LaunchProvider } from '../../types'

export function ProviderBadge({ provider }: { provider: LaunchProvider | 'dexscreener' | 'unknown' | 'bonkfun' }) {
  if (provider === 'unknown' || provider === 'dexscreener') return null

  const label = provider === 'bonkfun' ? 'Bonk' : launchProviderLabel(provider)
  const styles =
    provider === 'pumpfun'
      ? 'bg-[#14f19514] border-[#14f19533] text-[#14f195]'
      : provider === 'bags'
        ? 'bg-[#f5a62312] border-[#f5a62333] text-[#f5a623]'
        : 'bg-white/5 border-white/10 text-dark-subtext'

  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${styles}`}>
      {label}
    </span>
  )
}

import { useId } from 'react'
import { APP_NAME } from '../branding'

interface BrandLogoProps {
  showWordmark?: boolean
  compact?: boolean
  name?: string
  className?: string
}

export function BrandLogo({ showWordmark = true, compact = false, name = APP_NAME, className = '' }: BrandLogoProps) {
  const gradientId = useId()
  const glowId = useId()
  const markSize = compact ? 36 : 56
  const wrapperClass = compact ? 'flex items-center gap-2.5' : 'flex items-center gap-3'
  const wordmarkClass = compact
    ? 'text-dark-text font-bold text-lg tracking-tight'
    : 'text-dark-text font-extrabold text-[30px] tracking-tight'

  return (
    <div className={`${wrapperClass} ${className}`.trim()}>
      <div
        className="relative overflow-hidden rounded-2xl border border-brand/20 shadow-[0_10px_30px_rgba(153,69,255,0.16)]"
        style={{
          width: markSize,
          height: markSize,
          background:
            'radial-gradient(circle at top left, rgba(153,69,255,0.22), rgba(8,12,18,0.96) 58%), linear-gradient(160deg, rgba(20,241,149,0.14), rgba(153,69,255,0.08))',
        }}
      >
        <svg
          viewBox="0 0 64 64"
          className="absolute inset-0 h-full w-full"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id={gradientId} x1="8%" y1="8%" x2="92%" y2="92%">
              <stop offset="0%" stopColor="#14f195" />
              <stop offset="48%" stopColor="#7bf7ff" />
              <stop offset="100%" stopColor="#9945ff" />
            </linearGradient>
            <radialGradient id={glowId} cx="50%" cy="28%" r="70%">
              <stop offset="0%" stopColor="#7bf7ff" stopOpacity="0.45" />
              <stop offset="100%" stopColor="#7bf7ff" stopOpacity="0" />
            </radialGradient>
          </defs>
          <circle cx="32" cy="18" r="18" fill={`url(#${glowId})`} />
          <g fill={`url(#${gradientId})`}>
            <path d="M32 10 49 52H41.8l-3.9-9.9H26.1L22.2 52H15L32 10Zm3.3 25.9L32 27.1l-3.4 8.8h6.7Z" />
            <path d="M32 20.6a11.4 11.4 0 1 1 0 22.8 11.4 11.4 0 0 1 0-22.8Zm0 4.2a7.2 7.2 0 1 0 0 14.4 7.2 7.2 0 0 0 0-14.4Z" opacity="0.85" />
            <circle cx="32" cy="32" r="2.35" />
          </g>
          <path d="M32 14v6M32 44v6M14 32h6M44 32h6" stroke="rgba(123,247,255,0.7)" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </div>
      {showWordmark && <span className={wordmarkClass}>{name}</span>}
    </div>
  )
}

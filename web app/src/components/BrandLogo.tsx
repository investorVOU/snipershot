import { APP_NAME } from '../branding'

interface BrandLogoProps {
  showWordmark?: boolean
  compact?: boolean
  name?: string
  className?: string
}

export function BrandLogo({ showWordmark = true, compact = false, name = APP_NAME, className = '' }: BrandLogoProps) {
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
            <linearGradient id="solanaBrandGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#14f195" />
              <stop offset="52%" stopColor="#76f3ff" />
              <stop offset="100%" stopColor="#9945ff" />
            </linearGradient>
          </defs>
          <g fill="url(#solanaBrandGradient)">
            <path d="M18 17.5c0-1.38 1.12-2.5 2.5-2.5h25a2.5 2.5 0 0 1 1.77 4.27L38.9 27.64a2.5 2.5 0 0 1-1.77.73h-25a2.5 2.5 0 0 1-1.77-4.27l8.37-8.37A2.5 2.5 0 0 1 20.5 15h25A2.5 2.5 0 0 1 48 17.5Z" opacity="0.95" />
            <path d="M18 31.75c0-1.38 1.12-2.5 2.5-2.5h25a2.5 2.5 0 0 1 1.77 4.27l-8.37 8.37a2.5 2.5 0 0 1-1.77.73h-25a2.5 2.5 0 0 1-1.77-4.27l8.37-8.37a2.5 2.5 0 0 1 1.77-.73h25A2.5 2.5 0 0 1 48 31.75Z" opacity="0.82" />
            <path d="M18 46c0-1.38 1.12-2.5 2.5-2.5h25a2.5 2.5 0 0 1 1.77 4.27l-8.37 8.37a2.5 2.5 0 0 1-1.77.73h-25a2.5 2.5 0 0 1-1.77-4.27l8.37-8.37a2.5 2.5 0 0 1 1.77-.73h25A2.5 2.5 0 0 1 48 46Z" opacity="0.7" />
          </g>
        </svg>
      </div>
      {showWordmark && <span className={wordmarkClass}>{name}</span>}
    </div>
  )
}

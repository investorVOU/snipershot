import { useEffect, useRef } from 'react'
import type { FeedToken } from '../types'

interface Props {
  tokens: FeedToken[]
}

const ITEM_WIDTH = 130

export function TickerBar({ tokens }: Props) {
  const items = tokens.slice(0, 12)
  const doubled = [...items, ...items]
  const containerRef = useRef<HTMLDivElement>(null)
  const posRef = useRef(0)
  const halfWidth = items.length * ITEM_WIDTH
  const animRef = useRef<number>(0)

  useEffect(() => {
    if (items.length === 0) return
    let last = performance.now()

    const tick = (now: number) => {
      const dt = now - last
      last = now
      posRef.current += (dt / 1000) * 60
      if (posRef.current >= halfWidth) posRef.current = 0
      if (containerRef.current) {
        containerRef.current.scrollLeft = posRef.current
      }
      animRef.current = requestAnimationFrame(tick)
    }
    animRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(animRef.current)
  }, [items.length, halfWidth])

  if (items.length === 0) return null

  return (
    <div className="flex items-center h-[46px] border-b border-dark-border bg-dark-card overflow-hidden flex-shrink-0">
      <div className="flex items-center gap-1 px-2 flex-shrink-0 border-r border-dark-border mr-1">
        <span className="w-1.5 h-1.5 rounded-full bg-brand pulse-dot" />
        <span className="text-brand text-[9px] font-extrabold tracking-widest">LIVE</span>
      </div>
      <div
        ref={containerRef}
        className="flex overflow-hidden"
        style={{ scrollBehavior: 'auto', overflowX: 'hidden' }}
      >
        <div className="flex" style={{ width: doubled.length * ITEM_WIDTH }}>
          {doubled.map((token, i) => {
            const change = token.overview?.priceChange24h ?? 0
            const price = token.overview?.price ?? 0
            const isUp = change >= 0
            const imgSrc = token.imageUri || undefined
            return (
              <div
                key={`${token.mint}-${i}`}
                className="flex items-center gap-1.5 px-2 border-r border-dark-border h-[46px] flex-shrink-0"
                style={{ width: ITEM_WIDTH }}
              >
                <div className="w-6 h-6 rounded-full bg-[#1a1a2e] flex-shrink-0 overflow-hidden">
                  {imgSrc && (
                    <img src={imgSrc} alt="" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-dark-text text-[11px] font-bold truncate">${token.symbol}</div>
                  {price > 0 && (
                    <div className="text-dark-subtext text-[9px] truncate">
                      ${price < 0.0001 ? price.toExponential(2) : price.toFixed(price < 0.01 ? 5 : 4)}
                    </div>
                  )}
                  <div className={`text-[10px] font-semibold ${isUp ? 'text-[#14f195]' : 'text-red-400'}`}>
                    {isUp ? '▲' : '▼'} {Math.abs(change).toFixed(1)}%
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

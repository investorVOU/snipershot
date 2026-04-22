import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ColorType,
  createChart,
  type IChartApi,
} from 'lightweight-charts'
import {
  fetchMoralisBondingStatus,
  fetchMoralisOHLCV,
  fetchMoralisSwaps,
  type MoralisCandle,
  type MoralisInterval,
  type MoralisSwap,
} from '../services/moralis'
import { useTheme } from '../context/ThemeContext'

type ChartPlatform = 'dexscreener' | 'geckoterminal' | 'moralis'
export type MemeChartStatus = 'bonding' | 'graduated' | 'unknown'
interface MemeChartProps {
  tokenAddress: string
  chain: string
  platform?: ChartPlatform
  width?: string
  height?: number
  moralisApiKey?: string
  interval?: MoralisInterval
  onStatusChange?: (status: MemeChartStatus) => void
}

const INTERVALS: MoralisInterval[] = ['1min', '5min', '15min', '1h', '4h', '1d']

function sanitizeAddress(tokenAddress: string): string {
  return encodeURIComponent(tokenAddress.trim())
}

function normalizeChain(chain: string): string {
  return chain.trim().toLowerCase()
}

function resolvePlatform(chain: string, platform?: ChartPlatform, moralisApiKey?: string): ChartPlatform {
  if (platform) return platform
  if (normalizeChain(chain) === 'solana') {
    if (!moralisApiKey) {
      // no Moralis key — fall back to DexScreener embed
      return 'dexscreener'
    }
    return 'moralis'
  }
  return 'dexscreener'
}

function dexScreenerChainSlug(chain: string): string {
  const normalized = normalizeChain(chain)
  const map: Record<string, string> = {
    ethereum: 'ethereum',
    eth: 'ethereum',
    solana: 'solana',
    bsc: 'bsc',
    base: 'base',
    arbitrum: 'arbitrum',
    polygon: 'polygon',
  }
  return map[normalized] ?? normalized
}

function geckoChainSlug(chain: string): string {
  const normalized = normalizeChain(chain)
  const map: Record<string, string> = {
    solana: 'solana',
    ethereum: 'eth',
    eth: 'eth',
    bsc: 'bsc',
    base: 'base',
    arbitrum: 'arbitrum',
    polygon: 'polygon_pos',
  }
  return map[normalized] ?? normalized
}

function embedUrl(platform: ChartPlatform, chain: string, tokenAddress: string, theme: 'dark' | 'light'): string {
  const safeAddress = sanitizeAddress(tokenAddress)
  if (platform === 'geckoterminal') {
    return `https://www.geckoterminal.com/${geckoChainSlug(chain)}/pools/${safeAddress}?embed=1&info=0&swaps=0&light_chart=0`
  }
  return `https://dexscreener.com/${dexScreenerChainSlug(chain)}/${safeAddress}?embed=1&theme=${theme}&trades=0&info=0`
}

function chartUnavailable(tokenAddress: string, chain: string): boolean {
  return !tokenAddress.trim() || !chain.trim()
}

function intervalToSeconds(interval: MoralisInterval): number {
  const map: Record<MoralisInterval, number> = {
    '1min': 60,
    '5min': 300,
    '15min': 900,
    '1h': 3600,
    '4h': 14400,
    '1d': 86400,
  }
  return map[interval]
}

function extractSwapPriceUsd(swap: MoralisSwap, tokenAddress: string): number | null {
  const normalized = tokenAddress.toLowerCase()
  const candidates = [swap.bought, swap.sold, swap.tokenIn, swap.tokenOut]

  for (const side of candidates) {
    if (!side?.address || side.address.toLowerCase() !== normalized) continue
    if (typeof side.usdPrice === 'number' && Number.isFinite(side.usdPrice) && side.usdPrice > 0) {
      return side.usdPrice
    }
    if (typeof side.usdAmount === 'number' && side.amount) {
      const amount = Number(side.amount)
      if (Number.isFinite(amount) && amount > 0) {
        return side.usdAmount / amount
      }
    }
  }

  return null
}

function swapsToCandles(swaps: MoralisSwap[], tokenAddress: string, interval: MoralisInterval): MoralisCandle[] {
  const bucketSize = intervalToSeconds(interval)
  const buckets = new Map<number, MoralisCandle>()

  swaps.forEach((swap) => {
    const rawTime = swap.blockTime ? Date.parse(swap.blockTime) : NaN
    if (!Number.isFinite(rawTime)) return

    const timestamp = Math.floor(rawTime / 1000)
    const price = extractSwapPriceUsd(swap, tokenAddress)
    if (!price || !Number.isFinite(price)) return

    const bucket = Math.floor(timestamp / bucketSize) * bucketSize
    const volume = typeof swap.totalValueUsd === 'number' ? swap.totalValueUsd : 0
    const current = buckets.get(bucket)

    if (!current) {
      buckets.set(bucket, {
        timestamp: bucket,
        open: price,
        high: price,
        low: price,
        close: price,
        volume,
      })
      return
    }

    current.high = Math.max(current.high, price)
    current.low = Math.min(current.low, price)
    current.close = price
    current.volume += volume
  })

  return Array.from(buckets.values()).sort((a, b) => a.timestamp - b.timestamp)
}

function Skeleton({ height }: { height: number }) {
  return (
    <div
      className="w-full rounded-[12px] border border-white/10 bg-[#0f0f0f] animate-pulse"
      style={{ height }}
    />
  )
}

function ErrorState({ message, onRetry, height }: { message: string; onRetry: () => void; height: number }) {
  return (
    <div
      className="rounded-[12px] border border-white/10 bg-[#0f0f0f] flex flex-col items-center justify-center gap-3 px-4 text-center"
      style={{ height }}
    >
      <p className="text-sm text-dark-subtext">{message}</p>
      <button onClick={onRetry} className="btn-ghost justify-center text-sm px-4 py-2">
        Retry
      </button>
    </div>
  )
}

function UnavailableState({ message, height }: { message: string; height: number }) {
  return (
    <div
      className="rounded-[12px] border border-white/10 bg-[#0f0f0f] flex flex-col items-center justify-center gap-2 px-4 text-center"
      style={{ height }}
    >
      <p className="text-sm text-dark-subtext">{message}</p>
      <p className="text-xs text-dark-faint">Real chart data is not available yet for this pre-graduation token.</p>
    </div>
  )
}

function EmbedChart({
  title,
  src,
  height,
  width,
  onLoad,
}: {
  title: string
  src: string
  height: number
  width: string
  onLoad?: () => void
}) {
  const [loaded, setLoaded] = useState(false)

  return (
    <div className="rounded-[12px] overflow-hidden border border-white/10 bg-[#0f0f0f]" style={{ width, height }}>
      {!loaded && <Skeleton height={height} />}
      <iframe
        src={src}
        title={title}
        frameBorder="0"
        allowFullScreen
        scrolling="no"
        sandbox="allow-scripts allow-same-origin allow-popups"
        onLoad={() => {
          setLoaded(true)
          onLoad?.()
        }}
        className={`w-full h-full ${loaded ? 'block' : 'hidden'}`}
      />
    </div>
  )
}

function MoralisChart({
  tokenAddress,
  moralisApiKey,
  height,
  width,
  defaultInterval,
  onGraduated,
  onStatusChange,
}: {
  tokenAddress: string
  moralisApiKey: string
  height: number
  width: string
  defaultInterval: MoralisInterval
  onGraduated: () => void
  onStatusChange?: (status: MemeChartStatus) => void
}) {
  const [interval, setInterval] = useState<MoralisInterval>(defaultInterval)
  const [bondingProgress, setBondingProgress] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [candles, setCandles] = useState<MoralisCandle[]>([])
  const [graduated, setGraduated] = useState(false)

  const chartContainerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)

  const loadData = useMemo(() => {
    return async (signal?: AbortSignal) => {
      setLoading(true)
      setError('')

      try {
        let bonding
        try {
          bonding = await fetchMoralisBondingStatus(tokenAddress, moralisApiKey, signal)
        } catch {
          onStatusChange?.('unknown')
          setGraduated(true)
          onGraduated()
          return
        }
        setBondingProgress(bonding.bondingProgress)

        if (bonding.hasGraduated) {
          onStatusChange?.('graduated')
          setGraduated(true)
          onGraduated()
          return
        }

        onStatusChange?.('bonding')

        let nextCandles: MoralisCandle[] = []
        try {
          nextCandles = await fetchMoralisOHLCV(tokenAddress, moralisApiKey, interval, 200, signal)
        } catch {
          const swaps = await fetchMoralisSwaps(tokenAddress, moralisApiKey, 400, signal)
          nextCandles = swapsToCandles(swaps, tokenAddress, interval)
        }

        if (!nextCandles.length) {
          setCandles([])
          setError('No chart data available yet for this token.')
          return
        }

        setCandles(nextCandles)
      } catch {
        if (signal?.aborted) return
        setError('Unable to load chart data. Check your API key or token address.')
      } finally {
        if (!signal?.aborted) setLoading(false)
      }
    }
  }, [interval, moralisApiKey, onGraduated, tokenAddress])

  useEffect(() => {
    const ctrl = new AbortController()
    void loadData(ctrl.signal)
    return () => ctrl.abort()
  }, [loadData])

  useEffect(() => {
    if (!chartContainerRef.current || !candles.length || graduated) return

    chartRef.current?.remove()

    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: height - 84,
      layout: {
        background: { type: ColorType.Solid, color: '#0f0f0f' },
        textColor: '#7e8a99',
      },
      grid: {
        vertLines: { color: '#1f2937' },
        horzLines: { color: '#1f2937' },
      },
      rightPriceScale: {
        borderColor: '#1f2937',
      },
      timeScale: {
        borderColor: '#1f2937',
        timeVisible: true,
        secondsVisible: false,
      },
    })

    const candleSeries = chart.addCandlestickSeries({
      upColor: '#26a69a',
      downColor: '#ef5350',
      borderUpColor: '#26a69a',
      borderDownColor: '#ef5350',
      wickUpColor: '#26a69a',
      wickDownColor: '#ef5350',
    })

    const volumeSeries = chart.addHistogramSeries({
      color: '#26a69a',
      priceFormat: { type: 'volume' },
      priceScaleId: '',
      lastValueVisible: false,
      priceLineVisible: false,
    })

    candleSeries.setData(candles.map((candle) => ({
      time: candle.timestamp as never,
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
    })))

    volumeSeries.setData(candles.map((candle) => ({
      time: candle.timestamp as never,
      value: candle.volume,
      color: candle.close >= candle.open ? '#26a69a88' : '#ef535088',
    })))

    chart.timeScale().fitContent()
    chartRef.current = chart

    const onResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({ width: chartContainerRef.current.clientWidth })
      }
    }

    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('resize', onResize)
      chart.remove()
    }
  }, [candles, graduated, height])

  const retry = () => {
    void loadData()
  }

  if (loading) {
    return <Skeleton height={height} />
  }

  if (graduated) {
    return (
      <div className="rounded-[12px] overflow-hidden border border-white/10 bg-[#0f0f0f] flex items-center justify-center text-dark-subtext text-sm" style={{ width, height }}>
        Graduated - switching to DEX chart
      </div>
    )
  }

  if (error && !candles.length) {
    return <UnavailableState message={error} height={height} />
  }

  return (
    <div className="rounded-[12px] overflow-hidden border border-white/10 bg-[#0f0f0f]" style={{ width, minHeight: height }}>
      <div className="flex flex-wrap items-center gap-2 border-b border-white/10 px-3 py-3">
        {INTERVALS.map((value) => (
          <button
            key={value}
            onClick={() => setInterval(value)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
              interval === value
                ? 'bg-[#26a69a] text-[#041312]'
                : 'bg-[#151515] text-dark-subtext border border-white/10'
            }`}
          >
            {value}
          </button>
        ))}
      </div>

      <div ref={chartContainerRef} className="w-full" style={{ height: height - 84 }} />

      <div className="border-t border-white/10 px-3 py-3 flex flex-col gap-2">
        <div className="flex items-center justify-between text-xs font-semibold text-dark-subtext">
          <span>Bonding Curve Progress - {bondingProgress?.toFixed(0) ?? 0}%</span>
          {bondingProgress === 100 && (
            <span className="rounded-full bg-[#26a69a22] px-2 py-1 text-[#26a69a]">
              Graduated - switching to DEX chart
            </span>
          )}
        </div>
        <div className="h-2.5 rounded-full bg-[#151515] overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{
              width: `${Math.max(0, Math.min(100, bondingProgress ?? 0))}%`,
              background: 'linear-gradient(90deg, #14532d 0%, #26a69a 100%)',
            }}
          />
        </div>
        {error && <div className="text-xs text-red-400">{error}</div>}
      </div>
    </div>
  )
}

export function MemeChart({
  tokenAddress,
  chain,
  platform,
  width = '100%',
  height = 500,
  moralisApiKey,
  interval = '5min',
  onStatusChange,
}: MemeChartProps) {
  const { theme } = useTheme()
  const resolvedPlatform = resolvePlatform(chain, platform, moralisApiKey)
  const [activePlatform, setActivePlatform] = useState<ChartPlatform>(resolvedPlatform)

  useEffect(() => {
    setActivePlatform(resolvePlatform(chain, platform, moralisApiKey))
  }, [chain, moralisApiKey, platform])

  useEffect(() => {
    if (activePlatform !== 'moralis') {
      onStatusChange?.('graduated')
    }
  }, [activePlatform, onStatusChange])

  if (chartUnavailable(tokenAddress, chain)) {
    return (
      <ErrorState
        message="Chart unavailable - token address or chain missing."
        onRetry={() => setActivePlatform(resolvePlatform(chain, platform, moralisApiKey))}
        height={height}
      />
    )
  }

  if (activePlatform === 'moralis') {
    if (!moralisApiKey) {
      return (
        <ErrorState
          message="Unable to load chart data. Check your API key or token address."
          onRetry={() => setActivePlatform('dexscreener')}
          height={height}
        />
      )
    }

    return (
      <MoralisChart
        tokenAddress={tokenAddress}
        moralisApiKey={moralisApiKey}
        height={height}
        width={width}
        defaultInterval={interval}
        onGraduated={() => setActivePlatform('dexscreener')}
        onStatusChange={onStatusChange}
      />
    )
  }

  return (
    <EmbedChart
      title={`MemeChart - ${tokenAddress}`}
      src={embedUrl(activePlatform, chain, tokenAddress, theme)}
      height={height}
      width={width}
      onLoad={() => onStatusChange?.('graduated')}
    />
  )
}

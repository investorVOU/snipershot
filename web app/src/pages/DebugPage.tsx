import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { fetchTokenOverview, fetchOHLCV, fetchTokenHoldersCount, fetchTokenSecurity } from '../services/birdeye'
import { fetchDexScreenerSnapshot, fetchTokenByMint } from '../services/pumpfun'
import { fetchJupiterPrice } from '../services/jupiter'
import { runRugFilter } from '../services/rugFilter'
import { getAITokenRating } from '../services/groq'

type TestResult = {
  label: string
  ok: boolean
  summary: string
  data?: unknown
}

const DEFAULT_MINT = '31wXTexmz1WVcrzx436Bd76TNcyuQMfjCJWUom5dpump'

async function runRawJson(url: string, init?: RequestInit): Promise<TestResult> {
  try {
    const res = await fetch(url, init)
    const text = await res.text()
    let parsed: unknown = text
    try {
      parsed = JSON.parse(text)
    } catch {
      // Keep raw text.
    }
    return {
      label: url,
      ok: res.ok,
      summary: `${res.status} ${res.statusText}`,
      data: parsed,
    }
  } catch (error) {
    return {
      label: url,
      ok: false,
      summary: error instanceof Error ? error.message : 'Request failed',
    }
  }
}

export function DebugPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [mint, setMint] = useState(searchParams.get('mint') || DEFAULT_MINT)
  const [busy, setBusy] = useState(false)
  const [results, setResults] = useState<TestResult[]>([])
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle')

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
  const supabaseAnon = import.meta.env.VITE_SUPABASE_ANON_KEY as string
  const birdeyeKey = import.meta.env.VITE_BIRDEYE_KEY as string

  const normalizedMint = useMemo(() => mint.trim(), [mint])

  const copyAll = async () => {
    const payload = JSON.stringify({
      mint: normalizedMint,
      generatedAt: new Date().toISOString(),
      results,
    }, null, 2)

    try {
      await navigator.clipboard.writeText(payload)
      setCopyState('copied')
      setTimeout(() => setCopyState('idle'), 2000)
    } catch {
      setCopyState('failed')
      setTimeout(() => setCopyState('idle'), 3000)
    }
  }

  const runAll = async () => {
    if (!normalizedMint) return

    setBusy(true)
    setSearchParams({ mint: normalizedMint })

    const proxyBase = `${supabaseUrl}/functions/v1/birdeye-proxy`
    const now = Math.floor(Date.now() / 1000)
    const ohlcvFrom = now - 3600

    const nextResults: TestResult[] = []

    nextResults.push(await runRawJson(proxyBase, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${supabaseAnon}`,
      },
      body: JSON.stringify({
        path: '/defi/token_overview',
        params: { address: normalizedMint },
      }),
    }))

    nextResults.push(await runRawJson(`https://public-api.birdeye.so/defi/token_overview?address=${normalizedMint}`, {
      headers: {
        'X-API-KEY': birdeyeKey,
        'x-chain': 'solana',
      },
    }))

    nextResults.push(await runRawJson(`https://public-api.birdeye.so/defi/ohlcv?address=${normalizedMint}&type=1m&time_from=${ohlcvFrom}&time_to=${now}`, {
      headers: {
        'X-API-KEY': birdeyeKey,
        'x-chain': 'solana',
      },
    }))

    nextResults.push(await runRawJson(`https://public-api.birdeye.so/defi/v3/token/holder?address=${normalizedMint}&offset=0&limit=1`, {
      headers: {
        'X-API-KEY': birdeyeKey,
        'x-chain': 'solana',
      },
    }))

    const dexSnapshot = await fetchDexScreenerSnapshot(normalizedMint)
    nextResults.push({
      label: 'DexScreener snapshot',
      ok: dexSnapshot !== null,
      summary: dexSnapshot ? `price=${dexSnapshot.overview.price} mc=${dexSnapshot.overview.marketCap}` : 'No pair data',
      data: dexSnapshot,
    })

    const tokenByMint = await fetchTokenByMint(normalizedMint)
    nextResults.push({
      label: 'Token by mint',
      ok: tokenByMint !== null,
      summary: tokenByMint ? `${tokenByMint.name} (${tokenByMint.symbol})` : 'No token shell',
      data: tokenByMint,
    })

    const overview = await fetchTokenOverview(normalizedMint)
    nextResults.push({
      label: 'Overview service',
      ok: overview !== null,
      summary: overview ? `price=${overview.price} mc=${overview.marketCap} lp=${overview.liquidity}` : 'No overview',
      data: overview,
    })

    const holders = await fetchTokenHoldersCount(normalizedMint)
    nextResults.push({
      label: 'Holders service',
      ok: holders !== null,
      summary: holders !== null ? `${holders} holders` : 'No holder count',
      data: holders,
    })

    const security = await fetchTokenSecurity(normalizedMint)
    nextResults.push({
      label: 'Security service',
      ok: security !== null,
      summary: security ? 'Security payload returned' : 'No security payload',
      data: security,
    })

    const ohlcv = await fetchOHLCV(normalizedMint, '1m', 60)
    nextResults.push({
      label: 'OHLCV service',
      ok: ohlcv.length > 0,
      summary: `${ohlcv.length} bars`,
      data: ohlcv.slice(0, 3),
    })

    const jupiterPrice = await fetchJupiterPrice(normalizedMint)
    nextResults.push({
      label: 'Jupiter price',
      ok: jupiterPrice !== null,
      summary: jupiterPrice !== null ? `${jupiterPrice}` : 'No Jupiter price',
      data: jupiterPrice,
    })

    const rug = await runRugFilter(normalizedMint)
    nextResults.push({
      label: 'Rug filter',
      ok: rug.risk !== 'unknown',
      summary: `${rug.score}/100 ${rug.risk}`,
      data: rug,
    })

    try {
      const ai = await getAITokenRating(
        tokenByMint?.name ?? 'Unknown',
        tokenByMint?.symbol ?? '???',
        tokenByMint?.description ?? '',
        rug.score,
        rug.flags
      )
      nextResults.push({
        label: 'Groq AI',
        ok: true,
        summary: `${ai.verdict} ${ai.score}/100`,
        data: ai,
      })
    } catch (error) {
      nextResults.push({
        label: 'Groq AI',
        ok: false,
        summary: error instanceof Error ? error.message : 'AI failed',
      })
    }

    setResults(nextResults)
    setBusy(false)
  }

  return (
    <div className="min-h-screen bg-dark-bg text-dark-text p-4 sm:p-6">
      <div className="max-w-5xl mx-auto flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Token Debug</h1>
            <p className="text-dark-subtext text-sm">Run the real client-side fetch paths for a mint and inspect which source is failing.</p>
          </div>
          <Link to={`/token/${normalizedMint}`} className="text-sm font-semibold text-brand hover:opacity-80">
            Open token page
          </Link>
        </div>

        <div className="card p-4 flex flex-col gap-3">
          <label className="text-sm font-semibold text-dark-subtext">Mint</label>
          <input
            className="input"
            value={mint}
            onChange={(event) => setMint(event.target.value)}
            placeholder="Enter token mint"
          />
          <div className="flex flex-col sm:flex-row gap-2">
            <button onClick={runAll} disabled={busy || !normalizedMint} className="btn-primary justify-center w-full sm:w-auto">
              {busy ? 'Running tests...' : 'Run endpoint tests'}
            </button>
            <button
              onClick={copyAll}
              disabled={results.length === 0}
              className="px-4 py-2 rounded-xl border border-dark-border bg-dark-muted text-dark-text text-sm font-semibold disabled:opacity-50"
            >
              {copyState === 'copied' ? 'Copied' : copyState === 'failed' ? 'Copy failed' : 'Copy all output'}
            </button>
          </div>
        </div>

        <div className="grid gap-3">
          {results.map((result) => (
            <div key={result.label} className="card p-4">
              <div className="flex items-center justify-between gap-3 mb-2">
                <div className="font-semibold">{result.label}</div>
                <span className={`text-xs font-bold px-2 py-1 rounded ${result.ok ? 'bg-[#14f19520] text-[#14f195]' : 'bg-red-400/10 text-red-400'}`}>
                  {result.ok ? 'OK' : 'FAIL'}
                </span>
              </div>
              <div className="text-sm text-dark-subtext mb-3">{result.summary}</div>
              {result.data !== undefined && (
                <pre className="overflow-x-auto rounded-xl bg-dark-muted p-3 text-xs text-dark-text whitespace-pre-wrap break-all">
                  {JSON.stringify(result.data, null, 2)}
                </pre>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

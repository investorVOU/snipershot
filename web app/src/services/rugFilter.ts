import type { RugFilterResult } from '../types'
import { fetchTokenSecurity } from './birdeye'
import { fetchDexScreenerSnapshot } from './pumpfun'
import { fetchTokenOverview, fetchTokenHoldersCount } from './birdeye'

const RPC_URL = import.meta.env.VITE_SOLANA_RPC ?? 'https://api.mainnet-beta.solana.com'

function unknownResult(flags: string[]): RugFilterResult {
  return {
    score: 0,
    risk: 'unknown',
    flags,
    mintAuthorityRevoked: false,
    freezeAuthorityRevoked: false,
    lpLocked: false,
    top10HolderPercent: 0,
  }
}

async function fetchMintAuthorities(mint: string): Promise<{ mintAuthorityRevoked: boolean; freezeAuthorityRevoked: boolean } | null> {
  try {
    const res = await fetch(RPC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getAccountInfo',
        params: [mint, { encoding: 'jsonParsed' }],
      }),
    })
    if (!res.ok) return null
    const json = await res.json() as {
      result?: {
        value?: {
          data?: {
            parsed?: {
              info?: {
                mintAuthority?: string | null
                freezeAuthority?: string | null
              }
            }
          }
        }
      }
    }
    const info = json.result?.value?.data?.parsed?.info
    if (!info) return null
    return {
      mintAuthorityRevoked: !info.mintAuthority,
      freezeAuthorityRevoked: !info.freezeAuthority,
    }
  } catch {
    return null
  }
}

function deriveScore(params: {
  mintAuthorityRevoked: boolean | null
  freezeAuthorityRevoked: boolean | null
  top10HolderPercent: number | null
  liquidity: number
  holders: number | null
  marketCap: number
  sourceFlags?: string[]
}): RugFilterResult {
  const flags = [...(params.sourceFlags ?? [])]
  let score = 100

  if (params.mintAuthorityRevoked === false) {
    flags.push('Mint authority active')
    score -= 30
  } else if (params.mintAuthorityRevoked === null) {
    flags.push('Mint authority unavailable')
    score -= 8
  }
  if (params.freezeAuthorityRevoked === false) {
    flags.push('Freeze authority active')
    score -= 20
  } else if (params.freezeAuthorityRevoked === null) {
    flags.push('Freeze authority unavailable')
    score -= 6
  }
  if (params.top10HolderPercent != null) {
    if (params.top10HolderPercent > 50) {
      flags.push(`Top 10 hold ${params.top10HolderPercent.toFixed(0)}%`)
      score -= 20
    }
    if (params.top10HolderPercent > 80) {
      score -= 20
    }
  } else {
    flags.push('Top holders unavailable')
    score -= 8
  }
  if (params.liquidity <= 0) {
    flags.push('No verified liquidity')
    score -= 15
  } else if (params.liquidity < 5000) {
    flags.push('Low liquidity')
    score -= 10
  }
  if ((params.holders ?? 0) <= 0) {
    flags.push('Holder count unavailable')
    score -= 5
  } else if ((params.holders ?? 0) < 25) {
    flags.push('Very few holders')
    score -= 10
  }
  if (params.marketCap > 0 && params.marketCap < 5000) {
    flags.push('Very low market cap')
    score -= 8
  }

  score = Math.max(0, Math.min(100, score))

  return {
    score,
    risk: score >= 70 ? 'safe' : score >= 40 ? 'medium' : 'risky',
    flags,
    mintAuthorityRevoked: params.mintAuthorityRevoked ?? false,
    freezeAuthorityRevoked: params.freezeAuthorityRevoked ?? false,
    lpLocked: params.liquidity > 0,
    top10HolderPercent: params.top10HolderPercent ?? 0,
  }
}

export async function runRugFilter(mint: string): Promise<RugFilterResult> {
  try {
    const security = await fetchTokenSecurity(mint)
    if (security) {
      const mintAuthorityRevoked = !security.mintAuthority
      const freezeAuthorityRevoked = !security.freezeAuthority
      const top10 = typeof security.top10HolderPercent === 'number' ? security.top10HolderPercent : null

      return deriveScore({
        mintAuthorityRevoked,
        freezeAuthorityRevoked,
        top10HolderPercent: top10,
        liquidity: 0,
        holders: null,
        marketCap: 0,
        sourceFlags: ['Birdeye security'],
      })
    }

    const [authorities, overview, dexSnapshot, holders] = await Promise.all([
      fetchMintAuthorities(mint),
      fetchTokenOverview(mint),
      fetchDexScreenerSnapshot(mint),
      fetchTokenHoldersCount(mint),
    ])

    const liquidity = overview?.liquidity ?? dexSnapshot?.overview.liquidity ?? 0
    const marketCap = overview?.marketCap ?? dexSnapshot?.overview.marketCap ?? 0

    if (!authorities && !overview && !dexSnapshot && holders == null) {
      return unknownResult(['Security data unavailable'])
    }

    return deriveScore({
      mintAuthorityRevoked: authorities?.mintAuthorityRevoked ?? null,
      freezeAuthorityRevoked: authorities?.freezeAuthorityRevoked ?? null,
      top10HolderPercent: null,
      liquidity,
      holders,
      marketCap,
      sourceFlags: ['Derived from live token data'],
    })
  } catch {
    return unknownResult(['Security analysis failed'])
  }
}

import type { RugFilterResult } from '../types'
import { fetchTokenSecurity } from './birdeye'

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

export async function runRugFilter(mint: string): Promise<RugFilterResult> {
  try {
    const security = await fetchTokenSecurity(mint)
    if (!security) {
      return unknownResult(['Security data unavailable'])
    }

    const mintAuthorityRevoked = !security.mintAuthority
    const freezeAuthorityRevoked = !security.freezeAuthority
    const top10 = typeof security.top10HolderPercent === 'number' ? security.top10HolderPercent : null
    const lpLocked = false

    const flags: string[] = []
    let score = 100

    if (!mintAuthorityRevoked) {
      flags.push('Mint authority active')
      score -= 30
    }
    if (!freezeAuthorityRevoked) {
      flags.push('Freeze authority active')
      score -= 20
    }
    if (top10 !== null) {
      if (top10 > 50) {
        flags.push(`Top 10 hold ${top10.toFixed(0)}%`)
        score -= 20
      }
      if (top10 > 80) {
        score -= 20
      }
    } else {
      flags.push('Top holders unavailable')
    }

    flags.push('LP not verified')
    score -= 10

    score = Math.max(0, Math.min(100, score))

    const risk: RugFilterResult['risk'] =
      score >= 70 ? 'safe' : score >= 40 ? 'medium' : 'risky'

    return {
      score,
      risk,
      flags,
      mintAuthorityRevoked,
      freezeAuthorityRevoked,
      lpLocked,
      top10HolderPercent: top10 ?? 0,
    }
  } catch {
    return unknownResult(['Security analysis failed'])
  }
}

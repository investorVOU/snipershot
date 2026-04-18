import { getMintInfo, getTokenAccountBalance } from './helius';
import { fetchTokenSecurity } from './birdeye';

export interface RugFilterResult {
  rugScore: number;
  mintAuthorityRevoked: boolean;
  freezeAuthorityRevoked: boolean;
  lpLocked: boolean;
  top10HolderPercent: number;
  creatorSoldAll: boolean;
  breakdown: RugBreakdownItem[];
}

export interface RugBreakdownItem {
  label: string;
  safe: boolean;
  score: number;
  detail: string;
}

const SCORE_MINT_NOT_REVOKED = 30;
const SCORE_FREEZE_NOT_REVOKED = 20;
const SCORE_LP_NOT_LOCKED = 25;
const SCORE_TOP10_GT40 = 15;
const SCORE_TOP10_GT60 = 25;
const SCORE_CREATOR_SOLD = 20;

/** Run the full rug filter for a token. Returns rugScore + per-field breakdown. */
export async function runRugFilter(
  mint: string,
  creatorAddress: string
): Promise<RugFilterResult> {
  // Fetch data in parallel
  const [mintInfo, securityInfo] = await Promise.all([
    getMintInfo(mint),
    fetchTokenSecurity(mint),
  ]);

  // Check creator balance
  let creatorBalance = 0;
  if (creatorAddress) {
    creatorBalance = await getTokenAccountBalance(creatorAddress, mint);
  }

  // If mintInfo is null (API failed), treat mint/freeze as unknown — don't penalize
  const hasMintData = mintInfo !== null;
  const mintAuthorityRevoked = mintInfo?.mintAuthorityRevoked ?? false;
  const freezeAuthorityRevoked = mintInfo?.freezeAuthorityRevoked ?? false;

  // If securityInfo is empty (API failed/token too new), treat LP/holders as unknown
  const hasSecurityData = Object.keys(securityInfo).length > 0;
  const lpLocked = securityInfo.lpLocked ?? false;
  const top10HolderPercent = securityInfo.top10HolderPercent ?? 0;

  // Only flag creator sold if we have a valid creator address and confirmed balance
  const creatorSoldAll = !!creatorAddress && creatorBalance === 0;

  let rugScore = 0;
  const breakdown: RugBreakdownItem[] = [];

  // Mint authority
  if (!hasMintData) {
    breakdown.push({ label: 'Mint Authority', safe: true, score: 0, detail: 'On-chain data loading…' });
  } else if (!mintAuthorityRevoked) {
    rugScore += SCORE_MINT_NOT_REVOKED;
    breakdown.push({ label: 'Mint Authority', safe: false, score: SCORE_MINT_NOT_REVOKED, detail: 'Mint authority not revoked — creator can mint more tokens' });
  } else {
    breakdown.push({ label: 'Mint Authority', safe: true, score: 0, detail: 'Mint authority revoked' });
  }

  // Freeze authority
  if (!hasMintData) {
    breakdown.push({ label: 'Freeze Authority', safe: true, score: 0, detail: 'On-chain data loading…' });
  } else if (!freezeAuthorityRevoked) {
    rugScore += SCORE_FREEZE_NOT_REVOKED;
    breakdown.push({ label: 'Freeze Authority', safe: false, score: SCORE_FREEZE_NOT_REVOKED, detail: 'Freeze authority not revoked — wallets can be frozen' });
  } else {
    breakdown.push({ label: 'Freeze Authority', safe: true, score: 0, detail: 'Freeze authority revoked' });
  }

  // LP locked
  if (!hasSecurityData) {
    breakdown.push({ label: 'LP Locked', safe: true, score: 0, detail: 'Security data not yet available' });
  } else if (!lpLocked) {
    rugScore += SCORE_LP_NOT_LOCKED;
    breakdown.push({ label: 'LP Locked', safe: false, score: SCORE_LP_NOT_LOCKED, detail: 'Liquidity pool is not locked — can be removed at any time' });
  } else {
    breakdown.push({ label: 'LP Locked', safe: true, score: 0, detail: 'Liquidity pool is locked' });
  }

  // Top 10 holders
  if (!hasSecurityData) {
    breakdown.push({ label: 'Top 10 Holders', safe: true, score: 0, detail: 'Holder data not yet available' });
  } else {
    let top10Score = 0;
    let top10Detail = '';
    if (top10HolderPercent > 60) {
      top10Score = SCORE_TOP10_GT60;
      top10Detail = `Top 10 holders own ${top10HolderPercent.toFixed(1)}% — very concentrated`;
    } else if (top10HolderPercent > 40) {
      top10Score = SCORE_TOP10_GT40;
      top10Detail = `Top 10 holders own ${top10HolderPercent.toFixed(1)}% — concentrated`;
    } else {
      top10Detail = `Top 10 holders own ${top10HolderPercent.toFixed(1)}% — distributed`;
    }
    rugScore += top10Score;
    breakdown.push({ label: 'Top 10 Holders', safe: top10Score === 0, score: top10Score, detail: top10Detail });
  }

  // Creator sold all — only score if we have a creator address
  if (!creatorAddress) {
    breakdown.push({ label: 'Creator Holdings', safe: true, score: 0, detail: 'Creator address unknown' });
  } else if (creatorSoldAll) {
    rugScore += SCORE_CREATOR_SOLD;
    breakdown.push({ label: 'Creator Holdings', safe: false, score: SCORE_CREATOR_SOLD, detail: 'Creator has sold all tokens' });
  } else {
    breakdown.push({ label: 'Creator Holdings', safe: true, score: 0, detail: 'Creator still holds tokens' });
  }

  // Clamp to 0–100
  rugScore = Math.min(100, Math.max(0, rugScore));

  return {
    rugScore,
    mintAuthorityRevoked,
    freezeAuthorityRevoked,
    lpLocked,
    top10HolderPercent,
    creatorSoldAll,
    breakdown,
  };
}

/** Get the risk label for a rug score */
export function getRugRiskLabel(score: number): 'safe' | 'medium' | 'risky' {
  if (score <= 20) return 'safe';
  if (score <= 50) return 'medium';
  return 'risky';
}

/** Get badge colour for a rug score */
export function getRugScoreColor(score: number): string {
  if (score <= 20) return '#14f195';
  if (score <= 50) return '#f5a623';
  return '#ff4444';
}

import type { FeedToken } from '../types'
import type { EmbeddedWallet } from './walletService'

const STORAGE_KEY = 'snipershot_autosnipe_config'

export interface AutoSnipeConfig {
  enabled: boolean
  amountSol: number
  slippageBps: number
  minSafeScore: number       // minimum rug score to auto-buy (0-100, higher = safer)
  maxMarketCapUsd: number    // 0 = no limit
  autoSellProfitPct: number  // e.g. 200 = sell at 2x, 0 = disabled
  autoSellLossPct: number    // e.g. 50 = stop-loss at -50%, 0 = disabled
}

export const DEFAULT_AUTO_SNIPE_CONFIG: AutoSnipeConfig = {
  enabled: false,
  amountSol: 0.05,
  slippageBps: 1500,
  minSafeScore: 60,
  maxMarketCapUsd: 0,
  autoSellProfitPct: 200,
  autoSellLossPct: 50,
}

export function loadAutoSnipeConfig(): AutoSnipeConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return { ...DEFAULT_AUTO_SNIPE_CONFIG, ...JSON.parse(raw) as Partial<AutoSnipeConfig> }
  } catch { /* ignore */ }
  return { ...DEFAULT_AUTO_SNIPE_CONFIG }
}

export function saveAutoSnipeConfig(config: AutoSnipeConfig): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
}

export function shouldAutoSnipe(token: FeedToken, config: AutoSnipeConfig): boolean {
  if (!config.enabled) return false
  if (!token.rugFilter || token.rugFilter.risk === 'unknown') return false
  if (token.rugFilter.score < config.minSafeScore) return false
  if (token.rugFilter.risk === 'risky') return false
  if (config.maxMarketCapUsd > 0) {
    const mc = token.overview?.marketCap ?? token.usdMarketCap ?? 0
    if (mc > config.maxMarketCapUsd) return false
  }
  return true
}

// Auto-sell monitor: checks open positions against profit/loss thresholds
export function checkAutoSell(
  positionTokens: number,
  entryPriceSol: number,
  currentPriceSol: number,
  config: AutoSnipeConfig
): 'take-profit' | 'stop-loss' | null {
  if (positionTokens <= 0 || entryPriceSol <= 0 || currentPriceSol <= 0) return null
  const changePct = ((currentPriceSol - entryPriceSol) / entryPriceSol) * 100

  if (config.autoSellProfitPct > 0 && changePct >= config.autoSellProfitPct) return 'take-profit'
  if (config.autoSellLossPct > 0 && changePct <= -config.autoSellLossPct) return 'stop-loss'
  return null
}

// Hook that tries to auto-snipe a newly arrived token
export async function tryAutoSnipe(
  token: FeedToken,
  config: AutoSnipeConfig,
  wallet: EmbeddedWallet,
  userId: string,
  alreadySniped: Set<string>,
  onBuy: (mint: string, amountSol: number, slippageBps: number) => Promise<void>
): Promise<void> {
  if (alreadySniped.has(token.mint)) return
  if (!shouldAutoSnipe(token, config)) return
  alreadySniped.add(token.mint)
  try {
    await onBuy(token.mint, config.amountSol, config.slippageBps)
  } catch {
    alreadySniped.delete(token.mint)
  }
}

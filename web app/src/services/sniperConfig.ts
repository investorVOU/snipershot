export interface SniperConfig {
  takeProfitPercent: number
  stopLossPercent: number
  defaultAmount: number
  defaultSlippage: number
  autoSnipe: boolean
  maxAutoSnipes: number
}

export const SNIPER_CONFIG_KEY = 'snapshot_sniper_config'

export const DEFAULT_SNIPER_CONFIG: SniperConfig = {
  takeProfitPercent: 100,
  stopLossPercent: 30,
  defaultAmount: 0.1,
  defaultSlippage: 15,
  autoSnipe: false,
  maxAutoSnipes: 3,
}

export function loadSniperConfig(): SniperConfig {
  try {
    const raw = localStorage.getItem(SNIPER_CONFIG_KEY)
    if (raw) {
      return { ...DEFAULT_SNIPER_CONFIG, ...(JSON.parse(raw) as Partial<SniperConfig>) }
    }
  } catch {
    // Ignore invalid local cache.
  }
  return DEFAULT_SNIPER_CONFIG
}

export function saveSniperConfig(config: SniperConfig) {
  localStorage.setItem(SNIPER_CONFIG_KEY, JSON.stringify(config))
}

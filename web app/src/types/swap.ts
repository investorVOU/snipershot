export interface SwapTokenOption {
  mint: string
  symbol: string
  name: string
  decimals: number
  logoURI: string
  verified?: boolean
  source?: 'core' | 'launched' | 'wallet' | 'search'
}

export interface JupiterQuoteRoute {
  inputMint: string
  outputMint: string
  inAmount: string
  outAmount: string
  slippageBps: number
  priceImpactPct: number
  swapMode: string
  routePlan: Array<Record<string, unknown>>
  contextSlot?: number
}

export interface NormalizedSwapResult {
  inputToken: SwapTokenOption
  outputToken: SwapTokenOption
  inputAmount: number
  outputAmount: number
  routeSummary: Record<string, unknown>
  txSignature: string
  timestamp: string
}

export interface SwapHistoryRow {
  id?: string
  user_wallet: string
  input_mint: string
  output_mint: string
  input_symbol: string
  output_symbol: string
  input_amount: number
  output_amount: number
  tx_signature: string
  route_summary: Record<string, unknown>
  created_at: string
}


export interface PumpfunToken {
  mint: string
  name: string
  symbol: string
  imageUri: string
  description: string
  creatorAddress: string
  createdTimestamp: number
  marketCap: number
  usdMarketCap: number
  solInCurve: number
  complete: boolean
  twitterUrl: string
  telegramUrl: string
  websiteUrl: string
  totalSupply: number
}

export interface TokenOverview {
  price: number
  priceChange1h: number
  priceChange24h: number
  marketCap: number
  volume24h: number
  liquidity: number
  holders: number
  fdv: number
}

export interface RugFilterResult {
  score: number
  risk: 'safe' | 'medium' | 'risky' | 'unknown'
  flags: string[]
  mintAuthorityRevoked: boolean
  freezeAuthorityRevoked: boolean
  lpLocked: boolean
  top10HolderPercent: number
}

export interface AITokenRating {
  verdict: 'bullish' | 'neutral' | 'bearish' | 'scam'
  score: number
  reason: string
  tags: string[]
}

export interface OHLCVBar {
  time: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export interface FeedToken extends PumpfunToken {
  rugFilter: RugFilterResult | null
  rugFilterLoading: boolean
  overview: TokenOverview | null
  sparklineData: number[]
  isNewest: boolean
  aiRating: AITokenRating | null
  aiRatingLoading: boolean
  creatorDumped: boolean
  creatorDumpPct: number
  fromCache: boolean
}

export type FilterMode = 'all' | 'safe' | 'medium' | 'risky'

export interface Trade {
  id: string
  mint: string
  tokenName: string
  tokenSymbol: string
  tokenImageUri: string
  side: 'buy' | 'sell'
  amountSol: number
  amountTokens: number
  entryPriceSOL: number
  exitPriceSOL?: number
  pnlSol?: number
  pnlPercent?: number
  timestamp: number
  signature: string
}

export interface Position {
  mint: string
  tokenSymbol: string
  tokenName: string
  tokenImageUri: string
  entryPriceSOL: number
  amountTokens: number
  amountSolIn: number
  timestamp: number
}

export interface PriceAlert {
  id: string
  mint: string
  tokenSymbol: string
  targetPrice: number
  direction: 'above' | 'below'
  triggered: boolean
  createdAt: number
}

export interface UserProfile {
  id: string
  email?: string
  username?: string
  avatarUrl?: string
  walletAddress?: string
  totalPnl?: number
  totalTrades?: number
  winRate?: number
}

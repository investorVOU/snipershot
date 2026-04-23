import type { EmbeddedWallet } from '../services/walletService'

export type LaunchProvider = 'bags' | 'pumpfun'
export type LaunchExecutionStage =
  | 'idle'
  | 'uploading_metadata'
  | 'preparing'
  | 'awaiting_signature'
  | 'submitting'
  | 'confirming'
  | 'saving'
  | 'success'
  | 'error'

export interface LaunchSocialLinks {
  twitterUrl: string
  telegramUrl: string
  websiteUrl: string
  discordUrl: string
}

export interface TokenMetadataRecord extends LaunchSocialLinks {
  name: string
  symbol: string
  description: string
  imageUrl: string
  requestedSupply: number
  requestedDecimals: number
  metadataJson: Record<string, unknown>
  metadataStorageProvider: 'supabase'
  metadataPublicUrl: string
  ipfsCompatibleMetadataUrl: string
  creatorWallet: string
  launchProvider: LaunchProvider
}

export interface LaunchInitialBuyConfig {
  enabled: boolean
  amount: number
  denomination: 'SOL'
}

export interface LaunchProviderConfig {
  slippageBps?: number
  tags?: string[]
  creatorNote?: string
  category?: string
  extra?: Record<string, unknown>
}

export interface LaunchPayload {
  provider: LaunchProvider
  name: string
  symbol: string
  description: string
  totalSupply: number
  decimals: number
  imageFile: File | null
  imagePreviewUrl?: string
  socials: LaunchSocialLinks
  creatorNote?: string
  tags: string[]
  category?: string
  initialBuy: LaunchInitialBuyConfig
  providerConfig?: LaunchProviderConfig
}

export interface LaunchWalletContext {
  userId: string
  wallet: EmbeddedWallet
}

export interface NormalizedLaunchResult {
  provider: LaunchProvider
  mintAddress: string
  signature: string
  explorerUrl: string
  launchedAt: string
  metadataUrl: string
  imageUrl: string
  tokenName: string
  symbol: string
  socials: LaunchSocialLinks
  status: 'confirmed' | 'partial' | 'failed'
  initialBuyEnabled: boolean
  initialBuyAmount: number | null
  initialBuyDenomination: 'SOL' | null
  initialBuySignature: string | null
  initialBuyStatus: 'not_requested' | 'confirmed' | 'failed'
  totalLaunchCost: number | null
  rawProviderResponse: Record<string, unknown>
  metadataRecord: TokenMetadataRecord
}

export interface LaunchAdapterContext {
  walletContext: LaunchWalletContext
  metadata: TokenMetadataRecord
  initialBuy: LaunchInitialBuyConfig
}

export interface LaunchAdapter {
  provider: LaunchProvider
  label: string
  description: string
  note: string
  requiresIpfsCompatibleMetadataUrl?: boolean
  supportsInitialBuy: boolean
  launchToken: (payload: LaunchPayload, context: LaunchAdapterContext) => Promise<NormalizedLaunchResult>
}

export interface LaunchExecutionState {
  stage: LaunchExecutionStage
  message: string
  error: string | null
  result: NormalizedLaunchResult | null
}

export interface LaunchedTokenRow {
  id?: string
  creator_wallet: string
  provider: LaunchProvider
  token_name: string
  token_symbol: string
  mint_address: string
  description: string
  image_url: string
  metadata_json: Record<string, unknown>
  metadata_storage_provider: string
  metadata_public_url: string
  twitter_url: string
  telegram_url: string
  website_url: string
  discord_url: string
  tx_signature: string
  initial_buy_enabled: boolean
  initial_buy_amount: number | null
  initial_buy_denomination: string | null
  initial_buy_tx_signature: string | null
  total_launch_cost: number | null
  requested_supply: number
  requested_decimals: number
  created_at: string
  raw_provider_response: Record<string, unknown>
}

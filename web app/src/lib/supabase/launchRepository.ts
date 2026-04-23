import { supabase } from '../../services/supabase'
import type { LaunchedTokenRow, LaunchProvider, NormalizedLaunchResult, TokenMetadataRecord } from '../../types'

export async function persistLaunchedToken(args: {
  result: NormalizedLaunchResult
  metadata: TokenMetadataRecord
}): Promise<void> {
  const { result, metadata } = args
  const row = {
    creator_wallet: metadata.creatorWallet,
    provider: result.provider,
    token_name: result.tokenName,
    token_symbol: result.symbol,
    mint_address: result.mintAddress,
    description: metadata.description,
    image_url: result.imageUrl,
    metadata_json: metadata.metadataJson,
    metadata_storage_provider: metadata.metadataStorageProvider,
    metadata_public_url: metadata.metadataPublicUrl,
    twitter_url: metadata.twitterUrl,
    telegram_url: metadata.telegramUrl,
    website_url: metadata.websiteUrl,
    discord_url: metadata.discordUrl,
    tx_signature: result.signature,
    initial_buy_enabled: result.initialBuyEnabled,
    initial_buy_amount: result.initialBuyAmount,
    initial_buy_denomination: result.initialBuyDenomination,
    initial_buy_tx_signature: result.initialBuySignature,
    total_launch_cost: result.totalLaunchCost,
    requested_supply: metadata.requestedSupply,
    requested_decimals: metadata.requestedDecimals,
    created_at: result.launchedAt,
    raw_provider_response: result.rawProviderResponse,
  } satisfies Record<string, unknown>
  const insert = await supabase.from('launched_tokens').insert(row as never)
  if (insert.error) throw insert.error
}

export async function persistLaunchEvent(args: {
  mintAddress: string
  provider: LaunchProvider
  eventType: string
  txSignature?: string | null
  payload?: Record<string, unknown>
}): Promise<void> {
  const insert = await supabase.from('token_launch_events').insert({
    mint_address: args.mintAddress,
    provider: args.provider,
    event_type: args.eventType,
    tx_signature: args.txSignature ?? null,
    payload: args.payload ?? {},
    created_at: new Date().toISOString(),
  })
  if (insert.error) throw insert.error
}

export async function fetchLaunchedTokenByMint(mint: string): Promise<Record<string, unknown> | null> {
  const query = await supabase
    .from('launched_tokens')
    .select('*')
    .eq('mint_address', mint)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (query.error) return null
  return (query.data as Record<string, unknown> | null) ?? null
}

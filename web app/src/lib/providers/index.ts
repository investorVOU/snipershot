import type { LaunchAdapter, LaunchPayload, LaunchProvider, LaunchWalletContext, NormalizedLaunchResult } from '../../types'
import { bagsLaunchAdapter } from './bags/adapter'
import { pumpLaunchAdapter } from './pump/adapter'
import { saveTokenMetadataJson, uploadLaunchImage } from '../supabase/storage'

const adapters: Record<LaunchProvider, LaunchAdapter> = {
  bags: bagsLaunchAdapter,
  pumpfun: pumpLaunchAdapter,
}

export function getLaunchProviderAdapters(): LaunchAdapter[] {
  return Object.values(adapters)
}

export async function launchToken(provider: LaunchProvider, payload: LaunchPayload, walletContext: LaunchWalletContext): Promise<NormalizedLaunchResult> {
  const adapter = adapters[provider]
  if (!adapter) throw new Error('Unsupported launch provider.')
  if (!payload.imageFile) throw new Error('Token image is required.')

  const image = await uploadLaunchImage(payload.imageFile, payload.symbol)
  const metadataBase = await saveTokenMetadataJson({
    provider,
    name: payload.name,
    symbol: payload.symbol,
    description: payload.description,
    requestedSupply: payload.totalSupply,
    requestedDecimals: payload.decimals,
    imageUrl: image.publicUrl,
    socials: payload.socials,
    creatorWallet: walletContext.wallet.publicKey,
  })
  const metadata = { ...metadataBase, launchProvider: provider }

  return adapter.launchToken(payload, {
    walletContext,
    metadata,
    initialBuy: payload.initialBuy,
  })
}

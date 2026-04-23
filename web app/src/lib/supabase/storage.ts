import { supabase } from '../../services/supabase'
import type { LaunchProvider, TokenMetadataRecord } from '../../types'

const IMAGE_BUCKET = 'token-images'
const METADATA_BUCKET = 'token-metadata'

function safeFileName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

async function uploadFile(bucket: string, path: string, file: Blob, contentType: string) {
  const result = await supabase.storage.from(bucket).upload(path, file, {
    cacheControl: '3600',
    upsert: true,
    contentType,
  })
  if (result.error) throw result.error
  const { data } = supabase.storage.from(bucket).getPublicUrl(path)
  return { path, publicUrl: data.publicUrl }
}

export async function uploadLaunchImage(file: File, symbol: string): Promise<{ path: string; publicUrl: string }> {
  const ext = file.name.split('.').pop() || 'png'
  const fileName = `${safeFileName(symbol)}-${Date.now()}.${ext}`
  return uploadFile(IMAGE_BUCKET, fileName, file, file.type || 'image/png')
}

export async function saveTokenMetadataJson(input: {
  provider: LaunchProvider
  name: string
  symbol: string
  description: string
  requestedSupply: number
  requestedDecimals: number
  imageUrl: string
  socials: {
    twitterUrl: string
    telegramUrl: string
    websiteUrl: string
    discordUrl: string
  }
  creatorWallet: string
}): Promise<Omit<TokenMetadataRecord, 'launchProvider'>> {
  const metadataJson = {
    name: input.name,
    symbol: input.symbol,
    description: input.description,
    image: input.imageUrl,
    decimals: input.requestedDecimals,
    external_url: input.socials.websiteUrl || undefined,
    extensions: {
      twitter: input.socials.twitterUrl || undefined,
      telegram: input.socials.telegramUrl || undefined,
      discord: input.socials.discordUrl || undefined,
      axyrion: {
        requestedSupply: input.requestedSupply,
        requestedDecimals: input.requestedDecimals,
      },
    },
    properties: {
      category: 'image',
      creators: [{ address: input.creatorWallet, share: 100 }],
      files: [{ type: 'image/png', uri: input.imageUrl }],
    },
  }

  const fileName = `${safeFileName(input.symbol)}-${Date.now()}.json`
  const blob = new Blob([JSON.stringify(metadataJson, null, 2)], { type: 'application/json' })
  const uploaded = await uploadFile(METADATA_BUCKET, fileName, blob, 'application/json')

  return {
    name: input.name,
    symbol: input.symbol,
    description: input.description,
    imageUrl: input.imageUrl,
    requestedSupply: input.requestedSupply,
    requestedDecimals: input.requestedDecimals,
    metadataJson,
    metadataStorageProvider: 'supabase',
    metadataPublicUrl: uploaded.publicUrl,
    // TODO: Replace this compatibility URI with a real IPFS pinning flow for Pump.fun.
    ipfsCompatibleMetadataUrl: `ipfs://axyrion/${uploaded.path}`,
    twitterUrl: input.socials.twitterUrl,
    telegramUrl: input.socials.telegramUrl,
    websiteUrl: input.socials.websiteUrl,
    discordUrl: input.socials.discordUrl,
    creatorWallet: input.creatorWallet,
  }
}

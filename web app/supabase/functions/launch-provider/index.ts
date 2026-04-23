import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const PINATA_JWT = Deno.env.get('PINATA_JWT') ?? ''
const BAGS_API_KEY = Deno.env.get('BAGS_API_KEY') ?? ''

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  })
}

async function uploadUrlToPinata(url: string, fileName: string): Promise<{ cid: string; gatewayUrl: string }> {
  if (!PINATA_JWT) throw new Error('PINATA_JWT is not configured.')
  const source = await fetch(url)
  if (!source.ok) throw new Error(`Failed to fetch source asset for Pinata: ${source.status}`)
  const blob = await source.blob()
  const formData = new FormData()
  formData.append('network', 'public')
  formData.append('file', new File([blob], fileName, { type: blob.type || 'application/octet-stream' }))
  const upload = await fetch('https://uploads.pinata.cloud/v3/files', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${PINATA_JWT}`,
    },
    body: formData,
  })
  if (!upload.ok) throw new Error(`Pinata upload failed: ${upload.status}`)
  const body = await upload.json() as { data?: { cid?: string } }
  const cid = body.data?.cid
  if (!cid) throw new Error('Pinata upload did not return a CID.')
  return { cid, gatewayUrl: `https://ipfs.io/ipfs/${cid}` }
}

async function uploadJsonToPinata(document: Record<string, unknown>, fileName: string): Promise<{ cid: string; gatewayUrl: string; ipfsUri: string }> {
  if (!PINATA_JWT) throw new Error('PINATA_JWT is not configured.')
  const formData = new FormData()
  formData.append('network', 'public')
  formData.append('file', new File([JSON.stringify(document, null, 2)], fileName, { type: 'application/json' }))
  const upload = await fetch('https://uploads.pinata.cloud/v3/files', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${PINATA_JWT}`,
    },
    body: formData,
  })
  if (!upload.ok) throw new Error(`Pinata metadata upload failed: ${upload.status}`)
  const body = await upload.json() as { data?: { cid?: string } }
  const cid = body.data?.cid
  if (!cid) throw new Error('Pinata metadata upload did not return a CID.')
  return {
    cid,
    gatewayUrl: `https://ipfs.io/ipfs/${cid}`,
    ipfsUri: `ipfs://${cid}`,
  }
}

async function callBagsApi(path: string, init: RequestInit): Promise<unknown> {
  if (!BAGS_API_KEY) throw new Error('BAGS_API_KEY is not configured.')
  const res = await fetch(`https://public-api-v2.bags.fm/api/v1${path}`, {
    ...init,
    headers: {
      'x-api-key': BAGS_API_KEY,
      ...(init.headers ?? {}),
    },
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(typeof body?.error === 'string' ? body.error : `Bags API error ${res.status}`)
  return body
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { action, payload } = await req.json() as { action: string; payload: Record<string, unknown> }

    if (action === 'pump-create-transaction') {
      const imageUrl = String(payload.imageUrl ?? '')
      const metadataJson = (payload.metadataJson ?? {}) as Record<string, unknown>
      const imagePinned = await uploadUrlToPinata(imageUrl, `${String(payload.tokenMetadata?.['symbol'] ?? 'token').toLowerCase()}-image`)
      const metadataPinned = await uploadJsonToPinata({
        ...metadataJson,
        image: imagePinned.gatewayUrl,
      }, `${String(payload.tokenMetadata?.['symbol'] ?? 'token').toLowerCase()}-metadata.json`)

      const upstream = await fetch('https://pumpportal.fun/api/trade-local', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          publicKey: payload.creatorPublicKey,
          action: 'create',
          tokenMetadata: {
            name: payload.tokenMetadata?.['name'],
            symbol: payload.tokenMetadata?.['symbol'],
            uri: metadataPinned.gatewayUrl,
          },
          mint: payload.mintPublicKey,
          denominatedInSol: 'true',
          amount: payload.amountSol ?? 0,
          slippage: payload.slippage ?? 10,
          priorityFee: payload.priorityFee ?? 0.00005,
          pool: 'pump',
        }),
      })
      if (!upstream.ok) {
        const errorBody = await upstream.text()
        throw new Error(`PumpPortal create failed: ${upstream.status} ${errorBody}`)
      }
      const serialized = await upstream.arrayBuffer()
      const binary = new Uint8Array(serialized)
      let encoded = ''
      binary.forEach((byte) => { encoded += String.fromCharCode(byte) })
      return json({
        transactionBase64: btoa(encoded),
        metadataUri: metadataPinned.gatewayUrl,
        metadataIpfsUri: metadataPinned.ipfsUri,
        metadataPublicGatewayUrl: metadataPinned.gatewayUrl,
        imageIpfsUrl: imagePinned.gatewayUrl,
        providerResponse: { provider: 'pumpportal' },
      })
    }

    if (action === 'bags-create-token-info') {
      const formData = new FormData()
      formData.append('name', String(payload.name ?? ''))
      formData.append('symbol', String(payload.symbol ?? ''))
      formData.append('description', String(payload.description ?? ''))
      formData.append('imageUrl', String(payload.imageUrl ?? ''))
      formData.append('metadataUrl', String(payload.metadataUrl ?? ''))
      formData.append('telegram', String(payload.telegram ?? ''))
      formData.append('twitter', String(payload.twitter ?? ''))
      formData.append('website', String(payload.website ?? ''))
      const body = await callBagsApi('/token-launch/create-token-info', {
        method: 'POST',
        body: formData,
      }) as { response?: { tokenMint?: string; tokenMetadata?: string } }
      return json({
        tokenMint: body.response?.tokenMint,
        tokenMetadata: body.response?.tokenMetadata,
        providerResponse: body,
      })
    }

    if (action === 'bags-create-fee-config') {
      const body = await callBagsApi('/fee-share/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payer: payload.payer,
          baseMint: payload.baseMint,
          claimersArray: payload.claimersArray,
          basisPointsArray: payload.basisPointsArray,
        }),
      }) as { response?: { meteoraConfigKey?: string; transactions?: Array<{ transaction?: string }>; bundles?: Array<Array<{ transaction?: string }>> } }
      return json({
        meteoraConfigKey: body.response?.meteoraConfigKey,
        transactions: (body.response?.transactions ?? []).map((item) => ({ transactionBase64: item.transaction ?? '' })),
        bundles: (body.response?.bundles ?? []).map((bundle) => bundle.map((item) => ({ transactionBase64: item.transaction ?? '' }))),
        providerResponse: body,
      })
    }

    if (action === 'bags-create-launch-transaction') {
      const body = await callBagsApi('/token-launch/create-launch-transaction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ipfs: payload.ipfs,
          tokenMint: payload.tokenMint,
          wallet: payload.wallet,
          initialBuyLamports: payload.initialBuyLamports,
          configKey: payload.configKey,
        }),
      }) as { response?: string }
      return json({
        transactionBase64: body.response ?? '',
        providerResponse: body,
      })
    }

    return json({ error: 'Unsupported action' }, 400)
  } catch (err) {
    return json({ error: String(err) }, 500)
  }
})

// Supabase Edge Function — Birdeye proxy
// Forwards requests to public-api.birdeye.so server-side (bypasses browser CORS).
// Deploy: supabase functions deploy birdeye-proxy
// Secrets: supabase secrets set BIRDEYE_KEY=<your_key>

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const BIRDEYE_BASE = 'https://public-api.birdeye.so'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { path, params, apiKey } = await req.json() as {
      path: string
      params: Record<string, string>
      apiKey?: string
    }

    if (!path) {
      return new Response(JSON.stringify({ error: 'missing path' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Use env secret first, fall back to client-supplied key (VITE_BIRDEYE_KEY is already public)
    const key = Deno.env.get('BIRDEYE_KEY') ?? apiKey ?? ''
    if (!key) {
      return new Response(JSON.stringify({ error: 'no api key' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const url = new URL(`${BIRDEYE_BASE}${path}`)
    Object.entries(params ?? {}).forEach(([k, v]) => url.searchParams.set(k, v))

    const upstream = await fetch(url.toString(), {
      headers: {
        'X-API-KEY': key,
        'x-chain': 'solana',
        'Accept': 'application/json',
      },
    })

    const body = await upstream.text()

    return new Response(body, {
      status: upstream.status,
      headers: {
        ...corsHeaders,
        'Content-Type': upstream.headers.get('content-type') ?? 'application/json',
      },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

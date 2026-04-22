// Supabase Edge Function — DexScreener proxy
// Bypasses browser CORS for api.dexscreener.com
// Deploy: supabase functions deploy dexscreener-proxy

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const DEXSCREENER_BASE = 'https://api.dexscreener.com'

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
    const { path } = await req.json() as { path: string }

    if (!path) {
      return new Response(JSON.stringify({ error: 'missing path' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const upstream = await fetch(`${DEXSCREENER_BASE}${path}`, {
      headers: { 'Accept': 'application/json' },
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

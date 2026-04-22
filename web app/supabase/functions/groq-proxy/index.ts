// Supabase Edge Function — Groq proxy
// Keeps the Groq API key server-side so it's never exposed in the browser.
// Deploy: supabase functions deploy groq-proxy
// Secrets: supabase secrets set GROQ_API_KEY=<your_key>

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const key = Deno.env.get('GROQ_API_KEY')
  if (!key) {
    return new Response(JSON.stringify({ error: 'GROQ_API_KEY not configured' }), {
      status: 503,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    const body = await req.text()
    const upstream = await fetch(GROQ_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`,
      },
      body,
    })

    const text = await upstream.text()
    return new Response(text, {
      status: upstream.status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

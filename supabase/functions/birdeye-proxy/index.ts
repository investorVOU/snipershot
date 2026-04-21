import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
};

const BIRDEYE_BASE = 'https://public-api.birdeye.so';

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const apiKey = Deno.env.get('BIRDEYE_API_KEY');
    if (!apiKey) return new Response('BIRDEYE_API_KEY not set', { status: 500 });

    // Expect body: { path: '/defi/token_overview', params: { address: '...' } }
    const { path, params } = await req.json() as { path: string; params?: Record<string, string> };
    const url = new URL(`${BIRDEYE_BASE}${path}`);
    if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

    const res = await fetch(url.toString(), {
      headers: {
        'X-API-KEY': apiKey,
        'x-chain': 'solana',
      },
    });

    const data = await res.json();
    return new Response(JSON.stringify(data), {
      status: res.status,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }
});

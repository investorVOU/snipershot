import type { AITokenRating } from '../types'

const GROQ_PROXY_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/groq-proxy`
const GROQ_DIRECT_URL = 'https://api.groq.com/openai/v1/chat/completions'
const GROQ_MODELS = ['llama-3.1-8b-instant', 'llama-3.3-70b-versatile']

async function fetchWithTimeout(url: string, options: RequestInit, ms: number): Promise<Response> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), ms)
  return fetch(url, { ...options, signal: ctrl.signal }).finally(() => clearTimeout(timer))
}

async function groqChat(messages: Array<{ role: string; content: string }>, maxTokens = 512): Promise<string> {
  const body = (model: string) => JSON.stringify({ model, messages, max_tokens: maxTokens, temperature: 0.3 })

  for (const model of GROQ_MODELS) {
    try {
      const res = await fetchWithTimeout(
        GROQ_PROXY_URL,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY ?? ''}` },
          body: body(model),
        },
        5000
      )
      if (res.ok) {
        const json = await res.json() as { choices: Array<{ message: { content: string } }> }
        return json.choices[0]?.message?.content ?? ''
      }
    } catch { /* try direct */ }

    const apiKey = import.meta.env.VITE_GROQ_API_KEY ?? ''
    if (!apiKey) continue

    try {
      const res = await fetchWithTimeout(
        GROQ_DIRECT_URL,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
          body: body(model),
        },
        15000
      )
      if (res.ok) {
        const json = await res.json() as { choices: Array<{ message: { content: string } }> }
        return json.choices[0]?.message?.content ?? ''
      }
    } catch { /* continue */ }
  }

  throw new Error('Groq: all models unavailable')
}

export async function getAITokenRating(
  name: string,
  symbol: string,
  description: string,
  rugScore: number,
  flags: string[]
): Promise<AITokenRating> {
  const prompt = `Analyze this Solana memecoin and provide a JSON verdict.
Token: ${name} ($${symbol})
Description: ${description || 'None provided'}
Rug score: ${rugScore}/100
Risk flags: ${flags.length ? flags.join(', ') : 'None'}

Respond ONLY with valid JSON in this exact format:
{"verdict":"bullish"|"neutral"|"bearish"|"scam","score":0-100,"reason":"1-2 sentence reason","tags":["tag1","tag2"]}`

  try {
    const raw = await groqChat([
      { role: 'system', content: 'You are a crypto security analyst. Respond only with the requested JSON.' },
      { role: 'user', content: prompt },
    ], 256)

    const match = raw.match(/\{[\s\S]*\}/)
    if (!match) throw new Error('No JSON in response')
    const parsed = JSON.parse(match[0]) as AITokenRating
    return parsed
  } catch {
    throw new Error(`AI rating unavailable for ${name} (${symbol})`)
  }
}

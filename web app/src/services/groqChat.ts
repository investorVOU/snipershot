const GROQ_PROXY_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/groq-proxy`
const GROQ_DIRECT_URL = 'https://api.groq.com/openai/v1/chat/completions'
const MODEL = 'llama-3.1-8b-instant'

export async function groqChat(messages: Array<{ role: string; content: string }>, maxTokens = 256): Promise<string> {
  const body = JSON.stringify({ model: MODEL, messages, max_tokens: maxTokens, temperature: 0.3 })

  try {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 5000)
    const res = await fetch(GROQ_PROXY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}` },
      body,
      signal: ctrl.signal,
    }).finally(() => clearTimeout(timer))
    if (res.ok) {
      const json = await res.json() as { choices: Array<{ message: { content: string } }> }
      return json.choices[0]?.message?.content ?? ''
    }
  } catch { /* fall through */ }

  const apiKey = import.meta.env.VITE_GROQ_API_KEY
  if (!apiKey) throw new Error('No Groq key')

  const res = await fetch(GROQ_DIRECT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body,
  })
  if (!res.ok) throw new Error(`Groq ${res.status}`)
  const json = await res.json() as { choices: Array<{ message: { content: string } }> }
  return json.choices[0]?.message?.content ?? ''
}

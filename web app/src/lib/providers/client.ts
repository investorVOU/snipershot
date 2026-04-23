const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? ''
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY ?? ''

interface LaunchProxyRequest {
  action: string
  payload: Record<string, unknown>
}

export async function callLaunchProviderProxy<T>(request: LaunchProxyRequest): Promise<T> {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/launch-provider`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${SUPABASE_ANON}`,
    },
    body: JSON.stringify(request),
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(typeof data?.error === 'string' ? data.error : `Launch provider request failed: ${res.status}`)
  }
  return data as T
}


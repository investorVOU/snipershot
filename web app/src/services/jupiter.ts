const JUPITER_PRICE_V3 = 'https://lite-api.jup.ag/price/v3'

interface JupiterPriceEntry {
  usdPrice?: number
  price?: number
}

type JupiterPriceResp = Record<string, JupiterPriceEntry>

export async function fetchJupiterPrice(mint: string): Promise<number | null> {
  try {
    const url = new URL(JUPITER_PRICE_V3)
    url.searchParams.set('ids', mint)

    const res = await fetch(url.toString())
    if (!res.ok) return null

    const data = (await res.json()) as JupiterPriceResp
    const entry = data[mint]
    if (!entry) return null
    if (typeof entry.usdPrice === 'number') return entry.usdPrice
    if (typeof entry.price === 'number') return entry.price
    return null
  } catch {
    return null
  }
}

import { useEffect, useState } from 'react'
import { fetchJupiterQuote } from '../lib/jupiter/client'
import { SOL_MINT } from '../lib/tokens/catalog'

interface TradabilityState {
  loading: boolean
  status: 'available' | 'pending' | 'unavailable'
  reason: string
}

export function useTokenTradability(mint: string | null): TradabilityState {
  const [state, setState] = useState<TradabilityState>({
    loading: false,
    status: 'pending',
    reason: 'Checking Jupiter route availability...',
  })

  useEffect(() => {
    if (!mint) return
    let cancelled = false
    setState({ loading: true, status: 'pending', reason: 'Checking Jupiter route availability...' })

    fetchJupiterQuote(SOL_MINT, mint, 10000000, 100)
      .then((quote) => {
        if (cancelled) return
        if (quote) {
          setState({ loading: false, status: 'available', reason: 'Route available through Jupiter.' })
        } else {
          setState({ loading: false, status: 'unavailable', reason: 'No route available yet.' })
        }
      })
      .catch(() => {
        if (cancelled) return
        setState({ loading: false, status: 'unavailable', reason: 'Route check failed. Try again shortly.' })
      })

    return () => {
      cancelled = true
    }
  }, [mint])

  return state
}


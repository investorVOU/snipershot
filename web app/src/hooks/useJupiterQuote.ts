import { useEffect, useState } from 'react'
import { fetchJupiterQuote, toRawAmount, toUiAmount } from '../lib/jupiter/client'
import type { JupiterQuoteRoute, SwapTokenOption } from '../types'

interface QuoteState {
  quote: JupiterQuoteRoute | null
  loading: boolean
  error: string | null
  quotedOutputAmount: number
}

export function useJupiterQuote(inputToken: SwapTokenOption | null, outputToken: SwapTokenOption | null, amount: number, slippageBps: number): QuoteState {
  const [state, setState] = useState<QuoteState>({
    quote: null,
    loading: false,
    error: null,
    quotedOutputAmount: 0,
  })

  useEffect(() => {
    if (!inputToken || !outputToken || amount <= 0) {
      setState({ quote: null, loading: false, error: null, quotedOutputAmount: 0 })
      return
    }

    let cancelled = false
    setState((prev) => ({ ...prev, loading: true, error: null }))

    const timer = setTimeout(() => {
      const rawAmount = toRawAmount(amount, inputToken.decimals)
      fetchJupiterQuote(inputToken.mint, outputToken.mint, rawAmount, slippageBps)
        .then((quote) => {
          if (cancelled) return
          if (!quote) {
            setState({ quote: null, loading: false, error: 'No route available yet', quotedOutputAmount: 0 })
            return
          }
          setState({
            quote,
            loading: false,
            error: null,
            quotedOutputAmount: toUiAmount(quote.outAmount, outputToken.decimals),
          })
        })
        .catch(() => {
          if (cancelled) return
          setState({ quote: null, loading: false, error: 'Unable to fetch quote right now', quotedOutputAmount: 0 })
        })
    }, 250)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [amount, inputToken, outputToken, slippageBps])

  return state
}


import { useState } from 'react'
import { executeJupiterSwap } from '../lib/jupiter/client'
import { persistSwapHistory } from '../lib/supabase/swapRepository'
import type { NormalizedSwapResult, SwapTokenOption } from '../types'
import type { EmbeddedWallet } from '../services/walletService'

interface UseSwapArgs {
  wallet: EmbeddedWallet | null
}

export function useSwap({ wallet }: UseSwapArgs) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<NormalizedSwapResult | null>(null)

  const swap = async (args: {
    userWallet: string
    inputToken: SwapTokenOption
    outputToken: SwapTokenOption
    inputAmount: number
    slippageBps: number
  }): Promise<NormalizedSwapResult> => {
    if (!wallet) throw new Error('Connect your wallet to swap.')
    setLoading(true)
    setError(null)
    try {
      const executed = await executeJupiterSwap(args.inputToken, args.outputToken, args.inputAmount, args.slippageBps, wallet)
      const normalized: NormalizedSwapResult = {
        inputToken: args.inputToken,
        outputToken: args.outputToken,
        inputAmount: args.inputAmount,
        outputAmount: executed.outputAmount,
        routeSummary: {
          inAmount: executed.quote.inAmount,
          outAmount: executed.quote.outAmount,
          priceImpactPct: executed.quote.priceImpactPct,
          routePlan: executed.quote.routePlan,
          slippageBps: executed.quote.slippageBps,
        },
        txSignature: executed.signature,
        timestamp: new Date().toISOString(),
      }
      await persistSwapHistory(args.userWallet, normalized)
      setResult(normalized)
      return normalized
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Swap failed.'
      setError(message)
      throw err
    } finally {
      setLoading(false)
    }
  }

  return { swap, loading, error, result, clearResult: () => setResult(null) }
}


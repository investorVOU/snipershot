import { useEffect, useMemo, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { useTokenFeed } from '../hooks/useTokenFeed'
import { fetchPrice, fetchSOLPrice } from '../services/birdeye'
import { buyTokenForUser, sellTokenForUser } from '../services/solana'
import { loadSniperConfig } from '../services/sniperConfig'
import { supabase } from '../services/supabase'
import { appendActivityLog } from '../services/activityLog'

interface PositionRow {
  mint: string
  token_name: string | null
  token_symbol: string | null
  token_image_uri?: string | null
  image_uri?: string | null
  entry_price_sol: number | null
  amount_tokens: number | null
  closed?: boolean | null
}

export function AutoTrader() {
  const { user, wallet, isGuest } = useAuth()
  const { allTokens } = useTokenFeed('safe')
  const autoSnipedRef = useRef<Set<string>>(new Set())
  const autoSoldRef = useRef<Set<string>>(new Set())

  const newestSafeTokens = useMemo(
    () => allTokens.filter((token) => token.isNewest && token.rugFilter?.risk === 'safe'),
    [allTokens]
  )

  useEffect(() => {
    if (!user || !wallet || isGuest) return
    const config = loadSniperConfig()
    if (!config.autoSnipe) return

    const candidates = newestSafeTokens
      .filter((token) => !autoSnipedRef.current.has(token.mint))
      .slice(0, Math.max(0, config.maxAutoSnipes - autoSnipedRef.current.size))

    if (candidates.length === 0) return

    candidates.forEach((token) => {
      autoSnipedRef.current.add(token.mint)
      void buyTokenForUser({
        wallet,
        userId: user.id,
        mint: token.mint,
        tokenName: token.name,
        tokenSymbol: token.symbol,
        tokenImageUri: token.imageUri,
        amountSol: config.defaultAmount,
        slippageBps: config.defaultSlippage * 100,
      }).then(() => {
        appendActivityLog({
          type: 'auto-buy',
          title: `Auto bought ${token.symbol}`,
          detail: `${config.defaultAmount} SOL on ${token.name}`,
        })
      }).catch(() => {
        autoSnipedRef.current.delete(token.mint)
        appendActivityLog({
          type: 'error',
          title: `Auto buy failed`,
          detail: `${token.symbol} could not be bought`,
        })
      })
    })
  }, [newestSafeTokens, user, wallet, isGuest])

  useEffect(() => {
    if (!user || !wallet || isGuest) return

    const interval = setInterval(() => {
      void (async () => {
        const config = loadSniperConfig()
        const { data } = await supabase
          .from('positions')
          .select('*')
          .eq('user_pubkey', user.id)

        const openPositions = ((data as PositionRow[] | null) ?? []).filter((row) => row.closed !== true && !!row.mint)
        if (openPositions.length === 0) return

        const solUsdPrice = await fetchSOLPrice().catch(() => 0)
        if (solUsdPrice <= 0) return

        await Promise.all(openPositions.map(async (position) => {
          if (autoSoldRef.current.has(position.mint)) return
          const currentPriceUsd = await fetchPrice(position.mint).catch(() => 0)
          if (!currentPriceUsd || !position.entry_price_sol || !position.amount_tokens) return

          const currentPriceSol = currentPriceUsd / solUsdPrice
          const pnlPct = ((currentPriceSol - position.entry_price_sol) / position.entry_price_sol) * 100
          const shouldTakeProfit = pnlPct >= config.takeProfitPercent
          const shouldStopLoss = pnlPct <= -Math.abs(config.stopLossPercent)

          if (!shouldTakeProfit && !shouldStopLoss) return

          autoSoldRef.current.add(position.mint)
          try {
            await sellTokenForUser({
              wallet,
              userId: user.id,
              mint: position.mint,
              tokenName: position.token_name ?? 'Unknown',
              tokenSymbol: position.token_symbol ?? '???',
              tokenImageUri: position.token_image_uri ?? position.image_uri ?? '',
              amountTokens: position.amount_tokens,
            })
            appendActivityLog({
              type: 'auto-sell',
              title: `Auto sold ${position.token_symbol ?? 'token'}`,
              detail: shouldTakeProfit ? `Take profit at ${pnlPct.toFixed(1)}%` : `Stop loss at ${pnlPct.toFixed(1)}%`,
            })
          } catch {
            autoSoldRef.current.delete(position.mint)
            appendActivityLog({
              type: 'error',
              title: 'Auto sell failed',
              detail: `${position.token_symbol ?? position.mint} could not be sold`,
            })
          }
        }))
      })()
    }, 15_000)

    return () => clearInterval(interval)
  }, [user, wallet, isGuest])

  return null
}

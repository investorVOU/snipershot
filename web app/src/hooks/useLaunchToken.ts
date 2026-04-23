import { useCallback, useState } from 'react'
import { launchToken } from '../lib/providers'
import { persistLaunchEvent, persistLaunchedToken } from '../lib/supabase/launchRepository'
import { requireEmbeddedWallet } from '../lib/solana/embeddedWallet'
import { estimateLaunchSpend } from '../lib/utils/launch'
import type { FeedToken, LaunchExecutionState, LaunchPayload, LaunchWalletContext, NormalizedLaunchResult } from '../types'

function toFeedToken(result: NormalizedLaunchResult, walletAddress: string): FeedToken {
  return {
    mint: result.mintAddress,
    name: result.tokenName,
    symbol: result.symbol,
    imageUri: result.imageUrl,
    description: result.metadataRecord.description,
    creatorAddress: walletAddress,
    createdTimestamp: new Date(result.launchedAt).getTime(),
    marketCap: 0,
    usdMarketCap: 0,
    solInCurve: result.initialBuyAmount ?? 0,
    complete: false,
    twitterUrl: result.socials.twitterUrl,
    telegramUrl: result.socials.telegramUrl,
    websiteUrl: result.socials.websiteUrl,
    totalSupply: 1_000_000_000,
    launchSource: result.provider,
    rugFilter: null,
    rugFilterLoading: false,
    overview: null,
    sparklineData: [],
    isNewest: true,
    aiRating: null,
    aiRatingLoading: false,
    creatorDumped: false,
    creatorDumpPct: 0,
    fromCache: false,
    createdByWallet: true,
    metadataUrl: result.metadataUrl,
    explorerUrl: result.explorerUrl,
    launchStatus: result.status,
  }
}

const initialState: LaunchExecutionState = {
  stage: 'idle',
  message: '',
  error: null,
  result: null,
}

export function useLaunchToken() {
  const [state, setState] = useState<LaunchExecutionState>(initialState)

  const execute = useCallback(async (payload: LaunchPayload, context: LaunchWalletContext): Promise<{ result: NormalizedLaunchResult; feedToken: FeedToken }> => {
    const wallet = requireEmbeddedWallet(context.wallet)
    setState({ stage: 'uploading_metadata', message: 'Preparing launch...', error: null, result: null })

    try {
      const result = await launchToken(payload.provider, payload, { ...context, wallet })
      setState({ stage: 'confirming', message: 'Confirming on-chain...', error: null, result: null })

      await persistLaunchEvent({
        mintAddress: result.mintAddress,
        provider: result.provider,
        eventType: 'launch_submitted',
        txSignature: result.signature,
        payload: { initialBuyEnabled: result.initialBuyEnabled },
      })
      await persistLaunchEvent({
        mintAddress: result.mintAddress,
        provider: result.provider,
        eventType: 'metadata_uploaded',
        payload: { metadataUrl: result.metadataUrl },
      })
      if (result.initialBuyEnabled) {
        await persistLaunchEvent({
          mintAddress: result.mintAddress,
          provider: result.provider,
          eventType: result.initialBuySignature ? 'initial_buy_confirmed' : 'initial_buy_submitted',
          txSignature: result.initialBuySignature,
          payload: {
            amount: result.initialBuyAmount,
            denomination: result.initialBuyDenomination,
          },
        })
      }

      setState({ stage: 'saving', message: 'Saving launch record...', error: null, result: null })
      await persistLaunchedToken({ result, metadata: result.metadataRecord })
      await persistLaunchEvent({
        mintAddress: result.mintAddress,
        provider: result.provider,
        eventType: 'metadata_saved',
        payload: { estimatedSpend: estimateLaunchSpend(result.initialBuyEnabled, result.initialBuyAmount ?? 0) },
      })
      await persistLaunchEvent({
        mintAddress: result.mintAddress,
        provider: result.provider,
        eventType: 'launch_confirmed',
        txSignature: result.signature,
      })

      const feedToken = toFeedToken(result, wallet.publicKey)
      setState({ stage: 'success', message: 'Launch confirmed.', error: null, result })
      return { result, feedToken }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Launch failed.'
      setState({ stage: 'error', message, error: message, result: null })
      throw err
    }
  }, [])

  const reset = useCallback(() => {
    setState(initialState)
  }, [])

  return {
    ...state,
    launch: execute,
    reset,
  }
}

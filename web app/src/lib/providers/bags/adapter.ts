import type { LaunchAdapter } from '../../providers/types'
import { deserializeVersionedTransaction, sendAndConfirmVersionedTransaction, signWithWalletAndExtraSigners } from '../../solana/transactions'
import { callLaunchProviderProxy } from '../client'

function explorer(signature: string): string {
  return `https://solscan.io/tx/${signature}`
}

export const bagsLaunchAdapter: LaunchAdapter = {
  provider: 'bags',
  label: 'Bags',
  description: 'Creator-focused token launch flow with Axyrion-managed metadata.',
  note: 'Launch with creator-focused flow',
  supportsInitialBuy: true,
  async launchToken(payload, context) {
    const creatorWallet = context.walletContext.wallet.publicKey
    const tokenInfo = await callLaunchProviderProxy<{
      tokenMint: string
      tokenMetadata: string
      providerResponse: Record<string, unknown>
    }>({
      action: 'bags-create-token-info',
      payload: {
        name: payload.name,
        symbol: payload.symbol,
        description: payload.description,
        imageUrl: context.metadata.imageUrl,
        metadataUrl: context.metadata.metadataPublicUrl,
        telegram: payload.socials.telegramUrl,
        twitter: payload.socials.twitterUrl,
        website: payload.socials.websiteUrl,
      },
    })

    const feeConfig = await callLaunchProviderProxy<{
      meteoraConfigKey: string
      transactions: Array<{ transactionBase64: string }>
      bundles: Array<Array<{ transactionBase64: string }>>
      providerResponse: Record<string, unknown>
    }>({
      action: 'bags-create-fee-config',
      payload: {
        payer: creatorWallet,
        baseMint: tokenInfo.tokenMint,
        claimersArray: [creatorWallet],
        basisPointsArray: [10000],
      },
    })

    for (const item of feeConfig.transactions ?? []) {
      const tx = deserializeVersionedTransaction(item.transactionBase64)
      const signed = signWithWalletAndExtraSigners(context.walletContext.wallet, tx)
      await sendAndConfirmVersionedTransaction(signed)
    }

    const launchTx = await callLaunchProviderProxy<{
      transactionBase64: string
      providerResponse: Record<string, unknown>
    }>({
      action: 'bags-create-launch-transaction',
      payload: {
        ipfs: tokenInfo.tokenMetadata,
        tokenMint: tokenInfo.tokenMint,
        wallet: creatorWallet,
        initialBuyLamports: payload.initialBuy.enabled ? Math.floor(payload.initialBuy.amount * 1_000_000_000) : 0,
        configKey: feeConfig.meteoraConfigKey,
      },
    })

    const tx = deserializeVersionedTransaction(launchTx.transactionBase64)
    const signed = signWithWalletAndExtraSigners(context.walletContext.wallet, tx)
    const signature = await sendAndConfirmVersionedTransaction(signed)
    const initialBuySignature = payload.initialBuy.enabled ? signature : null
    return {
      provider: 'bags',
      mintAddress: tokenInfo.tokenMint,
      signature,
      explorerUrl: explorer(signature),
      launchedAt: new Date().toISOString(),
      metadataUrl: tokenInfo.tokenMetadata,
      imageUrl: context.metadata.imageUrl,
      tokenName: payload.name,
      symbol: payload.symbol,
      socials: payload.socials,
      status: initialBuySignature || !payload.initialBuy.enabled ? 'confirmed' : 'partial',
      initialBuyEnabled: payload.initialBuy.enabled,
      initialBuyAmount: payload.initialBuy.enabled ? payload.initialBuy.amount : null,
      initialBuyDenomination: payload.initialBuy.enabled ? payload.initialBuy.denomination : null,
      initialBuySignature,
      initialBuyStatus: payload.initialBuy.enabled ? (initialBuySignature ? 'confirmed' : 'failed') : 'not_requested',
      totalLaunchCost: payload.initialBuy.enabled ? Number((payload.initialBuy.amount + 0.02).toFixed(4)) : 0.02,
      rawProviderResponse: {
        provider: 'bags',
        requestedSupply: payload.totalSupply,
        requestedDecimals: payload.decimals,
        tokenInfo: tokenInfo.providerResponse,
        feeConfig: feeConfig.providerResponse,
        launchTx: launchTx.providerResponse,
      },
      metadataRecord: context.metadata,
    }
  },
}

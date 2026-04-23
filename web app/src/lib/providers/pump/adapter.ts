import { Keypair } from '@solana/web3.js'
import type { LaunchAdapter } from '../../providers/types'
import { callLaunchProviderProxy } from '../client'
import { signWithWalletAndExtraSigners, sendAndConfirmVersionedTransaction, deserializeVersionedTransaction } from '../../solana/transactions'

function explorer(signature: string): string {
  return `https://solscan.io/tx/${signature}`
}

export const pumpLaunchAdapter: LaunchAdapter = {
  provider: 'pumpfun',
  label: 'Pump.fun',
  description: 'Launch into the viral memecoin ecosystem using Axyrion-managed metadata.',
  note: 'Launch into the viral memecoin ecosystem',
  supportsInitialBuy: true,
  requiresIpfsCompatibleMetadataUrl: true,
  async launchToken(payload, context) {
    const mintKeypair = Keypair.generate()
    const initialBuyAmount = payload.initialBuy.enabled ? payload.initialBuy.amount : 0
    const proxyResponse = await callLaunchProviderProxy<{
      transactionBase64: string
      metadataUri: string
      metadataIpfsUri: string
      metadataPublicGatewayUrl: string
      imageIpfsUrl: string
      providerResponse: Record<string, unknown>
    }>({
      action: 'pump-create-transaction',
      payload: {
        creatorPublicKey: context.walletContext.wallet.publicKey,
        mintPublicKey: mintKeypair.publicKey.toBase58(),
        metadataJson: context.metadata.metadataJson,
        imageUrl: context.metadata.imageUrl,
        metadataPublicUrl: context.metadata.metadataPublicUrl,
        amountSol: initialBuyAmount,
        slippage: Math.max(5, (payload.providerConfig?.slippageBps ?? 1000) / 100),
        priorityFee: 0.00005,
        tokenMetadata: {
          name: payload.name,
          symbol: payload.symbol,
        },
      },
    })

    const tx = deserializeVersionedTransaction(proxyResponse.transactionBase64)
    const signed = signWithWalletAndExtraSigners(context.walletContext.wallet, tx, [mintKeypair])
    const signature = await sendAndConfirmVersionedTransaction(signed)
    const initialBuySignature = payload.initialBuy.enabled ? signature : null
    return {
      provider: 'pumpfun',
      mintAddress: mintKeypair.publicKey.toBase58(),
      signature,
      explorerUrl: explorer(signature),
      launchedAt: new Date().toISOString(),
      metadataUrl: proxyResponse.metadataUri,
      imageUrl: proxyResponse.imageIpfsUrl || context.metadata.imageUrl,
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
        provider: 'pumpfun',
        requestedSupply: payload.totalSupply,
        requestedDecimals: payload.decimals,
        metadataUriUsed: proxyResponse.metadataUri,
        providerResponse: proxyResponse.providerResponse,
      },
      metadataRecord: {
        ...context.metadata,
        imageUrl: proxyResponse.imageIpfsUrl || context.metadata.imageUrl,
        metadataPublicUrl: context.metadata.metadataPublicUrl,
        ipfsCompatibleMetadataUrl: proxyResponse.metadataIpfsUri,
      },
    }
  },
}

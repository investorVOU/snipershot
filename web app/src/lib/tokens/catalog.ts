import type { SwapTokenOption } from '../../types'

export const SOL_MINT = 'So11111111111111111111111111111111111111112'
export const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'
export const SKR_MINT = 'SKRbvo6Gf7GondiT3BbTfuRDPqLWei4j2Qy2NPGZhW3'

export const CORE_SWAP_TOKENS: SwapTokenOption[] = [
  {
    mint: SOL_MINT,
    symbol: 'SOL',
    name: 'Solana',
    decimals: 9,
    logoURI: 'https://statics.solscan.io/solscan-img/solana_icon.svg',
    verified: true,
    source: 'core',
  },
  {
    mint: USDC_MINT,
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
    logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png',
    verified: true,
    source: 'core',
  },
  {
    mint: SKR_MINT,
    symbol: 'SKR',
    name: 'Seeker',
    decimals: 9,
    logoURI: 'https://gateway.irys.xyz/uP1dFvCofZQT26m3SKOCttXrir3ORBR1B8wPhP6tv7M?ext=png',
    verified: true,
    source: 'core',
  },
]

export function dedupeSwapTokens(tokens: SwapTokenOption[]): SwapTokenOption[] {
  const byMint = new Map<string, SwapTokenOption>()
  tokens.forEach((token) => {
    if (!token.mint) return
    byMint.set(token.mint, token)
  })
  return Array.from(byMint.values())
}


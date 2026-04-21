import { MemeChart } from '../components/MemeChart'

const MORALIS_KEY = import.meta.env.VITE_MORALIS_API_KEY

export function ChartDemoPage() {
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-4 pt-5 pb-3 border-b border-dark-border">
        <h1 className="text-dark-text font-bold text-xl">MemeChart Demo</h1>
        <p className="text-dark-subtext text-sm mt-1">
          React + TypeScript + Tailwind + lightweight-charts. Solana charts default to Moralis mode and auto-switch to DEX embeds after graduation.
        </p>
      </div>

      <div className="p-4 flex flex-col gap-6 max-w-6xl mx-auto">
        <section className="card p-4 flex flex-col gap-3">
          <div>
            <h2 className="text-dark-text font-semibold">1. Pre-graduation pump.fun token</h2>
            <p className="text-dark-subtext text-sm">Moralis mode with bonding-status + OHLCV.</p>
          </div>
          <MemeChart
            tokenAddress="31wXTexmz1WVcrzx436Bd76TNcyuQMfjCJWUom5dpump"
            chain="solana"
            platform="moralis"
            moralisApiKey={MORALIS_KEY}
            height={500}
          />
        </section>

        <section className="card p-4 flex flex-col gap-3">
          <div>
            <h2 className="text-dark-text font-semibold">2. Post-graduation Solana token</h2>
            <p className="text-dark-subtext text-sm">Auto-detects Moralis first, then switches to DexScreener when graduated.</p>
          </div>
          <MemeChart
            tokenAddress="DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263"
            chain="solana"
            moralisApiKey={MORALIS_KEY}
            height={500}
          />
        </section>

        <section className="card p-4 flex flex-col gap-3">
          <div>
            <h2 className="text-dark-text font-semibold">3. Ethereum memecoin</h2>
            <p className="text-dark-subtext text-sm">DexScreener embed mode.</p>
          </div>
          <MemeChart
            tokenAddress="0x6982508145454Ce325dDbE47a25d4ec3d2311933"
            chain="ethereum"
            platform="dexscreener"
            height={500}
          />
        </section>

        <section className="card p-4 flex flex-col gap-3">
          <div>
            <h2 className="text-dark-text font-semibold">4. GeckoTerminal embed example</h2>
            <p className="text-dark-subtext text-sm">GeckoTerminal requires a pool address, not a token address.</p>
          </div>
          <MemeChart
            tokenAddress="0xa43fe16908251ee70ef74718545e4fe6c5ccec9f"
            chain="ethereum"
            platform="geckoterminal"
            height={500}
          />
        </section>
      </div>
    </div>
  )
}

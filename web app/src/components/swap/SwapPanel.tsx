import { ArrowDownUp, ChevronDown, RefreshCw } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { dedupeSwapTokens } from '../../lib/tokens/catalog'
import { shortenAddress } from '../../services/format'
import { useJupiterQuote } from '../../hooks/useJupiterQuote'
import { TokenSelectorModal } from './TokenSelectorModal'
import type { NormalizedSwapResult, SwapHistoryRow, SwapTokenOption } from '../../types'

interface Props {
  tokens: SwapTokenOption[]
  initialInputToken: SwapTokenOption
  initialOutputToken: SwapTokenOption
  walletConnected: boolean
  userWallet: string | null
  loading: boolean
  error: string | null
  balances?: Record<string, number>
  featuredTokens?: SwapTokenOption[]
  recentSwaps?: SwapHistoryRow[]
  onSwap: (args: { inputToken: SwapTokenOption; outputToken: SwapTokenOption; amount: number; slippageBps: number }) => Promise<NormalizedSwapResult>
}

export function SwapPanel({
  tokens,
  initialInputToken,
  initialOutputToken,
  walletConnected,
  userWallet,
  loading,
  error,
  balances = {},
  featuredTokens = [],
  recentSwaps = [],
  onSwap,
}: Props) {
  const availableTokens = useMemo(() => dedupeSwapTokens(tokens), [tokens])
  const [inputToken, setInputToken] = useState<SwapTokenOption>(initialInputToken)
  const [outputToken, setOutputToken] = useState<SwapTokenOption>(initialOutputToken)
  const [amount, setAmount] = useState('')
  const [slippageBps, setSlippageBps] = useState(100)
  const [selectorMode, setSelectorMode] = useState<'input' | 'output' | null>(null)
  const [success, setSuccess] = useState<NormalizedSwapResult | null>(null)

  useEffect(() => {
    setInputToken(initialInputToken)
  }, [initialInputToken])

  useEffect(() => {
    setOutputToken(initialOutputToken)
  }, [initialOutputToken])

  const numericAmount = Number(amount) || 0
  const { quote, loading: quoteLoading, error: quoteError, quotedOutputAmount } = useJupiterQuote(inputToken, outputToken, numericAmount, slippageBps)

  const inputBalance = balances[inputToken.mint] ?? 0
  const outputBalance = balances[outputToken.mint] ?? 0
  const maxAmount = inputToken.symbol === 'SOL' ? Math.max(0, inputBalance - 0.01) : inputBalance
  const routeLabel = quote?.routePlan?.length ? `${quote.routePlan.length} hop${quote.routePlan.length > 1 ? 's' : ''}` : 'No route'
  const insufficientBalance = numericAmount > 0 && numericAmount > inputBalance
  const sameToken = inputToken.mint === outputToken.mint
  const canSubmit = walletConnected && !!userWallet && numericAmount > 0 && !!quote && !loading && !insufficientBalance && !sameToken
  const primaryLabel = !walletConnected
    ? 'Connect wallet to swap'
    : sameToken
      ? 'Choose different tokens'
      : insufficientBalance
        ? 'Insufficient balance'
        : loading
          ? 'Submitting swap...'
          : 'Swap'

  return (
    <>
      <div className="card p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-dark-text">Swap</h3>
            <p className="text-sm text-dark-subtext">Live Jupiter routing. Tradability is only shown when a real route exists.</p>
          </div>
          <span className="rounded-full border border-white/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-dark-subtext">Jupiter</span>
        </div>

        <SwapTokenField
          label="You pay"
          token={inputToken}
          value={amount}
          balance={inputBalance}
          onChange={setAmount}
          onMax={() => setAmount(maxAmount > 0 ? maxAmount.toString() : '')}
          showMax={maxAmount > 0}
          onSelect={() => setSelectorMode('input')}
        />

        <div className="my-3 flex justify-center">
          <button
            type="button"
            onClick={() => {
              setInputToken(outputToken)
              setOutputToken(inputToken)
            }}
            className="rounded-full border border-dark-border bg-dark-muted p-2 text-dark-subtext transition-colors hover:text-dark-text"
          >
            <ArrowDownUp size={16} />
          </button>
        </div>

        <SwapTokenField
          label="You receive"
          token={outputToken}
          value={quotedOutputAmount > 0 ? quotedOutputAmount.toFixed(6) : ''}
          balance={outputBalance}
          readOnly
          onChange={() => undefined}
          onSelect={() => setSelectorMode('output')}
        />

        <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
          <InfoPill label="Route" value={quoteLoading ? 'Refreshing...' : routeLabel} loading={quoteLoading} />
          <InfoPill label="Price impact" value={quote ? `${Number(quote.priceImpactPct).toFixed(2)}%` : '—'} />
          <InfoPill label="Slippage" value={`${(slippageBps / 100).toFixed(2)}%`} />
          <InfoPill label="Wallet" value={userWallet ? shortenAddress(userWallet, 4) : 'Disconnected'} />
        </div>

        <div className="mt-4 flex gap-2">
          {[50, 100, 300].map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setSlippageBps(value)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold ${slippageBps === value ? 'bg-[#9945ff22] text-[#c7adff]' : 'bg-dark-muted text-dark-subtext'}`}
            >
              {(value / 100).toFixed(2)}%
            </button>
          ))}
        </div>

        {quoteLoading && numericAmount > 0 && (
          <div className="mt-4 rounded-xl border border-dark-border bg-dark-muted/60 px-3 py-3">
            <div className="h-3 w-24 animate-pulse rounded bg-white/10" />
            <div className="mt-2 h-3 w-40 animate-pulse rounded bg-white/10" />
          </div>
        )}
        {insufficientBalance && (
          <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            Insufficient {inputToken.symbol} balance. Available: {inputBalance.toLocaleString(undefined, { maximumFractionDigits: 6 })}.
          </div>
        )}
        {sameToken && (
          <div className="mt-4 rounded-xl border border-yellow-400/30 bg-yellow-400/10 px-3 py-2 text-sm text-yellow-400">
            Select two different tokens to request a route.
          </div>
        )}
        {(error || quoteError) && <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error ?? quoteError}</div>}
        {!quoteLoading && !quote && numericAmount > 0 && !quoteError && (
          <div className="mt-4 rounded-xl border border-yellow-400/30 bg-yellow-400/10 px-3 py-2 text-sm text-yellow-400">No route available yet</div>
        )}
        {success && (
          <div className="mt-4 rounded-xl border border-[#14f19530] bg-[#14f19510] px-3 py-3">
            <div className="text-sm font-semibold text-[#14f195]">Swap confirmed</div>
            <div className="mt-1 text-xs text-dark-subtext">Received {success.outputAmount.toFixed(6)} {success.outputToken.symbol}.</div>
            <a href={`https://solscan.io/tx/${success.txSignature}`} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-dark-text">
              View transaction
            </a>
          </div>
        )}

        <button
          type="button"
          disabled={!canSubmit}
          onClick={async () => {
            const result = await onSwap({ inputToken, outputToken, amount: numericAmount, slippageBps })
            setSuccess(result)
            setAmount('')
          }}
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-brand px-4 py-3 text-sm font-bold text-[#08110d] transition-colors disabled:opacity-40"
        >
          {loading ? <RefreshCw size={15} className="animate-spin" /> : null}
          {primaryLabel}
        </button>

        {recentSwaps.length > 0 && (
          <div className="mt-4">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-dark-faint">Recent swaps</div>
            <div className="flex flex-wrap gap-2">
              {recentSwaps.slice(0, 4).map((entry) => (
                <button
                  key={entry.tx_signature}
                  type="button"
                  onClick={() => {
                    const nextInput = availableTokens.find((token) => token.mint === entry.input_mint)
                    const nextOutput = availableTokens.find((token) => token.mint === entry.output_mint)
                    if (nextInput) setInputToken(nextInput)
                    if (nextOutput) setOutputToken(nextOutput)
                  }}
                  className="rounded-full border border-dark-border bg-dark-card px-3 py-1.5 text-xs font-semibold text-dark-subtext transition-colors hover:text-dark-text"
                >
                  {entry.input_symbol} to {entry.output_symbol}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <TokenSelectorModal
        visible={selectorMode !== null}
        onClose={() => setSelectorMode(null)}
        tokens={availableTokens}
        featuredTokens={featuredTokens}
        onSelect={(token) => {
          if (selectorMode === 'input') {
            if (token.mint === outputToken.mint) setOutputToken(inputToken)
            setInputToken(token)
          }
          if (selectorMode === 'output') {
            if (token.mint === inputToken.mint) setInputToken(outputToken)
            setOutputToken(token)
          }
        }}
      />
    </>
  )
}

function SwapTokenField(props: {
  label: string
  token: SwapTokenOption
  value: string
  onChange: (value: string) => void
  onSelect: () => void
  balance?: number
  onMax?: () => void
  showMax?: boolean
  readOnly?: boolean
}) {
  return (
    <div className="mt-4 rounded-[24px] border border-dark-border bg-[#0f1621] p-4">
      <div className="flex items-center justify-between text-xs text-dark-faint">
        <span>{props.label}</span>
        <div className="flex items-center gap-2">
          <span>{props.balance != null ? `Bal ${props.balance.toLocaleString(undefined, { maximumFractionDigits: 6 })}` : props.token.name}</span>
          {props.showMax && props.onMax && !props.readOnly && (
            <button type="button" onClick={props.onMax} className="rounded-full border border-dark-border px-2 py-0.5 text-[10px] font-semibold text-dark-text transition-colors hover:bg-dark-card">
              Max
            </button>
          )}
        </div>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <button type="button" onClick={props.onSelect} className="inline-flex items-center gap-2 rounded-2xl border border-dark-border bg-dark-card px-3 py-2">
          <div className="h-7 w-7 overflow-hidden rounded-full bg-dark-muted">
            {props.token.logoURI && <img src={props.token.logoURI} alt={props.token.name} className="h-full w-full object-cover" />}
          </div>
          <span className="text-sm font-semibold text-dark-text">{props.token.symbol}</span>
          <ChevronDown size={14} className="text-dark-subtext" />
        </button>
        <input
          value={props.value}
          onChange={(event) => props.onChange(event.target.value)}
          readOnly={props.readOnly}
          type="number"
          min="0"
          step="any"
          placeholder="0.0"
          className="w-full bg-transparent text-right text-2xl font-semibold text-dark-text outline-none"
        />
      </div>
    </div>
  )
}

function InfoPill({ label, value, loading = false }: { label: string; value: string; loading?: boolean }) {
  return (
    <div className="rounded-xl border border-dark-border bg-dark-muted px-3 py-2">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-dark-faint">{label}</div>
      {loading ? <div className="mt-1 h-5 w-16 animate-pulse rounded bg-white/10" /> : <div className="mt-1 text-sm font-semibold text-dark-text">{value}</div>}
    </div>
  )
}

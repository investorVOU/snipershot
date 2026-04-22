import { useEffect, useState } from 'react'
import { X, Zap, AlertTriangle, Crosshair, TrendingDown } from 'lucide-react'
import type { FeedToken } from '../types'
import type { EmbeddedWallet } from '../services/walletService'
import { getSolBalance } from '../services/solana'
import { toHttpUrl, formatMarketCap, formatPrice } from '../services/format'
import { loadSniperConfig } from '../services/sniperConfig'
import { useTheme } from '../context/ThemeContext'

type Tab = 'buy' | 'sell'
const SELL_PRESETS = [25, 50, 75, 100]

interface Props {
  token: FeedToken | null
  wallet?: EmbeddedWallet | null
  positionTokens?: number
  onClose: () => void
  onConfirm: (mint: string, amountSol: number, slippage: number) => Promise<void>
  onSell?: (mint: string, amountTokens: number, slippage: number) => Promise<void>
  defaultTab?: Tab
}

export function SnipeModal({ token, wallet, positionTokens = 0, onClose, onConfirm, onSell, defaultTab = 'buy' }: Props) {
  const { colors } = useTheme()
  const initialConfig = loadSniperConfig()
  const [tab, setTab] = useState<Tab>(defaultTab)

  // Buy state
  const [buyAmount, setBuyAmount] = useState(String(initialConfig.defaultAmount))
  const [buySlippage, setBuySlippage] = useState(initialConfig.defaultSlippage)
  const [balanceSol, setBalanceSol] = useState<number | null>(null)

  // Sell state
  const [sellPct, setSellPct] = useState(100)
  const [sellCustom, setSellCustom] = useState('')
  const [sellSlippage, setSellSlippage] = useState(15)

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setError('')
    setTab(defaultTab)
  }, [token?.mint, defaultTab])

  useEffect(() => {
    if (!wallet || !token) { setBalanceSol(null); return }
    void getSolBalance(wallet.publicKey).then(setBalanceSol).catch(() => setBalanceSol(null))
  }, [wallet, token])

  if (!token) return null

  const mc = token.overview?.marketCap ?? token.usdMarketCap ?? 0
  const price = token.overview?.price ?? 0
  const maxSpendable = balanceSol !== null ? Math.max(0, balanceSol - 0.001) : null

  // Sell amount derived
  const hasPosition = positionTokens > 0
  const derivedSellAmt = sellCustom !== ''
    ? parseFloat(sellCustom)
    : hasPosition ? (positionTokens * sellPct) / 100 : 0

  const handleBuy = async () => {
    const sol = parseFloat(buyAmount)
    if (isNaN(sol) || sol <= 0) { setError('Enter a valid SOL amount'); return }
    if (balanceSol !== null && sol > maxSpendable!) { setError(`Max spendable: ${maxSpendable!.toFixed(4)} SOL`); return }
    setBusy(true); setError('')
    try { await onConfirm(token.mint, sol, buySlippage); onClose() }
    catch (e) { setError(e instanceof Error ? e.message : 'Buy failed') }
    finally { setBusy(false) }
  }

  const handleSell = async () => {
    if (!onSell) { setError('Sell not available'); return }
    const amt = derivedSellAmt
    if (!amt || amt <= 0) { setError('Enter an amount to sell'); return }
    setBusy(true); setError('')
    try { await onSell(token.mint, amt, sellSlippage); onClose() }
    catch (e) { setError(e instanceof Error ? e.message : 'Sell failed') }
    finally { setBusy(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-sm bg-dark-card rounded-2xl border border-dark-border p-6" onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full flex-shrink-0 overflow-hidden" style={{ backgroundColor: colors.surface }}>
              {toHttpUrl(token.imageUri)
                ? <img src={toHttpUrl(token.imageUri)} alt={token.name} className="w-full h-full object-cover" />
                : <span className="w-full h-full flex items-center justify-center text-dark-subtext text-xs font-bold">{token.symbol.slice(0,2)}</span>
              }
            </div>
            <div className="min-w-0">
              <div className="text-dark-text font-bold text-sm truncate leading-tight">{token.name}</div>
              <div className="text-dark-subtext text-xs">${token.symbol}{mc > 0 ? ` · ${formatMarketCap(mc)}` : ''}{price > 0 ? ` · ${formatPrice(price)}` : ''}</div>
            </div>
          </div>
          <button onClick={onClose} className="text-dark-subtext hover:text-dark-text transition-colors ml-2 flex-shrink-0">
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex bg-dark-muted rounded-xl p-1 gap-1 mb-5">
          <button
            onClick={() => { setTab('buy'); setError('') }}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-[10px] text-sm font-semibold transition-colors ${
              tab === 'buy' ? 'bg-brand text-[#08110d]' : 'text-dark-subtext hover:text-dark-text'
            }`}
          >
            <Crosshair size={13} /> Buy
          </button>
          <button
            onClick={() => { setTab('sell'); setError('') }}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-[10px] text-sm font-semibold transition-colors ${
              tab === 'sell' ? 'bg-red-500/80 text-white' : 'text-dark-subtext hover:text-dark-text'
            }`}
          >
            <TrendingDown size={13} /> Sell
          </button>
        </div>

        {tab === 'buy' ? (
          <>
            {/* Balance */}
            <div className="flex items-center justify-between mb-2">
              <label className="text-dark-subtext text-sm font-semibold">Amount (SOL)</label>
              <span className="text-dark-subtext text-xs">Balance: {balanceSol !== null ? `◎${balanceSol.toFixed(4)}` : '...'}</span>
            </div>
            <div className="relative mb-2">
              <input
                type="number"
                value={buyAmount}
                onChange={(e) => setBuyAmount(e.target.value)}
                className="input pr-12"
                placeholder="0.1"
                min="0.001"
                step="0.01"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-subtext font-bold text-sm">◎</span>
            </div>
            <div className="flex gap-2 mb-4">
              {['0.05', '0.1', '0.5', '1'].map((v) => (
                <button key={v} onClick={() => setBuyAmount(v)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                    buyAmount === v ? 'bg-brand text-[#08110d] border-brand' : 'bg-dark-muted text-dark-subtext border-dark-border hover:border-brand/50'
                  }`}
                >{v}</button>
              ))}
              {maxSpendable !== null && (
                <button onClick={() => setBuyAmount(maxSpendable.toFixed(4))}
                  className="flex-1 py-1.5 rounded-lg text-xs font-semibold border bg-dark-muted text-dark-subtext border-dark-border hover:border-brand/50 transition-colors"
                >Max</button>
              )}
            </div>

            <label className="text-dark-subtext text-sm font-semibold mb-2 block">Slippage: {buySlippage}%</label>
            <div className="flex gap-2 mb-5">
              {[5, 10, 15, 25].map((v) => (
                <button key={v} onClick={() => setBuySlippage(v)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                    buySlippage === v ? 'bg-brand text-[#08110d] border-brand' : 'bg-dark-muted text-dark-subtext border-dark-border hover:border-brand/50'
                  }`}
                >{v}%</button>
              ))}
            </div>

            <div className="flex items-center gap-2 p-3 rounded-xl bg-yellow-400/5 border border-yellow-400/20 mb-4">
              <AlertTriangle size={14} className="text-yellow-400 flex-shrink-0" />
              <p className="text-yellow-400/80 text-xs">0.5% platform fee. Only invest what you can afford to lose.</p>
            </div>

            {error && <p className="text-red-400 text-sm text-center mb-3">{error}</p>}

            <button onClick={handleBuy} disabled={busy} className="btn-primary w-full justify-center">
              {busy ? <><Zap size={16} className="animate-pulse" /> Buying…</> : <><Crosshair size={16} /> Confirm Buy</>}
            </button>
          </>
        ) : (
          <>
            {/* Position info */}
            {hasPosition ? (
              <div className="mb-4 p-3 rounded-xl bg-[#14f19510] border border-[#14f19530]">
                <div className="text-[#14f195] text-xs font-bold mb-0.5">Your Position</div>
                <div className="text-dark-text font-mono text-sm">{positionTokens.toLocaleString(undefined, { maximumFractionDigits: 2 })} {token.symbol}</div>
              </div>
            ) : (
              <div className="mb-4 p-3 rounded-xl bg-dark-muted border border-dark-border">
                <div className="text-dark-subtext text-xs">No tracked position — enter token amount manually</div>
              </div>
            )}

            <label className="text-dark-subtext text-sm font-semibold mb-2 block">Amount ({token.symbol})</label>
            {hasPosition && (
              <div className="flex gap-2 mb-2">
                {SELL_PRESETS.map((p) => (
                  <button key={p} onClick={() => { setSellPct(p); setSellCustom('') }}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                      sellCustom === '' && sellPct === p ? 'bg-red-500/80 text-white border-red-500' : 'bg-dark-muted text-dark-subtext border-dark-border hover:border-red-500/40'
                    }`}
                  >{p}%</button>
                ))}
              </div>
            )}
            <div className="relative mb-1">
              <input
                type="number"
                value={sellCustom !== '' ? sellCustom : hasPosition ? ((positionTokens * sellPct) / 100).toFixed(2) : ''}
                onChange={(e) => setSellCustom(e.target.value)}
                className="input pr-16"
                placeholder="Token amount"
                min="0"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-subtext font-bold text-xs">{token.symbol}</span>
            </div>
            {hasPosition && (
              <button onClick={() => { setSellPct(100); setSellCustom('') }} className="text-brand text-xs mb-4">
                Max: {positionTokens.toLocaleString(undefined, { maximumFractionDigits: 4 })} {token.symbol}
              </button>
            )}

            <label className="text-dark-subtext text-sm font-semibold mb-2 block mt-3">Slippage: {sellSlippage}%</label>
            <div className="flex gap-2 mb-5">
              {[5, 10, 15, 25].map((v) => (
                <button key={v} onClick={() => setSellSlippage(v)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                    sellSlippage === v ? 'bg-red-500/80 text-white border-red-500' : 'bg-dark-muted text-dark-subtext border-dark-border hover:border-red-500/40'
                  }`}
                >{v}%</button>
              ))}
            </div>

            <div className="flex items-center gap-2 p-3 rounded-xl bg-yellow-400/5 border border-yellow-400/20 mb-4">
              <AlertTriangle size={14} className="text-yellow-400 flex-shrink-0" />
              <p className="text-yellow-400/80 text-xs">Selling via Jupiter swap. 0.5% platform fee applies.</p>
            </div>

            {error && <p className="text-red-400 text-sm text-center mb-3">{error}</p>}

            <button
              onClick={handleSell}
              disabled={busy || derivedSellAmt <= 0}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 font-bold text-sm hover:bg-red-500/20 transition-colors disabled:opacity-50"
            >
              {busy ? <><Zap size={16} className="animate-pulse" /> Selling…</> : <><TrendingDown size={16} /> Confirm Sell</>}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

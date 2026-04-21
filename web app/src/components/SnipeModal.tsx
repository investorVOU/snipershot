import { useState } from 'react'
import { X, Crosshair, Zap, AlertTriangle } from 'lucide-react'
import type { FeedToken } from '../types'
import { toHttpUrl, formatMarketCap } from '../services/format'

interface Props {
  token: FeedToken | null
  onClose: () => void
  onConfirm: (mint: string, amountSol: number, slippage: number) => Promise<void>
}

export function SnipeModal({ token, onClose, onConfirm }: Props) {
  const [amount, setAmount] = useState('0.1')
  const [slippage, setSlippage] = useState(15)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  if (!token) return null

  const handleConfirm = async () => {
    const sol = parseFloat(amount)
    if (isNaN(sol) || sol <= 0) { setError('Enter a valid SOL amount'); return }
    setBusy(true)
    setError('')
    try {
      await onConfirm(token.mint, sol, slippage)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Snipe failed')
    } finally {
      setBusy(false)
    }
  }

  const mc = token.overview?.marketCap ?? token.usdMarketCap ?? 0

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-sm bg-dark-card rounded-2xl border border-dark-border p-6 slide-in-right"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-dark-text font-bold text-lg flex items-center gap-2">
            <Crosshair size={18} className="text-brand" />
            Snipe Token
          </h2>
          <button onClick={onClose} className="text-dark-subtext hover:text-dark-text transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Token info */}
        <div className="flex items-center gap-3 mb-5 p-3 rounded-xl bg-dark-muted border border-dark-border">
          <div className="w-10 h-10 rounded-full bg-[#1a1a2e] flex-shrink-0 overflow-hidden">
            {toHttpUrl(token.imageUri) && (
              <img src={toHttpUrl(token.imageUri)} alt={token.name} className="w-full h-full object-cover" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-dark-text font-bold truncate">{token.name}</div>
            <div className="text-dark-subtext text-sm">${token.symbol} · MC {mc > 0 ? formatMarketCap(mc) : '—'}</div>
          </div>
        </div>

        {/* Amount */}
        <div className="mb-4">
          <label className="text-dark-subtext text-sm font-semibold mb-2 block">Amount (SOL)</label>
          <div className="relative">
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="input pr-12"
              placeholder="0.1"
              min="0.001"
              step="0.01"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-subtext font-bold text-sm">◎</span>
          </div>
          <div className="flex gap-2 mt-2">
            {['0.05', '0.1', '0.5', '1'].map((v) => (
              <button
                key={v}
                onClick={() => setAmount(v)}
                className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                  amount === v
                    ? 'bg-brand text-[#08110d] border-brand'
                    : 'bg-dark-muted text-dark-subtext border-dark-border hover:border-brand/50'
                }`}
              >
                {v}
              </button>
            ))}
          </div>
        </div>

        {/* Slippage */}
        <div className="mb-5">
          <label className="text-dark-subtext text-sm font-semibold mb-2 block">Slippage: {slippage}%</label>
          <div className="flex gap-2">
            {[5, 10, 15, 25].map((v) => (
              <button
                key={v}
                onClick={() => setSlippage(v)}
                className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                  slippage === v
                    ? 'bg-brand text-[#08110d] border-brand'
                    : 'bg-dark-muted text-dark-subtext border-dark-border hover:border-brand/50'
                }`}
              >
                {v}%
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 p-3 rounded-xl bg-yellow-400/5 border border-yellow-400/20 mb-4">
          <AlertTriangle size={14} className="text-yellow-400 flex-shrink-0" />
          <p className="text-yellow-400/80 text-xs">
            0.5% platform fee. Memecoins are extremely volatile. Only invest what you can afford to lose.
          </p>
        </div>

        {error && <p className="text-red-400 text-sm text-center mb-3">{error}</p>}

        <button
          onClick={handleConfirm}
          disabled={busy}
          className="btn-primary w-full justify-center"
        >
          {busy ? (
            <span className="flex items-center gap-2"><Zap size={16} className="animate-pulse" /> Sniping…</span>
          ) : (
            <><Crosshair size={16} /> Confirm Snipe</>
          )}
        </button>
      </div>
    </div>
  )
}

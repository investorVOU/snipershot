import { Search, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import type { SwapTokenOption } from '../../types'

interface Props {
  visible: boolean
  onClose: () => void
  tokens: SwapTokenOption[]
  featuredTokens?: SwapTokenOption[]
  onSelect: (token: SwapTokenOption) => void
}

export function TokenSelectorModal({ visible, onClose, tokens, featuredTokens = [], onSelect }: Props) {
  const [query, setQuery] = useState('')

  useEffect(() => {
    if (visible) setQuery('')
  }, [visible])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return tokens
    return tokens.filter((token) =>
      token.name.toLowerCase().includes(q) ||
      token.symbol.toLowerCase().includes(q) ||
      token.mint.toLowerCase().startsWith(q)
    )
  }, [query, tokens])

  const featured = useMemo(() => {
    const seen = new Set<string>()
    return featuredTokens.filter((token) => {
      if (!token.mint || seen.has(token.mint)) return false
      seen.add(token.mint)
      return true
    }).slice(0, 6)
  }, [featuredTokens])

  if (!visible) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center" onClick={onClose}>
      <div className="w-full max-w-md rounded-[28px] border border-dark-border bg-[#0d131c] p-4 shadow-[0_30px_80px_rgba(0,0,0,0.45)]" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-dark-text">Select token</h3>
            <p className="text-sm text-dark-subtext">Core assets, wallet holdings, and launched tokens.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-dark-subtext transition-colors hover:text-dark-text">
            <X size={18} />
          </button>
        </div>

        <div className="relative mt-4">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-faint" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="input pl-9 py-2.5 text-sm"
            placeholder="Search token, symbol, or mint"
          />
        </div>

        <div className="mt-4 flex max-h-[420px] flex-col gap-2 overflow-y-auto">
          {!query && featured.length > 0 && (
            <>
              <div className="px-1 pt-1 text-[11px] font-semibold uppercase tracking-wide text-dark-faint">Popular</div>
              <div className="mb-2 flex flex-wrap gap-2">
                {featured.map((token) => (
                  <button
                    key={`featured-${token.mint}`}
                    type="button"
                    onClick={() => { onSelect(token); onClose() }}
                    className="rounded-full border border-dark-border bg-dark-card px-3 py-1.5 text-xs font-semibold text-dark-text transition-colors hover:bg-[#131c27]"
                  >
                    {token.symbol}
                  </button>
                ))}
              </div>
            </>
          )}

          {filtered.map((token) => (
            <button
              key={token.mint}
              type="button"
              onClick={() => { onSelect(token); onClose() }}
              className="flex items-center gap-3 rounded-2xl border border-dark-border bg-dark-card px-3 py-3 text-left transition-colors hover:bg-[#131c27]"
            >
              <div className="h-10 w-10 overflow-hidden rounded-full bg-dark-muted">
                {token.logoURI && <img src={token.logoURI} alt={token.name} className="h-full w-full object-cover" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-dark-text">{token.name}</div>
                <div className="text-xs text-dark-subtext">${token.symbol}</div>
              </div>
              <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] font-semibold text-dark-subtext">
                {token.source ?? 'token'}
              </span>
            </button>
          ))}
          {filtered.length === 0 && <div className="py-8 text-center text-sm text-dark-subtext">No matching token found.</div>}
        </div>
      </div>
    </div>
  )
}

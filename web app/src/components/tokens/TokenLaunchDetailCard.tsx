import { Copy, ExternalLink } from 'lucide-react'
import { copyText } from '../../lib/utils/clipboard'
import { shortenAddress } from '../../services/format'
import { ProviderBadge } from '../launch/ProviderBadge'
import type { LaunchProvider } from '../../types'

interface Props {
  imageUrl: string
  name: string
  symbol: string
  mint: string
  provider: LaunchProvider
  txSignature?: string | null
  createdAt?: string | null
  websiteUrl?: string | null
  twitterUrl?: string | null
  telegramUrl?: string | null
  metadataUrl?: string | null
  tradableStatus?: string
  tradableReason?: string
}

export function TokenLaunchDetailCard(props: Props) {
  return (
    <div className="card p-4">
      <div className="flex items-start gap-3">
        <div className="h-12 w-12 overflow-hidden rounded-2xl bg-dark-muted">
          {props.imageUrl && <img src={props.imageUrl} alt={props.name} className="h-full w-full object-cover" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-base font-semibold text-dark-text">{props.name}</h3>
            <span className="text-sm font-semibold text-dark-subtext">${props.symbol}</span>
            <ProviderBadge provider={props.provider} />
          </div>
          <p className="mt-1 text-xs text-dark-subtext">
            Mint {shortenAddress(props.mint, 6)}
          </p>
          {props.createdAt && <p className="mt-1 text-xs text-dark-faint">Created {new Date(props.createdAt).toLocaleString()}</p>}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-2 text-sm text-dark-subtext">
        <div className="flex items-center justify-between rounded-xl border border-dark-border bg-dark-muted px-3 py-2">
          <span>Mint</span>
          <button type="button" onClick={() => void copyText(props.mint)} className="inline-flex items-center gap-1 font-mono text-xs text-dark-text">
            {shortenAddress(props.mint, 6)}
            <Copy size={12} />
          </button>
        </div>
        {props.txSignature && (
          <a href={`https://solscan.io/tx/${props.txSignature}`} target="_blank" rel="noreferrer" className="flex items-center justify-between rounded-xl border border-dark-border bg-dark-muted px-3 py-2">
            <span>Launch transaction</span>
            <span className="inline-flex items-center gap-1 text-dark-text">
              {shortenAddress(props.txSignature, 6)}
              <ExternalLink size={12} />
            </span>
          </a>
        )}
        {props.metadataUrl && (
          <a href={props.metadataUrl} target="_blank" rel="noreferrer" className="flex items-center justify-between rounded-xl border border-dark-border bg-dark-muted px-3 py-2">
            <span>Metadata</span>
            <span className="inline-flex items-center gap-1 text-dark-text">
              Open
              <ExternalLink size={12} />
            </span>
          </a>
        )}
      </div>

      <div className="mt-4 rounded-xl border border-dark-border bg-dark-muted px-3 py-3">
        <div className="text-xs font-semibold uppercase tracking-wide text-dark-faint">Tradability</div>
        <div className="mt-1 text-sm font-semibold text-dark-text">{props.tradableStatus ?? 'Checking route...'}</div>
        <div className="mt-1 text-xs text-dark-subtext">{props.tradableReason ?? 'Axyrion only enables swap CTAs when Jupiter reports a real route.'}</div>
      </div>
    </div>
  )
}


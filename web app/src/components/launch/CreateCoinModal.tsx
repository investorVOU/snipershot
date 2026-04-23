import { AlertTriangle, Check, ChevronRight, Copy, ExternalLink, Share2, Upload, Wallet, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { getLaunchProviderAdapters } from '../../lib/providers'
import { copyText } from '../../lib/utils/clipboard'
import { estimateLaunchSpend, launchProviderLabel, parseTagString, sanitizeSymbol, validateLaunchPayload, type LaunchFormErrors } from '../../lib/utils/launch'
import { useLaunchToken } from '../../hooks/useLaunchToken'
import { ProviderBadge } from './ProviderBadge'
import type { FeedToken, LaunchPayload, LaunchProvider, LaunchWalletContext, NormalizedLaunchResult } from '../../types'

interface Props {
  visible: boolean
  walletConnected: boolean
  walletAddress: string | null
  launchContext: LaunchWalletContext | null
  onClose: () => void
  onLaunched: (token: FeedToken, result: NormalizedLaunchResult) => void
  onViewToken?: (mint: string) => void
  onOpenSwap?: (mint: string) => void
}

type Step = 'provider' | 'form' | 'review' | 'success'

const initialPayload: LaunchPayload = {
  provider: 'pumpfun',
  name: '',
  symbol: '',
  description: '',
  totalSupply: 1_000_000_000,
  decimals: 6,
  imageFile: null,
  imagePreviewUrl: '',
  socials: {
    twitterUrl: '',
    telegramUrl: '',
    websiteUrl: '',
    discordUrl: '',
  },
  creatorNote: '',
  tags: [],
  category: '',
  initialBuy: {
    enabled: false,
    amount: 0,
    denomination: 'SOL',
  },
  providerConfig: {},
}

export function CreateCoinModal({ visible, walletConnected, walletAddress, launchContext, onClose, onLaunched, onViewToken, onOpenSwap }: Props) {
  const adapters = getLaunchProviderAdapters()
  const [step, setStep] = useState<Step>('provider')
  const [payload, setPayload] = useState<LaunchPayload>(initialPayload)
  const [tagInput, setTagInput] = useState('')
  const [errors, setErrors] = useState<LaunchFormErrors>({})
  const { launch, stage, message, error, result, reset } = useLaunchToken()

  useEffect(() => {
    if (!visible) return
    setStep('provider')
    setPayload(initialPayload)
    setTagInput('')
    setErrors({})
    reset()
  }, [visible, reset])

  const selectedAdapter = useMemo(() => adapters.find((adapter) => adapter.provider === payload.provider) ?? adapters[0], [adapters, payload.provider])
  const estimatedSpend = estimateLaunchSpend(payload.initialBuy.enabled, payload.initialBuy.amount)

  if (!visible) return null

  const handleValidateAndContinue = () => {
    const nextPayload = { ...payload, tags: parseTagString(tagInput), symbol: sanitizeSymbol(payload.symbol) }
    setPayload(nextPayload)
    const nextErrors = validateLaunchPayload(nextPayload, walletConnected)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length === 0) setStep('review')
  }

  const handleSubmit = async () => {
    if (!launchContext) {
      setErrors({ wallet: 'Connect your wallet to launch.' })
      return
    }
    const nextPayload = { ...payload, tags: parseTagString(tagInput), symbol: sanitizeSymbol(payload.symbol) }
    setPayload(nextPayload)
    const nextErrors = validateLaunchPayload(nextPayload, walletConnected)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    const launched = await launch(nextPayload, launchContext)
    onLaunched(launched.feedToken, launched.result)
    setStep('success')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center" onClick={onClose}>
      <div className="w-full max-w-2xl rounded-[32px] border border-dark-border bg-[#0d131c] shadow-[0_30px_80px_rgba(0,0,0,0.45)]" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between border-b border-dark-border px-5 py-4">
          <div>
            <h2 className="text-xl font-semibold text-dark-text">Create Coin</h2>
            <p className="text-sm text-dark-subtext">
              {step === 'provider' ? 'Choose where to launch your token' : step === 'review' ? 'Review before signing' : 'Configure launch metadata and initial buy'}
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-dark-subtext transition-colors hover:text-dark-text">
            <X size={18} />
          </button>
        </div>

        <div className="max-h-[80vh] overflow-y-auto px-5 py-4">
          {step === 'provider' && (
            <div className="grid gap-3 sm:grid-cols-2">
              {adapters.map((adapter) => (
                <button
                  key={adapter.provider}
                  type="button"
                  onClick={() => {
                    setPayload((prev) => ({ ...prev, provider: adapter.provider }))
                    setStep('form')
                  }}
                  className="rounded-[28px] border border-dark-border bg-dark-card p-4 text-left transition-colors hover:bg-[#131c27]"
                >
                  <div className="flex items-center justify-between">
                    <ProviderBadge provider={adapter.provider} />
                    <ChevronRight size={16} className="text-dark-subtext" />
                  </div>
                  <div className="mt-4 text-lg font-semibold text-dark-text">{adapter.label}</div>
                  <p className="mt-2 text-sm leading-relaxed text-dark-subtext">{adapter.description}</p>
                  <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-dark-faint">{adapter.note}</p>
                </button>
              ))}
            </div>
          )}

          {step === 'form' && (
            <div className="flex flex-col gap-4">
              <div className="rounded-[24px] border border-dark-border bg-dark-card p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold text-dark-text">{launchProviderLabel(payload.provider)}</div>
                    <div className="text-xs text-dark-subtext">{selectedAdapter.note}</div>
                  </div>
                  <button type="button" onClick={() => setStep('provider')} className="text-xs font-semibold text-dark-subtext hover:text-dark-text">Change</button>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Token name" error={errors.name}>
                  <input className="input" value={payload.name} onChange={(event) => setPayload((prev) => ({ ...prev, name: event.target.value }))} placeholder="Axyrion Alpha" />
                </Field>
                <Field label="Token symbol" error={errors.symbol}>
                  <input className="input uppercase" value={payload.symbol} onChange={(event) => setPayload((prev) => ({ ...prev, symbol: sanitizeSymbol(event.target.value) }))} placeholder="AXR" />
                </Field>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Total supply" error={errors.totalSupply}>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    className="input"
                    value={payload.totalSupply || ''}
                    onChange={(event) => setPayload((prev) => ({ ...prev, totalSupply: Number(event.target.value) || 0 }))}
                    placeholder="1000000000"
                  />
                </Field>
                <Field label="Decimals" error={errors.decimals}>
                  <input
                    type="number"
                    min="0"
                    max="9"
                    step="1"
                    className="input"
                    value={payload.decimals}
                    onChange={(event) => setPayload((prev) => ({ ...prev, decimals: Number(event.target.value) || 0 }))}
                    placeholder="6"
                  />
                </Field>
              </div>

              <div className="rounded-2xl border border-yellow-400/30 bg-yellow-400/10 px-3 py-2 text-sm text-yellow-400">
                Bags and Pump launch routes are real, but their current public create flows do not document custom supply or decimals inputs. Axyrion will store your requested values in metadata and launch history, while the live provider route may still use provider defaults.
              </div>

              <Field label="Description" error={errors.description}>
                <textarea className="input min-h-[110px] resize-none py-3" value={payload.description} onChange={(event) => setPayload((prev) => ({ ...prev, description: event.target.value }))} placeholder="Describe the token, narrative, and what users should know." />
              </Field>

              <Field label="Token image" error={errors.imageFile}>
                <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-dashed border-dark-border bg-dark-card px-4 py-4 text-sm text-dark-subtext">
                  <Upload size={16} />
                  <span className="flex-1">{payload.imageFile ? payload.imageFile.name : 'Upload PNG, JPG, or WEBP up to 5MB'}</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0] ?? null
                      setPayload((prev) => ({
                        ...prev,
                        imageFile: file,
                        imagePreviewUrl: file ? URL.createObjectURL(file) : '',
                      }))
                    }}
                  />
                </label>
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="X / Twitter" error={errors.socials?.twitterUrl}>
                  <input className="input" value={payload.socials.twitterUrl} onChange={(event) => setPayload((prev) => ({ ...prev, socials: { ...prev.socials, twitterUrl: event.target.value } }))} placeholder="https://x.com/..." />
                </Field>
                <Field label="Telegram" error={errors.socials?.telegramUrl}>
                  <input className="input" value={payload.socials.telegramUrl} onChange={(event) => setPayload((prev) => ({ ...prev, socials: { ...prev.socials, telegramUrl: event.target.value } }))} placeholder="https://t.me/..." />
                </Field>
                <Field label="Website" error={errors.socials?.websiteUrl}>
                  <input className="input" value={payload.socials.websiteUrl} onChange={(event) => setPayload((prev) => ({ ...prev, socials: { ...prev.socials, websiteUrl: event.target.value } }))} placeholder="https://example.com" />
                </Field>
                <Field label="Discord" error={errors.socials?.discordUrl}>
                  <input className="input" value={payload.socials.discordUrl} onChange={(event) => setPayload((prev) => ({ ...prev, socials: { ...prev.socials, discordUrl: event.target.value } }))} placeholder="https://discord.gg/..." />
                </Field>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Creator note">
                  <input className="input" value={payload.creatorNote} onChange={(event) => setPayload((prev) => ({ ...prev, creatorNote: event.target.value }))} placeholder="Optional note for holders" />
                </Field>
                <Field label="Launch tags / category">
                  <input className="input" value={tagInput} onChange={(event) => setTagInput(event.target.value)} placeholder="ai, trading, culture" />
                </Field>
              </div>

              <div className="rounded-[24px] border border-dark-border bg-dark-card p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold text-dark-text">Buy at launch</div>
                    <div className="text-xs text-dark-subtext">Optional creator initial buy submitted in the launch flow when supported.</div>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={payload.initialBuy.enabled}
                    onClick={() => setPayload((prev) => ({ ...prev, initialBuy: { ...prev.initialBuy, enabled: !prev.initialBuy.enabled } }))}
                    className={`relative inline-flex h-7 w-12 items-center rounded-full border transition-colors ${payload.initialBuy.enabled ? 'border-[#14f19555] bg-[#14f19522]' : 'border-dark-border bg-dark-muted'}`}
                  >
                    <span
                      className={`inline-block h-5 w-5 rounded-full transition-transform ${payload.initialBuy.enabled ? 'translate-x-6 bg-[#14f195]' : 'translate-x-1 bg-dark-faint'}`}
                    />
                    <span className="sr-only">Toggle buy at launch</span>
                  </button>
                </div>
                {payload.initialBuy.enabled && (
                  <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_140px]">
                    <Field label="Initial buy amount" error={errors.initialBuyAmount}>
                      <input type="number" min="0" step="any" className="input" value={payload.initialBuy.amount || ''} onChange={(event) => setPayload((prev) => ({ ...prev, initialBuy: { ...prev.initialBuy, amount: Number(event.target.value) || 0 } }))} placeholder="0.25" />
                    </Field>
                    <Field label="Denomination">
                      <div className="input flex items-center text-sm font-semibold text-dark-text">SOL</div>
                    </Field>
                  </div>
                )}
              </div>

              {!selectedAdapter.supportsInitialBuy && payload.initialBuy.enabled && (
                <div className="rounded-2xl border border-yellow-400/30 bg-yellow-400/10 px-3 py-2 text-sm text-yellow-400">This provider does not support initial buy in the current adapter.</div>
              )}
              {errors.wallet && <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">{errors.wallet}</div>}
            </div>
          )}

          {step === 'review' && (
            <div className="flex flex-col gap-4">
              <div className="rounded-[24px] border border-dark-border bg-dark-card p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ProviderBadge provider={payload.provider} />
                    <span className="text-sm font-semibold text-dark-text">{payload.name} (${payload.symbol})</span>
                  </div>
                  <div className="inline-flex items-center gap-2 text-xs text-dark-subtext">
                    <Wallet size={14} />
                    {walletAddress ?? 'Wallet required'}
                  </div>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-[96px_1fr]">
                  <div className="h-24 w-24 overflow-hidden rounded-2xl bg-dark-muted">
                    {payload.imagePreviewUrl && <img src={payload.imagePreviewUrl} alt={payload.name} className="h-full w-full object-cover" />}
                  </div>
                  <div className="space-y-2 text-sm text-dark-subtext">
                    <p>{payload.description}</p>
                    <p>Requested token config: {payload.totalSupply.toLocaleString()} supply · {payload.decimals} decimals</p>
                    <p>Initial buy: {payload.initialBuy.enabled ? `${payload.initialBuy.amount} ${payload.initialBuy.denomination}` : 'Disabled'}</p>
                    <p>Estimated spend: {estimatedSpend} SOL</p>
                    <p>Metadata preview will be uploaded to Axyrion-managed Supabase storage before provider submission.</p>
                    <p>Provider note: current public Bags / Pump launch routes may apply provider defaults for token decimals and supply.</p>
                  </div>
                </div>
              </div>

              <div className="rounded-[24px] border border-dark-border bg-dark-card p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-dark-faint">Wallet confirmation reminder</div>
                <p className="mt-2 text-sm text-dark-subtext">Axyrion never custodies funds. The launch and optional initial buy must be signed by your connected wallet. Launch success, initial buy success, and tradability are tracked separately.</p>
              </div>

              {(message || error) && (
                <div className={`rounded-2xl border px-3 py-3 text-sm ${error ? 'border-red-500/30 bg-red-500/10 text-red-300' : 'border-dark-border bg-dark-card text-dark-subtext'}`}>
                  {error ?? message}
                </div>
              )}
            </div>
          )}

          {step === 'success' && result && (
            <div className="flex flex-col gap-4">
              <div className={`rounded-[24px] border p-4 ${result.status === 'partial' ? 'border-yellow-400/30 bg-yellow-400/10' : 'border-[#14f19530] bg-[#14f19510]'}`}>
                <div className="flex items-center gap-2 text-sm font-semibold text-dark-text">
                  {result.status === 'partial' ? <AlertTriangle size={16} className="text-yellow-400" /> : <Check size={16} className="text-[#14f195]" />}
                  {result.status === 'partial' ? 'Token created, initial buy incomplete' : 'Launch confirmed'}
                </div>
                <p className="mt-2 text-sm text-dark-subtext">
                  Mint {result.mintAddress}
                </p>
                <p className="mt-1 text-xs text-dark-subtext">
                  Initial buy status: {result.initialBuyStatus === 'confirmed' ? 'Confirmed' : result.initialBuyStatus === 'failed' ? 'Failed' : 'Not requested'}
                </p>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <button type="button" onClick={() => onViewToken?.(result.mintAddress)} className="rounded-2xl border border-dark-border bg-dark-card px-4 py-3 text-sm font-semibold text-dark-text">
                  View token
                </button>
                {onOpenSwap && (
                  <button type="button" onClick={() => onOpenSwap(result.mintAddress)} className="rounded-2xl border border-dark-border bg-dark-card px-4 py-3 text-sm font-semibold text-dark-text">
                    Swap token
                  </button>
                )}
                <button type="button" onClick={() => void copyText(result.mintAddress)} className="rounded-2xl border border-dark-border bg-dark-card px-4 py-3 text-sm font-semibold text-dark-text">
                  <span className="inline-flex items-center gap-2"><Copy size={14} /> Copy mint</span>
                </button>
                <a href={result.explorerUrl} target="_blank" rel="noreferrer" className="rounded-2xl border border-dark-border bg-dark-card px-4 py-3 text-sm font-semibold text-dark-text">
                  <span className="inline-flex items-center gap-2"><ExternalLink size={14} /> View transaction</span>
                </a>
                <button
                  type="button"
                  onClick={async () => {
                    if (navigator.share) {
                      await navigator.share({ title: `${result.tokenName} (${result.symbol})`, text: result.mintAddress, url: `${window.location.origin}/token/${result.mintAddress}` })
                    } else {
                      await copyText(`${window.location.origin}/token/${result.mintAddress}`)
                    }
                  }}
                  className="rounded-2xl border border-dark-border bg-dark-card px-4 py-3 text-sm font-semibold text-dark-text"
                >
                  <span className="inline-flex items-center gap-2"><Share2 size={14} /> Share</span>
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-dark-border px-5 py-4">
          <div className="text-xs text-dark-faint">
            {step === 'review' ? `Provider ${launchProviderLabel(payload.provider)} · estimated spend ${estimatedSpend} SOL` : 'Axyrion stores canonical metadata for every launched token.'}
          </div>
          <div className="flex items-center gap-2">
            {step === 'form' && <button type="button" onClick={() => setStep('provider')} className="rounded-xl border border-dark-border px-4 py-2 text-sm font-semibold text-dark-subtext">Back</button>}
            {step === 'form' && <button type="button" onClick={handleValidateAndContinue} className="rounded-xl bg-brand px-4 py-2 text-sm font-bold text-[#08110d]">Review</button>}
            {step === 'review' && <button type="button" onClick={() => setStep('form')} className="rounded-xl border border-dark-border px-4 py-2 text-sm font-semibold text-dark-subtext">Edit</button>}
            {step === 'review' && <button type="button" onClick={() => void handleSubmit()} className="rounded-xl bg-brand px-4 py-2 text-sm font-bold text-[#08110d]">Launch token</button>}
            {step === 'success' && <button type="button" onClick={onClose} className="rounded-xl bg-brand px-4 py-2 text-sm font-bold text-[#08110d]">Done</button>}
          </div>
        </div>
      </div>
    </div>
  )
}

function Field({ label, error, children }: { label: string; error?: string; children: import('react').ReactNode }) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-sm font-semibold text-dark-text">{label}</span>
      {children}
      {error && <span className="text-xs text-red-300">{error}</span>}
    </label>
  )
}

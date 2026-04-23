import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, ShieldCheck, Wallet } from 'lucide-react'

const STEPS = [
  {
    id: 'discover',
    label: 'Discover',
    title: 'Catch fresh Solana launches faster.',
    body: 'Scan new tokens, open details quickly, and move from discovery to decision without extra noise.',
    points: ['Live launch feed', 'Fast token drill-down'],
    accent: '#14f195',
    eyebrow: 'Live launch feed',
  },
  {
    id: 'filter',
    label: 'Filter',
    title: 'Reject weak setups earlier.',
    body: 'Liquidity, holder concentration, wallet behavior, and AI signals are surfaced before entry.',
    points: ['Risk context upfront', 'Cleaner go or no-go reads'],
    accent: '#9945ff',
    eyebrow: 'Risk context upfront',
  },
  {
    id: 'trade',
    label: 'Trade',
    title: 'Research and execution stay together.',
    body: 'Use the same app flow to fund, buy, sell, send, and manage positions on this device.',
    points: ['Built-in wallet flow', 'One place for entry and management'],
    accent: '#6ea8ff',
    eyebrow: 'Built-in wallet flow',
  },
  {
    id: 'wallet',
    label: 'Wallet',
    title: 'The wallet model is clearly stated.',
    body: 'This build stores the generated wallet key locally in your browser on this device. We do not keep a separate wallet passphrase on our servers.',
    points: ['Stored locally', 'Export before clearing browser storage'],
    accent: '#ffb84d',
    eyebrow: 'Stored locally on this device',
  },
] as const

export function OnboardingFlowPage({ onComplete }: { onComplete: () => void }) {
  const navigate = useNavigate()
  const [index, setIndex] = useState(0)
  const step = STEPS[index]
  const isFirst = index === 0
  const isLast = index === STEPS.length - 1

  const finish = () => {
    onComplete()
    navigate('/', { replace: true })
  }

  const next = () => {
    if (isLast) finish()
    else setIndex((current) => current + 1)
  }

  const previous = () => {
    if (!isFirst) setIndex((current) => current - 1)
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(20,241,149,0.08),_transparent_24%),linear-gradient(145deg,_#080b11_0%,_#0b1017_48%,_#111823_100%)] px-3 py-3 sm:px-4 sm:py-4">
      <div className="mx-auto flex min-h-[calc(100vh-1.5rem)] max-w-5xl flex-col rounded-[28px] bg-[linear-gradient(180deg,_rgba(255,255,255,0.03),_rgba(255,255,255,0.015))] p-4 shadow-[0_28px_90px_rgba(0,0,0,0.4)] sm:min-h-[calc(100vh-2rem)] sm:p-5 lg:p-6">
        <div className="flex items-center justify-end">
          <button onClick={finish} className="text-sm font-medium text-[#7e8a97] transition-colors hover:text-[#e9eef3]">
            Skip
          </button>
        </div>

        <div className="mt-4 flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          {STEPS.map((item, itemIndex) => {
            const active = itemIndex === index
            return (
              <button
                key={item.id}
                onClick={() => setIndex(itemIndex)}
                className="flex-shrink-0 rounded-full px-3 py-2 text-xs font-semibold transition-colors"
                style={{
                  backgroundColor: active ? `${item.accent}1f` : 'rgba(255,255,255,0.04)',
                  color: active ? item.accent : '#a4afba',
                }}
              >
                {item.label}
              </button>
            )
          })}
        </div>

        <div className="mt-4 grid flex-1 gap-4 lg:grid-cols-[minmax(0,1fr)_270px] lg:gap-5">
          <section className="flex min-h-0 flex-col rounded-[24px] bg-[#0d131b]/90 p-4 sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h1 className="max-w-[15ch] text-[26px] font-semibold leading-[1.05] text-[#f4f7fb] sm:text-[32px] lg:text-[38px]">
                  {step.title}
                </h1>
                <p className="mt-3 max-w-[58ch] text-[13px] leading-6 text-[#99a5b2] sm:text-sm">
                  {step.body}
                </p>
              </div>
              <div
                className="hidden h-9 min-w-9 rounded-2xl sm:block"
                style={{ background: `linear-gradient(180deg, ${step.accent} 0%, rgba(255,255,255,0.24) 100%)`, opacity: 0.9 }}
              />
            </div>

            <div className="fade-in mt-4" key={step.id}>
              <div
                className="flex min-h-[150px] flex-col justify-between rounded-[24px] p-5 sm:min-h-[185px] sm:p-6"
                style={{
                  background: `radial-gradient(circle at top left, ${step.accent}20 0%, transparent 30%), linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.02) 100%)`,
                }}
              >
                <div className="flex items-center gap-3">
                  <div className="h-px w-14" style={{ backgroundColor: step.accent }} />
                  <div className="text-[10px] font-semibold uppercase tracking-[0.24em]" style={{ color: step.accent }}>
                    {step.eyebrow}
                  </div>
                </div>

                <div className="max-w-[26rem]">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#8d98a6]">
                    {step.label}
                  </div>
                  <p className="mt-2 text-sm leading-6 text-[#d6dde5]">
                    {step.points[0]}
                    {step.points[1] ? `  •  ${step.points[1]}` : ''}
                  </p>
                </div>
              </div>
            </div>
          </section>

          <aside className="flex flex-col gap-3">
            <div className="rounded-[24px] bg-white/[0.03] p-4">
              <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#6f7d8b]">
                What you get
              </div>
              <div className="mt-3 grid gap-3">
                {step.points.map((point) => (
                  <div key={point} className="flex items-start gap-3">
                    {step.id === 'wallet' ? (
                      <ShieldCheck size={14} className="mt-1 flex-shrink-0" style={{ color: step.accent }} />
                    ) : step.id === 'trade' ? (
                      <Wallet size={14} className="mt-1 flex-shrink-0" style={{ color: step.accent }} />
                    ) : (
                      <div className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full" style={{ backgroundColor: step.accent }} />
                    )}
                    <p className="text-sm leading-5 text-[#d6dde5]">{point}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[24px] bg-white/[0.03] p-4">
              <div className="flex items-center gap-2">
                {STEPS.map((item, itemIndex) => (
                  <button
                    key={item.id}
                    onClick={() => setIndex(itemIndex)}
                    aria-label={`Go to ${item.label}`}
                    className="h-2 rounded-full transition-all duration-300"
                    style={{
                      width: itemIndex === index ? 28 : 8,
                      backgroundColor: itemIndex === index ? item.accent : '#2a3440',
                    }}
                  />
                ))}
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2">
                <button
                  onClick={previous}
                  disabled={isFirst}
                  className="flex items-center justify-center gap-2 rounded-[16px] bg-white/[0.05] px-4 py-3 text-sm font-medium text-[#eef2f6] disabled:cursor-not-allowed disabled:opacity-35"
                >
                  <ArrowLeft size={15} />
                  Back
                </button>
                <button
                  onClick={next}
                  className="flex items-center justify-center gap-2 rounded-[16px] px-4 py-3 text-sm font-semibold text-[#08110d]"
                  style={{ backgroundColor: step.accent }}
                >
                  {isLast ? 'Enter app' : 'Next'}
                  <ArrowRight size={15} />
                </button>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}

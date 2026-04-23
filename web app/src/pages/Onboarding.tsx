import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ChevronRight, ShieldCheck, Wallet, Zap } from 'lucide-react'

const ONBOARDING_KEY = 'snipershot_onboarding_done'

const SLIDES = [
  {
    num: '01',
    accent: '#14f195',
    eyebrow: 'Launch feed',
    title: 'Catch new launches before the crowd settles in',
    body: 'Monitor fresh Solana pairs in one view, open details fast, and move from discovery to decision without bouncing between tabs.',
    points: ['Fresh launches stream live', 'Fast drill-down into token context', 'Built around quick sniper entry checks'],
    Illus: IllusSnipe,
  },
  {
    num: '02',
    accent: '#9945ff',
    eyebrow: 'Risk filter',
    title: 'Kill weak setups early',
    body: 'Read liquidity, holder concentration, wallet behavior, and AI-assisted screening before you commit capital.',
    points: ['Safety labels before entry', 'Holder and wallet context inline', 'Cleaner go or no-go decisions'],
    Illus: IllusShield,
  },
  {
    num: '03',
    accent: '#27c985',
    eyebrow: 'Execution',
    title: 'Trade from the same flow you used to research',
    body: 'Sign in, get a local device wallet, fund it, then buy, sell, send, and manage positions without switching tools.',
    points: ['Wallet is generated on this device', 'Fund it with SOL or supported SPL tokens', 'Use one flow for entry and management'],
    Illus: IllusAuto,
  },
  {
    num: '04',
    accent: '#ffb84d',
    eyebrow: 'Wallet model',
    title: 'Wallet behavior is explicit, not hidden',
    body: 'This build stores the generated wallet key locally in your browser on this device. We do not keep a separate wallet password or passphrase for you on our servers.',
    points: ['Not stored on our backend', 'Local browser storage powers signing', 'Clearing browser storage before export can remove access'],
    Illus: IllusWallet,
  },
] as const

function IllusSnipe() {
  return (
    <svg width="180" height="124" viewBox="0 0 200 140" fill="none">
      <circle cx="100" cy="70" r="50" stroke="#14f19530" strokeWidth="1.5" />
      <circle cx="100" cy="70" r="35" stroke="#14f19540" strokeWidth="1.5" />
      <circle cx="100" cy="70" r="20" stroke="#14f195" strokeWidth="2" />
      <circle cx="100" cy="70" r="5" fill="#14f195" />
      <line x1="100" y1="20" x2="100" y2="50" stroke="#14f19580" strokeWidth="1.5" />
      <line x1="100" y1="90" x2="100" y2="120" stroke="#14f19580" strokeWidth="1.5" />
      <line x1="50" y1="70" x2="80" y2="70" stroke="#14f19580" strokeWidth="1.5" />
      <line x1="120" y1="70" x2="150" y2="70" stroke="#14f19580" strokeWidth="1.5" />
      <rect x="20" y="80" width="6" height="30" rx="1" fill="#ef4444" />
      <rect x="34" y="60" width="6" height="50" rx="1" fill="#14f195" />
      <rect x="48" y="50" width="6" height="60" rx="1" fill="#14f195" />
      <rect x="160" y="70" width="6" height="40" rx="1" fill="#14f195" />
      <rect x="174" y="55" width="6" height="55" rx="1" fill="#14f195" />
    </svg>
  )
}

function IllusShield() {
  return (
    <svg width="180" height="124" viewBox="0 0 200 140" fill="none">
      <path d="M100 15 L150 35 L150 80 Q150 115 100 130 Q50 115 50 80 L50 35 Z" fill="#9945ff15" stroke="#9945ff60" strokeWidth="1.5" />
      <path d="M100 30 L135 46 L135 80 Q135 108 100 118 Q65 108 65 80 L65 46 Z" fill="#9945ff10" stroke="#9945ff40" strokeWidth="1" />
      <path d="M82 72 L95 85 L120 58" stroke="#9945ff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="30" cy="30" r="5" fill="#9945ff40" />
      <circle cx="170" cy="30" r="5" fill="#9945ff40" />
      <circle cx="30" cy="110" r="5" fill="#9945ff40" />
      <circle cx="170" cy="110" r="5" fill="#9945ff40" />
      <line x1="30" y1="30" x2="50" y2="35" stroke="#9945ff30" strokeWidth="1" />
      <line x1="170" y1="30" x2="150" y2="35" stroke="#9945ff30" strokeWidth="1" />
    </svg>
  )
}

function IllusAuto() {
  return (
    <svg width="180" height="124" viewBox="0 0 200 140" fill="none">
      <polyline points="20,110 50,90 75,95 100,60 125,45 150,30 180,20" fill="none" stroke="#27c985" strokeWidth="2" strokeLinejoin="round" />
      <polygon points="20,110 50,90 75,95 100,60 125,45 150,30 180,20 180,130 20,130" fill="#27c98515" />
      <line x1="20" y1="35" x2="180" y2="35" stroke="#14f19560" strokeWidth="1" strokeDasharray="4 3" />
      <text x="22" y="32" fill="#14f195" fontSize="9" fontWeight="600">TP</text>
      <line x1="20" y1="105" x2="180" y2="105" stroke="#ef444460" strokeWidth="1" strokeDasharray="4 3" />
      <text x="22" y="118" fill="#ef4444" fontSize="9" fontWeight="600">SL</text>
      <circle cx="180" cy="20" r="5" fill="#27c985" />
      <circle cx="180" cy="20" r="10" fill="#27c98530" />
    </svg>
  )
}

function IllusWallet() {
  return (
    <svg width="180" height="124" viewBox="0 0 200 140" fill="none">
      <rect x="42" y="26" width="116" height="82" rx="18" fill="#ffb84d12" stroke="#ffb84d66" strokeWidth="1.5" />
      <rect x="54" y="42" width="92" height="18" rx="9" fill="#ffb84d20" />
      <circle cx="70" cy="51" r="4" fill="#ffb84d" />
      <rect x="80" y="48" width="42" height="6" rx="3" fill="#ffe1ac" />
      <path d="M74 92 C74 78 83 68 100 68 C117 68 126 78 126 92" stroke="#ffb84d" strokeWidth="5" strokeLinecap="round" />
      <rect x="84" y="90" width="32" height="22" rx="8" fill="#ffb84d" />
      <circle cx="100" cy="100" r="4" fill="#1b1406" />
      <path d="M24 58 L42 58" stroke="#ffb84d55" strokeWidth="2" strokeLinecap="round" />
      <path d="M158 58 L176 58" stroke="#ffb84d55" strokeWidth="2" strokeLinecap="round" />
      <path d="M32 96 L47 89" stroke="#ffb84d40" strokeWidth="2" strokeLinecap="round" />
      <path d="M168 89 L153 96" stroke="#ffb84d40" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

export function OnboardingPage() {
  const navigate = useNavigate()
  const [index, setIndex] = useState(0)
  const slide = SLIDES[index]
  const isLast = index === SLIDES.length - 1

  const finish = () => {
    localStorage.setItem(ONBOARDING_KEY, 'true')
    navigate('/', { replace: true })
  }

  const next = () => {
    if (isLast) finish()
    else setIndex((current) => current + 1)
  }

  const previous = () => {
    setIndex((current) => Math.max(0, current - 1))
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(20,241,149,0.12),_transparent_22%),radial-gradient(circle_at_bottom_right,_rgba(255,184,77,0.1),_transparent_28%),linear-gradient(180deg,_#090d14_0%,_#0a0f16_100%)] px-4 py-4 sm:px-5 sm:py-5">
      <div className="mx-auto flex min-h-[calc(100vh-2rem)] max-w-6xl flex-col rounded-[28px] bg-[linear-gradient(180deg,_rgba(255,255,255,0.03),_rgba(255,255,255,0.015))] p-4 shadow-[0_28px_90px_rgba(0,0,0,0.34)] backdrop-blur sm:min-h-[calc(100vh-2.5rem)] sm:p-5 lg:grid lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-6 lg:rounded-[32px] lg:p-6">
        <aside className="hidden lg:flex lg:flex-col lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-white/[0.05] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#90a0b1]">
              <Zap size={12} className="text-brand" />
              Sniper Shot
            </div>
            <h1 className="mt-5 max-w-[12ch] text-[34px] font-extrabold leading-[1.02] text-dark-text">
              Faster research.
              <br />
              Cleaner entry.
            </h1>
            <p className="mt-3 max-w-[28ch] text-sm leading-6 text-[#8f9aa7]">
              The onboarding is now a compact briefing. Pick a step, skim the key point, move on.
            </p>
          </div>

          <div className="space-y-2">
            {SLIDES.map((item, itemIndex) => {
              const active = itemIndex === index
              return (
                <button
                  key={item.num}
                  onClick={() => setIndex(itemIndex)}
                  className="flex w-full items-start gap-3 rounded-2xl px-3 py-3 text-left transition-colors hover:bg-white/[0.04]"
                  style={{ backgroundColor: active ? 'rgba(255,255,255,0.06)' : 'transparent' }}
                >
                  <span className="mt-0.5 text-xs font-bold tracking-[0.22em]" style={{ color: active ? item.accent : '#627082' }}>
                    {item.num}
                  </span>
                  <div className="min-w-0">
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[#627082]">{item.eyebrow}</div>
                    <div className="mt-1 text-sm font-semibold leading-5 text-dark-text">{item.title}</div>
                  </div>
                </button>
              )
            })}
          </div>
        </aside>

        <section className="flex min-h-0 flex-1 flex-col">
          <div className="flex items-center justify-between gap-3">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/[0.05] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#90a0b1] lg:hidden">
              <Zap size={12} className="text-brand" />
              Sniper Shot
            </div>
            <button onClick={finish} className="text-sm font-semibold text-[#728091] transition-colors hover:text-dark-text">
              Skip
            </button>
          </div>

          <div className="mt-4 grid gap-4 lg:mt-2 lg:grid-cols-[minmax(0,1.1fr)_320px] lg:gap-5">
            <div className="rounded-[24px] bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.06),_transparent_58%)] p-4 sm:p-5 lg:p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#667384]">{slide.eyebrow}</div>
                  <div className="mt-2 flex items-center gap-3">
                    <span className="text-3xl font-extrabold sm:text-[40px]" style={{ color: `${slide.accent}4d` }}>
                      {slide.num}
                    </span>
                    <div className="h-px w-10" style={{ backgroundColor: slide.accent }} />
                  </div>
                </div>
                <div className="hidden h-10 w-10 items-center justify-center rounded-2xl sm:flex" style={{ backgroundColor: `${slide.accent}14`, color: slide.accent }}>
                  {slide.num === '04' ? <ShieldCheck size={18} /> : slide.num === '03' ? <Wallet size={18} /> : <Zap size={18} />}
                </div>
              </div>

              <div className="fade-in mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_230px]" key={index}>
                <div className="min-w-0">
                  <h2 className="max-w-[16ch] text-[28px] font-extrabold leading-[1.04] text-dark-text sm:text-[34px]">
                    {slide.title}
                  </h2>
                  <p className="mt-3 max-w-[60ch] text-sm leading-6 text-[#9aa5b3] sm:text-[15px] sm:leading-7">
                    {slide.body}
                  </p>
                </div>

                <div
                  className="flex h-[140px] items-center justify-center rounded-[22px] sm:h-[168px] lg:h-full"
                  style={{ background: `linear-gradient(180deg, ${slide.accent}12 0%, rgba(255,255,255,0.02) 100%)` }}
                >
                  <slide.Illus />
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3 rounded-[24px] bg-white/[0.03] p-4 sm:p-5">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-dark-text">What matters here</div>
                <div className="text-xs font-semibold text-[#6f7d8d]">
                  {index + 1}/{SLIDES.length}
                </div>
              </div>

              <div className="grid gap-2">
                {slide.points.map((point) => (
                  <div key={point} className="flex items-start gap-3 rounded-2xl bg-white/[0.035] px-3.5 py-3 text-sm leading-5 text-[#d7dee5]">
                    {slide.num === '04' ? (
                      <ShieldCheck size={15} style={{ color: slide.accent }} className="mt-0.5 flex-shrink-0" />
                    ) : slide.num === '03' ? (
                      <Wallet size={15} style={{ color: slide.accent }} className="mt-0.5 flex-shrink-0" />
                    ) : (
                      <div className="mt-[7px] h-2 w-2 flex-shrink-0 rounded-full" style={{ backgroundColor: slide.accent }} />
                    )}
                    <span>{point}</span>
                  </div>
                ))}
              </div>

              {slide.num === '04' && (
                <p className="text-xs leading-5 text-[#7f8a98]">
                  This note reflects the wallet implementation in the current build.
                </p>
              )}

              <div className="mt-1 flex items-center gap-2">
                {SLIDES.map((item, itemIndex) => (
                  <button
                    key={item.num}
                    onClick={() => setIndex(itemIndex)}
                    aria-label={`Go to step ${itemIndex + 1}`}
                    className="h-2 rounded-full transition-all duration-300"
                    style={{
                      width: itemIndex === index ? 26 : 8,
                      backgroundColor: itemIndex === index ? item.accent : '#27313d',
                    }}
                  />
                ))}
              </div>

              <div className="mt-auto flex flex-col gap-2 sm:flex-row">
                <button
                  onClick={previous}
                  disabled={index === 0}
                  className="flex items-center justify-center gap-2 rounded-2xl bg-white/[0.05] px-4 py-3 text-sm font-semibold text-dark-text transition-colors disabled:cursor-not-allowed disabled:opacity-35"
                >
                  <ArrowLeft size={16} />
                  Back
                </button>
                <button
                  onClick={next}
                  className="flex flex-1 items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-bold"
                  style={{ backgroundColor: slide.accent, color: '#08110d' }}
                >
                  {isLast ? 'Continue to App' : 'Next'}
                  <ChevronRight size={17} />
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}

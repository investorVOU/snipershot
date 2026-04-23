import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, ShieldCheck, Wallet, Zap } from 'lucide-react'

const ONBOARDING_KEY = 'snipershot_onboarding_done'

const SLIDES = [
  {
    num: '01',
    accent: '#14f195',
    title: 'Scan launches\nin real time',
    body: 'Track fresh Solana tokens the moment they appear, inspect the chart, and move from discovery to execution without hopping between tools.',
    points: ['Live feed for new launches', 'Fast token detail drill-down', 'Built for sniper-style execution'],
    Illus: IllusSnipe,
  },
  {
    num: '02',
    accent: '#9945ff',
    title: 'Filter out obvious\nbad setups',
    body: 'Use on-chain checks, liquidity signals, holder context, and AI-assisted screening to separate safer launches from obvious rugs and weak entries.',
    points: ['Safety labels before entry', 'Wallet and holder context', 'Faster go / no-go decisions'],
    Illus: IllusShield,
  },
  {
    num: '03',
    accent: '#27c985',
    title: 'Trade from one\nbuilt-in flow',
    body: 'Sign in, get a generated Solana wallet for this device, fund it, then buy, sell, send, and manage positions inside the app.',
    points: ['Account wallet is generated on this device', 'Fund it with SOL or supported SPL tokens', 'Use the same flow for sniping and management'],
    Illus: IllusAuto,
  },
  {
    num: '04',
    accent: '#ffb84d',
    title: 'Wallet safety,\nclearly explained',
    body: 'We do not store a separate wallet password or passphrase for you. The current app build generates a wallet in your browser and stores the private key locally on that device so it can sign transactions and let you export it later.',
    points: ['Not stored on our server', 'Stored locally in this browser', 'If browser storage is cleared before export, access can be lost'],
    Illus: IllusWallet,
  },
] as const

function IllusSnipe() {
  return (
    <svg width="200" height="140" viewBox="0 0 200 140" fill="none">
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
    <svg width="200" height="140" viewBox="0 0 200 140" fill="none">
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
    <svg width="200" height="140" viewBox="0 0 200 140" fill="none">
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
    <svg width="200" height="140" viewBox="0 0 200 140" fill="none">
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
    else setIndex((i) => i + 1)
  }

  return (
    <div className="min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(20,241,149,0.08),_transparent_22%),radial-gradient(circle_at_bottom_right,_rgba(255,184,77,0.08),_transparent_28%),linear-gradient(180deg,_#090d14_0%,_#0a0f16_100%)] px-4 py-4 sm:px-5 sm:py-6 lg:px-8 lg:py-8">
      <div className="mx-auto flex min-h-[calc(100vh-2rem)] max-w-7xl flex-col gap-5 lg:min-h-[calc(100vh-4rem)] lg:flex-row lg:items-stretch lg:gap-8">
        <section className="hidden lg:flex lg:w-[min(40%,460px)] lg:flex-col lg:justify-between lg:rounded-[36px] lg:border lg:border-white/6 lg:bg-white/[0.03] lg:p-8 lg:shadow-[0_30px_80px_rgba(0,0,0,0.28)]">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/8 bg-white/4 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8e9aa8]">
              <Zap size={12} className="text-brand" />
              Sniper Shot
            </div>
            <div className="space-y-4">
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#637081]">Solana Launch Intelligence</p>
              <h1 className="max-w-sm text-5xl font-extrabold leading-[1.02] text-dark-text">
                Research fast.
                <br />
                Trade faster.
              </h1>
              <p className="max-w-md text-base leading-7 text-[#98a3b1]">
                A sniper workflow for finding launches, filtering risk, and executing from the same interface without hiding how the wallet model actually works.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {SLIDES.map((item, i) => (
              <button
                key={item.num}
                onClick={() => setIndex(i)}
                className={`flex w-full items-start gap-4 rounded-2xl border px-4 py-4 text-left transition-colors ${
                  i === index
                    ? 'border-white/10 bg-white/[0.05]'
                    : 'border-white/5 bg-transparent hover:border-white/8 hover:bg-white/[0.025]'
                }`}
              >
                <span className="text-2xl font-extrabold" style={{ color: item.accent + '80' }}>{item.num}</span>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-dark-text">{item.title.replace('\n', ' ')}</div>
                  <div className="mt-1 text-sm leading-6 text-[#8290a0]">{item.body}</div>
                </div>
              </button>
            ))}
          </div>
        </section>

        <section className="flex min-h-[calc(100vh-2rem)] flex-1 flex-col overflow-hidden rounded-[28px] border border-white/6 bg-[radial-gradient(circle_at_top,_rgba(20,241,149,0.12),_transparent_28%),radial-gradient(circle_at_bottom_right,_rgba(255,184,77,0.12),_transparent_34%),linear-gradient(180deg,_#0d131c_0%,_#090d14_100%)] shadow-[0_30px_80px_rgba(0,0,0,0.45)] sm:rounded-[32px] lg:min-h-full">
          <div className="flex w-full items-center justify-between px-5 pt-5 sm:px-6 sm:pt-6 lg:hidden">
            <div className="flex items-center gap-2 rounded-full border border-white/8 bg-white/4 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8e9aa8]">
              <Zap size={12} className="text-brand" />
              Sniper Shot
            </div>
            <button onClick={finish} className="text-[#627082] text-sm font-semibold hover:text-dark-subtext transition-colors">
              Skip
            </button>
          </div>

          <div className="flex flex-1 flex-col justify-between px-5 pb-5 pt-4 sm:px-6 sm:pb-6 lg:grid lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)] lg:gap-8 lg:px-8 lg:py-8">
            <div className="flex min-h-0 flex-col justify-center">
              <div className="fade-in flex w-full justify-center lg:justify-start" key={index}>
                <div
                  className="flex h-[180px] w-full items-center justify-center rounded-[24px] border border-white/6 bg-white/[0.03] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] sm:h-[220px] lg:h-[320px] lg:max-w-[620px] lg:rounded-[30px]"
                  style={{ boxShadow: `0 20px 60px ${slide.accent}12, inset 0 1px 0 rgba(255,255,255,0.04)` }}
                >
                  <slide.Illus />
                </div>
              </div>

              <div className="mt-6 w-full fade-in lg:mt-8" key={`text-${index}`}>
                <div className="mb-4 flex items-center gap-3">
                  <span className="text-4xl font-extrabold sm:text-5xl" style={{ color: slide.accent + '40' }}>{slide.num}</span>
                  <div className="h-0.5 w-12 rounded-full" style={{ backgroundColor: slide.accent }} />
                </div>
                <h2 className="mb-3 whitespace-pre-line text-[26px] font-extrabold leading-tight text-dark-text sm:text-[30px] lg:max-w-[12ch] lg:text-[42px]">
                  {slide.title}
                </h2>
                <p className="max-w-2xl text-[15px] leading-relaxed text-[#9ba6b3] sm:text-base sm:leading-7">
                  {slide.body}
                </p>
              </div>
            </div>

            <div className="mt-6 flex flex-col justify-between lg:mt-0">
              <div className="grid gap-2.5 sm:gap-3 lg:mt-auto">
                {slide.points.map((point) => (
                  <div key={point} className="flex items-center gap-3 rounded-2xl border border-white/6 bg-white/[0.035] px-3.5 py-3 text-sm text-[#dde3ea] sm:px-4 sm:py-3.5">
                    {slide.num === '04' ? (
                      <ShieldCheck size={16} style={{ color: slide.accent }} className="flex-shrink-0" />
                    ) : slide.num === '03' ? (
                      <Wallet size={16} style={{ color: slide.accent }} className="flex-shrink-0" />
                    ) : (
                      <div className="h-2 w-2 rounded-full flex-shrink-0" style={{ backgroundColor: slide.accent }} />
                    )}
                    <span>{point}</span>
                  </div>
                ))}
              </div>

              <div className="mt-6 flex flex-col gap-5">
                <div className="flex items-center gap-2 justify-center lg:justify-start">
                  {SLIDES.map((item, i) => (
                    <button
                      key={i}
                      onClick={() => setIndex(i)}
                      aria-label={`Go to slide ${i + 1}`}
                      className="rounded-full transition-all duration-300"
                      style={{
                        width: i === index ? 24 : 8,
                        height: 8,
                        backgroundColor: i === index ? item.accent : '#1f2937',
                      }}
                    />
                  ))}
                </div>

                <div className="flex items-center justify-between gap-3">
                  <button onClick={finish} className="hidden text-sm font-semibold text-[#627082] transition-colors hover:text-dark-subtext lg:inline-flex">
                    Skip Intro
                  </button>
                  <button
                    onClick={next}
                    className="w-full flex items-center justify-center gap-2 rounded-2xl py-4 text-[15px] font-bold transition-colors lg:w-auto lg:min-w-[220px] lg:px-8"
                    style={{ backgroundColor: slide.accent, color: '#08110d' }}
                  >
                    {isLast ? 'Continue to App' : 'Next'}
                    <ChevronRight size={18} />
                  </button>
                </div>

                {slide.num === '04' && (
                  <p className="text-center text-xs leading-relaxed text-[#7b8796] lg:text-left">
                    This wallet note reflects the current implementation in this app build.
                  </p>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'

const ONBOARDING_KEY = 'snipershot_onboarding_done'

const SLIDES = [
  {
    num: '01',
    accent: '#14f195',
    title: 'Catch every\nlaunch instantly',
    body: 'Real-time feed powered by PumpPortal WebSocket. Never miss a new token the moment it hits the chain.',
    Illus: IllusSnipe,
  },
  {
    num: '02',
    accent: '#9945ff',
    title: 'AI-powered\nrug detection',
    body: 'Every token is scored on-chain and rated by AI. Know if it\'s safe, suspicious, or a rug before you ape in.',
    Illus: IllusShield,
  },
  {
    num: '03',
    accent: '#27c985',
    title: 'One-tap\nsniping',
    body: 'Set your amount, slippage, and fire. Auto TP/SL protects your position while you sleep.',
    Illus: IllusAuto,
  },
]

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
      {/* Candles */}
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
      {/* Network nodes */}
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
      {/* TP line */}
      <line x1="20" y1="35" x2="180" y2="35" stroke="#14f19560" strokeWidth="1" strokeDasharray="4 3" />
      <text x="22" y="32" fill="#14f195" fontSize="9" fontWeight="600">TP</text>
      {/* SL line */}
      <line x1="20" y1="105" x2="180" y2="105" stroke="#ef444460" strokeWidth="1" strokeDasharray="4 3" />
      <text x="22" y="118" fill="#ef4444" fontSize="9" fontWeight="600">SL</text>
      {/* Current point */}
      <circle cx="180" cy="20" r="5" fill="#27c985" />
      <circle cx="180" cy="20" r="10" fill="#27c98530" />
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
    <div className="min-h-screen bg-[#0a0f16] flex flex-col items-center justify-between px-8 py-12 max-w-md mx-auto">
      {/* Skip */}
      <div className="w-full flex justify-end">
        <button onClick={finish} className="text-[#475261] text-sm font-semibold hover:text-dark-subtext transition-colors">
          Skip
        </button>
      </div>

      {/* Illustration */}
      <div className="flex flex-col items-center gap-8 flex-1 justify-center">
        <div className="fade-in" key={index}>
          <slide.Illus />
        </div>

        <div className="w-full fade-in" key={`text-${index}`}>
          <div className="flex items-center gap-3 mb-3">
            <span className="font-extrabold text-5xl" style={{ color: slide.accent + '40' }}>{slide.num}</span>
            <div className="h-0.5 w-12 rounded-full" style={{ backgroundColor: slide.accent }} />
          </div>
          <h2 className="text-dark-text font-extrabold text-[26px] leading-tight mb-3 whitespace-pre-line">
            {slide.title}
          </h2>
          <p className="text-[#7e8a99] text-[15px] leading-relaxed">{slide.body}</p>
        </div>
      </div>

      {/* Dots + CTA */}
      <div className="w-full flex flex-col gap-6">
        <div className="flex items-center gap-2 justify-center">
          {SLIDES.map((_, i) => (
            <button
              key={i}
              onClick={() => setIndex(i)}
              className="rounded-full transition-all duration-300"
              style={{
                width: i === index ? 24 : 8,
                height: 8,
                backgroundColor: i === index ? slide.accent : '#1f2937',
              }}
            />
          ))}
        </div>

        <button
          onClick={next}
          className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl font-bold text-[15px] transition-colors"
          style={{ backgroundColor: slide.accent, color: '#08110d' }}
        >
          {isLast ? 'Get Started' : 'Next'}
          <ChevronRight size={18} />
        </button>
      </div>
    </div>
  )
}

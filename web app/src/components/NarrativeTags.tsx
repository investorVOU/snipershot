import { useEffect, useState, useRef } from 'react'
import { groqChat } from '../services/groqChat'

interface NarrativeResult {
  narratives: string[]
  hype: 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME'
}

const cache = new Map<string, NarrativeResult>()

const HYPE_COLOR: Record<string, string> = {
  LOW: '#9090a0',
  MEDIUM: '#ffc107',
  HIGH: '#ff6b35',
  EXTREME: '#ef4444',
}

interface Props {
  mint: string
  name: string
  symbol: string
  description: string
}

export function NarrativeTags({ mint, name, symbol, description }: Props) {
  const [result, setResult] = useState<NarrativeResult | null>(cache.get(mint) ?? null)
  const ran = useRef(false)

  useEffect(() => {
    if (result || ran.current) return
    ran.current = true

    const prompt = `Analyze this Solana memecoin and return JSON only.
Token: ${name} ($${symbol})
Description: ${description || 'none'}

Return ONLY valid JSON: {"narratives":["tag1","tag2"],"hype":"LOW"|"MEDIUM"|"HIGH"|"EXTREME"}
Narratives should be 1-2 word labels like: AI, Gaming, Meme, DeFi, Dog, Cat, Pepe, etc. Max 3 tags.`

    groqChat([{ role: 'user', content: prompt }], 100)
      .then((raw) => {
        const match = raw.match(/\{[\s\S]*\}/)
        if (!match) return
        const parsed = JSON.parse(match[0]) as NarrativeResult
        if (parsed.narratives?.length) {
          cache.set(mint, parsed)
          setResult(parsed)
        }
      })
      .catch(() => { /* silent */ })
  }, [mint, name, symbol, description, result])

  if (!result || result.narratives.length === 0) return null

  const hypeColor = HYPE_COLOR[result.hype] ?? '#9090a0'

  return (
    <div className="flex flex-wrap gap-1">
      {result.narratives.slice(0, 3).map((tag) => (
        <span key={tag} className="px-1.5 py-0.5 rounded bg-[#9945ff22] text-[#9945ff] text-[10px] font-bold">
          {tag}
        </span>
      ))}
      <span
        className="px-1.5 py-0.5 rounded border text-[9px] font-extrabold tracking-wide"
        style={{ backgroundColor: hypeColor + '22', borderColor: hypeColor + '55', color: hypeColor }}
      >
        {result.hype} HYPE
      </span>
    </div>
  )
}

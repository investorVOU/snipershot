import { getApiBase } from "./api";

export interface GroqMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export async function groqChat(
  messages: GroqMessage[],
  maxTokens = 512,
  temperature = 0.7
): Promise<string> {
  const base = getApiBase();
  const models = ["llama-3.1-8b-instant", "llama-3.3-70b-versatile"];
  let lastError = "Unknown Groq proxy error";

  for (const model of models) {
    const res = await fetch(`${base}/api/groq/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages, model, max_tokens: maxTokens, temperature }),
    });

    if (!res.ok) {
      lastError = await res.text();
      if (res.status === 429) continue;
      throw new Error(`Groq proxy error: ${lastError}`);
    }

    const json = (await res.json()) as { choices: Array<{ message: { content: string } }> };
    return json.choices[0]?.message?.content ?? "";
  }

  throw new Error(`Groq proxy error: ${lastError}`);
}

export interface RugVerdictResult {
  verdict: "SAFE" | "CAUTION" | "AVOID";
  confidence: number;
  reason: string;
  signal: "BUY" | "WATCH" | "SKIP";
}

export async function getAIRugVerdict(token: {
  name: string;
  symbol: string;
  rugScore: number;
  mintAuthorityRevoked: boolean;
  freezeAuthorityRevoked: boolean;
  lpLocked: boolean;
  top10HolderPercent: number;
  creatorSoldAll: boolean;
  solInBondingCurve: number;
  usdMarketCap?: number;
}): Promise<RugVerdictResult> {
  const prompt = `You are an expert Solana memecoin analyst. Analyze this token and give a verdict.

Token: ${token.name} (${token.symbol})
Rug Score: ${token.rugScore}/100
Mint Authority Revoked: ${token.mintAuthorityRevoked}
Freeze Authority Revoked: ${token.freezeAuthorityRevoked}
LP Locked: ${token.lpLocked}
Top 10 Holders: ${token.top10HolderPercent.toFixed(1)}%
Creator Sold All: ${token.creatorSoldAll}
Bonding Curve SOL: ${token.solInBondingCurve.toFixed(4)}
Market Cap: ${token.usdMarketCap ? `$${token.usdMarketCap.toFixed(0)}` : "unknown"}

Respond ONLY with valid JSON in this exact format:
{
  "verdict": "SAFE" | "CAUTION" | "AVOID",
  "confidence": 0-100,
  "reason": "one sentence max",
  "signal": "BUY" | "WATCH" | "SKIP"
}`;

  try {
    const raw = await groqChat([{ role: "user", content: prompt }], 256, 0.3);
    return JSON.parse(raw.trim()) as RugVerdictResult;
  } catch {
    return {
      verdict: token.rugScore <= 20 ? "SAFE" : token.rugScore <= 50 ? "CAUTION" : "AVOID",
      confidence: 60,
      reason: "AI analysis unavailable",
      signal: token.rugScore <= 30 ? "WATCH" : "SKIP",
    };
  }
}

export interface AITokenRating {
  score: number;           // 0–100 composite AI score (higher = safer/better opportunity)
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  verdict: 'GEM' | 'WATCH' | 'RISKY' | 'RUG';
  signal: 'BUY' | 'HOLD' | 'SKIP' | 'SELL';
  confidence: number;      // 0–100
  reason: string;          // one sentence
  flags: string[];         // positive/negative flags e.g. ['Mint revoked', 'Low LP', 'Whale concentration']
}

export async function getAITokenRating(token: {
  name: string;
  symbol: string;
  description: string;
  rugScore: number;
  mintAuthorityRevoked: boolean;
  freezeAuthorityRevoked: boolean;
  lpLocked: boolean;
  top10HolderPercent: number;
  creatorSoldAll: boolean;
  solInBondingCurve: number;
  usdMarketCap?: number;
  liquidity?: number;
  volume24h?: number;
  holders?: number;
  priceChange1h?: number;
  narratives?: string[];
}): Promise<AITokenRating> {
  const prompt = `You are an expert Solana memecoin analyst. Rate this token comprehensively.

Token: ${token.name} (${token.symbol})
Description: ${token.description || 'none'}
${token.narratives?.length ? `Narratives: ${token.narratives.join(', ')}` : ''}

On-chain safety:
- Rug Score: ${token.rugScore}/100 (lower = safer)
- Mint Authority Revoked: ${token.mintAuthorityRevoked}
- Freeze Authority Revoked: ${token.freezeAuthorityRevoked}
- LP Locked: ${token.lpLocked}
- Top 10 Holders: ${token.top10HolderPercent.toFixed(1)}%
- Creator Sold All: ${token.creatorSoldAll}
- Bonding Curve SOL: ${token.solInBondingCurve.toFixed(4)}

Market data:
- Market Cap: ${token.usdMarketCap ? `$${token.usdMarketCap.toFixed(0)}` : 'unknown'}
- Liquidity: ${token.liquidity ? `$${token.liquidity.toFixed(0)}` : 'unknown'}
- Volume 24h: ${token.volume24h ? `$${token.volume24h.toFixed(0)}` : 'unknown'}
- Holders: ${token.holders ?? 'unknown'}
- 1h Price Change: ${token.priceChange1h != null ? `${token.priceChange1h.toFixed(2)}%` : 'unknown'}

Score the token 0-100 where:
- 80-100 = potential gem with strong fundamentals
- 60-79 = worth watching, some risk
- 40-59 = risky, significant red flags
- 20-39 = likely rug or scam
- 0-19 = confirmed rug signals

Respond ONLY with valid JSON:
{
  "score": 0-100,
  "grade": "A" | "B" | "C" | "D" | "F",
  "verdict": "GEM" | "WATCH" | "RISKY" | "RUG",
  "signal": "BUY" | "HOLD" | "SKIP" | "SELL",
  "confidence": 0-100,
  "reason": "one sentence max 15 words",
  "flags": ["up to 4 short flag strings"]
}`;

  try {
    const raw = await groqChat([{ role: 'user', content: prompt }], 300, 0.3);
    const json = JSON.parse(raw.trim()) as AITokenRating;
    return json;
  } catch {
    const score = Math.max(0, 100 - token.rugScore);
    return {
      score,
      grade: score >= 80 ? 'A' : score >= 60 ? 'B' : score >= 40 ? 'C' : score >= 20 ? 'D' : 'F',
      verdict: score >= 70 ? 'WATCH' : score >= 40 ? 'RISKY' : 'RUG',
      signal: score >= 70 ? 'HOLD' : 'SKIP',
      confidence: 50,
      reason: 'AI analysis unavailable, score estimated from rug filter',
      flags: [],
    };
  }
}

export interface NarrativeResult {
  narratives: string[];
  hype: "LOW" | "MEDIUM" | "HIGH" | "EXTREME";
  trendMatch: boolean;
  summary: string;
}

export async function detectNarrative(token: {
  name: string;
  symbol: string;
  description: string;
}): Promise<NarrativeResult> {
  const prompt = `You are a Solana memecoin meta analyst. Detect the narrative/theme of this token.

Name: ${token.name}
Symbol: ${token.symbol}
Description: ${token.description || "none"}

Current hot narratives: AI, memes, animals (dogs/cats/frogs), gaming, DeFi, RWA, moodeng, pepe variants, political, celebrity.

Respond ONLY with valid JSON:
{
  "narratives": ["max 3 string tags like 'AI', 'Dog Coin', 'Political'"],
  "hype": "LOW" | "MEDIUM" | "HIGH" | "EXTREME",
  "trendMatch": true | false,
  "summary": "10 words max"
}`;

  try {
    const raw = await groqChat([{ role: "user", content: prompt }], 200, 0.5);
    return JSON.parse(raw.trim()) as NarrativeResult;
  } catch {
    return { narratives: [], hype: "LOW", trendMatch: false, summary: "Could not analyze" };
  }
}

export interface PortfolioAdvice {
  overallHealth: "STRONG" | "NEUTRAL" | "WEAK";
  totalAdvice: string;
  positions: Array<{
    symbol: string;
    action: "HOLD" | "TAKE_PROFIT" | "CUT_LOSS" | "ADD_MORE";
    reason: string;
  }>;
}

export async function getPortfolioAdvice(positions: Array<{
  tokenSymbol: string;
  entryPrice: number;
  currentPrice: number;
  pnlPercent: number;
  costBasisSol: number;
}>): Promise<PortfolioAdvice> {
  if (positions.length === 0) {
    return {
      overallHealth: "NEUTRAL",
      totalAdvice: "No open positions. Scout the feed for opportunities.",
      positions: [],
    };
  }

  const posStr = positions
    .map((p) =>
      `${p.tokenSymbol}: entry $${p.entryPrice.toFixed(8)}, current $${p.currentPrice.toFixed(8)}, P&L ${p.pnlPercent >= 0 ? "+" : ""}${p.pnlPercent.toFixed(1)}%, cost ${p.costBasisSol.toFixed(4)} SOL`
    )
    .join("\n");

  const prompt = `You are an expert Solana memecoin portfolio manager. Analyze these positions and give advice.

Positions:
${posStr}

Respond ONLY with valid JSON:
{
  "overallHealth": "STRONG" | "NEUTRAL" | "WEAK",
  "totalAdvice": "2 sentences max",
  "positions": [
    { "symbol": "TOKEN", "action": "HOLD" | "TAKE_PROFIT" | "CUT_LOSS" | "ADD_MORE", "reason": "max 8 words" }
  ]
}`;

  try {
    const raw = await groqChat([{ role: "user", content: prompt }], 512, 0.4);
    return JSON.parse(raw.trim()) as PortfolioAdvice;
  } catch {
    return {
      overallHealth: "NEUTRAL",
      totalAdvice: "AI analysis unavailable. Monitor your positions closely.",
      positions: positions.map((p) => ({ symbol: p.tokenSymbol, action: "HOLD" as const, reason: "Unable to analyze" })),
    };
  }
}

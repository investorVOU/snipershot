import { useCallback, useRef, useState } from "react";
import {
  detectNarrative,
  getAIRugVerdict,
  getPortfolioAdvice,
  type NarrativeResult,
  type PortfolioAdvice,
  type RugVerdictResult,
} from "../services/groq";
import { aiQueue } from "../services/aiQueue";

export function useAIVerdict() {
  const cache = useRef<Map<string, RugVerdictResult>>(new Map());
  const [loading, setLoading] = useState(false);

  const analyze = useCallback(
    async (mint: string, token: Parameters<typeof getAIRugVerdict>[0]): Promise<RugVerdictResult | null> => {
      if (cache.current.has(mint)) return cache.current.get(mint)!;
      setLoading(true);
      try {
        const result = await aiQueue.enqueue(() => getAIRugVerdict(token));
        cache.current.set(mint, result);
        return result;
      } catch {
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { analyze, loading };
}

export function useNarrativeDetector() {
  const cache = useRef<Map<string, NarrativeResult>>(new Map());

  const detect = useCallback(
    async (mint: string, token: Parameters<typeof detectNarrative>[0]): Promise<NarrativeResult | null> => {
      if (cache.current.has(mint)) return cache.current.get(mint)!;
      try {
        const result = await aiQueue.enqueue(() => detectNarrative(token));
        cache.current.set(mint, result);
        return result;
      } catch {
        return null;
      }
    },
    []
  );

  return { detect };
}

export function usePortfolioAI() {
  const [advice, setAdvice] = useState<PortfolioAdvice | null>(null);
  const [loading, setLoading] = useState(false);

  const analyze = useCallback(async (positions: Parameters<typeof getPortfolioAdvice>[0]) => {
    setLoading(true);
    try {
      const result = await getPortfolioAdvice(positions);
      setAdvice(result);
      return result;
    } catch {
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { advice, loading, analyze };
}

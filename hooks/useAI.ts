import { useCallback, useRef, useState } from "react";
import {
  detectNarrative,
  getAIRugVerdict,
  getPortfolioAdvice,
  groqChat,
  type GroqMessage,
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

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

export function useTokenChat(tokenContext: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const historyRef = useRef<GroqMessage[]>([
    {
      role: "system",
      content: `You are an expert Solana memecoin analyst and trading assistant. You have access to data about a specific token. Answer questions about this token concisely and helpfully. Always remind users that memecoins are extremely high-risk.\n\nToken context:\n${tokenContext}`,
    },
  ]);

  const send = useCallback(async (userText: string) => {
    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: userText,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, userMsg]);
    historyRef.current.push({ role: "user", content: userText });

    setLoading(true);
    try {
      const reply = await groqChat(historyRef.current, 512, 0.7);
      historyRef.current.push({ role: "assistant", content: reply });
      const assistantMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: reply,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      const rawMessage = err instanceof Error ? err.message : "Unable to reach the AI chat proxy.";
      const message = /rate limit|429/i.test(rawMessage)
        ? "Groq is rate-limiting the current account. Try again in a moment."
        : rawMessage;
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: `Sorry, I couldn't process that. ${message}`,
          timestamp: Date.now(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setMessages([]);
    historyRef.current = [historyRef.current[0]];
  }, []);

  return { messages, loading, send, reset };
}

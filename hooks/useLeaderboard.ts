import { useState, useEffect, useCallback } from 'react';
import { getTrades, Trade } from '../services/tradeLogger';

export interface LeaderboardEntry {
  mint: string;
  tokenName: string;
  tokenSymbol: string;
  buySOL: number;
  sellSOL: number;
  pnlSOL: number;
  pnlPercent: number;
  closedAt: number;
}

function buildLeaderboard(trades: Trade[]): LeaderboardEntry[] {
  const buys = trades.filter((t) => t.type === 'buy');
  const sells = trades.filter((t) => t.type === 'sell');

  const entries: LeaderboardEntry[] = [];

  for (const sell of sells) {
    const buy = buys.find((b) => b.mint === sell.mint && b.timestamp < sell.timestamp);
    if (!buy) continue;

    const pnlSOL = sell.amountSOL - buy.amountSOL;
    const pnlPercent = buy.amountSOL > 0 ? (pnlSOL / buy.amountSOL) * 100 : 0;

    entries.push({
      mint: sell.mint,
      tokenName: sell.tokenName,
      tokenSymbol: sell.tokenSymbol,
      buySOL: buy.amountSOL,
      sellSOL: sell.amountSOL,
      pnlSOL,
      pnlPercent,
      closedAt: sell.timestamp,
    });
  }

  return entries.sort((a, b) => b.pnlPercent - a.pnlPercent);
}

export function useLeaderboard() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const trades = await getTrades();
      setEntries(buildLeaderboard(trades));
    } catch {
      setEntries([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const totalPnlSOL = entries.reduce((s, e) => s + e.pnlSOL, 0);
  const winRate = entries.length > 0
    ? (entries.filter((e) => e.pnlSOL > 0).length / entries.length) * 100
    : 0;

  return { entries, isLoading, totalPnlSOL, winRate, refresh: load };
}

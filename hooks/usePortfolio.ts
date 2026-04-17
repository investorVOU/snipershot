import { useState, useEffect, useCallback } from 'react';
import { getPositions, getTrades, Position, Trade } from '../services/tradeLogger';
import { fetchPrice } from '../services/birdeye';
import { lamportsToSol } from '../utils/format';

export interface EnrichedPosition extends Position {
  currentPriceSOL: number;
  unrealizedPnlSOL: number;
  unrealizedPnlPercent: number;
  isLoading: boolean;
}

export interface PortfolioSummary {
  totalInvestedSOL: number;
  totalCurrentValueSOL: number;
  totalPnlSOL: number;
  totalPnlPercent: number;
}

export function usePortfolio() {
  const [positions, setPositions] = useState<EnrichedPosition[]>([]);
  const [closedTrades, setClosedTrades] = useState<Trade[]>([]);
  const [summary, setSummary] = useState<PortfolioSummary>({
    totalInvestedSOL: 0,
    totalCurrentValueSOL: 0,
    totalPnlSOL: 0,
    totalPnlPercent: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  const loadPositions = useCallback(async () => {
    const [rawPositions, allTrades] = await Promise.all([getPositions(), getTrades()]);

    // Set initial state with loading indicators
    const initial: EnrichedPosition[] = rawPositions.map((p) => ({
      ...p,
      currentPriceSOL: p.entryPriceSOL,
      unrealizedPnlSOL: 0,
      unrealizedPnlPercent: 0,
      isLoading: true,
    }));
    setPositions(initial);

    // Filter closed trades (sells)
    const sells = allTrades.filter((t) => t.type === 'sell');
    setClosedTrades(sells);

    // Fetch current prices in parallel
    const enriched = await Promise.all(
      rawPositions.map(async (pos) => {
        try {
          const currentPrice = await fetchPrice(pos.mint);
          // Price from Birdeye is in USD; we need SOL price
          // For P&L, compare token amounts × prices
          const currentValueSOL = currentPrice > 0
            ? pos.amountTokens * currentPrice
            : pos.amountSOLSpent;
          const unrealizedPnlSOL = currentValueSOL - pos.amountSOLSpent;
          const unrealizedPnlPercent =
            pos.amountSOLSpent > 0
              ? (unrealizedPnlSOL / pos.amountSOLSpent) * 100
              : 0;

          return {
            ...pos,
            currentPriceSOL: currentPrice,
            unrealizedPnlSOL,
            unrealizedPnlPercent,
            isLoading: false,
          } as EnrichedPosition;
        } catch {
          return {
            ...pos,
            currentPriceSOL: pos.entryPriceSOL,
            unrealizedPnlSOL: 0,
            unrealizedPnlPercent: 0,
            isLoading: false,
          } as EnrichedPosition;
        }
      })
    );

    setPositions(enriched);

    // Compute portfolio summary
    const totalInvested = enriched.reduce((sum, p) => sum + p.amountSOLSpent, 0);
    const totalCurrent = enriched.reduce(
      (sum, p) => sum + p.amountSOLSpent + p.unrealizedPnlSOL,
      0
    );
    const totalPnl = totalCurrent - totalInvested;
    const totalPnlPct = totalInvested > 0 ? (totalPnl / totalInvested) * 100 : 0;

    setSummary({
      totalInvestedSOL: totalInvested,
      totalCurrentValueSOL: totalCurrent,
      totalPnlSOL: totalPnl,
      totalPnlPercent: totalPnlPct,
    });

    setIsLoading(false);
  }, []);

  useEffect(() => {
    loadPositions();
    // Refresh every 30s
    const interval = setInterval(loadPositions, 30_000);
    return () => clearInterval(interval);
  }, [loadPositions]);

  return {
    positions,
    closedTrades,
    summary,
    isLoading,
    refresh: loadPositions,
  };
}

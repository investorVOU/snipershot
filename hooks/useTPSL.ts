import { useCallback, useEffect, useRef } from 'react';
import { PublicKey, VersionedTransaction } from '@solana/web3.js';
import Toast from 'react-native-toast-message';
import { fetchPrice } from '../services/birdeye';
import { getPositions, closePosition, logTrade, generateTradeId } from '../services/tradeLogger';
import { executeSell } from '../services/jupiter';
import { lamportsToSol } from '../utils/format';
import { PLATFORM_FEE_BPS } from '../constants/programs';
import type { SniperConfig } from './useSniper';

const CHECK_INTERVAL_MS = 30_000;

export function useTPSL(
  config: SniperConfig,
  publicKey: PublicKey | null,
  signTransaction: ((tx: VersionedTransaction) => Promise<VersionedTransaction>) | null
) {
  const triggering = useRef<Set<string>>(new Set());

  const checkPositions = useCallback(async () => {
    if (!publicKey || !signTransaction) return;
    if (config.takeProfitPercent <= 0 && config.stopLossPercent <= 0) return;

    let positions;
    try {
      positions = await getPositions();
    } catch {
      return;
    }
    if (positions.length === 0) return;

    for (const pos of positions) {
      if (triggering.current.has(pos.mint)) continue;
      try {
        const price = await fetchPrice(pos.mint);
        if (price <= 0 || pos.entryPriceSOL <= 0) continue;

        const pnlPct = ((price - pos.entryPriceSOL) / pos.entryPriceSOL) * 100;
        const shouldTP = config.takeProfitPercent > 0 && pnlPct >= config.takeProfitPercent;
        const shouldSL = config.stopLossPercent > 0 && pnlPct <= -config.stopLossPercent;
        if (!shouldTP && !shouldSL) continue;

        triggering.current.add(pos.mint);
        const reason = shouldTP ? `TP +${pnlPct.toFixed(1)}%` : `SL ${pnlPct.toFixed(1)}%`;
        Toast.show({ type: 'info', text1: `Auto-sell: ${pos.tokenSymbol}`, text2: reason });

        try {
          const result = await executeSell(
            pos.mint,
            pos.amountTokens,
            config.slippageBps,
            publicKey,
            signTransaction,
            config.priorityMode
          );
          const solReceived = lamportsToSol(result.outputAmount);

          await logTrade({
            id: generateTradeId(),
            type: 'sell',
            mint: pos.mint,
            tokenName: pos.tokenName,
            tokenSymbol: pos.tokenSymbol,
            userPublicKey: publicKey.toBase58(),
            amountSOL: solReceived,
            amountTokens: pos.amountTokens,
            pricePerToken: pos.amountTokens > 0 ? result.outputAmount / pos.amountTokens : 0,
            txSig: result.txSig,
            timestamp: Date.now(),
            feeLamports: Math.floor(result.outputAmount * (PLATFORM_FEE_BPS / 10000)),
          });
          await closePosition(pos.mint);

          Toast.show({
            type: 'success',
            text1: `Sold ${pos.tokenSymbol} (${reason})`,
            text2: `Received ${solReceived.toFixed(4)} SOL`,
          });
        } catch (err) {
          Toast.show({
            type: 'error',
            text1: `Auto-sell failed: ${pos.tokenSymbol}`,
            text2: err instanceof Error ? err.message : 'Error',
          });
        } finally {
          triggering.current.delete(pos.mint);
        }
      } catch {
        // skip this position silently
      }
    }
  }, [config, publicKey, signTransaction]);

  useEffect(() => {
    if (!publicKey || !signTransaction) return;
    void checkPositions();
    const timer = setInterval(() => { void checkPositions(); }, CHECK_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [checkPositions, publicKey, signTransaction]);
}

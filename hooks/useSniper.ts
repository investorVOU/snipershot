import { useState, useCallback, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PublicKey, VersionedTransaction } from '@solana/web3.js';
import Toast from 'react-native-toast-message';
import { executeBuy, executeSell, getQuote } from '../services/jupiter';
import { sendJitoBundle } from '../services/jito';
import { buildSwapTransaction } from '../services/jupiter';
import {
  logTrade,
  logFeeEvent,
  openPosition,
  closePosition,
  generateTradeId,
} from '../services/tradeLogger';
import { NATIVE_MINT, PLATFORM_FEE_BPS } from '../constants/programs';
import { solToLamports, lamportsToSol } from '../utils/format';
import type { PriorityMode } from '../services/jupiter';

const CONFIG_KEY = 'snapshot_sniper_config';

export interface SniperConfig {
  solAmount: number;
  slippageBps: number;
  autoSnipe: boolean;
  autoSnipeThreshold: number;
  autoSnipeMinLP: number;
  takeProfitPercent: number;
  stopLossPercent: number;
  priorityMode: PriorityMode;
}

const DEFAULT_CONFIG: SniperConfig = {
  solAmount: 0.1,
  slippageBps: 1500, // 15%
  autoSnipe: false,
  autoSnipeThreshold: 30,
  autoSnipeMinLP: 2,
  takeProfitPercent: 100,
  stopLossPercent: 30,
  priorityMode: 'normal',
};

export function useSniper(
  publicKey: PublicKey | null,
  signTransaction: (tx: VersionedTransaction) => Promise<VersionedTransaction>
) {
  const [config, setConfig] = useState<SniperConfig>(DEFAULT_CONFIG);
  const [isBuying, setIsBuying] = useState(false);
  const [isSelling, setIsSelling] = useState(false);
  const [configLoaded, setConfigLoaded] = useState(false);

  // Load config from AsyncStorage on mount
  useEffect(() => {
    AsyncStorage.getItem(CONFIG_KEY)
      .then((raw) => {
        if (raw) {
          const saved = JSON.parse(raw) as Partial<SniperConfig>;
          setConfig({ ...DEFAULT_CONFIG, ...saved });
        }
      })
      .catch(() => {})
      .finally(() => setConfigLoaded(true));
  }, []);

  /** Persist config changes */
  const updateConfig = useCallback(async (updates: Partial<SniperConfig>) => {
    setConfig((prev) => {
      const next = { ...prev, ...updates };
      AsyncStorage.setItem(CONFIG_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  /** Buy a token */
  const buy = useCallback(
    async (
      mint: string,
      tokenName: string,
      tokenSymbol: string,
      imageUri: string,
      overrideSOL?: number,
      overrideSlippageBps?: number
    ): Promise<string | null> => {
      if (!publicKey) {
        Toast.show({ type: 'error', text1: 'Wallet not connected' });
        return null;
      }

      const solAmt = overrideSOL ?? config.solAmount;
      const lamports = solToLamports(solAmt);
      const slippage = overrideSlippageBps ?? config.slippageBps;

      setIsBuying(true);
      try {
        let txSig: string;
        let outputAmount: number;

        if (config.priorityMode === 'jito') {
          const quote = await getQuote(
            NATIVE_MINT.toBase58(),
            mint,
            lamports,
            slippage
          );
          const tx = await buildSwapTransaction(quote, publicKey, config.priorityMode);
          const result = await sendJitoBundle(tx, publicKey, signTransaction);
          txSig = result.txSig;
          outputAmount = parseInt(quote.outAmount, 10);
        } else {
          const result = await executeBuy(
            mint,
            lamports,
            slippage,
            publicKey,
            signTransaction,
            config.priorityMode
          );
          txSig = result.txSig;
          outputAmount = result.outputAmount;
        }

        const pricePerToken = outputAmount > 0 ? lamports / outputAmount : 0;
        const tradeId = generateTradeId();

        await logTrade({
          id: tradeId,
          type: 'buy',
          mint,
          tokenName,
          tokenSymbol,
          userPublicKey: publicKey.toBase58(),
          amountSOL: solAmt,
          amountTokens: outputAmount,
          pricePerToken,
          txSig,
          timestamp: Date.now(),
          feeLamports: Math.floor(lamports * (PLATFORM_FEE_BPS / 10000)),
        });

        await logFeeEvent({
          userPublicKey: publicKey.toBase58(),
          tokenMint: mint,
          feeLamports: Math.floor(lamports * (PLATFORM_FEE_BPS / 10000)),
          txSig,
        });

        await openPosition({
          mint,
          tokenName,
          tokenSymbol,
          imageUri,
          entryPriceSOL: pricePerToken,
          amountTokens: outputAmount,
          amountSOLSpent: solAmt,
          openedAt: Date.now(),
          tradeId,
        });

        Toast.show({
          type: 'success',
          text1: 'Sniped!',
          text2: `Bought ${tokenSymbol} for ${solAmt.toFixed(4)} SOL`,
        });

        return txSig;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        Toast.show({ type: 'error', text1: 'Buy failed', text2: msg });
        return null;
      } finally {
        setIsBuying(false);
      }
    },
    [publicKey, signTransaction, config]
  );

  /** Sell a token */
  const sell = useCallback(
    async (
      mint: string,
      tokenName: string,
      tokenSymbol: string,
      amountTokens: number
    ): Promise<string | null> => {
      if (!publicKey) {
        Toast.show({ type: 'error', text1: 'Wallet not connected' });
        return null;
      }

      setIsSelling(true);
      try {
        let txSig: string;
        let outputAmount: number;

        if (config.priorityMode === 'jito') {
          const quote = await getQuote(
            mint,
            NATIVE_MINT.toBase58(),
            amountTokens,
            config.slippageBps
          );
          const tx = await buildSwapTransaction(quote, publicKey, config.priorityMode);
          const result = await sendJitoBundle(tx, publicKey, signTransaction);
          txSig = result.txSig;
          outputAmount = parseInt(quote.outAmount, 10);
        } else {
          const result = await executeSell(
            mint,
            amountTokens,
            config.slippageBps,
            publicKey,
            signTransaction,
            config.priorityMode
          );
          txSig = result.txSig;
          outputAmount = result.outputAmount;
        }

        const solReceived = lamportsToSol(outputAmount);
        const tradeId = generateTradeId();

        await logTrade({
          id: tradeId,
          type: 'sell',
          mint,
          tokenName,
          tokenSymbol,
          userPublicKey: publicKey.toBase58(),
          amountSOL: solReceived,
          amountTokens,
          pricePerToken: amountTokens > 0 ? outputAmount / amountTokens : 0,
          txSig,
          timestamp: Date.now(),
          feeLamports: Math.floor(outputAmount * (PLATFORM_FEE_BPS / 10000)),
        });

        await logFeeEvent({
          userPublicKey: publicKey.toBase58(),
          tokenMint: mint,
          feeLamports: Math.floor(outputAmount * (PLATFORM_FEE_BPS / 10000)),
          txSig,
        });

        await closePosition(mint);

        Toast.show({
          type: 'success',
          text1: 'Sold!',
          text2: `Sold ${tokenSymbol} for ${solReceived.toFixed(4)} SOL`,
        });

        return txSig;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        Toast.show({ type: 'error', text1: 'Sell failed', text2: msg });
        return null;
      } finally {
        setIsSelling(false);
      }
    },
    [publicKey, signTransaction, config]
  );

  return {
    config,
    updateConfig,
    configLoaded,
    buy,
    sell,
    isBuying,
    isSelling,
  };
}

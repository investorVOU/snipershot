/**
 * Auto-sniper: called from the token feed when a new token is detected.
 * Checks the config + rug filter, then fires a buy if conditions are met.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PublicKey, VersionedTransaction } from '@solana/web3.js';
import { runRugFilter } from './rugFilter';
import { executeBuy } from './jupiter';
import { hapticSnipe } from './haptics';
import {
  logTrade,
  logFeeEvent,
  openPosition,
  generateTradeId,
} from './tradeLogger';
import { solToLamports, lamportsToSol } from '../utils/format';
import { PLATFORM_FEE_BPS } from '../constants/programs';
import type { PriorityMode } from './jupiter';
import type { PumpfunToken } from './pumpfun';

const CONFIG_KEY = 'snapshot_sniper_config';

interface SniperConfig {
  solAmount: number;
  slippageBps: number;
  autoSnipe: boolean;
  autoSnipeThreshold: number;
  autoSnipeMinLP: number;
  priorityMode: PriorityMode;
  takeProfitPercent: number;
  stopLossPercent: number;
}

export async function tryAutoSnipe(
  token: PumpfunToken,
  publicKey: PublicKey,
  signTransaction: (tx: VersionedTransaction) => Promise<VersionedTransaction>
): Promise<boolean> {
  const raw = await AsyncStorage.getItem(CONFIG_KEY);
  if (!raw) return false;

  const config: SniperConfig = JSON.parse(raw);

  // Check if auto-snipe is enabled
  if (!config.autoSnipe) return false;

  // Check min LP
  if (token.solInCurve < config.autoSnipeMinLP) return false;

  // Run rug filter
  const rugResult = await runRugFilter(token.mint, token.creatorAddress);
  if (rugResult.rugScore > config.autoSnipeThreshold) return false;

  // Execute buy
  try {
    const lamports = solToLamports(config.solAmount);
    const result = await executeBuy(
      token.mint,
      lamports,
      config.slippageBps,
      publicKey,
      signTransaction,
      config.priorityMode
    );

    const pricePerToken = result.outputAmount > 0 ? lamports / result.outputAmount : 0;
    const tradeId = generateTradeId();

    await logTrade({
      id: tradeId,
      type: 'buy',
      mint: token.mint,
      tokenName: token.name,
      tokenSymbol: token.symbol,
      userPublicKey: publicKey.toBase58(),
      amountSOL: config.solAmount,
      amountTokens: result.outputAmount,
      pricePerToken,
      txSig: result.txSig,
      timestamp: Date.now(),
      feeLamports: Math.floor(lamports * (PLATFORM_FEE_BPS / 10000)),
    });

    await logFeeEvent({
      userPublicKey: publicKey.toBase58(),
      tokenMint: token.mint,
      feeLamports: Math.floor(lamports * (PLATFORM_FEE_BPS / 10000)),
      txSig: result.txSig,
    });

    await openPosition({
      mint: token.mint,
      tokenName: token.name,
      tokenSymbol: token.symbol,
      imageUri: token.imageUri,
      entryPriceSOL: pricePerToken,
      amountTokens: result.outputAmount,
      amountSOLSpent: config.solAmount,
      openedAt: Date.now(),
      tradeId,
    });

    hapticSnipe();
    return true;
  } catch {
    return false;
  }
}

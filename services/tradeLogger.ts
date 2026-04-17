import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? ''
);

const TRADES_KEY = 'snapshot_trades';
const POSITIONS_KEY = 'snapshot_positions';

export type TradeType = 'buy' | 'sell';

export interface Trade {
  id: string;
  type: TradeType;
  mint: string;
  tokenName: string;
  tokenSymbol: string;
  userPublicKey: string;
  amountSOL: number;
  amountTokens: number;
  pricePerToken: number;
  txSig: string;
  timestamp: number;
  feeLamports: number;
}

export interface Position {
  mint: string;
  tokenName: string;
  tokenSymbol: string;
  imageUri: string;
  entryPriceSOL: number;
  amountTokens: number;
  amountSOLSpent: number;
  openedAt: number;
  tradeId: string;
}

/** Log a trade to AsyncStorage and Supabase */
export async function logTrade(trade: Trade): Promise<void> {
  // Save to local storage
  try {
    const raw = await AsyncStorage.getItem(TRADES_KEY);
    const trades: Trade[] = raw ? JSON.parse(raw) : [];
    trades.unshift(trade);
    // Keep last 500 trades
    const trimmed = trades.slice(0, 500);
    await AsyncStorage.setItem(TRADES_KEY, JSON.stringify(trimmed));
  } catch {
    // Local storage failure is non-fatal
  }

  // Log to Supabase (non-blocking — fire and forget)
  void Promise.resolve(
    supabase.from('trades').insert({
      id: trade.id,
      timestamp: new Date(trade.timestamp).toISOString(),
      user_pubkey: trade.userPublicKey,
      token_mint: trade.mint,
      token_name: trade.tokenName,
      token_symbol: trade.tokenSymbol,
      type: trade.type,
      amount_sol: trade.amountSOL,
      amount_tokens: trade.amountTokens,
      price_per_token: trade.pricePerToken,
      tx_sig: trade.txSig,
      fee_lamports: trade.feeLamports,
    })
  ).catch(() => {});
}

/** Log a fee event to Supabase */
export async function logFeeEvent(params: {
  userPublicKey: string;
  tokenMint: string;
  feeLamports: number;
  txSig: string;
}): Promise<void> {
  void (supabase
    .from('fee_events')
    .insert({
      timestamp: new Date().toISOString(),
      user_pubkey: params.userPublicKey,
      token_mint: params.tokenMint,
      fee_lamports: params.feeLamports,
      tx_sig: params.txSig,
    }) as unknown as Promise<void>);
}

/** Fetch all trades from local storage */
export async function getTrades(): Promise<Trade[]> {
  try {
    const raw = await AsyncStorage.getItem(TRADES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/** Open a position (add to positions list) */
export async function openPosition(position: Position): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(POSITIONS_KEY);
    const positions: Position[] = raw ? JSON.parse(raw) : [];
    // Remove any existing position for same mint
    const filtered = positions.filter((p) => p.mint !== position.mint);
    filtered.unshift(position);
    await AsyncStorage.setItem(POSITIONS_KEY, JSON.stringify(filtered));
  } catch {}
}

/** Close a position by mint */
export async function closePosition(mint: string): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(POSITIONS_KEY);
    const positions: Position[] = raw ? JSON.parse(raw) : [];
    const filtered = positions.filter((p) => p.mint !== mint);
    await AsyncStorage.setItem(POSITIONS_KEY, JSON.stringify(filtered));
  } catch {}
}

/** Get all open positions */
export async function getPositions(): Promise<Position[]> {
  try {
    const raw = await AsyncStorage.getItem(POSITIONS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/** Update token amount for a position (partial sell) */
export async function updatePositionAmount(mint: string, newAmount: number): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(POSITIONS_KEY);
    const positions: Position[] = raw ? JSON.parse(raw) : [];
    const updated = positions.map((p) =>
      p.mint === mint ? { ...p, amountTokens: newAmount } : p
    );
    await AsyncStorage.setItem(POSITIONS_KEY, JSON.stringify(updated));
  } catch {}
}

/** Generate a simple unique ID for trades */
export function generateTradeId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

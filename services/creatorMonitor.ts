import axios from 'axios';
import { HELIUS_RPC_URL, HELIUS_WS_URL } from '../constants/programs';
import { supabase } from './supabase';

export interface CreatorSellEvent {
  mint: string;
  creatorAddress: string;
  tokensSold: number;
  percentSold: number;
  txSig: string;
  timestamp: number;
  isDump: boolean; // true if sold > 50% in one tx
}

type SellCallback = (event: CreatorSellEvent) => void;

// Global map: mint → { ws subscription id, initial balance }
const watchedTokens = new Map<string, { creatorAddress: string; initialBalance: number; subId?: number }>();

let ws: WebSocket | null = null;
let wsReady = false;
const pendingSubscribes: string[] = [];
const callbacks = new Map<string, SellCallback[]>();

function getOrCreateWs(): WebSocket {
  if (ws && ws.readyState === WebSocket.OPEN) return ws;

  ws = new WebSocket(HELIUS_WS_URL);
  wsReady = false;

  ws.onopen = () => {
    wsReady = true;
    // Re-subscribe all pending
    pendingSubscribes.forEach((addr) => sendAccountSubscribe(addr));
    pendingSubscribes.length = 0;
  };

  ws.onmessage = async (event) => {
    try {
      const msg = JSON.parse(event.data as string);
      if (msg.method === 'accountNotification') {
        await handleAccountNotification(msg.params);
      }
    } catch {}
  };

  ws.onclose = () => {
    wsReady = false;
    // Reconnect after 5s
    setTimeout(() => {
      if (watchedTokens.size > 0) getOrCreateWs();
    }, 5000);
  };

  return ws;
}

function sendAccountSubscribe(creatorAddress: string) {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    pendingSubscribes.push(creatorAddress);
    return;
  }
  ws.send(JSON.stringify({
    jsonrpc: '2.0',
    id: Date.now(),
    method: 'accountSubscribe',
    params: [
      creatorAddress,
      { encoding: 'jsonParsed', commitment: 'confirmed' },
    ],
  }));
}

async function handleAccountNotification(params: { result?: { value?: { data?: { parsed?: { info?: { tokenAmount?: { uiAmount?: number } } } } } }; subscription?: number }) {
  // Find which token this subscription belongs to
  const subId = params.subscription;
  let mint: string | undefined;
  let creatorAddress: string | undefined;

  for (const [m, data] of watchedTokens.entries()) {
    if (data.subId === subId) {
      mint = m;
      creatorAddress = data.creatorAddress;
      break;
    }
  }
  if (!mint || !creatorAddress) return;

  const currentBalance = params.result?.value?.data?.parsed?.info?.tokenAmount?.uiAmount ?? 0;
  const info = watchedTokens.get(mint);
  if (!info) return;

  const { initialBalance } = info;
  if (initialBalance === 0) return;

  const tokensSold = Math.max(0, initialBalance - currentBalance);
  const percentSold = (tokensSold / initialBalance) * 100;

  if (percentSold < 5) return; // ignore tiny changes

  const event: CreatorSellEvent = {
    mint,
    creatorAddress,
    tokensSold,
    percentSold,
    txSig: '',
    timestamp: Date.now(),
    isDump: percentSold > 50,
  };

  // Update Supabase token record with rug flag
  if (event.isDump) {
    void supabase.from('tokens')
      .update({ creator_dumped: true, creator_dump_pct: percentSold, creator_dump_at: new Date().toISOString() })
      .eq('mint', mint)
      .catch(() => {});
  }

  // Fire all callbacks for this mint
  const cbs = callbacks.get(mint) ?? [];
  cbs.forEach((cb) => cb(event));
}

/** Get creator's current token balance via Helius */
async function getCreatorTokenBalance(creatorAddress: string, mint: string): Promise<number> {
  try {
    const { data } = await axios.post(HELIUS_RPC_URL, {
      jsonrpc: '2.0',
      id: 'creator-balance',
      method: 'getTokenAccountsByOwner',
      params: [creatorAddress, { mint }, { encoding: 'jsonParsed' }],
    });
    const accounts = data?.result?.value ?? [];
    return accounts[0]?.account?.data?.parsed?.info?.tokenAmount?.uiAmount ?? 0;
  } catch {
    return 0;
  }
}

/**
 * Start monitoring a creator wallet for token sells.
 * Returns an unsubscribe function.
 */
export async function watchCreatorWallet(
  mint: string,
  creatorAddress: string,
  onSell: SellCallback
): Promise<() => void> {
  if (!creatorAddress || creatorAddress.length < 32) return () => {};

  // Register callback
  const existing = callbacks.get(mint) ?? [];
  callbacks.set(mint, [...existing, onSell]);

  // Fetch initial balance
  if (!watchedTokens.has(mint)) {
    const initialBalance = await getCreatorTokenBalance(creatorAddress, mint);
    watchedTokens.set(mint, { creatorAddress, initialBalance });
    getOrCreateWs();
    sendAccountSubscribe(creatorAddress);
  }

  return () => {
    const cbs = callbacks.get(mint) ?? [];
    const filtered = cbs.filter((cb) => cb !== onSell);
    if (filtered.length === 0) {
      callbacks.delete(mint);
      watchedTokens.delete(mint);
    } else {
      callbacks.set(mint, filtered);
    }
  };
}

/** Check if a creator has recently dumped by polling balance */
export async function checkCreatorDump(
  mint: string,
  creatorAddress: string,
  initialBalance: number
): Promise<{ dumped: boolean; percentSold: number }> {
  if (!creatorAddress || initialBalance === 0) return { dumped: false, percentSold: 0 };
  const current = await getCreatorTokenBalance(creatorAddress, mint);
  const percentSold = Math.max(0, ((initialBalance - current) / initialBalance) * 100);
  return { dumped: percentSold > 50, percentSold };
}

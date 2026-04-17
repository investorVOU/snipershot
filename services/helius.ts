import axios from 'axios';
import { HELIUS_RPC_URL, HELIUS_WS_URL, PUMPFUN_PROGRAM_ID } from '../constants/programs';

export interface HeliusAssetMetadata {
  mint: string;
  name: string;
  symbol: string;
  imageUri: string;
  description: string;
  externalUrl: string;
  twitterUrl: string;
  telegramUrl: string;
  creatorAddress: string;
}

export interface TransactionEvent {
  signature: string;
  mint: string;
  creatorWallet: string;
  initialSolInCurve: number;
  timestamp: number;
}

type TransactionCallback = (event: TransactionEvent) => void;

/** Fetch asset metadata from Helius getAsset RPC */
export async function getAssetMetadata(mint: string): Promise<HeliusAssetMetadata | null> {
  try {
    const { data } = await axios.post(HELIUS_RPC_URL, {
      jsonrpc: '2.0',
      id: 'get-asset',
      method: 'getAsset',
      params: { id: mint },
    });

    const asset = data?.result;
    if (!asset) return null;

    const content = asset.content ?? {};
    const metadata = content.metadata ?? {};
    const links = content.links ?? {};
    const creators = asset.creators ?? [];

    const twitterUrl =
      links.external_url?.includes('twitter') || links.external_url?.includes('x.com')
        ? links.external_url
        : '';
    const telegramUrl = links.external_url?.includes('t.me') ? links.external_url : '';

    return {
      mint,
      name: metadata.name ?? 'Unknown',
      symbol: metadata.symbol ?? '???',
      imageUri: links.image ?? '',
      description: metadata.description ?? '',
      externalUrl: links.external_url ?? '',
      twitterUrl,
      telegramUrl,
      creatorAddress: creators[0]?.address ?? '',
    };
  } catch {
    return null;
  }
}

/** Fetch mint account info to check authorities */
export async function getMintInfo(mint: string): Promise<{
  mintAuthorityRevoked: boolean;
  freezeAuthorityRevoked: boolean;
} | null> {
  try {
    const { data } = await axios.post(HELIUS_RPC_URL, {
      jsonrpc: '2.0',
      id: 'get-mint',
      method: 'getAccountInfo',
      params: [
        mint,
        { encoding: 'jsonParsed' },
      ],
    });

    const info = data?.result?.value?.data?.parsed?.info;
    if (!info) return null;

    return {
      mintAuthorityRevoked: info.mintAuthority === null,
      freezeAuthorityRevoked: info.freezeAuthority === null,
    };
  } catch {
    return null;
  }
}

/** Get token accounts for a wallet (to check if creator still holds) */
export async function getTokenAccountBalance(
  walletAddress: string,
  mint: string
): Promise<number> {
  try {
    const { data } = await axios.post(HELIUS_RPC_URL, {
      jsonrpc: '2.0',
      id: 'get-token-accounts',
      method: 'getTokenAccountsByOwner',
      params: [
        walletAddress,
        { mint },
        { encoding: 'jsonParsed' },
      ],
    });

    const accounts = data?.result?.value ?? [];
    if (accounts.length === 0) return 0;

    const balance = accounts[0]?.account?.data?.parsed?.info?.tokenAmount?.uiAmount ?? 0;
    return balance;
  } catch {
    return 0;
  }
}

/** Parse a Pump.fun transaction to extract token info */
function parsePumpfunTransaction(txData: unknown): TransactionEvent | null {
  try {
    const tx = txData as Record<string, unknown>;
    const signature = tx.signature as string;
    const timestamp = ((tx.blockTime as number) ?? (Date.now() / 1000)) * 1000;

    // Look through account keys for a new mint
    const accountKeys: string[] = (tx as unknown as { transaction: { message: { accountKeys: string[] } } })
      .transaction?.message?.accountKeys ?? [];

    // Heuristic: the mint is usually the second non-program account in a Pump.fun create tx
    const mint = accountKeys[1] ?? '';
    const creatorWallet = accountKeys[0] ?? '';

    if (!mint || mint.length < 32) return null;

    return {
      signature,
      mint,
      creatorWallet,
      initialSolInCurve: 0,
      timestamp,
    };
  } catch {
    return null;
  }
}

/** Subscribe to new Pump.fun transactions via Helius WebSocket */
export function subscribePumpfunTransactions(
  onTransaction: TransactionCallback,
  onError?: (err: Error) => void
): () => void {
  let ws: WebSocket | null = null;
  let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  let closed = false;
  let pingInterval: ReturnType<typeof setInterval> | null = null;

  function connect() {
    if (closed) return;

    ws = new WebSocket(HELIUS_WS_URL);

    ws.onopen = () => {
      // Subscribe to transactions involving Pump.fun program
      ws!.send(
        JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'transactionSubscribe',
          params: [
            {
              accountInclude: [PUMPFUN_PROGRAM_ID.toBase58()],
              failed: false,
              commitment: 'confirmed',
            },
            {
              encoding: 'jsonParsed',
              transactionDetails: 'full',
              maxSupportedTransactionVersion: 0,
            },
          ],
        })
      );

      // Keep-alive ping
      pingInterval = setInterval(() => {
        if (ws?.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ jsonrpc: '2.0', id: 999, method: 'ping' }));
        }
      }, 30_000);
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data as string);
        if (msg.method === 'transactionNotification') {
          const txData = msg.params?.result?.transaction;
          if (txData) {
            const parsed = parsePumpfunTransaction(txData);
            if (parsed) onTransaction(parsed);
          }
        }
      } catch {
        // ignore parse errors
      }
    };

    ws.onerror = (err) => {
      onError?.(new Error(`WebSocket error: ${String(err)}`));
    };

    ws.onclose = () => {
      if (pingInterval) clearInterval(pingInterval);
      if (!closed) {
        reconnectTimeout = setTimeout(connect, 3000);
      }
    };
  }

  connect();

  return () => {
    closed = true;
    if (pingInterval) clearInterval(pingInterval);
    if (reconnectTimeout) clearTimeout(reconnectTimeout);
    ws?.close();
  };
}

/** Send a raw transaction via Helius RPC */
export async function sendRawTransactionHelius(
  serializedTx: Buffer
): Promise<string> {
  const { data } = await axios.post(HELIUS_RPC_URL, {
    jsonrpc: '2.0',
    id: 'send-tx',
    method: 'sendTransaction',
    params: [
      Buffer.from(serializedTx).toString('base64'),
      { encoding: 'base64', skipPreflight: false, preflightCommitment: 'confirmed' },
    ],
  });

  if (data.error) throw new Error(data.error.message);
  return data.result as string;
}

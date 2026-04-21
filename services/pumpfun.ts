import axios from 'axios';
import { PUMPFUN_API } from '../constants/programs';
import { toHttpUrl } from '../utils/format';

export interface PumpfunToken {
  mint: string;
  name: string;
  symbol: string;
  imageUri: string;
  description: string;
  creatorAddress: string;
  createdTimestamp: number;
  marketCap: number;
  usdMarketCap: number;
  solInCurve: number;
  complete: boolean;
  twitterUrl: string;
  telegramUrl: string;
  websiteUrl: string;
  totalSupply: number;
}

interface PumpfunApiCoin {
  mint: string;
  name: string;
  symbol: string;
  image_uri: string;
  description: string;
  creator: string;
  created_timestamp: number;
  market_cap: number;
  usd_market_cap: number;
  virtual_sol_reserves: number;
  complete: boolean;
  twitter: string;
  telegram: string;
  website: string;
  total_supply: number;
}

interface PumpPortalEvent {
  signature: string;
  mint: string;
  traderPublicKey: string;
  txType: string;
  name: string;
  symbol: string;
  uri: string;
  marketCapSol: number;
  vSolInBondingCurve: number;
  tokenTotalSupply: number;
}

const PUMPPORTAL_WS = 'wss://pumpportal.fun/api/data';

const IPFS_GATEWAYS = [
  'https://ipfs.io/ipfs/',
  'https://cloudflare-ipfs.com/ipfs/',
  'https://gateway.pinata.cloud/ipfs/',
];

function resolveUri(uri: string): string[] {
  if (!uri) return [];
  if (uri.startsWith('ipfs://')) {
    const hash = uri.slice(7);
    return IPFS_GATEWAYS.map((gw) => `${gw}${hash}`);
  }
  const ipfsMatch = uri.match(/\/ipfs\/(Qm\w{40,}|bafy\w+)/);
  if (ipfsMatch) {
    return [uri, ...IPFS_GATEWAYS.map((gw) => `${gw}${ipfsMatch[1]}`)];
  }
  return [uri];
}

function mapCoin(coin: PumpfunApiCoin): PumpfunToken {
  return {
    mint: coin.mint,
    name: coin.name ?? 'Unknown',
    symbol: coin.symbol ?? '???',
    imageUri: toHttpUrl(coin.image_uri ?? ''),
    description: coin.description ?? '',
    creatorAddress: coin.creator ?? '',
    createdTimestamp: coin.created_timestamp * 1000,
    marketCap: coin.market_cap ?? 0,
    usdMarketCap: coin.usd_market_cap ?? 0,
    solInCurve: (coin.virtual_sol_reserves ?? 0) / 1_000_000_000,
    complete: coin.complete ?? false,
    twitterUrl: coin.twitter ?? '',
    telegramUrl: coin.telegram ?? '',
    websiteUrl: coin.website ?? '',
    totalSupply: coin.total_supply ?? 1_000_000_000,
  };
}

/** Fetch a single token from Pump.fun by mint (fallback lookup) */
export async function fetchTokenByMint(mint: string): Promise<PumpfunToken | null> {
  try {
    const { data } = await axios.get<PumpfunApiCoin>(
      `${PUMPFUN_API}/coins/${mint}`,
      { timeout: 5000 }
    );
    return data ? mapCoin(data) : null;
  } catch {
    return null;
  }
}

interface MetaResult {
  imageUri: string;
  description: string;
  twitterUrl: string;
  telegramUrl: string;
  websiteUrl: string;
}

const EMPTY_META: MetaResult = {
  imageUri: '', description: '', twitterUrl: '', telegramUrl: '', websiteUrl: '',
};

async function fetchMetaFromUri(url: string): Promise<MetaResult | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    const json = await res.json() as Record<string, string>;
    const imageUri = toHttpUrl(json.image ?? json.imageUri ?? json.logo ?? '');
    if (!imageUri && !json.description) return null;
    return {
      imageUri,
      description: json.description ?? '',
      twitterUrl: json.twitter ?? json.twitterUrl ?? '',
      telegramUrl: json.telegram ?? json.telegramUrl ?? '',
      websiteUrl: json.website ?? json.websiteUrl ?? json.external_url ?? '',
    };
  } catch {
    return null;
  }
}

async function resolveMetadata(mint: string, uri: string): Promise<MetaResult> {
  // Try all resolved URIs in order
  const urls = resolveUri(uri);
  for (const url of urls) {
    const result = await fetchMetaFromUri(url);
    if (result) return result;
  }

  // Fallback: pump.fun REST API
  try {
    const coin = await fetchTokenByMint(mint);
    if (coin) {
      return {
        imageUri: coin.imageUri,
        description: coin.description,
        twitterUrl: coin.twitterUrl,
        telegramUrl: coin.telegramUrl,
        websiteUrl: coin.websiteUrl,
      };
    }
  } catch {
    // ignore
  }

  return EMPTY_META;
}

/**
 * Subscribe to new token launches via PumpPortal WebSocket.
 * Resolves token image/socials from on-chain metadata URI with IPFS fallback.
 */
export function subscribePumpPortal(
  onToken: (token: PumpfunToken) => void,
  onDisconnect?: () => void
): () => void {
  let ws: WebSocket | null = null;
  let closed = false;
  let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;

  function connect() {
    if (closed) return;
    ws = new WebSocket(PUMPPORTAL_WS);

    ws.onopen = () => {
      ws!.send(JSON.stringify({ method: 'subscribeNewToken' }));
    };

    ws.onmessage = async (event) => {
      try {
        const msg = JSON.parse(event.data as string) as PumpPortalEvent;
        if (msg.txType !== 'create' || !msg.mint) return;

        const meta = await resolveMetadata(msg.mint, msg.uri ?? '');

        onToken({
          mint: msg.mint,
          name: msg.name ?? 'Unknown',
          symbol: msg.symbol ?? '???',
          imageUri: meta.imageUri,
          description: meta.description,
          creatorAddress: msg.traderPublicKey ?? '',
          createdTimestamp: Date.now(),
          marketCap: msg.marketCapSol ?? 0,
          usdMarketCap: 0,
          solInCurve: (msg.vSolInBondingCurve ?? 0) / 1_000_000_000,
          complete: false,
          twitterUrl: meta.twitterUrl,
          telegramUrl: meta.telegramUrl,
          websiteUrl: meta.websiteUrl,
          totalSupply: msg.tokenTotalSupply ?? 1_000_000_000,
        });
      } catch {
        // ignore malformed messages
      }
    };

    ws.onerror = () => { onDisconnect?.(); };

    ws.onclose = () => {
      onDisconnect?.();
      if (!closed) {
        reconnectTimeout = setTimeout(connect, 3000);
      }
    };
  }

  connect();

  return () => {
    closed = true;
    if (reconnectTimeout) clearTimeout(reconnectTimeout);
    ws?.close();
  };
}

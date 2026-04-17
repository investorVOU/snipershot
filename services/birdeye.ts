import axios from 'axios';
import { BIRDEYE_API } from '../constants/programs';

const BIRDEYE_KEY = process.env.EXPO_PUBLIC_BIRDEYE_KEY ?? '';

const birdeyeHeaders = {
  'X-API-KEY': BIRDEYE_KEY,
  'x-chain': 'solana',
};

export interface OHLCVBar {
  time: number; // unix seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface TokenSecurityInfo {
  mintAuthorityRevoked: boolean;
  freezeAuthorityRevoked: boolean;
  lpLocked: boolean;
  top10HolderPercent: number;
  creatorBalance: number;
  totalSupply: number;
}

export interface TokenOverview {
  price: number;
  priceChange1h: number;
  priceChange24h: number;
  marketCap: number;
  volume24h: number;
  liquidity: number;
  holders: number;
}

function resolutionToSeconds(resolution: string): number {
  const map: Record<string, number> = {
    '1m': 60, '3m': 180, '5m': 300, '15m': 900, '30m': 1800,
    '1H': 3600, '2H': 7200, '4H': 14400, '6H': 21600, '8H': 28800, '12H': 43200,
    '1D': 86400, '3D': 259200, '1W': 604800,
  };
  return map[resolution] ?? 60;
}

/** Fetch OHLCV candles for a token */
export async function fetchOHLCV(
  mint: string,
  resolution = '15m',
  limit = 60
): Promise<OHLCVBar[]> {
  try {
    const now = Math.floor(Date.now() / 1000);
    const from = now - limit * resolutionToSeconds(resolution);

    const { data } = await axios.get(`${BIRDEYE_API}/defi/ohlcv`, {
      headers: birdeyeHeaders,
      params: {
        address: mint,
        type: resolution,
        time_from: from,
        time_to: now,
      },
      timeout: 8000,
    });

    const items = data?.data?.items ?? [];
    return items.map((item: Record<string, number>) => ({
      time: item.unixTime,
      open: item.o,
      high: item.h,
      low: item.l,
      close: item.c,
      volume: item.v,
    }));
  } catch {
    return [];
  }
}

/** Fetch token security info from Birdeye */
export async function fetchTokenSecurity(mint: string): Promise<Partial<TokenSecurityInfo>> {
  try {
    const { data } = await axios.get(`${BIRDEYE_API}/defi/token_security`, {
      headers: birdeyeHeaders,
      params: { address: mint },
      timeout: 8000,
    });

    const d = data?.data ?? {};
    return {
      mintAuthorityRevoked: d.mintSlot === null || d.mintAuthority === null,
      freezeAuthorityRevoked: d.freezeAuthority === null,
      lpLocked: d.lpLockedPct > 0,
      top10HolderPercent: (d.top10HolderPercent ?? 0) * 100,
      creatorBalance: d.creatorBalance ?? 0,
      totalSupply: d.totalSupply ?? 0,
    };
  } catch {
    return {};
  }
}

/** Fetch token overview (price, volume, mcap, etc.) */
export async function fetchTokenOverview(mint: string): Promise<TokenOverview | null> {
  try {
    const { data } = await axios.get(`${BIRDEYE_API}/defi/token_overview`, {
      headers: birdeyeHeaders,
      params: { address: mint },
      timeout: 8000,
    });

    const d = data?.data ?? {};
    return {
      price: d.price ?? 0,
      priceChange1h: d.priceChange1hPercent ?? 0,
      priceChange24h: d.priceChange24hPercent ?? 0,
      marketCap: d.mc ?? 0,
      volume24h: d.v24hUSD ?? 0,
      liquidity: d.liquidity ?? 0,
      holders: d.holder ?? 0,
    };
  } catch {
    return null;
  }
}

/** Fetch current price for a token */
export async function fetchPrice(mint: string): Promise<number> {
  try {
    const { data } = await axios.get(`${BIRDEYE_API}/defi/price`, {
      headers: birdeyeHeaders,
      params: { address: mint },
      timeout: 5000,
    });
    return data?.data?.value ?? 0;
  } catch {
    return 0;
  }
}

/** Fetch SOL/USD price from CoinGecko */
export async function fetchSOLPrice(): Promise<number> {
  try {
    const { data } = await axios.get(
      'https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd',
      { timeout: 5000 }
    );
    return data?.solana?.usd ?? 0;
  } catch {
    return 0;
  }
}

/** Fetch LP lock info via Birdeye (uses token_security endpoint) */
export async function fetchLPLocked(mint: string): Promise<boolean> {
  const info = await fetchTokenSecurity(mint);
  return info.lpLocked ?? false;
}

import { useState, useEffect, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PumpfunToken, subscribePumpPortal } from '../services/pumpfun';
import { runRugFilter, RugFilterResult } from '../services/rugFilter';
import { fetchTokenOverview, fetchOHLCV, TokenOverview } from '../services/birdeye';
import { hapticNewSafeToken } from '../services/haptics';
import { supabase } from '../services/supabase';
import { getAITokenRating, type AITokenRating } from '../services/groq';
import { watchCreatorWallet } from '../services/creatorMonitor';
import { aiQueue } from '../services/aiQueue';

function saveTokenToSupabase(token: PumpfunToken) {
  void supabase.from('tokens').upsert({
    mint: token.mint,
    name: token.name,
    symbol: token.symbol,
    image_uri: token.imageUri ?? '',
    description: token.description ?? '',
    creator_address: token.creatorAddress ?? '',
    market_cap: token.marketCap ?? 0,
    usd_market_cap: token.usdMarketCap ?? 0,
    sol_in_curve: token.solInCurve ?? 0,
    complete: token.complete ?? false,
    twitter_url: token.twitterUrl ?? '',
    telegram_url: token.telegramUrl ?? '',
    website_url: token.websiteUrl ?? '',
    total_supply: token.totalSupply ?? 0,
    created_timestamp: new Date(token.createdTimestamp).toISOString(),
    first_seen_at: new Date().toISOString(),
  }, { onConflict: 'mint' }).catch(() => {});
}

export type FilterMode = 'all' | 'safe' | 'medium' | 'risky';

export interface FeedToken extends PumpfunToken {
  rugFilter: RugFilterResult | null;
  rugFilterLoading: boolean;
  overview: TokenOverview | null;
  sparklineData: number[];
  isNewest: boolean;
  aiRating: AITokenRating | null;
  aiRatingLoading: boolean;
  creatorDumped: boolean;
  creatorDumpPct: number;
}

const MAX_FEED_SIZE = 100;
const FEED_CACHE_KEY = 'snapshot_feed_cache';
const LIVE_REFRESH_INTERVAL = 30_000; // 30s
const LIVE_REFRESH_BATCH = 20;       // refresh newest N tokens
// Only AI-rate newest N tokens automatically — rest rated on-demand in detail page
const AI_AUTO_RATE_MAX = 8;
const CACHE_DEBOUNCE_MS = 2000;

// ─── Cache helpers ────────────────────────────────────────────────────────────

async function loadCache(): Promise<FeedToken[]> {
  try {
    const raw = await AsyncStorage.getItem(FEED_CACHE_KEY);
    if (!raw) return [];
    const items: FeedToken[] = JSON.parse(raw);
    // Restore with safe defaults so nothing appears "loading"
    return items.map((t) => ({ ...t, isNewest: false, rugFilterLoading: false, aiRatingLoading: false, creatorDumped: t.creatorDumped ?? false, creatorDumpPct: t.creatorDumpPct ?? 0, aiRating: t.aiRating ?? null }));
  } catch {
    return [];
  }
}

function saveCache(tokens: FeedToken[], timerRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>) {
  if (timerRef.current) clearTimeout(timerRef.current);
  timerRef.current = setTimeout(() => {
    const data = tokens.slice(0, MAX_FEED_SIZE).map((t) => ({
      ...t,
      isNewest: false,
      rugFilterLoading: false,
    }));
    AsyncStorage.setItem(FEED_CACHE_KEY, JSON.stringify(data)).catch(() => {});
  }, CACHE_DEBOUNCE_MS);
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useTokenFeed() {
  const [tokens, setTokens] = useState<FeedToken[]>([]);
  const [filter, setFilter] = useState<FilterMode>('all');
  const [search, setSearch] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [cacheLoaded, setCacheLoaded] = useState(false);

  const rugFilterQueue = useRef<Set<string>>(new Set());
  const saveCacheTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Keep a stable ref so the live-refresh interval can read current tokens
  const tokensRef = useRef<FeedToken[]>([]);

  // ── Keep ref in sync ────────────────────────────────────────────────────────
  useEffect(() => {
    tokensRef.current = tokens;
  }, [tokens]);

  // ── Load cache on mount ─────────────────────────────────────────────────────
  useEffect(() => {
    loadCache().then((cached) => {
      if (cached.length > 0) {
        setTokens(cached);
      }
      setCacheLoaded(true);
    });
  }, []);

  // ── Persist tokens to cache whenever they change ────────────────────────────
  useEffect(() => {
    if (!cacheLoaded || tokens.length === 0) return;
    saveCache(tokens, saveCacheTimer);
  }, [tokens, cacheLoaded]);

  // ── Live price/overview refresh (every 30s) ─────────────────────────────────
  useEffect(() => {
    const refreshLive = () => {
      const current = tokensRef.current;
      // Refresh only fully-enriched tokens (rug filter done, have overview)
      const batch = current
        .filter((t) => !t.rugFilterLoading)
        .slice(0, LIVE_REFRESH_BATCH);

      batch.forEach((token) => {
        fetchTokenOverview(token.mint)
          .then((overview) => {
            if (!overview) return;
            setTokens((prev) =>
              prev.map((t) => (t.mint === token.mint ? { ...t, overview } : t))
            );
          })
          .catch(() => {});
      });
    };

    const interval = setInterval(refreshLive, LIVE_REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, []); // intentionally empty — reads state via tokensRef

  // Track how many tokens have been auto-AI-rated this session
  const aiRatedCount = useRef(0);

  // ── Add a new token from the WebSocket ─────────────────────────────────────
  const addToken = useCallback((newToken: PumpfunToken) => {
    // Determine whether to auto-run AI (only for newest N tokens to keep queue short)
    const shouldRunAI = aiRatedCount.current < AI_AUTO_RATE_MAX;
    if (shouldRunAI) aiRatedCount.current++;

    setTokens((prev) => {
      if (prev.some((t) => t.mint === newToken.mint)) return prev;
      const feedToken: FeedToken = {
        ...newToken,
        rugFilter: null,
        rugFilterLoading: true,
        overview: null,
        sparklineData: [],
        isNewest: true,
        aiRating: null,
        aiRatingLoading: shouldRunAI,
        creatorDumped: false,
        creatorDumpPct: 0,
      };
      const cleared = prev.map((t) => (t.isNewest ? { ...t, isNewest: false } : t));
      return [feedToken, ...cleared].slice(0, MAX_FEED_SIZE);
    });

    saveTokenToSupabase(newToken);

    if (rugFilterQueue.current.has(newToken.mint)) return;
    rugFilterQueue.current.add(newToken.mint);

    Promise.all([
      runRugFilter(newToken.mint, newToken.creatorAddress),
      fetchTokenOverview(newToken.mint),
      fetchOHLCV(newToken.mint, '1H', 24),
    ])
      .then(([rugResult, overview, ohlcv]) => {
        const sparklineData = ohlcv.map((b) => b.close);
        if (rugResult.rugScore <= 20) hapticNewSafeToken();

        // Estimate USD market cap from SOL if Birdeye hasn't indexed yet
        const estimatedUsdMC = newToken.usdMarketCap > 0
          ? newToken.usdMarketCap
          : overview?.marketCap ?? (newToken.marketCap * (overview?.price ?? 0));

        setTokens((prev) =>
          prev.map((t) =>
            t.mint === newToken.mint
              ? {
                  ...t,
                  rugFilter: rugResult,
                  rugFilterLoading: false,
                  overview: overview ?? null,
                  sparklineData,
                  usdMarketCap: estimatedUsdMC || t.usdMarketCap,
                }
              : t
          )
        );

        // AI rating — only for the first AI_AUTO_RATE_MAX tokens per session
        if (shouldRunAI) {
          void aiQueue.enqueue(() => getAITokenRating({
            name: newToken.name,
            symbol: newToken.symbol,
            description: newToken.description ?? '',
            rugScore: rugResult.rugScore,
            mintAuthorityRevoked: rugResult.mintAuthorityRevoked,
            freezeAuthorityRevoked: rugResult.freezeAuthorityRevoked,
            lpLocked: rugResult.lpLocked,
            top10HolderPercent: rugResult.top10HolderPercent,
            creatorSoldAll: rugResult.creatorSoldAll,
            solInBondingCurve: newToken.solInCurve,
            usdMarketCap: estimatedUsdMC,
            liquidity: overview?.liquidity,
            volume24h: overview?.volume24h,
            holders: overview?.holders,
            priceChange1h: overview?.priceChange1h,
          })).then((aiRating) => {
            setTokens((prev) =>
              prev.map((t) => t.mint === newToken.mint ? { ...t, aiRating, aiRatingLoading: false } : t)
            );
          }).catch(() => {
            setTokens((prev) =>
              prev.map((t) => t.mint === newToken.mint ? { ...t, aiRatingLoading: false } : t)
            );
          });
        }

        // Monitor creator wallet for dump events
        if (newToken.creatorAddress) {
          void watchCreatorWallet(newToken.mint, newToken.creatorAddress, (sellEvent) => {
            setTokens((prev) =>
              prev.map((t) =>
                t.mint === newToken.mint
                  ? { ...t, creatorDumped: sellEvent.isDump, creatorDumpPct: sellEvent.percentSold }
                  : t
              )
            );
          });
        }
      })
      .catch(() => {
        setTokens((prev) =>
          prev.map((t) =>
            t.mint === newToken.mint ? { ...t, rugFilterLoading: false, aiRatingLoading: false } : t
          )
        );
      })
      .finally(() => {
        rugFilterQueue.current.delete(newToken.mint);
      });
  }, []);

  // ── WebSocket subscription ──────────────────────────────────────────────────
  useEffect(() => {
    const stop = subscribePumpPortal(
      (token) => { setIsConnected(true); addToken(token); },
      () => setIsConnected(false)
    );
    return stop;
  }, [addToken]);

  // ── Filtered + searched token list ─────────────────────────────────────────
  const q = search.trim().toLowerCase();

  const filteredTokens = tokens.filter((t) => {
    // Rug filter
    if (filter !== 'all') {
      if (!t.rugFilter) return false;
      const score = t.rugFilter.rugScore;
      if (filter === 'safe' && score > 20) return false;
      if (filter === 'medium' && (score <= 20 || score > 50)) return false;
      if (filter === 'risky' && score <= 50) return false;
    }
    // Search filter
    if (q) {
      return (
        t.name.toLowerCase().includes(q) ||
        t.symbol.toLowerCase().includes(q) ||
        t.mint.toLowerCase().startsWith(q)
      );
    }
    return true;
  });

  return {
    tokens: filteredTokens,
    allTokens: tokens,
    filter,
    setFilter,
    search,
    setSearch,
    isConnected,
    tokenCount: tokens.length,
  };
}

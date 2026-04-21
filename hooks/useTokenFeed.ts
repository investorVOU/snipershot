import { useState, useEffect, useCallback, useRef } from 'react';
import { PublicKey, VersionedTransaction } from '@solana/web3.js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { PumpfunToken, subscribePumpPortal } from '../services/pumpfun';
import { runRugFilter, RugFilterResult } from '../services/rugFilter';
import { fetchTokenOverview, fetchOHLCV, TokenOverview } from '../services/birdeye';
import { hapticNewSafeToken } from '../services/haptics';
import { supabase } from '../services/supabase';
import { getAITokenRating, type AITokenRating } from '../services/groq';
import { watchCreatorWallet } from '../services/creatorMonitor';
import { aiQueue } from '../services/aiQueue';
import { tryAutoSnipe } from '../services/autoSniper';

function saveTokenToSupabase(
  token: Pick<
    FeedToken,
    | 'mint'
    | 'name'
    | 'symbol'
    | 'imageUri'
    | 'description'
    | 'creatorAddress'
    | 'marketCap'
    | 'usdMarketCap'
    | 'solInCurve'
    | 'complete'
    | 'twitterUrl'
    | 'telegramUrl'
    | 'websiteUrl'
    | 'totalSupply'
    | 'createdTimestamp'
    | 'creatorDumped'
    | 'creatorDumpPct'
  > & {
    liquidity?: number;
    rawPayload?: Record<string, unknown>;
    source?: string;
    lastSignature?: string;
    heliusMetadataFetched?: boolean;
  },
  firstSeenAt?: number
) {
  // Supabase query builder is PromiseLike but not a full Promise — use async IIFE
  void (async () => {
    try {
      await supabase.from('launched_tokens').upsert({
        mint: token.mint,
        name: token.name,
        symbol: token.symbol,
        image_uri: token.imageUri ?? '',
        description: token.description ?? '',
        creator: token.creatorAddress ?? '',
        twitter: token.twitterUrl ?? '',
        telegram: token.telegramUrl ?? '',
        website: token.websiteUrl ?? '',
        created_timestamp: token.createdTimestamp ?? Date.now(),
        sol_in_bonding_curve: token.solInCurve ?? 0,
        liquidity: token.liquidity ?? 0,
        market_cap: token.marketCap ?? 0,
        usd_market_cap: token.usdMarketCap ?? 0,
        source: token.source ?? 'feed',
        last_signature: token.lastSignature ?? '',
        helius_metadata_fetched: token.heliusMetadataFetched ?? false,
        raw_payload: token.rawPayload ?? null,
        first_seen_at: new Date(firstSeenAt ?? Date.now()).toISOString(),
        last_seen_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'mint' });
    } catch { /* ignore — non-critical background sync */ }
  })();
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
  fromCache: boolean; // true = restored from disk, not a live launch this session
}

function isSyntheticAIRating(aiRating: AITokenRating | null | undefined): boolean {
  return aiRating?.reason === 'Score estimated from on-chain rug filter (AI offline)';
}

const MAX_FEED_SIZE = 500;
const FEED_CACHE_KEY = 'snapshot_feed_cache';
const WATCHLIST_KEY = 'snapshot_watchlist';
const POSITIONS_KEY = 'snapshot_positions';
const LIVE_REFRESH_INTERVAL = 30_000; // 30s
const LIVE_REFRESH_BATCH = 20;       // refresh newest N tokens
// Only AI-rate newest N tokens automatically — rest rated on-demand in detail page
const CACHE_DEBOUNCE_MS = 2000;

interface SupabaseTokenRow {
  mint: string;
  name: string | null;
  symbol: string | null;
  image_uri: string | null;
  description: string | null;
  creator: string | null;
  twitter: string | null;
  telegram: string | null;
  website: string | null;
  created_timestamp: number | null;
  sol_in_bonding_curve: number | null;
  liquidity: number | null;
  market_cap: number | null;
  usd_market_cap: number | null;
  source: string | null;
  last_signature: string | null;
  helius_metadata_fetched: boolean | null;
  raw_payload: Record<string, unknown> | null;
}

function mapSupabaseTokenToFeedToken(row: SupabaseTokenRow): FeedToken {
  return {
    mint: row.mint,
    name: row.name ?? 'Unknown',
    symbol: row.symbol ?? '???',
    imageUri: row.image_uri ?? '',
    description: row.description ?? '',
    creatorAddress: row.creator ?? '',
    createdTimestamp: row.created_timestamp ?? Date.now(),
    marketCap: row.market_cap ?? 0,
    usdMarketCap: row.usd_market_cap ?? 0,
    solInCurve: row.sol_in_bonding_curve ?? 0,
    complete: false,
    twitterUrl: row.twitter ?? '',
    telegramUrl: row.telegram ?? '',
    websiteUrl: row.website ?? '',
    totalSupply: 0,
    rugFilter: null,
    rugFilterLoading: true,
    overview: null,
    sparklineData: [],
    isNewest: false,
    aiRating: null,
    aiRatingLoading: true,
    creatorDumped: false,
    creatorDumpPct: 0,
    fromCache: true,
  };
}

function buildTokenSyncSignature(
  token: Pick<
    FeedToken,
    | 'mint'
    | 'name'
    | 'symbol'
    | 'imageUri'
    | 'description'
    | 'creatorAddress'
    | 'marketCap'
    | 'usdMarketCap'
    | 'solInCurve'
    | 'complete'
    | 'twitterUrl'
    | 'telegramUrl'
    | 'websiteUrl'
    | 'totalSupply'
    | 'createdTimestamp'
    | 'creatorDumped'
    | 'creatorDumpPct'
  >
): string {
  return JSON.stringify([
    token.mint,
    token.name,
    token.symbol,
    token.imageUri,
    token.description,
    token.creatorAddress,
    token.marketCap,
    token.usdMarketCap,
    token.solInCurve,
    token.complete,
    token.twitterUrl,
    token.telegramUrl,
    token.websiteUrl,
    token.totalSupply,
    token.createdTimestamp,
    token.creatorDumped,
    token.creatorDumpPct,
  ]);
}

function mergeTokenLists(current: FeedToken[], incoming: FeedToken[]): FeedToken[] {
  const byMint = new Map<string, FeedToken>();

  incoming.forEach((token) => {
    byMint.set(token.mint, token);
  });

  current.forEach((token) => {
    const existing = byMint.get(token.mint);
    if (!existing) {
      byMint.set(token.mint, token);
      return;
    }

    byMint.set(token.mint, {
      ...existing,
      ...token,
      rugFilter: token.rugFilter ?? existing.rugFilter,
      rugFilterLoading: token.rugFilterLoading && existing.rugFilterLoading,
      overview: token.overview ?? existing.overview,
      sparklineData: token.sparklineData.length ? token.sparklineData : existing.sparklineData,
      aiRating: token.aiRating ?? existing.aiRating,
      aiRatingLoading: token.aiRatingLoading && existing.aiRatingLoading,
      creatorDumped: token.creatorDumped || existing.creatorDumped,
      creatorDumpPct: token.creatorDumpPct || existing.creatorDumpPct,
      fromCache: token.fromCache && existing.fromCache,
    });
  });

  return Array.from(byMint.values())
    .sort((a, b) => b.createdTimestamp - a.createdTimestamp)
    .slice(0, MAX_FEED_SIZE);
}

async function loadPriorityMints(): Promise<string[]> {
  try {
    const [watchlistRaw, positionsRaw] = await Promise.all([
      AsyncStorage.getItem(WATCHLIST_KEY),
      AsyncStorage.getItem(POSITIONS_KEY),
    ]);

    const watchlist = watchlistRaw ? JSON.parse(watchlistRaw) as Array<{ mint?: string }> : [];
    const positions = positionsRaw ? JSON.parse(positionsRaw) as Array<{ mint?: string }> : [];

    return Array.from(new Set([
      ...watchlist.map((item) => item.mint).filter(Boolean),
      ...positions.map((item) => item.mint).filter(Boolean),
    ])) as string[];
  } catch {
    return [];
  }
}

async function loadSupabaseTokens(): Promise<FeedToken[]> {
  try {
    const { data: recentRows } = await supabase
      .from('launched_tokens')
      .select('mint,name,symbol,image_uri,description,creator,twitter,telegram,website,created_timestamp,sol_in_bonding_curve,liquidity,market_cap,usd_market_cap,source,last_signature,helius_metadata_fetched,raw_payload')
      .order('first_seen_at', { ascending: false })
      .limit(MAX_FEED_SIZE);

    const recent = ((recentRows ?? []) as SupabaseTokenRow[]).map(mapSupabaseTokenToFeedToken);
    const priorityMints = await loadPriorityMints();
    const missingPriorityMints = priorityMints.filter((mint) => !recent.some((token) => token.mint === mint));

    if (missingPriorityMints.length === 0) return recent;

    const { data: priorityRows } = await supabase
      .from('launched_tokens')
      .select('mint,name,symbol,image_uri,description,creator,twitter,telegram,website,created_timestamp,sol_in_bonding_curve,liquidity,market_cap,usd_market_cap,source,last_signature,helius_metadata_fetched,raw_payload')
      .in('mint', missingPriorityMints);

    return mergeTokenLists(recent, ((priorityRows ?? []) as SupabaseTokenRow[]).map(mapSupabaseTokenToFeedToken));
  } catch {
    return [];
  }
}

// ─── Cache helpers ────────────────────────────────────────────────────────────

async function loadCache(): Promise<FeedToken[]> {
  try {
    const raw = await AsyncStorage.getItem(FEED_CACHE_KEY);
    if (!raw) return [];
    const items: FeedToken[] = JSON.parse(raw);
    // Restore with safe defaults so nothing appears "loading"
    return items.map((t) => ({
      ...t,
      solInCurve: t.solInCurve > 1_000_000 ? t.solInCurve / 1_000_000_000 : t.solInCurve,
      isNewest: false,
      rugFilterLoading: t.rugFilter == null,
      aiRating: isSyntheticAIRating(t.aiRating) ? null : (t.aiRating ?? null),
      aiRatingLoading: isSyntheticAIRating(t.aiRating) || t.aiRating == null,
      creatorDumped: t.creatorDumped ?? false,
      creatorDumpPct: t.creatorDumpPct ?? 0,
      fromCache: true, // mark all cache-restored tokens so Launches tab excludes them
    }));
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

export function useTokenFeed(
  autoSnipePublicKey?: PublicKey | null,
  autoSnipeSignTx?: ((tx: VersionedTransaction) => Promise<VersionedTransaction>) | null
) {
  const [tokens, setTokens] = useState<FeedToken[]>([]);
  const [filter, setFilter] = useState<FilterMode>('all');
  const [search, setSearch] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [cacheLoaded, setCacheLoaded] = useState(false);

  const rugFilterQueue = useRef<Set<string>>(new Set());
  const cacheHydrationQueue = useRef<Set<string>>(new Set());
  const overviewFetchQueue = useRef<Set<string>>(new Set());
  const supabaseBackfillQueue = useRef<Set<string>>(new Set());
  const supabaseSyncSignatures = useRef<Map<string, string>>(new Map());
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

  useEffect(() => {
    if (!cacheLoaded) return;

    loadSupabaseTokens().then((supabaseTokens) => {
      if (supabaseTokens.length === 0) return;
      setTokens((prev) => mergeTokenLists(prev, supabaseTokens));
    });
  }, [cacheLoaded]);

  useEffect(() => {
    if (!cacheLoaded) return;

    const batch = tokensRef.current
      .filter((t) => t.fromCache && !supabaseBackfillQueue.current.has(t.mint))
      .slice(0, LIVE_REFRESH_BATCH);

    batch.forEach((token) => {
      supabaseBackfillQueue.current.add(token.mint);
      saveTokenToSupabase(token, token.createdTimestamp);
    });
  }, [cacheLoaded, tokens]);

  // ── Persist tokens to cache whenever they change ────────────────────────────
  useEffect(() => {
    if (!cacheLoaded || tokens.length === 0) return;
    saveCache(tokens, saveCacheTimer);
  }, [tokens, cacheLoaded]);

  useEffect(() => {
    if (!cacheLoaded || tokens.length === 0) return;

    tokens.slice(0, MAX_FEED_SIZE).forEach((token) => {
      const signature = buildTokenSyncSignature(token);
      const lastSignature = supabaseSyncSignatures.current.get(token.mint);
      if (lastSignature === signature) return;

      supabaseSyncSignatures.current.set(token.mint, signature);
      saveTokenToSupabase(token, token.createdTimestamp);
    });
  }, [cacheLoaded, tokens]);

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

  useEffect(() => {
    if (!cacheLoaded) return;

    const batch = tokensRef.current
      .filter((t) => !t.rugFilterLoading && !t.overview && !overviewFetchQueue.current.has(t.mint))
      .slice(0, LIVE_REFRESH_BATCH);

    batch.forEach((token) => {
      overviewFetchQueue.current.add(token.mint);
      fetchTokenOverview(token.mint)
        .then((overview) => {
          if (!overview) return;
          setTokens((prev) =>
            prev.map((t) =>
              t.mint === token.mint
                ? { ...t, overview, usdMarketCap: overview.marketCap || t.usdMarketCap }
                : t
            )
          );
        })
        .catch(() => {})
        .finally(() => {
          overviewFetchQueue.current.delete(token.mint);
        });
    });
  }, [cacheLoaded, tokens]);

  useEffect(() => {
    if (!cacheLoaded) return;

    const batch = tokensRef.current
      .filter((t) => t.fromCache && !cacheHydrationQueue.current.has(t.mint) && (t.rugFilter == null || t.aiRating == null))
      .slice(0, LIVE_REFRESH_BATCH);

    batch.forEach((token) => {
      cacheHydrationQueue.current.add(token.mint);
      setTokens((prev) =>
        prev.map((t) =>
          t.mint === token.mint
            ? {
                ...t,
                rugFilterLoading: t.rugFilter == null ? true : t.rugFilterLoading,
                aiRatingLoading: t.aiRating == null ? true : t.aiRatingLoading,
              }
            : t
        )
      );

      Promise.all([
        token.rugFilter ? Promise.resolve(token.rugFilter) : runRugFilter(token.mint, token.creatorAddress),
        token.overview ? Promise.resolve(token.overview) : fetchTokenOverview(token.mint),
      ])
        .then(([rugFilter, overview]) => {
          if (token.aiRating) {
            setTokens((prev) =>
              prev.map((t) =>
                t.mint === token.mint
                  ? {
                      ...t,
                      rugFilter,
                      rugFilterLoading: false,
                      overview: overview ?? t.overview,
                      aiRatingLoading: false,
                    }
                  : t
              )
            );
            return;
          }

          return aiQueue.enqueue(() => getAITokenRating({
            name: token.name,
            symbol: token.symbol,
            description: token.description ?? '',
            rugScore: rugFilter.rugScore,
            mintAuthorityRevoked: rugFilter.mintAuthorityRevoked,
            freezeAuthorityRevoked: rugFilter.freezeAuthorityRevoked,
            lpLocked: rugFilter.lpLocked,
            top10HolderPercent: rugFilter.top10HolderPercent,
            creatorSoldAll: rugFilter.creatorSoldAll,
            solInBondingCurve: token.solInCurve,
            usdMarketCap: overview?.marketCap,
            liquidity: overview?.liquidity,
            volume24h: overview?.volume24h,
            holders: overview?.holders,
            priceChange1h: overview?.priceChange1h,
          }))
            .then((aiRating) => {
              setTokens((prev) =>
                prev.map((t) =>
                  t.mint === token.mint
                  ? {
                      ...t,
                      rugFilter,
                      rugFilterLoading: false,
                      overview: overview ?? t.overview,
                      aiRating: aiRating ?? t.aiRating,
                      aiRatingLoading: false,
                    }
                    : t
                )
              );
            });
        })
        .catch(() => {
          setTokens((prev) =>
            prev.map((t) =>
              t.mint === token.mint
                ? { ...t, rugFilterLoading: false, aiRatingLoading: false }
                : t
            )
          );
        })
        .finally(() => {
          cacheHydrationQueue.current.delete(token.mint);
        });
    });
  }, [cacheLoaded, tokens]);

  // Track how many tokens have been auto-AI-rated this session

  // ── Add a new token from the WebSocket ─────────────────────────────────────
  const addToken = useCallback((newToken: PumpfunToken) => {
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
        aiRatingLoading: true,
        creatorDumped: false,
        creatorDumpPct: 0,
        fromCache: false, // live WebSocket arrival — eligible for Launches tab
      };
      saveTokenToSupabase(feedToken, Date.now());
      const cleared = prev.map((t) => (t.isNewest ? { ...t, isNewest: false } : t));
      return [feedToken, ...cleared].slice(0, MAX_FEED_SIZE);
    });

    // ── Auto-sniper (fire-and-forget, runs its own rug filter internally) ───────
    if (autoSnipePublicKey && autoSnipeSignTx) {
      void tryAutoSnipe(newToken, autoSnipePublicKey, autoSnipeSignTx);
    }

    // ── AI rating starts immediately — no need to wait for rug filter ──────────
    // Brand-new tokens have no Birdeye security data anyway; name/symbol/description
    // carry most of the signal. Rug filter data patches in separately below.

    // ── Rug filter + market data run in parallel with AI ───────────────────────
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
          usdMarketCap: estimatedUsdMC || newToken.usdMarketCap,
          liquidity: overview?.liquidity,
          volume24h: overview?.volume24h,
          holders: overview?.holders,
          priceChange1h: overview?.priceChange1h,
        })).then((aiRating) => {
          setTokens((prev) =>
            prev.map((t) =>
              t.mint === newToken.mint
                ? { ...t, aiRating: aiRating ?? null, aiRatingLoading: false }
                : t
            )
          );
        }).catch(() => {
          setTokens((prev) =>
            prev.map((t) =>
              t.mint === newToken.mint
                ? { ...t, aiRating: null, aiRatingLoading: false }
                : t
            )
          );
        });

        saveTokenToSupabase({
          mint: newToken.mint,
          name: newToken.name,
          symbol: newToken.symbol,
          imageUri: newToken.imageUri,
          description: newToken.description,
          creatorAddress: newToken.creatorAddress,
          marketCap: newToken.marketCap,
          usdMarketCap: estimatedUsdMC || newToken.usdMarketCap,
          solInCurve: newToken.solInCurve,
          complete: newToken.complete,
          twitterUrl: newToken.twitterUrl,
          telegramUrl: newToken.telegramUrl,
          websiteUrl: newToken.websiteUrl,
          totalSupply: newToken.totalSupply,
          createdTimestamp: newToken.createdTimestamp,
          creatorDumped: false,
          creatorDumpPct: 0,
        }, newToken.createdTimestamp);

        if (newToken.creatorAddress) {
          void watchCreatorWallet(newToken.mint, newToken.creatorAddress, (sellEvent) => {
            setTokens((prev) =>
              prev.map((t) => {
                if (t.mint !== newToken.mint) return t;
                const updated = { ...t, creatorDumped: sellEvent.isDump, creatorDumpPct: sellEvent.percentSold };
                saveTokenToSupabase(updated, updated.createdTimestamp);
                return updated;
              })
            );
            if (sellEvent.isDump) {
              void Notifications.scheduleNotificationAsync({
                content: {
                  title: `Creator Dump! ${newToken.symbol}`,
                  body: `Creator sold ${sellEvent.percentSold.toFixed(0)}% — possible rug`,
                  data: { mint: newToken.mint, type: 'creator_dump' },
                },
                trigger: null,
              });
            }
          });
        }
      })
      .catch(() => {
        setTokens((prev) =>
          prev.map((t) =>
            t.mint === newToken.mint ? { ...t, rugFilterLoading: false } : t
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

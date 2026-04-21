import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AnimatedTokenCard } from "../../components/AnimatedTokenCard";
import { SnipeSheet } from "../../components/SnipeSheet";
import { TickerBar } from "../../components/TickerBar";
import { TokenCard } from "../../components/TokenCard";
import { WalletBadge } from "../../components/WalletBadge";
import { useColors } from "../../hooks/useColors";
import { useSniper } from "../../hooks/useSniper";
import { useWallet } from "../../hooks/useWallet";
import { useWatchlistContext } from "../../hooks/useWatchlist";
import { type FilterMode, type FeedToken, useTokenFeed } from "../../hooks/useTokenFeed";
import { fetchOHLCV, fetchTokenOverview, fetchTrendingTokens, type TrendingToken } from "../../services/birdeye";
import { getAITokenRating } from "../../services/groq";
import { runRugFilter } from "../../services/rugFilter";
import { supabase } from "../../services/supabase";
import { aiQueue } from "../../services/aiQueue";
import { Image } from "react-native";
import { formatCompact } from "../../utils/format";

const FILTERS: { key: FilterMode; label: string }[] = [
  { key: "all", label: "All" },
  { key: "safe", label: "Safe" },
  { key: "medium", label: "Medium" },
  { key: "risky", label: "Risky" },
];

const PAGE_SIZE = 20;
const LAUNCH_MATURITY_MS = 30 * 60 * 1000;
const LAUNCHES_REFRESH_INTERVAL_MS = 60_000;
const TRENDING_MIN_MARKET_CAP = 10_000;
type FeedTab = "launches" | "new" | "trending";

interface LaunchTokenRow {
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
}

function mapLaunchRowToFeedToken(row: LaunchTokenRow): FeedToken {
  return {
    mint: row.mint,
    name: row.name ?? "Unknown",
    symbol: row.symbol ?? "???",
    imageUri: row.image_uri ?? "",
    description: row.description ?? "",
    creatorAddress: row.creator ?? "",
    createdTimestamp: row.created_timestamp ?? Date.now(),
    marketCap: row.market_cap ?? 0,
    usdMarketCap: row.usd_market_cap ?? 0,
    solInCurve: row.sol_in_bonding_curve ?? 0,
    complete: false,
    twitterUrl: row.twitter ?? "",
    telegramUrl: row.telegram ?? "",
    websiteUrl: row.website ?? "",
    totalSupply: 0,
    rugFilter: null,
    rugFilterLoading: true,
    overview: row.liquidity != null || row.usd_market_cap != null
      ? {
          price: 0,
          priceChange1h: 0,
          priceChange24h: 0,
          marketCap: row.usd_market_cap ?? 0,
          volume24h: 0,
          liquidity: row.liquidity ?? 0,
          holders: 0,
        }
      : null,
    sparklineData: [],
    isNewest: false,
    aiRating: null,
    aiRatingLoading: true,
    creatorDumped: false,
    creatorDumpPct: 0,
    fromCache: true,
  };
}

function mergeLaunchTokens(launches: FeedToken[], liveTokens: FeedToken[]): FeedToken[] {
  const byMint = new Map<string, FeedToken>();

  launches.forEach((token) => {
    byMint.set(token.mint, token);
  });

  liveTokens.forEach((token) => {
    const existing = byMint.get(token.mint);
    if (!existing) {
      byMint.set(token.mint, token);
      return;
    }

    byMint.set(token.mint, {
      ...existing,
      ...token,
      overview: token.overview ?? existing.overview,
      rugFilter: token.rugFilter ?? existing.rugFilter,
      aiRating: token.aiRating ?? existing.aiRating,
      sparklineData: token.sparklineData.length ? token.sparklineData : existing.sparklineData,
    });
  });

  return Array.from(byMint.values()).sort((a, b) => b.createdTimestamp - a.createdTimestamp);
}

export default function FeedScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const wallet = useWallet();
  const { tokens, allTokens, filter, setFilter, search, setSearch, isConnected } = useTokenFeed(
    wallet.authMethod !== 'guest' ? wallet.publicKey : null,
    wallet.authMethod !== 'guest' ? wallet.signTransaction : null,
  );
  const sniper = useSniper(wallet.publicKey, wallet.signTransaction);
  const { isWatched, toggleWatchlist } = useWatchlistContext();
  const [snipeToken, setSnipeToken] = useState<FeedToken | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<FeedTab>("launches");
  const [page, setPage] = useState(1);
  const seenMints = useRef(new Set<string>());
  const [trendingTokens, setTrendingTokens] = useState<TrendingToken[]>([]);
  const [trendingLoading, setTrendingLoading] = useState(false);
  const [launchesTokens, setLaunchesTokens] = useState<FeedToken[]>([]);
  const [launchesLoading, setLaunchesLoading] = useState(false);
  const [mcFilter, setMcFilter] = useState<'all' | '5k' | '25k' | '100k'>('all');
  const launchHydrationQueue = useRef(new Set<string>());

  useEffect(() => {
    if (tab !== "trending") return;
    setTrendingLoading(true);
    fetchTrendingTokens(30)
      .then((items) => setTrendingTokens(items.filter((item) => item.marketCap >= TRENDING_MIN_MARKET_CAP)))
      .catch(() => {})
      .finally(() => setTrendingLoading(false));
  }, [tab]);

  useEffect(() => {
    if (tab !== "launches") return undefined;

    let cancelled = false;
    const loadLaunches = async () => {
      const cutoff = Date.now() - LAUNCH_MATURITY_MS;
      setLaunchesLoading(true);
      try {
        const { data } = await supabase
          .from("launched_tokens")
          .select("mint,name,symbol,image_uri,description,creator,twitter,telegram,website,created_timestamp,sol_in_bonding_curve,liquidity,market_cap,usd_market_cap")
          .lte("created_timestamp", cutoff)
          .order("created_timestamp", { ascending: false })
          .limit(200);

        if (!cancelled) {
          const mapped = ((data ?? []) as LaunchTokenRow[]).map(mapLaunchRowToFeedToken);
          setLaunchesTokens((prev) => mergeLaunchTokens(mapped, prev));
        }
      } catch {
      } finally {
        if (!cancelled) {
          setLaunchesLoading(false);
        }
      }
    };

    void loadLaunches();
    const interval = setInterval(() => {
      void loadLaunches();
    }, LAUNCHES_REFRESH_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [tab, refreshing]);

  useEffect(() => {
    if (tab !== "launches") return;

    const batch = launchesTokens
      .filter((token) =>
        !launchHydrationQueue.current.has(token.mint) &&
        (token.rugFilter == null || token.aiRating == null || token.overview == null)
      )
      .slice(0, 20);

    batch.forEach((token) => {
      launchHydrationQueue.current.add(token.mint);

      Promise.all([
        token.rugFilter ? Promise.resolve(token.rugFilter) : runRugFilter(token.mint, token.creatorAddress),
        token.overview ? Promise.resolve(token.overview) : fetchTokenOverview(token.mint),
        fetchOHLCV(token.mint, "1H", 24),
      ])
        .then(([rugFilter, overview, ohlcv]) => {
          const sparklineData = ohlcv.map((bar) => bar.close);
          if (token.aiRating) {
            setLaunchesTokens((prev) =>
              prev.map((current) =>
                current.mint === token.mint
                  ? {
                      ...current,
                      rugFilter,
                      rugFilterLoading: false,
                      overview: overview ?? current.overview,
                      sparklineData: sparklineData.length ? sparklineData : current.sparklineData,
                      aiRatingLoading: false,
                    }
                  : current
              )
            );
            return null;
          }

          return aiQueue.enqueue(() => getAITokenRating({
            name: token.name,
            symbol: token.symbol,
            description: token.description ?? "",
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
          })).then((aiRating) => {
            setLaunchesTokens((prev) =>
              prev.map((current) =>
                current.mint === token.mint
                  ? {
                      ...current,
                      rugFilter,
                      rugFilterLoading: false,
                      overview: overview ?? current.overview,
                      sparklineData: sparklineData.length ? sparklineData : current.sparklineData,
                      aiRating: aiRating ?? current.aiRating,
                      aiRatingLoading: false,
                    }
                  : current
              )
            );
          });
        })
        .catch(() => {
          setLaunchesTokens((prev) =>
            prev.map((current) =>
              current.mint === token.mint
                ? { ...current, rugFilterLoading: false, aiRatingLoading: false }
                : current
            )
          );
        })
        .finally(() => {
          launchHydrationQueue.current.delete(token.mint);
        });
    });
  }, [launchesTokens, tab]);

  const topPad = Platform.OS === "web" ? Math.max(insets.top, 67) : insets.top;
  const botPad = Platform.OS === "web" ? Math.max(insets.bottom, 34) : insets.bottom;

  const applyLaunchFilters = useCallback((items: FeedToken[]) => {
    const q = search.trim().toLowerCase();
    const mcMin = mcFilter === '5k' ? 5_000 : mcFilter === '25k' ? 25_000 : mcFilter === '100k' ? 100_000 : 0;
    return items.filter((t) => {
      if (filter !== "all") {
        if (!t.rugFilter) return false;
        const score = t.rugFilter.rugScore;
        if (filter === "safe" && score > 20) return false;
        if (filter === "medium" && (score <= 20 || score > 50)) return false;
        if (filter === "risky" && score <= 50) return false;
      }
      if (mcMin > 0) {
        const mc = t.overview?.marketCap ?? t.usdMarketCap ?? 0;
        if (mc < mcMin) return false;
      }
      if (q) {
        return (
          t.name.toLowerCase().includes(q) ||
          t.symbol.toLowerCase().includes(q) ||
          t.mint.toLowerCase().startsWith(q)
        );
      }
      return true;
    });
  }, [filter, search, mcFilter]);

  const applySearchOnly = useCallback((items: FeedToken[]) => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((t) =>
      t.name.toLowerCase().includes(q) ||
      t.symbol.toLowerCase().includes(q) ||
      t.mint.toLowerCase().startsWith(q)
    );
  }, [search]);

  const tabTokens = useMemo(() => {
    const cutoff = Date.now() - LAUNCH_MATURITY_MS;
    if (tab === "launches") {
      const maturedLiveTokens = allTokens.filter((t) => t.createdTimestamp <= cutoff);
      return applyLaunchFilters(mergeLaunchTokens(launchesTokens, maturedLiveTokens));
    }
    return applySearchOnly(
      allTokens.filter((t) =>
        !t.fromCache &&
        t.createdTimestamp > cutoff
      )
    );
  }, [allTokens, applyLaunchFilters, applySearchOnly, launchesTokens, tab]);

  // Paginate: show PAGE_SIZE * page items, load more on scroll end
  const pagedTokens = useMemo(() => tabTokens.slice(0, PAGE_SIZE * page), [tabTokens, page]);

  const handleLoadMore = useCallback(() => {
    if (pagedTokens.length < tabTokens.length) {
      setPage((p) => p + 1);
    }
  }, [pagedTokens.length, tabTokens.length]);

  // Reset page when tab or filter changes
  const handleTabChange = useCallback((t: FeedTab) => {
    setTab(t);
    setPage(1);
  }, []);

  const handleFilterChange = useCallback((f: FilterMode) => {
    setFilter(f);
    setPage(1);
  }, [setFilter]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    setPage(1);
    setTimeout(() => setRefreshing(false), 1000);
  }, []);

  const isNewCard = (mint: string) => {
    if (seenMints.current.has(mint)) return false;
    seenMints.current.add(mint);
    return true;
  };

  const launchesCount = useMemo(() => {
    const cutoff = Date.now() - LAUNCH_MATURITY_MS;
    const maturedLiveTokens = allTokens.filter((t) => t.createdTimestamp <= cutoff);
    return applyLaunchFilters(mergeLaunchTokens(launchesTokens, maturedLiveTokens)).length;
  }, [allTokens, applyLaunchFilters, launchesTokens]);

  const newCount = useMemo(() => {
    const cutoff = Date.now() - LAUNCH_MATURITY_MS;
    return allTokens.filter((t) =>
      !t.fromCache &&
      t.createdTimestamp > cutoff
    ).length;
  }, [allTokens]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 10, borderBottomColor: colors.border }]}>
        {/* Top row */}
        <View style={styles.headerTop}>
          <View style={styles.titleRow}>
            <View style={[styles.liveDot, { backgroundColor: isConnected ? "#14f195" : "#ef4444" }]} />
            <Text style={[styles.headerTitle, { color: colors.foreground }]}>Feed</Text>
          </View>
          <WalletBadge />
        </View>

        {/* Tab switcher — Launches first */}
        <View style={[styles.tabRow, { backgroundColor: colors.muted, borderColor: colors.border }]}>
          <TouchableOpacity
            style={[styles.tabBtn, tab === "launches" && { backgroundColor: colors.card }]}
            onPress={() => handleTabChange("launches")}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabText, { color: tab === "launches" ? colors.foreground : colors.mutedForeground }]}>
              Launches
            </Text>
            <View style={[styles.tabBadge, { backgroundColor: tab === "launches" ? "#14f195" : colors.border }]}>
              <Text style={styles.tabBadgeText}>{launchesCount}</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabBtn, tab === "new" && { backgroundColor: colors.card }]}
            onPress={() => handleTabChange("new")}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabText, { color: tab === "new" ? colors.foreground : colors.mutedForeground }]}>
              New
            </Text>
            <View style={[styles.tabBadge, { backgroundColor: tab === "new" ? "#9945ff" : colors.border }]}>
              <Text style={styles.tabBadgeText}>{newCount}</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabBtn, tab === "trending" && { backgroundColor: colors.card }]}
            onPress={() => handleTabChange("trending")}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabText, { color: tab === "trending" ? colors.foreground : colors.mutedForeground }]}>
              Trending
            </Text>
          </TouchableOpacity>
        </View>

        {/* Risk filter — only meaningful on Launches tab */}
        {tab === "launches" && (
          <>
            <View style={styles.filterBar}>
              {FILTERS.map((f) => (
                <TouchableOpacity
                  key={f.key}
                  style={[
                    styles.filterBtn,
                    filter === f.key
                      ? { backgroundColor: colors.primary }
                      : { backgroundColor: colors.muted },
                  ]}
                  onPress={() => handleFilterChange(f.key)}
                >
                  <Text style={[styles.filterText, { color: filter === f.key ? "#fff" : colors.mutedForeground }]}>
                    {f.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.filterBar}>
              {([['all','Any MC'],['5k','$5k+'],['25k','$25k+'],['100k','$100k+']] as const).map(([key, label]) => (
                <TouchableOpacity
                  key={key}
                  style={[styles.filterBtn, mcFilter === key ? { backgroundColor: '#9945ff44' } : { backgroundColor: colors.muted }]}
                  onPress={() => setMcFilter(key)}
                >
                  <Text style={[styles.filterText, { color: mcFilter === key ? '#9945ff' : colors.mutedForeground }]}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        {/* Search */}
        <View style={[styles.searchWrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Feather name="search" size={16} color={colors.mutedForeground} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search name, symbol, or mint"
            placeholderTextColor={colors.mutedForeground}
            style={[styles.searchInput, { color: colors.foreground }]}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {search ? (
            <TouchableOpacity onPress={() => setSearch("")}>
              <Feather name="x" size={16} color={colors.mutedForeground} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      <TickerBar tokens={allTokens} />

      {tab === "trending" ? (
        trendingLoading ? (
          <View style={styles.loadingCenter}>
            <ActivityIndicator color="#f5a623" size="large" />
            <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>Loading trending…</Text>
          </View>
        ) : (
          <FlatList
            data={trendingTokens}
            keyExtractor={(item) => item.address}
            renderItem={({ item, index }) => {
              const isUp = item.priceChange24h >= 0;
              return (
                <TouchableOpacity
                  style={[styles.trendRow, { backgroundColor: colors.card, borderColor: colors.border }]}
                  onPress={() => router.push(`/token/${item.address}`)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.trendRank, { color: colors.mutedForeground }]}>#{index + 1}</Text>
                  {item.logoURI ? (
                    <Image source={{ uri: item.logoURI }} style={styles.trendAvatar} />
                  ) : (
                    <View style={[styles.trendAvatar, styles.trendAvatarFallback]}>
                      <Text style={{ color: '#f5a623', fontWeight: '700' }}>{item.symbol[0] ?? '?'}</Text>
                    </View>
                  )}
                  <View style={styles.trendInfo}>
                    <Text style={[styles.trendName, { color: colors.foreground }]}>{item.name}</Text>
                    <Text style={[styles.trendSymbol, { color: colors.mutedForeground }]}>${item.symbol}</Text>
                  </View>
                  <View style={styles.trendRight}>
                    <Text style={[styles.trendChange, { color: isUp ? '#14f195' : '#ef4444' }]}>
                      {isUp ? '+' : ''}{item.priceChange24h.toFixed(2)}%
                    </Text>
                    <Text style={[styles.trendMC, { color: colors.mutedForeground }]}>
                      ${formatCompact(item.marketCap)}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            }}
            contentContainerStyle={{ padding: 12, paddingBottom: botPad + 90, gap: 8 }}
            showsVerticalScrollIndicator={false}
          />
        )
      ) : pagedTokens.length === 0 && !refreshing ? (
        <View style={styles.loadingCenter}>
          {tab === "launches" && launchesLoading ? (
            <>
              <ActivityIndicator color="#14f195" size="large" />
              <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>
                Loading launches from Supabase...
              </Text>
            </>
          ) : tab === "launches" ? (
            <>
              <ActivityIndicator color="#14f195" size="large" />
              <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>
                No launched tokens found yet...
              </Text>
            </>
          ) : (
            <>
              <ActivityIndicator color={colors.primary} size="large" />
              <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>
                Scanning for new tokens...
              </Text>
            </>
          )}
        </View>
      ) : (
        <FlatList
          data={pagedTokens}
          keyExtractor={(item) => item.mint}
          renderItem={({ item, index }) => {
            const isNew = isNewCard(item.mint);
            return (
              <AnimatedTokenCard index={index} isNew={isNew}>
                <TokenCard
                  token={item}
                  onPress={() => router.push(`/token/${item.mint}`)}
                  onSnipe={() => setSnipeToken(item)}
                  onWatch={() => toggleWatchlist(item)}
                  isWatched={isWatched(item.mint)}
                />
              </AnimatedTokenCard>
            );
          }}
          ListFooterComponent={
            pagedTokens.length < tabTokens.length ? (
              <View style={styles.loadMoreRow}>
                <ActivityIndicator color={colors.primary} size="small" />
                <Text style={[styles.loadMoreText, { color: colors.mutedForeground }]}>
                  Loading more…
                </Text>
              </View>
            ) : pagedTokens.length > 0 ? (
              <Text style={[styles.endText, { color: colors.mutedForeground }]}>
                {pagedTokens.length} tokens shown
              </Text>
            ) : null
          }
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.3}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />
          }
          contentContainerStyle={{ paddingTop: 8, paddingBottom: botPad + 90, paddingHorizontal: 12, gap: 8 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          windowSize={10}
          maxToRenderPerBatch={8}
          removeClippedSubviews
        />
      )}

      <SnipeSheet
        token={snipeToken}
        config={sniper.config}
        onBuy={sniper.buy}
        isBuying={sniper.isBuying}
        onClose={() => setSnipeToken(null)}
        connected={wallet.connected}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { borderBottomWidth: 1, paddingHorizontal: 16, paddingBottom: 12, gap: 10 },
  headerTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  liveDot: { width: 8, height: 8, borderRadius: 4 },
  headerTitle: { fontSize: 22, fontWeight: "800" },
  tabRow: { flexDirection: "row", borderRadius: 12, borderWidth: 1, padding: 3, gap: 3 },
  tabBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 8, borderRadius: 10 },
  tabText: { fontSize: 14, fontWeight: "700" },
  tabBadge: { borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2, minWidth: 22, alignItems: "center" },
  tabBadgeText: { fontSize: 11, fontWeight: "700", color: "#fff" },
  filterBar: { flexDirection: "row", gap: 8 },
  filterBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20 },
  filterText: { fontSize: 13, fontWeight: "600" },
  searchWrap: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  searchInput: { flex: 1, fontSize: 14, fontWeight: "500", paddingVertical: 0 },
  loadingCenter: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  loadingText: { fontSize: 14, fontWeight: "500" },
  loadMoreRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 16 },
  loadMoreText: { fontSize: 13 },
  endText: { textAlign: "center", fontSize: 12, paddingVertical: 16 },
  trendRow: { flexDirection: "row", alignItems: "center", borderRadius: 14, borderWidth: 1, padding: 12, gap: 12 },
  trendRank: { width: 28, fontSize: 13, fontWeight: "700", textAlign: "center" },
  trendAvatar: { width: 40, height: 40, borderRadius: 20 },
  trendAvatarFallback: { backgroundColor: "#f5a62322", justifyContent: "center", alignItems: "center" },
  trendInfo: { flex: 1 },
  trendName: { fontSize: 14, fontWeight: "700" },
  trendSymbol: { fontSize: 12, fontWeight: "500", marginTop: 2 },
  trendRight: { alignItems: "flex-end", gap: 2 },
  trendChange: { fontSize: 14, fontWeight: "700" },
  trendMC: { fontSize: 11 },
});

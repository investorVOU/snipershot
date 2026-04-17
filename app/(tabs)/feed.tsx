import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useCallback, useRef, useState } from "react";
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

const FILTERS: { key: FilterMode; label: string }[] = [
  { key: "all", label: "All" },
  { key: "safe", label: "Safe" },
  { key: "medium", label: "Medium" },
  { key: "risky", label: "Risky" },
];

export default function FeedScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { tokens, allTokens, filter, setFilter, search, setSearch, isConnected } = useTokenFeed();
  const wallet = useWallet();
  const sniper = useSniper(wallet.publicKey, wallet.signTransaction);
  const { isWatched, toggleWatchlist } = useWatchlistContext();
  const [snipeToken, setSnipeToken] = useState<FeedToken | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const seenMints = useRef(new Set<string>());

  const topPad = Platform.OS === "web" ? Math.max(insets.top, 67) : insets.top;
  const botPad = Platform.OS === "web" ? Math.max(insets.bottom, 34) : insets.bottom;

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  }, []);

  const isNewCard = (mint: string) => {
    if (seenMints.current.has(mint)) return false;
    seenMints.current.add(mint);
    return true;
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 10, borderBottomColor: colors.border }]}>
        <View style={styles.headerTop}>
          <View style={styles.titleRow}>
            <View style={[styles.liveDot, { backgroundColor: isConnected ? "#14f195" : "#ef4444" }]} />
            <Text style={[styles.headerTitle, { color: colors.foreground }]}>Live Feed</Text>
          </View>
          <WalletBadge />
        </View>

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
              onPress={() => setFilter(f.key)}
            >
              <Text style={[styles.filterText, { color: filter === f.key ? "#fff" : colors.mutedForeground }]}>
                {f.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

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

      {tokens.length === 0 && !refreshing ? (
        <View style={styles.loadingCenter}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>
            Scanning for new tokens…
          </Text>
        </View>
      ) : (
        <FlatList
          data={tokens}
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
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Feather name="radio" size={40} color={colors.mutedForeground} />
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Scanning blockchain</Text>
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                Waiting for new tokens to appear...
              </Text>
            </View>
          }
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />
          }
          contentContainerStyle={{ paddingTop: 10, paddingBottom: botPad + 90 }}
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
  filterBar: { flexDirection: "row", gap: 8 },
  filterBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20 },
  filterText: { fontSize: 13, fontWeight: "600" },
  searchWrap: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  searchInput: { flex: 1, fontSize: 14, fontWeight: "500", paddingVertical: 0 },
  loadingCenter: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  loadingText: { fontSize: 14, fontWeight: "500" },
  emptyState: { alignItems: "center", justifyContent: "center", paddingTop: 80, gap: 12 },
  emptyTitle: { fontSize: 18, fontWeight: "700" },
  emptyText: { fontSize: 14, textAlign: "center" },
});

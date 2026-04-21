import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import { FlatList, Image, Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "../../hooks/useColors";
import { useWatchlistContext, type WatchlistToken } from "../../hooks/useWatchlist";
import { formatAge } from "../../utils/format";

export default function WatchlistScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { watchlist, toggleWatchlist } = useWatchlistContext();

  const topPad = Platform.OS === "web" ? Math.max(insets.top, 67) : insets.top;
  const botPad = Platform.OS === "web" ? Math.max(insets.bottom, 34) : insets.bottom;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 10, borderBottomColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.foreground }]}>Watchlist</Text>
        <Text style={[styles.sub, { color: colors.mutedForeground }]}>
          {watchlist.length} token{watchlist.length !== 1 ? "s" : ""} starred
        </Text>
      </View>

      <FlatList
        data={watchlist}
        keyExtractor={(item) => item.mint}
        contentContainerStyle={{ padding: 16, paddingBottom: botPad + 90, gap: 10 }}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }: { item: WatchlistToken }) => (
          <TouchableOpacity
            style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => router.push(`/token/${item.mint}`)}
            activeOpacity={0.8}
          >
            {item.imageUri ? (
              <Image source={{ uri: item.imageUri }} style={styles.avatar} resizeMode="cover" />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: colors.muted }]}>
                <Text style={[styles.avatarLetter, { color: colors.primary }]}>{item.symbol?.[0] ?? "?"}</Text>
              </View>
            )}
            <View style={styles.info}>
              <Text style={[styles.name, { color: colors.foreground }]} numberOfLines={1}>{item.name}</Text>
              <View style={styles.metaRow}>
                <Text style={[styles.symbol, { color: colors.mutedForeground }]}>${item.symbol}</Text>
                <Text style={[styles.addedAt, { color: colors.mutedForeground }]}>
                  MC — · Added {formatAge(item.addedAt)}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={[styles.removeBtn, { backgroundColor: "#ef444422" }]}
              onPress={() => toggleWatchlist(item)}
            >
              <Feather name="x" size={14} color="#ef4444" />
            </TouchableOpacity>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Feather name="star" size={48} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No tokens starred</Text>
            <Text style={[styles.emptySub, { color: colors.mutedForeground }]}>
              Tap the star on any token in the feed to add it here
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1, gap: 2 },
  title: { fontSize: 22, fontWeight: "800" },
  sub: { fontSize: 13 },
  card: { flexDirection: "row", alignItems: "center", padding: 14, borderRadius: 14, borderWidth: 1, gap: 12 },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  avatarFallback: { justifyContent: "center", alignItems: "center" },
  avatarLetter: { fontSize: 18, fontWeight: "700" },
  info: { flex: 1, gap: 3 },
  name: { fontSize: 15, fontWeight: "700" },
  metaRow: { flexDirection: "row", gap: 8, alignItems: "center", flexWrap: "wrap" },
  symbol: { fontSize: 12, fontWeight: "600" },
  addedAt: { fontSize: 11 },
  removeBtn: { width: 32, height: 32, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  empty: { alignItems: "center", paddingTop: 80, gap: 12, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 18, fontWeight: "700" },
  emptySub: { fontSize: 14, textAlign: "center", lineHeight: 20 },
});

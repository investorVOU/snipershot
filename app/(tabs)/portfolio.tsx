import { Feather } from "@expo/vector-icons";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PortfolioAICoach } from "../../components/PortfolioAICoach";
import { WalletBadge } from "../../components/WalletBadge";
import { useColors } from "../../hooks/useColors";
import { usePortfolio, type EnrichedPosition } from "../../hooks/usePortfolio";
import { useSniper } from "../../hooks/useSniper";
import { useWallet } from "../../hooks/useWallet";
import { formatSOLValue, formatPercent, truncateAddress } from "../../utils/format";
import type { Trade } from "../../services/tradeLogger";

export default function PortfolioScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const wallet = useWallet();
  const { positions, closedTrades, summary, isLoading, refresh } = usePortfolio();
  const sniper = useSniper(wallet.publicKey, wallet.signTransaction);
  const [sellingMint, setSellingMint] = useState<string | null>(null);

  const topPad = Platform.OS === "web" ? Math.max(insets.top, 67) : insets.top;
  const botPad = Platform.OS === "web" ? Math.max(insets.bottom, 34) : insets.bottom;

  const handleSellAll = useCallback(async (position: EnrichedPosition) => {
    Alert.alert(
      "Sell All",
      `Sell all ${position.tokenSymbol} back to SOL?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Sell",
          style: "destructive",
          onPress: async () => {
            setSellingMint(position.mint);
            await sniper.sell(position.mint, position.tokenName, position.tokenSymbol, position.amountTokens);
            setSellingMint(null);
            refresh();
          },
        },
      ]
    );
  }, [sniper, refresh]);

  const pnlColor = summary.totalPnlSOL >= 0 ? colors.green : colors.red;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 10, borderBottomColor: colors.border }]}>
        <View style={styles.headerTop}>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>Portfolio</Text>
          <WalletBadge />
        </View>
      </View>

      {isLoading ? (
        <View style={styles.loadingCenter}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={positions}
          keyExtractor={(item) => item.mint}
          ListHeaderComponent={
            <>
              <View style={[styles.pnlCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.pnlLabel, { color: colors.mutedForeground }]}>Total Unrealized P&L</Text>
                <Text style={[styles.pnlValue, { color: pnlColor }]}>
                  {summary.totalPnlSOL >= 0 ? "+" : ""}{formatSOLValue(summary.totalPnlSOL)} SOL
                </Text>
                <Text style={[styles.pnlSub, { color: colors.mutedForeground }]}>
                  {positions.length} open position{positions.length !== 1 ? "s" : ""}
                </Text>
              </View>

              <View style={styles.coachWrapper}>
                <PortfolioAICoach positions={positions} />
              </View>

              {positions.length > 0 && (
                <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>Open Positions</Text>
              )}
            </>
          }
          renderItem={({ item }) => {
            const pnl = item.unrealizedPnlSOL;
            const itemPnlColor = pnl >= 0 ? colors.green : colors.red;
            const isSelling = sellingMint === item.mint;
            return (
              <View style={[styles.posCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.posRow}>
                  {item.imageUri ? (
                    <Image source={{ uri: item.imageUri }} style={styles.posAvatar} resizeMode="cover" />
                  ) : (
                    <View style={[styles.posAvatar, styles.posAvatarFallback, { backgroundColor: colors.muted }]}>
                      <Text style={[styles.posAvatarLetter, { color: colors.primary }]}>{item.tokenSymbol?.[0] ?? "?"}</Text>
                    </View>
                  )}
                  <View style={styles.posInfo}>
                    <Text style={[styles.posName, { color: colors.foreground }]}>{item.tokenName}</Text>
                    <Text style={[styles.posSymbol, { color: colors.mutedForeground }]}>${item.tokenSymbol}</Text>
                  </View>
                  <View style={styles.posRight}>
                    <Text style={[styles.posPnl, { color: itemPnlColor }]}>
                      {pnl >= 0 ? "+" : ""}{formatSOLValue(pnl)} SOL
                    </Text>
                    <Text style={[styles.posPnlPct, { color: itemPnlColor }]}>
                      {item.unrealizedPnlPercent >= 0 ? "+" : ""}{formatPercent(item.unrealizedPnlPercent)}
                    </Text>
                  </View>
                </View>

                <View style={[styles.posMeta, { borderTopColor: colors.border }]}>
                  <View style={styles.metaItem}>
                    <Text style={[styles.metaLabel, { color: colors.mutedForeground }]}>Entry</Text>
                    <Text style={[styles.metaValue, { color: colors.foreground }]}>{item.entryPriceSOL.toExponential(2)}</Text>
                  </View>
                  <View style={styles.metaItem}>
                    <Text style={[styles.metaLabel, { color: colors.mutedForeground }]}>Current</Text>
                    {item.isLoading ? (
                      <ActivityIndicator size="small" color={colors.primary} />
                    ) : (
                      <Text style={[styles.metaValue, { color: colors.foreground }]}>{item.currentPriceSOL.toExponential(2)}</Text>
                    )}
                  </View>
                  <View style={styles.metaItem}>
                    <Text style={[styles.metaLabel, { color: colors.mutedForeground }]}>Cost</Text>
                    <Text style={[styles.metaValue, { color: colors.foreground }]}>{formatSOLValue(item.amountSOLSpent)} SOL</Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={[styles.sellBtn, { backgroundColor: "#ef444422", borderColor: "#ef444466" }]}
                  onPress={() => handleSellAll(item)}
                  disabled={isSelling}
                >
                  {isSelling ? (
                    <ActivityIndicator color="#ef4444" size="small" />
                  ) : (
                    <>
                      <Feather name="trending-down" size={14} color="#ef4444" />
                      <Text style={styles.sellBtnText}>Sell All</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            );
          }}
          ListFooterComponent={
            closedTrades.length > 0 ? (
              <View>
                <Text style={[styles.sectionLabel, { color: colors.mutedForeground, marginTop: 16 }]}>
                  Trade History
                </Text>
                {(closedTrades as Trade[]).map((trade) => (
                  <View key={trade.id} style={[styles.tradeRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <View>
                      <Text style={[styles.tradeToken, { color: colors.foreground }]}>
                        {trade.tokenName} ({trade.type.toUpperCase()})
                      </Text>
                      <Text style={[styles.tradeMeta, { color: colors.mutedForeground }]}>
                        {new Date(trade.timestamp).toLocaleDateString()} · {truncateAddress(trade.txSig)}
                      </Text>
                    </View>
                    <Text style={[styles.tradeAmount, { color: colors.foreground }]}>
                      {formatSOLValue(trade.amountSOL)} SOL
                    </Text>
                  </View>
                ))}
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Feather name="briefcase" size={40} color={colors.mutedForeground} />
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No positions</Text>
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                Snipe a token from the feed to open a position
              </Text>
            </View>
          }
          refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refresh} tintColor={colors.primary} />}
          contentContainerStyle={{ padding: 16, paddingBottom: botPad + 90, gap: 10 }}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { borderBottomWidth: 1, paddingHorizontal: 16, paddingBottom: 12 },
  headerTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  headerTitle: { fontSize: 22, fontWeight: "800" },
  loadingCenter: { flex: 1, alignItems: "center", justifyContent: "center" },
  pnlCard: { borderRadius: 14, borderWidth: 1, padding: 20, alignItems: "center", gap: 4, marginBottom: 16 },
  pnlLabel: { fontSize: 12, fontWeight: "600" },
  pnlValue: { fontSize: 36, fontWeight: "800" },
  pnlSub: { fontSize: 12 },
  coachWrapper: { marginBottom: 8 },
  sectionLabel: { fontSize: 12, fontWeight: "700", letterSpacing: 0.5, marginBottom: 8 },
  posCard: { borderRadius: 14, borderWidth: 1, padding: 14, gap: 12 },
  posRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  posAvatar: { width: 44, height: 44, borderRadius: 22 },
  posAvatarFallback: { justifyContent: "center", alignItems: "center" },
  posAvatarLetter: { fontSize: 18, fontWeight: "700" },
  posInfo: { flex: 1 },
  posName: { fontSize: 15, fontWeight: "700" },
  posSymbol: { fontSize: 12, fontWeight: "500" },
  posRight: { alignItems: "flex-end" },
  posPnl: { fontSize: 15, fontWeight: "700" },
  posPnlPct: { fontSize: 12, fontWeight: "600" },
  posMeta: { flexDirection: "row", justifyContent: "space-between", borderTopWidth: 1, paddingTop: 12 },
  metaItem: { alignItems: "center", gap: 2 },
  metaLabel: { fontSize: 10, fontWeight: "500" },
  metaValue: { fontSize: 12, fontWeight: "600" },
  sellBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 10, borderRadius: 10, borderWidth: 1, gap: 6 },
  sellBtnText: { color: "#ef4444", fontSize: 14, fontWeight: "700" },
  emptyState: { alignItems: "center", paddingTop: 60, gap: 12 },
  emptyTitle: { fontSize: 18, fontWeight: "700" },
  emptyText: { fontSize: 14, textAlign: "center" },
  tradeRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 12, borderRadius: 10, borderWidth: 1, marginBottom: 8 },
  tradeToken: { fontSize: 13, fontWeight: "600" },
  tradeMeta: { fontSize: 11, marginTop: 2 },
  tradeAmount: { fontSize: 13, fontWeight: "600" },
});

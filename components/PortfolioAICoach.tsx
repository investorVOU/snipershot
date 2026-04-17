import { Feather } from "@expo/vector-icons";
import React, { useEffect } from "react";
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useColors } from "../hooks/useColors";
import { usePortfolioAI } from "../hooks/useAI";
import type { EnrichedPosition } from "../hooks/usePortfolio";

interface Props {
  positions: EnrichedPosition[];
}

const HEALTH_COLORS: Record<string, string> = {
  STRONG: "#14f195",
  NEUTRAL: "#ffc107",
  WEAK: "#ef4444",
};

const ACTION_COLORS: Record<string, string> = {
  HOLD: "#9090a0",
  TAKE_PROFIT: "#14f195",
  CUT_LOSS: "#ef4444",
  ADD_MORE: "#9945ff",
};

const ACTION_ICONS: Record<string, string> = {
  HOLD: "pause-circle",
  TAKE_PROFIT: "trending-up",
  CUT_LOSS: "trending-down",
  ADD_MORE: "plus-circle",
};

export function PortfolioAICoach({ positions }: Props) {
  const colors = useColors();
  const { advice, loading, analyze } = usePortfolioAI();

  const runAnalysis = () => {
    if (positions.length === 0) return;
    analyze(
      positions.map((p) => ({
        tokenSymbol: p.tokenSymbol,
        entryPrice: p.entryPriceSOL,
        currentPrice: p.currentPriceSOL,
        pnlPercent: p.unrealizedPnlPercent,
        costBasisSol: p.amountSOLSpent,
      }))
    );
  };

  useEffect(() => {
    runAnalysis();
  }, [positions.length]);

  return (
    <View style={[styles.container, { backgroundColor: colors.card, borderColor: "#9945ff44" }]}>
      <View style={styles.headerRow}>
        <View style={styles.titleRow}>
          <View style={[styles.aiDot, { backgroundColor: "#9945ff" }]} />
          <Text style={[styles.title, { color: colors.foreground }]}>AI Portfolio Coach</Text>
        </View>
        <TouchableOpacity onPress={runAnalysis} disabled={loading}>
          <Feather name="refresh-cw" size={14} color={loading ? colors.mutedForeground : "#9945ff"} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator color="#9945ff" size="small" />
          <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>
            Groq is analyzing your portfolio...
          </Text>
        </View>
      ) : advice ? (
        <>
          <View style={[styles.healthPill, { backgroundColor: HEALTH_COLORS[advice.overallHealth] + "22" }]}>
            <View style={[styles.healthDot, { backgroundColor: HEALTH_COLORS[advice.overallHealth] }]} />
            <Text style={[styles.healthText, { color: HEALTH_COLORS[advice.overallHealth] }]}>
              {advice.overallHealth} PORTFOLIO
            </Text>
          </View>

          <Text style={[styles.totalAdvice, { color: colors.foreground }]}>{advice.totalAdvice}</Text>

          {advice.positions.map((pos) => {
            const actionColor = ACTION_COLORS[pos.action] ?? "#9945ff";
            const iconName = ACTION_ICONS[pos.action] as "pause-circle" | "trending-up" | "trending-down" | "plus-circle";
            return (
              <View key={pos.symbol} style={[styles.posRow, { backgroundColor: colors.background, borderColor: colors.border }]}>
                <View style={[styles.actionIcon, { backgroundColor: actionColor + "22" }]}>
                  <Feather name={iconName} size={13} color={actionColor} />
                </View>
                <View style={styles.posInfo}>
                  <Text style={[styles.posSymbol, { color: colors.foreground }]}>${pos.symbol}</Text>
                  <Text style={[styles.posReason, { color: colors.mutedForeground }]}>{pos.reason}</Text>
                </View>
                <View style={[styles.actionBadge, { backgroundColor: actionColor + "22", borderColor: actionColor + "44" }]}>
                  <Text style={[styles.actionText, { color: actionColor }]}>{pos.action.replace("_", " ")}</Text>
                </View>
              </View>
            );
          })}
        </>
      ) : (
        <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
          Add positions to get AI advice
        </Text>
      )}

      <Text style={[styles.poweredBy, { color: colors.mutedForeground }]}>
        Powered by Groq · LLaMA 3.3 70B · Not financial advice
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 12 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  aiDot: { width: 8, height: 8, borderRadius: 4 },
  title: { fontSize: 15, fontWeight: "700" },
  loadingRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 4 },
  loadingText: { fontSize: 13, fontStyle: "italic" },
  healthPill: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, gap: 5 },
  healthDot: { width: 6, height: 6, borderRadius: 3 },
  healthText: { fontSize: 11, fontWeight: "800", letterSpacing: 0.5 },
  totalAdvice: { fontSize: 13, lineHeight: 20 },
  posRow: { flexDirection: "row", alignItems: "center", padding: 10, borderRadius: 10, borderWidth: 1, gap: 10 },
  actionIcon: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  posInfo: { flex: 1 },
  posSymbol: { fontSize: 13, fontWeight: "700" },
  posReason: { fontSize: 11, marginTop: 1 },
  actionBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1 },
  actionText: { fontSize: 10, fontWeight: "700" },
  emptyText: { fontSize: 13, fontStyle: "italic" },
  poweredBy: { fontSize: 9, textAlign: "center", letterSpacing: 0.2 },
});

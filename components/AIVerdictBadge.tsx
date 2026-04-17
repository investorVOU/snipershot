import { Feather } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useAIVerdict } from "../hooks/useAI";
import type { RugFilterResult } from "../services/rugFilter";
import type { RugVerdictResult } from "../services/groq";

interface Props {
  mint: string;
  tokenName: string;
  tokenSymbol: string;
  rugFilter: RugFilterResult | null;
  rugLoading: boolean;
  solInBondingCurve: number;
  usdMarketCap?: number;
  onPress?: (verdict: RugVerdictResult) => void;
}

const VERDICT_COLORS: Record<string, string> = {
  SAFE: "#14f195",
  CAUTION: "#ffc107",
  AVOID: "#ef4444",
};

const SIGNAL_ICONS: Record<string, string> = {
  BUY: "trending-up",
  WATCH: "eye",
  SKIP: "x-circle",
};

export function AIVerdictBadge({ mint, tokenName, tokenSymbol, rugFilter, rugLoading, solInBondingCurve, usdMarketCap, onPress }: Props) {
  const { analyze } = useAIVerdict();
  const [verdict, setVerdict] = useState<RugVerdictResult | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (rugLoading || !rugFilter) return;
    let mounted = true;
    setLoading(true);
    analyze(mint, {
      name: tokenName,
      symbol: tokenSymbol,
      rugScore: rugFilter.rugScore,
      mintAuthorityRevoked: rugFilter.mintAuthorityRevoked,
      freezeAuthorityRevoked: rugFilter.freezeAuthorityRevoked,
      lpLocked: rugFilter.lpLocked,
      top10HolderPercent: rugFilter.top10HolderPercent,
      creatorSoldAll: rugFilter.creatorSoldAll,
      solInBondingCurve,
      usdMarketCap,
    }).then((v) => {
      if (mounted && v) setVerdict(v);
    }).finally(() => {
      if (mounted) setLoading(false);
    });
    return () => { mounted = false; };
  }, [mint, rugLoading, rugFilter?.rugScore]);

  if (loading) {
    return (
      <View style={styles.loadingBadge}>
        <ActivityIndicator size="small" color="#9945ff" />
        <Text style={styles.loadingText}>AI...</Text>
      </View>
    );
  }

  if (!verdict) return null;

  const color = VERDICT_COLORS[verdict.verdict] ?? "#9945ff";
  const iconName = SIGNAL_ICONS[verdict.signal] as "trending-up" | "eye" | "x-circle";

  return (
    <TouchableOpacity
      style={[styles.badge, { backgroundColor: color + "18", borderColor: color + "55" }]}
      onPress={() => onPress?.(verdict)}
      activeOpacity={0.8}
    >
      <View style={[styles.aiDot, { backgroundColor: "#9945ff" }]} />
      <Text style={[styles.aiLabel, { color: "#9945ff" }]}>AI</Text>
      <View style={[styles.sep, { backgroundColor: color + "55" }]} />
      <Feather name={iconName} size={11} color={color} />
      <Text style={[styles.signal, { color }]}>{verdict.signal}</Text>
      <Text style={[styles.confidence, { color: color + "cc" }]}>{verdict.confidence}%</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    gap: 4,
  },
  loadingBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: "#9945ff11",
    gap: 4,
  },
  loadingText: { fontSize: 10, color: "#9945ff", fontWeight: "600" },
  aiDot: { width: 5, height: 5, borderRadius: 3 },
  aiLabel: { fontSize: 9, fontWeight: "800", letterSpacing: 0.5 },
  sep: { width: 1, height: 10 },
  signal: { fontSize: 11, fontWeight: "700" },
  confidence: { fontSize: 9, fontWeight: "600" },
});

import { Feather } from "@expo/vector-icons";
import React from "react";
import { Modal, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useColors } from "../hooks/useColors";
import type { RugVerdictResult } from "../services/groq";

interface Props {
  visible: boolean;
  onClose: () => void;
  verdict: RugVerdictResult | null;
  tokenName: string;
}

const VERDICT_COLORS: Record<string, string> = {
  SAFE: "#14f195",
  CAUTION: "#ffc107",
  AVOID: "#ef4444",
};

const VERDICT_ICONS: Record<string, string> = {
  SAFE: "shield",
  CAUTION: "alert-triangle",
  AVOID: "x-octagon",
};

const SIGNAL_COLORS: Record<string, string> = {
  BUY: "#14f195",
  WATCH: "#ffc107",
  SKIP: "#ef4444",
};

export function AIVerdictModal({ visible, onClose, verdict, tokenName }: Props) {
  const colors = useColors();
  if (!verdict) return null;

  const verdictColor = VERDICT_COLORS[verdict.verdict] ?? "#9945ff";
  const iconName = VERDICT_ICONS[verdict.verdict] as "shield" | "alert-triangle" | "x-octagon";
  const signalColor = SIGNAL_COLORS[verdict.signal] ?? "#9945ff";

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose} />
      <SafeAreaView style={styles.centeredView} pointerEvents="box-none">
        <View style={[styles.modal, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.header}>
            <View style={[styles.aiPill, { backgroundColor: "#9945ff22" }]}>
              <Text style={styles.aiPillText}>AI Analysis · Groq LLaMA 3.3</Text>
            </View>
            <TouchableOpacity onPress={onClose}>
              <Feather name="x" size={18} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>

          <Text style={[styles.tokenName, { color: colors.foreground }]}>{tokenName}</Text>

          <View style={[styles.verdictCard, { backgroundColor: verdictColor + "18", borderColor: verdictColor + "44" }]}>
            <Feather name={iconName} size={32} color={verdictColor} />
            <Text style={[styles.verdictLabel, { color: verdictColor }]}>{verdict.verdict}</Text>
            <Text style={[styles.verdictReason, { color: colors.foreground }]}>{verdict.reason}</Text>
          </View>

          <View style={styles.statsRow}>
            <View style={[styles.statBox, { backgroundColor: colors.background, borderColor: colors.border }]}>
              <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Signal</Text>
              <Text style={[styles.statValue, { color: signalColor }]}>{verdict.signal}</Text>
            </View>
            <View style={[styles.statBox, { backgroundColor: colors.background, borderColor: colors.border }]}>
              <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Confidence</Text>
              <Text style={[styles.statValue, { color: colors.foreground }]}>{verdict.confidence}%</Text>
            </View>
          </View>

          <Text style={[styles.disclaimer, { color: colors.mutedForeground }]}>
            AI analysis is for informational purposes only. Not financial advice. Memecoins are extremely high-risk.
          </Text>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.7)" },
  centeredView: { flex: 1, justifyContent: "center", paddingHorizontal: 24 },
  modal: { borderRadius: 20, borderWidth: 1, padding: 20, gap: 14 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  aiPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  aiPillText: { fontSize: 11, fontWeight: "700", color: "#9945ff" },
  tokenName: { fontSize: 20, fontWeight: "800" },
  verdictCard: { borderRadius: 14, borderWidth: 1, padding: 20, alignItems: "center", gap: 8 },
  verdictLabel: { fontSize: 28, fontWeight: "800", letterSpacing: 1 },
  verdictReason: { fontSize: 14, textAlign: "center", lineHeight: 20 },
  statsRow: { flexDirection: "row", gap: 10 },
  statBox: { flex: 1, borderRadius: 10, borderWidth: 1, padding: 12, alignItems: "center", gap: 4 },
  statLabel: { fontSize: 11, fontWeight: "600" },
  statValue: { fontSize: 20, fontWeight: "800" },
  disclaimer: { fontSize: 10, textAlign: "center", lineHeight: 14 },
});

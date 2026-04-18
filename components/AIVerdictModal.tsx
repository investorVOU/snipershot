import { Feather } from "@expo/vector-icons";
import React from "react";
import { Modal, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useColors } from "../hooks/useColors";
import type { AITokenRating } from "../services/groq";

interface Props {
  visible: boolean;
  onClose: () => void;
  verdict: AITokenRating | null;
  tokenName: string;
}

const GRADE_COLORS: Record<string, string> = {
  A: "#14f195",
  B: "#4ade80",
  C: "#fbbf24",
  D: "#f97316",
  F: "#ef4444",
};

const VERDICT_COLORS: Record<string, string> = {
  GEM: "#14f195",
  WATCH: "#fbbf24",
  RISKY: "#f97316",
  RUG: "#ef4444",
};

const SIGNAL_ICONS: Record<string, React.ComponentProps<typeof Feather>["name"]> = {
  BUY: "trending-up",
  HOLD: "pause-circle",
  SKIP: "x-circle",
  SELL: "trending-down",
};

export function AIVerdictModal({ visible, onClose, verdict, tokenName }: Props) {
  const colors = useColors();
  if (!verdict) return null;

  const gradeColor = GRADE_COLORS[verdict.grade] ?? "#9945ff";
  const verdictColor = VERDICT_COLORS[verdict.verdict] ?? "#9945ff";
  const signalIcon = SIGNAL_ICONS[verdict.signal] ?? "minus";

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose} />
      <SafeAreaView style={styles.centeredView} pointerEvents="box-none">
        <View style={[styles.modal, { backgroundColor: colors.card, borderColor: verdictColor + "55" }]}>
          <View style={styles.header}>
            <View style={[styles.aiPill, { backgroundColor: "#9945ff22" }]}>
              <Text style={styles.aiPillText}>AI Analysis · Groq LLaMA 3.3</Text>
            </View>
            <TouchableOpacity onPress={onClose}>
              <Feather name="x" size={18} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>

          <Text style={[styles.tokenName, { color: colors.foreground }]}>{tokenName}</Text>

          {/* Score + Grade hero */}
          <View style={[styles.scoreCard, { backgroundColor: verdictColor + "15", borderColor: verdictColor + "44" }]}>
            <View style={[styles.gradeCircle, { backgroundColor: gradeColor + "22", borderColor: gradeColor }]}>
              <Text style={[styles.gradeText, { color: gradeColor }]}>{verdict.grade}</Text>
            </View>
            <View style={styles.scoreInfo}>
              <Text style={[styles.scoreNumber, { color: verdictColor }]}>{verdict.score}<Text style={styles.scoreOf}>/100</Text></Text>
              <Text style={[styles.verdictLabel, { color: verdictColor }]}>{verdict.verdict}</Text>
              <Text style={[styles.confidenceText, { color: colors.mutedForeground }]}>{verdict.confidence}% confidence</Text>
            </View>
            <View style={[styles.signalTag, { backgroundColor: verdictColor + "22", borderColor: verdictColor + "55" }]}>
              <Feather name={signalIcon} size={16} color={verdictColor} />
              <Text style={[styles.signalText, { color: verdictColor }]}>{verdict.signal}</Text>
            </View>
          </View>

          {/* Reason */}
          <Text style={[styles.reason, { color: colors.foreground }]}>{verdict.reason}</Text>

          {/* Flags */}
          {verdict.flags.length > 0 && (
            <View style={styles.flagsSection}>
              <Text style={[styles.flagsTitle, { color: colors.mutedForeground }]}>Risk Flags</Text>
              <View style={styles.flagsRow}>
                {verdict.flags.map((flag, i) => (
                  <View key={i} style={[styles.flagChip, { backgroundColor: "#ef444422", borderColor: "#ef444444" }]}>
                    <Feather name="alert-circle" size={10} color="#ef4444" />
                    <Text style={styles.flagText}>{flag}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

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
  scoreCard: { borderRadius: 14, borderWidth: 1, padding: 16, flexDirection: "row", alignItems: "center", gap: 14 },
  gradeCircle: { width: 60, height: 60, borderRadius: 30, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  gradeText: { fontSize: 28, fontWeight: "800" },
  scoreInfo: { flex: 1, gap: 2 },
  scoreNumber: { fontSize: 28, fontWeight: "800" },
  scoreOf: { fontSize: 16, fontWeight: "600" },
  verdictLabel: { fontSize: 14, fontWeight: "800", letterSpacing: 0.5 },
  confidenceText: { fontSize: 11 },
  signalTag: { flexDirection: "column", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10, borderWidth: 1 },
  signalText: { fontSize: 11, fontWeight: "700" },
  reason: { fontSize: 14, lineHeight: 20 },
  flagsSection: { gap: 8 },
  flagsTitle: { fontSize: 11, fontWeight: "700", letterSpacing: 0.5 },
  flagsRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  flagChip: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1 },
  flagText: { color: "#ef4444", fontSize: 11, fontWeight: "600" },
  disclaimer: { fontSize: 10, textAlign: "center", lineHeight: 14 },
});

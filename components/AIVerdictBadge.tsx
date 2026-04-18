import { Feather } from "@expo/vector-icons";
import React from "react";
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import type { AITokenRating } from "../services/groq";

interface Props {
  aiRating: AITokenRating | null;
  aiRatingLoading: boolean;
  creatorDumped?: boolean;
  creatorDumpPct?: number;
  onPress?: (rating: AITokenRating) => void;
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

export function AIVerdictBadge({ aiRating, aiRatingLoading, creatorDumped, creatorDumpPct, onPress }: Props) {
  if (creatorDumped) {
    return (
      <View style={[styles.badge, { backgroundColor: "#ef444422", borderColor: "#ef4444" }]}>
        <Feather name="alert-triangle" size={11} color="#ef4444" />
        <Text style={[styles.verdict, { color: "#ef4444" }]}>CREATOR DUMP</Text>
        {creatorDumpPct ? (
          <Text style={[styles.score, { color: "#ef444499" }]}>{creatorDumpPct.toFixed(0)}% sold</Text>
        ) : null}
      </View>
    );
  }

  if (aiRatingLoading) {
    return (
      <View style={styles.loadingBadge}>
        <ActivityIndicator size="small" color="#9945ff" />
        <Text style={styles.loadingText}>AI rating…</Text>
      </View>
    );
  }

  if (!aiRating) return null;

  const gradeColor = GRADE_COLORS[aiRating.grade] ?? "#9945ff";
  const verdictColor = VERDICT_COLORS[aiRating.verdict] ?? "#9945ff";
  const signalIcon = SIGNAL_ICONS[aiRating.signal] ?? "minus";

  return (
    <TouchableOpacity
      style={[styles.badge, { backgroundColor: verdictColor + "18", borderColor: verdictColor + "55" }]}
      onPress={() => onPress?.(aiRating)}
      activeOpacity={0.8}
    >
      {/* AI label */}
      <View style={[styles.aiDot, { backgroundColor: "#9945ff" }]} />
      <Text style={[styles.aiLabel, { color: "#9945ff" }]}>AI</Text>

      <View style={[styles.sep, { backgroundColor: verdictColor + "55" }]} />

      {/* Grade circle */}
      <View style={[styles.gradeCircle, { backgroundColor: gradeColor + "22", borderColor: gradeColor + "66" }]}>
        <Text style={[styles.grade, { color: gradeColor }]}>{aiRating.grade}</Text>
      </View>

      {/* Score */}
      <Text style={[styles.score, { color: verdictColor }]}>{aiRating.score}</Text>

      <View style={[styles.sep, { backgroundColor: verdictColor + "55" }]} />

      {/* Signal */}
      <Feather name={signalIcon} size={11} color={verdictColor} />
      <Text style={[styles.signal, { color: verdictColor }]}>{aiRating.signal}</Text>
    </TouchableOpacity>
  );
}

// Full card variant for token detail page
export function AIRatingCard({ aiRating, aiRatingLoading, creatorDumped, creatorDumpPct }: Props) {
  if (aiRatingLoading) {
    return (
      <View style={styles.card}>
        <ActivityIndicator color="#9945ff" />
        <Text style={styles.cardLoadingText}>AI analyzing token…</Text>
      </View>
    );
  }

  if (creatorDumped) {
    return (
      <View style={[styles.card, { borderColor: "#ef4444", backgroundColor: "#ef444411" }]}>
        <View style={styles.cardHeader}>
          <Feather name="alert-triangle" size={18} color="#ef4444" />
          <Text style={[styles.cardTitle, { color: "#ef4444" }]}>CREATOR DUMP DETECTED</Text>
        </View>
        <Text style={styles.cardReason}>
          The creator wallet has sold {creatorDumpPct?.toFixed(0)}% of their tokens. This is a strong rug signal.
        </Text>
      </View>
    );
  }

  if (!aiRating) return null;

  const gradeColor = GRADE_COLORS[aiRating.grade] ?? "#9945ff";
  const verdictColor = VERDICT_COLORS[aiRating.verdict] ?? "#9945ff";

  return (
    <View style={[styles.card, { borderColor: verdictColor + "55" }]}>
      <View style={styles.cardHeader}>
        <View style={[styles.aiDot, { backgroundColor: "#9945ff", width: 8, height: 8, borderRadius: 4 }]} />
        <Text style={[styles.cardTitle, { color: "#9945ff" }]}>AI Analysis</Text>
        <Text style={[styles.cardConfidence, { color: "#555" }]}>{aiRating.confidence}% confidence</Text>
      </View>

      <View style={styles.cardScoreRow}>
        <View style={[styles.cardGradeCircle, { backgroundColor: gradeColor + "22", borderColor: gradeColor }]}>
          <Text style={[styles.cardGrade, { color: gradeColor }]}>{aiRating.grade}</Text>
        </View>
        <View style={styles.cardScoreInfo}>
          <Text style={[styles.cardScore, { color: verdictColor }]}>{aiRating.score}/100</Text>
          <Text style={[styles.cardVerdict, { color: verdictColor }]}>{aiRating.verdict}</Text>
        </View>
        <View style={[styles.signalTag, { backgroundColor: verdictColor + "22", borderColor: verdictColor + "55" }]}>
          <Feather name={SIGNAL_ICONS[aiRating.signal] ?? "minus"} size={13} color={verdictColor} />
          <Text style={[styles.signalTagText, { color: verdictColor }]}>{aiRating.signal}</Text>
        </View>
      </View>

      <Text style={styles.cardReason}>{aiRating.reason}</Text>

      {aiRating.flags.length > 0 && (
        <View style={styles.flagsRow}>
          {aiRating.flags.map((flag, i) => (
            <View key={i} style={styles.flagChip}>
              <Text style={styles.flagText}>{flag}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // Badge (compact, for token cards)
  badge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 7,
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
  gradeCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  grade: { fontSize: 9, fontWeight: "800" },
  score: { fontSize: 11, fontWeight: "700" },
  signal: { fontSize: 10, fontWeight: "700" },
  verdict: { fontSize: 10, fontWeight: "800", letterSpacing: 0.3 },

  // Card (expanded, for detail page)
  card: {
    backgroundColor: "#12121a",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#1e1e2e",
    padding: 14,
    gap: 10,
    marginBottom: 12,
  },
  cardLoadingText: { color: "#555", fontSize: 13, marginLeft: 8 },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  cardTitle: { fontSize: 12, fontWeight: "700", letterSpacing: 0.5, flex: 1 },
  cardConfidence: { fontSize: 11 },
  cardScoreRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  cardGradeCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  cardGrade: { fontSize: 24, fontWeight: "800" },
  cardScoreInfo: { flex: 1, gap: 2 },
  cardScore: { fontSize: 22, fontWeight: "800" },
  cardVerdict: { fontSize: 13, fontWeight: "700" },
  signalTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  signalTagText: { fontSize: 13, fontWeight: "700" },
  cardReason: { color: "#888", fontSize: 13, lineHeight: 18 },
  flagsRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  flagChip: {
    backgroundColor: "#1e1e2e",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  flagText: { color: "#aaa", fontSize: 11 },
});

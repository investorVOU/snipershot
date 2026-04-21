import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import React, { useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { AIVerdictBadge } from "./AIVerdictBadge";
import { AIVerdictModal } from "./AIVerdictModal";
import { NarrativeTags } from "./NarrativeTags";
import { RugScoreBadge } from "./RugScoreBadge";
import { Sparkline } from "./Sparkline";
import { useColors } from "../hooks/useColors";
import { useTokenVotes } from "../hooks/useTokenVotes";
import type { FeedToken } from "../hooks/useTokenFeed";
import type { AITokenRating } from "../services/groq";
import { formatAge, formatMarketCap, toHttpUrl } from "../utils/format";

interface Props {
  token: FeedToken;
  onPress: () => void;
  onSnipe: () => void;
  onWatch?: () => void;
  isWatched?: boolean;
  style?: object;
}

export function TokenCard({ token, onPress, onSnipe, onWatch, isWatched, style }: Props) {
  const colors = useColors();
  const [verdictModal, setVerdictModal] = useState<AITokenRating | null>(null);
  const { votes, vote } = useTokenVotes(token.mint);

  const sparkData = token.sparklineData ?? [];
  const sparkColor = sparkData.length >= 2
    ? sparkData[sparkData.length - 1] >= sparkData[0] ? "#14f195" : "#ef4444"
    : "#9945ff";

  const mc = token.overview?.marketCap ?? token.usdMarketCap ?? 0;
  const liquidity = token.overview?.liquidity ?? 0;

  return (
    <>
      <TouchableOpacity
        style={[styles.card, { backgroundColor: colors.card }, style]}
        onPress={onPress}
        activeOpacity={0.85}
      >
        {/* Top row: avatar · name/stats · sparkline */}
        <View style={styles.row}>
          <Image
            source={{ uri: toHttpUrl(token.imageUri) || undefined }}
            style={styles.avatar}
            contentFit="cover"
            transition={200}
          />
          <View style={styles.info}>
            <View style={styles.nameRow}>
              <Text style={[styles.name, { color: colors.foreground }]} numberOfLines={1}>
                {token.name}
              </Text>
              <Text style={[styles.symbol, { color: colors.mutedForeground }]}>
                ${token.symbol}
              </Text>
            </View>
            <View style={styles.statsRow}>
              <Text style={[styles.age, { color: colors.mutedForeground }]}>
                {formatAge(token.createdTimestamp)}
              </Text>
              <View style={[styles.statPill, { backgroundColor: colors.muted }]}>
                <Text style={[styles.statText, { color: colors.mutedForeground }]}>
                  MC {mc > 0 ? formatMarketCap(mc) : "—"}
                </Text>
              </View>
              {liquidity > 0 && (
                <View style={[styles.statPill, { backgroundColor: colors.muted }]}>
                  <Feather name="droplet" size={10} color={colors.mutedForeground} />
                  <Text style={[styles.statText, { color: colors.mutedForeground }]}>
                    {formatMarketCap(liquidity)}
                  </Text>
                </View>
              )}
            </View>
          </View>

          {sparkData.length > 1 && (
            <Sparkline data={sparkData} width={72} height={34} color={sparkColor} showGradient />
          )}
        </View>

        {/* Narrative tags */}
        {!token.rugFilterLoading && (
          <NarrativeTags
            mint={token.mint}
            name={token.name}
            symbol={token.symbol}
            description={token.description}
          />
        )}

        {/* Safety badges */}
        <View style={styles.badgeRow}>
          <RugScoreBadge rugFilter={token.rugFilter} loading={token.rugFilterLoading} size="small" />
          <AIVerdictBadge
            aiRating={token.aiRating ?? null}
            aiRatingLoading={token.aiRatingLoading ?? false}
            creatorDumped={token.creatorDumped}
            creatorDumpPct={token.creatorDumpPct}
            onPress={(v) => setVerdictModal(v)}
          />
        </View>

        {/* Footer: votes · watch · snipe */}
        <View style={styles.footer}>
          <View style={styles.voteGroup}>
            <TouchableOpacity
              style={[
                styles.voteBtn,
                {
                  backgroundColor: votes?.userVote === "up" ? "#14f19522" : colors.muted,
                  borderColor: votes?.userVote === "up" ? "#14f19555" : colors.border,
                },
              ]}
              onPress={(e) => { e.stopPropagation(); void vote("up"); }}
            >
              <Feather name="thumbs-up" size={12} color={votes?.userVote === "up" ? "#14f195" : colors.mutedForeground} />
              <Text style={[styles.voteText, { color: votes?.userVote === "up" ? "#14f195" : colors.mutedForeground }]}>
                {votes?.upvotes ?? 0}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.voteBtn,
                {
                  backgroundColor: votes?.userVote === "down" ? "#ef444422" : colors.muted,
                  borderColor: votes?.userVote === "down" ? "#ef444455" : colors.border,
                },
              ]}
              onPress={(e) => { e.stopPropagation(); void vote("down"); }}
            >
              <Feather name="thumbs-down" size={12} color={votes?.userVote === "down" ? "#ef4444" : colors.mutedForeground} />
              <Text style={[styles.voteText, { color: votes?.userVote === "down" ? "#ef4444" : colors.mutedForeground }]}>
                {votes?.downvotes ?? 0}
              </Text>
            </TouchableOpacity>
          </View>

          {onWatch && (
            <TouchableOpacity
              style={[
                styles.watchBtn,
                {
                  backgroundColor: isWatched ? "#9945ff22" : colors.muted,
                  borderColor: isWatched ? "#9945ff55" : colors.border,
                },
              ]}
              onPress={(e) => { e.stopPropagation(); onWatch(); }}
            >
              <Feather name="star" size={13} color={isWatched ? "#9945ff" : colors.mutedForeground} />
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.snipeBtn, { backgroundColor: colors.primary }]}
            onPress={(e) => { e.stopPropagation(); onSnipe(); }}
          >
            <Feather name="crosshair" size={13} color="#fff" />
            <Text style={styles.snipeBtnText}>Snipe</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>

      <AIVerdictModal
        visible={verdictModal !== null}
        onClose={() => setVerdictModal(null)}
        verdict={verdictModal}
        tokenName={token.name}
      />
    </>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 14, padding: 14, gap: 10 },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: "#1a1a2e" },
  info: { flex: 1, gap: 4 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  name: { fontSize: 15, fontWeight: "700", flexShrink: 1 },
  symbol: { fontSize: 12, fontWeight: "600" },
  statsRow: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
  age: { fontSize: 11, fontWeight: "500" },
  statPill: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, gap: 3,
  },
  statText: { fontSize: 10, fontWeight: "600" },
  badgeRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  footer: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  voteGroup: { flexDirection: "row", alignItems: "center", gap: 8 },
  voteBtn: {
    flexDirection: "row", alignItems: "center", gap: 5,
    borderRadius: 8, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 7,
  },
  voteText: { fontSize: 12, fontWeight: "700" },
  watchBtn: { width: 32, height: 32, borderRadius: 8, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  snipeBtn: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8, gap: 5 },
  snipeBtnText: { color: "#fff", fontSize: 13, fontWeight: "700" },
});

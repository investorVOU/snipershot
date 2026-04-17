import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useNarrativeDetector } from "../hooks/useAI";
import type { NarrativeResult } from "../services/groq";

interface Props {
  mint: string;
  name: string;
  symbol: string;
  description: string;
}

const HYPE_COLORS: Record<string, string> = {
  LOW: "#9090a0",
  MEDIUM: "#ffc107",
  HIGH: "#ff6b35",
  EXTREME: "#ef4444",
};

export function NarrativeTags({ mint, name, symbol, description }: Props) {
  const { detect } = useNarrativeDetector();
  const [result, setResult] = useState<NarrativeResult | null>(null);

  useEffect(() => {
    let mounted = true;
    detect(mint, { name, symbol, description }).then((r) => {
      if (mounted && r && r.narratives.length > 0) setResult(r);
    });
    return () => { mounted = false; };
  }, [mint]);

  if (!result || result.narratives.length === 0) return null;

  const hypeColor = HYPE_COLORS[result.hype] ?? "#9090a0";

  return (
    <View style={styles.container}>
      {result.narratives.slice(0, 3).map((tag) => (
        <View key={tag} style={styles.tag}>
          <Text style={styles.tagText}>{tag}</Text>
        </View>
      ))}
      <View style={[styles.hypeTag, { backgroundColor: hypeColor + "22", borderColor: hypeColor + "55" }]}>
        <Text style={[styles.hypeText, { color: hypeColor }]}>{result.hype} HYPE</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: "row", flexWrap: "wrap", gap: 5 },
  tag: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 4, backgroundColor: "#9945ff22" },
  tagText: { fontSize: 10, fontWeight: "700", color: "#9945ff" },
  hypeTag: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 4, borderWidth: 1 },
  hypeText: { fontSize: 9, fontWeight: "800", letterSpacing: 0.3 },
});

import React, { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import type { RugFilterResult } from "../services/rugFilter";
import { getRugScoreColor } from "../services/rugFilter";

interface Props {
  rugFilter: RugFilterResult | null;
  loading?: boolean;
  size?: "small" | "medium";
}

export function RugScoreBadge({ rugFilter, loading = false, size = "medium" }: Props) {
  const [modalVisible, setModalVisible] = useState(false);

  if (loading || !rugFilter) {
    return (
      <View style={[styles.badge, styles.loadingBadge, size === "small" && styles.badgeSm]}>
        <Text style={[styles.text, size === "small" && styles.textSm]}>...</Text>
      </View>
    );
  }

  const color = getRugScoreColor(rugFilter.rugScore);
  const label = rugFilter.rugScore <= 20 ? "SAFE" : rugFilter.rugScore <= 50 ? "MED" : "RUG";

  return (
    <>
      <TouchableOpacity
        style={[styles.badge, { backgroundColor: color + "22", borderColor: color + "66" }, size === "small" && styles.badgeSm]}
        onPress={() => setModalVisible(true)}
        activeOpacity={0.7}
      >
        <View style={[styles.dot, { backgroundColor: color }]} />
        <Text style={[styles.text, { color }, size === "small" && styles.textSm]}>
          {label} {rugFilter.rugScore}
        </Text>
      </TouchableOpacity>

      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <Pressable style={styles.overlay} onPress={() => setModalVisible(false)}>
          <Pressable style={styles.modal} onPress={() => {}}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Rug Analysis</Text>
              <View style={[styles.scorePill, { backgroundColor: color + "22", borderColor: color }]}>
                <Text style={[styles.scorePillText, { color }]}>Score: {rugFilter.rugScore}/100</Text>
              </View>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {rugFilter.breakdown.map((item, i) => (
                <View key={i} style={styles.row}>
                  <View style={styles.rowLeft}>
                    <Text style={[styles.rowIcon, { color: item.safe ? "#14f195" : "#ff4444" }]}>
                      {item.safe ? "✓" : "✗"}
                    </Text>
                    <Text style={styles.rowLabel}>{item.label}</Text>
                  </View>
                  {item.score > 0 && (
                    <View style={styles.scoreBubble}>
                      <Text style={styles.scoreBubbleText}>+{item.score}</Text>
                    </View>
                  )}
                </View>
              ))}
              {rugFilter.breakdown.map((item, i) => (
                <Text key={`d${i}`} style={styles.detailText}>• {item.detail}</Text>
              ))}
            </ScrollView>
            <TouchableOpacity style={styles.closeBtn} onPress={() => setModalVisible(false)}>
              <Text style={styles.closeBtnText}>Close</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  badge: { flexDirection: "row", alignItems: "center", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1, gap: 4 },
  loadingBadge: { backgroundColor: "#33333344", borderColor: "#44444466" },
  badgeSm: { paddingHorizontal: 6, paddingVertical: 3 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  text: { fontSize: 11, fontWeight: "700", letterSpacing: 0.5 },
  textSm: { fontSize: 10 },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "flex-end" },
  modal: { backgroundColor: "#12121a", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: "80%" },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  modalTitle: { color: "#fff", fontSize: 18, fontWeight: "700" },
  scorePill: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  scorePillText: { fontSize: 13, fontWeight: "700" },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#1e1e2e" },
  rowLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  rowIcon: { fontSize: 16, fontWeight: "700" },
  rowLabel: { color: "#ccc", fontSize: 14 },
  scoreBubble: { backgroundColor: "#ff444422", borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  scoreBubbleText: { color: "#ff4444", fontSize: 12, fontWeight: "700" },
  detailText: { color: "#888", fontSize: 12, marginTop: 6, lineHeight: 18 },
  closeBtn: { marginTop: 16, backgroundColor: "#9945ff22", borderRadius: 12, padding: 14, alignItems: "center" },
  closeBtnText: { color: "#9945ff", fontSize: 16, fontWeight: "600" },
});

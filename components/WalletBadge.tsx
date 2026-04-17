import { Feather } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import React, { useRef, useState } from "react";
import { Animated, Modal, Platform, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useColors } from "../hooks/useColors";
import { useWallet } from "../hooks/useWallet";
import { formatSOLValue, truncateAddress } from "../utils/format";

export function WalletBadge() {
  const colors = useColors();
  const wallet = useWallet();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const onPress = () => {
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.94, duration: 80, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1, duration: 80, useNativeDriver: true }),
    ]).start(() => setDrawerOpen(true));
  };

  const copyAddress = async () => {
    if (wallet.address && Platform.OS !== "web") {
      try { await Clipboard.setStringAsync(wallet.address); } catch {}
    }
  };

  if (!wallet.connected || !wallet.address) return null;

  return (
    <>
      <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
        <TouchableOpacity
          style={[styles.badge, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={onPress}
          activeOpacity={0.85}
        >
          <View style={[styles.dot, { backgroundColor: colors.green }]} />
          <Text style={[styles.address, { color: colors.foreground }]}>
            {truncateAddress(wallet.address)}
          </Text>
          <Text style={[styles.balance, { color: colors.primary }]}>
            {formatSOLValue(wallet.solBalance)} SOL
          </Text>
        </TouchableOpacity>
      </Animated.View>

      <Modal visible={drawerOpen} transparent animationType="slide" onRequestClose={() => setDrawerOpen(false)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setDrawerOpen(false)} />
        <SafeAreaView style={[styles.drawer, { backgroundColor: colors.card }]}>
          <View style={[styles.handle, { backgroundColor: colors.border }]} />
          <ScrollView contentContainerStyle={styles.drawerContent}>
            <Text style={[styles.drawerTitle, { color: colors.foreground }]}>Wallet</Text>

            <View style={[styles.addressBox, { backgroundColor: colors.background, borderColor: colors.border }]}>
              <Text style={[styles.addressFull, { color: colors.mutedForeground }]} selectable>
                {wallet.address}
              </Text>
              <TouchableOpacity onPress={copyAddress} style={styles.copyBtn}>
                <Feather name="copy" size={16} color={colors.primary} />
              </TouchableOpacity>
            </View>

            <View style={[styles.balanceCard, { backgroundColor: colors.background, borderColor: colors.border }]}>
              <Text style={[styles.balanceLabel, { color: colors.mutedForeground }]}>Balance</Text>
              <Text style={[styles.balanceLarge, { color: colors.foreground }]}>
                {formatSOLValue(wallet.solBalance)} SOL
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.disconnectBtn, { backgroundColor: "#ef444422", borderColor: "#ef444466" }]}
              onPress={() => { setDrawerOpen(false); wallet.disconnect(); }}
            >
              <Feather name="log-out" size={16} color="#ef4444" />
              <Text style={[styles.disconnectText, { color: "#ef4444" }]}>Disconnect</Text>
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  badge: { flexDirection: "row", alignItems: "center", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, borderWidth: 1, gap: 5 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  address: { fontSize: 12, fontWeight: "600" },
  balance: { fontSize: 12, fontWeight: "700" },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)" },
  drawer: { borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 20, maxHeight: "60%" },
  handle: { width: 40, height: 4, borderRadius: 2, alignSelf: "center", marginTop: 12, marginBottom: 8 },
  drawerContent: { padding: 20, gap: 14 },
  drawerTitle: { fontSize: 20, fontWeight: "700", marginBottom: 4 },
  addressBox: { flexDirection: "row", alignItems: "center", borderRadius: 12, borderWidth: 1, padding: 12, gap: 8 },
  addressFull: { flex: 1, fontSize: 12, fontFamily: "monospace" },
  copyBtn: { padding: 4 },
  balanceCard: { borderRadius: 12, borderWidth: 1, padding: 16 },
  balanceLabel: { fontSize: 12, fontWeight: "500", marginBottom: 4 },
  balanceLarge: { fontSize: 24, fontWeight: "700" },
  disconnectBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 14, borderRadius: 12, borderWidth: 1, gap: 8, marginTop: 8 },
  disconnectText: { fontSize: 15, fontWeight: "600" },
});

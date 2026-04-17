import { Feather } from "@expo/vector-icons";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Image, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import BottomSheet, { BottomSheetBackdrop, BottomSheetView } from "@gorhom/bottom-sheet";
import type { BottomSheetBackdropProps } from "@gorhom/bottom-sheet";
import { useColors } from "../hooks/useColors";
import type { FeedToken } from "../hooks/useTokenFeed";
import type { SniperConfig } from "../hooks/useSniper";
import { formatSOLValue, truncateAddress } from "../utils/format";
import { hapticSnipe } from "../services/haptics";

interface Props {
  token: FeedToken | null;
  config: SniperConfig;
  onBuy: (mint: string, name: string, symbol: string, imageUri: string, sol?: number) => Promise<string | null>;
  isBuying: boolean;
  onClose: () => void;
  connected: boolean;
}

export function SnipeSheet({ token, config, onBuy, isBuying, onClose, connected }: Props) {
  const colors = useColors();
  const sheetRef = useRef<BottomSheet>(null);
  const [solAmount, setSolAmount] = useState(config.solAmount.toFixed(2));

  useEffect(() => {
    if (token) {
      sheetRef.current?.expand();
      setSolAmount(config.solAmount.toFixed(2));
    } else {
      sheetRef.current?.close();
    }
  }, [token, config.solAmount]);

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} onPress={onClose} />
    ),
    [onClose]
  );

  const handleBuy = async () => {
    if (!token) return;
    const sol = parseFloat(solAmount);
    if (isNaN(sol) || sol <= 0) return;
    hapticSnipe();
    await onBuy(token.mint, token.name, token.symbol, token.imageUri, sol);
    sheetRef.current?.close();
    onClose();
  };

  const QUICK_AMOUNTS = [0.1, 0.5, 1.0, 2.0];

  return (
    <BottomSheet
      ref={sheetRef}
      index={token ? 0 : -1}
      snapPoints={["58%"]}
      enablePanDownToClose
      onClose={onClose}
      backdropComponent={renderBackdrop}
      backgroundStyle={[styles.sheetBg, { backgroundColor: colors.card }]}
      handleIndicatorStyle={[styles.handle, { backgroundColor: colors.border }]}
    >
      <BottomSheetView style={styles.content}>
        {token && (
          <>
            <View style={styles.header}>
              {token.imageUri ? (
                <Image source={{ uri: token.imageUri }} style={styles.avatar} resizeMode="cover" />
              ) : (
                <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: colors.muted }]}>
                  <Text style={[styles.avatarText, { color: colors.primary }]}>{token.symbol?.[0] ?? "?"}</Text>
                </View>
              )}
              <View style={styles.tokenMeta}>
                <Text style={[styles.tokenName, { color: colors.foreground }]}>{token.name}</Text>
                <Text style={[styles.tokenSymbol, { color: colors.mutedForeground }]}>${token.symbol}</Text>
              </View>
              <View style={[styles.mintBox, { backgroundColor: colors.background }]}>
                <Text style={[styles.mintText, { color: colors.mutedForeground }]}>{truncateAddress(token.mint)}</Text>
              </View>
            </View>

            <Text style={[styles.label, { color: colors.mutedForeground }]}>Amount (SOL)</Text>
            <View style={[styles.inputRow, { backgroundColor: colors.background, borderColor: colors.primary + "44" }]}>
              <TextInput
                style={[styles.input, { color: colors.foreground }]}
                value={solAmount}
                onChangeText={setSolAmount}
                keyboardType="decimal-pad"
                selectTextOnFocus
                placeholderTextColor={colors.mutedForeground}
                placeholder="0.10"
              />
              <Text style={[styles.inputSuffix, { color: colors.primary }]}>SOL</Text>
            </View>

            <View style={styles.quickAmounts}>
              {QUICK_AMOUNTS.map((p) => (
                <TouchableOpacity
                  key={p}
                  style={[
                    styles.quickBtn,
                    { backgroundColor: colors.muted, borderColor: colors.border },
                    parseFloat(solAmount) === p && { borderColor: colors.primary, backgroundColor: colors.primary + "22" },
                  ]}
                  onPress={() => setSolAmount(p.toFixed(2))}
                >
                  <Text style={[styles.quickBtnText, { color: parseFloat(solAmount) === p ? colors.primary : colors.mutedForeground }]}>
                    {p} SOL
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={[styles.infoRow, { borderBottomColor: colors.border }]}>
              <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>Slippage</Text>
              <Text style={[styles.infoValue, { color: colors.foreground }]}>{(config.slippageBps / 100).toFixed(1)}%</Text>
            </View>
            <View style={[styles.infoRow, { borderBottomColor: colors.border }]}>
              <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>Mode</Text>
              <Text style={[styles.infoValue, { color: colors.foreground }]}>{config.priorityMode.toUpperCase()}</Text>
            </View>
            <View style={[styles.infoRow, { borderBottomColor: colors.border }]}>
              <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>Platform Fee</Text>
              <Text style={[styles.infoValue, { color: colors.foreground }]}>0.5%</Text>
            </View>

            {!connected ? (
              <View style={[styles.connectWarning, { backgroundColor: "#ff444422", borderColor: "#ff4444" }]}>
                <Text style={styles.connectWarningText}>Connect wallet to snipe (requires dev build)</Text>
              </View>
            ) : (
              <TouchableOpacity
                style={[styles.buyBtn, { backgroundColor: colors.primary, opacity: isBuying ? 0.7 : 1 }]}
                onPress={handleBuy}
                disabled={isBuying}
                activeOpacity={0.8}
              >
                {isBuying ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Feather name="crosshair" size={18} color="#fff" />
                    <Text style={styles.buyBtnText}>Snipe {formatSOLValue(parseFloat(solAmount) || 0)} SOL</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </>
        )}
      </BottomSheetView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  sheetBg: { borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  handle: { width: 40, height: 4, borderRadius: 2 },
  content: { flex: 1, padding: 20, gap: 12 },
  header: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 8 },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  avatarFallback: { justifyContent: "center", alignItems: "center" },
  avatarText: { fontSize: 18, fontWeight: "700" },
  tokenMeta: { flex: 1 },
  tokenName: { fontSize: 16, fontWeight: "700" },
  tokenSymbol: { fontSize: 13, fontWeight: "500" },
  mintBox: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  mintText: { fontSize: 11, fontFamily: "monospace" },
  label: { fontSize: 13, fontWeight: "600" },
  inputRow: { flexDirection: "row", alignItems: "center", borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10 },
  input: { flex: 1, fontSize: 20, fontWeight: "700", paddingVertical: 0 },
  inputSuffix: { fontSize: 14, fontWeight: "600" },
  quickAmounts: { flexDirection: "row", gap: 8 },
  quickBtn: { flex: 1, alignItems: "center", paddingVertical: 8, borderRadius: 8, borderWidth: 1 },
  quickBtnText: { fontSize: 13, fontWeight: "600" },
  infoRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 8, borderBottomWidth: 1 },
  infoLabel: { fontSize: 13, fontWeight: "500" },
  infoValue: { fontSize: 13, fontWeight: "600" },
  buyBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 16, borderRadius: 14, gap: 8, marginTop: 4 },
  buyBtnText: { color: "#fff", fontSize: 17, fontWeight: "700" },
  connectWarning: { borderRadius: 12, padding: 14, alignItems: "center", borderWidth: 1, marginTop: 4 },
  connectWarningText: { color: "#ff4444", fontSize: 14, fontWeight: "600", textAlign: "center" },
});

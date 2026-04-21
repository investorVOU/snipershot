import { Feather } from "@expo/vector-icons";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import BottomSheet, { BottomSheetBackdrop, BottomSheetView } from "@gorhom/bottom-sheet";
import type { BottomSheetBackdropProps } from "@gorhom/bottom-sheet";
import { PublicKey } from "@solana/web3.js";
import { useColors } from "../hooks/useColors";
import type { FeedToken } from "../hooks/useTokenFeed";
import { formatSOLValue, truncateAddress } from "../utils/format";
import { getTokenAccountBalance } from "../services/helius";
import { getQuote } from "../services/jupiter";
import { NATIVE_MINT } from "../constants/programs";
import { hapticSnipe } from "../services/haptics";

interface Props {
  token: FeedToken | null;
  publicKey: PublicKey | null;
  slippageBps: number;
  onSell: (mint: string, name: string, symbol: string, tokens: number) => Promise<string | null>;
  isSelling: boolean;
  onClose: () => void;
  connected: boolean;
}

const PCTS = [25, 50, 75, 100];

export function SellSheet({ token, publicKey, slippageBps, onSell, isSelling, onClose, connected }: Props) {
  const colors = useColors();
  const sheetRef = useRef<BottomSheet>(null);
  const [pct, setPct] = useState(100);
  const [balance, setBalance] = useState(0);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [estSOL, setEstSOL] = useState<number | null>(null);
  const [priceImpact, setPriceImpact] = useState<number | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);

  useEffect(() => {
    if (token && publicKey) {
      sheetRef.current?.expand();
      setPct(100);
      setEstSOL(null);
      setPriceImpact(null);
      setBalanceLoading(true);
      getTokenAccountBalance(publicKey.toBase58(), token.mint)
        .then((bal) => setBalance(bal))
        .catch(() => setBalance(0))
        .finally(() => setBalanceLoading(false));
    } else {
      sheetRef.current?.close();
    }
  }, [token, publicKey]);

  // Refresh quote when pct or balance changes
  useEffect(() => {
    if (!token || balance <= 0) return;
    const rawAmount = balance * (pct / 100);
    // Token amounts are integer (smallest unit) — balance from helius is uiAmount
    // We need the raw token amount: multiply by 10^decimals; approximation: use uiAmount * 10^6
    // Jupiter expects raw integer token amount
    const tokensRaw = Math.floor(rawAmount * 1_000_000); // assume 6 decimals (pump.fun tokens)
    if (tokensRaw <= 0) return;

    setQuoteLoading(true);
    getQuote(token.mint, NATIVE_MINT.toBase58(), tokensRaw, slippageBps)
      .then((q) => {
        setEstSOL(parseInt(q.outAmount, 10) / 1e9);
        setPriceImpact(parseFloat(q.priceImpactPct));
      })
      .catch(() => { setEstSOL(null); setPriceImpact(null); })
      .finally(() => setQuoteLoading(false));
  }, [token, balance, pct, slippageBps]);

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} onPress={onClose} />
    ),
    [onClose]
  );

  const handleSell = async () => {
    if (!token || balance <= 0) return;
    const tokensRaw = Math.floor(balance * (pct / 100) * 1_000_000);
    if (tokensRaw <= 0) return;
    hapticSnipe();
    await onSell(token.mint, token.name, token.symbol, tokensRaw);
    sheetRef.current?.close();
    onClose();
  };

  const impactColor =
    priceImpact == null
      ? colors.foreground
      : priceImpact > 10
      ? '#ef4444'
      : priceImpact > 3
      ? '#f5a623'
      : '#14f195';

  return (
    <BottomSheet
      ref={sheetRef}
      index={token ? 0 : -1}
      snapPoints={["62%"]}
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
                  <Text style={[styles.avatarText, { color: '#ef4444' }]}>{token.symbol?.[0] ?? "?"}</Text>
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

            <View style={[styles.balanceRow, { backgroundColor: '#ef444411' }]}>
              <Text style={[styles.balanceLabel, { color: colors.mutedForeground }]}>Your Balance</Text>
              {balanceLoading ? (
                <ActivityIndicator size="small" color="#ef4444" />
              ) : (
                <Text style={[styles.balanceValue, { color: colors.foreground }]}>
                  {balance > 0 ? balance.toLocaleString(undefined, { maximumFractionDigits: 2 }) : '0'} {token.symbol}
                </Text>
              )}
            </View>

            <Text style={[styles.label, { color: colors.mutedForeground }]}>Sell Amount</Text>
            <View style={styles.pctRow}>
              {PCTS.map((p) => (
                <TouchableOpacity
                  key={p}
                  style={[
                    styles.pctBtn,
                    { backgroundColor: colors.muted, borderColor: colors.border },
                    pct === p && { borderColor: '#ef4444', backgroundColor: '#ef444422' },
                  ]}
                  onPress={() => setPct(p)}
                >
                  <Text style={[styles.pctText, { color: pct === p ? '#ef4444' : colors.mutedForeground }]}>
                    {p}%
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={[styles.infoRow, { borderBottomColor: colors.border }]}>
              <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>Est. Receive</Text>
              {quoteLoading ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Text style={[styles.infoValue, { color: '#14f195' }]}>
                  {estSOL != null ? `${formatSOLValue(estSOL)} SOL` : '—'}
                </Text>
              )}
            </View>

            <View style={[styles.infoRow, { borderBottomColor: colors.border }]}>
              <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>Price Impact</Text>
              <Text style={[styles.infoValue, { color: impactColor }]}>
                {priceImpact != null ? `${priceImpact.toFixed(2)}%` : '—'}
              </Text>
            </View>

            <View style={[styles.infoRow, { borderBottomColor: colors.border }]}>
              <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>Slippage</Text>
              <Text style={[styles.infoValue, { color: colors.foreground }]}>{(slippageBps / 100).toFixed(1)}%</Text>
            </View>

            {priceImpact != null && priceImpact > 10 && (
              <View style={[styles.impactWarn, { backgroundColor: '#ef444422', borderColor: '#ef4444' }]}>
                <Feather name="alert-triangle" size={14} color="#ef4444" />
                <Text style={styles.impactWarnText}>
                  High price impact ({priceImpact.toFixed(1)}%) — you may receive significantly less SOL
                </Text>
              </View>
            )}

            {!connected ? (
              <View style={[styles.warnBox, { backgroundColor: "#ff444422", borderColor: "#ff4444" }]}>
                <Text style={styles.warnText}>Connect wallet to sell</Text>
              </View>
            ) : balance <= 0 && !balanceLoading ? (
              <View style={[styles.warnBox, { backgroundColor: "#f5a62322", borderColor: "#f5a623" }]}>
                <Text style={[styles.warnText, { color: '#f5a623' }]}>No {token.symbol} balance in wallet</Text>
              </View>
            ) : (
              <TouchableOpacity
                style={[styles.sellBtn, { opacity: isSelling || balance <= 0 || balanceLoading ? 0.7 : 1 }]}
                onPress={handleSell}
                disabled={isSelling || balance <= 0 || balanceLoading}
                activeOpacity={0.8}
              >
                {isSelling ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Feather name="trending-down" size={18} color="#fff" />
                    <Text style={styles.sellBtnText}>
                      Sell {pct}%{estSOL != null ? ` → ${formatSOLValue(estSOL)} SOL` : ''}
                    </Text>
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
  header: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 4 },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  avatarFallback: { justifyContent: "center", alignItems: "center" },
  avatarText: { fontSize: 18, fontWeight: "700" },
  tokenMeta: { flex: 1 },
  tokenName: { fontSize: 16, fontWeight: "700" },
  tokenSymbol: { fontSize: 13, fontWeight: "500" },
  mintBox: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  mintText: { fontSize: 11, fontFamily: "monospace" },
  balanceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10 },
  balanceLabel: { fontSize: 12, fontWeight: '600' },
  balanceValue: { fontSize: 14, fontWeight: '700' },
  label: { fontSize: 13, fontWeight: "600" },
  pctRow: { flexDirection: "row", gap: 8 },
  pctBtn: { flex: 1, alignItems: "center", paddingVertical: 10, borderRadius: 10, borderWidth: 1.5 },
  pctText: { fontSize: 15, fontWeight: "700" },
  infoRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 8, borderBottomWidth: 1 },
  infoLabel: { fontSize: 13, fontWeight: "500" },
  infoValue: { fontSize: 13, fontWeight: "600" },
  impactWarn: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 10, padding: 12, borderWidth: 1 },
  impactWarnText: { color: '#ef4444', fontSize: 12, fontWeight: '600', flex: 1 },
  warnBox: { borderRadius: 12, padding: 14, alignItems: "center", borderWidth: 1 },
  warnText: { color: "#ff4444", fontSize: 14, fontWeight: "600", textAlign: "center" },
  sellBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 16, borderRadius: 14, backgroundColor: '#ef4444', gap: 8, marginTop: 4 },
  sellBtnText: { color: "#fff", fontSize: 17, fontWeight: "700" },
});

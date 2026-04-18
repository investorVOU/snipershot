import { Feather } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as LocalAuthentication from 'expo-local-authentication';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Modal,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { useColors } from '../../hooks/useColors';
import { useWallet } from '../../hooks/useWallet';
import { fetchSOLPrice } from '../../services/birdeye';
import { exportWalletKey } from '../../services/embeddedWallet';
import { supabase } from '../../services/supabase';
import { formatSOLValue, formatUSD, truncateAddress } from '../../utils/format';

export default function ProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const wallet = useWallet();
  const [solUSDPrice, setSolUSDPrice] = useState(0);
  const [isExporting, setIsExporting] = useState(false);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [withdrawAddress, setWithdrawAddress] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');

  const { address, solBalance, connected, disconnect } = wallet;

  const topPad = Platform.OS === 'web' ? Math.max(insets.top, 67) : insets.top;
  const botPad = Platform.OS === 'web' ? Math.max(insets.bottom, 34) : insets.bottom;

  useEffect(() => {
    fetchSOLPrice().then(setSolUSDPrice).catch(() => {});
    const interval = setInterval(() => fetchSOLPrice().then(setSolUSDPrice).catch(() => {}), 60_000);
    return () => clearInterval(interval);
  }, []);

  const handleCopy = useCallback(async () => {
    if (!address) return;
    await Clipboard.setStringAsync(address);
    Toast.show({ type: 'success', text1: 'Address copied!', text2: 'Send SOL to this address to deposit' });
  }, [address]);

  const handleShare = useCallback(async () => {
    if (!address) return;
    await Share.share({ message: `My Solana wallet: ${address}` });
  }, [address]);

  const handleExportKey = useCallback(async () => {
    // Step 1: biometric / passcode gate
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    if (hasHardware && isEnrolled) {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Authenticate to view private key',
        fallbackLabel: 'Use Passcode',
        cancelLabel: 'Cancel',
      });
      if (!result.success) {
        Toast.show({ type: 'error', text1: 'Authentication cancelled' });
        return;
      }
    }

    // Step 2: fetch the actual key
    setIsExporting(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user?.id;
      if (!userId) {
        Toast.show({ type: 'error', text1: 'Not logged in', text2: 'Guest wallets are ephemeral — sign in to export.' });
        return;
      }

      const privateKey = await exportWalletKey(userId);
      if (!privateKey) {
        Toast.show({ type: 'error', text1: 'Key not found on this device', text2: 'Re-login to restore your wallet.' });
        return;
      }

      // Step 3: show the key with a copy option
      Alert.alert(
        '⚠️ Private Key',
        `${privateKey}\n\nStore this somewhere safe. Anyone with this key controls your wallet.`,
        [
          {
            text: 'Copy & Close',
            onPress: async () => {
              await Clipboard.setStringAsync(privateKey);
              Toast.show({ type: 'success', text1: 'Private key copied', text2: 'Store it in a password manager.' });
            },
          },
          { text: 'Close', style: 'cancel' },
        ]
      );
    } catch {
      Toast.show({ type: 'error', text1: 'Export failed', text2: 'Try again' });
    } finally {
      setIsExporting(false);
    }
  }, []);

  const handleDisconnect = useCallback(() => {
    Alert.alert('Disconnect', 'Are you sure you want to disconnect your wallet?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Disconnect', style: 'destructive', onPress: () => disconnect() },
    ]);
  }, [disconnect]);

  const handleWithdrawSubmit = useCallback(() => {
    if (!withdrawAddress.trim()) {
      Toast.show({ type: 'error', text1: 'Enter a destination address' });
      return;
    }
    const amt = parseFloat(withdrawAmount);
    if (!amt || amt <= 0 || amt > solBalance) {
      Toast.show({ type: 'error', text1: 'Invalid amount' });
      return;
    }
    Alert.alert(
      'Confirm Withdrawal',
      `Send ${amt} SOL to\n${truncateAddress(withdrawAddress)}?\n\nThis action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send',
          style: 'destructive',
          onPress: () => {
            setShowWithdraw(false);
            Toast.show({ type: 'info', text1: 'Use the swap/send flow to withdraw SOL', text2: 'Direct send coming soon' });
          },
        },
      ]
    );
  }, [withdrawAddress, withdrawAmount, solBalance]);

  if (!connected) {
    return (
      <View style={[styles.notConnected, { backgroundColor: colors.background }]}>
        <Feather name="user" size={48} color={colors.mutedForeground} />
        <Text style={[styles.notConnectedText, { color: colors.foreground }]}>No wallet connected</Text>
        <TouchableOpacity style={[styles.connectBtn, { backgroundColor: colors.primary }]} onPress={() => router.replace('/')}>
          <Text style={styles.connectBtnText}>Connect Wallet</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const usdValue = solBalance * solUSDPrice;

  return (
    <>
      <ScrollView
        style={[styles.container, { backgroundColor: colors.background }]}
        contentContainerStyle={{ padding: 16, paddingTop: topPad + 10, paddingBottom: botPad + 90 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.headerRow}>
          <Text style={[styles.screenTitle, { color: colors.foreground }]}>Profile</Text>
          <TouchableOpacity onPress={() => router.push('/(tabs)/config')} style={[styles.settingsBtn, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Feather name="settings" size={18} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>

        {/* Balance card */}
        <View style={[styles.balanceCard, { backgroundColor: colors.card, borderColor: '#9945ff44' }]}>
          <View style={[styles.avatarCircle, { backgroundColor: '#9945ff22', borderColor: '#9945ff55' }]}>
            <Feather name="user" size={28} color="#9945ff" />
          </View>
          <Text style={[styles.balanceLabel, { color: colors.mutedForeground }]}>SOL Balance</Text>
          <Text style={[styles.balanceSOL, { color: colors.foreground }]}>{formatSOLValue(solBalance)} SOL</Text>
          <Text style={[styles.balanceUSD, { color: colors.green }]}>{formatUSD(usdValue)}</Text>
          {solUSDPrice > 0 && (
            <Text style={[styles.solPrice, { color: colors.mutedForeground }]}>1 SOL = {formatUSD(solUSDPrice)}</Text>
          )}
        </View>

        {/* Wallet address — primary deposit method */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.mutedForeground }]}>Wallet Address</Text>
          <Text style={[styles.fullAddress, { color: colors.foreground }]} selectable>
            {address}
          </Text>
          <Text style={[styles.depositHint, { color: colors.mutedForeground }]}>
            Send SOL to this address to deposit funds into your wallet.
          </Text>
          <View style={styles.addressActions}>
            <TouchableOpacity style={[styles.addrBtn, { backgroundColor: '#9945ff22', borderColor: '#9945ff55' }]} onPress={handleCopy}>
              <Feather name="copy" size={14} color="#9945ff" />
              <Text style={[styles.addrBtnText, { color: '#9945ff' }]}>Copy Address</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.addrBtn, { backgroundColor: colors.muted, borderColor: colors.border }]} onPress={handleShare}>
              <Feather name="share-2" size={14} color={colors.mutedForeground} />
              <Text style={[styles.addrBtnText, { color: colors.mutedForeground }]}>Share</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Deposit / Withdraw */}
        <View style={styles.dwRow}>
          <TouchableOpacity
            style={[styles.dwBtn, { backgroundColor: colors.card, borderColor: '#14f19566' }]}
            onPress={handleCopy}
            activeOpacity={0.8}
          >
            <Feather name="download" size={22} color="#14f195" />
            <Text style={[styles.dwLabel, { color: '#14f195' }]}>Deposit</Text>
            <Text style={[styles.dwSub, { color: colors.mutedForeground }]}>Copy address & send SOL</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.dwBtn, { backgroundColor: colors.card, borderColor: '#ef444466' }]}
            onPress={() => setShowWithdraw(true)}
            activeOpacity={0.8}
          >
            <Feather name="upload" size={22} color="#ef4444" />
            <Text style={[styles.dwLabel, { color: '#ef4444' }]}>Withdraw</Text>
            <Text style={[styles.dwSub, { color: colors.mutedForeground }]}>Send SOL out</Text>
          </TouchableOpacity>
        </View>

        {/* Export key */}
        <TouchableOpacity
          style={[styles.card, styles.rowCard, { backgroundColor: colors.card, borderColor: '#f5a62333' }]}
          onPress={handleExportKey}
          disabled={isExporting}
          activeOpacity={0.8}
        >
          {isExporting ? <ActivityIndicator color="#f5a623" /> : <Feather name="key" size={20} color="#f5a623" />}
          <View style={{ flex: 1 }}>
            <Text style={[styles.rowCardTitle, { color: '#f5a623' }]}>Export Private Key</Text>
            <Text style={[styles.rowCardSub, { color: colors.mutedForeground }]}>Biometric protected</Text>
          </View>
          <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
        </TouchableOpacity>

        {/* Network info */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.mutedForeground }]}>Network Info</Text>
          {[
            { label: 'Network', value: 'Solana Mainnet' },
            { label: 'RPC', value: 'Helius' },
            { label: 'DEX Router', value: 'Jupiter v6' },
            { label: 'MEV Protection', value: 'Jito Bundles' },
            { label: 'Platform Fee', value: '0.5%' },
          ].map(({ label, value }) => (
            <View key={label} style={[styles.networkRow, { borderTopColor: colors.border }]}>
              <Text style={[styles.networkLabel, { color: colors.mutedForeground }]}>{label}</Text>
              <Text style={[styles.networkValue, { color: colors.foreground }]}>{value}</Text>
            </View>
          ))}
        </View>

        {/* Disconnect */}
        <TouchableOpacity
          style={[styles.disconnectBtn, { borderColor: '#ef4444' }]}
          onPress={handleDisconnect}
          activeOpacity={0.8}
        >
          <Feather name="log-out" size={16} color="#ef4444" />
          <Text style={styles.disconnectText}>Disconnect Wallet</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Withdraw modal */}
      <Modal visible={showWithdraw} animationType="slide" transparent presentationStyle="overFullScreen">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: colors.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.foreground }]}>Withdraw SOL</Text>
              <TouchableOpacity onPress={() => setShowWithdraw(false)}>
                <Feather name="x" size={22} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.modalLabel, { color: colors.mutedForeground }]}>Destination Address</Text>
            <TextInput
              style={[styles.modalInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
              value={withdrawAddress}
              onChangeText={setWithdrawAddress}
              placeholder="Solana wallet address"
              placeholderTextColor={colors.mutedForeground}
              autoCapitalize="none"
              autoCorrect={false}
            />

            <Text style={[styles.modalLabel, { color: colors.mutedForeground }]}>Amount (SOL)</Text>
            <TextInput
              style={[styles.modalInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
              value={withdrawAmount}
              onChangeText={setWithdrawAmount}
              placeholder={`Max: ${formatSOLValue(Math.max(0, solBalance - 0.01))} SOL`}
              placeholderTextColor={colors.mutedForeground}
              keyboardType="decimal-pad"
            />

            <TouchableOpacity
              style={[styles.modalMaxBtn, { borderColor: colors.border }]}
              onPress={() => setWithdrawAmount(Math.max(0, solBalance - 0.01).toFixed(4))}
            >
              <Text style={[styles.modalMaxText, { color: colors.primary }]}>Use Max (keep 0.01 for fees)</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.modalConfirmBtn, { backgroundColor: '#ef4444' }]}
              onPress={handleWithdrawSubmit}
            >
              <Text style={styles.modalConfirmText}>Confirm Withdrawal</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  notConnected: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16 },
  notConnectedText: { fontSize: 16, fontWeight: '600' },
  connectBtn: { paddingHorizontal: 28, paddingVertical: 14, borderRadius: 14 },
  connectBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  screenTitle: { fontSize: 22, fontWeight: '800' },
  settingsBtn: { padding: 8, borderRadius: 10, borderWidth: 1 },
  balanceCard: { borderRadius: 20, padding: 24, alignItems: 'center', marginBottom: 14, borderWidth: 1, gap: 4 },
  avatarCircle: { width: 64, height: 64, borderRadius: 32, borderWidth: 2, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  balanceLabel: { fontSize: 13 },
  balanceSOL: { fontSize: 34, fontWeight: '800', letterSpacing: -0.5 },
  balanceUSD: { fontSize: 18, fontWeight: '600' },
  solPrice: { fontSize: 12, marginTop: 4 },
  card: { borderRadius: 14, borderWidth: 1, padding: 16, marginBottom: 14, gap: 10 },
  rowCard: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cardTitle: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' },
  fullAddress: { fontSize: 12, fontFamily: 'monospace', lineHeight: 18 },
  depositHint: { fontSize: 12, lineHeight: 18 },
  addressActions: { flexDirection: 'row', gap: 10 },
  addrBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 10, borderWidth: 1, paddingVertical: 10 },
  addrBtnText: { fontSize: 13, fontWeight: '600' },
  dwRow: { flexDirection: 'row', gap: 12, marginBottom: 14 },
  dwBtn: { flex: 1, alignItems: 'center', borderRadius: 14, paddingVertical: 18, paddingHorizontal: 10, borderWidth: 1.5, gap: 4 },
  dwLabel: { fontSize: 15, fontWeight: '700' },
  dwSub: { fontSize: 11, textAlign: 'center' },
  rowCardTitle: { fontSize: 14, fontWeight: '700' },
  rowCardSub: { fontSize: 11, marginTop: 2 },
  networkRow: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 8, borderTopWidth: 1 },
  networkLabel: { fontSize: 13 },
  networkValue: { fontSize: 13, fontWeight: '600' },
  disconnectBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 14, paddingVertical: 16, borderWidth: 1, backgroundColor: '#ef444411', marginBottom: 8 },
  disconnectText: { color: '#ef4444', fontSize: 15, fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: '#00000088', justifyContent: 'flex-end' },
  modalSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, gap: 14 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  modalTitle: { fontSize: 18, fontWeight: '700' },
  modalLabel: { fontSize: 12, fontWeight: '600', letterSpacing: 0.5, textTransform: 'uppercase' },
  modalInput: { borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14 },
  modalMaxBtn: { borderWidth: 1, borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  modalMaxText: { fontSize: 13, fontWeight: '600' },
  modalConfirmBtn: { borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  modalConfirmText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});

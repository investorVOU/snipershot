import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Linking,

  Share,
  ActivityIndicator,
  Alert,
} from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import * as Clipboard from 'expo-clipboard';
import * as WebBrowser from 'expo-web-browser';
import { useWallet } from '../../hooks/useWallet';
import { fetchSOLPrice } from '../../services/birdeye';
import { formatSOLValue, formatUSD, truncateAddress } from '../../utils/format';
import Toast from 'react-native-toast-message';

export default function WalletScreen() {
  const wallet = useWallet();
  const [solUSDPrice, setSolUSDPrice] = useState(0);
  const [isExporting, setIsExporting] = useState(false);

  const { address, solBalance, connected, disconnect } = wallet;

  useEffect(() => {
    fetchSOLPrice().then(setSolUSDPrice).catch(() => {});
    const interval = setInterval(() => {
      fetchSOLPrice().then(setSolUSDPrice).catch(() => {});
    }, 60_000);
    return () => clearInterval(interval);
  }, []);

  const handleCopy = useCallback(async () => {
    if (!address) return;
    await Clipboard.setStringAsync(address);
    Toast.show({ type: 'success', text1: 'Address copied!' });
  }, [address]);

  const handleShare = useCallback(async () => {
    if (!address) return;
    await Share.share({ message: address });
  }, [address]);

  const handleBuySOL = useCallback(async () => {
    if (!address) return;
    // Deep-link to MoonPay with wallet pre-filled
    const url = `https://buy.moonpay.com/?walletAddress=${address}&currencyCode=sol`;
    const supported = await Linking.canOpenURL(url);
    if (supported) {
      await Linking.openURL(url);
    } else {
      await WebBrowser.openBrowserAsync(url);
    }
  }, [address]);

  const handleExportKey = useCallback(async () => {
    // Guard with biometrics
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();

    if (hasHardware && isEnrolled) {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Authenticate to export private key',
        fallbackLabel: 'Use Passcode',
      });
      if (!result.success) {
        Toast.show({ type: 'error', text1: 'Authentication failed' });
        return;
      }
    } else {
      Alert.alert(
        'Biometrics not available',
        'Please set up Face ID or fingerprint to export your key.'
      );
      return;
    }

    setIsExporting(true);
    try {
      // Privy handles the export flow — this triggers their in-app export UI
      Alert.alert(
        'Export Private Key',
        'Your private key will be shown once. Store it securely and never share it.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Show Key',
            style: 'destructive',
            onPress: () => {
              // Privy's SDK handles the actual export UI
              Toast.show({
                type: 'info',
                text1: 'Use the Privy export flow in settings',
              });
            },
          },
        ]
      );
    } finally {
      setIsExporting(false);
    }
  }, []);

  const handleDisconnect = useCallback(async () => {
    Alert.alert('Disconnect Wallet', 'Are you sure you want to disconnect?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Disconnect',
        style: 'destructive',
        onPress: () => disconnect(),
      },
    ]);
  }, [disconnect]);

  if (!connected) {
    return (
      <View style={styles.notConnected}>
        <Text style={styles.notConnectedText}>No wallet connected</Text>
      </View>
    );
  }

  const usdValue = solBalance * solUSDPrice;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Balance card */}
      <View style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>SOL Balance</Text>
        <Text style={styles.balanceSOL}>{formatSOLValue(solBalance)} SOL</Text>
        <Text style={styles.balanceUSD}>{formatUSD(usdValue)}</Text>
        {solUSDPrice > 0 && (
          <Text style={styles.solPrice}>1 SOL = {formatUSD(solUSDPrice)}</Text>
        )}
      </View>

      {/* Address */}
      <View style={styles.addressCard}>
        <Text style={styles.cardTitle}>Wallet Address</Text>
        <Text style={styles.fullAddress} selectable>
          {address}
        </Text>
        <View style={styles.addressActions}>
          <TouchableOpacity style={styles.actionBtn} onPress={handleCopy} activeOpacity={0.8}>
            <Text style={styles.actionBtnText}>📋 Copy</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={handleShare} activeOpacity={0.8}>
            <Text style={styles.actionBtnText}>↗ Share</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Deposit / Withdraw row */}
      <View style={styles.depositWithdrawRow}>
        <TouchableOpacity
          style={[styles.dwBtn, styles.depositBtn]}
          onPress={handleBuySOL}
          activeOpacity={0.8}
        >
          <Text style={styles.dwBtnIcon}>⬇️</Text>
          <Text style={[styles.dwBtnLabel, { color: '#14f195' }]}>Deposit</Text>
          <Text style={styles.dwBtnSub}>Buy SOL via MoonPay</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.dwBtn, styles.withdrawBtn]}
          onPress={() => {
            Alert.alert(
              'Withdraw',
              'To withdraw, send SOL from your wallet address to any external wallet or exchange.',
              [{ text: 'Copy Address', onPress: handleCopy }, { text: 'OK' }]
            );
          }}
          activeOpacity={0.8}
        >
          <Text style={styles.dwBtnIcon}>⬆️</Text>
          <Text style={[styles.dwBtnLabel, { color: '#ff4444' }]}>Withdraw</Text>
          <Text style={styles.dwBtnSub}>Send to external wallet</Text>
        </TouchableOpacity>
      </View>

      {/* Export key */}
      <View style={styles.actionsCard}>
        <TouchableOpacity
          style={[styles.bigActionBtn, styles.exportBtn]}
          onPress={handleExportKey}
          disabled={isExporting}
          activeOpacity={0.8}
        >
          {isExporting ? (
            <ActivityIndicator color="#f5a623" />
          ) : (
            <>
              <Text style={styles.bigActionBtnIcon}>🔑</Text>
              <View>
                <Text style={[styles.bigActionBtnTitle, { color: '#f5a623' }]}>
                  Export Private Key
                </Text>
                <Text style={styles.bigActionBtnSub}>Biometric protected</Text>
              </View>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Network info */}
      <View style={styles.networkCard}>
        <View style={styles.networkRow}>
          <Text style={styles.networkLabel}>Network</Text>
          <Text style={styles.networkValue}>Solana Mainnet</Text>
        </View>
        <View style={styles.networkRow}>
          <Text style={styles.networkLabel}>RPC</Text>
          <Text style={styles.networkValue}>Helius</Text>
        </View>
        <View style={styles.networkRow}>
          <Text style={styles.networkLabel}>DEX Router</Text>
          <Text style={styles.networkValue}>Jupiter v6</Text>
        </View>
        <View style={styles.networkRow}>
          <Text style={styles.networkLabel}>Platform Fee</Text>
          <Text style={styles.networkValue}>0.5%</Text>
        </View>
      </View>

      {/* Disconnect */}
      <TouchableOpacity
        style={styles.disconnectBtn}
        onPress={handleDisconnect}
        activeOpacity={0.8}
      >
        <Text style={styles.disconnectBtnText}>Disconnect Wallet</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0f',
  },
  content: {
    padding: 16,
    paddingBottom: 48,
  },
  notConnected: {
    flex: 1,
    backgroundColor: '#0a0a0f',
    justifyContent: 'center',
    alignItems: 'center',
  },
  notConnectedText: {
    color: '#555',
    fontSize: 16,
  },
  balanceCard: {
    backgroundColor: '#12121a',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#9945ff44',
  },
  balanceLabel: {
    color: '#888',
    fontSize: 13,
    marginBottom: 8,
  },
  balanceSOL: {
    color: '#fff',
    fontSize: 36,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  balanceUSD: {
    color: '#14f195',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 4,
  },
  solPrice: {
    color: '#555',
    fontSize: 12,
    marginTop: 6,
  },
  addressCard: {
    backgroundColor: '#12121a',
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#1e1e2e',
  },
  cardTitle: {
    color: '#888',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  fullAddress: {
    color: '#bbb',
    fontSize: 12,
    fontFamily: 'monospace',
    lineHeight: 20,
    marginBottom: 12,
  },
  addressActions: {
    flexDirection: 'row',
    gap: 10,
  },
  actionBtn: {
    flex: 1,
    backgroundColor: '#1e1e2e',
    borderRadius: 8,
    padding: 10,
    alignItems: 'center',
  },
  actionBtnText: {
    color: '#9945ff',
    fontSize: 13,
    fontWeight: '600',
  },
  depositWithdrawRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 14,
  },
  dwBtn: {
    flex: 1,
    alignItems: 'center',
    borderRadius: 14,
    paddingVertical: 18,
    paddingHorizontal: 10,
    borderWidth: 1.5,
    backgroundColor: 'transparent',
    gap: 4,
  },
  depositBtn: {
    borderColor: '#14f195',
  },
  withdrawBtn: {
    borderColor: '#ff4444',
  },
  dwBtnIcon: {
    fontSize: 22,
    marginBottom: 2,
  },
  dwBtnLabel: {
    fontSize: 15,
    fontWeight: '700',
  },
  dwBtnSub: {
    color: '#666',
    fontSize: 11,
    textAlign: 'center',
  },
  actionsCard: {
    gap: 12,
    marginBottom: 14,
  },
  bigActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#12121a',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1e1e2e',
  },
  exportBtn: {
    borderColor: '#f5a62333',
  },
  bigActionBtnIcon: {
    fontSize: 24,
  },
  bigActionBtnTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  bigActionBtnSub: {
    color: '#666',
    fontSize: 11,
    marginTop: 2,
  },
  networkCard: {
    backgroundColor: '#12121a',
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#1e1e2e',
    gap: 10,
  },
  networkRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  networkLabel: {
    color: '#666',
    fontSize: 13,
  },
  networkValue: {
    color: '#ccc',
    fontSize: 13,
    fontWeight: '600',
  },
  disconnectBtn: {
    backgroundColor: '#ff444422',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ff4444',
  },
  disconnectBtnText: {
    color: '#ff4444',
    fontSize: 16,
    fontWeight: '600',
  },
});

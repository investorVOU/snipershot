import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useWallet } from '../hooks/useWallet';
import { canUsePrivyNative, isExpoGo } from '../services/privy';

export default function OnboardingScreen() {
  const router = useRouter();
  const wallet = useWallet();

  // Already connected → go straight to feed
  useEffect(() => {
    if (wallet.connected) {
      router.replace('/(tabs)/feed');
    }
  }, [wallet.connected]);

  // In Expo Go, skip the login screen and auto-enter as guest
  useEffect(() => {
    if (isExpoGo && !wallet.connected && !wallet.isLoading) {
      wallet.connect('guest').then(() => {
        router.replace('/(tabs)/feed');
      });
    }
  }, [isExpoGo, wallet.connected, wallet.isLoading]);

  const handleConnect = async (method: 'email' | 'google' | 'guest') => {
    await wallet.connect(method);
    router.replace('/(tabs)/feed');
  };

  // Show spinner while auto-connecting in Expo Go or loading
  if (wallet.isLoading || isExpoGo) {
    return (
      <View style={styles.loadingContainer}>
        <View style={styles.logoRing}>
          <Text style={styles.logoEmoji}>🎯</Text>
        </View>
        <Text style={styles.appName}>SnapShot Sniper</Text>
        <ActivityIndicator size="large" color="#9945ff" style={{ marginTop: 32 }} />
        <Text style={styles.loadingText}>
          {isExpoGo ? 'Loading preview mode…' : 'Connecting…'}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Hero */}
      <View style={styles.hero}>
        <View style={styles.logoRing}>
          <Text style={styles.logoEmoji}>🎯</Text>
        </View>
        <Text style={styles.appName}>SnapShot Sniper</Text>
        <Text style={styles.tagline}>
          Snipe Solana memecoins{'\n'}the moment they launch
        </Text>
      </View>

      {/* Features */}
      <View style={styles.features}>
        {[
          { icon: '⚡', text: 'Real-time Pump.fun detection' },
          { icon: '🛡️', text: 'Automated rug filter scoring' },
          { icon: '🤖', text: 'Auto-snipe with TP/SL' },
          { icon: '🔒', text: 'Non-custodial embedded wallet' },
        ].map((f, i) => (
          <View key={i} style={styles.featureRow}>
            <Text style={styles.featureIcon}>{f.icon}</Text>
            <Text style={styles.featureText}>{f.text}</Text>
          </View>
        ))}
      </View>

      {/* Auth buttons — only shown in dev build */}
      <View style={styles.authButtons}>
        {canUsePrivyNative && (
          <>
            <TouchableOpacity
              style={[styles.authBtn, styles.primaryBtn]}
              onPress={() => handleConnect('email')}
              activeOpacity={0.8}
            >
              <Text style={styles.authBtnText}>✉️  Connect with Email</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.authBtn, styles.secondaryBtn]}
              onPress={() => handleConnect('google')}
              activeOpacity={0.8}
            >
              <Text style={styles.authBtnText}>🌐  Connect with Google</Text>
            </TouchableOpacity>
          </>
        )}
        <TouchableOpacity
          style={[styles.authBtn, canUsePrivyNative ? styles.ghostBtn : styles.primaryBtn]}
          onPress={() => handleConnect('guest')}
          activeOpacity={0.8}
        >
          <Text style={styles.authBtnText}>
            {canUsePrivyNative ? '👻  Continue as Guest' : '🚀  Enter App'}
          </Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.disclaimer}>
        Platform fee: 0.5% on all swaps via Jupiter.{'\n'}
        Non-custodial embedded wallet via Privy.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0f',
    padding: 24,
    justifyContent: 'space-between',
    paddingTop: 80,
    paddingBottom: 48,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0a0a0f',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  hero: { alignItems: 'center', gap: 12 },
  logoRing: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#9945ff22',
    borderWidth: 2,
    borderColor: '#9945ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  logoEmoji: { fontSize: 44 },
  appName: { color: '#fff', fontSize: 30, fontWeight: '800', letterSpacing: -0.5 },
  tagline: { color: '#888', fontSize: 16, textAlign: 'center', lineHeight: 24 },
  loadingText: { color: '#555', fontSize: 14, marginTop: 8 },
  features: {
    gap: 12,
    backgroundColor: '#12121a',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#1e1e2e',
  },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  featureIcon: { fontSize: 20, width: 28, textAlign: 'center' },
  featureText: { color: '#ccc', fontSize: 15 },
  authButtons: { gap: 12 },
  authBtn: { borderRadius: 14, padding: 16, alignItems: 'center', justifyContent: 'center' },
  primaryBtn: { backgroundColor: '#9945ff' },
  secondaryBtn: { backgroundColor: '#1e1e2e', borderWidth: 1, borderColor: '#333' },
  ghostBtn: { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#333' },
  authBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  disclaimer: { color: '#444', fontSize: 11, textAlign: 'center', lineHeight: 17 },
});

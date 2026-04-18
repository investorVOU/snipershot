import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useWallet } from '../hooks/useWallet';
import { canUsePrivyNative } from '../services/privy';

export default function LoginScreen() {
  const router = useRouter();
  const wallet = useWallet();
  const insets = useSafeAreaInsets();
  const [connecting, setConnecting] = useState<string | null>(null);

  // Already connected → go straight to feed
  useEffect(() => {
    if (wallet.connected && !wallet.isLoading) {
      router.replace('/(tabs)/feed');
    }
  }, [wallet.connected, wallet.isLoading]);

  const handleConnect = async (method: 'email' | 'google' | 'guest') => {
    setConnecting(method);
    try {
      await wallet.connect(method);
      router.replace('/(tabs)/feed');
    } catch {
      setConnecting(null);
    }
  };

  if (wallet.isLoading) {
    return (
      <View style={[styles.loading, { paddingTop: insets.top }]}>
        <View style={styles.logoRing}>
          <Text style={styles.logoEmoji}>🎯</Text>
        </View>
        <Text style={styles.appName}>SniperShot</Text>
        <ActivityIndicator size="large" color="#9945ff" style={{ marginTop: 32 }} />
        <Text style={styles.loadingText}>Connecting…</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
      {/* Hero */}
      <View style={styles.hero}>
        <View style={styles.logoRing}>
          <Text style={styles.logoEmoji}>🎯</Text>
        </View>
        <Text style={styles.appName}>SniperShot</Text>
        <Text style={styles.tagline}>
          Snipe Solana memecoins{'\n'}the moment they launch
        </Text>
      </View>

      {/* Features */}
      <View style={styles.features}>
        {[
          { icon: 'zap', text: 'Real-time Pump.fun detection' },
          { icon: 'shield', text: 'AI-powered rug filter scoring' },
          { icon: 'cpu', text: 'Groq AI analysis per token' },
          { icon: 'lock', text: 'Non-custodial embedded wallet via Privy' },
        ].map((f) => (
          <View key={f.icon} style={styles.featureRow}>
            <Feather name={f.icon as any} size={18} color="#9945ff" />
            <Text style={styles.featureText}>{f.text}</Text>
          </View>
        ))}
      </View>

      {/* Auth buttons */}
      <View style={styles.authButtons}>
        {canUsePrivyNative ? (
          <>
            <TouchableOpacity
              style={[styles.authBtn, styles.primaryBtn]}
              onPress={() => handleConnect('email')}
              disabled={!!connecting}
              activeOpacity={0.8}
            >
              {connecting === 'email' ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Feather name="mail" size={18} color="#fff" />
                  <Text style={styles.authBtnText}>Continue with Email</Text>
                </>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.authBtn, styles.secondaryBtn]}
              onPress={() => handleConnect('google')}
              disabled={!!connecting}
              activeOpacity={0.8}
            >
              {connecting === 'google' ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Feather name="globe" size={18} color="#fff" />
                  <Text style={styles.authBtnText}>Continue with Google</Text>
                </>
              )}
            </TouchableOpacity>
            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>
          </>
        ) : (
          <View style={[styles.privyNote, { borderColor: '#9945ff44' }]}>
            <Feather name="info" size={14} color="#9945ff" />
            <Text style={styles.privyNoteText}>
              Privy login (email/Google) requires a dev build.{'\n'}Use Guest mode to explore in Expo Go.
            </Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.authBtn, styles.ghostBtn]}
          onPress={() => handleConnect('guest')}
          disabled={!!connecting}
          activeOpacity={0.8}
        >
          {connecting === 'guest' ? (
            <ActivityIndicator color="#9945ff" />
          ) : (
            <>
              <Feather name="eye" size={18} color="#9945ff" />
              <Text style={[styles.authBtnText, { color: '#9945ff' }]}>Continue as Guest</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      <Text style={styles.disclaimer}>
        0.5% platform fee on all swaps · Non-custodial via Privy
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0f',
    paddingHorizontal: 24,
    justifyContent: 'space-between',
  },
  loading: {
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
    marginBottom: 4,
  },
  logoEmoji: { fontSize: 44 },
  appName: { color: '#fff', fontSize: 32, fontWeight: '800', letterSpacing: -0.5 },
  tagline: { color: '#666', fontSize: 16, textAlign: 'center', lineHeight: 24 },
  loadingText: { color: '#555', fontSize: 14, marginTop: 8 },
  features: {
    gap: 14,
    backgroundColor: '#12121a',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#1e1e2e',
  },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  featureText: { color: '#ccc', fontSize: 14, flex: 1 },
  authButtons: { gap: 12 },
  authBtn: {
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
    minHeight: 54,
  },
  primaryBtn: { backgroundColor: '#9945ff' },
  secondaryBtn: { backgroundColor: '#1a1a2e', borderWidth: 1, borderColor: '#333' },
  ghostBtn: { backgroundColor: '#9945ff11', borderWidth: 1.5, borderColor: '#9945ff55' },
  authBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#1e1e2e' },
  dividerText: { color: '#444', fontSize: 13 },
  privyNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#9945ff11',
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
  },
  privyNoteText: { color: '#888', fontSize: 13, lineHeight: 19, flex: 1 },
  disclaimer: { color: '#333', fontSize: 11, textAlign: 'center', lineHeight: 17 },
});

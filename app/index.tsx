import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useWallet } from '../hooks/useWallet';
import {
  signInWithEmail,
  signInWithGoogle,
  signInWithTwitter,
  signUpWithEmail,
} from '../hooks/useAuthWallet';

type AuthMode = 'login' | 'signup';

export default function LoginScreen() {
  const router = useRouter();
  const wallet = useWallet();
  const insets = useSafeAreaInsets();

  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  // Redirect when authenticated (not guest)
  useEffect(() => {
    if (wallet.connected && !wallet.isLoading && wallet.authMethod !== 'guest') {
      router.replace('/(tabs)/feed');
    }
  }, [wallet.connected, wallet.isLoading, wallet.authMethod]);

  const handleEmailAuth = async () => {
    if (!email.trim() || !password.trim()) { setError('Enter email and password'); return; }
    setError(''); setInfo(''); setBusy(true);
    try {
      if (mode === 'signup') {
        await signUpWithEmail(email.trim(), password);
        setInfo('Account created! Check your email to confirm, then sign in.');
        setMode('login');
      } else {
        await signInWithEmail(email.trim(), password);
        router.replace('/(tabs)/feed');
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Auth failed');
    } finally {
      setBusy(false);
    }
  };

  const handleGoogle = async () => {
    setError(''); setBusy(true);
    try {
      await signInWithGoogle();
      // onAuthStateChange will fire → wallet loads → redirect via useEffect
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Google sign-in failed');
    } finally {
      setBusy(false);
    }
  };

  const handleTwitter = async () => {
    setError(''); setBusy(true);
    try {
      await signInWithTwitter();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Twitter sign-in failed');
    } finally {
      setBusy(false);
    }
  };

  const handleGuest = async () => {
    setBusy(true);
    await wallet.connect('guest');
    router.replace('/(tabs)/feed');
    setBusy(false);
  };

  if (wallet.isLoading) {
    return (
      <View style={styles.center}>
        <View style={styles.logoRing}>
          <Text style={styles.logoEmoji}>🎯</Text>
        </View>
        <Text style={styles.appName}>SniperShot</Text>
        <ActivityIndicator size="large" color="#9945ff" style={{ marginTop: 32 }} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={{ flex: 1, backgroundColor: '#0a0a0f' }}
        contentContainerStyle={[styles.container, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled"
      >
        {/* Hero */}
        <View style={styles.hero}>
          <View style={styles.logoRing}>
            <Text style={styles.logoEmoji}>🎯</Text>
          </View>
          <Text style={styles.appName}>SniperShot</Text>
          <Text style={styles.tagline}>Snipe Solana memecoins{'\n'}the moment they launch</Text>
        </View>

        {/* Email / password form */}
        <View style={styles.form}>
          <View style={styles.modeToggle}>
            {(['login', 'signup'] as AuthMode[]).map((m) => (
              <TouchableOpacity
                key={m}
                style={[styles.modeBtn, mode === m && styles.modeBtnActive]}
                onPress={() => { setMode(m); setError(''); setInfo(''); }}
              >
                <Text style={[styles.modeBtnText, mode === m && styles.modeBtnTextActive]}>
                  {m === 'login' ? 'Sign In' : 'Create Account'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor="#444"
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
            editable={!busy}
          />
          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor="#444"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            editable={!busy}
          />

          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          {info ? <Text style={styles.infoText}>{info}</Text> : null}

          <TouchableOpacity style={styles.primaryBtn} onPress={handleEmailAuth} disabled={busy} activeOpacity={0.85}>
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Feather name="mail" size={16} color="#fff" />
                <Text style={styles.primaryBtnText}>{mode === 'login' ? 'Sign In with Email' : 'Create Account'}</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Social auth */}
        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or continue with</Text>
          <View style={styles.dividerLine} />
        </View>

        <View style={styles.socialRow}>
          <TouchableOpacity style={styles.socialBtn} onPress={handleGoogle} disabled={busy} activeOpacity={0.8}>
            <Feather name="globe" size={18} color="#fff" />
            <Text style={styles.socialBtnText}>Google</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.socialBtn} onPress={handleTwitter} disabled={busy} activeOpacity={0.8}>
            <Text style={styles.xIcon}>𝕏</Text>
            <Text style={styles.socialBtnText}>Twitter / X</Text>
          </TouchableOpacity>
        </View>

        {/* Guest mode */}
        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or</Text>
          <View style={styles.dividerLine} />
        </View>

        <TouchableOpacity style={styles.guestBtn} onPress={handleGuest} disabled={busy} activeOpacity={0.8}>
          <Feather name="eye" size={16} color="#9945ff" />
          <Text style={styles.guestBtnText}>Browse as Guest</Text>
        </TouchableOpacity>

        <Text style={styles.disclaimer}>
          By continuing you accept our Terms of Service.{'\n'}
          Your embedded wallet private key is encrypted and stored securely.{'\n'}
          0.5% platform fee on all swaps.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, backgroundColor: '#0a0a0f', justifyContent: 'center', alignItems: 'center', gap: 12 },
  container: { paddingHorizontal: 24, gap: 20 },
  hero: { alignItems: 'center', gap: 10 },
  logoRing: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: '#9945ff22', borderWidth: 2, borderColor: '#9945ff',
    justifyContent: 'center', alignItems: 'center',
  },
  logoEmoji: { fontSize: 42 },
  appName: { color: '#fff', fontSize: 30, fontWeight: '800', letterSpacing: -0.5 },
  tagline: { color: '#555', fontSize: 15, textAlign: 'center', lineHeight: 22 },
  form: { gap: 10 },
  modeToggle: { flexDirection: 'row', backgroundColor: '#12121a', borderRadius: 10, padding: 4, gap: 4 },
  modeBtn: { flex: 1, paddingVertical: 9, alignItems: 'center', borderRadius: 8 },
  modeBtnActive: { backgroundColor: '#9945ff' },
  modeBtnText: { color: '#555', fontSize: 14, fontWeight: '600' },
  modeBtnTextActive: { color: '#fff' },
  input: {
    backgroundColor: '#12121a', borderWidth: 1, borderColor: '#1e1e2e',
    borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14,
    color: '#fff', fontSize: 15,
  },
  errorText: { color: '#ef4444', fontSize: 13, textAlign: 'center' },
  infoText: { color: '#14f195', fontSize: 13, textAlign: 'center' },
  primaryBtn: {
    backgroundColor: '#9945ff', borderRadius: 14,
    paddingVertical: 16, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center', gap: 10, minHeight: 54,
  },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#1e1e2e' },
  dividerText: { color: '#333', fontSize: 12 },
  socialRow: { flexDirection: 'row', gap: 12 },
  socialBtn: {
    flex: 1, backgroundColor: '#12121a', borderWidth: 1, borderColor: '#1e1e2e',
    borderRadius: 12, paddingVertical: 14, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  socialBtnText: { color: '#ddd', fontSize: 14, fontWeight: '600' },
  xIcon: { color: '#fff', fontSize: 16, fontWeight: '800' },
  guestBtn: {
    backgroundColor: '#9945ff11', borderWidth: 1.5, borderColor: '#9945ff44',
    borderRadius: 12, paddingVertical: 14, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  guestBtnText: { color: '#9945ff', fontSize: 15, fontWeight: '600' },
  disclaimer: { color: '#2a2a3a', fontSize: 10, textAlign: 'center', lineHeight: 16 },
});

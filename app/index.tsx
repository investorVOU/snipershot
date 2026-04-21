import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useWallet } from '../hooks/useWallet';
import {
  signInWithEmail,
  signInWithGoogle,
  signInWithTwitter,
  signUpWithEmail,
} from '../hooks/useAuthWallet';
import { supabase } from '../services/supabase';
import { ONBOARDING_KEY } from './onboarding';

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
  const [showResend, setShowResend] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [onboardingChecked, setOnboardingChecked] = useState(false);
  const [onboardingDone, setOnboardingDone] = useState(false);

  // Check onboarding status once on mount
  useEffect(() => {
    AsyncStorage.getItem(ONBOARDING_KEY)
      .then((val) => setOnboardingDone(val === 'true'))
      .catch(() => setOnboardingDone(true))
      .finally(() => setOnboardingChecked(true));
  }, []);

  // Navigation gate: waits for both wallet and onboarding check to resolve
  useEffect(() => {
    if (wallet.isLoading || !onboardingChecked) return;

    if (wallet.connected && wallet.authMethod !== 'guest') {
      router.replace('/(tabs)/feed');
      return;
    }

    if (!onboardingDone) {
      router.replace('/onboarding');
    }
  }, [wallet.isLoading, wallet.connected, wallet.authMethod, onboardingChecked, onboardingDone, router]);

  const handleEmailAuth = async () => {
    if (!email.trim() || !password.trim()) {
      setError('Enter email and password');
      return;
    }

    setError('');
    setInfo('');
    setShowResend(false);
    setBusy(true);

    try {
      if (mode === 'signup') {
        await signUpWithEmail(email.trim(), password);
        setInfo('Account created! Check your email to confirm your address, then sign in.');
        setMode('login');
      } else {
        await signInWithEmail(email.trim(), password);
        router.replace('/(tabs)/feed');
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Auth failed';
      if (msg.toLowerCase().includes('email not confirmed')) {
        setError('Please confirm your email first. Check your inbox and spam folder.');
        setShowResend(true);
      } else {
        setError(msg);
      }
    } finally {
      setBusy(false);
    }
  };

  const handleResendConfirmation = async () => {
    if (resendCooldown > 0 || !email.trim()) return;

    try {
      await supabase.auth.resend({ type: 'signup', email: email.trim() });
      setInfo('Confirmation email resent! Check your inbox.');
      setResendCooldown(60);
      const interval = setInterval(() => {
        setResendCooldown((c) => {
          if (c <= 1) {
            clearInterval(interval);
            return 0;
          }
          return c - 1;
        });
      }, 1000);
    } catch {
      setError('Failed to resend. Try again in a moment.');
    }
  };

  const handleGoogle = async () => {
    setError('');
    setBusy(true);
    try {
      await signInWithGoogle();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Google sign-in failed');
    } finally {
      setBusy(false);
    }
  };

  const handleTwitter = async () => {
    setError('');
    setBusy(true);
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

  const brandMark = (
    <View style={styles.logoRing}>
      <Image source={require('../assets/icon.png')} style={styles.logoImage} resizeMode="contain" />
    </View>
  );

  if (wallet.isLoading || !onboardingChecked) {
    return (
      <View style={styles.center}>
        {brandMark}
        <Text style={styles.appName}>SniperShot</Text>
        <ActivityIndicator size="large" color="#27c985" style={{ marginTop: 32 }} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={{ flex: 1, backgroundColor: '#0a0f16' }}
        contentContainerStyle={[styles.container, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.hero}>
          {brandMark}
          <Text style={styles.appName}>SniperShot</Text>
          <Text style={styles.tagline}>Snipe Solana memecoins{'\n'}the moment they launch</Text>
        </View>

        <View style={styles.form}>
          <View style={styles.modeToggle}>
            {(['login', 'signup'] as AuthMode[]).map((m) => (
              <TouchableOpacity
                key={m}
                style={[styles.modeBtn, mode === m && styles.modeBtnActive]}
                onPress={() => {
                  setMode(m);
                  setError('');
                  setInfo('');
                }}
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
            placeholderTextColor="#46505d"
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
            editable={!busy}
          />
          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor="#46505d"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            editable={!busy}
          />

          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          {info ? <Text style={styles.infoText}>{info}</Text> : null}
          {showResend && (
            <TouchableOpacity onPress={handleResendConfirmation} disabled={resendCooldown > 0} activeOpacity={0.7}>
              <Text style={[styles.resendText, resendCooldown > 0 && { opacity: 0.4 }]}>
                {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend confirmation email'}
              </Text>
            </TouchableOpacity>
          )}

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
            <Text style={styles.xIcon}>X</Text>
            <Text style={styles.socialBtnText}>Twitter / X</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or</Text>
          <View style={styles.dividerLine} />
        </View>

        <TouchableOpacity style={styles.guestBtn} onPress={handleGuest} disabled={busy} activeOpacity={0.8}>
          <Feather name="eye" size={16} color="#27c985" />
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
  center: { flex: 1, backgroundColor: '#0a0f16', justifyContent: 'center', alignItems: 'center', gap: 12 },
  container: { paddingHorizontal: 24, gap: 20 },
  hero: { alignItems: 'center', gap: 12 },
  logoRing: {
    width: 96,
    height: 96,
    borderRadius: 28,
    backgroundColor: '#121925',
    borderWidth: 1.5,
    borderColor: '#2d3745',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.22,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
  },
  logoImage: { width: 78, height: 78, borderRadius: 20 },
  appName: { color: '#f3f6f8', fontSize: 30, fontWeight: '800', letterSpacing: -0.5 },
  tagline: { color: '#7e8a99', fontSize: 15, textAlign: 'center', lineHeight: 22 },
  form: { gap: 10 },
  modeToggle: { flexDirection: 'row', backgroundColor: '#121925', borderRadius: 10, padding: 4, gap: 4 },
  modeBtn: { flex: 1, paddingVertical: 9, alignItems: 'center', borderRadius: 8 },
  modeBtnActive: { backgroundColor: '#27c985' },
  modeBtnText: { color: '#7e8a99', fontSize: 14, fontWeight: '600' },
  modeBtnTextActive: { color: '#08110d' },
  input: {
    backgroundColor: '#121925',
    borderWidth: 1,
    borderColor: '#202b38',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: '#f3f6f8',
    fontSize: 15,
  },
  errorText: { color: '#ef4444', fontSize: 13, textAlign: 'center' },
  infoText: { color: '#27c985', fontSize: 13, textAlign: 'center' },
  resendText: { color: '#27c985', fontSize: 13, textAlign: 'center', textDecorationLine: 'underline' },
  primaryBtn: {
    backgroundColor: '#27c985',
    borderRadius: 14,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    minHeight: 54,
  },
  primaryBtnText: { color: '#08110d', fontSize: 16, fontWeight: '800' },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#202b38' },
  dividerText: { color: '#475261', fontSize: 12 },
  socialRow: { flexDirection: 'row', gap: 12 },
  socialBtn: {
    flex: 1,
    backgroundColor: '#121925',
    borderWidth: 1,
    borderColor: '#202b38',
    borderRadius: 12,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  socialBtnText: { color: '#dce1e6', fontSize: 14, fontWeight: '600' },
  xIcon: { color: '#fff', fontSize: 16, fontWeight: '800' },
  guestBtn: {
    backgroundColor: '#27c98512',
    borderWidth: 1.5,
    borderColor: '#27c98544',
    borderRadius: 12,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  guestBtnText: { color: '#27c985', fontSize: 15, fontWeight: '700' },
  disclaimer: { color: '#3c4653', fontSize: 10, textAlign: 'center', lineHeight: 16 },
});

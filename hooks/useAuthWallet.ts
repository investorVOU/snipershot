import { useState, useEffect, useCallback } from 'react';
import {
  Keypair,
  PublicKey,
  VersionedTransaction,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';
import type { Session } from '@supabase/supabase-js';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { supabase } from '../services/supabase';
import { getOrCreateWallet, clearWalletCache } from '../services/embeddedWallet';
import { getConnection } from '../services/jupiter';
import type { WalletContextValue } from './useWallet';

WebBrowser.maybeCompleteAuthSession();

export function useAuthWallet(): WalletContextValue {
  const [session, setSession] = useState<Session | null>(null);
  const [keypair, setKeypair] = useState<Keypair | null>(null);
  const [solBalance, setSolBalance] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [authMethod, setAuthMethod] = useState<'email' | 'google' | 'twitter' | 'guest' | null>(null);

  // ── Supabase auth state ─────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (!data.session) setIsLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
    });
    return () => subscription.unsubscribe();
  }, []);

  // ── Load / generate wallet on login ────────────────────────────────────────
  useEffect(() => {
    if (!session?.user) {
      if (authMethod !== 'guest') {
        setKeypair(null);
        setAuthMethod(null);
      }
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    const provider = session.user.app_metadata?.provider ?? 'email';
    setAuthMethod(provider === 'google' ? 'google' : provider === 'twitter' ? 'twitter' : 'email');
    getOrCreateWallet(session.user.id)
      .then(setKeypair)
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, [session?.user?.id]);

  // ── Balance polling ─────────────────────────────────────────────────────────
  const refreshBalance = useCallback(async () => {
    if (!keypair) return;
    try {
      const lamports = await getConnection().getBalance(keypair.publicKey);
      setSolBalance(lamports / LAMPORTS_PER_SOL);
    } catch { setSolBalance(0); }
  }, [keypair]);

  useEffect(() => {
    if (!keypair) return;
    refreshBalance();
    const id = setInterval(refreshBalance, 15_000);
    return () => clearInterval(id);
  }, [keypair, refreshBalance]);

  // ── Connect (used for guest mode) ──────────────────────────────────────────
  const connect = useCallback(async (method: 'email' | 'google' | 'guest') => {
    if (method === 'guest') {
      const guestKp = Keypair.generate();
      setKeypair(guestKp);
      setAuthMethod('guest');
    }
    // email / google are handled by signInWithEmail / signInWithGoogle
  }, []);

  // ── Disconnect ─────────────────────────────────────────────────────────────
  const disconnect = useCallback(async () => {
    if (session?.user) await clearWalletCache(session.user.id).catch(() => {});
    await supabase.auth.signOut().catch(() => {});
    setKeypair(null);
    setAuthMethod(null);
    setSolBalance(0);
  }, [session?.user?.id]);

  // ── Transaction signing ─────────────────────────────────────────────────────
  const signTransaction = useCallback(async (tx: VersionedTransaction) => {
    if (!keypair) throw new Error('No wallet connected');
    if (authMethod === 'guest') throw new Error('Login required to send transactions.');
    tx.sign([keypair]);
    return tx;
  }, [keypair, authMethod]);

  const signAllTransactions = useCallback(async (txs: VersionedTransaction[]) => {
    if (!keypair) throw new Error('No wallet connected');
    return txs.map((tx) => { tx.sign([keypair]); return tx; });
  }, [keypair]);

  return {
    publicKey: keypair?.publicKey ?? null,
    address: keypair?.publicKey.toBase58() ?? null,
    connected: !!keypair,
    solBalance,
    isLoading,
    authMethod: authMethod as 'email' | 'google' | 'guest' | null,
    connect,
    disconnect,
    signTransaction,
    signAllTransactions,
    refreshBalance,
  };
}

// ─── Standalone auth functions (called from login screen) ─────────────────────

export async function signUpWithEmail(email: string, password: string): Promise<void> {
  const { error } = await supabase.auth.signUp({ email, password });
  if (error) throw new Error(error.message);
}

export async function signInWithEmail(email: string, password: string): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);
}

export async function signInWithGoogle(): Promise<void> {
  const redirectUrl = Linking.createURL('/');
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: redirectUrl, skipBrowserRedirect: true },
  });
  if (error) throw new Error(error.message);
  if (!data.url) return;

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);
  if (result.type === 'success') {
    // Parse tokens from URL hash or query params
    const url = result.url;
    const hashParams = new URLSearchParams(url.includes('#') ? url.split('#')[1] : url.split('?')[1] ?? '');
    const access_token = hashParams.get('access_token');
    const refresh_token = hashParams.get('refresh_token');
    if (access_token && refresh_token) {
      await supabase.auth.setSession({ access_token, refresh_token });
    }
  }
}

export async function signInWithTwitter(): Promise<void> {
  const redirectUrl = Linking.createURL('/');
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'twitter',
    options: { redirectTo: redirectUrl, skipBrowserRedirect: true },
  });
  if (error) throw new Error(error.message);
  if (!data.url) return;

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);
  if (result.type === 'success') {
    const url = result.url;
    const hashParams = new URLSearchParams(url.includes('#') ? url.split('#')[1] : url.split('?')[1] ?? '');
    const access_token = hashParams.get('access_token');
    const refresh_token = hashParams.get('refresh_token');
    if (access_token && refresh_token) {
      await supabase.auth.setSession({ access_token, refresh_token });
    }
  }
}

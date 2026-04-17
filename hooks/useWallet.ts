import { useState, useEffect, useCallback, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PublicKey, VersionedTransaction, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { getConnection } from '../services/jupiter';
import { canUsePrivyNative, loadPrivyModule } from '../services/privy';

const WALLET_KEY = 'snapshot_sniper_wallet';

export interface WalletContextValue {
  publicKey: PublicKey | null;
  address: string | null;
  connected: boolean;
  solBalance: number;
  isLoading: boolean;
  authMethod: 'email' | 'google' | 'guest' | null;
  connect: (method: 'email' | 'google' | 'guest') => Promise<void>;
  disconnect: () => Promise<void>;
  signTransaction: (tx: VersionedTransaction) => Promise<VersionedTransaction>;
  signAllTransactions: (txs: VersionedTransaction[]) => Promise<VersionedTransaction[]>;
  refreshBalance: () => Promise<void>;
}

// ─── Guest / Expo Go wallet (no Privy) ──────────────────────────────────────

function useGuestWallet(): WalletContextValue {
  const [address, setAddress] = useState<string | null>(null);
  const [solBalance, setSolBalance] = useState(0);
  const [connected, setConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [authMethod, setAuthMethod] = useState<'email' | 'google' | 'guest' | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(WALLET_KEY).then((raw) => {
      if (!raw) return;
      const stored = JSON.parse(raw) as { authMethod: string };
      setConnected(true);
      setAuthMethod(stored.authMethod as 'guest');
    }).catch(() => {});
  }, []);

  const refreshBalance = useCallback(async () => {
    if (!address) return;
    try {
      const lamports = await getConnection().getBalance(new PublicKey(address));
      setSolBalance(lamports / LAMPORTS_PER_SOL);
    } catch { setSolBalance(0); }
  }, [address]);

  const connect = useCallback(async (method: 'email' | 'google' | 'guest') => {
    setIsLoading(true);
    try {
      await AsyncStorage.setItem(WALLET_KEY, JSON.stringify({ authMethod: method }));
      setConnected(true);
      setAuthMethod(method);
    } finally { setIsLoading(false); }
  }, []);

  const disconnect = useCallback(async () => {
    await AsyncStorage.removeItem(WALLET_KEY);
    setConnected(false);
    setAddress(null);
    setSolBalance(0);
    setAuthMethod(null);
  }, []);

  const signTransaction = useCallback(async (_tx: VersionedTransaction): Promise<VersionedTransaction> => {
    throw new Error('Transaction signing requires a dev build. Running in Expo Go (guest mode).');
  }, []);

  const signAllTransactions = useCallback(async (_txs: VersionedTransaction[]): Promise<VersionedTransaction[]> => {
    throw new Error('Transaction signing requires a dev build. Running in Expo Go (guest mode).');
  }, []);

  return {
    publicKey: address ? new PublicKey(address) : null,
    address,
    connected,
    solBalance,
    isLoading,
    authMethod,
    connect,
    disconnect,
    signTransaction,
    signAllTransactions,
    refreshBalance,
  };
}

// ─── Privy wallet (dev build only) ──────────────────────────────────────────

type PrivyModule = {
  usePrivy: () => {
    ready: boolean;
    authenticated: boolean;
    user?: {
      linkedAccounts?: Array<Record<string, unknown>>;
      email?: { address?: string } | null;
      google?: { email?: string; name?: string } | null;
    } | null;
    logout: () => Promise<void>;
  };
  useEmbeddedSolanaWallet: () => {
    wallets: Array<{
      address?: string;
      getProvider: () => Promise<{
        request: (args: Record<string, unknown>) => Promise<unknown>;
      }>;
    }>;
  };
};

function usePrivyWallet(): WalletContextValue {
  const privy = loadPrivyModule<PrivyModule>();
  if (!privy) throw new Error('Privy not available');

  const { ready, authenticated, user, logout } = privy.usePrivy();
  const { wallets } = privy.useEmbeddedSolanaWallet();
  const [solBalance, setSolBalance] = useState(0);

  const address = useMemo(() => wallets[0]?.address ?? null, [wallets]);
  const publicKey = useMemo(() => address ? new PublicKey(address) : null, [address]);

  const authMethod = useMemo((): 'email' | 'google' | 'guest' | null => {
    const accounts = user?.linkedAccounts ?? [];
    if (accounts.some((a) => a.type === 'google_oauth')) return 'google';
    if (accounts.some((a) => a.type === 'email')) return 'email';
    return null;
  }, [user?.linkedAccounts]);

  const refreshBalance = useCallback(async () => {
    if (!address) return;
    try {
      const lamports = await getConnection().getBalance(new PublicKey(address));
      setSolBalance(lamports / LAMPORTS_PER_SOL);
    } catch { setSolBalance(0); }
  }, [address]);

  useEffect(() => {
    if (authenticated && address) {
      refreshBalance();
      const interval = setInterval(refreshBalance, 15_000);
      return () => clearInterval(interval);
    }
  }, [authenticated, address, refreshBalance]);

  const connect = useCallback(async (_method: 'email' | 'google' | 'guest') => {
    // Login is triggered by the onboarding screen via useLoginWithEmail / useLoginWithOAuth
    // This hook just exposes the resulting state
  }, []);

  const disconnect = useCallback(async () => { await logout(); }, [logout]);

  const signTransaction = useCallback(async (tx: VersionedTransaction): Promise<VersionedTransaction> => {
    const provider = await wallets[0]?.getProvider();
    if (!provider) throw new Error('No Solana wallet ready');
    const result = await provider.request({ method: 'signTransaction', params: { transaction: tx } });
    return result as VersionedTransaction;
  }, [wallets]);

  const signAllTransactions = useCallback(async (txs: VersionedTransaction[]): Promise<VersionedTransaction[]> => {
    const provider = await wallets[0]?.getProvider();
    if (!provider) throw new Error('No Solana wallet ready');
    const result = await provider.request({ method: 'signAllTransactions', params: { transactions: txs } });
    return Array.isArray(result) ? result as VersionedTransaction[] : [];
  }, [wallets]);

  return {
    publicKey,
    address: address ?? null,
    connected: Boolean(ready && authenticated && address),
    solBalance,
    isLoading: !ready,
    authMethod,
    connect,
    disconnect,
    signTransaction,
    signAllTransactions,
    refreshBalance,
  };
}

// ─── Public hook — auto-selects mode ────────────────────────────────────────
// canUsePrivyNative is a module-level constant that never changes, so picking
// the implementation here is safe — React always sees the same hook call site.
const _useWalletImpl: () => WalletContextValue = canUsePrivyNative
  ? usePrivyWallet
  : useGuestWallet;

export function useWallet(): WalletContextValue {
  return _useWalletImpl();
}

import { PublicKey, VersionedTransaction } from '@solana/web3.js';
import { useAuthWallet } from './useAuthWallet';

export interface WalletContextValue {
  publicKey: PublicKey | null;
  address: string | null;
  connected: boolean;
  solBalance: number;
  isLoading: boolean;
  authMethod: 'email' | 'google' | 'twitter' | 'guest' | null;
  connect: (method: 'email' | 'google' | 'guest') => Promise<void>;
  disconnect: () => Promise<void>;
  signTransaction: (tx: VersionedTransaction) => Promise<VersionedTransaction>;
  signAllTransactions: (txs: VersionedTransaction[]) => Promise<VersionedTransaction[]>;
  refreshBalance: () => Promise<void>;
  sendSOL: (toAddress: string, amountSOL: number) => Promise<string>;
}

export function useWallet(): WalletContextValue {
  return useAuthWallet() as WalletContextValue;
}

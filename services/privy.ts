import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';

export const PRIVY_APP_ID = process.env.EXPO_PUBLIC_PRIVY_APP_ID ?? '';
export const PRIVY_CLIENT_ID = process.env.EXPO_PUBLIC_PRIVY_CLIENT_ID ?? '';

/** True when running inside Expo Go (StoreClient) */
export const isExpoGo =
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

export const isPrivyConfigured = Boolean(PRIVY_APP_ID && PRIVY_CLIENT_ID);

/**
 * Privy's native SDK requires a custom dev build — it cannot run inside Expo Go.
 * When this is false the app falls back to guest/read-only mode.
 */
export const canUsePrivyNative =
  Platform.OS !== 'web' && isPrivyConfigured && !isExpoGo;

/** Dynamic require so Metro never evaluates @privy-io/expo in Expo Go */
export function loadPrivyModule<T>(): T | null {
  if (!canUsePrivyNative) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('@privy-io/expo') as T;
  } catch {
    return null;
  }
}

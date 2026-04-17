/// <reference types="react-native" />

declare module '*.png' {
  const value: import('react-native').ImageSourcePropType;
  export default value;
}

declare module '*.jpg' {
  const value: import('react-native').ImageSourcePropType;
  export default value;
}

// Ensure Buffer is available globally
declare const Buffer: typeof import('buffer').Buffer;

// Env vars
declare namespace NodeJS {
  interface ProcessEnv {
    EXPO_PUBLIC_PRIVY_APP_ID: string;
    EXPO_PUBLIC_HELIUS_KEY: string;
    EXPO_PUBLIC_FEE_ACCOUNT: string;
    EXPO_PUBLIC_BIRDEYE_KEY: string;
    EXPO_PUBLIC_SUPABASE_URL: string;
    EXPO_PUBLIC_SUPABASE_ANON_KEY: string;
  }
}

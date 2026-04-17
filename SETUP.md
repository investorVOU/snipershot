# SnapShot Sniper — Setup Guide

## 1. Prerequisites

- Node.js 18+
- Expo CLI: `npm install -g expo-cli eas-cli`
- iOS: Xcode 15+ / Android: Android Studio Hedgehog+

## 2. Install dependencies

```bash
npm install
```

## 3. Configure environment variables

Copy `.env.example` to `.env` and fill in all values:

```bash
cp .env.example .env
```

| Variable                    | Where to get it                                      |
|-----------------------------|------------------------------------------------------|
| EXPO_PUBLIC_PRIVY_APP_ID    | https://console.privy.io                             |
| EXPO_PUBLIC_HELIUS_KEY      | https://dev.helius.xyz                               |
| EXPO_PUBLIC_FEE_ACCOUNT     | Your Solana wallet pubkey (receives 0.5% fees)       |
| EXPO_PUBLIC_BIRDEYE_KEY     | https://birdeye.so/developer                         |
| EXPO_PUBLIC_SUPABASE_URL    | https://supabase.com → your project → Settings → API |
| EXPO_PUBLIC_SUPABASE_ANON_KEY | Same as above                                      |

## 4. Configure Privy

1. Go to https://console.privy.io and create an app.
2. Enable **Solana embedded wallets**.
3. Enable login methods: Email, Google OAuth, Guest.
4. Add your app's bundle ID (`com.snapshotsniper.app`) to allowed origins.
5. Copy the **App ID** to `EXPO_PUBLIC_PRIVY_APP_ID`.

## 5. Set up Supabase

Run the schema in your Supabase SQL editor:

```bash
# In Supabase Dashboard → SQL Editor → New Query, paste:
cat supabase/schema.sql
```

## 6. Set up your fee wallet

1. Create or use an existing Solana wallet as your fee recipient.
2. Set `EXPO_PUBLIC_FEE_ACCOUNT` to its public key.
3. For Jupiter feeAccount to work, your fee wallet needs an ATA for each output token.
   The app automatically creates missing ATAs via `getOrCreateFeeATA` — the cost is ~0.002 SOL
   per new token and is paid by the user's transaction.

## 7. Run the app

```bash
# Start Expo dev server
npm start

# iOS simulator
npm run ios

# Android emulator
npm run android
```

## 8. Build for production

```bash
# Configure EAS
eas build:configure

# iOS build
eas build --platform ios --profile production

# Android build
eas build --platform android --profile production
```

## Architecture notes

### Revenue flow
- Every Jupiter swap includes `platformFeeBps=50` (0.5%)
- Jupiter deposits the fee directly into your fee wallet's ATA for the output token
- Fee events are logged to Supabase `fee_events` table for tracking

### TP/SL background watcher
- Uses Expo `BackgroundFetch` + `TaskManager` (registered in `app/_layout.tsx`)
- Runs every 30 seconds when the app is backgrounded
- Fires local push notifications when TP or SL is triggered
- Note: iOS limits background fetch frequency; actual interval may be longer

### WebSocket reconnection
- The Helius WebSocket auto-reconnects with 3s delay on disconnect
- A 3-second REST polling fallback via Pump.fun API ensures no tokens are missed

### Jito bundles
- In Jito mode, the main swap tx + a 0.001 SOL tip tx are submitted together
- This gives priority inclusion in the next Jito-aware validator block

## Known caveats

1. **`@jup-ag/core`**: The Jupiter SDK requires some polyfills. The `metro.config.js` handles these.
   If you hit crypto errors, ensure `react-native-quick-crypto` is linked: `npx expo prebuild`.

2. **Slider component**: Uses `@react-native-community/slider`. After `npm install`, run
   `npx expo prebuild` to ensure the native module is linked for dev builds.

3. **Background tasks**: Must use a development build (not Expo Go) for `expo-task-manager`
   and `expo-background-fetch` to work.

4. **Privy `clientId`**: In `app/_layout.tsx`, the `clientId` prop is left empty (`""`).
   Check the Privy docs for whether your plan requires a client ID.

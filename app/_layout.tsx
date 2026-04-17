import '../polyfills';
import 'react-native-reanimated';

import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Toast from 'react-native-toast-message';
import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import * as BackgroundFetch from 'expo-background-fetch';
import { StyleSheet } from 'react-native';
import { canUsePrivyNative, PRIVY_APP_ID, PRIVY_CLIENT_ID } from '../services/privy';
import { ThemeProvider, useTheme } from '../context/ThemeContext';
import { WatchlistProvider } from '../context/WatchlistProvider';

// Configure notifications
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const BG_PRICE_TASK = 'bg-price-watcher';

// Background task — silently ignored in Expo Go
try {
  TaskManager.defineTask(BG_PRICE_TASK, async () => {
    try {
      const { getPositions } = await import('../services/tradeLogger');
      const { fetchPrice } = await import('../services/birdeye');
      const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;

      const positions = await getPositions();
      const configRaw = await AsyncStorage.getItem('snapshot_sniper_config');
      const config = configRaw
        ? JSON.parse(configRaw)
        : { takeProfitPercent: 100, stopLossPercent: 30 };

      // Check TP/SL for positions
      for (const pos of positions) {
        const currentPrice = await fetchPrice(pos.mint);
        if (currentPrice <= 0) continue;
        const tpPrice = pos.entryPriceSOL * (1 + config.takeProfitPercent / 100);
        const slPrice = pos.entryPriceSOL * (1 - config.stopLossPercent / 100);
        if (currentPrice >= tpPrice) {
          await Notifications.scheduleNotificationAsync({
            content: {
              title: '🎯 Take Profit Hit!',
              body: `${pos.tokenSymbol} reached your TP target`,
              data: { mint: pos.mint, type: 'tp' },
            },
            trigger: null,
          });
        } else if (currentPrice <= slPrice) {
          await Notifications.scheduleNotificationAsync({
            content: {
              title: '🛑 Stop Loss Hit!',
              body: `${pos.tokenSymbol} hit your stop loss`,
              data: { mint: pos.mint, type: 'sl' },
            },
            trigger: null,
          });
        }
      }

      // Check price alerts
      const alertsRaw = await AsyncStorage.getItem('snapshot_price_alerts');
      const alerts = alertsRaw ? JSON.parse(alertsRaw) : [];
      let alertsChanged = false;

      for (const alert of alerts) {
        if (alert.triggered) continue;
        const price = await fetchPrice(alert.mint);
        if (price <= 0) continue;

        const triggered =
          (alert.direction === 'above' && price >= alert.targetPrice) ||
          (alert.direction === 'below' && price <= alert.targetPrice);

        if (triggered) {
          alert.triggered = true;
          alertsChanged = true;
          await Notifications.scheduleNotificationAsync({
            content: {
              title: `🔔 Price Alert: ${alert.tokenSymbol}`,
              body: `${alert.tokenSymbol} is ${alert.direction === 'above' ? 'above' : 'below'} $${alert.targetPrice}`,
              data: { mint: alert.mint, type: 'price_alert' },
            },
            trigger: null,
          });
        }
      }

      if (alertsChanged) {
        await AsyncStorage.setItem('snapshot_price_alerts', JSON.stringify(alerts));
      }

      return BackgroundFetch.BackgroundFetchResult.NewData;
    } catch {
      return BackgroundFetch.BackgroundFetchResult.Failed;
    }
  });
} catch {
  // Not available in Expo Go
}

function AppProviders({ children }: { children: React.ReactNode }) {
  if (canUsePrivyNative) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { PrivyProvider } = require('@privy-io/expo') as {
      PrivyProvider: React.ComponentType<{
        appId: string;
        clientId: string;
        config?: Record<string, unknown>;
        children: React.ReactNode;
      }>;
    };
    return (
      <PrivyProvider
        appId={PRIVY_APP_ID}
        clientId={PRIVY_CLIENT_ID}
        config={{ embedded: { solana: { createOnLogin: 'users-without-wallets' } } }}
      >
        {children}
      </PrivyProvider>
    );
  }
  return <>{children}</>;
}

function ThemedStack() {
  const { colors, isDark } = useTheme();
  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.text,
          headerTitleStyle: { fontWeight: '700' },
          contentStyle: { backgroundColor: colors.bg },
          headerShadowVisible: false,
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="token/[mint]"
          options={{ title: 'Token Detail', presentation: 'card' }}
        />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  useEffect(() => {
    Notifications.requestPermissionsAsync().catch(() => {});
    BackgroundFetch.registerTaskAsync(BG_PRICE_TASK, {
      minimumInterval: 30,
      stopOnTerminate: false,
      startOnBoot: true,
    }).catch(() => {});
  }, []);

  return (
    <GestureHandlerRootView style={styles.root}>
      <ThemeProvider>
        <WatchlistProvider>
          <AppProviders>
            <ThemedStack />
            <Toast />
          </AppProviders>
        </WatchlistProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});

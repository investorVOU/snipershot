import '../polyfills';
import 'react-native-reanimated';

import React, { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as SplashScreen from 'expo-splash-screen';
import Toast from 'react-native-toast-message';
import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import * as BackgroundFetch from 'expo-background-fetch';
import * as LocalAuthentication from 'expo-local-authentication';
import { ActivityIndicator, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ThemeProvider, useTheme } from '../context/ThemeContext';
import { WatchlistProvider } from '../context/WatchlistProvider';

// Keep the splash screen visible until we explicitly hide it
SplashScreen.preventAutoHideAsync().catch(() => {});

// Configure notifications
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const BG_PRICE_TASK = 'bg-price-watcher';

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

      for (const pos of positions) {
        const currentPrice = await fetchPrice(pos.mint);
        if (currentPrice <= 0) continue;
        const tpPrice = pos.entryPriceSOL * (1 + config.takeProfitPercent / 100);
        const slPrice = pos.entryPriceSOL * (1 - config.stopLossPercent / 100);
        if (currentPrice >= tpPrice) {
          await Notifications.scheduleNotificationAsync({
            content: {
              title: 'Take Profit Hit!',
              body: `${pos.tokenSymbol} reached your TP target`,
              data: { mint: pos.mint, type: 'tp' },
            },
            trigger: null,
          });
        } else if (currentPrice <= slPrice) {
          await Notifications.scheduleNotificationAsync({
            content: {
              title: 'Stop Loss Hit!',
              body: `${pos.tokenSymbol} hit your stop loss`,
              data: { mint: pos.mint, type: 'sl' },
            },
            trigger: null,
          });
        }
      }

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
              title: `Price Alert: ${alert.tokenSymbol}`,
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
        <Stack.Screen name="onboarding" options={{ headerShown: false, gestureEnabled: false }} />
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
  const [biometricPassed, setBiometricPassed] = useState(false);
  const [biometricFailed, setBiometricFailed] = useState(false);

  const runBiometrics = async () => {
    setBiometricFailed(false);
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      if (!hasHardware || !isEnrolled) {
        setBiometricPassed(true);
        return;
      }
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Authenticate to open SniperShot',
        fallbackLabel: 'Use Passcode',
        disableDeviceFallback: false,
      });
      if (result.success) {
        setBiometricPassed(true);
      } else {
        setBiometricFailed(true);
      }
    } catch {
      setBiometricPassed(true);
    }
  };

  useEffect(() => {
    Notifications.requestPermissionsAsync().catch(() => {});
    BackgroundFetch.registerTaskAsync(BG_PRICE_TASK, {
      minimumInterval: 30,
      stopOnTerminate: false,
      startOnBoot: true,
    }).catch(() => {});

    void runBiometrics();
  }, []);

  // Hide native splash only once biometric gate is resolved
  useEffect(() => {
    if (biometricPassed) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [biometricPassed]);

  if (!biometricPassed) {
    return (
      <View style={styles.splashRoot}>
        <View style={styles.splashLogo}>
          <Image source={require('../assets/icon.png')} style={styles.splashIcon} resizeMode="contain" />
        </View>
        <Text style={styles.splashTitle}>SniperShot</Text>
        <Text style={styles.splashTagline}>Snipe Solana memecoins{'\n'}the moment they launch</Text>

        {biometricFailed ? (
          <TouchableOpacity style={styles.retryBtn} onPress={runBiometrics} activeOpacity={0.8}>
            <Text style={styles.retryText}>Unlock App</Text>
          </TouchableOpacity>
        ) : (
          <ActivityIndicator size="small" color="#27c985" style={{ marginTop: 48 }} />
        )}
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={styles.root}>
      <ThemeProvider>
        <WatchlistProvider>
          <ThemedStack />
          <Toast />
        </WatchlistProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  splashRoot: {
    flex: 1,
    backgroundColor: '#0a0f16',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 32,
  },
  splashLogo: {
    width: 100,
    height: 100,
    borderRadius: 28,
    backgroundColor: '#121925',
    borderWidth: 1.5,
    borderColor: '#2d3745',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  splashIcon: { width: 80, height: 80, borderRadius: 20 },
  splashTitle: {
    color: '#f3f6f8',
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  splashTagline: {
    color: '#7e8a99',
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  retryBtn: {
    marginTop: 40,
    backgroundColor: '#27c985',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 40,
  },
  retryText: { color: '#08110d', fontSize: 16, fontWeight: '800' },
});

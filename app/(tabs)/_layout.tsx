import React, { useState, useEffect, useCallback } from 'react';
import { Tabs } from 'expo-router';
import { View, StyleSheet, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../../context/ThemeContext';
import { fetchPrice } from '../../services/birdeye';
import type { Position } from '../../services/tradeLogger';

function BadgeIcon({
  iconName,
  color,
  size,
  badgeCount,
}: {
  iconName: React.ComponentProps<typeof Ionicons>['name'];
  color: string;
  size: number;
  badgeCount?: number;
}) {
  return (
    <View>
      <Ionicons name={iconName} size={size} color={color} />
      {badgeCount && badgeCount > 0 ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badgeCount > 9 ? '9+' : badgeCount}</Text>
        </View>
      ) : null}
    </View>
  );
}

function usePortfolioBadge() {
  const [count, setCount] = useState(0);

  const check = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem('snapshot_positions');
      const positions: Position[] = raw ? JSON.parse(raw) : [];
      if (positions.length === 0) { setCount(0); return; }

      const prices = await Promise.all(positions.map((p) => fetchPrice(p.mint)));
      let n = 0;
      positions.forEach((pos, i) => {
        const price = prices[i];
        if (price > 0) {
          const currentValue = price * pos.amountTokens;
          const pnlPct = ((currentValue - pos.amountSOLSpent) / pos.amountSOLSpent) * 100;
          if (pnlPct > 50) n++;
        }
      });
      setCount(n);
    } catch {
      setCount(0);
    }
  }, []);

  useEffect(() => {
    check();
    const interval = setInterval(check, 120_000);
    return () => clearInterval(interval);
  }, [check]);

  return count;
}

export default function TabsLayout() {
  const { colors } = useTheme();
  const portfolioBadge = usePortfolioBadge();

  return (
    <Tabs
      screenOptions={({ route }) => ({
        tabBarStyle: [styles.tabBar, { backgroundColor: colors.surface, borderTopColor: colors.border }],
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: styles.tabLabel,
        headerStyle: { backgroundColor: colors.bg },
        headerTintColor: colors.text,
        headerTitleStyle: [styles.headerTitle, { color: colors.text }],
        headerShadowVisible: false,
        headerShown: false,
      })}
    >
      <Tabs.Screen
        name="feed"
        options={{
          title: 'Feed',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="flash" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="portfolio"
        options={{
          title: 'Portfolio',
          tabBarIcon: ({ color, size }) => (
            <BadgeIcon iconName="bar-chart" color={color} size={size} badgeCount={portfolioBadge} />
          ),
        }}
      />
      <Tabs.Screen
        name="watchlist"
        options={{
          title: 'Watchlist',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="star" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="leaderboard"
        options={{
          title: 'Ranks',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="trophy" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="config"
        options={{
          title: 'Config',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="settings" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="wallet"
        options={{
          title: 'Wallet',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="wallet" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    borderTopWidth: 1,
    height: 60,
    paddingBottom: 8,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '600',
  },
  headerTitle: {
    fontWeight: '700',
    fontSize: 17,
  },
  headerRight: {
    marginRight: 16,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -6,
    backgroundColor: '#ff4444',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '800',
  },
});

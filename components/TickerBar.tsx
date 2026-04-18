import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, Image } from 'react-native';
import { FeedToken } from '../hooks/useTokenFeed';
import { useTheme } from '../context/ThemeContext';

interface Props {
  tokens: FeedToken[];
}

const ITEM_WIDTH = 130;
const SCROLL_SPEED = 0.8;
const TICK_MS = 20;

export function TickerBar({ tokens }: Props) {
  const { colors } = useTheme();
  const scrollRef = useRef<ScrollView>(null);
  const posRef = useRef(0);
  const halfRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const items = tokens.slice(0, 10);
  const doubled = [...items, ...items];

  useEffect(() => {
    if (items.length === 0) return;
    halfRef.current = items.length * ITEM_WIDTH;

    timerRef.current = setInterval(() => {
      posRef.current += SCROLL_SPEED;
      if (posRef.current >= halfRef.current) {
        posRef.current = 0;
        scrollRef.current?.scrollTo({ x: 0, animated: false });
      } else {
        scrollRef.current?.scrollTo({ x: posRef.current, animated: false });
      }
    }, TICK_MS);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [items.length]);

  if (items.length === 0) return null;

  return (
    <View style={[styles.container, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
      <View style={[styles.liveTag, { backgroundColor: colors.accent + '22', borderColor: colors.accent + '66' }]}>
        <View style={[styles.dot, { backgroundColor: colors.green }]} />
        <Text style={[styles.liveText, { color: colors.accent }]}>LIVE</Text>
      </View>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        scrollEnabled={false}
        style={styles.scroll}
      >
        {doubled.map((token, i) => {
          const change = token.overview?.priceChange24h ?? 0;
          const isUp = change >= 0;
          const price = token.overview?.price ?? 0;
          return (
            <View key={`${token.mint}-${i}`} style={[styles.item, { width: ITEM_WIDTH, borderRightColor: colors.border }]}>
              {token.imageUri ? (
                <Image source={{ uri: token.imageUri }} style={styles.avatar} resizeMode="cover" />
              ) : (
                <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: colors.accent + '33' }]}>
                  <Text style={[styles.avatarLetter, { color: colors.accent }]}>
                    {token.symbol?.[0] ?? '?'}
                  </Text>
                </View>
              )}
              <View style={styles.textCol}>
                <Text style={[styles.symbol, { color: colors.text }]} numberOfLines={1}>
                  ${token.symbol}
                </Text>
                {price > 0 ? (
                  <Text style={[styles.price, { color: colors.textMuted }]} numberOfLines={1}>
                    ${price < 0.0001 ? price.toExponential(2) : price.toFixed(price < 0.01 ? 6 : 4)}
                  </Text>
                ) : null}
                <Text style={[styles.change, { color: isUp ? colors.green : colors.red }]}>
                  {isUp ? '▲' : '▼'} {Math.abs(change).toFixed(1)}%
                </Text>
              </View>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 50,
    borderBottomWidth: 1,
    overflow: 'hidden',
  },
  liveTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    marginHorizontal: 8,
    flexShrink: 0,
  },
  dot: { width: 5, height: 5, borderRadius: 3 },
  liveText: { fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  scroll: { flex: 1 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 8,
    borderRightWidth: 1,
    height: 50,
  },
  avatar: { width: 28, height: 28, borderRadius: 14 },
  avatarFallback: { justifyContent: 'center', alignItems: 'center' },
  avatarLetter: { fontSize: 11, fontWeight: '800' },
  textCol: { flex: 1 },
  symbol: { fontSize: 11, fontWeight: '700', lineHeight: 14 },
  price: { fontSize: 9, lineHeight: 12 },
  change: { fontSize: 10, fontWeight: '600', lineHeight: 13 },
});

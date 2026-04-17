import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Dimensions } from 'react-native';
import {
  VictoryChart,
  VictoryLine,
  VictoryAxis,
  VictoryArea,
} from 'victory-native';
import { fetchOHLCV, OHLCVBar } from '../services/birdeye';
import { formatPrice } from '../utils/format';

const SCREEN_WIDTH = Dimensions.get('window').width;

interface Props {
  mint: string;
  height?: number;
}

export function PriceChart({ mint, height = 220 }: Props) {
  const [bars, setBars] = useState<OHLCVBar[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const loadData = async () => {
    try {
      const data = await fetchOHLCV(mint, '1m', 60);
      if (data.length > 0) setBars(data);
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, [mint]);

  if (loading) {
    return (
      <View style={[styles.container, { height }]}>
        <ActivityIndicator color="#9945ff" />
        <Text style={styles.loadingText}>Loading chart…</Text>
      </View>
    );
  }

  if (error || bars.length === 0) {
    return (
      <View style={[styles.container, { height }]}>
        <Text style={styles.errorText}>No price data available</Text>
      </View>
    );
  }

  const chartData = bars.map((b, i) => ({ x: i, y: b.close }));
  const prices = bars.map((b) => b.close);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const isGreen = bars[bars.length - 1].close >= bars[0].close;
  const lineColor = isGreen ? '#14f195' : '#ff4444';
  const currentPrice = bars[bars.length - 1]?.close ?? 0;

  return (
    <View style={[styles.container, { height }]}>
      <View style={styles.header}>
        <Text style={styles.currentPrice}>{formatPrice(currentPrice)}</Text>
        <Text style={styles.range}>
          H: {formatPrice(maxPrice)}  ·  L: {formatPrice(minPrice)}
        </Text>
      </View>

      <VictoryChart
        width={SCREEN_WIDTH - 32}
        height={height - 48}
        padding={{ top: 8, bottom: 24, left: 8, right: 8 }}
        style={{ background: { fill: 'transparent' } }}
      >
        <VictoryAxis
          style={{
            axis: { stroke: 'transparent' },
            tickLabels: { fill: 'transparent' },
            grid: { stroke: 'transparent' },
          }}
        />
        <VictoryAxis
          dependentAxis
          style={{
            axis: { stroke: 'transparent' },
            tickLabels: { fill: 'transparent' },
            grid: { stroke: '#1e1e2e', strokeDasharray: '4,4' },
          }}
        />
        <VictoryArea
          data={chartData}
          style={{
            data: {
              fill: lineColor,
              fillOpacity: 0.08,
              stroke: lineColor,
              strokeWidth: 2,
            },
          }}
          interpolation="monotoneX"
          animate={{ duration: 300 }}
        />
      </VictoryChart>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#0d0d14',
    borderRadius: 12,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  header: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingTop: 10,
  },
  currentPrice: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  range: {
    color: '#555',
    fontSize: 12,
  },
  loadingText: {
    color: '#555',
    fontSize: 13,
    marginTop: 8,
  },
  errorText: {
    color: '#555',
    fontSize: 14,
  },
});

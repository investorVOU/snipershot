import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Dimensions } from 'react-native';
import Svg, { Line, Rect, Text as SvgText } from 'react-native-svg';
import { fetchOHLCV, OHLCVBar } from '../services/birdeye';
import { formatPrice } from '../utils/format';

const SCREEN_WIDTH = Dimensions.get('window').width;
const CHART_PADDING = { top: 8, bottom: 24, left: 8, right: 8 };
const GREEN = '#14f195';
const RED = '#ef4444';

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
      const data = await fetchOHLCV(mint, '15m', 48);
      if (data.length > 0) setBars(data);
      setError(data.length === 0);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 15_000);
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
        <Text style={styles.errorText}>No chart data</Text>
      </View>
    );
  }

  const chartW = SCREEN_WIDTH - 32;
  const chartH = height - 48; // reserve space for header
  const innerW = chartW - CHART_PADDING.left - CHART_PADDING.right;
  const innerH = chartH - CHART_PADDING.top - CHART_PADDING.bottom;

  const allPrices = bars.flatMap((b) => [b.high, b.low]);
  const minPrice = Math.min(...allPrices);
  const maxPrice = Math.max(...allPrices);
  const priceRange = maxPrice - minPrice || 1;

  const toY = (price: number) =>
    CHART_PADDING.top + (1 - (price - minPrice) / priceRange) * innerH;

  const candleCount = bars.length;
  const totalCandleWidth = innerW / candleCount;
  const bodyWidth = Math.max(2, totalCandleWidth * 0.6);

  const currentBar = bars[bars.length - 1];
  const firstBar = bars[0];
  const isUp = currentBar.close >= firstBar.open;
  const currentPrice = currentBar.close;
  const highPrice = Math.max(...bars.map((b) => b.high));
  const lowPrice = Math.min(...bars.map((b) => b.low));

  return (
    <View style={[styles.container, { height }]}>
      <View style={styles.header}>
        <Text style={styles.currentPrice}>{formatPrice(currentPrice)}</Text>
        <Text style={[styles.trend, { color: isUp ? GREEN : RED }]}>
          {isUp ? '▲' : '▼'} {Math.abs(((currentBar.close - firstBar.open) / firstBar.open) * 100).toFixed(2)}%
        </Text>
        <Text style={styles.range}>
          H: {formatPrice(highPrice)}  ·  L: {formatPrice(lowPrice)}
        </Text>
      </View>

      <Svg width={chartW} height={chartH}>
        {bars.map((bar, i) => {
          const centerX = CHART_PADDING.left + (i + 0.5) * totalCandleWidth;
          const isGreen = bar.close >= bar.open;
          const color = isGreen ? GREEN : RED;

          const bodyTop = toY(Math.max(bar.open, bar.close));
          const bodyBottom = toY(Math.min(bar.open, bar.close));
          const bodyHeight = Math.max(1, bodyBottom - bodyTop);

          const wickTop = toY(bar.high);
          const wickBottom = toY(bar.low);

          return (
            <React.Fragment key={i}>
              {/* Wick */}
              <Line
                x1={centerX}
                y1={wickTop}
                x2={centerX}
                y2={wickBottom}
                stroke={color}
                strokeWidth={1}
              />
              {/* Body */}
              <Rect
                x={centerX - bodyWidth / 2}
                y={bodyTop}
                width={bodyWidth}
                height={bodyHeight}
                fill={isGreen ? color : 'transparent'}
                stroke={color}
                strokeWidth={1}
              />
            </React.Fragment>
          );
        })}

        {/* Price labels at top/bottom */}
        <SvgText
          x={chartW - CHART_PADDING.right}
          y={CHART_PADDING.top + 8}
          fill="#555"
          fontSize={9}
          textAnchor="end"
        >
          {formatPrice(maxPrice)}
        </SvgText>
        <SvgText
          x={chartW - CHART_PADDING.right}
          y={chartH - CHART_PADDING.bottom - 4}
          fill="#555"
          fontSize={9}
          textAnchor="end"
        >
          {formatPrice(minPrice)}
        </SvgText>
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#0d0d14',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 4,
  },
  currentPrice: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  trend: {
    fontSize: 12,
    fontWeight: '600',
  },
  range: {
    color: '#555',
    fontSize: 11,
    marginLeft: 'auto',
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

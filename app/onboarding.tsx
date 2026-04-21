import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Dimensions,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import Svg, {
  Circle,
  Defs,
  G,
  Line,
  Path,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export const ONBOARDING_KEY = 'onboarding_done';

const { width, height } = Dimensions.get('window');
const ILLUS_H = Math.round(height * 0.44);
const CX = width / 2;
const CY = ILLUS_H / 2;

// ─── Slide 1: Radar + rising candles ─────────────────────────────────────────
function IllusSnipe() {
  const c = '#27c985';
  const candles = [
    { x: CX - 72, y: CY + 28, h: 38 },
    { x: CX - 46, y: CY + 8,  h: 58 },
    { x: CX - 20, y: CY - 22, h: 88 },
    { x: CX + 6,  y: CY - 66, h: 118 },
  ];
  return (
    <Svg width={width} height={ILLUS_H}>
      <Defs>
        <RadialGradient id="g1a" cx="50%" cy="50%" r="50%">
          <Stop offset="0%"   stopColor={c} stopOpacity="0.22" />
          <Stop offset="100%" stopColor={c} stopOpacity="0"    />
        </RadialGradient>
      </Defs>

      {/* Atmospheric glow */}
      <Circle cx={CX} cy={CY} r={ILLUS_H * 0.58} fill="url(#g1a)" />

      {/* Grid dots */}
      {Array.from({ length: 7 }, (_, r) =>
        Array.from({ length: 9 }, (_, col) => (
          <Circle
            key={`d${r}${col}`}
            cx={CX - 140 + col * 35}
            cy={CY - 105 + r * 35}
            r={1.5}
            fill={c}
            fillOpacity={0.08}
          />
        ))
      )}

      {/* Radar rings */}
      {[0.42, 0.28, 0.15].map((r, i) => (
        <Circle
          key={i}
          cx={CX} cy={CY}
          r={ILLUS_H * r}
          stroke={c}
          strokeOpacity={0.08 + i * 0.04}
          strokeWidth={1}
          fill="none"
        />
      ))}
      <Line x1={CX} y1={CY - ILLUS_H * 0.42} x2={CX} y2={CY + ILLUS_H * 0.42}
        stroke={c} strokeOpacity="0.06" strokeWidth={1} />
      <Line x1={CX - ILLUS_H * 0.42} y1={CY} x2={CX + ILLUS_H * 0.42} y2={CY}
        stroke={c} strokeOpacity="0.06" strokeWidth={1} />

      {/* Rising candles */}
      {candles.map((cd, i) => (
        <G key={i}>
          <Line
            x1={cd.x + 9} y1={cd.y - 10}
            x2={cd.x + 9} y2={cd.y + cd.h + 10}
            stroke={c} strokeOpacity={0.25 + i * 0.15} strokeWidth={1.5}
          />
          <Rect
            x={cd.x} y={cd.y}
            width={18} height={cd.h}
            rx={3}
            fill={c}
            fillOpacity={0.22 + i * 0.2}
          />
        </G>
      ))}

      {/* Live blip — top-right */}
      <Circle cx={CX + 68} cy={CY - 52} r={28} fill={c} fillOpacity="0.06" />
      <Circle cx={CX + 68} cy={CY - 52} r={18} fill={c} fillOpacity="0.12" />
      <Circle cx={CX + 68} cy={CY - 52} r={7}  fill={c} fillOpacity="1" />
      <Circle
        cx={CX + 68} cy={CY - 52} r={34}
        stroke={c} strokeOpacity="0.3" strokeWidth={1}
        fill="none" strokeDasharray="5 5"
      />

      {/* Arrow up from last candle */}
      <Path
        d={`M${CX + 15} ${CY - 82} L${CX + 24} ${CY - 98} L${CX + 33} ${CY - 82}`}
        stroke={c} strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round"
        strokeOpacity="0.9"
      />
      <Line x1={CX + 24} y1={CY - 66} x2={CX + 24} y2={CY - 96}
        stroke={c} strokeWidth={2} strokeOpacity="0.9" strokeLinecap="round" />
    </Svg>
  );
}

// ─── Slide 2: Hex shield + network ───────────────────────────────────────────
function IllusShield() {
  const c = '#9945ff';
  const R = 70;
  // Hexagon points
  const hex = Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 3) * i - Math.PI / 2;
    return [CX + R * Math.cos(a), CY + R * Math.sin(a)];
  });
  const hexPath = hex.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ') + ' Z';

  // Outer hex
  const R2 = 105;
  const hex2 = Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 3) * i - Math.PI / 2;
    return [CX + R2 * Math.cos(a), CY + R2 * Math.sin(a)];
  });
  const hexPath2 = hex2.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ') + ' Z';

  // Network nodes
  const nodes = [
    [CX, CY - 36],
    [CX - 32, CY + 18],
    [CX + 32, CY + 18],
    [CX - 18, CY - 10],
    [CX + 18, CY - 10],
    [CX, CY + 22],
  ];

  return (
    <Svg width={width} height={ILLUS_H}>
      <Defs>
        <RadialGradient id="g2a" cx="50%" cy="50%" r="50%">
          <Stop offset="0%"   stopColor={c} stopOpacity="0.28" />
          <Stop offset="100%" stopColor={c} stopOpacity="0"    />
        </RadialGradient>
      </Defs>

      <Circle cx={CX} cy={CY} r={ILLUS_H * 0.56} fill="url(#g2a)" />

      {/* Outer hex ring */}
      <Path d={hexPath2} stroke={c} strokeOpacity="0.12" strokeWidth={1} fill="none" />

      {/* Spokes from center to outer hex */}
      {hex2.map((p, i) => (
        <Line key={i} x1={CX} y1={CY} x2={p[0]} y2={p[1]}
          stroke={c} strokeOpacity="0.07" strokeWidth={1} />
      ))}

      {/* Inner hex — shield */}
      <Path d={hexPath} fill={c} fillOpacity="0.08" stroke={c} strokeOpacity="0.5" strokeWidth={1.5} />

      {/* Network lines */}
      {nodes.map((n, i) =>
        nodes.slice(i + 1).map((m, j) => (
          <Line key={`${i}${j}`}
            x1={n[0]} y1={n[1]} x2={m[0]} y2={m[1]}
            stroke={c} strokeOpacity="0.3" strokeWidth={1}
          />
        ))
      )}

      {/* Network nodes */}
      {nodes.map((n, i) => (
        <Circle key={i} cx={n[0]} cy={n[1]} r={4} fill={c} fillOpacity={i === 0 ? 1 : 0.5} />
      ))}

      {/* Checkmark */}
      <Path
        d={`M${CX - 14} ${CY} L${CX - 4} ${CY + 12} L${CX + 16} ${CY - 14}`}
        stroke={c} strokeWidth={3} fill="none"
        strokeLinecap="round" strokeLinejoin="round"
        strokeOpacity="0.95"
      />

      {/* Deflected warning triangles */}
      {[
        { x: CX - 100, y: CY - 55 },
        { x: CX + 82, y: CY - 62 },
        { x: CX + 90, y: CY + 28 },
      ].map((t, i) => (
        <G key={i} opacity={0.25 - i * 0.06}>
          <Path
            d={`M${t.x} ${t.y - 14} L${t.x + 14} ${t.y + 10} L${t.x - 14} ${t.y + 10} Z`}
            stroke="#ff4444" strokeWidth={1.5} fill="none" strokeLinejoin="round"
          />
          <Line x1={t.x - 10} y1={t.y + 3} x2={t.x + 10} y2={t.y - 12}
            stroke="#ff4444" strokeWidth={1.5} strokeLinecap="round" />
        </G>
      ))}
    </Svg>
  );
}

// ─── Slide 3: Chart with TP/SL ────────────────────────────────────────────────
function IllusAuto() {
  const c = '#f5a623';
  const chartL = CX - 120;
  const chartR = CX + 120;
  const chartB = CY + 55;
  const chartT = CY - 80;

  // Price path — sharp rise, small dip, recovery
  const pts: [number, number][] = [
    [chartL,      chartB],
    [chartL + 40, chartB - 20],
    [chartL + 70, chartB - 50],
    [chartL + 95, chartB - 35],
    [chartL + 120, chartB - 85],
    [chartL + 145, chartB - 65],
    [chartL + 170, chartT + 10],
    [chartL + 200, chartT - 5],
    [chartR,       chartT - 15],
  ];
  const curvePath = pts
    .map((p, i) => (i === 0 ? `M${p[0]} ${p[1]}` : `L${p[0]} ${p[1]}`))
    .join(' ');

  const tpY = chartT + 5;
  const slY = chartB - 8;

  return (
    <Svg width={width} height={ILLUS_H}>
      <Defs>
        <RadialGradient id="g3a" cx="50%" cy="50%" r="50%">
          <Stop offset="0%"   stopColor={c} stopOpacity="0.2" />
          <Stop offset="100%" stopColor={c} stopOpacity="0"   />
        </RadialGradient>
      </Defs>

      <Circle cx={CX} cy={CY} r={ILLUS_H * 0.56} fill="url(#g3a)" />

      {/* Grid lines */}
      {[0, 1, 2, 3].map(i => (
        <Line
          key={i}
          x1={chartL} y1={chartT + (i * (chartB - chartT)) / 3}
          x2={chartR} y2={chartT + (i * (chartB - chartT)) / 3}
          stroke={c} strokeOpacity="0.07" strokeWidth={1}
        />
      ))}

      {/* Chart fill */}
      <Path
        d={`${curvePath} L${chartR} ${chartB + 20} L${chartL} ${chartB + 20} Z`}
        fill={c} fillOpacity="0.06"
      />

      {/* Price line */}
      <Path d={curvePath} stroke={c} strokeWidth={2.5} fill="none"
        strokeLinecap="round" strokeLinejoin="round" />

      {/* TP line */}
      <Line x1={chartL - 8} y1={tpY} x2={chartR + 8} y2={tpY}
        stroke="#27c985" strokeWidth={1.5} strokeDasharray="6 4" strokeOpacity="0.85" />
      <Circle cx={chartR + 8} cy={tpY} r={4} fill="#27c985" fillOpacity="0.9" />

      {/* SL line */}
      <Line x1={chartL - 8} y1={slY} x2={chartR + 8} y2={slY}
        stroke="#ef4444" strokeWidth={1.5} strokeDasharray="6 4" strokeOpacity="0.7" />
      <Circle cx={chartR + 8} cy={slY} r={4} fill="#ef4444" fillOpacity="0.8" />

      {/* Execution dot on price peak */}
      <Circle cx={pts[6][0]} cy={pts[6][1]} r={16} fill={c} fillOpacity="0.12" />
      <Circle cx={pts[6][0]} cy={pts[6][1]} r={7}  fill={c} fillOpacity="1" />

      {/* Pulse ring */}
      <Circle cx={pts[6][0]} cy={pts[6][1]} r={22}
        stroke={c} strokeOpacity="0.35" strokeWidth={1}
        fill="none" strokeDasharray="4 4"
      />

      {/* Auto arrows at right edge */}
      {[tpY + 10, CY, slY - 10].map((y, i) => (
        <G key={i}>
          <Circle cx={chartR + 30} cy={y} r={9}
            fill={i === 1 ? c : i === 0 ? '#27c985' : '#ef4444'}
            fillOpacity="0.15"
          />
          <Path
            d={`M${chartR + 26} ${y - 4} L${chartR + 34} ${y} L${chartR + 26} ${y + 4}`}
            stroke={i === 1 ? c : i === 0 ? '#27c985' : '#ef4444'}
            strokeWidth={1.5} fill="none"
            strokeLinecap="round" strokeLinejoin="round"
            strokeOpacity="0.8"
          />
        </G>
      ))}
    </Svg>
  );
}

// ─── Slide data ───────────────────────────────────────────────────────────────
const SLIDES = [
  {
    key: '1',
    num: '01',
    Illus: IllusSnipe,
    accent: '#27c985',
    title: 'Snipe First',
    body: 'Real-time token launches the moment they hit pump.fun. One tap to buy before the crowd drives the price up.',
  },
  {
    key: '2',
    num: '02',
    Illus: IllusShield,
    accent: '#9945ff',
    title: 'AI Protection',
    body: 'Every token is scored for rug risk before you see it. Creator dump alerts and auto stop-loss keep your SOL safe.',
  },
  {
    key: '3',
    num: '03',
    Illus: IllusAuto,
    accent: '#f5a623',
    title: 'Auto Execute',
    body: 'Set take-profit and stop-loss targets once. They execute automatically — no screen-watching required.',
  },
];

// ─── Main component ───────────────────────────────────────────────────────────
export default function OnboardingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  // Floating animation for illustration
  const floatY = useSharedValue(0);
  useEffect(() => {
    floatY.value = withRepeat(
      withSequence(
        withTiming(-10, { duration: 2200, easing: Easing.inOut(Easing.sin) }),
        withTiming(0,   { duration: 2200, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      false
    );
  }, []);
  const floatStyle = useAnimatedStyle(() => ({ transform: [{ translateY: floatY.value }] }));

  // Content fade/slide on index change
  const contentOpacity = useSharedValue(1);
  const contentY = useSharedValue(0);
  const contentStyle = useAnimatedStyle(() => ({
    opacity: contentOpacity.value,
    transform: [{ translateY: contentY.value }],
  }));

  const animateContent = useCallback(() => {
    contentOpacity.value = 0;
    contentY.value = 18;
    contentOpacity.value = withTiming(1, { duration: 320 });
    contentY.value = withTiming(0, { duration: 320 });
  }, [contentOpacity, contentY]);

  const slide = SLIDES[activeIndex];
  const isLast = activeIndex === SLIDES.length - 1;

  const goNext = () => {
    if (isLast) {
      finish();
    } else {
      listRef.current?.scrollToIndex({ index: activeIndex + 1, animated: true });
    }
  };

  const finish = async () => {
    await AsyncStorage.setItem(ONBOARDING_KEY, 'true').catch(() => {});
    router.replace('/');
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>

      {/* Skip */}
      <View style={styles.topBar}>
        <Text style={styles.slideNum}>{slide.num}</Text>
        <TouchableOpacity onPress={finish} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>
      </View>

      {/* Illustrations (horizontal pager) */}
      <Animated.View style={[styles.illusWrap, floatStyle]}>
        <FlatList
          ref={listRef}
          data={SLIDES}
          keyExtractor={(s) => s.key}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          scrollEventThrottle={16}
          bounces={false}
          onMomentumScrollEnd={(e) => {
            const idx = Math.round(e.nativeEvent.contentOffset.x / width);
            if (idx !== activeIndex) {
              setActiveIndex(idx);
              animateContent();
            }
          }}
          renderItem={({ item }) => (
            <View style={{ width }}>
              <item.Illus />
            </View>
          )}
        />
      </Animated.View>

      {/* Text content */}
      <Animated.View style={[styles.textWrap, contentStyle]}>
        <View style={[styles.accentLine, { backgroundColor: slide.accent }]} />
        <Text style={styles.title}>{slide.title}</Text>
        <Text style={styles.body}>{slide.body}</Text>
      </Animated.View>

      {/* Footer */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 20 }]}>
        <View style={styles.dots}>
          {SLIDES.map((s, i) => (
            <Animated.View
              key={s.key}
              style={[
                styles.dot,
                i === activeIndex
                  ? { backgroundColor: slide.accent, width: 24 }
                  : { backgroundColor: '#2d3745', width: 7 },
              ]}
            />
          ))}
        </View>

        <TouchableOpacity
          style={[styles.nextBtn, { backgroundColor: slide.accent }]}
          onPress={goNext}
          activeOpacity={0.85}
        >
          <Text style={styles.nextBtnText}>{isLast ? 'Get Started' : 'Next'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#080c12',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 4,
  },
  slideNum: {
    color: '#2d3a4a',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1,
  },
  skipText: {
    color: '#3c4d5e',
    fontSize: 14,
    fontWeight: '600',
  },
  illusWrap: {
    height: ILLUS_H,
  },
  textWrap: {
    flex: 1,
    paddingHorizontal: 28,
    paddingTop: 8,
    gap: 14,
  },
  accentLine: {
    width: 36,
    height: 3,
    borderRadius: 2,
    marginBottom: 4,
  },
  title: {
    color: '#f0f4f8',
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: -0.5,
    lineHeight: 40,
  },
  body: {
    color: '#5e7080',
    fontSize: 16,
    lineHeight: 26,
    fontWeight: '400',
  },
  footer: {
    paddingHorizontal: 24,
    gap: 20,
  },
  dots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  dot: {
    height: 7,
    borderRadius: 4,
  },
  nextBtn: {
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
  },
  nextBtnText: {
    color: '#06110d',
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
});

import React from 'react';
import Svg, { Polyline, Defs, LinearGradient, Stop, Path } from 'react-native-svg';

interface Props {
  data: number[];
  width: number;
  height: number;
  color?: string;
  showGradient?: boolean;
}

export function SparklineChart({ data, width, height, color = '#14f195', showGradient = false }: Props) {
  if (data.length < 2) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pad = 2;
  const w = width - pad * 2;
  const h = height - pad * 2;

  const pts = data.map((v, i) => {
    const x = pad + (i / (data.length - 1)) * w;
    const y = pad + (1 - (v - min) / range) * h;
    return [x, y] as [number, number];
  });

  const polyPoints = pts.map(([x, y]) => `${x},${y}`).join(' ');

  let fillPath = '';
  if (showGradient && pts.length > 0) {
    const first = pts[0];
    const last = pts[pts.length - 1];
    fillPath = `M${first[0]},${first[1]} ` +
      pts.slice(1).map(([x, y]) => `L${x},${y}`).join(' ') +
      ` L${last[0]},${height} L${first[0]},${height} Z`;
  }

  const gradientId = `sg-${color.replace('#', '')}`;

  return (
    <Svg width={width} height={height}>
      {showGradient && (
        <Defs>
          <LinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={color} stopOpacity={0.3} />
            <Stop offset="100%" stopColor={color} stopOpacity={0} />
          </LinearGradient>
        </Defs>
      )}
      {showGradient && <Path d={fillPath} fill={`url(#${gradientId})`} />}
      <Polyline
        points={polyPoints}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </Svg>
  );
}

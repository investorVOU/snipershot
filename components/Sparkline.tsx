import React, { useMemo } from "react";
import { View } from "react-native";
import Svg, { Defs, LinearGradient, Path, Stop } from "react-native-svg";

interface Props {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  showGradient?: boolean;
}

export function Sparkline({ data, width = 80, height = 32, color = "#14f195", showGradient = true }: Props) {
  const { linePath, gradientPath } = useMemo(() => {
    if (!data || data.length < 2) return { linePath: "", gradientPath: "" };

    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;

    const pad = 2;
    const w = width - pad * 2;
    const h = height - pad * 2;

    const points = data.map((v, i) => ({
      x: pad + (i / (data.length - 1)) * w,
      y: pad + h - ((v - min) / range) * h,
    }));

    // Smooth cubic bezier line
    const linePath = points.reduce((acc, pt, i) => {
      if (i === 0) return `M ${pt.x} ${pt.y}`;
      const prev = points[i - 1];
      const cx = (prev.x + pt.x) / 2;
      return `${acc} C ${cx} ${prev.y} ${cx} ${pt.y} ${pt.x} ${pt.y}`;
    }, "");

    const last = points[points.length - 1];
    const first = points[0];
    const gradientPath = `${linePath} L ${last.x} ${height} L ${first.x} ${height} Z`;

    return { linePath, gradientPath };
  }, [data, width, height]);

  if (!linePath) return <View style={{ width, height }} />;

  const isUp = data[data.length - 1] >= data[0];
  const resolvedColor = color === "#14f195" ? (isUp ? "#14f195" : "#ef4444") : color;
  const gradId = `sg_${resolvedColor.replace("#", "")}`;

  return (
    <Svg width={width} height={height}>
      {showGradient && (
        <Defs>
          <LinearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={resolvedColor} stopOpacity="0.28" />
            <Stop offset="1" stopColor={resolvedColor} stopOpacity="0" />
          </LinearGradient>
        </Defs>
      )}
      {showGradient && <Path d={gradientPath} fill={`url(#${gradId})`} />}
      <Path
        d={linePath}
        fill="none"
        stroke={resolvedColor}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

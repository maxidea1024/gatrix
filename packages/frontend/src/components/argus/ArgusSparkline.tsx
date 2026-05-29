import React, { useMemo } from 'react';

interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  fillColor?: string;
  strokeWidth?: number;
  showDot?: boolean;
}

/**
 * Lightweight inline SVG sparkline chart.
 * Renders a smooth area chart for use in issue lists, stat cards, etc.
 */
const ArgusSparkline: React.FC<SparklineProps> = ({
  data,
  width = 80,
  height = 24,
  color = '#7c4dff',
  fillColor,
  strokeWidth = 1.5,
  showDot = true,
}) => {
  const { path, areaPath, lastPoint } = useMemo(() => {
    if (!data || data.length < 2) {
      return { path: '', areaPath: '', lastPoint: null };
    }

    const max = Math.max(...data, 1);
    const padding = 2;
    const w = width - padding * 2;
    const h = height - padding * 2;

    const points = data.map((v, i) => ({
      x: padding + (i / (data.length - 1)) * w,
      y: padding + h - (v / max) * h,
    }));

    // Build smooth path using catmull-rom → bezier conversion
    let d = `M ${points[0].x},${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[Math.max(0, i - 1)];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = points[Math.min(points.length - 1, i + 2)];

      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;

      d += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
    }

    const last = points[points.length - 1];
    const areaD = `${d} L ${last.x},${height - padding} L ${points[0].x},${height - padding} Z`;

    return { path: d, areaPath: areaD, lastPoint: last };
  }, [data, width, height]);

  if (!data || data.length < 2) return null;

  const gradientId = `sparkline-grad-${color.replace(/[^a-zA-Z0-9]/g, '')}`;
  const resolvedFill = fillColor || `${color}30`;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: 'block', flexShrink: 0 }}>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.3} />
          <stop offset="100%" stopColor={color} stopOpacity={0.02} />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${gradientId})`} />
      <path d={path} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      {showDot && lastPoint && (
        <circle cx={lastPoint.x} cy={lastPoint.y} r={2} fill={color} />
      )}
    </svg>
  );
};

export default React.memo(ArgusSparkline);

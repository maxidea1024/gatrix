import React, { useMemo } from 'react';
import { Box, Typography, useTheme, alpha } from '@mui/material';
import {
  ResponsiveContainer,
  LineChart,
  BarChart,
  AreaChart,
  ComposedChart,
  Line,
  Bar,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { type VizOptions, CHART_COLORS, formatValue } from './widgetTypes';

interface TimeSeriesRendererProps {
  data: any[];
  isDark: boolean;
  chartStyle: string; // 'line' | 'bar' | 'area' | 'stacked-bar' | 'stacked-area'
  vizOptions?: VizOptions;
}

/** Detect keys: first non-numeric = label, rest = value series */
function detectKeys(data: any[]): { labelKey: string; valueKeys: string[] } {
  if (!data || data.length === 0) return { labelKey: '', valueKeys: [] };

  const keys = Object.keys(data[0]);
  // Heuristic: 'hour', 'bucket', 'timestamp', 'date', 'time' → label/x-axis
  const timeKeys = ['hour', 'bucket', 'timestamp', 'date', 'time', 'day'];
  let labelKey = keys.find((k) => timeKeys.includes(k.toLowerCase()));

  if (!labelKey) {
    // First non-numeric key
    labelKey = keys.find(
      (k) => typeof data[0][k] === 'string' || isNaN(Number(data[0][k]))
    );
  }
  if (!labelKey) labelKey = keys[0];

  const valueKeys = keys.filter(
    (k) =>
      k !== labelKey &&
      (typeof data[0][k] === 'number' || !isNaN(Number(data[0][k])))
  );

  return { labelKey, valueKeys };
}

/** Format X-axis tick label (shorten timestamps) */
function formatXTick(value: string): string {
  if (!value) return '';
  // If ISO-like timestamp, show only time or date
  if (value.includes('T') || value.includes(' ')) {
    const d = new Date(value);
    if (!isNaN(d.getTime())) {
      // Show hours if within same day range, otherwise date
      return d.toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit',
      });
    }
  }
  // Truncate long labels
  return value.length > 12 ? value.slice(0, 12) + '…' : value;
}

const TimeSeriesRenderer: React.FC<TimeSeriesRendererProps> = ({
  data,
  isDark,
  chartStyle,
  vizOptions,
}) => {
  const theme = useTheme();
  const { labelKey, valueKeys } = useMemo(() => detectKeys(data), [data]);

  if (!labelKey || valueKeys.length === 0) return null;

  const lineWidth = vizOptions?.line_width ?? 2;
  const fillOpacity = vizOptions?.fill_opacity ?? 0.15;
  const showPoints = vizOptions?.show_points ?? 'auto';
  const pointSize = vizOptions?.point_size ?? 0;
  const connectNulls = vizOptions?.connect_nulls ?? true;
  const isStacked =
    chartStyle === 'stacked-bar' || chartStyle === 'stacked-area';

  const legendConfig = vizOptions?.legend;
  const showLegend = legendConfig?.show !== false && valueKeys.length > 1;

  const axisConfig = vizOptions?.axis;

  const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
  const textColor = isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.45)';

  const tooltipStyle = {
    backgroundColor: isDark ? '#1e1e2e' : '#fff',
    border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
    borderRadius: 8,
    fontSize: '0.75rem',
    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
  };

  const getSeriesColor = (key: string, index: number) => {
    if (vizOptions?.series_colors?.[key]) return vizOptions.series_colors[key];
    return CHART_COLORS[index % CHART_COLORS.length];
  };

  const yDomain: [any, any] = [
    axisConfig?.y_min ?? 'auto',
    axisConfig?.y_max ?? 'auto',
  ];

  const commonProps = {
    data,
    margin: { top: 8, right: 8, left: -12, bottom: showLegend ? 4 : 0 },
  };

  const xAxisProps = {
    dataKey: labelKey,
    tick: { fontSize: 10, fill: textColor },
    tickFormatter: formatXTick,
    axisLine: false,
    tickLine: false,
    label: axisConfig?.x_label
      ? {
          value: axisConfig.x_label,
          fontSize: 10,
          fill: textColor,
          position: 'insideBottomRight' as const,
          offset: -4,
        }
      : undefined,
  };

  const yAxisProps = {
    tick: { fontSize: 10, fill: textColor },
    tickFormatter: (v: number) => formatValue(v, vizOptions),
    axisLine: false,
    tickLine: false,
    domain: yDomain,
    scale: (axisConfig?.y_scale as any) || 'auto',
    label: axisConfig?.y_label
      ? {
          value: axisConfig.y_label,
          fontSize: 10,
          fill: textColor,
          angle: -90,
          position: 'insideLeft' as const,
        }
      : undefined,
  };

  const gridProps = {
    stroke: gridColor,
    strokeDasharray: '3 3',
    vertical: false,
  };

  const tooltipProps = {
    contentStyle: tooltipStyle,
    labelStyle: { fontWeight: 600, marginBottom: 4, fontSize: '0.72rem' },
    formatter: (value: number) => [formatValue(value, vizOptions), undefined],
    labelFormatter: (label: string) => label,
  };

  const legendProps = showLegend
    ? {
        wrapperStyle: { fontSize: '0.68rem', paddingTop: 4 },
        iconType: 'circle' as const,
        iconSize: 8,
      }
    : undefined;

  const dotConfig =
    showPoints === 'always'
      ? { r: pointSize || 3 }
      : showPoints === 'never'
        ? false
        : data.length < 30
          ? { r: pointSize || 2 }
          : false;

  const renderSeries = () => {
    const effectiveStyle =
      chartStyle === 'stacked-bar'
        ? 'bar'
        : chartStyle === 'stacked-area'
          ? 'area'
          : chartStyle;

    return valueKeys.map((key, i) => {
      const color = getSeriesColor(key, i);

      switch (effectiveStyle) {
        case 'bar':
          return (
            <Bar
              key={key}
              dataKey={key}
              fill={color}
              fillOpacity={0.85}
              radius={[2, 2, 0, 0]}
              stackId={isStacked ? 'stack' : undefined}
              animationDuration={600}
            />
          );
        case 'area':
          return (
            <Area
              key={key}
              type="monotone"
              dataKey={key}
              stroke={color}
              strokeWidth={lineWidth}
              fill={color}
              fillOpacity={fillOpacity}
              dot={dotConfig}
              connectNulls={connectNulls}
              stackId={isStacked ? 'stack' : undefined}
              animationDuration={600}
            />
          );
        case 'line':
        default:
          return (
            <Line
              key={key}
              type="monotone"
              dataKey={key}
              stroke={color}
              strokeWidth={lineWidth}
              dot={dotConfig}
              connectNulls={connectNulls}
              activeDot={{ r: 4, strokeWidth: 0 }}
              animationDuration={600}
            />
          );
      }
    });
  };

  // Use ComposedChart for flexibility (supports mixed series in future)
  return (
    <Box sx={{ width: '100%', height: '100%', minHeight: 0 }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart {...commonProps}>
          <CartesianGrid {...gridProps} />
          <XAxis {...xAxisProps} />
          <YAxis {...yAxisProps} />
          <Tooltip {...tooltipProps} />
          {showLegend && legendProps && <Legend {...legendProps} />}
          {renderSeries()}
        </ComposedChart>
      </ResponsiveContainer>
    </Box>
  );
};

export default TimeSeriesRenderer;

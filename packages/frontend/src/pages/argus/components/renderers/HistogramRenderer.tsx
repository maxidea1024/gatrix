import React, { useMemo } from 'react';
import { Box } from '@mui/material';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import {
  type VizOptions,
  CHART_COLORS,
  formatValue,
} from './widgetTypes';

interface HistogramRendererProps {
  data: any[];
  isDark: boolean;
  vizOptions?: VizOptions;
}

const HistogramRenderer: React.FC<HistogramRendererProps> = ({
  data,
  isDark,
  vizOptions,
}) => {
  const { chartData, binKey, countKey } = useMemo(() => {
    if (!data || data.length === 0)
      return { chartData: [], binKey: '', countKey: '' };

    const keys = Object.keys(data[0]);
    const ck =
      keys.find((k) => k === 'count' || k === 'frequency') ||
      keys.find(
        (k) => typeof data[0][k] === 'number' || !isNaN(Number(data[0][k]))
      ) ||
      keys[1];
    const bk = keys.find((k) => k !== ck) || keys[0];

    if (!ck || !bk) return { chartData: [], binKey: '', countKey: '' };

    return {
      chartData: data.map((row) => ({
        bin: String(row[bk]),
        count: Number(row[ck]),
      })),
      binKey: bk,
      countKey: ck,
    };
  }, [data]);

  if (chartData.length === 0) return null;

  const textColor = isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.45)';
  const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
  const barColor = vizOptions?.series_colors?.['histogram'] || CHART_COLORS[1];

  const tooltipStyle = {
    backgroundColor: isDark ? '#1e1e2e' : '#fff',
    border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
    borderRadius: 8,
    fontSize: '0.75rem',
    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
  };

  return (
    <Box sx={{ width: '100%', height: '100%', minHeight: 0 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartData}
          margin={{ top: 8, right: 8, left: -12, bottom: 0 }}
          barGap={0}
          barCategoryGap={1}
        >
          <CartesianGrid
            stroke={gridColor}
            strokeDasharray="3 3"
            vertical={false}
          />
          <XAxis
            dataKey="bin"
            tick={{ fontSize: 10, fill: textColor }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 10, fill: textColor }}
            tickFormatter={(v: number) => formatValue(v, vizOptions)}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(value: number) => [
              formatValue(value, vizOptions),
              undefined,
            ]}
          />
          <Bar
            dataKey="count"
            fill={barColor}
            fillOpacity={0.85}
            radius={[2, 2, 0, 0]}
            animationDuration={600}
          />
        </BarChart>
      </ResponsiveContainer>
    </Box>
  );
};

export default HistogramRenderer;

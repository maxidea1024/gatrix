import React, { useMemo } from 'react';
import { Box, Typography, alpha } from '@mui/material';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from 'recharts';
import { type VizOptions, CHART_COLORS, formatValue } from './widgetTypes';

interface HorizontalBarRendererProps {
  data: any[];
  isDark: boolean;
  vizOptions?: VizOptions;
  showRank?: boolean; // top-list mode: show rank numbers
}

const HorizontalBarRenderer: React.FC<HorizontalBarRendererProps> = ({
  data,
  isDark,
  vizOptions,
  showRank = false,
}) => {
  const { chartData, labelKey, numKey } = useMemo(() => {
    if (!data || data.length === 0)
      return { chartData: [], labelKey: '', numKey: '' };

    const keys = Object.keys(data[0]);
    const nk = keys.find(
      (k) => typeof data[0][k] === 'number' || !isNaN(Number(data[0][k]))
    );
    const lk = keys.find((k) => k !== nk);
    if (!nk || !lk) return { chartData: [], labelKey: '', numKey: '' };

    const cd = data.slice(0, 20).map((row, i) => ({
      name: String(row[lk]),
      value: Number(row[nk]),
      rank: i + 1,
    }));

    return { chartData: cd, labelKey: lk, numKey: nk };
  }, [data]);

  if (chartData.length === 0) return null;

  const textColor = isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.45)';
  const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';

  const getColor = (index: number, name: string) => {
    if (vizOptions?.series_colors?.[name])
      return vizOptions.series_colors[name];
    return CHART_COLORS[index % CHART_COLORS.length];
  };

  const tooltipStyle = {
    backgroundColor: isDark ? '#1e1e2e' : '#fff',
    border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
    borderRadius: 8,
    fontSize: '0.75rem',
    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
  };

  // For top-list mode with few items, use a simple styled list
  if (showRank && chartData.length <= 10) {
    const maxVal = Math.max(...chartData.map((d) => d.value));

    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          gap: 0.6,
          height: '100%',
          overflow: 'auto',
          py: 0.5,
          px: 0.5,
        }}
      >
        {chartData.map((item, i) => (
          <Box
            key={i}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
            }}
          >
            {/* Rank badge */}
            <Typography
              sx={{
                fontSize: '0.65rem',
                fontWeight: 700,
                color: i < 3 ? CHART_COLORS[i] : 'text.disabled',
                minWidth: 18,
                textAlign: 'center',
              }}
            >
              {item.rank}
            </Typography>

            {/* Label */}
            <Typography
              sx={{
                fontSize: '0.72rem',
                color: 'text.secondary',
                minWidth: 60,
                maxWidth: '40%',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                fontWeight: 500,
              }}
            >
              {item.name}
            </Typography>

            {/* Bar */}
            <Box
              sx={{
                flex: 1,
                height: 14,
                borderRadius: 7,
                overflow: 'hidden',
                backgroundColor: isDark
                  ? 'rgba(255,255,255,0.04)'
                  : 'rgba(0,0,0,0.03)',
              }}
            >
              <Box
                sx={{
                  height: '100%',
                  borderRadius: 7,
                  width: `${maxVal > 0 ? (item.value / maxVal) * 100 : 0}%`,
                  background: `linear-gradient(90deg, ${alpha(getColor(i, item.name), 0.9)}, ${alpha(getColor(i, item.name), 0.6)})`,
                  transition: 'width 0.4s ease',
                  minWidth: item.value > 0 ? 4 : 0,
                }}
              />
            </Box>

            {/* Value */}
            <Typography
              sx={{
                fontSize: '0.72rem',
                fontWeight: 700,
                minWidth: 40,
                textAlign: 'right',
              }}
            >
              {formatValue(item.value, vizOptions)}
            </Typography>
          </Box>
        ))}
      </Box>
    );
  }

  // Standard horizontal bar chart via recharts
  return (
    <Box sx={{ width: '100%', height: '100%', minHeight: 0 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 4, right: 8, left: 4, bottom: 4 }}
        >
          <CartesianGrid
            stroke={gridColor}
            strokeDasharray="3 3"
            horizontal={false}
          />
          <XAxis
            type="number"
            tick={{ fontSize: 10, fill: textColor }}
            tickFormatter={(v: number) => formatValue(v, vizOptions)}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="name"
            tick={{ fontSize: 10, fill: textColor }}
            width={80}
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
            dataKey="value"
            radius={[0, 4, 4, 0]}
            animationDuration={600}
            barSize={16}
          >
            {chartData.map((entry, i) => (
              <Cell key={i} fill={getColor(i, entry.name)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Box>
  );
};

export default HorizontalBarRenderer;

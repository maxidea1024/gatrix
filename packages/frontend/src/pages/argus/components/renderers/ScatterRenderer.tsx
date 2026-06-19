import React, { useMemo } from 'react';
import { Box } from '@mui/material';
import {
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ZAxis,
} from 'recharts';
import {
  type VizOptions,
  CHART_COLORS,
  formatValue,
} from './widgetTypes';

interface ScatterRendererProps {
  data: any[];
  isDark: boolean;
  vizOptions?: VizOptions;
}

const ScatterRenderer: React.FC<ScatterRendererProps> = ({
  data,
  isDark,
  vizOptions,
}) => {
  const { chartData, xKey, yKey, sizeKey } = useMemo(() => {
    if (!data || data.length === 0)
      return { chartData: [], xKey: '', yKey: '', sizeKey: '' };

    const keys = Object.keys(data[0]);
    const numericKeys = keys.filter(
      (k) => typeof data[0][k] === 'number' || !isNaN(Number(data[0][k]))
    );

    if (numericKeys.length < 2)
      return { chartData: [], xKey: '', yKey: '', sizeKey: '' };

    const xk = numericKeys[0];
    const yk = numericKeys[1];
    const sk = numericKeys.length > 2 ? numericKeys[2] : '';

    const cd = data.map((row) => ({
      x: Number(row[xk]),
      y: Number(row[yk]),
      ...(sk ? { z: Number(row[sk]) } : {}),
      _original: row,
    }));

    return { chartData: cd, xKey: xk, yKey: yk, sizeKey: sk };
  }, [data]);

  if (chartData.length === 0) return null;

  const textColor = isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.45)';
  const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
  const dotColor = vizOptions?.series_colors?.['scatter'] || CHART_COLORS[0];

  const axisConfig = vizOptions?.axis;

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
        <ScatterChart
          margin={{ top: 8, right: 8, left: -12, bottom: 0 }}
        >
          <CartesianGrid
            stroke={gridColor}
            strokeDasharray="3 3"
          />
          <XAxis
            type="number"
            dataKey="x"
            name={xKey}
            tick={{ fontSize: 10, fill: textColor }}
            tickFormatter={(v: number) => formatValue(v, vizOptions)}
            axisLine={false}
            tickLine={false}
            label={
              axisConfig?.x_label
                ? {
                    value: axisConfig.x_label,
                    fontSize: 10,
                    fill: textColor,
                    position: 'insideBottomRight',
                    offset: -4,
                  }
                : undefined
            }
          />
          <YAxis
            type="number"
            dataKey="y"
            name={yKey}
            tick={{ fontSize: 10, fill: textColor }}
            tickFormatter={(v: number) => formatValue(v, vizOptions)}
            axisLine={false}
            tickLine={false}
            label={
              axisConfig?.y_label
                ? {
                    value: axisConfig.y_label,
                    fontSize: 10,
                    fill: textColor,
                    angle: -90,
                    position: 'insideLeft',
                  }
                : undefined
            }
          />
          {sizeKey && (
            <ZAxis
              type="number"
              dataKey="z"
              range={[20, 200]}
              name={sizeKey}
            />
          )}
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(value: number, name: string) => [
              formatValue(value, vizOptions),
              name === 'x' ? xKey : name === 'y' ? yKey : sizeKey,
            ]}
          />
          <Scatter
            data={chartData}
            fill={dotColor}
            fillOpacity={0.7}
            animationDuration={600}
          />
        </ScatterChart>
      </ResponsiveContainer>
    </Box>
  );
};

export default ScatterRenderer;

import React, { useMemo } from 'react';
import { Box, Typography } from '@mui/material';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
} from 'recharts';
import { type VizOptions, CHART_COLORS, formatValue } from './widgetTypes';

interface PieRendererProps {
  data: any[];
  isDark: boolean;
  vizOptions?: VizOptions;
}

const PieRenderer: React.FC<PieRendererProps> = ({
  data,
  isDark,
  vizOptions,
}) => {
  const legendConfig = vizOptions?.legend;
  const showLegend = legendConfig?.show !== false;

  const { chartData, labelKey, numKey, total } = useMemo(() => {
    if (!data || data.length === 0)
      return { chartData: [], labelKey: '', numKey: '', total: 0 };

    const keys = Object.keys(data[0]);
    const nk = keys.find((k) => typeof data[0][k] === 'number' || !isNaN(Number(data[0][k])));
    const lk = keys.find((k) => k !== nk);
    if (!nk || !lk) return { chartData: [], labelKey: '', numKey: '', total: 0 };

    const cd = data.slice(0, 12).map((row) => ({
      name: String(row[lk]),
      value: Number(row[nk]),
    }));
    const t = cd.reduce((s, r) => s + r.value, 0);

    return { chartData: cd, labelKey: lk, numKey: nk, total: t };
  }, [data]);

  if (chartData.length === 0) return null;

  const getColor = (index: number, name: string) => {
    if (vizOptions?.series_colors?.[name]) return vizOptions.series_colors[name];
    return CHART_COLORS[index % CHART_COLORS.length];
  };

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
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius="45%"
            outerRadius="75%"
            paddingAngle={2}
            dataKey="value"
            nameKey="name"
            animationDuration={600}
            stroke="none"
          >
            {chartData.map((entry, i) => (
              <Cell
                key={entry.name}
                fill={getColor(i, entry.name)}
              />
            ))}
          </Pie>
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(value: number, name: string) => [
              `${formatValue(value, vizOptions)} (${total > 0 ? Math.round((value / total) * 100) : 0}%)`,
              name,
            ]}
          />
          {showLegend && (
            <Legend
              wrapperStyle={{ fontSize: '0.68rem', paddingTop: 0 }}
              iconType="circle"
              iconSize={8}
              layout={legendConfig?.position === 'right' ? 'vertical' : 'horizontal'}
              verticalAlign={legendConfig?.position === 'right' ? 'middle' : 'bottom'}
              align={legendConfig?.position === 'right' ? 'right' : 'center'}
            />
          )}
        </PieChart>
      </ResponsiveContainer>
    </Box>
  );
};

export default PieRenderer;

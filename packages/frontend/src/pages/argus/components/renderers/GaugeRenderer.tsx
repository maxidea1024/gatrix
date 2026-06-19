import React, { useMemo } from 'react';
import { Box, Typography, LinearProgress, alpha } from '@mui/material';
import {
  ResponsiveContainer,
  RadialBarChart,
  RadialBar,
  PolarAngleAxis,
} from 'recharts';
import {
  type VizOptions,
  CHART_COLORS,
  formatValue,
  getThresholdColor,
} from './widgetTypes';

interface GaugeRendererProps {
  data: any[];
  isDark: boolean;
  mode: 'radial' | 'bar';
  vizOptions?: VizOptions;
}

const GaugeRenderer: React.FC<GaugeRendererProps> = ({
  data,
  isDark,
  mode,
  vizOptions,
}) => {
  const gaugeOpts = vizOptions?.gauge;
  const min = gaugeOpts?.min ?? 0;
  const max = gaugeOpts?.max ?? 100;

  const items = useMemo(() => {
    if (!data || data.length === 0) return [];

    const keys = Object.keys(data[0]);
    const numKey = keys.find(
      (k) => typeof data[0][k] === 'number' || !isNaN(Number(data[0][k]))
    );
    const labelKey = keys.find((k) => k !== numKey);

    if (!numKey) return [];

    return data.slice(0, mode === 'radial' ? 1 : 6).map((row, i) => {
      const value = Number(row[numKey]);
      const label = labelKey ? String(row[labelKey]) : numKey;
      const percent = max > min ? ((value - min) / (max - min)) * 100 : 0;
      const color = getThresholdColor(
        value,
        vizOptions?.thresholds,
        CHART_COLORS[i % CHART_COLORS.length]
      );
      return { value, label, percent: Math.min(Math.max(percent, 0), 100), color };
    });
  }, [data, min, max, mode, vizOptions?.thresholds]);

  if (items.length === 0) return null;

  // ── Radial Gauge ──
  if (mode === 'radial') {
    const item = items[0];
    const chartData = [{ value: item.percent, fill: item.color }];

    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          width: '100%',
          position: 'relative',
        }}
      >
        <Box sx={{ width: '80%', height: '80%', maxWidth: 200, maxHeight: 200 }}>
          <ResponsiveContainer width="100%" height="100%">
            <RadialBarChart
              cx="50%"
              cy="50%"
              innerRadius="70%"
              outerRadius="100%"
              startAngle={225}
              endAngle={-45}
              data={chartData}
              barSize={12}
            >
              <PolarAngleAxis
                type="number"
                domain={[0, 100]}
                angleAxisId={0}
                tick={false}
              />
              <RadialBar
                dataKey="value"
                cornerRadius={6}
                fill={item.color}
                background={{
                  fill: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
                }}
                animationDuration={600}
              />
            </RadialBarChart>
          </ResponsiveContainer>
        </Box>
        {/* Center value */}
        <Box
          sx={{
            position: 'absolute',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}
        >
          <Typography
            sx={{
              fontSize: '1.6rem',
              fontWeight: 800,
              color: item.color,
              lineHeight: 1.1,
            }}
          >
            {formatValue(item.value, vizOptions)}
          </Typography>
          {gaugeOpts?.show_threshold_labels && (
            <Typography
              sx={{ fontSize: '0.65rem', color: 'text.secondary', mt: 0.3 }}
            >
              {item.label}
            </Typography>
          )}
        </Box>
      </Box>
    );
  }

  // ── Bar Gauge ──
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 1,
        height: '100%',
        justifyContent: 'center',
        px: 1,
        py: 0.5,
        overflow: 'auto',
      }}
    >
      {items.map((item, i) => (
        <Box key={i}>
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              mb: 0.3,
            }}
          >
            <Typography
              sx={{
                fontSize: '0.72rem',
                color: 'text.secondary',
                fontWeight: 500,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                maxWidth: '60%',
              }}
            >
              {item.label}
            </Typography>
            <Typography
              sx={{
                fontSize: '0.78rem',
                fontWeight: 700,
                color: item.color,
              }}
            >
              {formatValue(item.value, vizOptions)}
            </Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={item.percent}
            sx={{
              height: 10,
              borderRadius: 5,
              backgroundColor: isDark
                ? 'rgba(255,255,255,0.06)'
                : 'rgba(0,0,0,0.06)',
              '& .MuiLinearProgress-bar': {
                borderRadius: 5,
                backgroundColor: item.color,
                transition: 'transform 0.6s ease',
              },
            }}
          />
        </Box>
      ))}
    </Box>
  );
};

export default GaugeRenderer;

import React, { useMemo } from 'react';
import { Box, Typography, alpha } from '@mui/material';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
} from 'recharts';
import {
  type VizOptions,
  CHART_COLORS,
  formatValue,
  getThresholdColor,
} from './widgetTypes';

interface StatRendererProps {
  data: any[];
  isDark: boolean;
  vizOptions?: VizOptions;
}

const StatRenderer: React.FC<StatRendererProps> = ({
  data,
  isDark,
  vizOptions,
}) => {
  const statOpts = vizOptions?.stat;
  const orientation = statOpts?.orientation ?? 'vertical';
  const showSparkline = statOpts?.graph_mode !== 'none';
  const showChange = statOpts?.show_change ?? false;

  // Extract primary value
  const { value, label, sparklineData, changePercent } = useMemo(() => {
    if (!data || data.length === 0) return { value: 0, label: '', sparklineData: [], changePercent: undefined };

    const first = data[0];
    const keys = Object.keys(first);
    const numKey = keys.find((k) => typeof first[k] === 'number' || (first[k] !== null && first[k] !== '' && typeof first[k] !== 'boolean' && !isNaN(Number(first[k]))));
    const labelKey = keys.find((k) => k !== numKey && typeof first[k] === 'string');

    const primaryValue = numKey ? Number(first[numKey]) : 0;
    const primaryLabel = labelKey ? String(first[labelKey]) : (numKey || '');

    // If data has multiple rows, use for sparkline
    let spark: { value: number }[] = [];
    if (data.length > 1 && numKey) {
      spark = data.map((row) => ({ value: Number(row[numKey]) }));
    }

    // Calculate change % if we have time series data
    let change: number | undefined;
    if (showChange && spark.length >= 2) {
      const recent = spark[spark.length - 1].value;
      const previous = spark[0].value;
      if (previous !== 0) {
        change = ((recent - previous) / Math.abs(previous)) * 100;
      }
    }

    return { value: primaryValue, label: primaryLabel, sparklineData: spark, changePercent: change };
  }, [data, showChange]);

  const formattedValue = formatValue(value, vizOptions);
  const thresholdColor = getThresholdColor(
    value,
    vizOptions?.thresholds,
    CHART_COLORS[0]
  );

  const textSize = statOpts?.text_size || 36;

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: orientation === 'horizontal' ? 'row' : 'column',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100%',
        width: '100%',
        gap: orientation === 'horizontal' ? 2 : 0.5,
        p: 1,
        position: 'relative',
      }}
    >
      {/* Main Value */}
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          zIndex: 1,
        }}
      >
        <Typography
          sx={{
            fontSize: `${textSize}px`,
            fontWeight: 800,
            lineHeight: 1.1,
            color: thresholdColor,
            letterSpacing: '-0.02em',
          }}
        >
          {formattedValue}
        </Typography>

        {/* Change indicator */}
        {changePercent !== undefined && (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.3,
              mt: 0.3,
            }}
          >
            <Typography
              sx={{
                fontSize: '0.72rem',
                fontWeight: 600,
                color:
                  changePercent > 0
                    ? '#4caf50'
                    : changePercent < 0
                      ? '#f44336'
                      : 'text.secondary',
              }}
            >
              {changePercent > 0 ? '▲' : changePercent < 0 ? '▼' : '─'}{' '}
              {Math.abs(changePercent).toFixed(1)}%
            </Typography>
          </Box>
        )}

        {/* Label (stat_mode = value_and_name) */}
        {statOpts?.text_mode === 'value_and_name' && label && (
          <Typography
            sx={{
              fontSize: '0.7rem',
              color: 'text.secondary',
              mt: 0.3,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              fontWeight: 500,
            }}
          >
            {label}
          </Typography>
        )}
      </Box>

      {/* Sparkline */}
      {showSparkline && sparklineData.length > 1 && (
        <Box
          sx={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: '35%',
            opacity: 0.4,
          }}
        >
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={sparklineData}
              margin={{ top: 0, right: 0, left: 0, bottom: 0 }}
            >
              <Area
                type="monotone"
                dataKey="value"
                stroke={alpha(thresholdColor, 0.6)}
                strokeWidth={1.5}
                fill={alpha(thresholdColor, 0.12)}
                dot={false}
                animationDuration={600}
              />
            </AreaChart>
          </ResponsiveContainer>
        </Box>
      )}
    </Box>
  );
};

export default StatRenderer;

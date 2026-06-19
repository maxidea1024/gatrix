import React, { useMemo } from 'react';
import { Box, Typography, Tooltip as MuiTooltip, alpha } from '@mui/material';
import { type VizOptions, CHART_COLORS, formatValue } from './widgetTypes';

interface HeatmapRendererProps {
  data: any[];
  isDark: boolean;
  vizOptions?: VizOptions;
}

/**
 * 2D heatmap renderer using SVG cells.
 *
 * Expected data format:
 * [{ x: 'Mon', y: '00', value: 42 }, ...]
 * or auto-detected from: [{ day: 'Mon', hour: 0, count: 42 }]
 */
const HeatmapRenderer: React.FC<HeatmapRendererProps> = ({
  data,
  isDark,
  vizOptions,
}) => {
  const { cells, xLabels, yLabels, maxVal, minVal, xKey, yKey, valKey } =
    useMemo(() => {
      if (!data || data.length === 0)
        return {
          cells: [],
          xLabels: [],
          yLabels: [],
          maxVal: 0,
          minVal: 0,
          xKey: '',
          yKey: '',
          valKey: '',
        };

      const keys = Object.keys(data[0]);
      // Auto-detect: look for x/y/value or day/hour/count pattern
      const vk =
        keys.find((k) => k === 'value' || k === 'count') ||
        keys.find((k) => typeof data[0][k] === 'number') ||
        keys[2];
      const xk =
        keys.find(
          (k) =>
            k !== vk &&
            (k === 'x' || k === 'hour' || k === 'time' || k === 'column')
        ) || keys[1];
      const yk =
        keys.find(
          (k) =>
            k !== vk &&
            k !== xk &&
            (k === 'y' || k === 'day' || k === 'row')
        ) || keys[0];

      if (!vk || !xk || !yk)
        return {
          cells: data,
          xLabels: [],
          yLabels: [],
          maxVal: 0,
          minVal: 0,
          xKey: '',
          yKey: '',
          valKey: '',
        };

      const xSet = new Set<string>();
      const ySet = new Set<string>();
      let max = -Infinity;
      let min = Infinity;

      for (const row of data) {
        const v = Number(row[vk]);
        xSet.add(String(row[xk]));
        ySet.add(String(row[yk]));
        if (v > max) max = v;
        if (v < min) min = v;
      }

      return {
        cells: data,
        xLabels: Array.from(xSet),
        yLabels: Array.from(ySet),
        maxVal: max,
        minVal: min,
        xKey: xk,
        yKey: yk,
        valKey: vk,
      };
    }, [data]);

  // Build O(1) lookup map for cell values
  const cellMap = useMemo(() => {
    const map = new Map<string, any>();
    for (const c of cells) {
      map.set(`${String(c[xKey])}|${String(c[yKey])}`, c);
    }
    return map;
  }, [cells, xKey, yKey]);

  if (xLabels.length === 0 || yLabels.length === 0) return null;

  // Color interpolation
  const baseColor = vizOptions?.series_colors?.['heatmap'] || CHART_COLORS[0];

  function getColor(value: number): string {
    if (maxVal === minVal) return alpha(baseColor, 0.5);
    const ratio = (value - minVal) / (maxVal - minVal);
    // Interpolate from transparent to solid
    return alpha(baseColor, 0.08 + ratio * 0.85);
  }

  const cellWidth = 100 / xLabels.length;
  const cellHeight = 100 / yLabels.length;
  const labelHeight = 16;
  const labelWidth = 40;

  return (
    <Box
      sx={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        p: 0.5,
      }}
    >
      {/* Main heatmap grid */}
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          minHeight: 0,
        }}
      >
        {/* Y labels */}
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-around',
            minWidth: labelWidth,
            pr: 0.5,
          }}
        >
          {yLabels.map((y) => (
            <Typography
              key={y}
              sx={{
                fontSize: '0.58rem',
                color: 'text.secondary',
                textAlign: 'right',
                lineHeight: 1,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {y}
            </Typography>
          ))}
        </Box>

        {/* Grid */}
        <Box
          sx={{
            flex: 1,
            display: 'grid',
            gridTemplateColumns: `repeat(${xLabels.length}, 1fr)`,
            gridTemplateRows: `repeat(${yLabels.length}, 1fr)`,
            gap: '1px',
            borderRadius: 1,
            overflow: 'hidden',
          }}
        >
          {yLabels.map((y) =>
            xLabels.map((x) => {
              const cell = cellMap.get(`${x}|${y}`);
              const value = cell ? Number(cell[valKey]) : 0;

              return (
                <MuiTooltip
                  key={`${y}-${x}`}
                  title={`${y} × ${x}: ${formatValue(value, vizOptions)}`}
                  arrow
                  placement="top"
                >
                  <Box
                    sx={{
                      backgroundColor: getColor(value),
                      borderRadius: 0.3,
                      cursor: 'default',
                      transition: 'opacity 0.15s',
                      '&:hover': { opacity: 0.8 },
                      minWidth: 0,
                      minHeight: 0,
                    }}
                  />
                </MuiTooltip>
              );
            })
          )}
        </Box>
      </Box>

      {/* X labels */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-around',
          mt: 0.3,
          pl: `${labelWidth}px`,
        }}
      >
        {xLabels.map((x) => (
          <Typography
            key={x}
            sx={{
              fontSize: '0.58rem',
              color: 'text.secondary',
              textAlign: 'center',
              flex: 1,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {x}
          </Typography>
        ))}
      </Box>
    </Box>
  );
};

export default HeatmapRenderer;

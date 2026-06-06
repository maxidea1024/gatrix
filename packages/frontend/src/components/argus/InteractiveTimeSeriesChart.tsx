import React, { useMemo, useRef, useEffect } from 'react';
import { Box, useTheme, alpha } from '@mui/material';
import { Line, Bar, Chart } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  LogarithmicScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip as ChartTooltip,
  Legend,
  Filler,
} from 'chart.js';
import {
  getCrosshairPlugin,
  getDragSelectPlugin,
} from '../../utils/chartPlugins';

ChartJS.register(
  CategoryScale,
  LinearScale,
  LogarithmicScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  ChartTooltip,
  Legend,
  Filler
);

export interface ChartDataset {
  id?: string;
  label: string;
  data: number[];
  color?: string;
  type?: 'bar' | 'line' | 'area';
}

interface InteractiveTimeSeriesChartProps {
  // Legacy single-series support
  data?: { label: string; count: number }[];
  type?: 'bar' | 'line' | 'area';

  // Multi-series support
  labels?: string[];
  datasets?: ChartDataset[];

  // Configuration
  height?: number;
  onZoom?: (startIndex: number, endIndex: number) => void;
  yAxisType?: 'linear' | 'logarithmic';
  showLegend?: boolean;
  legendPosition?: 'top' | 'bottom' | 'left' | 'right';
}

const InteractiveTimeSeriesChart: React.FC<InteractiveTimeSeriesChartProps> = ({
  data,
  type = 'bar',
  labels,
  datasets,
  height = 200,
  onZoom,
  yAxisType = 'linear',
  showLegend = false,
  legendPosition = 'top',
}) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const onZoomRef = useRef(onZoom);
  useEffect(() => {
    onZoomRef.current = onZoom;
  }, [onZoom]);

  const finalLabels = useMemo(() => {
    if (labels) return labels;
    if (data) return data.map((d) => d.label);
    return [];
  }, [labels, data]);

  const finalDatasets = useMemo(() => {
    if (datasets && datasets.length > 0) return datasets;
    if (data) {
      return [
        {
          label: 'Count',
          data: data.map((d) => d.count),
          type: type,
          color: theme.palette.primary.main,
        },
      ];
    }
    return [];
  }, [datasets, data, type, theme.palette.primary.main]);

  const chartData = useMemo(() => {
    return {
      labels: finalLabels,
      datasets: finalDatasets.map((ds, i) => {
        const dsColor = ds.color || theme.palette.primary.main;
        const dsType = ds.type || 'bar';
        return {
          type: dsType === 'area' ? 'line' : dsType,
          label: ds.label,
          data: ds.data,
          backgroundColor: (ctx: any) => {
            if (dsType === 'bar') return alpha(dsColor, 0.6);
            if (dsType === 'area') {
              const gradient = ctx.chart?.ctx?.createLinearGradient(
                0,
                0,
                0,
                220
              );
              if (gradient) {
                gradient.addColorStop(0, alpha(dsColor, 0.4));
                gradient.addColorStop(1, alpha(dsColor, 0.01));
              }
              return gradient || alpha(dsColor, 0.2);
            }
            return dsColor;
          },
          borderColor: dsColor,
          borderWidth: dsType === 'bar' ? 0 : 2,
          borderRadius: dsType === 'bar' ? 4 : 0,
          borderSkipped: false,
          tension: 0.4,
          fill: dsType === 'area',
          pointRadius: 0,
          pointHoverRadius: 4,
          yAxisID: 'y', // associate with main y axis
        };
      }),
    };
  }, [finalLabels, finalDatasets]);

  const options = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 400 },
      plugins: {
        legend: {
          display: showLegend,
          position: legendPosition,
          labels: {
            color: isDark ? '#ccc' : '#555',
            font: { size: 11, family: 'monospace' },
            usePointStyle: true,
            boxWidth: 6,
          },
        },
        tooltip: {
          mode: 'index' as const,
          intersect: false,
          backgroundColor: isDark
            ? 'rgba(30,30,40,0.95)'
            : 'rgba(255,255,255,0.95)',
          titleColor: isDark ? '#fff' : '#1a1a2e',
          bodyColor: isDark ? '#ccc' : '#555',
          borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
          borderWidth: 1,
          padding: 10,
          cornerRadius: 8,
          displayColors: true,
          usePointStyle: true,
          boxWidth: 8,
          boxHeight: 8,
        },
      },
      scales: {
        x: {
          grid: { display: false },
          border: { display: false },
          ticks: {
            maxRotation: 0,
            autoSkip: true,
            maxTicksLimit: 12,
            font: { size: 10 },
            color: isDark ? '#666' : '#999',
          },
        },
        y: {
          type: yAxisType,
          beginAtZero: true,
          border: { display: false },
          grid: {
            color: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
            drawBorder: false,
          },
          ticks: {
            font: { size: 10 },
            color: isDark ? '#555' : '#aaa',
            padding: 8,
          },
        },
      },
      interaction: {
        mode: 'nearest' as const,
        axis: 'x' as const,
        intersect: false,
      },
    }),
    [isDark, showLegend, legendPosition, yAxisType]
  );

  const plugins = useMemo(() => {
    const list = [getCrosshairPlugin(isDark)];
    if (onZoom) {
      list.push(
        getDragSelectPlugin(isDark, (start, end) => {
          if (onZoomRef.current) {
            onZoomRef.current(start, end);
          }
        })
      );
    }
    return list;
  }, [isDark, !!onZoom]);

  if (finalLabels.length === 0) return null;

  // Use Chart component to render mixed chart types correctly
  return (
    <Box sx={{ height, position: 'relative', width: '100%' }}>
      <Chart
        type="bar"
        data={chartData as any}
        options={options as any}
        plugins={plugins}
      />
    </Box>
  );
};

export default InteractiveTimeSeriesChart;

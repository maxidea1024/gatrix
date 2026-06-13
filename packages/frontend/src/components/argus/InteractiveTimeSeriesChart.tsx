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
  ArcElement,
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
  ArcElement,
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
  type?:
    | 'bar'
    | 'line'
    | 'area'
    | 'scatter'
    | 'stacked-bar'
    | 'stacked-area'
    | 'stacked-line'
    | 'pie'
    | 'doughnut';
}

interface InteractiveTimeSeriesChartProps {
  // Legacy single-series support
  data?: { label: string; count: number }[];
  type?:
    | 'bar'
    | 'line'
    | 'area'
    | 'scatter'
    | 'stacked-bar'
    | 'stacked-area'
    | 'stacked-line'
    | 'pie'
    | 'doughnut';

  // Multi-series support
  labels?: string[];
  datasets?: ChartDataset[];

  // Configuration
  height?: number | string;
  onZoom?: (startIndex: number, endIndex: number) => void;
  yAxisType?: 'linear' | 'logarithmic';
  showLegend?: boolean;
  legendPosition?: 'top' | 'bottom' | 'left' | 'right';
  onPointClick?: (index: number, label: string) => void;
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
  onPointClick,
}) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const onZoomRef = useRef(onZoom);
  useEffect(() => {
    onZoomRef.current = onZoom;
  }, [onZoom]);

  const PIE_COLORS = [
    '#3b82f6',
    '#10b981',
    '#8b5cf6',
    '#f59e0b',
    '#ec4899',
    '#14b8a6',
    '#ef4444',
    '#06b6d4',
  ];

  const isPieOrDoughnut = type === 'pie' || type === 'doughnut';

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
    if (isPieOrDoughnut) {
      const labelsList = finalDatasets.map((ds) => ds.label);
      const dataList = finalDatasets.map((ds) => {
        return ds.data.reduce((acc, val) => acc + (val || 0), 0);
      });
      const colorsList = finalDatasets.map(
        (ds, idx) => ds.color || PIE_COLORS[idx % PIE_COLORS.length]
      );
      return {
        labels: labelsList,
        datasets: [
          {
            label: 'Total',
            data: dataList,
            backgroundColor: colorsList.map((c) => alpha(c, 0.75)),
            borderColor: colorsList,
            borderWidth: 1,
          },
        ],
      };
    }

    return {
      labels: finalLabels,
      datasets: finalDatasets.map((ds, i) => {
        const dsColor = ds.color || theme.palette.primary.main;
        const dsType = ds.type || type || 'bar';
        const resolvedType =
          dsType === 'stacked-bar'
            ? 'bar'
            : dsType === 'area' ||
                dsType === 'stacked-area' ||
                dsType === 'scatter' ||
                dsType === 'stacked-line'
              ? 'line'
              : dsType;
        return {
          type: resolvedType,
          label: ds.label,
          data: ds.data,
          backgroundColor: (ctx: any) => {
            if (dsType === 'bar' || dsType === 'stacked-bar')
              return alpha(dsColor, 0.6);
            if (dsType === 'area' || dsType === 'stacked-area') {
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
          borderWidth: dsType === 'bar' || dsType === 'stacked-bar' ? 0 : 2,
          borderRadius: 0,
          borderSkipped: false,
          tension: 0.4,
          fill: dsType === 'area' || dsType === 'stacked-area',
          pointRadius: dsType === 'scatter' ? 5 : 0,
          pointHoverRadius: dsType === 'scatter' ? 7 : 4,
          showLine: dsType !== 'scatter',
          yAxisID: 'y', // associate with main y axis
          ...(dsType === 'bar' || dsType === 'stacked-bar'
            ? {
                barPercentage: 0.85,
                categoryPercentage: 0.85,
              }
            : {}),
        };
      }),
    };
  }, [
    finalLabels,
    finalDatasets,
    type,
    theme.palette.primary.main,
    isPieOrDoughnut,
  ]);

  const options = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 400 },
      onClick: (event: any, elements: any[]) => {
        if (elements && elements.length > 0 && onPointClick) {
          const firstElement = elements[0];
          const datasetIndex = firstElement.datasetIndex;
          const index = firstElement.index;
          const datasetLabel = chartData.datasets[datasetIndex].label || '';
          onPointClick(index, datasetLabel);
        }
      },
      plugins: {
        legend: {
          display: showLegend,
          position: legendPosition,
          labels: {
            color: isDark ? '#ccc' : '#555',
            font: { size: 11, family: 'monospace' },
            usePointStyle: true,
            pointStyleWidth: 6,
            boxWidth: 6,
            boxHeight: 6,
            padding: 12,
          },
          onHover: (event: any, legendItem: any) => {
            const chart = event.chart;
            const hoveredDatasetIndex = legendItem.datasetIndex;

            chart.data.datasets.forEach((dataset: any, index: number) => {
              if (index === hoveredDatasetIndex) {
                dataset.borderColor =
                  dataset.originalBorderColor || dataset.borderColor;
                dataset.backgroundColor =
                  dataset.originalBackgroundColor || dataset.backgroundColor;
              } else {
                if (!dataset.originalBorderColor) {
                  dataset.originalBorderColor = dataset.borderColor;
                }
                if (!dataset.originalBackgroundColor) {
                  dataset.originalBackgroundColor = dataset.backgroundColor;
                }
                dataset.borderColor = alpha(dataset.originalBorderColor, 0.15);
                if (typeof dataset.originalBackgroundColor === 'string') {
                  dataset.backgroundColor = alpha(
                    dataset.originalBackgroundColor,
                    0.05
                  );
                } else {
                  dataset.backgroundColor = alpha(
                    dataset.originalBorderColor,
                    0.03
                  );
                }
              }
            });
            chart.update();
          },
          onLeave: (event: any) => {
            const chart = event.chart;
            chart.data.datasets.forEach((dataset: any) => {
              if (dataset.originalBorderColor) {
                dataset.borderColor = dataset.originalBorderColor;
              }
              if (dataset.originalBackgroundColor) {
                dataset.backgroundColor = dataset.originalBackgroundColor;
              }
            });
            chart.update();
          },
        },
        tooltip: {
          mode: isPieOrDoughnut ? ('nearest' as const) : ('index' as const),
          intersect: isPieOrDoughnut,
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
      ...(!isPieOrDoughnut
        ? {
            scales: {
              x: {
                grid: { display: false },
                border: { display: false },
                stacked:
                  type === 'stacked-bar' ||
                  type === 'stacked-area' ||
                  type === 'stacked-line',
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
                stacked:
                  type === 'stacked-bar' ||
                  type === 'stacked-area' ||
                  type === 'stacked-line',
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
          }
        : {}),
    }),
    [
      isDark,
      showLegend,
      legendPosition,
      yAxisType,
      type,
      isPieOrDoughnut,
      onPointClick,
      chartData,
    ]
  );

  const plugins = useMemo(() => {
    if (isPieOrDoughnut) return [];
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
  }, [isDark, !!onZoom, isPieOrDoughnut]);

  if (finalLabels.length === 0) return null;

  return (
    <Box sx={{ height, position: 'relative', width: '100%' }}>
      <Chart
        type={isPieOrDoughnut ? type : 'bar'}
        data={chartData as any}
        options={options as any}
        plugins={plugins}
      />
    </Box>
  );
};

export default InteractiveTimeSeriesChart;

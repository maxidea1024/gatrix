import React, { useMemo } from 'react';
import { Box, useTheme, alpha } from '@mui/material';
import { Line, Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip as ChartTooltip,
  Legend,
  Filler,
} from 'chart.js';
import { getCrosshairPlugin, getDragSelectPlugin } from '../../utils/chartPlugins';

ChartJS.register(
  CategoryScale, LinearScale, PointElement, LineElement, BarElement,
  Title, ChartTooltip, Legend, Filler
);

interface InteractiveTimeSeriesChartProps {
  data: { label: string; count: number }[];
  type?: 'bar' | 'line';
  height?: number;
  onZoom?: (startIndex: number, endIndex: number) => void;
}

const InteractiveTimeSeriesChart: React.FC<InteractiveTimeSeriesChartProps> = ({
  data,
  type = 'bar',
  height = 200,
  onZoom,
}) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const chartData = useMemo(() => {
    return {
      labels: data.map(d => d.label),
      datasets: [{
        label: 'Count',
        data: data.map(d => d.count),
        backgroundColor: (ctx: any) => {
          if (type === 'bar') return alpha(theme.palette.primary.main, 0.6);
          const gradient = ctx.chart?.ctx?.createLinearGradient(0, 0, 0, 220);
          if (gradient) {
            gradient.addColorStop(0, alpha(theme.palette.primary.main, 0.4));
            gradient.addColorStop(1, alpha(theme.palette.primary.main, 0.01));
          }
          return gradient || alpha(theme.palette.primary.main, 0.2);
        },
        borderColor: theme.palette.primary.main,
        borderWidth: type === 'line' ? 2 : 0,
        borderRadius: type === 'bar' ? 4 : 0,
        borderSkipped: false,
        tension: 0.4,
        fill: type === 'line',
        pointRadius: 0,
        pointHoverRadius: 4,
      }],
    };
  }, [data, theme, type]);

  const options = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 400 },
    plugins: {
      legend: { display: false },
      tooltip: {
        mode: 'index' as const,
        intersect: false,
        backgroundColor: isDark ? 'rgba(30,30,40,0.95)' : 'rgba(255,255,255,0.95)',
        titleColor: isDark ? '#fff' : '#1a1a2e',
        bodyColor: isDark ? '#ccc' : '#555',
        borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
        borderWidth: 1,
        padding: 10,
        cornerRadius: 8,
        displayColors: false,
      },
    },
    scales: {
      x: {
        grid: { display: false },
        border: { display: false },
        ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 12, font: { size: 10 }, color: isDark ? '#666' : '#999' },
      },
      y: {
        beginAtZero: true,
        border: { display: false },
        grid: { color: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)', drawBorder: false },
        ticks: { font: { size: 10 }, color: isDark ? '#555' : '#aaa', padding: 8 },
      },
    },
    interaction: { mode: 'nearest' as const, axis: 'x' as const, intersect: false },
  }), [isDark]);

  const plugins = useMemo(() => {
    const list = [getCrosshairPlugin(isDark)];
    if (onZoom) {
      list.push(getDragSelectPlugin(isDark, onZoom));
    }
    return list;
  }, [isDark, onZoom]);

  if (data.length === 0) return null;

  return (
    <Box sx={{ height, position: 'relative', width: '100%' }}>
      {type === 'bar' ? (
        <Bar data={chartData} options={options} plugins={plugins} />
      ) : (
        <Line data={chartData} options={options} plugins={plugins} />
      )}
    </Box>
  );
};

export default InteractiveTimeSeriesChart;

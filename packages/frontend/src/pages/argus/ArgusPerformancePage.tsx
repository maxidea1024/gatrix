import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  ToggleButton,
  ToggleButtonGroup,
  useTheme,
  Divider,
  TableSortLabel,
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  Speed as SpeedIcon,
  ArrowBack as ArrowBackIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
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
import { Line, Bar } from 'react-chartjs-2';
import PageContentLoader from '@/components/common/PageContentLoader';
import argusService, {
  ArgusTransaction,
  ArgusTransactionDetail,
} from '@/services/argusService';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  ChartTooltip,
  Legend,
  Filler
);

const TIME_RANGES = [
  { value: '1h', label: '1H' },
  { value: '6h', label: '6H' },
  { value: '24h', label: '24H' },
  { value: '7d', label: '7D' },
  { value: '30d', label: '30D' },
];

const ArgusPerformancePage: React.FC = () => {
  const theme = useTheme();
  const { t } = useTranslation();
  const isDark = theme.palette.mode === 'dark';

  const projectId = '1';

  const [transactions, setTransactions] = useState<ArgusTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState(() => localStorage.getItem('argus-perf-period') || '24h');
  const [sort, setSort] = useState<string>('count');

  // Detail view
  const [selectedTxn, setSelectedTxn] = useState<string | null>(null);
  const [detail, setDetail] = useState<ArgusTransactionDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    try {
      const data = await argusService.getTransactions(projectId, { period, sort, limit: 30 });
      setTransactions(data);
    } catch (error) {
      console.error('Failed to fetch transactions:', error);
    } finally {
      setLoading(false);
    }
  }, [projectId, period, sort]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const fetchDetail = useCallback(async (txnName: string) => {
    setDetailLoading(true);
    try {
      const data = await argusService.getTransactionDetail(projectId, txnName, period);
      setDetail(data);
    } catch (error) {
      console.error('Failed to fetch transaction detail:', error);
    } finally {
      setDetailLoading(false);
    }
  }, [projectId, period]);

  const handleTxnClick = (txnName: string) => {
    setSelectedTxn(txnName);
    fetchDetail(txnName);
  };

  const handleBack = () => {
    setSelectedTxn(null);
    setDetail(null);
  };

  const handlePeriodChange = (_: React.MouseEvent<HTMLElement>, value: string | null) => {
    if (!value) return;
    setPeriod(value);
    localStorage.setItem('argus-perf-period', value);
    if (selectedTxn) fetchDetail(selectedTxn);
  };

  const handleSortChange = (col: string) => {
    setSort(col);
  };

  // Chart data for detail view
  const trendChartData = useMemo(() => {
    if (!detail?.trend) return { labels: [], datasets: [] };
    return {
      labels: detail.trend.map((d) => formatHour(d.hour)),
      datasets: [
        {
          label: 'P95',
          data: detail.trend.map((d) => Number(d.p95)),
          borderColor: theme.palette.warning.main,
          backgroundColor: `${theme.palette.warning.main}20`,
          borderWidth: 2,
          tension: 0.3,
          fill: true,
          pointRadius: 0,
          pointHoverRadius: 3,
          yAxisID: 'y',
        },
        {
          label: t('argus.performance.throughput'),
          data: detail.trend.map((d) => d.count),
          borderColor: theme.palette.primary.main,
          backgroundColor: `${theme.palette.primary.main}40`,
          borderWidth: 1.5,
          tension: 0.3,
          fill: false,
          pointRadius: 0,
          pointHoverRadius: 3,
          yAxisID: 'y1',
        },
      ],
    };
  }, [detail, theme, t]);

  const histogramData = useMemo(() => {
    if (!detail?.histogram) return { labels: [], datasets: [] };
    return {
      labels: detail.histogram.map((d) => d.bucket),
      datasets: [
        {
          label: t('argus.performance.count'),
          data: detail.histogram.map((d) => d.count),
          backgroundColor: `${theme.palette.info.main}80`,
          borderColor: theme.palette.info.main,
          borderWidth: 1,
          borderRadius: 3,
        },
      ],
    };
  }, [detail, theme, t]);

  const baseChartOpts = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      animation: false as const,
      plugins: { legend: { display: true, position: 'top' as const, labels: { boxWidth: 10, font: { size: 11 } } } },
      scales: {
        x: { grid: { display: false }, ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 10, font: { size: 10 } } },
        y: { beginAtZero: true, grid: { color: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }, ticks: { font: { size: 10 } }, title: { display: true, text: 'ms', font: { size: 10 } } },
        y1: { position: 'right' as const, beginAtZero: true, grid: { display: false }, ticks: { font: { size: 10 } }, title: { display: true, text: 'req', font: { size: 10 } } },
      },
      interaction: { mode: 'nearest' as const, axis: 'x' as const, intersect: false },
    }),
    [isDark]
  );

  const barChartOpts = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      animation: false as const,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 10 } } },
        y: { beginAtZero: true, grid: { color: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }, ticks: { font: { size: 10 } } },
      },
    }),
    [isDark]
  );

  // --- Render ---
  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          {selectedTxn && (
            <IconButton onClick={handleBack} size="small">
              <ArrowBackIcon />
            </IconButton>
          )}
          <SpeedIcon sx={{ fontSize: 28, color: theme.palette.primary.main }} />
          <Typography variant="h5" fontWeight={700}>
            {selectedTxn || t('argus.performance.title')}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <ToggleButtonGroup value={period} exclusive onChange={handlePeriodChange} size="small">
            {TIME_RANGES.map((r) => (
              <ToggleButton
                key={r.value}
                value={r.value}
                sx={{ px: 1.2, py: 0.3, textTransform: 'none', fontSize: '0.75rem', minWidth: 36 }}
              >
                {r.label}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
          <IconButton onClick={selectedTxn ? () => fetchDetail(selectedTxn) : fetchTransactions} size="small">
            <RefreshIcon />
          </IconButton>
        </Box>
      </Box>

      {selectedTxn ? (
        /* ===== Detail View ===== */
        <PageContentLoader loading={detailLoading}>
          {/* Trend Chart */}
          <Paper sx={{ p: 2, mb: 2 }}>
            <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1.5 }}>
              {t('argus.performance.latencyTrend')}
            </Typography>
            <Box sx={{ height: 260 }}>
              <Line data={trendChartData} options={baseChartOpts} />
            </Box>
          </Paper>

          <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
            {/* Duration Histogram */}
            <Paper sx={{ p: 2, flex: '1 1 350px', minWidth: 280 }}>
              <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1.5 }}>
                {t('argus.performance.durationDistribution')}
              </Typography>
              <Box sx={{ height: 200 }}>
                <Bar data={histogramData} options={barChartOpts} />
              </Box>
            </Paper>

            {/* Span Summary */}
            <Paper sx={{ p: 2, flex: '1 1 350px', minWidth: 280 }}>
              <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1.5 }}>
                {t('argus.performance.slowestSpans')}
              </Typography>
              {detail?.spans?.length === 0 ? (
                <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
                  {t('argus.performance.noSpans')}
                </Typography>
              ) : (
                <Box sx={{ maxHeight: 200, overflow: 'auto' }}>
                  {detail?.spans?.slice(0, 10).map((span, idx) => (
                    <Box
                      key={idx}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        py: 0.5,
                        borderBottom: `1px solid ${theme.palette.divider}`,
                      }}
                    >
                      <Box sx={{ flex: 1, overflow: 'hidden' }}>
                        <Typography variant="body2" noWrap>
                          {span.description || span.op}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {span.op} · {span.count}x
                        </Typography>
                      </Box>
                      <Typography variant="body2" fontWeight={600} sx={{ ml: 1 }}>
                        {Number(span.avg_duration).toFixed(0)}ms
                      </Typography>
                    </Box>
                  ))}
                </Box>
              )}
            </Paper>
          </Box>
        </PageContentLoader>
      ) : (
        /* ===== Transaction List ===== */
        <PageContentLoader loading={loading}>
          <TableContainer component={Paper}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600, width: '40%' }}>
                    {t('argus.performance.transactionName')}
                  </TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>
                    <TableSortLabel active={sort === 'count'} direction="desc" onClick={() => handleSortChange('count')}>
                      {t('argus.performance.count')}
                    </TableSortLabel>
                  </TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>
                    <TableSortLabel active={sort === 'avg'} direction="desc" onClick={() => handleSortChange('avg')}>
                      {t('argus.performance.avgDuration')}
                    </TableSortLabel>
                  </TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>P50</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>
                    <TableSortLabel active={sort === 'p95'} direction="desc" onClick={() => handleSortChange('p95')}>
                      P95
                    </TableSortLabel>
                  </TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>{t('argus.performance.errorRate')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {transactions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} sx={{ py: 6, textAlign: 'center' }}>
                      <Typography color="text.secondary">
                        {t('argus.performance.noTransactions')}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  transactions.map((txn) => (
                    <TableRow
                      key={txn.name}
                      hover
                      onClick={() => handleTxnClick(txn.name)}
                      sx={{ cursor: 'pointer' }}
                    >
                      <TableCell>
                        <Typography variant="body2" fontWeight={500} noWrap>
                          {txn.name}
                        </Typography>
                      </TableCell>
                      <TableCell>{Number(txn.count).toLocaleString()}</TableCell>
                      <TableCell>{Number(txn.avg_duration).toFixed(0)}ms</TableCell>
                      <TableCell>{Number(txn.p50).toFixed(0)}ms</TableCell>
                      <TableCell>
                        <Typography
                          variant="body2"
                          sx={{
                            fontWeight: 600,
                            color: Number(txn.p95) > 3000
                              ? theme.palette.error.main
                              : Number(txn.p95) > 1000
                              ? theme.palette.warning.main
                              : 'inherit',
                          }}
                        >
                          {Number(txn.p95).toFixed(0)}ms
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={`${Number(txn.error_rate).toFixed(1)}%`}
                          size="small"
                          color={Number(txn.error_rate) > 5 ? 'error' : Number(txn.error_rate) > 1 ? 'warning' : 'default'}
                          variant="outlined"
                        />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </PageContentLoader>
      )}
    </Box>
  );
};

function formatHour(hourStr: string): string {
  try {
    const d = new Date(hourStr);
    return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:00`;
  } catch {
    return hourStr;
  }
}

export default ArgusPerformancePage;

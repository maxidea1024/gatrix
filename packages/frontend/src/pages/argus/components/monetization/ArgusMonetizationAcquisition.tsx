import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Box, Typography, Button, Paper, Table, TableHead, TableRow, TableCell, TableBody,
  TableContainer, ToggleButton, ToggleButtonGroup, LinearProgress, useTheme,
  Select, MenuItem, TextField, InputAdornment, Chip, alpha, IconButton,
} from '@mui/material';
import {
  Campaign as CampaignIcon,
  FileDownload as ExportIcon,
  People as PeopleIcon,
  ShoppingCart as CartIcon,
  Edit as EditIcon,
  CheckCircle as SaveIcon,
} from '@mui/icons-material';
import { Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip as ChartTooltip,
  Legend,
} from 'chart.js';
import SimplePagination from '@/components/common/SimplePagination';
import EmptyPlaceholder from '@/components/common/EmptyPlaceholder';
import ArgusChartSkeleton from '@/components/argus/ArgusChartSkeleton';
import ArgusVolumeChart from '@/components/argus/ArgusVolumeChart';
import useGlobalPageSize from '@/hooks/useGlobalPageSize';
import { downloadCsv, type CsvColumn } from '@/utils/csvExport';
import { fmt, fmtNum, KpiCard } from './MonetizationHelpers';
import {
  getRevenueAcquisition,
  type AcquisitionResponse,
  type AcquisitionTableRow,
} from '@/services/argus/argusAnalytics';

ChartJS.register(ArcElement, ChartTooltip, Legend);

// ─── Types ───────────────────────────────────────────────────────────────────

type GroupBy = 'source' | 'medium' | 'campaign' | 'platform';
type AttributionModel = 'last' | 'first' | 'linear';

interface AdSpendData {
  [dimension: string]: number;
}

// ─── Ad Spend storage helpers ─────────────────────────────────────────────────

function loadAdSpend(projectId: string, groupBy: GroupBy): AdSpendData {
  try {
    const key = `argus_ad_spend_${projectId}_${groupBy}`;
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveAdSpend(projectId: string, groupBy: GroupBy, data: AdSpendData) {
  try {
    const key = `argus_ad_spend_${projectId}_${groupBy}`;
    localStorage.setItem(key, JSON.stringify(data));
  } catch {
    // ignore
  }
}

// ─── Donut Chart ─────────────────────────────────────────────────────────────

interface MiniDonutProps {
  label: string;
  data: { dimension: string; value: number }[];
  isDark: boolean;
  formatter?: (v: number) => string;
}

const DONUT_COLORS = [
  '#6C63FF', '#FF6584', '#43D9AD', '#FFB347', '#4ECDC4',
  '#A8E6CF', '#FF8B94', '#9B59B6', '#3498DB', '#E74C3C',
];

const MiniDonut: React.FC<MiniDonutProps> = ({ label, data, isDark, formatter }) => {
  const theme = useTheme();

  const topItems = useMemo(() => {
    const sorted = [...data].sort((a, b) => b.value - a.value);
    if (sorted.length <= 6) return sorted;
    const top5 = sorted.slice(0, 5);
    const othersVal = sorted.slice(5).reduce((s, r) => s + r.value, 0);
    return [...top5, { dimension: 'Others', value: othersVal }];
  }, [data]);

  const total = topItems.reduce((s, r) => s + r.value, 0);

  const chartData = {
    labels: topItems.map((r) => r.dimension),
    datasets: [{
      data: topItems.map((r) => r.value),
      backgroundColor: DONUT_COLORS.slice(0, topItems.length),
      borderWidth: 2,
      borderColor: isDark ? '#1e1e2e' : '#ffffff',
      hoverBorderWidth: 0,
      hoverOffset: 4,
    }],
  };

  const options: any = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '68%',
    plugins: {
      legend: { display: false },
      tooltip: {
        enabled: false,
        external: null,
      },
    },
    animation: { duration: 400 },
  };

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 2,
        borderRadius: 2,
        bgcolor: isDark ? 'rgba(255,255,255,0.02)' : '#fff',
        display: 'flex',
        flexDirection: 'column',
        gap: 1.5,
        flex: 1,
        minWidth: 0,
      }}
    >
      <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
        {label}
      </Typography>

      <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
        {/* Donut */}
        <Box sx={{ position: 'relative', width: 110, height: 110, flexShrink: 0 }}>
          <Doughnut data={chartData} options={options} />
          <Box
            sx={{
              position: 'absolute', top: '50%', left: '50%',
              transform: 'translate(-50%, -50%)',
              textAlign: 'center', pointerEvents: 'none',
            }}
          >
            <Typography sx={{ fontSize: '0.75rem', fontWeight: 800, lineHeight: 1.1 }}>
              {formatter ? formatter(total) : fmtNum(total)}
            </Typography>
            <Typography sx={{ fontSize: '0.6rem', color: 'text.secondary' }}>Total</Typography>
          </Box>
        </Box>

        {/* Legend */}
        <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 0.6 }}>
          {topItems.map((item, i) => {
            const pct = total > 0 ? (item.value / total) * 100 : 0;
            return (
              <Box key={item.dimension} sx={{ display: 'flex', alignItems: 'center', gap: 0.75, minWidth: 0 }}>
                <Box sx={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, bgcolor: DONUT_COLORS[i] }} />
                <Typography
                  sx={{ fontSize: '0.72rem', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                  title={item.dimension}
                >
                  {item.dimension}
                </Typography>
                <Typography sx={{ fontSize: '0.72rem', fontWeight: 600, flexShrink: 0, color: 'text.secondary' }}>
                  {pct.toFixed(1)}%
                </Typography>
              </Box>
            );
          })}
        </Box>
      </Box>
    </Paper>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

interface ArgusMonetizationAcquisitionProps {
  projectId: string;
  apiParams: any;
  isDark: boolean;
  t: any;
  handleChartZoom: (rawPeriods: string[]) => (startIdx: number, endIdx: number) => void;
}

export const ArgusMonetizationAcquisition: React.FC<ArgusMonetizationAcquisitionProps> = ({
  projectId,
  apiParams,
  isDark,
  t,
  handleChartZoom,
}) => {
  const theme = useTheme();

  // ── State ──────────────────────────────────────────────────────────────────
  const [groupBy, setGroupBy] = useState<GroupBy>('source');
  const [attributionModel, setAttributionModel] = useState<AttributionModel>('last');
  const [data, setData] = useState<AcquisitionResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [adSpend, setAdSpend] = useState<AdSpendData>({});
  const [editingRow, setEditingRow] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const editRef = useRef<HTMLInputElement>(null);

  // Pagination
  const [pageSize, setPageSize] = useGlobalPageSize();
  const [page, setPage] = useState<number>(0);

  // ── Load ad spend from localStorage ────────────────────────────────────────
  useEffect(() => {
    setAdSpend(loadAdSpend(projectId, groupBy));
  }, [projectId, groupBy]);

  // ── Fetch Data ─────────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getRevenueAcquisition(projectId, {
        ...apiParams,
        groupBy,
        attributionModel,
      });
      setData(res);
    } catch (error) {
      console.error('Failed to fetch acquisition data:', error);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [projectId, apiParams, groupBy, attributionModel]);

  useEffect(() => {
    fetchData();
    setPage(0);
  }, [fetchData]);

  // ── Focus edit input ───────────────────────────────────────────────────────
  useEffect(() => {
    if (editingRow !== null && editRef.current) {
      editRef.current.focus();
    }
  }, [editingRow]);

  // ── Table Data ─────────────────────────────────────────────────────────────
  const rows = useMemo(() => data?.table || [], [data]);
  const totalRevenue = useMemo(() => rows.reduce((s, r) => s + r.revenue, 0), [rows]);
  const totalUsers = useMemo(() => rows.reduce((s, r) => s + r.users, 0), [rows]);

  const paginatedRows = useMemo(() => {
    const startIdx = page * pageSize;
    return rows.slice(startIdx, startIdx + pageSize);
  }, [rows, page, pageSize]);

  // ── Summary & PoP ─────────────────────────────────────────────────────────
  const summary = data?.summary || {
    total_sessions: 0,
    total_users: 0,
    total_revenue: 0,
    total_paying_users: 0,
    conversion_rate: 0,
  };

  const prev = data?.summary_prev;

  function popChange(curr: number, p?: number): number | undefined {
    if (!p || p === 0) return undefined;
    return ((curr - p) / p) * 100;
  }

  // ── Donut chart data ───────────────────────────────────────────────────────
  const revenueDonutData = useMemo(() =>
    rows.map((r) => ({ dimension: r.dimension, value: r.revenue })),
    [rows]
  );
  const usersDonutData = useMemo(() =>
    rows.map((r) => ({ dimension: r.dimension, value: r.users })),
    [rows]
  );

  // ── Chart ─────────────────────────────────────────────────────────────────
  const chartPoints = data?.chart || [];
  const hasChartData = chartPoints.length > 0;
  const chartRawPeriods = hasChartData ? chartPoints.map((p) => p.period) : [];
  const chartDatasets = useMemo(() => {
    if (!hasChartData) return [];
    return [
      {
        label: t('argus.monetization.sessions', 'Sessions'),
        data: chartPoints.map((p) => p.sessions),
        color: theme.palette.primary.main,
      },
      {
        label: t('argus.monetization.revenue', 'Revenue ($)'),
        data: chartPoints.map((p) => p.revenue),
        color: theme.palette.success.main,
      },
    ];
  }, [chartPoints, hasChartData, theme, t]);

  // ── Ad Spend helpers ──────────────────────────────────────────────────────
  function getSpend(dim: string) { return adSpend[dim] ?? 0; }

  function commitEdit(dim: string) {
    const val = parseFloat(editValue) || 0;
    const next = { ...adSpend, [dim]: val };
    setAdSpend(next);
    saveAdSpend(projectId, groupBy, next);
    setEditingRow(null);
    setEditValue('');
  }

  function computeRoas(row: AcquisitionTableRow) {
    const spend = getSpend(row.dimension);
    if (!spend) return null;
    return row.revenue / spend;
  }
  function computeCpa(row: AcquisitionTableRow) {
    const spend = getSpend(row.dimension);
    if (!spend || !row.paying_users) return null;
    return spend / row.paying_users;
  }
  function computeRoi(row: AcquisitionTableRow) {
    const spend = getSpend(row.dimension);
    if (!spend) return null;
    return ((row.revenue - spend) / spend) * 100;
  }

  // ── CSV Export ────────────────────────────────────────────────────────────
  const csvColumns: CsvColumn<AcquisitionTableRow>[] = [
    { key: 'dimension', label: 'Channel' },
    { key: 'sessions', label: 'Sessions', formatter: (v) => fmtNum(Number(v)) },
    { key: 'users', label: 'Users', formatter: (v) => fmtNum(Number(v)) },
    { key: 'revenue', label: 'Revenue', formatter: (v) => fmt(Number(v)) },
    { key: 'paying_users', label: 'Paying Users', formatter: (v) => fmtNum(Number(v)) },
    {
      key: 'revenue',
      label: 'Purchase CR',
      formatter: (_, row) => {
        const cr = row.users > 0 ? (row.paying_users / row.users) * 100 : 0;
        return `${cr.toFixed(2)}%`;
      }
    },
    { key: 'avg_duration', label: 'Avg Duration', formatter: (v) => `${(Number(v) || 0).toFixed(0)}s` },
    { key: 'revenue' as keyof AcquisitionTableRow, label: 'Ad Spend', formatter: (_: any, row: AcquisitionTableRow) => `$${getSpend(row.dimension).toFixed(2)}` },
    { key: 'revenue' as keyof AcquisitionTableRow, label: 'ROAS', formatter: (_: any, row: AcquisitionTableRow) => { const r = computeRoas(row); return r != null ? `${r.toFixed(2)}x` : '-'; } },
    { key: 'revenue' as keyof AcquisitionTableRow, label: 'CPA', formatter: (_: any, row: AcquisitionTableRow) => { const c = computeCpa(row); return c != null ? fmt(c) : '-'; } },
  ];

  const handleExport = () => {
    if (!rows.length) return;
    downloadCsv(rows, csvColumns, `acquisition_${groupBy}_${new Date().toISOString().slice(0, 10)}`);
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  const pageCount = rows.length;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, gap: 3 }}>

      {/* ── Header ── */}
      <Box sx={{ flexShrink: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <CampaignIcon sx={{ color: 'text.secondary', fontSize: 24 }} />
          <Box>
            <Typography variant="h6" fontWeight={700}>
              {t('argus.monetization.acquisitionTitle', 'User Acquisition Analysis')}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t('argus.monetization.acquisitionDesc', 'Analyze marketing traffic sources, campaign conversions, and customer acquisition costs')}
            </Typography>
          </Box>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            size="small"
            variant="outlined"
            startIcon={<ExportIcon sx={{ fontSize: 16 }} />}
            onClick={handleExport}
            disabled={!rows.length || loading}
            sx={{ textTransform: 'none', fontSize: 12 }}
          >
            CSV
          </Button>
        </Box>
      </Box>

      {/* ── KPI Cards (with PoP) — flat single-Paper grid, no nesting ── */}
      <Paper
        variant="outlined"
        sx={{
          flexShrink: 0,
          borderRadius: 2,
          overflow: 'hidden',
          bgcolor: isDark ? 'rgba(255,255,255,0.02)' : '#fff',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          '& > *:not(:last-child)': {
            borderRight: `1px solid ${isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)'}`,
          },
        }}
      >
        <KpiCard
          icon={<CampaignIcon sx={{ fontSize: 18 }} />}
          color={theme.palette.primary.main}
          label={t('argus.monetization.sessions', 'Sessions')}
          value={fmtNum(summary.total_sessions)}
          sub={t('argus.monetization.vsLastPeriod', 'vs last period')}
          change={popChange(summary.total_sessions, prev?.total_sessions)}
        />
        <KpiCard
          icon={<PeopleIcon sx={{ fontSize: 18 }} />}
          color={theme.palette.info.main}
          label={t('argus.monetization.users', 'Users')}
          value={fmtNum(summary.total_users)}
          sub={t('argus.monetization.vsLastPeriod', 'vs last period')}
          change={popChange(summary.total_users, prev?.total_users)}
        />
        <KpiCard
          icon={<CartIcon sx={{ fontSize: 18 }} />}
          color={theme.palette.success.main}
          label={t('argus.monetization.revenue', 'Revenue')}
          value={fmt(summary.total_revenue)}
          sub={t('argus.monetization.vsLastPeriod', 'vs last period')}
          change={popChange(summary.total_revenue, prev?.total_revenue)}
        />
        <KpiCard
          icon={<CartIcon sx={{ fontSize: 18 }} />}
          color={theme.palette.warning.main}
          label={t('argus.monetization.conversionRate', 'Purchase CR')}
          value={`${summary.conversion_rate.toFixed(2)}%`}
          sub={t('argus.monetization.vsLastPeriod', 'vs last period')}
          change={popChange(summary.conversion_rate, prev?.conversion_rate)}
        />
        <KpiCard
          icon={<PeopleIcon sx={{ fontSize: 18 }} />}
          color={theme.palette.secondary.main}
          label={t('argus.monetization.payingUsers', 'Paying Users')}
          value={fmtNum(summary.total_paying_users)}
          sub={t('argus.monetization.vsLastPeriod', 'vs last period')}
          change={popChange(summary.total_paying_users, prev?.total_paying_users)}
        />
        {(() => {
          const totalSpend = rows.reduce((s, r) => s + getSpend(r.dimension), 0);
          const totalRoas = totalSpend > 0 ? summary.total_revenue / totalSpend : null;
          return (
            <KpiCard
              icon={<CampaignIcon sx={{ fontSize: 18 }} />}
              color="#FF6584"
              label={t('argus.monetization.roas', 'ROAS')}
              value={totalRoas != null ? `${totalRoas.toFixed(2)}x` : '—'}
              sub={totalSpend > 0 ? `${t('argus.monetization.adSpend', 'Ad Spend')}: ${fmt(totalSpend)}` : t('argus.monetization.adSpendHint', 'Enter ad spend below')}
            />
          );
        })()}
      </Paper>


      {/* ── Donut Charts ── */}
      {rows.length > 0 && !loading && (
        <Box sx={{ flexShrink: 0, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <MiniDonut
            label={t('argus.monetization.revenueBreakdown', 'Revenue by Channel')}
            data={revenueDonutData}
            isDark={isDark}
            formatter={fmt}
          />
          <MiniDonut
            label={t('argus.monetization.usersBreakdown', 'Users by Channel')}
            data={usersDonutData}
            isDark={isDark}
            formatter={fmtNum}
          />
        </Box>
      )}

      {/* ── Trend Chart ── */}
      <Box sx={{ flexShrink: 0, minWidth: 0, overflow: 'hidden' }}>
        {loading && !data ? (
          <ArgusChartSkeleton height={240} />
        ) : hasChartData ? (
          <ArgusVolumeChart
            title={t('argus.monetization.acquisitionTrend', 'Traffic & Revenue Trend')}
            rawPeriods={chartRawPeriods}
            labels={[]}
            datasets={chartDatasets}
            loading={loading}
            storagePrefix="argus_acquisition_trend"
            showCompactToggle={false}
            onZoom={handleChartZoom(chartRawPeriods)}
          />
        ) : (
          <Paper variant="outlined" sx={{ height: 240, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'transparent' }}>
            <Typography color="text.secondary">{t('common.noData', 'No data available')}</Typography>
          </Paper>
        )}
      </Box>

      {/* ── Table ── */}
      <Paper
        variant="outlined"
        sx={{
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          minHeight: 0,
          borderRadius: 2,
          overflow: 'hidden',
          bgcolor: isDark ? 'rgba(255,255,255,0.02)' : '#fff',
        }}
      >
        {/* Table Toolbar */}
        <Box sx={{ p: 2, flexShrink: 0, borderBottom: '1px solid', borderColor: 'divider', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
            {/* GroupBy */}
            <ToggleButtonGroup
              value={groupBy}
              exclusive
              onChange={(_, val) => val && setGroupBy(val)}
              size="small"
            >
              <ToggleButton value="source" sx={{ textTransform: 'none', px: 1.5, fontSize: 12 }}>
                {t('argus.monetization.source', 'Source')}
              </ToggleButton>
              <ToggleButton value="medium" sx={{ textTransform: 'none', px: 1.5, fontSize: 12 }}>
                {t('argus.monetization.medium', 'Medium')}
              </ToggleButton>
              <ToggleButton value="campaign" sx={{ textTransform: 'none', px: 1.5, fontSize: 12 }}>
                {t('argus.monetization.campaign', 'Campaign')}
              </ToggleButton>
              <ToggleButton value="platform" sx={{ textTransform: 'none', px: 1.5, fontSize: 12 }}>
                {t('argus.monetization.platform', 'Platform')}
              </ToggleButton>
            </ToggleButtonGroup>

            {/* Attribution model */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: 12 }}>
                {t('argus.monetization.attributionModel', 'Attribution')}:
              </Typography>
              <Select
                value={attributionModel}
                onChange={(e) => setAttributionModel(e.target.value as AttributionModel)}
                size="small"
                sx={{ minWidth: 120, height: 30, fontSize: 12 }}
              >
                <MenuItem value="last" sx={{ fontSize: 12 }}>{t('argus.monetization.lastTouch', 'Last Touch')}</MenuItem>
                <MenuItem value="first" sx={{ fontSize: 12 }}>{t('argus.monetization.firstTouch', 'First Touch')}</MenuItem>
                <MenuItem value="linear" sx={{ fontSize: 12 }}>{t('argus.monetization.linear', 'Linear')}</MenuItem>
              </Select>
            </Box>
          </Box>

          <Typography variant="caption" color="text.secondary">
            {t('argus.monetization.totalRows', 'Total channels: {{count}}', { count: pageCount })}
          </Typography>
        </Box>

        {loading && <LinearProgress sx={{ flexShrink: 0 }} />}

        {/* Table body */}
        <TableContainer sx={{ flex: 1, overflow: 'auto', opacity: loading ? 0.55 : 1, transition: 'opacity 0.15s ease', pointerEvents: loading ? 'none' : 'auto' }}>
          {pageCount === 0 && !loading ? (
            <Box sx={{ py: 8 }}>
              <EmptyPlaceholder
                message={t('argus.monetization.noChannels', 'No acquisition channels found')}
                description={t('argus.monetization.noChannelsDesc', 'Make sure UTM parameters are correctly tagged on incoming SDK links.')}
              />
            </Box>
          ) : (
            <Table stickyHeader size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700, fontSize: 12 }}>{t('argus.monetization.acquisitionDimension', 'Channel / Source')}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, fontSize: 12 }}>{t('argus.monetization.sessions', 'Sessions')}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, fontSize: 12 }}>{t('argus.monetization.users', 'Users')}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, fontSize: 12 }}>{t('argus.monetization.revenue', 'Revenue')}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, fontSize: 12, minWidth: 100 }}>{t('argus.monetization.revenueShare', 'Rev. Share')}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, fontSize: 12 }}>{t('argus.monetization.payingUsers', 'Paying Users')}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, fontSize: 12 }}>{t('argus.monetization.conversionRate', 'CR')}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, fontSize: 12 }}>{t('argus.monetization.avgDuration', 'Duration')}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, fontSize: 12, color: theme.palette.primary.main }}>
                    {t('argus.monetization.adSpend', '광고비')}
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, fontSize: 12, color: '#43D9AD' }}>
                    {t('argus.monetization.roas', 'ROAS')}
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, fontSize: 12, color: '#FF6584' }}>
                    {t('argus.monetization.cpa', 'CPA')}
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, fontSize: 12, color: '#FFB347' }}>
                    {t('argus.monetization.roi', 'ROI')}
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {paginatedRows.map((row) => {
                  const cr = row.users > 0 ? (row.paying_users / row.users) * 100 : 0;
                  const revShare = totalRevenue > 0 ? (row.revenue / totalRevenue) * 100 : 0;
                  const roas = computeRoas(row);
                  const cpa = computeCpa(row);
                  const roi = computeRoi(row);
                  const isEditing = editingRow === row.dimension;
                  const spend = getSpend(row.dimension);

                  return (
                    <TableRow key={row.dimension} hover>
                      <TableCell sx={{ fontWeight: 600, fontSize: 12 }}>{row.dimension}</TableCell>
                      <TableCell align="right" sx={{ fontSize: 12 }}>{fmtNum(row.sessions)}</TableCell>
                      <TableCell align="right" sx={{ fontSize: 12 }}>{fmtNum(row.users)}</TableCell>
                      <TableCell align="right" sx={{ fontSize: 12, fontWeight: 600 }}>{fmt(row.revenue)}</TableCell>
                      {/* Revenue Share bar */}
                      <TableCell align="right">
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.75 }}>
                          <LinearProgress
                            variant="determinate"
                            value={Math.min(revShare, 100)}
                            sx={{
                              width: 52, height: 5, borderRadius: 3,
                              bgcolor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)',
                              '& .MuiLinearProgress-bar': { bgcolor: theme.palette.success.main, borderRadius: 3 },
                            }}
                          />
                          <Typography variant="caption" sx={{ fontSize: 11, minWidth: 32, textAlign: 'right' }}>
                            {revShare.toFixed(1)}%
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell align="right" sx={{ fontSize: 12 }}>{fmtNum(row.paying_users)}</TableCell>
                      <TableCell align="right">
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.5 }}>
                          <Typography variant="caption" sx={{ fontSize: 11 }}>{cr.toFixed(2)}%</Typography>
                          {cr > 0 && (
                            <LinearProgress
                              variant="determinate"
                              value={Math.min(cr * 10, 100)}
                              color="success"
                              sx={{ width: 28, height: 3, borderRadius: 2 }}
                            />
                          )}
                        </Box>
                      </TableCell>
                      <TableCell align="right" sx={{ fontSize: 12 }}>{row.avg_duration.toFixed(0)}s</TableCell>

                      {/* Ad Spend editable cell */}
                      <TableCell align="right" sx={{ minWidth: 110 }}>
                        {isEditing ? (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, justifyContent: 'flex-end' }}>
                            <TextField
                              inputRef={editRef}
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') commitEdit(row.dimension);
                                if (e.key === 'Escape') { setEditingRow(null); setEditValue(''); }
                              }}
                              onBlur={() => commitEdit(row.dimension)}
                              size="small"
                              type="number"
                              placeholder="0"
                              sx={{ width: 88, '& input': { fontSize: 11, py: 0.5, px: 1 } }}
                              InputProps={{
                                startAdornment: <InputAdornment position="start"><Typography sx={{ fontSize: 11 }}>$</Typography></InputAdornment>,
                              }}
                            />
                            <IconButton size="small" onClick={() => commitEdit(row.dimension)} sx={{ p: 0.3 }}>
                              <SaveIcon sx={{ fontSize: 14, color: 'success.main' }} />
                            </IconButton>
                          </Box>
                        ) : spend > 0 ? (
                          <Box
                            sx={{
                              display: 'inline-flex', alignItems: 'center', gap: 0.5,
                              cursor: 'pointer', px: 1, py: 0.3, borderRadius: 1,
                              border: `1px solid ${alpha(theme.palette.primary.main, 0.25)}`,
                              bgcolor: alpha(theme.palette.primary.main, isDark ? 0.08 : 0.04),
                              '&:hover': { bgcolor: alpha(theme.palette.primary.main, isDark ? 0.15 : 0.08) },
                              transition: 'background 0.15s',
                            }}
                            onClick={() => { setEditingRow(row.dimension); setEditValue(String(spend)); }}
                          >
                            <Typography sx={{ fontSize: 11, fontWeight: 600, color: theme.palette.primary.main }}>
                              {fmt(spend)}
                            </Typography>
                            <EditIcon sx={{ fontSize: 11, color: theme.palette.primary.main, opacity: 0.6 }} />
                          </Box>
                        ) : (
                          <Box
                            sx={{
                              display: 'inline-flex', alignItems: 'center', gap: 0.4,
                              cursor: 'pointer', px: 1, py: 0.3, borderRadius: 1,
                              border: `1px dashed ${isDark ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.22)'}`,
                              color: 'text.secondary',
                              '&:hover': {
                                borderColor: theme.palette.primary.main,
                                color: theme.palette.primary.main,
                                bgcolor: alpha(theme.palette.primary.main, 0.06),
                              },
                              transition: 'all 0.15s',
                            }}
                            onClick={() => { setEditingRow(row.dimension); setEditValue(''); }}
                          >
                            <EditIcon sx={{ fontSize: 11 }} />
                            <Typography sx={{ fontSize: 10, fontWeight: 600 }}>입력</Typography>
                          </Box>
                        )}
                      </TableCell>
                      {/* ROAS */}
                      <TableCell align="right">
                        {roas != null ? (
                          <Chip
                            label={`${roas.toFixed(2)}x`}
                            size="small"
                            sx={{
                              height: 20, fontSize: 10, fontWeight: 700,
                              bgcolor: alpha(roas >= 1 ? '#43D9AD' : '#FF6584', 0.15),
                              color: roas >= 1 ? '#43D9AD' : '#FF6584',
                              border: `1px solid ${alpha(roas >= 1 ? '#43D9AD' : '#FF6584', 0.3)}`,
                            }}
                          />
                        ) : (
                          <Typography variant="caption" sx={{ fontSize: 11, color: 'text.disabled' }}>—</Typography>
                        )}
                      </TableCell>
                      {/* CPA */}
                      <TableCell align="right">
                        <Typography variant="caption" sx={{ fontSize: 11, color: cpa != null ? '#FF6584' : 'text.disabled', fontWeight: cpa != null ? 600 : 400 }}>
                          {cpa != null ? fmt(cpa) : '—'}
                        </Typography>
                      </TableCell>
                      {/* ROI */}
                      <TableCell align="right">
                        {roi != null ? (
                          <Typography variant="caption" sx={{
                            fontSize: 11, fontWeight: 700,
                            color: roi >= 0 ? theme.palette.success.main : theme.palette.error.main,
                          }}>
                            {roi >= 0 ? '+' : ''}{roi.toFixed(1)}%
                          </Typography>
                        ) : (
                          <Typography variant="caption" sx={{ fontSize: 11, color: 'text.disabled' }}>—</Typography>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </TableContainer>

        {/* Pagination */}
        {pageCount > 0 && (
          <Box sx={{ p: 1.5, borderTop: '1px solid', borderColor: 'divider', flexShrink: 0 }}>
            <SimplePagination
              count={pageCount}
              page={page}
              rowsPerPage={pageSize}
              onPageChange={(_, newPage) => setPage(newPage)}
              onRowsPerPageChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(0);
              }}
            />
          </Box>
        )}
      </Paper>
    </Box>
  );
};

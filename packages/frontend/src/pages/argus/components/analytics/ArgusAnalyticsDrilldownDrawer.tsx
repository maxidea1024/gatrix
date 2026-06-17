import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Collapse,
  Skeleton,
  Tooltip,
  useTheme,
  alpha,
} from '@mui/material';
import {
  KeyboardArrowDown as ExpandIcon,
  KeyboardArrowUp as CollapseIcon,
  ContentCopy as CopyIcon,
  SearchOff as EmptyIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import ResizableDrawer from '@/components/common/ResizableDrawer';
import argusService from '@/services/argusService';
import { FlagImage } from '@/components/common/CountrySelect';
import { getCountryByCode } from '@/utils/countries';

// ─── Platform SVG brand icons ─────────────────────────────────────────────────
const IconSvg: React.FC<{ d: string; color?: string; size?: number }> = ({ d, color = 'currentColor', size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color} style={{ flexShrink: 0 }}>
    <path d={d} />
  </svg>
);

// Brand SVG paths (Simple Icons / public domain)
const SVG_PATHS: Record<string, { d: string; color: string }> = {
  steam: {
    d: 'M11.979 0C5.678 0 .511 4.86.022 11.037l6.432 2.658a3.387 3.387 0 0 1 1.912-.593c.064 0 .125.002.187.006l2.861-4.142V8.91a4.528 4.528 0 0 1 4.524-4.524 4.528 4.528 0 0 1 4.524 4.524 4.528 4.528 0 0 1-4.524 4.524h-.105l-4.076 2.911c0 .052.004.105.004.159 0 1.875-1.515 3.396-3.39 3.396-1.635 0-3.016-1.173-3.331-2.727L.436 15.27C1.862 20.307 6.486 24 11.979 24c6.627 0 12.021-5.373 12.021-12C24 5.373 18.606 0 11.979 0z',
    color: '#1b2838',
  },
  epic: {
    d: 'M3.537 0C2.165 0 1.66.506 1.66 1.879V18.12c0 1.373.505 1.879 1.877 1.879h3.18v4h6.12v-4.001l3.051.001c1.372 0 1.877-.506 1.877-1.879V1.879C17.765.506 17.26 0 15.888 0zm1.192 3.231h7.14v1.77h-5.07v4.31h4.46v1.77h-4.46v4.31h5.07v1.77h-7.14z',
    color: '#2f2f2f',
  },
  xbox: {
    d: 'M6.364 3.407c1.267-.86 2.983-1.404 5.636-1.404 2.653 0 4.37.543 5.636 1.404A11.943 11.943 0 0 0 12 0a11.943 11.943 0 0 0-5.636 3.407zm11.272 0s-1.127 1.227-2.927 3.36C18.537 11.212 22 17.658 22 17.658A11.975 11.975 0 0 0 24 12c0-3.41-1.424-6.488-3.708-8.674l-.656.081zm-11.272 0-.656-.081A11.975 11.975 0 0 0 0 12c0 3.41 2 5.658 2 5.658s3.463-6.446 7.291-10.891c-1.8-2.133-2.927-3.36-2.927-3.36zM12 7.32c-3.2 3.84-8 10.68-8 10.68A11.943 11.943 0 0 0 12 24a11.943 11.943 0 0 0 8-6c0 0-4.8-6.84-8-10.68z',
    color: '#107c10',
  },
  playstation: {
    d: 'M8.985 2.596v17.548l3.915 1.261V6.688c0-.69.304-1.151.794-.991.636.181.76.814.76 1.505v5.875c2.441 1.193 4.362-.002 4.362-3.153 0-3.093-1.042-4.925-5.158-5.942-1.148-.283-2.838-.602-4.673-.376zm-2.818 15.2L0 16.144c-.45-.158-.592-.441-.32-.639.271-.197.773-.347 1.222-.19l4.025 1.426v-1.982l-.47-.163S2.992 14.08.986 14.534c-1.74.383-1.917 1.543-.57 2.229 1.14.58 2.81 1.063 5.751 1.564v-1.529zm13.735-3.39c-1.336-.752-3.097-.996-5.323-.65v1.529c1.635-.249 3.18-.067 3.923.355.821.466.556 1.229-.733 1.533l-3.19.863v2.002l4.471-1.236c.784-.322 1.501-.827 1.501-1.604.005-.946-.55-1.88-2.649-2.792z',
    color: '#003087',
  },
  ios: {
    d: 'M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z',
    color: '#555555',
  },
  android: {
    d: 'M17.523 15.341c-.583 0-1.055.474-1.055 1.056 0 .583.473 1.055 1.055 1.055s1.055-.473 1.055-1.055c0-.583-.473-1.056-1.055-1.056m-11.046 0c-.583 0-1.055.474-1.055 1.056 0 .583.473 1.055 1.055 1.055s1.055-.473 1.055-1.055c0-.583-.473-1.056-1.055-1.056m11.405-6.02 1.997-3.459a.416.416 0 0 0-.152-.567.416.416 0 0 0-.567.152L17.14 8.95C15.66 8.238 14.013 7.837 12.262 7.837s-3.398.4-4.879 1.113L5.363 5.447a.416.416 0 0 0-.567-.152.416.416 0 0 0-.152.567l1.997 3.46C3.258 11.34 1.168 14.833.916 18.886h22.168c-.252-4.053-2.342-7.546-5.726-9.565',
    color: '#3ddc84',
  },
  direct: {
    d: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z',
    color: '#6366f1',
  },
  web: {
    d: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z',
    color: '#6366f1',
  },
  pc: {
    d: 'M20 18c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2H0v2h24v-2h-4zM4 6h16v10H4V6z',
    color: '#0078d4',
  },
  switch: {
    d: 'M14.176 24h5.386c2.448 0 4.438-1.99 4.438-4.438V4.438C24 1.99 22.01 0 19.562 0h-5.386v24zM16.4 4.2h3.163c1.235 0 2.237 1.002 2.237 2.237v3.163c0 1.235-1.002 2.237-2.237 2.237H16.4V4.2zM0 19.562C0 22.01 1.99 24 4.438 24H9.5V0H4.438C1.99 0 0 1.99 0 4.438v15.124zM4.4 4.2h3.163v7.637H4.4c-1.235 0-2.237-1.002-2.237-2.237V6.437C2.163 5.202 3.165 4.2 4.4 4.2z',
    color: '#e60012',
  },
};

function PlatformIcon({ platform }: { platform: string }) {
  if (!platform) return null;
  const key = platform.toLowerCase();
  const entry = SVG_PATHS[key];
  if (!entry) return null;
  return <IconSvg d={entry.d} color={entry.color} size={16} />;
}

// ─── Relative time ────────────────────────────────────────────────────────────
function relativeTime(ts: string, t: any): string {
  try {
    const now = Date.now();
    const then = new Date(ts).getTime();
    const diffSec = Math.floor((now - then) / 1000);

    if (diffSec < 60) return t('argus.analytics.drilldown.timeJustNow', 'just now');
    if (diffSec < 3600) {
      const m = Math.floor(diffSec / 60);
      return t('argus.analytics.drilldown.timeMinAgo', '{{m}}m ago', { m });
    }
    if (diffSec < 86400) {
      const h = Math.floor(diffSec / 3600);
      return t('argus.analytics.drilldown.timeHourAgo', '{{h}}h ago', { h });
    }
    const d = Math.floor(diffSec / 86400);
    return t('argus.analytics.drilldown.timeDayAgo', '{{d}}d ago', { d });
  } catch {
    return ts;
  }
}

function formatAbsoluteTime(ts: string): string {
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return ts;
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface ArgusAnalyticsDrilldownDrawerProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
  eventName: string;
  dateRange: { start: Date; end: Date };
  globalFilters?: { property: string; operator: string; value: string }[];
  breakdownFilters?: { property: string; value: string }[];
}

// ─── Detail Panel ─────────────────────────────────────────────────────────────
const DetailPanel: React.FC<{ row: Record<string, any> }> = ({ row }) => {
  const theme = useTheme();
  const { t } = useTranslation();
  const isDark = theme.palette.mode === 'dark';

  const detailFields = useMemo(() => {
    const skip = new Set(['event_id']);
    return Object.entries(row)
      .filter(([k, v]) => !skip.has(k) && v !== null && v !== undefined && v !== '')
      .map(([k, v]) => ({ key: k, value: typeof v === 'object' ? JSON.stringify(v) : String(v) }));
  }, [row]);

  return (
    <Box
      sx={{
        px: 3,
        py: 2,
        bgcolor: isDark ? alpha('#6366f1', 0.04) : alpha('#6366f1', 0.02),
        borderLeft: `3px solid ${alpha('#6366f1', 0.5)}`,
      }}
    >
      <Typography
        variant="caption"
        sx={{
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          color: 'text.secondary',
          mb: 1.5,
          display: 'block',
        }}
      >
        {t('argus.analytics.drilldown.rowDetailTitle', 'Event Detail')}
      </Typography>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'auto 1fr',
          gap: '6px 16px',
          fontSize: '0.8125rem',
        }}
      >
        {detailFields.map(({ key, value }) => (
          <React.Fragment key={key}>
            <Typography
              variant="body2"
              sx={{
                color: 'text.secondary',
                fontWeight: 500,
                fontSize: 'inherit',
                whiteSpace: 'nowrap',
              }}
            >
              {key}
            </Typography>
            <Typography
              variant="body2"
              sx={{
                fontFamily: 'monospace',
                fontSize: 'inherit',
                wordBreak: 'break-all',
                color: 'text.primary',
              }}
            >
              {value}
            </Typography>
          </React.Fragment>
        ))}
      </Box>
    </Box>
  );
};

// ─── Skeleton Rows ────────────────────────────────────────────────────────────
const SkeletonRows: React.FC = () => (
  <>
    {Array.from({ length: 8 }).map((_, i) => (
      <TableRow key={`skel-${i}`}>
        <TableCell sx={{ width: 32 }}>
          <Skeleton variant="circular" width={20} height={20} />
        </TableCell>
        <TableCell>
          <Skeleton variant="text" width={100} />
        </TableCell>
        <TableCell>
          <Skeleton variant="rounded" width={80} height={22} />
        </TableCell>
        <TableCell>
          <Skeleton variant="text" width={60} />
        </TableCell>
        <TableCell>
          <Skeleton variant="text" width={40} />
        </TableCell>
      </TableRow>
    ))}
  </>
);

// ─── Main Component ───────────────────────────────────────────────────────────
export const ArgusAnalyticsDrilldownDrawer: React.FC<
  ArgusAnalyticsDrilldownDrawerProps
> = ({
  open,
  onClose,
  projectId,
  eventName,
  dateRange,
  globalFilters,
  breakdownFilters,
}) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<Record<string, any>[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchDrilldownData = useCallback(async () => {
    if (!open || !eventName) return;
    setLoading(true);
    setExpandedId(null);
    try {
      const conditionsParts = [`event_name:"${eventName}"`];

      // Append global filters
      if (globalFilters) {
        globalFilters.forEach((f) => {
          if (f.property && f.value) {
            if (f.operator === 'is') {
              conditionsParts.push(`${f.property}:"${f.value}"`);
            } else if (f.operator === 'is_not') {
              conditionsParts.push(`!${f.property}:"${f.value}"`);
            } else if (f.operator === 'contains') {
              conditionsParts.push(`${f.property}:*${f.value}*`);
            } else if (f.operator === 'not_contains') {
              conditionsParts.push(`!${f.property}:*${f.value}*`);
            }
          }
        });
      }

      // Append breakdown filters
      if (breakdownFilters && breakdownFilters.length > 0) {
        breakdownFilters.forEach((bf) => {
          if (bf.property && bf.value) {
            conditionsParts.push(`${bf.property}:"${bf.value}"`);
          }
        });
      }

      const conditions = conditionsParts.join(' ');

      const result = await argusService.discoverQuery(projectId, {
        fields: [
          'event_id',
          'timestamp',
          'user_id',
          'event_name',
          'platform',
          'environment',
          'country',
          'os',
          'session_id',
        ],
        conditions: conditions || undefined,
        period: 'custom',
        start: dateRange.start.toISOString(),
        end: dateRange.end.toISOString(),
        limit: 100,
        dataset: 'activities',
      });
      setData(result.data || []);
    } catch (err) {
      console.error('Failed to fetch drilldown data', err);
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [
    open,
    projectId,
    eventName,
    dateRange,
    globalFilters,
    breakdownFilters,
  ]);

  useEffect(() => {
    fetchDrilldownData();
  }, [fetchDrilldownData]);

  const handleToggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  const handleCopyUserId = async (userId: string, rowId: string) => {
    try {
      await navigator.clipboard.writeText(userId);
      setCopiedId(rowId);
      setTimeout(() => setCopiedId(null), 1500);
    } catch { /* noop */ }
  };

  // ── Header cell style ───────────────────────────────────────────────────
  const headerCellSx = {
    fontWeight: 700,
    fontSize: '0.6875rem',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.08em',
    color: 'text.secondary',
    bgcolor: theme.palette.background.default,
    borderBottom: `1px solid ${theme.palette.divider}`,
    py: 1.5,
    whiteSpace: 'nowrap' as const,
  };

  return (
    <ResizableDrawer
      open={open}
      onClose={onClose}
      title={t('argus.analytics.drilldown.title', 'Event Drilldown')}
      subtitle={`${formatAbsoluteTime(dateRange.start.toISOString())} ~ ${formatAbsoluteTime(dateRange.end.toISOString())}`}
      storageKey="argus-analytics-drilldown-drawer"
      defaultWidth={680}
    >
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          p: 2,
          gap: 1.5,
        }}
      >
        {/* ── Summary bar ──────────────────────────────────────────────── */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            px: 1.5,
            py: 1,
            borderRadius: 1,
            bgcolor: isDark ? alpha('#6366f1', 0.06) : alpha('#6366f1', 0.03),
            border: `1px solid ${isDark ? alpha('#6366f1', 0.15) : alpha('#6366f1', 0.1)}`,
          }}
        >
          <Chip
            label={eventName}
            size="small"
            sx={{
              fontWeight: 600,
              fontFamily: 'monospace',
              fontSize: '0.75rem',
              bgcolor: isDark ? alpha('#6366f1', 0.15) : alpha('#6366f1', 0.1),
              color: isDark ? '#a5b4fc' : '#4338ca',
              maxWidth: 280,
            }}
          />
          <Typography variant="caption" color="text.secondary">
            {loading
              ? t('argus.analytics.drilldown.loading', 'Loading...')
              : data.length >= 100
                ? t('argus.analytics.drilldown.countCapped', '{{count}}+ events', { count: data.length })
                : t('argus.analytics.drilldown.count', '{{count}} events', { count: data.length })}
          </Typography>
        </Box>

        {/* ── Table ────────────────────────────────────────────────────── */}
        <TableContainer
          component={Paper}
          elevation={0}
          sx={{
            flex: 1,
            overflowY: 'auto',
            borderRadius: 1,
            border: `1px solid ${theme.palette.divider}`,
            bgcolor: 'transparent',
          }}
        >
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell sx={{ ...headerCellSx, width: 40, px: 1, textAlign: 'center' }} />
                <TableCell sx={headerCellSx}>
                  {t('argus.analytics.drilldown.colTime', 'Time')}
                </TableCell>
                <TableCell sx={headerCellSx}>
                  {t('argus.analytics.drilldown.colUser', 'User')}
                </TableCell>
                <TableCell sx={headerCellSx}>
                  {t('argus.analytics.drilldown.colPlatform', 'Platform')}
                </TableCell>
                <TableCell sx={headerCellSx}>
                  {t('argus.analytics.drilldown.colCountry', 'Country')}
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <SkeletonRows />
              ) : data.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} sx={{ border: 0 }}>
                    <Box
                      sx={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        py: 8,
                        gap: 1.5,
                      }}
                    >
                      <EmptyIcon
                        sx={{ fontSize: 48, color: 'text.disabled', opacity: 0.5 }}
                      />
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{ fontWeight: 500 }}
                      >
                        {t(
                          'argus.analytics.drilldown.noData',
                          'No events found for the selected timeframe.'
                        )}
                      </Typography>
                    </Box>
                  </TableCell>
                </TableRow>
              ) : (
                data.map((row, idx) => {
                  const rowId = row.event_id || `row-${idx}`;
                  const isExpanded = expandedId === rowId;

                  return (
                    <React.Fragment key={rowId}>
                      {/* ── Data row ───────────────────────────────── */}
                      <TableRow
                        hover
                        onClick={() => handleToggleExpand(rowId)}
                        sx={{
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                          borderLeft: isExpanded
                            ? `3px solid ${alpha('#6366f1', 0.7)}`
                            : '3px solid transparent',
                          bgcolor: isExpanded
                            ? isDark
                              ? alpha('#6366f1', 0.06)
                              : alpha('#6366f1', 0.03)
                            : 'transparent',
                          '&:hover': {
                            bgcolor: isDark
                              ? alpha('#6366f1', 0.08)
                              : alpha('#6366f1', 0.04),
                          },
                          '& td': {
                            borderBottom: isExpanded
                              ? 'none'
                              : `1px solid ${theme.palette.divider}`,
                          },
                        }}
                      >
                        {/* Expand toggle */}
                        <TableCell sx={{ width: 40, px: 1, py: 0.75, textAlign: 'center' }}>
                          {isExpanded ? (
                            <CollapseIcon
                              sx={{ fontSize: 18, color: 'text.secondary' }}
                            />
                          ) : (
                            <ExpandIcon
                              sx={{ fontSize: 18, color: 'text.disabled' }}
                            />
                          )}
                        </TableCell>

                        {/* Time */}
                        <TableCell sx={{ whiteSpace: 'nowrap', py: 0.75 }}>
                          <Tooltip
                            title={formatAbsoluteTime(row.timestamp)}
                            placement="top"
                            arrow
                          >
                            <Typography
                              variant="body2"
                              sx={{ fontSize: '0.8125rem', color: 'text.primary' }}
                            >
                              {relativeTime(row.timestamp, t)}
                            </Typography>
                          </Tooltip>
                        </TableCell>

                        {/* User ID */}
                        <TableCell sx={{ py: 0.75 }}>
                          <Box
                            sx={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 0.5,
                            }}
                          >
                            <Tooltip
                              title={
                                copiedId === rowId
                                  ? t('argus.analytics.drilldown.copied', 'Copied!')
                                  : row.user_id || ''
                              }
                              placement="top"
                              arrow
                            >
                              <Chip
                                label={
                                  row.user_id
                                    ? row.user_id.length > 14
                                      ? `${row.user_id.slice(0, 14)}…`
                                      : row.user_id
                                    : '—'
                                }
                                size="small"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (row.user_id) handleCopyUserId(row.user_id, rowId);
                                }}
                                icon={
                                  <CopyIcon sx={{ fontSize: '12px !important' }} />
                                }
                                sx={{
                                  fontFamily: 'monospace',
                                  fontSize: '0.7rem',
                                  fontWeight: 500,
                                  height: 24,
                                  bgcolor: isDark
                                    ? alpha('#fff', 0.06)
                                    : alpha('#000', 0.04),
                                  '&:hover': {
                                    bgcolor: isDark
                                      ? alpha('#fff', 0.1)
                                      : alpha('#000', 0.08),
                                  },
                                  '& .MuiChip-icon': {
                                    color: 'text.disabled',
                                    ml: '4px',
                                  },
                                }}
                              />
                            </Tooltip>
                          </Box>
                        </TableCell>

                        {/* Platform */}
                        <TableCell sx={{ py: 0.75 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                            <PlatformIcon platform={row.platform} />
                            <Typography variant="body2" sx={{ fontSize: '0.8125rem' }}>
                              {row.platform || '—'}
                            </Typography>
                          </Box>
                        </TableCell>

                        {/* Country */}
                        <TableCell sx={{ py: 0.75 }}>
                          {row.country ? (
                            <Tooltip title={getCountryByCode(row.country)?.name || row.country} placement="top" arrow>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                                <FlagImage code={row.country.toLowerCase()} size={16} />
                                <Typography variant="body2" sx={{ fontSize: '0.8125rem' }}>
                                  {row.country}
                                </Typography>
                              </Box>
                            </Tooltip>
                          ) : (
                            <Typography variant="body2" sx={{ fontSize: '0.8125rem', color: 'text.disabled' }}>
                              —
                            </Typography>
                          )}
                        </TableCell>
                      </TableRow>

                      {/* ── Expanded detail ─────────────────────── */}
                      <TableRow>
                        <TableCell
                          colSpan={5}
                          sx={{ p: 0, border: 0 }}
                        >
                          <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                            <DetailPanel row={row} />
                          </Collapse>
                        </TableCell>
                      </TableRow>
                    </React.Fragment>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>
    </ResizableDrawer>
  );
};

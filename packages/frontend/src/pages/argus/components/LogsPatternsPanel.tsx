import React, { useMemo, useState } from 'react';
import {
  Box,
  Typography,
  Chip,
  CircularProgress,
  useTheme,
  alpha,
  IconButton,
} from '@mui/material';
import {
  Search as SearchIcon,
  ArrowUpward as ArrowUpIcon,
  ArrowDownward as ArrowDownIcon,
  FiberNew as NewIcon,
  NotificationsActive as AlertIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import EmptyPlaceholder from '@/components/common/EmptyPlaceholder';
import SafeTooltip from '@/components/common/SafeTooltip';
import { formatRelativeTime } from '@/utils/dateFormat';
import { formatCompactNumber } from '@/utils/numberFormat';
import { ARGUS_SEMANTIC } from '../argusThemeTokens';

export interface PatternEntry {
  pattern: string;
  count: number;
  level: string;
  service: string;
  first_seen: string;
  last_seen: string;
  sample_message: string;
  prev_count?: number | null;
  trend?: number[] | null;
}

export interface LogsPatternsPanelProps {
  patterns: PatternEntry[];
  loading: boolean;
  isDark: boolean;
  onPatternClick?: (pattern: PatternEntry) => void;
  onCreateAlert?: (pattern: PatternEntry) => void;
}

/* ── Severity color mapping ── */
const LEVEL_COLORS: Record<string, string> = {
  fatal: '#d32f2f',
  error: ARGUS_SEMANTIC.negative,
  warn: ARGUS_SEMANTIC.warning,
  warning: ARGUS_SEMANTIC.warning,
  info: ARGUS_SEMANTIC.info,
  debug: '#9e9e9e',
  trace: '#78909c',
};

const getLevelColor = (level: string): string =>
  LEVEL_COLORS[level?.toLowerCase()] || '#9e9e9e';

/* ── Inline SVG Sparkline ── */
const Sparkline: React.FC<{
  data: number[];
  width?: number;
  height?: number;
  color?: string;
}> = React.memo(({ data, width = 60, height = 18, color = '#7c4dff' }) => {
  if (!data || data.length === 0) return null;
  const max = Math.max(...data, 1);
  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - (v / max) * (height - 2) - 1;
      return `${x},${y}`;
    })
    .join(' ');

  // Area fill path
  const firstX = 0;
  const lastX = width;
  const areaPath = `M${firstX},${height} L${points
    .split(' ')
    .map((p) => `L${p}`)
    .join(' ')} L${lastX},${height} Z`.replace('ML', 'L');

  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <polygon
        points={`${firstX},${height} ${points} ${lastX},${height}`}
        fill={color}
        opacity={0.12}
      />
    </svg>
  );
});

/* ── Delta Badge ── */
const DeltaBadge: React.FC<{
  count: number;
  prevCount: number | null | undefined;
  isDark: boolean;
}> = React.memo(({ count, prevCount, isDark }) => {
  if (prevCount === null || prevCount === undefined) return null;

  const prev = Number(prevCount);
  const curr = Number(count);

  // New pattern (didn't exist in previous period)
  if (prev === 0 && curr > 0) {
    return (
      <SafeTooltip title="New pattern — not seen in previous period">
        <Box
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 0.25,
            px: 0.5,
            py: 0.1,
            borderRadius: '3px',
            fontSize: '0.58rem',
            fontWeight: 700,
            color: ARGUS_SEMANTIC.positive,
            bgcolor: 'rgba(76,175,80,0.12)',
          }}
        >
          <NewIcon sx={{ fontSize: 10 }} />
          NEW
        </Box>
      </SafeTooltip>
    );
  }

  const delta = prev > 0 ? ((curr - prev) / prev) * 100 : 0;
  const isUp = delta > 5;
  const isDown = delta < -5;

  if (!isUp && !isDown) {
    return (
      <Typography
        component="span"
        sx={{ fontSize: '0.58rem', color: 'text.disabled' }}
      >
        —
      </Typography>
    );
  }

  const color = isUp ? ARGUS_SEMANTIC.negative : ARGUS_SEMANTIC.positive;
  const Icon = isUp ? ArrowUpIcon : ArrowDownIcon;

  // Format: use multiplier (×) for large changes, percentage for small
  const multiplier = curr / prev;
  const displayText =
    Math.abs(delta) > 200
      ? `${multiplier.toFixed(1)}×` // "3.2×" — much clearer than "220%"
      : `${Math.abs(delta).toFixed(0)}%`; // "45%"

  return (
    <SafeTooltip
      title={`${isUp ? '+' : ''}${delta.toFixed(0)}% vs previous period (${formatCompactNumber(prev)} → ${formatCompactNumber(curr)})`}
    >
      <Box
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 0.15,
          px: 0.5,
          py: 0.1,
          borderRadius: '3px',
          fontSize: '0.58rem',
          fontWeight: 700,
          color,
          bgcolor: `${color}18`,
        }}
      >
        <Icon sx={{ fontSize: 10 }} />
        {displayText}
      </Box>
    </SafeTooltip>
  );
});

/* ── Sort types ── */
type SortKey =
  | 'count'
  | 'level'
  | 'service'
  | 'first_seen'
  | 'last_seen'
  | 'delta';
type SortDir = 'asc' | 'desc';

const LEVEL_ORDER: Record<string, number> = {
  fatal: 0,
  error: 1,
  warn: 2,
  warning: 2,
  info: 3,
  debug: 4,
  trace: 5,
};

/* ── Summary Cards ── */
const SummaryCards: React.FC<{
  patterns: PatternEntry[];
  isDark: boolean;
}> = React.memo(({ patterns, isDark }) => {
  const theme = useTheme();

  const stats = useMemo(() => {
    let newCount = 0;
    let surgeCount = 0;
    let errorCount = 0;

    patterns.forEach((p) => {
      const prev = p.prev_count;
      if (prev === 0 || prev === null || prev === undefined) {
        if (Number(p.count) > 0 && prev === 0) newCount++;
      } else {
        const delta = ((Number(p.count) - Number(prev)) / Number(prev)) * 100;
        if (delta > 100) surgeCount++;
      }
      const lvl = p.level?.toLowerCase();
      if (lvl === 'error' || lvl === 'fatal') errorCount++;
    });

    return { total: patterns.length, newCount, surgeCount, errorCount };
  }, [patterns]);

  const cards = [
    { label: 'Total', value: stats.total, color: theme.palette.primary.main },
    { label: 'New', value: stats.newCount, color: ARGUS_SEMANTIC.positive },
    { label: 'Surge', value: stats.surgeCount, color: ARGUS_SEMANTIC.warning },
    { label: 'Error', value: stats.errorCount, color: ARGUS_SEMANTIC.negative },
  ];

  return (
    <Box sx={{ display: 'flex', gap: 1, px: 1, pb: 1, flexWrap: 'wrap' }}>
      {cards.map((c) => (
        <Box
          key={c.label}
          sx={{
            flex: '1 1 0',
            minWidth: 80,
            px: 1.5,
            py: 0.75,
            borderRadius: '6px',
            bgcolor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
            textAlign: 'center',
          }}
        >
          <Typography
            sx={{
              fontSize: '1.1rem',
              fontWeight: 800,
              color: c.color,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {c.value}
          </Typography>
          <Typography
            sx={{
              fontSize: '0.62rem',
              color: 'text.disabled',
              fontWeight: 600,
            }}
          >
            {c.label}
          </Typography>
        </Box>
      ))}
    </Box>
  );
});

/* ── Main Component ── */
const LogsPatternsPanel: React.FC<LogsPatternsPanelProps> = ({
  patterns,
  loading,
  isDark,
  onPatternClick,
  onCreateAlert,
}) => {
  const theme = useTheme();
  const { t } = useTranslation();

  // Sorting state
  const [sortKey, setSortKey] = useState<SortKey>('count');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const sortedPatterns = useMemo(() => {
    const arr = [...patterns];
    const dir = sortDir === 'asc' ? 1 : -1;
    arr.sort((a, b) => {
      switch (sortKey) {
        case 'count':
          return (Number(a.count) - Number(b.count)) * dir;
        case 'level':
          return (
            ((LEVEL_ORDER[a.level?.toLowerCase()] ?? 9) -
              (LEVEL_ORDER[b.level?.toLowerCase()] ?? 9)) *
            dir
          );
        case 'service':
          return (a.service || '').localeCompare(b.service || '') * dir;
        case 'first_seen':
          return (
            (new Date(a.first_seen).getTime() -
              new Date(b.first_seen).getTime()) *
            dir
          );
        case 'last_seen':
          return (
            (new Date(a.last_seen).getTime() -
              new Date(b.last_seen).getTime()) *
            dir
          );
        case 'delta': {
          const deltaA =
            a.prev_count != null && Number(a.prev_count) > 0
              ? (Number(a.count) - Number(a.prev_count)) / Number(a.prev_count)
              : a.prev_count === 0
                ? 999
                : -1;
          const deltaB =
            b.prev_count != null && Number(b.prev_count) > 0
              ? (Number(b.count) - Number(b.prev_count)) / Number(b.prev_count)
              : b.prev_count === 0
                ? 999
                : -1;
          return (deltaA - deltaB) * dir;
        }
        default:
          return 0;
      }
    });
    return arr;
  }, [patterns, sortKey, sortDir]);

  // Calculate total count for percentage bars
  const totalCount = useMemo(
    () => patterns.reduce((sum, p) => sum + Number(p.count), 0),
    [patterns]
  );

  const SortHeader: React.FC<{
    label: string;
    field: SortKey;
    style?: React.CSSProperties;
  }> = ({ label, field, style }) => (
    <th
      onClick={() => handleSort(field)}
      style={{
        ...style,
        padding: '6px 10px',
        fontWeight: 700,
        cursor: 'pointer',
        userSelect: 'none',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
      {sortKey === field && (
        <span style={{ fontSize: '0.6rem', marginLeft: 2 }}>
          {sortDir === 'asc' ? '▲' : '▼'}
        </span>
      )}
    </th>
  );

  return (
    <Box
      sx={{ px: 1, py: 1, flex: 1, display: 'flex', flexDirection: 'column' }}
    >
      {loading ? (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            py: 8,
          }}
        >
          <CircularProgress size={24} sx={{ mr: 1 }} />
          <Typography sx={{ fontSize: '0.82rem', color: 'text.secondary' }}>
            {t('argus.logs.patterns.loading', 'Analyzing patterns...')}
          </Typography>
        </Box>
      ) : patterns.length === 0 ? (
        <EmptyPlaceholder
          variant="text"
          icon={<SearchIcon sx={{ fontSize: 48 }} />}
          message={t('argus.logs.patterns.noPatterns', 'No patterns found')}
          description={t(
            'argus.logs.patterns.noPatternsDesc',
            'Try adjusting your search or time range.'
          )}
          sx={{ flex: 1 }}
        />
      ) : (
        <>
          {/* Summary Dashboard Cards (F) */}
          <SummaryCards patterns={patterns} isDark={isDark} />

          <Box sx={{ overflow: 'auto', flex: 1 }}>
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: '0.73rem',
              }}
            >
              <thead>
                <tr
                  style={{
                    borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
                  }}
                >
                  <SortHeader
                    label={t('argus.logs.patterns.level', 'Level')}
                    field="level"
                    style={{ textAlign: 'center', width: 50 }}
                  />
                  <SortHeader
                    label={t('argus.logs.patterns.count', 'Count')}
                    field="count"
                    style={{ textAlign: 'right', width: 70 }}
                  />
                  <th
                    style={{ padding: '6px 4px', fontWeight: 700, width: 50 }}
                  >
                    %
                  </th>
                  <SortHeader
                    label="Δ"
                    field="delta"
                    style={{ textAlign: 'center', width: 55 }}
                  />
                  <th
                    style={{
                      padding: '6px 4px',
                      fontWeight: 700,
                      width: 70,
                      textAlign: 'center',
                    }}
                  >
                    {t('argus.logs.patterns.trend', 'Trend')}
                  </th>
                  <th
                    style={{
                      textAlign: 'left',
                      padding: '6px 10px',
                      fontWeight: 700,
                    }}
                  >
                    {t('argus.logs.patterns.pattern', 'Pattern')}
                  </th>
                  <SortHeader
                    label={t('argus.logs.patterns.service', 'Service')}
                    field="service"
                    style={{ textAlign: 'left', width: 80 }}
                  />
                  <SortHeader
                    label={t('argus.logs.patterns.firstSeen', 'First Seen')}
                    field="first_seen"
                    style={{ textAlign: 'left', width: 100 }}
                  />
                  <SortHeader
                    label={t('argus.logs.patterns.lastSeen', 'Last Seen')}
                    field="last_seen"
                    style={{ textAlign: 'left', width: 100 }}
                  />
                  <th style={{ width: 30 }} />
                </tr>
              </thead>
              <tbody>
                {sortedPatterns.map((p, idx) => {
                  const pct =
                    totalCount > 0 ? (Number(p.count) / totalCount) * 100 : 0;
                  const levelColor = getLevelColor(p.level);
                  return (
                    <tr
                      key={idx}
                      onClick={() => onPatternClick?.(p)}
                      style={{
                        borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)'}`,
                        cursor: onPatternClick ? 'pointer' : 'default',
                        transition: 'background-color 0.15s',
                      }}
                      onMouseEnter={(e) => {
                        (
                          e.currentTarget as HTMLTableRowElement
                        ).style.backgroundColor = isDark
                          ? 'rgba(255,255,255,0.03)'
                          : 'rgba(0,0,0,0.02)';
                      }}
                      onMouseLeave={(e) => {
                        (
                          e.currentTarget as HTMLTableRowElement
                        ).style.backgroundColor = '';
                      }}
                    >
                      {/* Level badge */}
                      <td style={{ textAlign: 'center', padding: '6px 6px' }}>
                        <SafeTooltip title={p.level || 'unknown'}>
                          <Box
                            sx={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              px: 0.75,
                              py: 0.15,
                              borderRadius: '3px',
                              fontSize: '0.6rem',
                              fontWeight: 700,
                              textTransform: 'uppercase',
                              letterSpacing: '0.02em',
                              color: levelColor,
                              bgcolor: alpha(levelColor, 0.12),
                              minWidth: 36,
                            }}
                          >
                            {(p.level || '?').slice(0, 4).toUpperCase()}
                          </Box>
                        </SafeTooltip>
                      </td>
                      {/* Count */}
                      <td
                        style={{
                          textAlign: 'right',
                          padding: '6px 10px',
                          fontWeight: 700,
                          fontVariantNumeric: 'tabular-nums',
                          color: theme.palette.primary.main,
                        }}
                      >
                        {formatCompactNumber(Number(p.count))}
                      </td>
                      {/* Percentage bar */}
                      <td style={{ padding: '6px 4px', width: 50 }}>
                        <Box
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 0.5,
                          }}
                        >
                          <Box
                            sx={{
                              width: 30,
                              height: 4,
                              borderRadius: 2,
                              bgcolor: isDark
                                ? 'rgba(255,255,255,0.06)'
                                : 'rgba(0,0,0,0.06)',
                              overflow: 'hidden',
                              flexShrink: 0,
                            }}
                          >
                            <Box
                              sx={{
                                width: `${Math.min(pct, 100)}%`,
                                height: '100%',
                                bgcolor: alpha(theme.palette.primary.main, 0.6),
                                borderRadius: 2,
                              }}
                            />
                          </Box>
                          <Typography
                            sx={{
                              fontSize: '0.58rem',
                              color: 'text.disabled',
                              fontVariantNumeric: 'tabular-nums',
                              minWidth: 22,
                            }}
                          >
                            {pct.toFixed(0)}%
                          </Typography>
                        </Box>
                      </td>
                      {/* Delta badge */}
                      <td style={{ textAlign: 'center', padding: '4px 4px' }}>
                        <DeltaBadge
                          count={Number(p.count)}
                          prevCount={p.prev_count}
                          isDark={isDark}
                        />
                      </td>
                      {/* Sparkline */}
                      <td style={{ padding: '4px 4px', textAlign: 'center' }}>
                        {p.trend ? (
                          <Sparkline data={p.trend} color={levelColor} />
                        ) : (
                          <Typography
                            sx={{ fontSize: '0.55rem', color: 'text.disabled' }}
                          >
                            —
                          </Typography>
                        )}
                      </td>
                      {/* Pattern + sample */}
                      <td
                        style={{
                          padding: '6px 10px',
                          fontSize: '0.70rem',
                          wordBreak: 'break-all',
                          opacity: 0.85,
                        }}
                      >
                        {p.pattern}
                        <br />
                        <span
                          style={{
                            fontSize: '0.65rem',
                            color: isDark
                              ? 'rgba(255,255,255,0.35)'
                              : 'rgba(0,0,0,0.35)',
                          }}
                        >
                          {p.sample_message?.slice(0, 120)}
                        </span>
                      </td>
                      <td style={{ padding: '6px 10px' }}>
                        <Chip
                          label={p.service || '-'}
                          size="small"
                          variant="outlined"
                          sx={{ height: 18, fontSize: '0.62rem' }}
                        />
                      </td>
                      <td
                        style={{
                          padding: '6px 10px',
                          fontSize: '0.68rem',
                          color: isDark
                            ? 'rgba(255,255,255,0.5)'
                            : 'rgba(0,0,0,0.5)',
                        }}
                      >
                        {p.first_seen ? formatRelativeTime(p.first_seen) : '-'}
                      </td>
                      <td
                        style={{
                          padding: '6px 10px',
                          fontSize: '0.68rem',
                          color: isDark
                            ? 'rgba(255,255,255,0.5)'
                            : 'rgba(0,0,0,0.5)',
                        }}
                      >
                        {p.last_seen ? formatRelativeTime(p.last_seen) : '-'}
                      </td>
                      {/* Alert button (⭐6) */}
                      <td style={{ padding: '2px' }}>
                        {onCreateAlert && (
                          <SafeTooltip
                            title={t(
                              'argus.logs.patterns.createAlert',
                              'Create alert for this pattern'
                            )}
                          >
                            <IconButton
                              size="small"
                              onClick={(e) => {
                                e.stopPropagation();
                                onCreateAlert(p);
                              }}
                              sx={{
                                p: 0.3,
                                color: 'text.disabled',
                                opacity: 0,
                                transition: 'opacity 0.15s',
                                'tr:hover &': { opacity: 0.7 },
                                '&:hover': {
                                  opacity: 1,
                                  color: ARGUS_SEMANTIC.warning,
                                },
                              }}
                            >
                              <AlertIcon sx={{ fontSize: 13 }} />
                            </IconButton>
                          </SafeTooltip>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Box>
        </>
      )}
    </Box>
  );
};

export default LogsPatternsPanel;

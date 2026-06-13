import React, { useMemo, useCallback } from 'react';
import {
  Box,
  Typography,
  Popover,
  Paper,
  IconButton,
  useTheme,
  alpha,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  ErrorOutline as ErrorIcon,
  Link as UrlIcon,
  Person as UserIcon,
  NewReleases as ReleaseIcon,
  List as AllEventsIcon,
  ChevronLeft as PrevIcon,
  ChevronRight as NextIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import ArgusVolumeChart from '@/components/argus/ArgusVolumeChart';

// ─── Pre-built Queries ───

export interface PrebuiltQuery {
  id: string;
  nameKey: string;
  defaultName: string;
  descKey: string;
  defaultDesc: string;
  icon: React.ReactNode;
  color: string;
  fields: string[];
  groupBy: string[];
  orderBy: string;
  yAxis: string;
}

export const PREBUILT_QUERIES: PrebuiltQuery[] = [
  {
    id: 'all-events',
    nameKey: 'argus.discover.prebuilt.allEvents',
    defaultName: 'All Events',
    descKey: 'argus.discover.prebuilt.allEventsDesc',
    defaultDesc: 'Browse raw error events',
    icon: <AllEventsIcon sx={{ fontSize: 20 }} />,
    color: '#7c4dff',
    fields: ['event_id', 'timestamp', 'level', 'type', 'value'],
    groupBy: [],
    orderBy: '-timestamp',
    yAxis: 'count()',
  },
  {
    id: 'errors-by-title',
    nameKey: 'argus.discover.prebuilt.errorsByTitle',
    defaultName: 'Errors by Title',
    descKey: 'argus.discover.prebuilt.errorsByTitleDesc',
    defaultDesc: 'Top errors by occurrence count',
    icon: <ErrorIcon sx={{ fontSize: 20 }} />,
    color: '#f44336',
    fields: ['type', 'count()', 'uniq(user_id)'],
    groupBy: ['type'],
    orderBy: '-count',
    yAxis: 'count()',
  },
  {
    id: 'errors-by-url',
    nameKey: 'argus.discover.prebuilt.errorsByUrl',
    defaultName: 'Errors by URL',
    descKey: 'argus.discover.prebuilt.errorsByUrlDesc',
    defaultDesc: 'Which pages generate the most errors',
    icon: <UrlIcon sx={{ fontSize: 20 }} />,
    color: '#2196f3',
    fields: ['http_url', 'count()', 'uniq(user_id)'],
    groupBy: ['http_url'],
    orderBy: '-count',
    yAxis: 'count()',
  },
  {
    id: 'top-users',
    nameKey: 'argus.discover.prebuilt.topUsers',
    defaultName: 'Top Users',
    descKey: 'argus.discover.prebuilt.topUsersDesc',
    defaultDesc: 'Users with the most errors',
    icon: <UserIcon sx={{ fontSize: 20 }} />,
    color: '#4caf50',
    fields: ['user_id', 'user_email', 'count()'],
    groupBy: ['user_id', 'user_email'],
    orderBy: '-count',
    yAxis: 'count()',
  },
  {
    id: 'errors-by-release',
    nameKey: 'argus.discover.prebuilt.errorsByRelease',
    defaultName: 'Errors by Release',
    descKey: 'argus.discover.prebuilt.errorsByReleaseDesc',
    defaultDesc: 'Error distribution across releases',
    icon: <ReleaseIcon sx={{ fontSize: 20 }} />,
    color: '#ff9800',
    fields: ['release', 'count()', 'uniq(user_id)'],
    groupBy: ['release'],
    orderBy: '-count',
    yAxis: 'count()',
  },
];

// ─── PrebuiltQueryCards ───

export const PrebuiltQueryCards: React.FC<{
  onSelect: (query: PrebuiltQuery) => void;
  isDark: boolean;
}> = ({ onSelect, isDark }) => {
  const { t } = useTranslation();
  const theme = useTheme();

  return (
    <Box sx={{ mb: 3 }}>
      <Typography
        sx={{
          fontSize: '0.82rem',
          fontWeight: 700,
          mb: 1.5,
          color: 'text.secondary',
        }}
      >
        {t('argus.discover.prebuilt.title', 'Start with a query')}
      </Typography>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
          gap: 1.5,
        }}
      >
        {PREBUILT_QUERIES.map((q) => (
          <Paper
            key={q.id}
            elevation={0}
            onClick={() => onSelect(q)}
            sx={{
              p: 2,
              borderRadius: 2,
              cursor: 'pointer',
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
              transition: 'all 0.2s',
              '&:hover': {
                borderColor: alpha(q.color, 0.4),
                backgroundColor: alpha(q.color, 0.04),
                transform: 'translateY(-1px)',
                boxShadow: `0 4px 12px ${alpha(q.color, isDark ? 0.15 : 0.08)}`,
              },
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <Box
                sx={{
                  width: 32,
                  height: 32,
                  borderRadius: '8px',
                  backgroundColor: alpha(q.color, 0.12),
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: q.color,
                }}
              >
                {q.icon}
              </Box>
              <Typography sx={{ fontSize: '0.82rem', fontWeight: 700 }}>
                {t(q.nameKey, q.defaultName)}
              </Typography>
            </Box>
            <Typography
              sx={{
                fontSize: '0.7rem',
                color: 'text.disabled',
                lineHeight: 1.4,
              }}
            >
              {t(q.descKey, q.defaultDesc)}
            </Typography>
            <Box sx={{ display: 'flex', gap: 0.5, mt: 1.2, flexWrap: 'wrap' }}>
              {q.fields.slice(0, 3).map((f) => (
                <Typography
                  key={f}
                  sx={{
                    fontSize: '0.6rem',
                    fontWeight: 600,
                    px: 0.8,
                    py: 0.15,
                    borderRadius: '4px',
                    backgroundColor: isDark
                      ? 'rgba(255,255,255,0.04)'
                      : 'rgba(0,0,0,0.04)',
                    color: 'text.secondary',
                  }}
                >
                  {f}
                </Typography>
              ))}
              {q.fields.length > 3 && (
                <Typography
                  sx={{
                    fontSize: '0.6rem',
                    fontWeight: 600,
                    px: 0.8,
                    py: 0.15,
                    borderRadius: '4px',
                    backgroundColor: alpha(theme.palette.primary.main, 0.08),
                    color: theme.palette.primary.main,
                  }}
                >
                  +{q.fields.length - 3}
                </Typography>
              )}
            </Box>
          </Paper>
        ))}
      </Box>
    </Box>
  );
};

// ─── PaginationControls ───

export const PaginationControls: React.FC<{
  offset: number;
  limit: number;
  resultCount: number;
  onPrev: () => void;
  onNext: () => void;
  isDark: boolean;
}> = ({ offset, limit, resultCount, onPrev, onNext, isDark }) => {
  const { t } = useTranslation();
  const page = Math.floor(offset / limit) + 1;
  const hasNext = resultCount >= limit;
  const hasPrev = offset > 0;

  if (!hasPrev && !hasNext) return null;

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        gap: 1,
        py: 1,
        px: 2,
        borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
      }}
    >
      <Typography sx={{ fontSize: '0.72rem', color: 'text.disabled' }}>
        {t('argus.discover.showing', 'Showing')} {offset + 1}–
        {offset + resultCount}
      </Typography>
      <IconButton
        size="small"
        onClick={onPrev}
        disabled={!hasPrev}
        sx={{ p: 0.3 }}
      >
        <PrevIcon sx={{ fontSize: 18 }} />
      </IconButton>
      <Typography
        sx={{
          fontSize: '0.72rem',
          fontWeight: 700,
          minWidth: 20,
          textAlign: 'center',
        }}
      >
        {page}
      </Typography>
      <IconButton
        size="small"
        onClick={onNext}
        disabled={!hasNext}
        sx={{ p: 0.3 }}
      >
        <NextIcon sx={{ fontSize: 18 }} />
      </IconButton>
    </Box>
  );
};

// ─── Dataset Switcher ───

export type DiscoverDataset = 'errors' | 'spans' | 'logs' | 'transactions' | 'sessions';

export const DATASET_OPTIONS: { value: DiscoverDataset; label: string; color: string }[] = [
  { value: 'errors', label: 'Errors', color: '#f44336' },
  { value: 'spans', label: 'Spans', color: '#7c4dff' },
  { value: 'logs', label: 'Logs', color: '#4caf50' },
  { value: 'transactions', label: 'Transactions', color: '#2196f3' },
  { value: 'sessions', label: 'Sessions', color: '#ff9800' },
];

export const DatasetSwitcher: React.FC<{
  value: DiscoverDataset;
  onChange: (ds: DiscoverDataset) => void;
}> = ({ value, onChange }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  return (
    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
      {DATASET_OPTIONS.map((opt) => {
        const selected = opt.value === value;
        return (
          <Box
            key={opt.value}
            onClick={() => onChange(opt.value)}
            sx={{
              px: 1.5,
              py: 0.4,
              borderRadius: '6px',
              fontSize: '0.72rem',
              fontWeight: selected ? 700 : 500,
              cursor: 'pointer',
              transition: 'all 0.15s',
              userSelect: 'none',
              color: selected ? '#fff' : 'text.secondary',
              backgroundColor: selected
                ? opt.color
                : isDark
                  ? 'rgba(255,255,255,0.04)'
                  : 'rgba(0,0,0,0.04)',
              border: `1px solid ${selected ? opt.color : 'transparent'}`,
              '&:hover': {
                backgroundColor: selected
                  ? opt.color
                  : alpha(opt.color, 0.1),
                borderColor: alpha(opt.color, 0.3),
              },
            }}
          >
            {opt.label}
          </Box>
        );
      })}
    </Box>
  );
};

// ─── Per-Dataset Fallback Columns ───

export const DATASET_FALLBACK_COLUMNS: Record<DiscoverDataset, string[]> = {
  errors: [
    'event_id', 'timestamp', 'level', 'platform',
    'environment', 'release', 'transaction',
  ],
  spans: [
    'span_id', 'trace_id', 'timestamp', 'op',
    'description', 'status', 'duration',
  ],
  logs: [
    'log_id', 'timestamp', 'level', 'service',
    'message', 'environment',
  ],
  transactions: [
    'transaction_id', 'trace_id', 'timestamp', 'name',
    'duration', 'status', 'op',
  ],
  sessions: [
    'session_id', 'timestamp', 'status', 'duration',
    'environment', 'release',
  ],
};

// ─── Constants ───

export const FALLBACK_COLUMNS = [
  'event_id',
  'timestamp',
  'level',
  'platform',
  'browser',
  'os',
  'environment',
  'release',
  'transaction',
];

export const DISPLAY_OPTIONS_KEYS = [
  { value: 'total', labelKey: 'argus.discover.displayTotal' },
  { value: 'bar', labelKey: 'argus.discover.displayBar' },
  { value: 'top5', labelKey: 'argus.discover.displayTop5' },
  { value: 'daily', labelKey: 'argus.discover.displayDaily' },
];

export const Y_AXIS_OPTIONS = [
  { value: 'count()', label: 'count()' },
  { value: 'uniq(event_id)', label: 'count_unique(event_id)' },
  { value: 'uniq(user_id)', label: 'count_unique(user_id)' },
];

// Parse ClickHouse DateTime string safely (YYYY-MM-DD HH:MM:SS → ISO)
const parseChDate = (s: string): Date => {
  if (!s) return new Date(NaN);
  const iso = s.replace(' ', 'T');
  return new Date(iso.includes('T') ? iso : `${iso}T00:00:00`);
};

// ─── VolumeChart ───

export const VolumeChart: React.FC<{
  data: { bucket: string; level: string; count: number }[];
  isDark: boolean;
  period: string;
  onZoom?: (start: string, end: string) => void;
}> = ({ data, onZoom }) => {
  const { t, i18n } = useTranslation();

  const { sortedBuckets, chartLabels, chartDatasets } = useMemo(() => {
    if (data.length === 0)
      return {
        sortedBuckets: [] as string[],
        chartLabels: [] as string[],
        chartDatasets: [],
      };

    // Group by level for stacked charts
    const levels = new Set<string>();
    const bucketLevelMap = new Map<string, Map<string, number>>();
    data.forEach((p) => {
      const count = Number(p.count) || 0;
      const level = p.level || 'all';
      levels.add(level);
      if (!bucketLevelMap.has(p.bucket)) {
        bucketLevelMap.set(p.bucket, new Map());
      }
      const levelMap = bucketLevelMap.get(p.bucket)!;
      levelMap.set(level, (levelMap.get(level) || 0) + count);
    });

    const sortedKeys = [...bucketLevelMap.keys()].sort((a, b) =>
      a.localeCompare(b)
    );

    const labels = sortedKeys.map((b) => {
      const d = parseChDate(b);
      if (isNaN(d.getTime())) return b; // fallback to raw string
      return d.toLocaleString(i18n.language || 'en', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });
    });

    const LEVEL_COLORS: Record<string, string> = {
      fatal: '#d32f2f',
      error: '#f44336',
      warning: '#ff9800',
      info: '#2196f3',
      debug: '#9e9e9e',
      all: '#7c4dff',
    };

    const sortedLevels = [...levels].sort((a, b) => {
      const order = ['fatal', 'error', 'warning', 'info', 'debug', 'all'];
      return (order.indexOf(a) === -1 ? 99 : order.indexOf(a)) -
             (order.indexOf(b) === -1 ? 99 : order.indexOf(b));
    });

    const datasets = sortedLevels.length <= 1
      ? [{
          label: t('argus.discover.volumeTitle', 'count(events)'),
          data: sortedKeys.map((k) => {
            const m = bucketLevelMap.get(k)!;
            let total = 0;
            m.forEach((v) => (total += v));
            return total;
          }),
          type: 'bar' as const,
          color: '#7c4dff',
        }]
      : sortedLevels.map((level) => ({
          label: level,
          data: sortedKeys.map((k) => bucketLevelMap.get(k)?.get(level) || 0),
          type: 'bar' as const,
          color: LEVEL_COLORS[level] || '#7c4dff',
        }));

    return {
      sortedBuckets: sortedKeys,
      chartLabels: labels,
      chartDatasets: datasets,
    };
  }, [data, i18n.language, t]);

  const handleZoom = useCallback(
    (startIdx: number, endIdx: number) => {
      if (!onZoom) return;
      const si = Math.min(startIdx, endIdx);
      const ei = Math.max(startIdx, endIdx);
      if (sortedBuckets[si] && sortedBuckets[ei]) {
        const start = parseChDate(sortedBuckets[si]);
        let end = parseChDate(sortedBuckets[ei]);
        if (sortedBuckets.length > 1) {
          const gap =
            parseChDate(sortedBuckets[1]).getTime() -
            parseChDate(sortedBuckets[0]).getTime();
          end = new Date(end.getTime() + gap);
        } else {
          end = new Date(end.getTime() + 3600_000);
        }
        onZoom(start.toISOString(), end.toISOString());
      }
    },
    [onZoom, sortedBuckets]
  );

  return (
    <ArgusVolumeChart
      datasets={chartDatasets}
      labels={chartLabels}
      emptyMessage={t('argus.discover.noEventData')}
      title={t('argus.discover.volumeTitle', 'count(events)')}
      onZoom={onZoom ? handleZoom : undefined}
      storagePrefix="argus_discover_volume"
      showChartTypeToggle={true}
      showCompactToggle={true}
    />
  );
};

// ─── GroupBySelector ───

export const GroupBySelector: React.FC<{
  groupBy: string[];
  columns: string[];
  onToggle: (col: string) => void;
  isDark: boolean;
}> = ({ groupBy, columns, onToggle, isDark }) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const [anchorEl, setAnchorEl] = React.useState<HTMLElement | null>(null);

  return (
    <>
      <Box
        onClick={(e) => setAnchorEl(e.currentTarget)}
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 0.5,
          height: 32,
          px: 1.5,
          borderRadius: '6px',
          border: '1px solid',
          borderColor: anchorEl ? 'primary.main' : 'divider',
          bgcolor: anchorEl
            ? alpha(theme.palette.primary.main, 0.04)
            : 'transparent',
          cursor: 'pointer',
          transition: 'all 0.15s',
          userSelect: 'none',
          whiteSpace: 'nowrap',
          '&:hover': {
            borderColor: 'primary.main',
            bgcolor: alpha(theme.palette.primary.main, 0.04),
          },
        }}
      >
        <Typography
          sx={{ fontSize: '0.72rem', fontWeight: 600, color: 'text.secondary' }}
        >
          {t('argus.discover.groupBy', 'Group By')}:
        </Typography>
        <Typography
          sx={{
            fontSize: '0.72rem',
            fontWeight: 700,
            color:
              groupBy.length > 0 ? theme.palette.primary.main : 'text.primary',
          }}
        >
          {groupBy.length > 0
            ? groupBy.join(', ')
            : t('argus.discover.none', 'None')}
        </Typography>
        <ExpandMoreIcon
          sx={{
            fontSize: 13,
            color: 'text.disabled',
            transform: anchorEl ? 'rotate(180deg)' : 'none',
            transition: 'transform 0.2s',
          }}
        />
      </Box>
      <Popover
        open={Boolean(anchorEl)}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        slotProps={{
          paper: {
            sx: {
              mt: 0.5,
              borderRadius: '8px',
              boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
              minWidth: 200,
              maxHeight: 320,
              overflow: 'auto',
              py: 0.5,
            },
          },
        }}
      >
        {columns
          .filter((c) => !c.includes('('))
          .slice(0, 15)
          .map((col) => (
            <Box
              key={col}
              onClick={() => onToggle(col)}
              sx={{
                px: 1.5,
                py: 0.6,
                cursor: 'pointer',
                fontSize: '0.78rem',
                fontWeight: groupBy.includes(col) ? 700 : 400,
                color: groupBy.includes(col)
                  ? theme.palette.primary.main
                  : 'text.primary',
                backgroundColor: groupBy.includes(col)
                  ? alpha(theme.palette.primary.main, 0.06)
                  : 'transparent',
                transition: 'background 0.1s',
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                '&:hover': {
                  backgroundColor: alpha(theme.palette.primary.main, 0.04),
                },
              }}
            >
              <Box
                sx={{
                  width: 14,
                  height: 14,
                  borderRadius: '3px',
                  border: `1.5px solid ${groupBy.includes(col) ? theme.palette.primary.main : isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)'}`,
                  backgroundColor: groupBy.includes(col)
                    ? theme.palette.primary.main
                    : 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                {groupBy.includes(col) && (
                  <Typography
                    sx={{ color: '#fff', fontSize: '0.6rem', fontWeight: 800 }}
                  >
                    ✓
                  </Typography>
                )}
              </Box>
              {col}
            </Box>
          ))}
      </Popover>
    </>
  );
};

// ─── DisplayModeChip ───

export const DisplayModeChip: React.FC<{
  value: string;
  onChange: (v: string) => void;
  isDark: boolean;
}> = ({ value, onChange, isDark }) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const [anchorEl, setAnchorEl] = React.useState<HTMLElement | null>(null);
  const currentOpt = DISPLAY_OPTIONS_KEYS.find((o) => o.value === value);
  const displayLabel = currentOpt
    ? t(currentOpt.labelKey, currentOpt.value)
    : value;

  return (
    <>
      <Box
        onClick={(e) => setAnchorEl(e.currentTarget)}
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 0.5,
          height: 28,
          px: 1.2,
          borderRadius: '6px',
          border: '1px solid',
          borderColor: 'divider',
          cursor: 'pointer',
          transition: 'all 0.15s',
          userSelect: 'none',
          whiteSpace: 'nowrap',
          '&:hover': { borderColor: 'primary.main' },
        }}
      >
        <Typography
          sx={{ fontSize: '0.7rem', fontWeight: 600, color: 'text.secondary' }}
        >
          {t('argus.discover.display', 'Display')}:
        </Typography>
        <Typography
          sx={{ fontSize: '0.7rem', fontWeight: 700, color: 'text.primary' }}
        >
          {displayLabel}
        </Typography>
        <ExpandMoreIcon sx={{ fontSize: 12, color: 'text.disabled' }} />
      </Box>
      <Popover
        open={Boolean(anchorEl)}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        slotProps={{
          paper: {
            sx: {
              mt: 0.5,
              borderRadius: '8px',
              boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
              minWidth: 140,
              py: 0.5,
            },
          },
        }}
      >
        {DISPLAY_OPTIONS_KEYS.map((opt) => (
          <Box
            key={opt.value}
            onClick={() => {
              onChange(opt.value);
              setAnchorEl(null);
            }}
            sx={{
              px: 1.5,
              py: 0.6,
              cursor: 'pointer',
              fontSize: '0.78rem',
              fontWeight: opt.value === value ? 700 : 400,
              color: opt.value === value ? 'primary.main' : 'text.primary',
              backgroundColor:
                opt.value === value
                  ? alpha(theme.palette.primary.main, 0.06)
                  : 'transparent',
              '&:hover': {
                backgroundColor: alpha(theme.palette.primary.main, 0.04),
              },
            }}
          >
            {t(opt.labelKey, opt.value)}
          </Box>
        ))}
      </Popover>
    </>
  );
};

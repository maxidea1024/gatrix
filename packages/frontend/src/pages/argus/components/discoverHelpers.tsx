import React, { useMemo, useCallback } from 'react';
import { Box, Typography, Popover, useTheme, alpha } from '@mui/material';
import { ExpandMore as ExpandMoreIcon } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import ArgusVolumeChart from '@/components/argus/ArgusVolumeChart';

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

    const bucketMap = new Map<string, number>();
    data.forEach((p) => {
      const count = Number(p.count) || 0;
      bucketMap.set(p.bucket, (bucketMap.get(p.bucket) || 0) + count);
    });
    const sorted = [...bucketMap.entries()].sort((a, b) =>
      a[0].localeCompare(b[0])
    );

    const labels = sorted.map(([b]) => {
      const d = new Date(b);
      return d.toLocaleString(i18n.language || 'en', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });
    });

    const datasets = [
      {
        label: t('argus.discover.volumeTitle', 'count(events)'),
        data: sorted.map(([, c]) => c),
        type: 'bar' as const,
        color: '#7c4dff',
      },
    ];

    return {
      sortedBuckets: sorted.map(([b]) => b),
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
        const start = new Date(sortedBuckets[si]);
        let end = new Date(sortedBuckets[ei]);
        if (sortedBuckets.length > 1) {
          const gap =
            new Date(sortedBuckets[1]).getTime() -
            new Date(sortedBuckets[0]).getTime();
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
      showChartTypeToggle={false}
      showCompactToggle={false}
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

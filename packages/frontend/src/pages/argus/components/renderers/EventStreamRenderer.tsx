import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  Box,
  Typography,
  IconButton,
  Button,
  Chip,
  alpha,
} from '@mui/material';
import {
  ChevronLeft as PrevIcon,
  ChevronRight as NextIcon,
  KeyboardArrowDown as ExpandIcon,
  KeyboardArrowUp as CollapseIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { type WidgetConfig, type VizOptions, formatValue } from './widgetTypes';

interface EventStreamRendererProps {
  widget: WidgetConfig;
  data: any[];
  isDark: boolean;
  vizOptions?: VizOptions;
  onLoadMore?: (offset: number, limit: number) => void;
  totalCount?: number;
}

// Color by log level
const LEVEL_COLORS: Record<string, string> = {
  fatal: '#d32f2f',
  error: '#f44336',
  warning: '#ff9800',
  warn: '#ff9800',
  info: '#2196f3',
  debug: '#9e9e9e',
  trace: '#78909c',
};

/**
 * Event stream / log viewer widget renderer.
 *
 * Features:
 * - Log rows with level coloring
 * - Expandable row details
 * - Pagination (Load More)
 * - Column selection from viz_options.column_config
 */
const EventStreamRenderer: React.FC<EventStreamRendererProps> = ({
  widget,
  data,
  isDark,
  vizOptions,
  onLoadMore,
  totalCount,
}) => {
  const { t } = useTranslation();
  const [expandedRow, setExpandedRow] = useState<number | null>(null);
  const [page, setPage] = useState(0);

  // Reset page when data changes (e.g., filter/period change)
  useEffect(() => {
    setPage(0);
    setExpandedRow(null);
  }, [data]);

  const pageSize = vizOptions?.rows_per_page ?? 25;

  // Determine visible columns
  const columns = useMemo(() => {
    if (!data || data.length === 0) return [];

    const allKeys = Object.keys(data[0]);

    // If column_config exists, use it
    if (vizOptions?.column_config && vizOptions.column_config.length > 0) {
      return vizOptions.column_config
        .filter((c) => c.visible !== false)
        .map((c) => ({
          key: c.key,
          displayName: c.display_name || c.key,
          width: c.width,
        }));
    }

    // Default: show timestamp, level, message/value, and a couple more
    const priorityKeys = [
      'timestamp',
      'level',
      'message',
      'value',
      'type',
      'service',
      'environment',
    ];
    const visibleKeys = priorityKeys
      .filter((k) => allKeys.includes(k))
      .slice(0, 5);

    // Add remaining keys if less than 5
    if (visibleKeys.length < 5) {
      for (const k of allKeys) {
        if (!visibleKeys.includes(k) && visibleKeys.length < 5) {
          visibleKeys.push(k);
        }
      }
    }

    return visibleKeys.map((k) => ({
      key: k,
      displayName: k,
      width: undefined as number | undefined,
    }));
  }, [data, vizOptions?.column_config]);

  // Paginated data
  const paginatedData = useMemo(() => {
    const start = page * pageSize;
    return data.slice(start, start + pageSize);
  }, [data, page, pageSize]);

  const totalPages = Math.ceil((data?.length || 0) / pageSize);

  const handleToggleRow = useCallback((index: number) => {
    setExpandedRow((prev) => (prev === index ? null : index));
  }, []);

  if (columns.length === 0) return null;

  const borderColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
      }}
    >
      {/* Header row */}
      <Box
        sx={{
          display: 'flex',
          gap: 0,
          borderBottom: `1px solid ${borderColor}`,
          backgroundColor: isDark
            ? 'rgba(30,30,46,0.95)'
            : 'rgba(255,255,255,0.95)',
          position: 'sticky',
          top: 0,
          zIndex: 1,
          flexShrink: 0,
        }}
      >
        {/* Expand toggle spacer */}
        <Box sx={{ minWidth: 24, flexShrink: 0 }} />
        {columns.map((col) => (
          <Box
            key={col.key}
            sx={{
              flex: col.key === 'message' || col.key === 'value' ? 2 : 1,
              px: 0.8,
              py: 0.4,
              ...(col.width ? { width: col.width, flex: 'none' } : {}),
            }}
          >
            <Typography
              sx={{
                fontSize: '0.65rem',
                fontWeight: 700,
                color: 'text.secondary',
                textTransform: 'uppercase',
                letterSpacing: '0.03em',
              }}
              noWrap
            >
              {col.displayName}
            </Typography>
          </Box>
        ))}
      </Box>

      {/* Data rows */}
      <Box sx={{ flex: 1, overflow: 'auto' }}>
        {paginatedData.map((row, i) => {
          const globalIndex = page * pageSize + i;
          const isExpanded = expandedRow === globalIndex;
          const level = String(row.level || row.severity || '').toLowerCase();
          const levelColor = LEVEL_COLORS[level] || 'text.secondary';

          return (
            <Box key={globalIndex}>
              {/* Main row */}
              <Box
                sx={{
                  display: 'flex',
                  gap: 0,
                  borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)'}`,
                  cursor: 'pointer',
                  transition: 'background-color 0.1s',
                  '&:hover': {
                    backgroundColor: isDark
                      ? 'rgba(124,77,255,0.04)'
                      : 'rgba(124,77,255,0.02)',
                  },
                  ...(isExpanded
                    ? {
                        backgroundColor: isDark
                          ? 'rgba(124,77,255,0.06)'
                          : 'rgba(124,77,255,0.03)',
                      }
                    : {}),
                }}
                onClick={() => handleToggleRow(globalIndex)}
              >
                {/* Expand icon */}
                <Box
                  sx={{
                    minWidth: 24,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  {isExpanded ? (
                    <CollapseIcon
                      sx={{ fontSize: 14, color: 'text.disabled' }}
                    />
                  ) : (
                    <ExpandIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
                  )}
                </Box>

                {columns.map((col) => {
                  const cellValue = row[col.key];
                  const isLevel = col.key === 'level' || col.key === 'severity';
                  const isTimestamp = col.key === 'timestamp';
                  const isMessage =
                    col.key === 'message' || col.key === 'value';

                  return (
                    <Box
                      key={col.key}
                      sx={{
                        flex: isMessage ? 2 : 1,
                        px: 0.8,
                        py: 0.3,
                        overflow: 'hidden',
                        ...(col.width
                          ? { width: col.width, flex: 'none' }
                          : {}),
                      }}
                    >
                      {isLevel ? (
                        <Chip
                          label={String(cellValue || '').toUpperCase()}
                          size="small"
                          sx={{
                            height: 18,
                            fontSize: '0.58rem',
                            fontWeight: 700,
                            backgroundColor: alpha(levelColor, 0.12),
                            color: levelColor,
                            borderRadius: '4px',
                          }}
                        />
                      ) : isTimestamp ? (
                        <Typography
                          sx={{
                            fontSize: '0.65rem',
                            color: 'text.secondary',
                            fontFamily: 'monospace',
                          }}
                          noWrap
                        >
                          {formatTimestamp(String(cellValue || ''))}
                        </Typography>
                      ) : (
                        <Typography
                          sx={{
                            fontSize: '0.68rem',
                            color: isMessage
                              ? 'text.primary'
                              : 'text.secondary',
                            fontWeight: isMessage ? 500 : 400,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {typeof cellValue === 'number'
                            ? formatValue(cellValue, vizOptions)
                            : String(cellValue ?? '')}
                        </Typography>
                      )}
                    </Box>
                  );
                })}
              </Box>

              {/* Expanded detail */}
              {isExpanded && (
                <Box
                  sx={{
                    px: 3,
                    py: 1,
                    backgroundColor: isDark
                      ? 'rgba(124,77,255,0.04)'
                      : 'rgba(124,77,255,0.02)',
                    borderBottom: `1px solid ${borderColor}`,
                  }}
                >
                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns:
                        'repeat(auto-fill, minmax(200px, 1fr))',
                      gap: 0.5,
                    }}
                  >
                    {Object.entries(row).map(([key, value]) => (
                      <Box key={key} sx={{ display: 'flex', gap: 0.5 }}>
                        <Typography
                          sx={{
                            fontSize: '0.62rem',
                            color: 'text.disabled',
                            fontWeight: 600,
                            minWidth: 80,
                          }}
                        >
                          {key}:
                        </Typography>
                        <Typography
                          sx={{
                            fontSize: '0.62rem',
                            color: 'text.secondary',
                            wordBreak: 'break-all',
                            fontFamily:
                              typeof value === 'number'
                                ? 'monospace'
                                : 'inherit',
                          }}
                        >
                          {String(value ?? '')}
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                </Box>
              )}
            </Box>
          );
        })}
      </Box>

      {/* Pagination / Load More */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          px: 1,
          py: 0.3,
          borderTop: `1px solid ${borderColor}`,
          flexShrink: 0,
        }}
      >
        <Typography sx={{ fontSize: '0.62rem', color: 'text.disabled' }}>
          {t(
            'argus.dashboards.eventStream.showing',
            'Showing {{start}}–{{end}} of {{total}}',
            {
              start: page * pageSize + 1,
              end: Math.min((page + 1) * pageSize, data.length),
              total: totalCount ?? data.length,
            }
          )}
        </Typography>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          {/* Load More button (if onLoadMore callback provided) */}
          {onLoadMore && data.length < (totalCount ?? Infinity) && (
            <Button
              size="small"
              onClick={() => onLoadMore(data.length, pageSize)}
              sx={{
                fontSize: '0.62rem',
                textTransform: 'none',
                fontWeight: 600,
                minWidth: 0,
                py: 0.2,
                px: 1,
              }}
            >
              {t('argus.dashboards.eventStream.loadMore', 'Load More')}
            </Button>
          )}

          {/* Page nav */}
          {totalPages > 1 && (
            <>
              <IconButton
                size="small"
                disabled={page === 0}
                onClick={() => setPage((p) => p - 1)}
                sx={{ p: 0.2 }}
              >
                <PrevIcon sx={{ fontSize: 14 }} />
              </IconButton>
              <Typography
                sx={{
                  fontSize: '0.62rem',
                  fontWeight: 700,
                  minWidth: 16,
                  textAlign: 'center',
                }}
              >
                {page + 1}/{totalPages}
              </Typography>
              <IconButton
                size="small"
                disabled={page >= totalPages - 1}
                onClick={() => setPage((p) => p + 1)}
                sx={{ p: 0.2 }}
              >
                <NextIcon sx={{ fontSize: 14 }} />
              </IconButton>
            </>
          )}
        </Box>
      </Box>
    </Box>
  );
};

/** Format a ClickHouse or ISO timestamp to a readable short format */
function formatTimestamp(ts: string): string {
  if (!ts) return '';
  const d = new Date(ts.includes('T') ? ts : ts.replace(' ', 'T'));
  if (isNaN(d.getTime())) return ts;
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

export default EventStreamRenderer;

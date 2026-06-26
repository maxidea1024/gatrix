import React, { useCallback } from 'react';
import {
  Box,
  Typography,
  Button,
  CircularProgress,
  Paper,
  useTheme,
} from '@mui/material';
import {
  ArrowDownward as SortDescIcon,
  FiberManualRecord as DotIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import PageContentLoader from '@/components/common/PageContentLoader';
import { ArgusLogEntry } from '@/services/argusService';
import { formatDateTimeDetailed } from '@/utils/dateFormat';
import { ARGUS_SEMANTIC } from '../argusThemeTokens';

export type DisplayDensity = 'compact' | 'default' | 'expanded';

const DENSITY_PY: Record<DisplayDensity, number> = {
  compact: 0.15,
  default: 0.5,
  expanded: 1,
};

const SEVERITY_COLORS: Record<string, string> = {
  fatal: '#d32f2f',
  error: ARGUS_SEMANTIC.negative,
  warn: ARGUS_SEMANTIC.warning,
  warning: ARGUS_SEMANTIC.warning,
  info: ARGUS_SEMANTIC.info,
  debug: '#9e9e9e',
  trace: '#607d8b',
};

export interface LogsTablePanelProps {
  columns: string[];
  columnNames?: Record<string, string>;
  availableColumns: { key: string; label: string }[];
  logsFullscreen: boolean;
  wrapLines: boolean;
  isDark: boolean;

  // Data props
  logs: ArgusLogEntry[];
  loading: boolean;
  hasMore: boolean;
  selectedLogIndex: number | null;
  displayDensity: DisplayDensity;
  searchDebounce: string;
  logContainerRef?: React.RefObject<HTMLDivElement>;

  // Callback props
  onSelectLog: (index: number) => void;
  onLoadMore: () => void;
}

function highlightSearchTerms(text: string, query: string): React.ReactNode {
  if (!query || !text) return text;

  const tokens = query.match(/(?:[^\s"]+|"[^"]*")+/g) || [];
  const freeTextTerms = tokens
    .filter((t) => !/^[\w.-]+[:!=]/.test(t))
    .filter((t) => !['AND', 'OR', 'NOT'].includes(t.toUpperCase()))
    .map((t) => t.replace(/^"|"$/g, '').trim())
    .filter((t) => t.length > 0);

  if (freeTextTerms.length === 0) return text;

  const escaped = freeTextTerms.map((t) =>
    t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  );
  const regex = new RegExp(`(${escaped.join('|')})`, 'gi');

  const parts = text.split(regex);
  if (parts.length === 1) return text;

  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <mark
        key={i}
        style={{
          backgroundColor: 'rgba(255,213,79,0.4)',
          borderRadius: 2,
          padding: '0 1px',
        }}
      >
        {part}
      </mark>
    ) : (
      part
    )
  );
}

const LogsTablePanel: React.FC<LogsTablePanelProps> = ({
  columns,
  columnNames = {},
  availableColumns,
  logsFullscreen,
  wrapLines,
  isDark,

  logs,
  loading,
  hasMore,
  selectedLogIndex,
  displayDensity,
  searchDebounce,
  logContainerRef,

  onSelectLog,
  onLoadMore,
}) => {
  const theme = useTheme();
  const { t } = useTranslation();
  const navigate = useNavigate();

  // ─── Cell renderer ───
  const renderCell = useCallback(
    (log: ArgusLogEntry, col: string) => {
      switch (col) {
        case 'timestamp': {
          const formatted =
            formatDateTimeDetailed(log.timestamp) +
            '.' +
            String(new Date(log.timestamp + 'Z').getMilliseconds()).padStart(
              3,
              '0'
            );
          return (
            <Typography
              sx={{
                fontSize: '0.73rem',
                color: 'text.secondary',
                whiteSpace: 'nowrap',
              }}
            >
              {formatted}
            </Typography>
          );
        }
        case 'severity':
          return (
            <Typography
              sx={{
                fontSize: '0.72rem',
                fontWeight: 700,
                color: SEVERITY_COLORS[log.level?.toLowerCase()] || '#9e9e9e',
              }}
            >
              {log.level?.toUpperCase()}
            </Typography>
          );
        case 'message': {
          const highlighted = highlightSearchTerms(
            log.message || '',
            searchDebounce
          );
          return (
            <Typography
              component="div"
              sx={{
                fontSize: '0.73rem',
                ...(wrapLines
                  ? { whiteSpace: 'pre-wrap', wordBreak: 'break-all' }
                  : {
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }),
              }}
            >
              {highlighted}
            </Typography>
          );
        }
        case 'service':
          return (
            <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary' }}>
              {log.service || '—'}
            </Typography>
          );
        case 'environment':
          return (
            <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary' }}>
              {log.environment || '—'}
            </Typography>
          );
        case 'logger_name':
          return (
            <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary' }}>
              {log.logger_name || '—'}
            </Typography>
          );
        case 'trace_id':
          return (
            <Typography
              onClick={(e) => {
                if (log.trace_id) {
                  e.stopPropagation();
                  navigate(`/argus/performance?trace=${log.trace_id}`, {
                    state: { allowBack: true },
                  });
                }
              }}
              sx={{
                fontSize: '0.72rem',
                color: '#7c4dff',
                cursor: log.trace_id ? 'pointer' : 'default',
                '&:hover': log.trace_id ? { textDecoration: 'underline' } : {},
              }}
            >
              {log.trace_id ? log.trace_id.slice(0, 12) + '…' : '—'}
            </Typography>
          );
        case 'release':
          return (
            <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary' }}>
              {log.release || '—'}
            </Typography>
          );
        default: {
          const val =
            log[col as keyof ArgusLogEntry] ??
            (log.attributes ? log.attributes[col] : undefined);
          return (
            <Typography
              sx={{
                fontSize: '0.72rem',
                color: val !== undefined ? 'text.primary' : 'text.disabled',
              }}
            >
              {val !== undefined && val !== null ? String(val) : '—'}
            </Typography>
          );
        }
      }
    },
    [wrapLines, navigate, searchDebounce]
  );

  return (
    <Paper
      elevation={0}
      sx={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        backgroundColor: 'transparent',
      }}
    >
      {/* Column headers */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          px: 1.5,
          py: 0.8,
          flexShrink: 0,
          borderBottom: `2px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)'}`,
          backgroundColor: isDark
            ? 'rgba(255,255,255,0.02)'
            : 'rgba(0,0,0,0.015)',
        }}
      >
        <Box sx={{ width: 44 }} />
        {columns.map((col) => {
          const cfg = availableColumns.find((c) => c.key === col);
          const isMessage = col === 'message';
          return (
            <Box
              key={col}
              sx={{
                flex: isMessage ? 3 : col === 'timestamp' ? 1.3 : 0.8,
                minWidth: col === 'timestamp' ? 165 : isMessage ? 200 : 80,
                display: 'flex',
                alignItems: 'center',
                gap: 0.3,
              }}
            >
              <Typography
                sx={{
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  color: 'text.disabled',
                  textTransform: 'uppercase',
                  letterSpacing: '0.03em',
                }}
              >
                {columnNames[col] || cfg?.label || col.toUpperCase()}
              </Typography>
              {col === 'timestamp' && (
                <SortDescIcon sx={{ fontSize: 12, color: 'text.disabled' }} />
              )}
            </Box>
          );
        })}
      </Box>

      {/* Log rows */}
      <Box
        ref={logContainerRef}
        sx={{
          flex: 1,
          overflowY: 'auto',
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <PageContentLoader loading={loading && logs.length === 0}>
          {logs.length > 0 && (
            <>
              {logs.map((log, idx) => {
                const levelColor =
                  SEVERITY_COLORS[log.level?.toLowerCase()] || '#9e9e9e';
                const isSelected = selectedLogIndex === idx;

                return (
                  <Box key={log.log_id}>
                    <Box
                      data-log-row
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        px: 1.5,
                        py: DENSITY_PY[displayDensity],
                        cursor: 'pointer',
                        transition: 'background-color 0.1s',
                        borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)'}`,
                        backgroundColor: isSelected
                          ? isDark
                            ? 'rgba(33,150,243,0.08)'
                            : 'rgba(33,150,243,0.06)'
                          : 'transparent',
                        '&:hover': {
                          backgroundColor: isDark
                            ? 'rgba(255,255,255,0.015)'
                            : 'rgba(0,0,0,0.008)',
                        },
                        ...(isSelected && {
                          borderLeft: `2px solid ${theme.palette.primary.main}`,
                        }),
                      }}
                      onClick={() => onSelectLog(idx)}
                    >
                      <Box
                        sx={{
                          width: 44,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 0.5,
                          flexShrink: 0,
                        }}
                      >
                        <DotIcon sx={{ fontSize: 8, color: levelColor }} />
                      </Box>

                      {columns.map((col) => (
                        <Box
                          key={col}
                          sx={{
                            flex:
                              col === 'message'
                                ? 3
                                : col === 'timestamp'
                                  ? 1.3
                                  : 0.8,
                            minWidth:
                              col === 'timestamp'
                                ? 165
                                : col === 'message'
                                  ? 200
                                  : 80,
                            overflow: 'hidden',
                          }}
                        >
                          {renderCell(log, col)}
                        </Box>
                      ))}
                    </Box>
                  </Box>
                );
              })}

              {hasMore && (
                <Box
                  sx={{
                    py: 2,
                    textAlign: 'center',
                    borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}`,
                  }}
                >
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={onLoadMore}
                    disabled={loading}
                    startIcon={
                      loading ? (
                        <CircularProgress size={14} color="inherit" />
                      ) : undefined
                    }
                    sx={{
                      textTransform: 'none',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      minWidth: 160,
                      borderColor: isDark
                        ? 'rgba(255,255,255,0.12)'
                        : 'rgba(0,0,0,0.12)',
                    }}
                  >
                    {t('argus.logs.loadMore', 'Load More Logs')}
                  </Button>
                </Box>
              )}
            </>
          )}
        </PageContentLoader>
      </Box>
    </Paper>
  );
};

export default React.memo(LogsTablePanel);

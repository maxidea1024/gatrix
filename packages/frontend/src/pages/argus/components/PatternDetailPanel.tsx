/**
 * PatternDetailPanel — Resizable side drawer for pattern drilldown (⭐7 + ⭐8)
 * Shows pattern details, trend sparkline, stats, sample message,
 * and inline related issues list with show-more pagination.
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Chip,
  Divider,
  Link,
  CircularProgress,
  useTheme,
  alpha,
  Button,
} from '@mui/material';
import {
  FilterAlt as FilterIcon,
  NotificationsActive as AlertIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import ResizableDrawer from '@/components/common/ResizableDrawer';
import EmptyPlaceholder from '@/components/common/EmptyPlaceholder';
import IssueListItem from '@/components/argus/IssueListItem';
import argusService from '@/services/argusService';
import type { ArgusIssue } from '@/services/argusService';
import { formatRelativeTime } from '@/utils/dateFormat';
import { formatCompactNumber } from '@/utils/numberFormat';
import type { PatternEntry } from './LogsPatternsPanel';
import { ARGUS_SEMANTIC } from '../argusThemeTokens';

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

const PAGE_SIZE = 10;

/* ── Sparkline (larger version for detail panel) ── */
const DetailSparkline: React.FC<{
  data: number[];
  color: string;
}> = ({ data, color }) => {
  const width = 280;
  const height = 60;
  if (!data || data.length === 0) return null;
  const max = Math.max(...data, 1);
  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - (v / max) * (height - 6) - 3;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{ display: 'block', width: '100%', height: 'auto' }}
    >
      <defs>
        <linearGradient
          id={`grad-${color.replace('#', '')}`}
          x1="0"
          y1="0"
          x2="0"
          y2="1"
        >
          <stop offset="0%" stopColor={color} stopOpacity={0.3} />
          <stop offset="100%" stopColor={color} stopOpacity={0.02} />
        </linearGradient>
      </defs>
      <polygon
        points={`0,${height} ${points} ${width},${height}`}
        fill={`url(#grad-${color.replace('#', '')})`}
      />
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {data.map((v, i) => {
        const x = (i / (data.length - 1)) * width;
        const y = height - (v / max) * (height - 6) - 3;
        return (
          <circle key={i} cx={x} cy={y} r={2.5} fill={color} opacity={0.8} />
        );
      })}
    </svg>
  );
};

/* ── Stat Row ── */
const StatRow: React.FC<{
  label: string;
  value: React.ReactNode;
  isDark: boolean;
}> = ({ label, value, isDark }) => (
  <Box
    sx={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      py: 0.75,
      px: 2,
      '&:nth-of-type(odd)': {
        bgcolor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.015)',
      },
    }}
  >
    <Typography
      sx={{ fontSize: '0.78rem', color: 'text.secondary', fontWeight: 500 }}
    >
      {label}
    </Typography>
    <Typography
      component="div"
      sx={{
        fontSize: '0.78rem',
        fontWeight: 600,
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      {value}
    </Typography>
  </Box>
);

/* ── Section Label ── */
const SectionLabel: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => (
  <Typography
    sx={{
      fontSize: '0.65rem',
      color: 'text.disabled',
      fontWeight: 600,
      mb: 0.75,
      textTransform: 'uppercase',
      letterSpacing: '0.05em',
    }}
  >
    {children}
  </Typography>
);

export interface PatternDetailPanelProps {
  pattern: PatternEntry | null;
  open: boolean;
  onClose: () => void;
  onFilterPattern?: (pattern: PatternEntry) => void;
  onCreateAlert?: (pattern: PatternEntry) => void;
  projectId: number | string;
  isDark: boolean;
  /** Current time period for API calls */
  period?: string;
}

const PatternDetailPanel: React.FC<PatternDetailPanelProps> = ({
  pattern,
  open,
  onClose,
  onFilterPattern,
  onCreateAlert,
  projectId,
  isDark,
  period,
}) => {
  const theme = useTheme();
  const { t } = useTranslation();
  const navigate = useNavigate();

  // ── Attribute distribution state ──
  const [attrDistribution, setAttrDistribution] = useState<
    Record<string, { value: string; count: number }[]>
  >({});
  const [attrLoading, setAttrLoading] = useState(false);
  const [attrFetchedFor, setAttrFetchedFor] = useState<string | null>(null);

  // ── Related issues state (⭐8) ──
  const [issues, setIssues] = useState<ArgusIssue[]>([]);
  const [issuesLoading, setIssuesLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);

  // Extract search keyword from pattern
  const getKeyword = useCallback((p: PatternEntry | null): string => {
    if (!p) return '';
    return (
      p.sample_message
        ?.replace(/<[A-Z]+>/g, '')
        ?.split(/[\s:]+/)
        ?.find((w) => w.length > 3 && !/^\d+$/.test(w)) || ''
    );
  }, []);

  // Fetch issues on pattern change
  useEffect(() => {
    if (!open || !pattern || !projectId) {
      setIssues([]);
      setHasMore(false);
      return;
    }

    const keyword = getKeyword(pattern);
    if (!keyword) {
      setIssues([]);
      setHasMore(false);
      return;
    }

    let cancelled = false;
    const fetchIssues = async () => {
      setIssuesLoading(true);
      try {
        const result = await argusService.listIssues(projectId, {
          search: keyword,
          level: pattern.level || undefined,
          limit: PAGE_SIZE,
          offset: 0,
        });
        if (!cancelled) {
          setIssues(result.data || []);
          setHasMore((result.data || []).length === PAGE_SIZE);
        }
      } catch {
        if (!cancelled) setIssues([]);
      } finally {
        if (!cancelled) setIssuesLoading(false);
      }
    };

    fetchIssues();
    return () => {
      cancelled = true;
    };
  }, [open, pattern, projectId, getKeyword]);

  // Fetch attribute distribution when pattern changes
  useEffect(() => {
    if (!open || !pattern || !projectId) {
      setAttrDistribution({});
      setAttrFetchedFor(null);
      return;
    }
    const cacheKey = `${pattern.pattern}::${period || '14d'}`;
    if (attrFetchedFor === cacheKey) return;

    let cancelled = false;
    const fetchAttrs = async () => {
      setAttrLoading(true);
      setAttrFetchedFor(cacheKey);
      try {
        const data = await argusService.getPatternAttributes(projectId, {
          pattern: pattern.pattern,
          period: period || '14d',
          attributes: 'service,environment,level',
        });
        if (!cancelled) setAttrDistribution(data);
      } catch {
        if (!cancelled) setAttrDistribution({});
      } finally {
        if (!cancelled) setAttrLoading(false);
      }
    };
    fetchAttrs();
    return () => {
      cancelled = true;
    };
  }, [open, pattern, projectId, period, attrFetchedFor]);

  const handleLoadMore = useCallback(async () => {
    if (loadingMore || !pattern || !projectId) return;
    setLoadingMore(true);
    try {
      const keyword = getKeyword(pattern);
      const result = await argusService.listIssues(projectId, {
        search: keyword,
        level: pattern.level || undefined,
        limit: PAGE_SIZE,
        offset: issues.length,
      });
      const newData = result.data || [];
      setIssues((prev) => [...prev, ...newData]);
      if (newData.length < PAGE_SIZE) setHasMore(false);
    } catch {
      // silent
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, pattern, projectId, getKeyword, issues.length]);

  // Keep a ref to the last valid pattern so content is visible during close animation
  const lastPatternRef = React.useRef<PatternEntry | null>(null);
  if (pattern) lastPatternRef.current = pattern;
  const displayPattern = pattern ?? lastPatternRef.current;

  const levelColor = displayPattern
    ? getLevelColor(displayPattern.level)
    : '#9e9e9e';
  const prevCount =
    displayPattern?.prev_count != null
      ? Number(displayPattern.prev_count)
      : null;
  const delta =
    prevCount !== null && prevCount > 0 && displayPattern
      ? ((Number(displayPattern.count) - prevCount) / prevCount) * 100
      : null;
  const isNew =
    prevCount === 0 && displayPattern && Number(displayPattern.count) > 0;

  return (
    <ResizableDrawer
      open={open}
      onClose={onClose}
      title={t('argus.logs.patterns.detail', 'Pattern Detail')}
      subtitle={
        displayPattern?.level
          ? `${displayPattern.level.toUpperCase()} · ${displayPattern.service || '-'}`
          : undefined
      }
      storageKey="argus-pattern-detail-width"
      defaultWidth={480}
      minWidth={360}
      maxWidth={800}
    >
      <Box sx={{ flex: 1, overflow: 'auto' }}>
        {/* Pattern text */}
        <Box sx={{ px: 2, py: 2 }}>
          <SectionLabel>
            {t('argus.logs.patterns.pattern', 'Pattern')}
          </SectionLabel>
          <Box
            component="code"
            sx={{
              display: 'block',
              fontSize: '0.78rem',
              wordBreak: 'break-all',
              lineHeight: 1.6,
              color: 'text.secondary',
              bgcolor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
              p: 1.5,
              borderRadius: '8px',
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
            }}
          >
            {displayPattern?.pattern}
          </Box>
        </Box>

        <Divider />

        {/* Trend sparkline */}
        {displayPattern?.trend && (
          <Box sx={{ px: 2, py: 2 }}>
            <SectionLabel>
              {t('argus.logs.patterns.trendOverTime', 'Trend Over Time')}
            </SectionLabel>
            <DetailSparkline data={displayPattern.trend} color={levelColor} />
          </Box>
        )}

        <Divider />

        {/* Stats */}
        <Box sx={{ py: 1 }}>
          <StatRow
            label={t('argus.logs.patterns.totalCount', 'Total Count')}
            value={formatCompactNumber(Number(displayPattern?.count ?? 0))}
            isDark={isDark}
          />
          {prevCount !== null && (
            <StatRow
              label={t('argus.logs.patterns.prevCount', 'Previous Period')}
              value={formatCompactNumber(prevCount)}
              isDark={isDark}
            />
          )}
          {delta !== null && (
            <StatRow
              label={t('argus.logs.patterns.change', 'Change')}
              value={
                <Typography
                  component="span"
                  sx={{
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    color:
                      delta > 5
                        ? ARGUS_SEMANTIC.negative
                        : delta < -5
                          ? ARGUS_SEMANTIC.positive
                          : 'text.secondary',
                  }}
                >
                  {delta > 0 ? '+' : ''}
                  {delta.toFixed(1)}%
                </Typography>
              }
              isDark={isDark}
            />
          )}
          {isNew && (
            <StatRow
              label={t('argus.logs.patterns.status', 'Status')}
              value={
                <Chip
                  label="NEW"
                  size="small"
                  sx={{
                    height: 20,
                    fontSize: '0.65rem',
                    fontWeight: 700,
                    bgcolor: 'rgba(76,175,80,0.12)',
                    color: ARGUS_SEMANTIC.positive,
                  }}
                />
              }
              isDark={isDark}
            />
          )}
          <StatRow
            label={t('argus.logs.patterns.service', 'Service')}
            value={
              <Chip
                label={displayPattern?.service || '-'}
                size="small"
                variant="outlined"
                sx={{ height: 20, fontSize: '0.68rem' }}
              />
            }
            isDark={isDark}
          />
          <StatRow
            label={t('argus.logs.patterns.firstSeen', 'First Seen')}
            value={
              displayPattern?.first_seen
                ? formatRelativeTime(displayPattern.first_seen)
                : '-'
            }
            isDark={isDark}
          />
          <StatRow
            label={t('argus.logs.patterns.lastSeen', 'Last Seen')}
            value={
              displayPattern?.last_seen
                ? formatRelativeTime(displayPattern.last_seen)
                : '-'
            }
            isDark={isDark}
          />
        </Box>

        <Divider />

        {/* Sample message */}
        <Box sx={{ px: 2, py: 2 }}>
          <SectionLabel>
            {t('argus.logs.patterns.sampleMessage', 'Sample Message')}
          </SectionLabel>
          <Box
            component="code"
            sx={{
              display: 'block',
              fontSize: '0.75rem',
              wordBreak: 'break-all',
              lineHeight: 1.6,
              color: 'text.secondary',
              bgcolor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
              p: 1.5,
              borderRadius: '8px',
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
              maxHeight: 200,
              overflow: 'auto',
            }}
          >
            {displayPattern?.sample_message || '-'}
          </Box>
        </Box>

        <Divider />

        {/* Attribute Distribution */}
        <Box sx={{ px: 2, py: 2 }}>
          <SectionLabel>
            {t(
              'argus.logs.patterns.attrDistribution',
              'Attribute Distribution'
            )}
          </SectionLabel>
          {attrLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
              <CircularProgress size={18} />
            </Box>
          ) : Object.keys(attrDistribution).length === 0 ? (
            <Typography
              sx={{ fontSize: '0.72rem', color: 'text.disabled', py: 1 }}
            >
              {t(
                'argus.logs.patterns.noAttrData',
                'No attribute distribution data available'
              )}
            </Typography>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {Object.entries(attrDistribution).map(([attrKey, values]) => {
                if (!values || values.length === 0) return null;
                const maxCount = Math.max(...values.map((v) => v.count), 1);
                return (
                  <Box key={attrKey}>
                    <Typography
                      sx={{
                        fontSize: '0.7rem',
                        fontWeight: 600,
                        color: 'text.secondary',
                        mb: 0.5,
                        textTransform: 'capitalize',
                      }}
                    >
                      {attrKey}
                    </Typography>
                    {values.slice(0, 5).map((item) => (
                      <Box
                        key={item.value}
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1,
                          py: 0.3,
                        }}
                      >
                        <Typography
                          sx={{
                            fontSize: '0.68rem',
                            color: 'text.secondary',
                            minWidth: 80,
                            maxWidth: 100,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            flexShrink: 0,
                          }}
                        >
                          {item.value}
                        </Typography>
                        <Box
                          sx={{
                            flex: 1,
                            height: 12,
                            bgcolor: isDark
                              ? 'rgba(255,255,255,0.04)'
                              : 'rgba(0,0,0,0.04)',
                            borderRadius: '3px',
                            overflow: 'hidden',
                          }}
                        >
                          <Box
                            sx={{
                              minWidth: 0,
                              height: '100%',
                              width: `${(item.count / maxCount) * 100}%`,
                              bgcolor: levelColor,
                              borderRadius: '3px',
                              opacity: 0.7,
                              transition: 'width 0.3s ease',
                            }}
                          />
                        </Box>
                        <Typography
                          sx={{
                            fontSize: '0.65rem',
                            fontWeight: 600,
                            fontVariantNumeric: 'tabular-nums',
                            color: 'text.secondary',
                            minWidth: 36,
                            textAlign: 'right',
                            flexShrink: 0,
                          }}
                        >
                          {formatCompactNumber(item.count)}
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                );
              })}
            </Box>
          )}
        </Box>

        <Divider />

        {/* Related Issues (⭐8) — inline list with show-more */}
        <Box sx={{ px: 2, py: 2 }}>
          <SectionLabel>
            {t('argus.logs.patterns.relatedIssues', 'Related Issues')}
          </SectionLabel>
          {issuesLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
              <CircularProgress size={20} />
            </Box>
          ) : issues.length === 0 ? (
            <EmptyPlaceholder
              message={t(
                'argus.logs.patterns.noRelatedIssues',
                'No related issues found'
              )}
              minHeight={80}
            />
          ) : (
            <Box>
              {issues.map((issue, idx) => (
                <IssueListItem
                  key={issue.id}
                  issue={issue}
                  compact
                  showSparkline={false}
                  showLastSeen={false}
                  isFirst={idx === 0}
                  isLast={idx === issues.length - 1}
                  onClick={(iss) =>
                    navigate(`/argus/issues/${projectId}/${iss.id}`)
                  }
                />
              ))}
              {hasMore && (
                <Box sx={{ pt: 1, textAlign: 'center' }}>
                  <Link
                    component="button"
                    variant="caption"
                    onClick={handleLoadMore}
                    disabled={loadingMore}
                    sx={{
                      fontSize: '0.7rem',
                      cursor: 'pointer',
                      color: 'primary.main',
                      textDecoration: 'none',
                      fontWeight: 600,
                      opacity: loadingMore ? 0.5 : 1,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 0.5,
                      '&:hover': { textDecoration: 'underline' },
                    }}
                  >
                    {loadingMore && (
                      <CircularProgress size={10} color="inherit" />
                    )}
                    {t('common.showMore', '+{{count}} more', {
                      count: PAGE_SIZE,
                    })}
                  </Link>
                </Box>
              )}
            </Box>
          )}
        </Box>

        <Divider />

        {/* Action buttons */}
        <Box
          sx={{
            px: 2,
            py: 2,
            display: 'flex',
            flexDirection: 'column',
            gap: 1,
          }}
        >
          {onFilterPattern && (
            <Button
              variant="outlined"
              size="small"
              startIcon={<FilterIcon sx={{ fontSize: 15 }} />}
              onClick={() => displayPattern && onFilterPattern(displayPattern)}
              sx={{
                textTransform: 'none',
                fontSize: '0.75rem',
                fontWeight: 600,
                borderRadius: '8px',
                justifyContent: 'flex-start',
              }}
            >
              {t('argus.logs.patterns.filterLogs', 'Filter Logs by Pattern')}
            </Button>
          )}
          {onCreateAlert && (
            <Button
              variant="outlined"
              size="small"
              startIcon={<AlertIcon sx={{ fontSize: 15 }} />}
              onClick={() => displayPattern && onCreateAlert(displayPattern)}
              sx={{
                textTransform: 'none',
                fontSize: '0.75rem',
                fontWeight: 600,
                borderRadius: '8px',
                justifyContent: 'flex-start',
                color: ARGUS_SEMANTIC.warning,
                borderColor: alpha(ARGUS_SEMANTIC.warning, 0.3),
                '&:hover': {
                  borderColor: ARGUS_SEMANTIC.warning,
                  bgcolor: alpha(ARGUS_SEMANTIC.warning, 0.04),
                },
              }}
            >
              {t('argus.logs.patterns.createAlert', 'Create Alert for Pattern')}
            </Button>
          )}
        </Box>
      </Box>
    </ResizableDrawer>
  );
};

export default PatternDetailPanel;

import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Typography, Paper, Chip, useTheme, alpha } from '@mui/material';
import {
  Speed as SpeedIcon,
  Schedule as ScheduleIcon,
  Timeline as TimelineIcon,
  BugReport as BugReportIcon,
  Warning as WarningIcon,
  Lightbulb as LightbulbIcon,
  DevicesOther as DevicesIcon,
  Cloud as EnvIcon,
} from '@mui/icons-material';
import { Line, Bar } from 'react-chartjs-2';
import { useTranslation } from 'react-i18next';
import PageContentLoader from '@/components/common/PageContentLoader';
import EmptyPlaceholder from '@/components/common/EmptyPlaceholder';
import ArgusChartSkeleton from '@/components/argus/ArgusChartSkeleton';
import { ArgusTransactionDetail } from '@/services/argusService';
import { getCrosshairPlugin } from '../../../utils/chartPlugins';
import { formatCompactNumber } from '@/utils/numberFormat';
import {
  getOpIcon,
  getOpColor,
  formatTime,
  formatHour,
} from './performanceHelpers';
import {
  DetailPaper,
  StatCard,
  StatIconBox,
  InsightBox,
  IssueRow,
  LevelAccent,
  EventCountBadge,
  SpanProgressTrack,
} from './PerformanceDetailView.styles';

interface PerformanceDetailViewProps {
  detail: ArgusTransactionDetail | null;
  detailLoading: boolean;
  projectId: string | number;
  onTraceClick: (traceId: string) => void;
}

const PerformanceDetailView: React.FC<PerformanceDetailViewProps> = ({
  detail,
  detailLoading,
  projectId,
  onTraceClick,
}) => {
  const theme = useTheme();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const isDark = theme.palette.mode === 'dark';

  // ─── Chart Data ───
  const trendChartData = useMemo(() => {
    if (!detail?.trend) return { labels: [], datasets: [] };
    return {
      labels: detail.trend.map((d) => formatHour(d.hour)),
      datasets: [
        {
          label: 'P95',
          data: detail.trend.map((d) => Number(d.p95)),
          borderColor: '#ff9800',
          backgroundColor: alpha('#ff9800', 0.1),
          borderWidth: 2,
          tension: 0.4,
          fill: true,
          pointRadius: 0,
          pointHoverRadius: 4,
          yAxisID: 'y',
        },
        {
          label: t('argus.performance.throughput'),
          data: detail.trend.map((d) => d.count),
          borderColor: theme.palette.primary.main,
          backgroundColor: 'transparent',
          borderWidth: 1.5,
          tension: 0.4,
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
          backgroundColor: alpha(theme.palette.info.main, 0.6),
          borderColor: theme.palette.info.main,
          borderWidth: 0,
          borderRadius: 4,
        },
      ],
    };
  }, [detail, theme, t]);

  const chartOpts = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 300 },
      plugins: {
        legend: {
          display: true,
          position: 'top' as const,
          labels: { boxWidth: 8, font: { size: 11 } },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          border: { display: false },
          ticks: {
            maxRotation: 0,
            autoSkip: true,
            maxTicksLimit: 10,
            font: { size: 10 },
          },
        },
        y: {
          beginAtZero: true,
          grid: {
            color: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
          },
          border: { display: false },
          ticks: { font: { size: 10 } },
          title: { display: true, text: 'ms', font: { size: 10 } },
        },
        y1: {
          position: 'right' as const,
          beginAtZero: true,
          grid: { display: false },
          border: { display: false },
          ticks: { font: { size: 10 } },
          title: { display: true, text: 'req', font: { size: 10 } },
        },
      },
      interaction: {
        mode: 'nearest' as const,
        axis: 'x' as const,
        intersect: false,
      },
    }),
    [isDark]
  );

  const barOpts = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 300 },
      plugins: { legend: { display: false } },
      scales: {
        x: {
          grid: { display: false },
          border: { display: false },
          ticks: { font: { size: 10 } },
        },
        y: {
          beginAtZero: true,
          grid: {
            color: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
          },
          border: { display: false },
          ticks: { font: { size: 10 } },
        },
      },
    }),
    [isDark]
  );

  return (
    <PageContentLoader
      loading={detailLoading}
      skeleton={
        <>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
              gap: 2,
              mb: 2,
            }}
          >
            <Paper
              elevation={0}
              sx={{
                p: 2,
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: 2,
              }}
            >
              <ArgusChartSkeleton type="line" height={260} color="#ff9800" />
            </Paper>
            <Paper
              elevation={0}
              sx={{
                p: 2,
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: 2,
              }}
            >
              <ArgusChartSkeleton
                type="bar"
                height={220}
                color={theme.palette.info.main}
              />
            </Paper>
          </Box>
        </>
      }
    >
      {/* Summary Cards */}
      {detail?.summary && (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
            gap: 2,
            mb: 2,
          }}
        >
          {[
            {
              label: t('argus.performance.totalTransactions', 'Total'),
              value: formatCompactNumber(Number(detail.summary.count)),
              color: '#7c4dff',
              icon: <SpeedIcon />,
            },
            {
              label: t('argus.performance.avgP95', 'P95'),
              value: `${Number(detail.summary.p95).toFixed(0)}ms`,
              color:
                Number(detail.summary.p95) > 3000
                  ? '#f44336'
                  : Number(detail.summary.p95) > 1000
                    ? '#ff9800'
                    : '#4caf50',
              icon: <TimelineIcon />,
            },
            {
              label: t('argus.performance.avgDuration', 'Avg'),
              value: `${Number(detail.summary.avg_duration).toFixed(0)}ms`,
              color: '#2196f3',
              icon: <ScheduleIcon />,
            },
            {
              label: t('argus.performance.errorRate', 'Error Rate'),
              value: `${Number(detail.summary.error_rate).toFixed(2)}%`,
              color:
                Number(detail.summary.error_rate) > 5 ? '#f44336' : '#4caf50',
              icon: <BugReportIcon />,
            },
          ].map((card, idx) => (
            <StatCard
              key={idx}
              elevation={0}
              isDark={isDark}
              accentColor={card.color}
            >
              <StatIconBox isDark={isDark} accentColor={card.color}>
                {React.cloneElement(card.icon, { sx: { fontSize: 18 } })}
              </StatIconBox>
              <Box>
                <Typography
                  variant="h6"
                  fontWeight={800}
                  sx={{
                    lineHeight: 1.1,
                    fontSize: '1.1rem',
                    color: card.color,
                  }}
                >
                  {card.value}
                </Typography>
                <Typography
                  variant="caption"
                  sx={{
                    color: isDark ? '#888' : '#777',
                    fontWeight: 500,
                    fontSize: '0.65rem',
                  }}
                >
                  {card.label}
                </Typography>
              </Box>
            </StatCard>
          ))}
        </Box>
      )}

      {/* Charts */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
          gap: 2,
          mb: 2,
        }}
      >
        <DetailPaper elevation={0} isDark={isDark}>
          <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1.5 }}>
            {t('argus.performance.latencyTrend')}
          </Typography>
          <Box sx={{ height: 260 }}>
            {detailLoading ? (
              <ArgusChartSkeleton type="line" height={260} color="#ff9800" />
            ) : (
              <Line
                data={trendChartData}
                options={chartOpts}
                plugins={[getCrosshairPlugin(isDark)]}
              />
            )}
          </Box>
        </DetailPaper>
        <DetailPaper elevation={0} isDark={isDark}>
          <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1.5 }}>
            {t('argus.performance.durationDistribution')}
          </Typography>
          <Box sx={{ height: 220 }}>
            {detailLoading ? (
              <ArgusChartSkeleton
                type="bar"
                height={220}
                color={theme.palette.info.main}
              />
            ) : (
              <Bar data={histogramData} options={barOpts} />
            )}
          </Box>
        </DetailPaper>
      </Box>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {/* Insights & Suspect Tags */}
        <DetailPaper elevation={0} isDark={isDark}>
          <Typography
            variant="subtitle2"
            fontWeight={600}
            sx={{
              mb: 1.5,
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
            }}
          >
            <LightbulbIcon
              fontSize="small"
              sx={{ color: theme.palette.warning.main }}
            />
            {t('argus.performance.insights', 'Insights & Suspect Tags')}
          </Typography>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {/* Variance Insight */}
            {detail?.summary &&
              detail.summary.p95 > detail.summary.p50 * 3 &&
              detail.summary.p50 > 50 && (
                <InsightBox accentColor="#ff9800">
                  <Typography
                    variant="body2"
                    fontWeight={700}
                    sx={{
                      color: '#ff9800',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 0.5,
                      mb: 0.5,
                    }}
                  >
                    <WarningIcon sx={{ fontSize: 16 }} />
                    {t(
                      'argus.performance.highVariance',
                      'High Latency Variance Detected'
                    )}
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{
                      color: isDark ? '#ccc' : '#555',
                      display: 'block',
                      lineHeight: 1.4,
                    }}
                  >
                    {t(
                      'argus.performance.varianceDesc',
                      'P95 duration is significantly higher than the median (P50), indicating inconsistent performance.'
                    )}
                  </Typography>
                </InsightBox>
              )}

            {/* Suspect Tags */}
            {detail?.suspect_tags &&
              detail.suspect_tags.length > 0 &&
              (() => {
                const slowestTag = [...detail.suspect_tags].sort(
                  (a, b) => b.p95 - a.p95
                )[0];
                if (
                  detail.summary &&
                  slowestTag.p95 > detail.summary.p95 * 1.5
                ) {
                  return (
                    <InsightBox accentColor="#2196f3">
                      <Typography
                        variant="body2"
                        fontWeight={700}
                        sx={{
                          color: '#2196f3',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 0.5,
                          mb: 0.5,
                        }}
                      >
                        {slowestTag.tag_key === 'browser' ? (
                          <DevicesIcon sx={{ fontSize: 16 }} />
                        ) : (
                          <EnvIcon sx={{ fontSize: 16 }} />
                        )}
                        {t(
                          'argus.performance.slowestTag',
                          'Slowest Environment/Tag'
                        )}
                      </Typography>
                      <Typography
                        variant="caption"
                        sx={{
                          color: isDark ? '#ccc' : '#555',
                          display: 'block',
                          lineHeight: 1.4,
                        }}
                      >
                        {t(
                          'argus.performance.slowestTagDesc',
                          `This transaction is unusually slow on {{tag_value}} ({{tag_key}}).`,
                          {
                            tag_value: slowestTag.tag_value,
                            tag_key: slowestTag.tag_key,
                          }
                        )}
                        <strong style={{ marginLeft: 4 }}>
                          P95: {Number(slowestTag.p95).toFixed(0)}ms
                        </strong>
                      </Typography>
                    </InsightBox>
                  );
                }
                return null;
              })()}

            {(!detail?.summary ||
              (!(
                detail.summary.p95 > detail.summary.p50 * 3 &&
                detail.summary.p50 > 50
              ) &&
                !detail?.suspect_tags?.some(
                  (tag) => detail.summary && tag.p95 > detail.summary.p95 * 1.5
                ))) && (
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ py: 1, textAlign: 'center' }}
              >
                {t(
                  'argus.performance.noInsights',
                  'No significant anomalies detected.'
                )}
              </Typography>
            )}
          </Box>
        </DetailPaper>

        {/* Related Issues */}
        <DetailPaper
          elevation={0}
          isDark={isDark}
          sx={{ display: 'flex', flexDirection: 'column' }}
        >
          <Typography
            variant="subtitle2"
            fontWeight={600}
            sx={{
              mb: 1.5,
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
            }}
          >
            <BugReportIcon
              fontSize="small"
              sx={{ color: theme.palette.error.main }}
            />
            {t('argus.performance.relatedIssues', 'Related Issues')}
          </Typography>
          {!detail?.related_issues?.length ? (
            <EmptyPlaceholder
              icon={<BugReportIcon sx={{ fontSize: 36 }} />}
              message={t(
                'argus.performance.noIssues',
                'No related issues found.'
              )}
              minHeight={150}
            />
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
              {detail.related_issues.map((issue, idx) => {
                const levelColor =
                  issue.level === 'fatal'
                    ? '#f44336'
                    : issue.level === 'error'
                      ? '#ff5722'
                      : issue.level === 'warning'
                        ? '#ff9800'
                        : '#2196f3';
                return (
                  <IssueRow
                    key={idx}
                    accentColor={levelColor}
                    onClick={() =>
                      navigate(`/argus/issues/${projectId}/${issue.issue_id}`)
                    }
                  >
                    <LevelAccent accentColor={levelColor} />
                    <Box sx={{ flex: 1, overflow: 'hidden', minWidth: 0 }}>
                      <Typography
                        variant="body2"
                        fontWeight={600}
                        noWrap
                        sx={{ lineHeight: 1.3 }}
                      >
                        {issue.title || `Issue ${issue.issue_id}`}
                      </Typography>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        noWrap
                        sx={{ fontSize: '0.7rem' }}
                      >
                        {issue.subtitle || ''}
                      </Typography>
                    </Box>
                    <EventCountBadge isDark={isDark} accentColor={levelColor}>
                      <Typography
                        variant="caption"
                        fontWeight={700}
                        sx={{ color: levelColor, fontSize: '0.72rem' }}
                      >
                        {issue.event_count?.toLocaleString()}
                      </Typography>
                    </EventCountBadge>
                  </IssueRow>
                );
              })}
            </Box>
          )}
        </DetailPaper>

        {/* Slowest Spans & Recent Traces */}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
            gap: 2,
          }}
        >
          {/* Slowest Spans */}
          <DetailPaper elevation={0} isDark={isDark} sx={{ flex: 1 }}>
            <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1.5 }}>
              {t('argus.performance.slowestSpans')}
            </Typography>
            {detail?.spans?.length === 0 ? (
              <EmptyPlaceholder
                message={t('argus.performance.noSpans')}
                minHeight={100}
              />
            ) : (
              <Box sx={{ maxHeight: 280, overflow: 'auto' }}>
                {detail?.spans?.slice(0, 10).map((span, idx) => {
                  const opColor = getOpColor(span.op);
                  const maxDur = Math.max(
                    ...(detail?.spans?.map((s) => Number(s.avg_duration)) || [
                      1,
                    ])
                  );
                  const pct = (Number(span.avg_duration) / maxDur) * 100;
                  return (
                    <Box key={idx} sx={{ mb: 1 }}>
                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1,
                          mb: 0.3,
                        }}
                      >
                        <Box sx={{ color: opColor, display: 'flex' }}>
                          {getOpIcon(span.op)}
                        </Box>
                        <Typography
                          variant="caption"
                          noWrap
                          sx={{ flex: 1, fontSize: '0.75rem' }}
                        >
                          {span.description || span.op}
                        </Typography>
                        <Typography
                          variant="caption"
                          fontWeight={700}
                          sx={{ color: opColor, flexShrink: 0 }}
                        >
                          {Number(span.avg_duration).toFixed(0)}ms
                        </Typography>
                        <Typography
                          variant="caption"
                          sx={{
                            color: isDark ? '#555' : '#bbb',
                            flexShrink: 0,
                          }}
                        >
                          ×{span.count}
                        </Typography>
                      </Box>
                      <SpanProgressTrack isDark={isDark}>
                        <Box
                          sx={{
                            height: '100%',
                            borderRadius: 2,
                            width: `${pct}%`,
                            backgroundColor: opColor,
                            transition: 'width 0.3s',
                          }}
                        />
                      </SpanProgressTrack>
                    </Box>
                  );
                })}
              </Box>
            )}
          </DetailPaper>

          {/* Recent Traces */}
          <DetailPaper elevation={0} isDark={isDark} sx={{ flex: 1 }}>
            <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1.5 }}>
              {t('argus.performance.recentTraces')}
            </Typography>
            {!detail?.recent_traces?.length ? (
              <EmptyPlaceholder
                message={t('argus.performance.noTraces')}
                minHeight={100}
              />
            ) : (
              <Box sx={{ maxHeight: 280, overflow: 'auto' }}>
                {detail.recent_traces.map((tr, idx) => {
                  const isErr = tr.transaction_status !== 'ok';
                  return (
                    <Box
                      key={`${tr.event_id || tr.trace_id}-${idx}`}
                      onClick={() => onTraceClick(tr.trace_id)}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1.5,
                        p: 1,
                        borderRadius: 1.5,
                        cursor: 'pointer',
                        transition: 'background 0.15s',
                        borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)'}`,
                        '&:hover': {
                          backgroundColor: isDark
                            ? 'rgba(255,255,255,0.03)'
                            : 'rgba(0,0,0,0.02)',
                        },
                      }}
                    >
                      <Box
                        sx={{
                          width: 3,
                          height: 28,
                          borderRadius: 1,
                          backgroundColor: isErr ? '#f44336' : '#4caf50',
                          flexShrink: 0,
                        }}
                      />
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography
                          variant="caption"
                          sx={{
                            fontSize: '0.72rem',
                            color: isDark ? '#888' : '#666',
                          }}
                        >
                          {tr.trace_id.slice(0, 16)}...
                        </Typography>
                        <Box
                          sx={{
                            display: 'flex',
                            gap: 1,
                            alignItems: 'center',
                          }}
                        >
                          <Typography variant="caption" fontWeight={600}>
                            {Number(tr.duration).toLocaleString()}ms
                          </Typography>
                          <Chip
                            label={`${tr.span_count} spans`}
                            size="small"
                            sx={{
                              height: 16,
                              fontSize: '0.6rem',
                              backgroundColor: alpha(
                                theme.palette.primary.main,
                                0.1
                              ),
                            }}
                          />
                          {isErr && (
                            <Chip
                              label={tr.http_status_code || 'error'}
                              size="small"
                              color="error"
                              sx={{ height: 16, fontSize: '0.6rem' }}
                            />
                          )}
                        </Box>
                      </Box>
                      <Typography
                        variant="caption"
                        sx={{
                          color: isDark ? '#555' : '#bbb',
                          fontSize: '0.68rem',
                          flexShrink: 0,
                        }}
                      >
                        {formatTime(tr.timestamp)}
                      </Typography>
                    </Box>
                  );
                })}
              </Box>
            )}
          </DetailPaper>
        </Box>
      </Box>
    </PageContentLoader>
  );
};

export default React.memo(PerformanceDetailView);

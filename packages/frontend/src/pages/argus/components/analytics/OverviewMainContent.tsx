import React, { useMemo, useCallback } from 'react';
import { Box, Typography, Tooltip, useTheme, alpha } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { formatCompactNumber } from '@/utils/numberFormat';
import EventLabel from '@/components/argus/EventLabel';
import ArgusVolumeChart from '@/components/argus/ArgusVolumeChart';
import ArgusChartSkeleton from '@/components/argus/ArgusChartSkeleton';
import PageContentLoader from '@/components/common/PageContentLoader';
import type { ChartDataset } from '@/components/argus/InteractiveTimeSeriesChart';
import type { DateRangeValue } from '@/components/common/DateRangeSelector';
import type { AnalyticsEventNameEntry } from '@/services/argusService';
import { SectionHeader } from '../../ArgusAnalyticsPage.styles';
import type { SummaryData } from './OverviewLeftPanel';

interface OverviewMainContentProps {
  summary: SummaryData | null;
  eventNames: AnalyticsEventNameEntry[];
  loading: boolean;
  dateRangeLabel: string;
  setDateRange: (v: DateRangeValue) => void;
}

const DONUT_COLORS = [
  '#6366f1',
  '#f59e0b',
  '#10b981',
  '#ec4899',
  '#3b82f6',
  '#8b5cf6',
  '#14b8a6',
  '#f97316',
  '#ef4444',
  '#06b6d4',
];

const DOW_KEYS = [
  'argus.analytics.dow.mon',
  'argus.analytics.dow.tue',
  'argus.analytics.dow.wed',
  'argus.analytics.dow.thu',
  'argus.analytics.dow.fri',
  'argus.analytics.dow.sat',
  'argus.analytics.dow.sun',
];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

export const OverviewMainContent: React.FC<OverviewMainContentProps> = ({
  summary,
  eventNames,
  loading,
  dateRangeLabel,
  setDateRange,
}) => {
  const theme = useTheme();
  const { t } = useTranslation();
  const isDark = theme.palette.mode === 'dark';

  const totalEvents = useMemo(
    () => eventNames.reduce((sum, e) => sum + Number(e.count), 0),
    [eventNames]
  );

  const trendLabels = useMemo(() => {
    if (!summary) return [];
    return summary.daily_trend.map((d) => String(d.date).substring(5));
  }, [summary]);

  const trendDatasets: ChartDataset[] = useMemo(() => {
    if (!summary) return [];
    return [
      {
        label: t('argus.analytics.events', 'Events'),
        data: summary.daily_trend.map((d) => d.events),
        color: '#6366f1',
        type: 'area' as const,
      },
      {
        label: t('argus.analytics.users', 'Users'),
        data: summary.daily_trend.map((d) => d.users),
        color: '#10b981',
        type: 'area' as const,
      },
    ];
  }, [summary, t]);

  const handleTrendZoom = useCallback(
    (startIndex: number, endIndex: number) => {
      if (!summary || summary.daily_trend.length === 0) return;
      const trend = summary.daily_trend;
      const startDate = trend[Math.max(0, startIndex)]?.date;
      const endDate = trend[Math.min(trend.length - 1, endIndex)]?.date;
      if (startDate && endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        setDateRange({
          type: 'custom',
          start,
          end,
        });
      }
    },
    [summary, setDateRange]
  );

  const heatmapGrid = useMemo(() => {
    if (!summary || summary.hourly_heatmap.length === 0) return null;
    const grid: number[][] = Array.from({ length: 7 }, () =>
      new Array(24).fill(0)
    );
    let maxCount = 0;
    for (const { dow, hour, count } of summary.hourly_heatmap) {
      const rowIdx = dow - 1;
      if (rowIdx >= 0 && rowIdx < 7 && hour >= 0 && hour < 24) {
        grid[rowIdx][hour] = count;
        if (count > maxCount) maxCount = count;
      }
    }
    return { grid, maxCount };
  }, [summary]);

  return (
    <PageContentLoader
      loading={loading}
      skeleton={
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <ArgusChartSkeleton height={200} color="#6366f1" />
          <ArgusChartSkeleton height={140} color="#6366f1" />
        </Box>
      }
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {/* Daily Trend */}
        <ArgusVolumeChart
          title={t('argus.analytics.dailyTrend', 'Daily Trend')}
          labels={trendLabels}
          datasets={trendDatasets}
          loading={loading}
          onZoom={handleTrendZoom}
          storagePrefix="argus_analytics_trend"
          showLegend
          showCompactToggle={false}
          mb={0}
        />

        {/* Peak Hours Heatmap */}
        {heatmapGrid && (
          <Box
            sx={{
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
              borderRadius: 2,
              p: 2,
              background: isDark ? 'rgba(255,255,255,0.02)' : '#fff',
            }}
          >
            <Typography
              variant="subtitle2"
              color="text.secondary"
              sx={{
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: 0.5,
                fontSize: '0.65rem',
                mb: 1.5,
              }}
            >
              {t('argus.analytics.peakHours', 'Peak Hours')}
            </Typography>
            <Box sx={{ display: 'flex', gap: 0.5 }}>
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'flex-end',
                  gap: 0,
                  width: 28,
                  flexShrink: 0,
                }}
              >
                <Box sx={{ height: 16 }} />
                {DOW_KEYS.map((key) => (
                  <Typography
                    key={key}
                    sx={{
                      fontSize: '0.6rem',
                      color: 'text.secondary',
                      textAlign: 'right',
                      height: 16,
                      lineHeight: '16px',
                    }}
                  >
                    {t(key)}
                  </Typography>
                ))}
              </Box>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(24, 1fr)',
                    gap: '2px',
                    mb: '2px',
                  }}
                >
                  {HOURS.map((h) => (
                    <Box key={h} sx={{ textAlign: 'center', height: 14 }}>
                      <Typography
                        sx={{
                          fontSize: '0.55rem',
                          color: 'text.secondary',
                          lineHeight: '14px',
                        }}
                      >
                        {h % 3 === 0 ? h : ''}
                      </Typography>
                    </Box>
                  ))}
                </Box>
                {heatmapGrid.grid.map((row, rowIdx) => (
                  <Box
                    key={rowIdx}
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(24, 1fr)',
                      gap: '2px',
                      mb: '2px',
                    }}
                  >
                    {row.map((count, colIdx) => {
                      const intensity =
                        heatmapGrid.maxCount > 0
                          ? count / heatmapGrid.maxCount
                          : 0;
                      const cellColor =
                        intensity === 0
                          ? isDark
                            ? 'rgba(255,255,255,0.03)'
                            : 'rgba(0,0,0,0.03)'
                          : alpha(
                              '#6366f1',
                              0.1 + intensity * (isDark ? 0.7 : 0.6)
                            );
                      return (
                        <Tooltip
                          key={colIdx}
                          title={
                            <Box sx={{ textAlign: 'center' }}>
                              <Typography
                                sx={{ fontSize: '0.75rem', fontWeight: 600 }}
                              >
                                {t(DOW_KEYS[rowIdx])}{' '}
                                {String(colIdx).padStart(2, '0')}:00
                              </Typography>
                              <Typography
                                sx={{ fontSize: '0.85rem', fontWeight: 700 }}
                              >
                                {formatCompactNumber(count)}{' '}
                                {t('argus.analytics.events', 'events')}
                              </Typography>
                            </Box>
                          }
                          arrow
                          placement="top"
                          slotProps={{
                            tooltip: {
                              sx: {
                                bgcolor: isDark
                                  ? 'rgba(30,30,40,0.95)'
                                  : 'rgba(255,255,255,0.95)',
                                color: isDark ? '#e2e8f0' : '#1e293b',
                                border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
                                borderRadius: '8px',
                                px: 1.5,
                                py: 0.75,
                                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                              },
                            },
                            arrow: {
                              sx: {
                                color: isDark
                                  ? 'rgba(30,30,40,0.95)'
                                  : 'rgba(255,255,255,0.95)',
                              },
                            },
                          }}
                        >
                          <Box
                            sx={{
                              minWidth: 0,
                              height: 14,
                              borderRadius: '2px',
                              backgroundColor: cellColor,
                              transition: 'box-shadow 0.15s',
                              cursor: 'default',
                              '&:hover': {
                                boxShadow: `inset 0 0 0 1.5px ${isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.5)'}`,
                              },
                            }}
                          />
                        </Tooltip>
                      );
                    })}
                  </Box>
                ))}
              </Box>
            </Box>
            {/* Color scale legend */}
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                gap: 0.5,
                mt: 1,
              }}
            >
              <Typography
                sx={{
                  fontSize: '0.6rem',
                  color: 'text.secondary',
                  fontFamily: 'monospace',
                }}
              >
                0
              </Typography>
              {[0, 0.2, 0.4, 0.6, 0.8, 1].map((level) => (
                <Box
                  key={level}
                  sx={{
                    width: 12,
                    height: 12,
                    borderRadius: '2px',
                    backgroundColor:
                      level === 0
                        ? isDark
                          ? 'rgba(255,255,255,0.03)'
                          : 'rgba(0,0,0,0.03)'
                        : alpha('#6366f1', 0.1 + level * (isDark ? 0.7 : 0.6)),
                  }}
                />
              ))}
              <Typography
                sx={{
                  fontSize: '0.6rem',
                  color: 'text.secondary',
                  fontFamily: 'monospace',
                }}
              >
                {formatCompactNumber(heatmapGrid.maxCount)}
              </Typography>
            </Box>
          </Box>
        )}

        {/* Top Events */}
        <Box>
          <SectionHeader>
            <Typography
              variant="subtitle2"
              color="text.secondary"
              sx={{
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: 0.5,
                fontSize: '0.65rem',
              }}
            >
              {t('argus.analytics.topEvents', 'Top Events')} ({dateRangeLabel})
            </Typography>
          </SectionHeader>
          <Box
            sx={{
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
              borderRadius: 2,
              overflow: 'hidden',
              background: isDark ? 'rgba(255,255,255,0.02)' : '#fff',
            }}
          >
            {eventNames.length === 0 ? (
              <Box sx={{ px: 2, py: 3, textAlign: 'center' }}>
                <Typography variant="body2" color="text.secondary">
                  {t('argus.analytics.noEvents', 'No events found')}
                </Typography>
              </Box>
            ) : (
              eventNames.slice(0, 10).map((ev, i) => {
                const pctValue =
                  totalEvents > 0 ? (ev.count / totalEvents) * 100 : 0;
                const pctLabel =
                  pctValue === 0
                    ? '0%'
                    : pctValue < 1
                      ? '<1%'
                      : `${Math.round(pctValue)}%`;
                const barColor =
                  ev.icon_color || DONUT_COLORS[i % DONUT_COLORS.length];
                return (
                  <Box
                    key={ev.name}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1.5,
                      px: 1.5,
                      py: 0.6,
                      borderBottom:
                        i < Math.min(eventNames.length, 10) - 1
                          ? `1px solid ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}`
                          : 'none',
                      position: 'relative',
                      overflow: 'hidden',
                      '&:hover': {
                        background: isDark
                          ? 'rgba(255,255,255,0.02)'
                          : 'rgba(0,0,0,0.01)',
                      },
                    }}
                  >
                    <Box
                      sx={{
                        position: 'absolute',
                        left: 0,
                        top: 0,
                        bottom: 0,
                        width: `${pctValue}%`,
                        background: alpha(barColor, isDark ? 0.15 : 0.1),
                        transition: 'width 0.3s ease',
                      }}
                    />
                    <Box
                      sx={{
                        flex: 1,
                        position: 'relative',
                        zIndex: 1,
                        minWidth: 0,
                      }}
                    >
                      <EventLabel
                        eventName={ev.name}
                        displayName={ev.display_name}
                        icon={ev.icon}
                        iconColor={ev.icon_color}
                        description={ev.description}
                        isReserved={ev.is_reserved}
                        size="default"
                      />
                    </Box>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{
                        fontWeight: 600,
                        position: 'relative',
                        zIndex: 1,
                        minWidth: 50,
                        textAlign: 'right',
                        fontSize: '0.75rem',
                      }}
                    >
                      {formatCompactNumber(ev.count)}
                    </Typography>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{
                        position: 'relative',
                        zIndex: 1,
                        minWidth: 32,
                        textAlign: 'right',
                        opacity: 0.6,
                        fontSize: '0.7rem',
                      }}
                    >
                      {pctLabel}
                    </Typography>
                  </Box>
                );
              })
            )}
          </Box>
        </Box>
      </Box>
    </PageContentLoader>
  );
};

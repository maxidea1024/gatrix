import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Box, Typography, Button, CircularProgress, useTheme, alpha } from '@mui/material';
import { useTranslation } from 'react-i18next';
import argusService, { ArgusIssueTagGroup } from '@/services/argusService';
import InteractiveTimeSeriesChart from './InteractiveTimeSeriesChart';
import SafeTooltip from '@/components/common/SafeTooltip';

interface EventDistributionChartProps {
  projectId: string | number;
  issueId: string | number;
  isDark: boolean;
  compact?: boolean;
}

function formatCount(n: number): string {
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return n.toLocaleString();
}

const BROWSER_COLORS = ['#7c4dff', '#536dfe', '#448aff', '#40c4ff', '#64ffda'];

const EventDistributionChart: React.FC<EventDistributionChartProps> = ({ projectId, issueId, isDark }) => {
  const { t } = useTranslation();
  const theme = useTheme();

  const [loading, setLoading] = useState<boolean>(true);
  const [statsData, setStatsData] = useState<{ timestamp: string; event_count: number; user_count: number }[]>([]);
  const [browserTag, setBrowserTag] = useState<ArgusIssueTagGroup | null>(null);
  const [period, setPeriod] = useState<string>('14d');

  const fetchData = useCallback(async () => {
    if (!projectId || !issueId) return;
    setLoading(true);
    try {
      const [stats, tags] = await Promise.all([
        argusService.getIssueStats(projectId, issueId, period),
        argusService.getIssueTags(projectId, issueId).catch(() => []),
      ]);
      setStatsData(stats);
      setBrowserTag(tags.find((tg: ArgusIssueTagGroup) => tg.key === 'browser_name' || tg.key === 'browser') || null);
    } catch (error) {
      console.error('Failed to fetch event distribution data:', error);
    } finally {
      setLoading(false);
    }
  }, [projectId, issueId, period]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const { totalEvents, totalUsers } = useMemo(() => {
    return statsData.reduce(
      (acc, curr) => {
        acc.totalEvents += Number(curr.event_count) || 0;
        acc.totalUsers += Number(curr.user_count) || 0;
        return acc;
      },
      { totalEvents: 0, totalUsers: 0 }
    );
  }, [statsData]);

  const chartData = useMemo(() => {
    return statsData.map(d => {
      const date = new Date(d.timestamp);
      return {
        label: `${date.getMonth() + 1}/${date.getDate()}`,
        count: Number(d.event_count) || 0,
      };
    });
  }, [statsData]);

  // Browser tag computations
  const browserData = useMemo(() => {
    if (!browserTag || browserTag.topValues.length === 0) return null;
    const totalCount = browserTag.topValues.reduce((acc, v) => acc + (Number(v.count) || 0), 0);
    if (totalCount === 0) return null;

    const top2 = browserTag.topValues.slice(0, 2).map((tv, idx) => {
      const count = Number(tv.count) || 0;
      const pct = Math.round((count / totalCount) * 100);
      return { name: tv.value || 'Unknown', pct, color: BROWSER_COLORS[idx] || BROWSER_COLORS[0] };
    });

    let rest = null;
    let restList: { name: string; pct: number }[] = [];
    if (browserTag.topValues.length > 2) {
      const restItems = browserTag.topValues.slice(2);
      const restCount = restItems.reduce((a, b) => a + (Number(b.count) || 0), 0);
      const restPct = Math.round((restCount / totalCount) * 100);
      rest = { count: restItems.length, pct: restPct };
      restList = restItems.map(item => ({
        name: String(item.value) || 'Unknown',
        pct: Math.round(((Number(item.count) || 0) / totalCount) * 100)
      }));
    }
    return { top2, rest, restList };
  }, [browserTag]);

  if (loading && statsData.length === 0) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 72, mb: 2 }}>
        <CircularProgress size={20} />
      </Box>
    );
  }

  if (statsData.length === 0) return null;

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
        borderRadius: 1.5,
        px: 2,
        py: 1,
        mb: 2,
        backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.015)',
        minHeight: 72,
        overflow: 'hidden',
        opacity: loading ? 0.6 : 1,
        pointerEvents: loading ? 'none' : 'auto',
        transition: 'opacity 0.2s ease',
      }}
    >
      {/* ── 1. Stats (left) ── */}
      <Box sx={{ display: 'flex', flexDirection: 'column', flexShrink: 0, gap: 0.5 }}>
        <Box sx={{
          display: 'flex', alignItems: 'baseline',
          backgroundColor: isDark ? alpha('#7c4dff', 0.15) : alpha('#7c4dff', 0.08),
          px: 1, py: 0.25, borderRadius: 0.5,
        }}>
          <Typography sx={{ minWidth: 36, textAlign: 'right', fontWeight: 700, fontSize: '0.95rem', color: isDark ? '#bb86fc' : '#6200ea', lineHeight: 1.2 }}>
            {formatCount(totalEvents)}
          </Typography>
          <Typography sx={{ ml: 0.75, fontSize: '0.65rem', color: isDark ? '#bb86fc' : '#6200ea', fontWeight: 600, lineHeight: 1 }}>
            {t('argus.common.events', 'events')}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'baseline', px: 1 }}>
          <Typography sx={{ minWidth: 36, textAlign: 'right', fontWeight: 600, fontSize: '0.85rem', color: 'text.primary', lineHeight: 1.2 }}>
            {formatCount(totalUsers)}
          </Typography>
          <Typography sx={{ ml: 0.75, fontSize: '0.65rem', color: 'text.secondary', lineHeight: 1 }}>
            {t('argus.common.users', 'users')}
          </Typography>
        </Box>
        {/* Period Selector */}
        <Box sx={{ display: 'flex', gap: '2px', mt: 0.25, px: 0.5 }}>
          {['24h', '7d', '14d', '30d'].map((p) => (
            <Box
              key={p}
              onClick={() => setPeriod(p)}
              sx={{
                px: 0.8, py: 0.15,
                fontSize: '0.58rem',
                fontWeight: period === p ? 700 : 500,
                color: period === p ? (isDark ? '#bb86fc' : '#6200ea') : 'text.disabled',
                backgroundColor: period === p ? alpha(isDark ? '#bb86fc' : '#6200ea', 0.1) : 'transparent',
                borderRadius: 0.5,
                cursor: 'pointer',
                '&:hover': { backgroundColor: alpha(isDark ? '#bb86fc' : '#6200ea', 0.06) },
              }}
            >
              {p}
            </Box>
          ))}
        </Box>
      </Box>

      {/* ── 2. Chart (center, flex) ── */}
      <Box sx={{ flex: 1, minWidth: 120, height: 44, position: 'relative' }}>
        <InteractiveTimeSeriesChart
          data={chartData}
          type="bar"
          height={44}
          showLegend={false}
        />
      </Box>

      {/* ── 3. Browser breakdown (right) ── */}
      {browserData && (
        <Box sx={{
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: 0.25,
          borderLeft: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
          pl: 2,
          minWidth: 160,
        }}>
          <Typography sx={{ fontSize: '0.65rem', fontWeight: 700, color: 'text.secondary', textTransform: 'lowercase', letterSpacing: 0.3, mb: 0.25 }}>
            {t('argus.common.browser', 'browser')}
          </Typography>
          {browserData.top2.map((b, idx) => (
            <Box key={idx} sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
              <Typography sx={{
                fontSize: '0.7rem', color: 'text.primary', fontWeight: 500,
                flex: 1, minWidth: 60, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {b.name}
              </Typography>
              <Typography sx={{ fontSize: '0.65rem', color: 'text.secondary', minWidth: 24, textAlign: 'right' }}>
                {b.pct}%
              </Typography>
              <Box sx={{
                width: 40, height: 3,
                backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
                borderRadius: 1, overflow: 'hidden',
              }}>
                <Box sx={{ width: `${b.pct}%`, height: '100%', backgroundColor: b.color, borderRadius: 1 }} />
              </Box>
            </Box>
          ))}
          {browserData.rest && (
            <SafeTooltip
              title={
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                  {browserData.restList.map((item, i) => (
                    <Box key={i} sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
                      <Typography variant="caption">{item.name}</Typography>
                      <Typography variant="caption" sx={{ opacity: 0.7 }}>{item.pct}%</Typography>
                    </Box>
                  ))}
                </Box>
              }
              placement="top"
              arrow
            >
              <Box 
                onClick={() => {
                  const el = document.getElementById('argus-tag-distribution');
                  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }}
                sx={{ 
                  display: 'flex', alignItems: 'center', gap: 0.75, cursor: 'pointer',
                  '&:hover Typography': { color: isDark ? '#bb86fc' : '#6200ea' },
                  '&:hover .bar-bg': { backgroundColor: alpha(isDark ? '#bb86fc' : '#6200ea', 0.2) }
                }}
              >
                <Typography sx={{ fontSize: '0.65rem', color: 'text.disabled', flex: 1, minWidth: 60, whiteSpace: 'nowrap', transition: 'color 0.2s' }}>
                  +{browserData.rest.count} {t('argus.issues.eventDistributionMore', 'more')}
                </Typography>
                <Typography sx={{ fontSize: '0.65rem', color: 'text.disabled', minWidth: 24, textAlign: 'right', transition: 'color 0.2s' }}>
                  {browserData.rest.pct}%
                </Typography>
                <Box 
                  className="bar-bg"
                  sx={{
                    width: 40, height: 3,
                    backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
                    borderRadius: 1, transition: 'background-color 0.2s'
                  }} 
                />
              </Box>
            </SafeTooltip>
          )}
        </Box>
      )}

      {/* ── 4. Issue Tags button ── */}
      <Box sx={{
        flexShrink: 0,
        borderLeft: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
        pl: 2,
      }}>
        <Button
          variant="outlined"
          size="small"
          onClick={() => {
            // Scroll to TagDistribution section
            const el = document.getElementById('argus-tag-distribution');
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          }}
          sx={{
            textTransform: 'none',
            color: 'text.primary',
            borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)',
            fontSize: '0.72rem',
            fontWeight: 600,
            px: 1.5,
            py: 0.5,
            whiteSpace: 'nowrap',
            '&:hover': {
              borderColor: theme.palette.primary.main,
              backgroundColor: alpha(theme.palette.primary.main, 0.04),
            },
          }}
        >
          {t('argus.issues.eventDistributionIssueTags', 'Issue Tags')}
        </Button>
      </Box>
    </Box>
  );
};

export default EventDistributionChart;

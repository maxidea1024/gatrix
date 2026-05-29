import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Paper,
  Chip,
  IconButton,
  ToggleButton,
  ToggleButtonGroup,
  useTheme,
  alpha,
  Divider,
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  NewReleases as ReleasesIcon,
  BugReport as BugIcon,
  People as PeopleIcon,
  Schedule as ScheduleIcon,
  CheckCircle as CheckIcon,
  Warning as WarnIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import PageContentLoader from '@/components/common/PageContentLoader';
import argusService, { ArgusRelease } from '@/services/argusService';

const TIME_RANGES = [
  { value: '7d', label: '7D' },
  { value: '30d', label: '30D' },
  { value: '90d', label: '90D' },
];

const ArgusReleasesPage: React.FC = () => {
  const theme = useTheme();
  const { t } = useTranslation();
  const isDark = theme.palette.mode === 'dark';
  const projectId = '1';

  const [releases, setReleases] = useState<ArgusRelease[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('30d');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await argusService.getReleases(projectId, period);
      setReleases(data);
    } catch (error) {
      console.error('Failed to fetch releases:', error);
    } finally {
      setLoading(false);
    }
  }, [projectId, period]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handlePeriodChange = (_: React.MouseEvent<HTMLElement>, v: string | null) => {
    if (!v) return;
    setPeriod(v);
  };

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 2.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="h5" fontWeight={700} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <ReleasesIcon sx={{ color: '#7c4dff' }} />
          {t('argus.releases.title')}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <ToggleButtonGroup value={period} exclusive onChange={handlePeriodChange} size="small">
            {TIME_RANGES.map((r) => (
              <ToggleButton key={r.value} value={r.value} sx={{
                px: 1.2, py: 0.3, textTransform: 'none', fontSize: '0.75rem', minWidth: 36,
                '&.Mui-selected': { backgroundColor: alpha(theme.palette.primary.main, 0.15), color: theme.palette.primary.main, fontWeight: 600 },
              }}>{r.label}</ToggleButton>
            ))}
          </ToggleButtonGroup>
          <IconButton onClick={fetchData} size="small"><RefreshIcon /></IconButton>
        </Box>
      </Box>

      <PageContentLoader loading={loading}>
        {releases.length === 0 ? (
          <Paper elevation={0} sx={{
            py: 8, textAlign: 'center',
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
            borderRadius: 2,
          }}>
            <ReleasesIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
            <Typography color="text.secondary">{t('argus.releases.noReleases')}</Typography>
          </Paper>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {releases.map((r, idx) => {
              const rate = Number(r.crash_free_rate);
              const rateColor = rate >= 99 ? '#4caf50' : rate >= 95 ? '#ff9800' : '#f44336';
              const isBeta = r.release.includes('beta') || r.release.includes('alpha') || r.release.includes('rc');
              const isHotfix = r.release.includes('hotfix');
              return (
                <Paper
                  key={r.release}
                  elevation={0}
                  sx={{
                    border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
                    borderRadius: 2,
                    overflow: 'hidden',
                    transition: 'all 0.15s',
                    '&:hover': { borderColor: alpha('#7c4dff', 0.3) },
                  }}
                >
                  {/* Release Header */}
                  <Box sx={{
                    display: 'flex', alignItems: 'center', gap: 1.5,
                    px: 2.5, py: 1.5,
                    backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.015)',
                    borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}`,
                  }}>
                    <Chip
                      label={r.release}
                      size="small"
                      sx={{
                        fontWeight: 700, fontSize: '0.82rem',
                        backgroundColor: alpha('#7c4dff', 0.1), color: '#7c4dff', border: 'none',
                      }}
                    />
                    {isBeta && <Chip label="Beta" size="small" sx={{ height: 18, fontSize: '0.6rem', fontWeight: 700, backgroundColor: alpha('#ff9800', 0.12), color: '#ff9800', border: 'none' }} />}
                    {isHotfix && <Chip label="Hotfix" size="small" sx={{ height: 18, fontSize: '0.6rem', fontWeight: 700, backgroundColor: alpha('#f44336', 0.12), color: '#f44336', border: 'none' }} />}
                    <Box sx={{ flex: 1 }} />
                    {/* Crash-free badge */}
                    <Box sx={{
                      display: 'flex', alignItems: 'center', gap: 0.5,
                      px: 1.2, py: 0.3, borderRadius: 1,
                      backgroundColor: alpha(rateColor, 0.1),
                    }}>
                      {rate >= 99 ? <CheckIcon sx={{ fontSize: 14, color: rateColor }} /> : <WarnIcon sx={{ fontSize: 14, color: rateColor }} />}
                      <Typography variant="caption" fontWeight={700} sx={{ color: rateColor }}>
                        {rate.toFixed(1)}% crash free
                      </Typography>
                    </Box>
                  </Box>

                  {/* Stats Row */}
                  <Box sx={{ display: 'flex', px: 2.5, py: 2, gap: 3, flexWrap: 'wrap' }}>
                    <StatItem icon={<BugIcon sx={{ fontSize: 15 }} />} color="#f44336" label={t('argus.releases.errors')} value={Number(r.error_count).toLocaleString()} />
                    <Divider orientation="vertical" flexItem />
                    <StatItem icon={<BugIcon sx={{ fontSize: 15 }} />} color="#ff9800" label={t('argus.releases.issues')} value={Number(r.issue_count).toLocaleString()} />
                    <Divider orientation="vertical" flexItem />
                    <StatItem icon={<PeopleIcon sx={{ fontSize: 15 }} />} color="#2196f3" label={t('argus.releases.users')} value={Number(r.affected_users).toLocaleString()} />
                    <Divider orientation="vertical" flexItem />
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <ScheduleIcon sx={{ fontSize: 14, color: isDark ? '#555' : '#bbb' }} />
                      <Box>
                        <Typography variant="caption" sx={{ color: isDark ? '#666' : '#999', fontSize: '0.68rem', display: 'block' }}>
                          {t('argus.releases.firstSeen')}: {formatRelative(r.first_seen)}
                        </Typography>
                        <Typography variant="caption" sx={{ color: isDark ? '#666' : '#999', fontSize: '0.68rem', display: 'block' }}>
                          {t('argus.releases.lastSeen')}: {formatRelative(r.last_seen)}
                        </Typography>
                      </Box>
                    </Box>
                  </Box>

                  {/* Health bar */}
                  <Box sx={{ px: 2.5, pb: 2 }}>
                    <Box sx={{ height: 6, borderRadius: 3, backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)' }}>
                      <Box sx={{
                        height: '100%', borderRadius: 3, width: `${Math.min(rate, 100)}%`,
                        background: `linear-gradient(90deg, ${rateColor}, ${alpha(rateColor, 0.5)})`,
                        transition: 'width 0.5s',
                      }} />
                    </Box>
                  </Box>
                </Paper>
              );
            })}
          </Box>
        )}
      </PageContentLoader>
    </Box>
  );
};

const StatItem: React.FC<{ icon: React.ReactElement; color: string; label: string; value: string }> = ({ icon, color, label, value }) => (
  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
    <Box sx={{ color, display: 'flex' }}>{icon}</Box>
    <Box>
      <Typography variant="body2" fontWeight={700}>{value}</Typography>
      <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.68rem' }}>{label}</Typography>
    </Box>
  </Box>
);

function formatRelative(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const hrs = Math.floor(diff / 3600000);
    const days = Math.floor(hrs / 24);

    if (hrs < 1) return '방금';
    if (hrs < 24) return `${hrs}시간 전`;
    if (days < 30) return `${days}일 전`;
    return d.toLocaleDateString('ko-KR');
  } catch {
    return dateStr;
  }
}

export default ArgusReleasesPage;

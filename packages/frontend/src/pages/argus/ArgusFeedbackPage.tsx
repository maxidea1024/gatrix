import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Paper,
  Chip,
  IconButton,
  ToggleButton,
  ToggleButtonGroup,
  Stack,
  Pagination,
  useTheme,
  alpha,
  Avatar,
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  Feedback as FeedbackIcon,
  Person as PersonIcon,
  Email as EmailIcon,
  Schedule as ScheduleIcon,
  Link as LinkIcon,
  FormatQuote as QuoteIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import PageContentLoader from '@/components/common/PageContentLoader';
import argusService, { ArgusFeedbackItem } from '@/services/argusService';

const PAGE_SIZE = 20;
const TIME_RANGES = [
  { value: '24h', label: '24H' },
  { value: '7d', label: '7D' },
  { value: '30d', label: '30D' },
];

// Generate avatar color from name
function stringToColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) { hash = str.charCodeAt(i) + ((hash << 5) - hash); }
  const colors = ['#f44336', '#e91e63', '#9c27b0', '#673ab7', '#3f51b5', '#2196f3', '#00bcd4', '#009688', '#4caf50', '#ff9800'];
  return colors[Math.abs(hash) % colors.length];
}

function getInitials(name: string): string {
  return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
}

const ArgusFeedbackPage: React.FC = () => {
  const theme = useTheme();
  const { t } = useTranslation();
  const isDark = theme.palette.mode === 'dark';
  const projectId = '1';

  const [items, setItems] = useState<ArgusFeedbackItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [period, setPeriod] = useState('7d');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await argusService.getFeedback(projectId, { period, page, limit: PAGE_SIZE });
      setItems(data.items || []);
      setTotal(data.total || 0);
    } catch (error) {
      console.error('Failed to fetch feedback:', error);
    } finally {
      setLoading(false);
    }
  }, [projectId, period, page]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handlePeriodChange = (_: React.MouseEvent<HTMLElement>, v: string | null) => {
    if (!v) return;
    setPeriod(v);
    setPage(1);
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 2.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <FeedbackIcon sx={{ fontSize: 26, color: '#7c4dff' }} />
          <Typography variant="h5" fontWeight={700}>
            {t('argus.feedback.title')}
          </Typography>
          {!loading && (
            <Chip label={total.toLocaleString()} size="small" sx={{
              fontWeight: 700, fontSize: '0.75rem', height: 22,
              backgroundColor: alpha('#7c4dff', 0.1), color: '#7c4dff', border: 'none',
            }} />
          )}
        </Box>
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
        {items.length === 0 ? (
          <Paper elevation={0} sx={{
            py: 8, textAlign: 'center',
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
            borderRadius: 2,
          }}>
            <FeedbackIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
            <Typography color="text.secondary">{t('argus.feedback.noFeedback')}</Typography>
          </Paper>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {items.map((item) => {
              const displayName = item.name || item.email?.split('@')[0] || 'Anonymous';
              const avatarColor = stringToColor(displayName);
              return (
                <Paper
                  key={item.event_id}
                  elevation={0}
                  sx={{
                    p: 0, overflow: 'hidden',
                    border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
                    borderRadius: 2,
                    transition: 'all 0.15s',
                    '&:hover': { borderColor: alpha('#7c4dff', 0.3), boxShadow: `0 2px 12px ${alpha('#7c4dff', 0.08)}` },
                  }}
                >
                  {/* Card Header */}
                  <Box sx={{
                    display: 'flex', alignItems: 'center', gap: 1.5,
                    px: 2, py: 1.5,
                    backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.015)',
                    borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}`,
                  }}>
                    <Avatar sx={{ width: 32, height: 32, fontSize: '0.75rem', fontWeight: 700, backgroundColor: avatarColor }}>
                      {getInitials(displayName)}
                    </Avatar>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="body2" fontWeight={600} sx={{ lineHeight: 1.3 }}>
                        {displayName}
                      </Typography>
                      {item.email && (
                        <Typography variant="caption" sx={{ color: isDark ? '#666' : '#999', fontSize: '0.7rem' }}>
                          {item.email}
                        </Typography>
                      )}
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}>
                      {item.url && (
                        <Chip
                          icon={<LinkIcon sx={{ fontSize: '14px !important' }} />}
                          label={item.url}
                          size="small"
                          sx={{
                            height: 20, fontSize: '0.65rem',
                            backgroundColor: alpha('#2196f3', 0.08), color: '#2196f3', border: 'none',
                            '& .MuiChip-icon': { color: '#2196f3' },
                          }}
                        />
                      )}
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.3 }}>
                        <ScheduleIcon sx={{ fontSize: 13, color: isDark ? '#555' : '#bbb' }} />
                        <Typography variant="caption" sx={{ fontSize: '0.68rem', color: isDark ? '#666' : '#999' }}>
                          {formatRelative(item.submitted_at, t)}
                        </Typography>
                      </Box>
                    </Box>
                  </Box>

                  {/* Message Body */}
                  <Box sx={{ px: 2.5, py: 2, display: 'flex', gap: 1 }}>
                    <QuoteIcon sx={{ fontSize: 20, color: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)', flexShrink: 0, mt: 0.2 }} />
                    <Typography variant="body2" sx={{
                      whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                      lineHeight: 1.7, fontSize: '0.88rem',
                      color: isDark ? '#ccc' : '#444',
                    }}>
                      {item.message}
                    </Typography>
                  </Box>
                </Paper>
              );
            })}
          </Box>
        )}

        {totalPages > 1 && (
          <Stack alignItems="center" sx={{ mt: 3 }}>
            <Pagination
              count={totalPages}
              page={page}
              onChange={(_, v) => setPage(v)}
              color="primary"
              shape="rounded"
              size="small"
            />
          </Stack>
        )}
      </PageContentLoader>
    </Box>
  );
};

function formatRelative(ts: string, t: any): string {
  if (!ts) return '';
  try {
    const diffSec = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
    if (diffSec < 0) return t('common.time.justNow');
    const mins = Math.floor(diffSec / 60);
    const hrs = Math.floor(mins / 60);
    const days = Math.floor(hrs / 24);
    if (mins < 1) return t('common.time.justNow');
    if (mins < 60) return t('common.time.minutesAgo', { count: mins });
    if (hrs < 24) return t('common.time.hoursAgo', { count: hrs });
    if (days < 30) return t('common.time.daysAgo', { count: days });
    return new Date(ts).toLocaleDateString();
  } catch { return ts; }
}

export default ArgusFeedbackPage;

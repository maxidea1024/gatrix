import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Paper,
  Chip,
  IconButton,
  TextField,
  InputAdornment,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Stack,
  Pagination,
  useTheme,
  alpha,
} from '@mui/material';
import PageContentLoader from '@/components/common/PageContentLoader';
import {
  Search as SearchIcon,
  Refresh as RefreshIcon,
  ErrorOutline as ErrorIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  BugReport as BugReportIcon,
  Schedule as ScheduleIcon,
  Person as PersonIcon,
} from '@mui/icons-material';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import argusService, {
  ArgusIssue,
  ArgusIssueListParams,
} from '@/services/argusService';

const PAGE_SIZE = 25;

const LEVEL_CONFIG: Record<string, { color: string; icon: React.ReactElement; bg: string }> = {
  fatal: { color: '#f44336', icon: <ErrorIcon sx={{ fontSize: 16 }} />, bg: 'rgba(244,67,54,0.08)' },
  error: { color: '#ff5722', icon: <ErrorIcon sx={{ fontSize: 16 }} />, bg: 'rgba(255,87,34,0.08)' },
  warning: { color: '#ff9800', icon: <WarningIcon sx={{ fontSize: 16 }} />, bg: 'rgba(255,152,0,0.08)' },
  info: { color: '#2196f3', icon: <InfoIcon sx={{ fontSize: 16 }} />, bg: 'rgba(33,150,243,0.08)' },
  debug: { color: '#9e9e9e', icon: <InfoIcon sx={{ fontSize: 16 }} />, bg: 'rgba(158,158,158,0.08)' },
};

const STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  unresolved: { color: '#f44336', label: 'Unresolved' },
  resolved: { color: '#4caf50', label: 'Resolved' },
  ignored: { color: '#9e9e9e', label: 'Ignored' },
};

interface ArgusIssuesPageProps {
  projectId?: string | number;
}

const ArgusIssuesPage: React.FC<ArgusIssuesPageProps> = ({ projectId: propProjectId }) => {
  const theme = useTheme();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const isDark = theme.palette.mode === 'dark';

  const projectId = propProjectId || searchParams.get('projectId') || '1';
  const currentPage = parseInt(searchParams.get('page') || '1', 10);

  const [issues, setIssues] = useState<ArgusIssue[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [status, setStatus] = useState(searchParams.get('status') || 'unresolved');
  const [level, setLevel] = useState(searchParams.get('level') || '');
  const [sort, setSort] = useState(searchParams.get('sort') || 'last_seen');

  const fetchIssues = useCallback(async () => {
    setLoading(true);
    try {
      const params: ArgusIssueListParams = {
        status: status || undefined,
        level: level || undefined,
        sort,
        limit: PAGE_SIZE,
        offset: (currentPage - 1) * PAGE_SIZE,
        search: search || undefined,
      };
      const result = await argusService.listIssues(projectId, params);
      setIssues(result.data);
      setTotal(result.total);
    } catch (error) {
      console.error('Failed to fetch issues:', error);
      setIssues([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [projectId, status, level, sort, currentPage, search]);

  useEffect(() => { fetchIssues(); }, [fetchIssues]);

  const handlePageChange = (_: React.ChangeEvent<unknown>, page: number) => {
    const params = new URLSearchParams(searchParams);
    params.set('page', String(page));
    setSearchParams(params);
  };

  const handleIssueClick = (issue: ArgusIssue) => {
    navigate(`/argus/issues/${projectId}/${issue.id}`);
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 2.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <BugReportIcon sx={{ fontSize: 28, color: theme.palette.error.main }} />
          <Typography variant="h5" fontWeight={700}>
            {t('argus.issues.title')}
          </Typography>
          {!loading && (
            <Chip
              label={total.toLocaleString()}
              size="small"
              sx={{
                fontWeight: 700, fontSize: '0.75rem', height: 22,
                backgroundColor: alpha(theme.palette.error.main, 0.1),
                color: theme.palette.error.main,
                border: 'none',
              }}
            />
          )}
        </Box>
        <IconButton onClick={fetchIssues} disabled={loading} size="small">
          <RefreshIcon />
        </IconButton>
      </Box>

      {/* Filter Bar */}
      <Paper
        elevation={0}
        sx={{
          p: 1.5, mb: 2,
          display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center',
          border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
          borderRadius: 2,
        }}
      >
        <TextField
          size="small"
          placeholder={t('argus.issues.searchPlaceholder')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              const params = new URLSearchParams(searchParams);
              params.set('search', search);
              params.set('page', '1');
              setSearchParams(params);
            }
          }}
          InputProps={{
            startAdornment: <InputAdornment position="start"><SearchIcon sx={{ fontSize: 18, color: 'text.secondary' }} /></InputAdornment>,
          }}
          sx={{
            minWidth: 260,
            '& .MuiOutlinedInput-root': {
              borderRadius: 1.5, fontSize: '0.85rem',
              backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
            },
          }}
        />
        <FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel sx={{ fontSize: '0.85rem' }}>{t('argus.issues.status')}</InputLabel>
          <Select
            value={status}
            label={t('argus.issues.status')}
            sx={{ borderRadius: 1.5, fontSize: '0.85rem' }}
            onChange={(e) => {
              setStatus(e.target.value);
              const params = new URLSearchParams(searchParams);
              params.set('status', e.target.value);
              params.set('page', '1');
              setSearchParams(params);
            }}
          >
            <MenuItem value="">{t('common.all')}</MenuItem>
            <MenuItem value="unresolved">{t('argus.issues.unresolved')}</MenuItem>
            <MenuItem value="resolved">{t('argus.issues.resolved')}</MenuItem>
            <MenuItem value="ignored">{t('argus.issues.ignored')}</MenuItem>
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 110 }}>
          <InputLabel sx={{ fontSize: '0.85rem' }}>{t('argus.issues.level')}</InputLabel>
          <Select
            value={level}
            label={t('argus.issues.level')}
            sx={{ borderRadius: 1.5, fontSize: '0.85rem' }}
            onChange={(e) => {
              setLevel(e.target.value);
              const params = new URLSearchParams(searchParams);
              params.set('level', e.target.value);
              params.set('page', '1');
              setSearchParams(params);
            }}
          >
            <MenuItem value="">{t('common.all')}</MenuItem>
            <MenuItem value="fatal">Fatal</MenuItem>
            <MenuItem value="error">Error</MenuItem>
            <MenuItem value="warning">Warning</MenuItem>
            <MenuItem value="info">Info</MenuItem>
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 130 }}>
          <InputLabel sx={{ fontSize: '0.85rem' }}>{t('argus.issues.sort')}</InputLabel>
          <Select
            value={sort}
            label={t('argus.issues.sort')}
            sx={{ borderRadius: 1.5, fontSize: '0.85rem' }}
            onChange={(e) => {
              setSort(e.target.value);
              const params = new URLSearchParams(searchParams);
              params.set('sort', e.target.value);
              setSearchParams(params);
            }}
          >
            <MenuItem value="last_seen">{t('argus.issues.lastSeen')}</MenuItem>
            <MenuItem value="first_seen">{t('argus.issues.firstSeen')}</MenuItem>
            <MenuItem value="event_count">{t('argus.issues.events')}</MenuItem>
            <MenuItem value="user_count">{t('argus.issues.users')}</MenuItem>
          </Select>
        </FormControl>
      </Paper>

      <PageContentLoader loading={loading}>
        {/* Issue Cards */}
        <Paper
          elevation={0}
          sx={{
            mb: 2,
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
            borderRadius: 2,
            overflow: 'hidden',
          }}
        >
          {issues.length === 0 ? (
            <Box sx={{ py: 8, textAlign: 'center' }}>
              <BugReportIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
              <Typography color="text.secondary">{t('argus.issues.noIssues')}</Typography>
            </Box>
          ) : (
            issues.map((issue, idx) => {
              const lc = LEVEL_CONFIG[issue.level] || LEVEL_CONFIG.info;
              const sc = STATUS_CONFIG[issue.status] || STATUS_CONFIG.unresolved;
              return (
                <Box
                  key={issue.id}
                  onClick={() => handleIssueClick(issue)}
                  sx={{
                    display: 'flex',
                    alignItems: 'stretch',
                    cursor: 'pointer',
                    transition: 'background 0.15s',
                    borderBottom: idx < issues.length - 1 ? `1px solid ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}` : 'none',
                    '&:hover': {
                      backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.015)',
                    },
                  }}
                >
                  {/* Level Color Bar */}
                  <Box sx={{
                    width: 4, flexShrink: 0,
                    backgroundColor: lc.color,
                    borderRadius: idx === 0 ? '8px 0 0 0' : idx === issues.length - 1 ? '0 0 0 8px' : 0,
                  }} />

                  {/* Content */}
                  <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', px: 2, py: 1.5, gap: 2, minWidth: 0 }}>
                    {/* Level Icon */}
                    <Box sx={{
                      width: 30, height: 30, borderRadius: 1.5, flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      backgroundColor: lc.bg, color: lc.color,
                    }}>
                      {lc.icon}
                    </Box>

                    {/* Issue Info */}
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.2 }}>
                        <Typography
                          variant="body2"
                          fontWeight={600}
                          noWrap
                          sx={{ color: isDark ? '#e0e0e0' : '#1a1a2e', lineHeight: 1.3 }}
                        >
                          {issue.title}
                        </Typography>
                        {issue.is_regression && (
                          <Chip
                            label="Regression"
                            size="small"
                            sx={{
                              height: 18, fontSize: '0.6rem', fontWeight: 700,
                              backgroundColor: alpha('#ff9800', 0.15),
                              color: '#ff9800', border: 'none',
                            }}
                          />
                        )}
                      </Box>
                      <Typography
                        variant="caption"
                        noWrap
                        sx={{ color: isDark ? '#666' : '#999', fontSize: '0.75rem', display: 'block' }}
                      >
                        {issue.culprit || issue.fingerprint?.slice(0, 16)}
                      </Typography>
                    </Box>

                    {/* Stats */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0 }}>
                      {/* Event count */}
                      <Box sx={{ textAlign: 'center', minWidth: 50 }}>
                        <Typography variant="body2" fontWeight={700} sx={{ lineHeight: 1.2 }}>
                          {issue.event_count?.toLocaleString() || 0}
                        </Typography>
                        <Typography variant="caption" sx={{ fontSize: '0.65rem', color: isDark ? '#555' : '#aaa' }}>
                          {t('argus.issues.events')}
                        </Typography>
                      </Box>

                      {/* User count */}
                      <Box sx={{ textAlign: 'center', minWidth: 40 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.3, justifyContent: 'center' }}>
                          <PersonIcon sx={{ fontSize: 13, color: isDark ? '#555' : '#aaa' }} />
                          <Typography variant="body2" fontWeight={600}>
                            {issue.user_count?.toLocaleString() || 0}
                          </Typography>
                        </Box>
                      </Box>

                      {/* Time */}
                      <Box sx={{ minWidth: 70, textAlign: 'right' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.3, justifyContent: 'flex-end' }}>
                          <ScheduleIcon sx={{ fontSize: 12, color: isDark ? '#555' : '#aaa' }} />
                          <Typography variant="caption" sx={{ fontSize: '0.72rem', color: isDark ? '#777' : '#888' }}>
                            {issue.last_seen ? formatTimeAgo(issue.last_seen) : '-'}
                          </Typography>
                        </Box>
                      </Box>
                    </Box>
                  </Box>
                </Box>
              );
            })
          )}
        </Paper>

        {/* Pagination */}
        {totalPages > 1 && (
          <Stack alignItems="center" sx={{ mt: 2 }}>
            <Pagination
              count={totalPages}
              page={currentPage}
              onChange={handlePageChange}
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

function formatTimeAgo(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (diffSec < 60) return `${diffSec}초 전`;
    if (diffMin < 60) return `${diffMin}분 전`;
    if (diffHour < 24) return `${diffHour}시간 전`;
    if (diffDay < 30) return `${diffDay}일 전`;
    return date.toLocaleDateString();
  } catch {
    return dateStr;
  }
}

export default ArgusIssuesPage;

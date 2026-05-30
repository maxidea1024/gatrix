import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Paper,
  Chip,
  TextField,
  InputAdornment,
  Pagination,
  Stack,
  useTheme,
  alpha,
  Popover,
  Checkbox,
  Button,
  Tooltip,
} from '@mui/material';
import PageContentLoader from '@/components/common/PageContentLoader';
import {
  Search as SearchIcon,
  ErrorOutline as ErrorIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  BugReport as BugReportIcon,
  Schedule as ScheduleIcon,
  Person as PersonIcon,
  ExpandMore as ExpandMoreIcon,
  MergeType as MergeIcon,
} from '@mui/icons-material';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import argusService, {
  ArgusIssue,
  ArgusIssueListParams,
} from '@/services/argusService';
import ArgusFilterBar, { ArgusFilterState, defaultArgusFilterState } from '@/components/argus/ArgusFilterBar';
import { argusDateRangeToApiParams } from '@/components/argus/ArgusDateRangePicker';

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

interface FilterChipSelectProps {
  label: string;
  value: string;
  options: { value: string; label: string; color?: string }[];
  anchorEl: HTMLElement | null;
  onOpen: (e: React.MouseEvent<HTMLElement>) => void;
  onClose: () => void;
  onSelect: (value: string) => void;
}

const FilterChipSelect: React.FC<FilterChipSelectProps> = ({ label, value, options, anchorEl, onOpen, onClose, onSelect }) => {
  const theme = useTheme();
  const currentOption = options.find(o => o.value === value);
  const displayLabel = currentOption?.label || options[0]?.label;
  const dotColor = currentOption?.color;
  return (
    <>
      <Box
        onClick={onOpen}
        sx={{
          display: 'inline-flex', alignItems: 'center', gap: 0.5,
          height: 28, px: 1.2, borderRadius: '6px',
          border: '1px solid', borderColor: anchorEl ? 'primary.main' : 'divider',
          bgcolor: anchorEl ? alpha(theme.palette.primary.main, 0.04) : 'transparent',
          cursor: 'pointer', transition: 'all 0.15s', userSelect: 'none',
          '&:hover': { borderColor: 'primary.main', bgcolor: alpha(theme.palette.primary.main, 0.04) },
        }}
      >
        {dotColor && <Box sx={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: dotColor }} />}
        <Typography sx={{ fontSize: '0.72rem', fontWeight: 600, color: 'text.secondary' }}>{label}:</Typography>
        <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, color: 'text.primary' }}>{displayLabel}</Typography>
        <ExpandMoreIcon sx={{ fontSize: 13, color: 'text.disabled', transform: anchorEl ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
      </Box>
      <Popover
        open={Boolean(anchorEl)}
        anchorEl={anchorEl}
        onClose={onClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        slotProps={{ paper: { sx: { mt: 0.5, borderRadius: '8px', boxShadow: '0 4px 20px rgba(0,0,0,0.12)', minWidth: 140, py: 0.5 } } }}
      >
        {options.map(opt => (
          <Box
            key={opt.value}
            onClick={() => { onSelect(opt.value); onClose(); }}
            sx={{
              px: 1.5, py: 0.6, cursor: 'pointer', fontSize: '0.78rem',
              fontWeight: opt.value === value ? 700 : 400,
              color: opt.value === value ? 'primary.main' : 'text.primary',
              backgroundColor: opt.value === value ? alpha(theme.palette.primary.main, 0.06) : 'transparent',
              display: 'flex', alignItems: 'center', gap: 0.8,
              transition: 'background 0.1s',
              '&:hover': { backgroundColor: alpha(theme.palette.primary.main, 0.04) },
            }}
          >
            {opt.color && <Box sx={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: opt.color }} />}
            {opt.label}
          </Box>
        ))}
      </Popover>
    </>
  );
};

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
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [merging, setMerging] = useState(false);

  // ArgusFilterBar state (includes environment/browser/os from URL + heatmap time)
  const [filters, setFilters] = useState<ArgusFilterState>(() => {
    const state = defaultArgusFilterState('24h');
    const env = searchParams.get('environment');
    const br = searchParams.get('browser');
    const osParam = searchParams.get('os');
    if (env) state.environments = [env];
    if (br) state.browsers = [br];
    if (osParam) state.os = [osParam];

    // Heatmap click: dayOfWeek (1=Mon..7=Sun) + hour (0..23)
    const dayOfWeek = searchParams.get('dayOfWeek');
    const hour = searchParams.get('hour');
    if (dayOfWeek && hour) {
      const dow = parseInt(dayOfWeek, 10); // 1=Mon..7=Sun
      const h = parseInt(hour, 10);
      // Find the most recent date matching this day-of-week
      const now = new Date();
      const jsDay = dow === 7 ? 0 : dow; // JS: 0=Sun,1=Mon..6=Sat
      let diff = now.getDay() - jsDay;
      if (diff < 0) diff += 7;
      if (diff === 0 && now.getHours() < h) diff = 7; // hasn't happened today yet
      const targetDate = new Date(now);
      targetDate.setDate(targetDate.getDate() - diff);
      const start = new Date(targetDate);
      start.setHours(h, 0, 0, 0);
      const end = new Date(start);
      end.setHours(h + 1, 0, 0, 0);
      state.dateRange = { type: 'custom', start, end };
    }

    return state;
  });

  // Dropdown anchor state for compact filter chips
  const [statusAnchor, setStatusAnchor] = useState<HTMLElement | null>(null);
  const [levelAnchor, setLevelAnchor] = useState<HTMLElement | null>(null);
  const [sortAnchor, setSortAnchor] = useState<HTMLElement | null>(null);

  const fetchIssues = useCallback(async () => {
    setLoading(true);
    try {
      const dateParams = argusDateRangeToApiParams(filters.dateRange);
      const params: ArgusIssueListParams = {
        status: status || undefined,
        level: level || undefined,
        sort,
        limit: PAGE_SIZE,
        offset: (currentPage - 1) * PAGE_SIZE,
        search: search || undefined,
        environment: filters.environments.length === 1 ? filters.environments[0] : undefined,
        browser: filters.browsers.length === 1 ? filters.browsers[0] : undefined,
        os: filters.os.length === 1 ? filters.os[0] : undefined,
        ...dateParams,
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
  }, [projectId, status, level, sort, currentPage, search, filters]);

  useEffect(() => { fetchIssues(); }, [fetchIssues]);

  const handleFilterChange = (newFilters: ArgusFilterState) => {
    setFilters(newFilters);
  };

  const handlePageChange = (_: React.ChangeEvent<unknown>, page: number) => {
    const params = new URLSearchParams(searchParams);
    params.set('page', String(page));
    setSearchParams(params);
  };

  const handleIssueClick = (issue: ArgusIssue) => {
    navigate(`/argus/issues/${projectId}/${issue.id}`);
  };

  const toggleSelect = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleMerge = async () => {
    if (selectedIds.size < 2) return;
    setMerging(true);
    try {
      await argusService.mergeIssues(projectId, Array.from(selectedIds));
      setSelectedIds(new Set());
      fetchIssues();
    } catch (e) {
      console.error('Failed to merge issues:', e);
    } finally {
      setMerging(false);
    }
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  // Filter chip option helpers
  const statusOptions = [
    { value: '', label: t('common.all', 'All') },
    { value: 'unresolved', label: t('argus.issues.unresolved', 'Unresolved'), color: '#f44336' },
    { value: 'resolved', label: t('argus.issues.resolved', 'Resolved'), color: '#4caf50' },
    { value: 'ignored', label: t('argus.issues.ignored', 'Ignored'), color: '#9e9e9e' },
  ];
  const levelOptions = [
    { value: '', label: t('common.all', 'All') },
    { value: 'fatal', label: 'Fatal', color: '#f44336' },
    { value: 'error', label: 'Error', color: '#ff5722' },
    { value: 'warning', label: 'Warning', color: '#ff9800' },
    { value: 'info', label: 'Info', color: '#2196f3' },
  ];
  const sortOptions = [
    { value: 'last_seen', label: t('argus.issues.lastSeen', 'Last Seen') },
    { value: 'first_seen', label: t('argus.issues.firstSeen', 'First Seen') },
    { value: 'event_count', label: t('argus.issues.events', 'Events') },
    { value: 'user_count', label: t('argus.issues.users', 'Users') },
  ];

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1.5 }}>
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

      {/* Global Filter Bar (environment / browser / OS / date range) */}
      <ArgusFilterBar
        projectId={String(projectId)}
        value={filters}
        onChange={handleFilterChange}
        onRefresh={fetchIssues}
        loading={loading}
      />

      {/* Merge Toolbar */}
      {selectedIds.size > 0 && (
        <Paper elevation={0} sx={{
          mb: 1.5, p: 1, display: 'flex', alignItems: 'center', gap: 1.5,
          border: `1px solid ${alpha(theme.palette.primary.main, 0.3)}`,
          borderRadius: 2,
          backgroundColor: alpha(theme.palette.primary.main, 0.04),
        }}>
          <Typography variant="body2" fontWeight={600} sx={{ fontSize: '0.8rem' }}>
            {selectedIds.size} {t('argus.issues.selected', 'selected')}
          </Typography>
          <Tooltip title={selectedIds.size < 2 ? t('argus.issues.mergeMinTwo', 'Select at least 2 issues') : ''}>
            <span>
              <Button
                variant="contained"
                size="small"
                startIcon={<MergeIcon />}
                disabled={selectedIds.size < 2 || merging}
                onClick={handleMerge}
                sx={{ textTransform: 'none', borderRadius: '6px', fontSize: '0.76rem' }}
              >
                {t('argus.issues.merge', 'Merge Issues')}
              </Button>
            </span>
          </Tooltip>
          <Button
            size="small"
            onClick={() => setSelectedIds(new Set())}
            sx={{ textTransform: 'none', fontSize: '0.76rem', ml: 'auto' }}
          >
            {t('common.cancel', 'Cancel')}
          </Button>
        </Paper>
      )}

      {/* Issue-specific Filter Bar */}
      <Box
        sx={{
          display: 'flex', gap: 0.75, mb: 2, flexWrap: 'wrap', alignItems: 'center',
        }}
      >
        {/* Search */}
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
            startAdornment: <InputAdornment position="start"><SearchIcon sx={{ fontSize: 16, color: 'text.disabled' }} /></InputAdornment>,
          }}
          sx={{
            minWidth: 220,
            '& .MuiOutlinedInput-root': {
              borderRadius: '6px', fontSize: '0.78rem', height: 28,
              backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
            },
            '& .MuiOutlinedInput-input': { py: 0.4 },
          }}
        />

        {/* Status */}
        <FilterChipSelect
          label={t('argus.issues.status', 'Status')}
          value={status}
          options={statusOptions}
          anchorEl={statusAnchor}
          onOpen={(e) => setStatusAnchor(e.currentTarget)}
          onClose={() => setStatusAnchor(null)}
          onSelect={(v) => {
            setStatus(v);
            const params = new URLSearchParams(searchParams);
            params.set('status', v); params.set('page', '1');
            setSearchParams(params);
          }}
        />

        {/* Level */}
        <FilterChipSelect
          label={t('argus.issues.level', 'Level')}
          value={level}
          options={levelOptions}
          anchorEl={levelAnchor}
          onOpen={(e) => setLevelAnchor(e.currentTarget)}
          onClose={() => setLevelAnchor(null)}
          onSelect={(v) => {
            setLevel(v);
            const params = new URLSearchParams(searchParams);
            params.set('level', v); params.set('page', '1');
            setSearchParams(params);
          }}
        />

        {/* Sort */}
        <FilterChipSelect
          label={t('argus.issues.sort', 'Sort')}
          value={sort}
          options={sortOptions}
          anchorEl={sortAnchor}
          onOpen={(e) => setSortAnchor(e.currentTarget)}
          onClose={() => setSortAnchor(null)}
          onSelect={(v) => {
            setSort(v);
            const params = new URLSearchParams(searchParams);
            params.set('sort', v);
            setSearchParams(params);
          }}
        />
      </Box>

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

                  {/* Checkbox */}
                  <Box sx={{ display: 'flex', alignItems: 'center', pl: 0.5 }}>
                    <Checkbox
                      size="small"
                      checked={selectedIds.has(issue.id)}
                      onClick={(e) => toggleSelect(issue.id, e)}
                      sx={{ p: 0.3, '& .MuiSvgIcon-root': { fontSize: 16 } }}
                    />
                  </Box>

                  {/* Content */}
                  <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', px: 1.5, py: 1.5, gap: 2, minWidth: 0 }}>
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
                        {issue.substatus === 'regressed' && (
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

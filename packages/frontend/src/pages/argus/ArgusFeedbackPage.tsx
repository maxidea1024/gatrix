import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  Typography,
  Paper,
  Chip,
  IconButton,
  useTheme,
  alpha,
  Avatar,
  TextField,
  InputAdornment,
  Skeleton,
  Button,
  Tooltip,
  Checkbox,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Dialog,
  DialogContent,
  DialogTitle,
  DialogActions,
  Tabs,
  Tab,
  Divider,
  Collapse,
  Popover,
  Select,
  FormControl,
  InputLabel,
} from '@mui/material';
import {
  Feedback as FeedbackIcon,
  Schedule as ScheduleIcon,
  Link as LinkIcon,
  Search as SearchIcon,
  People as PeopleIcon,
  ContactMail as ContactIcon,
  TextFields as TextIcon,
  TrendingUp as TrendingUpIcon,
  CheckCircleOutline as ResolveIcon,
  ReportProblem as SpamIcon,
  Undo as UnresolveIcon,
  BugReport as BugReportIcon,
  Image as ImageIcon,
  Close as CloseIcon,
  PersonAdd as AssignIcon,
  OpenInNew as OpenIcon,
  Person as PersonIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Sort as SortIcon,
  Add as AddIcon,
  Mail as MailIcon,
  Language as UrlIcon,
  Dns as EnvIcon,
  NewReleases as ReleaseIcon,
  LocalOffer as TagIcon,
  Source as SourceIcon,
  FilterList as FilterListIcon,
  Delete as DeleteIcon,
  PlayArrow as RunIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip as ChartTooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { useSnackbar } from 'notistack';
import PageContentLoader from '@/components/common/PageContentLoader';
import { ListSkeleton } from '@/components/argus/ArgusSkeletons';
import argusService, { ArgusFeedbackItem, ArgusFeedbackResponse, ArgusIssueTracker } from '@/services/argusService';
import { rbacService } from '@/services/rbacService';
import ArgusFilterBar, { ArgusFilterState, defaultArgusFilterState } from '@/components/argus/ArgusFilterBar';
import { argusDateRangeToApiParams } from '@/components/argus/ArgusDateRangePicker';
import { formatCompactNumber, formatWithCommas, needsCompactTooltip } from '@/utils/numberFormat';
import ArgusChartSkeleton from '@/components/argus/ArgusChartSkeleton';
import useArgusUrlState from '@/hooks/useArgusUrlState';
import SimplePagination from '@/components/common/SimplePagination';
import { useOrgProject } from '@/contexts/OrgProjectContext';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, ChartTooltip, Legend, Filler);

const PAGE_SIZE_KEY = 'argusFeedback.pageSize';
const DEFAULT_PAGE_SIZE = 20;
const VALID_PAGE_SIZES = [5, 10, 15, 20, 25, 50, 100];
const STATS_COLLAPSED_KEY = 'argusFeedback.statsCollapsed';

// ─── Helpers ───
function stringToColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) { hash = str.charCodeAt(i) + ((hash << 5) - hash); }
  const colors = ['#f44336', '#e91e63', '#9c27b0', '#673ab7', '#3f51b5', '#2196f3', '#00bcd4', '#009688', '#4caf50', '#ff9800'];
  return colors[Math.abs(hash) % colors.length];
}

function getInitials(name: string): string {
  return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
}

function HighlightText({ text, highlight, isDark }: { text: string; highlight: string; isDark: boolean }) {
  if (!text) return <>{text}</>;
  if (!highlight.trim()) return <>{text}</>;
  const parts = text.split(new RegExp(`(${highlight})`, 'gi'));
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === highlight.toLowerCase() ? (
          <span key={i} style={{ 
            backgroundColor: isDark ? 'rgba(255, 235, 59, 0.2)' : 'rgba(255, 235, 59, 0.4)',
            color: isDark ? '#ffd54f' : '#f57f17',
            borderRadius: '2px',
            padding: '0 2px'
          }}>
            {part}
          </span>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}

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

const statusColor = (s: string) => {
  if (s === 'resolved') return '#4caf50';
  if (s === 'spam') return '#9e9e9e';
  return '#ff9800';
};

type FeedbackStatusTab = 'unresolved' | 'resolved' | 'spam' | '';

// ─── Main Component ───
const ArgusFeedbackPage: React.FC = () => {
  const theme = useTheme();
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isDark = theme.palette.mode === 'dark';
  const { currentProject } = useOrgProject();
  const projectId = searchParams.get('projectId') || currentProject?.id || '1';

  // ─── URL State ───
  const URL_PARAMS = useMemo(() => ({
    period: { key: 'period', default: '7d' },
    status: { key: 'status', default: 'unresolved' },
    page:   { key: 'page',   default: '1' },
    sort:   { key: 'sort',   default: 'newest' },
    fb:     { key: 'fb',     default: '' },  // selected feedback ID
  }), []);
  const [urlState, setUrlState] = useArgusUrlState(URL_PARAMS);

  // ─── Core State ───
  const [data, setData] = useState<ArgusFeedbackResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const page = parseInt(urlState.page, 10) || 1;
  const [rowsPerPage, setRowsPerPage] = useState(() => {
    const saved = parseInt(localStorage.getItem(PAGE_SIZE_KEY) || '', 10);
    if (!isNaN(saved) && VALID_PAGE_SIZES.includes(saved)) return saved;
    return DEFAULT_PAGE_SIZE;
  });

  useEffect(() => {
    localStorage.setItem(PAGE_SIZE_KEY, String(rowsPerPage));
  }, [rowsPerPage]);

  const filters = useMemo<ArgusFilterState>(
    () => defaultArgusFilterState(urlState.period),
    [urlState.period],
  );
  const [search, setSearch] = useState('');
  const [searchDebounce, setSearchDebounce] = useState('');
  const statusTab = urlState.status as FeedbackStatusTab;
  const sortOrder = urlState.sort;

  // ─── Selection & Menus ───
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [assigneeAnchor, setAssigneeAnchor] = useState<{ el: HTMLElement; feedbackId: string } | null>(null);
  const [bulkAssignAnchor, setBulkAssignAnchor] = useState<HTMLElement | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [sortAnchor, setSortAnchor] = useState<HTMLElement | null>(null);

  // ─── Stats & UI ───
  const [statsCollapsed, setStatsCollapsed] = useState(() => localStorage.getItem(STATS_COLLAPSED_KEY) === 'true');
  const [members, setMembers] = useState<any[]>([]);

  // ─── Create Issue Dialog ───
  const [createIssueOpen, setCreateIssueOpen] = useState(false);
  const [createIssueTitle, setCreateIssueTitle] = useState('');
  const [createIssueFeedbackId, setCreateIssueFeedbackId] = useState('');
  const [issueTrackers, setIssueTrackers] = useState<ArgusIssueTracker[]>([]);
  const [selectedTrackerId, setSelectedTrackerId] = useState<number | ''>('');

  // ─── Spam Filter Dialog ───
  const [spamFilterOpen, setSpamFilterOpen] = useState(false);
  const [spamKeywords, setSpamKeywords] = useState<{ id: number; keyword: string; is_regex: boolean; created_at: string }[]>([]);
  const [newKeyword, setNewKeyword] = useState('');
  const [newKeywordRegex, setNewKeywordRegex] = useState(false);
  const [spamScanLoading, setSpamScanLoading] = useState(false);

  useEffect(() => {
    localStorage.setItem(STATS_COLLAPSED_KEY, String(statsCollapsed));
  }, [statsCollapsed]);

  useEffect(() => {
    const fetchMembers = async () => {
      try {
        const data = await rbacService.getProjectMembers(projectId);
        setMembers(data);
      } catch (error) {
        console.error('Failed to fetch project members:', error);
      }
    };
    fetchMembers();
  }, [projectId]);

  // ─── Debounce Search ───
  useEffect(() => {
    const timer = setTimeout(() => setSearchDebounce(search), 400);
    return () => clearTimeout(timer);
  }, [search]);

  // ─── Fetch Data ───
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const ap = argusDateRangeToApiParams(filters.dateRange);
      const result = await argusService.getFeedback(projectId, {
        ...ap, page, limit: rowsPerPage,
        search: searchDebounce || undefined,
        status: statusTab || undefined,
        sort: sortOrder,
      });
      setData(result);
    } catch (error) {
      console.error('Failed to fetch feedback:', error);
    } finally {
      setLoading(false);
    }
  }, [projectId, filters, page, rowsPerPage, searchDebounce, statusTab, sortOrder]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ─── Handlers ───
  const handleFilterChange = (newFilters: ArgusFilterState) => {
    if (newFilters.dateRange.type === 'preset' && newFilters.dateRange.preset) {
      setUrlState({ period: newFilters.dateRange.preset, page: '1' });
    }
  };

  const handleUpdateStatus = async (feedbackId: string, status: string) => {
    try {
      await argusService.updateFeedback(projectId, feedbackId, { status });
      enqueueSnackbar(t('argus.feedback.statusUpdated', 'Status updated'), { variant: 'success' });
      fetchData();
    } catch { enqueueSnackbar(t('common.error'), { variant: 'error' }); }
  };

  const handleMarkSpam = async (feedbackId: string) => {
    try {
      await argusService.updateFeedback(projectId, feedbackId, { is_spam: true });
      enqueueSnackbar(t('argus.feedback.markedSpam', 'Marked as spam'), { variant: 'success' });
      fetchData();
    } catch { enqueueSnackbar(t('common.error'), { variant: 'error' }); }
  };

  const handleAssignFeedback = async (feedbackId: string, assignee: string) => {
    try {
      await argusService.updateFeedback(projectId, feedbackId, { assigned_to: assignee });
      enqueueSnackbar(t('argus.feedback.assigneeUpdated', 'Assignee updated'), { variant: 'success' });
      fetchData();
    } catch { enqueueSnackbar(t('common.error'), { variant: 'error' }); }
    setAssigneeAnchor(null);
  };

  const handleBulkAction = async (action: 'resolve' | 'unresolve' | 'spam') => {
    if (selectedIds.size === 0) return;
    try {
      await argusService.bulkFeedbackAction(projectId, Array.from(selectedIds), action);
      enqueueSnackbar(t('argus.feedback.bulkDone', { count: selectedIds.size }), { variant: 'success' });
      setSelectedIds(new Set());
      fetchData();
    } catch { enqueueSnackbar(t('common.error'), { variant: 'error' }); }
  };

  const handleBulkAssign = async (assignee: string) => {
    if (selectedIds.size === 0) return;
    try {
      await argusService.bulkFeedbackAction(projectId, Array.from(selectedIds), 'assign', assignee);
      enqueueSnackbar(t('argus.feedback.bulkAssignSuccess', 'Assigned successfully'), { variant: 'success' });
      setSelectedIds(new Set());
      fetchData();
    } catch { enqueueSnackbar(t('common.error'), { variant: 'error' }); }
    setBulkAssignAnchor(null);
  };

  const handleCreateIssue = async () => {
    if (!createIssueTitle.trim() || !createIssueFeedbackId) return;
    try {
      const result = await argusService.createIssue(projectId, {
        title: createIssueTitle,
        level: 'info',
        message: selectedItem?.message || '',
        culprit: selectedItem?.url || 'user-feedback',
        tracker_id: selectedTrackerId ? Number(selectedTrackerId) : undefined,
      });
      if (result.external_url) {
        enqueueSnackbar(
          t('argus.feedback.issueCreatedExternal', 'Issue created: {{key}}', { key: result.external_key || '' }),
          { variant: 'success' }
        );
      } else {
        enqueueSnackbar(t('argus.feedback.issueCreated', 'Issue created'), { variant: 'success' });
      }
      setCreateIssueOpen(false);
      setCreateIssueTitle('');
      setSelectedTrackerId('');
      fetchData();
    } catch { enqueueSnackbar(t('common.error'), { variant: 'error' }); }
  };

  const fetchSpamKeywords = async () => {
    try { setSpamKeywords(await argusService.getSpamKeywords(projectId)); }
    catch { /* ignore */ }
  };

  const handleAddKeyword = async () => {
    if (!newKeyword.trim()) return;
    try {
      await argusService.addSpamKeyword(projectId, newKeyword.trim(), newKeywordRegex);
      setNewKeyword('');
      setNewKeywordRegex(false);
      fetchSpamKeywords();
    } catch { enqueueSnackbar(t('common.error'), { variant: 'error' }); }
  };

  const handleDeleteKeyword = async (id: number) => {
    try {
      await argusService.deleteSpamKeyword(projectId, id);
      fetchSpamKeywords();
    } catch { enqueueSnackbar(t('common.error'), { variant: 'error' }); }
  };

  const handleRunAutoSpam = async () => {
    setSpamScanLoading(true);
    try {
      const result = await argusService.runAutoSpam(projectId);
      enqueueSnackbar(
        result.matched > 0
          ? t('argus.feedback.spamScanDone', { count: result.matched })
          : t('argus.feedback.spamScanNone', 'No spam detected'),
        { variant: result.matched > 0 ? 'success' : 'info' }
      );
      if (result.matched > 0) fetchData();
    } catch { enqueueSnackbar(t('common.error'), { variant: 'error' }); }
    finally { setSpamScanLoading(false); }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // ─── Derived Data ───
  const items = data?.items || [];
  const total = data?.total || 0;
  const summary = data?.summary;
  const selectedFbId = urlState.fb;
  const selectedItem = items.find(i => i.feedback_id === selectedFbId) || null;

  const unresolvedCount = summary?.unresolved_count || 0;
  const resolvedCount = summary?.resolved_count || 0;
  const spamCount = summary?.spam_count || 0;

  // ─── Trend Chart ───
  const trendChartData = useMemo(() => {
    if (!data?.trend) return { labels: [], datasets: [] };
    return {
      labels: data.trend.map(d => {
        try { const dt = new Date(d.day); return `${dt.getMonth() + 1}/${dt.getDate()}`; } catch { return d.day; }
      }),
      datasets: [{
        label: t('argus.feedback.title'),
        data: data.trend.map(d => Number(d.count)),
        backgroundColor: alpha('#7c4dff', 0.6),
        borderColor: '#7c4dff',
        borderWidth: 0,
        borderRadius: 4,
        borderSkipped: false as const,
      }],
    };
  }, [data, t]);

  const chartOpts = useMemo(() => ({
    responsive: true, maintainAspectRatio: false,
    animation: { duration: 300 },
    plugins: { legend: { display: false } },
    scales: {
      x: { grid: { display: false }, border: { display: false }, ticks: { font: { size: 10 }, maxRotation: 0 } },
      y: { beginAtZero: true, border: { display: false }, grid: { color: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)' }, ticks: { font: { size: 10 } } },
    },
  }), [isDark]);

  const statCards = [
    { icon: <FeedbackIcon />, color: '#7c4dff', label: t('argus.feedback.totalFeedback'), value: summary?.total_feedback },
    { icon: <PeopleIcon />, color: '#2196f3', label: t('argus.feedback.uniqueUsers'), value: summary?.unique_users },
    { icon: <ContactIcon />, color: '#4caf50', label: t('argus.feedback.withContact'), value: summary?.with_contact },
    { icon: <TextIcon />, color: '#ff9800', label: t('argus.feedback.avgMessageLength'), value: summary ? `${Math.round(Number(summary.avg_message_length))}` : undefined },
  ];

  const SORT_OPTIONS = [
    { value: 'newest', label: t('argus.feedback.sortNewest', 'Newest first') },
    { value: 'oldest', label: t('argus.feedback.sortOldest', 'Oldest first') },
  ];

  // ─── RENDER ───
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 120px)' }}>
      {/* Header */}
      <Box sx={{ mb: 1.5, display: 'flex', alignItems: 'center', gap: 1.5, flexShrink: 0 }}>
        <FeedbackIcon sx={{ fontSize: 26, color: '#7c4dff' }} />
        <Typography variant="h5" fontWeight={700}>
          {t('argus.feedback.title')}
        </Typography>
        {!loading && total > 0 && (
          <Chip label={formatCompactNumber(total)} size="small" sx={{
            fontWeight: 700, fontSize: '0.75rem', height: 22,
            backgroundColor: alpha('#7c4dff', 0.1), color: '#7c4dff', border: 'none',
          }} />
        )}
        <Box sx={{ flex: 1 }} />
        {/* Stats toggle */}
        <Button
          size="small"
          startIcon={statsCollapsed ? <ExpandMoreIcon /> : <ExpandLessIcon />}
          onClick={() => setStatsCollapsed(!statsCollapsed)}
          sx={{ textTransform: 'none', fontSize: '0.72rem', color: 'text.secondary' }}
        >
          {statsCollapsed ? t('argus.feedback.showStats', 'Show Stats') : t('argus.feedback.hideStats', 'Hide Stats')}
        </Button>
        <Tooltip title={t('argus.feedback.spamFilter', 'Spam Filter')}>
          <Button
            size="small"
            startIcon={<FilterListIcon />}
            onClick={() => { setSpamFilterOpen(true); fetchSpamKeywords(); }}
            sx={{ textTransform: 'none', fontSize: '0.72rem', color: 'text.secondary' }}
          >
            {t('argus.feedback.spamFilter', 'Spam Filter')}
          </Button>
        </Tooltip>
      </Box>

      {/* Collapsible Stats */}
      <Collapse in={!statsCollapsed} sx={{ flexShrink: 0 }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(4, 1fr) 1.5fr' }, gap: 1.5, mb: 1.5 }}>
          {statCards.map((card, idx) => (
            <Paper key={idx} elevation={0} sx={{
              p: 1.5,
              background: isDark
                ? `linear-gradient(135deg, ${alpha(card.color, 0.12)}, ${alpha(card.color, 0.03)})`
                : `linear-gradient(135deg, ${alpha(card.color, 0.06)}, ${alpha(card.color, 0.01)})`,
              border: `1px solid ${alpha(card.color, 0.2)}`,
              borderRadius: 2, display: 'flex', alignItems: 'center', gap: 1,
            }}>
              <Box sx={{
                width: 32, height: 32, borderRadius: 1.5,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                backgroundColor: alpha(card.color, isDark ? 0.2 : 0.1), color: card.color,
              }}>
                {React.cloneElement(card.icon, { sx: { fontSize: 16 } })}
              </Box>
              <Box>
                {loading ? <Skeleton width={40} height={20} /> : (
                  <Tooltip title={typeof card.value === 'number' && needsCompactTooltip(card.value) ? formatWithCommas(card.value) : ''} arrow placement="top">
                    <Typography variant="h6" fontWeight={800} sx={{ lineHeight: 1.1, fontSize: '0.95rem' }}>
                      {typeof card.value === 'number' ? formatCompactNumber(card.value) : card.value ?? '-'}
                    </Typography>
                  </Tooltip>
                )}
                <Typography variant="caption" sx={{ color: isDark ? '#888' : '#777', fontWeight: 500, fontSize: '0.58rem' }}>
                  {card.label}
                </Typography>
              </Box>
            </Paper>
          ))}
          {/* Compact Trend Chart */}
          <Paper elevation={0} sx={{ p: 1.5, border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`, borderRadius: 2 }}>
            <Box sx={{ height: 60 }}>
              {loading ? <ArgusChartSkeleton type="bar" height={60} color="#7c4dff" /> : <Bar data={trendChartData} options={chartOpts as any} />}
            </Box>
          </Paper>
        </Box>
      </Collapse>

      {/* Filter Bar + Search + Sort */}
      <Box sx={{ flexShrink: 0, mb: 1 }}>
        <ArgusFilterBar
          projectId={projectId}
          value={filters}
          onChange={handleFilterChange}
          onRefresh={fetchData}
          loading={loading}
          extraControls={
            <>
              <Box sx={{ height: 20, borderLeft: '1px solid', borderColor: 'divider', mx: 0.25 }} />
              <TextField
                size="small"
                placeholder={t('argus.feedback.searchPlaceholder', 'Search by name, email, or message...')}
                value={search}
                onChange={(e) => { setSearch(e.target.value); setUrlState({ page: '1' }); }}
                InputProps={{
                  startAdornment: <InputAdornment position="start"><SearchIcon sx={{ fontSize: 14, color: 'text.disabled' }} /></InputAdornment>,
                  endAdornment: search ? (
                    <InputAdornment position="end">
                      <IconButton size="small" onClick={() => { setSearch(''); setUrlState({ page: '1' }); }} sx={{ p: 0.2 }}>
                        <CloseIcon sx={{ fontSize: 14 }} />
                      </IconButton>
                    </InputAdornment>
                  ) : null,
                }}
                sx={{
                  minWidth: 300,
                  '& .MuiOutlinedInput-root': { borderRadius: '6px', fontSize: '0.75rem', height: 26, backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)' },
                  '& .MuiOutlinedInput-input': { py: 0.3 },
                }}
              />
              <Box sx={{ height: 20, borderLeft: '1px solid', borderColor: 'divider', mx: 0.25 }} />
              {/* Sort Button */}
              <Box
                onClick={(e) => setSortAnchor(e.currentTarget)}
                sx={{
                  display: 'inline-flex', alignItems: 'center', gap: 0.5,
                  height: 26, px: 1, borderRadius: '6px',
                  border: '1px solid', borderColor: sortAnchor ? 'primary.main' : 'divider',
                  cursor: 'pointer', transition: 'all 0.15s', userSelect: 'none',
                  '&:hover': { borderColor: 'primary.main' },
                }}
              >
                <SortIcon sx={{ fontSize: 13, color: 'text.secondary' }} />
                <Typography sx={{ fontSize: '0.7rem', fontWeight: 600, color: 'text.secondary' }}>
                  {SORT_OPTIONS.find(o => o.value === sortOrder)?.label || 'Sort'}
                </Typography>
              </Box>
              <Popover
                open={Boolean(sortAnchor)}
                anchorEl={sortAnchor}
                onClose={() => setSortAnchor(null)}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
                slotProps={{ paper: { sx: { mt: 0.5, borderRadius: '8px', boxShadow: '0 4px 20px rgba(0,0,0,0.12)', py: 0.5 } } }}
              >
                {SORT_OPTIONS.map(opt => (
                  <Box
                    key={opt.value}
                    onClick={() => { setUrlState({ sort: opt.value, page: '1' }); setSortAnchor(null); }}
                    sx={{
                      px: 1.5, py: 0.6, cursor: 'pointer', fontSize: '0.78rem',
                      fontWeight: opt.value === sortOrder ? 700 : 400,
                      color: opt.value === sortOrder ? 'primary.main' : 'text.primary',
                      backgroundColor: opt.value === sortOrder ? alpha(theme.palette.primary.main, 0.06) : 'transparent',
                      '&:hover': { backgroundColor: alpha(theme.palette.primary.main, 0.04) },
                    }}
                  >
                    {opt.label}
                  </Box>
                ))}
              </Popover>
            </>
          }
        />
      </Box>

      {/* Status Tabs */}
      <Tabs
        value={statusTab}
        onChange={(_, v) => { setUrlState({ status: v, page: '1', fb: '' }); setSelectedIds(new Set()); }}
        sx={{
          mb: 1, minHeight: 30, flexShrink: 0,
          '& .MuiTab-root': { minHeight: 30, py: 0.3, textTransform: 'none', fontSize: '0.75rem', fontWeight: 600 },
          '& .MuiTabs-indicator': { height: 2 },
        }}
      >
        <Tab value="unresolved" label={`${t('argus.feedback.statusUnresolved', 'Unresolved')} (${formatCompactNumber(unresolvedCount)})`} />
        <Tab value="resolved" label={`${t('argus.feedback.statusResolved', 'Resolved')} (${formatCompactNumber(resolvedCount)})`} />
        <Tab value="spam" label={`${t('argus.feedback.statusSpam', 'Spam')} (${formatCompactNumber(spamCount)})`} />
        <Tab value="" label={t('argus.feedback.statusAll', 'All')} />
      </Tabs>

      {/* Bulk Action Toolbar */}
      {selectedIds.size > 0 && (
        <Paper elevation={0} sx={{
          mb: 1, p: 0.8, display: 'flex', alignItems: 'center', gap: 1,
          border: `1px solid ${alpha('#7c4dff', 0.3)}`, borderRadius: 1.5,
          backgroundColor: alpha('#7c4dff', 0.04), flexShrink: 0,
        }}>
          <Typography variant="body2" fontWeight={600} sx={{ fontSize: '0.76rem' }}>
            {selectedIds.size} {t('argus.issues.selected', 'selected')}
          </Typography>
          <Button size="small" startIcon={<ResolveIcon />} onClick={() => handleBulkAction('resolve')}
            sx={{ textTransform: 'none', fontSize: '0.72rem', borderRadius: '6px' }}>
            {t('argus.feedback.resolve', 'Resolve')}
          </Button>
          <Button size="small" startIcon={<SpamIcon />} onClick={() => handleBulkAction('spam')}
            sx={{ textTransform: 'none', fontSize: '0.72rem', borderRadius: '6px' }}>
            {t('argus.feedback.markSpam', 'Spam')}
          </Button>
          <Button size="small" startIcon={<AssignIcon />} onClick={(e) => setBulkAssignAnchor(e.currentTarget)}
            sx={{ textTransform: 'none', fontSize: '0.72rem', borderRadius: '6px' }}>
            {t('argus.feedback.assign', 'Assign')}
          </Button>
          <Button size="small" onClick={() => setSelectedIds(new Set())}
            sx={{ textTransform: 'none', fontSize: '0.72rem', ml: 'auto' }}>
            {t('common.cancel', 'Cancel')}
          </Button>
        </Paper>
      )}

      {/* ═══════ SPLIT-PANEL INBOX ═══════ */}
      <Box sx={{ flex: 1, display: 'flex', gap: 0, overflow: 'hidden', border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`, borderRadius: 2 }}>

        {/* ─── LEFT: Feedback List ─── */}
        <Box sx={{
          width: selectedItem ? 380 : '100%', minWidth: 340, flexShrink: 0,
          borderRight: selectedItem ? `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}` : 'none',
          display: 'flex', flexDirection: 'column', transition: 'width 0.2s', overflow: 'hidden',
        }}>
          <PageContentLoader loading={loading} skeleton={<ListSkeleton rows={8} />} sx={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            {items.length === 0 ? (
              <Box sx={{ py: 8, textAlign: 'center', flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <FeedbackIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
                <Typography color="text.secondary">{t('argus.feedback.noFeedback')}</Typography>
              </Box>
            ) : (
              <Box sx={{ flex: 1, overflow: 'auto' }}>
                {items.map((item) => {
                  const displayName = item.name || item.email?.split('@')[0] || t('argus.feedback.anonymous');
                  const isSelected = selectedIds.has(item.feedback_id);
                  const isActive = selectedFbId === item.feedback_id;
                  return (
                    <Box
                      key={item.feedback_id}
                      onClick={() => setUrlState({ fb: item.feedback_id })}
                      sx={{
                        display: 'flex', alignItems: 'flex-start', gap: 1,
                        px: 1.5, py: 1.2, cursor: 'pointer',
                        borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}`,
                        backgroundColor: isActive
                          ? alpha('#7c4dff', isDark ? 0.12 : 0.06)
                          : isSelected
                            ? alpha('#7c4dff', 0.03)
                            : 'transparent',
                        borderLeft: isActive ? `3px solid #7c4dff` : '3px solid transparent',
                        transition: 'all 0.1s',
                        '&:hover': { backgroundColor: isActive ? alpha('#7c4dff', isDark ? 0.15 : 0.08) : isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.015)' },
                      }}
                    >
                      <Checkbox
                        size="small"
                        checked={isSelected}
                        onChange={(e) => { e.stopPropagation(); toggleSelect(item.feedback_id); }}
                        onClick={(e) => e.stopPropagation()}
                        sx={{ p: 0.2, mt: 0.2 }}
                      />
                      <Box sx={{
                        width: 6, height: 6, borderRadius: '50%', mt: 0.8, flexShrink: 0,
                        backgroundColor: statusColor(item.status),
                      }} />
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.2 }}>
                          <Typography variant="body2" fontWeight={600} noWrap sx={{ fontSize: '0.8rem', flex: 1 }}>
                            <HighlightText text={displayName} highlight={searchDebounce} isDark={isDark} />
                          </Typography>
                          <Typography variant="caption" sx={{ color: isDark ? '#666' : '#999', fontSize: '0.62rem', flexShrink: 0 }}>
                            {formatRelative(item.submitted_at, t)}
                          </Typography>
                        </Box>
                        <Typography variant="caption" noWrap sx={{
                          color: isDark ? '#999' : '#666', fontSize: '0.72rem', display: 'block',
                          lineHeight: 1.4, maxHeight: '2.8em', overflow: 'hidden',
                        }}>
                          <HighlightText text={item.message} highlight={searchDebounce} isDark={isDark} />
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 0.5, mt: 0.4, flexWrap: 'wrap' }}>
                          {item.issue_id && (
                            <Chip icon={<BugReportIcon sx={{ fontSize: '10px !important' }} />} label={`#${item.issue_id}`}
                              size="small" sx={{ height: 16, fontSize: '0.55rem', backgroundColor: alpha('#f44336', 0.08), color: '#f44336', border: 'none', '& .MuiChip-icon': { color: '#f44336' } }} />
                          )}
                          {item.attachments?.length > 0 && (
                            <Chip icon={<ImageIcon sx={{ fontSize: '10px !important' }} />} label={item.attachments.length}
                              size="small" sx={{ height: 16, fontSize: '0.55rem', backgroundColor: alpha('#2196f3', 0.08), color: '#2196f3', border: 'none', '& .MuiChip-icon': { color: '#2196f3' } }} />
                          )}
                          {item.assigned_to && (
                            <Chip label={item.assigned_to} size="small"
                              sx={{ height: 16, fontSize: '0.55rem', backgroundColor: alpha('#4caf50', 0.08), color: '#4caf50', border: 'none' }} />
                          )}
                        </Box>
                      </Box>
                    </Box>
                  );
                })}
              </Box>
            )}

            {/* Pagination */}
            {total > 0 && (
              <Box sx={{ flexShrink: 0, borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}` }}>
                <SimplePagination
                  count={total}
                  page={page - 1}
                  rowsPerPage={rowsPerPage}
                  onPageChange={(_, newPage) => setUrlState({ page: String(newPage + 1) })}
                  onRowsPerPageChange={(e) => {
                    setRowsPerPage(Number(e.target.value));
                    setUrlState({ page: '1' });
                  }}
                  rowsPerPageOptions={VALID_PAGE_SIZES}
                  size="small"
                />
              </Box>
            )}
          </PageContentLoader>
        </Box>

        {/* ─── RIGHT: Detail Panel ─── */}
        {selectedItem && (
          <Box sx={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
            {/* Detail Header */}
            <Box sx={{
              px: 2.5, py: 1.5, display: 'flex', alignItems: 'center', gap: 1.5,
              borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
              backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.015)',
              flexShrink: 0,
            }}>
              <Avatar sx={{ width: 36, height: 36, fontSize: '0.8rem', fontWeight: 700, backgroundColor: stringToColor(selectedItem.name || selectedItem.email || 'A') }}>
                {getInitials(selectedItem.name || selectedItem.email?.split('@')[0] || 'A')}
              </Avatar>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="body1" fontWeight={700} sx={{ fontSize: '0.9rem' }}>
                  {selectedItem.name || selectedItem.email?.split('@')[0] || t('argus.feedback.anonymous')}
                </Typography>
                {selectedItem.email && (
                  <Typography variant="caption" sx={{ color: isDark ? '#888' : '#777', fontSize: '0.72rem' }}>
                    {selectedItem.email}
                  </Typography>
                )}
              </Box>
              <Chip
                label={t(`argus.feedback.status${(selectedItem.status || 'unresolved').charAt(0).toUpperCase() + (selectedItem.status || 'unresolved').slice(1)}`, selectedItem.status)}
                size="small"
                sx={{ height: 22, fontSize: '0.68rem', fontWeight: 700, backgroundColor: alpha(statusColor(selectedItem.status), 0.12), color: statusColor(selectedItem.status), border: 'none' }}
              />
              <Typography variant="caption" sx={{ color: isDark ? '#666' : '#999', fontSize: '0.68rem' }}>
                {formatRelative(selectedItem.submitted_at, t)}
              </Typography>
            </Box>

            {/* Detail Actions */}
            <Box sx={{
              px: 2.5, py: 1, display: 'flex', alignItems: 'center', gap: 1,
              borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
              flexShrink: 0,
            }}>
              {selectedItem.status !== 'resolved' ? (
                <Button size="small" variant="contained" startIcon={<ResolveIcon />}
                  onClick={() => handleUpdateStatus(selectedItem.feedback_id, 'resolved')}
                  sx={{ textTransform: 'none', fontSize: '0.72rem', borderRadius: '6px', backgroundColor: '#4caf50', '&:hover': { backgroundColor: '#43a047' } }}>
                  {t('argus.feedback.resolve', 'Resolve')}
                </Button>
              ) : (
                <Button size="small" variant="outlined" startIcon={<UnresolveIcon />}
                  onClick={() => handleUpdateStatus(selectedItem.feedback_id, 'unresolved')}
                  sx={{ textTransform: 'none', fontSize: '0.72rem', borderRadius: '6px' }}>
                  {t('argus.feedback.unresolve', 'Reopen')}
                </Button>
              )}
              {!selectedItem.is_spam && (
                <Button size="small" variant="outlined" startIcon={<SpamIcon />}
                  onClick={() => handleMarkSpam(selectedItem.feedback_id)}
                  sx={{ textTransform: 'none', fontSize: '0.72rem', borderRadius: '6px', color: '#9e9e9e', borderColor: '#9e9e9e' }}>
                  {t('argus.feedback.markSpam', 'Spam')}
                </Button>
              )}
              <Button size="small" variant="outlined" startIcon={<AssignIcon />}
                onClick={(e) => setAssigneeAnchor({ el: e.currentTarget, feedbackId: selectedItem.feedback_id })}
                sx={{ textTransform: 'none', fontSize: '0.72rem', borderRadius: '6px' }}>
                {selectedItem.assigned_to || t('argus.feedback.assign', 'Assign')}
              </Button>
              <Box sx={{ flex: 1 }} />
              {selectedItem.issue_id ? (
                <Button size="small" variant="outlined" startIcon={<BugReportIcon />}
                  onClick={() => navigate(`/argus/issues/${projectId}/${selectedItem.issue_id}`)}
                  sx={{ textTransform: 'none', fontSize: '0.72rem', borderRadius: '6px', color: '#f44336', borderColor: alpha('#f44336', 0.3) }}>
                  {t('argus.feedback.viewIssue', 'Issue')} #{selectedItem.issue_id}
                </Button>
              ) : (
                <Button size="small" variant="outlined" startIcon={<AddIcon />}
                  onClick={async () => {
                    setCreateIssueFeedbackId(selectedItem.feedback_id);
                    setCreateIssueTitle(`[Feedback] ${selectedItem.message.slice(0, 80)}`);
                    setSelectedTrackerId('');
                    try { setIssueTrackers(await argusService.listIssueTrackers(projectId)); } catch { /* ok */ }
                    setCreateIssueOpen(true);
                  }}
                  sx={{ textTransform: 'none', fontSize: '0.72rem', borderRadius: '6px' }}>
                  {t('argus.feedback.createIssue', 'Create Issue')}
                </Button>
              )}
            </Box>

            {/* Detail Body */}
            <Box sx={{ flex: 1, overflow: 'auto', px: 2.5, py: 2 }}>
              {/* Message */}
              <Paper elevation={0} sx={{
                p: 2, mb: 2, borderRadius: 2,
                border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
                backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)',
              }}>
                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.8, fontSize: '0.88rem' }}>
                  {selectedItem.message}
                </Typography>
              </Paper>

              {/* Attachments */}
              {selectedItem.attachments?.length > 0 && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="caption" fontWeight={600} sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1, fontSize: '0.72rem', color: 'text.secondary' }}>
                    <ImageIcon sx={{ fontSize: 14 }} /> {t('argus.feedback.attachments', 'Attachments')} ({selectedItem.attachments.length})
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    {selectedItem.attachments.map((url, ai) => (
                      <Box
                        key={ai}
                        onClick={() => setLightboxUrl(url)}
                        sx={{
                          width: 100, height: 75, borderRadius: 1.5, overflow: 'hidden',
                          border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
                          cursor: 'pointer', transition: 'all 0.15s',
                          '&:hover': { borderColor: '#7c4dff', transform: 'scale(1.03)' },
                        }}
                      >
                        <img src={url} alt={`attachment-${ai}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      </Box>
                    ))}
                  </Box>
                </Box>
              )}

              {/* Metadata Section */}
              <Typography variant="caption" fontWeight={600} sx={{ display: 'block', mb: 1, fontSize: '0.72rem', color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                {t('argus.feedback.metadata', 'Context')}
              </Typography>
              <Paper elevation={0} sx={{
                mb: 2, borderRadius: 2, overflow: 'hidden',
                border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
              }}>
                {[
                  { icon: <UrlIcon sx={{ fontSize: 14 }} />, label: 'URL', value: selectedItem.url },
                  { icon: <MailIcon sx={{ fontSize: 14 }} />, label: t('argus.feedback.contactEmail', 'Contact'), value: selectedItem.contact_email },
                  { icon: <EnvIcon sx={{ fontSize: 14 }} />, label: t('argus.feedback.environment', 'Environment'), value: selectedItem.environment },
                  { icon: <ReleaseIcon sx={{ fontSize: 14 }} />, label: t('argus.feedback.release', 'Release'), value: selectedItem.release },
                  { icon: <SourceIcon sx={{ fontSize: 14 }} />, label: t('argus.feedback.source', 'Source'), value: selectedItem.source },
                ].filter(row => row.value).map((row, idx) => (
                  <Box key={idx} sx={{
                    display: 'flex', alignItems: 'center', gap: 1.5, px: 1.5, py: 0.8,
                    borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)'}`,
                    '&:last-child': { borderBottom: 'none' },
                  }}>
                    <Box sx={{ color: isDark ? '#666' : '#aaa', display: 'flex' }}>{row.icon}</Box>
                    <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', fontSize: '0.7rem', minWidth: 80 }}>
                      {row.label}
                    </Typography>
                    <Typography variant="caption" sx={{ fontSize: '0.72rem', fontFamily: 'monospace', wordBreak: 'break-all', flex: 1 }}>
                      {row.value}
                    </Typography>
                  </Box>
                ))}
              </Paper>

              {/* Tags */}
              {selectedItem.tags && Object.keys(selectedItem.tags).length > 0 && (
                <>
                  <Typography variant="caption" fontWeight={600} sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1, fontSize: '0.72rem', color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    <TagIcon sx={{ fontSize: 14 }} /> {t('argus.feedback.tags', 'Tags')}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 2 }}>
                    {Object.entries(selectedItem.tags).map(([k, v]) => (
                      <Chip
                        key={k}
                        label={`${k}: ${v}`}
                        size="small"
                        sx={{ height: 22, fontSize: '0.65rem', fontFamily: 'monospace', backgroundColor: alpha(theme.palette.primary.main, 0.08), border: 'none' }}
                      />
                    ))}
                  </Box>
                </>
              )}
            </Box>
          </Box>
        )}

        {/* Empty Detail Placeholder */}
        {!selectedItem && items.length > 0 && !loading && (
          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'text.disabled' }}>
            <FeedbackIcon sx={{ fontSize: 56, mb: 1, opacity: 0.3 }} />
            <Typography variant="body2" sx={{ fontSize: '0.85rem' }}>
              {t('argus.feedback.selectToView', 'Select a feedback to view details')}
            </Typography>
          </Box>
        )}
      </Box>

      {/* ═══════ DIALOGS & MENUS ═══════ */}

      {/* Spam Filter Dialog */}
      <Dialog open={spamFilterOpen} onClose={() => setSpamFilterOpen(false)} maxWidth="sm" fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ fontSize: '0.9rem', fontWeight: 700, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <FilterListIcon sx={{ fontSize: 20, color: '#ff9800' }} />
            {t('argus.feedback.spamFilter', 'Spam Filter')}
          </Box>
          <IconButton size="small" onClick={() => setSpamFilterOpen(false)}><CloseIcon fontSize="small" /></IconButton>
        </DialogTitle>
        <DialogContent>
          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 2, fontSize: '0.75rem' }}>
            {t('argus.feedback.spamFilterDesc', 'Add keywords to automatically detect and mark spam feedback. Supports plain text and regex patterns.')}
          </Typography>

          {/* Add keyword */}
          <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
            <TextField
              size="small" fullWidth
              placeholder={t('argus.feedback.spamKeywordPlaceholder', 'Enter keyword or regex...')}
              value={newKeyword}
              onChange={(e) => setNewKeyword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddKeyword()}
              sx={{ '& .MuiOutlinedInput-root': { fontSize: '0.82rem' } }}
            />
            <Tooltip title={t('argus.feedback.regexToggle', 'Regex pattern')}>
              <Chip
                label=".*"
                size="small"
                onClick={() => setNewKeywordRegex(!newKeywordRegex)}
                sx={{
                  height: 32, fontFamily: 'monospace', fontWeight: 700, cursor: 'pointer',
                  backgroundColor: newKeywordRegex ? alpha('#ff9800', 0.15) : 'transparent',
                  color: newKeywordRegex ? '#ff9800' : 'text.disabled',
                  border: `1px solid ${newKeywordRegex ? '#ff9800' : 'rgba(128,128,128,0.3)'}`,
                }}
              />
            </Tooltip>
            <Button variant="contained" size="small" onClick={handleAddKeyword}
              disabled={!newKeyword.trim()}
              sx={{ textTransform: 'none', minWidth: 60, fontWeight: 700 }}>
              {t('common.add', 'Add')}
            </Button>
          </Box>

          {/* Keyword list */}
          {spamKeywords.length === 0 ? (
            <Box sx={{ py: 3, textAlign: 'center' }}>
              <FilterListIcon sx={{ fontSize: 36, color: 'text.disabled', mb: 1 }} />
              <Typography color="text.disabled" sx={{ fontSize: '0.82rem' }}>
                {t('argus.feedback.noSpamKeywords', 'No spam keywords configured')}
              </Typography>
            </Box>
          ) : (
            <Box sx={{ maxHeight: 240, overflow: 'auto' }}>
              {spamKeywords.map((kw) => (
                <Box key={kw.id} sx={{
                  display: 'flex', alignItems: 'center', gap: 1, px: 1.5, py: 0.8,
                  borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}`,
                  '&:hover': { backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)' },
                }}>
                  <Typography sx={{ flex: 1, fontSize: '0.82rem', fontFamily: 'monospace' }}>
                    {kw.keyword}
                  </Typography>
                  {kw.is_regex && (
                    <Chip label="regex" size="small" sx={{
                      height: 18, fontSize: '0.58rem', fontWeight: 700,
                      backgroundColor: alpha('#ff9800', 0.1), color: '#ff9800', border: 'none',
                    }} />
                  )}
                  <IconButton size="small" onClick={() => handleDeleteKeyword(kw.id)}
                    sx={{ color: 'text.disabled', '&:hover': { color: '#f44336' } }}>
                    <DeleteIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                </Box>
              ))}
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, justifyContent: 'space-between' }}>
          <Button
            variant="outlined" size="small"
            startIcon={<RunIcon />}
            onClick={handleRunAutoSpam}
            disabled={spamScanLoading || spamKeywords.length === 0}
            sx={{ textTransform: 'none', fontSize: '0.78rem', fontWeight: 600 }}
          >
            {spamScanLoading
              ? t('common.loading', 'Loading...')
              : t('argus.feedback.runSpamScan', 'Run Spam Scan')}
          </Button>
          <Button onClick={() => setSpamFilterOpen(false)} sx={{ textTransform: 'none' }}>
            {t('common.close', 'Close')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Create Issue Dialog */}
      <Dialog open={createIssueOpen} onClose={() => setCreateIssueOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontSize: '0.9rem', fontWeight: 700 }}>
          {t('argus.feedback.createIssue', 'Create Issue from Feedback')}
        </DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            size="small"
            label={t('argus.feedback.issueTitle', 'Issue Title')}
            value={createIssueTitle}
            onChange={(e) => setCreateIssueTitle(e.target.value)}
            sx={{ mt: 1 }}
          />

          {/* Issue Tracker Selection */}
          <FormControl fullWidth size="small" sx={{ mt: 2 }}>
            <InputLabel sx={{ fontSize: '0.82rem' }}>{t('argus.feedback.issueTracker', 'Issue Tracker')}</InputLabel>
            <Select
              value={selectedTrackerId}
              onChange={(e) => setSelectedTrackerId(e.target.value as number | '')}
              label={t('argus.feedback.issueTracker', 'Issue Tracker')}
              sx={{ fontSize: '0.82rem' }}
            >
              <MenuItem value="" sx={{ fontSize: '0.82rem' }}>
                <em>{t('argus.feedback.internalOnly', 'Internal Only (Argus)')}</em>
              </MenuItem>
              {issueTrackers.filter(tr => tr.enabled).map(tracker => (
                <MenuItem key={tracker.id} value={tracker.id} sx={{ fontSize: '0.82rem' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Chip
                      label={tracker.provider.toUpperCase()}
                      size="small"
                      sx={{
                        height: 18, fontSize: '0.6rem', fontWeight: 700,
                        backgroundColor: tracker.provider === 'jira' ? 'rgba(0,82,204,0.1)' : tracker.provider === 'linear' ? 'rgba(94,106,210,0.1)' : 'rgba(0,0,0,0.06)',
                        color: tracker.provider === 'jira' ? '#0052CC' : tracker.provider === 'linear' ? '#5E6AD2' : '#333',
                        border: 'none',
                      }}
                    />
                    {tracker.name}
                  </Box>
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {selectedItem && (
            <Paper elevation={0} sx={{ mt: 2, p: 1.5, backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)', borderRadius: 1.5 }}>
              <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', fontSize: '0.68rem' }}>
                {t('argus.feedback.feedbackMessage', 'Feedback Message')}:
              </Typography>
              <Typography variant="body2" sx={{ mt: 0.5, fontSize: '0.8rem', whiteSpace: 'pre-wrap', maxHeight: 120, overflow: 'auto' }}>
                {selectedItem.message}
              </Typography>
            </Paper>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateIssueOpen(false)} sx={{ textTransform: 'none' }}>
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button variant="contained" onClick={handleCreateIssue} disabled={!createIssueTitle.trim()}
            sx={{ textTransform: 'none' }}>
            {t('argus.feedback.createIssue', 'Create Issue')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Lightbox */}
      <Dialog open={Boolean(lightboxUrl)} onClose={() => setLightboxUrl(null)} maxWidth="lg">
        <DialogContent sx={{ p: 0, position: 'relative' }}>
          <IconButton
            onClick={() => setLightboxUrl(null)}
            sx={{ position: 'absolute', top: 8, right: 8, backgroundColor: 'rgba(0,0,0,0.5)', color: '#fff', '&:hover': { backgroundColor: 'rgba(0,0,0,0.7)' } }}
          >
            <CloseIcon />
          </IconButton>
          {lightboxUrl && (
            <img src={lightboxUrl} alt="attachment" style={{ maxWidth: '90vw', maxHeight: '80vh', display: 'block' }} />
          )}
        </DialogContent>
      </Dialog>

      {/* Assignee Menu */}
      <Menu
        anchorEl={assigneeAnchor?.el}
        open={Boolean(assigneeAnchor)}
        onClose={() => setAssigneeAnchor(null)}
        slotProps={{ paper: { sx: { borderRadius: 2, minWidth: 160, maxHeight: 300, boxShadow: '0 4px 20px rgba(0,0,0,0.12)' } } }}
      >
        <MenuItem onClick={() => handleAssignFeedback(assigneeAnchor?.feedbackId || '', '')}>
          <ListItemIcon><PersonIcon sx={{ fontSize: 18 }} /></ListItemIcon>
          <ListItemText primary={t('argus.issues.unassigned', 'Unassigned')} primaryTypographyProps={{ fontSize: '0.82rem' }} />
        </MenuItem>
        <Divider />
        {members.map(member => {
          const dn = member.name || member.email || member.userId;
          return (
            <MenuItem key={member.userId} onClick={() => handleAssignFeedback(assigneeAnchor?.feedbackId || '', dn)}>
              <Avatar sx={{ width: 20, height: 20, mr: 1, fontSize: '0.55rem', fontWeight: 700, backgroundColor: stringToColor(dn) }}>
                {getInitials(dn)}
              </Avatar>
              <ListItemText primary={dn} primaryTypographyProps={{ fontSize: '0.82rem' }} />
            </MenuItem>
          );
        })}
      </Menu>

      {/* Bulk Assignee Menu */}
      <Menu
        anchorEl={bulkAssignAnchor}
        open={Boolean(bulkAssignAnchor)}
        onClose={() => setBulkAssignAnchor(null)}
        slotProps={{ paper: { sx: { borderRadius: 2, minWidth: 160, maxHeight: 300, boxShadow: '0 4px 20px rgba(0,0,0,0.12)' } } }}
      >
        <MenuItem onClick={() => handleBulkAssign('')}>
          <ListItemIcon><PersonIcon sx={{ fontSize: 18 }} /></ListItemIcon>
          <ListItemText primary={t('argus.issues.unassigned', 'Unassigned')} primaryTypographyProps={{ fontSize: '0.82rem' }} />
        </MenuItem>
        <Divider />
        {members.map(member => {
          const dn = member.name || member.email || member.userId;
          return (
            <MenuItem key={member.userId} onClick={() => handleBulkAssign(dn)}>
              <Avatar sx={{ width: 20, height: 20, mr: 1, fontSize: '0.55rem', fontWeight: 700, backgroundColor: stringToColor(dn) }}>
                {getInitials(dn)}
              </Avatar>
              <ListItemText primary={dn} primaryTypographyProps={{ fontSize: '0.82rem' }} />
            </MenuItem>
          );
        })}
      </Menu>
    </Box>
  );
};

export default ArgusFeedbackPage;

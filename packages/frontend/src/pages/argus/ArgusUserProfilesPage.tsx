import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  useTheme,
  alpha,
  TextField,
  InputAdornment,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  TableContainer,
  TableSortLabel,
  Chip,
  IconButton,
  Tooltip,
  Divider,
  Button,
  Tabs,
  Tab,
  Skeleton,
  Paper,
  CircularProgress,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import {
  Search as SearchIcon,
  Person as PersonIcon,
  Close as CloseIcon,
  Public as GlobeIcon,
  Devices as DevicesIcon,
  Schedule as ScheduleIcon,
  Event as EventIcon,
  Folder as SessionIcon,
  ExpandMore as ExpandMoreIcon,
  ShoppingCart as PurchaseIcon,
  EmojiEvents as TrophyIcon,
  Error as ErrorIcon,
  Login as LoginIcon,
  Star as StarIcon,
  StarBorder as StarBorderIcon,
  ContentCopy as CopyIcon,
  Check as CheckIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import ResizableDrawer from '@/components/common/ResizableDrawer';
import PageHeader from '@/components/common/PageHeader';
import PageContentLoader from '@/components/common/PageContentLoader';
import EmptyPagePlaceholder from '@/components/common/EmptyPagePlaceholder';
import ArgusBreadcrumbs from '@/components/argus/ArgusBreadcrumbs';
import DateRangeSelector, {
  DateRangeValue,
  dateRangeToApiParams,
} from '@/components/common/DateRangeSelector';
import SimplePagination from '@/components/common/SimplePagination';
import useGlobalPageSize from '@/hooks/useGlobalPageSize';
import { useOrgProject } from '@/contexts/OrgProjectContext';
import ArgusSparkline from '@/components/argus/ArgusSparkline';
import {
  getUserProfiles,
  getUserProfile,
  getUserEvents,
  getUserSessions,
  getUserProperties,
  getUserCohortMemberships,
  getRevenueUserSummary,
  type UserFinancialResponse,
  type UserFinancialTransaction,
} from '@/services/argus/argusAnalytics';
import type {
  ArgusUserProfile,
  ArgusUserEvent,
  ArgusUserSession,
  ArgusUserProperty,
} from '@/services/argus/argusTypes';
import CohortChip from '@/components/argus/CohortChip';
import type { CohortMembership } from '@/components/argus/CohortChip';
import { downloadCsv, type CsvColumn } from '@/utils/csvExport';
import { ARGUS_SEMANTIC } from './argusThemeTokens';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins < 60) return `${mins}m ${secs}s`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ${mins % 60}m`;
}

// ─── Insight Helpers ─────────────────────────────────────────────────────────

type LifecycleStage = { label: string; bg: string; fg: string };
function computeLifecycleStage(profile: ArgusUserProfile, netRevenue: number): LifecycleStage {
  const daysSinceFirst = (Date.now() - new Date(profile.first_seen).getTime()) / 86400000;
  const daysSinceLast  = (Date.now() - new Date(profile.last_seen).getTime()) / 86400000;
  const isVip = netRevenue >= 100;
  if (daysSinceFirst < 7)   return { label: isVip ? 'NEW VIP' : 'NEW',     bg: '#1565c0', fg: '#90caf9' };
  if (daysSinceLast > 30)   return { label: isVip ? 'DORMANT VIP' : 'DORMANT', bg: '#b71c1c', fg: '#ef9a9a' };
  if (daysSinceLast > 14)   return { label: isVip ? 'AT RISK VIP' : 'AT RISK', bg: '#e65100', fg: '#ffcc80' };
  if (daysSinceLast <= 7)   return { label: isVip ? 'ACTIVE VIP' : 'ACTIVE',  bg: '#1b5e20', fg: '#a5d6a7' };
  return                           { label: isVip ? 'REGULAR VIP' : 'REGULAR', bg: '#37474f', fg: '#b0bec5' };
}

type ChurnRisk = { kind: 'purchase' | 'refund'; msg: string } | null;
function computeChurnRisk(
  lastPurchase: string | null,
  refundRate: number,
  netRevenue: number
): ChurnRisk {
  if (netRevenue > 0 && lastPurchase) {
    const days = Math.floor((Date.now() - new Date(lastPurchase).getTime()) / 86400000);
    if (days > 30) return { kind: 'purchase', msg: `${days}일째 미구매 — 이탈 위험` };
  }
  if (refundRate > 0.2) return { kind: 'refund', msg: `환불율 ${(refundRate * 100).toFixed(0)}% — 결제 이슈 의심` };
  return null;
}

type HeatCell = { dow: number; hour: number; count: number };
function computeHeatmap(evts: ArgusUserEvent[]): HeatCell[] {
  const map: Record<string, HeatCell> = {};
  for (let d = 0; d < 7; d++) for (let h = 0; h < 24; h++) map[`${d}-${h}`] = { dow: d, hour: h, count: 0 };
  evts.forEach(e => { const dt = new Date(e.timestamp); const k = `${dt.getDay()}-${dt.getHours()}`; if (map[k]) map[k].count++; });
  return Object.values(map);
}

type TopProduct = { name: string; count: number; total: number };
function computeTopProducts(purchases: UserFinancialTransaction[]): TopProduct[] {
  const m = new Map<string, TopProduct>();
  purchases.forEach(p => {
    const ex = m.get(p.product_name) ?? { name: p.product_name, count: 0, total: 0 };
    m.set(p.product_name, { ...ex, count: ex.count + 1, total: ex.total + (p.amount || 0) });
  });
  return [...m.values()].sort((a, b) => b.count - a.count || b.total - a.total).slice(0, 5);
}

type SessionStats = { avgDurSec: number; avgGapDays: number; trend: 'up' | 'down' | 'stable' | 'none' };
function computeSessionStats(ss: ArgusUserSession[]): SessionStats {
  if (ss.length === 0) return { avgDurSec: 0, avgGapDays: 0, trend: 'none' };
  const avgDurSec = ss.reduce((a, s) => a + s.duration_seconds, 0) / ss.length;
  const sorted = [...ss].sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
  let avgGapDays = 0;
  if (sorted.length >= 2) {
    const gaps = sorted.slice(1).map((s, i) => (new Date(s.start_time).getTime() - new Date(sorted[i].start_time).getTime()) / 86400000);
    avgGapDays = gaps.reduce((a, b) => a + b, 0) / gaps.length;
  }
  let trend: SessionStats['trend'] = 'none';
  if (ss.length >= 6) {
    const recent = ss.slice(0, 3).reduce((a, s) => a + s.duration_seconds, 0) / 3;
    const older  = ss.slice(3, 6).reduce((a, s) => a + s.duration_seconds, 0) / 3;
    trend = recent > older * 1.1 ? 'up' : recent < older * 0.9 ? 'down' : 'stable';
  }
  return { avgDurSec, avgGapDays, trend };
}

// ─── Copyable Cell Helper ────────────────────────────────────────────────────

const CopyableCell: React.FC<{ value: string; fontSize?: number }> = ({ value, fontSize = 11 }) => {
  const [copied, setCopied] = React.useState(false);
  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(value).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 800);
  };
  if (!value) return <Box sx={{ fontSize, color: 'text.disabled' }}>—</Box>;
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, '&:hover .copy-btn': { opacity: 1 } }}>
      <Box sx={{ fontSize, wordBreak: 'break-all', flex: 1 }}>{value}</Box>
      <IconButton
        className="copy-btn"
        size="small"
        onClick={handleCopy}
        sx={{ opacity: 0, transition: 'opacity 0.15s', p: 0.25, flexShrink: 0 }}
      >
        {copied ? <CheckIcon sx={{ fontSize: 13, color: 'success.main' }} /> : <CopyIcon sx={{ fontSize: 13 }} />}
      </IconButton>
    </Box>
  );
};

// ─── User Profile Drawer ─────────────────────────────────────────────────────

interface UserProfileDrawerProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
  userId: string | null;
}

const UserProfileDrawer: React.FC<UserProfileDrawerProps> = ({
  open,
  onClose,
  projectId,
  userId,
}) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const { t } = useTranslation();

  // Tab for Right column: 0 for Events timeline, 1 for Sessions list
  const [rightTab, setRightTab] = useState(0);

  // Local state for searching/filtering
  const [propertySearch, setPropertySearch] = useState('');
  const [propertySearchDebounced, setPropertySearchDebounced] = useState('');
  const [eventSearch, setEventSearch] = useState('');
  const [eventSearchDebounced, setEventSearchDebounced] = useState('');
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());

  // Finance tab state
  const [finData, setFinData] = useState<UserFinancialResponse | null>(null);
  const [finLoading, setFinLoading] = useState(false);
  const [finLoadedForUser, setFinLoadedForUser] = useState<string | null>(null);
  const [finSubTab, setFinSubTab] = useState(0); // 0=purchases, 1=refunds, 2=grants

  const [profile, setProfile] = useState<ArgusUserProfile | null>(null);
  const [events, setEvents] = useState<ArgusUserEvent[]>([]);
  const [sessions, setSessions] = useState<ArgusUserSession[]>([]);
  const [properties, setProperties] = useState<ArgusUserProperty[]>([]);
  const [loading, setLoading] = useState(false);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [sessionsHasMore, setSessionsHasMore] = useState(false);
  const [sessionsLoadingMore, setSessionsLoadingMore] = useState(false);
  const SESSIONS_PAGE_SIZE = 10;
  const [userCohorts, setUserCohorts] = useState<CohortMembership[]>([]);

  // Debounce property search
  useEffect(() => {
    const timer = setTimeout(() => setPropertySearchDebounced(propertySearch), 250);
    return () => clearTimeout(timer);
  }, [propertySearch]);

  // Debounce event search
  useEffect(() => {
    const timer = setTimeout(() => setEventSearchDebounced(eventSearch), 250);
    return () => clearTimeout(timer);
  }, [eventSearch]);

  // Parallel loading when open/userId changes
  useEffect(() => {
    if (!open || !userId) return;
    setLoading(true);
    setEventsLoading(true);
    setExpandedEventId(null);
    setExpandedDates(new Set());
    setPropertySearch('');
    setPropertySearchDebounced('');
    setEventSearch('');
    setEventSearchDebounced('');
    setRightTab(0);
    // Fix #4: Reset finance data on user change
    setFinData(null);
    setFinLoadedForUser(null);
    setFinSubTab(0);

    Promise.all([
      getUserProfile(projectId, userId).then((p) => setProfile(p)),
      getUserEvents(projectId, userId, { limit: 150 }).then((r) => setEvents(r.data)),
      getUserSessions(projectId, userId, { limit: SESSIONS_PAGE_SIZE }).then((s) => {
        setSessions(s);
        setSessionsHasMore(s.length >= SESSIONS_PAGE_SIZE);
      }),
      getUserProperties(projectId, userId).then((prop) => setProperties(prop)),
      getUserCohortMemberships(projectId, [userId]).then((memberships) => {
        setUserCohorts(memberships[userId] || []);
      }),
    ])
      .catch((error) => {
        console.error('Failed to fetch user details:', error);
      })
      .finally(() => {
        setLoading(false);
        setEventsLoading(false);
      });
  }, [open, userId, projectId]);



  // Sparkline/daily event count chart for the last 30 days
  const dailyActivity = useMemo(() => {
    const days = Array.from({ length: 30 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      d.setHours(0, 0, 0, 0);
      return { dateStr: d.toLocaleDateString(), date: d, count: 0 };
    }).reverse();

    events.forEach((evt) => {
      const evtDate = new Date(evt.timestamp);
      evtDate.setHours(0, 0, 0, 0);
      const dateStr = evtDate.toLocaleDateString();
      const found = days.find((d) => d.dateStr === dateStr);
      if (found) {
        found.count += 1;
      }
    });

    return days;
  }, [events]);

  const maxDailyCount = useMemo(() => {
    return Math.max(...dailyActivity.map((d) => d.count), 1);
  }, [dailyActivity]);

  // ─── Insight computations ────────────────────────────────────────────────────
  const lifecycleStage = useMemo(
    () => profile ? computeLifecycleStage(profile, finData?.summary.net_revenue ?? 0) : null,
    [profile, finData]
  );

  const churnRisk = useMemo(
    () => finData ? computeChurnRisk(finData.summary.last_purchase, finData.summary.refund_rate, finData.summary.net_revenue) : null,
    [finData]
  );

  const heatmap = useMemo(() => computeHeatmap(events), [events]);
  const heatmapMax = useMemo(() => Math.max(...heatmap.map(c => c.count), 1), [heatmap]);

  const topProducts = useMemo(() => finData ? computeTopProducts(finData.purchases) : [], [finData]);

  const sessionStats = useMemo(() => computeSessionStats(sessions), [sessions]);

  // Filtering user properties
  const filteredProperties = useMemo(() => {
    if (!propertySearchDebounced.trim()) return properties;
    const query = propertySearchDebounced.toLowerCase().trim();
    return properties.filter((p) => p.key.toLowerCase().includes(query));
  }, [properties, propertySearchDebounced]);

  // Filtering events
  const filteredEvents = useMemo(() => {
    if (!eventSearchDebounced.trim()) return events;
    const query = eventSearchDebounced.toLowerCase().trim();
    return events.filter(
      (e) =>
          e.event_name.toLowerCase().includes(query) ||
          JSON.stringify(e.properties).toLowerCase().includes(query)
    );
  }, [events, eventSearchDebounced]);

  // Group filtered events by date
  const groupedEvents = useMemo(() => {
    const groups: Record<string, ArgusUserEvent[]> = {};
    filteredEvents.forEach((evt) => {
      const dateStr = new Date(evt.timestamp).toLocaleDateString();
      if (!groups[dateStr]) groups[dateStr] = [];
      groups[dateStr].push(evt);
    });
    return Object.entries(groups);
  }, [filteredEvents]);

  // Category specific icons
  const getEventIcon = (name: string) => {
    const n = name.toLowerCase();
    if (n.includes('purchase') || n.includes('buy') || n.includes('pay')) {
      return <PurchaseIcon sx={{ color: theme.palette.secondary.main, fontSize: 18 }} />;
    }
    if (n.includes('quest') || n.includes('level') || n.includes('achievement')) {
      return <TrophyIcon sx={{ color: '#ffb300', fontSize: 18 }} />;
    }
    if (n.includes('error') || n.includes('crash') || n.includes('fail')) {
      return <ErrorIcon sx={{ color: theme.palette.error.main, fontSize: 18 }} />;
    }
    if (n.includes('login') || n.includes('start') || n.includes('session') || n.includes('join')) {
      return <LoginIcon sx={{ color: theme.palette.primary.main, fontSize: 18 }} />;
    }
    return <EventIcon sx={{ color: 'text.secondary', fontSize: 18 }} />;
  };

  const drawerTitle = useMemo(() => (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
      {profile?.avatar_url ? (
        <Box
          component="img"
          src={profile.avatar_url}
          alt={userId || ''}
          sx={{
            width: 40,
            height: 40,
            borderRadius: '50%',
            objectFit: 'cover',
          }}
        />
      ) : (
        <Box
          sx={{
            width: 40,
            height: 40,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
            color: '#fff',
            fontSize: 18,
            fontWeight: 700,
          }}
        >
          {userId?.[0]?.toUpperCase() || 'U'}
        </Box>
      )}
      <Box sx={{ minWidth: 0 }}>
        <Typography
          variant="subtitle1"
          fontWeight={700}
          sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
        >
          {userId}
        </Typography>
      </Box>
    </Box>
  ), [userId, theme, profile]);

  const drawerSubtitle = useMemo(() => {
    if (!profile) return undefined;
    return t('argus.userProfiles.drawerSubtitle', '{{events}} events · {{sessions}} sessions', {
      events: profile.total_events.toLocaleString(),
      sessions: profile.total_sessions.toLocaleString(),
    });
  }, [profile, t]);

  return (
    <ResizableDrawer
      open={open}
      onClose={onClose}
      title={drawerTitle}
      subtitle={drawerSubtitle}
      storageKey="argus-user-profile-width"
      defaultWidth={900}
      minWidth={600}
      maxWidth={1200}
    >
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', bgcolor: 'background.default' }}>
          <CircularProgress size={32} />
        </Box>
      ) : profile ? (
        <Box sx={{ flex: 1, display: 'flex', minHeight: 0, flexDirection: { xs: 'column', sm: 'row' }, bgcolor: 'background.default' }}>
          
          {/* ─── Left Sidebar (340px) ─── */}
          <Box
            sx={{
              width: { xs: '100%', sm: 340 },
              borderRight: { sm: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}` },
              display: 'flex',
              flexDirection: 'column',
              bgcolor: 'background.paper',
              overflowY: 'auto',
              p: 2,
              gap: 2,
            }}
          >
            {/* Identity Summary Card + Lifecycle Badge */}
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ textTransform: 'uppercase' }}>
                  {t('argus.userProfiles.identitySummary', 'Identity Summary')}
                </Typography>
                {lifecycleStage && (
                  <Chip
                    label={lifecycleStage.label}
                    size="small"
                    sx={{
                      height: 20, fontSize: 10, fontWeight: 800, letterSpacing: 0.6,
                      bgcolor: lifecycleStage.bg,
                      color: lifecycleStage.fg,
                      border: 'none',
                    }}
                  />
                )}
              </Box>
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 1 }}>
                {[
                  { icon: <ScheduleIcon fontSize="inherit" />, label: t('argus.userProfiles.firstSeenLabel', 'First seen'), value: formatRelativeTime(profile.first_seen) },
                  { icon: <ScheduleIcon fontSize="inherit" />, label: t('argus.userProfiles.lastSeenLabel', 'Last seen'), value: formatRelativeTime(profile.last_seen) },
                  { icon: <GlobeIcon fontSize="inherit" />, label: t('argus.userProfiles.countryLabel', 'Country'), value: profile.country || '—' },
                  { icon: <DevicesIcon fontSize="inherit" />, label: t('argus.userProfiles.platformLabel', 'Platform'), value: profile.platform || '—' },
                ].map((card) => (
                  <Paper key={card.label} variant="outlined" sx={{ p: 1, borderRadius: 1.5, bgcolor: 'background.paper' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'text.secondary', mb: 0.2 }}>
                      <Box sx={{ display: 'inline-flex', fontSize: 13 }}>{card.icon}</Box>
                      <Typography variant="caption" sx={{ fontSize: 10 }}>{card.label}</Typography>
                    </Box>
                    <Typography variant="body2" fontWeight={600} sx={{ fontSize: 12 }}>{card.value}</Typography>
                  </Paper>
                ))}
              </Box>
            </Box>

            {/* Cohorts Membership */}
              <Box>
                <Typography variant="caption" color="text.secondary" fontWeight={600} display="block" sx={{ mb: 1, textTransform: 'uppercase' }}>
                  {t('argus.userProfiles.cohortsMembership', 'Cohorts Membership')}
                </Typography>
                {userCohorts.length > 0 ? (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {userCohorts.map((c) => (
                      <CohortChip key={c.id} cohort={c} />
                    ))}
                  </Box>
                ) : (
                  <Typography variant="caption" color="text.secondary">
                    {t('argus.userProfiles.noCohortMembership', 'No cohort membership')}
                  </Typography>
                )}
              </Box>

            {/* Churn Risk Warning */}
            {churnRisk && (
              <Box sx={{
                p: 1.2, borderRadius: 1.5,
                border: '1px solid',
                borderColor: churnRisk.kind === 'purchase' ? 'warning.main' : 'error.main',
                bgcolor: churnRisk.kind === 'purchase'
                  ? (isDark ? 'rgba(255,152,0,0.08)' : 'rgba(255,152,0,0.06)')
                  : (isDark ? 'rgba(244,67,54,0.08)' : 'rgba(244,67,54,0.06)'),
                display: 'flex', alignItems: 'flex-start', gap: 1,
              }}>
                <Typography sx={{ fontSize: 16, lineHeight: 1, mt: 0.1 }}>
                  {churnRisk.kind === 'purchase' ? '⚠️' : '🔴'}
                </Typography>
                <Box>
                  <Typography sx={{ fontSize: 11, fontWeight: 700, color: churnRisk.kind === 'purchase' ? 'warning.main' : 'error.main' }}>
                    {churnRisk.kind === 'purchase' ? '이탈 위험' : '결제 이슈 의심'}
                  </Typography>
                  <Typography sx={{ fontSize: 11, color: 'text.secondary', mt: 0.2 }}>{churnRisk.msg}</Typography>
                </Box>
              </Box>
            )}

            {/* Properties Sidebar with Search */}
            <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 250 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ textTransform: 'uppercase' }}>
                  {t('argus.userProfiles.userProperties', 'User Properties ({{count}})', { count: filteredProperties.length })}
                </Typography>
              </Box>
              <TextField
                placeholder={t('argus.userProfiles.searchPropertiesPlaceholder', 'Search properties...')}
                size="small"
                value={propertySearch}
                onChange={(e) => setPropertySearch(e.target.value)}
                sx={{
                  mb: 1.5,
                  '& .MuiInputBase-root': {
                    height: 32,
                    fontSize: 12,
                  },
                }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon sx={{ fontSize: 16 }} />
                    </InputAdornment>
                  ),
                  endAdornment: propertySearch ? (
                    <InputAdornment position="end">
                      <IconButton
                        size="small"
                        onClick={() => setPropertySearch('')}
                        sx={{ p: 0.25 }}
                      >
                        <CloseIcon sx={{ fontSize: 14 }} />
                      </IconButton>
                    </InputAdornment>
                  ) : null,
                }}
              />
              <TableContainer sx={{ flex: 1, maxHeight: 350, overflowY: 'auto' }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontSize: 12, fontWeight: 700, p: 0.8, bgcolor: 'action.hover' }}>{t('argus.userProfiles.propertyKey', 'Property Key')}</TableCell>
                      <TableCell sx={{ fontSize: 12, fontWeight: 700, p: 0.8, bgcolor: 'action.hover' }}>{t('argus.userProfiles.propertyValue', 'Value')}</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredProperties.map((p) => (
                      <TableRow key={p.key} hover>
                        <TableCell sx={{ p: 0.8, fontSize: 12, wordBreak: 'break-all', maxWidth: 120 }}>{p.key}</TableCell>
                        <TableCell sx={{ p: 0.8, fontSize: 12, wordBreak: 'break-all' }}><CopyableCell value={p.value} fontSize={12} /></TableCell>
                      </TableRow>
                    ))}
                    {filteredProperties.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={2} align="center" sx={{ py: 3, color: 'text.secondary', fontSize: 12 }}>
                          {t('argus.userProfiles.noPropertiesFound', 'No properties found')}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          </Box>

          {/* ─── Right Column (Timeline Feed & Charts) ─── */}
          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            
            {/* Sparkline Daily Activity chart */}
            <Box sx={{ p: 2, borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`, bgcolor: isDark ? 'rgba(255,255,255,0.01)' : 'rgba(0,0,0,0.01)' }}>
              <Typography variant="caption" color="text.secondary" fontWeight={600} display="block" sx={{ mb: 1, textTransform: 'uppercase' }}>
                {t('argus.userProfiles.engagementTrend', 'Activity — Last 30 Days')}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: '3px', height: 36, px: 1 }}>
                {dailyActivity.map((d, idx) => (
                  <Tooltip key={idx} title={`${d.date.toLocaleDateString()}: ${d.count} events`}>
                    <Box sx={{ flex: 1, height: `${Math.max((d.count / maxDailyCount) * 36, 2)}px`,
                      bgcolor: d.count > 0 ? theme.palette.primary.main : (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'),
                      borderRadius: '2px', cursor: 'pointer', transition: 'all 0.2s ease',
                      '&:hover': { bgcolor: theme.palette.primary.light, transform: 'scaleY(1.15)' } }} />
                  </Tooltip>
                ))}
              </Box>

              {/* Activity Heatmap — hour × day-of-week */}
              {events.length > 0 && (() => {
                const DAYS = ['일', '월', '화', '수', '목', '금', '토'];
                const HOUR_GROUPS = [
                  { label: '0–5', hours: [0,1,2,3,4,5] },
                  { label: '6–11', hours: [6,7,8,9,10,11] },
                  { label: '12–17', hours: [12,13,14,15,16,17] },
                  { label: '18–23', hours: [18,19,20,21,22,23] },
                ];
                // Aggregate by dow × hour-group
                const grouped: Record<string, number> = {};
                heatmap.forEach(c => {
                  const hg = HOUR_GROUPS.findIndex(g => g.hours.includes(c.hour));
                  if (hg < 0) return;
                  const k = `${c.dow}-${hg}`;
                  grouped[k] = (grouped[k] ?? 0) + c.count;
                });
                const maxVal = Math.max(...Object.values(grouped), 1);
                return (
                  <Box sx={{ mt: 1.5 }}>
                    <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ textTransform: 'uppercase', fontSize: 9, letterSpacing: 0.4 }}>
                      시간대별 활동 패턴
                    </Typography>
                    <Box sx={{ mt: 0.8, display: 'grid', gridTemplateColumns: 'auto repeat(7, 1fr)', gap: '2px', alignItems: 'center' }}>
                      {/* Header row: day labels */}
                      <Box />
                      {DAYS.map(d => (
                        <Typography key={d} sx={{ fontSize: 9, textAlign: 'center', color: 'text.disabled', fontWeight: 600 }}>{d}</Typography>
                      ))}
                      {/* Data rows: hour group × day */}
                      {HOUR_GROUPS.map((hg, hgi) => (
                        <React.Fragment key={hg.label}>
                          <Typography sx={{ fontSize: 9, color: 'text.disabled', pr: 0.5, lineHeight: 1, textAlign: 'right' }}>{hg.label}</Typography>
                          {DAYS.map((_, di) => {
                            const val = grouped[`${di}-${hgi}`] ?? 0;
                            const intensity = val / maxVal;
                            return (
                              <Tooltip key={di} title={`${DAYS[di]} ${hg.label}시: ${val}건`}>
                                <Box sx={{
                                  height: 10,
                                  borderRadius: '2px',
                                  bgcolor: val === 0
                                    ? (isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)')
                                    : alpha(theme.palette.primary.main, 0.15 + intensity * 0.85),
                                  cursor: 'default',
                                  transition: 'opacity 0.15s',
                                  '&:hover': { opacity: 0.7 },
                                }} />
                              </Tooltip>
                            );
                          })}
                        </React.Fragment>
                      ))}
                    </Box>
                  </Box>
                );
              })()}
            </Box>

            {/* Tabs for choosing display Mode */}
            <Box sx={{ display: 'flex', alignItems: 'center', justifyComposite: 'space-between', px: 2, pt: 1, borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}` }}>
              <Tabs
                value={rightTab}
                onChange={(_, v) => setRightTab(v)}
                sx={{
                  minHeight: 36,
                  '& .MuiTab-root': {
                    minHeight: 36,
                    py: 0.5,
                    fontSize: 12,
                    textTransform: 'none',
                    fontWeight: 600,
                  },
                }}
              >
                <Tab label={`${t('argus.userProfiles.activityFeed', 'Activity Feed')} (${profile?.total_events ?? events.length})`} icon={<EventIcon sx={{ fontSize: 14 }} />} iconPosition="start" />
                <Tab label={`${t('argus.userProfiles.sessionsLogs', 'Sessions Logs')} (${profile?.total_sessions ?? sessions.length})`} icon={<SessionIcon sx={{ fontSize: 14 }} />} iconPosition="start" />
                <Tab label={t('argus.userProfiles.finance', 'Finance')} icon={<PurchaseIcon sx={{ fontSize: 14 }} />} iconPosition="start" />
              </Tabs>
              
              {/* Event search bar */}
              {rightTab === 0 && (
                <TextField
                  placeholder={t('argus.userProfiles.filterEventsPlaceholder', 'Filter events...')}
                  size="small"
                  value={eventSearch}
                  onChange={(e) => setEventSearch(e.target.value)}
                  sx={{
                    flex: 1,
                    ml: 1,
                    '& .MuiInputBase-root': {
                      height: 28,
                      fontSize: 11,
                    },
                  }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon sx={{ fontSize: 14 }} />
                      </InputAdornment>
                    ),
                    endAdornment: eventSearch ? (
                      <InputAdornment position="end">
                        <IconButton
                          size="small"
                          onClick={() => setEventSearch('')}
                          sx={{ p: 0.25 }}
                        >
                          <CloseIcon sx={{ fontSize: 12 }} />
                        </IconButton>
                      </InputAdornment>
                    ) : null,
                  }}
                />
              )}
            </Box>

            {/* Scrollable Feed List */}
            <Box sx={{ flex: 1, overflowY: 'auto', p: 2 }}>
              
              {/* ─── Mode 0: Expandable Events Feed (Accordion Style) ─── */}
              {rightTab === 0 && (
                eventsLoading ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                    <CircularProgress size={24} />
                  </Box>
                ) : groupedEvents.length === 0 ? (
                  <Box sx={{ textAlign: 'center', py: 6, color: 'text.secondary' }}>
                    <Typography variant="body2">{t('argus.userProfiles.noEventsMatch', 'No events match the filters.')}</Typography>
                  </Box>
                ) : (
                  groupedEvents.map(([dateStr, items]) => (
                    <Box key={dateStr} sx={{ mb: 3.5 }}>
                      {/* Date Header */}
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, pb: 0.3, borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}` }}>
                        <Typography variant="caption" fontWeight={700} color="text.secondary">
                          {dateStr}
                        </Typography>
                        <Typography variant="caption" color="text.disabled" sx={{ fontSize: 10 }}>
                          ({items.length})
                        </Typography>
                      </Box>
                      {(expandedDates.has(dateStr) ? items : items.slice(0, 5)).map((evt, idx) => {
                        const isExpanded = expandedEventId === `${evt.event_id}-${idx}`;
                        return (
                          <Accordion
                            key={`${evt.event_id}-${idx}`}
                            expanded={isExpanded}
                            onChange={() => setExpandedEventId(isExpanded ? null : `${evt.event_id}-${idx}`)}
                            disableGutters
                            elevation={0}
                            sx={{
                              border: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}`,
                              borderRadius: '6px !important',
                              mb: 0.8,
                              '&:before': { display: 'none' },
                              bgcolor: 'background.paper',
                              overflow: 'hidden',
                              boxShadow: 'none',
                              '&:hover': {
                                borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                              },
                            }}
                          >
                            <AccordionSummary
                              expandIcon={<ExpandMoreIcon sx={{ fontSize: 18 }} />}
                              sx={{
                                minHeight: 40,
                                height: 40,
                                px: 1.5,
                                '& .MuiAccordionSummary-content': {
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 1.5,
                                  minWidth: 0,
                                },
                              }}
                            >
                              <Box sx={{ display: 'inline-flex', flexShrink: 0 }}>
                                {getEventIcon(evt.event_name)}
                              </Box>
                              <Typography variant="body2" fontWeight={600} sx={{ fontSize: 13, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {evt.event_name}
                              </Typography>
                              <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0, mr: 1, fontSize: 11 }}>
                                {new Date(evt.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </Typography>
                            </AccordionSummary>
                            <AccordionDetails sx={{ px: 2, py: 1.5, borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`, bgcolor: isDark ? 'rgba(0,0,0,0.15)' : 'rgba(0,0,0,0.015)' }}>
                              <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: '6px', overflow: 'hidden', bgcolor: 'transparent' }}>
                                <Table size="small">
                                  <TableHead>
                                    <TableRow>
                                      <TableCell sx={{ fontSize: 11, fontWeight: 700, p: 0.6, bgcolor: 'action.hover' }}>{t('argus.userProfiles.attributeKey', 'Attribute Key')}</TableCell>
                                      <TableCell sx={{ fontSize: 11, fontWeight: 700, p: 0.6, bgcolor: 'action.hover' }}>{t('argus.userProfiles.attributeValue', 'Value')}</TableCell>
                                    </TableRow>
                                  </TableHead>
                                  <TableBody>
                                    <TableRow>
                                      <TableCell sx={{ fontSize: 11, p: 0.6, fontWeight: 600, color: theme.palette.primary.main }}>event_id</TableCell>
                                      <TableCell sx={{ fontSize: 11, p: 0.6, fontFamily: 'monospace' }}><CopyableCell value={evt.event_id} /></TableCell>
                                    </TableRow>
                                    {evt.session_id && (
                                      <TableRow>
                                        <TableCell sx={{ fontSize: 11, p: 0.6, fontWeight: 600, color: theme.palette.primary.main }}>session_id</TableCell>
                                        <TableCell sx={{ fontSize: 11, p: 0.6, fontFamily: 'monospace' }}><CopyableCell value={evt.session_id} /></TableCell>
                                      </TableRow>
                                    )}
                                    {Object.entries({ ...evt.properties, ...evt.numeric_properties }).map(([k, v]) => (
                                      <TableRow key={k}>
                                        <TableCell sx={{ fontSize: 11, p: 0.6, fontFamily: 'monospace' }}>{k}</TableCell>
                                        <TableCell sx={{ fontSize: 11, p: 0.6 }}><CopyableCell value={typeof v === 'object' ? JSON.stringify(v) : String(v)} /></TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              </TableContainer>
                            </AccordionDetails>
                          </Accordion>
                        );
                      })}
                      {!expandedDates.has(dateStr) && items.length > 5 && (
                        <Button
                          size="small"
                          onClick={() => setExpandedDates(prev => new Set(prev).add(dateStr))}
                          sx={{ mt: 0.5, fontSize: 11, textTransform: 'none', color: 'text.secondary' }}
                        >
                          {t('argus.userProfiles.showMoreEvents', 'Show {{count}} more events', { count: items.length - 5 })}
                        </Button>
                      )}
                    </Box>
                  ))
                )
              )}

              {/* ─── Mode 1: Sessions Log Feed ─── */}
              {rightTab === 1 && (
                sessions.length === 0 ? (
                  <Box sx={{ textAlign: 'center', py: 6, color: 'text.secondary' }}>
                    <Typography variant="body2">{t('argus.userProfiles.noSessionLogs', 'No session logs found for this user.')}</Typography>
                  </Box>
                ) : (
                  <>
                  {/* Session Engagement Summary */}
                  {sessions.length >= 2 && (() => {
                    const { avgDurSec, avgGapDays, trend } = sessionStats;
                    const trendIcon = trend === 'up' ? '📈' : trend === 'down' ? '📉' : trend === 'stable' ? '➡️' : null;
                    const trendLabel = trend === 'up' ? '세션 증가 추세' : trend === 'down' ? '세션 단축 추세 (이탈 주의)' : trend === 'stable' ? '안정적' : null;
                    return (
                      <Box sx={{ display: 'flex', gap: 1, mb: 1.5, flexWrap: 'wrap' }}>
                        <Paper variant="outlined" sx={{ flex: 1, minWidth: 100, p: 1, borderRadius: 1.5, textAlign: 'center', bgcolor: isDark ? 'rgba(255,255,255,0.02)' : '#fff' }}>
                          <Typography sx={{ fontSize: 9, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.4 }}>평균 세션</Typography>
                          <Typography sx={{ fontSize: 14, fontWeight: 800, lineHeight: 1.2, mt: 0.3 }}>{formatDuration(Math.round(avgDurSec))}</Typography>
                        </Paper>
                        <Paper variant="outlined" sx={{ flex: 1, minWidth: 100, p: 1, borderRadius: 1.5, textAlign: 'center', bgcolor: isDark ? 'rgba(255,255,255,0.02)' : '#fff' }}>
                          <Typography sx={{ fontSize: 9, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.4 }}>평균 재방문</Typography>
                          <Typography sx={{ fontSize: 14, fontWeight: 800, lineHeight: 1.2, mt: 0.3 }}>{avgGapDays < 1 ? '< 1일' : `${avgGapDays.toFixed(1)}일`}</Typography>
                        </Paper>
                        {trendIcon && (
                          <Paper variant="outlined" sx={{ flex: 1, minWidth: 100, p: 1, borderRadius: 1.5, textAlign: 'center', bgcolor: isDark ? 'rgba(255,255,255,0.02)' : '#fff' }}>
                            <Typography sx={{ fontSize: 9, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.4 }}>트렌드</Typography>
                            <Typography sx={{ fontSize: 12, fontWeight: 700, lineHeight: 1.4, mt: 0.3, color: trend === 'down' ? 'warning.main' : trend === 'up' ? 'success.main' : 'text.secondary' }}>
                              {trendIcon} {trendLabel}
                            </Typography>
                          </Paper>
                        )}
                      </Box>
                    );
                  })()}
                  <Box>
                  {sessions.map((s, i) => (
                    <Box
                      key={`${s.session_id}-${i}`}
                      sx={{
                        p: 1.8,
                        mb: 1,
                        borderRadius: '8px',
                        border: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}`,
                        bgcolor: 'background.paper',
                        '&:hover': {
                          borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                        },
                      }}
                    >
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.6 }}>
                        <Typography variant="body2" fontWeight={600} sx={{ fontFamily: 'monospace', fontSize: 12, color: theme.palette.primary.main, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, mr: 1 }}>
                          {s.session_id}
                        </Typography>
                        <Typography variant="caption" fontWeight={600} sx={{ px: 1, py: 0.2, borderRadius: '4px', bgcolor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)', flexShrink: 0 }}>
                          {s.duration_seconds === 0
                            ? t('argus.userProfiles.sessionSingleEvent', 'Single event')
                            : t('argus.userProfiles.sessionDurationLabel', '{{duration}}', { duration: formatDuration(s.duration_seconds) })}
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
                        <Typography variant="caption" color="text.secondary">
                          {t('argus.userProfiles.sessionEvents', '{{total}} total ({{unique}} unique)', { total: s.event_count, unique: s.unique_events })}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {s.start_time === s.end_time
                            ? new Date(s.start_time).toLocaleString()
                            : `${new Date(s.start_time).toLocaleString()} → ${new Date(s.end_time).toLocaleString()}`}
                        </Typography>
                      </Box>
                      {(s.platform || s.browser || s.os) && (
                        <Box sx={{ display: 'flex', gap: 0.5, mt: 0.8, flexWrap: 'wrap' }}>
                          {s.platform && <Chip label={s.platform} size="small" sx={{ height: 20, fontSize: 10 }} />}
                          {s.browser && <Chip label={s.browser} size="small" variant="outlined" sx={{ height: 20, fontSize: 10 }} />}
                          {s.os && <Chip label={s.os} size="small" variant="outlined" sx={{ height: 20, fontSize: 10 }} />}
                        </Box>
                      )}
                    </Box>
                  ))}
                  </Box>
                  {sessionsHasMore && (
                    <Box sx={{ textAlign: 'center', mt: 1 }}>
                      <Button
                        size="small"
                        disabled={sessionsLoadingMore}
                        onClick={async () => {
                          if (!userId) return;
                          setSessionsLoadingMore(true);
                          try {
                            const more = await getUserSessions(projectId, userId, {
                              limit: SESSIONS_PAGE_SIZE,
                              offset: sessions.length,
                            });
                            setSessions(prev => [...prev, ...more]);
                            setSessionsHasMore(more.length >= SESSIONS_PAGE_SIZE);
                          } finally {
                            setSessionsLoadingMore(false);
                          }
                        }}
                        sx={{ fontSize: 11, textTransform: 'none', color: 'text.secondary' }}
                      >
                        {sessionsLoadingMore
                          ? <CircularProgress size={14} sx={{ mr: 0.5 }} />
                          : t('argus.userProfiles.loadMoreSessions', 'Load more sessions')}
                      </Button>
                    </Box>
                  )}
                  </>
                )
              )}


              {/* ─── Mode 2: Finance Tab ─── */}
              {rightTab === 2 && (() => {
                // Fix #2: Load via effect-like pattern with guard, not render body
                if (!finData && !finLoading && userId && finLoadedForUser !== userId) {
                  setFinLoading(true);
                  setFinLoadedForUser(userId);
                  getRevenueUserSummary(projectId, { user_id: userId, period: '90d' })
                    .then(data => setFinData(data))
                    .catch(() => setFinData({ summary: { total_purchases: 0, purchase_count: 0, total_refunds: 0, refund_count: 0, total_grants: 0, grant_count: 0, net_revenue: 0, refund_rate: 0, first_purchase: null, last_purchase: null }, purchases: [], refunds: [], grants: [] }))
                    .finally(() => setFinLoading(false));
                }

                // Fix #10: Add generic type to CsvColumn
                const finCsvCols: CsvColumn<{ timestamp: string; product_name: string; amount: number; reason: string; payment_method: string }>[] = [
                  { key: 'timestamp', label: 'Time', formatter: (v: any) => v ? new Date(v).toLocaleString() : '' },
                  { key: 'product_name', label: 'Product' },
                  { key: 'amount', label: 'Amount', formatter: (v: any) => `$${(Number(v) || 0).toFixed(2)}` },
                  { key: 'reason', label: 'Reason' },
                  { key: 'payment_method', label: 'Payment' },
                ];

                const fmt = (n: number) => n >= 1000000 ? `$${(n / 1000000).toFixed(1)}M` : n >= 1000 ? `$${(n / 1000).toFixed(1)}K` : `$${n.toFixed(2)}`;

                return finLoading ? (
                  <Box sx={{ p: 3, display: 'flex', justifyContent: 'center' }}>
                    <CircularProgress size={28} />
                  </Box>
                ) : finData ? (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, p: 1 }}>
                    {/* Summary cards */}
                    <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 1.5 }}>
                      <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2, textAlign: 'center', bgcolor: isDark ? 'rgba(255,255,255,0.02)' : '#fff' }}>
                        <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>{t('argus.userProfiles.totalPurchases', 'Purchases')}</Typography>
                        <Typography sx={{ fontSize: 16, fontWeight: 700, color: ARGUS_SEMANTIC.positive }}>{fmt(finData.summary.total_purchases)}</Typography>
                        <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>{finData.summary.purchase_count} {t('argus.userProfiles.items', 'items')}</Typography>
                      </Paper>
                      <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2, textAlign: 'center', bgcolor: isDark ? 'rgba(255,255,255,0.02)' : '#fff' }}>
                        <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>{t('argus.userProfiles.totalRefunds', 'Refunds')}</Typography>
                        <Typography sx={{ fontSize: 16, fontWeight: 700, color: ARGUS_SEMANTIC.negative }}>-{fmt(finData.summary.total_refunds)}</Typography>
                        <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>{finData.summary.refund_count} {t('argus.userProfiles.items', 'items')}</Typography>
                      </Paper>
                      <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2, textAlign: 'center', bgcolor: isDark ? 'rgba(255,255,255,0.02)' : '#fff' }}>
                        <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>{t('argus.userProfiles.totalGrants', 'Grants')}</Typography>
                        <Typography sx={{ fontSize: 16, fontWeight: 700, color: ARGUS_SEMANTIC.warning }}>{fmt(finData.summary.total_grants)}</Typography>
                        <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>{finData.summary.grant_count} {t('argus.userProfiles.items', 'items')}</Typography>
                      </Paper>
                      <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2, textAlign: 'center', bgcolor: isDark ? 'rgba(255,255,255,0.02)' : '#fff' }}>
                        <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>{t('argus.userProfiles.netRevenue', 'Net Revenue')}</Typography>
                        <Typography sx={{ fontSize: 16, fontWeight: 700 }}>{fmt(finData.summary.net_revenue)}</Typography>
                        {finData.summary.refund_rate > 20 && (
                          <Chip size="small" label={`⚠ ${finData.summary.refund_rate.toFixed(0)}% refund`} sx={{ fontSize: 9, height: 18, bgcolor: 'rgba(244,67,54,0.1)', color: ARGUS_SEMANTIC.negative, fontWeight: 700 }} />
                        )}
                      </Paper>
                    </Box>

                    {/* Top Products */}
                    {topProducts.length > 0 && (() => {
                      const maxCount = topProducts[0].count;
                      return (
                        <Box sx={{ p: 1.5, borderRadius: 1.5, border: '1px solid', borderColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)', bgcolor: isDark ? 'rgba(255,255,255,0.02)' : '#fafafa' }}>
                          <Typography sx={{ fontSize: 10, fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.5, mb: 1 }}>
                            선호 상품 Top {topProducts.length}
                          </Typography>
                          {topProducts.map((p, i) => (
                            <Box key={p.name} sx={{ mb: i < topProducts.length - 1 ? 1 : 0 }}>
                              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.3 }}>
                                <Typography sx={{ fontSize: 11, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, mr: 1 }}>
                                  #{i + 1} {p.name}
                                </Typography>
                                <Box sx={{ display: 'flex', gap: 1, flexShrink: 0 }}>
                                  <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>{p.count}회</Typography>
                                  <Typography sx={{ fontSize: 11, fontWeight: 700 }}>{fmt(p.total)}</Typography>
                                </Box>
                              </Box>
                              <Box sx={{ height: 4, borderRadius: 2, bgcolor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)', overflow: 'hidden' }}>
                                <Box sx={{ height: '100%', width: `${(p.count / maxCount) * 100}%`, bgcolor: theme.palette.primary.main, borderRadius: 2, transition: 'width 0.4s ease' }} />
                              </Box>
                            </Box>
                          ))}
                        </Box>
                      );
                    })()}

                    {/* Sub-tabs */}
                    <Tabs value={finSubTab} onChange={(_, v) => setFinSubTab(v)} sx={{ minHeight: 28, '& .MuiTab-root': { minHeight: 28, fontSize: 11, textTransform: 'none', py: 0 } }}>
                      <Tab label={`🛒 ${t('argus.userProfiles.purchaseHistory', 'Purchases')} (${finData.purchases.length})`} />
                      <Tab label={`↩️ ${t('argus.userProfiles.refundHistory', 'Refunds')} (${finData.refunds.length})`} />
                      <Tab label={`🎁 ${t('argus.userProfiles.grantHistory', 'Grants')} (${finData.grants.length})`} />
                    </Tabs>

                    {/* Transaction table */}
                    {(() => {
                      const rows = finSubTab === 0 ? finData.purchases : finSubTab === 1 ? finData.refunds : finData.grants;
                      const typeLabel = finSubTab === 0 ? 'purchases' : finSubTab === 1 ? 'refunds' : 'grants';
                      return rows.length > 0 ? (
                        <Box>
                          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1 }}>
                            <Button size="small" variant="outlined" onClick={() => downloadCsv(rows, finCsvCols, `user_${userId}_${typeLabel}`)}
                              sx={{ fontSize: 10, textTransform: 'none', minWidth: 'auto', px: 1 }}>
                              📥 CSV
                            </Button>
                          </Box>
                          <Table size="small">
                            <TableHead>
                              <TableRow>
                                <TableCell sx={{ fontWeight: 700, fontSize: 11 }}>{t('argus.userProfiles.time', 'Time')}</TableCell>
                                <TableCell sx={{ fontWeight: 700, fontSize: 11 }}>{t('argus.userProfiles.product', 'Product')}</TableCell>
                                <TableCell align="right" sx={{ fontWeight: 700, fontSize: 11 }}>{t('argus.userProfiles.amount', 'Amount')}</TableCell>
                                <TableCell sx={{ fontWeight: 700, fontSize: 11 }}>{finSubTab >= 1 ? t('argus.userProfiles.reason', 'Reason') : t('argus.userProfiles.payment', 'Payment')}</TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {rows.map((row, i) => (
                                <TableRow key={`${row.event_id}-${i}`}>
                                  <TableCell sx={{ fontSize: 12, whiteSpace: 'nowrap' }}>
                                    {new Date(row.timestamp).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                  </TableCell>
                                  <TableCell sx={{ fontSize: 12, fontWeight: 600 }}>{row.product_name || '—'}</TableCell>
                                  <TableCell align="right" sx={{ fontSize: 12, fontWeight: 700, color: finSubTab === 1 ? ARGUS_SEMANTIC.negative : 'text.primary' }}>
                                    {finSubTab === 1 ? '-' : ''}{fmt(row.amount)}
                                  </TableCell>
                                  <TableCell sx={{ fontSize: 11, color: 'text.secondary', textTransform: 'capitalize' }}>
                                    {finSubTab >= 1 ? (row.reason || '—').replace(/_/g, ' ') : (row.payment_method || '—')}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </Box>
                      ) : (
                        <Typography fontSize={12} color="text.secondary" sx={{ textAlign: 'center', py: 3 }}>
                          {t('argus.userProfiles.noFinanceData', 'No records found')}
                        </Typography>
                      );
                    })()}
                  </Box>
                ) : (
                  <Typography fontSize={12} color="text.secondary" sx={{ textAlign: 'center', py: 3 }}>
                    {t('argus.userProfiles.financeLoadError', 'Failed to load financial data')}
                  </Typography>
                );
              })()}

            </Box>
          </Box>
        </Box>
      ) : (
        <Box sx={{ p: 4, textAlign: 'center', color: 'text.secondary', bgcolor: 'background.default', height: '100%' }}>
          {t('argus.userProfiles.userNotFound', 'User not found')}
        </Box>
      )}
    </ResizableDrawer>
  );
};

// ─── Sort type ────────────────────────────────────────────────────────────────

type SortField = 'last_seen' | 'first_seen' | 'total_events' | 'total_sessions';
type SortDir = 'asc' | 'desc';

// ─── Main Page ────────────────────────────────────────────────────────────────

const ArgusUserProfilesPage: React.FC = () => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const { t } = useTranslation();
  const { currentProject } = useOrgProject();
  const projectId = String(currentProject?.id || '1');
  const { userId: urlUserId } = useParams<{ userId?: string }>();
  const navigate = useNavigate();

  const [users, setUsers] = useState<ArgusUserProfile[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [searchDebounced, setSearchDebounced] = useState('');
  const [page, setPage] = useState(0);
  const [sortField, setSortField] = useState<SortField>('last_seen');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [dateRange, setDateRange] = useState<DateRangeValue>({ type: 'preset', preset: '30d' });

  // Drawer
  const [drawerUserId, setDrawerUserId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [cohortMap, setCohortMap] = useState<Record<string, CohortMembership[]>>({});

  const [pageSize, setPageSize] = useGlobalPageSize();
  const initialLoadDone = useRef(false);

  // ─── Starred users (localStorage per project) ────────────────────────────────
  const starStorageKey = `argus_starred_users_${projectId}`;
  const [starredUsers, setStarredUsers] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem(`argus_starred_users_${projectId}`);
      return new Set(raw ? JSON.parse(raw) : []);
    } catch { return new Set(); }
  });
  const [showStarredOnly, setShowStarredOnly] = useState(false);

  const toggleStar = (e: React.MouseEvent, userId: string) => {
    e.stopPropagation();
    setStarredUsers(prev => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      try { localStorage.setItem(starStorageKey, JSON.stringify([...next])); } catch {}
      return next;
    });
  };

  // Rows split: starred first (pinned), rest below
  const displayedRows = useMemo(() => {
    const base = showStarredOnly ? users.filter(u => starredUsers.has(u.user_id)) : users;
    const starred = base.filter(u => starredUsers.has(u.user_id));
    const rest = base.filter(u => !starredUsers.has(u.user_id));
    const maxEvents = Math.max(...base.map(u => u.total_events), 1);
    return { starred, rest, maxEvents };
  }, [users, starredUsers, showStarredOnly]);

  // Deep-link: auto-open drawer when URL contains userId
  useEffect(() => {
    if (urlUserId) {
      setDrawerUserId(decodeURIComponent(urlUserId));
      setDrawerOpen(true);
    }
  }, [urlUserId]);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setSearchDebounced(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const loadUsers = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const apiParams = dateRangeToApiParams(dateRange);
      const sortStr = sortDir === 'asc' ? `-${sortField}` : sortField;
      const result = await getUserProfiles(projectId, {
        limit: pageSize,
        offset: page * pageSize,
        sort: sortStr,
        search: searchDebounced || undefined,
        ...apiParams,
      });
      setUsers(result.data);
      setTotal(result.total);
      // Fetch cohort memberships for loaded users
      if (result.data.length > 0) {
        getUserCohortMemberships(projectId, result.data.map((u: ArgusUserProfile) => u.user_id))
          .then((m) => setCohortMap(m))
          .catch(() => setCohortMap({}));
      } else {
        setCohortMap({});
      }
    } catch {
      setUsers([]);
      setTotal(0);
    } finally {
      setLoading(false);
      initialLoadDone.current = true;
    }
  }, [projectId, page, pageSize, sortField, sortDir, searchDebounced, dateRange]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('desc');
    }
    setPage(0);
  };

  const handleUserClick = (userId: string) => {
    setDrawerUserId(userId);
    setDrawerOpen(true);
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <PageHeader
        title={
          <ArgusBreadcrumbs
            paths={[
              {
                label: t('argus.analytics.title', 'Analytics'),
                to: '/argus/analytics',
              },
              { label: t('argus.userProfiles', 'User Profiles') },
            ]}
            size="title"
          />
        }
        subtitle={t('argus.userProfiles.subtitle', 'Explore individual user behavior and properties')}
      />

      <PageContentLoader loading={loading && !initialLoadDone.current} sx={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        {/* Search bar */}
        <Box sx={{ mb: 2, display: 'flex', gap: 1.5, alignItems: 'center', flexShrink: 0 }}>
          <TextField
            size="small"
            placeholder={t('argus.userProfiles.searchPlaceholder', 'Search by user ID or property')}
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                </InputAdornment>
              ),
              endAdornment: search ? (
                <InputAdornment position="end">
                  <IconButton size="small" onClick={() => { setSearch(''); setPage(0); }} sx={{ p: 0.25 }}>
                    <CloseIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                </InputAdornment>
              ) : null,
            }}
            sx={{ width: 320 }}
          />
          {/* Starred filter toggle */}
          <Tooltip title={showStarredOnly ? t('argus.userProfiles.showAll', 'Show all users') : t('argus.userProfiles.showStarred', 'Show starred only')}>
            <IconButton
              size="small"
              onClick={() => setShowStarredOnly(p => !p)}
              sx={{
                border: '1px solid',
                borderColor: showStarredOnly ? 'warning.main' : 'divider',
                borderRadius: 1.5,
                color: showStarredOnly ? 'warning.main' : 'text.secondary',
                bgcolor: showStarredOnly ? alpha('#ffa726', 0.08) : 'transparent',
                '&:hover': { borderColor: 'warning.main', color: 'warning.main' },
                transition: 'all 0.15s ease',
                px: 1,
                gap: 0.5,
                display: 'flex',
              }}
            >
              <StarIcon sx={{ fontSize: 16 }} />
              {starredUsers.size > 0 && (
                <Typography sx={{ fontSize: 11, fontWeight: 700, lineHeight: 1 }}>{starredUsers.size}</Typography>
              )}
            </IconButton>
          </Tooltip>
          <Box sx={{ flex: 1 }} />
          <Typography variant="body2" color="text.secondary">
            {t('argus.userProfiles.usersCount', '{{count}} users', { count: total })}
          </Typography>
          <DateRangeSelector value={dateRange} onChange={setDateRange} />
        </Box>

        {/* Table */}
        <TableContainer
          component={Paper}
          variant="outlined"
          sx={{
            flex: 1,
            overflow: 'auto',
            borderRadius: 2,
            bgcolor: isDark ? 'rgba(255,255,255,0.02)' : '#fff',
            opacity: loading && users.length > 0 ? 0.55 : 1,
            transition: 'opacity 0.15s ease',
            pointerEvents: loading ? 'none' : 'auto',
          }}
        >
          <Table stickyHeader sx={{ '& .MuiTableCell-root': { py: 1.2 }, '& .MuiTableHead-root .MuiTableCell-root': { zIndex: 2, bgcolor: isDark ? '#1e1e1e' : '#fff' } }}>
            <TableHead>
              <TableRow>
                <TableCell sx={{ width: 36, p: '4px 8px' }} />
                <TableCell sx={{ fontWeight: 700, width: 260 }}>{t('argus.userProfiles.userId', 'User ID')}</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>
                  <TableSortLabel
                    active={sortField === 'last_seen'}
                    direction={sortField === 'last_seen' ? sortDir : 'desc'}
                    onClick={() => handleSort('last_seen')}
                  >
                    {t('argus.userProfiles.lastSeen', 'Last Seen')}
                  </TableSortLabel>
                </TableCell>
                <TableCell sx={{ fontWeight: 700 }}>
                  <TableSortLabel
                    active={sortField === 'first_seen'}
                    direction={sortField === 'first_seen' ? sortDir : 'desc'}
                    onClick={() => handleSort('first_seen')}
                  >
                    {t('argus.userProfiles.firstSeen', 'First Seen')}
                  </TableSortLabel>
                </TableCell>
                <TableCell sx={{ fontWeight: 700, width: 60 }} align="right">
                  <TableSortLabel
                    active={sortField === 'total_events'}
                    direction={sortField === 'total_events' ? sortDir : 'desc'}
                    onClick={() => handleSort('total_events')}
                  >
                    {t('argus.userProfiles.eventCount', 'Events')}
                  </TableSortLabel>
                </TableCell>
                <TableCell sx={{ fontWeight: 700, width: 88 }} />
                <TableCell sx={{ fontWeight: 700 }} align="right">
                  <TableSortLabel
                    active={sortField === 'total_sessions'}
                    direction={sortField === 'total_sessions' ? sortDir : 'desc'}
                    onClick={() => handleSort('total_sessions')}
                  >
                    {t('argus.userProfiles.sessions', 'Sessions')}
                  </TableSortLabel>
                </TableCell>
                <TableCell sx={{ fontWeight: 700 }}>{t('argus.userProfiles.platform', 'Platform')}</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>{t('argus.userProfiles.browser', 'Browser')}</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>{t('argus.userProfiles.country', 'Country')}</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>{t('argus.userProfiles.cohorts', 'Cohorts')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading && users.length === 0
                ? Array.from({ length: 8 }).map((_, i) => (
                    <TableRow key={`skeleton-${i}`}>
                      {Array.from({ length: 11 }).map((_, j) => (
                        <TableCell key={j}><Skeleton /></TableCell>
                      ))}
                    </TableRow>
                  ))
                : (() => {
                    const renderRow = (user: ArgusUserProfile, isStarredSection: boolean) => {
                      const isStarred = starredUsers.has(user.user_id);
                      return (
                        <TableRow
                          key={user.user_id}
                          hover
                          onClick={() => handleUserClick(user.user_id)}
                          sx={{
                            cursor: 'pointer',
                            ...(isStarredSection ? {
                              bgcolor: isDark ? alpha('#ffa726', 0.04) : alpha('#ffa726', 0.03),
                            } : {}),
                          }}
                        >
                          {/* Star button */}
                          <TableCell sx={{ p: '4px 8px', width: 36 }}>
                            <Tooltip title={isStarred ? t('argus.userProfiles.unstar', 'Remove from starred') : t('argus.userProfiles.star', 'Star this user')}>
                              <IconButton
                                size="small"
                                onClick={(e) => toggleStar(e, user.user_id)}
                                sx={{ p: 0.4, color: isStarred ? 'warning.main' : 'text.disabled', '&:hover': { color: 'warning.main' } }}
                              >
                                {isStarred ? <StarIcon sx={{ fontSize: 15 }} /> : <StarBorderIcon sx={{ fontSize: 15 }} />}
                              </IconButton>
                            </Tooltip>
                          </TableCell>
                          <TableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              {user.avatar_url ? (
                                <Box component="img" src={user.avatar_url} alt={user.user_id}
                                  sx={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover' }} />
                              ) : (
                                <Box sx={{ width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  bgcolor: alpha(theme.palette.primary.main, 0.12), color: theme.palette.primary.main, fontSize: 12, fontWeight: 700 }}>
                                  {user.user_id[0]?.toUpperCase() || 'U'}
                                </Box>
                              )}
                              <Box sx={{ minWidth: 0 }}>
                                <Typography variant="body2" fontWeight={600}
                                  sx={{ fontFamily: 'monospace', fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200 }}>
                                  {user.user_id}
                                </Typography>
                                {user.email && (
                                  <Typography variant="caption" color="text.secondary"
                                    sx={{ fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200, display: 'block', lineHeight: 1.3 }}>
                                    {user.email}
                                  </Typography>
                                )}
                              </Box>
                            </Box>
                          </TableCell>
                          <TableCell><Typography variant="body2" fontSize={13}>{formatRelativeTime(user.last_seen)}</Typography></TableCell>
                          <TableCell><Typography variant="body2" fontSize={13}>{formatRelativeTime(user.first_seen)}</Typography></TableCell>
                          <TableCell align="right" sx={{ width: 60 }}>
                            <Typography variant="body2" fontWeight={700} fontSize={13}>
                              {user.total_events.toLocaleString()}
                            </Typography>
                          </TableCell>
                          <TableCell sx={{ width: 88, py: 0 }}>
                            {user.activity_sparkline && user.activity_sparkline.length >= 2 ? (
                              <ArgusSparkline
                                data={user.activity_sparkline}
                                width={80}
                                height={24}
                                color={theme.palette.primary.main}
                                strokeWidth={1.5}
                                showDot={false}
                              />
                            ) : (
                              <Box sx={{ width: 80, height: 3, borderRadius: 1, bgcolor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)', overflow: 'hidden' }}>
                                <Box sx={{ height: '100%', width: `${(user.total_events / displayedRows.maxEvents) * 100}%`, bgcolor: theme.palette.primary.main, opacity: 0.4 }} />
                              </Box>
                            )}
                          </TableCell>
                          <TableCell align="right"><Typography variant="body2" fontSize={13}>{user.total_sessions}</Typography></TableCell>
                          <TableCell>{user.platform && <Chip label={user.platform} size="small" sx={{ height: 22, fontSize: 11 }} />}</TableCell>
                          <TableCell><Typography variant="body2" fontSize={13}>{user.browser || '—'}</Typography></TableCell>
                          <TableCell><Typography variant="body2" fontSize={13}>{user.country || '—'}</Typography></TableCell>
                          <TableCell>
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                              {(cohortMap[user.user_id] || []).map((c) => <CohortChip key={c.id} cohort={c} />)}
                            </Box>
                          </TableCell>
                        </TableRow>
                      );
                    };
                    return (
                      <>
                        {/* Starred section */}
                        {displayedRows.starred.map(u => renderRow(u, true))}
                        {/* Divider between starred and rest */}
                        {displayedRows.starred.length > 0 && displayedRows.rest.length > 0 && (
                          <TableRow>
                            <TableCell colSpan={10} sx={{ py: 0.3, px: 2, bgcolor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)', borderBottom: 'none' }}>
                              <Typography sx={{ fontSize: 10, fontWeight: 700, color: 'text.disabled', textTransform: 'uppercase', letterSpacing: 0.8 }}>
                                {t('argus.userProfiles.otherUsers', 'Other users')}
                              </Typography>
                            </TableCell>
                          </TableRow>
                        )}
                        {/* Rest */}
                        {displayedRows.rest.map(u => renderRow(u, false))}
                      </>
                    );
                  })()}
              {!loading && users.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 6 }}>
                    <PersonIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
                    <Typography color="text.secondary">{t('argus.userProfiles.noUsers', 'No user profiles')}</Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Pagination */}
        <Box sx={{ mt: 2, flexShrink: 0 }}>
          <SimplePagination
            count={total}
            page={page}
            rowsPerPage={pageSize}
            onPageChange={(_, newPage) => setPage(newPage)}
            onRowsPerPageChange={(e) => {
              setPageSize(Number(e.target.value));
              setPage(0);
            }}
          />
        </Box>
      </PageContentLoader>

      {/* User Profile Drawer */}
      <UserProfileDrawer
        open={drawerOpen}
        onClose={() => {
          setDrawerOpen(false);
          if (urlUserId) {
            navigate('/argus/analytics/users', { replace: true });
          }
        }}
        projectId={projectId}
        userId={drawerUserId}
      />
    </Box>
  );
};

export default ArgusUserProfilesPage;

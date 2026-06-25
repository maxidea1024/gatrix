import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
import {
  getUserProfiles,
  getUserProfile,
  getUserEvents,
  getUserSessions,
  getUserProperties,
  getUserCohortMemberships,
  getRevenueUserSummary,
  type UserFinancialResponse,
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
            {/* Identity Summary Card */}
            <Box>
              <Typography variant="caption" color="text.secondary" fontWeight={600} display="block" sx={{ mb: 1, textTransform: 'uppercase' }}>
                {t('argus.userProfiles.identitySummary', 'Identity Summary')}
              </Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 1 }}>
                {[
                  { icon: <ScheduleIcon fontSize="inherit" />, label: t('argus.userProfiles.firstSeenLabel', 'First seen'), value: formatRelativeTime(profile.first_seen) },
                  { icon: <ScheduleIcon fontSize="inherit" />, label: t('argus.userProfiles.lastSeenLabel', 'Last seen'), value: formatRelativeTime(profile.last_seen) },
                  { icon: <GlobeIcon fontSize="inherit" />, label: t('argus.userProfiles.countryLabel', 'Country'), value: profile.country || '—' },
                  { icon: <DevicesIcon fontSize="inherit" />, label: t('argus.userProfiles.platformLabel', 'Platform'), value: profile.platform || '—' },
                ].map((card) => (
                  <Paper
                    key={card.label}
                    variant="outlined"
                    sx={{
                      p: 1,
                      borderRadius: 1.5,
                      bgcolor: 'background.paper',
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'text.secondary', mb: 0.2 }}>
                      <Box sx={{ display: 'inline-flex', fontSize: 13 }}>{card.icon}</Box>
                      <Typography variant="caption" sx={{ fontSize: 10 }}>{card.label}</Typography>
                    </Box>
                    <Typography variant="body2" fontWeight={600} sx={{ fontSize: 12 }}>
                      {card.value}
                    </Typography>
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
            <Box
              sx={{
                p: 2,
                borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
                bgcolor: isDark ? 'rgba(255,255,255,0.01)' : 'rgba(0,0,0,0.01)',
              }}
            >
              <Typography variant="caption" color="text.secondary" fontWeight={600} display="block" sx={{ mb: 1.5, textTransform: 'uppercase' }}>
                {t('argus.userProfiles.engagementTrend', 'User Engagement Trend (Last 30 Days Event Frequency)')}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: '3px', height: 40, px: 1 }}>
                {dailyActivity.map((d, idx) => (
                  <Tooltip key={idx} title={t('argus.userProfiles.engagementTrendTooltip', '{{date}}: {{count}} events', { date: d.date.toLocaleDateString(), count: d.count })}>
                    <Box
                      sx={{
                        flex: 1,
                        height: `${Math.max((d.count / maxDailyCount) * 40, 2)}px`,
                        bgcolor: d.count > 0 ? theme.palette.primary.main : (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'),
                        borderRadius: '2px',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        '&:hover': {
                          bgcolor: theme.palette.primary.light,
                          transform: 'scaleY(1.15)',
                        },
                      }}
                    />
                  </Tooltip>
                ))}
              </Box>
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
                <Tab label={`💰 ${t('argus.userProfiles.finance', 'Finance')}`} icon={<PurchaseIcon sx={{ fontSize: 14 }} />} iconPosition="start" />
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
                  sessions.map((s, i) => (
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
                  ))
                  .concat(
                    sessionsHasMore ? [
                      <Box key="load-more" sx={{ textAlign: 'center', mt: 1 }}>
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
                    ] : []
                  )
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
                        <Typography sx={{ fontSize: 16, fontWeight: 700, color: '#4caf50' }}>{fmt(finData.summary.total_purchases)}</Typography>
                        <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>{finData.summary.purchase_count} {t('argus.userProfiles.items', 'items')}</Typography>
                      </Paper>
                      <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2, textAlign: 'center', bgcolor: isDark ? 'rgba(255,255,255,0.02)' : '#fff' }}>
                        <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>{t('argus.userProfiles.totalRefunds', 'Refunds')}</Typography>
                        <Typography sx={{ fontSize: 16, fontWeight: 700, color: '#f44336' }}>-{fmt(finData.summary.total_refunds)}</Typography>
                        <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>{finData.summary.refund_count} {t('argus.userProfiles.items', 'items')}</Typography>
                      </Paper>
                      <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2, textAlign: 'center', bgcolor: isDark ? 'rgba(255,255,255,0.02)' : '#fff' }}>
                        <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>{t('argus.userProfiles.totalGrants', 'Grants')}</Typography>
                        <Typography sx={{ fontSize: 16, fontWeight: 700, color: '#ff9800' }}>{fmt(finData.summary.total_grants)}</Typography>
                        <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>{finData.summary.grant_count} {t('argus.userProfiles.items', 'items')}</Typography>
                      </Paper>
                      <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2, textAlign: 'center', bgcolor: isDark ? 'rgba(255,255,255,0.02)' : '#fff' }}>
                        <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>{t('argus.userProfiles.netRevenue', 'Net Revenue')}</Typography>
                        <Typography sx={{ fontSize: 16, fontWeight: 700 }}>{fmt(finData.summary.net_revenue)}</Typography>
                        {finData.summary.refund_rate > 20 && (
                          <Chip size="small" label={`⚠ ${finData.summary.refund_rate.toFixed(0)}% refund`} sx={{ fontSize: 9, height: 18, bgcolor: 'rgba(244,67,54,0.1)', color: '#f44336', fontWeight: 700 }} />
                        )}
                      </Paper>
                    </Box>

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
                                  <TableCell align="right" sx={{ fontSize: 12, fontWeight: 700, color: finSubTab === 1 ? '#f44336' : 'text.primary' }}>
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
        <Box sx={{ mb: 2, display: 'flex', gap: 2, alignItems: 'center', flexShrink: 0 }}>
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
                  <IconButton
                    size="small"
                    onClick={() => {
                      setSearch('');
                      setPage(0);
                    }}
                    sx={{ p: 0.25 }}
                  >
                    <CloseIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                </InputAdornment>
              ) : null,
            }}
            sx={{ width: 340 }}
          />
          <Box sx={{ flex: 1 }} />
          <Typography variant="body2" color="text.secondary">
            {t('argus.userProfiles.usersCount', '{{count}} users', { count: total })}
          </Typography>
          <DateRangeSelector
            value={dateRange}
            onChange={setDateRange}
          />
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
                <TableCell sx={{ fontWeight: 700, width: 280 }}>{t('argus.userProfiles.userId', 'User ID')}</TableCell>
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
                <TableCell sx={{ fontWeight: 700 }} align="right">
                  <TableSortLabel
                    active={sortField === 'total_events'}
                    direction={sortField === 'total_events' ? sortDir : 'desc'}
                    onClick={() => handleSort('total_events')}
                  >
                    {t('argus.userProfiles.eventCount', 'Event Count')}
                  </TableSortLabel>
                </TableCell>
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
                      {Array.from({ length: 9 }).map((_, j) => (
                        <TableCell key={j}>
                          <Skeleton />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                : users.map((user) => (
                    <TableRow
                      key={user.user_id}
                      hover
                      onClick={() => handleUserClick(user.user_id)}
                      sx={{ cursor: 'pointer' }}
                    >
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          {user.avatar_url ? (
                            <Box
                              component="img"
                              src={user.avatar_url}
                              alt={user.user_id}
                              sx={{
                                width: 28,
                                height: 28,
                                borderRadius: '50%',
                                objectFit: 'cover',
                              }}
                            />
                          ) : (
                            <Box
                              sx={{
                                width: 28,
                                height: 28,
                                borderRadius: '50%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                bgcolor: alpha(theme.palette.primary.main, 0.12),
                                color: theme.palette.primary.main,
                                fontSize: 12,
                                fontWeight: 700,
                              }}
                            >
                              {user.user_id[0]?.toUpperCase() || 'U'}
                            </Box>
                          )}
                          <Box sx={{ minWidth: 0 }}>
                            <Typography
                              variant="body2"
                              fontWeight={600}
                              sx={{
                                fontFamily: 'monospace',
                                fontSize: 12,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                maxWidth: 200,
                              }}
                            >
                              {user.user_id}
                            </Typography>
                            {user.email && (
                              <Typography
                                variant="caption"
                                color="text.secondary"
                                sx={{
                                  fontSize: 11,
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                  maxWidth: 200,
                                  display: 'block',
                                  lineHeight: 1.3,
                                }}
                              >
                                {user.email}
                              </Typography>
                            )}
                          </Box>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontSize={13}>
                          {formatRelativeTime(user.last_seen)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontSize={13}>
                          {formatRelativeTime(user.first_seen)}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" fontWeight={600} fontSize={13}>
                          {user.total_events.toLocaleString()}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" fontSize={13}>
                          {user.total_sessions}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        {user.platform && (
                          <Chip label={user.platform} size="small" sx={{ height: 22, fontSize: 11 }} />
                        )}
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontSize={13}>
                          {user.browser || '—'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontSize={13}>
                          {user.country || '—'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                          {(cohortMap[user.user_id] || []).map((c) => (
                            <CohortChip key={c.id} cohort={c} />
                          ))}
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))}
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
        onClose={() => setDrawerOpen(false)}
        projectId={projectId}
        userId={drawerUserId}
      />
    </Box>
  );
};

export default ArgusUserProfilesPage;

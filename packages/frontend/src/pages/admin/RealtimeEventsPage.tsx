import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Card,
  CardContent,
  IconButton,
  Tooltip,
  Chip,
  Avatar,
  List,
  ListItem,
  ListItemText,
  Divider,
  Badge,
  alpha,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Stack,
  Collapse,
  useTheme,
  Tab,
  Tabs,
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  Timeline as TimelineIcon,
  Person as PersonIcon,
  Event as EventIcon,
  FilterList as FilterListIcon,
  Close as CloseIcon,
  Search as SearchIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  FiberManualRecord as DotIcon,
  PlayArrow as PlayIcon,
  Pause as PauseIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import { AuditLogService } from '../../services/auditLogService';
import { AuditLog } from '../../types';
import { formatDateTimeDetailed } from '../../utils/dateFormat';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/ko';
import 'dayjs/locale/zh-cn';
import { useI18n } from '../../contexts/I18nContext';

dayjs.extend(relativeTime);

interface EventStats {
  action: string;
  count: number;
}

interface TimelineGroup {
  timestamp: string;
  events: AuditLog[];
  count: number;
}

const RealtimeEventsPage: React.FC = () => {
  const { t } = useTranslation();
  const { language } = useI18n();
  const { enqueueSnackbar } = useSnackbar();
  const theme = useTheme();

  const [events, setEvents] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [topEvents, setTopEvents] = useState<EventStats[]>([]);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const eventStreamRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Filter states
  const [showFilters, setShowFilters] = useState(false);
  const [eventTypeFilter, setEventTypeFilter] = useState<string>('');
  const [userFilter, setUserFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Detail modal
  const [selectedEvent, setSelectedEvent] = useState<AuditLog | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);

  // Stats
  const [uniqueUsers, setUniqueUsers] = useState(0);
  const [eventTypes, setEventTypes] = useState(0);

  // View mode
  const [viewMode, setViewMode] = useState<'stream' | 'timeline'>('timeline');

  // Timeline groups (grouped by minute)
  const [timelineGroups, setTimelineGroups] = useState<TimelineGroup[]>([]);

  // Set dayjs locale
  useEffect(() => {
    switch (language) {
      case 'ko':
        dayjs.locale('ko');
        break;
      case 'zh':
        dayjs.locale('zh-cn');
        break;
      default:
        dayjs.locale('en');
        break;
    }
  }, [language]);

  // Load events
  const loadEvents = useCallback(async () => {
    try {
      // Get events from last 30 minutes
      const thirtyMinutesAgo = dayjs().subtract(30, 'minute').toISOString();

      const filters: any = {
        start_date: thirtyMinutesAgo,
      };

      if (eventTypeFilter) {
        filters.action = eventTypeFilter;
      }

      if (userFilter) {
        filters.user = userFilter;
      }

      const result = await AuditLogService.getAuditLogs(1, 100, filters);

      if (result && Array.isArray(result.logs)) {
        let filteredEvents = result.logs;

        // Apply search filter
        if (searchQuery) {
          const query = searchQuery.toLowerCase();
          filteredEvents = filteredEvents.filter(log =>
            log.action.toLowerCase().includes(query) ||
            log.user?.email?.toLowerCase().includes(query) ||
            log.user?.name?.toLowerCase().includes(query) ||
            log.entityType?.toLowerCase().includes(query)
          );
        }

        setEvents(filteredEvents);

        // Group events by minute for timeline view
        const groups: Record<string, AuditLog[]> = {};
        filteredEvents.forEach((log) => {
          const minuteKey = dayjs(log.createdAt).format('HH:mm');
          if (!groups[minuteKey]) {
            groups[minuteKey] = [];
          }
          groups[minuteKey].push(log);
        });

        const timelineData: TimelineGroup[] = Object.entries(groups)
          .map(([timestamp, events]) => ({
            timestamp,
            events,
            count: events.length,
          }))
          .sort((a, b) => b.timestamp.localeCompare(a.timestamp));

        setTimelineGroups(timelineData);

        // Calculate top events
        const eventCounts: Record<string, number> = {};
        filteredEvents.forEach((log) => {
          eventCounts[log.action] = (eventCounts[log.action] || 0) + 1;
        });

        const stats = Object.entries(eventCounts)
          .map(([action, count]) => ({ action, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5);

        setTopEvents(stats);

        // Calculate unique users
        const users = new Set(filteredEvents.map(log => log.userId).filter(Boolean));
        setUniqueUsers(users.size);

        // Calculate event types
        const types = new Set(filteredEvents.map(log => log.action));
        setEventTypes(types.size);
      }
    } catch (error: any) {
      console.error('Failed to load events:', error);
      enqueueSnackbar(error.message || t('common.error'), { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [t, enqueueSnackbar, eventTypeFilter, userFilter, searchQuery]);

  // Initial load
  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  // Auto refresh every 5 seconds
  useEffect(() => {
    if (autoRefresh) {
      intervalRef.current = setInterval(() => {
        loadEvents();
      }, 5000);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [autoRefresh, loadEvents]);

  // Get event color
  const getEventColor = (action: string): string => {
    if (action.includes('create')) return '#4CAF50';
    if (action.includes('update')) return '#2196F3';
    if (action.includes('delete')) return '#F44336';
    if (action.includes('login')) return '#9C27B0';
    return '#757575';
  };

  // Get event icon
  const getEventIcon = (action: string): string => {
    const firstLetter = action.charAt(0).toUpperCase();
    return firstLetter;
  };

  // Calculate time difference
  const getTimeDiff = (current: Date, previous?: Date): string => {
    if (!previous) return '';
    const diff = dayjs(current).diff(dayjs(previous), 'second');
    if (diff < 60) return `${diff}s`;
    return `${Math.floor(diff / 60)}m`;
  };

  // Get all unique event types for filter
  const allEventTypes = Array.from(new Set(events.map(e => e.action))).sort();

  // Handle event click
  const handleEventClick = (event: AuditLog) => {
    setSelectedEvent(event);
    setDetailModalOpen(true);
  };

  // Clear filters
  const handleClearFilters = () => {
    setEventTypeFilter('');
    setUserFilter('');
    setSearchQuery('');
  };

  return (
    <Box sx={{
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      bgcolor: 'background.default',
    }}>
      {/* Header */}
      <Paper
        elevation={0}
        sx={{
          p: 2,
          borderRadius: 0,
          borderBottom: 1,
          borderColor: 'divider',
          bgcolor: 'background.paper',
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <TimelineIcon sx={{ fontSize: 32, color: 'primary.main' }} />
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 700 }}>
                {t('realtimeEvents.title')}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {t('realtimeEvents.subtitle')}
              </Typography>
            </Box>
          </Box>

          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            {/* Auto-refresh indicator */}
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                px: 2,
                py: 0.5,
                borderRadius: 2,
                bgcolor: autoRefresh ? alpha(theme.palette.success.main, 0.1) : alpha(theme.palette.grey[500], 0.1),
                border: 1,
                borderColor: autoRefresh ? 'success.main' : 'divider',
              }}
            >
              <DotIcon
                sx={{
                  fontSize: 12,
                  color: autoRefresh ? 'success.main' : 'grey.500',
                  animation: autoRefresh ? 'pulse 2s infinite' : 'none',
                  '@keyframes pulse': {
                    '0%, 100%': { opacity: 1 },
                    '50%': { opacity: 0.3 },
                  },
                }}
              />
              <Typography variant="caption" sx={{ fontWeight: 600 }}>
                {autoRefresh ? 'LIVE' : 'PAUSED'}
              </Typography>
            </Box>

            <Tooltip title={autoRefresh ? t('common.pause') : t('common.play')}>
              <IconButton
                onClick={() => setAutoRefresh(!autoRefresh)}
                color={autoRefresh ? 'success' : 'default'}
                size="small"
              >
                {autoRefresh ? <PauseIcon /> : <PlayIcon />}
              </IconButton>
            </Tooltip>

            <Tooltip title={t('realtimeEvents.filters.title')}>
              <IconButton
                onClick={() => setShowFilters(!showFilters)}
                color={showFilters ? 'primary' : 'default'}
                size="small"
              >
                <Badge badgeContent={[eventTypeFilter, userFilter, searchQuery].filter(Boolean).length} color="primary">
                  <FilterListIcon />
                </Badge>
              </IconButton>
            </Tooltip>

            <Tooltip title={t('common.refresh')}>
              <IconButton onClick={loadEvents} size="small">
                <RefreshIcon />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        {/* Filters */}
        <Collapse in={showFilters}>
          <Box sx={{ mt: 2 }}>
            <Grid container spacing={2}>
              <Grid item xs={12} md={3}>
                <TextField
                  fullWidth
                  size="small"
                  label={t('realtimeEvents.filters.user')}
                  placeholder={t('realtimeEvents.filters.userPlaceholder')}
                  value={userFilter}
                  onChange={(e) => setUserFilter(e.target.value)}
                  InputProps={{
                    startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />,
                  }}
                />
              </Grid>
              <Grid item xs={12} md={3}>
                <FormControl fullWidth size="small">
                  <InputLabel>{t('realtimeEvents.filters.eventType')}</InputLabel>
                  <Select
                    value={eventTypeFilter}
                    label={t('realtimeEvents.filters.eventType')}
                    onChange={(e) => setEventTypeFilter(e.target.value)}
                  >
                    <MenuItem value="">{t('realtimeEvents.filters.allEventTypes')}</MenuItem>
                    {allEventTypes.map((type) => (
                      <MenuItem key={type} value={type}>{type}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  size="small"
                  label={t('common.search')}
                  placeholder={t('common.search')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  InputProps={{
                    startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />,
                  }}
                />
              </Grid>
              <Grid item xs={12} md={2}>
                <Button
                  fullWidth
                  variant="outlined"
                  onClick={handleClearFilters}
                  sx={{ height: '40px' }}
                >
                  {t('realtimeEvents.filters.clear')}
                </Button>
              </Grid>
            </Grid>
          </Box>
        </Collapse>
      </Paper>

      {/* Main Content */}
      <Box sx={{ flex: 1, overflow: 'hidden', display: 'flex', p: 2, gap: 2, bgcolor: 'background.default' }}>
        {/* Left: Timeline View */}
        <Paper
          elevation={1}
          sx={{
            flex: '0 0 280px',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            bgcolor: 'background.paper',
          }}
        >
          <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', fontSize: '0.75rem' }}>
              Timeline
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {t('realtimeEvents.last30Minutes')}
            </Typography>
          </Box>

          <Box sx={{ flex: 1, overflowY: 'auto', p: 2 }}>
            {loading ? (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <Typography variant="caption" color="text.secondary">{t('common.loading')}</Typography>
              </Box>
            ) : timelineGroups.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 8 }}>
                <TimelineIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
                <Typography variant="h6" color="text.secondary" gutterBottom>
                  {t('realtimeEvents.noEventsYet')}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {t('realtimeEvents.noEventsDescription')}
                </Typography>
              </Box>
            ) : (
              <Stack spacing={1}>
                {timelineGroups.map((group) => (
                  <Box
                    key={group.timestamp}
                    sx={{
                      p: 1.5,
                      borderRadius: 1,
                      bgcolor: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
                      border: 1,
                      borderColor: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'divider',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      '&:hover': {
                        bgcolor: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.04)',
                        borderColor: 'primary.main',
                      },
                    }}
                  >
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {group.timestamp}
                      </Typography>
                      <Chip
                        label={group.count}
                        size="small"
                        sx={{
                          height: 20,
                          fontSize: '0.7rem',
                          bgcolor: 'primary.main',
                          color: 'primary.contrastText',
                        }}
                      />
                    </Box>
                    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                      {Array.from(new Set(group.events.map(e => e.action))).slice(0, 3).map((action) => (
                        <Chip
                          key={action}
                          label={action}
                          size="small"
                          variant="outlined"
                          sx={{
                            height: 18,
                            fontSize: '0.65rem',
                            '& .MuiChip-label': { px: 0.5 },
                          }}
                        />
                      ))}
                      {Array.from(new Set(group.events.map(e => e.action))).length > 3 && (
                        <Typography variant="caption" color="text.secondary">
                          +{Array.from(new Set(group.events.map(e => e.action))).length - 3}
                        </Typography>
                      )}
                    </Box>
                  </Box>
                ))}
              </Stack>
            )}
          </Box>
        </Paper>

        {/* Center: Event Stream */}
        <Paper
          elevation={1}
          sx={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            bgcolor: 'background.paper',
          }}
        >
          <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', fontSize: '0.75rem' }}>
              {t('realtimeEvents.eventStream')}
            </Typography>
          </Box>

          <Box
            ref={eventStreamRef}
            sx={{
              flex: 1,
              overflowY: 'auto',
              p: 2,
            }}
          >
            {loading ? (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <Typography color="text.secondary">{t('realtimeEvents.waitingForEvents')}</Typography>
              </Box>
            ) : events.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 8 }}>
                <EventIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
                <Typography variant="h6" color="text.secondary" gutterBottom>
                  {t('realtimeEvents.noEventsYet')}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                  {t('realtimeEvents.noEventsDescription')}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontStyle: 'italic' }}>
                  {t('realtimeEvents.eventsGeneratedBy')}
                </Typography>
              </Box>
            ) : (
              <Stack spacing={1.5}>
                {events.map((event, index) => {
                  const timeDiff = index < events.length - 1 ? getTimeDiff(event.createdAt, events[index + 1].createdAt) : '';

                  return (
                    <Box
                      key={event.id}
                      sx={{
                        display: 'flex',
                        gap: 2,
                        p: 1.5,
                        borderRadius: 1,
                        bgcolor: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.01)',
                        border: 1,
                        borderColor: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'transparent',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        '&:hover': {
                          bgcolor: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
                          borderColor: getEventColor(event.action),
                        },
                      }}
                      onClick={() => handleEventClick(event)}
                    >
                      {/* Time */}
                      <Box sx={{ flex: '0 0 60px', textAlign: 'right' }}>
                        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                          {dayjs(event.createdAt).format('HH:mm:ss')}
                        </Typography>
                        {timeDiff && (
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontSize: '0.65rem' }}>
                            +{timeDiff}
                          </Typography>
                        )}
                      </Box>

                      {/* Icon */}
                      <Box sx={{ flex: '0 0 auto' }}>
                        <Avatar
                          sx={{
                            width: 32,
                            height: 32,
                            fontSize: '0.875rem',
                            bgcolor: alpha(getEventColor(event.action), 0.1),
                            color: getEventColor(event.action),
                            border: 2,
                            borderColor: getEventColor(event.action),
                          }}
                        >
                          {getEventIcon(event.action)}
                        </Avatar>
                      </Box>

                      {/* Content */}
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                          <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
                            {event.action}
                          </Typography>
                          {event.entityType && (
                            <Chip
                              label={event.entityType}
                              size="small"
                              variant="outlined"
                              sx={{ height: 18, fontSize: '0.65rem' }}
                            />
                          )}
                        </Box>
                        <Typography variant="caption" color="text.secondary" noWrap>
                          {event.user?.email || 'System'}
                        </Typography>
                      </Box>

                      {/* IP Address */}
                      <Box sx={{ flex: '0 0 120px', textAlign: 'right' }}>
                        <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
                          {event.ipAddress || 'N/A'}
                        </Typography>
                      </Box>
                    </Box>
                  );
                })}
              </Stack>
            )}
          </Box>
        </Paper>

        {/* Right: Stats & Top Events */}
        <Paper
          elevation={1}
          sx={{
            flex: '0 0 320px',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            bgcolor: 'background.paper',
          }}
        >
          <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', fontSize: '0.75rem' }}>
              {t('realtimeEvents.topEvents')}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {t('realtimeEvents.last30Minutes')}
            </Typography>
          </Box>

          <Box sx={{ flex: 1, overflowY: 'auto' }}>
            {/* Stats Cards */}
            <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
              <Grid container spacing={1}>
                <Grid item xs={4}>
                  <Paper
                    elevation={0}
                    sx={{
                      p: 1.5,
                      textAlign: 'center',
                      bgcolor: alpha(theme.palette.primary.main, 0.1),
                      border: 1,
                      borderColor: alpha(theme.palette.primary.main, 0.3),
                    }}
                  >
                    <Typography variant="h5" sx={{ fontWeight: 700, color: 'primary.main' }}>
                      {events.length}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                      Events
                    </Typography>
                  </Paper>
                </Grid>
                <Grid item xs={4}>
                  <Paper
                    elevation={0}
                    sx={{
                      p: 1.5,
                      textAlign: 'center',
                      bgcolor: alpha(theme.palette.success.main, 0.1),
                      border: 1,
                      borderColor: alpha(theme.palette.success.main, 0.3),
                    }}
                  >
                    <Typography variant="h5" sx={{ fontWeight: 700, color: 'success.main' }}>
                      {uniqueUsers}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                      Users
                    </Typography>
                  </Paper>
                </Grid>
                <Grid item xs={4}>
                  <Paper
                    elevation={0}
                    sx={{
                      p: 1.5,
                      textAlign: 'center',
                      bgcolor: alpha(theme.palette.info.main, 0.1),
                      border: 1,
                      borderColor: alpha(theme.palette.info.main, 0.3),
                    }}
                  >
                    <Typography variant="h5" sx={{ fontWeight: 700, color: 'info.main' }}>
                      {eventTypes}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                      Types
                    </Typography>
                  </Paper>
                </Grid>
              </Grid>
            </Box>

            {/* Top Events List */}
            <Box sx={{ p: 2 }}>
              <Stack spacing={1}>
                {topEvents.map((stat, index) => (
                  <Box
                    key={stat.action}
                    sx={{
                      p: 1.5,
                      borderRadius: 1,
                      bgcolor: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.01)',
                      borderLeft: 3,
                      borderColor: getEventColor(stat.action),
                    }}
                  >
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                      <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
                        {stat.action}
                      </Typography>
                      <Chip
                        label={stat.count}
                        size="small"
                        sx={{
                          bgcolor: getEventColor(stat.action),
                          color: '#fff',
                          fontWeight: 700,
                          minWidth: 32,
                        }}
                      />
                    </Box>
                    <Typography variant="caption" color="text.secondary">
                      {((stat.count / events.length) * 100).toFixed(1)}% of total
                    </Typography>
                  </Box>
                ))}
              </Stack>
            </Box>
          </Box>
        </Paper>
      </Box>

      {/* Event Detail Modal */}
      <Dialog
        open={detailModalOpen}
        onClose={() => setDetailModalOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Avatar
              sx={{
                width: 32,
                height: 32,
                bgcolor: selectedEvent ? getEventColor(selectedEvent.action) : 'grey',
              }}
            >
              {selectedEvent ? getEventIcon(selectedEvent.action) : '?'}
            </Avatar>
            <Typography variant="h6">{t('realtimeEvents.eventDetails')}</Typography>
          </Box>
          <IconButton onClick={() => setDetailModalOpen(false)}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        <DialogContent dividers>
          {selectedEvent && (
            <Stack spacing={2}>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  {t('realtimeEvents.eventType')}
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                  <Chip
                    label={selectedEvent.action}
                    sx={{
                      bgcolor: alpha(getEventColor(selectedEvent.action), 0.1),
                      color: getEventColor(selectedEvent.action),
                      fontWeight: 600,
                    }}
                  />
                  {selectedEvent.entityType && (
                    <Chip label={selectedEvent.entityType} variant="outlined" />
                  )}
                </Box>
              </Box>

              <Divider />

              <Box>
                <Typography variant="caption" color="text.secondary">
                  {t('realtimeEvents.timestamp')}
                </Typography>
                <Typography variant="body1" sx={{ mt: 0.5 }}>
                  {formatDateTimeDetailed(selectedEvent.createdAt)}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  ({dayjs(selectedEvent.createdAt).fromNow()})
                </Typography>
              </Box>

              <Divider />

              <Box>
                <Typography variant="caption" color="text.secondary">
                  {t('realtimeEvents.user')}
                </Typography>
                <Typography variant="body1" sx={{ mt: 0.5 }}>
                  {selectedEvent.user?.name || 'N/A'}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {selectedEvent.user?.email || 'System'}
                </Typography>
              </Box>

              <Divider />

              <Box>
                <Typography variant="caption" color="text.secondary">
                  {t('realtimeEvents.ipAddress')}
                </Typography>
                <Typography variant="body1" sx={{ mt: 0.5 }}>
                  {selectedEvent.ipAddress || 'N/A'}
                </Typography>
              </Box>

              {selectedEvent.entityId && (
                <>
                  <Divider />
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      {t('realtimeEvents.resource')}
                    </Typography>
                    <Typography variant="body1" sx={{ mt: 0.5 }}>
                      {selectedEvent.entityType} #{selectedEvent.entityId}
                    </Typography>
                  </Box>
                </>
              )}

              {selectedEvent.oldValues && (
                <>
                  <Divider />
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      {t('realtimeEvents.oldValues')}
                    </Typography>
                    <Paper sx={{ p: 1, mt: 0.5, bgcolor: 'background.default' }}>
                      <pre style={{ margin: 0, fontSize: '0.75rem', overflow: 'auto' }}>
                        {JSON.stringify(selectedEvent.oldValues, null, 2)}
                      </pre>
                    </Paper>
                  </Box>
                </>
              )}

              {selectedEvent.newValues && (
                <>
                  <Divider />
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      {t('realtimeEvents.newValues')}
                    </Typography>
                    <Paper sx={{ p: 1, mt: 0.5, bgcolor: 'background.default' }}>
                      <pre style={{ margin: 0, fontSize: '0.75rem', overflow: 'auto' }}>
                        {JSON.stringify(selectedEvent.newValues, null, 2)}
                      </pre>
                    </Paper>
                  </Box>
                </>
              )}

              {selectedEvent.userAgent && (
                <>
                  <Divider />
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      {t('realtimeEvents.userAgent')}
                    </Typography>
                    <Typography variant="body2" sx={{ mt: 0.5, wordBreak: 'break-all' }}>
                      {selectedEvent.userAgent}
                    </Typography>
                  </Box>
                </>
              )}
            </Stack>
          )}
        </DialogContent>

        <DialogActions>
          <Button onClick={() => setDetailModalOpen(false)}>
            {t('common.close')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default RealtimeEventsPage;


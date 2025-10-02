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
  CircularProgress,
} from '@mui/material';
import Timeline from '@mui/lab/Timeline';
import TimelineItem from '@mui/lab/TimelineItem';
import TimelineSeparator from '@mui/lab/TimelineSeparator';
import TimelineConnector from '@mui/lab/TimelineConnector';
import TimelineContent from '@mui/lab/TimelineContent';
import TimelineDot from '@mui/lab/TimelineDot';
import TimelineOppositeContent from '@mui/lab/TimelineOppositeContent';
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
import utc from 'dayjs/plugin/utc';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/ko';
import 'dayjs/locale/zh-cn';
import { useI18n } from '../../contexts/I18nContext';

dayjs.extend(utc);
dayjs.extend(relativeTime);

interface EventStats {
  action: string;
  count: number;
}

interface TimelineGroup {
  timestamp: string;
  timeLabel: string; // e.g., "10:08 PM"
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
  const [refreshProgress, setRefreshProgress] = useState(0);
  const eventStreamRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [newEventIds, setNewEventIds] = useState<Set<number>>(new Set());
  const previousEventIdsRef = useRef<Set<number>>(new Set());

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
  const [changedGroupKeys, setChangedGroupKeys] = useState<Set<string>>(new Set());
  const previousGroupCountsRef = useRef<Map<string, number>>(new Map());

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
      // Use server time instead of client time to avoid timezone issues
      const now = new Date();
      const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000);

      console.log('[RealtimeEvents] Loading events:', {
        start_date: thirtyMinutesAgo.toISOString(),
        end_date: now.toISOString(),
        eventTypeFilter,
        userFilter,
        clientTime: now.toString()
      });

      const filters: any = {
        start_date: thirtyMinutesAgo.toISOString(),
        end_date: now.toISOString(),
      };

      if (eventTypeFilter) {
        filters.action = eventTypeFilter;
      }

      if (userFilter) {
        filters.user = userFilter;
      }

      const result = await AuditLogService.getAuditLogs(1, 100, filters);

      console.log('[RealtimeEvents] Loaded events:', {
        count: result?.logs?.length || 0,
        total: result?.total || 0
      });

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

        // Detect new events
        const currentEventIds = new Set(filteredEvents.map(e => e.id));
        const newIds = new Set<number>();

        currentEventIds.forEach(id => {
          if (!previousEventIdsRef.current.has(id)) {
            newIds.add(id);
          }
        });

        if (newIds.size > 0) {
          setNewEventIds(newIds);
          // Remove flash effect after 2 seconds
          setTimeout(() => {
            setNewEventIds(new Set());
          }, 2000);
        }

        previousEventIdsRef.current = currentEventIds;
        setEvents(filteredEvents);

        // Group events by minute for timeline view
        const groups: Record<string, { events: AuditLog[], timeLabel: string }> = {};
        filteredEvents.forEach((log) => {
          const minuteKey = dayjs(log.createdAt).format('HH:mm');
          const timeLabel = dayjs(log.createdAt).format('h:mm A'); // e.g., "10:08 PM"
          if (!groups[minuteKey]) {
            groups[minuteKey] = { events: [], timeLabel };
          }
          groups[minuteKey].events.push(log);
        });

        const timelineData: TimelineGroup[] = Object.entries(groups)
          .map(([timestamp, { events, timeLabel }]) => ({
            timestamp,
            timeLabel,
            events,
            count: events.length,
          }))
          .sort((a, b) => b.timestamp.localeCompare(a.timestamp));

        // Detect changed group counts for rumble effect
        const changedKeys = new Set<string>();
        const newGroupCounts = new Map<string, number>();

        timelineData.forEach(group => {
          newGroupCounts.set(group.timestamp, group.count);
          const prevCount = previousGroupCountsRef.current.get(group.timestamp);
          if (prevCount !== undefined && prevCount !== group.count) {
            changedKeys.add(group.timestamp);
          }
        });

        if (changedKeys.size > 0) {
          setChangedGroupKeys(changedKeys);
          // Remove rumble effect after 600ms
          setTimeout(() => {
            setChangedGroupKeys(new Set());
          }, 600);
        }

        previousGroupCountsRef.current = newGroupCounts;
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

  // Auto refresh every 5 seconds with progress
  useEffect(() => {
    if (autoRefresh) {
      // Reset progress
      setRefreshProgress(0);

      // Update progress every 50ms (5000ms / 100 = 50ms per 1%)
      progressIntervalRef.current = setInterval(() => {
        setRefreshProgress((prev) => {
          const next = prev + 1;
          if (next > 100) {
            // Reset to 0 when exceeding 100%
            return 0;
          }
          return next;
        });
      }, 50);

      // Refresh data every 5 seconds
      intervalRef.current = setInterval(() => {
        loadEvents();
        setRefreshProgress(0); // Reset progress when loading
      }, 5000);
    } else {
      setRefreshProgress(0);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
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
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      bgcolor: 'background.default',
      overflow: 'hidden',
      p: 3,
    }}>
      {/* Header */}
      <Paper
        elevation={0}
        sx={{
          p: 3,
          mb: 2,
          borderRadius: 1,
          bgcolor: 'background.paper',
          flexShrink: 0,
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
            {/* Auto-refresh indicator with circular progress */}
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
              {/* Circular progress indicator */}
              <Box sx={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {autoRefresh ? (
                  <>
                    {/* Background circle */}
                    <CircularProgress
                      variant="determinate"
                      value={100}
                      size={16}
                      thickness={6}
                      sx={{
                        color: alpha(theme.palette.success.main, 0.2),
                        position: 'absolute',
                      }}
                    />
                    {/* Progress circle */}
                    <CircularProgress
                      variant="determinate"
                      value={refreshProgress}
                      size={16}
                      thickness={6}
                      sx={{
                        color: 'success.main',
                        '& .MuiCircularProgress-circle': {
                          strokeLinecap: 'round',
                        },
                      }}
                    />
                  </>
                ) : (
                  <DotIcon
                    sx={{
                      fontSize: 16,
                      color: 'grey.500',
                    }}
                  />
                )}
              </Box>

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
      <Box sx={{
        flex: 1,
        overflow: 'hidden',
        display: 'flex',
        gap: 2,
        minHeight: 0,
      }}>
        {/* Left: Timeline View */}
        <Paper
          elevation={1}
          sx={{
            flex: '0 0 360px',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            bgcolor: 'background.paper',
          }}
        >
          <Box sx={{
            p: 2,
            borderBottom: 1,
            borderColor: 'divider',
            height: '72px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-end',
          }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', fontSize: '0.75rem' }}>
              Timeline
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {t('realtimeEvents.last30Minutes')}
            </Typography>
          </Box>

          <Box sx={{
            flex: 1,
            overflowY: 'auto',
            // Chat-style scrollbar
            '&::-webkit-scrollbar': {
              width: '8px',
            },
            '&::-webkit-scrollbar-track': {
              background: 'transparent',
            },
            '&::-webkit-scrollbar-thumb': {
              background: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)',
              borderRadius: '4px',
            },
            '&::-webkit-scrollbar-thumb:hover': {
              background: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.3)',
            },
            '&::-webkit-scrollbar-thumb:active': {
              background: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.4)',
            },
            scrollbarWidth: 'thin',
            scrollbarColor: theme.palette.mode === 'dark'
              ? 'rgba(255, 255, 255, 0.2) transparent'
              : 'rgba(0, 0, 0, 0.2) transparent',
          }}>
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
              <Timeline
                sx={{
                  p: 2,
                  m: 0,
                  '& .MuiTimelineItem-root': {
                    '&:before': {
                      content: 'none',
                    },
                    minHeight: 80,
                  },
                  '& .MuiTimelineContent-root': {
                    py: 0,
                    px: 2,
                  },
                  '& .MuiTimelineDot-root': {
                    margin: 0,
                  },
                  '& .MuiTimelineConnector-root': {
                    bgcolor: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)',
                    width: '2px',
                  },
                }}
              >
                {timelineGroups.map((group, index) => {
                  const isChanged = changedGroupKeys.has(group.timestamp);

                  return (
                  <TimelineItem key={group.timestamp}>
                    <TimelineSeparator>
                      <TimelineDot
                        sx={{
                          bgcolor: 'transparent',
                          boxShadow: 'none',
                          p: 0,
                          m: 0,
                          position: 'relative',
                        }}
                      >
                        {/* Outer glow ring */}
                        <Box
                          sx={{
                            position: 'absolute',
                            width: 56,
                            height: 56,
                            borderRadius: '50%',
                            bgcolor: alpha(theme.palette.primary.main, 0.1),
                            animation: 'pulse 2s ease-in-out infinite',
                            '@keyframes pulse': {
                              '0%, 100%': {
                                transform: 'scale(1)',
                                opacity: 0.5,
                              },
                              '50%': {
                                transform: 'scale(1.1)',
                                opacity: 0.3,
                              },
                            },
                          }}
                        />
                        {/* Main circle */}
                        <Box
                          sx={{
                            position: 'relative',
                            width: 48,
                            height: 48,
                            borderRadius: '50%',
                            bgcolor: 'primary.main',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '0.875rem',
                            fontWeight: 700,
                            color: 'primary.contrastText',
                            boxShadow: `0 4px 12px ${alpha(theme.palette.primary.main, 0.4)}`,
                            border: 4,
                            borderColor: 'background.paper',
                            transition: 'all 0.3s ease',
                            animation: isChanged ? 'rumble 0.6s ease-out' : 'none',
                            '@keyframes rumble': {
                              '0%, 100%': {
                                transform: 'translate(0, 0) scale(1)',
                              },
                              '10%': {
                                transform: 'translate(-2px, -1px) scale(1.05)',
                              },
                              '20%': {
                                transform: 'translate(2px, 1px) scale(1.05)',
                              },
                              '30%': {
                                transform: 'translate(-2px, 1px) scale(1.05)',
                              },
                              '40%': {
                                transform: 'translate(2px, -1px) scale(1.05)',
                              },
                              '50%': {
                                transform: 'translate(-1px, -1px) scale(1.03)',
                              },
                              '60%': {
                                transform: 'translate(1px, 1px) scale(1.03)',
                              },
                              '70%': {
                                transform: 'translate(-1px, 1px) scale(1.02)',
                              },
                              '80%': {
                                transform: 'translate(1px, -1px) scale(1.02)',
                              },
                              '90%': {
                                transform: 'translate(-1px, 0) scale(1.01)',
                              },
                            },
                            '&:hover': {
                              transform: 'scale(1.1)',
                              boxShadow: `0 6px 16px ${alpha(theme.palette.primary.main, 0.5)}`,
                            },
                          }}
                        >
                          {group.count}
                        </Box>
                      </TimelineDot>
                      {index < timelineGroups.length - 1 && (
                        <TimelineConnector sx={{ minHeight: 50 }} />
                      )}
                    </TimelineSeparator>
                    <TimelineContent sx={{ pt: 1.5 }}>
                      <Typography
                        variant="caption"
                        sx={{
                          display: 'block',
                          mb: 1.5,
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          color: 'text.primary',
                          letterSpacing: '0.5px',
                        }}
                      >
                        {group.timeLabel}
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
                        {Array.from(new Set(group.events.map(e => e.action))).slice(0, 3).map((action, idx) => (
                          <Chip
                            key={action}
                            label={action}
                            size="small"
                            sx={{
                              height: 26,
                              fontSize: '0.7rem',
                              fontWeight: 500,
                              bgcolor: theme.palette.mode === 'dark'
                                ? alpha(theme.palette.primary.main, 0.15)
                                : alpha(theme.palette.primary.main, 0.08),
                              color: theme.palette.mode === 'dark' ? 'primary.light' : 'primary.dark',
                              border: 1,
                              borderColor: theme.palette.mode === 'dark'
                                ? alpha(theme.palette.primary.main, 0.3)
                                : alpha(theme.palette.primary.main, 0.2),
                              '& .MuiChip-label': { px: 1.5 },
                              transition: 'all 0.2s ease',
                              '&:hover': {
                                bgcolor: theme.palette.mode === 'dark'
                                  ? alpha(theme.palette.primary.main, 0.25)
                                  : alpha(theme.palette.primary.main, 0.15),
                                transform: 'translateY(-2px)',
                                boxShadow: 1,
                              },
                            }}
                          />
                        ))}
                        {Array.from(new Set(group.events.map(e => e.action))).length > 3 && (
                          <Chip
                            label={`+${Array.from(new Set(group.events.map(e => e.action))).length - 3}`}
                            size="small"
                            sx={{
                              height: 26,
                              fontSize: '0.7rem',
                              fontWeight: 600,
                              bgcolor: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
                              color: 'text.secondary',
                              '& .MuiChip-label': { px: 1 },
                            }}
                          />
                        )}
                      </Box>
                    </TimelineContent>
                  </TimelineItem>
                  );
                })}
              </Timeline>
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
          <Box sx={{
            p: 2,
            borderBottom: 1,
            borderColor: 'divider',
            height: '72px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-end',
          }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', fontSize: '0.75rem', mb: '20px' }}>
              {t('realtimeEvents.eventStream')}
            </Typography>
          </Box>

          <Box
            ref={eventStreamRef}
            sx={{
              flex: 1,
              overflowY: 'auto',
              p: 2,
              // Chat-style scrollbar
              '&::-webkit-scrollbar': {
                width: '8px',
              },
              '&::-webkit-scrollbar-track': {
                background: 'transparent',
              },
              '&::-webkit-scrollbar-thumb': {
                background: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)',
                borderRadius: '4px',
              },
              '&::-webkit-scrollbar-thumb:hover': {
                background: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.3)',
              },
              '&::-webkit-scrollbar-thumb:active': {
                background: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.4)',
              },
              scrollbarWidth: 'thin',
              scrollbarColor: theme.palette.mode === 'dark'
                ? 'rgba(255, 255, 255, 0.2) transparent'
                : 'rgba(0, 0, 0, 0.2) transparent',
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
              <Stack spacing={0}>
                {events.map((event, index) => {
                  const timeDiff = index < events.length - 1 ? getTimeDiff(event.createdAt, events[index + 1].createdAt) : '';
                  const isNew = newEventIds.has(event.id);

                  return (
                    <React.Fragment key={event.id}>
                      <Box
                        sx={{
                          display: 'flex',
                          gap: 1.5,
                          py: 1.5,
                          px: 2,
                          cursor: 'pointer',
                          transition: 'all 0.15s',
                          borderLeft: '3px solid transparent',
                          alignItems: 'center',
                          bgcolor: isNew
                            ? (theme.palette.mode === 'dark'
                              ? alpha(theme.palette.primary.main, 0.15)
                              : alpha(theme.palette.primary.main, 0.08))
                            : 'transparent',
                          animation: isNew ? 'flashEffect 2s ease-out' : 'none',
                          '@keyframes flashEffect': {
                            '0%': {
                              bgcolor: theme.palette.mode === 'dark'
                                ? alpha(theme.palette.primary.main, 0.25)
                                : alpha(theme.palette.primary.main, 0.15),
                            },
                            '100%': {
                              bgcolor: 'transparent',
                            },
                          },
                          '&:hover': {
                            bgcolor: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
                            borderLeftColor: getEventColor(event.action),
                          },
                        }}
                        onClick={() => handleEventClick(event)}
                      >
                        {/* Time */}
                        <Box sx={{ flex: '0 0 80px', display: 'flex', alignItems: 'center' }}>
                          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500, fontSize: '0.7rem' }}>
                            {dayjs(event.createdAt).format('h:mm:ss A')}
                          </Typography>
                        </Box>

                        {/* Icon */}
                        <Box sx={{ flex: '0 0 auto' }}>
                          <Avatar
                            sx={{
                              width: 28,
                              height: 28,
                              fontSize: '0.75rem',
                              bgcolor: getEventColor(event.action),
                              color: '#fff',
                              fontWeight: 700,
                            }}
                          >
                            {getEventIcon(event.action)}
                          </Avatar>
                        </Box>

                        {/* Content */}
                        <Box sx={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center' }}>
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.25 }} noWrap>
                              {event.action}
                            </Typography>
                            {event.user && (
                              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontSize: '0.7rem' }} noWrap>
                                {event.user.name || event.user.email}
                              </Typography>
                            )}
                          </Box>
                        </Box>

                        {/* Time diff indicator */}
                        {timeDiff && (
                          <Box sx={{ flex: '0 0 auto' }}>
                            <Chip
                              label={timeDiff}
                              size="small"
                              sx={{
                                height: 18,
                                fontSize: '0.65rem',
                                bgcolor: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
                                color: 'text.secondary',
                                '& .MuiChip-label': { px: 0.75 },
                              }}
                            />
                          </Box>
                        )}
                      </Box>

                      {/* Divider between events */}
                      {index < events.length - 1 && (
                        <Divider sx={{ opacity: 0.3 }} />
                      )}
                    </React.Fragment>
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
            flex: '0 0 360px',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            bgcolor: 'background.paper',
          }}
        >
          <Box sx={{
            p: 2,
            borderBottom: 1,
            borderColor: 'divider',
            height: '72px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-end',
          }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', fontSize: '0.75rem' }}>
              {t('realtimeEvents.topEvents')}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {t('realtimeEvents.last30Minutes')}
            </Typography>
          </Box>

          <Box sx={{
            flex: 1,
            overflowY: 'auto',
            // Chat-style scrollbar
            '&::-webkit-scrollbar': {
              width: '8px',
            },
            '&::-webkit-scrollbar-track': {
              background: 'transparent',
            },
            '&::-webkit-scrollbar-thumb': {
              background: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)',
              borderRadius: '4px',
            },
            '&::-webkit-scrollbar-thumb:hover': {
              background: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.3)',
            },
            '&::-webkit-scrollbar-thumb:active': {
              background: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.4)',
            },
            scrollbarWidth: 'thin',
            scrollbarColor: theme.palette.mode === 'dark'
              ? 'rgba(255, 255, 255, 0.2) transparent'
              : 'rgba(0, 0, 0, 0.2) transparent',
          }}>
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


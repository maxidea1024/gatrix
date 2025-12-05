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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Stack,
  Collapse,
  useTheme,
  Tab,
  Tabs,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
} from '@mui/material';
import ReactDiffViewer, { DiffMethod } from 'react-diff-viewer-continued';
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
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  FiberManualRecord as DotIcon,
  PlayArrow as PlayIcon,
  Pause as PauseIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  Lock as LockIcon,
  LockOpen as LockOpenIcon,
  Check as CheckIcon,
  Clear as ClearIcon,
  Login as LoginIcon,
  Logout as LogoutIcon,
  Settings as SettingsIcon,
  Build as BuildIcon,
  Security as SecurityIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  Star as StarIcon,
  Flag as FlagIcon,
  Send as SendIcon,
  Mail as MailIcon,
  Notifications as NotificationsIcon,
  AccountCircle as AccountCircleIcon,
  Group as GroupIcon,
  Public as PublicIcon,
  Language as LanguageIcon,
  Update as UpdateIcon,
  Sync as SyncIcon,
  CloudUpload as CloudUploadIcon,
  CloudDownload as CloudDownloadIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
  Done as DoneIcon,
  Block as BlockIcon,
  CheckCircle as CheckCircleIcon,
  RadioButtonUnchecked as RadioButtonUncheckedIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import { AuditLogService } from '../../services/auditLogService';
import { AuditLog } from '../../types';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import relativeTime from 'dayjs/plugin/relativeTime';
import updateLocale from 'dayjs/plugin/updateLocale';
import 'dayjs/locale/ko';
import 'dayjs/locale/zh-cn';
import { useI18n } from '../../contexts/I18nContext';
import DynamicFilterBar, { FilterDefinition, ActiveFilter } from '../../components/common/DynamicFilterBar';
import { getStoredTimezone, formatDateTimeDetailed } from '../../utils/dateFormat';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(relativeTime);
dayjs.extend(updateLocale);

// Customize relativeTime thresholds and strings
dayjs.updateLocale('ko', {
  relativeTime: {
    future: '%s 후',
    past: '%s 전',
    s: '방금',
    m: '1분',
    mm: '%d분',
    h: '1시간',
    hh: '%d시간',
    d: '1일',
    dd: '%d일',
    M: '1개월',
    MM: '%d개월',
    y: '1년',
    yy: '%d년',
  },
});

dayjs.updateLocale('en', {
  relativeTime: {
    future: 'in %s',
    past: '%s ago',
    s: 'just now',
    m: '1 min',
    mm: '%d mins',
    h: '1 hour',
    hh: '%d hours',
    d: '1 day',
    dd: '%d days',
    M: '1 month',
    MM: '%d months',
    y: '1 year',
    yy: '%d years',
  },
});

dayjs.updateLocale('zh-cn', {
  relativeTime: {
    future: '%s后',
    past: '%s前',
    s: '刚刚',
    m: '1分钟',
    mm: '%d分钟',
    h: '1小时',
    hh: '%d小时',
    d: '1天',
    dd: '%d天',
    M: '1个月',
    MM: '%d个月',
    y: '1年',
    yy: '%d年',
  },
});

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

  // Load autoRefresh setting from localStorage (default: true)
  const [autoRefresh, setAutoRefresh] = useState(() => {
    const saved = localStorage.getItem('realtimeEvents.autoRefresh');
    return saved !== null ? saved === 'true' : true;
  });

  const [refreshProgress, setRefreshProgress] = useState(0);
  const eventStreamRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [newEventIds, setNewEventIds] = useState<Set<number>>(new Set());
  const previousEventIdsRef = useRef<Set<number>>(new Set());

  // Track the latest event timestamp for incremental updates
  const latestEventTimestampRef = useRef<Date | null>(null);
  const isInitialLoadRef = useRef<boolean>(true);

  // 동적 필터 상태
  const [activeFilters, setActiveFilters] = useState<ActiveFilter[]>([]);

  // 동적 필터에서 값 추출
  const eventTypeFilter = activeFilters.find(f => f.key === 'action')?.value as string | string[] || '';
  const eventTypeOperator = activeFilters.find(f => f.key === 'action')?.operator;
  const resourceTypeFilter = activeFilters.find(f => f.key === 'resource_type')?.value as string | string[] || '';
  const resourceTypeOperator = activeFilters.find(f => f.key === 'resource_type')?.operator;
  const userFilter = activeFilters.find(f => f.key === 'user')?.value as string || '';

  // Detail panel
  const [selectedEvent, setSelectedEvent] = useState<AuditLog | null>(null);

  // Stats
  const [uniqueUsers, setUniqueUsers] = useState(0);
  const [eventTypes, setEventTypes] = useState(0);

  // View mode
  const [viewMode, setViewMode] = useState<'stream' | 'timeline'>('timeline');

  // Timeline groups (grouped by minute)
  const [timelineGroups, setTimelineGroups] = useState<TimelineGroup[]>([]);
  const [changedGroupKeys, setChangedGroupKeys] = useState<Set<string>>(new Set());
  const previousGroupCountsRef = useRef<Map<string, number>>(new Map());

  // New events notification - track which events have been seen
  const [hasUnseenEvents, setHasUnseenEvents] = useState(false);
  const [unseenEventCount, setUnseenEventCount] = useState(0);
  const [seenEventIds, setSeenEventIds] = useState<Set<number>>(() => {
    const saved = localStorage.getItem('realtimeEvents_seenEventIds');
    return saved ? new Set(JSON.parse(saved)) : new Set();
  });
  const timelineContainerRef = useRef<HTMLDivElement>(null);
  const firstEventRef = useRef<HTMLDivElement>(null);

  // Custom event icon/color settings
  const [customEventSettings, setCustomEventSettings] = useState<Record<string, { iconName: string; color: string }>>(() => {
    const saved = localStorage.getItem('realtimeEvents_customSettings');
    return saved ? JSON.parse(saved) : {};
  });
  const [iconDialogOpen, setIconDialogOpen] = useState(false);
  const [selectedActionForCustomization, setSelectedActionForCustomization] = useState<string | null>(null);

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
      const now = new Date();
      let startDate: Date;

      // For initial load or when filters change, get last 30 minutes
      // For incremental updates, get only new events since last fetch
      if (isInitialLoadRef.current || !latestEventTimestampRef.current) {
        startDate = new Date(now.getTime() - 30 * 60 * 1000); // Last 30 minutes
        console.log('[RealtimeEvents] Initial load - fetching last 30 minutes');
      } else {
        // Add 1ms to avoid getting the same event again
        startDate = new Date(latestEventTimestampRef.current.getTime() + 1);
        console.log('[RealtimeEvents] Incremental update - fetching since:', startDate.toISOString());
      }

      console.log('[RealtimeEvents] Loading events:', {
        start_date: startDate.toISOString(),
        end_date: now.toISOString(),
        eventTypeFilter,
        userFilter,
        isInitialLoad: isInitialLoadRef.current,
        clientTime: now.toString()
      });

      const filters: any = {
        start_date: startDate.toISOString(),
        end_date: now.toISOString(),
      };

      if (eventTypeFilter) {
        filters.action = eventTypeFilter;
        if (eventTypeOperator) filters.action_operator = eventTypeOperator;
      }

      if (resourceTypeFilter) {
        filters.resource_type = resourceTypeFilter;
        if (resourceTypeOperator) filters.resource_type_operator = resourceTypeOperator;
      }

      if (userFilter) {
        filters.user = userFilter;
      }

      const result = await AuditLogService.getAuditLogs(1, 100, filters);

      console.log('[RealtimeEvents] Loaded events:', {
        count: result?.logs?.length || 0,
        total: result?.total || 0,
        isIncremental: !isInitialLoadRef.current
      });

      if (result && Array.isArray(result.logs)) {
        let newEvents = result.logs;

        // Update latest timestamp
        if (newEvents.length > 0) {
          const latestEvent = newEvents.reduce((latest, event) => {
            const eventDate = new Date(event.createdAt);
            return !latest || eventDate > latest ? eventDate : latest;
          }, latestEventTimestampRef.current);

          latestEventTimestampRef.current = latestEvent;
        }

        // Store new event IDs and unseen events to update state after setEvents
        let newIdsToFlash = new Set<number>();
        let unseenEventIdsToProcess: number[] = [];
        let isAtTopPosition = false;
        let currentEventIds: Set<number> = new Set();

        // Use functional update to get the current state
        setEvents(prevEvents => {
          let allEvents: AuditLog[];

          if (isInitialLoadRef.current) {
            // Initial load: replace all events
            allEvents = newEvents;
          } else {
            // Incremental update: merge new events with existing ones
            // Remove duplicates and keep only events from last 30 minutes
            const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
            const existingEventsMap = new Map(prevEvents.map(e => [e.id, e]));

            console.log('[RealtimeEvents] Merging events:', {
              existingCount: prevEvents.length,
              newCount: newEvents.length,
              previousEventIdsCount: previousEventIdsRef.current.size
            });

            // Add new events to the map
            newEvents.forEach(event => {
              existingEventsMap.set(event.id, event);
            });

            // Convert back to array and filter by time window
            allEvents = Array.from(existingEventsMap.values())
              .filter(event => new Date(event.createdAt) >= thirtyMinutesAgo)
              .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

            console.log('[RealtimeEvents] After merge:', {
              totalCount: allEvents.length,
              removedOld: existingEventsMap.size - allEvents.length
            });
          }

          // Detect new events for flash effect (only after initial load)
          currentEventIds = new Set(allEvents.map(e => e.id));

          // Only detect new events if this is not the initial load
          if (!isInitialLoadRef.current) {
            currentEventIds.forEach(id => {
              if (!previousEventIdsRef.current.has(id)) {
                newIdsToFlash.add(id);
              }
            });

            if (newIdsToFlash.size > 0) {
              // Check scroll position - if already at top, mark as seen immediately
              const container = eventStreamRef.current;
              isAtTopPosition = container ? container.scrollTop <= 10 : false;

              // Check which new events haven't been seen yet
              unseenEventIdsToProcess = Array.from(newIdsToFlash).filter(id => !seenEventIds.has(id));

              console.log('🔔 New events detected:', {
                newEventCount: newIdsToFlash.size,
                unseenCount: unseenEventIdsToProcess.length,
                previousEventIds: Array.from(previousEventIdsRef.current),
                currentEventIds: Array.from(currentEventIds),
                seenEventIds: Array.from(seenEventIds),
                isAtTop: isAtTopPosition,
              });
            }
          } else {
            // Initial load - set previousEventIds to prevent flash on first load
            console.log('[RealtimeEvents] Initial load - setting previousEventIds');
          }

          // Mark initial load as complete
          if (isInitialLoadRef.current) {
            isInitialLoadRef.current = false;
            console.log('[RealtimeEvents] Initial load complete');
          }

          return allEvents;
        });

        // Update previousEventIdsRef AFTER setEvents completes (outside the functional update)
        // This prevents race conditions when loadEvents is called rapidly
        previousEventIdsRef.current = currentEventIds;

        // Update flash effect state (outside of setEvents to avoid nested state updates)
        if (newIdsToFlash.size > 0) {
          setNewEventIds(newIdsToFlash);
          // Remove flash effect after 2 seconds
          setTimeout(() => {
            setNewEventIds(new Set());
          }, 2000);

          // Update unseen events state
          if (unseenEventIdsToProcess.length > 0 && !isAtTopPosition) {
            console.log('✅ Setting hasUnseenEvents to true');
            setHasUnseenEvents(true);
            setUnseenEventCount(prev => prev + unseenEventIdsToProcess.length);
          } else if (isAtTopPosition && unseenEventIdsToProcess.length > 0) {
            console.log('❌ Already at top - marking new events as seen');
            // Mark new events as seen immediately
            setSeenEventIds(prev => {
              const newSet = new Set(prev);
              unseenEventIdsToProcess.forEach(id => newSet.add(id));
              return newSet;
            });
          } else if (unseenEventIdsToProcess.length === 0) {
            console.log('❌ All new events already seen');
          }
        }
      }
    } catch (error: any) {
      console.error('[RealtimeEvents] Failed to load events:', error);
      // Don't show error toast for background auto-refresh failures
      // Only log to console for debugging
    } finally {
      setLoading(false);
    }
  }, [eventTypeFilter, eventTypeOperator, resourceTypeFilter, resourceTypeOperator, userFilter]);

  // Update timeline groups and stats when events change
  useEffect(() => {
    const userTimezone = getStoredTimezone();

    // Group events by minute for timeline view
    const groups: Record<string, { events: AuditLog[], timeLabel: string }> = {};
    events.forEach((log) => {
      const localTime = dayjs.utc(log.createdAt).tz(userTimezone);
      const minuteKey = localTime.format('HH:mm');
      const timeLabel = localTime.format('h:mm A'); // e.g., "10:08 PM"
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
    events.forEach((log) => {
      eventCounts[log.action] = (eventCounts[log.action] || 0) + 1;
    });

    const stats = Object.entries(eventCounts)
      .map(([action, count]) => ({ action, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    setTopEvents(stats);

    // Calculate unique users
    const users = new Set(events.map(log => log.userId).filter(Boolean));
    setUniqueUsers(users.size);

    // Calculate event types
    const types = new Set(events.map(log => log.action));
    setEventTypes(types.size);
  }, [events]);

  // Reset to initial load when filters change
  useEffect(() => {
    isInitialLoadRef.current = true;
    latestEventTimestampRef.current = null;
    previousEventIdsRef.current = new Set();
  }, [eventTypeFilter, resourceTypeFilter, userFilter]);

  // Initial load
  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  // Save seenEventIds to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('realtimeEvents_seenEventIds', JSON.stringify(Array.from(seenEventIds)));
  }, [seenEventIds]);

  // Intersection Observer to track when first event is visible
  useEffect(() => {
    const firstEvent = firstEventRef.current;
    if (!firstEvent) {
      console.log('⚠️ First event ref not found');
      return;
    }

    console.log('✅ Setting up Intersection Observer for first event');

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            console.log('👁️ First event is visible - marking events as seen');
            // Mark all current events as seen
            const currentEventIds = new Set(events.map(e => e.id));
            setSeenEventIds(currentEventIds);
            setHasUnseenEvents(false);
            setUnseenEventCount(0);
          }
        });
      },
      {
        root: eventStreamRef.current,
        threshold: 0.1, // Trigger when 10% of the element is visible
      }
    );

    observer.observe(firstEvent);

    return () => {
      console.log('🧹 Cleaning up Intersection Observer');
      observer.disconnect();
    };
  }, [events]);

  // Scroll to top function
  const scrollToTop = () => {
    if (eventStreamRef.current) {
      eventStreamRef.current.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
      // Mark all events as seen
      const currentEventIds = new Set(events.map(e => e.id));
      setSeenEventIds(currentEventIds);
      setHasUnseenEvents(false);
      setUnseenEventCount(0);
    }
  };

  // Save autoRefresh setting to localStorage
  useEffect(() => {
    localStorage.setItem('realtimeEvents.autoRefresh', String(autoRefresh));
  }, [autoRefresh]);

  // Auto refresh every 5 seconds with progress
  useEffect(() => {
    if (autoRefresh) {
      // Reset progress
      setRefreshProgress(0);

      // Update progress every 50ms (5000ms / 100 = 50ms per 1%)
      progressIntervalRef.current = setInterval(() => {
        setRefreshProgress((prev) => {
          const next = prev + 1;
          // When reaching 100%, immediately reset to 0 to restart the cycle
          if (next >= 100) {
            return 0;
          }
          return next;
        });
      }, 50);

      // Refresh data every 5 seconds
      intervalRef.current = setInterval(() => {
        // Fill to 100% before refreshing for visual feedback
        setRefreshProgress(100);

        // Wait a brief moment to show the filled circle, then load and reset
        setTimeout(() => {
          loadEvents();
          setRefreshProgress(0);
        }, 100);
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

  // Get event color (with custom override)
  const getEventColor = (action: string): string => {
    if (customEventSettings[action]?.color) {
      return customEventSettings[action].color;
    }
    if (action.includes('create')) return '#4CAF50';
    if (action.includes('update')) return '#2196F3';
    if (action.includes('delete')) return '#F44336';
    if (action.includes('login')) return '#9C27B0';
    return '#757575';
  };

  // Get event icon (with custom override)
  const getEventIcon = (action: string): React.ReactNode => {
    if (customEventSettings[action]?.iconName) {
      const IconComponent = iconMap[customEventSettings[action].iconName];
      return IconComponent ? <IconComponent sx={{ fontSize: '1.1rem' }} /> : action.charAt(0).toUpperCase();
    }
    const firstLetter = action.charAt(0).toUpperCase();
    return firstLetter;
  };

  // Handle icon customization
  const handleIconClick = (action: string, event: React.MouseEvent) => {
    event.stopPropagation();
    setSelectedActionForCustomization(action);
    setIconDialogOpen(true);
  };

  // Save custom icon/color settings
  const saveCustomSettings = (iconName: string, color: string) => {
    if (!selectedActionForCustomization) return;

    const newSettings = {
      ...customEventSettings,
      [selectedActionForCustomization]: { iconName, color },
    };
    setCustomEventSettings(newSettings);
    localStorage.setItem('realtimeEvents_customSettings', JSON.stringify(newSettings));
    setIconDialogOpen(false);
    setSelectedActionForCustomization(null);
  };

  // Reset custom settings for an action
  const resetCustomSettings = () => {
    if (!selectedActionForCustomization) return;

    const newSettings = { ...customEventSettings };
    delete newSettings[selectedActionForCustomization];
    setCustomEventSettings(newSettings);
    localStorage.setItem('realtimeEvents_customSettings', JSON.stringify(newSettings));
    setIconDialogOpen(false);
    setSelectedActionForCustomization(null);
  };

  // Calculate time difference
  const getTimeDiff = (current: string | Date, previous?: string | Date): string => {
    if (!previous) return '';
    const diff = dayjs(current).diff(dayjs(previous), 'second');
    if (diff < 60) return `${diff}s`;
    return `${Math.floor(diff / 60)}m`;
  };

  // Get all unique event types for filter
  const allEventTypes = Array.from(new Set(events.map(e => e.action))).sort();
  const allResourceTypes = Array.from(new Set(events.map(e => e.entityType).filter(Boolean))).sort();

  // 동적 필터 정의
  const availableFilterDefinitions: FilterDefinition[] = [
    {
      key: 'action',
      label: t('realtimeEvents.filters.eventType'),
      type: 'multiselect',
      operator: 'any_of',
      allowOperatorToggle: false, // Single-value field, only 'any_of' makes sense
      options: allEventTypes.map(action => ({
        value: action,
        label: t(`auditLogs.actions.${action}`, action),
      })),
    },
    {
      key: 'resource_type',
      label: t('auditLogs.resourceType'),
      type: 'multiselect',
      operator: 'any_of',
      allowOperatorToggle: false, // Single-value field, only 'any_of' makes sense
      options: allResourceTypes.map(type => ({
        value: type,
        label: t(`auditLogs.resources.${type}`, type),
      })),
    },
    {
      key: 'user',
      label: t('realtimeEvents.filters.user'),
      type: 'text',
      placeholder: t('realtimeEvents.filters.userPlaceholder'),
    },
  ];

  // Manual refresh handler - reset to initial load
  const handleManualRefresh = () => {
    isInitialLoadRef.current = true;
    latestEventTimestampRef.current = null;
    previousEventIdsRef.current = new Set();
    loadEvents();
  };

  // 동적 필터 핸들러
  const handleFilterAdd = (filter: ActiveFilter) => {
    setActiveFilters([...activeFilters, filter]);
  };

  const handleFilterRemove = (filterKey: string) => {
    setActiveFilters(activeFilters.filter(f => f.key !== filterKey));
  };

  const handleDynamicFilterChange = (filterKey: string, value: any) => {
    setActiveFilters(activeFilters.map(f =>
      f.key === filterKey ? { ...f, value } : f
    ));
  };

  const handleOperatorChange = (filterKey: string, operator: 'any_of' | 'include_all') => {
    setActiveFilters(activeFilters.map(f =>
      f.key === filterKey ? { ...f, operator } : f
    ));
  };

  // Handle event click
  const handleEventClick = (event: AuditLog) => {
    setSelectedEvent(event);
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
                          // Disable transition to prevent reverse animation when resetting to 0
                          transition: 'none',
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



            <Tooltip title={t('common.refresh')}>
              <IconButton onClick={handleManualRefresh} size="small">
                <RefreshIcon />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        {/* Filters */}
        <Box sx={{ mt: 2 }}>
          {/* Dynamic Filter Bar */}
          <DynamicFilterBar
            availableFilters={availableFilterDefinitions}
            activeFilters={activeFilters}
            onFilterAdd={handleFilterAdd}
            onFilterRemove={handleFilterRemove}
            onFilterChange={handleDynamicFilterChange}
            onOperatorChange={handleOperatorChange}
          />
        </Box>
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
            position: 'relative',
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

          <Box
            ref={timelineContainerRef}
            sx={{
              flex: 1,
              overflowY: 'auto',
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
            position: 'relative',
          }}
        >
          {/* New Events Notification Badge */}
          {hasUnseenEvents && (
            <Box
              onClick={scrollToTop}
              sx={{
                position: 'absolute',
                top: 16,
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 10,
                bgcolor: 'primary.main',
                color: 'primary.contrastText',
                px: 2,
                py: 1,
                borderRadius: 3,
                boxShadow: 3,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                animation: 'slideDownBounce 0.5s ease-out, gentleBounce 2s ease-in-out 0.5s infinite',
                '@keyframes slideDownBounce': {
                  '0%': { opacity: 0, transform: 'translateX(-50%) translateY(-20px)' },
                  '60%': { opacity: 1, transform: 'translateX(-50%) translateY(2px)' },
                  '80%': { transform: 'translateX(-50%) translateY(-1px)' },
                  '100%': { opacity: 1, transform: 'translateX(-50%) translateY(0)' }
                },
                '@keyframes gentleBounce': {
                  '0%, 100%': { transform: 'translateX(-50%) translateY(0)' },
                  '15%': { transform: 'translateX(-50%) translateY(-4px)' },
                  '30%': { transform: 'translateX(-50%) translateY(0)' },
                  '45%, 100%': { transform: 'translateX(-50%) translateY(0)' }
                },
                '&:hover': {
                  bgcolor: 'primary.dark',
                  boxShadow: 4,
                  animation: 'none', // Stop animation on hover
                },
                transition: 'background-color 0.2s ease, box-shadow 0.2s ease',
              }}
            >
              <DotIcon sx={{ fontSize: 12, animation: 'blink 1s ease-in-out infinite' }} />
              <Typography variant="caption" sx={{ fontWeight: 600 }}>
                {unseenEventCount} {t('realtimeEvents.newEvents')}
              </Typography>
              <style>
                {`
                  @keyframes blink {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.3; }
                  }
                `}
              </style>
            </Box>
          )}

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
                        ref={index === 0 ? firstEventRef : null}
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
                            {dayjs.utc(event.createdAt).tz(getStoredTimezone()).format('h:mm:ss A')}
                          </Typography>
                        </Box>

                        {/* Icon */}
                        <Box sx={{ flex: '0 0 auto' }}>
                          <Avatar
                            onClick={(e) => handleIconClick(event.action, e)}
                            sx={{
                              width: 28,
                              height: 28,
                              fontSize: '0.75rem',
                              bgcolor: getEventColor(event.action),
                              color: '#fff',
                              fontWeight: 700,
                              cursor: 'pointer',
                              transition: 'all 0.2s',
                              '&:hover': {
                                transform: 'scale(1.1)',
                                boxShadow: 2,
                              },
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

        {/* Right: Stats & Top Events OR Event Detail */}
        <Paper
          elevation={1}
          sx={{
            flex: '0 0 360px',
            display: selectedEvent ? 'none' : 'flex',
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
          }}>
            {/* Stats Cards */}
            <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
              <Stack direction="row" spacing={1}>
                <Box sx={{ flex: 1 }}>
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
                      {t('realtimeEvents.stats.events')}
                    </Typography>
                  </Paper>
                </Box>
                <Box sx={{ flex: 1 }}>
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
                      {t('realtimeEvents.stats.users')}
                    </Typography>
                  </Paper>
                </Box>
                <Box sx={{ flex: 1 }}>
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
                      {t('realtimeEvents.stats.types')}
                    </Typography>
                  </Paper>
                </Box>
              </Stack>
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

        {/* Right: Event Detail Panel */}
        <Paper
          elevation={1}
          sx={{
            flex: '0 0 360px',
            display: selectedEvent ? 'flex' : 'none',
            flexDirection: 'column',
            overflow: 'hidden',
            bgcolor: 'background.paper',
            position: 'relative',
            animation: selectedEvent ? 'slideInRight 0.3s ease-out' : 'none',
            '@keyframes slideInRight': {
              from: {
                opacity: 0,
                transform: 'translateX(20px)',
              },
              to: {
                opacity: 1,
                transform: 'translateX(0)',
              },
            },
          }}
        >
          {/* Header */}
          <Box sx={{
            p: 2,
            borderBottom: 1,
            borderColor: 'divider',
            height: '72px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
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
              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', fontSize: '0.75rem' }}>
                {t('realtimeEvents.eventDetails')}
              </Typography>
            </Box>
            <IconButton
              size="small"
              onClick={() => setSelectedEvent(null)}
              sx={{
                '&:hover': {
                  bgcolor: 'action.hover',
                }
              }}
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>

          {/* Content */}
          <Box sx={{
            flex: 1,
            overflowY: 'auto',
            p: 2,
          }}>
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
                    ({dayjs.utc(selectedEvent.createdAt).tz(getStoredTimezone()).fromNow()})
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

                {/* Show diff if both old and new values exist */}
                {selectedEvent.oldValues && selectedEvent.newValues && (
                  <>
                    <Divider />
                    <Box>
                      <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                        {t('realtimeEvents.changes')}
                      </Typography>
                      <Paper sx={{
                        mt: 0.5,
                        bgcolor: 'background.default',
                        overflow: 'hidden',
                        '& pre': {
                          fontSize: '0.75rem !important',
                          fontFamily: 'monospace',
                        },
                        '& .diff-gutter': {
                          minWidth: '30px',
                        },
                        '& .diff-code': {
                          fontSize: '0.75rem',
                        },
                      }}>
                        <ReactDiffViewer
                          oldValue={JSON.stringify(selectedEvent.oldValues, null, 2)}
                          newValue={JSON.stringify(selectedEvent.newValues, null, 2)}
                          splitView={false}
                          compareMethod={DiffMethod.WORDS}
                          useDarkTheme={theme.palette.mode === 'dark'}
                          hideLineNumbers={false}
                          showDiffOnly={true}
                          styles={{
                            variables: {
                              dark: {
                                diffViewerBackground: theme.palette.background.default,
                                addedBackground: alpha(theme.palette.success.main, 0.2),
                                addedColor: theme.palette.success.contrastText,
                                removedBackground: alpha(theme.palette.error.main, 0.2),
                                removedColor: theme.palette.error.contrastText,
                                wordAddedBackground: alpha(theme.palette.success.main, 0.4),
                                wordRemovedBackground: alpha(theme.palette.error.main, 0.4),
                                gutterBackground: theme.palette.background.paper,
                                gutterColor: theme.palette.text.secondary,
                              },
                              light: {
                                diffViewerBackground: theme.palette.background.default,
                                addedBackground: alpha(theme.palette.success.main, 0.1),
                                addedColor: theme.palette.text.primary,
                                removedBackground: alpha(theme.palette.error.main, 0.1),
                                removedColor: theme.palette.text.primary,
                                wordAddedBackground: alpha(theme.palette.success.main, 0.3),
                                wordRemovedBackground: alpha(theme.palette.error.main, 0.3),
                                gutterBackground: theme.palette.background.paper,
                                gutterColor: theme.palette.text.secondary,
                              },
                            },
                          }}
                        />
                      </Paper>
                    </Box>
                  </>
                )}

                {/* Show only old values if new values don't exist */}
                {selectedEvent.oldValues && !selectedEvent.newValues && (
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

                {/* Show only new values if old values don't exist */}
                {!selectedEvent.oldValues && selectedEvent.newValues && (
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
          </Box>
        </Paper>
      </Box>

      {/* Icon Customization Dialog */}
      <IconCustomizationDialog
        open={iconDialogOpen}
        action={selectedActionForCustomization}
        currentIconName={selectedActionForCustomization ? (customEventSettings[selectedActionForCustomization]?.iconName || '') : ''}
        currentColor={selectedActionForCustomization ? getEventColor(selectedActionForCustomization) : '#757575'}
        onSave={saveCustomSettings}
        onReset={resetCustomSettings}
        onClose={() => {
          setIconDialogOpen(false);
          setSelectedActionForCustomization(null);
        }}
      />
    </Box>
  );
};

// Icon map for Material Icons
const iconMap: Record<string, React.ComponentType<any>> = {
  Add: AddIcon,
  Edit: EditIcon,
  Delete: DeleteIcon,
  Visibility: VisibilityIcon,
  VisibilityOff: VisibilityOffIcon,
  Lock: LockIcon,
  LockOpen: LockOpenIcon,
  Check: CheckIcon,
  Clear: ClearIcon,
  Login: LoginIcon,
  Logout: LogoutIcon,
  Settings: SettingsIcon,
  Build: BuildIcon,
  Security: SecurityIcon,
  Warning: WarningIcon,
  Error: ErrorIcon,
  Info: InfoIcon,
  Star: StarIcon,
  Flag: FlagIcon,
  Send: SendIcon,
  Mail: MailIcon,
  Notifications: NotificationsIcon,
  AccountCircle: AccountCircleIcon,
  Group: GroupIcon,
  Public: PublicIcon,
  Language: LanguageIcon,
  Update: UpdateIcon,
  Sync: SyncIcon,
  CloudUpload: CloudUploadIcon,
  CloudDownload: CloudDownloadIcon,
  Save: SaveIcon,
  Cancel: CancelIcon,
  Done: DoneIcon,
  Block: BlockIcon,
  CheckCircle: CheckCircleIcon,
  RadioButtonUnchecked: RadioButtonUncheckedIcon,
  Person: PersonIcon,
  Event: EventIcon,
  Refresh: RefreshIcon,
};

// Icon Customization Dialog Component
interface IconCustomizationDialogProps {
  open: boolean;
  action: string | null;
  currentIconName: string;
  currentColor: string;
  onSave: (iconName: string, color: string) => void;
  onReset: () => void;
  onClose: () => void;
}

const IconCustomizationDialog: React.FC<IconCustomizationDialogProps> = ({
  open,
  action,
  currentIconName,
  currentColor,
  onSave,
  onReset,
  onClose,
}) => {
  const { t } = useTranslation();
  const [selectedIconName, setSelectedIconName] = useState(currentIconName);
  const [color, setColor] = useState(currentColor);

  useEffect(() => {
    setSelectedIconName(currentIconName);
    setColor(currentColor);
  }, [currentIconName, currentColor]);

  const handleSave = () => {
    onSave(selectedIconName, color);
  };

  const predefinedColors = [
    '#4CAF50', // Green
    '#2196F3', // Blue
    '#F44336', // Red
    '#FF9800', // Orange
    '#9C27B0', // Purple
    '#00BCD4', // Cyan
    '#FFEB3B', // Yellow
    '#795548', // Brown
    '#607D8B', // Blue Grey
    '#757575', // Grey
  ];

  // All available icons (flattened)
  const availableIcons = ['Add', 'Edit', 'Delete', 'Save', 'Cancel', 'Done', 'Clear', 'Send', 'Refresh', 'Update', 'Sync',
    'Visibility', 'VisibilityOff', 'Lock', 'LockOpen', 'Block',
    'Check', 'CheckCircle', 'Error', 'Warning', 'Info', 'Star', 'Flag',
    'Login', 'Logout', 'Person', 'AccountCircle', 'Group',
    'Settings', 'Build', 'Security', 'Notifications', 'Event',
    'CloudUpload', 'CloudDownload', 'Public', 'Language', 'Mail'];

  const SelectedIconComponent = selectedIconName && iconMap[selectedIconName] ? iconMap[selectedIconName] : null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        {t('realtimeEvents.customizeEventIcon')}
        {action && (
          <Typography variant="caption" display="block" color="text.secondary">
            {action}
          </Typography>
        )}
      </DialogTitle>
      <DialogContent>
        <Stack spacing={3} sx={{ mt: 1 }}>
          {/* Icon Selection */}
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              {t('realtimeEvents.selectIcon')}
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', maxHeight: 300, overflowY: 'auto', p: 1 }}>
              {availableIcons.map((iconName) => {
                const IconComponent = iconMap[iconName];
                return (
                  <Tooltip key={iconName} title={iconName}>
                    <Avatar
                      onClick={() => setSelectedIconName(iconName)}
                      sx={{
                        width: 40,
                        height: 40,
                        bgcolor: selectedIconName === iconName ? color : 'grey.300',
                        color: selectedIconName === iconName ? '#fff' : 'grey.700',
                        cursor: 'pointer',
                        border: selectedIconName === iconName ? '3px solid' : '1px solid',
                        borderColor: selectedIconName === iconName ? color : 'grey.400',
                        transition: 'all 0.2s',
                        '&:hover': {
                          transform: 'scale(1.1)',
                          boxShadow: 2,
                        },
                      }}
                    >
                      <IconComponent sx={{ fontSize: 20 }} />
                    </Avatar>
                  </Tooltip>
                );
              })}
            </Box>
          </Box>

          {/* Color Selection */}
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              {t('realtimeEvents.color')}
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              {predefinedColors.map((presetColor) => (
                <Box
                  key={presetColor}
                  onClick={() => setColor(presetColor)}
                  sx={{
                    width: 32,
                    height: 32,
                    bgcolor: presetColor,
                    borderRadius: 1,
                    cursor: 'pointer',
                    border: color === presetColor ? '3px solid #000' : '1px solid #ccc',
                    transition: 'all 0.2s',
                    '&:hover': {
                      transform: 'scale(1.1)',
                      boxShadow: 2,
                    },
                  }}
                />
              ))}
            </Box>
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onReset} color="warning">
          {t('common.reset')}
        </Button>
        <Button onClick={onClose}>
          {t('common.cancel')}
        </Button>
        <Button onClick={handleSave} variant="contained" disabled={!selectedIconName}>
          {t('common.save')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default RealtimeEventsPage;


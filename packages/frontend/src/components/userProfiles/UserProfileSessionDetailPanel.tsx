import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Box,
  Typography,
  Chip,
  useTheme,
  Divider,
  CircularProgress,
  alpha,
  Tooltip,
} from '@mui/material';
import {
  Timer as TimerIcon,
  Event as EventIcon,
  Devices as DevicesIcon,
  Public as PublicIcon,
  ErrorOutline as ErrorIcon,
  ShoppingCart as PurchaseIcon,
  Login as LoginIcon,
  TouchApp as ClickIcon,
  Visibility as ViewIcon,
  ChatBubbleOutline as ChatIcon,
  Settings as SettingsIcon,
  PlayArrow as StartIcon,
} from '@mui/icons-material';
import { Virtuoso } from 'react-virtuoso';
import { useTranslation } from 'react-i18next';
import type { ArgusUserSession, ArgusUserEvent } from '@/services/argus/argusTypes';
import { getUserEvents } from '@/services/argus/argusAnalytics';
import { formatDuration } from '@/utils/dateFormat';

interface UserProfileSessionDetailPanelProps {
  session: ArgusUserSession;
  projectId: string | number;
  userId: string;
}

const InfoRow: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 0.6 }}>
    <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ fontSize: 11 }}>
      {label}
    </Typography>
    <Typography variant="caption" sx={{ fontSize: 12, fontWeight: 500, textAlign: 'right' }}>
      {value}
    </Typography>
  </Box>
);

/* ─── Event classification for coloring & icons ─── */
type EventCategory = 'error' | 'purchase' | 'navigation' | 'click' | 'session' | 'chat' | 'system' | 'default';

function classifyEvent(name: string): EventCategory {
  const n = name.toLowerCase();
  if (n.includes('error') || n.includes('crash') || n.includes('exception')) return 'error';
  if (n.includes('purchase') || n.includes('buy') || n.includes('payment') || n.includes('item_purchased') || n.includes('grant')) return 'purchase';
  if (n.includes('page_view') || n.includes('$page_view') || n.includes('view') || n.includes('enter_zone') || n.includes('navigate')) return 'navigation';
  if (n.includes('click') || n.includes('$click') || n.includes('tap') || n.includes('press')) return 'click';
  if (n.includes('session') || n.includes('login') || n.includes('logout') || n.includes('sign')) return 'session';
  if (n.includes('chat') || n.includes('message')) return 'chat';
  if (n.includes('setting') || n.includes('config') || n.includes('upgrade') || n.includes('update')) return 'system';
  return 'default';
}

function getCategoryColor(cat: EventCategory, theme: any): string {
  switch (cat) {
    case 'error': return theme.palette.error.main;
    case 'purchase': return '#4caf50';
    case 'navigation': return theme.palette.info.main;
    case 'click': return theme.palette.warning.main;
    case 'session': return '#ab47bc';
    case 'chat': return '#26a69a';
    case 'system': return '#78909c';
    default: return theme.palette.text.disabled;
  }
}

function getCategoryIcon(cat: EventCategory): React.ReactNode {
  const sx = { fontSize: 11 };
  switch (cat) {
    case 'error': return <ErrorIcon sx={sx} />;
    case 'purchase': return <PurchaseIcon sx={sx} />;
    case 'navigation': return <ViewIcon sx={sx} />;
    case 'click': return <ClickIcon sx={sx} />;
    case 'session': return <LoginIcon sx={sx} />;
    case 'chat': return <ChatIcon sx={sx} />;
    case 'system': return <SettingsIcon sx={sx} />;
    default: return <EventIcon sx={sx} />;
  }
}

/* ─── Timeline item ─── */
const ITEM_HEIGHT = 44;

const TimelineItem: React.FC<{
  evt: ArgusUserEvent;
  offsetStr: string;
  timeStr: string;
  isFirst: boolean;
  isLast: boolean;
  isDark: boolean;
  category: EventCategory;
  catColor: string;
  railColor: string;
}> = React.memo(({ evt, offsetStr, timeStr, isFirst, isLast, isDark, category, catColor, railColor }) => (
  <Box
    sx={{
      display: 'flex',
      alignItems: 'stretch',
      height: ITEM_HEIGHT,
      px: 1.5,
      cursor: 'default',
      transition: 'background-color 0.15s',
      '&:hover': {
        bgcolor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
      },
    }}
  >
    {/* ── Rail column ── */}
    <Box
      sx={{
        width: 28,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        flexShrink: 0,
        position: 'relative',
      }}
    >
      {/* top rail segment */}
      {!isFirst && (
        <Box sx={{ width: 2, flex: 1, bgcolor: railColor, borderRadius: 1 }} />
      )}
      {isFirst && <Box sx={{ flex: 1 }} />}

      {/* dot */}
      <Box
        sx={{
          width: isFirst || isLast ? 12 : 8,
          height: isFirst || isLast ? 12 : 8,
          borderRadius: '50%',
          bgcolor: catColor,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: `0 0 0 3px ${alpha(catColor, 0.15)}`,
          zIndex: 1,
        }}
      >
        {(isFirst || isLast) && (
          <Box
            sx={{
              width: 4,
              height: 4,
              borderRadius: '50%',
              bgcolor: isDark ? '#1e1e1e' : '#fff',
            }}
          />
        )}
      </Box>

      {/* bottom rail segment */}
      {!isLast && (
        <Box sx={{ width: 2, flex: 1, bgcolor: railColor, borderRadius: 1 }} />
      )}
      {isLast && <Box sx={{ flex: 1 }} />}
    </Box>

    {/* ── Content column ── */}
    <Box
      sx={{
        flex: 1,
        minWidth: 0,
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        ml: 0.5,
        borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}`,
      }}
    >
      {/* icon badge */}
      <Tooltip title={category} placement="left">
        <Box
          sx={{
            width: 22,
            height: 22,
            borderRadius: '6px',
            bgcolor: alpha(catColor, isDark ? 0.15 : 0.1),
            color: catColor,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          {getCategoryIcon(category)}
        </Box>
      </Tooltip>

      {/* event name + time */}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography
          sx={{
            fontSize: 11,
            fontWeight: 600,
            lineHeight: 1.2,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {evt.event_name}
        </Typography>
        <Typography
          sx={{
            fontSize: 9,
            color: 'text.disabled',
            lineHeight: 1.2,
            mt: '1px',
          }}
        >
          {timeStr}
        </Typography>
      </Box>

      {/* offset badge */}
      <Typography
        sx={{
          fontSize: 10,
          fontWeight: 600,
          fontFamily: 'monospace',
          color: catColor,
          flexShrink: 0,
          bgcolor: alpha(catColor, isDark ? 0.12 : 0.08),
          px: 0.8,
          py: 0.2,
          borderRadius: '4px',
          lineHeight: 1.3,
        }}
      >
        {offsetStr}
      </Typography>
    </Box>
  </Box>
));
TimelineItem.displayName = 'TimelineItem';

export const UserProfileSessionDetailPanel: React.FC<UserProfileSessionDetailPanelProps> = ({
  session,
  projectId,
  userId,
}) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const railColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';

  const [events, setEvents] = useState<ArgusUserEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);

  useEffect(() => {
    if (!session.session_id || !projectId || !userId) return;
    let cancelled = false;
    setEventsLoading(true);
    getUserEvents(projectId, userId, {
      limit: 500,
      offset: 0,
      search: `session_id=${session.session_id}`,
    })
      .then((result) => {
        if (!cancelled) setEvents(result.data);
      })
      .catch(() => {
        if (!cancelled) setEvents([]);
      })
      .finally(() => {
        if (!cancelled) setEventsLoading(false);
      });
    return () => { cancelled = true; };
  }, [session.session_id, projectId, userId]);

  const sessionStart = new Date(session.start_time).getTime();

  // Pre-compute derived data
  const derived = useMemo(() => events.map((evt) => {
    const ts = new Date(evt.timestamp);
    const offsetMs = ts.getTime() - sessionStart;
    const offsetSec = Math.max(0, Math.floor(offsetMs / 1000));
    let offsetStr: string;
    if (offsetSec < 60) offsetStr = `+${offsetSec}s`;
    else {
      const m = Math.floor(offsetSec / 60);
      const s = offsetSec % 60;
      offsetStr = m < 60 ? `+${m}m${s.toString().padStart(2, '0')}s` : `+${Math.floor(m / 60)}h${(m % 60).toString().padStart(2, '0')}m`;
    }
    const cat = classifyEvent(evt.event_name);
    return {
      offsetStr,
      timeStr: ts.toLocaleTimeString(),
      category: cat,
      catColor: getCategoryColor(cat, theme),
    };
  }), [events, sessionStart, theme]);

  const renderItem = useCallback((idx: number) => (
    <TimelineItem
      evt={events[idx]}
      offsetStr={derived[idx].offsetStr}
      timeStr={derived[idx].timeStr}
      isFirst={idx === 0}
      isLast={idx === events.length - 1}
      isDark={isDark}
      category={derived[idx].category}
      catColor={derived[idx].catColor}
      railColor={railColor}
    />
  ), [events, derived, isDark, railColor]);

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        bgcolor: 'background.paper',
      }}
    >
      {/* Header */}
      <Box sx={{ p: 2, borderBottom: `1px solid ${theme.palette.divider}`, flexShrink: 0 }}>
        <Typography variant="subtitle2" fontWeight={700} sx={{ fontSize: '0.85rem' }}>
          {t('argus.userProfiles.sessionDetail', 'Session Detail')}
        </Typography>
        <Typography
          variant="caption" fontFamily="monospace" color="text.secondary"
          sx={{ fontSize: 10, mt: 0.5, display: 'block', wordBreak: 'break-all' }}
        >
          {session.session_id}
        </Typography>
        <Box sx={{ display: 'flex', gap: 0.5, mt: 1, flexWrap: 'wrap' }}>
          {session.platform && <Chip label={session.platform} size="small" sx={{ height: 20, fontSize: 10 }} />}
          {session.country && <Chip label={session.country} size="small" variant="outlined" sx={{ height: 20, fontSize: 10 }} />}
          {session.os && <Chip label={session.os} size="small" variant="outlined" sx={{ height: 20, fontSize: 10 }} />}
          {session.browser && <Chip label={session.browser} size="small" variant="outlined" sx={{ height: 20, fontSize: 10 }} />}
        </Box>
      </Box>

      {/* Info section */}
      <Box sx={{ px: 2, py: 1.5, flexShrink: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1, color: 'text.secondary' }}>
          <TimerIcon sx={{ fontSize: 14 }} />
          <Typography variant="caption" fontWeight={700} sx={{ textTransform: 'uppercase', letterSpacing: 0.5, fontSize: 10 }}>
            {t('argus.userProfiles.timing', 'Timing')}
          </Typography>
        </Box>
        <InfoRow label={t('argus.userProfiles.startTime', 'Start')} value={new Date(session.start_time).toLocaleString()} />
        <InfoRow label={t('argus.userProfiles.endTime', 'End')} value={new Date(session.end_time).toLocaleString()} />
        <InfoRow
          label={t('argus.userProfiles.duration', 'Duration')}
          value={<Typography variant="caption" fontWeight={700} color="primary" sx={{ fontSize: 12 }}>{formatDuration(session.duration_seconds * 1000)}</Typography>}
        />
      </Box>

      <Divider />

      <Box sx={{ px: 2, py: 1.5, flexShrink: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1, color: 'text.secondary' }}>
          <EventIcon sx={{ fontSize: 14 }} />
          <Typography variant="caption" fontWeight={700} sx={{ textTransform: 'uppercase', letterSpacing: 0.5, fontSize: 10 }}>
            {t('argus.userProfiles.activity', 'Activity')}
          </Typography>
        </Box>
        <InfoRow label={t('argus.userProfiles.totalEvents', 'Total Events')} value={session.event_count} />
        <InfoRow label={t('argus.userProfiles.uniqueEvents', 'Unique Events')} value={session.unique_events} />
      </Box>

      <Divider />

      <Box sx={{ px: 2, py: 1.5, flexShrink: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1, color: 'text.secondary' }}>
          <DevicesIcon sx={{ fontSize: 14 }} />
          <Typography variant="caption" fontWeight={700} sx={{ textTransform: 'uppercase', letterSpacing: 0.5, fontSize: 10 }}>
            {t('argus.userProfiles.device', 'Device')}
          </Typography>
        </Box>
        {session.platform && <InfoRow label={t('argus.userProfiles.platform', 'Platform')} value={session.platform} />}
        {session.os && <InfoRow label={t('argus.userProfiles.os', 'OS')} value={session.os} />}
        {session.browser && <InfoRow label={t('argus.userProfiles.browser', 'Browser')} value={session.browser} />}
        {session.country && (
          <InfoRow
            label={t('argus.userProfiles.country', 'Country')}
            value={<Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}><PublicIcon sx={{ fontSize: 12 }} />{session.country}</Box>}
          />
        )}
      </Box>

      {/* ═══════ Event Timeline ═══════ */}
      <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', borderTop: `1px solid ${theme.palette.divider}` }}>
        {/* Timeline header */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
            px: 2,
            py: 1,
            flexShrink: 0,
            bgcolor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.015)',
          }}
        >
          <StartIcon sx={{ fontSize: 14, color: 'text.secondary', transform: 'rotate(90deg)' }} />
          <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.5, fontSize: 10 }}>
            {t('argus.userProfiles.eventTimeline', 'Event Timeline')}
          </Typography>
          {!eventsLoading && events.length > 0 && (
            <Chip
              label={events.length}
              size="small"
              color="primary"
              variant="outlined"
              sx={{ ml: 'auto', height: 18, fontSize: 10, fontWeight: 700, '& .MuiChip-label': { px: 0.8 } }}
            />
          )}
        </Box>

        {/* Timeline body — hybrid: direct render for ≤200, virtualized for >200 */}
        <Box sx={{ flex: 1, minHeight: 0 }}>
          {eventsLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
              <CircularProgress size={20} />
            </Box>
          ) : events.length === 0 ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: 11 }}>
                {t('argus.userProfiles.noEventsInSession', 'No events in this session')}
              </Typography>
            </Box>
          ) : events.length <= 200 ? (
            <Box sx={{ overflow: 'auto', height: '100%' }}>
              {events.map((_, idx) => renderItem(idx))}
            </Box>
          ) : (
            <Virtuoso
              totalCount={events.length}
              fixedItemHeight={ITEM_HEIGHT}
              overscan={400}
              itemContent={renderItem}
              style={{ height: '100%' }}
            />
          )}
        </Box>
      </Box>
    </Box>
  );
};

export default UserProfileSessionDetailPanel;

/**
 * EventNavigator — Sentry-style event navigation bar.
 *
 * Shows current event position (e.g., "Event 3 of 47"),
 * Older/Newer buttons, and an event timeline distribution mini-chart.
 * Allows switching between individual error events within an issue.
 */
import React, { useEffect, useState, useCallback } from 'react';
import {
  Box,
  Typography,
  IconButton,
  Tooltip,
  Chip,
  alpha,
  useTheme,
  Skeleton,
} from '@mui/material';
import {
  ChevronLeft as PrevIcon,
  ChevronRight as NextIcon,
  FirstPage as OldestIcon,
  LastPage as LatestIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import argusService, { ArgusErrorEvent } from '@/services/argusService';

interface EventNavigatorProps {
  projectId: string | number;
  issueId: string | number;
  currentEvent: ArgusErrorEvent | null;
  onEventChange: (event: ArgusErrorEvent) => void;
  isDark: boolean;
}

const EventNavigator: React.FC<EventNavigatorProps> = ({
  projectId,
  issueId,
  currentEvent,
  onEventChange,
  isDark,
}) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const [events, setEvents] = useState<ArgusErrorEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  // Fetch all events for this issue (paginated, up to 100)
  useEffect(() => {
    if (!projectId || !issueId) return;
    let cancelled = false;
    const fetchEvents = async () => {
      setLoading(true);
      try {
        const result = await argusService.listIssueEvents(projectId, issueId, {
          limit: 100,
          offset: 0,
        });
        if (!cancelled) {
          setEvents(result.data || []);
        }
      } catch (e) {
        console.error('Failed to fetch events:', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchEvents();
    return () => { cancelled = true; };
  }, [projectId, issueId]);

  // Sync currentIndex when events or currentEvent change
  useEffect(() => {
    if (!currentEvent || events.length === 0) return;
    const idx = events.findIndex(e => e.event_id === currentEvent.event_id);
    if (idx >= 0) setCurrentIndex(idx);
  }, [currentEvent, events]);

  const goToEvent = useCallback((idx: number) => {
    if (idx >= 0 && idx < events.length) {
      setCurrentIndex(idx);
      onEventChange(events[idx]);
    }
  }, [events, onEventChange]);

  const total = events.length;
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < total - 1;

  // Build mini timeline: bucket events by hour for last 24h
  const buildTimeline = () => {
    if (events.length === 0) return [];
    const now = Date.now();
    const buckets = new Array(24).fill(0);
    for (const evt of events) {
      const evtTime = new Date(evt.timestamp).getTime();
      const hoursAgo = Math.floor((now - evtTime) / (1000 * 60 * 60));
      if (hoursAgo >= 0 && hoursAgo < 24) {
        buckets[23 - hoursAgo]++;
      }
    }
    const max = Math.max(...buckets, 1);
    return buckets.map(count => ({ count, pct: (count / max) * 100 }));
  };

  const timeline = buildTimeline();

  if (loading) {
    return (
      <Box sx={{
        display: 'flex', alignItems: 'center', gap: 1, px: 2, py: 1,
        border: `1px solid ${theme.palette.divider}`,
        borderRadius: 1.5,
        backgroundColor: theme.palette.background.paper,
      }}>
        <Skeleton variant="text" width={140} height={24} />
        <Skeleton variant="rectangular" width={200} height={20} sx={{ borderRadius: 1, ml: 'auto' }} />
      </Box>
    );
  }

  if (total === 0) return null;

  return (
    <Box sx={{
      display: 'flex', alignItems: 'center', gap: 1,
      px: 2, py: 0.8,
      border: `1px solid ${theme.palette.divider}`,
      borderRadius: 1.5,
      backgroundColor: theme.palette.background.paper,
      flexWrap: 'wrap',
    }}>
      {/* Navigation buttons */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.3 }}>
        <Tooltip title={t('argus.events.oldest', 'Oldest')}>
          <span>
            <IconButton size="small" onClick={() => goToEvent(total - 1)} disabled={!hasNext}>
              <OldestIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title={t('argus.events.older', 'Older')}>
          <span>
            <IconButton size="small" onClick={() => goToEvent(currentIndex + 1)} disabled={!hasNext}>
              <PrevIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </span>
        </Tooltip>
      </Box>

      {/* Event position indicator */}
      <Typography variant="caption" sx={{
        fontSize: '0.78rem', fontWeight: 600,
        color: theme.palette.text.primary,
        mx: 0.5,
      }}>
        {t('argus.events.eventOf', {
          defaultValue: 'Event {{current}} of {{total}}',
          current: currentIndex + 1,
          total,
        })}
      </Typography>

      {/* Navigation forward */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.3 }}>
        <Tooltip title={t('argus.events.newer', 'Newer')}>
          <span>
            <IconButton size="small" onClick={() => goToEvent(currentIndex - 1)} disabled={!hasPrev}>
              <NextIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title={t('argus.events.latest', 'Latest')}>
          <span>
            <IconButton size="small" onClick={() => goToEvent(0)} disabled={!hasPrev}>
              <LatestIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </span>
        </Tooltip>
      </Box>

      {/* Event timestamp */}
      {currentEvent && (
        <Chip
          label={new Date(currentEvent.timestamp).toLocaleString()}
          size="small"
          sx={{
            height: 20, fontSize: '0.68rem',
            fontFamily: 'monospace',
            backgroundColor: alpha(theme.palette.text.primary, 0.05),
            color: theme.palette.text.secondary,
          }}
        />
      )}

      {/* Mini timeline chart */}
      {timeline.length > 0 && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, ml: 'auto' }}>
          <Typography variant="caption" sx={{ fontSize: '0.68rem', color: 'text.secondary' }}>
            {t('argus.events.last24h', 'Event distribution (last 24h)')}
          </Typography>
          <Box sx={{
            display: 'flex', alignItems: 'flex-end', gap: '1px',
            height: 26,
            p: '3px 5px',
            borderRadius: 1.5,
            backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)',
          }}>
            {timeline.map((bucket, i) => (
              <Box
                key={i}
                sx={{
                  width: 4, borderRadius: '1px 1px 0 0',
                  height: `${Math.max(bucket.pct, bucket.count > 0 ? 15 : 0)}%`,
                  minHeight: bucket.count > 0 ? 2 : 0,
                  backgroundColor: bucket.count > 0
                    ? alpha(theme.palette.primary.main, 0.5 + bucket.pct / 200)
                    : alpha(theme.palette.text.disabled, 0.15),
                  transition: 'height 0.2s',
                }}
              />
            ))}
          </Box>
        </Box>
      )}
    </Box>
  );
};

export default EventNavigator;

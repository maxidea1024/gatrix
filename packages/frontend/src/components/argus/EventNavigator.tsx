/**
 * EventNavigator — Sentry-style event navigation bar.
 *
 * Shows current event position (e.g., "Event 3 of 47"),
 * Older/Newer buttons, and an event timeline distribution mini-chart.
 * Allows switching between individual error events within an issue.
 *
 * Enhanced (Phase 2D):
 *  - Event search bar (search within events by exception, user, etc.)
 *  - Keyboard shortcuts: J (older), K (newer), [ (oldest), ] (latest)
 *  - Recommended event indicator
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
  Star as RecommendedIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import argusService, { ArgusErrorEvent } from '@/services/argusService';
import { QueryAQLEditor, ISSUES_CONFIG } from './query-aql';

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
  const [searchQuery, setSearchQuery] = useState('');

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
    return () => {
      cancelled = true;
    };
  }, [projectId, issueId]);

  // Sync currentIndex when events or currentEvent change
  useEffect(() => {
    if (!currentEvent || events.length === 0) return;
    const idx = events.findIndex((e) => e.event_id === currentEvent.event_id);
    if (idx >= 0) setCurrentIndex(idx);
  }, [currentEvent, events]);

  const goToEvent = useCallback(
    (idx: number) => {
      if (idx >= 0 && idx < events.length) {
        setCurrentIndex(idx);
        onEventChange(events[idx]);
      }
    },
    [events, onEventChange]
  );

  // Keyboard shortcuts: J=older, K=newer, [=oldest, ]=latest
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't capture when typing in inputs
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;

      if (e.key === 'j' || e.key === 'J') {
        e.preventDefault();
        goToEvent(currentIndex + 1);
      } else if (e.key === 'k' || e.key === 'K') {
        e.preventDefault();
        goToEvent(currentIndex - 1);
      } else if (e.key === '[') {
        e.preventDefault();
        goToEvent(events.length - 1);
      } else if (e.key === ']') {
        e.preventDefault();
        goToEvent(0);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, events.length, goToEvent]);

  const total = events.length;
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < total - 1;

  // Is current event the "recommended" one (latest = index 0)?
  const isRecommended = currentIndex === 0;

  if (loading) {
    return (
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          px: 2,
          py: 1,
          border: `1px solid ${theme.palette.divider}`,
          borderRadius: 1.5,
          backgroundColor: theme.palette.background.paper,
        }}
      >
        <Skeleton variant="text" width={140} height={24} />
        <Skeleton
          variant="rectangular"
          width={200}
          height={20}
          sx={{ borderRadius: 1, ml: 'auto' }}
        />
      </Box>
    );
  }

  if (total === 0) return null;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          px: 2,
          py: 0.8,
          border: `1px solid ${theme.palette.divider}`,
          borderRadius: 1.5,
          backgroundColor: theme.palette.background.paper,
          flexWrap: 'wrap',
        }}
      >
        {/* Navigation buttons */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.3 }}>
          <Tooltip title={`${t('argus.events.oldest', 'Oldest')} [ ]`}>
            <span>
              <IconButton
                size="small"
                onClick={() => goToEvent(total - 1)}
                disabled={!hasNext}
              >
                <OldestIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title={`${t('argus.events.older', 'Older')} [J]`}>
            <span>
              <IconButton
                size="small"
                onClick={() => goToEvent(currentIndex + 1)}
                disabled={!hasNext}
              >
                <PrevIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </span>
          </Tooltip>
        </Box>

        {/* Event position indicator */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          {isRecommended && (
            <Tooltip title={t('argus.events.recommended', 'Recommended')}>
              <RecommendedIcon sx={{ fontSize: 14, color: 'warning.main' }} />
            </Tooltip>
          )}
          <Typography
            variant="caption"
            sx={{
              fontSize: '0.78rem',
              fontWeight: 600,
              color: theme.palette.text.primary,
            }}
          >
            {t('argus.events.eventOf', {
              defaultValue: 'Event {{current}} of {{total}}',
              current: currentIndex + 1,
              total,
            })}
          </Typography>
        </Box>

        {/* Navigation forward */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.3 }}>
          <Tooltip title={`${t('argus.events.newer', 'Newer')} [K]`}>
            <span>
              <IconButton
                size="small"
                onClick={() => goToEvent(currentIndex - 1)}
                disabled={!hasPrev}
              >
                <NextIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title={`${t('argus.events.latest', 'Latest')} [ ] ]`}>
            <span>
              <IconButton
                size="small"
                onClick={() => goToEvent(0)}
                disabled={!hasPrev}
              >
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
              height: 20,
              fontSize: '0.68rem',
              backgroundColor: alpha(theme.palette.text.primary, 0.05),
              color: theme.palette.text.secondary,
            }}
          />
        )}

        {/* Event Search Bar — AQL Editor */}
        <Box sx={{ ml: 'auto', flex: 1, minWidth: 0 }}>
          <QueryAQLEditor
            config={ISSUES_CONFIG}
            initialQuery={searchQuery}
            onSearch={(query) => {
              setSearchQuery(query);
              if (!query.trim()) return;
              // Simple client-side search within loaded events
              const q = query.toLowerCase();
              const matchIdx = events.findIndex((evt, idx) => {
                if (idx <= currentIndex) return false;
                return (
                  evt.exception_type?.toLowerCase().includes(q) ||
                  evt.exception_value?.toLowerCase().includes(q) ||
                  evt.user_email?.toLowerCase().includes(q) ||
                  evt.user_id?.toLowerCase().includes(q) ||
                  evt.transaction?.toLowerCase().includes(q) ||
                  evt.event_id?.toLowerCase().includes(q)
                );
              });
              if (matchIdx >= 0) {
                goToEvent(matchIdx);
              } else {
                // Wrap around
                const wrapIdx = events.findIndex((evt) => (
                  evt.exception_type?.toLowerCase().includes(q) ||
                  evt.exception_value?.toLowerCase().includes(q) ||
                  evt.user_email?.toLowerCase().includes(q) ||
                  evt.user_id?.toLowerCase().includes(q) ||
                  evt.transaction?.toLowerCase().includes(q) ||
                  evt.event_id?.toLowerCase().includes(q)
                ));
                if (wrapIdx >= 0) goToEvent(wrapIdx);
              }
            }}
            placeholder={t(
              'argus.events.searchPlaceholder',
              'Search events...'
            )}
          />
        </Box>
      </Box>
    </Box>
  );
};

export default React.memo(EventNavigator);

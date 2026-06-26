import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Typography,
  CircularProgress,
  TextField,
  InputAdornment,
  IconButton,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  TableContainer,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Paper,
  Button,
  useTheme,
} from '@mui/material';
import {
  Search as SearchIcon,
  Close as CloseIcon,
  ExpandMore as ExpandMoreIcon,
  ShoppingCart as PurchaseIcon,
  EmojiEvents as TrophyIcon,
  Error as ErrorIcon,
  Login as LoginIcon,
  Event as EventIcon,
  ContentCopy as CopyIcon,
  Check as CheckIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { getUserEvents } from '@/services/argus/argusAnalytics';
import type { ArgusUserEvent } from '@/services/argus/argusTypes';

const CopyableCell: React.FC<{ value: string; fontSize?: number }> = ({
  value,
  fontSize = 11,
}) => {
  const [copied, setCopied] = React.useState(false);
  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(value).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 800);
  };
  if (!value) return <Box sx={{ fontSize, color: 'text.disabled' }}>—</Box>;
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 0.5,
        '&:hover .copy-btn': { opacity: 1 },
      }}
    >
      <Box sx={{ fontSize, wordBreak: 'break-all', flex: 1 }}>{value}</Box>
      <IconButton
        className="copy-btn"
        size="small"
        onClick={handleCopy}
        sx={{ opacity: 0, transition: 'opacity 0.15s', p: 0.25, flexShrink: 0 }}
      >
        {copied ? (
          <CheckIcon sx={{ fontSize: 13, color: 'success.main' }} />
        ) : (
          <CopyIcon sx={{ fontSize: 13 }} />
        )}
      </IconButton>
    </Box>
  );
};

interface UserProfileEventFeedProps {
  projectId: string;
  userId: string;
}

export const UserProfileEventFeed: React.FC<UserProfileEventFeedProps> = ({
  projectId,
  userId,
}) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const [events, setEvents] = useState<ArgusUserEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [eventSearch, setEventSearch] = useState('');
  const [eventSearchDebounced, setEventSearchDebounced] = useState('');
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());

  // Debounce event search
  useEffect(() => {
    const timer = setTimeout(() => setEventSearchDebounced(eventSearch), 250);
    return () => clearTimeout(timer);
  }, [eventSearch]);

  // Load events
  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    getUserEvents(projectId, userId, { limit: 200 })
      .then((r) => {
        setEvents(r.data);
      })
      .catch((err) => {
        console.error('Failed to load events:', err);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [projectId, userId]);

  const getEventIcon = (name: string) => {
    const n = name.toLowerCase();
    if (n.includes('purchase') || n.includes('buy') || n.includes('pay')) {
      return (
        <PurchaseIcon sx={{ color: theme.palette.secondary.main, fontSize: 18 }} />
      );
    }
    if (n.includes('quest') || n.includes('level') || n.includes('achievement')) {
      return <TrophyIcon sx={{ color: '#ffb300', fontSize: 18 }} />;
    }
    if (n.includes('error') || n.includes('crash') || n.includes('fail')) {
      return <ErrorIcon sx={{ color: theme.palette.error.main, fontSize: 18 }} />;
    }
    if (
      n.includes('login') ||
      n.includes('start') ||
      n.includes('session') ||
      n.includes('join')
    ) {
      return <LoginIcon sx={{ color: theme.palette.primary.main, fontSize: 18 }} />;
    }
    return <EventIcon sx={{ color: 'text.secondary', fontSize: 18 }} />;
  };

  const filteredEvents = useMemo(() => {
    if (!eventSearchDebounced.trim()) return events;
    const query = eventSearchDebounced.toLowerCase().trim();
    return events.filter(
      (e) =>
        e.event_name.toLowerCase().includes(query) ||
        JSON.stringify(e.properties).toLowerCase().includes(query)
    );
  }, [events, eventSearchDebounced]);

  const groupedEvents = useMemo(() => {
    const groups: Record<string, ArgusUserEvent[]> = {};
    filteredEvents.forEach((evt) => {
      const dateStr = new Date(evt.timestamp).toLocaleDateString();
      if (!groups[dateStr]) groups[dateStr] = [];
      groups[dateStr].push(evt);
    });
    return Object.entries(groups);
  }, [filteredEvents]);

  return (
    <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Search Header */}
      <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', mb: 2, flexShrink: 0 }}>
        <TextField
          placeholder={t('argus.userProfiles.filterEventsPlaceholder', 'Filter events...')}
          size="small"
          value={eventSearch}
          onChange={(e) => setEventSearch(e.target.value)}
          sx={{
            flex: 1,
            '& .MuiInputBase-root': {
              height: 36,
              fontSize: 12,
            },
          }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ fontSize: 16 }} />
              </InputAdornment>
            ),
            endAdornment: eventSearch ? (
              <InputAdornment position="end">
                <IconButton
                  size="small"
                  onClick={() => setEventSearch('')}
                  sx={{ p: 0.25 }}
                >
                  <CloseIcon sx={{ fontSize: 14 }} />
                </IconButton>
              </InputAdornment>
            ) : null,
          }}
        />
      </Box>

      {/* Timeline List */}
      <Box sx={{ flex: 1, overflowY: 'auto' }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress size={32} />
          </Box>
        ) : groupedEvents.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 8, color: 'text.secondary' }}>
            <Typography variant="body2">
              {t('argus.userProfiles.noEventsMatch', 'No events match the filters.')}
            </Typography>
          </Box>
        ) : (
          groupedEvents.map(([dateStr, items]) => (
            <Box key={dateStr} sx={{ mb: 3 }}>
              {/* Date Section Divider */}
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  mb: 1.5,
                  pb: 0.5,
                  borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
                }}
              >
                <Typography variant="subtitle2" fontWeight={700} color="text.primary" sx={{ fontSize: '0.85rem' }}>
                  {dateStr}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10 }}>
                  ({items.length})
                </Typography>
              </Box>

              {/* Accordion list */}
              {(expandedDates.has(dateStr) ? items : items.slice(0, 5)).map(
                (evt, idx) => {
                  const isExpanded = expandedEventId === `${evt.event_id}-${idx}`;
                  return (
                    <Accordion
                      key={`${evt.event_id}-${idx}`}
                      expanded={isExpanded}
                      onChange={() =>
                        setExpandedEventId(
                          isExpanded ? null : `${evt.event_id}-${idx}`
                        )
                      }
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
                          borderColor: isDark
                            ? 'rgba(255,255,255,0.1)'
                            : 'rgba(0,0,0,0.1)',
                        },
                      }}
                    >
                      <AccordionSummary
                        expandIcon={<ExpandMoreIcon sx={{ fontSize: 18 }} />}
                        sx={{
                          minHeight: 44,
                          height: 44,
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
                        <Typography
                          variant="body2"
                          fontWeight={600}
                          sx={{
                            fontSize: 13,
                            flex: 1,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {evt.event_name}
                        </Typography>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{ flexShrink: 0, mr: 1, fontSize: 11 }}
                        >
                          {new Date(evt.timestamp).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </Typography>
                      </AccordionSummary>
                      <AccordionDetails
                        sx={{
                          px: 2,
                          py: 1.5,
                          borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
                          bgcolor: isDark
                            ? 'rgba(0,0,0,0.15)'
                            : 'rgba(0,0,0,0.015)',
                        }}
                      >
                        <TableContainer
                          component={Paper}
                          variant="outlined"
                          sx={{
                            borderRadius: '6px',
                            overflow: 'hidden',
                            bgcolor: 'transparent',
                            borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
                          }}
                        >
                          <Table size="small">
                            <TableHead>
                              <TableRow>
                                <TableCell
                                  sx={{
                                    fontSize: 11,
                                    fontWeight: 700,
                                    p: 0.8,
                                    bgcolor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
                                  }}
                                >
                                  {t('argus.userProfiles.attributeKey', 'Attribute Key')}
                                </TableCell>
                                <TableCell
                                  sx={{
                                    fontSize: 11,
                                    fontWeight: 700,
                                    p: 0.8,
                                    bgcolor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
                                  }}
                                >
                                  {t('argus.userProfiles.attributeValue', 'Value')}
                                </TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              <TableRow>
                                <TableCell
                                  sx={{
                                    fontSize: 11,
                                    p: 0.8,
                                    fontWeight: 600,
                                    color: theme.palette.primary.main,
                                  }}
                                >
                                  event_id
                                </TableCell>
                                <TableCell
                                  sx={{ fontSize: 11, p: 0.8, fontFamily: 'monospace' }}
                                >
                                  <CopyableCell value={evt.event_id} />
                                </TableCell>
                              </TableRow>
                              {evt.session_id && (
                                <TableRow>
                                  <TableCell
                                    sx={{
                                      fontSize: 11,
                                      p: 0.8,
                                      fontWeight: 600,
                                      color: theme.palette.primary.main,
                                    }}
                                  >
                                    session_id
                                  </TableCell>
                                  <TableCell
                                    sx={{ fontSize: 11, p: 0.8, fontFamily: 'monospace' }}
                                  >
                                    <CopyableCell value={evt.session_id} />
                                  </TableCell>
                                </TableRow>
                              )}
                              {Object.entries({
                                ...evt.properties,
                                ...evt.numeric_properties,
                              }).map(([k, v]) => (
                                <TableRow key={k}>
                                  <TableCell
                                    sx={{ fontSize: 11, p: 0.8, fontFamily: 'monospace' }}
                                  >
                                    {k}
                                  </TableCell>
                                  <TableCell sx={{ fontSize: 11, p: 0.8 }}>
                                    <CopyableCell
                                      value={
                                        typeof v === 'object'
                                          ? JSON.stringify(v)
                                          : String(v)
                                      }
                                    />
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </TableContainer>
                      </AccordionDetails>
                    </Accordion>
                  );
                }
              )}
              {!expandedDates.has(dateStr) && items.length > 5 && (
                <Button
                  size="small"
                  onClick={() =>
                    setExpandedDates((prev) => new Set(prev).add(dateStr))
                  }
                  sx={{
                    mt: 0.5,
                    fontSize: 11,
                    textTransform: 'none',
                    color: 'text.secondary',
                  }}
                >
                  {t('argus.userProfiles.showMoreEvents', 'Show {{count}} more events', {
                    count: items.length - 5,
                  })}
                </Button>
              )}
            </Box>
          ))
        )}
      </Box>
    </Box>
  );
};

export default UserProfileEventFeed;

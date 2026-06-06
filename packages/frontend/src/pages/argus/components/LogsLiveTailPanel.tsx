import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Box, Typography, Chip, Button, alpha } from '@mui/material';
import {
  PlayArrow as PlayArrowIcon,
  Stop as StopIcon,
  Search as SearchIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import EmptyPlaceholder from '@/components/common/EmptyPlaceholder';
import argusService, { ArgusLogEntry } from '@/services/argusService';

export interface LogsLiveTailPanelProps {
  projectId: string;
  searchDebounce: string;
  isDark: boolean;
}

const SEVERITY_COLORS: Record<string, string> = {
  fatal: '#d32f2f',
  error: '#f44336',
  warn: '#ff9800',
  warning: '#ff9800',
  info: '#2196f3',
  debug: '#9e9e9e',
  trace: '#607d8b',
};

const LogsLiveTailPanel: React.FC<LogsLiveTailPanelProps> = ({
  projectId,
  searchDebounce,
  isDark,
}) => {
  const { t } = useTranslation();
  const [liveTailLogs, setLiveTailLogs] = useState<ArgusLogEntry[]>([]);
  const [liveTailActive, setLiveTailActive] = useState(false);
  const [liveTailPaused, setLiveTailPaused] = useState(false);
  const [liveTailCount, setLiveTailCount] = useState(0);
  const liveTailRef = useRef<EventSource | null>(null);
  const liveTailBufferRef = useRef<ArgusLogEntry[]>([]);

  const stopLiveTail = useCallback(() => {
    if (liveTailRef.current) {
      liveTailRef.current.close();
      liveTailRef.current = null;
    }
    setLiveTailActive(false);
  }, []);

  const startLiveTail = useCallback(() => {
    if (liveTailRef.current) liveTailRef.current.close();
    setLiveTailLogs([]);
    setLiveTailCount(0);
    setLiveTailPaused(false);
    setLiveTailActive(true);

    const es = argusService.createLiveTailConnection(
      projectId,
      { search: searchDebounce || undefined },
      (newLogs) => {
        setLiveTailCount((prev) => prev + newLogs.length);
        if (!liveTailPaused) {
          setLiveTailLogs((prev) => [...prev, ...newLogs].slice(-500));
        } else {
          liveTailBufferRef.current.push(...newLogs);
        }
      },
      () => {
        /* SSE error — will auto-reconnect */
      }
    );
    liveTailRef.current = es;
  }, [projectId, searchDebounce, liveTailPaused]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (liveTailRef.current) liveTailRef.current.close();
    };
  }, []);

  return (
    <Box
      sx={{
        px: 1,
        py: 1,
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        minHeight: 300,
      }}
    >
      {/* Controls */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        {!liveTailActive ? (
          <Button
            variant="contained"
            size="small"
            color="success"
            onClick={startLiveTail}
            startIcon={<PlayArrowIcon sx={{ fontSize: 16 }} />}
            sx={{
              textTransform: 'none',
              fontSize: '0.73rem',
              fontWeight: 600,
              borderRadius: '6px',
            }}
          >
            {t('argus.logs.liveTail.start', 'Start Streaming')}
          </Button>
        ) : (
          <Button
            variant="contained"
            size="small"
            color="error"
            onClick={stopLiveTail}
            startIcon={<StopIcon sx={{ fontSize: 16 }} />}
            sx={{
              textTransform: 'none',
              fontSize: '0.73rem',
              fontWeight: 600,
              borderRadius: '6px',
            }}
          >
            {t('argus.logs.liveTail.stop', 'Stop Streaming')}
          </Button>
        )}
        {liveTailActive && (
          <Button
            variant="outlined"
            size="small"
            onClick={() => {
              if (liveTailPaused) {
                // Resume: flush buffer
                setLiveTailLogs((prev) =>
                  [...prev, ...liveTailBufferRef.current].slice(-500)
                );
                liveTailBufferRef.current = [];
              }
              setLiveTailPaused((p) => !p);
            }}
            sx={{
              textTransform: 'none',
              fontSize: '0.72rem',
              borderRadius: '6px',
            }}
          >
            {liveTailPaused
              ? t('argus.logs.liveTail.resume', 'Resume')
              : t('argus.logs.liveTail.pause', 'Pause')}
          </Button>
        )}
        {liveTailLogs.length > 0 && (
          <Button
            variant="text"
            size="small"
            onClick={() => {
              setLiveTailLogs([]);
              setLiveTailCount(0);
            }}
            sx={{
              textTransform: 'none',
              fontSize: '0.72rem',
              color: 'text.secondary',
            }}
          >
            {t('argus.logs.liveTail.clear', 'Clear Logs')}
          </Button>
        )}
        <Box sx={{ flex: 1 }} />
        {liveTailActive && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Box
              sx={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                backgroundColor: liveTailPaused ? '#ff9800' : '#4caf50',
                animation: liveTailPaused ? 'none' : 'pulse 1.5s infinite',
                '@keyframes pulse': {
                  '0%,100%': { opacity: 1 },
                  '50%': { opacity: 0.4 },
                },
              }}
            />
            <Typography
              sx={{
                fontSize: '0.68rem',
                color: 'text.secondary',
                fontWeight: 600,
              }}
            >
              {liveTailPaused
                ? t('argus.logs.liveTail.paused', 'Paused')
                : t('argus.logs.liveTail.streaming', 'Streaming...')}
            </Typography>
            <Chip
              size="small"
              label={t('argus.logs.liveTail.received', '{{count}} received', {
                count: liveTailCount,
              })}
              sx={{ height: 20, fontSize: '0.65rem', ml: 0.5 }}
            />
          </Box>
        )}
      </Box>

      {/* Log stream */}
      <Box
        sx={{
          flex: 1,
          overflow: 'auto',
          fontFamily: 'monospace',
          fontSize: '0.70rem',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {liveTailLogs.length === 0 ? (
          <EmptyPlaceholder
            icon={<SearchIcon sx={{ fontSize: 48 }} />}
            message={t('argus.logs.liveTail.noLogs', 'No logs received yet')}
            description={t(
              'argus.logs.liveTail.noLogsDesc',
              'Start streaming to see new logs appear here.'
            )}
            sx={{ flex: 1 }}
          />
        ) : (
          liveTailLogs.map((log, idx) => (
            <Box
              key={`${log.log_id}-${idx}`}
              sx={{
                display: 'flex',
                gap: 1,
                py: 0.3,
                px: 0.5,
                borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)'}`,
                '&:hover': {
                  backgroundColor: isDark
                    ? 'rgba(255,255,255,0.02)'
                    : 'rgba(0,0,0,0.02)',
                },
              }}
            >
              <Typography
                sx={{
                  fontSize: '0.65rem',
                  color: 'text.disabled',
                  flexShrink: 0,
                  width: 75,
                  fontFamily: 'monospace',
                }}
              >
                {new Date(log.timestamp).toLocaleTimeString()}
              </Typography>
              <Chip
                label={log.level}
                size="small"
                sx={{
                  height: 16,
                  fontSize: '0.58rem',
                  fontWeight: 700,
                  flexShrink: 0,
                  backgroundColor: alpha(
                    SEVERITY_COLORS[log.level?.toLowerCase()] || '#9e9e9e',
                    0.15
                  ),
                  color: SEVERITY_COLORS[log.level?.toLowerCase()] || '#9e9e9e',
                }}
              />
              <Typography
                sx={{
                  fontSize: '0.70rem',
                  flex: 1,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {log.message || log.body}
              </Typography>
            </Box>
          ))
        )}
      </Box>
    </Box>
  );
};

export default LogsLiveTailPanel;

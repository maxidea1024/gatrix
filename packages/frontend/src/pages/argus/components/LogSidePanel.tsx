import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  IconButton,
  Tabs,
  Tab,
  Divider,
  Button,
  useTheme,
  alpha,
  Chip,
  CircularProgress,
} from '@mui/material';
import {
  Close as CloseIcon,
  KeyboardArrowUp as PrevIcon,
  KeyboardArrowDown as NextIcon,
  Timeline as TraceIcon,
  OpenInNew as OpenIcon,
} from '@mui/icons-material';
import SafeTooltip from '@/components/common/SafeTooltip';
import { CopyButton } from '@/components/common/CopyButton';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { formatWith } from '@/utils/dateFormat';
import argusService, { ArgusTraceDetail } from '@/services/argusService';
import TraceWaterfall from '@/components/argus/TraceWaterfall';
import { useOrgProject } from '@/contexts/OrgProjectContext';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import PageContentLoader from '@/components/common/PageContentLoader';

import { LogSidePanelProps } from './LogSidePanel/types';
import { JsonTab } from './LogSidePanel/JsonTab';
import { EventTab, SEVERITY_COLORS } from './LogSidePanel/EventTab';
import {
  PanelHeader,
  LevelChip,
  MetadataBar,
  TraceHeaderBar,
} from './LogSidePanel.styles';

const LogSidePanel = React.memo(
  React.forwardRef<HTMLDivElement, LogSidePanelProps>((
  {
  log,
  loading = false,
  open,
  onClose,
  onPrev,
  onNext,
  onFilter,
  hasPrev,
  hasNext,
  width = 420,
}, ref) => {
  const theme = useTheme();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const isDark = theme.palette.mode === 'dark';
  const [tab, setTab] = useLocalStorage('argus_right_panel_tab', 0);

  const { currentProject } = useOrgProject();
  const projectId = currentProject?.id || '1';
  const [traceData, setTraceData] = useState<ArgusTraceDetail | null>(null);
  const [traceLoading, setTraceLoading] = useState(false);
  const [traceFetchedFor, setTraceFetchedFor] = useState<string | null>(null);

  useEffect(() => {
    setTraceData(null);
    setTraceFetchedFor(null);
  }, [log?.log_id]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      const tag = (document.activeElement?.tagName || '').toLowerCase();
      const isEditable =
        tag === 'input' ||
        tag === 'textarea' ||
        (document.activeElement as HTMLElement)?.isContentEditable;
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (isEditable) return;
      if (e.key === 'ArrowUp' || e.key === 'k') {
        e.preventDefault();
        onPrev();
      }
      if (e.key === 'ArrowDown' || e.key === 'j') {
        e.preventDefault();
        onNext();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose, onPrev, onNext]);

  useEffect(() => {
    if (tab === 2 && log?.trace_id && traceFetchedFor !== log.trace_id) {
      setTraceLoading(true);
      setTraceFetchedFor(log.trace_id);
      argusService
        .getTraceDetail(projectId, log.trace_id)
        .then((data) => setTraceData(data))
        .catch((err) => {
          console.error('Failed to fetch trace', err);
          setTraceData(null);
        })
        .finally(() => setTraceLoading(false));
    }
  }, [tab, log?.trace_id, projectId, traceFetchedFor]);
  if (!log && !loading) {
    return (
      <Box
        ref={ref}
        sx={{
          width,
          flexShrink: 0,
          height: '100%',
          display: open ? 'flex' : 'none',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          position: 'relative',
        }}
      >
        <Box sx={{ position: 'absolute', top: 8, right: 8 }}>
          <SafeTooltip title={t('argus.logs.panel.close', 'Close (Esc)')}>
            <IconButton
              size="small"
              onClick={onClose}
              sx={{ color: 'text.secondary' }}
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          </SafeTooltip>
        </Box>
        <Typography sx={{ color: 'text.secondary', fontSize: '0.8rem', mt: 4 }}>
          {t(
            'argus.logs.panel.selectLog',
            'Select a log event to view details'
          )}
        </Typography>
      </Box>
    );
  }

  const levelColor = log
    ? SEVERITY_COLORS[log.level?.toLowerCase()] || '#9e9e9e'
    : '#9e9e9e';
  const formattedTime = log
    ? formatWith(log.timestamp, 'YYYY-MM-DD HH:mm:ss.SSS')
    : '';

  return (
    <Box
      ref={ref}
      sx={{
        width,
        flexShrink: 0,
        height: '100%',
        overflow: 'auto',
        display: open ? 'flex' : 'none',
        flexDirection: 'column',
      }}
    >
      <PageContentLoader
        loading={loading}
        sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}
      >
        {log && (
          <>
            <PanelHeader isDark={isDark}>
              <LevelChip
                label={log.level?.toUpperCase() || 'UNKNOWN'}
                size="small"
                levelColor={levelColor}
              />
              <Typography
                sx={{
                  fontSize: '0.7rem',
                  color: 'text.secondary',
                  fontFamily: 'monospace',
                  flex: 1,
                }}
              >
                {formattedTime}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                <SafeTooltip
                  title={t('argus.logs.panel.prevLog', 'Previous log (↑)')}
                >
                  <span>
                    <IconButton
                      size="small"
                      onClick={onPrev}
                      disabled={!hasPrev}
                      sx={{ p: 0.3 }}
                    >
                      <PrevIcon sx={{ fontSize: 18 }} />
                    </IconButton>
                  </span>
                </SafeTooltip>
                <SafeTooltip
                  title={t('argus.logs.panel.nextLog', 'Next log (↓)')}
                >
                  <span>
                    <IconButton
                      size="small"
                      onClick={onNext}
                      disabled={!hasNext}
                      sx={{ p: 0.3 }}
                    >
                      <NextIcon sx={{ fontSize: 18 }} />
                    </IconButton>
                  </span>
                </SafeTooltip>
              </Box>
              <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
              {log.trace_id && (
                <SafeTooltip
                  title={t('argus.logs.panel.viewTrace', 'View Trace')}
                >
                  <IconButton
                    size="small"
                    onClick={() =>
                      navigate(`/argus/performance?trace=${log.trace_id}`, {
                        state: { allowBack: true },
                      })
                    }
                    sx={{ p: 0.3, color: theme.palette.primary.main }}
                  >
                    <TraceIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                </SafeTooltip>
              )}
              <SafeTooltip title={t('argus.logs.panel.close', 'Close (Esc)')}>
                <IconButton size="small" onClick={onClose} sx={{ p: 0.3 }}>
                  <CloseIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </SafeTooltip>
            </PanelHeader>

            <MetadataBar isDark={isDark}>
              {log.service && (
                <Chip
                  label={log.service}
                  size="small"
                  variant="outlined"
                  sx={{ height: 20, fontSize: '0.62rem', fontWeight: 600 }}
                />
              )}
              {log.environment && (
                <Chip
                  label={log.environment}
                  size="small"
                  variant="outlined"
                  sx={{ height: 20, fontSize: '0.62rem' }}
                />
              )}
              {log.release && (
                <Chip
                  label={log.release}
                  size="small"
                  variant="outlined"
                  sx={{ height: 20, fontSize: '0.62rem' }}
                />
              )}
            </MetadataBar>

            <Tabs
              value={tab}
              onChange={(_, v) => setTab(v)}
              sx={{
                minHeight: 34,
                flexShrink: 0,
                borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
                '& .MuiTab-root': {
                  minHeight: 34,
                  py: 0,
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  textTransform: 'none',
                },
              }}
            >
              <Tab label={t('argus.logs.panel.eventTab', 'Event')} />
              <Tab label="JSON" />
              {log.trace_id && (
                <Tab label={t('argus.logs.panel.traceTab', 'Trace')} />
              )}
            </Tabs>

            <Box sx={{ flex: 1, overflowY: 'auto' }}>
              {tab === 0 && (
                <EventTab log={log} isDark={isDark} onFilter={onFilter} />
              )}
              {tab === 1 && <JsonTab log={log} isDark={isDark} />}
              {tab === 2 && log.trace_id && (
                <Box
                  sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    height: '100%',
                  }}
                >
                  <TraceHeaderBar isDark={isDark}>
                    <Box
                      sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
                    >
                      <TraceIcon
                        sx={{ fontSize: 14, color: 'text.disabled' }}
                      />
                      <Typography
                        sx={{
                          fontSize: '0.72rem',
                          color: 'text.secondary',
                          fontFamily: 'monospace',
                        }}
                      >
                        {log.trace_id.slice(0, 16)}...
                      </Typography>
                      <CopyButton
                        text={log.trace_id}
                        size={12}
                        sx={{ p: 0.2 }}
                      />
                    </Box>
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<OpenIcon sx={{ fontSize: 12 }} />}
                      onClick={() =>
                        navigate(`/argus/performance?trace=${log.trace_id}`, {
                          state: { allowBack: true },
                        })
                      }
                      sx={{
                        textTransform: 'none',
                        fontSize: '0.68rem',
                        fontWeight: 600,
                        borderRadius: '6px',
                        py: 0.25,
                        px: 1,
                        borderColor: isDark
                          ? 'rgba(255,255,255,0.12)'
                          : 'rgba(0,0,0,0.12)',
                      }}
                    >
                      {t('argus.logs.panel.viewFullTrace', 'View full trace')}
                    </Button>
                  </TraceHeaderBar>
                  <Box sx={{ flex: 1, overflow: 'auto', minHeight: 200 }}>
                    {traceLoading ? (
                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          py: 8,
                        }}
                      >
                        <CircularProgress size={24} />
                      </Box>
                    ) : traceData ? (
                      <TraceWaterfall trace={traceData} isDark={isDark} />
                    ) : (
                      <Box sx={{ py: 6, textAlign: 'center' }}>
                        <TraceIcon
                          sx={{ fontSize: 40, color: 'text.disabled', mb: 1 }}
                        />
                        <Typography
                          sx={{ fontSize: '0.82rem', fontWeight: 600, mb: 0.5 }}
                        >
                          {t(
                            'argus.logs.panel.traceNotFound',
                            'Trace not found'
                          )}
                        </Typography>
                        <Typography
                          sx={{ fontSize: '0.72rem', color: 'text.secondary' }}
                        >
                          {t(
                            'argus.logs.panel.traceNotFoundDesc',
                            'The trace data may have expired or is not available.'
                          )}
                        </Typography>
                      </Box>
                    )}
                  </Box>
                </Box>
              )}
            </Box>
          </>
        )}
      </PageContentLoader>
    </Box>
  );
}));

export default LogSidePanel;

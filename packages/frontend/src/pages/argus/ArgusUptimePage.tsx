/**
 * ArgusUptimePage — Sentry-style Uptime Monitoring.
 *
 * Displays HTTP endpoint monitors with uptime %, response time,
 * status history timeline, and alerting configuration.
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Paper, Button, Chip, IconButton, Tooltip,
  alpha, useTheme, TextField, InputAdornment, Skeleton,
  Dialog, DialogTitle, DialogContent, DialogActions,
  Select, MenuItem, FormControl, InputLabel,
} from '@mui/material';
import {
  Search as SearchIcon,
  Add as AddIcon,
  CheckCircle as UpIcon,
  Error as DownIcon,
  Warning as DegradedIcon,
  Pause as PausedIcon,
  Refresh as RefreshIcon,
  Language as UrlIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { useOrgProject } from '@/contexts/OrgProjectContext';
import ArgusBreadcrumbs from '@/components/argus/ArgusBreadcrumbs';
import PageHeader from '@/components/common/PageHeader';

interface UptimeMonitor {
  id: string;
  name: string;
  url: string;
  method: 'GET' | 'POST' | 'HEAD';
  interval_seconds: number;
  status: 'up' | 'down' | 'degraded' | 'disabled';
  uptime_percent: number;
  avg_response_ms: number;
  last_check: string | null;
  environment: string;
  // 30-day status timeline (1 = up, 0 = down, -1 = degraded)
  timeline: number[];
  created_at: string;
}

const STATUS_CONFIG: Record<string, { color: string; icon: React.ReactElement; label: string }> = {
  up: { color: '#4caf50', icon: <UpIcon sx={{ fontSize: 16 }} />, label: 'Up' },
  down: { color: '#f44336', icon: <DownIcon sx={{ fontSize: 16 }} />, label: 'Down' },
  degraded: { color: '#ff9800', icon: <DegradedIcon sx={{ fontSize: 16 }} />, label: 'Degraded' },
  disabled: { color: '#9e9e9e', icon: <PausedIcon sx={{ fontSize: 16 }} />, label: 'Disabled' },
};

// Demo data
const DEMO_MONITORS: UptimeMonitor[] = [
  {
    id: '1', name: 'API Health', url: 'https://api.example.com/health', method: 'GET',
    interval_seconds: 60, status: 'up', uptime_percent: 99.98, avg_response_ms: 145,
    last_check: new Date(Date.now() - 30000).toISOString(), environment: 'production',
    timeline: Array.from({ length: 30 }, () => (Math.random() > 0.02 ? 1 : 0)),
    created_at: '2025-01-01T00:00:00Z',
  },
  {
    id: '2', name: 'Auth Service', url: 'https://auth.example.com/status', method: 'GET',
    interval_seconds: 60, status: 'up', uptime_percent: 99.95, avg_response_ms: 89,
    last_check: new Date(Date.now() - 45000).toISOString(), environment: 'production',
    timeline: Array.from({ length: 30 }, () => (Math.random() > 0.03 ? 1 : -1)),
    created_at: '2025-02-15T00:00:00Z',
  },
  {
    id: '3', name: 'Payment Gateway', url: 'https://pay.example.com/ping', method: 'HEAD',
    interval_seconds: 30, status: 'down', uptime_percent: 97.2, avg_response_ms: 0,
    last_check: new Date(Date.now() - 120000).toISOString(), environment: 'production',
    timeline: Array.from({ length: 30 }, (_, i) => (i > 27 ? 0 : 1)),
    created_at: '2025-03-01T00:00:00Z',
  },
  {
    id: '4', name: 'Staging API', url: 'https://staging-api.example.com/health', method: 'GET',
    interval_seconds: 300, status: 'degraded', uptime_percent: 95.5, avg_response_ms: 2100,
    last_check: new Date(Date.now() - 200000).toISOString(), environment: 'staging',
    timeline: Array.from({ length: 30 }, (_, i) => (i > 25 ? -1 : 1)),
    created_at: '2025-04-01T00:00:00Z',
  },
];

const ArgusUptimePage: React.FC = () => {
  const theme = useTheme();
  const { t } = useTranslation();
  const isDark = theme.palette.mode === 'dark';
  const [searchParams] = useSearchParams();
  const { currentProject } = useOrgProject();
  const projectId = searchParams.get('projectId') || currentProject?.id || '1';

  const [monitors, setMonitors] = useState<UptimeMonitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  const fetchMonitors = useCallback(async () => {
    setLoading(true);
    await new Promise(r => setTimeout(r, 500));
    setMonitors(DEMO_MONITORS);
    setLoading(false);
  }, [projectId]);

  useEffect(() => { fetchMonitors(); }, [fetchMonitors]);

  const filtered = monitors.filter(m => {
    if (search && !m.name.toLowerCase().includes(search.toLowerCase()) &&
        !m.url.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <Box>
      <ArgusBreadcrumbs paths={[
        { label: t('argus.nav.argus', 'Argus'), to: '/argus/overview' },
        { label: t('argus.nav.uptime', 'Uptime') },
      ]} />
      <PageHeader title={t('argus.uptime.title', 'Uptime Monitors')} />

      {/* Toolbar */}
      <Box sx={{ display: 'flex', gap: 1, mb: 2, alignItems: 'center' }}>
        <TextField
          size="small"
          placeholder={t('argus.uptime.searchPlaceholder', 'Search monitors...')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          slotProps={{
            input: {
              startAdornment: <InputAdornment position="start"><SearchIcon sx={{ fontSize: 18 }} /></InputAdornment>,
              sx: { fontSize: '0.8rem', borderRadius: '8px' },
            },
          }}
          sx={{ flex: 1, maxWidth: 400 }}
        />
        <Tooltip title={t('common.refresh', 'Refresh')}>
          <IconButton onClick={fetchMonitors} size="small">
            <RefreshIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Tooltip>
        <Button
          variant="contained"
          size="small"
          startIcon={<AddIcon />}
          onClick={() => setCreateDialogOpen(true)}
          sx={{ textTransform: 'none', borderRadius: '8px', fontSize: '0.78rem', fontWeight: 600 }}
        >
          {t('argus.uptime.createMonitor', 'Create Monitor')}
        </Button>
      </Box>

      {/* Monitor Cards */}
      {loading ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} variant="rectangular" height={100} sx={{ borderRadius: 2 }} />
          ))}
        </Box>
      ) : filtered.length === 0 ? (
        <Paper elevation={0} sx={{
          py: 6, textAlign: 'center',
          border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
          borderRadius: 2,
        }}>
          <UrlIcon sx={{ fontSize: 40, color: 'text.disabled', mb: 1 }} />
          <Typography sx={{ color: 'text.secondary', fontSize: '0.85rem' }}>
            {t('argus.uptime.noMonitors', 'No uptime monitors found')}
          </Typography>
        </Paper>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {filtered.map((monitor) => {
            const statusCfg = STATUS_CONFIG[monitor.status] || STATUS_CONFIG.up;
            return (
              <Paper
                key={monitor.id}
                elevation={0}
                sx={{
                  p: 2,
                  border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
                  borderLeft: `4px solid ${statusCfg.color}`,
                  borderRadius: 2,
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  '&:hover': { borderColor: alpha(statusCfg.color, 0.4), backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)' },
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
                  {/* Status + Name */}
                  <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Chip
                        icon={statusCfg.icon}
                        label={statusCfg.label}
                        size="small"
                        sx={{
                          height: 22, fontSize: '0.68rem', fontWeight: 700,
                          backgroundColor: alpha(statusCfg.color, 0.1),
                          color: statusCfg.color,
                          '& .MuiChip-icon': { color: statusCfg.color },
                        }}
                      />
                      <Typography sx={{ fontSize: '0.88rem', fontWeight: 700 }}>
                        {monitor.name}
                      </Typography>
                    </Box>
                    <Typography sx={{ fontSize: '0.72rem', color: 'text.disabled', fontFamily: 'monospace', mt: 0.25 }}>
                      {monitor.method} {monitor.url}
                    </Typography>
                  </Box>

                  {/* Metrics */}
                  <Box sx={{ display: 'flex', gap: 3, alignItems: 'center' }}>
                    <Box sx={{ textAlign: 'center' }}>
                      <Typography sx={{
                        fontSize: '1.1rem', fontWeight: 700,
                        color: monitor.uptime_percent >= 99.9 ? '#4caf50' : monitor.uptime_percent >= 99 ? '#ff9800' : '#f44336',
                      }}>
                        {monitor.uptime_percent.toFixed(2)}%
                      </Typography>
                      <Typography sx={{ fontSize: '0.6rem', color: 'text.disabled', textTransform: 'uppercase' }}>
                        {t('argus.uptime.uptime', 'Uptime')}
                      </Typography>
                    </Box>
                    <Box sx={{ textAlign: 'center' }}>
                      <Typography sx={{ fontSize: '1.1rem', fontWeight: 700 }}>
                        {monitor.avg_response_ms > 0 ? `${monitor.avg_response_ms}ms` : '-'}
                      </Typography>
                      <Typography sx={{ fontSize: '0.6rem', color: 'text.disabled', textTransform: 'uppercase' }}>
                        {t('argus.uptime.avgResponse', 'Avg Response')}
                      </Typography>
                    </Box>
                    <Chip label={monitor.environment} size="small" sx={{ height: 18, fontSize: '0.6rem', fontWeight: 600 }} />
                  </Box>
                </Box>

                {/* 30-day timeline */}
                <Box sx={{ display: 'flex', gap: '2px', mt: 1 }}>
                  {monitor.timeline.map((day, i) => (
                    <Tooltip key={i} title={`Day ${i + 1}: ${day === 1 ? 'Up' : day === 0 ? 'Down' : 'Degraded'}`}>
                      <Box sx={{
                        flex: 1, height: 8, borderRadius: '2px',
                        backgroundColor: day === 1
                          ? alpha('#4caf50', 0.6)
                          : day === 0
                            ? alpha('#f44336', 0.7)
                            : alpha('#ff9800', 0.5),
                        transition: 'opacity 0.15s',
                        '&:hover': { opacity: 0.8 },
                      }} />
                    </Tooltip>
                  ))}
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
                  <Typography sx={{ fontSize: '0.55rem', color: 'text.disabled' }}>30d ago</Typography>
                  <Typography sx={{ fontSize: '0.55rem', color: 'text.disabled' }}>{t('common.today', 'Today')}</Typography>
                </Box>
              </Paper>
            );
          })}
        </Box>
      )}

      {/* Create Monitor Dialog */}
      <Dialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: '12px' } }}
      >
        <DialogTitle sx={{ fontWeight: 700 }}>
          {t('argus.uptime.createMonitor', 'Create Monitor')}
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '8px !important' }}>
          <TextField size="small" label={t('argus.uptime.monitorName', 'Monitor Name')} fullWidth />
          <TextField size="small" label="URL" placeholder="https://example.com/health" fullWidth />
          <FormControl size="small" fullWidth>
            <InputLabel>Method</InputLabel>
            <Select label="Method" defaultValue="GET">
              <MenuItem value="GET">GET</MenuItem>
              <MenuItem value="HEAD">HEAD</MenuItem>
              <MenuItem value="POST">POST</MenuItem>
            </Select>
          </FormControl>
          <FormControl size="small" fullWidth>
            <InputLabel>{t('argus.uptime.interval', 'Check Interval')}</InputLabel>
            <Select label={t('argus.uptime.interval', 'Check Interval')} defaultValue={60}>
              <MenuItem value={30}>30s</MenuItem>
              <MenuItem value={60}>1m</MenuItem>
              <MenuItem value={300}>5m</MenuItem>
              <MenuItem value={600}>10m</MenuItem>
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setCreateDialogOpen(false)} sx={{ textTransform: 'none' }}>
            {t('common.cancel')}
          </Button>
          <Button variant="contained" onClick={() => setCreateDialogOpen(false)} sx={{ textTransform: 'none' }}>
            {t('common.save')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ArgusUptimePage;

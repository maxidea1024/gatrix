/**
 * ArgusCronsPage — Sentry-style Cron Monitoring.
 *
 * Displays scheduled job monitors with status, last check-in,
 * next expected check-in, and failure history.
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Paper, Button, Chip, IconButton, Tooltip,
  alpha, useTheme, TextField, InputAdornment, Skeleton,
  Dialog, DialogTitle, DialogContent, DialogActions,
  Table, TableHead, TableRow, TableCell, TableBody,
  Select, MenuItem, FormControl, InputLabel,
} from '@mui/material';
import {
  Search as SearchIcon,
  Add as AddIcon,
  CheckCircle as HealthyIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Schedule as ScheduleIcon,
  Pause as PausedIcon,
  Refresh as RefreshIcon,
  MoreVert as MoreVertIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { useOrgProject } from '@/contexts/OrgProjectContext';
import ArgusBreadcrumbs from '@/components/argus/ArgusBreadcrumbs';
import PageHeader from '@/components/common/PageHeader';

// Types
interface CronMonitor {
  id: string;
  name: string;
  slug: string;
  schedule: string;
  schedule_type: 'crontab' | 'interval';
  status: 'ok' | 'error' | 'missed' | 'timeout' | 'disabled';
  last_checkin: string | null;
  next_checkin: string | null;
  environment: string;
  owner: string | null;
  created_at: string;
  config: {
    checkin_margin?: number;
    max_runtime?: number;
    timezone?: string;
    failure_issue_threshold?: number;
    recovery_threshold?: number;
  };
}

const STATUS_CONFIG: Record<string, { color: string; icon: React.ReactElement; label: string }> = {
  ok: { color: '#4caf50', icon: <HealthyIcon sx={{ fontSize: 16 }} />, label: 'Healthy' },
  error: { color: '#f44336', icon: <ErrorIcon sx={{ fontSize: 16 }} />, label: 'Error' },
  missed: { color: '#ff9800', icon: <WarningIcon sx={{ fontSize: 16 }} />, label: 'Missed' },
  timeout: { color: '#ff5722', icon: <ScheduleIcon sx={{ fontSize: 16 }} />, label: 'Timeout' },
  disabled: { color: '#9e9e9e', icon: <PausedIcon sx={{ fontSize: 16 }} />, label: 'Disabled' },
};

// Demo data
const DEMO_MONITORS: CronMonitor[] = [
  {
    id: '1', name: 'daily-digest-email', slug: 'daily-digest', schedule: '0 9 * * *',
    schedule_type: 'crontab', status: 'ok', last_checkin: new Date(Date.now() - 3600000).toISOString(),
    next_checkin: new Date(Date.now() + 82800000).toISOString(), environment: 'production',
    owner: null, created_at: '2025-01-15T00:00:00Z',
    config: { checkin_margin: 5, max_runtime: 300, timezone: 'UTC' },
  },
  {
    id: '2', name: 'cleanup-old-sessions', slug: 'cleanup-sessions', schedule: '*/30 * * * *',
    schedule_type: 'crontab', status: 'ok', last_checkin: new Date(Date.now() - 900000).toISOString(),
    next_checkin: new Date(Date.now() + 900000).toISOString(), environment: 'production',
    owner: null, created_at: '2025-02-01T00:00:00Z',
    config: { checkin_margin: 2, max_runtime: 120 },
  },
  {
    id: '3', name: 'process-payment-queue', slug: 'payment-queue', schedule: '*/5 * * * *',
    schedule_type: 'crontab', status: 'error', last_checkin: new Date(Date.now() - 600000).toISOString(),
    next_checkin: new Date(Date.now() + 300000).toISOString(), environment: 'production',
    owner: 'backend-team', created_at: '2025-03-10T00:00:00Z',
    config: { checkin_margin: 1, max_runtime: 60, failure_issue_threshold: 3 },
  },
  {
    id: '4', name: 'nightly-backup', slug: 'nightly-backup', schedule: '0 2 * * *',
    schedule_type: 'crontab', status: 'missed', last_checkin: new Date(Date.now() - 86400000).toISOString(),
    next_checkin: new Date(Date.now() + 50400000).toISOString(), environment: 'production',
    owner: 'infra-team', created_at: '2025-01-01T00:00:00Z',
    config: { checkin_margin: 10, max_runtime: 7200, timezone: 'Asia/Seoul' },
  },
  {
    id: '5', name: 'weekly-report', slug: 'weekly-report', schedule: '0 8 * * 1',
    schedule_type: 'crontab', status: 'disabled', last_checkin: null,
    next_checkin: null, environment: 'staging',
    owner: null, created_at: '2025-04-01T00:00:00Z',
    config: {},
  },
];

function formatRelativeTime(isoStr: string | null): string {
  if (!isoStr) return '-';
  const diff = Date.now() - new Date(isoStr).getTime();
  const absDiff = Math.abs(diff);
  const prefix = diff < 0 ? 'in ' : '';
  const suffix = diff >= 0 ? ' ago' : '';
  if (absDiff < 60000) return `${prefix}${Math.floor(absDiff / 1000)}s${suffix}`;
  if (absDiff < 3600000) return `${prefix}${Math.floor(absDiff / 60000)}m${suffix}`;
  if (absDiff < 86400000) return `${prefix}${Math.floor(absDiff / 3600000)}h${suffix}`;
  return `${prefix}${Math.floor(absDiff / 86400000)}d${suffix}`;
}

const ArgusCronsPage: React.FC = () => {
  const theme = useTheme();
  const { t } = useTranslation();
  const isDark = theme.palette.mode === 'dark';
  const [searchParams] = useSearchParams();
  const { currentProject } = useOrgProject();
  const projectId = searchParams.get('projectId') || currentProject?.id || '1';

  const [monitors, setMonitors] = useState<CronMonitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  const fetchMonitors = useCallback(async () => {
    setLoading(true);
    // TODO: Replace with actual API call when backend supports crons
    await new Promise(r => setTimeout(r, 500));
    setMonitors(DEMO_MONITORS);
    setLoading(false);
  }, [projectId]);

  useEffect(() => { fetchMonitors(); }, [fetchMonitors]);

  const filtered = monitors.filter(m => {
    if (statusFilter !== 'all' && m.status !== statusFilter) return false;
    if (search && !m.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const statusCounts = monitors.reduce((acc, m) => {
    acc[m.status] = (acc[m.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <Box>
      <ArgusBreadcrumbs paths={[
        { label: t('argus.nav.argus', 'Argus'), to: '/argus/overview' },
        { label: t('argus.nav.crons', 'Crons') },
      ]} />
      <PageHeader title={t('argus.crons.title', 'Cron Monitors')} />

      {/* Status Summary */}
      <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
        {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
          <Chip
            key={key}
            icon={cfg.icon}
            label={`${cfg.label}: ${statusCounts[key] || 0}`}
            size="small"
            onClick={() => setStatusFilter(statusFilter === key ? 'all' : key)}
            sx={{
              fontSize: '0.72rem', fontWeight: 600,
              borderColor: statusFilter === key ? cfg.color : 'transparent',
              backgroundColor: statusFilter === key ? alpha(cfg.color, 0.1) : 'transparent',
              border: `1px solid ${statusFilter === key ? cfg.color : isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
              color: cfg.color,
            }}
          />
        ))}
      </Box>

      {/* Toolbar */}
      <Box sx={{ display: 'flex', gap: 1, mb: 2, alignItems: 'center' }}>
        <TextField
          size="small"
          placeholder={t('argus.crons.searchPlaceholder', 'Search monitors...')}
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
          {t('argus.crons.createMonitor', 'Create Monitor')}
        </Button>
      </Box>

      {/* Monitor Table */}
      <Paper elevation={0} sx={{
        border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
        borderRadius: 2, overflow: 'hidden',
      }}>
        {loading ? (
          <Box sx={{ p: 2 }}>
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} variant="rectangular" height={48} sx={{ mb: 1, borderRadius: 1 }} />
            ))}
          </Box>
        ) : filtered.length === 0 ? (
          <Box sx={{ py: 6, textAlign: 'center' }}>
            <ScheduleIcon sx={{ fontSize: 40, color: 'text.disabled', mb: 1 }} />
            <Typography sx={{ color: 'text.secondary', fontSize: '0.85rem' }}>
              {t('argus.crons.noMonitors', 'No cron monitors found')}
            </Typography>
          </Box>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 700, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  {t('argus.crons.monitor', 'Monitor')}
                </TableCell>
                <TableCell sx={{ fontWeight: 700, fontSize: '0.72rem', textTransform: 'uppercase' }}>
                  {t('argus.crons.status', 'Status')}
                </TableCell>
                <TableCell sx={{ fontWeight: 700, fontSize: '0.72rem', textTransform: 'uppercase' }}>
                  {t('argus.crons.schedule', 'Schedule')}
                </TableCell>
                <TableCell sx={{ fontWeight: 700, fontSize: '0.72rem', textTransform: 'uppercase' }}>
                  {t('argus.crons.lastCheckin', 'Last Check-in')}
                </TableCell>
                <TableCell sx={{ fontWeight: 700, fontSize: '0.72rem', textTransform: 'uppercase' }}>
                  {t('argus.crons.nextExpected', 'Next Expected')}
                </TableCell>
                <TableCell sx={{ fontWeight: 700, fontSize: '0.72rem', textTransform: 'uppercase' }}>
                  {t('argus.crons.environment', 'Env')}
                </TableCell>
                <TableCell width={40} />
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.map((monitor) => {
                const statusCfg = STATUS_CONFIG[monitor.status] || STATUS_CONFIG.ok;
                return (
                  <TableRow
                    key={monitor.id}
                    hover
                    sx={{ cursor: 'pointer', '&:last-child td': { borderBottom: 0 } }}
                  >
                    <TableCell>
                      <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                        <Typography sx={{ fontSize: '0.82rem', fontWeight: 600 }}>
                          {monitor.name}
                        </Typography>
                        {monitor.owner && (
                          <Typography sx={{ fontSize: '0.65rem', color: 'text.disabled' }}>
                            {monitor.owner}
                          </Typography>
                        )}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Chip
                        icon={statusCfg.icon}
                        label={statusCfg.label}
                        size="small"
                        sx={{
                          height: 22, fontSize: '0.68rem', fontWeight: 700,
                          backgroundColor: alpha(statusCfg.color, 0.1),
                          color: statusCfg.color,
                          border: 'none',
                          '& .MuiChip-icon': { color: statusCfg.color },
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography sx={{ fontSize: '0.75rem', fontFamily: 'monospace', color: 'text.secondary' }}>
                        {monitor.schedule}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography sx={{ fontSize: '0.75rem', fontFamily: 'monospace' }}>
                        {formatRelativeTime(monitor.last_checkin)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography sx={{ fontSize: '0.75rem', fontFamily: 'monospace' }}>
                        {formatRelativeTime(monitor.next_checkin)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={monitor.environment}
                        size="small"
                        sx={{ height: 18, fontSize: '0.6rem', fontWeight: 600 }}
                      />
                    </TableCell>
                    <TableCell>
                      <IconButton size="small"><MoreVertIcon sx={{ fontSize: 16 }} /></IconButton>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Paper>

      {/* Create Monitor Dialog */}
      <Dialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: '12px' } }}
      >
        <DialogTitle sx={{ fontWeight: 700 }}>
          {t('argus.crons.createMonitor', 'Create Monitor')}
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '8px !important' }}>
          <TextField size="small" label={t('argus.crons.monitorName', 'Monitor Name')} fullWidth />
          <TextField size="small" label={t('argus.crons.cronExpression', 'Cron Expression')} placeholder="*/5 * * * *" fullWidth />
          <FormControl size="small" fullWidth>
            <InputLabel>{t('argus.crons.environment', 'Environment')}</InputLabel>
            <Select label={t('argus.crons.environment', 'Environment')} defaultValue="production">
              <MenuItem value="production">Production</MenuItem>
              <MenuItem value="staging">Staging</MenuItem>
              <MenuItem value="development">Development</MenuItem>
            </Select>
          </FormControl>
          <TextField size="small" label={t('argus.crons.checkinMargin', 'Check-in Margin (min)')} type="number" defaultValue={5} fullWidth />
          <TextField size="small" label={t('argus.crons.maxRuntime', 'Max Runtime (sec)')} type="number" defaultValue={300} fullWidth />
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

export default ArgusCronsPage;

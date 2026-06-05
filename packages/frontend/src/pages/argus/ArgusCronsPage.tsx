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
  Delete as DeleteIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { useSnackbar } from 'notistack';
import { useOrgProject } from '@/contexts/OrgProjectContext';
import ArgusBreadcrumbs from '@/components/argus/ArgusBreadcrumbs';
import PageHeader from '@/components/common/PageHeader';
import EmptyPlaceholder from '@/components/common/EmptyPlaceholder';
import argusService from '@/services/argusService';

// Types
interface CronMonitor {
  id: string;
  name: string;
  slug: string;
  schedule_type: string;
  schedule_value: string;
  status: string;
  last_checkin_at: string | null;
  next_checkin_at: string | null;
  last_status: string | null;
  environment: string;
  checkin_margin: number;
  max_runtime: number;
  created_at: string;
}

function formatRelativeTime(isoStr: string | null, t: any): string {
  if (!isoStr) return '-';
  const diff = Date.now() - new Date(isoStr).getTime();
  const absDiff = Math.abs(diff);
  const prefix = diff < 0 ? t('common.time.in', 'in ') : '';
  const suffix = diff >= 0 ? t('common.time.ago', ' ago') : '';
  if (absDiff < 60000) return `${prefix}${Math.floor(absDiff / 1000)}${t('common.time.s', 's')}${suffix}`;
  if (absDiff < 3600000) return `${prefix}${Math.floor(absDiff / 60000)}${t('common.time.m', 'm')}${suffix}`;
  if (absDiff < 86400000) return `${prefix}${Math.floor(absDiff / 3600000)}${t('common.time.h', 'h')}${suffix}`;
  return `${prefix}${Math.floor(absDiff / 86400000)}${t('common.time.d', 'd')}${suffix}`;
}

const ArgusCronsPage: React.FC = () => {
  const theme = useTheme();
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const isDark = theme.palette.mode === 'dark';
  const [searchParams] = useSearchParams();
  const { currentProject } = useOrgProject();
  const projectId = searchParams.get('projectId') || currentProject?.id || '1';

  const [monitors, setMonitors] = useState<CronMonitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(handler);
  }, [search]);
  
  // Dialog State
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    schedule_value: '*/5 * * * *',
    environment: 'production',
    checkin_margin: 5,
    max_runtime: 300,
  });
  const [formErrors, setFormErrors] = useState({ name: false, schedule_value: false });

  const STATUS_CONFIG: Record<string, { color: string; icon: React.ReactElement; label: string }> = {
    ok: { color: '#4caf50', icon: <HealthyIcon sx={{ fontSize: 16 }} />, label: t('argus.crons.status.ok', 'Healthy') },
    error: { color: '#f44336', icon: <ErrorIcon sx={{ fontSize: 16 }} />, label: t('argus.crons.status.error', 'Error') },
    missed: { color: '#ff9800', icon: <WarningIcon sx={{ fontSize: 16 }} />, label: t('argus.crons.status.missed', 'Missed') },
    timeout: { color: '#ff5722', icon: <ScheduleIcon sx={{ fontSize: 16 }} />, label: t('argus.crons.status.timeout', 'Timeout') },
    disabled: { color: '#9e9e9e', icon: <PausedIcon sx={{ fontSize: 16 }} />, label: t('argus.crons.status.disabled', 'Disabled') },
    active: { color: '#2196f3', icon: <HealthyIcon sx={{ fontSize: 16 }} />, label: t('argus.crons.status.active', 'Active') },
  };

  const fetchMonitors = useCallback(async () => {
    setLoading(true);
    try {
      const data = await argusService.getCrons(projectId);
      setMonitors(data);
    } catch (error) {
      console.error('Failed to load crons', error);
      enqueueSnackbar(t('common.error', 'An error occurred'), { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [projectId, enqueueSnackbar, t]);

  useEffect(() => { fetchMonitors(); }, [fetchMonitors]);

  const handleCreate = async () => {
    const errors = {
      name: !formData.name.trim(),
      schedule_value: !formData.schedule_value.trim()
    };
    setFormErrors(errors);
    if (errors.name || errors.schedule_value || !formData.slug) return;

    setIsSubmitting(true);
    try {
      const newMonitor = await argusService.createCron(projectId, {
        ...formData,
        schedule_type: 'crontab'
      });
      // Optimistic update
      setMonitors([newMonitor, ...monitors]);
      setCreateDialogOpen(false);
      setFormData({
        name: '', slug: '', schedule_value: '*/5 * * * *',
        environment: 'production', checkin_margin: 5, max_runtime: 300
      });
      enqueueSnackbar(t('argus.crons.createSuccess', 'Monitor created successfully'), { variant: 'success' });
    } catch (error) {
      console.error('Create failed', error);
      enqueueSnackbar(t('argus.crons.createFailed', 'Failed to create monitor.'), { variant: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      await argusService.deleteCron(projectId, id);
      setMonitors(prev => prev.filter(m => m.id !== id));
      enqueueSnackbar(t('common.deleteSuccess', 'Deleted successfully'), { variant: 'success' });
    } catch (error) {
      console.error('Delete failed', error);
      enqueueSnackbar(t('common.deleteFailed', 'Failed to delete'), { variant: 'error' });
    }
  };

  const filtered = monitors.filter(m => {
    const s = m.last_status || m.status || 'active';
    if (statusFilter !== 'all' && s !== statusFilter) return false;
    if (debouncedSearch && !m.name.toLowerCase().includes(debouncedSearch.toLowerCase())) return false;
    return true;
  });

  const statusCounts = monitors.reduce((acc, m) => {
    const s = m.last_status || m.status || 'active';
    acc[s] = (acc[s] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <Box>
      <PageHeader
        icon={<ScheduleIcon />}
        title={
          <ArgusBreadcrumbs size="title" paths={[
            { label: t('sidebar.argusCrons', 'Cron Monitors') },
          ]} />
        }
        subtitle={t('argus.crons.subtitle', 'Manage scheduled jobs and background tasks')}
      />

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
          onClick={() => {
            setFormErrors({ name: false, schedule_value: false });
            setCreateDialogOpen(true);
          }}
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
          <EmptyPlaceholder 
            message={t('argus.crons.noMonitors', 'No cron monitors found')} 
          />
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
                const s = monitor.last_status || monitor.status || 'active';
                const statusCfg = STATUS_CONFIG[s] || STATUS_CONFIG.active;
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
                        <Typography sx={{ fontSize: '0.65rem', color: 'text.disabled' }}>
                          {monitor.slug}
                        </Typography>
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
                      <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
                        {monitor.schedule_value}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography sx={{ fontSize: '0.75rem'}}>
                        {formatRelativeTime(monitor.last_checkin_at, t)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography sx={{ fontSize: '0.75rem'}}>
                        {formatRelativeTime(monitor.next_checkin_at, t)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={t(`common.environment.${monitor.environment}`, monitor.environment)}
                        size="small"
                        sx={{ height: 18, fontSize: '0.6rem', fontWeight: 600 }}
                      />
                    </TableCell>
                    <TableCell>
                      <IconButton size="small" onClick={(e) => handleDelete(e, monitor.id)}>
                        <DeleteIcon sx={{ fontSize: 16 }} />
                      </IconButton>
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
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: '16px !important' }}>
          <TextField 
            size="small" 
            label={t('argus.crons.monitorName', 'Monitor Name')} 
            fullWidth 
            value={formData.name}
            onChange={e => {
              const name = e.target.value;
              setFormData({ ...formData, name, slug: name.toLowerCase().replace(/[^a-z0-9]/g, '-') });
              if (name.trim()) setFormErrors(p => ({ ...p, name: false }));
            }}
            error={formErrors.name}
            helperText={formErrors.name ? t('common.required', 'Required') : ''}
          />
          <TextField 
            size="small" 
            label={t('argus.crons.slug', 'Slug')} 
            fullWidth 
            value={formData.slug}
            disabled
          />
          <TextField 
            size="small" 
            label={t('argus.crons.cronExpression', 'Cron Expression')} 
            placeholder="*/5 * * * *" 
            fullWidth 
            value={formData.schedule_value}
            onChange={e => {
              setFormData({ ...formData, schedule_value: e.target.value });
              if (e.target.value.trim()) setFormErrors(p => ({ ...p, schedule_value: false }));
            }}
            error={formErrors.schedule_value}
            helperText={formErrors.schedule_value ? t('common.required', 'Required') : t('argus.crons.cronExpressionHelper', 'UTC Timezone. Next run will be calculated upon creation.')}
          />
          <FormControl size="small" fullWidth>
            <InputLabel>{t('argus.crons.environment', 'Environment')}</InputLabel>
            <Select 
              label={t('argus.crons.environment', 'Environment')} 
              value={formData.environment}
              onChange={e => setFormData({ ...formData, environment: e.target.value })}
            >
              <MenuItem value="production">{t('common.environment.production', 'Production')}</MenuItem>
              <MenuItem value="staging">{t('common.environment.staging', 'Staging')}</MenuItem>
              <MenuItem value="development">{t('common.environment.development', 'Development')}</MenuItem>
            </Select>
          </FormControl>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField 
              size="small" 
              label={t('argus.crons.checkinMargin', 'Check-in Margin (min)')} 
              type="number" 
              fullWidth 
              value={formData.checkin_margin}
              onChange={e => setFormData({ ...formData, checkin_margin: Number(e.target.value) })}
            />
            <TextField 
              size="small" 
              label={t('argus.crons.maxRuntime', 'Max Runtime (sec)')} 
              type="number" 
              fullWidth 
              value={formData.max_runtime}
              onChange={e => setFormData({ ...formData, max_runtime: Number(e.target.value) })}
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setCreateDialogOpen(false)} sx={{ textTransform: 'none' }} disabled={isSubmitting}>
            {t('common.cancel')}
          </Button>
          <Button variant="contained" onClick={handleCreate} sx={{ textTransform: 'none' }} disabled={isSubmitting}>
            {t('common.save')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ArgusCronsPage;

/**
 * ArgusCronsPage — Sentry-style Cron Monitoring.
 *
 * List view + Detail drawer with:
 *   - Checkin history table
 *   - SDK integration guide (curl examples)
 *   - Manual test checkin button
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  Chip,
  IconButton,
  Tooltip,
  alpha,
  useTheme,
  TextField,
  InputAdornment,
  Skeleton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Drawer,
  Tabs,
  Tab,
  Divider,
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
  Close as CloseIcon,
  PlayArrow as TestIcon,
  Code as CodeIcon,
  History as HistoryIcon,
  ContentCopy as CopyIcon,
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
  timezone?: string;
  failure_issue_threshold?: number;
  recovery_threshold?: number;
  is_muted?: boolean;
  created_at: string;
}

interface CronCheckin {
  id: number;
  checkin_id: string;
  status: string;
  duration: number | null;
  environment: string;
  created_at: string;
  expected_time: string | null;
}

function formatRelativeTime(isoStr: string | null, t: any): string {
  if (!isoStr) return '-';
  const diff = Date.now() - new Date(isoStr).getTime();
  const absDiff = Math.abs(diff);
  const prefix = diff < 0 ? t('common.time.in', 'in ') : '';
  const suffix = diff >= 0 ? t('common.time.ago', ' ago') : '';
  if (absDiff < 60000)
    return `${prefix}${Math.floor(absDiff / 1000)}${t('common.time.s', 's')}${suffix}`;
  if (absDiff < 3600000)
    return `${prefix}${Math.floor(absDiff / 60000)}${t('common.time.m', 'm')}${suffix}`;
  if (absDiff < 86400000)
    return `${prefix}${Math.floor(absDiff / 3600000)}${t('common.time.h', 'h')}${suffix}`;
  return `${prefix}${Math.floor(absDiff / 86400000)}${t('common.time.d', 'd')}${suffix}`;
}

function formatDateTime(isoStr: string | null): string {
  if (!isoStr) return '-';
  return new Date(isoStr).toLocaleString();
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
  const [formErrors, setFormErrors] = useState({
    name: false,
    schedule_value: false,
  });

  // Detail Drawer State
  const [selectedMonitor, setSelectedMonitor] = useState<CronMonitor | null>(
    null
  );
  const [detailTab, setDetailTab] = useState(0);
  const [checkins, setCheckins] = useState<CronCheckin[]>([]);
  const [checkinsLoading, setCheckinsLoading] = useState(false);
  const [checkinsTotal, setCheckinsTotal] = useState(0);
  const [testingSending, setTestingSending] = useState(false);

  const STATUS_CONFIG: Record<
    string,
    { color: string; icon: React.ReactElement; label: string }
  > = {
    ok: {
      color: '#4caf50',
      icon: <HealthyIcon sx={{ fontSize: 16 }} />,
      label: t('argus.crons.status.ok', 'Healthy'),
    },
    error: {
      color: '#f44336',
      icon: <ErrorIcon sx={{ fontSize: 16 }} />,
      label: t('argus.crons.status.error', 'Error'),
    },
    missed: {
      color: '#ff9800',
      icon: <WarningIcon sx={{ fontSize: 16 }} />,
      label: t('argus.crons.status.missed', 'Missed'),
    },
    timeout: {
      color: '#ff5722',
      icon: <ScheduleIcon sx={{ fontSize: 16 }} />,
      label: t('argus.crons.status.timeout', 'Timeout'),
    },
    disabled: {
      color: '#9e9e9e',
      icon: <PausedIcon sx={{ fontSize: 16 }} />,
      label: t('argus.crons.status.disabled', 'Disabled'),
    },
    active: {
      color: '#2196f3',
      icon: <HealthyIcon sx={{ fontSize: 16 }} />,
      label: t('argus.crons.status.active', 'Active'),
    },
    in_progress: {
      color: '#2196f3',
      icon: <ScheduleIcon sx={{ fontSize: 16 }} />,
      label: 'In Progress',
    },
  };

  const fetchMonitors = useCallback(async () => {
    setLoading(true);
    try {
      const data = await argusService.getCrons(projectId);
      setMonitors(data);
    } catch (error) {
      console.error('Failed to load crons', error);
      enqueueSnackbar(t('common.error', 'An error occurred'), {
        variant: 'error',
      });
    } finally {
      setLoading(false);
    }
  }, [projectId, enqueueSnackbar, t]);

  useEffect(() => {
    fetchMonitors();
  }, [fetchMonitors]);

  const fetchCheckins = useCallback(
    async (monitorId: string) => {
      setCheckinsLoading(true);
      try {
        const result = await argusService.getCronCheckins(
          projectId,
          monitorId,
          { limit: 50 }
        );
        setCheckins(result.data);
        setCheckinsTotal(result.total);
      } catch (error) {
        console.error('Failed to load checkins', error);
      } finally {
        setCheckinsLoading(false);
      }
    },
    [projectId]
  );

  const handleOpenDetail = (monitor: CronMonitor) => {
    setSelectedMonitor(monitor);
    setDetailTab(0);
    fetchCheckins(monitor.id);
  };

  const handleCloseDetail = () => {
    setSelectedMonitor(null);
    setCheckins([]);
  };

  const handleSendTestCheckin = async (status: 'ok' | 'error' = 'ok') => {
    if (!selectedMonitor) return;
    setTestingSending(true);
    try {
      await argusService.sendCronTestCheckin(
        projectId,
        selectedMonitor.id,
        status
      );
      enqueueSnackbar(t('argus.crons.testSuccess', 'Test check-in sent!'), {
        variant: 'success',
      });
      // Refresh checkins and monitors
      fetchCheckins(selectedMonitor.id);
      fetchMonitors();
    } catch (error) {
      console.error('Test checkin failed', error);
      enqueueSnackbar(
        t('argus.crons.testFailed', 'Failed to send test check-in'),
        { variant: 'error' }
      );
    } finally {
      setTestingSending(false);
    }
  };

  const handleCreate = async () => {
    const errors = {
      name: !formData.name.trim(),
      schedule_value: !formData.schedule_value.trim(),
    };
    setFormErrors(errors);
    if (errors.name || errors.schedule_value || !formData.slug) return;

    setIsSubmitting(true);
    try {
      const newMonitor = await argusService.createCron(projectId, {
        ...formData,
        schedule_type: 'crontab',
      });
      // Optimistic update
      setMonitors([newMonitor, ...monitors]);
      setCreateDialogOpen(false);
      setFormData({
        name: '',
        slug: '',
        schedule_value: '*/5 * * * *',
        environment: 'production',
        checkin_margin: 5,
        max_runtime: 300,
      });
      enqueueSnackbar(
        t('argus.crons.createSuccess', 'Monitor created successfully'),
        { variant: 'success' }
      );
    } catch (error) {
      console.error('Create failed', error);
      enqueueSnackbar(
        t('argus.crons.createFailed', 'Failed to create monitor.'),
        { variant: 'error' }
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      await argusService.deleteCron(projectId, id);
      setMonitors((prev) => prev.filter((m) => m.id !== id));
      if (selectedMonitor?.id === id) handleCloseDetail();
      enqueueSnackbar(t('common.deleteSuccess', 'Deleted successfully'), {
        variant: 'success',
      });
    } catch (error) {
      console.error('Delete failed', error);
      enqueueSnackbar(t('common.deleteFailed', 'Failed to delete'), {
        variant: 'error',
      });
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    enqueueSnackbar(t('common.copied', 'Copied!'), { variant: 'success' });
  };

  const filtered = monitors.filter((m) => {
    const s = m.last_status || m.status || 'active';
    if (statusFilter !== 'all' && s !== statusFilter) return false;
    if (
      debouncedSearch &&
      !m.name.toLowerCase().includes(debouncedSearch.toLowerCase())
    )
      return false;
    return true;
  });

  const statusCounts = monitors.reduce(
    (acc, m) => {
      const s = m.last_status || m.status || 'active';
      acc[s] = (acc[s] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  // Build the API endpoint URL for SDK guide
  const argusApiBase = `${window.location.origin}/argus/api`;

  return (
    <Box>
      <PageHeader
        icon={<ScheduleIcon />}
        title={
          <ArgusBreadcrumbs
            size="title"
            paths={[{ label: t('sidebar.argusCrons', 'Cron Monitors') }]}
          />
        }
        subtitle={t(
          'argus.crons.subtitle',
          'Manage scheduled jobs and background tasks'
        )}
      />

      {/* Status Summary */}
      <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
        {Object.entries(STATUS_CONFIG)
          .filter(([key]) => key !== 'in_progress')
          .map(([key, cfg]) => (
            <Chip
              key={key}
              icon={cfg.icon}
              label={`${cfg.label}: ${statusCounts[key] || 0}`}
              size="small"
              onClick={() =>
                setStatusFilter(statusFilter === key ? 'all' : key)
              }
              sx={{
                fontSize: '0.72rem',
                fontWeight: 600,
                borderColor: statusFilter === key ? cfg.color : 'transparent',
                backgroundColor:
                  statusFilter === key ? alpha(cfg.color, 0.1) : 'transparent',
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
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ fontSize: 18 }} />
                </InputAdornment>
              ),
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
          sx={{
            textTransform: 'none',
            borderRadius: '8px',
            fontSize: '0.78rem',
            fontWeight: 600,
          }}
        >
          {t('argus.crons.createMonitor', 'Create Monitor')}
        </Button>
      </Box>

      {/* Monitor Table */}
      <Paper
        elevation={0}
        sx={{
          border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
          borderRadius: 2,
          overflow: 'hidden',
        }}
      >
        {loading ? (
          <Box sx={{ p: 2 }}>
            {[...Array(4)].map((_, i) => (
              <Skeleton
                key={i}
                variant="rectangular"
                height={48}
                sx={{ mb: 1, borderRadius: 1 }}
              />
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
                <TableCell
                  sx={{
                    fontWeight: 700,
                    fontSize: '0.72rem',
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                  }}
                >
                  {t('argus.crons.monitor', 'Monitor')}
                </TableCell>
                <TableCell
                  sx={{
                    fontWeight: 700,
                    fontSize: '0.72rem',
                    textTransform: 'uppercase',
                  }}
                >
                  {t('argus.crons.status', 'Status')}
                </TableCell>
                <TableCell
                  sx={{
                    fontWeight: 700,
                    fontSize: '0.72rem',
                    textTransform: 'uppercase',
                  }}
                >
                  {t('argus.crons.schedule', 'Schedule')}
                </TableCell>
                <TableCell
                  sx={{
                    fontWeight: 700,
                    fontSize: '0.72rem',
                    textTransform: 'uppercase',
                  }}
                >
                  {t('argus.crons.lastCheckin', 'Last Check-in')}
                </TableCell>
                <TableCell
                  sx={{
                    fontWeight: 700,
                    fontSize: '0.72rem',
                    textTransform: 'uppercase',
                  }}
                >
                  {t('argus.crons.nextExpected', 'Next Expected')}
                </TableCell>
                <TableCell
                  sx={{
                    fontWeight: 700,
                    fontSize: '0.72rem',
                    textTransform: 'uppercase',
                  }}
                >
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
                    onClick={() => handleOpenDetail(monitor)}
                    sx={{
                      cursor: 'pointer',
                      '&:last-child td': { borderBottom: 0 },
                    }}
                  >
                    <TableCell>
                      <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                        <Typography
                          sx={{ fontSize: '0.82rem', fontWeight: 600 }}
                        >
                          {monitor.name}
                        </Typography>
                        <Typography
                          sx={{ fontSize: '0.65rem', color: 'text.disabled' }}
                        >
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
                          height: 22,
                          fontSize: '0.68rem',
                          fontWeight: 700,
                          backgroundColor: alpha(statusCfg.color, 0.1),
                          color: statusCfg.color,
                          border: 'none',
                          '& .MuiChip-icon': { color: statusCfg.color },
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography
                        sx={{ fontSize: '0.75rem', color: 'text.secondary' }}
                      >
                        {monitor.schedule_value}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography sx={{ fontSize: '0.75rem' }}>
                        {formatRelativeTime(monitor.last_checkin_at, t)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography sx={{ fontSize: '0.75rem' }}>
                        {formatRelativeTime(monitor.next_checkin_at, t)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={t(
                          `common.environment.${monitor.environment}`,
                          monitor.environment
                        )}
                        size="small"
                        sx={{ height: 18, fontSize: '0.6rem', fontWeight: 600 }}
                      />
                    </TableCell>
                    <TableCell>
                      <IconButton
                        size="small"
                        onClick={(e) => handleDelete(e, monitor.id)}
                      >
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
        <DialogContent
          sx={{
            display: 'flex',
            flexDirection: 'column',
            gap: 2.5,
            pt: '16px !important',
          }}
        >
          <TextField
            size="small"
            label={t('argus.crons.monitorName', 'Monitor Name')}
            fullWidth
            value={formData.name}
            onChange={(e) => {
              const name = e.target.value;
              setFormData({
                ...formData,
                name,
                slug: name.toLowerCase().replace(/[^a-z0-9]/g, '-'),
              });
              if (name.trim()) setFormErrors((p) => ({ ...p, name: false }));
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
            onChange={(e) => {
              setFormData({ ...formData, schedule_value: e.target.value });
              if (e.target.value.trim())
                setFormErrors((p) => ({ ...p, schedule_value: false }));
            }}
            error={formErrors.schedule_value}
            helperText={
              formErrors.schedule_value
                ? t('common.required', 'Required')
                : t(
                    'argus.crons.cronExpressionHelper',
                    'UTC Timezone. Next run will be calculated upon creation.'
                  )
            }
          />
          <FormControl size="small" fullWidth>
            <InputLabel>
              {t('argus.crons.environment', 'Environment')}
            </InputLabel>
            <Select
              label={t('argus.crons.environment', 'Environment')}
              value={formData.environment}
              onChange={(e) =>
                setFormData({ ...formData, environment: e.target.value })
              }
            >
              <MenuItem value="production">
                {t('common.environment.production', 'Production')}
              </MenuItem>
              <MenuItem value="staging">
                {t('common.environment.staging', 'Staging')}
              </MenuItem>
              <MenuItem value="development">
                {t('common.environment.development', 'Development')}
              </MenuItem>
            </Select>
          </FormControl>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField
              size="small"
              label={t('argus.crons.checkinMargin', 'Check-in Margin (min)')}
              type="number"
              fullWidth
              value={formData.checkin_margin}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  checkin_margin: Number(e.target.value),
                })
              }
            />
            <TextField
              size="small"
              label={t('argus.crons.maxRuntime', 'Max Runtime (sec)')}
              type="number"
              fullWidth
              value={formData.max_runtime}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  max_runtime: Number(e.target.value),
                })
              }
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            onClick={() => setCreateDialogOpen(false)}
            sx={{ textTransform: 'none' }}
            disabled={isSubmitting}
          >
            {t('common.cancel')}
          </Button>
          <Button
            variant="contained"
            onClick={handleCreate}
            sx={{ textTransform: 'none' }}
            disabled={isSubmitting}
          >
            {t('common.save')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Detail Drawer */}
      <Drawer
        anchor="right"
        open={!!selectedMonitor}
        onClose={handleCloseDetail}
        PaperProps={{
          sx: {
            width: { xs: '100%', sm: 560 },
            borderLeft: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
          },
        }}
      >
        {selectedMonitor && (
          <Box
            sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}
          >
            {/* Drawer Header */}
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                px: 2.5,
                py: 2,
                borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
              }}
            >
              <Box>
                <Typography sx={{ fontSize: '1rem', fontWeight: 700 }}>
                  {selectedMonitor.name}
                </Typography>
                <Typography
                  sx={{
                    fontSize: '0.72rem',
                    color: 'text.disabled',
                    fontFamily: 'monospace',
                  }}
                >
                  {selectedMonitor.slug}
                </Typography>
              </Box>
              <IconButton onClick={handleCloseDetail} size="small">
                <CloseIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Box>

            {/* Monitor Summary */}
            <Box
              sx={{
                px: 2.5,
                py: 1.5,
                display: 'flex',
                gap: 2,
                flexWrap: 'wrap',
                borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}`,
              }}
            >
              {(() => {
                const s =
                  selectedMonitor.last_status ||
                  selectedMonitor.status ||
                  'active';
                const cfg = STATUS_CONFIG[s] || STATUS_CONFIG.active;
                return (
                  <Chip
                    icon={cfg.icon}
                    label={cfg.label}
                    size="small"
                    sx={{
                      height: 22,
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      backgroundColor: alpha(cfg.color, 0.1),
                      color: cfg.color,
                      '& .MuiChip-icon': { color: cfg.color },
                    }}
                  />
                );
              })()}
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                {t('argus.crons.schedule', 'Schedule')}:{' '}
                <strong>{selectedMonitor.schedule_value}</strong>
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                {t('argus.crons.lastCheckin', 'Last')}:{' '}
                <strong>
                  {formatRelativeTime(selectedMonitor.last_checkin_at, t)}
                </strong>
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                {t('argus.crons.nextExpected', 'Next')}:{' '}
                <strong>
                  {formatRelativeTime(selectedMonitor.next_checkin_at, t)}
                </strong>
              </Typography>
            </Box>

            {/* Tabs */}
            <Tabs
              value={detailTab}
              onChange={(_, v) => setDetailTab(v)}
              sx={{
                px: 2.5,
                minHeight: 36,
                '& .MuiTab-root': {
                  minHeight: 36,
                  fontSize: '0.75rem',
                  textTransform: 'none',
                  fontWeight: 600,
                },
              }}
            >
              <Tab
                icon={<HistoryIcon sx={{ fontSize: 16 }} />}
                iconPosition="start"
                label={t('argus.crons.checkinHistory', 'Check-in History')}
              />
              <Tab
                icon={<CodeIcon sx={{ fontSize: 16 }} />}
                iconPosition="start"
                label={t('argus.crons.sdkGuide', 'SDK Guide')}
              />
            </Tabs>
            <Divider />

            {/* Tab Content */}
            <Box sx={{ flex: 1, overflow: 'auto', px: 2.5, py: 2 }}>
              {detailTab === 0 && (
                <Box>
                  {/* Test Checkin Buttons */}
                  <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                    <Button
                      variant="outlined"
                      size="small"
                      color="success"
                      startIcon={<TestIcon />}
                      onClick={() => handleSendTestCheckin('ok')}
                      disabled={testingSending}
                      sx={{
                        textTransform: 'none',
                        fontSize: '0.72rem',
                        borderRadius: '8px',
                      }}
                    >
                      {t('argus.crons.sendTestOk', 'Send OK')}
                    </Button>
                    <Button
                      variant="outlined"
                      size="small"
                      color="error"
                      startIcon={<ErrorIcon sx={{ fontSize: 14 }} />}
                      onClick={() => handleSendTestCheckin('error')}
                      disabled={testingSending}
                      sx={{
                        textTransform: 'none',
                        fontSize: '0.72rem',
                        borderRadius: '8px',
                      }}
                    >
                      {t('argus.crons.sendTestError', 'Send Error')}
                    </Button>
                    <Box sx={{ flex: 1 }} />
                    <Typography
                      variant="caption"
                      sx={{ color: 'text.disabled', alignSelf: 'center' }}
                    >
                      {checkinsTotal}{' '}
                      {t('argus.crons.totalCheckins', 'check-ins')}
                    </Typography>
                  </Box>

                  {/* Checkin History Table */}
                  {checkinsLoading ? (
                    <Box>
                      {[...Array(5)].map((_, i) => (
                        <Skeleton key={i} height={36} sx={{ mb: 0.5 }} />
                      ))}
                    </Box>
                  ) : checkins.length === 0 ? (
                    <Box
                      sx={{
                        py: 6,
                        textAlign: 'center',
                        color: 'text.disabled',
                        border: `1px dashed ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
                        borderRadius: 2,
                      }}
                    >
                      <HistoryIcon sx={{ fontSize: 40, mb: 1, opacity: 0.3 }} />
                      <Typography
                        sx={{ fontSize: '0.82rem', fontWeight: 600, mb: 0.5 }}
                      >
                        {t('argus.crons.noCheckins', 'No check-in history')}
                      </Typography>
                      <Typography sx={{ fontSize: '0.72rem' }}>
                        {t(
                          'argus.crons.noCheckinsHint',
                          'Use the SDK Guide tab to learn how to send check-ins from your application.'
                        )}
                      </Typography>
                    </Box>
                  ) : (
                    <Table
                      size="small"
                      sx={{ '& td, & th': { fontSize: '0.72rem', py: 0.75 } }}
                    >
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 700 }}>
                            {t('argus.crons.status', 'Status')}
                          </TableCell>
                          <TableCell sx={{ fontWeight: 700 }}>
                            {t('argus.crons.duration', 'Duration')}
                          </TableCell>
                          <TableCell sx={{ fontWeight: 700 }}>
                            {t('argus.crons.timestamp', 'Timestamp')}
                          </TableCell>
                          <TableCell sx={{ fontWeight: 700 }}>
                            {t('argus.crons.environment', 'Env')}
                          </TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {checkins.map((ci) => {
                          const ciCfg =
                            STATUS_CONFIG[ci.status] || STATUS_CONFIG.active;
                          return (
                            <TableRow key={ci.id}>
                              <TableCell>
                                <Chip
                                  icon={ciCfg.icon}
                                  label={ciCfg.label}
                                  size="small"
                                  sx={{
                                    height: 20,
                                    fontSize: '0.62rem',
                                    fontWeight: 700,
                                    backgroundColor: alpha(ciCfg.color, 0.1),
                                    color: ciCfg.color,
                                    '& .MuiChip-icon': {
                                      color: ciCfg.color,
                                      fontSize: 12,
                                    },
                                  }}
                                />
                              </TableCell>
                              <TableCell>
                                {ci.duration != null ? `${ci.duration}ms` : '-'}
                              </TableCell>
                              <TableCell>
                                {formatDateTime(ci.created_at)}
                              </TableCell>
                              <TableCell>{ci.environment}</TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  )}
                </Box>
              )}

              {detailTab === 1 && (
                <Box>
                  {/* SDK Integration Guide */}
                  <Typography
                    sx={{ fontSize: '0.85rem', fontWeight: 700, mb: 1.5 }}
                  >
                    {t('argus.crons.sdkGuideTitle', 'How to send check-ins')}
                  </Typography>
                  <Typography
                    sx={{
                      fontSize: '0.75rem',
                      color: 'text.secondary',
                      mb: 2,
                      lineHeight: 1.6,
                    }}
                  >
                    {t(
                      'argus.crons.sdkGuideDesc',
                      'Your cron job must send HTTP check-ins to Argus at the start and end of each execution. If no check-in arrives by the expected time, the monitor will be marked as "missed" and an issue will be created.'
                    )}
                  </Typography>

                  {/* Endpoint */}
                  <Typography
                    sx={{
                      fontSize: '0.72rem',
                      fontWeight: 600,
                      mb: 0.5,
                      color: 'text.secondary',
                      textTransform: 'uppercase',
                      letterSpacing: 0.5,
                    }}
                  >
                    Endpoint
                  </Typography>
                  <CodeBlock
                    code={`POST ${argusApiBase}/projects/${projectId}/crons/${selectedMonitor.slug}/checkin`}
                    onCopy={copyToClipboard}
                    isDark={isDark}
                  />

                  {/* Simple OK checkin */}
                  <Typography
                    sx={{
                      fontSize: '0.72rem',
                      fontWeight: 600,
                      mb: 0.5,
                      mt: 2.5,
                      color: 'text.secondary',
                      textTransform: 'uppercase',
                      letterSpacing: 0.5,
                    }}
                  >
                    {t(
                      'argus.crons.simpleCheckin',
                      '1. Simple Check-in (job completed)'
                    )}
                  </Typography>
                  <CodeBlock
                    code={`curl -X POST "${argusApiBase}/projects/${projectId}/crons/${selectedMonitor.slug}/checkin" \\
  -H "Content-Type: application/json" \\
  -d '{"status": "ok"}'`}
                    onCopy={copyToClipboard}
                    isDark={isDark}
                  />

                  {/* Wrapping a job */}
                  <Typography
                    sx={{
                      fontSize: '0.72rem',
                      fontWeight: 600,
                      mb: 0.5,
                      mt: 2.5,
                      color: 'text.secondary',
                      textTransform: 'uppercase',
                      letterSpacing: 0.5,
                    }}
                  >
                    {t(
                      'argus.crons.wrappedCheckin',
                      '2. Wrapping a job (start + finish)'
                    )}
                  </Typography>
                  <CodeBlock
                    code={`# Step 1: Mark job as in_progress (returns check_in_id)
CHECK_IN_ID=$(curl -s -X POST "${argusApiBase}/projects/${projectId}/crons/${selectedMonitor.slug}/checkin" \\
  -H "Content-Type: application/json" \\
  -d '{"status": "in_progress"}' | jq -r '.checkin_id')

# Step 2: Run your actual job
./my-backup-script.sh

# Step 3: Report result
if [ $? -eq 0 ]; then
  curl -X POST "${argusApiBase}/projects/${projectId}/crons/${selectedMonitor.slug}/checkin" \\
    -H "Content-Type: application/json" \\
    -d "{\\"status\\": \\"ok\\", \\"check_in_id\\": \\"$CHECK_IN_ID\\"}"
else
  curl -X POST "${argusApiBase}/projects/${projectId}/crons/${selectedMonitor.slug}/checkin" \\
    -H "Content-Type: application/json" \\
    -d "{\\"status\\": \\"error\\", \\"check_in_id\\": \\"$CHECK_IN_ID\\"}"
fi`}
                    onCopy={copyToClipboard}
                    isDark={isDark}
                  />

                  {/* Status values */}
                  <Typography
                    sx={{
                      fontSize: '0.72rem',
                      fontWeight: 600,
                      mb: 0.5,
                      mt: 2.5,
                      color: 'text.secondary',
                      textTransform: 'uppercase',
                      letterSpacing: 0.5,
                    }}
                  >
                    {t('argus.crons.statusValues', 'Status Values')}
                  </Typography>
                  <Box
                    sx={{
                      p: 1.5,
                      borderRadius: 1.5,
                      backgroundColor: isDark
                        ? 'rgba(255,255,255,0.03)'
                        : 'rgba(0,0,0,0.02)',
                      border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
                      fontSize: '0.72rem',
                      lineHeight: 1.8,
                    }}
                  >
                    <Box>
                      <code style={{ color: '#4caf50' }}>ok</code> —{' '}
                      {t(
                        'argus.crons.statusOkDesc',
                        'Job completed successfully'
                      )}
                    </Box>
                    <Box>
                      <code style={{ color: '#f44336' }}>error</code> —{' '}
                      {t('argus.crons.statusErrorDesc', 'Job failed')}
                    </Box>
                    <Box>
                      <code style={{ color: '#2196f3' }}>in_progress</code> —{' '}
                      {t(
                        'argus.crons.statusInProgressDesc',
                        'Job started (will timeout if no follow-up)'
                      )}
                    </Box>
                  </Box>
                </Box>
              )}
            </Box>
          </Box>
        )}
      </Drawer>
    </Box>
  );
};

/** Reusable code block with copy button */
function CodeBlock({
  code,
  onCopy,
  isDark,
}: {
  code: string;
  onCopy: (text: string) => void;
  isDark: boolean;
}) {
  return (
    <Box
      sx={{
        position: 'relative',
        p: 1.5,
        borderRadius: 1.5,
        backgroundColor: isDark ? 'rgba(0,0,0,0.4)' : '#1e1e2e',
        border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.1)'}`,
        fontFamily: '"JetBrains Mono", "Fira Code", monospace',
        fontSize: '0.68rem',
        lineHeight: 1.7,
        color: '#e0e0e0',
        overflowX: 'auto',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-all',
      }}
    >
      <IconButton
        size="small"
        onClick={() => onCopy(code)}
        sx={{
          position: 'absolute',
          top: 4,
          right: 4,
          color: 'rgba(255,255,255,0.4)',
          '&:hover': { color: 'rgba(255,255,255,0.8)' },
        }}
      >
        <CopyIcon sx={{ fontSize: 14 }} />
      </IconButton>
      {code}
    </Box>
  );
}

export default ArgusCronsPage;

/**
 * ArgusUptimePage — Sentry-style Uptime Monitoring.
 *
 * Displays HTTP endpoint monitors with uptime %, response time,
 * status history timeline, and alerting configuration.
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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  FormHelperText,
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
  Delete as DeleteIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { useSnackbar } from 'notistack';
import { useOrgProject } from '@/contexts/OrgProjectContext';
import ArgusBreadcrumbs from '@/components/argus/ArgusBreadcrumbs';
import PageHeader from '@/components/common/PageHeader';
import EmptyPlaceholder from '@/components/common/EmptyPlaceholder';
import PageContentLoader from '@/components/common/PageContentLoader';
import argusService from '@/services/argusService';

interface UptimeMonitor {
  id: string;
  name: string;
  url: string;
  method: 'GET' | 'POST' | 'HEAD';
  interval_seconds: number;
  status: 'up' | 'down' | 'degraded' | 'disabled';
  uptime_percent: string;
  avg_response_ms: number;
  environment: string;
  created_at: string;
}

const ArgusUptimePage: React.FC = () => {
  const theme = useTheme();
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const isDark = theme.palette.mode === 'dark';
  const [searchParams] = useSearchParams();
  const { currentProject } = useOrgProject();
  const projectId = searchParams.get('projectId') || currentProject?.id || '1';

  const [monitors, setMonitors] = useState<UptimeMonitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(handler);
  }, [search]);

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    url: '',
    method: 'GET',
    interval_seconds: 60,
    environment: 'production',
  });
  const [formErrors, setFormErrors] = useState({ name: false, url: false });

  const STATUS_CONFIG: Record<
    string,
    { color: string; icon: React.ReactElement; label: string }
  > = {
    up: {
      color: '#4caf50',
      icon: <UpIcon sx={{ fontSize: 16 }} />,
      label: t('argus.uptime.status.up', 'Up'),
    },
    down: {
      color: '#f44336',
      icon: <DownIcon sx={{ fontSize: 16 }} />,
      label: t('argus.uptime.status.down', 'Down'),
    },
    degraded: {
      color: '#ff9800',
      icon: <DegradedIcon sx={{ fontSize: 16 }} />,
      label: t('argus.uptime.status.degraded', 'Degraded'),
    },
    disabled: {
      color: '#9e9e9e',
      icon: <PausedIcon sx={{ fontSize: 16 }} />,
      label: t('argus.uptime.status.disabled', 'Disabled'),
    },
  };

  const fetchMonitors = useCallback(async () => {
    setLoading(true);
    try {
      const data = await argusService.getUptimes(projectId);
      setMonitors(data);
    } catch (error) {
      console.error('Failed to load uptimes', error);
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

  const handleCreate = async () => {
    const errors = {
      name: !formData.name.trim(),
      url: !formData.url.trim(),
    };
    setFormErrors(errors);
    if (errors.name || errors.url) return;

    setIsSubmitting(true);
    try {
      const newMonitor = await argusService.createUptime(projectId, formData);
      setMonitors([newMonitor, ...monitors]);
      setCreateDialogOpen(false);
      setFormData({
        name: '',
        url: '',
        method: 'GET',
        interval_seconds: 60,
        environment: 'production',
      });
      enqueueSnackbar(
        t('argus.uptime.createSuccess', 'Monitor created successfully'),
        { variant: 'success' }
      );
    } catch (error) {
      console.error('Create failed', error);
      enqueueSnackbar(
        t('argus.uptime.createFailed', 'Failed to create monitor.'),
        { variant: 'error' }
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      await argusService.deleteUptime(projectId, id);
      setMonitors((prev) => prev.filter((m) => m.id !== id));
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

  const filtered = monitors.filter((m) => {
    if (
      debouncedSearch &&
      !m.name.toLowerCase().includes(debouncedSearch.toLowerCase()) &&
      !m.url.toLowerCase().includes(debouncedSearch.toLowerCase())
    )
      return false;
    return true;
  });

  return (
    <Box>
      <PageHeader
        icon={<UrlIcon />}
        title={
          <ArgusBreadcrumbs
            size="title"
            paths={[{ label: t('sidebar.argusUptime', 'Uptime Monitors') }]}
          />
        }
        subtitle={t(
          'argus.uptime.subtitle',
          'Monitor HTTP endpoint availability and response times'
        )}
      />

      {/* Toolbar */}
      <Box sx={{ display: 'flex', gap: 1, mb: 2, alignItems: 'center' }}>
        <TextField
          size="small"
          placeholder={t(
            'argus.uptime.searchPlaceholder',
            'Search monitors...'
          )}
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
            setFormErrors({ name: false, url: false });
            setCreateDialogOpen(true);
          }}
          sx={{
            textTransform: 'none',
            borderRadius: '8px',
            fontSize: '0.78rem',
            fontWeight: 600,
          }}
        >
          {t('argus.uptime.createMonitor', 'Create Monitor')}
        </Button>
      </Box>

      {/* Monitor Cards */}
      <PageContentLoader loading={loading}>
        {filtered.length === 0 ? (
          <EmptyPlaceholder
            message={t('argus.uptime.noMonitors', 'No uptime monitors found')}
          />
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {filtered.map((monitor) => {
              const statusCfg =
                STATUS_CONFIG[monitor.status] || STATUS_CONFIG.up;
              const uptimePercent = parseFloat(monitor.uptime_percent) || 100;
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
                    '&:hover': {
                      borderColor: alpha(statusCfg.color, 0.4),
                      backgroundColor: isDark
                        ? 'rgba(255,255,255,0.02)'
                        : 'rgba(0,0,0,0.01)',
                    },
                  }}
                >
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 2,
                      mb: 1,
                    }}
                  >
                    {/* Status + Name */}
                    <Box
                      sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}
                    >
                      <Box
                        sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
                      >
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
                            '& .MuiChip-icon': { color: statusCfg.color },
                          }}
                        />
                        <Typography
                          sx={{ fontSize: '0.88rem', fontWeight: 700 }}
                        >
                          {monitor.name}
                        </Typography>
                      </Box>
                      <Typography
                        sx={{
                          fontSize: '0.72rem',
                          color: 'text.disabled',
                          mt: 0.25,
                        }}
                      >
                        {monitor.method} {monitor.url}
                      </Typography>
                    </Box>

                    {/* Metrics */}
                    <Box sx={{ display: 'flex', gap: 3, alignItems: 'center' }}>
                      <Box sx={{ textAlign: 'center' }}>
                        <Typography
                          sx={{
                            fontSize: '1.1rem',
                            fontWeight: 700,
                            color:
                              uptimePercent >= 99.9
                                ? '#4caf50'
                                : uptimePercent >= 99
                                  ? '#ff9800'
                                  : '#f44336',
                          }}
                        >
                          {uptimePercent.toFixed(2)}%
                        </Typography>
                        <Typography
                          sx={{
                            fontSize: '0.6rem',
                            color: 'text.disabled',
                            textTransform: 'uppercase',
                          }}
                        >
                          {t('argus.uptime.uptime', 'Uptime')}
                        </Typography>
                      </Box>
                      <Box sx={{ textAlign: 'center' }}>
                        <Typography
                          sx={{ fontSize: '1.1rem', fontWeight: 700 }}
                        >
                          {monitor.avg_response_ms > 0
                            ? `${monitor.avg_response_ms}ms`
                            : '-'}
                        </Typography>
                        <Typography
                          sx={{
                            fontSize: '0.6rem',
                            color: 'text.disabled',
                            textTransform: 'uppercase',
                          }}
                        >
                          {t('argus.uptime.avgResponse', 'Avg Response')}
                        </Typography>
                      </Box>
                      <Chip
                        label={t(
                          `common.environment.${monitor.environment}`,
                          monitor.environment
                        )}
                        size="small"
                        sx={{ height: 18, fontSize: '0.6rem', fontWeight: 600 }}
                      />
                      <IconButton
                        size="small"
                        onClick={(e) => handleDelete(e, monitor.id)}
                      >
                        <DeleteIcon sx={{ fontSize: 16 }} />
                      </IconButton>
                    </Box>
                  </Box>
                </Paper>
              );
            })}
          </Box>
        )}
      </PageContentLoader>

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
            label={t('argus.uptime.monitorName', 'Monitor Name')}
            fullWidth
            value={formData.name}
            onChange={(e) => {
              setFormData({ ...formData, name: e.target.value });
              if (e.target.value.trim())
                setFormErrors((p) => ({ ...p, name: false }));
            }}
            error={formErrors.name}
            helperText={formErrors.name ? t('common.required', 'Required') : ''}
          />
          <TextField
            size="small"
            label={t('argus.uptime.url', 'URL')}
            placeholder={t(
              'argus.uptime.urlPlaceholder',
              'https://example.com/health'
            )}
            fullWidth
            value={formData.url}
            onChange={(e) => {
              setFormData({ ...formData, url: e.target.value });
              if (e.target.value.trim())
                setFormErrors((p) => ({ ...p, url: false }));
            }}
            error={formErrors.url}
            helperText={formErrors.url ? t('common.required', 'Required') : ''}
          />
          <Box sx={{ display: 'flex', gap: 2 }}>
            <FormControl size="small" sx={{ flex: 1 }}>
              <InputLabel>{t('argus.uptime.method', 'Method')}</InputLabel>
              <Select
                label={t('argus.uptime.method', 'Method')}
                value={formData.method}
                onChange={(e) =>
                  setFormData({ ...formData, method: e.target.value as any })
                }
              >
                <MenuItem value="GET">GET</MenuItem>
                <MenuItem value="HEAD">HEAD</MenuItem>
                <MenuItem value="POST">POST</MenuItem>
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ flex: 1 }}>
              <InputLabel>
                {t('argus.uptime.interval', 'Check Interval')}
              </InputLabel>
              <Select
                label={t('argus.uptime.interval', 'Check Interval')}
                value={formData.interval_seconds}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    interval_seconds: Number(e.target.value),
                  })
                }
              >
                <MenuItem value={10}>{t('common.time.10s', '10s')}</MenuItem>
                <MenuItem value={30}>{t('common.time.30s', '30s')}</MenuItem>
                <MenuItem value={60}>{t('common.time.1m', '1m')}</MenuItem>
                <MenuItem value={300}>{t('common.time.5m', '5m')}</MenuItem>
                <MenuItem value={600}>{t('common.time.10m', '10m')}</MenuItem>
              </Select>
            </FormControl>
          </Box>
          <FormControl size="small" fullWidth>
            <InputLabel>
              {t('argus.uptime.environment', 'Environment')}
            </InputLabel>
            <Select
              label={t('argus.uptime.environment', 'Environment')}
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
    </Box>
  );
};

export default ArgusUptimePage;

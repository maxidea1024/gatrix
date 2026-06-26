import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  useTheme,
  Paper,
  Button,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  TableContainer,
  Chip,
  Tooltip,
  CircularProgress,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  PlayArrow as CheckIcon,
  NotificationsActive as AlertIcon,
  CheckCircle as OkIcon,
  Warning as TriggeredIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import PageHeader from '@/components/common/PageHeader';
import ArgusBreadcrumbs from '@/components/argus/ArgusBreadcrumbs';
import PageContentLoader from '@/components/common/PageContentLoader';
import EmptyPagePlaceholder from '@/components/common/EmptyPagePlaceholder';
import { useOrgProject } from '@/contexts/OrgProjectContext';
import {
  getKpiAlerts,
  createKpiAlert,
  deleteKpiAlert,
  checkKpiAlert,
  getAnalyticsEventNames,
  type KpiAlert,
  type KpiAlertMetricConfig,
} from '@/services/argus/argusAnalytics';
import type { AnalyticsEventNameEntry } from '@/services/argus/argusTypes';

// ─── Create Dialog ───────────────────────────────────────────────────────────

interface CreateDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: any) => Promise<void>;
  eventNames: AnalyticsEventNameEntry[];
}

const CreateDialog: React.FC<CreateDialogProps> = ({
  open,
  onClose,
  onSave,
  eventNames,
}) => {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [metricType, setMetricType] =
    useState<KpiAlertMetricConfig['type']>('event_count');
  const [eventName, setEventName] = useState('');
  const [intervalSec, setIntervalSec] = useState(86400);
  const [operator, setOperator] = useState<
    'less_than' | 'greater_than' | 'equals'
  >('less_than');
  const [threshold, setThreshold] = useState(100);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setName('');
      setMetricType('event_count');
      setEventName('');
      setIntervalSec(86400);
      setOperator('less_than');
      setThreshold(100);
    }
  }, [open]);

  const needsEvent =
    metricType === 'event_count' || metricType === 'unique_users';

  const handleSave = async () => {
    if (!name) return;
    setSaving(true);
    try {
      await onSave({
        name,
        metric_config: {
          type: metricType,
          event_name: needsEvent ? eventName : undefined,
          interval_seconds: intervalSec,
        },
        operator,
        threshold,
        check_interval: intervalSec,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const METRIC_TYPES = [
    { value: 'event_count', label: t('argus.kpiAlerts.eventCount') },
    { value: 'unique_users', label: t('argus.kpiAlerts.uniqueUsers') },
    { value: 'dau', label: t('argus.kpiAlerts.dau') },
    { value: 'revenue', label: t('argus.kpiAlerts.revenue') },
  ] as const;

  const OPERATORS = [
    { value: 'less_than', label: `< (${t('argus.kpiAlerts.lessThan')})` },
    { value: 'greater_than', label: `> (${t('argus.kpiAlerts.greaterThan')})` },
    { value: 'equals', label: `= (${t('argus.kpiAlerts.equals')})` },
  ] as const;

  const INTERVALS = [
    { value: 3600, label: t('argus.kpiAlerts.1hour') },
    { value: 21600, label: t('argus.kpiAlerts.6hours') },
    { value: 86400, label: t('argus.kpiAlerts.24hours') },
    { value: 604800, label: t('argus.kpiAlerts.7days') },
  ] as const;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>
        {t('argus.kpiAlerts.createAlert')}
      </DialogTitle>
      <DialogContent dividers>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            label={t('argus.kpiAlerts.name')}
            value={name}
            onChange={(e) => setName(e.target.value)}
            fullWidth
            size="small"
            required
          />
          <FormControl size="small" fullWidth>
            <InputLabel>{t('argus.kpiAlerts.metricType')}</InputLabel>
            <Select
              value={metricType}
              label={t('argus.kpiAlerts.metricType')}
              onChange={(e) => setMetricType(e.target.value as any)}
            >
              {METRIC_TYPES.map((m) => (
                <MenuItem key={m.value} value={m.value}>
                  {m.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          {needsEvent && (
            <FormControl size="small" fullWidth>
              <InputLabel>{t('argus.impact.causeEvent')}</InputLabel>
              <Select
                value={eventName}
                label={t('argus.impact.causeEvent')}
                onChange={(e) => setEventName(e.target.value)}
              >
                {eventNames.map((en) => (
                  <MenuItem key={en.name} value={en.name}>
                    {en.display_name || en.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
          <Box sx={{ display: 'flex', gap: 1.5 }}>
            <FormControl size="small" sx={{ flex: 1 }}>
              <InputLabel>{t('argus.kpiAlerts.operator')}</InputLabel>
              <Select
                value={operator}
                label={t('argus.kpiAlerts.operator')}
                onChange={(e) => setOperator(e.target.value as any)}
              >
                {OPERATORS.map((o) => (
                  <MenuItem key={o.value} value={o.value}>
                    {o.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label={t('argus.kpiAlerts.threshold')}
              type="number"
              size="small"
              value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value))}
              sx={{ flex: 1 }}
            />
          </Box>
          <FormControl size="small" fullWidth>
            <InputLabel>{t('argus.kpiAlerts.checkInterval')}</InputLabel>
            <Select
              value={intervalSec}
              label={t('argus.kpiAlerts.checkInterval')}
              onChange={(e) => setIntervalSec(Number(e.target.value))}
            >
              {INTERVALS.map((i) => (
                <MenuItem key={i.value} value={i.value}>
                  {i.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} color="inherit">
          {t('argus.kpiAlerts.cancel')}
        </Button>
        <Button
          onClick={handleSave}
          variant="contained"
          disabled={!name || saving}
          startIcon={saving ? <CircularProgress size={16} /> : undefined}
        >
          {t('argus.kpiAlerts.create')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────

const ArgusKpiAlertsPage: React.FC = () => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const { t } = useTranslation();
  const { currentProject } = useOrgProject();
  const projectId = String(currentProject?.id || '1');

  const [alerts, setAlerts] = useState<KpiAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [eventNames, setEventNames] = useState<AnalyticsEventNameEntry[]>([]);
  const [checkingId, setCheckingId] = useState<number | null>(null);

  const loadAlerts = useCallback(async () => {
    setLoading(true);
    try {
      setAlerts(await getKpiAlerts(projectId));
    } catch {
      setAlerts([]);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadAlerts();
    getAnalyticsEventNames(projectId)
      .then(setEventNames)
      .catch(() => {});
  }, [loadAlerts, projectId]);

  const handleCreate = async (data: any) => {
    await createKpiAlert(projectId, data);
    await loadAlerts();
  };
  const handleDelete = async (id: number) => {
    await deleteKpiAlert(projectId, id);
    await loadAlerts();
  };
  const handleCheck = async (id: number) => {
    setCheckingId(id);
    try {
      await checkKpiAlert(projectId, id);
      await loadAlerts();
    } finally {
      setCheckingId(null);
    }
  };

  const metricLabel = (type: string) => {
    const map: Record<string, string> = {
      event_count: t('argus.kpiAlerts.eventCount'),
      unique_users: t('argus.kpiAlerts.uniqueUsers'),
      dau: t('argus.kpiAlerts.dau'),
      revenue: t('argus.kpiAlerts.revenue'),
    };
    return map[type] || type;
  };

  const operatorLabel = (op: string) => {
    const map: Record<string, string> = {
      less_than: t('argus.kpiAlerts.lessThan'),
      greater_than: t('argus.kpiAlerts.greaterThan'),
      equals: t('argus.kpiAlerts.equals'),
    };
    return map[op] || op;
  };

  return (
    <Box>
      <PageHeader
        title={
          <ArgusBreadcrumbs
            paths={[
              {
                label: t('argus.analytics.title', 'Analytics'),
                to: '/argus/analytics',
              },
              { label: t('argus.kpiAlerts') },
            ]}
            size="title"
          />
        }
        subtitle={t('argus.kpiAlerts.subtitle')}
        actions={
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setDialogOpen(true)}
            size="small"
          >
            {t('argus.kpiAlerts.createAlert')}
          </Button>
        }
      />

      <PageContentLoader loading={loading}>
        {alerts.length === 0 ? (
          <EmptyPagePlaceholder
            icon={<AlertIcon sx={{ fontSize: 48 }} />}
            message={t('argus.kpiAlerts.noAlerts')}
            subtitle={t('argus.kpiAlerts.noAlertsDesc')}
            onAddClick={() => setDialogOpen(true)}
            addButtonLabel={t('argus.kpiAlerts.createAlert')}
          />
        ) : (
          <TableContainer
            component={Paper}
            variant="outlined"
            sx={{
              borderRadius: 2,
              bgcolor: isDark ? 'rgba(255,255,255,0.02)' : '#fff',
            }}
          >
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700 }}>
                    {t('argus.kpiAlerts.name')}
                  </TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>
                    {t('argus.kpiAlerts.metric')}
                  </TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>
                    {t('argus.kpiAlerts.condition')}
                  </TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>
                    {t('argus.kpiAlerts.status')}
                  </TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>
                    {t('argus.kpiAlerts.lastValue')}
                  </TableCell>
                  <TableCell sx={{ fontWeight: 700 }} align="right">
                    {t('argus.kpiAlerts.actions')}
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {alerts.map((alert) => (
                  <TableRow key={alert.id} hover>
                    <TableCell>
                      <Typography variant="body2" fontWeight={600}>
                        {alert.name}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={metricLabel(alert.metric_config.type)}
                        size="small"
                        sx={{ fontSize: 11, height: 22 }}
                      />
                      {alert.metric_config.event_name && (
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{ ml: 0.5 }}
                        >
                          {alert.metric_config.event_name}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontFamily="monospace">
                        {operatorLabel(alert.operator)}{' '}
                        {alert.threshold.toLocaleString()}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {alert.status === 'triggered' ? (
                        <Chip
                          icon={<TriggeredIcon />}
                          label={t('argus.kpiAlerts.triggered')}
                          size="small"
                          color="error"
                          sx={{ fontSize: 11, height: 24 }}
                        />
                      ) : (
                        <Chip
                          icon={<OkIcon />}
                          label={t('argus.kpiAlerts.ok')}
                          size="small"
                          color="success"
                          variant="outlined"
                          sx={{ fontSize: 11, height: 24 }}
                        />
                      )}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight={600}>
                        {alert.last_value != null
                          ? alert.last_value.toLocaleString()
                          : '—'}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title={t('argus.kpiAlerts.checkNow')}>
                        <IconButton
                          size="small"
                          onClick={() => handleCheck(alert.id)}
                          disabled={checkingId === alert.id}
                        >
                          {checkingId === alert.id ? (
                            <CircularProgress size={16} />
                          ) : (
                            <CheckIcon fontSize="small" />
                          )}
                        </IconButton>
                      </Tooltip>
                      <Tooltip title={t('argus.kpiAlerts.delete')}>
                        <IconButton
                          size="small"
                          onClick={() => handleDelete(alert.id)}
                          color="error"
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </PageContentLoader>

      <CreateDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSave={handleCreate}
        eventNames={eventNames}
      />
    </Box>
  );
};

export default ArgusKpiAlertsPage;

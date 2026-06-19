import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Typography,
  IconButton,
  Box,
  CircularProgress,
  Divider,
  alpha,
  useTheme,
} from '@mui/material';
import {
  Close as CloseIcon,
  Dashboard as DashboardIcon,
  Add as AddIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import argusService from '@/services/argusService';
import type { WidgetConfig } from '../DashboardWidgetCard';

type AnalyticsType = 'insights' | 'funnels' | 'retention' | 'flows';

export interface AddToDashboardDialogProps {
  open: boolean;
  onClose: () => void;
  projectId: string | number;
  /** Analytics tab type */
  analyticsType: AnalyticsType;
  /** Current query config from store (serialized) */
  analyticsConfig: Record<string, any>;
  /** Default widget title */
  defaultTitle?: string;
  /** Callback after successfully adding */
  onAdded?: () => void;
}

const WIDGET_TYPES: { value: WidgetConfig['type']; label: string }[] = [
  { value: 'line', label: 'Line Chart' },
  { value: 'bar', label: 'Bar Chart' },
  { value: 'number', label: 'Big Number' },
  { value: 'table', label: 'Table' },
];

const AddToDashboardDialog: React.FC<AddToDashboardDialogProps> = ({
  open,
  onClose,
  projectId,
  analyticsType,
  analyticsConfig,
  defaultTitle = '',
  onAdded,
}) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const [dashboards, setDashboards] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form state
  const [selectedDashboardId, setSelectedDashboardId] = useState<
    number | 'new'
  >('new');
  const [newDashboardTitle, setNewDashboardTitle] = useState('');
  const [widgetTitle, setWidgetTitle] = useState(defaultTitle);
  const [widgetType, setWidgetType] = useState<WidgetConfig['type']>('line');

  // Load dashboards on open
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setWidgetTitle(defaultTitle);
    argusService
      .listDashboards(projectId)
      .then((data) => {
        setDashboards(data || []);
        if (data && data.length > 0) {
          setSelectedDashboardId(data[0].id);
        } else {
          setSelectedDashboardId('new');
        }
      })
      .catch(() => setDashboards([]))
      .finally(() => setLoading(false));
  }, [open, projectId, defaultTitle]);

  const handleAdd = async () => {
    setSaving(true);
    try {
      let dashboardId: number;

      if (selectedDashboardId === 'new') {
        const title = newDashboardTitle.trim() || 'Analytics Dashboard';
        const result = await argusService.createDashboard(projectId, {
          title,
        });
        dashboardId = result.id;
      } else {
        dashboardId = selectedDashboardId;
      }

      // Get current dashboard to append widget
      const dashboard = await argusService.getDashboard(
        projectId,
        dashboardId
      );
      const existingWidgets: WidgetConfig[] =
        typeof dashboard.widgets_config === 'string'
          ? JSON.parse(dashboard.widgets_config)
          : dashboard.widgets_config || [];

      // Calculate next Y position
      const maxY = existingWidgets.reduce(
        (max, w) => Math.max(max, (w.layout?.y || 0) + (w.layout?.h || 3)),
        0
      );

      const newWidget: WidgetConfig = {
        id: `w-analytics-${Date.now()}`,
        title: widgetTitle.trim() || `${analyticsType} widget`,
        type: widgetType,
        query: {
          fields: [],
          analytics_type: analyticsType,
          analytics_config: analyticsConfig,
          period: analyticsConfig.period || '14d',
        },
        layout: { x: 0, y: maxY, w: 6, h: 4 },
      };

      await argusService.updateDashboard(projectId, dashboardId, {
        widgets_config: [...existingWidgets, newWidget],
      });

      onAdded?.();
      onClose();
    } catch (err) {
      console.error('Failed to add widget to dashboard:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      PaperProps={{ sx: { borderRadius: 2 } }}
    >
      <DialogTitle
        sx={{
          fontWeight: 700,
          fontSize: '0.95rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          pb: 1,
        }}
      >
        {t('argus.analytics.addToDashboard', 'Add to Dashboard')}
        <IconButton size="small" onClick={onClose}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        {loading ? (
          <Box sx={{ py: 3, textAlign: 'center' }}>
            <CircularProgress size={24} />
          </Box>
        ) : (
          <>
            {/* Widget Title */}
            <TextField
              autoFocus
              fullWidth
              size="small"
              label={t('argus.analytics.widgetTitle', 'Widget Title')}
              value={widgetTitle}
              onChange={(e) => setWidgetTitle(e.target.value)}
              sx={{ mt: 1, mb: 2 }}
            />

            {/* Widget Type */}
            <FormControl fullWidth size="small" sx={{ mb: 2 }}>
              <InputLabel>
                {t('argus.analytics.widgetType', 'Widget Type')}
              </InputLabel>
              <Select
                value={widgetType}
                label={t('argus.analytics.widgetType', 'Widget Type')}
                onChange={(e) =>
                  setWidgetType(e.target.value as WidgetConfig['type'])
                }
              >
                {WIDGET_TYPES.map((wt) => (
                  <MenuItem key={wt.value} value={wt.value}>
                    {wt.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <Divider sx={{ my: 1.5 }} />

            {/* Dashboard Selection */}
            <Typography
              variant="caption"
              fontWeight={700}
              sx={{ mb: 1, display: 'block', color: 'text.secondary' }}
            >
              {t('argus.analytics.selectDashboard', 'Select Dashboard')}
            </Typography>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
              {/* Create new option */}
              <Box
                onClick={() => setSelectedDashboardId('new')}
                sx={{
                  px: 1.5,
                  py: 1,
                  borderRadius: 1.5,
                  cursor: 'pointer',
                  border: `1.5px solid ${selectedDashboardId === 'new' ? theme.palette.primary.main : 'transparent'}`,
                  backgroundColor:
                    selectedDashboardId === 'new'
                      ? alpha(theme.palette.primary.main, 0.06)
                      : 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  transition: 'all 0.15s',
                  '&:hover': {
                    backgroundColor: alpha(theme.palette.primary.main, 0.04),
                  },
                }}
              >
                <AddIcon
                  sx={{ fontSize: 18, color: theme.palette.primary.main }}
                />
                <Typography variant="body2" fontWeight={600} fontSize="0.82rem">
                  {t(
                    'argus.analytics.createNewDashboard',
                    'Create New Dashboard'
                  )}
                </Typography>
              </Box>

              {selectedDashboardId === 'new' && (
                <TextField
                  fullWidth
                  size="small"
                  placeholder="Dashboard name"
                  value={newDashboardTitle}
                  onChange={(e) => setNewDashboardTitle(e.target.value)}
                  sx={{ ml: 4, width: 'calc(100% - 32px)', mt: 0.5 }}
                />
              )}

              {/* Existing dashboards */}
              {dashboards.map((db: any) => (
                <Box
                  key={db.id}
                  onClick={() => setSelectedDashboardId(db.id)}
                  sx={{
                    px: 1.5,
                    py: 1,
                    borderRadius: 1.5,
                    cursor: 'pointer',
                    border: `1.5px solid ${selectedDashboardId === db.id ? theme.palette.primary.main : 'transparent'}`,
                    backgroundColor:
                      selectedDashboardId === db.id
                        ? alpha(theme.palette.primary.main, 0.06)
                        : 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    transition: 'all 0.15s',
                    '&:hover': {
                      backgroundColor: isDark
                        ? 'rgba(255,255,255,0.03)'
                        : 'rgba(0,0,0,0.02)',
                    },
                  }}
                >
                  <DashboardIcon sx={{ fontSize: 18, color: 'text.disabled' }} />
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography
                      variant="body2"
                      fontWeight={600}
                      fontSize="0.82rem"
                      noWrap
                    >
                      {db.title}
                    </Typography>
                    {db.description && (
                      <Typography
                        variant="caption"
                        sx={{
                          color: 'text.disabled',
                          fontSize: '0.68rem',
                          display: 'block',
                        }}
                        noWrap
                      >
                        {db.description}
                      </Typography>
                    )}
                  </Box>
                </Box>
              ))}
            </Box>
          </>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button
          onClick={onClose}
          sx={{ textTransform: 'none', fontSize: '0.82rem' }}
        >
          {t('common.cancel', 'Cancel')}
        </Button>
        <Button
          onClick={handleAdd}
          variant="contained"
          disabled={saving || loading}
          sx={{ textTransform: 'none', fontWeight: 700, fontSize: '0.82rem' }}
        >
          {saving ? '...' : t('common.add', 'Add')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AddToDashboardDialog;

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useSnackbar } from 'notistack';
import {
  Box,
  Typography,
  Paper,
  Button,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  TextField,
  useTheme,
  alpha,
  CircularProgress,
  Card,
  CardContent,
  CardActions,
  Grid,
  Chip,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Collapse,
  Menu,
  ListItemIcon,
  ListItemText,
  Divider,
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Save as SaveIcon,
  Close as CloseIcon,
  Widgets as WidgetIcon,
  AutoAwesome as PresetIcon,
  MoreVert as MoreIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  StarBorder as StarBorderIcon,
  Star as StarIcon,
  BarChart as BarChartIcon,
  ShowChart as LineChartIcon,
  PieChart as PieChartIcon,
  Numbers as NumberIcon,
  TableChart as TableIcon,
  AreaChart as AreaChartIcon,
  Share as ShareIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { Responsive, WidthProvider, Layout } from 'react-grid-layout';
import argusService from '@/services/argusService';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import { useOrgProject } from '@/contexts/OrgProjectContext';
import PageHeader from '@/components/common/PageHeader';
import ArgusBreadcrumbs from '@/components/argus/ArgusBreadcrumbs';
import EmptyPlaceholder from '@/components/common/EmptyPlaceholder';
import {
  WidgetCard,
  type WidgetConfig,
  type DashboardData,
  type PresetSummary,
} from './components/DashboardWidgetCard';
import WidgetEditorDrawer from './components/WidgetEditorDrawer';
import WidgetCatalog from './components/WidgetCatalog';
import DashboardShareDialog from './components/DashboardShareDialog';
import type { WidgetType } from './components/renderers/widgetTypes';

const ResponsiveGridLayout = WidthProvider(Responsive);

const ArgusDashboardsPage: React.FC = () => {
  const theme = useTheme();
  const { t } = useTranslation();
  const isDark = theme.palette.mode === 'dark';
  const { currentProject } = useOrgProject();
  const projectId = currentProject?.id || '1';
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const { dashboardId: urlDashboardId } = useParams<{ dashboardId?: string }>();

  // ─── State ───
  const [dashboards, setDashboards] = useState<DashboardData[]>([]);
  const [presets, setPresets] = useState<PresetSummary[]>([]);
  const [activeDashboard, setActiveDashboard] = useState<DashboardData | null>(
    null
  );
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [widgetData, setWidgetData] = useState<Record<string, any[]>>({});
  const [widgetLoading, setWidgetLoading] = useState<Record<string, boolean>>(
    {}
  );

  // Dialog state
  const [createOpen, setCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [selectedPreset, setSelectedPreset] = useState('');

  // Delete confirmation
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deletingDashboard, setDeletingDashboard] = useState<DashboardData | null>(null);

  // Card context menu
  const [cardMenuAnchor, setCardMenuAnchor] = useState<HTMLElement | null>(null);
  const [cardMenuDashboard, setCardMenuDashboard] = useState<DashboardData | null>(null);

  // Templates collapse (default expanded)
  const [templatesExpanded, setTemplatesExpanded] = useState(true);

  // Widget editor
  const [widgetEditorOpen, setWidgetEditorOpen] = useState(false);
  const [editingWidget, setEditingWidget] = useState<WidgetConfig | null>(null);

  // Share dialog
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [sharingDashboard, setSharingDashboard] = useState<DashboardData | null>(null);

  // Widget types catalog is now inside WidgetEditorDrawer

  // ─── Load Data ───
  useEffect(() => {
    Promise.all([
      argusService.listDashboards(projectId),
      argusService.listDashboardPresets(projectId),
    ])
      .then(([dbData, presetData]) => {
        setDashboards(dbData);
        setPresets(presetData);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load dashboards:', err);
        setLoading(false);
      });
  }, [projectId]);

  // Auto-load dashboard from URL param
  useEffect(() => {
    if (urlDashboardId && dashboards.length > 0) {
      const found = dashboards.find((d: any) => String(d.id) === urlDashboardId);
      if (found) {
        argusService.getDashboard(projectId, (found as any).id).then((full) => {
          if (full) setActiveDashboard(full);
        });
      }
    } else if (!urlDashboardId) {
      setActiveDashboard(null);
    }
  }, [urlDashboardId, dashboards, projectId]);

  // ─── Execute Widget Queries ───
  const fetchWidgetData = useCallback(
    async (widgets: WidgetConfig[]) => {
      const loadingState: Record<string, boolean> = {};
      widgets.forEach((w) => {
        loadingState[w.id] = true;
      });
      setWidgetLoading(loadingState);

      const results: Record<string, any[]> = {};
      await Promise.allSettled(
        widgets.map(async (w) => {
          try {
            const raw: any = await argusService.queryDashboardWidget(
              projectId,
              w.query
            );

            // Analytics widgets return { series: [...] } instead of flat rows
            if (w.query.analytics_type && raw && !Array.isArray(raw) && raw.series) {
              // Transform series into flat chart-friendly rows
              const flatData: any[] = [];
              for (const s of raw.series) {
                if (Array.isArray(s.data)) {
                  for (const point of s.data) {
                    flatData.push({
                      hour: point.bucket,
                      count: Number(point.value),
                      event: s.event || s.breakdown_value || '',
                    });
                  }
                }
              }
              results[w.id] = flatData.length > 0 ? flatData : [{ count: raw.series.reduce((s: number, sr: any) => s + (sr.data?.reduce((a: number, p: any) => a + Number(p.value), 0) || 0), 0) }];
            } else {
              results[w.id] = Array.isArray(raw) ? raw : [];
            }
          } catch {
            results[w.id] = [];
          }
        })
      );
      setWidgetData(results);
      setWidgetLoading({});
    },
    [projectId]
  );

  useEffect(() => {
    if (activeDashboard?.widgets_config?.length) {
      fetchWidgetData(activeDashboard.widgets_config);
    }
  }, [activeDashboard, fetchWidgetData]);

  // Warn on browser navigation with unsaved changes
  useEffect(() => {
    if (!isEditing) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isEditing]);

  // ─── Handlers ───
  const handleCreateDashboard = async () => {
    if (!newTitle.trim()) return;
    try {
      const data = await argusService.createDashboard(projectId, {
        title: newTitle,
        description: newDesc,
        ...(selectedPreset ? { preset_id: selectedPreset } : {}),
      });
      if (data) {
        setDashboards((prev) => [...prev, data]);
        setActiveDashboard(data);
        navigate(`/argus/dashboards/${data.id}`);
        setCreateOpen(false);
        setNewTitle('');
        setNewDesc('');
        setSelectedPreset('');
        enqueueSnackbar(t('argus.dashboards.createSuccess', 'Dashboard created'), { variant: 'success' });
      }
    } catch (err) {
      console.error(err);
      enqueueSnackbar(t('argus.dashboards.createFailed', 'Failed to create dashboard'), { variant: 'error' });
    }
  };

  const handleDeleteDashboard = async (id: number) => {
    try {
      await argusService.deleteDashboard(projectId, id);
      setDashboards((prev) => prev.filter((d) => (d as any).id !== id));
      if (activeDashboard && (activeDashboard as any).id === id) {
        setActiveDashboard(null);
        navigate('/argus/dashboards');
      }
      enqueueSnackbar(t('argus.dashboards.deleteSuccess', 'Dashboard deleted'), { variant: 'success' });
    } catch (err) {
      console.error(err);
      enqueueSnackbar(t('argus.dashboards.deleteFailed', 'Failed to delete dashboard'), { variant: 'error' });
    }
  };

  const handleSaveDashboard = async () => {
    if (!activeDashboard?.id) return;
    try {
      await argusService.updateDashboard(projectId, activeDashboard.id, {
        widgets_config: activeDashboard.widgets_config,
      });
      setIsEditing(false);
      enqueueSnackbar(t('argus.dashboards.saveSuccess', 'Dashboard saved'), { variant: 'success' });
    } catch (err) {
      console.error(err);
      enqueueSnackbar(t('argus.dashboards.saveFailed', 'Failed to save dashboard'), { variant: 'error' });
    }
  };

  const handleLayoutChange = (layout: Layout[]) => {
    if (!isEditing || !activeDashboard) return;
    const updated = { ...activeDashboard };
    updated.widgets_config = updated.widgets_config.map((w) => {
      const l = layout.find((item) => item.i === w.id);
      if (l) return { ...w, layout: { x: l.x, y: l.y, w: l.w, h: l.h } };
      return w;
    });
    setActiveDashboard(updated);
  };

  const handleAddWidget = () => {
    const newWidget: WidgetConfig = {
      id: `w-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title: t('argus.dashboards.newWidget', 'New Widget'),
      type: 'time-series',
      chart_style: 'line',
      query: { fields: ['count()'], period: '24h' },
      layout: { x: 0, y: 100, w: 4, h: 3 },
    };
    setEditingWidget(newWidget);
    setWidgetEditorOpen(true);
  };

  const handleAddWidgetWithType = (type: WidgetType) => {
    const newWidget: WidgetConfig = {
      id: `w-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title: t('argus.dashboards.newWidget', 'New Widget'),
      type,
      chart_style: type === 'time-series' ? 'line' : undefined,
      query: { fields: ['count()'], period: '24h' },
      layout: { x: 0, y: 100, w: 4, h: 3 },
    };
    setEditingWidget(newWidget);
    setWidgetEditorOpen(true);
  };

  const handleSaveWidget = (savedWidget: WidgetConfig) => {
    if (!savedWidget || !activeDashboard) return;
    const existing = activeDashboard.widgets_config.find(
      (w) => w.id === savedWidget.id
    );
    let updated: WidgetConfig[];
    if (existing) {
      updated = activeDashboard.widgets_config.map((w) =>
        w.id === savedWidget.id ? savedWidget : w
      );
    } else {
      updated = [...activeDashboard.widgets_config, savedWidget];
    }
    setActiveDashboard({ ...activeDashboard, widgets_config: updated });
    setWidgetEditorOpen(false);
    setEditingWidget(null);
  };

  const handleDeleteWidget = (widgetId: string) => {
    if (!activeDashboard) return;
    setActiveDashboard({
      ...activeDashboard,
      widgets_config: activeDashboard.widgets_config.filter(
        (w) => w.id !== widgetId
      ),
    });
  };

  const handleDuplicateWidget = (widget: WidgetConfig) => {
    if (!activeDashboard) return;
    const dup: WidgetConfig = {
      ...widget,
      id: `w-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title: `${widget.title} ${t('argus.dashboards.copySuffix', '(copy)')}`,
      layout: { ...widget.layout, y: widget.layout.y + widget.layout.h },
    };
    setActiveDashboard({
      ...activeDashboard,
      widgets_config: [...activeDashboard.widgets_config, dup],
    });
  };

  const gridLayout = useMemo(() => {
    if (!activeDashboard) return [];
    return activeDashboard.widgets_config.map((w) => ({
      i: w.id,
      x: w.layout.x,
      y: w.layout.y,
      w: w.layout.w,
      h: w.layout.h,
      minW: 2,
      minH: 2,
    }));
  }, [activeDashboard]);

  // ─── Favorite toggle ───
  const handleToggleFavorite = async (db: any, e: React.MouseEvent) => {
    e.stopPropagation();
    const newVal = !db.is_favorite;
    try {
      await argusService.toggleDashboardFavorite(projectId, db.id, newVal);
      setDashboards((prev) =>
        prev
          .map((d: any) =>
            d.id === db.id ? { ...d, is_favorite: newVal ? 1 : 0 } : d
          )
          .sort((a: any, b: any) => {
            if ((b.is_favorite || 0) !== (a.is_favorite || 0))
              return (b.is_favorite || 0) - (a.is_favorite || 0);
            return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
          })
      );
    } catch (err) {
      console.error('Failed to toggle favorite:', err);
    }
  };

  /* ═══ RENDER ═══ */

  // Dashboard list view
  if (!activeDashboard) {
    return (
      <Box>
        {/* Header */}
        <PageHeader
          icon={<DashboardIcon />}
          title={
            <ArgusBreadcrumbs
              size="title"
              paths={[{ label: t('argus.dashboards.title', 'Dashboards') }]}
            />
          }
          actions={
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setCreateOpen(true)}
              sx={{
                textTransform: 'none',
                fontWeight: 600,
              }}
            >
              {t('argus.dashboards.create', 'Create Dashboard')}
            </Button>
          }
        />

        {loading ? (
          <Box sx={{ py: 8, textAlign: 'center' }}>
            <CircularProgress />
          </Box>
        ) : (
          <>
            {/* Custom Dashboards (shown first for accessibility) */}
            <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1.5 }}>
              {t('argus.dashboards.custom', 'Custom Dashboards')}
            </Typography>
            {dashboards.length === 0 ? (
              <EmptyPlaceholder
                icon={<DashboardIcon sx={{ fontSize: 48 }} />}
                message={t(
                  'argus.dashboards.empty',
                  'No custom dashboards yet. Create one or use a template below.'
                )}
                minHeight={200}
              />
            ) : (
              <Grid container spacing={2}>
                {dashboards.map((db: any) => (
                  <Grid size={{ xs: 12, sm: 6, md: 4 }} key={db.id}>
                    <Card
                      elevation={0}
                      sx={{
                        border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
                        borderRadius: 2,
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        height: 160,
                        display: 'flex',
                        flexDirection: 'column',
                        '&:hover': {
                          borderColor: alpha('#7c4dff', 0.3),
                          transform: 'translateY(-1px)',
                        },
                      }}
                      onClick={() => {
                        setActiveDashboard(db);
                        navigate(`/argus/dashboards/${db.id}`);
                      }}
                    >
                      {/* Header: title + star + more */}
                      <CardContent sx={{ pb: 0, pt: 1.5, px: 2 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography variant="subtitle2" fontWeight={700} sx={{ fontSize: '0.85rem' }} noWrap>
                              {db.title}
                            </Typography>
                            <Typography
                              variant="caption"
                              sx={{ color: 'text.secondary', fontSize: '0.7rem', display: 'block' }}
                              noWrap
                            >
                              {db.description ||
                                t('argus.dashboards.noDescription', 'No description')}
                            </Typography>
                          </Box>
                          <Box sx={{ display: 'flex', alignItems: 'center', ml: 0.5, flexShrink: 0 }}>
                            <IconButton
                              size="small"
                              onClick={(e) => handleToggleFavorite(db, e)}
                              sx={{
                                color: db.is_favorite ? '#ffc107' : 'text.disabled',
                                '&:hover': { color: '#ffc107' },
                              }}
                            >
                              {db.is_favorite ? (
                                <StarIcon sx={{ fontSize: 16 }} />
                              ) : (
                                <StarBorderIcon sx={{ fontSize: 16 }} />
                              )}
                            </IconButton>
                            <IconButton
                              size="small"
                              onClick={(e) => {
                                e.stopPropagation();
                                setCardMenuAnchor(e.currentTarget);
                                setCardMenuDashboard(db);
                              }}
                              sx={{
                                color: 'text.disabled',
                                '&:hover': { color: 'text.primary' },
                              }}
                            >
                              <MoreIcon sx={{ fontSize: 16 }} />
                            </IconButton>
                          </Box>
                        </Box>
                      </CardContent>

                      {/* Footer: mini preview + widget count */}
                      <Box sx={{ px: 2, pb: 1.5, pt: 0.5, flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                        {(db.widgets_config || []).length > 0 ? (
                          <Box
                            sx={{
                              height: 56,
                              borderRadius: 1,
                              backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
                              border: `1px solid ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}`,
                              position: 'relative',
                              overflow: 'hidden',
                            }}
                          >
                            {(db.widgets_config || []).slice(0, 12).map((w: WidgetConfig) => {
                              const ICON_MAP: Record<string, React.ReactNode> = {
                                line: <LineChartIcon sx={{ fontSize: 8, color: 'text.disabled' }} />,
                                bar: <BarChartIcon sx={{ fontSize: 8, color: 'text.disabled' }} />,
                                pie: <PieChartIcon sx={{ fontSize: 8, color: 'text.disabled' }} />,
                                number: <NumberIcon sx={{ fontSize: 8, color: 'text.disabled' }} />,
                                table: <TableIcon sx={{ fontSize: 8, color: 'text.disabled' }} />,
                                area: <AreaChartIcon sx={{ fontSize: 8, color: 'text.disabled' }} />,
                              };
                              return (
                                <Box
                                  key={w.id}
                                  sx={{
                                    position: 'absolute',
                                    left: `${(w.layout.x / 12) * 100}%`,
                                    top: `${Math.min((w.layout.y / 8) * 100, 80)}%`,
                                    width: `${(w.layout.w / 12) * 100}%`,
                                    height: `${Math.min((w.layout.h / 8) * 100, 50)}%`,
                                    minHeight: 8,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    borderRadius: 0.5,
                                    backgroundColor: isDark ? 'rgba(124,77,255,0.08)' : 'rgba(124,77,255,0.06)',
                                    border: `0.5px solid ${alpha('#7c4dff', 0.15)}`,
                                  }}
                                >
                                  {ICON_MAP[w.type] || null}
                                </Box>
                              );
                            })}
                          </Box>
                        ) : (
                          <Box
                            sx={{
                              height: 56,
                              borderRadius: 1,
                              border: `1.5px dashed ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
                            }}
                          />
                        )}

                      </Box>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            )}

            {/* Card Context Menu */}
            <Menu
              anchorEl={cardMenuAnchor}
              open={Boolean(cardMenuAnchor)}
              onClose={() => { setCardMenuAnchor(null); setCardMenuDashboard(null); }}
              PaperProps={{ sx: { minWidth: 160, borderRadius: '8px' } }}
            >
              <MenuItem
                onClick={() => {
                  if (cardMenuDashboard) {
                    setActiveDashboard(cardMenuDashboard);
                    navigate(`/argus/dashboards/${(cardMenuDashboard as any).id}`);
                  }
                  setCardMenuAnchor(null);
                  setCardMenuDashboard(null);
                }}
                sx={{ fontSize: '0.8rem' }}
              >
                <ListItemIcon><EditIcon sx={{ fontSize: 16 }} /></ListItemIcon>
                <ListItemText primaryTypographyProps={{ fontSize: '0.8rem' }}>
                  {t('argus.dashboards.editDashboard', 'Edit Dashboard')}
                </ListItemText>
              </MenuItem>
              <MenuItem
                onClick={() => {
                  setSharingDashboard(cardMenuDashboard);
                  setShareDialogOpen(true);
                  setCardMenuAnchor(null);
                  setCardMenuDashboard(null);
                }}
                sx={{ fontSize: '0.8rem' }}
              >
                <ListItemIcon><ShareIcon sx={{ fontSize: 16 }} /></ListItemIcon>
                <ListItemText primaryTypographyProps={{ fontSize: '0.8rem' }}>
                  {t('argus.dashboards.sharing.title', 'Sharing Settings')}
                </ListItemText>
              </MenuItem>
              <Divider />
              <MenuItem
                onClick={() => {
                  setDeleteConfirmOpen(true);
                  setDeletingDashboard(cardMenuDashboard);
                  setCardMenuAnchor(null);
                  setCardMenuDashboard(null);
                }}
                sx={{ fontSize: '0.8rem', color: 'error.main' }}
              >
                <ListItemIcon><DeleteIcon sx={{ fontSize: 16, color: 'error.main' }} /></ListItemIcon>
                <ListItemText primaryTypographyProps={{ fontSize: '0.8rem' }}>
                  {t('argus.dashboards.deleteDashboard', 'Delete Dashboard')}
                </ListItemText>
              </MenuItem>
            </Menu>

            {/* Delete Confirmation Dialog */}
            <Dialog
              open={deleteConfirmOpen}
              onClose={() => { setDeleteConfirmOpen(false); setDeletingDashboard(null); }}
              PaperProps={{ sx: { borderRadius: 2 } }}
            >
              <DialogTitle sx={{ fontWeight: 700, fontSize: '0.95rem' }}>
                {t('argus.dashboards.confirmDeleteTitle', 'Delete Dashboard')}
              </DialogTitle>
              <DialogContent>
                <DialogContentText sx={{ fontSize: '0.85rem' }}>
                  {t('argus.dashboards.confirmDeleteMessage', 'Are you sure you want to delete "{{name}}"? This action cannot be undone.', {
                    name: deletingDashboard?.title || '',
                  })}
                </DialogContentText>
              </DialogContent>
              <DialogActions>
                <Button
                  onClick={() => { setDeleteConfirmOpen(false); setDeletingDashboard(null); }}
                  sx={{ textTransform: 'none' }}
                >
                  {t('common.cancel', 'Cancel')}
                </Button>
                <Button
                  onClick={async () => {
                    if (deletingDashboard?.id) {
                      await handleDeleteDashboard(deletingDashboard.id);
                    }
                    setDeleteConfirmOpen(false);
                    setDeletingDashboard(null);
                  }}
                  variant="contained"
                  color="error"
                  sx={{ textTransform: 'none', fontWeight: 700 }}
                >
                  {t('common.delete', 'Delete')}
                </Button>
              </DialogActions>
            </Dialog>

            {/* Templates Section (below, collapsible) */}
            {presets.length > 0 && (
              <Box sx={{ mt: 4 }}>
                <Button
                  size="small"
                  startIcon={<PresetIcon sx={{ fontSize: 16, color: '#ff9800' }} />}
                  endIcon={templatesExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                  onClick={() => setTemplatesExpanded(!templatesExpanded)}
                  sx={{
                    textTransform: 'none',
                    fontWeight: 600,
                    fontSize: '0.8rem',
                    color: 'text.secondary',
                    mb: 1,
                  }}
                >
                  {t('argus.dashboards.presets', 'Dashboard Templates')}
                </Button>
                <Collapse in={templatesExpanded}>
                  <Grid container spacing={2}>
                    {presets.map((p) => (
                      <Grid size={{ xs: 12, sm: 6, md: 3 }} key={p.id}>
                        <Card
                          elevation={0}
                          sx={{
                            border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
                            borderRadius: 2,
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            '&:hover': {
                              borderColor: alpha('#7c4dff', 0.3),
                              transform: 'translateY(-2px)',
                              boxShadow: `0 4px 16px ${alpha('#7c4dff', 0.1)}`,
                            },
                          }}
                          onClick={() => {
                            setNewTitle(t(`argus.dashboards.preset.${p.id}.title`, p.title));
                            setNewDesc(t(`argus.dashboards.preset.${p.id}.description`, p.description));
                            setSelectedPreset(p.id);
                            setCreateOpen(true);
                          }}
                        >
                          <CardContent sx={{ pb: 1 }}>
                            <Typography
                              variant="subtitle2"
                              fontWeight={700}
                              sx={{ mb: 0.5, fontSize: '0.88rem' }}
                            >
                              {t(`argus.dashboards.preset.${p.id}.title`, p.title)}
                            </Typography>
                            <Typography
                              variant="caption"
                              sx={{
                                color: 'text.secondary',
                                fontSize: '0.73rem',
                                display: 'block',
                                mb: 1,
                              }}
                            >
                              {t(`argus.dashboards.preset.${p.id}.description`, p.description)}
                            </Typography>
                            <Chip
                              label={t('argus.dashboards.widgetCount', '{{count}} widgets', { count: p.widgetCount })}
                              size="small"
                              sx={{
                                height: 20,
                                fontSize: '0.62rem',
                                backgroundColor: alpha('#7c4dff', 0.08),
                                color: '#7c4dff',
                              }}
                            />
                          </CardContent>
                        </Card>
                      </Grid>
                    ))}
                  </Grid>
                </Collapse>
              </Box>
            )}
          </>
        )}

        {/* Create Dialog */}
        <Dialog
          open={createOpen}
          onClose={() => {
            setCreateOpen(false);
            setSelectedPreset('');
          }}
          maxWidth="sm"
          fullWidth
          PaperProps={{ sx: { borderRadius: 2 } }}
        >
          <DialogTitle sx={{ fontWeight: 700, fontSize: '0.95rem' }}>
            {selectedPreset
              ? t('argus.dashboards.createFromPreset', 'Create from Template')
              : t('argus.dashboards.create', 'Create Dashboard')}
          </DialogTitle>
          <DialogContent>
            <TextField
              autoFocus
              fullWidth
              size="small"
              label={t('argus.dashboards.name', 'Dashboard Name')}
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              sx={{ mt: 1, mb: 2 }}
            />
            <TextField
              fullWidth
              size="small"
              multiline
              rows={2}
              label={t('argus.dashboards.description', 'Description')}
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
            />
          </DialogContent>
          <DialogActions>
            <Button
              onClick={() => {
                setCreateOpen(false);
                setSelectedPreset('');
              }}
              sx={{ textTransform: 'none' }}
            >
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button
              onClick={handleCreateDashboard}
              variant="contained"
              disabled={!newTitle.trim()}
              sx={{ textTransform: 'none', fontWeight: 700 }}
            >
              {t('common.create', 'Create')}
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    );
  }

  // ─── Dashboard Detail View ───
  return (
    <Box>
      {/* Dashboard Header */}
      <PageHeader
        icon={<DashboardIcon />}
        title={
          <ArgusBreadcrumbs
            size="title"
            paths={[
              {
                label: t('argus.dashboards.title', 'Dashboards'),
                to: `/argus/dashboards`,
              },
              { label: activeDashboard.title },
            ]}
          />
        }
        subtitle={activeDashboard.description}
        onBack={() => { setActiveDashboard(null); navigate('/argus/dashboards'); }}
        actions={
          <Box sx={{ display: 'flex', gap: 1 }}>
            {isEditing ? (
              <>
                <Button
                  size="small"
                  startIcon={<AddIcon />}
                  onClick={handleAddWidget}
                  sx={{
                    textTransform: 'none',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                  }}
                >
                  {t('argus.dashboards.addWidget', 'Add Widget')}
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => setIsEditing(false)}
                  sx={{ textTransform: 'none', fontSize: '0.78rem' }}
                >
                  {t('common.cancel', 'Cancel')}
                </Button>
                <Button
                  size="small"
                  variant="contained"
                  startIcon={<SaveIcon sx={{ fontSize: 16 }} />}
                  onClick={handleSaveDashboard}
                  sx={{
                    textTransform: 'none',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                  }}
                >
                  {t('common.save', 'Save')}
                </Button>
              </>
            ) : (
              <Button
                size="small"
                variant="outlined"
                startIcon={<EditIcon sx={{ fontSize: 16 }} />}
                onClick={() => setIsEditing(true)}
                sx={{
                  textTransform: 'none',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                }}
              >
                {t('argus.dashboards.editLayout', 'Edit')}
              </Button>
            )}
          </Box>
        }
      />

      {/* Widget Grid + Catalog Sidebar */}
      <Box sx={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Catalog sidebar in edit mode */}
        {isEditing && (
          <WidgetCatalog
            onSelect={handleAddWidgetWithType}
            isDark={isDark}
          />
        )}

        {/* Main Grid */}
        <Box sx={{ flex: 1, overflow: 'auto' }}>
      {activeDashboard.widgets_config.length > 0 ? (
        <ResponsiveGridLayout
          className="layout"
          layouts={{ lg: gridLayout }}
          breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
          cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }}
          rowHeight={60}
          isDraggable={isEditing}
          isResizable={isEditing}
          onLayoutChange={handleLayoutChange}
          draggableHandle=".drag-handle"
          containerPadding={[0, 0]}
          margin={[12, 12]}
        >
          {activeDashboard.widgets_config.map((widget) => (
            <div key={widget.id}>
              <WidgetCard
                widget={widget}
                data={widgetData[widget.id] || []}
                loading={!!widgetLoading[widget.id]}
                isDark={isDark}
                isEditing={isEditing}
                onEdit={() => {
                  setEditingWidget({ ...widget });
                  setWidgetEditorOpen(true);
                }}
                onDelete={() => handleDeleteWidget(widget.id)}
                onDuplicate={() => handleDuplicateWidget(widget)}
              />
            </div>
          ))}
        </ResponsiveGridLayout>
      ) : (
        <EmptyPlaceholder
          icon={<WidgetIcon sx={{ fontSize: 48 }} />}
          message={t(
            'argus.dashboards.noWidgets',
            'This dashboard has no widgets yet.'
          )}
          minHeight={300}
        >
          <Button
            variant="outlined"
            startIcon={<AddIcon />}
            onClick={() => {
              setIsEditing(true);
              handleAddWidget();
            }}
            sx={{ textTransform: 'none', mt: 2 }}
          >
            {t('argus.dashboards.addWidget', 'Add Widget')}
          </Button>
        </EmptyPlaceholder>
      )}
        </Box>
      </Box>

      {/* Widget Editor Drawer */}
      <WidgetEditorDrawer
        open={widgetEditorOpen}
        widget={editingWidget}
        onClose={() => setWidgetEditorOpen(false)}
        onSave={handleSaveWidget}
        isDark={isDark}
        previewData={editingWidget ? widgetData[editingWidget.id] || [] : []}
        previewLoading={editingWidget ? !!widgetLoading[editingWidget.id] : false}
      />

      {/* Dashboard Share Dialog */}
      {sharingDashboard && (
        <DashboardShareDialog
          open={shareDialogOpen}
          onClose={() => { setShareDialogOpen(false); setSharingDashboard(null); }}
          projectId={projectId}
          dashboard={sharingDashboard as any}
          onUpdated={() => {
            argusService.listDashboards(projectId).then(setDashboards);
          }}
        />
      )}
    </Box>
  );
};

export default ArgusDashboardsPage;

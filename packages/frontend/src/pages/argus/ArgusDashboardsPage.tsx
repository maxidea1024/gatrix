import React, { useState, useCallback, useEffect, useMemo } from 'react';
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
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Save as SaveIcon,
  Close as CloseIcon,
  Widgets as WidgetIcon,
  BarChart as BarChartIcon,
  ShowChart as LineChartIcon,
  PieChart as PieChartIcon,
  Numbers as NumberIcon,
  TableChart as TableIcon,
  ArrowBack as BackIcon,
  AutoAwesome as PresetIcon,
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

const ResponsiveGridLayout = WidthProvider(Responsive);

const WIDGET_TYPES = [
  { value: 'line', label: 'Line Chart', icon: <LineChartIcon /> },
  { value: 'bar', label: 'Bar Chart', icon: <BarChartIcon /> },
  { value: 'pie', label: 'Pie Chart', icon: <PieChartIcon /> },
  { value: 'number', label: 'Big Number', icon: <NumberIcon /> },
  { value: 'table', label: 'Table', icon: <TableIcon /> },
];

const ArgusDashboardsPage: React.FC = () => {
  const theme = useTheme();
  const { t } = useTranslation();
  const isDark = theme.palette.mode === 'dark';
  const { currentProject } = useOrgProject();
  const projectId = currentProject?.id || '1';

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

  // Widget editor
  const [widgetEditorOpen, setWidgetEditorOpen] = useState(false);
  const [editingWidget, setEditingWidget] = useState<WidgetConfig | null>(null);

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
            results[w.id] = await argusService.queryDashboardWidget(
              projectId,
              w.query
            );
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

  // ─── Handlers ───
  const handleCreateDashboard = async () => {
    try {
      const data = await argusService.createDashboard(projectId, {
        title: newTitle,
        description: newDesc,
        ...(selectedPreset ? { preset_id: selectedPreset } : {}),
      });
      if (data) {
        setDashboards((prev) => [...prev, data]);
        setActiveDashboard(data);
        setCreateOpen(false);
        setNewTitle('');
        setNewDesc('');
        setSelectedPreset('');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteDashboard = async (id: number) => {
    try {
      await argusService.deleteDashboard(projectId, id);
      setDashboards((prev) => prev.filter((d) => (d as any).id !== id));
      if (activeDashboard && (activeDashboard as any).id === id)
        setActiveDashboard(null);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveDashboard = async () => {
    if (!activeDashboard?.id) return;
    try {
      await argusService.updateDashboard(projectId, activeDashboard.id, {
        widgets_config: activeDashboard.widgets_config,
      });
      setIsEditing(false);
    } catch (err) {
      console.error(err);
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
      id: `w-${Date.now()}`,
      title: 'New Widget',
      type: 'number',
      query: { fields: ['count()'], period: '24h' },
      layout: { x: 0, y: 100, w: 4, h: 3 },
    };
    setEditingWidget(newWidget);
    setWidgetEditorOpen(true);
  };

  const handleSaveWidget = () => {
    if (!editingWidget || !activeDashboard) return;
    const existing = activeDashboard.widgets_config.find(
      (w) => w.id === editingWidget.id
    );
    let updated: WidgetConfig[];
    if (existing) {
      updated = activeDashboard.widgets_config.map((w) =>
        w.id === editingWidget.id ? editingWidget : w
      );
    } else {
      updated = [...activeDashboard.widgets_config, editingWidget];
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
      id: `w-${Date.now()}`,
      title: `${widget.title} (copy)`,
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
            {/* Presets Section */}
            {presets.length > 0 && (
              <Box sx={{ mb: 4 }}>
                <Typography
                  variant="subtitle2"
                  fontWeight={700}
                  sx={{
                    mb: 1.5,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.5,
                  }}
                >
                  <PresetIcon sx={{ fontSize: 18, color: '#ff9800' }} />
                  {t('argus.dashboards.presets', 'Dashboard Templates')}
                </Typography>
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
                          setNewTitle(p.title);
                          setNewDesc(p.description);
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
                            {p.title}
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
                            {p.description}
                          </Typography>
                          <Chip
                            label={`${p.widgetCount} widgets`}
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
              </Box>
            )}

            {/* Custom Dashboards */}
            <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1.5 }}>
              {t('argus.dashboards.custom', 'Custom Dashboards')}
            </Typography>
            {dashboards.length === 0 ? (
              <EmptyPlaceholder
                icon={<DashboardIcon sx={{ fontSize: 48 }} />}
                message={t(
                  'argus.dashboards.empty',
                  'No custom dashboards yet. Create one or use a template above.'
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
                        '&:hover': {
                          borderColor: alpha('#7c4dff', 0.3),
                          transform: 'translateY(-1px)',
                        },
                      }}
                      onClick={() => setActiveDashboard(db)}
                    >
                      <CardContent>
                        <Typography variant="subtitle2" fontWeight={700}>
                          {db.title}
                        </Typography>
                        <Typography
                          variant="caption"
                          sx={{ color: 'text.secondary', fontSize: '0.7rem' }}
                        >
                          {db.description ||
                            t(
                              'argus.dashboards.noDescription',
                              'No description'
                            )}
                        </Typography>
                      </CardContent>
                      <CardActions
                        sx={{
                          px: 2,
                          pt: 0,
                          pb: 1.5,
                          justifyContent: 'space-between',
                        }}
                      >
                        <Chip
                          label={`${(db.widgets_config || []).length} widgets`}
                          size="small"
                          sx={{ height: 20, fontSize: '0.62rem' }}
                        />
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteDashboard(db.id);
                          }}
                          sx={{
                            color: 'text.disabled',
                            '&:hover': { color: '#f44336' },
                          }}
                        >
                          <DeleteIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                      </CardActions>
                    </Card>
                  </Grid>
                ))}
              </Grid>
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
        onBack={() => setActiveDashboard(null)}
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

      {/* Widget Grid */}
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

      {/* Widget Editor Dialog */}
      <Dialog
        open={widgetEditorOpen}
        onClose={() => setWidgetEditorOpen(false)}
        maxWidth="sm"
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
          }}
        >
          {editingWidget?.id?.startsWith('w-')
            ? t('argus.dashboards.addWidget', 'Add Widget')
            : t('argus.dashboards.editWidget', 'Edit Widget')}
          <IconButton size="small" onClick={() => setWidgetEditorOpen(false)}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>
        {editingWidget && (
          <DialogContent>
            <TextField
              fullWidth
              size="small"
              label={t('argus.dashboards.widgetTitle', 'Widget Title')}
              value={editingWidget.title}
              onChange={(e) =>
                setEditingWidget({ ...editingWidget, title: e.target.value })
              }
              sx={{ mt: 1, mb: 2 }}
            />

            <FormControl fullWidth size="small" sx={{ mb: 2 }}>
              <InputLabel>Visualization Type</InputLabel>
              <Select
                value={editingWidget.type}
                label="Visualization Type"
                onChange={(e) =>
                  setEditingWidget({
                    ...editingWidget,
                    type: e.target.value as any,
                  })
                }
              >
                {WIDGET_TYPES.map((wt) => (
                  <MenuItem
                    key={wt.value}
                    value={wt.value}
                    sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
                  >
                    {wt.icon} {wt.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              fullWidth
              size="small"
              multiline
              rows={2}
              label="Query Fields (comma separated)"
              value={editingWidget.query.fields.join(', ')}
              onChange={(e) =>
                setEditingWidget({
                  ...editingWidget,
                  query: {
                    ...editingWidget.query,
                    fields: e.target.value
                      .split(',')
                      .map((s) => s.trim())
                      .filter(Boolean),
                  },
                })
              }
              sx={{
                mb: 2,
                '& .MuiOutlinedInput-root': { fontSize: '0.82rem' },
              }}
            />

            <TextField
              fullWidth
              size="small"
              label="Group By (comma separated)"
              value={(editingWidget.query.groupBy || []).join(', ')}
              onChange={(e) =>
                setEditingWidget({
                  ...editingWidget,
                  query: {
                    ...editingWidget.query,
                    groupBy: e.target.value
                      .split(',')
                      .map((s) => s.trim())
                      .filter(Boolean),
                  },
                })
              }
              sx={{
                mb: 2,
                '& .MuiOutlinedInput-root': { fontSize: '0.82rem' },
              }}
            />

            <Box sx={{ display: 'flex', gap: 2 }}>
              <FormControl size="small" sx={{ flex: 1 }}>
                <InputLabel>Period</InputLabel>
                <Select
                  value={editingWidget.query.period || '24h'}
                  label="Period"
                  onChange={(e) =>
                    setEditingWidget({
                      ...editingWidget,
                      query: { ...editingWidget.query, period: e.target.value },
                    })
                  }
                >
                  <MenuItem value="1h">1h</MenuItem>
                  <MenuItem value="6h">6h</MenuItem>
                  <MenuItem value="24h">24h</MenuItem>
                  <MenuItem value="7d">7d</MenuItem>
                  <MenuItem value="30d">30d</MenuItem>
                  <MenuItem value="90d">90d</MenuItem>
                </Select>
              </FormControl>
              <TextField
                size="small"
                type="number"
                label="Limit"
                value={editingWidget.query.limit || 20}
                onChange={(e) =>
                  setEditingWidget({
                    ...editingWidget,
                    query: {
                      ...editingWidget.query,
                      limit: Number(e.target.value),
                    },
                  })
                }
                sx={{ width: 80 }}
              />
            </Box>
          </DialogContent>
        )}
        <DialogActions>
          <Button
            onClick={() => setWidgetEditorOpen(false)}
            sx={{ textTransform: 'none' }}
          >
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button
            onClick={handleSaveWidget}
            variant="contained"
            sx={{ textTransform: 'none', fontWeight: 700 }}
          >
            {t('common.apply', 'Apply')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ArgusDashboardsPage;

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  Box,
  Typography,
  Button,
  TextField,
  Drawer,
  IconButton,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Divider,
  alpha,
  useTheme,
  Chip,
  CircularProgress,
} from '@mui/material';
import {
  Close as CloseIcon,
  ShowChart as LineChartIcon,
  BarChart as BarChartIcon,
  PieChart as PieChartIcon,
  Numbers as NumberIcon,
  TableChart as TableIcon,
  AreaChart as AreaChartIcon,
  Speed as GaugeIcon,
  GridView as HeatmapIcon,
  ScatterPlot as ScatterIcon,
  Map as MapIcon,
  ViewList as ListIcon,
  TextFields as TextIcon,
  BarChart as HistogramIcon,
  AccountTree as TreemapIcon,
  Timeline as TimelineIcon,
  EventNote as EventStreamIcon,
  LinearScale as BarGaugeIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import WidgetRenderer from './renderers/WidgetRenderer';
import type { WidgetConfig, WidgetType, VizOptions } from './renderers/widgetTypes';

// ─── Widget Type Catalog Data ───

interface CatalogItem {
  value: WidgetType;
  labelKey: string;
  defaultLabel: string;
  descKey: string;
  defaultDesc: string;
  icon: React.ReactNode;
}

interface CatalogGroup {
  groupKey: string;
  defaultLabel: string;
  items: CatalogItem[];
}

const WIDGET_TYPE_CATALOG: CatalogGroup[] = [
  {
    groupKey: 'argus.dashboards.catalog.timeSeries',
    defaultLabel: 'Time Series / Trends',
    items: [
      { value: 'time-series', labelKey: 'argus.dashboards.widgetType.timeSeries', defaultLabel: 'Time Series', descKey: 'argus.dashboards.widgetType.timeSeriesDesc', defaultDesc: 'Line, bar, or area chart over time', icon: <LineChartIcon sx={{ fontSize: 18 }} /> },
    ],
  },
  {
    groupKey: 'argus.dashboards.catalog.stats',
    defaultLabel: 'Stats / Single Value',
    items: [
      { value: 'stat', labelKey: 'argus.dashboards.widgetType.stat', defaultLabel: 'Stat', descKey: 'argus.dashboards.widgetType.statDesc', defaultDesc: 'Big number with sparkline', icon: <NumberIcon sx={{ fontSize: 18 }} /> },
      { value: 'gauge', labelKey: 'argus.dashboards.widgetType.gauge', defaultLabel: 'Gauge', descKey: 'argus.dashboards.widgetType.gaugeDesc', defaultDesc: 'Radial gauge', icon: <GaugeIcon sx={{ fontSize: 18 }} /> },
      { value: 'bar-gauge', labelKey: 'argus.dashboards.widgetType.barGauge', defaultLabel: 'Bar Gauge', descKey: 'argus.dashboards.widgetType.barGaugeDesc', defaultDesc: 'Horizontal bar gauge', icon: <BarGaugeIcon sx={{ fontSize: 18 }} /> },
    ],
  },
  {
    groupKey: 'argus.dashboards.catalog.distribution',
    defaultLabel: 'Distribution / Comparison',
    items: [
      { value: 'pie', labelKey: 'argus.dashboards.widgetType.pie', defaultLabel: 'Pie / Donut', descKey: 'argus.dashboards.widgetType.pieDesc', defaultDesc: 'Proportional distribution', icon: <PieChartIcon sx={{ fontSize: 18 }} /> },
      { value: 'horizontal-bar', labelKey: 'argus.dashboards.widgetType.horizontalBar', defaultLabel: 'Horizontal Bar', descKey: 'argus.dashboards.widgetType.horizontalBarDesc', defaultDesc: 'Category comparison', icon: <BarChartIcon sx={{ fontSize: 18 }} /> },
      { value: 'histogram', labelKey: 'argus.dashboards.widgetType.histogram', defaultLabel: 'Histogram', descKey: 'argus.dashboards.widgetType.histogramDesc', defaultDesc: 'Frequency distribution', icon: <HistogramIcon sx={{ fontSize: 18 }} /> },
      { value: 'scatter', labelKey: 'argus.dashboards.widgetType.scatter', defaultLabel: 'Scatter', descKey: 'argus.dashboards.widgetType.scatterDesc', defaultDesc: 'Correlation between two values', icon: <ScatterIcon sx={{ fontSize: 18 }} /> },
    ],
  },
  {
    groupKey: 'argus.dashboards.catalog.data',
    defaultLabel: 'Data / Lists',
    items: [
      { value: 'table', labelKey: 'argus.dashboards.widgetType.table', defaultLabel: 'Table', descKey: 'argus.dashboards.widgetType.tableDesc', defaultDesc: 'Sortable, paginated table', icon: <TableIcon sx={{ fontSize: 18 }} /> },
      { value: 'top-list', labelKey: 'argus.dashboards.widgetType.topList', defaultLabel: 'Top List', descKey: 'argus.dashboards.widgetType.topListDesc', defaultDesc: 'Ranked list with bars', icon: <ListIcon sx={{ fontSize: 18 }} /> },
      { value: 'event-stream', labelKey: 'argus.dashboards.widgetType.eventStream', defaultLabel: 'Event Stream', descKey: 'argus.dashboards.widgetType.eventStreamDesc', defaultDesc: 'Log/event viewer with pagination', icon: <EventStreamIcon sx={{ fontSize: 18 }} /> },
    ],
  },
  {
    groupKey: 'argus.dashboards.catalog.geo',
    defaultLabel: 'Geographic',
    items: [
      { value: 'geo-map', labelKey: 'argus.dashboards.widgetType.geoMap', defaultLabel: 'Geo Map', descKey: 'argus.dashboards.widgetType.geoMapDesc', defaultDesc: 'Country-level map visualization', icon: <MapIcon sx={{ fontSize: 18 }} /> },
    ],
  },
  {
    groupKey: 'argus.dashboards.catalog.special',
    defaultLabel: 'Special',
    items: [
      { value: 'heatmap', labelKey: 'argus.dashboards.widgetType.heatmap', defaultLabel: 'Heatmap', descKey: 'argus.dashboards.widgetType.heatmapDesc', defaultDesc: '2D color matrix', icon: <HeatmapIcon sx={{ fontSize: 18 }} /> },
      { value: 'text', labelKey: 'argus.dashboards.widgetType.text', defaultLabel: 'Text', descKey: 'argus.dashboards.widgetType.textDesc', defaultDesc: 'Markdown text note', icon: <TextIcon sx={{ fontSize: 18 }} /> },
    ],
  },
];

// ─── Props ───

interface WidgetEditorDrawerProps {
  open: boolean;
  widget: WidgetConfig | null;
  onClose: () => void;
  onSave: (widget: WidgetConfig) => void;
  isDark: boolean;
  previewData?: any[];
  previewLoading?: boolean;
  onQueryChange?: (query: WidgetConfig['query']) => void;
}

// ─── Component ───

const WidgetEditorDrawer: React.FC<WidgetEditorDrawerProps> = ({
  open,
  widget,
  onClose,
  onSave,
  isDark,
  previewData = [],
  previewLoading = false,
  onQueryChange,
}) => {
  const { t } = useTranslation();
  const theme = useTheme();

  // Local editable copy
  const [editingWidget, setEditingWidget] = useState<WidgetConfig | null>(null);

  // Sync from prop when opened / clear when closed
  useEffect(() => {
    if (widget && open) {
      setEditingWidget({ ...widget });
    } else if (!open) {
      setEditingWidget(null);
    }
  }, [widget, open]);

  // Update field helper
  const updateWidget = useCallback(
    (patch: Partial<WidgetConfig>) => {
      setEditingWidget((prev) => {
        if (!prev) return prev;
        return { ...prev, ...patch };
      });
    },
    []
  );

  const updateQuery = useCallback(
    (patch: Partial<WidgetConfig['query']>) => {
      setEditingWidget((prev) => {
        if (!prev) return prev;
        const newQuery = { ...prev.query, ...patch };
        onQueryChange?.(newQuery);
        return { ...prev, query: newQuery };
      });
    },
    [onQueryChange]
  );

  const handleSave = () => {
    if (editingWidget) {
      onSave(editingWidget);
    }
  };

  const isNewWidget = editingWidget?.id?.startsWith('w-');
  const borderColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';

  if (!editingWidget) return null;

  return (
    <Drawer
      anchor="bottom"
      open={open}
      onClose={onClose}
      slotProps={{
        paper: {
          sx: {
            height: 'calc(100vh - 64px)',
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          },
        },
      }}
    >
      {/* ─── Header ─── */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 2.5,
          py: 1.2,
          borderBottom: `1px solid ${borderColor}`,
          flexShrink: 0,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography sx={{ fontWeight: 700, fontSize: '0.95rem' }}>
            {isNewWidget
              ? t('argus.dashboards.addWidget', 'Add Widget')
              : t('argus.dashboards.editWidget', 'Edit Widget')}
          </Typography>
          <Typography
            sx={{ fontSize: '0.78rem', color: 'text.secondary', fontWeight: 500 }}
          >
            — {editingWidget.title}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            size="small"
            onClick={onClose}
            sx={{ textTransform: 'none', fontWeight: 600, fontSize: '0.78rem' }}
          >
            {t('argus.dashboards.editor.discard', 'Discard')}
          </Button>
          <Button
            size="small"
            variant="contained"
            onClick={handleSave}
            sx={{ textTransform: 'none', fontWeight: 700, fontSize: '0.78rem' }}
          >
            {isNewWidget
              ? t('argus.dashboards.editor.addToDashboard', 'Add to Dashboard')
              : t('common.apply', 'Apply')}
          </Button>
          <IconButton size="small" onClick={onClose}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>
      </Box>

      {/* ─── Preview Area ─── */}
      <Box
        sx={{
          height: '40%',
          minHeight: 200,
          maxHeight: 400,
          borderBottom: `1px solid ${borderColor}`,
          backgroundColor: isDark ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.01)',
          p: 2,
          flexShrink: 0,
        }}
      >
        <Box
          sx={{
            height: '100%',
            borderRadius: 2,
            border: `1px solid ${borderColor}`,
            overflow: 'hidden',
            backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : '#fff',
          }}
        >
          <WidgetRenderer
            widget={editingWidget}
            data={previewData}
            loading={previewLoading}
            isDark={isDark}
          />
        </Box>
      </Box>

      {/* ─── Editor Panels ─── */}
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          overflow: 'hidden',
          minHeight: 0,
        }}
      >
        {/* Left: Query Builder */}
        <Box
          sx={{
            flex: 1,
            borderRight: `1px solid ${borderColor}`,
            overflow: 'auto',
            p: 2,
          }}
        >
          <Typography
            sx={{
              fontSize: '0.72rem',
              fontWeight: 700,
              color: 'text.secondary',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              mb: 1.5,
            }}
          >
            {t('argus.dashboards.editor.queryBuilder', 'Query Builder')}
          </Typography>

          {/* Widget Title */}
          <TextField
            fullWidth
            size="small"
            label={t('argus.dashboards.widgetTitle', 'Widget Title')}
            value={editingWidget.title}
            onChange={(e) => updateWidget({ title: e.target.value })}
            sx={{ mb: 2 }}
          />

          {/* Dataset */}
          <FormControl fullWidth size="small" sx={{ mb: 2 }}>
            <InputLabel>
              {t('argus.dashboards.editor.dataset', 'Dataset')}
            </InputLabel>
            <Select
              value={editingWidget.query.dataset || 'errors'}
              label={t('argus.dashboards.editor.dataset', 'Dataset')}
              onChange={(e) =>
                updateQuery({ dataset: e.target.value as any })
              }
            >
              <MenuItem value="errors">{t('argus.dashboards.dataset.errors', 'Errors')}</MenuItem>
              <MenuItem value="transactions">{t('argus.dashboards.dataset.transactions', 'Transactions')}</MenuItem>
              <MenuItem value="spans">{t('argus.dashboards.dataset.spans', 'Spans')}</MenuItem>
              <MenuItem value="logs">{t('argus.dashboards.dataset.logs', 'Logs')}</MenuItem>
              <MenuItem value="metrics">{t('argus.dashboards.dataset.metrics', 'Metrics')}</MenuItem>
            </Select>
          </FormControl>

          {/* Fields */}
          <TextField
            fullWidth
            size="small"
            multiline
            rows={2}
            label={t(
              'argus.dashboards.queryFields',
              'Query Fields (comma separated)'
            )}
            value={editingWidget.query.fields.join(', ')}
            onChange={(e) =>
              updateQuery({
                fields: e.target.value
                  .split(',')
                  .map((s) => s.trim())
                  .filter(Boolean),
              })
            }
            sx={{
              mb: 2,
              '& .MuiOutlinedInput-root': { fontSize: '0.82rem' },
            }}
          />

          {/* Group By */}
          <TextField
            fullWidth
            size="small"
            label={t(
              'argus.dashboards.groupBy',
              'Group By (comma separated)'
            )}
            value={(editingWidget.query.groupBy || []).join(', ')}
            onChange={(e) =>
              updateQuery({
                groupBy: e.target.value
                  .split(',')
                  .map((s) => s.trim())
                  .filter(Boolean),
              })
            }
            sx={{
              mb: 2,
              '& .MuiOutlinedInput-root': { fontSize: '0.82rem' },
            }}
          />

          {/* Conditions (AQL) */}
          <TextField
            fullWidth
            size="small"
            label={t('argus.dashboards.editor.conditions', 'Conditions (AQL)')}
            placeholder="level:error AND browser_name:Chrome"
            value={editingWidget.query.conditions || ''}
            onChange={(e) => updateQuery({ conditions: e.target.value })}
            sx={{
              mb: 2,
              '& .MuiOutlinedInput-root': { fontSize: '0.82rem' },
            }}
          />

          {/* Order By */}
          <TextField
            fullWidth
            size="small"
            label={t('argus.dashboards.editor.orderBy', 'Order By')}
            placeholder="-count"
            value={editingWidget.query.orderBy || ''}
            onChange={(e) => updateQuery({ orderBy: e.target.value })}
            sx={{ mb: 2 }}
          />

          {/* Period + Limit */}
          <Box sx={{ display: 'flex', gap: 2 }}>
            <FormControl size="small" sx={{ flex: 1 }}>
              <InputLabel>
                {t('argus.dashboards.period', 'Period')}
              </InputLabel>
              <Select
                value={editingWidget.query.period || '24h'}
                label={t('argus.dashboards.period', 'Period')}
                onChange={(e) =>
                  updateQuery({ period: e.target.value })
                }
              >
                <MenuItem value="1h">1h</MenuItem>
                <MenuItem value="6h">6h</MenuItem>
                <MenuItem value="24h">24h</MenuItem>
                <MenuItem value="7d">7d</MenuItem>
                <MenuItem value="14d">14d</MenuItem>
                <MenuItem value="30d">30d</MenuItem>
                <MenuItem value="90d">90d</MenuItem>
              </Select>
            </FormControl>
            <TextField
              size="small"
              type="number"
              label={t('argus.dashboards.limit', 'Limit')}
              value={editingWidget.query.limit || 20}
              onChange={(e) =>
                updateQuery({ limit: Number(e.target.value) })
              }
              sx={{ width: 80 }}
            />
          </Box>
        </Box>

        {/* Right: Style Options */}
        <Box
          sx={{
            width: 320,
            overflow: 'auto',
            p: 2,
            flexShrink: 0,
          }}
        >
          <Typography
            sx={{
              fontSize: '0.72rem',
              fontWeight: 700,
              color: 'text.secondary',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              mb: 1.5,
            }}
          >
            {t('argus.dashboards.editor.styleOptions', 'Style Options')}
          </Typography>

          {/* Visualization Type Selector */}
          <Typography
            sx={{
              fontSize: '0.68rem',
              fontWeight: 600,
              color: 'text.secondary',
              mb: 0.8,
            }}
          >
            {t('argus.dashboards.vizType', 'Visualization Type')}
          </Typography>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mb: 2 }}>
            {WIDGET_TYPE_CATALOG.map((group) => (
              <Box key={group.groupKey}>
                <Typography
                  sx={{
                    fontSize: '0.6rem',
                    fontWeight: 700,
                    color: 'text.disabled',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    mb: 0.5,
                  }}
                >
                  {t(group.groupKey, group.defaultLabel)}
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {group.items.map((item) => {
                    const isSelected = editingWidget.type === item.value;
                    return (
                      <Chip
                        key={item.value}
                        label={t(item.labelKey, item.defaultLabel)}
                        icon={item.icon as any}
                        size="small"
                        clickable
                        onClick={() => updateWidget({ type: item.value })}
                        sx={{
                          fontSize: '0.68rem',
                          fontWeight: isSelected ? 700 : 500,
                          height: 28,
                          backgroundColor: isSelected
                            ? alpha('#7c4dff', 0.12)
                            : isDark
                              ? 'rgba(255,255,255,0.04)'
                              : 'rgba(0,0,0,0.04)',
                          color: isSelected ? '#7c4dff' : 'text.primary',
                          border: isSelected
                            ? `1px solid ${alpha('#7c4dff', 0.4)}`
                            : '1px solid transparent',
                          '&:hover': {
                            backgroundColor: alpha('#7c4dff', 0.08),
                          },
                          '& .MuiChip-icon': {
                            color: isSelected ? '#7c4dff' : 'text.secondary',
                            fontSize: 16,
                          },
                        }}
                      />
                    );
                  })}
                </Box>
              </Box>
            ))}
          </Box>

          <Divider sx={{ my: 1.5 }} />

          {/* Chart Style (for time-series) */}
          {editingWidget.type === 'time-series' && (
            <>
              <Typography
                sx={{
                  fontSize: '0.68rem',
                  fontWeight: 600,
                  color: 'text.secondary',
                  mb: 0.8,
                }}
              >
                {t('argus.dashboards.editor.chartStyle', 'Chart Style')}
              </Typography>
              <Box sx={{ display: 'flex', gap: 0.5, mb: 2 }}>
                {(['line', 'bar', 'area', 'stacked-bar', 'stacked-area'] as const).map(
                  (style) => {
                    const styleLabels: Record<string, string> = {
                      line: t('argus.dashboards.chartStyle.line', 'Line'),
                      bar: t('argus.dashboards.chartStyle.bar', 'Bar'),
                      area: t('argus.dashboards.chartStyle.area', 'Area'),
                      'stacked-bar': t('argus.dashboards.chartStyle.stackedBar', 'Stacked Bar'),
                      'stacked-area': t('argus.dashboards.chartStyle.stackedArea', 'Stacked Area'),
                    };
                    const isSelected = (editingWidget.chart_style || 'line') === style;
                    return (
                      <Chip
                        key={style}
                        label={styleLabels[style] || style}
                        size="small"
                        clickable
                        onClick={() => updateWidget({ chart_style: style })}
                        sx={{
                          fontSize: '0.65rem',
                          fontWeight: isSelected ? 700 : 500,
                          height: 24,
                          backgroundColor: isSelected
                            ? alpha('#7c4dff', 0.12)
                            : 'transparent',
                          color: isSelected ? '#7c4dff' : 'text.secondary',
                          border: isSelected
                            ? `1px solid ${alpha('#7c4dff', 0.4)}`
                            : `1px solid ${borderColor}`,
                        }}
                      />
                    );
                  }
                )}
              </Box>
            </>
          )}

          {/* Unit */}
          <FormControl fullWidth size="small" sx={{ mb: 2 }}>
            <InputLabel>
              {t('argus.dashboards.style.unit', 'Unit')}
            </InputLabel>
            <Select
              value={editingWidget.viz_options?.unit || 'none'}
              label={t('argus.dashboards.style.unit', 'Unit')}
              onChange={(e) =>
                updateWidget({
                  viz_options: {
                    ...editingWidget.viz_options,
                    unit: e.target.value,
                  },
                })
              }
            >
              <MenuItem value="none">None</MenuItem>
              <MenuItem value="short">Short (1K, 1M)</MenuItem>
              <MenuItem value="percent">Percent (%)</MenuItem>
              <MenuItem value="ms">Duration (ms)</MenuItem>
              <MenuItem value="bytes">Bytes (KB, MB)</MenuItem>
            </Select>
          </FormControl>

          {/* Decimals */}
          <TextField
            fullWidth
            size="small"
            type="number"
            label={t('argus.dashboards.style.decimals', 'Decimals')}
            value={editingWidget.viz_options?.decimals ?? ''}
            onChange={(e) =>
              updateWidget({
                viz_options: {
                  ...editingWidget.viz_options,
                  decimals: e.target.value ? Number(e.target.value) : undefined,
                },
              })
            }
            sx={{ mb: 2 }}
            inputProps={{ min: 0, max: 10 }}
          />

          {/* Legend */}
          <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
            <Chip
              label={t('argus.dashboards.style.legendShow', 'Legend')}
              size="small"
              clickable
              onClick={() =>
                updateWidget({
                  viz_options: {
                    ...editingWidget.viz_options,
                    legend: {
                      ...editingWidget.viz_options?.legend,
                      show: !(editingWidget.viz_options?.legend?.show !== false),
                    },
                  },
                })
              }
              sx={{
                fontSize: '0.65rem',
                fontWeight: 600,
                height: 24,
                backgroundColor:
                  editingWidget.viz_options?.legend?.show !== false
                    ? alpha('#4caf50', 0.12)
                    : 'transparent',
                color:
                  editingWidget.viz_options?.legend?.show !== false
                    ? '#4caf50'
                    : 'text.disabled',
                border: `1px solid ${borderColor}`,
              }}
            />
          </Box>

          {/* Description */}
          <TextField
            fullWidth
            size="small"
            multiline
            rows={2}
            label={t('argus.dashboards.description', 'Description')}
            value={editingWidget.description || ''}
            onChange={(e) => updateWidget({ description: e.target.value })}
            sx={{ mb: 2 }}
          />

          {/* Markdown Content (for text widgets) */}
          {editingWidget.type === 'text' && (
            <TextField
              fullWidth
              size="small"
              multiline
              rows={6}
              label={t('argus.dashboards.style.markdownContent', 'Markdown Content')}
              value={editingWidget.viz_options?.markdown_content || ''}
              onChange={(e) =>
                updateWidget({
                  viz_options: {
                    ...editingWidget.viz_options,
                    markdown_content: e.target.value,
                  },
                })
              }
              placeholder={t('argus.dashboards.style.markdownPlaceholder', '# Heading\n\nWrite your markdown here...')}
              sx={{
                '& .MuiOutlinedInput-root': {
                  fontFamily: 'monospace',
                  fontSize: '0.8rem',
                },
              }}
            />
          )}
        </Box>
      </Box>
    </Drawer>
  );
};

export default WidgetEditorDrawer;

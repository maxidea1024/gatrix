import React from 'react';
import { Box, CircularProgress } from '@mui/material';
import { useTranslation } from 'react-i18next';
import EmptyPlaceholder from '@/components/common/EmptyPlaceholder';
import {
  type WidgetConfig,
  type VizOptions,
  normalizeWidgetType,
  legacyTypeToChartStyle,
} from './widgetTypes';
import TimeSeriesRenderer from './TimeSeriesRenderer';
import StatRenderer from './StatRenderer';
import PieRenderer from './PieRenderer';
import GaugeRenderer from './GaugeRenderer';
import HorizontalBarRenderer from './HorizontalBarRenderer';
import TableRenderer from './TableRenderer';
import HeatmapRenderer from './HeatmapRenderer';
import HistogramRenderer from './HistogramRenderer';
import ScatterRenderer from './ScatterRenderer';
import TextRenderer from './TextRenderer';
import GeoMapRenderer from './GeoMapRenderer';
import EventStreamRenderer from './EventStreamRenderer';

// ─── Props ───
export interface WidgetRendererProps {
  widget: WidgetConfig;
  data: any[];
  loading: boolean;
  isDark: boolean;
}

/**
 * Router component that delegates rendering to the appropriate
 * visualization renderer based on widget type.
 */
const WidgetRenderer: React.FC<WidgetRendererProps> = ({
  widget,
  data,
  loading,
  isDark,
}) => {
  const { t } = useTranslation();
  const vizOptions = widget.viz_options;

  if (loading) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100%',
        }}
      >
        <CircularProgress size={24} />
      </Box>
    );
  }

  // Text widget doesn't need data
  const normalizedType = normalizeWidgetType(widget.type);
  if (normalizedType === 'text') {
    return (
      <TextRenderer
        widget={widget}
        isDark={isDark}
        vizOptions={vizOptions}
      />
    );
  }

  if (!data || data.length === 0) {
    return (
      <EmptyPlaceholder
        message={t('common.noData', 'No data')}
        minHeight="100%"
        sx={{ height: '100%', border: 'none', py: 0, px: 0 }}
      />
    );
  }

  // Resolve effective chart_style for legacy types
  const effectiveChartStyle =
    widget.chart_style || legacyTypeToChartStyle(widget.type) || 'line';

  switch (normalizedType) {
    case 'time-series':
      return (
        <TimeSeriesRenderer
          data={data}
          isDark={isDark}
          chartStyle={effectiveChartStyle}
          vizOptions={vizOptions}
        />
      );

    case 'stat':
      return (
        <StatRenderer
          data={data}
          isDark={isDark}
          vizOptions={vizOptions}
        />
      );

    case 'gauge':
    case 'bar-gauge':
      return (
        <GaugeRenderer
          data={data}
          isDark={isDark}
          mode={normalizedType === 'bar-gauge' ? 'bar' : 'radial'}
          vizOptions={vizOptions}
        />
      );

    case 'pie':
      return (
        <PieRenderer
          data={data}
          isDark={isDark}
          vizOptions={vizOptions}
        />
      );

    case 'horizontal-bar':
    case 'top-list':
      return (
        <HorizontalBarRenderer
          data={data}
          isDark={isDark}
          vizOptions={vizOptions}
          showRank={normalizedType === 'top-list'}
        />
      );

    case 'table':
      return (
        <TableRenderer
          data={data}
          isDark={isDark}
          vizOptions={vizOptions}
        />
      );

    case 'heatmap':
      return (
        <HeatmapRenderer
          data={data}
          isDark={isDark}
          vizOptions={vizOptions}
        />
      );

    case 'histogram':
      return (
        <HistogramRenderer
          data={data}
          isDark={isDark}
          vizOptions={vizOptions}
        />
      );

    case 'scatter':
      return (
        <ScatterRenderer
          data={data}
          isDark={isDark}
          vizOptions={vizOptions}
        />
      );

    case 'geo-map':
      return (
        <GeoMapRenderer
          data={data}
          isDark={isDark}
          vizOptions={vizOptions}
        />
      );

    case 'event-stream':
      return (
        <EventStreamRenderer
          widget={widget}
          data={data}
          isDark={isDark}
          vizOptions={vizOptions}
        />
      );

    // TODO: treemap, status-timeline

    default:
      return (
        <EmptyPlaceholder
          message={t(
            'argus.dashboards.unsupportedWidget',
            'Unsupported widget type: {{type}}',
            { type: widget.type }
          )}
          minHeight="100%"
          sx={{ height: '100%', border: 'none', py: 0, px: 0 }}
        />
      );
  }
};

export default WidgetRenderer;

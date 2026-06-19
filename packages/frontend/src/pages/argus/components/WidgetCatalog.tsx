import React from 'react';
import { Box, Typography, alpha, useTheme, Tooltip } from '@mui/material';
import {
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
  EventNote as EventStreamIcon,
  LinearScale as BarGaugeIcon,
  BarChart as HistogramIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import type { WidgetType } from './renderers/widgetTypes';

// ─── Catalog Structure ───

interface CatalogEntry {
  type: WidgetType;
  labelKey: string;
  defaultLabel: string;
  icon: React.ReactNode;
}

interface CatalogSection {
  titleKey: string;
  defaultTitle: string;
  entries: CatalogEntry[];
}

const CATALOG_SECTIONS: CatalogSection[] = [
  {
    titleKey: 'argus.dashboards.catalog.timeSeries',
    defaultTitle: 'Time Series',
    entries: [
      {
        type: 'time-series',
        labelKey: 'argus.dashboards.widgetType.timeSeries',
        defaultLabel: 'Time Series',
        icon: <LineChartIcon />,
      },
    ],
  },
  {
    titleKey: 'argus.dashboards.catalog.stats',
    defaultTitle: 'Stats',
    entries: [
      {
        type: 'stat',
        labelKey: 'argus.dashboards.widgetType.stat',
        defaultLabel: 'Stat',
        icon: <NumberIcon />,
      },
      {
        type: 'gauge',
        labelKey: 'argus.dashboards.widgetType.gauge',
        defaultLabel: 'Gauge',
        icon: <GaugeIcon />,
      },
      {
        type: 'bar-gauge',
        labelKey: 'argus.dashboards.widgetType.barGauge',
        defaultLabel: 'Bar Gauge',
        icon: <BarGaugeIcon />,
      },
    ],
  },
  {
    titleKey: 'argus.dashboards.catalog.distribution',
    defaultTitle: 'Distribution',
    entries: [
      {
        type: 'pie',
        labelKey: 'argus.dashboards.widgetType.pie',
        defaultLabel: 'Pie',
        icon: <PieChartIcon />,
      },
      {
        type: 'horizontal-bar',
        labelKey: 'argus.dashboards.widgetType.horizontalBar',
        defaultLabel: 'H. Bar',
        icon: <BarChartIcon />,
      },
      {
        type: 'histogram',
        labelKey: 'argus.dashboards.widgetType.histogram',
        defaultLabel: 'Histogram',
        icon: <HistogramIcon />,
      },
      {
        type: 'scatter',
        labelKey: 'argus.dashboards.widgetType.scatter',
        defaultLabel: 'Scatter',
        icon: <ScatterIcon />,
      },
    ],
  },
  {
    titleKey: 'argus.dashboards.catalog.data',
    defaultTitle: 'Data',
    entries: [
      {
        type: 'table',
        labelKey: 'argus.dashboards.widgetType.table',
        defaultLabel: 'Table',
        icon: <TableIcon />,
      },
      {
        type: 'top-list',
        labelKey: 'argus.dashboards.widgetType.topList',
        defaultLabel: 'Top List',
        icon: <ListIcon />,
      },
      {
        type: 'event-stream',
        labelKey: 'argus.dashboards.widgetType.eventStream',
        defaultLabel: 'Events',
        icon: <EventStreamIcon />,
      },
    ],
  },
  {
    titleKey: 'argus.dashboards.catalog.geo',
    defaultTitle: 'Geo',
    entries: [
      {
        type: 'geo-map',
        labelKey: 'argus.dashboards.widgetType.geoMap',
        defaultLabel: 'Geo Map',
        icon: <MapIcon />,
      },
    ],
  },
  {
    titleKey: 'argus.dashboards.catalog.special',
    defaultTitle: 'Special',
    entries: [
      {
        type: 'heatmap',
        labelKey: 'argus.dashboards.widgetType.heatmap',
        defaultLabel: 'Heatmap',
        icon: <HeatmapIcon />,
      },
      {
        type: 'text',
        labelKey: 'argus.dashboards.widgetType.text',
        defaultLabel: 'Text',
        icon: <TextIcon />,
      },
    ],
  },
];

// ─── Props ───

interface WidgetCatalogProps {
  onSelect: (type: WidgetType) => void;
  isDark: boolean;
}

/**
 * Sidebar catalog shown in edit mode — users pick a widget type
 * and it opens the editor drawer with that type pre-selected.
 */
const WidgetCatalog: React.FC<WidgetCatalogProps> = ({ onSelect, isDark }) => {
  const { t } = useTranslation();
  const theme = useTheme();

  return (
    <Box
      sx={{
        width: 180,
        flexShrink: 0,
        borderRight: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
        overflow: 'auto',
        py: 1.5,
        px: 1,
        backgroundColor: isDark ? 'rgba(0,0,0,0.15)' : 'rgba(0,0,0,0.01)',
      }}
    >
      <Typography
        sx={{
          fontSize: '0.7rem',
          fontWeight: 700,
          color: 'text.secondary',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          px: 0.5,
          mb: 1,
        }}
      >
        {t('argus.dashboards.catalog.title', 'Add Widget')}
      </Typography>

      {CATALOG_SECTIONS.map((section) => (
        <Box key={section.titleKey} sx={{ mb: 1.5 }}>
          <Typography
            sx={{
              fontSize: '0.58rem',
              fontWeight: 700,
              color: 'text.disabled',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              px: 0.5,
              mb: 0.3,
            }}
          >
            {t(section.titleKey, section.defaultTitle)}
          </Typography>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.2 }}>
            {section.entries.map((entry) => (
              <Tooltip
                key={entry.type}
                title={t(entry.labelKey, entry.defaultLabel)}
                placement="right"
                arrow
              >
                <Box
                  onClick={() => onSelect(entry.type)}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.8,
                    px: 0.8,
                    py: 0.5,
                    borderRadius: 1,
                    cursor: 'pointer',
                    transition: 'all 0.12s',
                    '&:hover': {
                      backgroundColor: alpha('#7c4dff', 0.08),
                    },
                    '&:active': {
                      transform: 'scale(0.97)',
                    },
                  }}
                >
                  <Box
                    sx={{
                      width: 28,
                      height: 28,
                      borderRadius: '6px',
                      backgroundColor: isDark
                        ? 'rgba(255,255,255,0.04)'
                        : 'rgba(0,0,0,0.04)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      color: 'text.secondary',
                      '& svg': { fontSize: 16 },
                    }}
                  >
                    {entry.icon}
                  </Box>
                  <Typography
                    sx={{
                      fontSize: '0.7rem',
                      fontWeight: 500,
                      color: 'text.primary',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {t(entry.labelKey, entry.defaultLabel)}
                  </Typography>
                </Box>
              </Tooltip>
            ))}
          </Box>
        </Box>
      ))}
    </Box>
  );
};

export default WidgetCatalog;

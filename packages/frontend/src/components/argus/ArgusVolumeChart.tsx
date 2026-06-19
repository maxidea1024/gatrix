import React, { useMemo } from 'react';
import {
  Box,
  Paper,
  Typography,
  ToggleButtonGroup,
  ToggleButton,
  IconButton,
  useTheme,
  alpha,
} from '@mui/material';
import {
  BarChart as BarChartIcon,
  ShowChart as LineChartIcon,
  StackedLineChart as AreaChartIcon,
  StackedBarChart as StackedBarIcon,
  Layers as StackedAreaIcon,
  UnfoldLess as CompactIcon,
  UnfoldMore as ExpandIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import SafeTooltip from '@/components/common/SafeTooltip';
import EmptyPlaceholder from '@/components/common/EmptyPlaceholder';
import ArgusChartSkeleton from '@/components/argus/ArgusChartSkeleton';
import InteractiveTimeSeriesChart, {
  ChartDataset,
} from '@/components/argus/InteractiveTimeSeriesChart';
import { useLocalStorage } from '@/hooks/useLocalStorage';

export type VolumeChartType =
  | 'bar'
  | 'line'
  | 'area'
  | 'stacked-bar'
  | 'stacked-area';

export interface ArgusVolumeChartProps {
  /** Chart datasets */
  datasets: ChartDataset[];
  /** X-axis labels */
  labels: string[];
  /** Loading state */
  loading?: boolean;
  /** Empty state message */
  emptyMessage?: string;
  /** Chart title (hidden in compact mode) */
  title?: string;
  /** Drag selection callback: returns start/end data indices */
  onZoom?: (startIndex: number, endIndex: number) => void;
  /** localStorage key prefix for persisting settings */
  storagePrefix?: string;
  /** Show chart type toggle (default: true) */
  showChartTypeToggle?: boolean;
  /** Show compact toggle (default: true) */
  showCompactToggle?: boolean;
  /** Show legend (default: false) */
  showLegend?: boolean;
  /** Skeleton color hint (default: '#7c4dff') */
  skeletonColor?: string;
  /** Bottom margin (default: 2) */
  mb?: number;
  /** Controlled chart type (overrides localStorage) */
  chartType?: VolumeChartType;
  /** Callback when chart type changes (controlled mode) */
  onChartTypeChange?: (type: VolumeChartType) => void;
}

const CHART_HEIGHT_NORMAL = 140;
const CHART_HEIGHT_COMPACT = 80;

/**
 * Unified volume chart component used across all Argus pages.
 * Fixed-height Paper container prevents layout shift during loading transitions.
 * Supports drag selection, chart type toggle, and compact mode.
 */
const ArgusVolumeChart: React.FC<ArgusVolumeChartProps> = ({
  datasets,
  labels,
  loading = false,
  emptyMessage,
  title,
  onZoom,
  storagePrefix = 'argus_volume',
  showChartTypeToggle = true,
  showCompactToggle = true,
  showLegend = false,
  skeletonColor = '#7c4dff',
  mb = 2,
  chartType: controlledChartType,
  onChartTypeChange,
}) => {
  const theme = useTheme();
  const { t } = useTranslation();
  const isDark = theme.palette.mode === 'dark';

  const [localChartType, setLocalChartType] = useLocalStorage<VolumeChartType>(
    `${storagePrefix}_chart_type`,
    'bar'
  );
  const chartType = controlledChartType ?? localChartType;
  const setChartType = (v: VolumeChartType) => {
    if (onChartTypeChange) onChartTypeChange(v);
    else setLocalChartType(v);
  };
  const [compact, setCompact] = useLocalStorage<boolean>(
    `${storagePrefix}_compact`,
    false
  );

  const chartHeight = compact ? CHART_HEIGHT_COMPACT : CHART_HEIGHT_NORMAL;
  const hasData = labels.length > 0 && datasets.length > 0;
  const isEmpty = !loading && !hasData;

  // Apply current chartType to all datasets
  const typedDatasets = useMemo(() => {
    return datasets.map((ds) => ({
      ...ds,
      type: chartType,
    }));
  }, [datasets, chartType]);

  const handleChartTypeChange = (
    _: React.MouseEvent<HTMLElement>,
    value: VolumeChartType | null
  ) => {
    if (value) setChartType(value);
  };

  return (
    <Paper
      elevation={0}
      sx={{
        mb,
        p: compact ? 1 : 2,
        pt: compact ? 1 : 1.5,
        borderRadius: 2,
        border: `1px solid`,
        borderColor: 'divider',
        transition: 'padding 0.2s ease',
      }}
    >
      {/* Header: title + controls */}
      {!compact && (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            mb: 1,
            minHeight: 24,
            position: 'relative',
            zIndex: 3,
          }}
        >
          <Typography
            sx={{
              fontSize: '0.78rem',
              fontWeight: 700,
              color: 'text.secondary',
            }}
          >
            {title || 'count(events)'}
          </Typography>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            {showChartTypeToggle && (
              <ToggleButtonGroup
                value={chartType}
                exclusive
                onChange={handleChartTypeChange}
                size="small"
                sx={{
                  height: 24,
                  '& .MuiToggleButton-root': {
                    px: 0.75,
                    py: 0,
                    border: `1px solid`,
                    borderColor: 'divider',
                    '&.Mui-selected': {
                      bgcolor: alpha(theme.palette.primary.main, 0.1),
                      color: theme.palette.primary.main,
                      borderColor: alpha(theme.palette.primary.main, 0.3),
                    },
                  },
                }}
              >
                <ToggleButton value="bar">
                  <SafeTooltip title={t('argus.chart.bar', 'Bar')}>
                    <BarChartIcon sx={{ fontSize: 16 }} />
                  </SafeTooltip>
                </ToggleButton>
                <ToggleButton value="line">
                  <SafeTooltip title={t('argus.chart.line', 'Line')}>
                    <LineChartIcon sx={{ fontSize: 16 }} />
                  </SafeTooltip>
                </ToggleButton>
                <ToggleButton value="area">
                  <SafeTooltip title={t('argus.chart.area', 'Area')}>
                    <AreaChartIcon sx={{ fontSize: 16 }} />
                  </SafeTooltip>
                </ToggleButton>
                <ToggleButton value="stacked-bar">
                  <SafeTooltip
                    title={t('argus.chart.stackedBar', 'Stacked Bar')}
                  >
                    <StackedBarIcon sx={{ fontSize: 16 }} />
                  </SafeTooltip>
                </ToggleButton>
                <ToggleButton value="stacked-area">
                  <SafeTooltip
                    title={t('argus.chart.stackedArea', 'Stacked Area')}
                  >
                    <StackedAreaIcon sx={{ fontSize: 16 }} />
                  </SafeTooltip>
                </ToggleButton>
              </ToggleButtonGroup>
            )}
            {showCompactToggle && (
              <SafeTooltip title={t('argus.chart.compact', 'Compact')}>
                <IconButton
                  size="small"
                  onClick={() => setCompact(true)}
                  sx={{ p: 0.3 }}
                >
                  <CompactIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </SafeTooltip>
            )}
          </Box>
        </Box>
      )}

      {/* Chart area — fixed height */}
      <Box
        sx={{
          height: chartHeight,
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* Compact mode: overlay controls */}
        {compact && (
          <Box
            sx={{
              position: 'absolute',
              top: 4,
              right: 4,
              zIndex: 3,
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
              opacity: 0.6,
              transition: 'opacity 0.15s',
              '&:hover': { opacity: 1 },
            }}
          >
            {showChartTypeToggle && (
              <ToggleButtonGroup
                value={chartType}
                exclusive
                onChange={handleChartTypeChange}
                size="small"
                sx={{
                  height: 20,
                  '& .MuiToggleButton-root': {
                    px: 0.5,
                    py: 0,
                    fontSize: '0.6rem',
                    border: `1px solid`,
                    borderColor: 'divider',
                    '&.Mui-selected': {
                      bgcolor: alpha(theme.palette.primary.main, 0.1),
                      color: theme.palette.primary.main,
                      borderColor: alpha(theme.palette.primary.main, 0.3),
                    },
                  },
                }}
              >
                <ToggleButton value="bar">
                  <BarChartIcon sx={{ fontSize: 13 }} />
                </ToggleButton>
                <ToggleButton value="line">
                  <LineChartIcon sx={{ fontSize: 13 }} />
                </ToggleButton>
                <ToggleButton value="area">
                  <AreaChartIcon sx={{ fontSize: 13 }} />
                </ToggleButton>
                <ToggleButton value="stacked-bar">
                  <StackedBarIcon sx={{ fontSize: 13 }} />
                </ToggleButton>
                <ToggleButton value="stacked-area">
                  <StackedAreaIcon sx={{ fontSize: 13 }} />
                </ToggleButton>
              </ToggleButtonGroup>
            )}
            {showCompactToggle && (
              <SafeTooltip title={t('argus.chart.expand', 'Expand')}>
                <IconButton
                  size="small"
                  onClick={() => setCompact(false)}
                  sx={{ p: 0.2 }}
                >
                  <ExpandIcon sx={{ fontSize: 14 }} />
                </IconButton>
              </SafeTooltip>
            )}
          </Box>
        )}

        {/* State: Loading */}
        {loading && (
          <ArgusChartSkeleton
            type={
              chartType === 'bar' || chartType === 'stacked-bar'
                ? 'bar'
                : 'line'
            }
            height={chartHeight}
            color={skeletonColor}
          />
        )}

        {/* State: Empty */}
        {isEmpty && (
          <EmptyPlaceholder
            variant="text"
            message={
              emptyMessage || t('argus.chart.noData', 'No data available')
            }
            sx={{ flex: 1, height: '100%' }}
          />
        )}

        {/* State: Data */}
        {!loading && hasData && (
          <InteractiveTimeSeriesChart
            labels={labels}
            datasets={typedDatasets}
            height={chartHeight}
            onZoom={onZoom}
            showLegend={showLegend && !compact}
          />
        )}
      </Box>
    </Paper>
  );
};

export default React.memo(ArgusVolumeChart);

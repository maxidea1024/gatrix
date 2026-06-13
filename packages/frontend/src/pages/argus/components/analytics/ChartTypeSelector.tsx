import React, { useMemo } from 'react';
import { ToggleButtonGroup, ToggleButton, useTheme, alpha, Tooltip } from '@mui/material';
import {
  ShowChart as LineIcon,
  BarChart as BarIcon,
  StackedBarChart as StackedIcon,
  TableChart as TableIcon,
  Tag as MetricIcon,
  DonutLarge as DonutIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';

export type ChartType = 'line' | 'bar' | 'stacked-bar' | 'table' | 'metric' | 'donut';

interface ChartTypeDef {
  type: ChartType;
  icon: React.ReactElement;
  label: string;
}

interface ChartTypeSelectorProps {
  value: ChartType;
  onChange: (type: ChartType) => void;
  availableTypes?: ChartType[];
}

const ChartTypeSelector: React.FC<ChartTypeSelectorProps> = ({
  value,
  onChange,
  availableTypes,
}) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const { t } = useTranslation();

  const ALL_CHART_TYPES: ChartTypeDef[] = useMemo(() => [
    { type: 'line', icon: <LineIcon fontSize="small" />, label: t('argus.analytics.lineChart', 'Line Chart') },
    { type: 'bar', icon: <BarIcon fontSize="small" />, label: t('argus.analytics.barChart', 'Bar Chart') },
    { type: 'stacked-bar', icon: <StackedIcon fontSize="small" />, label: t('argus.analytics.stackedBar', 'Stacked Bar') },
    { type: 'table', icon: <TableIcon fontSize="small" />, label: t('argus.analytics.tableView', 'Table') },
    { type: 'metric', icon: <MetricIcon fontSize="small" />, label: t('argus.analytics.metricView', 'Metric') },
    { type: 'donut', icon: <DonutIcon fontSize="small" />, label: t('argus.analytics.donutChart', 'Donut') },
  ], [t]);

  const types = availableTypes
    ? ALL_CHART_TYPES.filter((ct) => availableTypes.includes(ct.type))
    : ALL_CHART_TYPES.filter((ct) => ['line', 'bar', 'stacked-bar', 'table'].includes(ct.type));

  return (
    <ToggleButtonGroup
      size="small"
      value={value}
      exclusive
      onChange={(_, newVal) => {
        if (newVal !== null) onChange(newVal as ChartType);
      }}
      sx={{
        '& .MuiToggleButton-root': {
          border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
          px: 1,
          py: 0.5,
          color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)',
          '&.Mui-selected': {
            bgcolor: alpha(theme.palette.primary.main, isDark ? 0.2 : 0.1),
            color: theme.palette.primary.main,
            borderColor: alpha(theme.palette.primary.main, 0.3),
          },
          '&:hover': {
            bgcolor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
          },
        },
      }}
    >
      {types.map((t) => (
        <Tooltip key={t.type} title={t.label} arrow>
          <ToggleButton value={t.type} aria-label={t.label}>
            {t.icon}
          </ToggleButton>
        </Tooltip>
      ))}
    </ToggleButtonGroup>
  );
};

export default ChartTypeSelector;

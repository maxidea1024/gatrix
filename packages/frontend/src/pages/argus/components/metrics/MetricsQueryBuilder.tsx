import React, { useMemo } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  IconButton,
  Tooltip,
  useTheme,
  alpha,
  TextField,
  Autocomplete,
} from '@mui/material';
import {
  Close as CloseIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  Calculate as CalculateIcon,
  Settings as SettingsIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import SingleSelectFilterChip from '@/components/common/SingleSelectFilterChip';
import PillSwitch from '@/components/common/PillSwitch';
import {
  getQueryColor,
  DEFAULT_AGG_BY_TYPE,
  type MetricQuery,
  type EquationQuery,
  type ChartConfig,
  type GroupByOption,
} from '../metricsHelpers';

interface MetricsQueryBuilderProps {
  queries: MetricQuery[];
  setQueries: React.Dispatch<React.SetStateAction<MetricQuery[]>>;
  equations: EquationQuery[];
  setEquations: React.Dispatch<React.SetStateAction<EquationQuery[]>>;
  chartConfig: ChartConfig;
  setChartConfig: React.Dispatch<React.SetStateAction<ChartConfig>>;
  urlState: any;
  setUrlState: (state: any) => void;
  metricNames: any[];
  metricTypes: Record<string, string>;
  setMetricTypes: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  setMetricUnits: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  groupByOptions: GroupByOption[];
  commonEnvironments: string[];
  commonReleases: string[];
  allowedIntervals: { value: string; label: string }[];
}

export const MetricsQueryBuilder: React.FC<MetricsQueryBuilderProps> = ({
  queries,
  setQueries,
  equations,
  setEquations,
  chartConfig,
  setChartConfig,
  urlState,
  setUrlState,
  metricNames,
  metricTypes,
  setMetricTypes,
  setMetricUnits,
  groupByOptions,
  commonEnvironments,
  commonReleases,
  allowedIntervals,
}) => {
  const theme = useTheme();
  const { t } = useTranslation();
  const isDark = theme.palette.mode === 'dark';

  const aggOptions = useMemo(() => [
    { value: 'avg', label: t('argus.metrics.agg.avg', 'Average') },
    { value: 'sum', label: t('argus.metrics.agg.sum', 'Sum') },
    { value: 'min', label: t('argus.metrics.agg.min', 'Minimum') },
    { value: 'max', label: t('argus.metrics.agg.max', 'Maximum') },
    { value: 'count', label: t('argus.metrics.agg.count', 'Count') },
    { value: 'p50', label: 'p50 (Median)' },
    { value: 'p75', label: 'p75' },
    { value: 'p90', label: 'p90' },
    { value: 'p95', label: 'p95' },
    { value: 'p99', label: 'p99' },
  ], [t]);

  const addQuery = () => {
    const nextId = String.fromCharCode(97 + queries.length);
    setQueries([
      ...queries,
      {
        id: nextId,
        metric: '',
        agg: 'avg',
        groupBy: '',
        filter: '',
        isHidden: false,
      },
    ]);
  };

  const addEquation = () => {
    const nextId = `f${equations.length + 1}`;
    setEquations([...equations, { id: nextId, equation: '', isHidden: false }]);
  };

  const updateQuery = (id: string, updates: Partial<MetricQuery>) => {
    setQueries(queries.map((q) => (q.id === id ? { ...q, ...updates } : q)));
  };

  const updateEquation = (id: string, updates: Partial<EquationQuery>) => {
    setEquations(
      equations.map((eq) => (eq.id === id ? { ...eq, ...updates } : eq))
    );
  };

  const removeQuery = (id: string) => {
    setQueries(queries.filter((q) => q.id !== id));
  };

  const removeEquation = (id: string) => {
    setEquations(equations.filter((eq) => eq.id !== id));
  };

  const getFilterSuggestions = (inputValue: string) => {
    if (!inputValue) {
      return groupByOptions.map((opt) => `${opt.key}=`);
    }

    const parts = inputValue.split(',');
    const currentPart = parts[parts.length - 1];
    const prefix = parts.slice(0, parts.length - 1).join(',');

    const eqIndex = currentPart.indexOf('=');
    if (eqIndex === -1) {
      return groupByOptions.map((opt) => {
        const pfx = prefix ? `${prefix.trim()}, ` : '';
        return `${pfx}${opt.key}=`;
      });
    } else {
      const key = currentPart.substring(0, eqIndex).trim();
      let commonVals: string[] = [];
      if (key === 'environment') {
        commonVals = commonEnvironments;
      } else if (key === 'release') {
        commonVals = commonReleases;
      }

      const pfx = prefix ? `${prefix.trim()}, ` : '';
      return commonVals.map((val) => `${pfx}${key}=${val}`);
    }
  };

  return (
    <Paper
      elevation={0}
      sx={{
        mb: 2,
        p: 2,
        borderRadius: 2,
        border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
        backgroundColor: isDark ? 'rgba(255,255,255,0.01)' : 'rgba(0,0,0,0.01)',
      }}
    >
      <Typography
        sx={{
          fontSize: '0.8rem',
          fontWeight: 700,
          mb: 1.5,
          display: 'flex',
          alignItems: 'center',
          gap: 1,
        }}
      >
        <SettingsIcon sx={{ fontSize: 16 }} /> {t('argus.metrics.queryBuilder', 'Query Builder')}
      </Typography>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {queries.map((q, idx) => (
          <Box key={q.id} sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box
              sx={{
                width: 24,
                height: 24,
                borderRadius: 1,
                backgroundColor: alpha(getQueryColor(idx), 0.1),
                color: getQueryColor(idx),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 800,
                fontSize: '0.75rem',
              }}
            >
              {q.id.toUpperCase()}
            </Box>

            <Autocomplete
              size="small"
              freeSolo
              options={metricNames.map((m) => m.name)}
              value={q.metric}
              onInputChange={(_, newVal) => updateQuery(q.id, { metric: newVal })}
              onChange={(_, newVal) => {
                if (newVal) {
                  const metaMatch = metricNames.find((m) => m.name === newVal);
                  const mType = metaMatch?.metric_type || metricTypes[newVal] || 'counter';
                  const defaultAgg = DEFAULT_AGG_BY_TYPE[mType] || 'avg';
                  updateQuery(q.id, { metric: newVal, agg: defaultAgg });
                }
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  placeholder={t('argus.metrics.selectMetric', 'Select metric...')}
                  sx={{
                    '& .MuiInputBase-root': {
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      width: 300,
                      backgroundColor: isDark ? 'rgba(0,0,0,0.2)' : '#fff',
                    },
                  }}
                />
              )}
            />

            <SingleSelectFilterChip
              label={t('argus.metrics.aggregation', 'Aggregation')}
              value={q.agg}
              onChange={(val) => updateQuery(q.id, { agg: val })}
              options={aggOptions}
            />

            <Autocomplete
              size="small"
              freeSolo
              multiple
              options={groupByOptions.map((o) => o.key)}
              value={q.groupBy ? q.groupBy.split(',').filter(Boolean) : []}
              onChange={(_, newVal) =>
                updateQuery(q.id, { groupBy: (newVal as string[]).join(',') })
              }
              renderInput={(params) => (
                <TextField
                  {...params}
                  placeholder={t('argus.metrics.groupBy', 'Group by...')}
                  sx={{
                    '& .MuiInputBase-root': {
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      minWidth: 200,
                      backgroundColor: isDark ? 'rgba(0,0,0,0.2)' : '#fff',
                    },
                  }}
                />
              )}
            />

            <Autocomplete
              size="small"
              freeSolo
              disableClearable
              filterOptions={(options) => options}
              options={getFilterSuggestions(q.filter || '')}
              value={q.filter || ''}
              inputValue={q.filter || ''}
              onInputChange={(_, newInputValue) => {
                updateQuery(q.id, { filter: newInputValue });
              }}
              onChange={(_, newValue) => {
                if (typeof newValue === 'string') {
                  updateQuery(q.id, { filter: newValue });
                }
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  placeholder={t('argus.metrics.filter', 'Filter: key=val,...')}
                  sx={{
                    '& .MuiInputBase-root': {
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      width: 220,
                      backgroundColor: isDark ? 'rgba(0,0,0,0.2)' : '#fff',
                    },
                  }}
                />
              )}
            />

            <Box sx={{ ml: 'auto', display: 'flex', gap: 0.5 }}>
              <Tooltip
                title={
                  q.isHidden
                    ? t('argus.metrics.showSeries', 'Show series')
                    : t('argus.metrics.hideSeries', 'Hide series')
                }
              >
                <IconButton
                  size="small"
                  onClick={() => updateQuery(q.id, { isHidden: !q.isHidden })}
                  sx={{ color: q.isHidden ? 'text.disabled' : getQueryColor(idx) }}
                >
                  {q.isHidden ? <VisibilityOffIcon sx={{ fontSize: 18 }} /> : <VisibilityIcon sx={{ fontSize: 18 }} />}
                </IconButton>
              </Tooltip>
              {queries.length > 1 && (
                <Tooltip title={t('argus.metrics.removeQuery', 'Remove query')}>
                  <IconButton
                    size="small"
                    onClick={() => removeQuery(q.id)}
                    sx={{ color: 'text.disabled', '&:hover': { color: 'error.main' } }}
                  >
                    <DeleteIcon sx={{ fontSize: 18 }} />
                  </IconButton>
                </Tooltip>
              )}
            </Box>
          </Box>
        ))}

        {equations.map((eq, idx) => (
          <Box key={eq.id} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mt: 0.5 }}>
            <Box
              sx={{
                width: 24,
                height: 24,
                borderRadius: 1,
                backgroundColor: alpha(getQueryColor(queries.length + idx), 0.1),
                color: getQueryColor(queries.length + idx),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 800,
                fontSize: '0.75rem',
              }}
            >
              {eq.id.toUpperCase()}
            </Box>

            <TextField
              size="small"
              placeholder={t('argus.metrics.equationPlaceholder', 'e.g. a / b * 100')}
              value={eq.equation}
              onChange={(e) => updateEquation(eq.id, { equation: e.target.value })}
              sx={{
                '& .MuiInputBase-root': {
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  width: 300,
                  backgroundColor: isDark ? 'rgba(0,0,0,0.2)' : '#fff',
                },
              }}
            />

            <Typography sx={{ fontSize: '0.7rem', color: 'text.disabled', ml: 1 }}>
              {t('argus.metrics.equationHelp', 'Use query IDs (a, b) and math operators (+, -, *, /)')}
            </Typography>

            <Box sx={{ ml: 'auto', display: 'flex', gap: 0.5 }}>
              <Tooltip
                title={
                  eq.isHidden
                    ? t('argus.metrics.showFormula', 'Show formula')
                    : t('argus.metrics.hideFormula', 'Hide formula')
                }
              >
                <IconButton
                  size="small"
                  onClick={() => updateEquation(eq.id, { isHidden: !eq.isHidden })}
                  sx={{ color: eq.isHidden ? 'text.disabled' : getQueryColor(queries.length + idx) }}
                >
                  {eq.isHidden ? <VisibilityOffIcon sx={{ fontSize: 18 }} /> : <VisibilityIcon sx={{ fontSize: 18 }} />}
                </IconButton>
              </Tooltip>
              <Tooltip title={t('argus.metrics.removeFormula', 'Remove formula')}>
                <IconButton
                  size="small"
                  onClick={() => removeEquation(eq.id)}
                  sx={{ color: 'text.disabled', '&:hover': { color: 'error.main' } }}
                >
                  <DeleteIcon sx={{ fontSize: 18 }} />
                </IconButton>
              </Tooltip>
            </Box>
          </Box>
        ))}

        <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
          <Button size="small" startIcon={<AddIcon />} onClick={addQuery} sx={{ textTransform: 'none', fontSize: '0.75rem', fontWeight: 600 }}>
            {t('argus.metrics.addQuery', 'Add Query')}
          </Button>
          <Button size="small" startIcon={<CalculateIcon />} onClick={addEquation} sx={{ textTransform: 'none', fontSize: '0.75rem', fontWeight: 600, color: 'text.secondary' }}>
            {t('argus.metrics.addEquation', 'Add Equation')}
          </Button>
        </Box>
      </Box>

      {/* Chart Configuration */}
      <Box
        sx={{
          mt: 3,
          pt: 2,
          borderTop: `1px dashed ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
          display: 'flex',
          alignItems: 'center',
          gap: 3,
        }}
      >
        <SingleSelectFilterChip
          label={t('argus.metrics.chartType', 'Chart Type:')}
          value={chartConfig.type}
          onChange={(val) => setChartConfig({ ...chartConfig, type: val as any })}
          options={[
            { value: 'line', label: t('argus.metrics.line', 'Line') },
            { value: 'stacked-line', label: t('argus.metrics.stackedLine', 'Stacked Line') },
            { value: 'area', label: t('argus.metrics.area', 'Area') },
            { value: 'stacked-area', label: t('argus.metrics.stackedArea', 'Stacked Area') },
            { value: 'bar', label: t('argus.metrics.bar', 'Bar') },
            { value: 'stacked-bar', label: t('argus.metrics.stackedBar', 'Stacked Bar') },
            { value: 'pie', label: t('argus.metrics.pie', 'Pie') },
            { value: 'doughnut', label: t('argus.metrics.doughnut', 'Doughnut') },
            { value: 'scatter', label: t('argus.metrics.scatter', 'Scatter') },
          ]}
        />
        <SingleSelectFilterChip
          label={t('argus.metrics.yAxis', 'Y-Axis:')}
          value={chartConfig.yAxisType}
          onChange={(val) => setChartConfig({ ...chartConfig, yAxisType: val as any })}
          options={[
            { value: 'linear', label: t('argus.metrics.linear', 'Linear') },
            { value: 'logarithmic', label: t('argus.metrics.logarithmic', 'Logarithmic') },
          ]}
        />
        <SingleSelectFilterChip
          label={t('argus.metrics.interval', 'Interval:')}
          value={urlState.interval || 'auto'}
          onChange={(val) => setUrlState({ interval: val })}
          options={allowedIntervals}
        />
        <PillSwitch
          checked={chartConfig.showLegend}
          onChange={() => setChartConfig({ ...chartConfig, showLegend: !chartConfig.showLegend })}
          label={t('argus.metrics.showLegend', '범례 표시')}
          size="small"
        />
      </Box>
    </Paper>
  );
};

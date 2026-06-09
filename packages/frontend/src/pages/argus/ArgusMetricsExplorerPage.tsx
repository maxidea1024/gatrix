import React, {
  useState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  Chip,
  IconButton,
  Tooltip,
  useTheme,
  alpha,
  CircularProgress,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  FormControl,
  Select,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Drawer,
  Autocomplete,
} from '@mui/material';
import {
  Search as SearchIcon,
  Close as CloseIcon,
  BarChart as MetricsIcon,
  ExpandMore as ExpandMoreIcon,
  TrendingUp as TrendUpIcon,
  TrendingDown as TrendDownIcon,
  ShowChart as ChartIcon,
  Bookmark as BookmarkIcon,
  BookmarkBorder as BookmarkBorderIcon,
  Save as SaveIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  Calculate as CalculateIcon,
  Settings as SettingsIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import PageContentLoader from '@/components/common/PageContentLoader';
import { TableSkeleton } from '@/components/argus/ArgusSkeletons';
import ArgusChartSkeleton from '@/components/argus/ArgusChartSkeleton';
import { ChartDataset } from '@/components/argus/InteractiveTimeSeriesChart';
import ArgusFilterBar, {
  ArgusFilterState,
  defaultArgusFilterState,
  argusFilterStateToApiParams,
} from '@/components/argus/ArgusFilterBar';
import SingleSelectFilterChip from '@/components/common/SingleSelectFilterChip';
import argusService, { ArgusSavedQuery } from '@/services/argusService';
import useArgusUrlState from '@/hooks/useArgusUrlState';
import { useLocation } from 'react-router-dom';
import ArgusBreadcrumbs from '@/components/argus/ArgusBreadcrumbs';
import { useOrgProject } from '@/contexts/OrgProjectContext';
import ExploreActions from '@/components/argus/ExploreActions';
import PageHeader from '@/components/common/PageHeader';
import EditablePageTitle from '@/components/common/EditablePageTitle';
import PillSwitch from '@/components/common/PillSwitch';
import EmptyPlaceholder from '@/components/common/EmptyPlaceholder';
import {
  MetricChart,
  getAggOptions,
  getQueryColor,
  type MetricQuery,
  type EquationQuery,
  type ChartConfig,
} from './components/metricsHelpers';



const ArgusMetricsExplorerPage: React.FC = () => {
  const theme = useTheme();
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const isDark = theme.palette.mode === 'dark';
  const { currentProject } = useOrgProject();
  const projectId = currentProject?.id || '1';

  const aggOptions = useMemo(() => getAggOptions(t), [t]);

  // ─── URL-driven state ───
  const URL_PARAMS = useMemo(
    () => ({
      period: {
        key: 'period',
        default: '14d',
        storageKey: 'argus-metrics-period',
      },
      start: { key: 'start', default: '' },
      end: { key: 'end', default: '' },
      queryId: { key: 'queryId', default: '' },
    }),
    []
  );
  const [urlState, setUrlState] = useArgusUrlState(URL_PARAMS);

  // Derive filters
  const [filters, setFilters] = useState<ArgusFilterState>(() => {
    if (urlState.period === 'custom' && urlState.start && urlState.end) {
      const base = defaultArgusFilterState('custom');
      base.dateRange = {
        type: 'custom',
        start: new Date(urlState.start),
        end: new Date(urlState.end),
      };
      return base;
    }
    return defaultArgusFilterState(urlState.period);
  });

  useEffect(() => {
    setFilters((prev) => {
      if (urlState.period === 'custom' && urlState.start && urlState.end) {
        return {
          ...prev,
          dateRange: {
            type: 'custom',
            start: new Date(urlState.start),
            end: new Date(urlState.end),
          },
        };
      }
      return {
        ...prev,
        dateRange: { type: 'preset', preset: urlState.period },
      };
    });
  }, [urlState.period, urlState.start, urlState.end]);

  const currentPeriod = useMemo(() => {
    if (filters.dateRange.type === 'preset' && filters.dateRange.preset)
      return filters.dateRange.preset;
    return '24h';
  }, [filters.dateRange]);

  // ─── State ───
  const defaultQueryName = t('argus.metrics.newQuery', 'New Metrics Dashboard');
  const [queryName, setQueryName] = useState(
    (location.state as any)?.queryName || defaultQueryName
  );

  const [queries, setQueries] = useState<MetricQuery[]>([
    { id: 'a', metric: '', agg: 'avg', groupBy: '', isHidden: false },
  ]);
  const [equations, setEquations] = useState<EquationQuery[]>([]);
  const [chartConfig, setChartConfig] = useState<ChartConfig>({
    type: 'line',
    yAxisType: 'linear',
    showLegend: true,
  });

  const [metricNames, setMetricNames] = useState<any[]>([]);
  const [queryResults, setQueryResults] = useState<
    Record<string, { timeSeries: any[]; summary: any }>
  >({});
  const [loading, setLoading] = useState(false);
  const [queryLoading, setQueryLoading] = useState(false);

  // Saved Queries State
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [savedQueries, setSavedQueries] = useState<ArgusSavedQuery[]>([]);
  const [savedPanelOpen, setSavedPanelOpen] = useState(false);
  const [currentQueryId, setCurrentQueryId] = useState<number | null>(null);

  // Sync URL queryId to state
  useEffect(() => {
    if (urlState.queryId && savedQueries.length > 0) {
      const qId = parseInt(urlState.queryId, 10);
      const matched = savedQueries.find((q) => q.id === qId);
      if (matched && currentQueryId !== qId) {
        handleLoadSavedQuery(matched);
      }
    }
  }, [urlState.queryId, savedQueries, currentQueryId]);

  // ─── Fetch ───
  const fetchMetricNames = useCallback(async () => {
    setLoading(true);
    try {
      const data = await argusService.getMetricNames(projectId, currentPeriod);
      setMetricNames(data);
    } catch (err) {
      console.error('Failed to fetch metric names', err);
    } finally {
      setLoading(false);
    }
  }, [projectId, currentPeriod]);

  const fetchMetricQueries = useCallback(async () => {
    const activeQueries = queries.filter((q) => q.metric);
    if (activeQueries.length === 0) {
      setQueryResults({});
      return;
    }
    setQueryLoading(true);
    try {
      const apiParams = argusFilterStateToApiParams(filters);

      const results: Record<string, any> = {};
      await Promise.all(
        activeQueries.map(async (q) => {
          const data = await argusService.queryMetric(projectId, {
            name: q.metric,
            period: apiParams.period || currentPeriod,
            agg: q.agg,
            groupBy: q.groupBy || undefined,
            start: apiParams.start,
            end: apiParams.end,
          });
          results[q.id] = data;
        })
      );
      setQueryResults(results);
    } catch (err) {
      console.error('Failed to query metric', err);
    } finally {
      setQueryLoading(false);
    }
  }, [projectId, filters, currentPeriod, queries]);

  useEffect(() => {
    fetchMetricNames();
    argusService
      .listSavedQueries(projectId, 'metrics' as any)
      .then(setSavedQueries)
      .catch(() => setSavedQueries([]));
  }, [fetchMetricNames, projectId]);

  // Trigger fetch when period or base queries change (excluding isHidden)
  useEffect(() => {
    fetchMetricQueries();
  }, [
    fetchMetricQueries,
    queries.map((q) => `${q.id}-${q.metric}-${q.agg}-${q.groupBy}`).join('|'),
  ]);

  // ─── Handlers ───
  const handleFilterChange = (newFilters: ArgusFilterState) => {
    setFilters(newFilters);
    if (newFilters.dateRange.type === 'preset' && newFilters.dateRange.preset) {
      setUrlState({ period: newFilters.dateRange.preset, start: '', end: '' });
    } else if (
      newFilters.dateRange.type === 'custom' &&
      newFilters.dateRange.start &&
      newFilters.dateRange.end
    ) {
      setUrlState({
        period: 'custom',
        start: newFilters.dateRange.start.toISOString(),
        end: newFilters.dateRange.end.toISOString(),
      });
    }
  };

  const handleZoom = useCallback(
    (start: string, end: string) => {
      setUrlState({ period: 'custom', start, end });
    },
    [setUrlState]
  );

  const addQuery = () => {
    const nextId = String.fromCharCode(97 + queries.length); // 'a', 'b', 'c'
    setQueries([
      ...queries,
      { id: nextId, metric: '', agg: 'avg', groupBy: '', isHidden: false },
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

  const handleSaveQuery = async () => {
    if (!saveName.trim()) return;
    try {
      const res = await argusService.createSavedQuery(projectId, {
        name: saveName.trim(),
        query_config: {
          queries,
          equations,
          chartConfig,
          period: currentPeriod,
        },
        display_type: 'chart',
        query_type: 'metrics' as any,
      });
      const updated = await argusService.listSavedQueries(
        projectId,
        'metrics' as any
      );
      setSavedQueries(updated);
      setQueryName(saveName.trim());
      if (res.id) setCurrentQueryId(res.id);
      setSaveDialogOpen(false);
      setSaveName('');
    } catch (err) {
      console.error('Failed to save metrics query:', err);
    }
  };

  const handleLoadSavedQuery = (sq: ArgusSavedQuery) => {
    const cfg =
      typeof sq.query_config === 'string'
        ? JSON.parse(sq.query_config)
        : sq.query_config;
    if (cfg.queries) setQueries(cfg.queries);
    if (cfg.equations) setEquations(cfg.equations);
    if (cfg.chartConfig) setChartConfig(cfg.chartConfig);
    if (cfg.period) setUrlState({ period: cfg.period });
    setQueryName(sq.name);
    setCurrentQueryId(sq.id);
    setSavedPanelOpen(false);
  };

  const handleDeleteSavedQuery = async (id: number) => {
    if (
      !window.confirm(
        t(
          'argus.metrics.confirmDelete',
          'Are you sure you want to delete this saved query?'
        )
      )
    )
      return;
    try {
      await argusService.deleteSavedQuery(projectId, id);
      setSavedQueries(savedQueries.filter((q) => q.id !== id));
      if (currentQueryId === id) {
        setCurrentQueryId(null);
        setQueryName(defaultQueryName);
      }
    } catch (err) {
      console.error('Failed to delete query:', err);
    }
  };

  // ─── Data Processing ───

  const { chartLabels, chartDatasets, buckets } = useMemo(() => {
    const allBuckets = new Set<string>();
    Object.values(queryResults).forEach((res) => {
      res.timeSeries.forEach((ts: any) => allBuckets.add(String(ts.bucket)));
    });
    const sortedBuckets = Array.from(allBuckets).sort();

    const formattedLabels = sortedBuckets.map((b) => {
      // Handle both ISO strings and stringified numeric timestamps
      const date = new Date(/^\d+$/.test(b) ? Number(b) : b);
      return date.toLocaleString(i18n.language || 'en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });
    });

    const datasets: ChartDataset[] = [];

    // Base Queries
    queries.forEach((q, idx) => {
      if (q.isHidden || !q.metric) return;
      const res = queryResults[q.id];
      if (!res) return;
      const bucketMap = new Map();
      res.timeSeries.forEach((ts: any) =>
        bucketMap.set(String(ts.bucket), Number(ts.value))
      );
      const data = sortedBuckets.map((b) => bucketMap.get(b) ?? 0);
      datasets.push({
        id: q.id,
        label: `[${q.id.toUpperCase()}] ${q.metric}`,
        data,
        type: chartConfig.type,
        color: getQueryColor(idx),
      });
    });

    // Equations
    equations.forEach((eq, idx) => {
      if (eq.isHidden || !eq.equation) return;
      const data = sortedBuckets.map((b) => {
        const context: Record<string, number> = {};
        queries.forEach((q) => {
          const res = queryResults[q.id];
          if (res) {
            const val = res.timeSeries.find(
              (ts: any) => ts.bucket === b
            )?.value;
            context[q.id] = val !== undefined ? Number(val) : 0;
          } else {
            context[q.id] = 0;
          }
        });
        try {
          let expr = eq.equation.toLowerCase();
          // Allowed chars: a-z (variables), digits, operators
          if (!/^[a-z0-9\s\+\-\*\/\(\)\.]+$/.test(expr)) return 0;
          Object.keys(context).forEach((key) => {
            const regex = new RegExp(`\\b${key}\\b`, 'g');
            expr = expr.replace(regex, String(context[key]));
          });
          // eslint-disable-next-line no-new-func
          const result = new Function(`return ${expr}`)();
          return isNaN(result) || !isFinite(result) ? 0 : result;
        } catch {
          return 0;
        }
      });
      datasets.push({
        id: eq.id,
        label: `[${eq.id.toUpperCase()}] ${eq.equation}`,
        data,
        type: chartConfig.type,
        color: getQueryColor(queries.length + idx),
      });
    });

    return {
      chartLabels: formattedLabels,
      chartDatasets: datasets,
      buckets: sortedBuckets,
    };
  }, [queryResults, queries, equations, chartConfig.type]);

  /* ═══ RENDER ═══ */
  return (
    <Box>
      <PageHeader
        icon={<MetricsIcon />}
        title={
          <ArgusBreadcrumbs
            size="title"
            paths={[
              {
                label: t('argus.explore.title', 'Explore'),
                to: `/argus/explore`,
              },
              {
                label: (
                  <EditablePageTitle
                    value={queryName}
                    onChange={setQueryName}
                    placeholder={defaultQueryName}
                  />
                ),
              },
            ]}
          />
        }
        subtitle={t(
          'argus.metrics.subtitle',
          'Build advanced metric dashboards and expressions'
        )}
        actions={
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <Tooltip
              title={t('argus.metrics.savedQueries', 'Saved Dashboards')}
            >
              <IconButton
                size="small"
                onClick={() => setSavedPanelOpen(true)}
                sx={{
                  color:
                    savedQueries.length > 0
                      ? theme.palette.primary.main
                      : 'text.secondary',
                }}
              >
                {savedQueries.length > 0 ? (
                  <BookmarkIcon sx={{ fontSize: 20 }} />
                ) : (
                  <BookmarkBorderIcon sx={{ fontSize: 20 }} />
                )}
              </IconButton>
            </Tooltip>
            <Button
              size="small"
              variant="outlined"
              startIcon={<SaveIcon sx={{ fontSize: 15 }} />}
              onClick={() => {
                setSaveName(queryName === defaultQueryName ? '' : queryName);
                setSaveDialogOpen(true);
              }}
              sx={{
                textTransform: 'none',
                fontSize: '0.75rem',
                fontWeight: 600,
                borderColor: isDark
                  ? 'rgba(255,255,255,0.12)'
                  : 'rgba(0,0,0,0.12)',
                borderRadius: '6px',
              }}
            >
              {t('argus.metrics.saveAs', 'Save as...')}
            </Button>
            <ExploreActions
              dataset="metrics"
              projectId={projectId}
              queryContext={{
                search: queries[0]?.metric,
                period: currentPeriod,
              }}
            />
          </Box>
        }
      />

      <ArgusFilterBar
        projectId={projectId}
        value={filters}
        onChange={handleFilterChange}
        onRefresh={() => {
          fetchMetricNames();
          fetchMetricQueries();
        }}
        loading={loading || queryLoading}
        hideFilters={['browser', 'os']}
      />

      {/* ═══ Query Builder ═══ */}
      <Paper
        elevation={0}
        sx={{
          mb: 2,
          p: 2,
          borderRadius: 2,
          border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
          backgroundColor: isDark
            ? 'rgba(255,255,255,0.01)'
            : 'rgba(0,0,0,0.01)',
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
          <SettingsIcon sx={{ fontSize: 16 }} />{' '}
          {t('argus.metrics.queryBuilder', 'Query Builder')}
        </Typography>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {/* Base Queries */}
          {queries.map((q, idx) => (
            <Box
              key={q.id}
              sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}
            >
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
                onInputChange={(_, newVal) =>
                  updateQuery(q.id, { metric: newVal })
                }
                onChange={(_, newVal) => {
                  if (newVal) updateQuery(q.id, { metric: newVal });
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    placeholder={t(
                      'argus.metrics.selectMetric',
                      'Select metric...'
                    )}
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

              <SingleSelectFilterChip
                label={t('argus.metrics.groupBy', 'Group by:')}
                value={q.groupBy}
                onChange={(val) => updateQuery(q.id, { groupBy: val })}
                options={[
                  { value: '', label: t('common.none', 'None') },
                  {
                    value: 'environment',
                    label: t('argus.metrics.environment', 'Environment'),
                  },
                  {
                    value: 'release',
                    label: t('argus.metrics.release', 'Release'),
                  },
                ]}
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
                    sx={{
                      color: q.isHidden ? 'text.disabled' : getQueryColor(idx),
                    }}
                  >
                    {q.isHidden ? (
                      <VisibilityOffIcon sx={{ fontSize: 18 }} />
                    ) : (
                      <VisibilityIcon sx={{ fontSize: 18 }} />
                    )}
                  </IconButton>
                </Tooltip>
                {queries.length > 1 && (
                  <Tooltip
                    title={t('argus.metrics.removeQuery', 'Remove query')}
                  >
                    <IconButton
                      size="small"
                      onClick={() => removeQuery(q.id)}
                      sx={{
                        color: 'text.disabled',
                        '&:hover': { color: 'error.main' },
                      }}
                    >
                      <DeleteIcon sx={{ fontSize: 18 }} />
                    </IconButton>
                  </Tooltip>
                )}
              </Box>
            </Box>
          ))}

          {/* Equations */}
          {equations.map((eq, idx) => (
            <Box
              key={eq.id}
              sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mt: 0.5 }}
            >
              <Box
                sx={{
                  width: 24,
                  height: 24,
                  borderRadius: 1,
                  backgroundColor: alpha(
                    getQueryColor(queries.length + idx),
                    0.1
                  ),
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
                placeholder={t(
                  'argus.metrics.equationPlaceholder',
                  'e.g. a / b * 100'
                )}
                value={eq.equation}
                onChange={(e) =>
                  updateEquation(eq.id, { equation: e.target.value })
                }
                sx={{
                  '& .MuiInputBase-root': {
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    width: 300,
                    backgroundColor: isDark ? 'rgba(0,0,0,0.2)' : '#fff',
                  },
                }}
              />

              <Typography
                sx={{ fontSize: '0.7rem', color: 'text.disabled', ml: 1 }}
              >
                {t(
                  'argus.metrics.equationHelp',
                  'Use query IDs (a, b) and math operators (+, -, *, /)'
                )}
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
                    onClick={() =>
                      updateEquation(eq.id, { isHidden: !eq.isHidden })
                    }
                    sx={{
                      color: eq.isHidden
                        ? 'text.disabled'
                        : getQueryColor(queries.length + idx),
                    }}
                  >
                    {eq.isHidden ? (
                      <VisibilityOffIcon sx={{ fontSize: 18 }} />
                    ) : (
                      <VisibilityIcon sx={{ fontSize: 18 }} />
                    )}
                  </IconButton>
                </Tooltip>
                <Tooltip
                  title={t('argus.metrics.removeFormula', 'Remove formula')}
                >
                  <IconButton
                    size="small"
                    onClick={() => removeEquation(eq.id)}
                    sx={{
                      color: 'text.disabled',
                      '&:hover': { color: 'error.main' },
                    }}
                  >
                    <DeleteIcon sx={{ fontSize: 18 }} />
                  </IconButton>
                </Tooltip>
              </Box>
            </Box>
          ))}

          <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
            <Button
              size="small"
              startIcon={<AddIcon />}
              onClick={addQuery}
              sx={{
                textTransform: 'none',
                fontSize: '0.75rem',
                fontWeight: 600,
              }}
            >
              {t('argus.metrics.addQuery', 'Add Query')}
            </Button>
            <Button
              size="small"
              startIcon={<CalculateIcon />}
              onClick={addEquation}
              sx={{
                textTransform: 'none',
                fontSize: '0.75rem',
                fontWeight: 600,
                color: 'text.secondary',
              }}
            >
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
            onChange={(val) =>
              setChartConfig({ ...chartConfig, type: val as any })
            }
            options={[
              { value: 'line', label: t('argus.metrics.line', 'Line') },
              { value: 'area', label: t('argus.metrics.area', 'Area') },
              { value: 'bar', label: t('argus.metrics.bar', 'Bar') },
            ]}
          />
          <SingleSelectFilterChip
            label={t('argus.metrics.yAxis', 'Y-Axis:')}
            value={chartConfig.yAxisType}
            onChange={(val) =>
              setChartConfig({ ...chartConfig, yAxisType: val as any })
            }
            options={[
              { value: 'linear', label: t('argus.metrics.linear', 'Linear') },
              {
                value: 'logarithmic',
                label: t('argus.metrics.logarithmic', 'Logarithmic'),
              },
            ]}
          />
          <PillSwitch
            checked={chartConfig.showLegend}
            onChange={() =>
              setChartConfig({
                ...chartConfig,
                showLegend: !chartConfig.showLegend,
              })
            }
            label={t('argus.metrics.showLegend', '범례 표시')}
            size="small"
          />
        </Box>
      </Paper>

      {/* ═══ Chart ═══ */}
      <PageContentLoader
        loading={queryLoading}
        skeleton={
          <ArgusChartSkeleton
            type={chartConfig.type === 'bar' ? 'bar' : 'line'}
            height={300}
            color={theme.palette.primary.main}
          />
        }
      >
        <MetricChart
          labels={chartLabels}
          datasets={chartDatasets}
          isDark={isDark}
          onZoom={handleZoom}
          config={chartConfig}
          buckets={buckets}
        />
      </PageContentLoader>

      {/* ═══ Data Table ═══ */}
      {chartLabels.length > 0 && (
        <Paper
          elevation={0}
          sx={{
            borderRadius: 2,
            overflow: 'hidden',
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
          }}
        >
          <Table
            size="small"
            sx={{
              '& td, & th': {
                borderColor: isDark
                  ? 'rgba(255,255,255,0.04)'
                  : 'rgba(0,0,0,0.04)',
              },
            }}
          >
            <TableHead>
              <TableRow>
                <TableCell
                  sx={{
                    fontWeight: 700,
                    fontSize: '0.7rem',
                    textTransform: 'uppercase',
                    py: 1,
                  }}
                >
                  {t('argus.metrics.timestamp', 'TIMESTAMP')}
                </TableCell>
                {chartDatasets.map((ds) => (
                  <TableCell
                    key={ds.id}
                    sx={{
                      fontWeight: 700,
                      fontSize: '0.7rem',
                      textTransform: 'uppercase',
                      py: 1,
                      color: ds.color,
                    }}
                  >
                    {ds.label}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {chartLabels.slice(0, 100).map((label, idx) => (
                <TableRow key={idx} hover>
                  <TableCell sx={{ py: 0.6 }}>
                    <Typography
                      sx={{ fontSize: '0.73rem', color: 'text.secondary' }}
                    >
                      {label}
                    </Typography>
                  </TableCell>
                  {chartDatasets.map((ds) => (
                    <TableCell key={ds.id} sx={{ py: 0.6 }}>
                      <Typography sx={{ fontSize: '0.73rem', fontWeight: 600 }}>
                        {Number(ds.data[idx]).toLocaleString(undefined, {
                          maximumFractionDigits: 2,
                        })}
                      </Typography>
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>
      )}

      {/* Save Query Dialog */}
      <Dialog
        open={saveDialogOpen}
        onClose={() => setSaveDialogOpen(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: 2.5 } }}
      >
        <DialogTitle
          sx={{
            fontWeight: 700,
            fontSize: '0.95rem',
            pb: 1,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          {t('argus.metrics.saveQuery', 'Save Metric Query')}
          <IconButton size="small" onClick={() => setSaveDialogOpen(false)}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            size="small"
            autoFocus
            label={t('argus.discover.queryName', 'Query Name')}
            value={saveName}
            onChange={(e) => setSaveName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSaveQuery();
            }}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            onClick={() => setSaveDialogOpen(false)}
            sx={{ textTransform: 'none' }}
          >
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button
            variant="contained"
            onClick={handleSaveQuery}
            disabled={!saveName.trim()}
            sx={{ textTransform: 'none', fontWeight: 700 }}
          >
            {t('common.save', 'Save')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Saved Queries Panel */}
      <Drawer
        anchor="right"
        open={savedPanelOpen}
        onClose={() => setSavedPanelOpen(false)}
        PaperProps={{ sx: { width: 340, p: 2 } }}
      >
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            mb: 2,
          }}
        >
          <Typography sx={{ fontWeight: 700, fontSize: '0.95rem' }}>
            {t('argus.metrics.savedQueries', 'Saved Dashboards')}
          </Typography>
          <IconButton size="small" onClick={() => setSavedPanelOpen(false)}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>
        {savedQueries.length === 0 ? (
          <EmptyPlaceholder message={t('argus.metrics.noSavedQueries')} />
        ) : (
          savedQueries.map((sq) => (
            <Paper
              key={sq.id}
              elevation={0}
              sx={{
                p: 1.5,
                mb: 1,
                borderRadius: 2,
                border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}`,
                cursor: 'pointer',
                '&:hover': {
                  borderColor: theme.palette.primary.main,
                  bgcolor: alpha(theme.palette.primary.main, 0.02),
                },
                display: 'flex',
                alignItems: 'center',
                gap: 1,
              }}
            >
              <Box
                sx={{ flex: 1, minWidth: 0 }}
                onClick={() => handleLoadSavedQuery(sq)}
              >
                <Typography
                  sx={{
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {sq.name}
                </Typography>
                <Typography sx={{ fontSize: '0.7rem', color: 'text.disabled' }}>
                  {sq.created_by} ·{' '}
                  {new Date(sq.created_at).toLocaleDateString()}
                </Typography>
              </Box>
              <IconButton
                size="small"
                onClick={() => handleDeleteSavedQuery(sq.id)}
                sx={{
                  color: 'text.disabled',
                  '&:hover': { color: 'error.main' },
                }}
              >
                <DeleteIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Paper>
          ))
        )}
      </Drawer>
    </Box>
  );
};

export default ArgusMetricsExplorerPage;

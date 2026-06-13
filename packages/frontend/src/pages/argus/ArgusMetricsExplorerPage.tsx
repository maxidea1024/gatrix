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
  Tabs,
  Tab,
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
import argusService, {
  ArgusSavedQuery,
  ArgusProject,
} from '@/services/argusService';
import useArgusUrlState from '@/hooks/useArgusUrlState';
import { useLocation } from 'react-router-dom';
import ArgusBreadcrumbs from '@/components/argus/ArgusBreadcrumbs';
import { useOrgProject } from '@/contexts/OrgProjectContext';
import ExploreActions from '@/components/argus/ExploreActions';
import PageHeader from '@/components/common/PageHeader';
import EditablePageTitle from '@/components/common/EditablePageTitle';
import PillSwitch from '@/components/common/PillSwitch';
import EmptyPlaceholder from '@/components/common/EmptyPlaceholder';
import SaveQueryDialog from '@/components/argus/SaveQueryDialog';
import DeleteQueryConfirmDialog from '@/components/argus/DeleteQueryConfirmDialog';
import { formatDateTimeUI, formatWith, formatDate } from '@/utils/dateFormat';
import { formatCompactNumber } from '@/utils/numberFormat';
import {
  MetricChart,
  getAggOptions,
  getQueryColor,
  formatMetricValue,
  parseChDate,
  DEFAULT_AGG_BY_TYPE,
  type MetricQuery,
  type EquationQuery,
  type ChartConfig,
  type GroupByOption,
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
      mq: { key: 'mq', default: '', type: 'array' as const },
      eq: { key: 'eq', default: '', type: 'array' as const },
      chartType: { key: 'chartType', default: 'line' },
      yAxisType: { key: 'yAxisType', default: 'linear' },
      legend: { key: 'legend', default: '1' },
      interval: {
        key: 'interval',
        default: 'auto',
        storageKey: 'argus-metrics-interval',
      },
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

  const allowedIntervals = useMemo(() => {
    let deltaSeconds = 0;
    if (filters.dateRange.type === 'preset' && filters.dateRange.preset) {
      const presetMap: Record<string, number> = {
        '1h': 3600,
        '24h': 86400,
        '48h': 2 * 86400,
        '7d': 7 * 86400,
        '14d': 14 * 86400,
        '30d': 30 * 86400,
      };
      deltaSeconds = presetMap[filters.dateRange.preset] || 14 * 86400;
    } else if (
      filters.dateRange.type === 'custom' &&
      filters.dateRange.start &&
      filters.dateRange.end
    ) {
      deltaSeconds =
        (filters.dateRange.end.getTime() - filters.dateRange.start.getTime()) /
        1000;
    }

    const options = [
      { value: 'auto', label: t('argus.metrics.intervalAuto', 'Auto') },
    ];

    if (deltaSeconds <= 86400) {
      options.push({ value: '1m', label: '1m' });
    }
    if (deltaSeconds <= 7 * 86400) {
      options.push({ value: '5m', label: '5m' });
    }
    if (deltaSeconds <= 30 * 86400) {
      options.push({ value: '15m', label: '15m' });
    }

    options.push(
      { value: '1h', label: '1h' },
      { value: '1d', label: '1d' },
      { value: '1w', label: '1w' }
    );

    return options;
  }, [filters.dateRange, t]);

  useEffect(() => {
    const isAllowed = allowedIntervals.some(
      (opt) => opt.value === urlState.interval
    );
    if (!isAllowed) {
      setUrlState({ interval: 'auto' });
    }
  }, [allowedIntervals, urlState.interval, setUrlState]);

  // ─── State — hydrated from URL ───
  const defaultQueryName = t('argus.metrics.newQuery', 'New Metrics Dashboard');
  const [queryName, setQueryName] = useState(
    (location.state as any)?.queryName || defaultQueryName
  );

  // Parse mq URL param: each entry is "metric|agg|groupBy"
  const [queries, setQueries] = useState<MetricQuery[]>(() => {
    const mqArr = urlState.mq as string[];
    if (mqArr && mqArr.length > 0 && mqArr[0] !== '') {
      return mqArr.map((entry, idx) => {
        const parts = entry.split('|');
        return {
          id: String.fromCharCode(97 + idx),
          metric: parts[0] || '',
          agg: parts[1] || 'avg',
          groupBy: parts[2] || '',
          filter: parts[3] || '',
          isHidden: false,
        };
      });
    }
    return [
      {
        id: 'a',
        metric: '',
        agg: 'avg',
        groupBy: '',
        filter: '',
        isHidden: false,
      },
    ];
  });

  const [equations, setEquations] = useState<EquationQuery[]>(() => {
    const eqArr = urlState.eq as string[];
    if (eqArr && eqArr.length > 0 && eqArr[0] !== '') {
      return eqArr.map((entry, idx) => ({
        id: `f${idx + 1}`,
        equation: entry,
        isHidden: false,
      }));
    }
    return [];
  });

  const [chartConfig, setChartConfig] = useState<ChartConfig>({
    type: (urlState.chartType as ChartConfig['type']) || 'line',
    yAxisType: (urlState.yAxisType as ChartConfig['yAxisType']) || 'linear',
    showLegend: urlState.legend !== '0',
  });

  // ─── Samples View state ───
  const [viewMode, setViewMode] = useState<'aggregates' | 'samples'>(
    'aggregates'
  );
  const [samplesData, setSamplesData] = useState<any[]>([]);
  const [samplesLoading, setSamplesLoading] = useState(false);
  const [groupByOptions, setGroupByOptions] = useState<GroupByOption[]>([]);
  const [metricUnits, setMetricUnits] = useState<Record<string, string>>({});
  const [metricTypes, setMetricTypes] = useState<Record<string, string>>({});
  const [project, setProject] = useState<ArgusProject | null>(null);

  useEffect(() => {
    argusService
      .getProject(projectId)
      .then(setProject)
      .catch(() => {});
  }, [projectId]);

  // ─── Sync queries/equations/chart config → URL ───
  const queriesUrlKey = queries
    .map((q) => `${q.metric}|${q.agg}|${q.groupBy}|${q.filter || ''}`)
    .join(',');
  const equationsUrlKey = equations.map((eq) => eq.equation).join(',');

  useEffect(() => {
    const mqArr = queries
      .filter((q) => q.metric)
      .map((q) => `${q.metric}|${q.agg}|${q.groupBy || ''}|${q.filter || ''}`);
    const eqArr = equations
      .filter((eq) => eq.equation)
      .map((eq) => eq.equation);

    setUrlState({
      mq: mqArr,
      eq: eqArr,
      chartType: chartConfig.type,
      yAxisType: chartConfig.yAxisType,
      legend: chartConfig.showLegend ? '1' : '0',
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    queriesUrlKey,
    equationsUrlKey,
    chartConfig.type,
    chartConfig.yAxisType,
    chartConfig.showLegend,
  ]);

  const [metricNames, setMetricNames] = useState<any[]>([]);
  const [queryResults, setQueryResults] = useState<
    Record<string, { timeSeries: any[]; summary: any }>
  >({});
  const totalSamples = useMemo(() => {
    let sum = 0;
    Object.values(queryResults).forEach((res: any) => {
      if (res?.summary?.total_points) {
        sum += Number(res.summary.total_points);
      }
    });
    return sum;
  }, [queryResults]);
  const [loading, setLoading] = useState(false);
  const [queryLoading, setQueryLoading] = useState(false);

  // Saved Queries State
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [saveDialogMode, setSaveDialogMode] = useState<'new' | 'saveAs'>('new');
  const [saveName, setSaveName] = useState('');
  const [savedQueries, setSavedQueries] = useState<ArgusSavedQuery[]>([]);
  const [savedPanelOpen, setSavedPanelOpen] = useState(false);
  const [currentQueryId, setCurrentQueryId] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ArgusSavedQuery | null>(
    null
  );

  const lastProcessedUrlQueryIdRef = useRef<string | undefined>(undefined);

  // Sync URL queryId to state
  useEffect(() => {
    if (urlState.queryId !== lastProcessedUrlQueryIdRef.current) {
      lastProcessedUrlQueryIdRef.current = urlState.queryId;
      if (urlState.queryId && savedQueries.length > 0) {
        const qId = parseInt(urlState.queryId, 10);
        const matched = savedQueries.find((q) => q.id === qId);
        if (matched && currentQueryId !== qId) {
          handleLoadSavedQuery(matched);
        }
      } else if (!urlState.queryId) {
        setCurrentQueryId(null);
      }
    }
  }, [urlState.queryId, savedQueries, currentQueryId]);

  // ─── Dirty state tracking ───
  type MetricsSnapshot = {
    queries: string;
    equations: string;
    chartConfig: string;
  };
  const [savedSnapshot, setSavedSnapshot] = useState<MetricsSnapshot | null>(
    null
  );

  const takeSnapshot = useCallback(() => {
    setSavedSnapshot({
      queries: JSON.stringify(queries),
      equations: JSON.stringify(equations),
      chartConfig: JSON.stringify(chartConfig),
    });
  }, [queries, equations, chartConfig]);

  const isDirty = useMemo(() => {
    if (!savedSnapshot) {
      // New state: always allow save (like VSCode empty file)
      return true;
    }
    return (
      JSON.stringify(queries) !== savedSnapshot.queries ||
      JSON.stringify(equations) !== savedSnapshot.equations ||
      JSON.stringify(chartConfig) !== savedSnapshot.chartConfig
    );
  }, [queries, equations, chartConfig, savedSnapshot]);

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

  const [commonEnvironments, setCommonEnvironments] = useState<string[]>([]);
  const [commonReleases, setCommonReleases] = useState<string[]>([]);

  // Fetch dynamic groupBy options when any metric changes
  const fetchGroupByOptions = useCallback(async () => {
    const firstMetric = queries.find((q) => q.metric)?.metric;
    try {
      const [options, tagData] = await Promise.all([
        argusService.getMetricGroupByOptions(projectId, firstMetric),
        firstMetric
          ? argusService.getMetricTags(projectId, {
              name: firstMetric,
              period: currentPeriod,
            })
          : Promise.resolve({ environment: [], release: [], metric_type: [] }),
      ]);
      setGroupByOptions(options as GroupByOption[]);
      setCommonEnvironments(
        (tagData.environment || []).map((e: any) => e.value).filter(Boolean)
      );
      setCommonReleases(
        (tagData.release || []).map((r: any) => r.value).filter(Boolean)
      );
    } catch {
      // fallback
      setGroupByOptions([
        { key: 'environment', source: 'column' },
        { key: 'release', source: 'column' },
      ]);
      setCommonEnvironments([]);
      setCommonReleases([]);
    }
  }, [projectId, queries.map((q) => q.metric).join(','), currentPeriod]);

  const getFilterSuggestions = useCallback(
    (inputValue: string) => {
      if (!inputValue) {
        return groupByOptions.map((opt) => `${opt.key}=`);
      }

      const parts = inputValue.split(',');
      const currentPart = parts[parts.length - 1];
      const prefix = parts.slice(0, parts.length - 1).join(',');

      const eqIndex = currentPart.indexOf('=');
      if (eqIndex === -1) {
        // Suggest keys
        return groupByOptions.map((opt) => {
          const pfx = prefix ? `${prefix.trim()}, ` : '';
          return `${pfx}${opt.key}=`;
        });
      } else {
        // Suggest values for the key
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
    },
    [groupByOptions, commonEnvironments, commonReleases]
  );

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
            filter: q.filter || undefined,
            groupLimit: project?.metrics_group_limit || 10,
            interval: urlState.interval,
          });
          results[q.id] = data;
          // Track metric type and unit from response
          if (data.metricType) {
            setMetricTypes((prev) => ({
              ...prev,
              [q.metric]: data.metricType!,
            }));
          }
          if (data.unit) {
            setMetricUnits((prev) => ({ ...prev, [q.metric]: data.unit! }));
          }
        })
      );
      setQueryResults(results);
    } catch (err) {
      console.error('Failed to query metric', err);
    } finally {
      setQueryLoading(false);
    }
  }, [
    projectId,
    filters,
    currentPeriod,
    queries,
    project?.metrics_group_limit,
    urlState.interval,
  ]);

  // Fetch samples for Samples view
  const fetchSamples = useCallback(async () => {
    const firstMetric = queries.find((q) => q.metric);
    if (!firstMetric?.metric) return;
    setSamplesLoading(true);
    try {
      const apiParams = argusFilterStateToApiParams(filters);
      const result = await argusService.getMetricSamples(projectId, {
        name: firstMetric.metric,
        period: apiParams.period || currentPeriod,
        start: apiParams.start,
        end: apiParams.end,
        filter: firstMetric.filter || undefined,
        limit: 100,
      });
      setSamplesData(result.data || []);
    } catch {
      setSamplesData([]);
    } finally {
      setSamplesLoading(false);
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
    fetchGroupByOptions();
  }, [
    fetchMetricQueries,
    fetchGroupByOptions,
    queries
      .map((q) => `${q.id}-${q.metric}-${q.agg}-${q.groupBy}-${q.filter || ''}`)
      .join('|'),
  ]);

  // Fetch samples when view switches to samples mode
  useEffect(() => {
    if (viewMode === 'samples') fetchSamples();
  }, [viewMode, fetchSamples]);

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

  const handleChartPointClick = useCallback(
    (timestamp: string, label: string) => {
      const date = parseChDate(timestamp);
      if (isNaN(date.getTime())) return;

      // Parse query ID from label, e.g., "[A] my.metric (group_val)"
      const match = label.match(
        /^\[([a-zA-Z0-9]+)\]\s*(.*?)(?:\s*\((.*?)\))?$/
      );
      if (!match) return;

      const qId = match[1].toLowerCase();
      const targetIndex = queries.findIndex((q) => q.id === qId);
      if (targetIndex === -1) return; // Equation or invalid query -> skip drilldown

      const start = new Date(date.getTime() - 30 * 60 * 1000).toISOString();
      const end = new Date(date.getTime() + 30 * 60 * 1000).toISOString();

      // Switch view mode and date range
      setViewMode('samples');
      setUrlState({
        period: 'custom',
        start,
        end,
      });

      const targetQuery = queries[targetIndex];
      let updatedFilter = targetQuery.filter || '';

      // If there's a group key, append it to filter
      const groupKeyStr = match[3];
      if (groupKeyStr && targetQuery.groupBy) {
        const keys = targetQuery.groupBy.split(',').filter(Boolean);
        const vals = groupKeyStr.split('/');
        const filterPairs: string[] = [];
        keys.forEach((k, i) => {
          const v = vals[i];
          if (v && v !== 'none') {
            filterPairs.push(`${k}=${v}`);
          }
        });

        if (filterPairs.length > 0) {
          // Parse existing filters
          const existing = updatedFilter
            ? updatedFilter
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean)
            : [];

          // Merge filters (avoid duplicates)
          const merged = [...existing];
          filterPairs.forEach((pair) => {
            const [k] = pair.split('=');
            const idx = merged.findIndex((item) => item.startsWith(`${k}=`));
            if (idx > -1) {
              merged[idx] = pair;
            } else {
              merged.push(pair);
            }
          });
          updatedFilter = merged.join(', ');
        }
      }

      // Reorder queries to make targetQuery first, and update filter
      const updatedQuery = { ...targetQuery, filter: updatedFilter };
      const otherQueries = queries.filter((q) => q.id !== qId);
      setQueries([updatedQuery, ...otherQueries]);
    },
    [queries, setQueries, setUrlState]
  );

  const addQuery = () => {
    const nextId = String.fromCharCode(97 + queries.length); // 'a', 'b', 'c'
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

  const buildQueryConfig = useCallback(
    () => ({
      queries,
      equations,
      chartConfig,
      period: currentPeriod,
    }),
    [queries, equations, chartConfig, currentPeriod]
  );

  // Save: update existing or prompt name for new
  const handleSave = useCallback(async () => {
    if (currentQueryId) {
      try {
        await argusService.updateSavedQuery(projectId, currentQueryId, {
          name: queryName,
          query_config: buildQueryConfig(),
        });
        const updated = await argusService.listSavedQueries(
          projectId,
          'metrics' as any
        );
        setSavedQueries(updated);
        takeSnapshot();
        lastProcessedUrlQueryIdRef.current = String(currentQueryId);
      } catch (err) {
        console.error('Failed to update saved query:', err);
      }
    } else if (queryName !== defaultQueryName && queryName.trim()) {
      const duplicate = savedQueries.find(
        (q) => q.name.toLowerCase() === queryName.trim().toLowerCase()
      );
      if (duplicate) {
        setSaveName(queryName.trim());
        setSaveDialogMode('new');
        setSaveDialogOpen(true);
      } else {
        try {
          const res = await argusService.createSavedQuery(projectId, {
            name: queryName.trim(),
            query_config: buildQueryConfig(),
            query_type: 'metrics' as any,
            display_type: 'chart',
          });
          if (res.id) {
            setCurrentQueryId(res.id);
            setUrlState({ queryId: String(res.id) });
          }
          const updated = await argusService.listSavedQueries(
            projectId,
            'metrics' as any
          );
          setSavedQueries(updated);
          takeSnapshot();
          lastProcessedUrlQueryIdRef.current = String(res.id);
        } catch (err) {
          console.error('Failed to create metrics query:', err);
        }
      }
    } else {
      // New state with default name: open name dialog
      setSaveName('');
      setSaveDialogMode('new');
      setSaveDialogOpen(true);
    }
  }, [
    currentQueryId,
    projectId,
    queryName,
    defaultQueryName,
    buildQueryConfig,
    takeSnapshot,
    setUrlState,
    savedQueries,
  ]);

  // Save As: always open name dialog
  const handleSaveAs = useCallback(() => {
    setSaveName(queryName === defaultQueryName ? '' : queryName);
    setSaveDialogMode('saveAs');
    setSaveDialogOpen(true);
  }, [queryName, defaultQueryName]);

  // Dialog save callback
  const handleDialogSave = useCallback(
    async (name: string, existingQueryId: number | null) => {
      try {
        if (existingQueryId) {
          // Overwrite existing query with same name
          await argusService.updateSavedQuery(projectId, existingQueryId, {
            name,
            query_config: buildQueryConfig(),
            display_type: 'chart',
          });
          setCurrentQueryId(existingQueryId);
          setQueryName(name);
          setUrlState({ queryId: String(existingQueryId) });
        } else {
          // Create new
          const res = await argusService.createSavedQuery(projectId, {
            name,
            query_config: buildQueryConfig(),
            display_type: 'chart',
            query_type: 'metrics' as any,
          });
          if (res.id) {
            setCurrentQueryId(res.id);
            setQueryName(name);
            setUrlState({ queryId: String(res.id) });
          }
        }
        const updated = await argusService.listSavedQueries(
          projectId,
          'metrics' as any
        );
        setSavedQueries(updated);

        takeSnapshot();
        setSaveDialogOpen(false);
        setSaveName('');
      } catch (err) {
        console.error('Failed to save metrics query:', err);
      }
    },
    [projectId, buildQueryConfig, setUrlState, takeSnapshot]
  );

  const handleRename = useCallback(
    async (newName: string) => {
      setQueryName(newName);
      const effectiveId =
        currentQueryId ||
        (urlState.queryId ? parseInt(urlState.queryId, 10) : null);
      if (effectiveId) {
        try {
          await argusService.updateSavedQuery(projectId, effectiveId, {
            name: newName,
          });
          const updated = await argusService.listSavedQueries(
            projectId,
            'metrics' as any
          );
          setSavedQueries(updated);
        } catch (err) {
          console.error('Failed to rename metrics query:', err);
        }
      }
    },
    [currentQueryId, projectId, urlState.queryId]
  );

  const handleLoadSavedQuery = useCallback(
    (sq: ArgusSavedQuery) => {
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
      setUrlState({ queryId: String(sq.id) });
      setSavedPanelOpen(false);
      // Set snapshot so isDirty starts as false
      setSavedSnapshot({
        queries: JSON.stringify(cfg.queries || []),
        equations: JSON.stringify(cfg.equations || []),
        chartConfig: JSON.stringify(cfg.chartConfig || {}),
      });
    },
    [setUrlState]
  );

  const handleDeleteSavedQuery = useCallback(
    (id: number) => {
      const target = savedQueries.find((q) => q.id === id);
      if (target) setDeleteTarget(target);
    },
    [savedQueries]
  );

  const confirmDelete = useCallback(async () => {
    if (!deleteTarget) return;
    try {
      await argusService.deleteSavedQuery(projectId, deleteTarget.id);
      setSavedQueries((prev) => prev.filter((q) => q.id !== deleteTarget.id));
      if (currentQueryId === deleteTarget.id) {
        setCurrentQueryId(null);
        setUrlState({ queryId: '' });
        setQueryName(defaultQueryName);
      }
    } catch (err) {
      console.error('Failed to delete query:', err);
    }
    setDeleteTarget(null);
  }, [deleteTarget, projectId, currentQueryId, setUrlState, defaultQueryName]);

  // ─── Data Processing ───

  const { chartLabels, chartDatasets, buckets } = useMemo(() => {
    const allBuckets = new Set<string>();
    Object.values(queryResults).forEach((res) => {
      res.timeSeries.forEach((ts: any) => allBuckets.add(String(ts.bucket)));
    });
    const sortedBuckets = Array.from(allBuckets).sort();

    const formattedLabels = sortedBuckets.map((b) => {
      const date = parseChDate(b);
      if (isNaN(date.getTime())) return b;
      return formatWith(date, 'MMM D HH:mm');
    });

    const datasets: ChartDataset[] = [];

    // Base Queries
    queries.forEach((q, idx) => {
      if (q.isHidden || !q.metric) return;
      const res = queryResults[q.id];
      if (!res) return;

      const groupByKeys = q.groupBy ? q.groupBy.split(',').filter(Boolean) : [];
      if (groupByKeys.length === 0) {
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
          color: getQueryColor(datasets.length),
        });
      } else {
        const groupSeriesMap = new Map<string, Map<string, number>>();
        res.timeSeries.forEach((ts: any) => {
          const groupVals = groupByKeys.map(
            (key) => ts[`group_${key}`] || 'none'
          );
          const groupKeyStr = groupVals.join('/');
          if (!groupSeriesMap.has(groupKeyStr)) {
            groupSeriesMap.set(groupKeyStr, new Map());
          }
          groupSeriesMap
            .get(groupKeyStr)!
            .set(String(ts.bucket), Number(ts.value));
        });

        // Sort groups by total/average sum to find the top N groups
        const groupSums = Array.from(groupSeriesMap.entries()).map(
          ([gKey, bucketMap]) => {
            let sum = 0;
            bucketMap.forEach((val) => {
              sum += val;
            });
            return { gKey, sum };
          }
        );

        // Sort descending
        groupSums.sort((a, b) => b.sum - a.sum);

        // Take top N groups according to project settings
        const limit = project?.metrics_group_limit || 10;
        const topGroups = groupSums.slice(0, limit);

        topGroups.forEach(({ gKey }) => {
          const bucketMap = groupSeriesMap.get(gKey)!;
          const data = sortedBuckets.map((b) => bucketMap.get(b) ?? 0);
          datasets.push({
            id: `${q.id}_${gKey}`,
            label: `[${q.id.toUpperCase()}] ${q.metric} (${gKey})`,
            data,
            type: chartConfig.type,
            color: getQueryColor(datasets.length),
          });
        });
      }
    });

    // Equations
    equations.forEach((eq, idx) => {
      if (eq.isHidden || !eq.equation) return;
      const data = sortedBuckets.map((b) => {
        const context: Record<string, number> = {};
        queries.forEach((q) => {
          const res = queryResults[q.id];
          if (res) {
            // Find sum of all matching buckets if grouped, or single value
            const matchedBuckets = res.timeSeries.filter(
              (ts: any) => ts.bucket === b
            );
            const sum = matchedBuckets.reduce(
              (acc: number, curr: any) => acc + Number(curr.value || 0),
              0
            );
            context[q.id] = sum;
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
        color: getQueryColor(datasets.length),
      });
    });

    return {
      chartLabels: formattedLabels,
      chartDatasets: datasets,
      buckets: sortedBuckets,
    };
  }, [
    queryResults,
    queries,
    equations,
    chartConfig.type,
    project?.metrics_group_limit,
  ]);

  const [displayedData, setDisplayedData] = useState<{
    chartLabels: string[];
    chartDatasets: ChartDataset[];
    buckets: string[];
    queries: MetricQuery[];
    metricUnits: Record<string, string>;
    metricTypes: Record<string, string>;
    totalSamples: number;
  }>(() => ({
    chartLabels: [],
    chartDatasets: [],
    buckets: [],
    queries: [],
    metricUnits: {},
    metricTypes: {},
    totalSamples: 0,
  }));

  useEffect(() => {
    const activeQueries = queries.filter((q) => q.metric);
    if (!queryLoading || activeQueries.length === 0) {
      setDisplayedData({
        chartLabels,
        chartDatasets,
        buckets,
        queries,
        metricUnits,
        metricTypes,
        totalSamples,
      });
    }
  }, [
    queryLoading,
    chartLabels,
    chartDatasets,
    buckets,
    queries,
    metricUnits,
    metricTypes,
    totalSamples,
  ]);

  const [displayedSamplesData, setDisplayedSamplesData] = useState<any[]>([]);

  useEffect(() => {
    const activeQueries = queries.filter((q) => q.metric);
    if (!samplesLoading || activeQueries.length === 0) {
      setDisplayedSamplesData(samplesData);
    }
  }, [samplesLoading, samplesData, queries]);

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
                    onChange={handleRename}
                    placeholder={defaultQueryName}
                  />
                ),
              },
            ]}
          />
        }
        titleUpdateTrigger={queryName}
        actionsUpdateTrigger={`${isDirty}-${currentQueryId}`}
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
            {currentQueryId && (
              <Button
                size="small"
                variant="contained"
                startIcon={<SaveIcon sx={{ fontSize: 15 }} />}
                onClick={handleSave}
                disabled={!isDirty}
                sx={{
                  textTransform: 'none',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  borderRadius: '6px',
                }}
              >
                {t('argus.metrics.save', 'Save')}
              </Button>
            )}
            {!currentQueryId && (
              <Button
                size="small"
                variant="contained"
                startIcon={<SaveIcon sx={{ fontSize: 15 }} />}
                onClick={handleSave}
                disabled={!isDirty}
                sx={{
                  textTransform: 'none',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  borderRadius: '6px',
                }}
              >
                {t('argus.metrics.save', 'Save')}
              </Button>
            )}
            <Button
              size="small"
              variant="outlined"
              startIcon={<SaveIcon sx={{ fontSize: 15 }} />}
              onClick={handleSaveAs}
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
                  if (newVal) {
                    // Auto-set default aggregation based on metric_type
                    const metaMatch = metricNames.find(
                      (m) => m.name === newVal
                    );
                    const mType =
                      metaMatch?.metric_type ||
                      metricTypes[newVal] ||
                      'counter';
                    const defaultAgg = DEFAULT_AGG_BY_TYPE[mType] || 'avg';
                    updateQuery(q.id, { metric: newVal, agg: defaultAgg });
                  }
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
                    placeholder={t(
                      'argus.metrics.filter',
                      'Filter: key=val,...'
                    )}
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
              {
                value: 'stacked-line',
                label: t('argus.metrics.stackedLine', 'Stacked Line'),
              },
              { value: 'area', label: t('argus.metrics.area', 'Area') },
              {
                value: 'stacked-area',
                label: t('argus.metrics.stackedArea', 'Stacked Area'),
              },
              { value: 'bar', label: t('argus.metrics.bar', 'Bar') },
              {
                value: 'stacked-bar',
                label: t('argus.metrics.stackedBar', 'Stacked Bar'),
              },
              { value: 'pie', label: t('argus.metrics.pie', 'Pie') },
              {
                value: 'doughnut',
                label: t('argus.metrics.doughnut', 'Doughnut'),
              },
              {
                value: 'scatter',
                label: t('argus.metrics.scatter', 'Scatter'),
              },
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
          <SingleSelectFilterChip
            label={t('argus.metrics.interval', 'Interval:')}
            value={urlState.interval || 'auto'}
            onChange={(val) => setUrlState({ interval: val })}
            options={allowedIntervals}
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

      {/* ═══ View Mode Toggle ═══ */}
      <Box
        sx={{
          mb: 2,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Tabs
          value={viewMode}
          onChange={(_, val) => setViewMode(val)}
          sx={{
            minHeight: 0,
            backgroundColor: isDark
              ? 'rgba(255,255,255,0.03)'
              : 'rgba(0,0,0,0.03)',
            borderRadius: '8px',
            p: 0.5,
            '& .MuiTabs-indicator': {
              display: 'none',
            },
            '& .MuiTab-root': {
              minHeight: 0,
              minWidth: 'auto',
              px: 2,
              py: 0.5,
              fontSize: '0.8rem',
              fontWeight: 600,
              textTransform: 'none',
              borderRadius: '6px',
              color: 'text.secondary',
              '&.Mui-selected': {
                color: isDark ? '#fff' : '#000',
                backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#fff',
                boxShadow: isDark ? 'none' : '0px 1px 3px rgba(0,0,0,0.1)',
              },
            },
          }}
        >
          <Tab
            value="aggregates"
            label={t('argus.metrics.aggregates', 'Aggregates')}
          />
          <Tab value="samples" label={t('argus.metrics.samples', 'Samples')} />
        </Tabs>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography
            sx={{
              fontSize: '0.78rem',
              color: 'text.secondary',
              fontWeight: 500,
            }}
          >
            {viewMode === 'aggregates' ? (
              <>
                {t('argus.metrics.aggregatedSamplesCount', '집계된 샘플 수:')}{' '}
                <Box
                  component="span"
                  sx={{ fontWeight: 600, color: 'text.primary' }}
                >
                  {formatCompactNumber(displayedData.totalSamples)}
                </Box>
              </>
            ) : (
              <>
                {t('argus.metrics.showingSamplesCount', '표시 중인 샘플 수:')}{' '}
                <Box
                  component="span"
                  sx={{ fontWeight: 600, color: 'text.primary' }}
                >
                  {formatCompactNumber(displayedSamplesData.length)}
                </Box>
              </>
            )}
          </Typography>
        </Box>
      </Box>

      {viewMode === 'aggregates' ? (
        <Box
          sx={{
            position: 'relative',
            opacity: queryLoading ? 0.65 : 1,
            transition: 'opacity 0.15s ease-in-out',
            pointerEvents: queryLoading ? 'none' : 'auto',
          }}
        >
          {/* ═══ Chart ═══ */}
          <PageContentLoader
            loading={queryLoading && displayedData.chartLabels.length === 0}
            skeleton={
              <ArgusChartSkeleton
                type={chartConfig.type === 'bar' ? 'bar' : 'line'}
                height={300}
                color={theme.palette.primary.main}
              />
            }
          >
            <MetricChart
              labels={displayedData.chartLabels}
              datasets={displayedData.chartDatasets}
              isDark={isDark}
              onZoom={handleZoom}
              config={chartConfig}
              buckets={displayedData.buckets}
              onPointClick={handleChartPointClick}
            />
          </PageContentLoader>

          {/* ═══ Aggregated Data Table ═══ */}
          {displayedData.chartLabels.length > 0 && (
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
                    {displayedData.chartDatasets.map((ds) => (
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
                  {displayedData.chartLabels.slice(0, 100).map((label, idx) => {
                    return (
                      <TableRow key={idx} hover>
                        <TableCell sx={{ py: 0.6 }}>
                          <Typography
                            sx={{
                              fontSize: '0.73rem',
                              color: 'text.secondary',
                            }}
                          >
                            {formatDateTimeUI(
                              parseChDate(displayedData.buckets[idx])
                            )}
                          </Typography>
                        </TableCell>
                        {displayedData.chartDatasets.map((ds) => {
                          const qId = ds.id.split('_')[0];
                          const queryObj = displayedData.queries.find(
                            (q) => q.id === qId
                          );
                          const metricName = queryObj?.metric;
                          const unit = metricName
                            ? displayedData.metricUnits[metricName]
                            : undefined;
                          const metricType = metricName
                            ? displayedData.metricTypes[metricName]
                            : undefined;
                          return (
                            <TableCell key={ds.id} sx={{ py: 0.6 }}>
                              <Typography
                                sx={{ fontSize: '0.73rem', fontWeight: 600 }}
                              >
                                {formatMetricValue(
                                  Number(ds.data[idx]),
                                  unit,
                                  metricType
                                )}
                              </Typography>
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Paper>
          )}
        </Box>
      ) : (
        /* ═══ Samples View ═══ */
        <Box
          sx={{
            position: 'relative',
            opacity: samplesLoading ? 0.65 : 1,
            transition: 'opacity 0.15s ease-in-out',
            pointerEvents: samplesLoading ? 'none' : 'auto',
          }}
        >
          <PageContentLoader
            loading={samplesLoading && displayedSamplesData.length === 0}
            skeleton={<TableSkeleton rows={10} cols={7} />}
          >
            {displayedSamplesData.length === 0 ? (
              <EmptyPlaceholder
                message={t(
                  'argus.metrics.noSamples',
                  'No metric samples found. Select a metric to view individual events.'
                )}
                minHeight={200}
              />
            ) : (
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
                      {[
                        'Timestamp',
                        'Name',
                        'Type',
                        'Value',
                        'Unit',
                        'Environment',
                        'Release',
                      ].map((h) => (
                        <TableCell
                          key={h}
                          sx={{
                            fontWeight: 700,
                            fontSize: '0.7rem',
                            textTransform: 'uppercase',
                            py: 1,
                          }}
                        >
                          {h}
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {displayedSamplesData.map((row, idx) => {
                      const ts = parseChDate(String(row.timestamp));
                      const valRaw =
                        typeof row.value === 'object'
                          ? JSON.stringify(row.value)
                          : row.value;
                      return (
                        <TableRow key={idx} hover>
                          <TableCell sx={{ py: 0.6 }}>
                            <Typography
                              sx={{
                                fontSize: '0.73rem',
                                color: 'text.secondary',
                              }}
                            >
                              {formatDateTimeUI(row.timestamp)}
                            </Typography>
                          </TableCell>
                          <TableCell sx={{ py: 0.6 }}>
                            <Typography
                              sx={{ fontSize: '0.73rem', fontWeight: 600 }}
                            >
                              {row.name}
                            </Typography>
                          </TableCell>
                          <TableCell sx={{ py: 0.6 }}>
                            <Typography
                              sx={{
                                fontSize: '0.7rem',
                                px: 0.8,
                                py: 0.2,
                                borderRadius: 1,
                                backgroundColor: alpha(
                                  theme.palette.primary.main,
                                  0.08
                                ),
                                display: 'inline-block',
                              }}
                            >
                              {row.metric_type}
                            </Typography>
                          </TableCell>
                          <TableCell sx={{ py: 0.6 }}>
                            <Typography
                              sx={{ fontSize: '0.73rem', fontWeight: 600 }}
                            >
                              {formatMetricValue(
                                Number(valRaw),
                                row.unit,
                                row.metric_type
                              )}
                            </Typography>
                          </TableCell>
                          <TableCell sx={{ py: 0.6 }}>
                            <Typography
                              sx={{
                                fontSize: '0.73rem',
                                color: 'text.secondary',
                              }}
                            >
                              {row.unit || '—'}
                            </Typography>
                          </TableCell>
                          <TableCell sx={{ py: 0.6 }}>
                            <Typography sx={{ fontSize: '0.73rem' }}>
                              {row.environment || '—'}
                            </Typography>
                          </TableCell>
                          <TableCell sx={{ py: 0.6 }}>
                            <Typography sx={{ fontSize: '0.73rem' }}>
                              {row.release || '—'}
                            </Typography>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </Paper>
            )}
          </PageContentLoader>
        </Box>
      )}

      {/* Save / Save As Dialog */}
      <SaveQueryDialog
        open={saveDialogOpen}
        onClose={() => setSaveDialogOpen(false)}
        name={saveName}
        onNameChange={setSaveName}
        onSave={handleDialogSave}
        mode={saveDialogMode}
        savedQueries={savedQueries}
        currentQueryId={currentQueryId}
      />

      {/* Delete Confirm Dialog */}
      <DeleteQueryConfirmDialog
        open={!!deleteTarget}
        queryName={deleteTarget?.name || ''}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
      />

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
                  {sq.created_by} · {formatDate(sq.created_at)}
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

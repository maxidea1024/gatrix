/**
 * Feature Network Page
 * Displays SDK API traffic data (features/segments requests)
 * Similar to Unleash Network dashboard
 */

import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  ToggleButton,
  ToggleButtonGroup,
  Card,
  CardContent,
  Skeleton,
  IconButton,
  Tooltip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Collapse,
  Tabs,
  Tab,
  Chip,
  keyframes,
} from '@mui/material';
import DateRangeSelector, {
  DateRangeValue,
  dateRangeToDatePair,
  presetToHours,
} from '@/components/common/DateRangeSelector';
import {
  Refresh as RefreshIcon,
  Hub as HubIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  TrendingUp as TrendingUpIcon,
  Apps as AppsIcon,
  Speed as SpeedIcon,
  Flag as FlagIcon,
  Category as CategoryIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';

import api from '../../services/api';
import PageContentLoader from '@/components/common/PageContentLoader';
import PageHeader from '@/components/common/PageHeader';
import PageHeaderContextMenu from '@/components/common/PageHeaderContextMenu';
import MultiSelectFilterChip from '@/components/common/MultiSelectFilterChip';
import ArgusVolumeChart from '@/components/argus/ArgusVolumeChart';
import { ChartDataset } from '@/components/argus/InteractiveTimeSeriesChart';
import EnvironmentTreeFilterChip from '@/components/common/EnvironmentTreeFilterChip';
import SimplePagination from '@/components/common/SimplePagination';
import { useGlobalPageSize } from '@/hooks/useGlobalPageSize';

// Types
interface TrafficDataPoint {
  bucket: string;
  displayTime: string;
  environmentId: string;
  appName: string;
  featuresCount: number;
  segmentsCount: number;
  totalCount: number;
}

interface TrafficSummary {
  totalRequests: number;
  featuresCount: number;
  segmentsCount: number;
  activeApplications: number;
  avgRequestsPerHour: number;
}

interface EvaluationSummary {
  totalEvaluations: number;
  yesCount: number;
  noCount: number;
}

// Chart data point grouped by app
interface ChartDataPointByApp {
  bucket: string;
  displayTime: string;
  environmentId: string;
  appName: string;
  featuresCount: number;
  segmentsCount: number;
  totalCount: number;
}

// Evaluation time series data point
interface EvaluationTimeSeriesPoint {
  bucket: string;
  displayTime: string;
  evaluations: number;
  yesCount: number;
  noCount: number;
}

// Evaluation time series data point grouped by app
interface EvaluationTimeSeriesPointByApp {
  bucket: string;
  displayTime: string;
  environmentId: string;
  environmentName: string;
  projectName: string;
  orgName: string;
  appName: string;
  evaluations: number;
  yesCount: number;
  noCount: number;
}

// Evaluation time series data point grouped by flag
interface EvaluationTimeSeriesPointByFlag {
  bucket: string;
  displayTime: string;
  flagName: string;
  evaluations: number;
}

// Global environment info with org/project
interface GlobalEnvironment {
  environmentId: string;
  environmentName: string;
  environmentType: string;
  projectId: string;
  projectName: string;
  orgId: string;
  orgName: string;
}

// Global API base path (not project-scoped)
const GLOBAL_API_PATH = '/admin/network';

const spin = keyframes`
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
`;

const FeatureNetworkPage: React.FC = () => {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();

  // Global environments (all accessible orgs/projects/envs)
  const [globalEnvs, setGlobalEnvs] = useState<GlobalEnvironment[]>([]);
  const [globalEnvsLoaded, setGlobalEnvsLoaded] = useState(false);

  // Lookup map: environmentId -> displayName
  const envNameMap = useMemo(
    () =>
      new Map(
        globalEnvs.map((e) => [
          e.environmentId,
          e.environmentName || e.environmentId,
        ])
      ),
    [globalEnvs]
  );

  // Lookup map: environmentId -> org/project/env full path (for chart labels)
  const envFullPathMap = useMemo(
    () =>
      new Map(
        globalEnvs.map((e) => [
          e.environmentId,
          `${e.orgName}/${e.projectName}/${e.environmentName}`,
        ])
      ),
    [globalEnvs]
  );

  // Lookup maps: environmentId -> projectName / orgName (for table columns)
  const envProjectMap = useMemo(
    () =>
      new Map(globalEnvs.map((e) => [e.environmentId, e.projectName || '-'])),
    [globalEnvs]
  );
  const envOrgMap = useMemo(
    () => new Map(globalEnvs.map((e) => [e.environmentId, e.orgName || '-'])),
    [globalEnvs]
  );

  // State - initialize from URL params
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const hasLoadedRef = useRef(false);
  const [trafficData, setTrafficData] = useState<TrafficDataPoint[]>([]);
  const [chartDataByApp, setChartDataByApp] = useState<ChartDataPointByApp[]>(
    []
  );
  const [summary, setSummary] = useState<TrafficSummary | null>(null);
  const [evaluations, setEvaluations] = useState<EvaluationSummary | null>(
    null
  );
  const [evaluationTimeSeries, setEvaluationTimeSeries] = useState<
    EvaluationTimeSeriesPoint[]
  >([]);
  const [evaluationTimeSeriesByApp, setEvaluationTimeSeriesByApp] = useState<
    EvaluationTimeSeriesPointByApp[]
  >([]);
  const [evaluationTimeSeriesByFlag, setEvaluationTimeSeriesByFlag] = useState<
    EvaluationTimeSeriesPointByFlag[]
  >([]);
  const [applications, setApplications] = useState<string[]>([]);
  const [initialEnvLoad, setInitialEnvLoad] = useState(true);
  const [selectedEnvironments, setSelectedEnvironments] = useState<string[]>(
    () => {
      const envParam = searchParams.get('environments');
      return envParam ? envParam.split(',') : [];
    }
  );
  const [selectedApps, setSelectedApps] = useState<string[]>(() => {
    const appsParam = searchParams.get('apps');
    return appsParam ? appsParam.split(',') : [];
  });
  const [dateRange, setDateRange] = useState<DateRangeValue>(() => ({
    type: 'preset',
    preset: searchParams.get('range') || '7d',
  }));
  const [showTable, setShowTable] = useState(true);
  const [showEvalTable, setShowEvalTable] = useState(true);

  // Pagination state for detail tables
  const [trafficPage, setTrafficPage] = useState(0);
  const [evalPage, setEvalPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useGlobalPageSize();

  // Reset pagination when data changes
  useEffect(() => {
    setTrafficPage(0);
  }, [trafficData]);
  useEffect(() => {
    setEvalPage(0);
  }, [evaluationTimeSeriesByApp]);

  const [appsLoaded, setAppsLoaded] = useState(false);
  const [activeTab, setActiveTab] = useState(() => {
    const tabParam = searchParams.get('tab');
    return tabParam === '1' ? 1 : 0;
  });
  const [chartGroupBy, setChartGroupBy] = useState<
    'all' | 'app' | 'env' | 'flag'
  >(() => {
    const groupParam = searchParams.get('groupBy');
    if (groupParam === 'env') return 'env';
    if (groupParam === 'app') return 'app';
    if (groupParam === 'flag') return 'flag';
    return 'all';
  });

  // Reset grouping to 'all' if 'flag' is active and user switches to API Requests tab
  useEffect(() => {
    if (activeTab === 0 && chartGroupBy === 'flag') {
      setChartGroupBy('all');
    }
  }, [activeTab, chartGroupBy]);

  // Fetch global environments on mount
  useEffect(() => {
    const fetchGlobalEnvs = async () => {
      try {
        const res = await api.get<{ environments: GlobalEnvironment[] }>(
          `${GLOBAL_API_PATH}/environments`
        );
        const envs = res.data?.environments || [];
        setGlobalEnvs(envs);
        setGlobalEnvsLoaded(true);
      } catch (error) {
        console.error('Failed to fetch global environments:', error);
        setGlobalEnvsLoaded(true);
      }
    };
    fetchGlobalEnvs();
  }, []);

  // Get time range dates
  const getTimeRange = useCallback(() => {
    const { start, end } = dateRangeToDatePair(dateRange);
    return { startDate: start, endDate: end };
  }, [dateRange]);

  // Update URL params when filters change
  useEffect(() => {
    const params = new URLSearchParams();
    if (
      selectedEnvironments.length > 0 &&
      selectedEnvironments.length < globalEnvs.length
    ) {
      params.set('environments', selectedEnvironments.join(','));
    }
    if (selectedApps.length > 0 && selectedApps.length < applications.length) {
      params.set('apps', selectedApps.join(','));
    }
    const preset =
      dateRange.type === 'preset' ? dateRange.preset || '24h' : 'custom';
    if (preset !== '24h') {
      params.set('range', preset);
    }
    if (activeTab !== 0) {
      params.set('tab', String(activeTab));
    }
    if (chartGroupBy !== 'all') {
      params.set('groupBy', chartGroupBy);
    }
    setSearchParams(params, { replace: true });
  }, [
    selectedEnvironments,
    selectedApps,
    dateRange,
    activeTab,
    chartGroupBy,
    globalEnvs.length,
    applications.length,
    setSearchParams,
  ]);

  // Fetch applications list
  const fetchApplications = useCallback(async () => {
    try {
      const { startDate, endDate } = getTimeRange();
      const params = new URLSearchParams({
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      });

      // Get apps for selected environments
      if (selectedEnvironments.length > 0) {
        params.set('environments', selectedEnvironments.join(','));
      }

      const appsRes = await api.get<{ applications: string[] }>(
        `${GLOBAL_API_PATH}/applications?${params}`
      );
      const appsList = appsRes.data?.applications || [];
      setApplications(appsList);

      if (!appsLoaded && appsList.length > 0) {
        // First load: select all apps
        setSelectedApps(appsList);
        setAppsLoaded(true);
      } else if (appsLoaded) {
        // Subsequent loads: keep only valid selections, or select all if none remain
        setSelectedApps((prev) => {
          const validApps = prev.filter((a) => appsList.includes(a));
          return validApps.length > 0 ? validApps : appsList;
        });
      }
    } catch (error) {
      console.error('Failed to fetch applications:', error);
    }
  }, [getTimeRange, selectedEnvironments, appsLoaded]);

  // Fetch traffic data
  const fetchData = useCallback(async () => {
    if (!hasLoadedRef.current) {
      setLoading(true);
    } else {
      setIsRefreshing(true);
    }
    try {
      // If no environments selected, show no data
      if (selectedEnvironments.length === 0) {
        setTrafficData([]);
        setChartDataByApp([]);
        setSummary(null);
        setEvaluations(null);
        setEvaluationTimeSeries([]);
        setEvaluationTimeSeriesByApp([]);
        setEvaluationTimeSeriesByFlag([]);
        return;
      }

      const { startDate, endDate } = getTimeRange();
      const params = new URLSearchParams({
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      });

      if (selectedEnvironments.length > 0) {
        params.set('environments', selectedEnvironments.join(','));
      }
      if (selectedApps.length > 0) {
        params.set('appNames', selectedApps.join(','));
      }

      // Evaluations use environment-only params (no appNames filter)
      const evalParams = new URLSearchParams({
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      });
      if (selectedEnvironments.length > 0) {
        evalParams.set('environments', selectedEnvironments.join(','));
      }

      // Fetch all data from global API in parallel
      const [
        trafficRes,
        aggregatedRes,
        aggregatedByAppRes,
        summaryRes,
        evaluationsRes,
        evalTimeSeriesRes,
        evalTimeSeriesByAppRes,
        evalTimeSeriesByFlagRes,
      ] = await Promise.all([
        api.get<{ traffic: TrafficDataPoint[] }>(
          `${GLOBAL_API_PATH}/traffic?${params}`
        ),
        api.get<{ traffic: ChartDataPointByApp[] }>(
          `${GLOBAL_API_PATH}/traffic/aggregated?${params}`
        ),
        api.get<{ traffic: ChartDataPointByApp[] }>(
          `${GLOBAL_API_PATH}/traffic/aggregated/by-app?${params}`
        ),
        api.get<{ summary: TrafficSummary }>(
          `${GLOBAL_API_PATH}/summary?${params}`
        ),
        api.get<{ evaluations: EvaluationSummary }>(
          `${GLOBAL_API_PATH}/evaluations?${evalParams}`
        ),
        api.get<{ timeseries: EvaluationTimeSeriesPoint[] }>(
          `${GLOBAL_API_PATH}/evaluations/timeseries?${evalParams}`
        ),
        api.get<{ timeseries: EvaluationTimeSeriesPointByApp[] }>(
          `${GLOBAL_API_PATH}/evaluations/timeseries/by-app?${evalParams}`
        ),
        api.get<{ timeseries: EvaluationTimeSeriesPointByFlag[] }>(
          `${GLOBAL_API_PATH}/evaluations/timeseries/by-flag?${evalParams}`
        ),
      ]);

      setTrafficData(trafficRes.data?.traffic || []);
      setChartDataByApp(aggregatedByAppRes.data?.traffic || []);
      setSummary(summaryRes.data?.summary || null);
      setEvaluations(evaluationsRes.data?.evaluations || null);
      setEvaluationTimeSeries(evalTimeSeriesRes.data?.timeseries || []);
      setEvaluationTimeSeriesByApp(
        evalTimeSeriesByAppRes.data?.timeseries || []
      );
      setEvaluationTimeSeriesByFlag(
        evalTimeSeriesByFlagRes.data?.timeseries || []
      );
    } catch (error) {
      console.error('Failed to fetch network traffic data:', error);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
      hasLoadedRef.current = true;
    }
  }, [getTimeRange, selectedEnvironments, selectedApps]);

  // Set default environments when global envs are loaded (only on initial load)
  useEffect(() => {
    if (
      globalEnvsLoaded &&
      globalEnvs.length > 0 &&
      selectedEnvironments.length === 0 &&
      initialEnvLoad
    ) {
      // Select all environments by default only on first load
      setSelectedEnvironments(globalEnvs.map((e) => e.environmentId));
      setInitialEnvLoad(false);
    } else if (globalEnvsLoaded && initialEnvLoad) {
      setInitialEnvLoad(false);
    }
  }, [
    globalEnvsLoaded,
    globalEnvs,
    selectedEnvironments.length,
    initialEnvLoad,
  ]);

  // Fetch applications when environments or time range changes
  useEffect(() => {
    fetchApplications();
  }, [fetchApplications, selectedEnvironments.length, dateRange]);

  // Fetch data when filters change
  useEffect(() => {
    fetchData();
  }, [fetchData, selectedEnvironments, selectedApps]);

  // Handle environment toggle
  const handleEnvironmentChange = (
    _: React.MouseEvent<HTMLElement>,
    newEnvs: string[]
  ) => {
    setSelectedEnvironments(newEnvs || []);
  };

  // Handle app toggle
  const handleAppChange = (
    _: React.MouseEvent<HTMLElement>,
    newApps: string[]
  ) => {
    setSelectedApps(newApps || []);
  };

  // Handle time range change
  const handleDateRangeChange = useCallback((value: DateRangeValue) => {
    setDateRange(value);
  }, []);

  // Colors for different series
  const seriesColors = useMemo(
    () => [
      '#2196f3',
      '#4caf50',
      '#ff9800',
      '#e91e63',
      '#9c27b0',
      '#00bcd4',
      '#795548',
      '#607d8b',
    ],
    []
  );

  // Shared time axis labels for both tabs
  const chartTimeLabels = useMemo(() => {
    const { startDate, endDate } = getTimeRange();
    const labels: string[] = [];
    const current = new Date(startDate);
    current.setMinutes(0, 0, 0);
    while (current <= endDate) {
      const month = String(current.getMonth() + 1).padStart(2, '0');
      const day = String(current.getDate()).padStart(2, '0');
      const hour = String(current.getHours()).padStart(2, '0');
      labels.push(`${month}/${day} ${hour}:00`);
      current.setHours(current.getHours() + 1);
    }
    return labels;
  }, [getTimeRange]);

  // API Requests chart datasets (Top 10 + Other)
  const MAX_SERIES = 10;
  const apiChartDatasets = useMemo<ChartDataset[]>(() => {
    if (chartDataByApp.length === 0) return [];

    const buildGroupedDatasets = (
      groupKey: 'environmentId' | 'appName',
      labelFn: (key: string) => string,
      valueFn: (d: ChartDataPointByApp) => number
    ): ChartDataset[] => {
      // Aggregate total per group for ranking
      const groupTotals = new Map<string, number>();
      chartDataByApp.forEach((d) => {
        const key = d[groupKey];
        groupTotals.set(key, (groupTotals.get(key) || 0) + valueFn(d));
      });

      // Sort by total descending, pick top N
      const sorted = [...groupTotals.entries()].sort((a, b) => b[1] - a[1]);
      const topKeys = new Set(sorted.slice(0, MAX_SERIES).map(([k]) => k));

      // Build per-group time series
      const groupAgg = new Map<string, Map<string, number>>();
      const otherAgg = new Map<string, number>();
      chartDataByApp.forEach((d) => {
        const key = d[groupKey];
        const val = valueFn(d);
        if (topKeys.has(key)) {
          if (!groupAgg.has(key)) groupAgg.set(key, new Map());
          const m = groupAgg.get(key)!;
          m.set(d.displayTime, (m.get(d.displayTime) || 0) + val);
        } else {
          otherAgg.set(d.displayTime, (otherAgg.get(d.displayTime) || 0) + val);
        }
      });

      const datasets: ChartDataset[] = [...groupAgg.entries()].map(
        ([key, agg], i) => ({
          label: labelFn(key),
          data: chartTimeLabels.map((t) => agg.get(t) || 0),
          color: seriesColors[i % seriesColors.length],
        })
      );

      if (otherAgg.size > 0) {
        datasets.push({
          label: 'Other',
          data: chartTimeLabels.map((t) => otherAgg.get(t) || 0),
          color: '#9e9e9e',
        });
      }
      return datasets;
    };

    if (chartGroupBy === 'env') {
      return buildGroupedDatasets(
        'environmentId',
        (k) => envFullPathMap.get(k) || envNameMap.get(k) || k,
        (d) => d.totalCount
      );
    } else if (chartGroupBy === 'app') {
      return buildGroupedDatasets(
        'appName',
        (k) => k,
        (d) => d.totalCount
      );
    } else {
      const aggregated = new Map<string, number>();
      chartDataByApp.forEach((d) => {
        aggregated.set(
          d.displayTime,
          (aggregated.get(d.displayTime) || 0) + d.totalCount
        );
      });
      return [
        {
          label: '',
          data: chartTimeLabels.map((time) => aggregated.get(time) || 0),
          color: seriesColors[0],
        },
      ];
    }
  }, [
    chartDataByApp,
    chartTimeLabels,
    seriesColors,
    chartGroupBy,
    envFullPathMap,
    envNameMap,
  ]);

  // Zoom handler — converts chart index range to custom date range
  const handleChartZoom = useCallback(
    (startIndex: number, endIndex: number) => {
      const { startDate } = getTimeRange();
      const start = new Date(startDate);
      start.setMinutes(0, 0, 0);
      start.setHours(start.getHours() + startIndex);
      const end = new Date(startDate);
      end.setMinutes(0, 0, 0);
      end.setHours(end.getHours() + endIndex);
      setDateRange({ type: 'custom', start, end });
    },
    [getTimeRange]
  );

  // Evaluation chart datasets (Top 10 + Other)
  const evalChartDatasets = useMemo<ChartDataset[]>(() => {
    if (evaluationTimeSeriesByApp.length === 0) return [];

    const buildGroupedEvalDatasets = (
      groupKey: 'environmentId' | 'appName',
      labelFn: (key: string) => string
    ): ChartDataset[] => {
      const groupTotals = new Map<string, number>();
      evaluationTimeSeriesByApp.forEach((d) => {
        const key = d[groupKey];
        groupTotals.set(key, (groupTotals.get(key) || 0) + d.evaluations);
      });
      const sorted = [...groupTotals.entries()].sort((a, b) => b[1] - a[1]);
      const topKeys = new Set(sorted.slice(0, MAX_SERIES).map(([k]) => k));

      const groupAgg = new Map<string, Map<string, number>>();
      const otherAgg = new Map<string, number>();
      evaluationTimeSeriesByApp.forEach((d) => {
        const key = d[groupKey];
        if (topKeys.has(key)) {
          if (!groupAgg.has(key)) groupAgg.set(key, new Map());
          const m = groupAgg.get(key)!;
          m.set(d.displayTime, (m.get(d.displayTime) || 0) + d.evaluations);
        } else {
          otherAgg.set(
            d.displayTime,
            (otherAgg.get(d.displayTime) || 0) + d.evaluations
          );
        }
      });

      const datasets: ChartDataset[] = [...groupAgg.entries()].map(
        ([key, agg], i) => ({
          label: labelFn(key),
          data: chartTimeLabels.map((t) => agg.get(t) || 0),
          color: seriesColors[i % seriesColors.length],
        })
      );
      if (otherAgg.size > 0) {
        datasets.push({
          label: 'Other',
          data: chartTimeLabels.map((t) => otherAgg.get(t) || 0),
          color: '#9e9e9e',
        });
      }
      return datasets;
    };

    if (chartGroupBy === 'env') {
      return buildGroupedEvalDatasets(
        'environmentId',
        (k) => envFullPathMap.get(k) || envNameMap.get(k) || k
      );
    } else if (chartGroupBy === 'app') {
      return buildGroupedEvalDatasets('appName', (k) => k);
    } else if (chartGroupBy === 'flag') {
      if (evaluationTimeSeriesByFlag.length === 0) return [];
      const groupTotals = new Map<string, number>();
      evaluationTimeSeriesByFlag.forEach((d) => {
        const key = d.flagName;
        groupTotals.set(key, (groupTotals.get(key) || 0) + d.evaluations);
      });
      const sorted = [...groupTotals.entries()].sort((a, b) => b[1] - a[1]);
      const topKeys = new Set(sorted.slice(0, MAX_SERIES).map(([k]) => k));

      const groupAgg = new Map<string, Map<string, number>>();
      const otherAgg = new Map<string, number>();
      evaluationTimeSeriesByFlag.forEach((d) => {
        const key = d.flagName;
        if (topKeys.has(key)) {
          if (!groupAgg.has(key)) groupAgg.set(key, new Map());
          const m = groupAgg.get(key)!;
          m.set(d.displayTime, (m.get(d.displayTime) || 0) + d.evaluations);
        } else {
          otherAgg.set(
            d.displayTime,
            (otherAgg.get(d.displayTime) || 0) + d.evaluations
          );
        }
      });

      const datasets: ChartDataset[] = [...groupAgg.entries()].map(
        ([key, agg], i) => ({
          label: key,
          data: chartTimeLabels.map((t) => agg.get(t) || 0),
          color: seriesColors[i % seriesColors.length],
        })
      );
      if (otherAgg.size > 0) {
        datasets.push({
          label: 'Other',
          data: chartTimeLabels.map((t) => otherAgg.get(t) || 0),
          color: '#9e9e9e',
        });
      }
      return datasets;
    } else {
      const aggregated = new Map<string, number>();
      evaluationTimeSeriesByApp.forEach((d) => {
        aggregated.set(
          d.displayTime,
          (aggregated.get(d.displayTime) || 0) + d.evaluations
        );
      });
      return [
        {
          label: '',
          data: chartTimeLabels.map((time) => aggregated.get(time) || 0),
          color: seriesColors[0],
        },
      ];
    }
  }, [
    evaluationTimeSeriesByApp,
    evaluationTimeSeriesByFlag,
    chartTimeLabels,
    seriesColors,
    chartGroupBy,
    envFullPathMap,
    envNameMap,
  ]);

  // API Request tab summary cards
  const apiSummaryCards = useMemo(
    () => [
      {
        icon: <TrendingUpIcon />,
        label: t('network.totalRequests'),
        value: summary?.totalRequests?.toLocaleString() || '0',
        color: '#2196f3',
      },
      {
        icon: <FlagIcon />,
        label: t('network.features'),
        value: summary?.featuresCount?.toLocaleString() || '0',
        color: '#1976d2',
      },
      {
        icon: <CategoryIcon />,
        label: t('network.segments'),
        value: summary?.segmentsCount?.toLocaleString() || '0',
        color: '#4caf50',
      },
      {
        icon: <AppsIcon />,
        label: t('network.activeApplications'),
        value: summary?.activeApplications?.toLocaleString() || '0',
        color: '#ff9800',
      },
      {
        icon: <HubIcon />,
        label: t('network.activeEnvironments'),
        value: selectedEnvironments.length.toLocaleString(),
        color: '#00bcd4',
      },
      {
        icon: <SpeedIcon />,
        label: t('network.avgRequestsPerHour'),
        value: summary?.avgRequestsPerHour?.toLocaleString() || '0',
        color: '#9c27b0',
      },
    ],
    [summary, t, selectedEnvironments]
  );

  // Flag Evaluation tab summary cards
  const evalSummaryCards = useMemo(
    () => [
      {
        icon: <TrendingUpIcon />,
        label: t('network.flagEvaluations'),
        value: evaluations?.totalEvaluations?.toLocaleString() || '0',
        color: '#e91e63',
      },
      {
        icon: <AppsIcon />,
        label: t('network.activeApplications'),
        value: summary?.activeApplications?.toLocaleString() || '0',
        color: '#ff9800',
      },
      {
        icon: <HubIcon />,
        label: t('network.activeEnvironments'),
        value: selectedEnvironments.length.toLocaleString(),
        color: '#00bcd4',
      },
      {
        icon: <SpeedIcon />,
        label: t('network.avgEvaluationsPerHour'),
        value: evaluations
          ? Math.round(
              evaluations.totalEvaluations /
                (presetToHours(
                  dateRange.type === 'preset'
                    ? dateRange.preset || '24h'
                    : '24h'
                ) || 24)
            ).toLocaleString()
          : '0',
        color: '#9c27b0',
      },
    ],
    [evaluations, summary, t, dateRange, selectedEnvironments]
  );

  return (
    <Box>
      <PageHeader
        icon={<HubIcon />}
        title={t('network.title')}
        subtitle={t('network.subtitle')}
        actions={
          <PageHeaderContextMenu
            onRefresh={fetchData}
            refreshDisabled={loading || isRefreshing}
          />
        }
      />

      {/* Filters */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          mb: 3,
          flexWrap: 'wrap',
        }}
      >
        {/* Environment tree selector */}
        <EnvironmentTreeFilterChip
          environments={globalEnvs}
          selected={selectedEnvironments}
          onChange={setSelectedEnvironments}
        />

        {/* Application */}
        <MultiSelectFilterChip
          label={t('network.application')}
          options={applications.map((app) => ({ value: app, label: app }))}
          selected={selectedApps}
          onChange={setSelectedApps}
          hideWhenEmpty
        />

        {/* Chart Grouping Selector */}
        <ToggleButtonGroup
          size="small"
          value={chartGroupBy}
          exclusive
          onChange={(_, value) => value && setChartGroupBy(value)}
          sx={{
            height: '32px',
            '& .MuiToggleButton-root': {
              py: 0,
              px: 1.5,
              fontSize: '0.75rem',
              fontWeight: 500,
              textTransform: 'none',
            },
          }}
        >
          <ToggleButton value="all">{t('network.groupByAll')}</ToggleButton>
          <ToggleButton value="app">{t('network.groupByApp')}</ToggleButton>
          <ToggleButton value="env">{t('network.groupByEnv')}</ToggleButton>
          {activeTab === 1 && (
            <ToggleButton value="flag">{t('network.groupByFlag')}</ToggleButton>
          )}
        </ToggleButtonGroup>

        {/* Time Range */}
        <Box sx={{ ml: 'auto' }}>
          <DateRangeSelector
            value={dateRange}
            onChange={handleDateRangeChange}
            compact
          />
        </Box>
      </Box>

      {/* Tabs */}
      <PageContentLoader loading={loading}>
        <Paper
          sx={{
            mb: 3,
            borderRadius: 2,
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
          }}
        >
          <Tabs
            value={activeTab}
            onChange={(_, newValue) => setActiveTab(newValue)}
            sx={{ borderBottom: 1, borderColor: 'divider' }}
          >
            <Tab label={t('network.tabApiRequests')} />
            <Tab label={t('network.tabFlagEvaluations')} />
          </Tabs>

          {/* API Requests Tab */}
          {activeTab === 0 && (
            <Box sx={{ p: 2 }}>
              {/* API Summary Cards */}
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                  gap: 2,
                  mb: 3,
                }}
              >
                {apiSummaryCards.map((card, index) => (
                  <Card
                    key={index}
                    sx={{
                      borderRadius: 2,
                      boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                    }}
                  >
                    <CardContent
                      sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}
                    >
                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1,
                          mb: 0.5,
                        }}
                      >
                        <Box sx={{ color: card.color, fontSize: 18 }}>
                          {card.icon}
                        </Box>
                        <Typography variant="caption" color="text.secondary">
                          {card.label}
                        </Typography>
                      </Box>
                      {(loading || isRefreshing) && !summary ? (
                        <Skeleton variant="text" width={60} height={32} />
                      ) : (
                        <Typography variant="h5" fontWeight={600}>
                          {card.value}
                        </Typography>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </Box>

              <ArgusVolumeChart
                labels={chartTimeLabels}
                datasets={apiChartDatasets}
                loading={loading}
                title={t('network.requestsOverTime')}
                onZoom={handleChartZoom}
                storagePrefix="feature_network_api"
                showLegend={chartGroupBy !== 'all'}
                mb={0}
              />

              {/* Traffic Detail Table */}
              <Box sx={{ mt: 3 }}>
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                  }}
                  onClick={() => setShowTable(!showTable)}
                >
                  <Typography variant="subtitle1" fontWeight={600}>
                    {t('network.detailData')}
                  </Typography>
                  <IconButton size="small">
                    {showTable ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                  </IconButton>
                </Box>
                <Collapse in={showTable}>
                  <Card variant="outlined" sx={{ mt: 2, borderRadius: 2 }}>
                    <CardContent sx={{ p: 0, '&:last-child': { pb: 0 } }}>
                      <TableContainer
                        sx={{
                          maxHeight: 'calc(100vh - 480px)',
                          minHeight: 300,
                        }}
                      >
                        <Table
                          size="small"
                          stickyHeader
                          sx={{ '& .MuiTableCell-root': { py: 0.75 } }}
                        >
                          <TableHead
                            sx={{
                              '& .MuiTableCell-root': {
                                bgcolor: 'background.paper',
                                zIndex: 1,
                              },
                            }}
                          >
                            <TableRow>
                              <TableCell>{t('network.time')}</TableCell>
                              <TableCell>{t('common.environment')}</TableCell>
                              <TableCell>{t('common.project')}</TableCell>
                              <TableCell>{t('common.organization')}</TableCell>
                              <TableCell>{t('network.application')}</TableCell>
                              <TableCell align="right">
                                {t('network.features')}
                              </TableCell>
                              <TableCell align="right">
                                {t('network.segments')}
                              </TableCell>
                              <TableCell align="right">
                                {t('network.total')}
                              </TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {trafficData.length === 0 ? (
                              <TableRow hover>
                                <TableCell
                                  colSpan={8}
                                  align="center"
                                  sx={{ py: 4 }}
                                >
                                  <Typography color="text.secondary">
                                    {t('common.noData')}
                                  </Typography>
                                </TableCell>
                              </TableRow>
                            ) : (
                              trafficData
                                .slice()
                                .reverse()
                                .slice(
                                  trafficPage * rowsPerPage,
                                  trafficPage * rowsPerPage + rowsPerPage
                                )
                                .map((row, index) => (
                                  <TableRow key={index} hover>
                                    <TableCell>{row.displayTime}</TableCell>
                                    <TableCell>
                                      <Tooltip title={row.environmentId}>
                                        <Chip
                                          label={
                                            envNameMap.get(row.environmentId) ||
                                            row.environmentId
                                          }
                                          size="small"
                                          color="primary"
                                          variant="outlined"
                                          sx={{ borderRadius: '16px' }}
                                        />
                                      </Tooltip>
                                    </TableCell>
                                    <TableCell>
                                      {envProjectMap.get(row.environmentId) ||
                                        '-'}
                                    </TableCell>
                                    <TableCell>
                                      {envOrgMap.get(row.environmentId) || '-'}
                                    </TableCell>
                                    <TableCell>
                                      {row.appName ? (
                                        <Chip
                                          label={row.appName}
                                          size="small"
                                          color="info"
                                          sx={{ borderRadius: '16px' }}
                                        />
                                      ) : (
                                        '-'
                                      )}
                                    </TableCell>
                                    <TableCell align="right">
                                      {row.featuresCount.toLocaleString()}
                                    </TableCell>
                                    <TableCell align="right">
                                      {row.segmentsCount.toLocaleString()}
                                    </TableCell>
                                    <TableCell align="right">
                                      {row.totalCount.toLocaleString()}
                                    </TableCell>
                                  </TableRow>
                                ))
                            )}
                          </TableBody>
                        </Table>
                      </TableContainer>
                      <SimplePagination
                        page={trafficPage}
                        rowsPerPage={rowsPerPage}
                        count={trafficData.length}
                        onPageChange={(_, newPage) => setTrafficPage(newPage)}
                        onRowsPerPageChange={(e) => {
                          setRowsPerPage(Number(e.target.value));
                          setTrafficPage(0);
                        }}
                      />
                    </CardContent>
                  </Card>
                </Collapse>
              </Box>
            </Box>
          )}

          {/* Flag Evaluations Tab */}
          {activeTab === 1 && (
            <Box sx={{ p: 2 }}>
              {/* Evaluation Summary Cards */}
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                  gap: 2,
                  mb: 3,
                }}
              >
                {evalSummaryCards.map((card, index) => (
                  <Card
                    key={index}
                    sx={{
                      borderRadius: 2,
                      boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                    }}
                  >
                    <CardContent
                      sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}
                    >
                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1,
                          mb: 0.5,
                        }}
                      >
                        <Box sx={{ color: card.color, fontSize: 18 }}>
                          {card.icon}
                        </Box>
                        <Typography variant="caption" color="text.secondary">
                          {card.label}
                        </Typography>
                      </Box>
                      {loading && !evaluations ? (
                        <Skeleton variant="text" width={60} height={32} />
                      ) : (
                        <Typography variant="h5" fontWeight={600}>
                          {card.value}
                        </Typography>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </Box>

              <ArgusVolumeChart
                labels={chartTimeLabels}
                datasets={evalChartDatasets}
                loading={loading}
                title={t('network.evaluationsOverTime')}
                onZoom={handleChartZoom}
                storagePrefix="feature_network_eval"
                showLegend={chartGroupBy !== 'all'}
                mb={0}
              />

              {/* Evaluation Detail Table */}
              <Box sx={{ mt: 3 }}>
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                  }}
                  onClick={() => setShowEvalTable(!showEvalTable)}
                >
                  <Typography variant="subtitle1" fontWeight={600}>
                    {t('network.detailData')}
                  </Typography>
                  <IconButton size="small">
                    {showEvalTable ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                  </IconButton>
                </Box>
                <Collapse in={showEvalTable}>
                  <Card variant="outlined" sx={{ mt: 2, borderRadius: 2 }}>
                    <CardContent sx={{ p: 0, '&:last-child': { pb: 0 } }}>
                      <TableContainer
                        sx={{
                          maxHeight: 'calc(100vh - 480px)',
                          minHeight: 300,
                        }}
                      >
                        <Table
                          size="small"
                          stickyHeader
                          sx={{ '& .MuiTableCell-root': { py: 0.75 } }}
                        >
                          <TableHead
                            sx={{
                              '& .MuiTableCell-root': {
                                bgcolor: 'background.paper',
                                zIndex: 1,
                              },
                            }}
                          >
                            <TableRow>
                              <TableCell>{t('network.time')}</TableCell>
                              <TableCell>{t('common.environment')}</TableCell>
                              <TableCell>{t('common.project')}</TableCell>
                              <TableCell>{t('common.organization')}</TableCell>
                              <TableCell>{t('network.application')}</TableCell>
                              <TableCell align="right">
                                {t('network.flagEvaluations')}
                              </TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {evaluationTimeSeriesByApp.length === 0 ? (
                              <TableRow hover>
                                <TableCell
                                  colSpan={6}
                                  align="center"
                                  sx={{ py: 4 }}
                                >
                                  <Typography color="text.secondary">
                                    {t('common.noData')}
                                  </Typography>
                                </TableCell>
                              </TableRow>
                            ) : (
                              evaluationTimeSeriesByApp
                                .slice()
                                .reverse()
                                .slice(
                                  evalPage * rowsPerPage,
                                  evalPage * rowsPerPage + rowsPerPage
                                )
                                .map((row, index) => (
                                  <TableRow key={index} hover>
                                    <TableCell>{row.displayTime}</TableCell>
                                    <TableCell>
                                      <Tooltip title={row.environmentId}>
                                        <Chip
                                          label={
                                            row.environmentName ||
                                            envNameMap.get(row.environmentId) ||
                                            row.environmentId
                                          }
                                          size="small"
                                          color="primary"
                                          variant="outlined"
                                          sx={{ borderRadius: '16px' }}
                                        />
                                      </Tooltip>
                                    </TableCell>
                                    <TableCell>
                                      {row.projectName || '-'}
                                    </TableCell>
                                    <TableCell>{row.orgName || '-'}</TableCell>
                                    <TableCell>
                                      {row.appName ? (
                                        <Chip
                                          label={row.appName}
                                          size="small"
                                          color="info"
                                          sx={{ borderRadius: '16px' }}
                                        />
                                      ) : (
                                        '-'
                                      )}
                                    </TableCell>
                                    <TableCell align="right">
                                      {row.evaluations.toLocaleString()}
                                    </TableCell>
                                  </TableRow>
                                ))
                            )}
                          </TableBody>
                        </Table>
                      </TableContainer>
                      <SimplePagination
                        page={evalPage}
                        rowsPerPage={rowsPerPage}
                        count={evaluationTimeSeriesByApp.length}
                        onPageChange={(_, newPage) => setEvalPage(newPage)}
                        onRowsPerPageChange={(e) => {
                          setRowsPerPage(Number(e.target.value));
                          setEvalPage(0);
                        }}
                      />
                    </CardContent>
                  </Card>
                </Collapse>
              </Box>
            </Box>
          )}
        </Paper>
      </PageContentLoader>
    </Box>
  );
};

export default FeatureNetworkPage;

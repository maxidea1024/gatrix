/**
 * Feature Network Page
 * Displays SDK API traffic data (features/segments requests)
 * Similar to Unleash Network dashboard
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
    Divider,
} from '@mui/material';
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
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip as ChartTooltip,
    Legend,
    Filler,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { useTranslation } from 'react-i18next';

import { useEnvironment } from '../../contexts/EnvironmentContext';
import api from '../../services/api';
import { Environment } from '../../services/environmentService';

// Register Chart.js components
ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    ChartTooltip,
    Legend,
    Filler
);

// Types
interface TrafficDataPoint {
    bucket: string;
    displayTime: string;
    environment: string;
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

// Chart data point (aggregated by time)
interface ChartDataPoint {
    bucket: string;
    displayTime: string;
    featuresCount: number;
    segmentsCount: number;
    totalCount: number;
}

// Chart data point grouped by app
interface ChartDataPointByApp {
    bucket: string;
    displayTime: string;
    environment: string;
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
    environment: string;
    appName: string;
    evaluations: number;
    yesCount: number;
    noCount: number;
}

// Time range options
const TIME_RANGE_OPTIONS = [
    { value: '1h', label: 'network.timeRange.1h', hours: 1 },
    { value: '6h', label: 'network.timeRange.6h', hours: 6 },
    { value: '24h', label: 'network.timeRange.24h', hours: 24 },
    { value: '7d', label: 'network.timeRange.7d', hours: 24 * 7 },
];

// Fill missing hours with zero values
function fillMissingHours<T extends { bucket: string; displayTime: string }>(
    data: T[],
    startDate: Date,
    endDate: Date,
    defaultValues: Omit<T, 'bucket' | 'displayTime'>
): T[] {
    const result: T[] = [];
    const dataMap = new Map<string, T>();

    // Create a map of existing data by display time
    for (const item of data) {
        dataMap.set(item.displayTime, item);
    }

    // Generate all hours in the range
    const current = new Date(startDate);
    current.setMinutes(0, 0, 0); // Round down to hour

    while (current <= endDate) {
        const month = String(current.getMonth() + 1).padStart(2, '0');
        const day = String(current.getDate()).padStart(2, '0');
        const hour = String(current.getHours()).padStart(2, '0');
        const displayTime = `${month}/${day} ${hour}:00`;

        if (dataMap.has(displayTime)) {
            result.push(dataMap.get(displayTime)!);
        } else {
            result.push({
                bucket: current.toISOString(),
                displayTime,
                ...defaultValues,
            } as T);
        }

        current.setHours(current.getHours() + 1);
    }

    return result;
}

const FeatureNetworkPage: React.FC = () => {
    const { t } = useTranslation();
    const { currentEnvironment, allEnvironments } = useEnvironment();
    const [searchParams, setSearchParams] = useSearchParams();

    // Ensure allEnvironments is an array
    const envList: Environment[] = Array.isArray(allEnvironments) ? allEnvironments : [];

    // State - initialize from URL params
    const [loading, setLoading] = useState(true);
    const [trafficData, setTrafficData] = useState<TrafficDataPoint[]>([]);
    const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
    const [chartDataByApp, setChartDataByApp] = useState<ChartDataPointByApp[]>([]);
    const [summary, setSummary] = useState<TrafficSummary | null>(null);
    const [evaluations, setEvaluations] = useState<EvaluationSummary | null>(null);
    const [evaluationTimeSeries, setEvaluationTimeSeries] = useState<EvaluationTimeSeriesPoint[]>([]);
    const [evaluationTimeSeriesByApp, setEvaluationTimeSeriesByApp] = useState<EvaluationTimeSeriesPointByApp[]>([]);
    const [applications, setApplications] = useState<string[]>([]);
    const [initialEnvLoad, setInitialEnvLoad] = useState(true);
    const [selectedEnvironments, setSelectedEnvironments] = useState<string[]>(() => {
        const envParam = searchParams.get('environments');
        return envParam ? envParam.split(',') : [];
    });
    const [selectedApps, setSelectedApps] = useState<string[]>(() => {
        const appsParam = searchParams.get('apps');
        return appsParam ? appsParam.split(',') : [];
    });
    const [timeRange, setTimeRange] = useState(() => searchParams.get('range') || '24h');
    const [showTable, setShowTable] = useState(true);
    const [showEvalTable, setShowEvalTable] = useState(true);
    const [appsLoaded, setAppsLoaded] = useState(false);
    const [activeTab, setActiveTab] = useState(() => {
        const tabParam = searchParams.get('tab');
        return tabParam === '1' ? 1 : 0;
    });
    const [chartGroupBy, setChartGroupBy] = useState<'all' | 'app' | 'env'>(() => {
        const groupParam = searchParams.get('groupBy');
        if (groupParam === 'env') return 'env';
        if (groupParam === 'app') return 'app';
        return 'all';
    });

    // Get time range dates
    const getTimeRange = useCallback(() => {
        const option = TIME_RANGE_OPTIONS.find(o => o.value === timeRange);
        const hours = option?.hours || 24;
        const endDate = new Date();
        const startDate = new Date(endDate.getTime() - hours * 60 * 60 * 1000);
        return { startDate, endDate };
    }, [timeRange]);

    // Update URL params when filters change
    useEffect(() => {
        const params = new URLSearchParams();
        if (selectedEnvironments.length > 0 && selectedEnvironments.length < envList.length) {
            params.set('environments', selectedEnvironments.join(','));
        }
        if (selectedApps.length > 0 && selectedApps.length < applications.length) {
            params.set('apps', selectedApps.join(','));
        }
        if (timeRange !== '24h') {
            params.set('range', timeRange);
        }
        if (activeTab !== 0) {
            params.set('tab', String(activeTab));
        }
        if (chartGroupBy !== 'all') {
            params.set('groupBy', chartGroupBy);
        }
        setSearchParams(params, { replace: true });
    }, [selectedEnvironments, selectedApps, timeRange, activeTab, chartGroupBy, envList.length, applications.length, setSearchParams]);

    // Fetch applications list
    const fetchApplications = useCallback(async () => {
        try {
            const { startDate, endDate } = getTimeRange();
            const params = new URLSearchParams({
                startDate: startDate.toISOString(),
                endDate: endDate.toISOString(),
            });

            // Get apps for all environments
            if (selectedEnvironments.length > 0) {
                params.set('environments', selectedEnvironments.join(','));
            }

            const appsRes = await api.get<{ applications: string[] }>(`/admin/features/network/applications?${params}`);
            const appsList = appsRes.data?.applications || [];
            setApplications(appsList);

            // If no apps selected yet and apps are available, select all
            if (!appsLoaded && appsList.length > 0) {
                setSelectedApps(appsList);
                setAppsLoaded(true);
            }
        } catch (error) {
            console.error('Failed to fetch applications:', error);
        }
    }, [getTimeRange, selectedEnvironments, appsLoaded]);

    // Fetch traffic data
    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            // If no environments selected, show no data
            if (selectedEnvironments.length === 0) {
                setTrafficData([]);
                setChartData([]);
                setChartDataByApp([]);
                setSummary(null);
                setEvaluations(null);
                setEvaluationTimeSeries([]);
                setEvaluationTimeSeriesByApp([]);
                return;
            }

            // If apps are loaded but none selected, show no data
            if (appsLoaded && applications.length > 0 && selectedApps.length === 0) {
                setTrafficData([]);
                setChartData([]);
                setChartDataByApp([]);
                setSummary(null);
                setEvaluations(null);
                setEvaluationTimeSeries([]);
                setEvaluationTimeSeriesByApp([]);
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

            // Fetch traffic (detailed), aggregated (for chart), summary, evaluations, and evaluation timeseries in parallel
            const [
                trafficRes,
                aggregatedRes,
                aggregatedByAppRes,
                summaryRes,
                evaluationsRes,
                evalTimeSeriesRes,
                evalTimeSeriesByAppRes,
            ] = await Promise.all([
                api.get<{ traffic: TrafficDataPoint[] }>(`/admin/features/network/traffic?${params}`),
                api.get<{ traffic: ChartDataPoint[] }>(`/admin/features/network/traffic/aggregated?${params}`),
                api.get<{ traffic: ChartDataPointByApp[] }>(`/admin/features/network/traffic/aggregated/by-app?${params}`),
                api.get<{ summary: TrafficSummary }>(`/admin/features/network/summary?${params}`),
                api.get<{ evaluations: EvaluationSummary }>(`/admin/features/network/evaluations?${params}`),
                api.get<{ timeseries: EvaluationTimeSeriesPoint[] }>(`/admin/features/network/evaluations/timeseries?${params}`),
                api.get<{ timeseries: EvaluationTimeSeriesPointByApp[] }>(`/admin/features/network/evaluations/timeseries/by-app?${params}`),
            ]);

            setTrafficData(trafficRes.data?.traffic || []);
            setChartData(aggregatedRes.data?.traffic || []);
            setChartDataByApp(aggregatedByAppRes.data?.traffic || []);
            setSummary(summaryRes.data?.summary || null);
            setEvaluations(evaluationsRes.data?.evaluations || null);
            setEvaluationTimeSeries(evalTimeSeriesRes.data?.timeseries || []);
            setEvaluationTimeSeriesByApp(evalTimeSeriesByAppRes.data?.timeseries || []);
        } catch (error) {
            console.error('Failed to fetch network traffic data:', error);
        } finally {
            setLoading(false);
        }
    }, [getTimeRange, selectedEnvironments, selectedApps, appsLoaded, applications.length]);

    // Set default environments when envList is loaded (only on initial load)
    useEffect(() => {
        if (envList.length > 0 && selectedEnvironments.length === 0 && initialEnvLoad) {
            // Select all environments by default only on first load
            setSelectedEnvironments(envList.map(e => e.environment));
            setInitialEnvLoad(false);
        } else if (envList.length > 0 && initialEnvLoad) {
            setInitialEnvLoad(false);
        }
    }, [envList, selectedEnvironments.length, initialEnvLoad]);

    // Fetch applications when environments or time range changes
    useEffect(() => {
        fetchApplications();
    }, [fetchApplications, selectedEnvironments.length, timeRange]);

    // Fetch data when filters change
    useEffect(() => {
        fetchData();
    }, [fetchData, selectedEnvironments, selectedApps]);

    // Handle environment toggle
    const handleEnvironmentChange = (_: React.MouseEvent<HTMLElement>, newEnvs: string[]) => {
        setSelectedEnvironments(newEnvs || []);
    };

    // Handle app toggle
    const handleAppChange = (_: React.MouseEvent<HTMLElement>, newApps: string[]) => {
        setSelectedApps(newApps || []);
    };

    // Handle time range change
    const handleTimeRangeChange = (_: React.MouseEvent<HTMLElement>, newRange: string | null) => {
        if (newRange) {
            setTimeRange(newRange);
        }
    };

    // Chart data - fill missing hours and downsample if needed
    const downsampledChartData = useMemo<ChartDataPoint[]>(() => {
        // If no original data, return empty to show "no data" message
        if (chartData.length === 0) return [];

        const { startDate, endDate } = getTimeRange();
        const filledData = fillMissingHours(chartData, startDate, endDate, {
            featuresCount: 0,
            segmentsCount: 0,
            totalCount: 0,
        });

        if (filledData.length <= 60) return filledData;

        // Downsample to ~60 points for readability
        const step = Math.ceil(filledData.length / 60);
        return filledData.filter((_, i) => i % step === 0);
    }, [chartData, getTimeRange]);

    // Colors for different apps
    const appColors = useMemo(() => {
        const colors = [
            { border: '#2196f3', bg: 'rgba(33, 150, 243, 0.1)' },
            { border: '#4caf50', bg: 'rgba(76, 175, 80, 0.1)' },
            { border: '#ff9800', bg: 'rgba(255, 152, 0, 0.1)' },
            { border: '#e91e63', bg: 'rgba(233, 30, 99, 0.1)' },
            { border: '#9c27b0', bg: 'rgba(156, 39, 176, 0.1)' },
            { border: '#00bcd4', bg: 'rgba(0, 188, 212, 0.1)' },
            { border: '#795548', bg: 'rgba(121, 85, 72, 0.1)' },
            { border: '#607d8b', bg: 'rgba(96, 125, 139, 0.1)' },
        ];
        return colors;
    }, []);

    // Prepare chart.js data - per app or env breakdown
    const lineChartData = useMemo(() => {
        if (chartDataByApp.length === 0) {
            return { labels: [], datasets: [] };
        }

        // Get all unique display times
        const { startDate, endDate } = getTimeRange();
        const allDisplayTimes: string[] = [];
        const current = new Date(startDate);
        current.setMinutes(0, 0, 0);
        while (current <= endDate) {
            const month = String(current.getMonth() + 1).padStart(2, '0');
            const day = String(current.getDate()).padStart(2, '0');
            const hour = String(current.getHours()).padStart(2, '0');
            allDisplayTimes.push(`${month}/${day} ${hour}:00`);
            current.setHours(current.getHours() + 1);
        }

        if (chartGroupBy === 'env') {
            // Group by environment
            const envNames = [...new Set(chartDataByApp.map(d => d.environment))];
            const datasets = envNames.map((envName, index) => {
                const envData = chartDataByApp.filter(d => d.environment === envName);
                // Aggregate by displayTime
                const aggregated = new Map<string, number>();
                envData.forEach(d => {
                    aggregated.set(d.displayTime, (aggregated.get(d.displayTime) || 0) + d.totalCount);
                });
                const data = allDisplayTimes.map(time => aggregated.get(time) || 0);
                const colorIndex = index % appColors.length;

                return {
                    label: envName,
                    data,
                    borderColor: appColors[colorIndex].border,
                    backgroundColor: appColors[colorIndex].bg,
                    borderWidth: 2,
                    tension: 0.3,
                    fill: true,
                    pointRadius: 0,
                    pointHoverRadius: 4,
                };
            });
            return { labels: allDisplayTimes, datasets };
        } else if (chartGroupBy === 'app') {
            // Group by app
            const appNames = [...new Set(chartDataByApp.map(d => d.appName))];
            const datasets = appNames.map((appName, index) => {
                const appData = chartDataByApp.filter(d => d.appName === appName);
                // Aggregate by displayTime
                const aggregated = new Map<string, number>();
                appData.forEach(d => {
                    aggregated.set(d.displayTime, (aggregated.get(d.displayTime) || 0) + d.totalCount);
                });
                const data = allDisplayTimes.map(time => aggregated.get(time) || 0);
                const colorIndex = index % appColors.length;

                return {
                    label: appName,
                    data,
                    borderColor: appColors[colorIndex].border,
                    backgroundColor: appColors[colorIndex].bg,
                    borderWidth: 2,
                    tension: 0.3,
                    fill: true,
                    pointRadius: 0,
                    pointHoverRadius: 4,
                };
            });
            return { labels: allDisplayTimes, datasets };
        } else {
            // 'all' - Single aggregated line
            const aggregated = new Map<string, number>();
            chartDataByApp.forEach(d => {
                aggregated.set(d.displayTime, (aggregated.get(d.displayTime) || 0) + d.totalCount);
            });
            const data = allDisplayTimes.map(time => aggregated.get(time) || 0);

            return {
                labels: allDisplayTimes,
                datasets: [{
                    label: '',
                    data,
                    borderColor: appColors[0].border,
                    backgroundColor: appColors[0].bg,
                    borderWidth: 2,
                    tension: 0.3,
                    fill: true,
                    pointRadius: 0,
                    pointHoverRadius: 4,
                }],
            };
        }
    }, [chartDataByApp, getTimeRange, appColors, chartGroupBy, t]);

    // Chart options
    const lineChartOptions = useMemo(() => ({
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'top' as const,
            },
            tooltip: {
                mode: 'index' as const,
                intersect: false,
            },
        },
        scales: {
            x: {
                grid: {
                    display: false,
                },
                ticks: {
                    maxRotation: 0,
                    autoSkip: true,
                    maxTicksLimit: 10,
                },
            },
            y: {
                beginAtZero: true,
                grid: {
                    color: 'rgba(0, 0, 0, 0.05)',
                },
            },
        },
        interaction: {
            mode: 'nearest' as const,
            axis: 'x' as const,
            intersect: false,
        },
    }), []);

    // Evaluation chart data - per app or env breakdown
    const evaluationChartData = useMemo(() => {
        // If no original data, return empty to show "no data" message
        if (evaluationTimeSeriesByApp.length === 0) {
            return { labels: [], datasets: [] };
        }

        // Get all unique display times
        const { startDate, endDate } = getTimeRange();
        const allDisplayTimes: string[] = [];
        const current = new Date(startDate);
        current.setMinutes(0, 0, 0);
        while (current <= endDate) {
            const month = String(current.getMonth() + 1).padStart(2, '0');
            const day = String(current.getDate()).padStart(2, '0');
            const hour = String(current.getHours()).padStart(2, '0');
            allDisplayTimes.push(`${month}/${day} ${hour}:00`);
            current.setHours(current.getHours() + 1);
        }

        if (chartGroupBy === 'env') {
            // Group by environment
            const envNames = [...new Set(evaluationTimeSeriesByApp.map(d => d.environment))];
            const datasets = envNames.map((envName, index) => {
                const envData = evaluationTimeSeriesByApp.filter(d => d.environment === envName);
                // Aggregate by displayTime
                const aggregated = new Map<string, number>();
                envData.forEach(d => {
                    aggregated.set(d.displayTime, (aggregated.get(d.displayTime) || 0) + d.evaluations);
                });
                const data = allDisplayTimes.map(time => aggregated.get(time) || 0);
                const colorIndex = index % appColors.length;

                return {
                    label: envName,
                    data,
                    borderColor: appColors[colorIndex].border,
                    backgroundColor: appColors[colorIndex].bg,
                    borderWidth: 2,
                    tension: 0.3,
                    fill: true,
                    pointRadius: 0,
                    pointHoverRadius: 4,
                };
            });
            return { labels: allDisplayTimes, datasets };
        } else if (chartGroupBy === 'app') {
            // Group by app
            const appNames = [...new Set(evaluationTimeSeriesByApp.map(d => d.appName))];
            const datasets = appNames.map((appName, index) => {
                const appData = evaluationTimeSeriesByApp.filter(d => d.appName === appName);
                // Aggregate by displayTime
                const aggregated = new Map<string, number>();
                appData.forEach(d => {
                    aggregated.set(d.displayTime, (aggregated.get(d.displayTime) || 0) + d.evaluations);
                });
                const data = allDisplayTimes.map(time => aggregated.get(time) || 0);
                const colorIndex = index % appColors.length;

                return {
                    label: appName,
                    data,
                    borderColor: appColors[colorIndex].border,
                    backgroundColor: appColors[colorIndex].bg,
                    borderWidth: 2,
                    tension: 0.3,
                    fill: true,
                    pointRadius: 0,
                    pointHoverRadius: 4,
                };
            });
            return { labels: allDisplayTimes, datasets };
        } else {
            // 'all' - Single aggregated line
            const aggregated = new Map<string, number>();
            evaluationTimeSeriesByApp.forEach(d => {
                aggregated.set(d.displayTime, (aggregated.get(d.displayTime) || 0) + d.evaluations);
            });
            const data = allDisplayTimes.map(time => aggregated.get(time) || 0);

            return {
                labels: allDisplayTimes,
                datasets: [{
                    label: '',
                    data,
                    borderColor: appColors[0].border,
                    backgroundColor: appColors[0].bg,
                    borderWidth: 2,
                    tension: 0.3,
                    fill: true,
                    pointRadius: 0,
                    pointHoverRadius: 4,
                }],
            };
        }
    }, [evaluationTimeSeriesByApp, getTimeRange, appColors, chartGroupBy, t]);

    // API Request tab summary cards
    const apiSummaryCards = useMemo(() => [
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
    ], [summary, t, selectedEnvironments]);

    // Flag Evaluation tab summary cards
    const evalSummaryCards = useMemo(() => [
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
            value: evaluations ? Math.round(evaluations.totalEvaluations / (TIME_RANGE_OPTIONS.find(o => o.value === timeRange)?.hours || 24)).toLocaleString() : '0',
            color: '#9c27b0',
        },
    ], [evaluations, summary, t, timeRange, selectedEnvironments]);

    return (
        <Box sx={{ p: 3, maxWidth: 1400, mx: 'auto' }}>
            {/* Page Header */}
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <HubIcon sx={{ fontSize: 32, color: 'primary.main' }} />
                    <Box>
                        <Typography variant="h5" fontWeight={600}>
                            {t('network.title')}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            {t('network.subtitle')}
                        </Typography>
                    </Box>
                </Box>
                <Tooltip title={t('common.refresh')}>
                    <span>
                        <IconButton onClick={fetchData} disabled={loading}>
                            <RefreshIcon />
                        </IconButton>
                    </span>
                </Tooltip>
            </Box>

            {/* Filters */}
            <Paper sx={{ p: 2, mb: 3 }}>
                <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap', alignItems: 'stretch' }}>
                    {/* Environment Toggle */}
                    <Box>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                            {t('network.environment')}
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                            {envList.map(env => (
                                <Chip
                                    key={env.environment}
                                    label={env.displayName || env.environment}
                                    size="small"
                                    onClick={() => {
                                        if (selectedEnvironments.includes(env.environment)) {
                                            setSelectedEnvironments(selectedEnvironments.filter(e => e !== env.environment));
                                        } else {
                                            setSelectedEnvironments([...selectedEnvironments, env.environment]);
                                        }
                                    }}
                                    color={selectedEnvironments.includes(env.environment) ? 'primary' : 'default'}
                                    variant={selectedEnvironments.includes(env.environment) ? 'filled' : 'outlined'}
                                    sx={{ borderRadius: '16px' }}
                                />
                            ))}
                        </Box>
                    </Box>

                    <Divider orientation="vertical" flexItem />

                    {/* Application Toggle */}
                    {applications.length > 0 && (
                        <>
                            <Box>
                                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                                    {t('network.application')}
                                </Typography>
                                <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                                    {applications.map(app => (
                                        <Chip
                                            key={app}
                                            label={app}
                                            size="small"
                                            onClick={() => {
                                                if (selectedApps.includes(app)) {
                                                    setSelectedApps(selectedApps.filter(a => a !== app));
                                                } else {
                                                    setSelectedApps([...selectedApps, app]);
                                                }
                                            }}
                                            color={selectedApps.includes(app) ? 'primary' : 'default'}
                                            variant={selectedApps.includes(app) ? 'filled' : 'outlined'}
                                            sx={{ borderRadius: '16px' }}
                                        />
                                    ))}
                                </Box>
                            </Box>
                            <Divider orientation="vertical" flexItem />
                        </>
                    )}

                    {/* Time Range */}
                    <Box sx={{ ml: 'auto' }}>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                            {t('network.timeRange')}
                        </Typography>
                        <ToggleButtonGroup
                            value={timeRange}
                            exclusive
                            onChange={handleTimeRangeChange}
                            size="small"
                        >
                            {TIME_RANGE_OPTIONS.map(option => (
                                <ToggleButton key={option.value} value={option.value}>
                                    {t(option.label)}
                                </ToggleButton>
                            ))}
                        </ToggleButtonGroup>
                    </Box>
                </Box>
            </Paper>

            {/* Tabs */}
            <Paper sx={{ mb: 3, borderRadius: 2, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
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
                    <Box sx={{ p: 3 }}>
                        {/* API Summary Cards */}
                        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 2, mb: 3 }}>
                            {apiSummaryCards.map((card, index) => (
                                <Card key={index} sx={{ borderRadius: 2, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
                                    <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                                            <Box sx={{ color: card.color, fontSize: 18 }}>{card.icon}</Box>
                                            <Typography variant="caption" color="text.secondary">
                                                {card.label}
                                            </Typography>
                                        </Box>
                                        {loading ? (
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

                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                            <Typography variant="h6">
                                {t('network.requestsOverTime')}
                            </Typography>
                            <ToggleButtonGroup
                                size="small"
                                value={chartGroupBy}
                                exclusive
                                onChange={(_, value) => value && setChartGroupBy(value)}
                            >
                                <ToggleButton value="all">{t('network.groupByAll')}</ToggleButton>
                                <ToggleButton value="app">{t('network.groupByApp')}</ToggleButton>
                                <ToggleButton value="env">{t('network.groupByEnv')}</ToggleButton>
                            </ToggleButtonGroup>
                        </Box>
                        {loading ? (
                            <Skeleton variant="rectangular" height={300} />
                        ) : chartDataByApp.length === 0 ? (
                            <Box sx={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Typography color="text.secondary">{t('common.noData')}</Typography>
                            </Box>
                        ) : (
                            <Box sx={{ height: 300 }}>
                                <Line data={lineChartData} options={lineChartOptions} />
                            </Box>
                        )}

                        {/* Traffic Detail Table */}
                        <Box sx={{ mt: 3 }}>
                            <Box
                                sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
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
                                <TableContainer sx={{ mt: 2, maxHeight: 400 }}>
                                    <Table size="small" stickyHeader>
                                        <TableHead sx={{ '& .MuiTableCell-root': { bgcolor: 'background.paper', zIndex: 1 } }}>
                                            <TableRow>
                                                <TableCell>{t('network.time')}</TableCell>
                                                <TableCell>{t('common.environment')}</TableCell>
                                                <TableCell>{t('network.application')}</TableCell>
                                                <TableCell align="right">{t('network.features')}</TableCell>
                                                <TableCell align="right">{t('network.segments')}</TableCell>
                                                <TableCell align="right">{t('network.total')}</TableCell>
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {trafficData.length === 0 ? (
                                                <TableRow>
                                                    <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                                                        <Typography color="text.secondary">{t('common.noData')}</Typography>
                                                    </TableCell>
                                                </TableRow>
                                            ) : (
                                                trafficData.slice().reverse().map((row, index) => (
                                                    <TableRow key={index} hover>
                                                        <TableCell>{row.displayTime}</TableCell>
                                                        <TableCell>{row.environment}</TableCell>
                                                        <TableCell>{row.appName || '-'}</TableCell>
                                                        <TableCell align="right">{row.featuresCount.toLocaleString()}</TableCell>
                                                        <TableCell align="right">{row.segmentsCount.toLocaleString()}</TableCell>
                                                        <TableCell align="right">{row.totalCount.toLocaleString()}</TableCell>
                                                    </TableRow>
                                                ))
                                            )}
                                        </TableBody>
                                    </Table>
                                </TableContainer>
                            </Collapse>
                        </Box>
                    </Box>
                )}

                {/* Flag Evaluations Tab */}
                {activeTab === 1 && (
                    <Box sx={{ p: 3 }}>
                        {/* Evaluation Summary Cards */}
                        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 2, mb: 3 }}>
                            {evalSummaryCards.map((card, index) => (
                                <Card key={index} sx={{ borderRadius: 2, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
                                    <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                                            <Box sx={{ color: card.color, fontSize: 18 }}>{card.icon}</Box>
                                            <Typography variant="caption" color="text.secondary">
                                                {card.label}
                                            </Typography>
                                        </Box>
                                        {loading ? (
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

                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                            <Typography variant="h6">
                                {t('network.evaluationsOverTime')}
                            </Typography>
                            <ToggleButtonGroup
                                size="small"
                                value={chartGroupBy}
                                exclusive
                                onChange={(_, value) => value && setChartGroupBy(value)}
                            >
                                <ToggleButton value="all">{t('network.groupByAll')}</ToggleButton>
                                <ToggleButton value="app">{t('network.groupByApp')}</ToggleButton>
                                <ToggleButton value="env">{t('network.groupByEnv')}</ToggleButton>
                            </ToggleButtonGroup>
                        </Box>
                        {loading ? (
                            <Skeleton variant="rectangular" height={300} />
                        ) : evaluationTimeSeriesByApp.length === 0 ? (
                            <Box sx={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Typography color="text.secondary">{t('common.noData')}</Typography>
                            </Box>
                        ) : (
                            <Box sx={{ height: 300 }}>
                                <Line data={evaluationChartData} options={lineChartOptions} />
                            </Box>
                        )}

                        {/* Evaluation Detail Table */}
                        <Box sx={{ mt: 3 }}>
                            <Box
                                sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
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
                                <TableContainer sx={{ mt: 2, maxHeight: 400 }}>
                                    <Table size="small" stickyHeader>
                                        <TableHead sx={{ '& .MuiTableCell-root': { bgcolor: 'background.paper', zIndex: 1 } }}>
                                            <TableRow>
                                                <TableCell>{t('network.time')}</TableCell>
                                                <TableCell>{t('common.environment')}</TableCell>
                                                <TableCell>{t('network.application')}</TableCell>
                                                <TableCell align="right">{t('network.flagEvaluations')}</TableCell>
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {evaluationTimeSeriesByApp.length === 0 ? (
                                                <TableRow>
                                                    <TableCell colSpan={4} align="center" sx={{ py: 4 }}>
                                                        <Typography color="text.secondary">{t('common.noData')}</Typography>
                                                    </TableCell>
                                                </TableRow>
                                            ) : (
                                                evaluationTimeSeriesByApp.slice().reverse().map((row, index) => (
                                                    <TableRow key={index} hover>
                                                        <TableCell>{row.displayTime}</TableCell>
                                                        <TableCell>{row.environment}</TableCell>
                                                        <TableCell>{row.appName || '-'}</TableCell>
                                                        <TableCell align="right">{row.evaluations.toLocaleString()}</TableCell>
                                                    </TableRow>
                                                ))
                                            )}
                                        </TableBody>
                                    </Table>
                                </TableContainer>
                            </Collapse>
                        </Box>
                    </Box>
                )}
            </Paper>
        </Box>
    );
};

export default FeatureNetworkPage;

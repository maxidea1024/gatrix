/**
 * Feature Flag Metrics Component
 * Displays exposure metrics for a feature flag with environment and period selection
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
    Box,
    Paper,
    Typography,
    ToggleButton,
    FormControl,
    Select,
    MenuItem,
    Alert,
    CircularProgress,
    useTheme,
    SelectChangeEvent,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import api from '../../services/api';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    ArcElement,
    Title,
    Tooltip,
    Legend,
} from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';

// Register Chart.js components
ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Title, Tooltip, Legend);

interface FeatureFlagMetricsProps {
    flagName: string;
    environments: { environment: string; isEnabled: boolean }[];
    currentEnvironment: string;
}

interface MetricsBucket {
    id: string;
    environment: string;
    flagName: string;
    metricsBucket: string;
    yesCount: number;
    noCount: number;
    variantCounts?: Record<string, number>;
}

interface AggregatedMetrics {
    totalYes: number;
    totalNo: number;
    total: number;
    variantCounts: Record<string, number>;
}

type PeriodOption = '1h' | '6h' | '24h' | '48h' | '7d' | '30d';

const PERIOD_OPTIONS: { value: PeriodOption; labelKey: string; hours: number }[] = [
    { value: '1h', labelKey: 'featureFlags.metrics.lastHour', hours: 1 },
    { value: '6h', labelKey: 'featureFlags.metrics.last6Hours', hours: 6 },
    { value: '24h', labelKey: 'featureFlags.metrics.last24Hours', hours: 24 },
    { value: '48h', labelKey: 'featureFlags.metrics.last48Hours', hours: 48 },
    { value: '7d', labelKey: 'featureFlags.metrics.last7Days', hours: 168 },
    { value: '30d', labelKey: 'featureFlags.metrics.last30Days', hours: 720 },
];

export const FeatureFlagMetrics: React.FC<FeatureFlagMetricsProps> = ({
    flagName,
    environments,
    currentEnvironment,
}) => {
    const { t } = useTranslation();
    const theme = useTheme();

    // Multi-select environments - default to all environments
    const [selectedEnvs, setSelectedEnvs] = useState<string[]>(
        environments.map(e => e.environment)
    );
    const [period, setPeriod] = useState<PeriodOption>('48h');
    const [metrics, setMetrics] = useState<MetricsBucket[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchMetrics = useCallback(async () => {
        if (!flagName || selectedEnvs.length === 0) return;

        setLoading(true);
        setError(null);

        try {
            const periodConfig = PERIOD_OPTIONS.find(p => p.value === period);
            const hours = periodConfig?.hours || 48;
            const endDate = new Date();
            const startDate = new Date(endDate.getTime() - hours * 60 * 60 * 1000);

            // Fetch metrics from all selected environments in parallel
            const metricsPromises = selectedEnvs.map(env =>
                api.get<{ metrics: MetricsBucket[] }>(
                    `/admin/features/${flagName}/metrics`,
                    {
                        params: {
                            startDate: startDate.toISOString(),
                            endDate: endDate.toISOString(),
                        },
                        headers: {
                            'x-environment': env,
                        },
                    }
                ).then(response =>
                    (response.data.metrics || []).map(m => ({ ...m, environment: env }))
                )
            );

            const allMetrics = await Promise.all(metricsPromises);
            setMetrics(allMetrics.flat());
        } catch (err) {
            console.error('Failed to fetch metrics:', err);
            setError(t('featureFlags.metrics.loadFailed'));
        } finally {
            setLoading(false);
        }
    }, [flagName, selectedEnvs, period, t]);

    useEffect(() => {
        fetchMetrics();
    }, [fetchMetrics]);

    // Toggle environment selection (multi-select)
    const handleEnvToggle = (env: string) => {
        setSelectedEnvs(prev => {
            if (prev.includes(env)) {
                // Don't allow deselecting all environments
                if (prev.length === 1) return prev;
                return prev.filter(e => e !== env);
            }
            return [...prev, env];
        });
    };

    const handlePeriodChange = (event: SelectChangeEvent<PeriodOption>) => {
        setPeriod(event.target.value as PeriodOption);
    };

    // Aggregate metrics
    const aggregatedMetrics: AggregatedMetrics = metrics.reduce(
        (acc, m) => ({
            totalYes: acc.totalYes + m.yesCount,
            totalNo: acc.totalNo + m.noCount,
            total: acc.total + m.yesCount + m.noCount,
            variantCounts: m.variantCounts
                ? Object.entries(m.variantCounts).reduce(
                    (vc, [variant, count]) => ({
                        ...vc,
                        [variant]: (vc[variant] || 0) + count,
                    }),
                    acc.variantCounts
                )
                : acc.variantCounts,
        }),
        { totalYes: 0, totalNo: 0, total: 0, variantCounts: {} as Record<string, number> }
    );

    const hasMetrics = metrics.length > 0 && aggregatedMetrics.total > 0;

    // Prepare chart data - sorted by time
    const sortedMetrics = [...metrics].sort(
        (a, b) => new Date(a.metricsBucket).getTime() - new Date(b.metricsBucket).getTime()
    );

    const formatDateTime = (dateStr: string): string => {
        const date = new Date(dateStr);
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        return `${month}/${day} ${hours}:${minutes}`;
    };

    // Determine if this flag has variants
    const hasVariants = Object.keys(aggregatedMetrics.variantCounts).length > 0;

    // Get all unique variant names across all buckets
    const allVariantNames = new Set<string>();
    sortedMetrics.forEach(m => {
        if (m.variantCounts) {
            Object.keys(m.variantCounts).forEach(v => allVariantNames.add(v));
        }
    });
    const variantNamesList = Array.from(allVariantNames);

    // Variant colors for consistent coloring
    const variantColors = [
        theme.palette.primary.main,
        theme.palette.secondary.main,
        theme.palette.info.main,
        theme.palette.warning.main,
        '#9c27b0', // purple
        '#00bcd4', // cyan
        '#ff9800', // orange
        '#795548', // brown
    ];

    // Chart.js data for enabled/disabled (default)
    const chartData = {
        labels: sortedMetrics.map(m => formatDateTime(m.metricsBucket)),
        datasets: [
            {
                label: t('featureFlags.metrics.exposedTrue'),
                data: sortedMetrics.map(m => m.yesCount),
                backgroundColor: theme.palette.success.main,
                borderRadius: 4,
            },
            {
                label: t('featureFlags.metrics.exposedFalse'),
                data: sortedMetrics.map(m => m.noCount),
                backgroundColor: theme.palette.error.main,
                borderRadius: 4,
            },
        ],
    };

    // Chart.js data for variants time series
    const variantChartData = {
        labels: sortedMetrics.map(m => formatDateTime(m.metricsBucket)),
        datasets: variantNamesList.map((variantName, idx) => ({
            label: variantName,
            data: sortedMetrics.map(m => (m.variantCounts?.[variantName] || 0)),
            backgroundColor: variantColors[idx % variantColors.length],
            borderRadius: 4,
        })),
    };

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'bottom' as const,
                labels: {
                    usePointStyle: true,
                    pointStyle: 'rect',
                },
            },
            tooltip: {
                mode: 'index' as const,
                intersect: false,
            },
        },
        scales: {
            x: {
                stacked: true,
                grid: {
                    display: false,
                },
            },
            y: {
                stacked: true,
                beginAtZero: true,
                grid: {
                    color: theme.palette.divider,
                },
            },
        },
    };


    return (
        <Box sx={{ p: 3 }}>
            {/* Header */}
            <Paper
                variant="outlined"
                sx={{
                    p: 2,
                    mb: 3,
                    display: 'inline-block',
                    borderRadius: 1,
                }}
            >
                <Typography variant="subtitle1" fontWeight={600}>
                    {t('featureFlags.metrics.exposureMetrics')}
                </Typography>
            </Paper>

            {/* Controls Row */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3, flexWrap: 'wrap', gap: 2 }}>
                {/* Environment Toggle */}
                <Paper variant="outlined" sx={{ p: 2, borderRadius: 1 }}>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                        {t('featureFlags.metrics.environments')}
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                        {environments.map((env) => {
                            const isSelected = selectedEnvs.includes(env.environment);
                            return (
                                <ToggleButton
                                    key={env.environment}
                                    value={env.environment}
                                    selected={isSelected}
                                    onClick={() => handleEnvToggle(env.environment)}
                                    size="small"
                                    sx={{
                                        textTransform: 'none',
                                        px: 2,
                                        borderRadius: 1,
                                        border: `1px solid ${theme.palette.divider}`,
                                        '&.Mui-selected': {
                                            bgcolor: theme.palette.primary.main,
                                            color: theme.palette.primary.contrastText,
                                            '&:hover': {
                                                bgcolor: theme.palette.primary.dark,
                                            },
                                        },
                                    }}
                                >
                                    {env.environment}
                                </ToggleButton>
                            );
                        })}
                    </Box>
                </Paper>

                {/* Period Selector */}
                <Paper variant="outlined" sx={{ p: 2, borderRadius: 1, minWidth: 180 }}>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                        {t('featureFlags.metrics.period')}
                    </Typography>
                    <FormControl size="small" fullWidth>
                        <Select
                            value={period}
                            onChange={handlePeriodChange}
                        >
                            {PERIOD_OPTIONS.map((option) => (
                                <MenuItem key={option.value} value={option.value}>
                                    {t(option.labelKey)}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                </Paper>
            </Box>

            {/* Metrics Content */}
            {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
                    <CircularProgress />
                </Box>
            ) : error ? (
                <Alert severity="error">{error}</Alert>
            ) : !hasMetrics ? (
                <Paper variant="outlined" sx={{ p: 3, borderRadius: 1 }}>
                    <Typography color="text.secondary">
                        {t('featureFlags.metrics.noMetrics')}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                        {t('featureFlags.metrics.noMetricsHint')}
                    </Typography>
                </Paper>
            ) : (
                <Paper variant="outlined" sx={{ p: 3, borderRadius: 1 }}>
                    {/* Summary Stats */}
                    <Box sx={{ display: 'flex', gap: 4, mb: 4 }}>
                        <Box>
                            <Typography variant="h4" fontWeight={600} color="success.main">
                                {aggregatedMetrics.totalYes.toLocaleString()}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                {t('featureFlags.metrics.exposedTrue')}
                            </Typography>
                        </Box>
                        <Box>
                            <Typography variant="h4" fontWeight={600} color="error.main">
                                {aggregatedMetrics.totalNo.toLocaleString()}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                {t('featureFlags.metrics.exposedFalse')}
                            </Typography>
                        </Box>
                        <Box>
                            <Typography variant="h4" fontWeight={600}>
                                {aggregatedMetrics.total.toLocaleString()}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                {t('featureFlags.metrics.totalRequests')}
                            </Typography>
                        </Box>
                    </Box>

                    {/* Time Series Stacked Bar Chart */}
                    {sortedMetrics.length > 0 && (
                        <Box sx={{ mt: 3 }}>
                            <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 2 }}>
                                {t('featureFlags.metrics.timeSeriesChart')}
                            </Typography>
                            <Box sx={{ height: 300 }}>
                                <Bar data={chartData} options={chartOptions} />
                            </Box>
                        </Box>
                    )}

                    {/* Variant Time Series Chart (if flag has variants) */}
                    {hasVariants && sortedMetrics.length > 0 && variantNamesList.length > 0 && (
                        <Box sx={{ mt: 4 }}>
                            <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 2 }}>
                                {t('featureFlags.metrics.variantTimeSeriesChart')}
                            </Typography>
                            <Box sx={{ height: 300 }}>
                                <Bar data={variantChartData} options={chartOptions} />
                            </Box>
                        </Box>
                    )}

                    {/* Variant Counts */}
                    {Object.keys(aggregatedMetrics.variantCounts).length > 0 && (() => {
                        const variantEntries = Object.entries(aggregatedMetrics.variantCounts);
                        const totalVariantCount = variantEntries.reduce((sum, [, count]) => sum + count, 0);

                        // Doughnut chart data
                        const doughnutData = {
                            labels: variantEntries.map(([variant]) => variant),
                            datasets: [{
                                data: variantEntries.map(([, count]) => count),
                                backgroundColor: variantColors,
                                borderWidth: 2,
                                borderColor: theme.palette.background.paper,
                            }],
                        };

                        const doughnutOptions = {
                            responsive: true,
                            maintainAspectRatio: false,
                            cutout: '60%',
                            plugins: {
                                legend: {
                                    display: false, // We'll show custom legend
                                },
                                tooltip: {
                                    callbacks: {
                                        label: (context: any) => {
                                            const value = context.raw;
                                            const percentage = ((value / totalVariantCount) * 100).toFixed(1);
                                            return `${context.label}: ${value.toLocaleString()} (${percentage}%)`;
                                        },
                                    },
                                },
                            },
                        };

                        return (
                            <Box sx={{ mt: 4 }}>
                                <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 2 }}>
                                    {t('featureFlags.metrics.variantDistribution')}
                                </Typography>

                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                    {/* Doughnut Chart */}
                                    <Box sx={{ width: 200, height: 200, position: 'relative' }}>
                                        <Doughnut data={doughnutData} options={doughnutOptions} />
                                        {/* Center text */}
                                        <Box
                                            sx={{
                                                position: 'absolute',
                                                top: '50%',
                                                left: '50%',
                                                transform: 'translate(-50%, -50%)',
                                                textAlign: 'center',
                                            }}
                                        >
                                            <Typography variant="h6" fontWeight={700}>
                                                {totalVariantCount.toLocaleString()}
                                            </Typography>
                                            <Typography variant="caption" color="text.secondary">
                                                {t('featureFlags.metrics.totalRequests')}
                                            </Typography>
                                        </Box>
                                    </Box>

                                    {/* Legend with details */}
                                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                        {variantEntries.map(([variant, count], idx) => {
                                            const percentage = (count / totalVariantCount) * 100;
                                            return (
                                                <Box key={variant} sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                                    <Box
                                                        sx={{
                                                            width: 12,
                                                            height: 12,
                                                            borderRadius: 0.5,
                                                            bgcolor: variantColors[idx % variantColors.length],
                                                        }}
                                                    />
                                                    <Box>
                                                        <Typography variant="body2" fontWeight={600}>
                                                            {variant}
                                                        </Typography>
                                                        <Typography variant="caption" color="text.secondary">
                                                            {count.toLocaleString()} ({percentage.toFixed(1)}%)
                                                        </Typography>
                                                    </Box>
                                                </Box>
                                            );
                                        })}
                                    </Box>
                                </Box>
                            </Box>
                        );
                    })()}
                </Paper>
            )}
        </Box>
    );
};

export default FeatureFlagMetrics;

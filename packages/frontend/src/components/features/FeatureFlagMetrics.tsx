/**
 * Feature Flag Metrics Component - Unleash Style
 * Displays exposure metrics with line chart and summary cards
 */

import React, { useEffect, useState, useCallback, useMemo } from 'react';
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
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Collapse,
    IconButton,
} from '@mui/material';
import {
    KeyboardArrowDown as ExpandIcon,
    KeyboardArrowUp as CollapseIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import api from '../../services/api';
import { formatWith } from '../../utils/dateFormat';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    ArcElement,
    Title,
    Tooltip,
    Legend,
    Filler,
} from 'chart.js';
import { Line, Doughnut } from 'react-chartjs-2';

// Register Chart.js components
ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    ArcElement,
    Title,
    Tooltip,
    Legend,
    Filler
);

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

interface TimeSeriesPoint {
    time: string;
    displayTime: string;
    exposed: number;
    notExposed: number;
    total: number;
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
}) => {
    const { t } = useTranslation();
    const theme = useTheme();

    // Multi-select environments - default to all environments
    const [selectedEnvs, setSelectedEnvs] = useState<string[]>(
        environments.map(e => e.environment)
    );
    const [period, setPeriod] = useState<PeriodOption>('24h');
    const [metrics, setMetrics] = useState<MetricsBucket[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showTable, setShowTable] = useState(false);

    const fetchMetrics = useCallback(async () => {
        if (!flagName || selectedEnvs.length === 0) return;

        setLoading(true);
        setError(null);

        try {
            const periodConfig = PERIOD_OPTIONS.find(p => p.value === period);
            const hours = periodConfig?.hours || 24;
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
    const aggregatedMetrics: AggregatedMetrics = useMemo(() =>
        metrics.reduce(
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
        ),
        [metrics]
    );

    const hasMetrics = metrics.length > 0 && aggregatedMetrics.total > 0;
    const exposurePercentage = aggregatedMetrics.total > 0
        ? ((aggregatedMetrics.totalYes / aggregatedMetrics.total) * 100).toFixed(0)
        : '0';

    // Prepare time series data - aggregate by time bucket across environments
    const timeSeriesData: TimeSeriesPoint[] = useMemo(() => {
        const bucketMap = new Map<string, TimeSeriesPoint>();

        metrics.forEach(m => {
            const existing = bucketMap.get(m.metricsBucket);
            if (existing) {
                existing.exposed += m.yesCount;
                existing.notExposed += m.noCount;
                existing.total += m.yesCount + m.noCount;
            } else {
                // Use formatWith for consistent timezone handling (MM/DD HH:mm for chart labels)
                const displayTime = formatWith(m.metricsBucket, 'MM/DD HH:mm');
                bucketMap.set(m.metricsBucket, {
                    time: m.metricsBucket,
                    displayTime,
                    exposed: m.yesCount,
                    notExposed: m.noCount,
                    total: m.yesCount + m.noCount,
                });
            }
        });

        return Array.from(bucketMap.values())
            .sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
    }, [metrics]);

    // Line chart data - Unleash style
    const lineChartData = {
        labels: timeSeriesData.map(d => d.displayTime),
        datasets: [
            {
                label: t('featureFlags.metrics.exposed'),
                data: timeSeriesData.map(d => d.exposed),
                borderColor: theme.palette.success.main,
                backgroundColor: 'transparent',
                borderWidth: 2,
                borderDash: [5, 5], // Dashed line for exposed
                tension: 0.3,
                pointRadius: 4,
                pointBackgroundColor: theme.palette.success.main,
            },
            {
                label: t('featureFlags.metrics.notExposed'),
                data: timeSeriesData.map(d => d.notExposed),
                borderColor: theme.palette.error.main,
                backgroundColor: 'transparent',
                borderWidth: 2,
                tension: 0.3,
                pointRadius: 4,
                pointBackgroundColor: theme.palette.error.main,
            },
            {
                label: t('featureFlags.metrics.totalRequests'),
                data: timeSeriesData.map(d => d.total),
                borderColor: theme.palette.primary.main,
                backgroundColor: 'transparent',
                borderWidth: 2,
                tension: 0.3,
                pointRadius: 4,
                pointBackgroundColor: theme.palette.primary.main,
            },
        ],
    };

    const lineChartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
            mode: 'index' as const,
            intersect: false,
        },
        plugins: {
            legend: {
                position: 'top' as const,
                align: 'end' as const,
                labels: {
                    usePointStyle: true,
                    pointStyle: 'line',
                    boxWidth: 30,
                },
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
                    maxRotation: 45,
                    minRotation: 45,
                },
            },
            y: {
                beginAtZero: true,
                grid: {
                    color: theme.palette.divider,
                },
                title: {
                    display: true,
                    text: t('featureFlags.metrics.numberOfRequests'),
                },
            },
        },
    };

    // Variant colors
    const variantColors = [
        theme.palette.primary.main,
        theme.palette.secondary.main,
        theme.palette.info.main,
        theme.palette.warning.main,
        '#9c27b0',
        '#00bcd4',
        '#ff9800',
        '#795548',
    ];

    // Determine if this flag has variants
    const hasVariants = Object.keys(aggregatedMetrics.variantCounts).length > 0;

    return (
        <Box sx={{ p: 3 }}>
            {/* Controls Row - Unleash style */}
            <Box sx={{ display: 'flex', gap: 3, mb: 3, flexWrap: 'wrap', alignItems: 'flex-start' }}>
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
                <>
                    {/* Line Chart - Unleash style */}
                    <Paper variant="outlined" sx={{ p: 3, borderRadius: 1, mb: 3 }}>
                        <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 2 }}>
                            {t('featureFlags.metrics.requestsInPeriod', {
                                period: t(PERIOD_OPTIONS.find(p => p.value === period)?.labelKey || '')
                            })}
                        </Typography>
                        <Box sx={{ height: 300 }}>
                            <Line data={lineChartData} options={lineChartOptions} />
                        </Box>
                    </Paper>

                    {/* Summary Cards - Unleash style (bottom) */}
                    <Box sx={{ display: 'flex', gap: 3, mb: 3 }}>
                        <Paper
                            variant="outlined"
                            sx={{
                                p: 3,
                                borderRadius: 1,
                                flex: 1,
                                textAlign: 'center',
                                borderLeft: `4px solid ${theme.palette.success.main}`,
                            }}
                        >
                            <Typography variant="h3" fontWeight={600} color="success.main">
                                {aggregatedMetrics.totalYes.toLocaleString()}
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                                {t('featureFlags.metrics.exposure')}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                                {t('featureFlags.metrics.totalExposureInPeriod')}
                            </Typography>
                        </Paper>

                        <Paper
                            variant="outlined"
                            sx={{
                                p: 3,
                                borderRadius: 1,
                                flex: 1,
                                textAlign: 'center',
                                borderLeft: `4px solid ${theme.palette.info.main}`,
                            }}
                        >
                            <Typography variant="h3" fontWeight={600} color="info.main">
                                {exposurePercentage}%
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                                {t('featureFlags.metrics.exposurePercent')}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                                {t('featureFlags.metrics.percentExposedInPeriod')}
                            </Typography>
                        </Paper>

                        <Paper
                            variant="outlined"
                            sx={{
                                p: 3,
                                borderRadius: 1,
                                flex: 1,
                                textAlign: 'center',
                                borderLeft: `4px solid ${theme.palette.primary.main}`,
                            }}
                        >
                            <Typography variant="h3" fontWeight={600} color="primary.main">
                                {aggregatedMetrics.total.toLocaleString()}
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                                {t('featureFlags.metrics.requests')}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                                {t('featureFlags.metrics.totalRequestsInPeriod')}
                            </Typography>
                        </Paper>
                    </Box>

                    {/* Hourly Metrics Table */}
                    <Paper variant="outlined" sx={{ borderRadius: 1 }}>
                        <Box
                            sx={{
                                p: 2,
                                display: 'flex',
                                alignItems: 'center',
                                cursor: 'pointer',
                                '&:hover': { bgcolor: 'action.hover' },
                            }}
                            onClick={() => setShowTable(!showTable)}
                        >
                            <IconButton size="small">
                                {showTable ? <CollapseIcon /> : <ExpandIcon />}
                            </IconButton>
                            <Typography variant="subtitle2" sx={{ ml: 1 }}>
                                {t('featureFlags.metrics.hourlyBreakdown')}
                            </Typography>
                        </Box>
                        <Collapse in={showTable}>
                            <TableContainer>
                                <Table size="small">
                                    <TableHead>
                                        <TableRow>
                                            <TableCell>{t('featureFlags.metrics.time')}</TableCell>
                                            <TableCell align="right">{t('featureFlags.metrics.exposed')}</TableCell>
                                            <TableCell align="right">{t('featureFlags.metrics.notExposed')}</TableCell>
                                            <TableCell align="right">{t('featureFlags.metrics.total')}</TableCell>
                                            <TableCell align="right">{t('featureFlags.metrics.exposureRate')}</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {timeSeriesData.map((row) => {
                                            const rate = row.total > 0
                                                ? ((row.exposed / row.total) * 100).toFixed(1)
                                                : '0.0';
                                            return (
                                                <TableRow key={row.time}>
                                                    <TableCell>{row.displayTime}</TableCell>
                                                    <TableCell align="right" sx={{ color: 'success.main' }}>
                                                        {row.exposed.toLocaleString()}
                                                    </TableCell>
                                                    <TableCell align="right" sx={{ color: 'error.main' }}>
                                                        {row.notExposed.toLocaleString()}
                                                    </TableCell>
                                                    <TableCell align="right">
                                                        {row.total.toLocaleString()}
                                                    </TableCell>
                                                    <TableCell align="right">
                                                        {rate}%
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        </Collapse>
                    </Paper>

                    {/* Variant Distribution (if flag has variants) */}
                    {hasVariants && (() => {
                        const variantEntries = Object.entries(aggregatedMetrics.variantCounts);
                        const totalVariantCount = variantEntries.reduce((sum, [, count]) => sum + count, 0);

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
                                    display: false,
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
                            <Paper variant="outlined" sx={{ p: 3, borderRadius: 1, mt: 3 }}>
                                <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 2 }}>
                                    {t('featureFlags.metrics.variantDistribution')}
                                </Typography>

                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                    {/* Doughnut Chart */}
                                    <Box sx={{ width: 180, height: 180, position: 'relative' }}>
                                        <Doughnut data={doughnutData} options={doughnutOptions} />
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
                                                {t('featureFlags.metrics.total')}
                                            </Typography>
                                        </Box>
                                    </Box>

                                    {/* Legend */}
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
                            </Paper>
                        );
                    })()}
                </>
            )}
        </Box>
    );
};

export default FeatureFlagMetrics;

/**
 * Feature Flag Metrics Component
 * Displays exposure metrics for a feature flag with environment and period selection
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
    Box,
    Paper,
    Typography,
    ToggleButtonGroup,
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

    const [selectedEnv, setSelectedEnv] = useState<string>(currentEnvironment);
    const [period, setPeriod] = useState<PeriodOption>('48h');
    const [metrics, setMetrics] = useState<MetricsBucket[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchMetrics = useCallback(async () => {
        if (!flagName || !selectedEnv) return;

        setLoading(true);
        setError(null);

        try {
            const periodConfig = PERIOD_OPTIONS.find(p => p.value === period);
            const hours = periodConfig?.hours || 48;
            const endDate = new Date();
            const startDate = new Date(endDate.getTime() - hours * 60 * 60 * 1000);

            const response = await api.get<{ metrics: MetricsBucket[] }>(
                `/admin/feature-flags/${flagName}/metrics`,
                {
                    params: {
                        startDate: startDate.toISOString(),
                        endDate: endDate.toISOString(),
                    },
                    headers: {
                        'x-environment': selectedEnv,
                    },
                }
            );

            setMetrics(response.data.metrics || []);
        } catch (err) {
            console.error('Failed to fetch metrics:', err);
            setError(t('featureFlags.metrics.loadFailed'));
        } finally {
            setLoading(false);
        }
    }, [flagName, selectedEnv, period, t]);

    useEffect(() => {
        fetchMetrics();
    }, [fetchMetrics]);

    const handleEnvChange = (_event: React.MouseEvent<HTMLElement>, newEnv: string | null) => {
        if (newEnv) {
            setSelectedEnv(newEnv);
        }
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
                    <ToggleButtonGroup
                        value={selectedEnv}
                        exclusive
                        onChange={handleEnvChange}
                        size="small"
                    >
                        {environments.map((env) => (
                            <ToggleButton
                                key={env.environment}
                                value={env.environment}
                                sx={{
                                    textTransform: 'none',
                                    px: 2,
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
                        ))}
                    </ToggleButtonGroup>
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
                    <Box sx={{ display: 'flex', gap: 4, mb: 3 }}>
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

                    {/* Variant Counts */}
                    {Object.keys(aggregatedMetrics.variantCounts).length > 0 && (
                        <Box sx={{ mt: 3 }}>
                            <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 2 }}>
                                {t('featureFlags.metrics.variantDistribution')}
                            </Typography>
                            <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                                {Object.entries(aggregatedMetrics.variantCounts).map(([variant, count]) => (
                                    <Box key={variant}>
                                        <Typography variant="h5" fontWeight={600}>
                                            {count.toLocaleString()}
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary">
                                            {variant}
                                        </Typography>
                                    </Box>
                                ))}
                            </Box>
                        </Box>
                    )}
                </Paper>
            )}
        </Box>
    );
};

export default FeatureFlagMetrics;

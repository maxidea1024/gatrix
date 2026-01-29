/**
 * Environment Settings Card - Unleash-style environment configuration card
 * 
 * Features:
 * - Expandable accordion with environment name, strategy count, toggle
 * - Shows strategies with OR separators when expanded
 * - Edit button opens drawer for detailed editing
 */
import React from 'react';
import {
    Box,
    Paper,
    Typography,
    Chip,
    IconButton,
    Accordion,
    AccordionSummary,
    AccordionDetails,
    Button,
    Stack,
    Divider,
    Tooltip,
} from '@mui/material';
import {
    ExpandMore as ExpandMoreIcon,
    Edit as EditIcon,
    Add as AddIcon,
    ContentCopy as CopyIcon,
    MoreVert as MoreIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import FeatureSwitch from '../common/FeatureSwitch';
import { getContrastColor } from '../../utils/colorUtils';

export interface Strategy {
    id?: string;
    name: string;
    title?: string;
    parameters?: Record<string, any>;
    constraints?: any[];
    segments?: string[];
    sortOrder?: number;
    disabled?: boolean;
}

export interface EnvironmentData {
    environment: string;
    displayName: string;
    color?: string;
    isEnabled: boolean;
    strategies: Strategy[];
    variants?: any[];
    lastSeenAt?: string;
}

interface EnvironmentSettingsCardProps {
    envData: EnvironmentData;
    segments: any[];
    isArchived?: boolean;
    canManage: boolean;
    onToggle: () => void;
    onEditClick: () => void;
    onAddStrategy: () => void;
    onEditStrategy: (strategy: Strategy) => void;
    expanded?: boolean;
    onExpandChange?: (expanded: boolean) => void;
    getStrategyTitle: (strategyName: string) => string;
}

const EnvironmentSettingsCard: React.FC<EnvironmentSettingsCardProps> = ({
    envData,
    segments,
    isArchived,
    canManage,
    onToggle,
    onEditClick,
    onAddStrategy,
    onEditStrategy,
    expanded,
    onExpandChange,
    getStrategyTitle,
}) => {
    const { t } = useTranslation();

    const strategies = envData.strategies || [];
    const strategiesCount = strategies.length;

    // Get segment names for display
    const getSegmentNames = (segmentIds: string[] = []) => {
        return segmentIds
            .map(id => segments.find(s => s.id === id)?.name || id)
            .join(', ');
    };

    return (
        <Paper
            variant="outlined"
            sx={{
                borderLeftWidth: 4,
                borderLeftColor: envData.color || '#888',
                overflow: 'hidden',
            }}
        >
            <Accordion
                expanded={expanded}
                onChange={(_, isExpanded) => onExpandChange?.(isExpanded)}
                disableGutters
                sx={{
                    '&:before': { display: 'none' },
                    bgcolor: 'transparent',
                }}
            >
                <AccordionSummary
                    expandIcon={<ExpandMoreIcon />}
                    sx={{
                        px: 2,
                        '& .MuiAccordionSummary-content': {
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 2,
                        },
                    }}
                >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1 }}>
                        {/* Environment name and info */}
                        <Box>
                            <Typography variant="caption" color="text.secondary">
                                {t('featureFlags.environment')}
                            </Typography>
                            <Typography variant="subtitle1" fontWeight={600}>
                                {envData.displayName}
                            </Typography>
                        </Box>

                        {/* Strategy count */}
                        <Chip
                            label={t('featureFlags.strategiesCount', { count: strategiesCount })}
                            size="small"
                            color="primary"
                            variant="outlined"
                            sx={{ ml: 2 }}
                        />
                    </Box>

                    {/* Right side: metrics placeholder + toggle */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }} onClick={(e) => e.stopPropagation()}>
                        <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'right' }}>
                            {t('featureFlags.noMetricsYet')}
                        </Typography>
                        <FeatureSwitch
                            size="small"
                            checked={envData.isEnabled}
                            onChange={onToggle}
                            disabled={!canManage || isArchived}
                        />
                    </Box>
                </AccordionSummary>

                <AccordionDetails sx={{ px: 2, pt: 0, pb: 2 }}>
                    {strategies.length === 0 ? (
                        <Box sx={{ py: 3, textAlign: 'center' }}>
                            <Typography color="text.secondary" gutterBottom>
                                {t('featureFlags.noStrategies')}
                            </Typography>
                            {canManage && (
                                <Button
                                    variant="contained"
                                    startIcon={<AddIcon />}
                                    onClick={onAddStrategy}
                                    size="small"
                                >
                                    {t('featureFlags.addStrategy')}
                                </Button>
                            )}
                        </Box>
                    ) : (
                        <Stack spacing={2}>
                            {strategies.map((strategy, index) => (
                                <React.Fragment key={strategy.id || index}>
                                    {/* OR divider between strategies */}
                                    {index > 0 && (
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                            <Divider sx={{ flexGrow: 1 }} />
                                            <Chip
                                                label="OR"
                                                size="small"
                                                variant="outlined"
                                                color="secondary"
                                                sx={{ fontWeight: 600, fontSize: '0.7rem' }}
                                            />
                                            <Divider sx={{ flexGrow: 1 }} />
                                        </Box>
                                    )}

                                    {/* Strategy card */}
                                    <Paper variant="outlined" sx={{ p: 2 }}>
                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                            <Box sx={{ flex: 1 }}>
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                                    <Typography fontWeight={600}>
                                                        {getStrategyTitle(strategy.name)}
                                                    </Typography>
                                                    {strategy.disabled && (
                                                        <Chip
                                                            label={t('featureFlags.strategyDisabled')}
                                                            size="small"
                                                            color="warning"
                                                        />
                                                    )}
                                                </Box>

                                                {/* Segments */}
                                                {strategy.segments && strategy.segments.length > 0 && (
                                                    <Box sx={{ mb: 1 }}>
                                                        <Typography variant="caption" color="text.secondary">
                                                            {t('featureFlags.segment')}:
                                                        </Typography>
                                                        <Typography variant="body2">
                                                            {getSegmentNames(strategy.segments)}
                                                        </Typography>
                                                    </Box>
                                                )}

                                                {/* Rollout percentage */}
                                                {strategy.parameters?.rollout !== undefined && (
                                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                        <Typography variant="caption" color="text.secondary">
                                                            {t('featureFlags.rollout')}:
                                                        </Typography>
                                                        <Chip
                                                            label={`${strategy.parameters.rollout}%`}
                                                            size="small"
                                                            variant="outlined"
                                                        />
                                                        <Typography variant="body2" color="text.secondary">
                                                            {t('featureFlags.ofYourBase')}
                                                        </Typography>
                                                    </Box>
                                                )}

                                                {/* Constraints count */}
                                                {strategy.constraints && strategy.constraints.length > 0 && (
                                                    <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                                                        +{strategy.constraints.length} {t('featureFlags.constraints').toLowerCase()}
                                                    </Typography>
                                                )}
                                            </Box>

                                            {/* Action buttons */}
                                            {canManage && (
                                                <Box sx={{ display: 'flex', gap: 0.5 }}>
                                                    <Tooltip title={t('common.edit')}>
                                                        <IconButton
                                                            size="small"
                                                            onClick={() => onEditStrategy(strategy)}
                                                        >
                                                            <EditIcon fontSize="small" />
                                                        </IconButton>
                                                    </Tooltip>
                                                    <Tooltip title={t('common.copy')}>
                                                        <IconButton size="small">
                                                            <CopyIcon fontSize="small" />
                                                        </IconButton>
                                                    </Tooltip>
                                                    <IconButton size="small">
                                                        <MoreIcon fontSize="small" />
                                                    </IconButton>
                                                </Box>
                                            )}
                                        </Box>
                                    </Paper>
                                </React.Fragment>
                            ))}

                            {/* Add strategy button */}
                            {canManage && (
                                <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                                    <Button
                                        variant="contained"
                                        startIcon={<AddIcon />}
                                        onClick={onAddStrategy}
                                        size="small"
                                    >
                                        {t('featureFlags.addStrategy')}
                                    </Button>
                                </Box>
                            )}
                        </Stack>
                    )}
                </AccordionDetails>
            </Accordion>
        </Paper>
    );
};

export default EnvironmentSettingsCard;

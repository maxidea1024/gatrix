/**
 * ConstraintDisplay - Unleash-style constraint display component
 * Reusable component for displaying constraints in a clean, readable format
 */
import React from 'react';
import { Box, Typography, Chip, Paper, Stack, Tooltip } from '@mui/material';
import { FilterList as ConstraintIcon } from '@mui/icons-material';
import { formatDateTime } from '../../utils/dateFormat';

export interface ConstraintValue {
    contextName: string;
    operator: string;
    value?: string;
    values?: string[];
    inverted?: boolean;
    caseInsensitive?: boolean;
}

export interface ContextFieldInfo {
    fieldName: string;
    displayName?: string;
    description?: string;
    fieldType?: string;
}

interface ConstraintDisplayProps {
    constraint: ConstraintValue;
    compact?: boolean;
    contextFields?: ContextFieldInfo[];
}

// Get operator display label
const getOperatorLabel = (op: string): string => {
    const opLabels: Record<string, string> = {
        'str_eq': '=',
        'str_neq': '≠',
        'str_contains': '⊃',
        'str_starts_with': '^',
        'str_ends_with': '$',
        'str_in': '∈',
        'str_not_in': '∉',
        'num_eq': '=',
        'num_gt': '>',
        'num_gte': '≥',
        'num_lt': '<',
        'num_lte': '≤',
        'bool_is': '=',
        'date_gt': '>',
        'date_gte': '≥',
        'date_lt': '<',
        'date_lte': '≤',
        'semver_eq': '=',
        'semver_gt': '>',
        'semver_gte': '≥',
        'semver_lt': '<',
        'semver_lte': '≤',
    };
    return opLabels[op] || op;
};

// Format date using utility function
const formatDateValueDisplay = (value: string): string => {
    if (!value) return value;
    try {
        return formatDateTime(value);
    } catch {
        return value;
    }
};

// Check if operator is date-related
const isDateOperator = (op: string): boolean => {
    return op.startsWith('date_');
};

/**
 * Single constraint display row - Unleash style
 */
export const ConstraintDisplay: React.FC<ConstraintDisplayProps> = ({ constraint, compact = false, contextFields = [] }) => {

    // Find context field info for tooltip (ensure contextFields is an array)
    const fieldsArray = Array.isArray(contextFields) ? contextFields : [];
    const contextFieldInfo = fieldsArray.find(f => f.fieldName === constraint.contextName);
    const contextFieldDescription = contextFieldInfo?.description || contextFieldInfo?.displayName || '';

    // Get constraint value display (for single values)
    const getSingleValueDisplay = (): string => {
        if (constraint.value !== undefined && constraint.value !== null) {
            if (typeof constraint.value === 'boolean') {
                return constraint.value ? 'true' : 'false';
            }
            const value = String(constraint.value);
            // Format date values
            if (isDateOperator(constraint.operator)) {
                return formatDateValueDisplay(value);
            }
            return value;
        }
        return '-';
    };

    const isMultiValue = constraint.values && constraint.values.length > 0;
    const showCaseSensitivity = constraint.operator?.startsWith('str_');

    if (compact) {
        const displayValue = isMultiValue ? constraint.values!.join(', ') : getSingleValueDisplay();
        return (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Typography variant="caption" fontWeight={500}>{constraint.contextName}</Typography>
                <Typography variant="caption" color="text.secondary">
                    {getOperatorLabel(constraint.operator)}
                </Typography>
                <Typography variant="caption" fontWeight={500}>{displayValue}</Typography>
            </Box>
        );
    }

    // Get readable operator text and description for tooltip
    const getOperatorInfo = (op: string): { text: string; description: string } => {
        const opInfo: Record<string, { text: string; description: string }> = {
            'str_eq': { text: 'equals', description: 'String equals (exact match)' },
            'str_neq': { text: 'not equals', description: 'String not equals' },
            'str_contains': { text: 'contains', description: 'String contains substring' },
            'str_starts_with': { text: 'starts with', description: 'String starts with prefix' },
            'str_ends_with': { text: 'ends with', description: 'String ends with suffix' },
            'str_in': { text: 'is one of', description: 'Value matches one of the listed values' },
            'str_not_in': { text: 'is not one of', description: 'Value does not match any of the listed values' },
            'num_eq': { text: 'equals', description: 'Number equals' },
            'num_gt': { text: 'greater than', description: 'Number is greater than' },
            'num_gte': { text: 'greater or equal', description: 'Number is greater than or equal to' },
            'num_lt': { text: 'less than', description: 'Number is less than' },
            'num_lte': { text: 'less or equal', description: 'Number is less than or equal to' },
            'bool_is': { text: 'is', description: 'Boolean equals' },
            'date_gt': { text: 'is after', description: 'Date is after the specified time' },
            'date_gte': { text: 'is on or after', description: 'Date is on or after the specified time' },
            'date_lt': { text: 'is before', description: 'Date is before the specified time' },
            'date_lte': { text: 'is on or before', description: 'Date is on or before the specified time' },
            'semver_eq': { text: 'equals', description: 'Semantic version equals' },
            'semver_gt': { text: 'greater than', description: 'Semantic version is greater than' },
            'semver_gte': { text: 'greater or equal', description: 'Semantic version is greater than or equal to' },
            'semver_lt': { text: 'less than', description: 'Semantic version is less than' },
            'semver_lte': { text: 'less or equal', description: 'Semantic version is less than or equal to' },
        };
        return opInfo[op] || { text: op, description: op };
    };

    const operatorInfo = getOperatorInfo(constraint.operator);

    return (
        <Box
            sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                px: 2,
                py: 1.25,
                border: 1,
                borderColor: 'divider',
                borderRadius: 6,
                bgcolor: 'action.hover',
                flexWrap: 'wrap',
            }}
        >
            {/* Constraint icon */}
            <Tooltip title="Constraint condition">
                <ConstraintIcon sx={{ fontSize: 18, color: 'text.secondary', flexShrink: 0 }} />
            </Tooltip>

            {/* Context Name - Bold text with tooltip for description */}
            <Tooltip title={contextFieldDescription} arrow placement="top" disableHoverListener={!contextFieldDescription}>
                <Typography
                    variant="body2"
                    sx={{
                        fontWeight: 600,
                        fontSize: '0.85rem',
                        color: 'text.primary',
                        cursor: contextFieldDescription ? 'help' : 'default',
                    }}
                >
                    {constraint.contextName}
                </Typography>
            </Tooltip>

            {/* Inverted indicator - shows NOT when constraint is inverted */}
            {constraint.inverted && (
                <Tooltip title="This condition is inverted (NOT)">
                    <Chip
                        label="NOT"
                        size="small"
                        sx={{
                            height: 22,
                            fontSize: '0.7rem',
                            fontWeight: 600,
                            bgcolor: 'error.main',
                            color: 'error.contrastText',
                            borderRadius: 3,
                            '& .MuiChip-label': {
                                px: 0.75,
                            },
                        }}
                    />
                </Tooltip>
            )}

            {/* Operator - Rounded chip with tooltip description */}
            <Tooltip title={operatorInfo.description} arrow>
                <Chip
                    label={operatorInfo.text}
                    size="small"
                    sx={{
                        height: 24,
                        fontSize: '0.75rem',
                        fontWeight: 400,
                        bgcolor: 'action.selected',
                        color: 'text.secondary',
                        border: 1,
                        borderColor: 'divider',
                        borderRadius: 3,
                        cursor: 'help',
                        '& .MuiChip-label': {
                            px: 1.5,
                        },
                    }}
                />
            </Tooltip>

            {/* Case sensitivity indicator for string operators */}
            {showCaseSensitivity && (
                <Tooltip title={constraint.caseInsensitive ? 'Case insensitive' : 'Case sensitive'}>
                    <Chip
                        label={constraint.caseInsensitive ? 'Aa' : 'AA'}
                        size="small"
                        sx={{
                            height: 24,
                            fontSize: '0.7rem',
                            fontWeight: 500,
                            minWidth: 32,
                            fontFamily: 'monospace',
                            borderRadius: 3,
                            bgcolor: 'action.selected',
                            color: 'text.secondary',
                            border: 1,
                            borderColor: 'divider',
                            '& .MuiChip-label': {
                                px: 1,
                            },
                        }}
                    />
                </Tooltip>
            )}

            {/* Values - Always display as chips */}
            {isMultiValue ? (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, alignItems: 'center' }}>
                    {constraint.values!.map((val, idx) => (
                        <Chip
                            key={idx}
                            label={val}
                            size="small"
                            sx={{
                                height: 22,
                                fontSize: '0.75rem',
                                fontWeight: 500,
                                bgcolor: 'action.selected',
                                color: 'text.primary',
                                borderRadius: '16px',
                                '& .MuiChip-label': {
                                    px: 1.25,
                                },
                            }}
                        />
                    ))}
                </Box>
            ) : (
                <Chip
                    label={getSingleValueDisplay()}
                    size="small"
                    sx={{
                        height: 22,
                        fontSize: '0.75rem',
                        fontWeight: 500,
                        bgcolor: 'action.selected',
                        color: 'text.primary',
                        borderRadius: '16px',
                        '& .MuiChip-label': {
                            px: 1.25,
                        },
                    }}
                />
            )}
        </Box>
    );
};

interface ConstraintListProps {
    constraints: ConstraintValue[];
    title?: string;
    contextFields?: ContextFieldInfo[];
}

/**
 * List of constraints with AND separators
 */
export const ConstraintList: React.FC<ConstraintListProps> = ({ constraints, title, contextFields = [] }) => {
    if (!constraints || constraints.length === 0) {
        return (
            <Typography variant="caption" color="text.secondary" fontStyle="italic">
                No constraints defined
            </Typography>
        );
    }

    return (
        <Stack spacing={0}>
            {title && (
                <Typography variant="caption" color="text.secondary" sx={{ mb: 1 }}>
                    {title}
                </Typography>
            )}
            {constraints.map((c, i) => (
                <React.Fragment key={i}>
                    {i > 0 && (
                        <Box sx={{ display: 'flex', alignItems: 'center', ml: 1, my: -0.5, position: 'relative', zIndex: 2 }}>
                            <Chip
                                label="AND"
                                size="small"
                                sx={{
                                    height: 18,
                                    fontSize: '0.6rem',
                                    fontWeight: 700,
                                    bgcolor: 'background.paper',
                                    color: 'text.secondary',
                                    border: 1,
                                    borderColor: 'divider',
                                    '& .MuiChip-label': {
                                        px: 0.75,
                                    },
                                }}
                            />
                        </Box>
                    )}
                    <ConstraintDisplay constraint={c} contextFields={contextFields} />
                </React.Fragment>
            ))}
        </Stack>
    );
};

interface SegmentPreviewProps {
    segmentName: string;
    displayName?: string;
    constraints: ConstraintValue[];
    onClose?: () => void;
}

/**
 * Segment preview card showing segment name and its constraints
 */
export const SegmentPreview: React.FC<SegmentPreviewProps> = ({
    segmentName,
    displayName,
    constraints,
}) => {
    return (
        <Paper
            variant="outlined"
            sx={{
                p: 2,
                mt: 1,
                bgcolor: 'background.default',
                borderColor: 'primary.light',
                borderWidth: 2,
            }}
        >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
                    세그먼트 조건
                </Typography>
            </Box>
            <ConstraintList constraints={constraints} />
        </Paper>
    );
};

export default ConstraintDisplay;

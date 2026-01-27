/**
 * ConstraintDisplay - Unleash-style constraint display component
 * Reusable component for displaying constraints in a clean, readable format
 */
import React from 'react';
import { Box, Typography, Chip, Paper, Stack, Tooltip } from '@mui/material';
import { getStoredTimezone } from '../../utils/dateFormat';

export interface ConstraintValue {
    contextName: string;
    operator: string;
    value?: string;
    values?: string[];
    inverted?: boolean;
    caseInsensitive?: boolean;
}

interface ConstraintDisplayProps {
    constraint: ConstraintValue;
    compact?: boolean;
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

// Format date with timezone
const formatDateValue = (value: string, timezone?: string): string => {
    if (!value) return value;
    try {
        const date = new Date(value);
        if (isNaN(date.getTime())) return value;

        // Format with timezone if available
        const options: Intl.DateTimeFormatOptions = {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            timeZone: timezone || 'UTC',
            timeZoneName: 'short'
        };
        return new Intl.DateTimeFormat('ko-KR', options).format(date);
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
export const ConstraintDisplay: React.FC<ConstraintDisplayProps> = ({ constraint, compact = false }) => {
    // Get user's configured timezone from settings
    const timezone = getStoredTimezone();

    // Get constraint value display
    const getValueDisplay = (): string => {
        let value = '';
        if (constraint.values && constraint.values.length > 0) {
            value = constraint.values.join(', ');
        } else if (constraint.value !== undefined && constraint.value !== null) {
            if (typeof constraint.value === 'boolean') {
                return constraint.value ? 'true' : 'false';
            }
            value = String(constraint.value);
        } else {
            return '-';
        }

        // Format date values with timezone
        if (isDateOperator(constraint.operator)) {
            return formatDateValue(value, timezone);
        }

        return value;
    };

    const valueDisplay = getValueDisplay();
    const showCaseSensitivity = constraint.operator?.startsWith('str_');

    if (compact) {
        return (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Typography variant="caption" fontWeight={500}>{constraint.contextName}</Typography>
                <Typography variant="caption" color="text.secondary">
                    {getOperatorLabel(constraint.operator)}
                </Typography>
                <Typography variant="caption" fontWeight={500}>{valueDisplay}</Typography>
            </Box>
        );
    }

    // Get readable operator text
    const getOperatorText = (op: string): string => {
        const opTexts: Record<string, string> = {
            'str_eq': 'equals',
            'str_neq': 'not equals',
            'str_contains': 'contains',
            'str_starts_with': 'starts with',
            'str_ends_with': 'ends with',
            'str_in': 'is one of',
            'str_not_in': 'is not one of',
            'num_eq': 'equals',
            'num_gt': 'greater than',
            'num_gte': 'greater than or equals',
            'num_lt': 'less than',
            'num_lte': 'less than or equals',
            'bool_is': 'is',
            'date_gt': 'is after',
            'date_gte': 'is on or after',
            'date_lt': 'is before',
            'date_lte': 'is on or before',
            'semver_eq': 'equals',
            'semver_gt': 'greater than',
            'semver_gte': 'greater than or equals',
            'semver_lt': 'less than',
            'semver_lte': 'less than or equals',
        };
        return opTexts[op] || op;
    };

    return (
        <Box
            sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                px: 2,
                py: 1.25,
                border: 1,
                borderColor: 'grey.300',
                borderRadius: 6,
                bgcolor: 'grey.50',
            }}
        >
            {/* Constraint label */}
            <Typography
                variant="body2"
                sx={{
                    color: 'text.secondary',
                    fontSize: '0.8rem',
                    flexShrink: 0,
                }}
            >
                Constraint
            </Typography>

            {/* Context Name - Bold text */}
            <Typography
                variant="body2"
                sx={{
                    fontWeight: 600,
                    fontSize: '0.85rem',
                    color: 'text.primary',
                }}
            >
                {constraint.contextName}
            </Typography>

            {/* Operator - Rounded chip with light gray background */}
            <Chip
                label={getOperatorText(constraint.operator)}
                size="small"
                sx={{
                    height: 24,
                    fontSize: '0.75rem',
                    fontWeight: 400,
                    bgcolor: 'grey.200',
                    color: 'text.secondary',
                    borderRadius: 3,
                    '& .MuiChip-label': {
                        px: 1.5,
                    },
                }}
            />

            {/* Case sensitivity indicator for string operators */}
            {showCaseSensitivity && (
                <Tooltip title={constraint.caseInsensitive ? 'Case insensitive' : 'Case sensitive'}>
                    <Chip
                        label={constraint.caseInsensitive ? 'Aa' : 'AA'}
                        size="small"
                        variant="outlined"
                        sx={{
                            height: 24,
                            fontSize: '0.7rem',
                            fontWeight: 500,
                            minWidth: 32,
                            fontFamily: 'monospace',
                            borderRadius: 3,
                            borderColor: 'grey.400',
                            color: 'text.secondary',
                            '& .MuiChip-label': {
                                px: 1,
                            },
                        }}
                    />
                </Tooltip>
            )}

            {/* Value - Bold text */}
            <Typography
                variant="body2"
                sx={{
                    fontWeight: 600,
                    fontSize: '0.85rem',
                    color: 'text.primary',
                    maxWidth: 300,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                }}
            >
                {valueDisplay}
            </Typography>
        </Box>
    );
};

interface ConstraintListProps {
    constraints: ConstraintValue[];
    title?: string;
}

/**
 * List of constraints with AND separators
 */
export const ConstraintList: React.FC<ConstraintListProps> = ({ constraints, title }) => {
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
                    <ConstraintDisplay constraint={c} />
                    {i < constraints.length - 1 && (
                        <Box sx={{ display: 'flex', justifyContent: 'center', py: 0.5 }}>
                            <Chip
                                label="AND"
                                size="small"
                                sx={{
                                    height: 20,
                                    fontSize: '0.65rem',
                                    bgcolor: 'grey.200',
                                    color: 'text.secondary',
                                    fontWeight: 600,
                                    borderRadius: 2,
                                    '& .MuiChip-label': {
                                        px: 1,
                                    },
                                }}
                            />
                        </Box>
                    )}
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

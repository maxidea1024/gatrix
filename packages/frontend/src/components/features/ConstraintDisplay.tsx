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

    return (
        <Box
            sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                p: 1.5,
                border: 1,
                borderColor: 'divider',
                borderRadius: 1,
                bgcolor: 'background.paper',
                flexWrap: 'wrap',
            }}
        >
            {/* Context Name - Blue chip */}
            <Chip
                label={constraint.contextName}
                size="small"
                sx={{
                    bgcolor: 'primary.main',
                    color: 'primary.contrastText',
                    fontWeight: 600,
                    fontSize: '0.8rem',
                    height: 28,
                }}
            />

            {/* Operator - Outlined chip */}
            <Chip
                label={getOperatorLabel(constraint.operator)}
                size="small"
                variant="outlined"
                sx={{
                    height: 28,
                    fontSize: '0.8rem',
                    fontWeight: 500,
                    minWidth: 32,
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
                            height: 28,
                            fontSize: '0.75rem',
                            minWidth: 36,
                            fontFamily: 'monospace',
                        }}
                    />
                </Tooltip>
            )}

            {/* Value - Blue background */}
            <Box
                sx={{
                    px: 1.5,
                    py: 0.5,
                    bgcolor: 'primary.main',
                    color: 'primary.contrastText',
                    borderRadius: 0.5,
                    fontFamily: 'monospace',
                    fontSize: '0.85rem',
                    fontWeight: 500,
                    maxWidth: 400,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                }}
            >
                {valueDisplay}
            </Box>
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
                                    height: 22,
                                    fontSize: '0.7rem',
                                    bgcolor: 'grey.200',
                                    color: 'text.secondary',
                                    fontWeight: 600,
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

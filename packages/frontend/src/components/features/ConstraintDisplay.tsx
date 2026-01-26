/**
 * ConstraintDisplay - Unleash-style constraint display component
 * Reusable component for displaying constraints in a clean, readable format
 */
import React from 'react';
import { Box, Typography, Chip, Paper, Stack, Tooltip } from '@mui/material';
import TextFieldsIcon from '@mui/icons-material/TextFields';

export interface ConstraintValue {
    contextName: string;
    operator: string;
    value?: string;
    values?: string[];
    inverted?: boolean;
}

interface ConstraintDisplayProps {
    constraint: ConstraintValue;
    compact?: boolean;
}

// Get operator display label
const getOperatorLabel = (op: string): string => {
    const opLabels: Record<string, string> = {
        'str_eq': 'equals',
        'str_neq': 'not equals',
        'str_contains': 'contains',
        'str_starts_with': 'starts with',
        'str_ends_with': 'ends with',
        'str_in': 'is one of',
        'str_not_in': 'is not one of',
        'num_eq': '=',
        'num_gt': '>',
        'num_gte': '≥',
        'num_lt': '<',
        'num_lte': '≤',
        'bool_is': 'is',
        'date_gt': 'after',
        'date_gte': 'on or after',
        'date_lt': 'before',
        'date_lte': 'on or before',
        'semver_eq': '=',
        'semver_gt': '>',
        'semver_gte': '≥',
        'semver_lt': '<',
        'semver_lte': '≤',
    };
    return opLabels[op] || op;
};

// Get constraint value display
const getValueDisplay = (c: ConstraintValue): string => {
    if (c.values && c.values.length > 0) {
        return c.values.join(', ');
    }
    if (c.value !== undefined && c.value !== null) {
        if (typeof c.value === 'boolean') {
            return c.value ? 'True' : 'False';
        }
        return String(c.value);
    }
    return '-';
};

/**
 * Single constraint display row
 */
export const ConstraintDisplay: React.FC<ConstraintDisplayProps> = ({ constraint, compact = false }) => {
    const valueDisplay = getValueDisplay(constraint);
    const isMultiValue = constraint.values && constraint.values.length > 1;

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
            }}
        >
            <Typography variant="body2" color="text.secondary" sx={{ minWidth: 80 }}>
                Constraint
            </Typography>
            <Typography variant="body2" fontWeight={600} color="primary.main">
                {constraint.contextName}
            </Typography>
            <Chip
                label={getOperatorLabel(constraint.operator)}
                size="small"
                variant="outlined"
                sx={{ height: 24, fontSize: '0.75rem' }}
            />
            {isMultiValue ? (
                <Tooltip title={<TextFieldsIcon sx={{ fontSize: 14 }} />}>
                    <Chip
                        label="Aa"
                        size="small"
                        variant="outlined"
                        sx={{ height: 24, fontSize: '0.7rem', minWidth: 28 }}
                    />
                </Tooltip>
            ) : null}
            <Typography
                variant="body2"
                sx={{
                    fontFamily: 'monospace',
                    bgcolor: 'action.hover',
                    px: 1,
                    py: 0.5,
                    borderRadius: 0.5,
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
        <Stack spacing={1}>
            {title && (
                <Typography variant="caption" color="text.secondary">
                    {title}
                </Typography>
            )}
            {constraints.map((c, i) => (
                <React.Fragment key={i}>
                    {i > 0 && (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.5 }}>
                            <Box sx={{ flex: 1, borderBottom: 1, borderColor: 'divider' }} />
                            <Chip
                                label="AND"
                                size="small"
                                sx={{
                                    height: 20,
                                    fontSize: '0.65rem',
                                    bgcolor: 'action.selected',
                                    fontWeight: 600,
                                }}
                            />
                            <Box sx={{ flex: 1, borderBottom: 1, borderColor: 'divider' }} />
                        </Box>
                    )}
                    <ConstraintDisplay constraint={c} />
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
        <Paper variant="outlined" sx={{ p: 2, mt: 1, bgcolor: 'grey.50' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <Typography variant="body2" color="text.secondary">
                    Segment
                </Typography>
                <Typography variant="body2" fontWeight={600} color="primary.main">
                    {displayName || segmentName}
                </Typography>
            </Box>
            <ConstraintList constraints={constraints} />
        </Paper>
    );
};

export default ConstraintDisplay;

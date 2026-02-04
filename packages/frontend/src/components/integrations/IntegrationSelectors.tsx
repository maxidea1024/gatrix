import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Box,
    Button,
    Chip,
    Typography,
    Accordion,
    AccordionSummary,
    AccordionDetails,
    Checkbox,
    FormControlLabel,
    FormGroup,
    Popover,
    alpha,
} from '@mui/material';
import {
    ExpandMore as ExpandMoreIcon,
    KeyboardArrowDown as ArrowDownIcon,
} from '@mui/icons-material';

interface EventCategory {
    key: string;
    events: string[];
}

interface EventSelectorProps {
    selectedEvents: string[];
    onChange: (events: string[]) => void;
    eventCategories: EventCategory[];
}

/**
 * Dropdown-style event selector with accordion categories inside
 */
export const EventSelector: React.FC<EventSelectorProps> = ({
    selectedEvents,
    onChange,
    eventCategories,
}) => {
    const { t } = useTranslation();
    const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null);
    const [expanded, setExpanded] = useState<string | false>(false);

    const open = Boolean(anchorEl);

    const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
        setAnchorEl(event.currentTarget);
    };

    const handleClose = () => {
        setAnchorEl(null);
    };

    const handleAccordionChange = (panel: string) => (_: React.SyntheticEvent, isExpanded: boolean) => {
        setExpanded(isExpanded ? panel : false);
    };

    const handleEventToggle = (event: string) => {
        if (selectedEvents.includes(event)) {
            onChange(selectedEvents.filter((e) => e !== event));
        } else {
            onChange([...selectedEvents, event]);
        }
    };

    const handleCategoryToggle = (category: EventCategory, checked: boolean) => {
        if (checked) {
            onChange([...new Set([...selectedEvents, ...category.events])]);
        } else {
            onChange(selectedEvents.filter((e) => !category.events.includes(e)));
        }
    };

    const handleSelectAll = () => {
        const allEvents = eventCategories.flatMap((c) => c.events);
        onChange(allEvents);
    };

    const handleDeselectAll = () => {
        onChange([]);
    };

    // Format event name for display
    const formatEventName = (event: string): string => {
        const localized = t(`integrations.events.${event}`);
        if (localized !== `integrations.events.${event}`) {
            return localized;
        }
        return event.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
    };

    const totalEvents = eventCategories.reduce((sum, c) => sum + c.events.length, 0);

    return (
        <Box>
            {/* Dropdown Trigger Button */}
            <Button
                variant="outlined"
                onClick={handleClick}
                endIcon={<ArrowDownIcon />}
                sx={{
                    justifyContent: 'space-between',
                    minWidth: 250,
                    textTransform: 'none',
                }}
            >
                {selectedEvents.length === 0
                    ? t('integrations.selectEvents')
                    : t('common.selectedCount', { count: selectedEvents.length })}
            </Button>

            {/* Dropdown Popover */}
            <Popover
                open={open}
                anchorEl={anchorEl}
                onClose={handleClose}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
                transformOrigin={{ vertical: 'top', horizontal: 'left' }}
                PaperProps={{
                    sx: {
                        width: 450,
                        maxHeight: 500,
                        overflow: 'hidden',
                        display: 'flex',
                        flexDirection: 'column',
                    },
                }}
            >
                {/* Header */}
                <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider', display: 'flex', gap: 1, alignItems: 'center' }}>
                    <Button size="small" variant="outlined" onClick={handleSelectAll}>
                        {t('common.selectAll')}
                    </Button>
                    <Button size="small" variant="outlined" onClick={handleDeselectAll}>
                        {t('common.deselectAll')}
                    </Button>
                    <Typography variant="body2" color="text.secondary" sx={{ ml: 'auto' }}>
                        {selectedEvents.length}/{totalEvents}
                    </Typography>
                </Box>

                {/* Scrollable Content */}
                <Box sx={{ overflow: 'auto', flex: 1 }}>
                    {eventCategories.map((category) => {
                        const selectedCount = category.events.filter((e) =>
                            selectedEvents.includes(e)
                        ).length;
                        const allSelected = selectedCount === category.events.length;
                        const indeterminate = selectedCount > 0 && !allSelected;

                        return (
                            <Accordion
                                key={category.key}
                                expanded={expanded === category.key}
                                onChange={handleAccordionChange(category.key)}
                                disableGutters
                                elevation={0}
                                sx={{
                                    '&:before': { display: 'none' },
                                    borderBottom: 1,
                                    borderColor: 'divider',
                                }}
                            >
                                <AccordionSummary
                                    expandIcon={<ExpandMoreIcon />}
                                    sx={{
                                        bgcolor: selectedCount > 0
                                            ? (theme) => alpha(theme.palette.primary.main, 0.05)
                                            : 'transparent',
                                        '&:hover': { bgcolor: (theme) => alpha(theme.palette.action.hover, 0.5) },
                                    }}
                                >
                                    <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', pr: 2 }}>
                                        <Checkbox
                                            checked={allSelected}
                                            indeterminate={indeterminate}
                                            onClick={(e) => e.stopPropagation()}
                                            onChange={(e) => handleCategoryToggle(category, e.target.checked)}
                                            size="small"
                                        />
                                        <Typography sx={{ flexGrow: 1 }}>
                                            {t(`integrations.eventCategories.${category.key}`)}
                                        </Typography>
                                        <Chip
                                            label={`${selectedCount}/${category.events.length}`}
                                            size="small"
                                            color={selectedCount > 0 ? 'primary' : 'default'}
                                            variant={selectedCount > 0 ? 'filled' : 'outlined'}
                                        />
                                    </Box>
                                </AccordionSummary>
                                <AccordionDetails sx={{ pt: 0, pb: 1, bgcolor: 'action.hover' }}>
                                    <FormGroup sx={{ pl: 4 }}>
                                        {category.events.map((event) => (
                                            <FormControlLabel
                                                key={event}
                                                control={
                                                    <Checkbox
                                                        checked={selectedEvents.includes(event)}
                                                        onChange={() => handleEventToggle(event)}
                                                        size="small"
                                                    />
                                                }
                                                label={formatEventName(event)}
                                                sx={{
                                                    '& .MuiFormControlLabel-label': { fontSize: '0.875rem' },
                                                }}
                                            />
                                        ))}
                                    </FormGroup>
                                </AccordionDetails>
                            </Accordion>
                        );
                    })}
                </Box>

                {/* Footer */}
                <Box sx={{ p: 1.5, borderTop: 1, borderColor: 'divider', textAlign: 'right' }}>
                    <Button variant="contained" size="small" onClick={handleClose}>
                        {t('common.confirm')}
                    </Button>
                </Box>
            </Popover>

            {/* Selected summary as chips */}
            {selectedEvents.length > 0 && (
                <Box sx={{ mt: 1, display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {eventCategories.map((category) => {
                        const selectedCount = category.events.filter((e) =>
                            selectedEvents.includes(e)
                        ).length;
                        if (selectedCount === 0) return null;
                        return (
                            <Chip
                                key={category.key}
                                label={`${t(`integrations.eventCategories.${category.key}`)} (${selectedCount})`}
                                size="small"
                                color="primary"
                                variant="outlined"
                                onDelete={() => {
                                    onChange(selectedEvents.filter((e) => !category.events.includes(e)));
                                }}
                            />
                        );
                    })}
                </Box>
            )}
        </Box>
    );
};

interface EnvironmentSelectorProps {
    selectedEnvironments: string[];
    onChange: (environments: string[]) => void;
    environments: { environment: string; displayName?: string }[];
}

/**
 * Tag-style environment selector with clickable chips
 */
export const EnvironmentSelector: React.FC<EnvironmentSelectorProps> = ({
    selectedEnvironments,
    onChange,
    environments,
}) => {
    const { t } = useTranslation();

    const handleToggle = (env: string) => {
        if (selectedEnvironments.includes(env)) {
            onChange(selectedEnvironments.filter((e) => e !== env));
        } else {
            onChange([...selectedEnvironments, env]);
        }
    };

    return (
        <Box>
            {/* Environment chips as tags */}
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {environments.map((env) => {
                    const isSelected = selectedEnvironments.includes(env.environment);
                    return (
                        <Chip
                            key={env.environment}
                            label={env.displayName || env.environment}
                            color={isSelected ? 'primary' : 'default'}
                            variant={isSelected ? 'filled' : 'outlined'}
                            onClick={() => handleToggle(env.environment)}
                            sx={{
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                '&:hover': {
                                    transform: 'scale(1.02)',
                                    boxShadow: 1,
                                },
                            }}
                        />
                    );
                })}
                {environments.length === 0 && (
                    <Typography variant="body2" color="text.secondary">
                        {t('integrations.noEnvironmentsAvailable')}
                    </Typography>
                )}
            </Box>

            {/* Help text */}
            {selectedEnvironments.length === 0 && environments.length > 0 && (
                <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                    {t('integrations.allEnvironmentsHint')}
                </Typography>
            )}
        </Box>
    );
};

export default { EventSelector, EnvironmentSelector };

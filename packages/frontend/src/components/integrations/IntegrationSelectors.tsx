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
    alpha,
} from '@mui/material';
import { ExpandMore as ExpandMoreIcon } from '@mui/icons-material';

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
 * AWS IAM-style event selector with expandable categories
 */
export const EventSelector: React.FC<EventSelectorProps> = ({
    selectedEvents,
    onChange,
    eventCategories,
}) => {
    const { t } = useTranslation();
    const [expanded, setExpanded] = useState<string | false>(false);

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
        // Try localization first
        const localized = t(`integrations.events.${event}`);
        if (localized !== `integrations.events.${event}`) {
            return localized;
        }
        // Fallback to formatted event name
        return event.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
    };

    return (
        <Box>
            {/* Quick actions */}
            <Box sx={{ mb: 2, display: 'flex', gap: 1 }}>
                <Button size="small" variant="outlined" onClick={handleSelectAll}>
                    {t('common.selectAll')}
                </Button>
                <Button size="small" variant="outlined" onClick={handleDeselectAll}>
                    {t('common.deselectAll')}
                </Button>
                <Typography variant="body2" color="text.secondary" sx={{ ml: 'auto', alignSelf: 'center' }}>
                    {t('common.selectedCount', { count: selectedEvents.length })}
                </Typography>
            </Box>

            {/* Event categories as accordions */}
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
                        sx={{
                            '&:before': { display: 'none' },
                            boxShadow: 'none',
                            border: 1,
                            borderColor: 'divider',
                            '&:not(:last-child)': { mb: 1 },
                            borderRadius: 1,
                            overflow: 'hidden',
                        }}
                    >
                        <AccordionSummary
                            expandIcon={<ExpandMoreIcon />}
                            sx={{
                                bgcolor: selectedCount > 0
                                    ? (theme) => alpha(theme.palette.primary.main, 0.05)
                                    : 'transparent',
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
                                <Typography sx={{ fontWeight: 'medium', flexGrow: 1 }}>
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
                        <AccordionDetails sx={{ pt: 0, pb: 2 }}>
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
                                            '& .MuiFormControlLabel-label': {
                                                fontSize: '0.875rem',
                                            },
                                        }}
                                    />
                                ))}
                            </FormGroup>
                        </AccordionDetails>
                    </Accordion>
                );
            })}
        </Box>
    );
};

interface EnvironmentSelectorProps {
    selectedEnvironments: string[];
    onChange: (environments: string[]) => void;
    environments: { environment: string; displayName?: string }[];
}

/**
 * Tag-style environment selector component with clickable chips
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

    const handleSelectAll = () => {
        onChange(environments.map((e) => e.environment));
    };

    const handleDeselectAll = () => {
        onChange([]);
    };

    return (
        <Box>
            {/* Quick actions */}
            <Box sx={{ mb: 2, display: 'flex', gap: 1 }}>
                <Button size="small" variant="outlined" onClick={handleSelectAll}>
                    {t('common.selectAll')}
                </Button>
                <Button size="small" variant="outlined" onClick={handleDeselectAll}>
                    {t('common.deselectAll')}
                </Button>
            </Box>

            {/* Environment chips */}
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
                                '&:hover': {
                                    bgcolor: isSelected
                                        ? undefined
                                        : (theme) => alpha(theme.palette.primary.main, 0.1),
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

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Box,
    Button,
    Checkbox,
    Chip,
    FormControlLabel,
    FormGroup,
    Menu,
    MenuItem,
    Typography,
    Divider,
    ListItemIcon,
    ListItemText,
} from '@mui/material';
import {
    ExpandMore as ExpandMoreIcon,
    Check as CheckIcon,
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
 * Compact event selector dropdown component
 */
export const EventSelector: React.FC<EventSelectorProps> = ({
    selectedEvents,
    onChange,
    eventCategories,
}) => {
    const { t } = useTranslation();
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const open = Boolean(anchorEl);

    const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
        setAnchorEl(event.currentTarget);
    };

    const handleClose = () => {
        setAnchorEl(null);
    };

    const handleEventToggle = (event: string) => {
        if (selectedEvents.includes(event)) {
            onChange(selectedEvents.filter((e) => e !== event));
        } else {
            onChange([...selectedEvents, event]);
        }
    };

    const handleCategoryToggle = (category: EventCategory) => {
        const allSelected = category.events.every((e) => selectedEvents.includes(e));
        if (allSelected) {
            onChange(selectedEvents.filter((e) => !category.events.includes(e)));
        } else {
            onChange([...new Set([...selectedEvents, ...category.events])]);
        }
    };

    const handleSelectAll = () => {
        const allEvents = eventCategories.flatMap((c) => c.events);
        onChange(allEvents);
    };

    const handleDeselectAll = () => {
        onChange([]);
    };

    const totalEvents = eventCategories.reduce((sum, c) => sum + c.events.length, 0);

    return (
        <Box>
            <Button
                variant="outlined"
                onClick={handleClick}
                endIcon={<ExpandMoreIcon />}
                sx={{ minWidth: 200 }}
            >
                {selectedEvents.length === 0
                    ? t('integrations.selectEvents')
                    : t('integrations.eventsSelected', { count: selectedEvents.length })}
            </Button>
            <Menu
                anchorEl={anchorEl}
                open={open}
                onClose={handleClose}
                PaperProps={{
                    sx: { maxHeight: 400, minWidth: 280 },
                }}
            >
                <Box sx={{ px: 2, py: 1, display: 'flex', gap: 1 }}>
                    <Button size="small" onClick={handleSelectAll}>
                        {t('integrations.selectAllEvents')}
                    </Button>
                    <Button size="small" onClick={handleDeselectAll}>
                        {t('integrations.deselectAllEvents')}
                    </Button>
                </Box>
                <Divider />
                {eventCategories.map((category) => {
                    const selectedCount = category.events.filter((e) =>
                        selectedEvents.includes(e)
                    ).length;
                    const allSelected = selectedCount === category.events.length;
                    const partialSelected = selectedCount > 0 && !allSelected;

                    return (
                        <Box key={category.key}>
                            <MenuItem
                                onClick={() => handleCategoryToggle(category)}
                                sx={{ py: 1 }}
                            >
                                <ListItemIcon>
                                    <Checkbox
                                        checked={allSelected}
                                        indeterminate={partialSelected}
                                        size="small"
                                    />
                                </ListItemIcon>
                                <ListItemText
                                    primary={t(`integrations.eventCategories.${category.key}`)}
                                />
                                <Chip
                                    label={`${selectedCount}/${category.events.length}`}
                                    size="small"
                                    sx={{ ml: 1 }}
                                />
                            </MenuItem>
                        </Box>
                    );
                })}
            </Menu>
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
 * Compact environment selector dropdown component
 */
export const EnvironmentSelector: React.FC<EnvironmentSelectorProps> = ({
    selectedEnvironments,
    onChange,
    environments,
}) => {
    const { t } = useTranslation();
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const open = Boolean(anchorEl);

    const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
        setAnchorEl(event.currentTarget);
    };

    const handleClose = () => {
        setAnchorEl(null);
    };

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
            <Button
                variant="outlined"
                onClick={handleClick}
                endIcon={<ExpandMoreIcon />}
                sx={{ minWidth: 200 }}
            >
                {selectedEnvironments.length === 0
                    ? t('integrations.allEnvironments')
                    : t('integrations.environmentsSelected', { count: selectedEnvironments.length })}
            </Button>
            <Menu
                anchorEl={anchorEl}
                open={open}
                onClose={handleClose}
                PaperProps={{
                    sx: { minWidth: 200 },
                }}
            >
                <Box sx={{ px: 2, py: 1, display: 'flex', gap: 1 }}>
                    <Button size="small" onClick={handleSelectAll}>
                        {t('common.selectAll')}
                    </Button>
                    <Button size="small" onClick={handleDeselectAll}>
                        {t('common.deselectAll')}
                    </Button>
                </Box>
                <Divider />
                {environments.map((env) => (
                    <MenuItem
                        key={env.environment}
                        onClick={() => handleToggle(env.environment)}
                    >
                        <ListItemIcon>
                            {selectedEnvironments.includes(env.environment) && (
                                <CheckIcon fontSize="small" />
                            )}
                        </ListItemIcon>
                        <ListItemText primary={env.displayName || env.environment} />
                    </MenuItem>
                ))}
                {environments.length === 0 && (
                    <MenuItem disabled>
                        <ListItemText primary={t('integrations.noEnvironmentsAvailable')} />
                    </MenuItem>
                )}
            </Menu>
            {selectedEnvironments.length > 0 && (
                <Box sx={{ mt: 1, display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {selectedEnvironments.map((env) => {
                        const envData = environments.find((e) => e.environment === env);
                        return (
                            <Chip
                                key={env}
                                label={envData?.displayName || env}
                                size="small"
                                onDelete={() => handleToggle(env)}
                            />
                        );
                    })}
                </Box>
            )}
        </Box>
    );
};

export default { EventSelector, EnvironmentSelector };

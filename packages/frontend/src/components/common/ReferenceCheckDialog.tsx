import React from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Typography,
    Button,
    Box,
    Alert,
    List,
    ListItem,
    ListItemButton,
    ListItemIcon,
    ListItemText,
    Chip,
} from '@mui/material';
import {
    Block as BlockIcon,
    Flag as FlagIcon,
    People as SegmentIcon,
    AccountTree as TemplateIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

export interface ResourceReference {
    flags: { flagName: string; environment: string }[];
    segments?: { segmentName: string; id: string }[];
    templates?: { flowName: string; id: string; milestoneName?: string }[];
}

interface ReferenceCheckDialogProps {
    open: boolean;
    onClose: () => void;
    title: string;
    references: ResourceReference | null;
}

/**
 * Dialog to display resource references that prevent deletion.
 * Shows clickable links to referencing flags, segments, and templates.
 */
const ReferenceCheckDialog: React.FC<ReferenceCheckDialogProps> = ({
    open,
    onClose,
    title,
    references,
}) => {
    const { t } = useTranslation();
    const navigate = useNavigate();

    const handleFlagClick = (flagName: string, environment?: string) => {
        onClose();
        const envParam = environment ? `?env=${encodeURIComponent(environment)}` : '';
        navigate(`/feature-flags/${encodeURIComponent(flagName)}${envParam}`);
    };

    const handleSegmentClick = () => {
        onClose();
        navigate('/feature-flags/segments');
    };

    const handleTemplateClick = () => {
        onClose();
        navigate('/feature-flags/templates');
    };

    if (!references) return null;

    const hasFlags = references.flags.length > 0;
    const hasSegments = (references.segments?.length ?? 0) > 0;
    const hasTemplates = (references.templates?.length ?? 0) > 0;

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="sm"
            fullWidth
            PaperProps={{
                sx: {
                    borderRadius: 2,
                    p: 1,
                },
            }}
        >
            <DialogTitle sx={{ pb: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <BlockIcon color="error" />
                    <Typography variant="h6" component="span" sx={{ fontWeight: 600 }}>
                        {title}
                    </Typography>
                </Box>
            </DialogTitle>

            <DialogContent sx={{ pb: 2 }}>
                <Alert severity="warning" sx={{ mb: 2 }}>
                    {t('common.resourceInUse')}
                </Alert>

                {/* Referencing Feature Flags */}
                {hasFlags && (
                    <Box sx={{ mb: 2 }}>
                        <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                            {t('common.referencingFlags')}
                        </Typography>
                        <List dense disablePadding>
                            {references.flags.map((flag, index) => (
                                <ListItem key={`flag-${index}`} disablePadding>
                                    <ListItemButton
                                        onClick={() => handleFlagClick(flag.flagName, flag.environment)}
                                        sx={{ borderRadius: 1, py: 0.5 }}
                                    >
                                        <ListItemIcon sx={{ minWidth: 32 }}>
                                            <FlagIcon fontSize="small" color="primary" />
                                        </ListItemIcon>
                                        <ListItemText
                                            primary={flag.flagName}
                                            primaryTypographyProps={{ variant: 'body2' }}
                                        />
                                        <Chip
                                            label={flag.environment}
                                            size="small"
                                            variant="outlined"
                                            sx={{ ml: 1, height: 20, fontSize: '0.7rem' }}
                                        />
                                    </ListItemButton>
                                </ListItem>
                            ))}
                        </List>
                    </Box>
                )}

                {/* Referencing Segments */}
                {hasSegments && (
                    <Box sx={{ mb: 2 }}>
                        <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                            {t('common.referencingSegments')}
                        </Typography>
                        <List dense disablePadding>
                            {references.segments!.map((segment, index) => (
                                <ListItem key={`segment-${index}`} disablePadding>
                                    <ListItemButton
                                        onClick={handleSegmentClick}
                                        sx={{ borderRadius: 1, py: 0.5 }}
                                    >
                                        <ListItemIcon sx={{ minWidth: 32 }}>
                                            <SegmentIcon fontSize="small" color="primary" />
                                        </ListItemIcon>
                                        <ListItemText
                                            primary={segment.segmentName}
                                            primaryTypographyProps={{ variant: 'body2' }}
                                        />
                                    </ListItemButton>
                                </ListItem>
                            ))}
                        </List>
                    </Box>
                )}

                {/* Referencing Release Templates */}
                {hasTemplates && (
                    <Box sx={{ mb: 2 }}>
                        <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                            {t('common.referencingTemplates')}
                        </Typography>
                        <List dense disablePadding>
                            {references.templates!.map((template, index) => (
                                <ListItem key={`template-${index}`} disablePadding>
                                    <ListItemButton
                                        onClick={handleTemplateClick}
                                        sx={{ borderRadius: 1, py: 0.5 }}
                                    >
                                        <ListItemIcon sx={{ minWidth: 32 }}>
                                            <TemplateIcon fontSize="small" color="primary" />
                                        </ListItemIcon>
                                        <ListItemText
                                            primary={template.flowName}
                                            secondary={
                                                template.milestoneName
                                                    ? `${t('releaseFlow.milestone')}: ${template.milestoneName}`
                                                    : undefined
                                            }
                                            primaryTypographyProps={{ variant: 'body2' }}
                                            secondaryTypographyProps={{ variant: 'caption' }}
                                        />
                                    </ListItemButton>
                                </ListItem>
                            ))}
                        </List>
                    </Box>
                )}
            </DialogContent>

            <DialogActions sx={{ px: 3, pb: 2 }}>
                <Button onClick={onClose} variant="outlined" sx={{ minWidth: 80 }}>
                    {t('common.close')}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default ReferenceCheckDialog;

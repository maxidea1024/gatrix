import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { PERMISSIONS } from '../../types/permissions';
import {
    Box,
    Typography,
    Button,
    Card,
    CardContent,
    TextField,
    Switch,
    FormControlLabel,
    Chip,
    IconButton,
    Tooltip,
    Divider,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Grid,
    Tabs,
    Tab,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
} from '@mui/material';
import {
    ArrowBack as ArrowBackIcon,
    Save as SaveIcon,
    Delete as DeleteIcon,
    Add as AddIcon,
    Edit as EditIcon,
    Flag as FlagIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import { parseApiErrorMessage } from '../../utils/errorUtils';
import featureFlagService, { FeatureFlag, FlagType } from '../../services/featureFlagService';
import ConfirmDeleteDialog from '../../components/common/ConfirmDeleteDialog';

interface TabPanelProps {
    children?: React.ReactNode;
    index: number;
    value: number;
}

function TabPanel(props: TabPanelProps) {
    const { children, value, index, ...other } = props;
    return (
        <div role="tabpanel" hidden={value !== index} {...other}>
            {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
        </div>
    );
}

const FeatureFlagDetailPage: React.FC = () => {
    const { t } = useTranslation();
    const { enqueueSnackbar } = useSnackbar();
    const { hasPermission } = useAuth();
    const navigate = useNavigate();
    const { flagName } = useParams<{ flagName: string }>();
    const canManage = hasPermission([PERMISSIONS.FEATURE_FLAGS_MANAGE]);
    const isNew = flagName === 'new';

    // State
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [tabValue, setTabValue] = useState(0);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [formData, setFormData] = useState<Partial<FeatureFlag>>({
        flagName: '',
        displayName: '',
        description: '',
        flagType: 'release',
        isEnabled: false,
        impressionDataEnabled: false,
        staleAfterDays: 90,
        tags: [],
    });
    const [tagInput, setTagInput] = useState('');

    // Load flag data
    const loadFlag = useCallback(async () => {
        if (isNew || !flagName) return;
        setLoading(true);
        try {
            const flag = await featureFlagService.getFeatureFlag(flagName);
            setFormData(flag);
        } catch (error: any) {
            enqueueSnackbar(parseApiErrorMessage(error, 'featureFlags.loadFailed'), { variant: 'error' });
            navigate('/game/feature-flags');
        } finally {
            setLoading(false);
        }
    }, [flagName, isNew, enqueueSnackbar, navigate]);

    useEffect(() => {
        loadFlag();
    }, [loadFlag]);

    // Handlers
    const handleChange = (field: keyof FeatureFlag, value: any) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleAddTag = () => {
        if (tagInput.trim() && !formData.tags?.includes(tagInput.trim())) {
            setFormData(prev => ({ ...prev, tags: [...(prev.tags || []), tagInput.trim()] }));
            setTagInput('');
        }
    };

    const handleRemoveTag = (tag: string) => {
        setFormData(prev => ({ ...prev, tags: prev.tags?.filter(t => t !== tag) }));
    };

    const handleSave = async () => {
        if (!formData.flagName?.trim()) {
            enqueueSnackbar(t('featureFlags.validation.nameRequired'), { variant: 'error' });
            return;
        }

        setSaving(true);
        try {
            if (isNew) {
                await featureFlagService.createFeatureFlag({
                    flagName: formData.flagName,
                    displayName: formData.displayName,
                    description: formData.description,
                    flagType: formData.flagType,
                    isEnabled: formData.isEnabled,
                    impressionDataEnabled: formData.impressionDataEnabled,
                    staleAfterDays: formData.staleAfterDays,
                    tags: formData.tags,
                });
                enqueueSnackbar(t('featureFlags.createSuccess'), { variant: 'success' });
            } else {
                await featureFlagService.updateFeatureFlag(flagName!, {
                    displayName: formData.displayName,
                    description: formData.description,
                    isEnabled: formData.isEnabled,
                    impressionDataEnabled: formData.impressionDataEnabled,
                    staleAfterDays: formData.staleAfterDays,
                    tags: formData.tags,
                });
                enqueueSnackbar(t('featureFlags.updateSuccess'), { variant: 'success' });
            }
            navigate('/game/feature-flags');
        } catch (error: any) {
            enqueueSnackbar(parseApiErrorMessage(error, 'featureFlags.saveFailed'), { variant: 'error' });
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!flagName) return;
        try {
            await featureFlagService.deleteFeatureFlag(flagName);
            enqueueSnackbar(t('featureFlags.deleteSuccess'), { variant: 'success' });
            navigate('/game/feature-flags');
        } catch (error: any) {
            enqueueSnackbar(parseApiErrorMessage(error, 'featureFlags.deleteFailed'), { variant: 'error' });
        }
        setDeleteDialogOpen(false);
    };

    if (loading) {
        return (
            <Box sx={{ p: 3, display: 'flex', justifyContent: 'center' }}>
                <Typography color="text.secondary">{t('common.loadingData')}</Typography>
            </Box>
        );
    }

    return (
        <Box sx={{ p: 3 }}>
            {/* Header */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <IconButton onClick={() => navigate('/game/feature-flags')}>
                        <ArrowBackIcon />
                    </IconButton>
                    <Box>
                        <Typography variant="h4" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <FlagIcon />
                            {isNew ? t('featureFlags.createFlag') : formData.displayName || formData.flagName}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            {isNew ? t('featureFlags.createFlagSubtitle') : formData.flagName}
                        </Typography>
                    </Box>
                </Box>
                <Box sx={{ display: 'flex', gap: 1 }}>
                    {canManage && !isNew && (
                        <Button
                            variant="outlined"
                            color="error"
                            startIcon={<DeleteIcon />}
                            onClick={() => setDeleteDialogOpen(true)}
                        >
                            {t('common.delete')}
                        </Button>
                    )}
                    {canManage && (
                        <Button
                            variant="contained"
                            startIcon={<SaveIcon />}
                            onClick={handleSave}
                            disabled={saving}
                        >
                            {saving ? t('common.saving') : t('common.save')}
                        </Button>
                    )}
                </Box>
            </Box>

            {/* Tabs */}
            <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)} sx={{ mb: 2 }}>
                <Tab label={t('featureFlags.basicInfo')} />
                <Tab label={t('featureFlags.strategies')} disabled={isNew} />
                <Tab label={t('featureFlags.variants')} disabled={isNew} />
            </Tabs>

            {/* Basic Info Tab */}
            <TabPanel value={tabValue} index={0}>
                <Grid container spacing={3}>
                    <Grid item xs={12} md={8}>
                        <Card>
                            <CardContent>
                                <Typography variant="h6" gutterBottom>{t('featureFlags.basicInfo')}</Typography>
                                <Grid container spacing={2}>
                                    <Grid item xs={12} md={6}>
                                        <TextField
                                            fullWidth
                                            label={t('featureFlags.flagName')}
                                            value={formData.flagName || ''}
                                            onChange={(e) => handleChange('flagName', e.target.value)}
                                            disabled={!isNew}
                                            helperText={!isNew ? t('featureFlags.nameCannotChange') : ''}
                                        />
                                    </Grid>
                                    <Grid item xs={12} md={6}>
                                        <TextField
                                            fullWidth
                                            label={t('featureFlags.displayName')}
                                            value={formData.displayName || ''}
                                            onChange={(e) => handleChange('displayName', e.target.value)}
                                            disabled={!canManage}
                                        />
                                    </Grid>
                                    <Grid item xs={12}>
                                        <TextField
                                            fullWidth
                                            multiline
                                            rows={3}
                                            label={t('featureFlags.description')}
                                            value={formData.description || ''}
                                            onChange={(e) => handleChange('description', e.target.value)}
                                            disabled={!canManage}
                                        />
                                    </Grid>
                                    <Grid item xs={12} md={6}>
                                        <FormControl fullWidth disabled={!isNew}>
                                            <InputLabel>{t('featureFlags.type')}</InputLabel>
                                            <Select
                                                value={formData.flagType || 'release'}
                                                label={t('featureFlags.type')}
                                                onChange={(e) => handleChange('flagType', e.target.value)}
                                            >
                                                <MenuItem value="release">{t('featureFlags.types.release')}</MenuItem>
                                                <MenuItem value="experiment">{t('featureFlags.types.experiment')}</MenuItem>
                                                <MenuItem value="operational">{t('featureFlags.types.operational')}</MenuItem>
                                                <MenuItem value="permission">{t('featureFlags.types.permission')}</MenuItem>
                                            </Select>
                                        </FormControl>
                                    </Grid>
                                    <Grid item xs={12} md={6}>
                                        <TextField
                                            fullWidth
                                            type="number"
                                            label={t('featureFlags.staleAfterDays')}
                                            value={formData.staleAfterDays || 90}
                                            onChange={(e) => handleChange('staleAfterDays', parseInt(e.target.value))}
                                            disabled={!canManage}
                                        />
                                    </Grid>
                                </Grid>
                            </CardContent>
                        </Card>
                    </Grid>

                    <Grid item xs={12} md={4}>
                        <Card>
                            <CardContent>
                                <Typography variant="h6" gutterBottom>{t('featureFlags.settings')}</Typography>
                                <FormControlLabel
                                    control={
                                        <Switch
                                            checked={formData.isEnabled || false}
                                            onChange={(e) => handleChange('isEnabled', e.target.checked)}
                                            disabled={!canManage}
                                        />
                                    }
                                    label={t('featureFlags.enabled')}
                                />
                                <FormControlLabel
                                    control={
                                        <Switch
                                            checked={formData.impressionDataEnabled || false}
                                            onChange={(e) => handleChange('impressionDataEnabled', e.target.checked)}
                                            disabled={!canManage}
                                        />
                                    }
                                    label={t('featureFlags.impressionDataEnabled')}
                                />
                            </CardContent>
                        </Card>

                        <Card sx={{ mt: 2 }}>
                            <CardContent>
                                <Typography variant="h6" gutterBottom>{t('featureFlags.tags')}</Typography>
                                <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
                                    {formData.tags?.map((tag, idx) => (
                                        <Chip
                                            key={idx}
                                            label={tag}
                                            onDelete={canManage ? () => handleRemoveTag(tag) : undefined}
                                            size="small"
                                        />
                                    ))}
                                </Box>
                                {canManage && (
                                    <Box sx={{ display: 'flex', gap: 1 }}>
                                        <TextField
                                            size="small"
                                            placeholder={t('featureFlags.addTag')}
                                            value={tagInput}
                                            onChange={(e) => setTagInput(e.target.value)}
                                            onKeyPress={(e) => e.key === 'Enter' && handleAddTag()}
                                        />
                                        <Button onClick={handleAddTag} size="small">
                                            <AddIcon />
                                        </Button>
                                    </Box>
                                )}
                            </CardContent>
                        </Card>
                    </Grid>
                </Grid>
            </TabPanel>

            {/* Strategies Tab */}
            <TabPanel value={tabValue} index={1}>
                <Card>
                    <CardContent>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                            <Typography variant="h6">{t('featureFlags.strategies')}</Typography>
                            {canManage && (
                                <Button variant="outlined" startIcon={<AddIcon />}>
                                    {t('featureFlags.addStrategy')}
                                </Button>
                            )}
                        </Box>
                        <Typography color="text.secondary">{t('featureFlags.strategiesDescription')}</Typography>
                        {/* Strategy list will be implemented later */}
                    </CardContent>
                </Card>
            </TabPanel>

            {/* Variants Tab */}
            <TabPanel value={tabValue} index={2}>
                <Card>
                    <CardContent>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                            <Typography variant="h6">{t('featureFlags.variants')}</Typography>
                            {canManage && (
                                <Button variant="outlined" startIcon={<AddIcon />}>
                                    {t('featureFlags.addVariant')}
                                </Button>
                            )}
                        </Box>
                        <Typography color="text.secondary">{t('featureFlags.variantsDescription')}</Typography>
                        {/* Variant list will be implemented later */}
                    </CardContent>
                </Card>
            </TabPanel>

            {/* Delete Dialog */}
            <ConfirmDeleteDialog
                open={deleteDialogOpen}
                onClose={() => setDeleteDialogOpen(false)}
                onConfirm={handleDelete}
                title={t('featureFlags.deleteConfirmTitle')}
                message={t('featureFlags.deleteConfirmMessage', { name: formData.flagName })}
            />
        </Box>
    );
};

export default FeatureFlagDetailPage;

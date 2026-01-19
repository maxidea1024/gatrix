import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { PERMISSIONS } from '../../types/permissions';
import {
    Box,
    Typography,
    Button,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    IconButton,
    Chip,
    TextField,
    InputAdornment,
    Tooltip,
    Card,
    CardContent,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Grid,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
} from '@mui/material';
import {
    Add as AddIcon,
    Search as SearchIcon,
    SettingsSuggest as ContextIcon,
    Refresh as RefreshIcon,
    Edit as EditIcon,
    Delete as DeleteIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import { parseApiErrorMessage } from '../../utils/errorUtils';
import SimplePagination from '../../components/common/SimplePagination';
import EmptyState from '../../components/common/EmptyState';
import { useDebounce } from '../../hooks/useDebounce';
import { formatDateTimeDetailed } from '../../utils/dateFormat';
import ConfirmDeleteDialog from '../../components/common/ConfirmDeleteDialog';
import api from '../../services/api';

interface FeatureContextField {
    id: string;
    environmentId: string;
    fieldName: string;
    displayName: string;
    description: string;
    fieldType: 'string' | 'number' | 'boolean' | 'datetime' | 'semver';
    legalValues: string[];
    sortOrder: number;
    createdAt: string;
    updatedAt: string;
}

const FeatureContextFieldsPage: React.FC = () => {
    const { t } = useTranslation();
    const { enqueueSnackbar } = useSnackbar();
    const { hasPermission } = useAuth();
    const canManage = hasPermission([PERMISSIONS.FEATURE_FLAGS_MANAGE]);

    // State
    const [fields, setFields] = useState<FeatureContextField[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [deletingField, setDeletingField] = useState<FeatureContextField | null>(null);
    const [editDialogOpen, setEditDialogOpen] = useState(false);
    const [editingField, setEditingField] = useState<Partial<FeatureContextField> | null>(null);

    const debouncedSearchTerm = useDebounce(searchTerm, 500);

    // Load fields
    const loadFields = async () => {
        setLoading(true);
        try {
            const result = await api.get('/api/v1/admin/features/context-fields', {
                params: {
                    page: page + 1,
                    limit: rowsPerPage,
                    search: debouncedSearchTerm || undefined,
                }
            });
            setFields(result.data?.contextFields || []);
            setTotal(result.data?.total || 0);
        } catch (error: any) {
            enqueueSnackbar(parseApiErrorMessage(error, 'featureFlags.loadFailed'), { variant: 'error' });
            setFields([]);
            setTotal(0);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadFields();
    }, [page, rowsPerPage, debouncedSearchTerm]);

    // Handlers
    const handleEdit = (field: FeatureContextField) => {
        setEditingField(field);
        setEditDialogOpen(true);
    };

    const handleCreate = () => {
        setEditingField({ fieldName: '', displayName: '', description: '', fieldType: 'string', legalValues: [], sortOrder: 0 });
        setEditDialogOpen(true);
    };

    const handleSave = async () => {
        if (!editingField) return;
        try {
            if (editingField.id) {
                await api.put(`/api/v1/admin/features/context-fields/${editingField.id}`, editingField);
                enqueueSnackbar(t('featureFlags.updateSuccess'), { variant: 'success' });
            } else {
                await api.post('/api/v1/admin/features/context-fields', editingField);
                enqueueSnackbar(t('featureFlags.createSuccess'), { variant: 'success' });
            }
            setEditDialogOpen(false);
            setEditingField(null);
            loadFields();
        } catch (error: any) {
            enqueueSnackbar(parseApiErrorMessage(error, 'featureFlags.saveFailed'), { variant: 'error' });
        }
    };

    const handleDelete = (field: FeatureContextField) => {
        setDeletingField(field);
        setDeleteConfirmOpen(true);
    };

    const handleDeleteConfirm = async () => {
        if (!deletingField) return;
        try {
            await api.delete(`/api/v1/admin/features/context-fields/${deletingField.id}`);
            enqueueSnackbar(t('featureFlags.deleteSuccess'), { variant: 'success' });
            loadFields();
        } catch (error: any) {
            enqueueSnackbar(parseApiErrorMessage(error, 'featureFlags.deleteFailed'), { variant: 'error' });
        } finally {
            setDeleteConfirmOpen(false);
            setDeletingField(null);
        }
    };

    const getFieldTypeLabel = (type: string) => {
        switch (type) {
            case 'string': return t('featureFlags.fieldTypes.string');
            case 'number': return t('featureFlags.fieldTypes.number');
            case 'boolean': return t('featureFlags.fieldTypes.boolean');
            case 'datetime': return t('featureFlags.fieldTypes.datetime');
            case 'semver': return t('featureFlags.fieldTypes.semver');
            default: return type;
        }
    };

    return (
        <Box sx={{ p: 3 }}>
            {/* Header */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
                <Box>
                    <Typography variant="h4" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <ContextIcon />
                        {t('featureFlags.contextFields')}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        {t('featureFlags.contextFieldsDescription')}
                    </Typography>
                </Box>
                <Box sx={{ display: 'flex', gap: 1 }}>
                    {canManage && (
                        <Button variant="contained" startIcon={<AddIcon />} onClick={handleCreate}>
                            {t('featureFlags.addContextField')}
                        </Button>
                    )}
                </Box>
            </Box>

            {/* Search */}
            <Card sx={{ mb: 3 }}>
                <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, justifyContent: 'space-between' }}>
                        <TextField
                            placeholder={t('common.search')}
                            value={searchTerm}
                            onChange={(e) => { setSearchTerm(e.target.value); setPage(0); }}
                            sx={{ minWidth: 300 }}
                            InputProps={{ startAdornment: (<InputAdornment position="start"><SearchIcon /></InputAdornment>) }}
                            size="small"
                        />
                        <Tooltip title={t('common.refresh')}>
                            <span><IconButton size="small" onClick={loadFields} disabled={loading}><RefreshIcon /></IconButton></span>
                        </Tooltip>
                    </Box>
                </CardContent>
            </Card>

            {/* Table */}
            <Card>
                <CardContent sx={{ p: 0, '&:last-child': { pb: 0 } }}>
                    {loading ? (
                        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
                            <Typography color="text.secondary">{t('common.loadingData')}</Typography>
                        </Box>
                    ) : fields.length === 0 ? (
                        <EmptyState
                            message={t('featureFlags.noContextFieldsFound')}
                            onAddClick={canManage ? handleCreate : undefined}
                            addButtonLabel={t('featureFlags.addContextField')}
                        />
                    ) : (
                        <>
                            <TableContainer>
                                <Table>
                                    <TableHead>
                                        <TableRow>
                                            <TableCell>{t('featureFlags.fieldName')}</TableCell>
                                            <TableCell>{t('featureFlags.displayName')}</TableCell>
                                            <TableCell>{t('featureFlags.fieldType')}</TableCell>
                                            <TableCell>{t('featureFlags.createdAt')}</TableCell>
                                            {canManage && <TableCell align="center">{t('common.actions')}</TableCell>}
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {fields.map((field) => (
                                            <TableRow key={field.id} hover>
                                                <TableCell><Typography fontWeight={500}>{field.fieldName}</Typography></TableCell>
                                                <TableCell>{field.displayName || '-'}</TableCell>
                                                <TableCell><Chip label={getFieldTypeLabel(field.fieldType)} size="small" /></TableCell>
                                                <TableCell>{formatDateTimeDetailed(field.createdAt)}</TableCell>
                                                {canManage && (
                                                    <TableCell align="center">
                                                        <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center' }}>
                                                            <Tooltip title={t('common.edit')}><IconButton size="small" onClick={() => handleEdit(field)}><EditIcon fontSize="small" /></IconButton></Tooltip>
                                                            <Tooltip title={t('common.delete')}><IconButton size="small" onClick={() => handleDelete(field)}><DeleteIcon fontSize="small" /></IconButton></Tooltip>
                                                        </Box>
                                                    </TableCell>
                                                )}
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                            <SimplePagination
                                page={page}
                                rowsPerPage={rowsPerPage}
                                count={total}
                                onPageChange={(_, newPage) => setPage(newPage)}
                                onRowsPerPageChange={(e) => { setRowsPerPage(Number(e.target.value)); setPage(0); }}
                            />
                        </>
                    )}
                </CardContent>
            </Card>

            {/* Edit Dialog */}
            <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle>{editingField?.id ? t('featureFlags.editContextField') : t('featureFlags.addContextField')}</DialogTitle>
                <DialogContent>
                    <Grid container spacing={2} sx={{ mt: 1 }}>
                        <Grid item xs={12}>
                            <TextField
                                fullWidth
                                label={t('featureFlags.fieldName')}
                                value={editingField?.fieldName || ''}
                                onChange={(e) => setEditingField(prev => ({ ...prev, fieldName: e.target.value }))}
                                disabled={!!editingField?.id}
                            />
                        </Grid>
                        <Grid item xs={12}>
                            <TextField
                                fullWidth
                                label={t('featureFlags.displayName')}
                                value={editingField?.displayName || ''}
                                onChange={(e) => setEditingField(prev => ({ ...prev, displayName: e.target.value }))}
                            />
                        </Grid>
                        <Grid item xs={12}>
                            <FormControl fullWidth>
                                <InputLabel>{t('featureFlags.fieldType')}</InputLabel>
                                <Select
                                    value={editingField?.fieldType || 'string'}
                                    label={t('featureFlags.fieldType')}
                                    onChange={(e) => setEditingField(prev => ({ ...prev, fieldType: e.target.value as any }))}
                                    disabled={!!editingField?.id}
                                >
                                    <MenuItem value="string">{t('featureFlags.fieldTypes.string')}</MenuItem>
                                    <MenuItem value="number">{t('featureFlags.fieldTypes.number')}</MenuItem>
                                    <MenuItem value="boolean">{t('featureFlags.fieldTypes.boolean')}</MenuItem>
                                    <MenuItem value="datetime">{t('featureFlags.fieldTypes.datetime')}</MenuItem>
                                    <MenuItem value="semver">{t('featureFlags.fieldTypes.semver')}</MenuItem>
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid item xs={12}>
                            <TextField
                                fullWidth
                                multiline
                                rows={3}
                                label={t('featureFlags.description')}
                                value={editingField?.description || ''}
                                onChange={(e) => setEditingField(prev => ({ ...prev, description: e.target.value }))}
                            />
                        </Grid>
                    </Grid>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setEditDialogOpen(false)}>{t('common.cancel')}</Button>
                    <Button variant="contained" onClick={handleSave}>{t('common.save')}</Button>
                </DialogActions>
            </Dialog>

            {/* Delete Dialog */}
            <ConfirmDeleteDialog
                open={deleteConfirmOpen}
                onClose={() => setDeleteConfirmOpen(false)}
                onConfirm={handleDeleteConfirm}
                title={t('featureFlags.deleteConfirmTitle')}
                message={t('featureFlags.deleteConfirmMessage', { name: deletingField?.fieldName || '' })}
            />
        </Box>
    );
};

export default FeatureContextFieldsPage;

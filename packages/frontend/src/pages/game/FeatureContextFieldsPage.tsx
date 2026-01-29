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
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Autocomplete,
    Stack,
    FormHelperText,
    FormControlLabel,
    Checkbox,
} from '@mui/material';
import ResizableDrawer from '../../components/common/ResizableDrawer';
import {
    Add as AddIcon,
    Search as SearchIcon,
    SettingsSuggest as ContextIcon,
    Refresh as RefreshIcon,
    Edit as EditIcon,
    Delete as DeleteIcon,
    ContentCopy as CopyIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import { parseApiErrorMessage } from '../../utils/errorUtils';
import SimplePagination from '../../components/common/SimplePagination';
import EmptyState from '../../components/common/EmptyState';
import { useDebounce } from '../../hooks/useDebounce';
import { formatDateTimeDetailed, formatRelativeTime } from '../../utils/dateFormat';
import { copyToClipboardWithNotification } from '../../utils/clipboard';
import ConfirmDeleteDialog from '../../components/common/ConfirmDeleteDialog';
import api from '../../services/api';
import { tagService } from '../../services/tagService';
import { getContrastColor } from '../../utils/colorUtils';
import FeatureSwitch from '../../components/common/FeatureSwitch';

interface FeatureContextField {
    id: string;
    environmentId: string;
    fieldName: string;
    displayName: string;
    description: string;
    fieldType: 'string' | 'number' | 'boolean' | 'datetime' | 'semver';
    legalValues: string[];
    isEnabled: boolean;
    tags: string[];
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
    const [originalField, setOriginalField] = useState<Partial<FeatureContextField> | null>(null);
    const [expandedLegalValues, setExpandedLegalValues] = useState<Set<string>>(new Set());
    const [allTags, setAllTags] = useState<{ id: number; name: string; color: string; description?: string }[]>([]);

    const debouncedSearchTerm = useDebounce(searchTerm, 500);

    // Load fields
    const loadFields = async () => {
        setLoading(true);
        try {
            const result = await api.get('/admin/features/context-fields', {
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

    // Load tags for selection
    useEffect(() => {
        const loadTags = async () => {
            try {
                const tags = await tagService.list();
                setAllTags(tags);
            } catch (error) {
                console.error('Failed to load tags:', error);
            }
        };
        loadTags();
    }, []);

    // Handlers
    const handleEdit = (field: FeatureContextField) => {
        setEditingField(field);
        setOriginalField(JSON.parse(JSON.stringify(field)));
        setEditDialogOpen(true);
    };

    const handleCreate = () => {
        const newField = { fieldName: '', displayName: '', description: '', fieldType: 'string' as const, legalValues: [], tags: [], sortOrder: 0 };
        setEditingField(newField);
        setOriginalField(null);
        setEditDialogOpen(true);
    };

    // Check if field has been modified
    const hasChanges = (): boolean => {
        if (!editingField) return false;
        if (!originalField) return true; // New field always has "changes"

        // Compare each field explicitly to avoid JSON.stringify key order issues
        const fieldNameChanged = (editingField.fieldName || '') !== (originalField.fieldName || '');
        const displayNameChanged = (editingField.displayName || '') !== (originalField.displayName || '');
        const descriptionChanged = (editingField.description || '') !== (originalField.description || '');
        const fieldTypeChanged = (editingField.fieldType || 'string') !== (originalField.fieldType || 'string');
        const sortOrderChanged = (editingField.sortOrder || 0) !== (originalField.sortOrder || 0);

        // Compare legalValues arrays
        const editingLegalValues = editingField.legalValues || [];
        const originalLegalValues = originalField.legalValues || [];
        const legalValuesChanged = editingLegalValues.length !== originalLegalValues.length ||
            editingLegalValues.some((v, i) => v !== originalLegalValues[i]);

        // Compare tags arrays
        const editingTags = editingField.tags || [];
        const originalTags = originalField.tags || [];
        const tagsChanged = editingTags.length !== originalTags.length ||
            editingTags.some((v, i) => v !== originalTags[i]);

        return fieldNameChanged || displayNameChanged || descriptionChanged ||
            fieldTypeChanged || sortOrderChanged || legalValuesChanged || tagsChanged;
    };

    const handleSave = async () => {
        if (!editingField) return;
        try {
            if (editingField.id) {
                await api.put(`/admin/features/context-fields/${editingField.fieldName}`, editingField);
                enqueueSnackbar(t('featureFlags.updateSuccess'), { variant: 'success' });
            } else {
                await api.post('/admin/features/context-fields', editingField);
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
            await api.delete(`/admin/features/context-fields/${deletingField.fieldName}`);
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
                                            <TableCell>{t('featureFlags.visibility')}</TableCell>
                                            <TableCell>{t('featureFlags.fieldName')}</TableCell>
                                            <TableCell>{t('featureFlags.displayName')}</TableCell>
                                            <TableCell>{t('featureFlags.description')}</TableCell>
                                            <TableCell>{t('featureFlags.fieldType')}</TableCell>
                                            <TableCell>{t('featureFlags.legalValuesColumn')}</TableCell>
                                            <TableCell>{t('featureFlags.tags')}</TableCell>
                                            <TableCell>{t('featureFlags.createdAt')}</TableCell>
                                            {canManage && <TableCell align="center">{t('common.actions')}</TableCell>}
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {fields.map((field) => (
                                            <TableRow key={field.id} hover>
                                                <TableCell>
                                                    <FeatureSwitch
                                                        size="small"
                                                        checked={field.isEnabled !== false}
                                                        onChange={async () => {
                                                            const newEnabled = !field.isEnabled;
                                                            // Optimistic update
                                                            setFields(prev => prev.map(f =>
                                                                f.id === field.id ? { ...f, isEnabled: newEnabled } : f
                                                            ));
                                                            try {
                                                                await api.put(`/admin/features/context-fields/${field.fieldName}`, { isEnabled: newEnabled });
                                                            } catch (error: any) {
                                                                // Rollback on error
                                                                setFields(prev => prev.map(f =>
                                                                    f.id === field.id ? { ...f, isEnabled: !newEnabled } : f
                                                                ));
                                                                enqueueSnackbar(parseApiErrorMessage(error, t('common.saveFailed')), { variant: 'error' });
                                                            }
                                                        }}
                                                        disabled={!canManage}
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                        <Typography
                                                            fontWeight={500}
                                                            sx={{ cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}
                                                            onClick={() => handleEdit(field)}
                                                        >
                                                            {field.fieldName}
                                                        </Typography>
                                                        <Tooltip title={t('common.copy')}>
                                                            <IconButton
                                                                size="small"
                                                                onClick={(e) => { e.stopPropagation(); copyToClipboardWithNotification(field.fieldName, enqueueSnackbar, t); }}
                                                                sx={{ opacity: 0.5, '&:hover': { opacity: 1 } }}
                                                            >
                                                                <CopyIcon sx={{ fontSize: 14 }} />
                                                            </IconButton>
                                                        </Tooltip>
                                                    </Box>
                                                </TableCell>
                                                <TableCell>
                                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                        <Typography
                                                            sx={{ cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}
                                                            onClick={() => handleEdit(field)}
                                                        >
                                                            {field.displayName || field.fieldName}
                                                        </Typography>
                                                        <Tooltip title={t('common.copy')}>
                                                            <IconButton
                                                                size="small"
                                                                onClick={(e) => { e.stopPropagation(); copyToClipboardWithNotification(field.displayName || field.fieldName, enqueueSnackbar, t); }}
                                                                sx={{ opacity: 0.5, '&:hover': { opacity: 1 } }}
                                                            >
                                                                <CopyIcon sx={{ fontSize: 14 }} />
                                                            </IconButton>
                                                        </Tooltip>
                                                    </Box>
                                                </TableCell>
                                                <TableCell>
                                                    <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                        {field.description || '-'}
                                                    </Typography>
                                                </TableCell>
                                                <TableCell><Chip label={getFieldTypeLabel(field.fieldType)} size="small" /></TableCell>
                                                <TableCell>
                                                    {field.legalValues && field.legalValues.length > 0 ? (
                                                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, alignItems: 'center' }}>
                                                            {(expandedLegalValues.has(field.id) ? field.legalValues : field.legalValues.slice(0, 3)).map((value, idx) => (
                                                                <Chip key={idx} label={value} size="small" variant="outlined" sx={{ fontSize: '0.75rem' }} />
                                                            ))}
                                                            {field.legalValues.length > 3 && (
                                                                <Typography
                                                                    variant="caption"
                                                                    sx={{ cursor: 'pointer', color: 'primary.main', '&:hover': { textDecoration: 'underline' } }}
                                                                    onClick={() => {
                                                                        setExpandedLegalValues(prev => {
                                                                            const newSet = new Set(prev);
                                                                            if (newSet.has(field.id)) {
                                                                                newSet.delete(field.id);
                                                                            } else {
                                                                                newSet.add(field.id);
                                                                            }
                                                                            return newSet;
                                                                        });
                                                                    }}
                                                                >
                                                                    {expandedLegalValues.has(field.id)
                                                                        ? t('featureFlags.showLess')
                                                                        : t('featureFlags.showMore', { count: field.legalValues.length - 3 })
                                                                    }
                                                                </Typography>
                                                            )}
                                                        </Box>
                                                    ) : (
                                                        <Typography variant="body2" color="text.disabled">-</Typography>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    {field.tags && field.tags.length > 0 ? (
                                                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                                            {field.tags.map((tagName, idx) => {
                                                                const tagData = allTags.find(t => t.name === tagName);
                                                                const color = tagData?.color || '#888888';
                                                                return (
                                                                    <Tooltip key={idx} title={tagData?.description || ''} arrow>
                                                                        <Chip
                                                                            label={tagName}
                                                                            size="small"
                                                                            sx={{ bgcolor: color, color: getContrastColor(color), fontSize: '0.75rem' }}
                                                                        />
                                                                    </Tooltip>
                                                                );
                                                            })}
                                                        </Box>
                                                    ) : (
                                                        <Typography variant="body2" color="text.disabled">-</Typography>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    <Tooltip title={formatDateTimeDetailed(field.createdAt)}>
                                                        <span>{formatRelativeTime(field.createdAt)}</span>
                                                    </Tooltip>
                                                </TableCell>
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

            {/* Edit Drawer */}
            <ResizableDrawer
                open={editDialogOpen}
                onClose={() => setEditDialogOpen(false)}
                title={editingField?.id ? t('featureFlags.editContextField') : t('featureFlags.addContextField')}
                subtitle={t('featureFlags.contextFieldsDescription')}
                storageKey="featureContextFieldDrawerWidth"
                defaultWidth={500}
            >
                <Box sx={{ p: 3, flex: 1, overflow: 'auto' }}>
                    <Stack spacing={3}>
                        <Box>
                            <FormControlLabel
                                control={
                                    <Checkbox
                                        checked={editingField?.isEnabled !== false}
                                        onChange={(e) => setEditingField(prev => ({ ...prev, isEnabled: e.target.checked }))}
                                    />
                                }
                                label={t('featureFlags.visibility')}
                            />
                            <FormHelperText sx={{ ml: 4, mt: -0.5 }}>{t('featureFlags.visibilityHelp')}</FormHelperText>
                        </Box>

                        <TextField
                            fullWidth
                            required
                            label={t('featureFlags.fieldName')}
                            value={editingField?.fieldName || ''}
                            onChange={(e) => setEditingField(prev => ({ ...prev, fieldName: e.target.value.replace(/[^a-zA-Z0-9_]/g, '') }))}
                            disabled={!!editingField?.id}
                            helperText={t('featureFlags.fieldNameHelp')}
                            placeholder="userId, deviceType, country..."
                        />

                        <TextField
                            fullWidth
                            label={t('featureFlags.displayName')}
                            value={editingField?.displayName || ''}
                            onChange={(e) => setEditingField(prev => ({ ...prev, displayName: e.target.value }))}
                            helperText={t('featureFlags.displayNameHelp')}
                        />

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
                            <FormHelperText>{t('featureFlags.fieldTypeHelp')}</FormHelperText>
                        </FormControl>

                        <TextField
                            fullWidth
                            multiline
                            rows={3}
                            label={t('featureFlags.description')}
                            value={editingField?.description || ''}
                            onChange={(e) => setEditingField(prev => ({ ...prev, description: e.target.value }))}
                            helperText={t('featureFlags.descriptionHelp')}
                        />

                        {/* Legal Values - only show for string and number types */}
                        {(editingField?.fieldType === 'string' || editingField?.fieldType === 'number') && (
                            <Autocomplete
                                multiple
                                freeSolo
                                options={[]}
                                value={editingField?.legalValues || []}
                                onChange={(_, newValue) => setEditingField(prev => ({ ...prev, legalValues: newValue as string[] }))}
                                renderTags={(value, getTagProps) =>
                                    value.map((option, idx) => (
                                        <Chip size="small" label={option} {...getTagProps({ index: idx })} key={idx} />
                                    ))
                                }
                                renderInput={(params) => (
                                    <TextField
                                        {...params}
                                        label={t('featureFlags.legalValues')}
                                        placeholder={t('featureFlags.legalValuesPlaceholder')}
                                        helperText={t('featureFlags.legalValuesHelp')}
                                    />
                                )}
                            />
                        )}

                        {/* Tags */}
                        <Autocomplete
                            multiple
                            options={allTags}
                            getOptionLabel={(option) => typeof option === 'string' ? option : option.name}
                            filterSelectedOptions
                            isOptionEqualToValue={(option, value) => {
                                const optName = typeof option === 'string' ? option : option.name;
                                const valName = typeof value === 'string' ? value : value.name;
                                return optName === valName;
                            }}
                            value={(editingField?.tags || []).map(tagName => {
                                const found = allTags.find(t => t.name === tagName);
                                return found || { id: 0, name: tagName, color: '#888888' };
                            })}
                            onChange={(_, newValue) => {
                                const tagNames = newValue.map(v => typeof v === 'string' ? v : v.name);
                                setEditingField(prev => ({ ...prev, tags: tagNames }));
                            }}
                            renderTags={(value, getTagProps) =>
                                value.map((option, idx) => {
                                    const { key, ...chipProps } = getTagProps({ index: idx });
                                    const tagData = typeof option === 'string' ? { name: option, color: '#888888' } : option;
                                    return (
                                        <Tooltip key={key} title={tagData.description || ''} arrow>
                                            <Chip
                                                size="small"
                                                label={tagData.name}
                                                sx={{ bgcolor: tagData.color, color: getContrastColor(tagData.color) }}
                                                {...chipProps}
                                            />
                                        </Tooltip>
                                    );
                                })
                            }
                            renderInput={(params) => (
                                <TextField
                                    {...params}
                                    label={t('featureFlags.tags')}
                                    placeholder={t('featureFlags.tagsPlaceholder')}
                                    helperText={t('featureFlags.tagsHelp')}
                                />
                            )}
                            renderOption={(props, option) => {
                                const tagData = typeof option === 'string' ? { name: option, color: '#888888', description: '' } : option;
                                return (
                                    <Box component="li" {...props}>
                                        <Chip
                                            label={tagData.name}
                                            size="small"
                                            sx={{ bgcolor: tagData.color, color: getContrastColor(tagData.color), mr: 1 }}
                                        />
                                        {tagData.description || t('tags.noDescription')}
                                    </Box>
                                );
                            }}
                        />
                    </Stack>
                </Box>

                {/* Footer Actions */}
                <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider', display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                    <Button onClick={() => setEditDialogOpen(false)}>{t('common.cancel')}</Button>
                    <Button
                        variant="contained"
                        onClick={handleSave}
                        disabled={!hasChanges() || !editingField?.fieldName}
                    >
                        {editingField?.id ? t('common.update') : t('common.create')}
                    </Button>
                </Box>
            </ResizableDrawer>

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

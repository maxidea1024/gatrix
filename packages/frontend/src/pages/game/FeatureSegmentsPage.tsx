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
    Divider,
    Stack,
    FormHelperText,
    Autocomplete,
    Switch,
    FormControlLabel,
    Checkbox,
} from '@mui/material';
import {
    Add as AddIcon,
    Search as SearchIcon,
    Category as SegmentIcon,
    Refresh as RefreshIcon,
    Edit as EditIcon,
    Delete as DeleteIcon,
    ContentCopy as CopyIcon,
    ExpandMore as ExpandMoreIcon,
    ExpandLess as ExpandLessIcon,
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
import ResizableDrawer from '../../components/common/ResizableDrawer';
import api from '../../services/api';
import ConstraintEditor, { Constraint, ContextField } from '../../components/features/ConstraintEditor';
import { tagService } from '../../services/tagService';
import { getContrastColor } from '../../utils/colorUtils';

interface FeatureSegment {
    id: string;
    environmentId: string;
    segmentName: string;
    displayName: string;
    description: string;
    constraints: Constraint[];
    isActive?: boolean;
    tags?: string[];
    createdAt: string;
    updatedAt: string;
}

const FeatureSegmentsPage: React.FC = () => {
    const { t } = useTranslation();
    const { enqueueSnackbar } = useSnackbar();
    const { hasPermission } = useAuth();
    const canManage = hasPermission([PERMISSIONS.FEATURE_FLAGS_MANAGE]);

    // State
    const [segments, setSegments] = useState<FeatureSegment[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [deletingSegment, setDeletingSegment] = useState<FeatureSegment | null>(null);
    const [editDialogOpen, setEditDialogOpen] = useState(false);
    const [editingSegment, setEditingSegment] = useState<Partial<FeatureSegment> | null>(null);
    const [originalSegment, setOriginalSegment] = useState<Partial<FeatureSegment> | null>(null);
    const [contextFields, setContextFields] = useState<ContextField[]>([]);
    const [expandedConstraints, setExpandedConstraints] = useState<Set<string>>(new Set());
    const [allTags, setAllTags] = useState<{ id: number; name: string; color: string; description?: string }[]>([]);

    const debouncedSearchTerm = useDebounce(searchTerm, 500);

    // Load context fields for constraint editor
    const loadContextFields = async () => {
        try {
            const result = await api.get('/admin/features/context-fields');
            const fields = result.data?.contextFields || [];
            setContextFields(fields
                .filter((f: any) => f.isEnabled !== false)
                .map((f: any) => ({
                    fieldName: f.fieldName,
                    displayName: f.displayName || f.fieldName,
                    description: f.description || '',
                    fieldType: f.fieldType || 'string',
                    legalValues: f.legalValues || [],
                })));
        } catch (error) {
            console.error('Failed to load context fields:', error);
            // Provide default context fields if API fails
            setContextFields([
                { fieldName: 'userId', displayName: 'User ID', fieldType: 'string' },
                { fieldName: 'sessionId', displayName: 'Session ID', fieldType: 'string' },
                { fieldName: 'appName', displayName: 'App Name', fieldType: 'string' },
                { fieldName: 'environment', displayName: 'Environment', fieldType: 'string' },
                { fieldName: 'currentTime', displayName: 'Current Time', fieldType: 'datetime' },
            ]);
        }
    };

    // Load segments
    const loadSegments = async () => {
        setLoading(true);
        try {
            const result = await api.get('/admin/features/segments', {
                params: {
                    page: page + 1,
                    limit: rowsPerPage,
                    search: debouncedSearchTerm || undefined,
                }
            });
            setSegments(result.data?.segments || []);
            setTotal(result.data?.total || 0);
        } catch (error: any) {
            enqueueSnackbar(parseApiErrorMessage(error, 'featureFlags.loadFailed'), { variant: 'error' });
            setSegments([]);
            setTotal(0);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadContextFields();
    }, []);

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

    useEffect(() => {
        loadSegments();
    }, [page, rowsPerPage, debouncedSearchTerm]);

    // Handlers
    const handleEdit = (segment: FeatureSegment) => {
        const segmentData = {
            ...segment,
            constraints: segment.constraints || [],
        };
        setEditingSegment(segmentData);
        setOriginalSegment(JSON.parse(JSON.stringify(segmentData)));
        setEditDialogOpen(true);
    };

    const handleCreate = () => {
        const newSegment = { segmentName: '', displayName: '', description: '', constraints: [], tags: [] };
        setEditingSegment(newSegment);
        setOriginalSegment(null);
        setEditDialogOpen(true);
    };

    // Check if segment has been modified
    const hasChanges = (): boolean => {
        if (!editingSegment) return false;
        if (!originalSegment) return true; // New segment always has "changes"

        // Compare basic fields
        if ((editingSegment.segmentName || '') !== (originalSegment.segmentName || '')) return true;
        if ((editingSegment.displayName || '') !== (originalSegment.displayName || '')) return true;
        if ((editingSegment.description || '') !== (originalSegment.description || '')) return true;

        // Deep compare constraints
        const editingConstraints = editingSegment.constraints || [];
        const originalConstraints = originalSegment.constraints || [];

        if (editingConstraints.length !== originalConstraints.length) return true;

        for (let i = 0; i < editingConstraints.length; i++) {
            const ec = editingConstraints[i];
            const oc = originalConstraints[i];

            if (ec.contextName !== oc.contextName) return true;
            if (ec.operator !== oc.operator) return true;
            if ((ec.value ?? '') !== (oc.value ?? '')) return true;
            if (Boolean(ec.caseInsensitive) !== Boolean(oc.caseInsensitive)) return true;
            if (Boolean(ec.inverted) !== Boolean(oc.inverted)) return true;

            // Compare values arrays
            const ecValues = ec.values || [];
            const ocValues = oc.values || [];
            if (ecValues.length !== ocValues.length) return true;
            for (let j = 0; j < ecValues.length; j++) {
                if (ecValues[j] !== ocValues[j]) return true;
            }
        }

        // Compare tags
        const editingTags = editingSegment.tags || [];
        const originalTags = originalSegment.tags || [];
        if (editingTags.length !== originalTags.length) return true;
        for (let i = 0; i < editingTags.length; i++) {
            if (editingTags[i] !== originalTags[i]) return true;
        }

        return false;
    };

    // Check if segment is valid for saving
    const isSegmentValid = (): boolean => {
        if (!editingSegment?.segmentName) return false;

        // All constraints must have valid contextName and value
        const constraints = editingSegment.constraints || [];
        for (const constraint of constraints) {
            // Must have a context field selected
            if (!constraint.contextName) return false;

            // Must have value(s) based on operator type
            const isMultiValue = constraint.operator === 'str_in' || constraint.operator === 'str_not_in';
            if (isMultiValue) {
                if (!constraint.values?.length) return false;
            } else {
                if (constraint.value === undefined || constraint.value === '') return false;
            }
        }

        return true;
    };

    const handleSave = async () => {
        if (!editingSegment) return;
        try {
            if (editingSegment.id) {
                await api.put(`/admin/features/segments/${editingSegment.id}`, editingSegment);
                enqueueSnackbar(t('featureFlags.updateSuccess'), { variant: 'success' });
            } else {
                await api.post('/admin/features/segments', editingSegment);
                enqueueSnackbar(t('featureFlags.createSuccess'), { variant: 'success' });
            }
            setEditDialogOpen(false);
            setEditingSegment(null);
            loadSegments();
        } catch (error: any) {
            enqueueSnackbar(parseApiErrorMessage(error, 'featureFlags.saveFailed'), { variant: 'error' });
        }
    };

    const handleDelete = (segment: FeatureSegment) => {
        setDeletingSegment(segment);
        setDeleteConfirmOpen(true);
    };

    const handleDeleteConfirm = async () => {
        if (!deletingSegment) return;
        try {
            await api.delete(`/admin/features/segments/${deletingSegment.id}`);
            enqueueSnackbar(t('featureFlags.deleteSuccess'), { variant: 'success' });
            loadSegments();
        } catch (error: any) {
            enqueueSnackbar(parseApiErrorMessage(error, 'featureFlags.deleteFailed'), { variant: 'error' });
        } finally {
            setDeleteConfirmOpen(false);
            setDeletingSegment(null);
        }
    };

    const handleConstraintsChange = (constraints: Constraint[]) => {
        setEditingSegment(prev => prev ? { ...prev, constraints } : null);
    };

    return (
        <Box sx={{ p: 3 }}>
            {/* Header */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
                <Box>
                    <Typography variant="h4" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <SegmentIcon />
                        {t('featureFlags.segments')}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        {t('featureFlags.segmentsDescription')}
                    </Typography>
                </Box>
                <Box sx={{ display: 'flex', gap: 1 }}>
                    {canManage && (
                        <Button variant="contained" startIcon={<AddIcon />} onClick={handleCreate}>
                            {t('featureFlags.addSegment')}
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
                            <span><IconButton size="small" onClick={loadSegments} disabled={loading}><RefreshIcon /></IconButton></span>
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
                    ) : segments.length === 0 ? (
                        <EmptyState
                            message={t('featureFlags.noSegmentsFound')}
                            onAddClick={canManage ? handleCreate : undefined}
                            addButtonLabel={t('featureFlags.addSegment')}
                        />
                    ) : (
                        <>
                            <TableContainer>
                                <Table>
                                    <TableHead>
                                        <TableRow>
                                            <TableCell>{t('featureFlags.visibility')}</TableCell>
                                            <TableCell>{t('featureFlags.segmentName')}</TableCell>
                                            <TableCell>{t('featureFlags.displayName')}</TableCell>
                                            <TableCell>{t('featureFlags.constraints')}</TableCell>
                                            <TableCell>{t('featureFlags.tags')}</TableCell>
                                            <TableCell>{t('featureFlags.createdAt')}</TableCell>
                                            {canManage && <TableCell align="center">{t('common.actions')}</TableCell>}
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {segments.map((segment) => (
                                            <TableRow key={segment.id} hover>
                                                <TableCell>
                                                    <Switch
                                                        size="small"
                                                        checked={segment.isActive !== false}
                                                        onChange={async () => {
                                                            try {
                                                                await api.put(`/admin/features/segments/${segment.id}`, { isActive: !segment.isActive });
                                                                loadSegments();
                                                            } catch (error: any) {
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
                                                            onClick={() => handleEdit(segment)}
                                                        >
                                                            {segment.segmentName}
                                                        </Typography>
                                                        <Tooltip title={t('common.copy')}>
                                                            <IconButton
                                                                size="small"
                                                                onClick={(e) => { e.stopPropagation(); copyToClipboardWithNotification(segment.segmentName, enqueueSnackbar, t); }}
                                                                sx={{ opacity: 0.5, '&:hover': { opacity: 1 } }}
                                                            >
                                                                <CopyIcon sx={{ fontSize: 14 }} />
                                                            </IconButton>
                                                        </Tooltip>
                                                    </Box>
                                                </TableCell>
                                                <TableCell>
                                                    <Typography
                                                        sx={{ cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}
                                                        onClick={() => handleEdit(segment)}
                                                    >
                                                        {segment.displayName || segment.segmentName}
                                                    </Typography>
                                                </TableCell>
                                                <TableCell>
                                                    {segment.constraints && segment.constraints.length > 0 ? (
                                                        <Box>
                                                            <Box
                                                                sx={{ display: 'flex', alignItems: 'center', gap: 0.5, cursor: 'pointer' }}
                                                                onClick={() => {
                                                                    setExpandedConstraints(prev => {
                                                                        const newSet = new Set(prev);
                                                                        if (newSet.has(segment.id)) {
                                                                            newSet.delete(segment.id);
                                                                        } else {
                                                                            newSet.add(segment.id);
                                                                        }
                                                                        return newSet;
                                                                    });
                                                                }}
                                                            >
                                                                <Chip label={segment.constraints.length} size="small" />
                                                                {expandedConstraints.has(segment.id) ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                                                            </Box>
                                                            {expandedConstraints.has(segment.id) && (
                                                                <Box sx={{ mt: 1, pl: 1, borderLeft: 2, borderColor: 'divider' }}>
                                                                    {segment.constraints.map((c, idx) => (
                                                                        <Typography key={idx} variant="caption" sx={{ display: 'block', mb: 0.5 }}>
                                                                            {c.contextName} {c.operator} {c.values?.join(', ') || c.value}
                                                                        </Typography>
                                                                    ))}
                                                                </Box>
                                                            )}
                                                        </Box>
                                                    ) : (
                                                        <Typography variant="body2" color="text.disabled">-</Typography>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    {segment.tags && segment.tags.length > 0 ? (
                                                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                                            {segment.tags.map((tagName, idx) => {
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
                                                    <Tooltip title={formatDateTimeDetailed(segment.createdAt)}>
                                                        <span>{formatRelativeTime(segment.createdAt)}</span>
                                                    </Tooltip>
                                                </TableCell>
                                                {canManage && (
                                                    <TableCell align="center">
                                                        <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center' }}>
                                                            <Tooltip title={t('common.edit')}><IconButton size="small" onClick={() => handleEdit(segment)}><EditIcon fontSize="small" /></IconButton></Tooltip>
                                                            <Tooltip title={t('common.delete')}><IconButton size="small" onClick={() => handleDelete(segment)}><DeleteIcon fontSize="small" /></IconButton></Tooltip>
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
                title={editingSegment?.id ? t('featureFlags.editSegment') : t('featureFlags.addSegment')}
                subtitle={t('featureFlags.segmentsDescription')}
                storageKey="featureSegmentDrawerWidth"
                defaultWidth={500}
            >
                <Box sx={{ p: 3, flex: 1, overflow: 'auto' }}>
                    <Stack spacing={3}>
                        <Box>
                            <FormControlLabel
                                control={
                                    <Checkbox
                                        checked={editingSegment?.isActive !== false}
                                        onChange={(e) => setEditingSegment(prev => ({ ...prev, isActive: e.target.checked }))}
                                    />
                                }
                                label={t('featureFlags.visibility')}
                            />
                            <FormHelperText sx={{ ml: 4, mt: -0.5 }}>{t('featureFlags.visibilityHelp')}</FormHelperText>
                        </Box>

                        <TextField
                            fullWidth
                            required
                            label={t('featureFlags.segmentName')}
                            value={editingSegment?.segmentName || ''}
                            onChange={(e) => setEditingSegment(prev => ({ ...prev, segmentName: e.target.value.replace(/[^a-zA-Z0-9_-]/g, '') }))}
                            disabled={!!editingSegment?.id}
                            helperText={t('featureFlags.segmentNameHelp')}
                            placeholder="beta-users, premium-tier..."
                        />

                        <TextField
                            fullWidth
                            label={t('featureFlags.displayName')}
                            value={editingSegment?.displayName || ''}
                            onChange={(e) => setEditingSegment(prev => ({ ...prev, displayName: e.target.value }))}
                            helperText={t('featureFlags.segmentDisplayNameHelp')}
                        />

                        <TextField
                            fullWidth
                            multiline
                            rows={3}
                            label={t('featureFlags.description')}
                            value={editingSegment?.description || ''}
                            onChange={(e) => setEditingSegment(prev => ({ ...prev, description: e.target.value }))}
                            helperText={t('featureFlags.segmentDescriptionHelp')}
                        />

                        <Divider />

                        <Box>
                            <Typography variant="subtitle2" gutterBottom>{t('featureFlags.constraints')}</Typography>
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
                                {t('featureFlags.segmentConstraintsHelp')}
                            </Typography>
                            <ConstraintEditor
                                constraints={editingSegment?.constraints || []}
                                onChange={handleConstraintsChange}
                                contextFields={contextFields}
                                disabled={!canManage}
                            />
                        </Box>

                        <Divider />

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
                            value={(editingSegment?.tags || []).map(tagName => {
                                const found = allTags.find(t => t.name === tagName);
                                return found || { id: 0, name: tagName, color: '#888888' };
                            })}
                            onChange={(_, newValue) => {
                                const tagNames = newValue.map(v => typeof v === 'string' ? v : v.name);
                                setEditingSegment(prev => ({ ...prev, tags: tagNames }));
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
                        disabled={!hasChanges() || !isSegmentValid()}
                    >
                        {editingSegment?.id ? t('common.update') : t('common.create')}
                    </Button>
                </Box>
            </ResizableDrawer>

            {/* Delete Dialog */}
            <ConfirmDeleteDialog
                open={deleteConfirmOpen}
                onClose={() => setDeleteConfirmOpen(false)}
                onConfirm={handleDeleteConfirm}
                title={t('featureFlags.deleteConfirmTitle')}
                message={t('featureFlags.deleteConfirmMessage', { name: deletingSegment?.segmentName || '' })}
            />
        </Box>
    );
};

export default FeatureSegmentsPage;

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
} from '@mui/material';
import {
    Add as AddIcon,
    Search as SearchIcon,
    Category as SegmentIcon,
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

interface FeatureSegment {
    id: string;
    environmentId: string;
    segmentName: string;
    displayName: string;
    description: string;
    constraints: any[];
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

    const debouncedSearchTerm = useDebounce(searchTerm, 500);

    // Load segments
    const loadSegments = async () => {
        setLoading(true);
        try {
            const result = await api.get('/api/v1/admin/features/segments', {
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
        loadSegments();
    }, [page, rowsPerPage, debouncedSearchTerm]);

    // Handlers
    const handleEdit = (segment: FeatureSegment) => {
        setEditingSegment(segment);
        setEditDialogOpen(true);
    };

    const handleCreate = () => {
        setEditingSegment({ segmentName: '', displayName: '', description: '', constraints: [] });
        setEditDialogOpen(true);
    };

    const handleSave = async () => {
        if (!editingSegment) return;
        try {
            if (editingSegment.id) {
                await api.put(`/api/v1/admin/features/segments/${editingSegment.id}`, editingSegment);
                enqueueSnackbar(t('featureFlags.updateSuccess'), { variant: 'success' });
            } else {
                await api.post('/api/v1/admin/features/segments', editingSegment);
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
            await api.delete(`/api/v1/admin/features/segments/${deletingSegment.id}`);
            enqueueSnackbar(t('featureFlags.deleteSuccess'), { variant: 'success' });
            loadSegments();
        } catch (error: any) {
            enqueueSnackbar(parseApiErrorMessage(error, 'featureFlags.deleteFailed'), { variant: 'error' });
        } finally {
            setDeleteConfirmOpen(false);
            setDeletingSegment(null);
        }
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
                                            <TableCell>{t('featureFlags.segmentName')}</TableCell>
                                            <TableCell>{t('featureFlags.displayName')}</TableCell>
                                            <TableCell>{t('featureFlags.constraintsCount')}</TableCell>
                                            <TableCell>{t('featureFlags.createdAt')}</TableCell>
                                            {canManage && <TableCell align="center">{t('common.actions')}</TableCell>}
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {segments.map((segment) => (
                                            <TableRow key={segment.id} hover>
                                                <TableCell><Typography fontWeight={500}>{segment.segmentName}</Typography></TableCell>
                                                <TableCell>{segment.displayName || '-'}</TableCell>
                                                <TableCell><Chip label={segment.constraints?.length || 0} size="small" /></TableCell>
                                                <TableCell>{formatDateTimeDetailed(segment.createdAt)}</TableCell>
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

            {/* Edit Dialog */}
            <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle>{editingSegment?.id ? t('featureFlags.editSegment') : t('featureFlags.addSegment')}</DialogTitle>
                <DialogContent>
                    <Grid container spacing={2} sx={{ mt: 1 }}>
                        <Grid item xs={12}>
                            <TextField
                                fullWidth
                                label={t('featureFlags.segmentName')}
                                value={editingSegment?.segmentName || ''}
                                onChange={(e) => setEditingSegment(prev => ({ ...prev, segmentName: e.target.value }))}
                                disabled={!!editingSegment?.id}
                            />
                        </Grid>
                        <Grid item xs={12}>
                            <TextField
                                fullWidth
                                label={t('featureFlags.displayName')}
                                value={editingSegment?.displayName || ''}
                                onChange={(e) => setEditingSegment(prev => ({ ...prev, displayName: e.target.value }))}
                            />
                        </Grid>
                        <Grid item xs={12}>
                            <TextField
                                fullWidth
                                multiline
                                rows={3}
                                label={t('featureFlags.description')}
                                value={editingSegment?.description || ''}
                                onChange={(e) => setEditingSegment(prev => ({ ...prev, description: e.target.value }))}
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
                message={t('featureFlags.deleteConfirmMessage', { name: deletingSegment?.segmentName || '' })}
            />
        </Box>
    );
};

export default FeatureSegmentsPage;

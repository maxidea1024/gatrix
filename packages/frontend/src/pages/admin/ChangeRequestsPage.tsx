import React, { useState, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
    Box,
    Typography,
    Card,
    CardContent,
    TableContainer,
    Table,
    TableHead,
    TableRow,
    TableCell,
    TableBody,
    Chip,
    LinearProgress,
    Button,
    Tabs,
    Tab,
    Tooltip,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogContentText,
    DialogActions,
    TextField,
    Paper,
} from '@mui/material';
import {
    Refresh as RefreshIcon,
    Check as CheckIcon,
    Close as CloseIcon,
    Undo as UndoIcon,
    PlayArrow as PlayArrowIcon,
    Delete as DeleteIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import useSWR from 'swr';
import { useHandleApiError } from '@/hooks/useHandleApiError';

import { RelativeTime } from '@/components/common/RelativeTime';
import changeRequestService, {
    ChangeRequest,
    ChangeRequestStatus,
} from '@/services/changeRequestService';
import SimplePagination from '@/components/common/SimplePagination';
import EmptyTableRow from '@/components/common/EmptyTableRow';
import ChangeRequestDetailDrawer from '@/components/admin/ChangeRequestDetailDrawer';
import RevertPreviewDrawer from '@/components/admin/RevertPreviewDrawer';
import { formatChangeRequestTitle } from '@/utils/changeRequestFormatter';

// JSON Diff wrapper component
interface FieldChange {
    field: string;
    oldValue: any;
    newValue: any;
}

const JsonDiffView: React.FC<{ before?: any; after?: any }> = ({ before, after }) => {
    const { t } = useTranslation();

    // Determine operation type
    const isCreate = !before && after;
    const isDelete = before && !after;

    // Compute field-level changes for MODIFY
    const changes = useMemo(() => {
        if (!before || !after) return [];
        const result: FieldChange[] = [];
        const allKeys = new Set([...Object.keys(before), ...Object.keys(after)]);

        allKeys.forEach((key) => {
            const oldVal = before[key];
            const newVal = after[key];
            if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
                result.push({ field: key, oldValue: oldVal, newValue: newVal });
            }
        });
        return result;
    }, [before, after]);

    const formatValue = (value: any): string => {
        if (value === null) return 'null';
        if (value === undefined) return '-';
        if (typeof value === 'object') return JSON.stringify(value);
        return String(value);
    };

    // For CREATE: simply show the new data
    if (isCreate) {
        return (
            <Box>
                <Chip
                    label={t('changeRequest.operationCreate')}
                    color="success"
                    size="small"
                    sx={{ mb: 1 }}
                />
                <Box
                    component="pre"
                    sx={{
                        bgcolor: 'success.main',
                        color: 'common.white',
                        p: 1.5,
                        borderRadius: 1,
                        fontSize: '0.75rem',
                        fontFamily: 'monospace',
                        overflow: 'auto',
                        maxHeight: 300,
                        m: 0,
                    }}
                >
                    {JSON.stringify(after, null, 2)}
                </Box>
            </Box>
        );
    }

    // For DELETE: show the deleted data
    if (isDelete) {
        return (
            <Box>
                <Chip
                    label={t('changeRequest.operationDelete')}
                    color="error"
                    size="small"
                    sx={{ mb: 1 }}
                />
                <Box
                    component="pre"
                    sx={{
                        bgcolor: 'error.main',
                        color: 'common.white',
                        p: 1.5,
                        borderRadius: 1,
                        fontSize: '0.75rem',
                        fontFamily: 'monospace',
                        overflow: 'auto',
                        maxHeight: 300,
                        m: 0,
                    }}
                >
                    {JSON.stringify(before, null, 2)}
                </Box>
            </Box>
        );
    }

    // For MODIFY: show field-level changes in table format
    if (changes.length === 0) {
        return (
            <Typography variant="body2" color="textSecondary" sx={{ fontStyle: 'italic' }}>
                {t('changeRequest.noChanges')}
            </Typography>
        );
    }

    return (
        <Box>
            <Chip
                label={t('changeRequest.operationModify')}
                color="warning"
                size="small"
                sx={{ mb: 1 }}
            />
            <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                    <TableHead>
                        <TableRow>
                            <TableCell sx={{ fontWeight: 'bold', width: '25%' }}>{t('changeRequest.field')}</TableCell>
                            <TableCell sx={{ fontWeight: 'bold', width: '37.5%' }}>{t('changeRequest.oldValue')}</TableCell>
                            <TableCell sx={{ fontWeight: 'bold', width: '37.5%' }}>{t('changeRequest.newValue')}</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {changes.map((change) => (
                            <TableRow key={change.field}>
                                <TableCell sx={{ fontFamily: 'monospace', fontWeight: 500 }}>
                                    {change.field}
                                </TableCell>
                                <TableCell sx={{ fontFamily: 'monospace', bgcolor: 'error.dark', color: 'common.white' }}>
                                    {formatValue(change.oldValue)}
                                </TableCell>
                                <TableCell sx={{ fontFamily: 'monospace', bgcolor: 'success.dark', color: 'common.white' }}>
                                    {formatValue(change.newValue)}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>
        </Box>
    );
};




// Status configuration
const STATUS_CONFIG: Record<ChangeRequestStatus, { color: 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning'; labelKey: string }> = {
    draft: { color: 'default', labelKey: 'changeRequest.status.draft' },
    open: { color: 'info', labelKey: 'changeRequest.status.open' },
    approved: { color: 'success', labelKey: 'changeRequest.status.approved' },
    applied: { color: 'primary', labelKey: 'changeRequest.status.applied' },
    rejected: { color: 'error', labelKey: 'changeRequest.status.rejected' },
    conflict: { color: 'warning', labelKey: 'changeRequest.status.conflict' },
};

// Priority configuration
const PRIORITY_CONFIG: Record<string, { color: 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning'; labelKey: string }> = {
    low: { color: 'default', labelKey: 'changeRequest.priority.low' },
    medium: { color: 'info', labelKey: 'changeRequest.priority.medium' },
    high: { color: 'warning', labelKey: 'changeRequest.priority.high' },
    critical: { color: 'error', labelKey: 'changeRequest.priority.critical' },
};

// Row component
interface ChangeRequestRowProps {
    cr: ChangeRequest;
    index: number;
    onRefresh: () => void;
    onOpenDrawer: (id: string) => void;
}

const ChangeRequestRow: React.FC<ChangeRequestRowProps> = ({ cr, index, onRefresh, onOpenDrawer }) => {
    const { t, i18n } = useTranslation();
    const { enqueueSnackbar } = useSnackbar();

    const [actionLoading, setActionLoading] = useState(false);
    const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
    const [rejectComment, setRejectComment] = useState('');
    const [submitDialogOpen, setSubmitDialogOpen] = useState(false);
    const [submitTitle, setSubmitTitle] = useState('');
    const [submitReason, setSubmitReason] = useState('');
    const [reopenDialogOpen, setReopenDialogOpen] = useState(false);
    const [rollbackPreviewOpen, setRollbackPreviewOpen] = useState(false);
    const { handleApiError, ErrorDialog } = useHandleApiError();



    const handleApprove = async () => {
        setActionLoading(true);
        try {
            await changeRequestService.approve(cr.id);
            enqueueSnackbar(t('changeRequest.messages.approved'), { variant: 'success' });
            onRefresh();
        } catch (err: any) {
            handleApiError(err, 'changeRequest.errors.approveFailed');
        } finally {
            setActionLoading(false);
        }
    };

    const handleReject = async () => {
        if (!rejectComment.trim()) {
            enqueueSnackbar(t('changeRequest.errors.rejectCommentRequired'), { variant: 'warning' });
            return;
        }
        setActionLoading(true);
        try {
            await changeRequestService.reject(cr.id, rejectComment);
            enqueueSnackbar(t('changeRequest.messages.rejected'), { variant: 'success' });
            setRejectDialogOpen(false);
            setRejectComment('');
            onRefresh();
        } catch (err: any) {
            handleApiError(err, 'changeRequest.errors.rejectFailed');
        } finally {
            setActionLoading(false);
        }
    };

    const handleReopen = () => {
        setReopenDialogOpen(true);
    };

    const confirmReopen = async () => {
        setActionLoading(true);
        try {
            await changeRequestService.reopen(cr.id);
            enqueueSnackbar(t('changeRequest.messages.reopened'), { variant: 'success' });
            setReopenDialogOpen(false);
            onRefresh();
        } catch (err: any) {
            handleApiError(err, 'changeRequest.errors.reopenFailed');
        } finally {
            setActionLoading(false);
        }
    };

    const handleExecute = async () => {
        setActionLoading(true);
        try {
            await changeRequestService.execute(cr.id);
            enqueueSnackbar(t('changeRequest.messages.executed'), { variant: 'success' });
            onRefresh();
        } catch (err: any) {
            if (handleApiError(err, 'changeRequest.errors.executeFailed')) {
                onRefresh(); // Refresh if it was a conflict (to show rejected status if handled by dialog)
            }
        } finally {
            setActionLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!window.confirm(t('changeRequest.confirmDelete'))) return;
        setActionLoading(true);
        try {
            await changeRequestService.delete(cr.id);
            enqueueSnackbar(t('changeRequest.messages.deleted'), { variant: 'success' });
            onRefresh();
        } catch (err: any) {
            handleApiError(err, 'changeRequest.errors.deleteFailed');
        } finally {
            setActionLoading(false);
        }
    };

    const handleRollback = () => {
        setRollbackPreviewOpen(true);
    };

    // ... (rest of existing handlers like handleDelete)

    const handleSubmit = async () => {
        if (!submitTitle.trim() || !submitReason.trim()) {
            enqueueSnackbar(t('changeRequest.errors.submitFieldsRequired'), { variant: 'warning' });
            return;
        }
        setActionLoading(true);
        try {
            await changeRequestService.submit(cr.id, { title: submitTitle.trim(), reason: submitReason.trim() });
            enqueueSnackbar(t('changeRequest.messages.submitted'), { variant: 'success' });
            setSubmitDialogOpen(false);
            setSubmitTitle('');
            setSubmitReason('');
            onRefresh();
        } catch (err: any) {
            handleApiError(err, 'changeRequest.errors.submitFailed');
        } finally {
            setActionLoading(false);
        }
    };

    const statusConfig = STATUS_CONFIG[cr.status];
    const priorityConfig = PRIORITY_CONFIG[cr.priority] || PRIORITY_CONFIG.medium;

    return (
        <>
            <TableRow
                hover
                sx={{ cursor: 'pointer' }}
                onClick={() => onOpenDrawer(cr.id)}
            >

                <TableCell>
                    <Chip
                        label={t(statusConfig.labelKey)}
                        color={statusConfig.color}
                        size="small"
                        sx={{ fontWeight: 'bold', minWidth: 80 }}
                    />
                </TableCell>
                <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {formatChangeRequestTitle(cr.title, t)}
                    </Typography>
                </TableCell>
                <TableCell>
                    <Typography variant="body2">
                        {cr.requester?.name || cr.requester?.email || '-'}
                    </Typography>
                </TableCell>
                <TableCell>
                    <Chip
                        label={t(priorityConfig.labelKey)}
                        color={priorityConfig.color}
                        size="small"
                        variant="outlined"
                    />
                </TableCell>
                <TableCell align="center">
                    <Typography variant="body2">
                        {cr.changeItems?.length || 0}
                    </Typography>
                </TableCell>
                <TableCell align="center">
                    <Typography variant="body2">
                        {cr.approvals?.length || 0} / {cr.environmentModel?.requiredApprovers || 1}
                    </Typography>
                </TableCell>
                <TableCell align="center">
                    <RelativeTime date={cr.updatedAt} />
                </TableCell>
                <TableCell align="center">
                    {cr.status === 'applied' && (
                        <Chip
                            label={t('changeRequest.actions.revert')}
                            color="warning"
                            size="small"
                            variant="outlined"
                            onClick={(e) => {
                                e.stopPropagation();
                                handleRollback();
                            }}
                            icon={<UndoIcon />}
                            disabled={actionLoading}
                        />
                    )}
                </TableCell>
            </TableRow>


            {/* Submit Dialog */}
            <Dialog open={submitDialogOpen} onClose={() => setSubmitDialogOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle>{t('changeRequest.submitDialog.title')}</DialogTitle>
                <DialogContent>
                    <DialogContentText sx={{ mb: 2 }}>
                        {t('changeRequest.submitDialog.description')}
                    </DialogContentText>
                    <TextField
                        autoFocus
                        fullWidth
                        label={t('changeRequest.submitDialog.titleField')}
                        value={submitTitle}
                        onChange={(e) => setSubmitTitle(e.target.value)}
                        required
                        sx={{ mb: 2 }}
                    />
                    <TextField
                        fullWidth
                        multiline
                        rows={3}
                        label={t('changeRequest.submitDialog.reason')}
                        value={submitReason}
                        onChange={(e) => setSubmitReason(e.target.value)}
                        required
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setSubmitDialogOpen(false)}>{t('common.cancel')}</Button>
                    <Button onClick={handleSubmit} variant="contained" disabled={actionLoading}>
                        {t('changeRequest.actions.submit')}
                    </Button>
                </DialogActions>
            </Dialog >

            {/* Reject Dialog */}
            < Dialog open={rejectDialogOpen} onClose={() => setRejectDialogOpen(false)} maxWidth="sm" fullWidth >
                <DialogTitle>{t('changeRequest.rejectDialog.title')}</DialogTitle>
                <DialogContent>
                    <DialogContentText sx={{ mb: 2 }}>
                        {t('changeRequest.rejectDialog.description')}
                    </DialogContentText>
                    <TextField
                        autoFocus
                        fullWidth
                        multiline
                        rows={3}
                        label={t('changeRequest.rejectDialog.comment')}
                        value={rejectComment}
                        onChange={(e) => setRejectComment(e.target.value)}
                        required
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setRejectDialogOpen(false)}>{t('common.cancel')}</Button>
                    <Button onClick={handleReject} color="error" disabled={actionLoading}>
                        {t('changeRequest.actions.reject')}
                    </Button>
                </DialogActions>
            </Dialog >

            {/* Reopen Confirmation Dialog */}
            < Dialog open={reopenDialogOpen} onClose={() => setReopenDialogOpen(false)} maxWidth="sm" fullWidth >
                <DialogTitle>{t('changeRequest.reopenDialog.title')}</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        {t('changeRequest.reopenDialog.description')}
                    </DialogContentText>
                    {cr.rejectionReason && (
                        <Paper variant="outlined" sx={{ mt: 2, p: 2, bgcolor: 'action.hover' }}>
                            <Typography variant="caption" color="textSecondary">{t('changeRequest.rejectionReason')}</Typography>
                            <Typography variant="body2" sx={{ mt: 0.5, whiteSpace: 'pre-wrap' }}>
                                {cr.rejectionReason}
                            </Typography>
                        </Paper>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setReopenDialogOpen(false)}>{t('common.cancel')}</Button>
                    <Button onClick={confirmReopen} color="warning" variant="contained" disabled={actionLoading}>
                        {t('changeRequest.actions.reopen')}
                    </Button>
                </DialogActions>
            </Dialog >

            {/* Rollback Preview Drawer */}
            <RevertPreviewDrawer
                open={rollbackPreviewOpen}
                onClose={() => setRollbackPreviewOpen(false)}
                changeRequestId={cr.id}
                onRollbackCreated={() => onRefresh()}
            />

            <ErrorDialog />
        </>
    );
};

// Main Page Component
const ChangeRequestsPage: React.FC = () => {
    const { t } = useTranslation();
    const { enqueueSnackbar } = useSnackbar();


    // Tab state controlled by URL param
    const [searchParams, setSearchParams] = useSearchParams();
    const statusFilters: (ChangeRequestStatus | undefined)[] = [undefined, 'draft', 'open', 'approved', 'applied', 'rejected', 'conflict'];

    // Initialize/Get tab value from URL
    const tabValue = useMemo(() => {
        const statusParam = searchParams.get('status');
        if (statusParam) {
            const index = statusFilters.indexOf(statusParam as ChangeRequestStatus);
            if (index !== -1) return index;
        }
        return 0;
    }, [searchParams]);

    // Update URL when tab changes
    const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
        const status = statusFilters[newValue];
        if (status) {
            setSearchParams({ status });
        } else {
            setSearchParams({});
        }
        setPage(0);
    };

    // Pagination
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(20);

    // Drawer state
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [selectedChangeRequestId, setSelectedChangeRequestId] = useState<string | null>(null);

    const handleOpenDrawer = useCallback((id: string) => {
        setSelectedChangeRequestId(id);
        setDrawerOpen(true);
    }, []);

    const handleCloseDrawer = useCallback(() => {
        setDrawerOpen(false);
        setSelectedChangeRequestId(null);
    }, []);

    const statusFilter = statusFilters[tabValue];

    // SWR fetcher
    const fetcher = useCallback(async () => {
        const params: any = { page: page + 1, limit: rowsPerPage };
        if (statusFilter) {
            params.status = statusFilter;
        }
        return await changeRequestService.list(params);
    }, [page, rowsPerPage, statusFilter]);

    const { data, isLoading, mutate } = useSWR(
        `change-requests-${page}-${rowsPerPage}-${statusFilter || 'all'}`,
        fetcher,
        {
            revalidateOnFocus: false,
            revalidateOnReconnect: false,
        }
    );

    const { data: stats, mutate: mutateStats } = useSWR(
        'change-requests-stats',
        () => changeRequestService.getStats(),
        {
            revalidateOnFocus: false,
        }
    );

    const handleRefresh = useCallback(() => {
        mutate();
        mutateStats();
    }, [mutate, mutateStats]);

    const handlePageChange = useCallback((_: unknown, newPage: number) => {
        setPage(newPage);
    }, []);

    const handleRowsPerPageChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        const newRowsPerPage = parseInt(event.target.value, 10);
        setRowsPerPage(newRowsPerPage);
        setPage(0);
    }, []);

    return (
        <Box sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
                <Box>
                    <Typography variant="h4" component="h1" gutterBottom>
                        {t('changeRequest.title')}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        {t('changeRequest.subtitle')}
                    </Typography>
                </Box>
                <Button
                    variant="outlined"
                    startIcon={<RefreshIcon />}
                    onClick={handleRefresh}
                >
                    {t('common.refresh')}
                </Button>
            </Box>

            <Card>
                <CardContent sx={{ p: 0, '&:last-child': { pb: 0 } }}>
                    {/* Status Tabs */}
                    <Box sx={{ borderBottom: 1, borderColor: 'divider', px: 2 }}>
                        <Tabs value={tabValue} onChange={handleTabChange}>
                            <Tab label={t('changeRequest.tabs.all') + (stats?.all ? ` (${stats.all})` : '')} />
                            <Tab label={t('changeRequest.tabs.draft') + (stats?.draft ? ` (${stats.draft})` : '')} />
                            <Tab label={t('changeRequest.tabs.open') + (stats?.open ? ` (${stats.open})` : '')} />
                            <Tab label={t('changeRequest.tabs.approved') + (stats?.approved ? ` (${stats.approved})` : '')} />
                            <Tab label={t('changeRequest.tabs.applied') + (stats?.applied ? ` (${stats.applied})` : '')} />
                            <Tab label={t('changeRequest.tabs.rejected') + (stats?.rejected ? ` (${stats.rejected})` : '')} />
                            <Tab label={t('changeRequest.tabs.conflict') + (stats?.conflict ? ` (${stats.conflict})` : '')} />
                        </Tabs>
                    </Box>

                    {isLoading && <LinearProgress />}

                    <TableContainer>
                        <Table>
                            <TableHead>
                                <TableRow>

                                    <TableCell>{t('changeRequest.status')}</TableCell>
                                    <TableCell>{t('changeRequest.titleField')}</TableCell>
                                    <TableCell>{t('changeRequest.requester')}</TableCell>
                                    <TableCell>{t('changeRequest.priorityField')}</TableCell>
                                    <TableCell align="center">{t('changeRequest.items')}</TableCell>
                                    <TableCell align="center">{t('changeRequest.approvalProgress')}</TableCell>
                                    <TableCell align="center">{t('changeRequest.lastUpdated')}</TableCell>
                                    <TableCell align="center">{t('changeRequest.actions.label')}</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {data?.items && data.items.length > 0 ? (
                                    data.items.map((cr, idx) => (
                                        <ChangeRequestRow key={cr.id} cr={cr} index={idx} onRefresh={handleRefresh} onOpenDrawer={handleOpenDrawer} />
                                    ))
                                ) : (
                                    <EmptyTableRow colSpan={8} message={t('changeRequest.noRequests')} />
                                )}
                            </TableBody>
                        </Table>
                    </TableContainer>

                    {/* Pagination */}
                    {data && data.pagination && data.pagination.total > 0 && (
                        <Box sx={{ p: 2 }}>
                            <SimplePagination
                                count={data.pagination.total}
                                page={page}
                                rowsPerPage={rowsPerPage}
                                onPageChange={handlePageChange}
                                onRowsPerPageChange={handleRowsPerPageChange}
                            />
                        </Box>
                    )}
                </CardContent>
            </Card>

            {/* Change Request Detail Drawer */}
            <ChangeRequestDetailDrawer
                open={drawerOpen}
                onClose={handleCloseDrawer}
                changeRequestId={selectedChangeRequestId}
                onRefresh={handleRefresh}
            />
        </Box >
    );
};

export default ChangeRequestsPage;

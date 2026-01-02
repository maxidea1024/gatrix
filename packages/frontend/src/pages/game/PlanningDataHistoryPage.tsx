import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { PERMISSIONS } from '@/types/permissions';
import {
    Box,
    Typography,
    Card,
    CardContent,
    CircularProgress,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    Chip,
    Tooltip,
    IconButton,
    Collapse,
} from '@mui/material';
import {
    History as HistoryIcon,
    Refresh as RefreshIcon,
    ContentCopy as CopyIcon,
    ExpandMore as ExpandMoreIcon,
    ExpandLess as ExpandLessIcon,
    Computer as WebIcon,
    Terminal as CliIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import { copyToClipboardWithNotification } from '@/utils/clipboard';
import planningDataService, { UploadRecord } from '../../services/planningDataService';
import SimplePagination from '../../components/common/SimplePagination';
import { formatDateTimeDetailed } from '../../utils/dateFormat';

const PlanningDataHistoryPage: React.FC = () => {
    const { t } = useTranslation();
    const { enqueueSnackbar } = useSnackbar();
    const { hasPermission } = useAuth();
    const canView = hasPermission([PERMISSIONS.PLANNING_DATA_VIEW, PERMISSIONS.PLANNING_DATA_MANAGE]);

    const [history, setHistory] = useState<UploadRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(20);
    const [expandedRow, setExpandedRow] = useState<number | null>(null);

    useEffect(() => {
        loadHistory();
    }, []);

    const loadHistory = async () => {
        try {
            setLoading(true);
            const data = await planningDataService.getUploadHistory(100);
            setHistory(data);
        } catch (error: any) {
            console.error('Error loading history:', error);
            enqueueSnackbar(t('planningData.history.loadFailed'), { variant: 'error' });
        } finally {
            setLoading(false);
        }
    };

    const handleRefresh = () => {
        loadHistory();
    };

    const toggleExpand = (id: number) => {
        setExpandedRow(expandedRow === id ? null : id);
    };

    const formatBytes = (bytes: number): string => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    // Pagination
    const paginatedHistory = history.slice(page * rowsPerPage, (page + 1) * rowsPerPage);

    if (!canView) {
        return (
            <Box sx={{ p: 3 }}>
                <Typography color="error">{t('common.noPermission')}</Typography>
            </Box>
        );
    }

    return (
        <Box sx={{ p: 3 }}>
            {/* Header */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <HistoryIcon sx={{ fontSize: 32 }} />
                    <Typography variant="h4" component="h1">
                        {t('planningData.history.title')}
                    </Typography>
                </Box>
                <IconButton onClick={handleRefresh} disabled={loading}>
                    <RefreshIcon />
                </IconButton>
            </Box>

            {/* Content */}
            {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                    <CircularProgress />
                </Box>
            ) : history.length === 0 ? (
                <Card>
                    <CardContent>
                        <Typography color="text.secondary" align="center">
                            {t('planningData.history.noRecords')}
                        </Typography>
                    </CardContent>
                </Card>
            ) : (
                <Card>
                    <TableContainer component={Paper}>
                        <Table>
                            <TableHead>
                                <TableRow>
                                    <TableCell width={40}></TableCell>
                                    <TableCell>{t('planningData.history.uploadedAt')}</TableCell>
                                    <TableCell>{t('planningData.history.uploader')}</TableCell>
                                    <TableCell>{t('planningData.history.source')}</TableCell>
                                    <TableCell>{t('planningData.history.hash')}</TableCell>
                                    <TableCell align="right">{t('planningData.history.filesCount')}</TableCell>
                                    <TableCell align="right">{t('planningData.history.size')}</TableCell>
                                    <TableCell>{t('planningData.history.comment')}</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {paginatedHistory.map((record, index) => (
                                    <React.Fragment key={record.id}>
                                        <TableRow
                                            hover
                                            sx={{
                                                bgcolor: index === 0 ? 'action.selected' : 'inherit',
                                                cursor: 'pointer',
                                            }}
                                            onClick={() => toggleExpand(record.id)}
                                        >
                                            <TableCell>
                                                <IconButton size="small">
                                                    {expandedRow === record.id ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                                                </IconButton>
                                            </TableCell>
                                            <TableCell>
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                    {formatDateTimeDetailed(record.uploadedAt)}
                                                    {index === 0 && (
                                                        <Chip size="small" label={t('planningData.history.latest')} color="primary" />
                                                    )}
                                                </Box>
                                            </TableCell>
                                            <TableCell>
                                                <Typography variant="body2">
                                                    {record.uploaderName || 'Unknown'}
                                                </Typography>
                                            </TableCell>
                                            <TableCell>
                                                <Chip
                                                    size="small"
                                                    icon={record.uploadSource === 'cli' ? <CliIcon /> : <WebIcon />}
                                                    label={record.uploadSource.toUpperCase()}
                                                    color={record.uploadSource === 'cli' ? 'warning' : 'default'}
                                                    variant="outlined"
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <Tooltip title={t('common.copyToClipboard')}>
                                                    <Chip
                                                        size="small"
                                                        label={record.uploadHash}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            copyToClipboardWithNotification(
                                                                record.uploadHash,
                                                                () => enqueueSnackbar(t('common.copiedToClipboard'), { variant: 'success' }),
                                                                () => enqueueSnackbar(t('common.copyFailed'), { variant: 'error' })
                                                            );
                                                        }}
                                                        sx={{ cursor: 'pointer', fontFamily: 'monospace' }}
                                                    />
                                                </Tooltip>
                                            </TableCell>
                                            <TableCell align="right">{record.filesCount}</TableCell>
                                            <TableCell align="right">{formatBytes(record.totalSize)}</TableCell>
                                            <TableCell>
                                                <Typography variant="body2" noWrap sx={{ maxWidth: 200 }}>
                                                    {record.uploadComment || '-'}
                                                </Typography>
                                            </TableCell>
                                        </TableRow>
                                        <TableRow>
                                            <TableCell colSpan={8} sx={{ py: 0 }}>
                                                <Collapse in={expandedRow === record.id} timeout="auto" unmountOnExit>
                                                    <Box sx={{ py: 2, px: 4 }}>
                                                        {record.changedFiles && record.changedFiles.length > 0 ? (
                                                            <>
                                                                <Typography variant="subtitle2" gutterBottom>
                                                                    {t('planningData.history.changedFiles')} ({record.changedFiles.length}):
                                                                </Typography>
                                                                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                                                    {record.changedFiles.map((file) => {
                                                                        const fileDiff = record.fileDiffs?.[file];
                                                                        return (
                                                                            <Box key={file} sx={{ p: 1.5, bgcolor: 'action.hover', borderRadius: 1 }}>
                                                                                <Chip size="small" label={file} color="warning" sx={{ mb: 1 }} />
                                                                                {fileDiff && (
                                                                                    <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mt: 1 }}>
                                                                                        {fileDiff.added?.length > 0 && (
                                                                                            <Box>
                                                                                                <Typography variant="caption" color="success.main" sx={{ fontWeight: 'bold' }}>
                                                                                                    + {t('planningData.history.added')}: {fileDiff.added.length}
                                                                                                </Typography>
                                                                                                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
                                                                                                    {fileDiff.added.slice(0, 10).map((id: string) => (
                                                                                                        <Chip key={id} size="small" label={`ID: ${id}`} color="success" variant="outlined" sx={{ fontSize: '0.7rem' }} />
                                                                                                    ))}
                                                                                                    {fileDiff.added.length > 10 && (
                                                                                                        <Chip size="small" label={`+${fileDiff.added.length - 10} more`} variant="outlined" sx={{ fontSize: '0.7rem' }} />
                                                                                                    )}
                                                                                                </Box>
                                                                                            </Box>
                                                                                        )}
                                                                                        {fileDiff.removed?.length > 0 && (
                                                                                            <Box>
                                                                                                <Typography variant="caption" color="error.main" sx={{ fontWeight: 'bold' }}>
                                                                                                    − {t('planningData.history.removed')}: {fileDiff.removed.length}
                                                                                                </Typography>
                                                                                                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
                                                                                                    {fileDiff.removed.slice(0, 10).map((id: string) => (
                                                                                                        <Chip key={id} size="small" label={`ID: ${id}`} color="error" variant="outlined" sx={{ fontSize: '0.7rem' }} />
                                                                                                    ))}
                                                                                                    {fileDiff.removed.length > 10 && (
                                                                                                        <Chip size="small" label={`+${fileDiff.removed.length - 10} more`} variant="outlined" sx={{ fontSize: '0.7rem' }} />
                                                                                                    )}
                                                                                                </Box>
                                                                                            </Box>
                                                                                        )}
                                                                                        {fileDiff.modified?.length > 0 && (
                                                                                            <Box>
                                                                                                <Typography variant="caption" color="warning.main" sx={{ fontWeight: 'bold' }}>
                                                                                                    ~ {t('planningData.history.modified')}: {fileDiff.modified.length}
                                                                                                </Typography>
                                                                                                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
                                                                                                    {fileDiff.modified.slice(0, 10).map((id: string) => (
                                                                                                        <Chip key={id} size="small" label={`ID: ${id}`} color="warning" variant="outlined" sx={{ fontSize: '0.7rem' }} />
                                                                                                    ))}
                                                                                                    {fileDiff.modified.length > 10 && (
                                                                                                        <Chip size="small" label={`+${fileDiff.modified.length - 10} more`} variant="outlined" sx={{ fontSize: '0.7rem' }} />
                                                                                                    )}
                                                                                                </Box>
                                                                                            </Box>
                                                                                        )}
                                                                                    </Box>
                                                                                )}
                                                                                {!fileDiff && (
                                                                                    <Typography variant="caption" color="text.secondary">
                                                                                        {t('planningData.history.noDiffAvailable')}
                                                                                    </Typography>
                                                                                )}
                                                                            </Box>
                                                                        );
                                                                    })}
                                                                </Box>
                                                            </>
                                                        ) : (
                                                            <Typography variant="body2" color="text.secondary">
                                                                {t('planningData.history.noChanges')}
                                                            </Typography>
                                                        )}
                                                    </Box>
                                                </Collapse>
                                            </TableCell>
                                        </TableRow>
                                    </React.Fragment>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>

                    {/* Pagination */}
                    {history.length > rowsPerPage && (
                        <Box sx={{ p: 2 }}>
                            <SimplePagination
                                totalCount={history.length}
                                page={page}
                                rowsPerPage={rowsPerPage}
                                onPageChange={setPage}
                                onRowsPerPageChange={setRowsPerPage}
                            />
                        </Box>
                    )}
                </Card>
            )}
        </Box>
    );
};

export default PlanningDataHistoryPage;

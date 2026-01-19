import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
    TableSortLabel,
    Switch,
    FormControl,
    Select,
    MenuItem,
    InputLabel,
} from '@mui/material';
import {
    Add as AddIcon,
    Search as SearchIcon,
    Flag as FlagIcon,
    Refresh as RefreshIcon,
    Archive as ArchiveIcon,
    Unarchive as UnarchiveIcon,
    Delete as DeleteIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import { parseApiErrorMessage } from '../../utils/errorUtils';
import featureFlagService, { FeatureFlag, FlagType } from '../../services/featureFlagService';
import SimplePagination from '../../components/common/SimplePagination';
import EmptyState from '../../components/common/EmptyState';
import { useDebounce } from '../../hooks/useDebounce';
import { formatDateTimeDetailed } from '../../utils/dateFormat';
import ConfirmDeleteDialog from '../../components/common/ConfirmDeleteDialog';

const FeatureFlagsPage: React.FC = () => {
    const { t } = useTranslation();
    const { enqueueSnackbar } = useSnackbar();
    const { hasPermission } = useAuth();
    const canManage = hasPermission([PERMISSIONS.FEATURE_FLAGS_MANAGE]);
    const navigate = useNavigate();

    // State
    const [flags, setFlags] = useState<FeatureFlag[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [loading, setLoading] = useState(false);
    const [isInitialLoad, setIsInitialLoad] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [flagTypeFilter, setFlagTypeFilter] = useState<FlagType | ''>('');
    const [showArchived, setShowArchived] = useState(false);
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [deletingFlag, setDeletingFlag] = useState<FeatureFlag | null>(null);

    // Sorting state
    const [orderBy, setOrderBy] = useState<string>(() => {
        const saved = localStorage.getItem('featureFlagsSortBy');
        return saved || 'createdAt';
    });
    const [order, setOrder] = useState<'asc' | 'desc'>(() => {
        const saved = localStorage.getItem('featureFlagsSortOrder');
        return (saved as 'asc' | 'desc') || 'desc';
    });

    const debouncedSearchTerm = useDebounce(searchTerm, 500);

    // Load flags
    const loadFlags = async () => {
        setLoading(true);
        try {
            const result = await featureFlagService.getFeatureFlags({
                page: page + 1,
                limit: rowsPerPage,
                search: debouncedSearchTerm || undefined,
                flagType: flagTypeFilter || undefined,
                isArchived: showArchived,
                sortBy: orderBy,
                sortOrder: order,
            });

            if (result && typeof result === 'object' && 'flags' in result && Array.isArray(result.flags)) {
                setFlags(result.flags);
                const validTotal = typeof result.total === 'number' && !isNaN(result.total) ? result.total : 0;
                setTotal(validTotal);
            } else {
                console.error('Invalid response:', result);
                setFlags([]);
                setTotal(0);
            }
        } catch (error: any) {
            console.error('Failed to load feature flags:', error);
            enqueueSnackbar(parseApiErrorMessage(error, 'featureFlags.loadFailed'), { variant: 'error' });
            setFlags([]);
            setTotal(0);
        } finally {
            setLoading(false);
            setIsInitialLoad(false);
        }
    };

    useEffect(() => {
        loadFlags();
    }, [page, rowsPerPage, debouncedSearchTerm, orderBy, order, flagTypeFilter, showArchived]);

    // Sort handler
    const handleSort = (colId: string) => {
        let newOrder: 'asc' | 'desc' = 'asc';
        if (orderBy === colId) {
            newOrder = order === 'asc' ? 'desc' : 'asc';
        }
        setOrderBy(colId);
        setOrder(newOrder);
        localStorage.setItem('featureFlagsSortBy', colId);
        localStorage.setItem('featureFlagsSortOrder', newOrder);
        setPage(0);
    };

    // Toggle flag
    const handleToggle = async (flag: FeatureFlag) => {
        try {
            await featureFlagService.toggleFeatureFlag(flag.flagName, !flag.isEnabled);
            enqueueSnackbar(
                t(flag.isEnabled ? 'featureFlags.disableSuccess' : 'featureFlags.enableSuccess'),
                { variant: 'success' }
            );
            loadFlags();
        } catch (error: any) {
            enqueueSnackbar(parseApiErrorMessage(error, 'featureFlags.toggleFailed'), { variant: 'error' });
        }
    };

    // Archive/Revive flag
    const handleArchiveToggle = async (flag: FeatureFlag) => {
        try {
            if (flag.isArchived) {
                await featureFlagService.reviveFeatureFlag(flag.flagName);
                enqueueSnackbar(t('featureFlags.reviveSuccess'), { variant: 'success' });
            } else {
                await featureFlagService.archiveFeatureFlag(flag.flagName);
                enqueueSnackbar(t('featureFlags.archiveSuccess'), { variant: 'success' });
            }
            loadFlags();
        } catch (error: any) {
            enqueueSnackbar(parseApiErrorMessage(error, 'featureFlags.archiveFailed'), { variant: 'error' });
        }
    };

    // Delete flag
    const handleDelete = (flag: FeatureFlag) => {
        setDeletingFlag(flag);
        setDeleteConfirmOpen(true);
    };

    const handleDeleteConfirm = async () => {
        if (!deletingFlag) return;
        try {
            await featureFlagService.deleteFeatureFlag(deletingFlag.flagName);
            enqueueSnackbar(t('featureFlags.deleteSuccess'), { variant: 'success' });
            loadFlags();
        } catch (error: any) {
            enqueueSnackbar(parseApiErrorMessage(error, 'featureFlags.deleteFailed'), { variant: 'error' });
        } finally {
            setDeleteConfirmOpen(false);
            setDeletingFlag(null);
        }
    };

    const handleDeleteCancel = () => {
        setDeleteConfirmOpen(false);
        setDeletingFlag(null);
    };

    // Flag type chip color
    const getTypeColor = (type: FlagType): 'default' | 'primary' | 'secondary' | 'warning' => {
        switch (type) {
            case 'release': return 'primary';
            case 'experiment': return 'secondary';
            case 'operational': return 'warning';
            case 'permission': return 'default';
            default: return 'default';
        }
    };

    return (
        <Box sx={{ p: 3 }}>
            {/* Header */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
                <Box>
                    <Typography variant="h4" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <FlagIcon />
                        {t('featureFlags.title')}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        {t('featureFlags.subtitle')}
                    </Typography>
                </Box>
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                    {canManage && (
                        <Button variant="contained" startIcon={<AddIcon />} onClick={() => navigate('/game/feature-flags/new')}>
                            {t('featureFlags.createFlag')}
                        </Button>
                    )}
                </Box>
            </Box>

            {/* Search and Filters */}
            <Card sx={{ mb: 3 }}>
                <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap', justifyContent: 'space-between' }}>
                        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap', flex: 1 }}>
                            <TextField
                                placeholder={t('featureFlags.searchPlaceholder')}
                                value={searchTerm}
                                onChange={(e) => { setSearchTerm(e.target.value); setPage(0); }}
                                sx={{
                                    minWidth: 200, flexGrow: 1, maxWidth: 320,
                                    '& .MuiOutlinedInput-root': {
                                        height: '40px', borderRadius: '20px', bgcolor: 'background.paper',
                                        transition: 'all 0.2s ease-in-out',
                                        '& fieldset': { borderColor: 'divider' },
                                        '&:hover': { bgcolor: 'action.hover', '& fieldset': { borderColor: 'primary.light' } },
                                        '&.Mui-focused': { bgcolor: 'background.paper', boxShadow: '0 0 0 2px rgba(25, 118, 210, 0.1)', '& fieldset': { borderColor: 'primary.main', borderWidth: '1px' } }
                                    },
                                    '& .MuiInputBase-input': { fontSize: '0.875rem' }
                                }}
                                InputProps={{ startAdornment: (<InputAdornment position="start"><SearchIcon sx={{ color: 'text.secondary', fontSize: 20 }} /></InputAdornment>) }}
                                size="small"
                            />
                            <FormControl size="small" sx={{ minWidth: 150 }}>
                                <InputLabel>{t('featureFlags.typeFilter')}</InputLabel>
                                <Select
                                    value={flagTypeFilter}
                                    label={t('featureFlags.typeFilter')}
                                    onChange={(e) => { setFlagTypeFilter(e.target.value as FlagType | ''); setPage(0); }}
                                >
                                    <MenuItem value="">{t('common.all')}</MenuItem>
                                    <MenuItem value="release">{t('featureFlags.types.release')}</MenuItem>
                                    <MenuItem value="experiment">{t('featureFlags.types.experiment')}</MenuItem>
                                    <MenuItem value="operational">{t('featureFlags.types.operational')}</MenuItem>
                                    <MenuItem value="permission">{t('featureFlags.types.permission')}</MenuItem>
                                </Select>
                            </FormControl>
                            <Tooltip title={t('featureFlags.showArchivedTooltip')}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                    <Switch
                                        size="small"
                                        checked={showArchived}
                                        onChange={(e) => { setShowArchived(e.target.checked); setPage(0); }}
                                    />
                                    <Typography variant="body2">{t('featureFlags.showArchived')}</Typography>
                                </Box>
                            </Tooltip>
                        </Box>
                        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                            <Tooltip title={t('common.refresh')}>
                                <span><IconButton size="small" onClick={loadFlags} disabled={loading}><RefreshIcon /></IconButton></span>
                            </Tooltip>
                        </Box>
                    </Box>
                </CardContent>
            </Card>

            {/* Table */}
            <Card>
                <CardContent sx={{ p: 0, '&:last-child': { pb: 0 } }}>
                    {loading && isInitialLoad ? (
                        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
                            <Typography color="text.secondary">{t('common.loadingData')}</Typography>
                        </Box>
                    ) : flags.length === 0 ? (
                        <EmptyState
                            message={t('featureFlags.noFlagsFound')}
                            onAddClick={canManage ? () => navigate('/game/feature-flags/new') : undefined}
                            addButtonLabel={t('featureFlags.createFlag')}
                            subtitle={canManage ? t('common.addFirstItem') : undefined}
                        />
                    ) : (
                        <>
                            <TableContainer>
                                <Table>
                                    <TableHead>
                                        <TableRow>
                                            <TableCell>
                                                <TableSortLabel active={orderBy === 'flagName'} direction={orderBy === 'flagName' ? order : 'asc'} onClick={() => handleSort('flagName')}>
                                                    {t('featureFlags.flagName')}
                                                </TableSortLabel>
                                            </TableCell>
                                            <TableCell>{t('featureFlags.displayName')}</TableCell>
                                            <TableCell>{t('featureFlags.type')}</TableCell>
                                            <TableCell>{t('featureFlags.enabled')}</TableCell>
                                            <TableCell>
                                                <TableSortLabel active={orderBy === 'createdAt'} direction={orderBy === 'createdAt' ? order : 'asc'} onClick={() => handleSort('createdAt')}>
                                                    {t('featureFlags.createdAt')}
                                                </TableSortLabel>
                                            </TableCell>
                                            {canManage && <TableCell align="center">{t('common.actions')}</TableCell>}
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {flags.map((flag) => (
                                            <TableRow
                                                key={flag.id}
                                                hover
                                                sx={{
                                                    cursor: 'pointer',
                                                    ...(flag.isArchived ? { opacity: 0.6 } : {})
                                                }}
                                                onClick={() => navigate(`/game/feature-flags/${flag.flagName}`)}
                                            >
                                                <TableCell>
                                                    <Typography fontWeight={500}>{flag.flagName}</Typography>
                                                    {flag.tags && flag.tags.length > 0 && (
                                                        <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5 }}>
                                                            {flag.tags.slice(0, 3).map((tag, idx) => (
                                                                <Chip key={idx} label={tag} size="small" variant="outlined" sx={{ height: 20 }} />
                                                            ))}
                                                            {flag.tags.length > 3 && <Chip label={`+${flag.tags.length - 3}`} size="small" sx={{ height: 20 }} />}
                                                        </Box>
                                                    )}
                                                </TableCell>
                                                <TableCell>{flag.displayName || '-'}</TableCell>
                                                <TableCell>
                                                    <Chip label={t(`featureFlags.types.${flag.flagType}`)} size="small" color={getTypeColor(flag.flagType)} />
                                                </TableCell>
                                                <TableCell>
                                                    <Switch
                                                        size="small"
                                                        checked={flag.isEnabled}
                                                        onChange={() => handleToggle(flag)}
                                                        disabled={flag.isArchived || !canManage}
                                                    />
                                                </TableCell>
                                                <TableCell>{formatDateTimeDetailed(flag.createdAt)}</TableCell>
                                                {canManage && (
                                                    <TableCell align="center">
                                                        <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center' }}>
                                                            <Tooltip title={flag.isArchived ? t('featureFlags.revive') : t('featureFlags.archive')}>
                                                                <IconButton size="small" onClick={() => handleArchiveToggle(flag)}>
                                                                    {flag.isArchived ? <UnarchiveIcon fontSize="small" /> : <ArchiveIcon fontSize="small" />}
                                                                </IconButton>
                                                            </Tooltip>
                                                            <Tooltip title={t('common.delete')}>
                                                                <IconButton size="small" onClick={() => handleDelete(flag)}>
                                                                    <DeleteIcon fontSize="small" />
                                                                </IconButton>
                                                            </Tooltip>
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
                                onPageChange={(event, newPage) => setPage(newPage)}
                                onRowsPerPageChange={(event) => { setRowsPerPage(Number(event.target.value)); setPage(0); }}
                            />
                        </>
                    )}
                </CardContent>
            </Card>

            {/* Delete Confirmation Dialog */}
            <ConfirmDeleteDialog
                open={deleteConfirmOpen}
                onClose={handleDeleteCancel}
                onConfirm={handleDeleteConfirm}
                title={t('featureFlags.deleteConfirmTitle')}
                message={t('featureFlags.deleteConfirmMessage', { name: deletingFlag?.flagName || '' })}
            />
        </Box>
    );
};

export default FeatureFlagsPage;

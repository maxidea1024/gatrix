/**
 * Signal Endpoints Management Page
 *
 * Allows administrators to manage signal endpoints,
 * their tokens, and view received signals.
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
    Box,
    Typography,
    Button,
    Paper,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    IconButton,
    Chip,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    Switch,
    Tooltip,
    Alert,
    Collapse,
    Divider,
    List,
    ListItem,
    ListItemText,
    ListItemSecondaryAction,
} from '@mui/material';
import {
    Add as AddIcon,
    Edit as EditIcon,
    Delete as DeleteIcon,
    Refresh as RefreshIcon,
    ContentCopy as CopyIcon,
    ExpandMore as ExpandMoreIcon,
    ExpandLess as ExpandLessIcon,
    Sensors as SensorsIcon,
    VpnKey as TokenIcon,
    Cancel as CancelIcon,
    Save as SaveIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { enqueueSnackbar } from 'notistack';
import signalEndpointService, {
    SignalEndpoint,
    SignalEndpointToken,
} from '@/services/signalEndpointService';
import { copyToClipboardWithNotification } from '@/utils/clipboard';
import EmptyPlaceholder from '@/components/common/EmptyPlaceholder';
import ResizableDrawer from '@/components/common/ResizableDrawer';

// ==================== Create/Edit Dialog ====================
interface EndpointDialogProps {
    open: boolean;
    endpoint: SignalEndpoint | null;
    onClose: () => void;
    onSave: (data: { name: string; description?: string }) => void;
}

const EndpointDialog: React.FC<EndpointDialogProps> = ({ open, endpoint, onClose, onSave }) => {
    const { t } = useTranslation();
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');

    useEffect(() => {
        if (endpoint) {
            setName(endpoint.name);
            setDescription(endpoint.description || '');
        } else {
            setName('');
            setDescription('');
        }
    }, [endpoint, open]);

    const handleSave = () => {
        if (!name.trim()) return;
        onSave({ name: name.trim(), description: description.trim() || undefined });
    };

    return (
        <ResizableDrawer
            open={open}
            onClose={onClose}
            title={endpoint
                ? t('signalEndpoints.editEndpoint')
                : t('signalEndpoints.createEndpoint')}
            subtitle={t('signalEndpoints.drawerSubtitle')}
            storageKey="signalEndpointDrawerWidth"
            defaultWidth={500}
            minWidth={400}
            zIndex={1301}
        >
            {/* Content */}
            <Box
                sx={{
                    flex: 1,
                    p: 3,
                    overflow: 'auto',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 3,
                }}
            >
                <Paper variant="outlined" sx={{ p: 2 }}>
                    <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 600, color: 'primary.main' }}>
                        {t('signalEndpoints.basicInfo')}
                    </Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <TextField
                            autoFocus
                            label={t('signalEndpoints.name')}
                            fullWidth
                            size="small"
                            required
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                        />
                        <TextField
                            label={t('signalEndpoints.description')}
                            fullWidth
                            multiline
                            rows={3}
                            size="small"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                        />
                    </Box>
                </Paper>
            </Box>

            {/* Footer Actions */}
            <Box
                sx={{
                    p: 2,
                    borderTop: '1px solid',
                    borderColor: 'divider',
                    bgcolor: 'background.paper',
                    display: 'flex',
                    gap: 1,
                    justifyContent: 'flex-end',
                }}
            >
                <Button onClick={onClose} startIcon={<CancelIcon />}>
                    {t('common.cancel')}
                </Button>
                <Button onClick={handleSave} variant="contained" startIcon={<SaveIcon />} disabled={!name.trim()}>
                    {endpoint ? t('common.save') : t('common.create')}
                </Button>
            </Box>
        </ResizableDrawer>
    );
};

// ==================== Token Dialog ====================
interface TokenDialogProps {
    open: boolean;
    endpointId: number | null;
    onClose: () => void;
    onCreated: () => void;
}

const TokenDialog: React.FC<TokenDialogProps> = ({ open, endpointId, onClose, onCreated }) => {
    const { t } = useTranslation();
    const [tokenName, setTokenName] = useState('');
    const [createdToken, setCreatedToken] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (open) {
            setTokenName('');
            setCreatedToken(null);
        }
    }, [open]);

    const handleCreate = async () => {
        if (!endpointId || !tokenName.trim()) return;
        setLoading(true);
        try {
            const result = await signalEndpointService.createToken(endpointId, {
                name: tokenName.trim(),
            });
            setCreatedToken(result.secret);
            onCreated();
            enqueueSnackbar(t('signalEndpoints.tokenCreatedSuccess'), { variant: 'success' });
        } catch (error) {
            enqueueSnackbar(t('signalEndpoints.tokenCreateFailed'), { variant: 'error' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle>{t('signalEndpoints.createToken')}</DialogTitle>
            <DialogContent>
                {!createdToken ? (
                    <TextField
                        autoFocus
                        margin="dense"
                        label={t('signalEndpoints.tokenName')}
                        fullWidth
                        value={tokenName}
                        onChange={(e) => setTokenName(e.target.value)}
                        sx={{ mt: 1 }}
                    />
                ) : (
                    <Box>
                        <Alert severity="warning" sx={{ mb: 2 }}>
                            {t('signalEndpoints.tokenSecurityNotice')}
                        </Alert>
                        <TextField
                            fullWidth
                            label={t('signalEndpoints.tokenValue')}
                            value={createdToken}
                            InputProps={{
                                readOnly: true,
                                endAdornment: (
                                    <IconButton
                                        size="small"
                                        onClick={() =>
                                            copyToClipboardWithNotification(
                                                createdToken,
                                                () => enqueueSnackbar(t('common.copiedToClipboard'), { variant: 'success' }),
                                                () => enqueueSnackbar(t('common.copyFailed'), { variant: 'error' })
                                            )
                                        }
                                    >
                                        <CopyIcon fontSize="small" />
                                    </IconButton>
                                ),
                            }}
                        />
                    </Box>
                )}
            </DialogContent>
            <DialogActions>
                {!createdToken ? (
                    <>
                        <Button onClick={onClose}>{t('common.cancel')}</Button>
                        <Button
                            onClick={handleCreate}
                            variant="contained"
                            disabled={!tokenName.trim() || loading}
                        >
                            {t('common.create')}
                        </Button>
                    </>
                ) : (
                    <Button onClick={onClose} variant="contained">
                        {t('common.close')}
                    </Button>
                )}
            </DialogActions>
        </Dialog>
    );
};

// ==================== Delete Confirm Dialog ====================
interface DeleteDialogProps {
    open: boolean;
    title: string;
    message: string;
    onClose: () => void;
    onConfirm: () => void;
}

const DeleteDialog: React.FC<DeleteDialogProps> = ({
    open,
    title,
    message,
    onClose,
    onConfirm,
}) => {
    const { t } = useTranslation();

    return (
        <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
            <DialogTitle>{title}</DialogTitle>
            <DialogContent>
                <Typography>{message}</Typography>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>{t('common.cancel')}</Button>
                <Button onClick={onConfirm} color="error" variant="contained">
                    {t('common.delete')}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

// ==================== Main Page ====================
const SignalEndpointsPage: React.FC = () => {
    const { t } = useTranslation();
    const [endpoints, setEndpoints] = useState<SignalEndpoint[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedId, setExpandedId] = useState<number | null>(null);
    const [endpointTokens, setEndpointTokens] = useState<Record<number, SignalEndpointToken[]>>({});

    // Dialog states
    const [editDialog, setEditDialog] = useState<{
        open: boolean;
        endpoint: SignalEndpoint | null;
    }>({ open: false, endpoint: null });

    const [tokenDialog, setTokenDialog] = useState<{
        open: boolean;
        endpointId: number | null;
    }>({ open: false, endpointId: null });

    const [deleteDialog, setDeleteDialog] = useState<{
        open: boolean;
        type: 'endpoint' | 'token';
        endpointId: number;
        tokenId?: number;
        name: string;
    } | null>(null);

    const fetchEndpoints = useCallback(async () => {
        setLoading(true);
        try {
            const data = await signalEndpointService.getAll();
            setEndpoints(data);
        } catch (error) {
            enqueueSnackbar(t('signalEndpoints.loadFailed'), { variant: 'error' });
        } finally {
            setLoading(false);
        }
    }, [t]);

    useEffect(() => {
        fetchEndpoints();
    }, [fetchEndpoints]);

    const fetchTokens = useCallback(
        async (endpointId: number) => {
            try {
                const endpoint = await signalEndpointService.getById(endpointId);
                if (endpoint.tokens) {
                    setEndpointTokens((prev) => ({ ...prev, [endpointId]: endpoint.tokens! }));
                }
            } catch (error) {
                enqueueSnackbar(t('signalEndpoints.tokenLoadFailed'), { variant: 'error' });
            }
        },
        [t]
    );

    const handleExpand = (id: number) => {
        if (expandedId === id) {
            setExpandedId(null);
        } else {
            setExpandedId(id);
            fetchTokens(id);
        }
    };

    const handleSaveEndpoint = async (data: { name: string; description?: string }) => {
        try {
            if (editDialog.endpoint) {
                await signalEndpointService.update(editDialog.endpoint.id, data);
                enqueueSnackbar(t('signalEndpoints.updateSuccess'), { variant: 'success' });
            } else {
                await signalEndpointService.create(data);
                enqueueSnackbar(t('signalEndpoints.createSuccess'), { variant: 'success' });
            }
            setEditDialog({ open: false, endpoint: null });
            fetchEndpoints();
        } catch (error) {
            enqueueSnackbar(
                editDialog.endpoint
                    ? t('signalEndpoints.updateFailed')
                    : t('signalEndpoints.createFailed'),
                { variant: 'error' }
            );
        }
    };

    const handleToggle = async (endpoint: SignalEndpoint) => {
        try {
            await signalEndpointService.toggle(endpoint.id);
            fetchEndpoints();
        } catch (error) {
            enqueueSnackbar(t('signalEndpoints.toggleFailed'), { variant: 'error' });
        }
    };

    const handleDeleteConfirm = async () => {
        if (!deleteDialog) return;
        try {
            if (deleteDialog.type === 'endpoint') {
                await signalEndpointService.delete(deleteDialog.endpointId);
                enqueueSnackbar(t('signalEndpoints.deleteSuccess'), { variant: 'success' });
            } else if (deleteDialog.tokenId) {
                await signalEndpointService.deleteToken(deleteDialog.endpointId, deleteDialog.tokenId);
                enqueueSnackbar(t('signalEndpoints.tokenDeleteSuccess'), { variant: 'success' });
                fetchTokens(deleteDialog.endpointId);
            }
            setDeleteDialog(null);
            fetchEndpoints();
        } catch (error) {
            enqueueSnackbar(t('signalEndpoints.deleteFailed'), { variant: 'error' });
        }
    };

    return (
        <Box sx={{ p: 3 }}>
            {/* Header */}
            <Box
                sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    mb: 3,
                }}
            >
                <Box>
                    <Typography variant="h5" fontWeight="bold">
                        {t('signalEndpoints.title')}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        {t('signalEndpoints.subtitle')}
                    </Typography>
                </Box>
                <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button
                        variant="outlined"
                        startIcon={<RefreshIcon />}
                        onClick={fetchEndpoints}
                    >
                        {t('common.refresh')}
                    </Button>
                    {endpoints.length > 0 && (
                        <Button
                            variant="contained"
                            startIcon={<AddIcon />}
                            onClick={() => setEditDialog({ open: true, endpoint: null })}
                        >
                            {t('signalEndpoints.createEndpoint')}
                        </Button>
                    )}
                </Box>
            </Box>

            {/* Content */}
            {!loading && endpoints.length === 0 ? (
                <EmptyPlaceholder
                    message={t('signalEndpoints.noEndpoints')}
                    onAddClick={() => setEditDialog({ open: true, endpoint: null })}
                    addButtonLabel={t('signalEndpoints.createEndpoint')}
                />
            ) : (
                <TableContainer component={Paper} variant="outlined">
                    <Table>
                        <TableHead>
                            <TableRow>
                                <TableCell width={40} />
                                <TableCell>{t('signalEndpoints.name')}</TableCell>
                                <TableCell>{t('signalEndpoints.description')}</TableCell>
                                <TableCell align="center">{t('signalEndpoints.status')}</TableCell>
                                <TableCell align="center">{t('signalEndpoints.tokens')}</TableCell>
                                <TableCell align="right">{t('common.actions')}</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                                        <Typography color="text.secondary">
                                            {t('common.loading')}
                                        </Typography>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                endpoints.map((endpoint) => (
                                    <React.Fragment key={endpoint.id}>
                                        <TableRow
                                            hover
                                            sx={{
                                                '& > td': {
                                                    borderBottom: expandedId === endpoint.id ? 'none' : undefined,
                                                },
                                            }}
                                        >
                                            <TableCell>
                                                <IconButton
                                                    size="small"
                                                    onClick={() => handleExpand(endpoint.id)}
                                                >
                                                    {expandedId === endpoint.id ? (
                                                        <ExpandLessIcon />
                                                    ) : (
                                                        <ExpandMoreIcon />
                                                    )}
                                                </IconButton>
                                            </TableCell>
                                            <TableCell>
                                                <Typography fontWeight="medium">{endpoint.name}</Typography>
                                            </TableCell>
                                            <TableCell>
                                                <Typography
                                                    variant="body2"
                                                    color="text.secondary"
                                                    sx={{
                                                        maxWidth: 300,
                                                        overflow: 'hidden',
                                                        textOverflow: 'ellipsis',
                                                        whiteSpace: 'nowrap',
                                                    }}
                                                >
                                                    {endpoint.description || '-'}
                                                </Typography>
                                            </TableCell>
                                            <TableCell align="center">
                                                <Tooltip
                                                    title={
                                                        endpoint.isEnabled
                                                            ? t('signalEndpoints.enabled')
                                                            : t('signalEndpoints.disabled')
                                                    }
                                                >
                                                    <Switch
                                                        checked={endpoint.isEnabled}
                                                        size="small"
                                                        onChange={() => handleToggle(endpoint)}
                                                    />
                                                </Tooltip>
                                            </TableCell>
                                            <TableCell align="center">
                                                <Chip
                                                    label={endpoint.tokens?.length || 0}
                                                    size="small"
                                                    variant="outlined"
                                                    icon={<TokenIcon sx={{ fontSize: 14 }} />}
                                                />
                                            </TableCell>
                                            <TableCell align="right">
                                                <Tooltip title={t('signalEndpoints.createToken')}>
                                                    <IconButton
                                                        size="small"
                                                        onClick={() =>
                                                            setTokenDialog({ open: true, endpointId: endpoint.id })
                                                        }
                                                    >
                                                        <TokenIcon fontSize="small" />
                                                    </IconButton>
                                                </Tooltip>
                                                <Tooltip title={t('common.edit')}>
                                                    <IconButton
                                                        size="small"
                                                        onClick={() =>
                                                            setEditDialog({ open: true, endpoint })
                                                        }
                                                    >
                                                        <EditIcon fontSize="small" />
                                                    </IconButton>
                                                </Tooltip>
                                                <Tooltip title={t('common.delete')}>
                                                    <IconButton
                                                        size="small"
                                                        color="error"
                                                        onClick={() =>
                                                            setDeleteDialog({
                                                                open: true,
                                                                type: 'endpoint',
                                                                endpointId: endpoint.id,
                                                                name: endpoint.name,
                                                            })
                                                        }
                                                    >
                                                        <DeleteIcon fontSize="small" />
                                                    </IconButton>
                                                </Tooltip>
                                            </TableCell>
                                        </TableRow>

                                        {/* Expanded Token List */}
                                        <TableRow>
                                            <TableCell
                                                colSpan={6}
                                                sx={{ py: 0, borderBottom: expandedId === endpoint.id ? undefined : 'none' }}
                                            >
                                                <Collapse in={expandedId === endpoint.id}>
                                                    <Box sx={{ p: 2, bgcolor: 'action.hover', borderRadius: 1, my: 1 }}>
                                                        <Box
                                                            sx={{
                                                                display: 'flex',
                                                                justifyContent: 'space-between',
                                                                alignItems: 'center',
                                                                mb: 1,
                                                            }}
                                                        >
                                                            <Typography variant="subtitle2">
                                                                {t('signalEndpoints.tokensFor', { name: endpoint.name })}
                                                            </Typography>
                                                            <Button
                                                                size="small"
                                                                startIcon={<AddIcon />}
                                                                onClick={() =>
                                                                    setTokenDialog({ open: true, endpointId: endpoint.id })
                                                                }
                                                            >
                                                                {t('signalEndpoints.addToken')}
                                                            </Button>
                                                        </Box>
                                                        <Divider sx={{ mb: 1 }} />
                                                        {(!endpointTokens[endpoint.id] ||
                                                            endpointTokens[endpoint.id].length === 0) ? (
                                                            <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>
                                                                {t('signalEndpoints.noTokens')}
                                                            </Typography>
                                                        ) : (
                                                            <List dense disablePadding>
                                                                {endpointTokens[endpoint.id].map((token) => (
                                                                    <ListItem key={token.id} sx={{ px: 0 }}>
                                                                        <ListItemText
                                                                            primary={token.tokenName}
                                                                            secondary={new Date(token.createdAt).toLocaleDateString()}
                                                                        />
                                                                        <ListItemSecondaryAction>
                                                                            <IconButton
                                                                                edge="end"
                                                                                size="small"
                                                                                color="error"
                                                                                onClick={() =>
                                                                                    setDeleteDialog({
                                                                                        open: true,
                                                                                        type: 'token',
                                                                                        endpointId: endpoint.id,
                                                                                        tokenId: token.id,
                                                                                        name: token.tokenName,
                                                                                    })
                                                                                }
                                                                            >
                                                                                <DeleteIcon fontSize="small" />
                                                                            </IconButton>
                                                                        </ListItemSecondaryAction>
                                                                    </ListItem>
                                                                ))}
                                                            </List>
                                                        )}
                                                        <Divider sx={{ mt: 1, mb: 1 }} />
                                                        <Typography variant="caption" color="text.secondary">
                                                            {t('signalEndpoints.endpointUrl')}:{' '}
                                                            <Box
                                                                component="code"
                                                                sx={{
                                                                    bgcolor: 'background.paper',
                                                                    px: 1,
                                                                    py: 0.5,
                                                                    borderRadius: 0.5,
                                                                    fontSize: '0.75rem',
                                                                    cursor: 'pointer',
                                                                }}
                                                                onClick={() =>
                                                                    copyToClipboardWithNotification(
                                                                        `POST /api/v1/signals/${endpoint.name}`,
                                                                        () => enqueueSnackbar(t('common.copiedToClipboard'), { variant: 'success' }),
                                                                        () => enqueueSnackbar(t('common.copyFailed'), { variant: 'error' })
                                                                    )
                                                                }
                                                            >
                                                                POST /api/v1/signals/{endpoint.name}
                                                            </Box>
                                                        </Typography>
                                                    </Box>
                                                </Collapse>
                                            </TableCell>
                                        </TableRow>
                                    </React.Fragment>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </TableContainer>
            )}

            {/* Dialogs */}
            <EndpointDialog
                open={editDialog.open}
                endpoint={editDialog.endpoint}
                onClose={() => setEditDialog({ open: false, endpoint: null })}
                onSave={handleSaveEndpoint}
            />

            <TokenDialog
                open={tokenDialog.open}
                endpointId={tokenDialog.endpointId}
                onClose={() => setTokenDialog({ open: false, endpointId: null })}
                onCreated={() => {
                    if (tokenDialog.endpointId) {
                        fetchTokens(tokenDialog.endpointId);
                    }
                    fetchEndpoints();
                }}
            />

            {deleteDialog && (
                <DeleteDialog
                    open={deleteDialog.open}
                    title={
                        deleteDialog.type === 'endpoint'
                            ? t('signalEndpoints.deleteEndpoint')
                            : t('signalEndpoints.deleteToken')
                    }
                    message={t('signalEndpoints.deleteConfirmMessage', { name: deleteDialog.name })}
                    onClose={() => setDeleteDialog(null)}
                    onConfirm={handleDeleteConfirm}
                />
            )}
        </Box>
    );
};

export default SignalEndpointsPage;

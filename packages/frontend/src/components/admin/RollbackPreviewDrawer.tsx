import React, { useState } from 'react';
import {
    Box,
    Typography,
    Paper,
    Chip,
    Button,
    CircularProgress,
    Alert,
    Divider,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableRow,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import {
    Add as AddIcon,
    Edit as EditIcon,
    Delete as DeleteIcon,
    Undo as UndoIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import { useHandleApiError } from '@/hooks/useHandleApiError';
import useSWR from 'swr';
import ResizableDrawer from '@/components/common/ResizableDrawer';
import changeRequestService from '@/services/changeRequestService';
import { getTableLocalizationKey } from '@/utils/changeRequestFormatter';

interface FieldOp {
    path: string;
    oldValue: any;
    newValue: any;
    opType: 'SET' | 'DEL' | 'MOD';
}

interface RollbackItem {
    targetTable: string;
    targetId: string;
    opType: 'CREATE' | 'UPDATE' | 'DELETE';
    ops: FieldOp[];
    actionType: string;
}

interface RollbackPreviewDrawerProps {
    open: boolean;
    onClose: () => void;
    changeRequestId: string | null;
    onRollbackCreated?: (newCrId: string) => void;
}

const RollbackPreviewDrawer: React.FC<RollbackPreviewDrawerProps> = ({
    open,
    onClose,
    changeRequestId,
    onRollbackCreated,
}) => {
    const { t } = useTranslation();
    const { enqueueSnackbar } = useSnackbar();
    const { handleApiError } = useHandleApiError();
    const [isCreating, setIsCreating] = useState(false);

    // Fetch rollback preview
    const { data: preview, error, isLoading } = useSWR(
        open && changeRequestId ? `/admin/change-requests/${changeRequestId}/rollback-preview` : null,
        () => changeRequestService.getRollbackPreview(changeRequestId!)
    );

    const handleCreateRollback = async () => {
        if (!changeRequestId) return;

        setIsCreating(true);
        try {
            const result = await changeRequestService.rollback(changeRequestId);
            enqueueSnackbar(t('changeRequest.messages.rollbackCreated'), { variant: 'success' });
            onClose();
            if (onRollbackCreated) {
                onRollbackCreated(result.id);
            }
        } catch (err) {
            handleApiError(err);
        } finally {
            setIsCreating(false);
        }
    };

    const getOpTypeColor = (opType: string): 'success' | 'error' | 'warning' => {
        switch (opType) {
            case 'CREATE': return 'success';
            case 'DELETE': return 'error';
            default: return 'warning';
        }
    };

    const getOpTypeLabel = (opType: string) => {
        switch (opType) {
            case 'CREATE': return t('changeRequest.opCreate');
            case 'DELETE': return t('changeRequest.opDelete');
            default: return t('changeRequest.opUpdate');
        }
    };

    const getOpIcon = (opType: string) => {
        switch (opType) {
            case 'CREATE': return <AddIcon fontSize="small" />;
            case 'DELETE': return <DeleteIcon fontSize="small" />;
            default: return <EditIcon fontSize="small" />;
        }
    };

    const formatValue = (value: any): string => {
        if (value === null || value === undefined) return '—';
        if (typeof value === 'boolean') return value ? 'true' : 'false';
        if (typeof value === 'object') return JSON.stringify(value);
        return String(value);
    };

    // Convert internal field names to user-friendly labels based on table
    const formatFieldName = (tableName: string, fieldName: string): string => {
        const tableFieldMappings: Record<string, Record<string, string>> = {
            g_service_notices: {
                title: t('serviceNotices.noticeTitle'),
                content: t('serviceNotices.content'),
                category: t('serviceNotices.category'),
                tabTitle: t('serviceNotices.tabTitle'),
                startDate: t('serviceNotices.startDate'),
                endDate: t('serviceNotices.endDate'),
                description: t('serviceNotices.description'),
                isActive: t('serviceNotices.isActive'),
            },
            g_store_products: {
                productId: t('storeProducts.productId'),
                productName: t('storeProducts.productName'),
                nameKo: t('storeProducts.nameKo'),
                nameEn: t('storeProducts.nameEn'),
                nameZh: t('storeProducts.nameZh'),
                store: t('storeProducts.store'),
                price: t('storeProducts.price'),
                currency: t('storeProducts.currency'),
                isActive: t('storeProducts.isActive'),
            },
            g_game_worlds: {
                name: t('gameWorlds.name'),
                worldId: t('gameWorlds.worldId'),
                description: t('gameWorlds.description'),
                isVisible: t('gameWorlds.isVisible'),
                isMaintenance: t('gameWorlds.isMaintenance'),
            },
            g_client_versions: {
                platform: t('clientVersions.platform'),
                channel: t('clientVersions.channel'),
                minVersion: t('clientVersions.minVersion'),
                recommendedVersion: t('clientVersions.recommendedVersion'),
                latestVersion: t('clientVersions.latestVersion'),
            },
            g_ingame_popup_notices: {
                isActive: t('ingamePopupNotices.isActive'),
                content: t('ingamePopupNotices.content'),
                startDate: t('ingamePopupNotices.startDate'),
                endDate: t('ingamePopupNotices.endDate'),
                description: t('ingamePopupNotices.description'),
            },
            g_reward_templates: {
                name: t('rewardTemplates.name'),
                description: t('rewardTemplates.description'),
                rewardItems: t('rewardTemplates.rewardItems'),
            },
        };

        const commonMappings: Record<string, string> = {
            id: 'ID',
            environment: t('common.environment'),
            createdAt: t('common.createdAt'),
            updatedAt: t('common.updatedAt'),
            createdBy: t('common.createdBy'),
            updatedBy: t('common.updatedBy'),
            version: t('common.version'),
        };

        if (tableFieldMappings[tableName]?.[fieldName]) {
            return tableFieldMappings[tableName][fieldName];
        }
        if (commonMappings[fieldName]) {
            return commonMappings[fieldName];
        }
        return fieldName
            .replace(/([A-Z])/g, ' $1')
            .replace(/^./, str => str.toUpperCase())
            .trim();
    };

    return (
        <ResizableDrawer
            anchor="right"
            open={open}
            onClose={onClose}
            title={t('changeRequest.rollbackPreview')}
            defaultWidth={650}
            minWidth={500}
        >
            <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                {/* Content Area */}
                <Box sx={{ flex: 1, overflow: 'auto', p: 3 }}>
                    {isLoading && (
                        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                            <CircularProgress />
                        </Box>
                    )}

                    {error && (
                        <Alert severity="error" sx={{ mb: 2 }}>
                            {t('common.errorLoading')}
                        </Alert>
                    )}

                    {preview && (
                        <>
                            {/* Header Info */}
                            <Paper sx={{ p: 2, mb: 3, bgcolor: alpha('#ff9800', 0.1), border: '1px solid', borderColor: 'warning.main' }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                    <UndoIcon color="warning" />
                                    <Typography variant="h6">
                                        {t('changeRequest.rollbackPreviewTitle')}
                                    </Typography>
                                </Box>
                                <Typography variant="body2" color="text.secondary">
                                    {t('changeRequest.rollbackPreviewDesc', { title: preview.originalCr?.title })}
                                </Typography>
                            </Paper>

                            {/* Rollback Items */}
                            <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 600 }}>
                                {t('changeRequest.rollbackChanges')} ({preview.rollbackItems?.length || 0})
                            </Typography>

                            {preview.rollbackItems?.map((item: RollbackItem, index: number) => (
                                <Paper
                                    key={index}
                                    variant="outlined"
                                    sx={{ mb: 2, overflow: 'hidden' }}
                                >
                                    {/* Item Header */}
                                    <Box sx={{
                                        px: 2,
                                        py: 1.5,
                                        bgcolor: 'action.hover',
                                        borderBottom: item.opType !== 'DELETE' ? '1px solid' : 'none',
                                        borderColor: 'divider',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 1.5,
                                    }}>
                                        {getOpIcon(item.opType)}
                                        <Typography variant="body2" fontWeight={600} sx={{ flex: 1 }}>
                                            {t(getTableLocalizationKey(item.targetTable))}: {item.targetId}
                                        </Typography>
                                        <Chip
                                            label={getOpTypeLabel(item.opType)}
                                            color={getOpTypeColor(item.opType)}
                                            size="small"
                                            sx={{ fontWeight: 500 }}
                                        />
                                    </Box>

                                    {/* Ops Detail - Only show for UPDATE/CREATE, hide for DELETE */}
                                    {item.opType === 'CREATE' && item.ops.length > 0 && (
                                        <Box sx={{ p: 2 }}>
                                            <Table size="small">
                                                <TableBody>
                                                    {item.ops.map((op: FieldOp, opIndex: number) => (
                                                        <TableRow key={opIndex}>
                                                            <TableCell sx={{ fontWeight: 600, color: 'text.secondary', width: '40%', border: 'none', py: 0.5, fontSize: '0.875rem' }}>
                                                                {formatFieldName(item.targetTable, op.path)}
                                                            </TableCell>
                                                            <TableCell sx={{ color: 'success.main', border: 'none', py: 0.5 }}>
                                                                {formatValue(op.newValue)}
                                                            </TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </Box>
                                    )}

                                    {item.opType === 'UPDATE' && item.ops.length > 0 && (
                                        <Box sx={{ p: 2 }}>
                                            <Table size="small">
                                                <TableHead>
                                                    <TableRow>
                                                        <TableCell sx={{ fontWeight: 600, color: 'text.secondary', py: 1 }}>{t('changeRequest.field')}</TableCell>
                                                        <TableCell sx={{ fontWeight: 600, color: 'text.secondary', py: 1 }}>{t('changeRequest.before')}</TableCell>
                                                        <TableCell sx={{ fontWeight: 600, color: 'text.secondary', py: 1 }}>{t('changeRequest.after')}</TableCell>
                                                    </TableRow>
                                                </TableHead>
                                                <TableBody>
                                                    {item.ops.map((op: FieldOp, opIndex: number) => (
                                                        <TableRow key={opIndex}>
                                                            <TableCell sx={{ fontWeight: 600, width: '30%', py: 0.5, fontSize: '0.875rem' }}>
                                                                {formatFieldName(item.targetTable, op.path)}
                                                            </TableCell>
                                                            <TableCell sx={{
                                                                color: 'error.main',
                                                                textDecoration: 'line-through',
                                                                py: 0.5,
                                                                maxWidth: 150,
                                                                overflow: 'hidden',
                                                                textOverflow: 'ellipsis',
                                                            }}>
                                                                {formatValue(op.oldValue)}
                                                            </TableCell>
                                                            <TableCell sx={{ color: 'success.main', py: 0.5 }}>
                                                                {formatValue(op.newValue)}
                                                            </TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </Box>
                                    )}
                                </Paper>
                            ))}
                        </>
                    )}
                </Box>

                {/* Footer Action Buttons - Fixed at bottom */}
                <Divider />
                <Box sx={{ p: 2, display: 'flex', gap: 2, justifyContent: 'flex-end', bgcolor: 'background.paper' }}>
                    <Button variant="outlined" onClick={onClose}>
                        {t('common.cancel')}
                    </Button>
                    <Button
                        variant="contained"
                        color="warning"
                        startIcon={isCreating ? <CircularProgress size={16} color="inherit" /> : <UndoIcon />}
                        onClick={handleCreateRollback}
                        disabled={isCreating || isLoading || !!error}
                    >
                        {t('changeRequest.createRollbackCR')}
                    </Button>
                </Box>
            </Box>
        </ResizableDrawer>
    );
};

export default RollbackPreviewDrawer;

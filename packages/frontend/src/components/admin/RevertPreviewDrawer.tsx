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
import { useOrgProject } from '@/contexts/OrgProjectContext';
import ChangeItemDiffDisplay from './change-request/ChangeItemDiffDisplay';

interface FieldOp {
  path: string;
  oldValue: any;
  newValue: any;
  opType: 'SET' | 'DEL' | 'MOD';
}

interface RevertItem {
  targetTable: string;
  targetId: string;
  displayName?: string;
  opType: 'CREATE' | 'UPDATE' | 'DELETE';
  ops: FieldOp[];
  actionType: string;
}

interface RevertPreviewDrawerProps {
  open: boolean;
  onClose: () => void;
  changeRequestId: string | null;
  onRevertCreated?: (newCrId: string) => void;
  onRollbackCreated?: (newCrId?: string) => void;
}

const RevertPreviewDrawer: React.FC<RevertPreviewDrawerProps> = ({
  open,
  onClose,
  changeRequestId,
  onRevertCreated,
}) => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const { handleApiError } = useHandleApiError();
  const { getProjectApiPath } = useOrgProject();
  const projectApiPath = getProjectApiPath();
  const [isCreating, setIsCreating] = useState(false);

  // Fetch revert preview
  const {
    data: preview,
    error,
    isLoading,
  } = useSWR(
    open && changeRequestId
      ? `/admin/change-requests/${changeRequestId}/revert-preview`
      : null,
    () =>
      changeRequestService.getRevertPreview(changeRequestId!, projectApiPath)
  );

  const handleCreateRevert = async () => {
    if (!changeRequestId) return;

    setIsCreating(true);
    try {
      const result = await changeRequestService.revert(
        changeRequestId,
        projectApiPath
      );
      enqueueSnackbar(t('changeRequest.messages.revertCreated'), {
        variant: 'success',
      });
      onClose();
      if (onRevertCreated) {
        onRevertCreated(result.id);
      }
    } catch (err) {
      handleApiError(err);
    } finally {
      setIsCreating(false);
    }
  };

  const getOpTypeColor = (opType: string): 'success' | 'error' | 'warning' => {
    switch (opType) {
      case 'CREATE':
        return 'success';
      case 'DELETE':
        return 'error';
      default:
        return 'warning';
    }
  };

  const getOpTypeLabel = (opType: string) => {
    switch (opType) {
      case 'CREATE':
        return t('changeRequest.opCreate');
      case 'DELETE':
        return t('changeRequest.opDelete');
      default:
        return t('changeRequest.opUpdate');
    }
  };

  const getOpIcon = (opType: string) => {
    switch (opType) {
      case 'CREATE':
        return <AddIcon fontSize="small" />;
      case 'DELETE':
        return <DeleteIcon fontSize="small" />;
      default:
        return <EditIcon fontSize="small" />;
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
        clientVersion: t('clientVersions.clientVersion'),
        clientStatus: t('clientVersions.clientStatus'),
        gameServerAddress: t('clientVersions.gameServerAddress'),
        gameServerAddressForWhiteList: t(
          'clientVersions.gameServerAddressForWhiteList'
        ),
        patchAddress: t('clientVersions.patchAddress'),
        patchAddressForWhiteList: t('clientVersions.patchAddressForWhiteList'),
        guestModeAllowed: t('clientVersions.guestModeAllowed'),
        externalClickLink: t('clientVersions.externalClickLink'),
        memo: t('clientVersions.memo'),
        customPayload: t('clientVersions.customPayload'),
        maintenanceStartDate: t('clientVersions.maintenance.startDate'),
        maintenanceEndDate: t('clientVersions.maintenance.endDate'),
        maintenanceMessage: t('clientVersions.maintenance.defaultMessage'),
        maintenanceLocales: t('gameWorlds.maintenanceLocales'),
        supportsMultiLanguage: t(
          'clientVersions.maintenance.supportsMultiLanguage'
        ),
        tags: t('clientVersions.tags'),
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
      environmentId: t('common.environment'),
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
      .replace(/^./, (str) => str.toUpperCase())
      .trim();
  };

  return (
    <ResizableDrawer
      anchor="right"
      open={open}
      onClose={onClose}
      title={t('changeRequest.revertPreview')}
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
              <Paper
                sx={{
                  p: 2,
                  mb: 3,
                  bgcolor: alpha('#ff9800', 0.1),
                  border: '1px solid',
                  borderColor: 'warning.main',
                }}
              >
                <Box
                  sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}
                >
                  <UndoIcon color="warning" />
                  <Typography variant="h6">
                    {t('changeRequest.revertPreviewTitle')}
                  </Typography>
                </Box>
                <Typography variant="body2" color="text.secondary">
                  {t('changeRequest.revertPreviewDesc', {
                    title: preview.originalCr?.title,
                  })}
                </Typography>
              </Paper>

              {/* Rollback Items */}
              <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 600 }}>
                {t('changeRequest.revertChanges')} (
                {preview.revertItems?.length || 0})
              </Typography>

              {preview.revertItems?.map((item: RevertItem, index: number) => {
                // Convert RevertItem to ChangeItemData format for ChangeItemDiffDisplay
                const diffItem = {
                  table: item.targetTable,
                  targetId: item.targetId,
                  operation: item.opType.toLowerCase(),
                  changes: item.ops.map((op) => ({
                    field: op.path,
                    oldValue: op.oldValue,
                    newValue: op.newValue,
                    operation: op.opType,
                  })),
                  displayName: item.displayName,
                };

                return (
                  <Paper
                    key={index}
                    variant="outlined"
                    sx={{ mb: 2, overflow: 'hidden' }}
                  >
                    {/* Item Header */}
                    <Box
                      sx={{
                        px: 2,
                        py: 1.5,
                        bgcolor: 'action.hover',
                        borderBottom:
                          item.opType !== 'DELETE' ? '1px solid' : 'none',
                        borderColor: 'divider',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1.5,
                      }}
                    >
                      {getOpIcon(item.opType)}
                      <Typography
                        variant="body2"
                        fontWeight={600}
                        sx={{ flex: 1 }}
                      >
                        {t(getTableLocalizationKey(item.targetTable))}:{' '}
                        {item.displayName || item.targetId}
                      </Typography>
                      <Chip
                        label={getOpTypeLabel(item.opType)}
                        color={getOpTypeColor(item.opType)}
                        size="small"
                        sx={{ fontWeight: 500 }}
                      />
                    </Box>

                    {/* Ops Detail - Reuse ChangeItemDiffDisplay for structured rendering */}
                    {item.opType !== 'DELETE' && item.ops.length > 0 && (
                      <Box sx={{ px: 2, py: 1 }}>
                        <ChangeItemDiffDisplay
                          item={diffItem}
                          formatFieldName={formatFieldName}
                          formatValue={formatValue}
                        />
                      </Box>
                    )}
                  </Paper>
                );
              })}
            </>
          )}
        </Box>

        {/* Footer Action Buttons - Fixed at bottom */}
        <Divider />
        <Box
          sx={{
            p: 2,
            display: 'flex',
            gap: 2,
            justifyContent: 'flex-end',
            bgcolor: 'background.paper',
          }}
        >
          <Button onClick={onClose}>{t('common.cancel')}</Button>
          <Button
            variant="contained"
            color="warning"
            startIcon={
              isCreating ? (
                <CircularProgress size={16} color="inherit" />
              ) : (
                <UndoIcon />
              )
            }
            onClick={handleCreateRevert}
            disabled={isCreating || isLoading || !!error}
          >
            {t('changeRequest.createRevertCR')}
          </Button>
        </Box>
      </Box>
    </ResizableDrawer>
  );
};

export default RevertPreviewDrawer;

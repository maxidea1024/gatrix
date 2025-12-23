import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { PERMISSIONS } from '@/types/permissions';
import {
  Box,
  Button,
  Card,
  CardContent,
  IconButton,
  LinearProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
  Chip,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Lock as LockIcon,
  ContentCopy as CopyIcon,
  FileCopy as DuplicateIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import { varsService, VarItem } from '@/services/varsService';
import EmptyTableRow from '@/components/common/EmptyTableRow';
import { formatDateTimeDetailed } from '@/utils/dateFormat';
import ConfirmDeleteDialog from '@/components/common/ConfirmDeleteDialog';
import KeyValueFormDrawer from '@/components/settings/KeyValueFormDrawer';

import { useEnvironment } from '@/contexts/EnvironmentContext';

const KeyValuePage: React.FC = () => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const { hasPermission } = useAuth();
  const { currentEnvironmentId } = useEnvironment();
  const canManage = hasPermission([PERMISSIONS.SYSTEM_SETTINGS_MANAGE]);

  const [items, setItems] = useState<VarItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<VarItem | null>(null);
  const [isDuplicateMode, setIsDuplicateMode] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; item: VarItem | null }>({
    open: false,
    item: null,
  });

  // Load KV items
  const loadItems = async () => {
    setLoading(true);
    try {
      const data = await varsService.getAllKV();
      setItems(data);
    } catch (error: any) {
      enqueueSnackbar(error.message || t('settings.kv.loadFailed'), { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadItems();
  }, [currentEnvironmentId]);

  // Handle create
  const handleCreate = () => {
    setEditingItem(null);
    setIsDuplicateMode(false);
    setDrawerOpen(true);
  };

  // Handle edit
  const handleEdit = (item: VarItem) => {
    setEditingItem(item);
    setIsDuplicateMode(false);
    setDrawerOpen(true);
  };

  // Handle duplicate
  const handleDuplicate = (item: VarItem) => {
    // Check if item is copyable
    if (!item.isCopyable) {
      enqueueSnackbar(t('common.cannotCopySystemItem'), { variant: 'warning' });
      return;
    }

    // Create a copy with _copy suffix
    const baseKey = item.varKey.replace(/^(kv:|$)/, '');
    const newKey = `${baseKey}_copy`;

    // Create a new item with copied data (without id to trigger create mode)
    const duplicatedItem: Partial<VarItem> = {
      ...item,
      varKey: `kv:${newKey}`,
      isSystemDefined: false, // Duplicated items are never system-defined
      isCopyable: true, // Duplicated items are always copyable
    };

    // Remove id to ensure it's treated as a new item
    delete duplicatedItem.id;

    setEditingItem(duplicatedItem as VarItem);
    setIsDuplicateMode(true);
    setDrawerOpen(true);
  };

  // Handle copy key name
  const handleCopyKeyName = (keyName: string) => {
    navigator.clipboard.writeText(keyName);
    enqueueSnackbar(t('common.copiedToClipboard'), { variant: 'success' });
  };

  // Get chip color based on type
  const getTypeChipColor = (type: string): 'default' | 'primary' | 'secondary' | 'success' | 'error' | 'info' | 'warning' => {
    switch (type) {
      case 'string':
        return 'primary';
      case 'number':
        return 'info';
      case 'boolean':
        return 'success';
      case 'color':
        return 'secondary';
      case 'array':
        return 'warning';
      case 'object':
        return 'error';
      default:
        return 'default';
    }
  };

  // Format type display
  const formatTypeDisplay = (item: VarItem): string => {
    if (item.valueType === 'array') {
      const elementType = item.description?.match(/\[elementType:(\w+)\]/)?.[1] || 'unknown';
      return `${elementType}[]`;
    }
    return item.valueType;
  };

  // Handle delete
  const handleDeleteClick = (item: VarItem) => {
    setDeleteConfirm({ open: true, item });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirm.item) return;

    const keyName = deleteConfirm.item.varKey.replace('kv:', '');
    try {
      await varsService.deleteKV(keyName);
      enqueueSnackbar(t('settings.kv.deleteSuccess', { key: keyName }), { variant: 'success' });
      setDeleteConfirm({ open: false, item: null });
      loadItems();
    } catch (error: any) {
      enqueueSnackbar(error.message || t('settings.kv.deleteFailed'), { variant: 'error' });
    }
  };

  // Render value display in table
  const renderValueDisplay = (item: VarItem) => {
    switch (item.valueType) {
      case 'boolean':
        return (
          <Chip
            label={item.varValue}
            size="small"
            color={item.varValue === 'true' ? 'success' : 'default'}
          />
        );
      case 'color':
        return (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box
              sx={{
                width: 24,
                height: 24,
                borderRadius: 1,
                bgcolor: item.varValue,
                border: 1,
                borderColor: 'divider',
              }}
            />
            <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
              {item.varValue}
            </Typography>
          </Box>
        );
      case 'object':
      case 'array':
        return (
          <Typography
            variant="body2"
            sx={{
              fontFamily: 'monospace',
              maxWidth: 300,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {item.varValue}
          </Typography>
        );
      case 'string':
        return (
          <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
            "{item.varValue}"
          </Typography>
        );
      default:
        return <Typography variant="body2">{item.varValue}</Typography>;
    }
  };

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="body2" color="text.secondary">
          {t('settings.kv.subtitle')}
        </Typography>
        {canManage && (
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleCreate}
          >
            {t('settings.kv.create')}
          </Button>
        )}
      </Box>

      {/* Table */}
      <Card>
        <CardContent sx={{ p: 0 }}>
          {loading && <LinearProgress />}
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>{t('settings.kv.key')}</TableCell>
                  <TableCell>{t('settings.kv.type')}</TableCell>
                  <TableCell>{t('settings.kv.value')}</TableCell>
                  <TableCell>{t('settings.kv.description')}</TableCell>
                  <TableCell>{t('common.updatedAt')}</TableCell>
                  {canManage && <TableCell align="center">{t('common.actions')}</TableCell>}
                </TableRow>
              </TableHead>
              <TableBody>
                {items.length === 0 ? (
                  <EmptyTableRow
                    colSpan={canManage ? 6 : 5}
                    message={t('settings.kv.noItems')}
                    loading={loading}
                    subtitle={canManage ? t('common.addFirstItem') : undefined}
                    onAddClick={canManage ? handleCreate : undefined}
                    addButtonLabel={t('settings.kv.create')}
                  />
                ) : (
                  items.map((item) => (
                    <TableRow key={item.varKey} hover>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography
                            variant="body2"
                            sx={{
                              fontFamily: 'monospace',
                              cursor: 'pointer',
                              '&:hover': {
                                textDecoration: 'underline',
                                color: 'primary.main',
                              },
                            }}
                            onClick={() => handleEdit(item)}
                          >
                            {item.varKey.replace('kv:', '')}
                          </Typography>
                          <Tooltip title={t('common.copy')}>
                            <IconButton
                              size="small"
                              onClick={() => handleCopyKeyName(item.varKey.replace('kv:', ''))}
                              sx={{ p: 0.5 }}
                            >
                              <CopyIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          {item.isSystemDefined && (
                            <Tooltip title={t('settings.kv.systemDefined')}>
                              <LockIcon fontSize="small" color="action" />
                            </Tooltip>
                          )}
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={formatTypeDisplay(item)}
                          size="small"
                          color={getTypeChipColor(item.valueType)}
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell>{renderValueDisplay(item)}</TableCell>
                      <TableCell>
                        <Tooltip title={item.description?.replace(/\[elementType:\w+\]\s*/, '') || '-'}>
                          <Typography
                            variant="body2"
                            color="text.secondary"
                            sx={{
                              maxWidth: '300px',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {item.description?.replace(/\[elementType:\w+\]\s*/, '') || '-'}
                          </Typography>
                        </Tooltip>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {formatDateTimeDetailed(item.updatedAt)}
                        </Typography>
                      </TableCell>
                      {canManage && (
                        <TableCell align="center">
                          <Tooltip title={t('common.edit')}>
                            <IconButton size="small" onClick={() => handleEdit(item)}>
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title={!item.isCopyable ? t('settings.kv.cannotCopy') : t('common.duplicate')}>
                            <span>
                              <IconButton
                                size="small"
                                onClick={() => handleDuplicate(item)}
                                disabled={!item.isCopyable}
                              >
                                <DuplicateIcon fontSize="small" />
                              </IconButton>
                            </span>
                          </Tooltip>
                          <Tooltip title={item.isSystemDefined ? t('settings.kv.systemDefined') : t('common.delete')}>
                            <span>
                              <IconButton
                                size="small"
                                onClick={() => handleDeleteClick(item)}
                                disabled={item.isSystemDefined}
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </span>
                          </Tooltip>
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {/* Form Drawer */}
      <KeyValueFormDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onSuccess={loadItems}
        item={editingItem}
        isDuplicate={isDuplicateMode}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmDeleteDialog
        open={deleteConfirm.open}
        onClose={() => setDeleteConfirm({ open: false, item: null })}
        onConfirm={handleDeleteConfirm}
        title={t('settings.kv.deleteConfirmTitle')}
        message={t('settings.kv.deleteConfirmMessage', { key: deleteConfirm.item?.varKey.replace('kv:', '') || '' })}
      />
    </Box>
  );
};

export default KeyValuePage;


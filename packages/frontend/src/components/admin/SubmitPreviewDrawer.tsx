import React, { useState, useMemo, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Chip,
  Button,
  Checkbox,
  TextField,
  CircularProgress,
  Alert,
  Divider,
  FormControlLabel,
  Collapse,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import {
  Send as SendIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  ExpandMore as ExpandMoreIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import { useHandleApiError } from '@/hooks/useHandleApiError';
import ResizableDrawer from '@/components/common/ResizableDrawer';
import changeRequestService, {
  ChangeRequest,
  ActionGroup,
  ChangeItem,
} from '@/services/changeRequestService';
import { formatChangeRequestTitle, getTableLocalizationKey } from '@/utils/changeRequestFormatter';

interface SubmitPreviewDrawerProps {
  open: boolean;
  onClose: () => void;
  changeRequest: ChangeRequest | null;
  onSubmitted?: () => void;
}

interface FieldOp {
  path: string;
  oldValue: any;
  newValue: any;
  opType: 'SET' | 'DEL' | 'MOD';
}

const SubmitPreviewDrawer: React.FC<SubmitPreviewDrawerProps> = ({
  open,
  onClose,
  changeRequest,
  onSubmitted,
}) => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const { handleApiError } = useHandleApiError();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [title, setTitle] = useState('');
  const [reason, setReason] = useState('');

  // Track checked state for action groups and items
  const [checkedGroups, setCheckedGroups] = useState<Record<string, boolean>>({});
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  // Initialize checked state when CR changes
  useEffect(() => {
    if (changeRequest) {
      const groupsState: Record<string, boolean> = {};
      const itemsState: Record<string, boolean> = {};
      const expandedState: Record<string, boolean> = {};

      changeRequest.actionGroups?.forEach((group) => {
        groupsState[group.id] = true;
        expandedState[group.id] = true;
        group.changeItems?.forEach((item) => {
          itemsState[item.id] = true;
        });
      });

      // Also handle items without action groups
      changeRequest.changeItems?.forEach((item) => {
        if (!item.actionGroupId) {
          itemsState[item.id] = true;
        }
      });

      setCheckedGroups(groupsState);
      setCheckedItems(itemsState);
      setExpandedGroups(expandedState);
      setTitle(changeRequest.title || '');
      setReason('');
    }
  }, [changeRequest, open]);

  const handleGroupCheck = (groupId: string, checked: boolean) => {
    setCheckedGroups((prev) => ({ ...prev, [groupId]: checked }));

    // Also check/uncheck all items in this group
    const group = changeRequest?.actionGroups?.find((g) => g.id === groupId);
    if (group?.changeItems) {
      const updates: Record<string, boolean> = {};
      group.changeItems.forEach((item) => {
        updates[item.id] = checked;
      });
      setCheckedItems((prev) => ({ ...prev, ...updates }));
    }
  };

  const handleItemCheck = (itemId: string, groupId: string | undefined, checked: boolean) => {
    setCheckedItems((prev) => ({ ...prev, [itemId]: checked }));

    // Update group check state based on its items
    if (groupId) {
      const group = changeRequest?.actionGroups?.find((g) => g.id === groupId);
      if (group?.changeItems) {
        const newItemsState = { ...checkedItems, [itemId]: checked };
        const allChecked = group.changeItems.every((item) => newItemsState[item.id]);
        const someChecked = group.changeItems.some((item) => newItemsState[item.id]);
        setCheckedGroups((prev) => ({ ...prev, [groupId]: allChecked }));
      }
    }
  };

  const toggleGroupExpand = (groupId: string) => {
    setExpandedGroups((prev) => ({ ...prev, [groupId]: !prev[groupId] }));
  };

  // Count selected items
  const selectedCount = useMemo(() => {
    return Object.values(checkedItems).filter(Boolean).length;
  }, [checkedItems]);

  const totalCount = useMemo(() => {
    return Object.keys(checkedItems).length;
  }, [checkedItems]);

  const handleSubmit = async () => {
    if (!changeRequest) return;
    if (!title.trim()) {
      enqueueSnackbar(t('changeRequest.errors.titleRequired'), {
        variant: 'warning',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      // First, delete unchecked items
      const itemsToDelete = Object.entries(checkedItems)
        .filter(([_, checked]) => !checked)
        .map(([id]) => id);

      for (const itemId of itemsToDelete) {
        await changeRequestService.deleteChangeItem(changeRequest.id, itemId);
      }

      // Then submit
      await changeRequestService.submit(changeRequest.id, {
        title: title.trim(),
        reason: reason.trim() || undefined,
      });

      enqueueSnackbar(t('changeRequest.messages.submitted'), {
        variant: 'success',
      });
      onClose();
      onSubmitted?.();
    } catch (err) {
      handleApiError(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getOpTypeIcon = (opType: string) => {
    switch (opType) {
      case 'CREATE':
        return <AddIcon fontSize="small" sx={{ color: 'success.main' }} />;
      case 'DELETE':
        return <DeleteIcon fontSize="small" sx={{ color: 'error.main' }} />;
      default:
        return <EditIcon fontSize="small" sx={{ color: 'warning.main' }} />;
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

  const formatValue = (value: any): string => {
    if (value === null || value === undefined) return '—';
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  };

  if (!changeRequest) return null;

  return (
    <ResizableDrawer
      anchor="right"
      open={open}
      onClose={onClose}
      title={t('changeRequest.submitPreview')}
      defaultWidth={650}
      minWidth={500}
    >
      <Box sx={{ p: 3, display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* Header */}
        <Paper sx={{ p: 2, mb: 3, bgcolor: alpha('#2196f3', 0.1) }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <SendIcon color="primary" />
            <Typography variant="h6">{t('changeRequest.submitPreviewTitle')}</Typography>
          </Box>
          <Typography variant="body2" color="text.secondary">
            {t('changeRequest.submitPreviewDesc')}
          </Typography>
        </Paper>

        {/* Title & Reason */}
        <Box sx={{ mb: 3 }}>
          <TextField
            fullWidth
            label={t('changeRequest.submitDialog.titleField')}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            sx={{ mb: 2 }}
          />
          <TextField
            fullWidth
            multiline
            rows={2}
            label={t('changeRequest.submitDialog.reason')}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            helperText={t('changeRequest.submitDialog.reasonOptional')}
          />
        </Box>

        <Divider sx={{ mb: 2 }} />

        {/* Changes Summary */}
        <Typography variant="subtitle2" sx={{ mb: 2 }}>
          {t('changeRequest.selectChanges')} ({selectedCount}/{totalCount})
        </Typography>

        {/* Action Groups */}
        <Box sx={{ flex: 1, overflow: 'auto', mb: 3 }}>
          {changeRequest.actionGroups?.map((group) => (
            <Paper key={group.id} variant="outlined" sx={{ mb: 2, overflow: 'hidden' }}>
              {/* Group Header */}
              <Box
                sx={{
                  px: 2,
                  py: 1,
                  bgcolor: 'action.hover',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  cursor: 'pointer',
                }}
                onClick={() => toggleGroupExpand(group.id)}
              >
                <Checkbox
                  checked={checkedGroups[group.id] ?? true}
                  indeterminate={
                    group.changeItems?.some((item) => checkedItems[item.id]) &&
                    !group.changeItems?.every((item) => checkedItems[item.id])
                  }
                  onChange={(e) => {
                    e.stopPropagation();
                    handleGroupCheck(group.id, e.target.checked);
                  }}
                  onClick={(e) => e.stopPropagation()}
                  size="small"
                />
                <ExpandMoreIcon
                  sx={{
                    transform: expandedGroups[group.id] ? 'rotate(0deg)' : 'rotate(-90deg)',
                    transition: 'transform 0.2s',
                    fontSize: 20,
                  }}
                />
                <Typography variant="body2" fontWeight={600} sx={{ flex: 1 }}>
                  {formatChangeRequestTitle(group.title, t)}
                </Typography>
                <Chip
                  label={`${group.changeItems?.filter((item) => checkedItems[item.id]).length || 0}/${group.changeItems?.length || 0}`}
                  size="small"
                  variant="outlined"
                />
              </Box>

              {/* Group Items */}
              <Collapse in={expandedGroups[group.id]}>
                <Box sx={{ p: 1 }}>
                  {group.changeItems?.map((item) => (
                    <Box
                      key={item.id}
                      sx={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 1,
                        p: 1,
                        borderRadius: 1,
                        bgcolor: checkedItems[item.id] ? 'transparent' : alpha('#f44336', 0.05),
                        opacity: checkedItems[item.id] ? 1 : 0.6,
                        '&:hover': { bgcolor: 'action.hover' },
                      }}
                    >
                      <Checkbox
                        checked={checkedItems[item.id] ?? true}
                        onChange={(e) => handleItemCheck(item.id, group.id, e.target.checked)}
                        size="small"
                      />
                      <Box sx={{ flex: 1 }}>
                        <Box
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1,
                            mb: 0.5,
                          }}
                        >
                          {getOpTypeIcon((item as any).opType || 'UPDATE')}
                          <Typography variant="body2" fontWeight={500}>
                            {t(getTableLocalizationKey(item.targetTable))}: {item.targetId}
                          </Typography>
                          <Chip
                            label={getOpTypeLabel((item as any).opType || 'UPDATE')}
                            size="small"
                            sx={{ height: 20, fontSize: 11 }}
                          />
                        </Box>
                        {/* Show ops count for UPDATE */}
                        {(item as any).opType === 'UPDATE' && (item as any).ops?.length > 0 && (
                          <Typography variant="caption" color="text.secondary">
                            {(item as any).ops.length} {t('changeRequest.fieldChanges')}
                          </Typography>
                        )}
                      </Box>
                    </Box>
                  ))}
                </Box>
              </Collapse>
            </Paper>
          ))}

          {/* Items without action groups */}
          {changeRequest.changeItems
            ?.filter((item) => !item.actionGroupId)
            .map((item) => (
              <Paper key={item.id} variant="outlined" sx={{ mb: 1, p: 1.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Checkbox
                    checked={checkedItems[item.id] ?? true}
                    onChange={(e) => handleItemCheck(item.id, undefined, e.target.checked)}
                    size="small"
                  />
                  {getOpTypeIcon((item as any).opType || 'UPDATE')}
                  <Typography variant="body2">
                    {t(getTableLocalizationKey(item.targetTable))}: {item.targetId}
                  </Typography>
                </Box>
              </Paper>
            ))}
        </Box>

        {/* Warning if some items are unchecked */}
        {selectedCount < totalCount && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            {t('changeRequest.submitExcludeWarning', {
              count: totalCount - selectedCount,
            })}
          </Alert>
        )}

        {/* Action Buttons */}
        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
          <Button variant="outlined" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="contained"
            color="primary"
            startIcon={isSubmitting ? <CircularProgress size={16} /> : <SendIcon />}
            onClick={handleSubmit}
            disabled={isSubmitting || selectedCount === 0}
          >
            {t('changeRequest.actions.submit')}
          </Button>
        </Box>
      </Box>
    </ResizableDrawer>
  );
};

export default SubmitPreviewDrawer;

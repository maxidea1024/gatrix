import React, { useState, useEffect, useMemo } from 'react';
import {
  AppBar,
  Toolbar,
  Button,
  TextField,
  Box,
  Typography,
  IconButton,
  Chip,
  Paper,
  Stack,
  Collapse,
  OutlinedInput,
  Autocomplete,
  Tooltip,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Close as CloseIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
} from '@mui/icons-material';
import ResizableDrawer from '../common/ResizableDrawer';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import { useNavigate } from 'react-router-dom';
import { showChangeRequestCreatedToast } from '../../utils/changeRequestToast';
import { getActionLabel } from '../../utils/changeRequestToast';
import { useEnvironment } from '../../contexts/EnvironmentContext';
import { parseApiErrorMessage } from '../../utils/errorUtils';
import rewardTemplateService, { RewardTemplate, ParticipationReward } from '../../services/rewardTemplateService';
import RewardItemSelector, { RewardSelection } from './RewardItemSelector';
import { tagService, Tag } from '../../services/tagService';
import { getContrastColor } from '@/utils/colorUtils';

interface RewardTemplateFormDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: () => void;
  template?: RewardTemplate | null;
}

const RewardTemplateFormDialog: React.FC<RewardTemplateFormDialogProps> = ({
  open,
  onClose,
  onSave,
  template,
}) => {
  const { t } = useTranslation();
  const { enqueueSnackbar, closeSnackbar } = useSnackbar();
  const navigate = useNavigate();
  const { currentEnvironment } = useEnvironment();
  const requiresApproval = currentEnvironment?.requiresApproval ?? false;

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [rewardItems, setRewardItems] = useState<ParticipationReward[]>([]);
  const [selectedTags, setSelectedTags] = useState<Tag[]>([]);
  const [availableTags, setAvailableTags] = useState<Tag[]>([]);
  const [rewardsExpanded, setRewardsExpanded] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadingTags, setLoadingTags] = useState(false);
  const [isCopy, setIsCopy] = useState(false);
  // Track if description was manually edited by user
  const [isDescriptionManuallyEdited, setIsDescriptionManuallyEdited] = useState(false);
  const nameInputRef = React.useRef<HTMLInputElement>(null);

  // Load available tags
  useEffect(() => {
    const loadTags = async () => {
      try {
        setLoadingTags(true);
        const tags = await tagService.list();
        setAvailableTags(tags);
      } catch (error) {
        console.error('Failed to load tags:', error);
      } finally {
        setLoadingTags(false);
      }
    };

    if (open) {
      loadTags();
    }
  }, [open]);

  // Initialize form
  useEffect(() => {
    if (template) {
      // Check if this is a copy operation (template has no ID)
      const isCopyOperation = !template.id;
      setIsCopy(isCopyOperation);

      setName(template.name);
      setDescription(template.description || '');

      // Deep copy rewardItems to avoid reference sharing
      const rewardItemsCopy = template.rewardItems && Array.isArray(template.rewardItems)
        ? template.rewardItems.map(item => {
          if (typeof item === 'object' && item !== null) {
            return { ...item };
          }
          return item;
        })
        : [];
      setRewardItems(rewardItemsCopy);

      // Convert tags to Tag objects - deep copy to avoid reference sharing
      if (template.tags && Array.isArray(template.tags)) {
        const selectedTagObjects = availableTags
          .filter(tag =>
            template.tags?.some(t => {
              // Handle both Tag objects and string tags
              if (typeof t === 'object' && t !== null && 'id' in t) {
                return t.id === tag.id;
              }
              return false;
            })
          )
          .map(tag => {
            // Deep copy each tag to avoid reference sharing
            if (typeof tag === 'object' && tag !== null) {
              return { ...tag };
            }
            return tag;
          });
        console.log('[RewardTemplateFormDialog] Form initialized with template:', {
          templateId: template.id,
          templateName: template.name,
          templateTagIds: template.tags?.map((t: any) => t.id) || [],
          selectedTagIds: selectedTagObjects.map(t => t.id),
          availableTagCount: availableTags.length,
        });
        setSelectedTags(selectedTagObjects);
      } else {
        console.log('[RewardTemplateFormDialog] Form initialized with template (no tags):', {
          templateId: template.id,
          templateName: template.name,
        });
        setSelectedTags([]);
      }
    } else {
      setName('');
      setDescription('');
      setRewardItems([]);
      setSelectedTags([]);
      setIsCopy(false);
      setIsDescriptionManuallyEdited(false);
    }

    // When editing or copying, mark description as manually edited (since it already has a value)
    if (template && template.id) {
      setIsDescriptionManuallyEdited(true);
    } else if (template && !template.id) {
      // Copy operation - mark as manually edited since it has a value
      setIsDescriptionManuallyEdited(true);
    }

    // Focus on name input when drawer opens
    if (open) {
      setTimeout(() => {
        nameInputRef.current?.focus();
      }, 100);
    }
  }, [template, open, availableTags]);

  // Check if form is dirty (data changed)
  const isDirty = useMemo(() => {
    if (!template) return true;

    // We only check for changes if template has an ID (edit mode)
    if (!template.id) return true; // New or Copy mode

    const currentData = {
      name: name.trim(),
      description: description.trim() || null,
      rewardItems: rewardItems.map(item => ({
        rewardType: item.rewardType,
        itemId: item.itemId,
        quantity: item.quantity,
      })),
      tagIds: selectedTags.map(tag => tag.id).sort((a, b) => a - b),
    };

    const originalData = {
      name: template.name.trim(),
      description: template.description?.trim() || null,
      rewardItems: (template.rewardItems || []).map(item => ({
        rewardType: item.rewardType,
        itemId: item.itemId,
        quantity: item.quantity,
      })),
      tagIds: (template.tags || []).map((tag: any) => tag.id).sort((a: number, b: number) => a - b),
    };

    return JSON.stringify(currentData) !== JSON.stringify(originalData);
  }, [template, name, description, rewardItems, selectedTags]);

  // Handlers
  const handleAddReward = () => {
    setRewardItems([
      ...rewardItems,
      { rewardType: '', itemId: '', quantity: 1 },
    ]);
  };

  const handleRemoveReward = (index: number) => {
    setRewardItems(rewardItems.filter((_, i) => i !== index));
  };

  const handleRewardChange = (index: number, reward: RewardSelection) => {
    const updated = [...rewardItems];
    updated[index] = reward;
    setRewardItems(updated);
  };

  const handleSave = async () => {
    // Validation
    if (!name.trim()) {
      enqueueSnackbar(t('rewardTemplates.nameRequired'), { variant: 'error' });
      return;
    }

    if (rewardItems.length === 0) {
      enqueueSnackbar(t('rewardTemplates.atLeastOneReward'), { variant: 'error' });
      return;
    }

    // Validate each reward
    for (let i = 0; i < rewardItems.length; i++) {
      const reward = rewardItems[i];
      if (!reward.rewardType) {
        enqueueSnackbar(t('rewardTemplates.rewardTypeRequired', { index: i + 1 }), { variant: 'error' });
        return;
      }
      if (!reward.itemId) {
        enqueueSnackbar(t('rewardTemplates.rewardItemRequired', { index: i + 1 }), { variant: 'error' });
        return;
      }
      if (!reward.quantity || reward.quantity < 1) {
        enqueueSnackbar(t('rewardTemplates.rewardQuantityRequired', { index: i + 1 }), { variant: 'error' });
        return;
      }
    }

    setSaving(true);
    try {
      const tagIds = selectedTags.map(tag => tag.id);
      console.log('[RewardTemplateFormDialog] Saving template:', {
        templateId: template?.id || 'NEW',
        templateName: name.trim(),
        tagIds,
        selectedTagCount: selectedTags.length,
      });
      if (template && template.id) {
        // Update existing template
        const updatePayload = {
          name: name.trim(),
          description: description.trim() || undefined,
          rewardItems,
          tagIds,
        };
        console.log('[RewardTemplateFormDialog] Sending update request:', {
          templateId: template.id,
          payload: updatePayload,
        });
        const result = await rewardTemplateService.updateRewardTemplate(template.id, updatePayload);
        console.log('[RewardTemplateFormDialog] Template updated successfully:', {
          templateId: template.id,
          tagIds,
          resultTags: result.data?.tags?.map((t: any) => ({ id: t.id, name: t.name })) || [],
        });
        if (result.isChangeRequest) {
          showChangeRequestCreatedToast(enqueueSnackbar, closeSnackbar, navigate);
        } else {
          enqueueSnackbar(t('rewardTemplates.updateSuccess'), { variant: 'success' });
        }
      } else {
        // Create new template (including copied templates)
        const result = await rewardTemplateService.createRewardTemplate({
          name: name.trim(),
          description: description.trim() || undefined,
          rewardItems,
          tagIds,
        });
        if (result.isChangeRequest) {
          showChangeRequestCreatedToast(enqueueSnackbar, closeSnackbar, navigate);
        } else {
          // Check if this is a copy operation (name contains " (Copy)" or localized equivalent)
          const isCopy = name.includes(`(${t('common.copy')})`);
          const message = isCopy ? t('rewardTemplates.copySuccess') : t('rewardTemplates.createSuccess');
          enqueueSnackbar(message, { variant: 'success' });
        }
      }
      onSave();
    } catch (error: any) {
      console.error('[RewardTemplateFormDialog] Error saving template:', error);
      const fallbackKey = requiresApproval ? 'rewardTemplates.requestSaveFailed' : 'common.saveFailed';
      enqueueSnackbar(parseApiErrorMessage(error, fallbackKey), { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <ResizableDrawer
      open={open}
      onClose={onClose}
      title={
        isCopy
          ? t('rewardTemplates.copyTemplate')
          : template
            ? t('rewardTemplates.editTemplate')
            : t('rewardTemplates.createTemplate')
      }
      subtitle={
        isCopy
          ? t('rewardTemplates.formSubtitle')
          : t('rewardTemplates.formSubtitle')
      }
      storageKey="rewardTemplateFormDrawerWidth"
      defaultWidth={800}
      minWidth={600}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* Content */}
        <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
          <Stack spacing={2}>
            {/* Name */}
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                {t('rewardTemplates.name')}
                <span style={{ color: '#d32f2f', marginLeft: '4px' }}>*</span>
              </Typography>
              <TextField
                inputRef={nameInputRef}
                value={name}
                onChange={(e) => {
                  const newName = e.target.value;
                  setName(newName);
                  // Auto-fill description if it hasn't been manually edited
                  if (!isDescriptionManuallyEdited) {
                    setDescription(newName);
                  }
                }}
                fullWidth
                size="small"
                placeholder={t('rewardTemplates.nameHelp')}
              />
            </Box>

            {/* Description */}
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>{t('rewardTemplates.description')}</Typography>
              <TextField
                value={description}
                onChange={(e) => {
                  setDescription(e.target.value);
                  // Mark description as manually edited when user types
                  setIsDescriptionManuallyEdited(true);
                }}
                fullWidth
                multiline
                rows={3}
                size="small"
                placeholder={t('rewardTemplates.descriptionHelp')}
              />
            </Box>

            {/* Tags */}
            <Box>
              <Autocomplete
                multiple
                options={availableTags.filter(tag => typeof tag !== 'string')}
                getOptionLabel={(option) => option.name}
                filterSelectedOptions
                isOptionEqualToValue={(option, value) => option.id === value.id}
                value={selectedTags}
                onChange={(_, value) => setSelectedTags(value)}
                loading={loadingTags}
                renderTags={(value, getTagProps) =>
                  value.map((option, index) => {
                    const { key, ...chipProps } = getTagProps({ index });
                    return (
                      <Tooltip key={option.id} title={option.description || t('tags.noDescription')} arrow>
                        <Chip
                          variant="outlined"
                          label={option.name}
                          size="small"
                          sx={{ bgcolor: option.color, color: getContrastColor(option.color) }}
                          {...chipProps}
                        />
                      </Tooltip>
                    );
                  })
                }
                renderInput={(params) => (
                  <TextField {...params} label={t('rewardTemplates.tags')} />
                )}
              />
            </Box>

            {/* Reward Items */}
            <Box>
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  mb: 1,
                  p: 1,
                  backgroundColor: 'action.hover',
                  borderRadius: 1,
                  cursor: 'pointer',
                }}
                onClick={() => setRewardsExpanded(!rewardsExpanded)}
              >
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                  {t('rewardTemplates.rewardItems')}
                  <span style={{ color: '#d32f2f', marginLeft: '4px' }}>*</span>
                </Typography>
                <IconButton size="small" sx={{ pointerEvents: 'none' }}>
                  {rewardsExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                </IconButton>
              </Box>
              <Collapse in={rewardsExpanded}>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
                  {t('rewardTemplates.rewardItemsHelp')}
                </Typography>
                <Stack spacing={2}>
                  {rewardItems.map((reward, index) => (
                    <Box key={index} sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                      <Box sx={{ flex: 1 }}>
                        <RewardItemSelector
                          value={{
                            rewardType: reward.rewardType,
                            itemId: reward.itemId,
                            quantity: reward.quantity,
                          }}
                          onChange={(value) => handleRewardChange(index, value)}
                        />
                      </Box>
                      <IconButton
                        size="small"
                        onClick={() => handleRemoveReward(index)}
                        color="error"
                        sx={{ mt: 0.5 }}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  ))}
                  <Button
                    size="small"
                    startIcon={<AddIcon />}
                    onClick={handleAddReward}
                    variant="outlined"
                  >
                    {t('rewardTemplates.addReward')}
                  </Button>
                </Stack>
              </Collapse>
            </Box>
          </Stack>
        </Box>

        {/* Footer */}
        <Box sx={{ p: 2, borderTop: '1px solid', borderColor: 'divider', display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
          <Button onClick={onClose} disabled={saving}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={saving || (!!template?.id && !isDirty)}
          >
            {saving ? t('common.saving') : getActionLabel(template ? 'update' : 'create', requiresApproval, t)}
          </Button>
        </Box>
      </Box>
    </ResizableDrawer>
  );
};

export default RewardTemplateFormDialog;


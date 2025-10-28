import React, { useState, useEffect } from 'react';
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
import rewardTemplateService, { RewardTemplate, ParticipationReward } from '../../services/rewardTemplateService';
import RewardItemSelector, { RewardSelection } from './RewardItemSelector';

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
  const { enqueueSnackbar } = useSnackbar();

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [rewardItems, setRewardItems] = useState<ParticipationReward[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [rewardsExpanded, setRewardsExpanded] = useState(true);
  const [saving, setSaving] = useState(false);

  // Initialize form
  useEffect(() => {
    if (template) {
      setName(template.name);
      setDescription(template.description || '');
      setRewardItems(template.rewardItems || []);
      setTags(template.tags || []);
    } else {
      setName('');
      setDescription('');
      setRewardItems([]);
      setTags([]);
    }
    setTagInput('');
  }, [template, open]);

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

  const handleAddTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (tag: string) => {
    setTags(tags.filter(t => t !== tag));
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
      if (template) {
        await rewardTemplateService.updateRewardTemplate(template.id, {
          name: name.trim(),
          description: description.trim() || undefined,
          rewardItems,
          tags,
        });
        enqueueSnackbar(t('rewardTemplates.updateSuccess'), { variant: 'success' });
      } else {
        await rewardTemplateService.createRewardTemplate({
          name: name.trim(),
          description: description.trim() || undefined,
          rewardItems,
          tags,
        });
        enqueueSnackbar(t('rewardTemplates.createSuccess'), { variant: 'success' });
      }
      onSave();
    } catch (error: any) {
      enqueueSnackbar(error.message || t('common.saveFailed'), { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <ResizableDrawer
      open={open}
      onClose={onClose}
      title={template ? t('rewardTemplates.editTemplate') : t('rewardTemplates.createTemplate')}
      subtitle={t('rewardTemplates.formSubtitle')}
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
              <Typography variant="subtitle2" sx={{ mb: 1 }}>{t('rewardTemplates.name')}</Typography>
              <TextField
                value={name}
                onChange={(e) => setName(e.target.value)}
                fullWidth
                size="small"
                placeholder={t('rewardTemplates.nameHelp')}
                helperText={t('rewardTemplates.nameHelp')}
              />
            </Box>

            {/* Description */}
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>{t('rewardTemplates.description')}</Typography>
              <TextField
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                fullWidth
                multiline
                rows={3}
                size="small"
                placeholder={t('rewardTemplates.descriptionHelp')}
                helperText={t('rewardTemplates.descriptionHelp')}
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

            {/* Tags */}
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>{t('rewardTemplates.tags')}</Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                {t('rewardTemplates.tagsHelp')}
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
                <OutlinedInput
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddTag();
                    }
                  }}
                  placeholder={t('rewardTemplates.addTag')}
                  size="small"
                  sx={{ flex: 1 }}
                />
                <Button
                  variant="outlined"
                  onClick={handleAddTag}
                  sx={{ whiteSpace: 'nowrap' }}
                >
                  {t('rewardTemplates.addTag')}
                </Button>
              </Box>
              {tags.length > 0 && (
                <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                  {tags.map((tag) => (
                    <Chip
                      key={tag}
                      label={tag}
                      onDelete={() => handleRemoveTag(tag)}
                      size="small"
                    />
                  ))}
                </Box>
              )}
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
            disabled={saving}
          >
            {saving ? t('common.saving') : t('common.save')}
          </Button>
        </Box>
      </Box>
    </ResizableDrawer>
  );
};

export default RewardTemplateFormDialog;


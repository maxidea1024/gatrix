import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  IconButton,
  Stack,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Tooltip,
} from '@mui/material';
import { Add as AddIcon, Delete as DeleteIcon } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import RewardItemSelector, { RewardSelection } from './RewardItemSelector';
import rewardTemplateService, {
  RewardTemplate,
  ParticipationReward,
} from '../../services/rewardTemplateService';

interface RewardSelectorProps {
  value: ParticipationReward[];
  onChange: (rewards: ParticipationReward[]) => void;
  onModeChange?: (mode: RewardMode, selectedTemplateId?: string) => void;
  disabled?: boolean;
  minQuantity?: number;
  initialMode?: RewardMode;
  initialTemplateId?: string;
}

type RewardMode = 'direct' | 'template';

const RewardSelector: React.FC<RewardSelectorProps> = ({
  value,
  onChange,
  onModeChange,
  disabled = false,
  minQuantity = 1,
  initialMode = 'direct',
  initialTemplateId = '',
}) => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();

  // State
  const [mode, setMode] = useState<RewardMode>(initialMode);
  const [templates, setTemplates] = useState<RewardTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [showModeChangeWarning, setShowModeChangeWarning] = useState(false);
  const [pendingMode, setPendingMode] = useState<RewardMode | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(initialTemplateId);

  // Load templates on mount
  useEffect(() => {
    loadTemplates();
  }, []);

  // Update mode and selectedTemplateId when initialMode or initialTemplateId changes
  useEffect(() => {
    setMode(initialMode);
    setSelectedTemplateId(initialTemplateId);
  }, [initialMode, initialTemplateId]);

  // Auto-load template rewards when initialTemplateId is set and templates are loaded
  useEffect(() => {
    if (
      initialMode === 'template' &&
      initialTemplateId &&
      templates.length > 0 &&
      value.length === 0
    ) {
      const template = templates.find((t) => t.id === initialTemplateId);
      if (template && template.rewardItems && template.rewardItems.length > 0) {
        onChange([...template.rewardItems]);
      }
    }
  }, [templates, initialTemplateId, initialMode, value.length]);

  const loadTemplates = async () => {
    try {
      setLoadingTemplates(true);
      const response = await rewardTemplateService.getRewardTemplates({
        limit: 100,
      });
      setTemplates(response.templates);
    } catch (error: any) {
      enqueueSnackbar(error.message || t('rewardTemplates.errors.loadFailed'), {
        variant: 'error',
      });
    } finally {
      setLoadingTemplates(false);
    }
  };

  const handleModeChange = (newMode: RewardMode) => {
    if (value.length > 0 && mode !== newMode) {
      setPendingMode(newMode);
      setShowModeChangeWarning(true);
    } else {
      setMode(newMode);
      setSelectedTemplateId('');
      onModeChange?.(newMode, '');
    }
  };

  const handleConfirmModeChange = () => {
    if (pendingMode) {
      setMode(pendingMode);
      onChange([]);
      setPendingMode(null);
      setSelectedTemplateId('');
      onModeChange?.(pendingMode, '');
    }
    setShowModeChangeWarning(false);
  };

  const handleAddReward = () => {
    const newReward: ParticipationReward = {
      rewardType: '',
      itemId: '',
      quantity: minQuantity,
    };
    onChange([...value, newReward]);
  };

  const handleRewardChange = (index: number, selection: RewardSelection) => {
    const updated = [...value];
    updated[index] = {
      rewardType: selection.rewardType,
      itemId: selection.itemId,
      quantity: selection.quantity,
    };
    onChange(updated);
  };

  const handleRemoveReward = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  const handleSelectTemplate = (templateId: string) => {
    setSelectedTemplateId(templateId);
    const template = templates.find((t) => t.id === templateId);
    if (template && template.rewardItems && template.rewardItems.length > 0) {
      onChange([...template.rewardItems]);
      onModeChange?.('template', templateId);
    } else if (template) {
      enqueueSnackbar(t('rewardSelector.templateEmpty'), {
        variant: 'warning',
      });
    }
  };

  return (
    <Box>
      {/* Mode Selection Dropdown */}
      <FormControl fullWidth sx={{ mb: 2 }}>
        <InputLabel>{t('rewardSelector.selectMode')}</InputLabel>
        <Select
          value={mode}
          label={t('rewardSelector.selectMode')}
          onChange={(e) => handleModeChange(e.target.value as RewardMode)}
          disabled={disabled}
        >
          <MenuItem value="direct">{t('rewardSelector.directMode')}</MenuItem>
          <MenuItem value="template">{t('rewardSelector.templateMode')}</MenuItem>
        </Select>
      </FormControl>

      {/* Direct Mode */}
      {mode === 'direct' && (
        <Box>
          <Typography variant="subtitle2" sx={{ mb: 2 }}>
            {t('rewardSelector.rewards')}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
            {t('rewardSelector.directModeHelp')}
          </Typography>
          <Stack spacing={2}>
            {value.map((reward, index) => (
              <Box key={index} sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                <Box sx={{ flex: 1 }}>
                  <RewardItemSelector
                    value={{
                      rewardType: reward.rewardType,
                      itemId: reward.itemId,
                      quantity: reward.quantity,
                    }}
                    onChange={(selection) => handleRewardChange(index, selection)}
                    disabled={disabled}
                    minQuantity={minQuantity}
                  />
                </Box>
                <Tooltip title={t('rewardSelector.deleteReward')}>
                  <IconButton
                    onClick={() => handleRemoveReward(index)}
                    disabled={disabled}
                    size="small"
                    sx={{ mt: 0.5 }}
                  >
                    <DeleteIcon />
                  </IconButton>
                </Tooltip>
              </Box>
            ))}
            {value.length === 0 && (
              <Box
                sx={{
                  py: 3,
                  px: 2,
                  textAlign: 'center',
                  bgcolor: 'warning.lighter',
                  border: '2px dashed',
                  borderColor: 'warning.main',
                  borderRadius: 1,
                }}
              >
                <Typography variant="body2" sx={{ fontWeight: 600, color: 'warning.dark', mb: 2 }}>
                  ⚠️ {t('rewardSelector.noRewards')}
                </Typography>
                <Button
                  fullWidth
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={handleAddReward}
                  disabled={disabled}
                >
                  {t('rewardSelector.addReward')}
                </Button>
              </Box>
            )}
            {value.length > 0 && (
              <Button
                fullWidth
                variant="outlined"
                startIcon={<AddIcon />}
                onClick={handleAddReward}
                disabled={disabled}
              >
                {t('rewardSelector.addReward')}
              </Button>
            )}
          </Stack>
        </Box>
      )}

      {/* Template Mode */}
      {mode === 'template' && (
        <Box>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
            {t('rewardSelector.templateModeHelp')}
          </Typography>

          {loadingTemplates ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
              <CircularProgress />
            </Box>
          ) : templates.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
              {t('rewardSelector.noTemplates')}
            </Typography>
          ) : (
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>{t('rewardSelector.selectTemplate')}</InputLabel>
              <Select
                value={selectedTemplateId}
                label={t('rewardSelector.selectTemplate')}
                onChange={(e) => handleSelectTemplate(e.target.value)}
                disabled={disabled}
              >
                <MenuItem value="">
                  <em>{t('rewardSelector.selectTemplate')}</em>
                </MenuItem>
                {templates.map((template) => (
                  <MenuItem key={template.id} value={template.id}>
                    {template.name}
                    {template.rewardItems && template.rewardItems.length > 0 && (
                      <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                        (
                        {t('rewardSelector.itemCount', {
                          count: template.rewardItems.length,
                        })}
                        )
                      </Typography>
                    )}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          {value.length > 0 && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                {t('rewardSelector.appliedRewards')}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                {t('rewardSelector.templateReadOnlyHelp')}
              </Typography>
              <Stack spacing={1}>
                {value.map((reward, index) => (
                  <Box key={index} sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                    <Box sx={{ flex: 1 }}>
                      <RewardItemSelector
                        value={{
                          rewardType: reward.rewardType,
                          itemId: reward.itemId,
                          quantity: reward.quantity,
                        }}
                        onChange={() => {}}
                        disabled={true}
                        minQuantity={minQuantity}
                      />
                    </Box>
                  </Box>
                ))}
              </Stack>
            </Box>
          )}
        </Box>
      )}

      {/* Mode Change Warning Dialog */}
      <Dialog open={showModeChangeWarning} onClose={() => setShowModeChangeWarning(false)}>
        <DialogTitle>{t('rewardSelector.modeChangeWarning')}</DialogTitle>
        <DialogContent>
          <Typography>{t('rewardSelector.modeChangeWarningMessage')}</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowModeChangeWarning(false)}>{t('common.cancel')}</Button>
          <Button onClick={handleConfirmModeChange} variant="contained" color="error">
            {t('common.confirm')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default RewardSelector;

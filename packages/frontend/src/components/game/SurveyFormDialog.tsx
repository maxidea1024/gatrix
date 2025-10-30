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
  FormControlLabel,
  Switch,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
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
import { usePlatformConfig } from '../../contexts/PlatformConfigContext';
import surveyService, { Survey, TriggerCondition, ParticipationReward } from '../../services/surveyService';
import RewardSelector from './RewardSelector';

interface SurveyFormDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  survey?: Survey | null;
}

const SurveyFormDialog: React.FC<SurveyFormDialogProps> = ({
  open,
  onClose,
  onSuccess,
  survey,
}) => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const { platforms } = usePlatformConfig();

  // Form state
  const [platformSurveyId, setPlatformSurveyId] = useState('');
  const [surveyTitle, setSurveyTitle] = useState('');
  const [surveyContent, setSurveyContent] = useState('');
  const [triggerConditions, setTriggerConditions] = useState<TriggerCondition[]>([
    { type: 'userLevel', value: 1 },
  ]);
  const [participationRewards, setParticipationRewards] = useState<ParticipationReward[]>([]);
  const [rewardTemplateId, setRewardTemplateId] = useState<string | null>(null);
  const [rewardMode, setRewardMode] = useState<'direct' | 'template'>('direct');
  const [rewardMailTitle, setRewardMailTitle] = useState('');
  const [rewardMailContent, setRewardMailContent] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Targeting state
  const [targetPlatforms, setTargetPlatforms] = useState<string[]>([]);
  const [targetWorlds, setTargetWorlds] = useState<string[]>([]);
  const [targetMarkets, setTargetMarkets] = useState<string[]>([]);
  const [targetClientVersions, setTargetClientVersions] = useState<string[]>([]);
  const [targetAccountIds, setTargetAccountIds] = useState<string[]>([]);

  // Collapse states
  const [triggerConditionsExpanded, setTriggerConditionsExpanded] = useState(true);
  const [participationMailExpanded, setParticipationMailExpanded] = useState(true);
  const [rewardsExpanded, setRewardsExpanded] = useState(true);
  const [targetingExpanded, setTargetingExpanded] = useState(true);

  // Initialize form with survey data
  useEffect(() => {
    if (survey) {
      setPlatformSurveyId(survey.platformSurveyId);
      setSurveyTitle(survey.surveyTitle);
      setSurveyContent(survey.surveyContent || '');
      setTriggerConditions(survey.triggerConditions);

      // Set reward mode and data based on rewardTemplateId
      if (survey.rewardTemplateId) {
        setRewardMode('template');
        setRewardTemplateId(survey.rewardTemplateId);
        setParticipationRewards([]);
      } else {
        setRewardMode('direct');
        setRewardTemplateId(null);
        setParticipationRewards(survey.participationRewards || []);
      }

      setRewardMailTitle(survey.rewardMailTitle || '');
      setRewardMailContent(survey.rewardMailContent || '');
      setIsActive(Boolean(survey.isActive));
      setTargetPlatforms(Array.isArray(survey.targetPlatforms) ? survey.targetPlatforms : []);
      setTargetWorlds(Array.isArray(survey.targetWorlds) ? survey.targetWorlds : []);
      setTargetMarkets(Array.isArray(survey.targetMarkets) ? survey.targetMarkets : []);
      setTargetClientVersions(Array.isArray(survey.targetClientVersions) ? survey.targetClientVersions : []);
      setTargetAccountIds(Array.isArray(survey.targetAccountIds) ? survey.targetAccountIds : []);
    } else {
      // Reset form
      setPlatformSurveyId('');
      setSurveyTitle('');
      setSurveyContent('');
      setTriggerConditions([{ type: 'userLevel', value: 1 }]);
      setParticipationRewards([]);
      setRewardTemplateId(null);
      setRewardMode('direct');
      setRewardMailTitle('');
      setRewardMailContent('');
      setIsActive(true);
      setTargetPlatforms([]);
      setTargetWorlds([]);
      setTargetMarkets([]);
      setTargetClientVersions([]);
      setTargetAccountIds([]);
    }
  }, [survey, open]);

  // Get available condition types (exclude already used types)
  const getAvailableConditionTypes = (currentIndex: number): ('userLevel' | 'joinDays')[] => {
    const usedTypes = triggerConditions
      .map((c, idx) => idx !== currentIndex ? c.type : null)
      .filter(Boolean) as ('userLevel' | 'joinDays')[];

    const allTypes: ('userLevel' | 'joinDays')[] = ['userLevel', 'joinDays'];
    return allTypes.filter(type => !usedTypes.includes(type));
  };

  // Check if we can add more conditions
  const canAddMoreConditions = () => {
    const usedTypes = new Set(triggerConditions.map(c => c.type));
    return usedTypes.size < 2; // Only 2 types available: userLevel and joinDays
  };

  // Trigger condition handlers
  const handleAddTriggerCondition = () => {
    if (!canAddMoreConditions()) {
      enqueueSnackbar(t('surveys.allConditionTypesUsed'), { variant: 'warning' });
      return;
    }

    // Find the first available type
    const usedTypes = new Set(triggerConditions.map(c => c.type));
    const availableType = usedTypes.has('userLevel') ? 'joinDays' : 'userLevel';

    setTriggerConditions([...triggerConditions, { type: availableType, value: 1 }]);
  };

  const handleRemoveTriggerCondition = (index: number) => {
    if (triggerConditions.length === 1) {
      enqueueSnackbar(t('surveys.atLeastOneCondition'), { variant: 'warning' });
      return;
    }
    setTriggerConditions(triggerConditions.filter((_, i) => i !== index));
  };

  const handleTriggerConditionChange = (index: number, field: keyof TriggerCondition, value: any) => {
    // If changing type, check if the new type is already used
    if (field === 'type') {
      const isTypeUsed = triggerConditions.some((c, idx) => idx !== index && c.type === value);
      if (isTypeUsed) {
        enqueueSnackbar(t('surveys.conditionTypeAlreadyUsed'), { variant: 'warning' });
        return;
      }
    }

    const updated = [...triggerConditions];
    updated[index] = { ...updated[index], [field]: value };
    setTriggerConditions(updated);
  };

  // Submit handler
  const handleSubmit = async () => {
    // Validation
    if (!platformSurveyId.trim()) {
      enqueueSnackbar(t('surveys.platformSurveyIdRequired'), { variant: 'error' });
      return;
    }
    if (!surveyTitle.trim()) {
      enqueueSnackbar(t('surveys.surveyTitleRequired'), { variant: 'error' });
      return;
    }
    if (triggerConditions.length === 0) {
      enqueueSnackbar(t('surveys.atLeastOneCondition'), { variant: 'error' });
      return;
    }

    // Validate that either participationRewards or rewardTemplateId is provided
    if (rewardMode === 'direct' && participationRewards.length === 0) {
      enqueueSnackbar(t('surveys.atLeastOneReward'), { variant: 'error' });
      return;
    }
    if (rewardMode === 'template' && !rewardTemplateId) {
      enqueueSnackbar(t('rewardSelector.selectTemplate'), { variant: 'error' });
      return;
    }

    // Validate participation rewards if in direct mode
    if (rewardMode === 'direct') {
      for (let i = 0; i < participationRewards.length; i++) {
        const reward = participationRewards[i];
        if (!reward.rewardType) {
          enqueueSnackbar(t('surveys.rewardTypeRequired', { index: i + 1 }), { variant: 'error' });
          return;
        }
        // Check if itemId is required (for reward types with table)
        if (!reward.itemId || reward.itemId === '') {
          enqueueSnackbar(t('surveys.rewardItemRequired', { index: i + 1 }), { variant: 'error' });
          return;
        }
        if (!reward.quantity || reward.quantity <= 0) {
          enqueueSnackbar(t('surveys.rewardQuantityRequired', { index: i + 1 }), { variant: 'error' });
          return;
        }
      }
    }

    try {
      setSubmitting(true);
      const data = {
        platformSurveyId: platformSurveyId.trim(),
        surveyTitle: surveyTitle.trim(),
        surveyContent: surveyContent.trim() || undefined,
        triggerConditions,
        participationRewards: rewardMode === 'direct' ? participationRewards : null,
        rewardTemplateId: rewardMode === 'template' ? rewardTemplateId : null,
        rewardMailTitle: rewardMailTitle.trim() || undefined,
        rewardMailContent: rewardMailContent.trim() || undefined,
        isActive,
        targetPlatforms: targetPlatforms.length > 0 ? targetPlatforms : null,
        targetWorlds: targetWorlds.length > 0 ? targetWorlds : null,
        targetMarkets: targetMarkets.length > 0 ? targetMarkets : null,
        targetClientVersions: targetClientVersions.length > 0 ? targetClientVersions : null,
        targetAccountIds: targetAccountIds.length > 0 ? targetAccountIds : null,
      };

      if (survey) {
        await surveyService.updateSurvey(survey.id, data);
        enqueueSnackbar(t('surveys.updateSuccess'), { variant: 'success' });
      } else {
        await surveyService.createSurvey(data);
        enqueueSnackbar(t('surveys.createSuccess'), { variant: 'success' });
      }

      onSuccess();
      onClose();
    } catch (error: any) {
      // Map backend error messages to localized messages
      let errorMessage = t('surveys.saveFailed');

      // Extract error message from various possible error structures
      const backendMessage = error?.error?.message || error?.message || '';

      if (backendMessage) {
        if (backendMessage.includes('Platform survey ID already exists') ||
            backendMessage.includes('already exists')) {
          errorMessage = t('surveys.platformSurveyIdExists');
        } else if (backendMessage.includes('At least one trigger condition is required')) {
          errorMessage = t('surveys.triggerConditionRequired');
        } else {
          errorMessage = backendMessage;
        }
      }

      enqueueSnackbar(errorMessage, { variant: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ResizableDrawer
      open={open}
      onClose={onClose}
      title={survey ? t('surveys.editSurvey') : t('surveys.createSurvey')}
      subtitle={t('surveys.formSubtitle')}
      storageKey="surveyFormDrawerWidth"
      defaultWidth={800}
      minWidth={600}
      zIndex={1300}
    >
      {/* Content */}
      <Box
        sx={{
          flex: 1,
          overflow: 'auto',
          p: 3,
          '&::-webkit-scrollbar': {
            width: '8px',
          },
          '&::-webkit-scrollbar-track': {
            background: 'transparent',
          },
          '&::-webkit-scrollbar-thumb': {
            background: (theme) =>
              theme.palette.mode === 'dark'
                ? 'rgba(255, 255, 255, 0.2)'
                : 'rgba(0, 0, 0, 0.2)',
            borderRadius: '4px',
          },
          '&::-webkit-scrollbar-thumb:hover': {
            background: (theme) =>
              theme.palette.mode === 'dark'
                ? 'rgba(255, 255, 255, 0.3)'
                : 'rgba(0, 0, 0, 0.3)',
          },
          scrollbarWidth: 'thin',
          scrollbarColor: (theme) =>
            theme.palette.mode === 'dark'
              ? 'rgba(255, 255, 255, 0.2) transparent'
              : 'rgba(0, 0, 0, 0.2) transparent',
        }}
      >
        <Stack spacing={3}>
          {/* Basic Settings */}
          <Box>
            <FormControlLabel
              control={
                <Switch
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                />
              }
              label={t('surveys.isActive')}
            />
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', ml: 4, mt: 0.5 }}>
              {t('surveys.isActiveHelp')}
            </Typography>
          </Box>

          <TextField
            label={t('surveys.platformSurveyId')}
            value={platformSurveyId}
            onChange={(e) => setPlatformSurveyId(e.target.value)}
            required
            fullWidth
            helperText={t('surveys.platformSurveyIdHelp')}
          />

          {/* Targeting */}
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                mb: targetingExpanded ? 1 : 0,
                cursor: 'pointer',
              }}
              onClick={() => setTargetingExpanded(!targetingExpanded)}
            >
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                {t('surveys.targeting')}
              </Typography>
              <IconButton size="small" sx={{ pointerEvents: 'none' }}>
                {targetingExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
              </IconButton>
            </Box>
            <Collapse in={targetingExpanded}>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
                {t('surveys.targetingHelp')}
              </Typography>
              <Stack spacing={2}>
                {/* Target Platforms */}
                <FormControl fullWidth>
                  <InputLabel>{t('surveys.targetPlatforms')}</InputLabel>
                  <Select
                    multiple
                    value={targetPlatforms}
                    onChange={(e) => setTargetPlatforms(typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value)}
                    input={<OutlinedInput label={t('surveys.targetPlatforms')} />}
                    renderValue={(selected) => (
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {selected.map((value) => (
                          <Chip key={value} label={value} size="small" />
                        ))}
                      </Box>
                    )}
                  >
                    {platforms.map((platform) => (
                      <MenuItem key={platform.value} value={platform.value}>
                        {platform.label}
                      </MenuItem>
                    ))}
                  </Select>
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, ml: 1.75 }}>
                    {t('surveys.targetPlatformsHelp')}
                  </Typography>
                </FormControl>

                {/* Target Worlds */}
                <TextField
                  label={t('surveys.targetWorlds')}
                  value={targetWorlds.join(', ')}
                  onChange={(e) => setTargetWorlds(e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                  fullWidth
                  placeholder={t('surveys.targetWorldsPlaceholder')}
                  helperText={t('surveys.targetWorldsHelp')}
                />

                {/* Target Markets */}
                <TextField
                  label={t('surveys.targetMarkets')}
                  value={targetMarkets.join(', ')}
                  onChange={(e) => setTargetMarkets(e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                  fullWidth
                  placeholder={t('surveys.targetMarketsPlaceholder')}
                  helperText={t('surveys.targetMarketsHelp')}
                />

                {/* Target Client Versions */}
                <TextField
                  label={t('surveys.targetClientVersions')}
                  value={targetClientVersions.join(', ')}
                  onChange={(e) => setTargetClientVersions(e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                  fullWidth
                  placeholder={t('surveys.targetClientVersionsPlaceholder')}
                  helperText={t('surveys.targetClientVersionsHelp')}
                />

                {/* Target Account IDs */}
                <TextField
                  label={t('surveys.targetAccountIds')}
                  value={targetAccountIds.join(', ')}
                  onChange={(e) => setTargetAccountIds(e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                  fullWidth
                  placeholder={t('surveys.targetAccountIdsPlaceholder')}
                  helperText={t('surveys.targetAccountIdsHelp')}
                />
              </Stack>
            </Collapse>
          </Paper>

          {/* Trigger Conditions */}
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                mb: triggerConditionsExpanded ? 1 : 0,
                cursor: 'pointer',
              }}
              onClick={() => setTriggerConditionsExpanded(!triggerConditionsExpanded)}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                  {t('surveys.triggerConditions')}
                </Typography>
                <IconButton size="small" sx={{ pointerEvents: 'none' }}>
                  {triggerConditionsExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                </IconButton>
              </Box>
              {triggerConditionsExpanded && (
                <Button
                  size="small"
                  startIcon={<AddIcon />}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleAddTriggerCondition();
                  }}
                  disabled={!canAddMoreConditions()}
                >
                  {t('surveys.addCondition')}
                </Button>
              )}
            </Box>
            <Collapse in={triggerConditionsExpanded}>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
                {t('surveys.triggerConditionsHelp')}
              </Typography>
              {triggerConditions.map((condition, index) => {
                const availableTypes = getAvailableConditionTypes(index);
                return (
                  <Box key={index}>
                    <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
                      <FormControl sx={{ minWidth: 150 }}>
                        <InputLabel>{t('surveys.conditionType')}</InputLabel>
                        <Select
                          value={condition.type}
                          onChange={(e) => handleTriggerConditionChange(index, 'type', e.target.value)}
                          label={t('surveys.conditionType')}
                        >
                          {/* Always show current type */}
                          {!availableTypes.includes(condition.type) && (
                            <MenuItem value={condition.type}>
                              {t(`surveys.condition.${condition.type}`)}
                            </MenuItem>
                          )}
                          {/* Show available types */}
                          {availableTypes.map(type => (
                            <MenuItem key={type} value={type}>
                              {t(`surveys.condition.${type}`)}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                      <TextField
                        label={t('surveys.conditionValue')}
                        type="number"
                        value={condition.value}
                        onChange={(e) => handleTriggerConditionChange(index, 'value', parseInt(e.target.value) || 0)}
                        sx={{
                          flex: 1,
                          '& input[type=number]': {
                            MozAppearance: 'textfield',
                          },
                          '& input[type=number]::-webkit-outer-spin-button, & input[type=number]::-webkit-inner-spin-button': {
                            WebkitAppearance: 'none',
                            margin: 0,
                          },
                        }}
                      />
                      <IconButton
                        onClick={() => handleRemoveTriggerCondition(index)}
                        disabled={triggerConditions.length === 1}
                      >
                        <DeleteIcon />
                      </IconButton>
                    </Box>
                    {/* AND separator between conditions */}
                    {index < triggerConditions.length - 1 && (
                      <Box sx={{ display: 'flex', justifyContent: 'center', my: 1 }}>
                        <Chip
                          label="AND"
                          size="small"
                          color="primary"
                          variant="outlined"
                          sx={{ fontWeight: 600 }}
                        />
                      </Box>
                    )}
                  </Box>
                );
              })}
            </Collapse>
          </Paper>

          {/* Survey Participation Mail */}
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                mb: participationMailExpanded ? 1 : 0,
                cursor: 'pointer',
              }}
              onClick={() => setParticipationMailExpanded(!participationMailExpanded)}
            >
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                {t('surveys.participationMail')}
              </Typography>
              <IconButton size="small" sx={{ pointerEvents: 'none' }}>
                {participationMailExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
              </IconButton>
            </Box>
            <Collapse in={participationMailExpanded}>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
                {t('surveys.participationMailHelp')}
              </Typography>
              <Stack spacing={2}>
                <TextField
                  label={t('surveys.surveyTitle')}
                  value={surveyTitle}
                  onChange={(e) => setSurveyTitle(e.target.value)}
                  required
                  fullWidth
                  helperText={t('surveys.surveyTitleHelp')}
                />
                <TextField
                  label={t('surveys.surveyContent')}
                  value={surveyContent}
                  onChange={(e) => setSurveyContent(e.target.value)}
                  multiline
                  rows={3}
                  fullWidth
                  helperText={t('surveys.surveyContentHelp')}
                />
              </Stack>
            </Collapse>
          </Paper>

          {/* Rewards */}
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                mb: rewardsExpanded ? 1 : 0,
                cursor: 'pointer',
              }}
              onClick={() => setRewardsExpanded(!rewardsExpanded)}
            >
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                {t('surveys.section.rewards')}
              </Typography>
              <IconButton size="small" sx={{ pointerEvents: 'none' }}>
                {rewardsExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
              </IconButton>
            </Box>
            <Collapse in={rewardsExpanded}>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
                {t('surveys.rewardsHelp')}
              </Typography>
              <Stack spacing={2}>
              {/* Reward Mail */}
              <Box>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>{t('surveys.rewardMailTitle')}</Typography>
                <TextField
                  value={rewardMailTitle}
                  onChange={(e) => setRewardMailTitle(e.target.value)}
                  fullWidth
                  size="small"
                  helperText={t('surveys.rewardMailTitleHelp')}
                />
              </Box>

              <Box>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>{t('surveys.rewardMailContent')}</Typography>
                <TextField
                  value={rewardMailContent}
                  onChange={(e) => setRewardMailContent(e.target.value)}
                  multiline
                  rows={3}
                  fullWidth
                  size="small"
                  helperText={t('surveys.rewardMailContentHelp')}
                />
              </Box>

              {/* Participation Rewards */}
              <Box>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                  {t('surveys.participationRewards')}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
                  {t('surveys.participationRewardsHelp')}
                </Typography>
                <RewardSelector
                  value={participationRewards}
                  onChange={setParticipationRewards}
                  onModeChange={(mode, templateId) => {
                    setRewardMode(mode);
                    if (mode === 'template') {
                      setRewardTemplateId(templateId || null);
                    } else {
                      setRewardTemplateId(null);
                    }
                  }}
                  minQuantity={1}
                  initialMode={rewardMode}
                  initialTemplateId={rewardTemplateId || ''}
                />
              </Box>
              </Stack>
            </Collapse>
          </Paper>
        </Stack>
      </Box>

      {/* Footer */}
      <Box
        sx={{
          p: 2,
          borderTop: 1,
          borderColor: 'divider',
          bgcolor: 'background.paper',
          display: 'flex',
          gap: 1,
          justifyContent: 'flex-end',
        }}
      >
        <Button onClick={onClose} disabled={submitting}>
          {t('common.cancel')}
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={submitting}
        >
          {survey ? t('common.update') : t('common.create')}
        </Button>
      </Box>
    </ResizableDrawer>
  );
};

export default SurveyFormDialog;


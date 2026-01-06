import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { useGameWorld } from '../../contexts/GameWorldContext';
import surveyService, { Survey, TriggerCondition, ParticipationReward, ChannelSubchannelData } from '../../services/surveyService';
import RewardSelector from './RewardSelector';
import TargetSettingsGroup from './TargetSettingsGroup';
import { ErrorCodes } from '@gatrix/shared';
import { showChangeRequestCreatedToast } from '../../utils/changeRequestToast';
import { getActionLabel } from '../../utils/changeRequestToast';
import { useEnvironment } from '../../contexts/EnvironmentContext';

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
  const { enqueueSnackbar, closeSnackbar } = useSnackbar();
  const navigate = useNavigate();
  const { currentEnvironment } = useEnvironment();
  const requiresApproval = currentEnvironment?.requiresApproval ?? false;
  const { platforms, channels } = usePlatformConfig();
  const { worlds } = useGameWorld();

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
  const [targetPlatformsInverted, setTargetPlatformsInverted] = useState(false);
  const [targetChannelSubchannels, setTargetChannelSubchannels] = useState<ChannelSubchannelData[]>([]);
  const [targetChannelSubchannelsInverted, setTargetChannelSubchannelsInverted] = useState(false);
  const [targetWorlds, setTargetWorlds] = useState<string[]>([]);
  const [targetWorldsInverted, setTargetWorldsInverted] = useState(false);

  // Collapse states
  const [basicInfoExpanded, setBasicInfoExpanded] = useState(true);
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
      setTargetPlatformsInverted(survey.targetPlatformsInverted || false);

      // Convert targetChannels and targetSubchannels to targetChannelSubchannels format
      // targetSubchannels format: "channel:subchannel" (e.g., "official:global", "official:asia")
      const targetChannelSubchannels: ChannelSubchannelData[] = [];
      const targetChannels = (survey as any).targetChannels || [];
      const targetSubchannels = (survey as any).targetSubchannels || [];

      // Parse targetSubchannels from "channel:subchannel" format
      const subchannelsByChannel: { [key: string]: string[] } = {};
      targetSubchannels.forEach((subchannelKey: string) => {
        const [channel, subchannel] = subchannelKey.split(':');
        if (channel && subchannel) {
          if (!subchannelsByChannel[channel]) {
            subchannelsByChannel[channel] = [];
          }
          subchannelsByChannel[channel].push(subchannel);
        }
      });

      // Build targetChannelSubchannels array
      if (targetChannels.length > 0) {
        targetChannels.forEach((channel: string) => {
          targetChannelSubchannels.push({
            channel,
            subchannels: subchannelsByChannel[channel] || [],
          });
        });
      }

      setTargetChannelSubchannels(targetChannelSubchannels);
      setTargetChannelSubchannelsInverted(survey.targetChannelSubchannelsInverted || false);
      setTargetWorlds(Array.isArray(survey.targetWorlds) ? survey.targetWorlds : []);
      setTargetWorldsInverted(survey.targetWorldsInverted || false);
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
      setTargetPlatformsInverted(false);
      setTargetChannelSubchannels([]);
      setTargetChannelSubchannelsInverted(false);
      setTargetWorlds([]);
      setTargetWorldsInverted(false);
    }
  }, [survey, open]);

  // Check if form is dirty (data changed)
  const isDirty = useMemo(() => {
    if (!survey) return true;

    // Convert current target settings back to channels/subchannels for comparison
    const currentChannels: string[] = [];
    const currentSubchannels: string[] = [];
    if (targetChannelSubchannels && targetChannelSubchannels.length > 0) {
      targetChannelSubchannels.forEach((item: any) => {
        if (!currentChannels.includes(item.channel)) {
          currentChannels.push(item.channel);
        }
        item.subchannels.forEach((subchannel: string) => {
          const subchannelKey = `${item.channel}:${subchannel}`;
          if (!currentSubchannels.includes(subchannelKey)) {
            currentSubchannels.push(subchannelKey);
          }
        });
      });
    }

    const currentData = {
      platformSurveyId: platformSurveyId.trim(),
      surveyTitle: surveyTitle.trim(),
      surveyContent: surveyContent.trim() || '',
      triggerConditions: triggerConditions.map(c => ({ type: c.type, value: c.value })),
      participationRewards: rewardMode === 'direct' ? participationRewards : null,
      rewardTemplateId: rewardMode === 'template' ? rewardTemplateId : null,
      rewardMailTitle: rewardMailTitle.trim() || '',
      rewardMailContent: rewardMailContent.trim() || '',
      isActive: !!isActive,
      targetPlatforms: targetPlatforms.length > 0 ? [...targetPlatforms].sort() : null,
      targetPlatformsInverted,
      targetChannels: currentChannels.length > 0 ? [...currentChannels].sort() : null,
      targetChannelsInverted: targetChannelSubchannelsInverted,
      targetSubchannels: currentSubchannels.length > 0 ? [...currentSubchannels].sort() : null,
      targetSubchannelsInverted: targetChannelSubchannelsInverted,
      targetWorlds: targetWorlds.length > 0 ? [...targetWorlds].sort() : null,
      targetWorldsInverted: targetWorldsInverted,
    };

    const originalData = {
      platformSurveyId: survey.platformSurveyId.trim(),
      surveyTitle: survey.surveyTitle.trim(),
      surveyContent: survey.surveyContent?.trim() || '',
      triggerConditions: (survey.triggerConditions || []).map(c => ({ type: c.type, value: c.value })),
      participationRewards: survey.rewardTemplateId ? null : (survey.participationRewards || []),
      rewardTemplateId: survey.rewardTemplateId || null,
      rewardMailTitle: survey.rewardMailTitle?.trim() || '',
      rewardMailContent: survey.rewardMailContent?.trim() || '',
      isActive: !!survey.isActive,
      targetPlatforms: (survey.targetPlatforms || []).length > 0 ? [...survey.targetPlatforms].sort() : null,
      targetPlatformsInverted: survey.targetPlatformsInverted || false,
      targetChannels: ((survey as any).targetChannels || []).length > 0 ? [...(survey as any).targetChannels].sort() : null,
      targetChannelsInverted: survey.targetChannelSubchannelsInverted || false,
      targetSubchannels: ((survey as any).targetSubchannels || []).length > 0 ? [...(survey as any).targetSubchannels].sort() : null,
      targetSubchannelsInverted: survey.targetChannelSubchannelsInverted || false,
      targetWorlds: (survey.targetWorlds || []).length > 0 ? [...survey.targetWorlds].sort() : null,
      targetWorldsInverted: survey.targetWorldsInverted || false,
    };

    return JSON.stringify(currentData) !== JSON.stringify(originalData);
  }, [
    survey, platformSurveyId, surveyTitle, surveyContent, triggerConditions,
    participationRewards, rewardTemplateId, rewardMode, rewardMailTitle, rewardMailContent,
    isActive, targetPlatforms, targetPlatformsInverted, targetChannelSubchannels,
    targetChannelSubchannelsInverted, targetWorlds, targetWorldsInverted
  ]);

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

      // Convert targetChannelSubchannels to targetChannels and targetSubchannels
      // targetSubchannels format: "channel:subchannel" (e.g., "official:global", "official:asia")
      const targetChannels: string[] = [];
      const targetSubchannels: string[] = [];
      if (targetChannelSubchannels && targetChannelSubchannels.length > 0) {
        targetChannelSubchannels.forEach((item: any) => {
          if (!targetChannels.includes(item.channel)) {
            targetChannels.push(item.channel);
          }
          item.subchannels.forEach((subchannel: string) => {
            const subchannelKey = `${item.channel}:${subchannel}`;
            if (!targetSubchannels.includes(subchannelKey)) {
              targetSubchannels.push(subchannelKey);
            }
          });
        });
      }

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
        targetPlatformsInverted: targetPlatformsInverted,
        targetChannels: targetChannels.length > 0 ? targetChannels : null,
        targetChannelsInverted: targetChannelSubchannelsInverted,
        targetSubchannels: targetSubchannels.length > 0 ? targetSubchannels : null,
        targetSubchannelsInverted: targetChannelSubchannelsInverted,
        targetWorlds: targetWorlds.length > 0 ? targetWorlds : null,
        targetWorldsInverted: targetWorldsInverted,
      };

      if (survey) {
        const result = await surveyService.updateSurvey(survey.id, data);
        if (result.isChangeRequest) {
          showChangeRequestCreatedToast(enqueueSnackbar, closeSnackbar, navigate);
        } else {
          enqueueSnackbar(t('surveys.updateSuccess'), { variant: 'success' });
        }
      } else {
        const result = await surveyService.createSurvey(data);
        if (result.isChangeRequest) {
          showChangeRequestCreatedToast(enqueueSnackbar, closeSnackbar, navigate);
        } else {
          enqueueSnackbar(t('surveys.createSuccess'), { variant: 'success' });
        }
      }

      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Failed to save survey:', error);
      const fallbackKey = currentEnvironment?.requiresApproval ? 'surveys.requestSaveFailed' : 'surveys.saveFailed';
      enqueueSnackbar(parseApiErrorMessage(error, fallbackKey), { variant: 'error' });
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

          {/* Basic Information Group */}
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                mb: basicInfoExpanded ? 1 : 0,
                cursor: 'pointer',
              }}
              onClick={() => setBasicInfoExpanded(!basicInfoExpanded)}
            >
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                {t('common.basicInformation')}
              </Typography>
              <IconButton size="small" sx={{ pointerEvents: 'none' }}>
                {basicInfoExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
              </IconButton>
            </Box>
            <Collapse in={basicInfoExpanded}>
              <Stack spacing={2} sx={{ mt: 1 }}>
                <TextField
                  label={t('surveys.platformSurveyId')}
                  value={platformSurveyId}
                  onChange={(e) => setPlatformSurveyId(e.target.value)}
                  required
                  fullWidth
                  helperText={t('surveys.platformSurveyIdHelp')}
                />
              </Stack>
            </Collapse>
          </Paper>

          {/* Targeting */}
          <TargetSettingsGroup
            targetPlatforms={targetPlatforms}
            targetPlatformsInverted={targetPlatformsInverted}
            platforms={platforms}
            onPlatformsChange={(platforms, inverted) => {
              setTargetPlatforms(platforms);
              setTargetPlatformsInverted(inverted);
            }}
            targetChannelSubchannels={targetChannelSubchannels}
            targetChannelSubchannelsInverted={targetChannelSubchannelsInverted}
            channels={channels}
            onChannelsChange={(channels, inverted) => {
              setTargetChannelSubchannels(channels);
              setTargetChannelSubchannelsInverted(inverted);
            }}
            targetWorlds={targetWorlds}
            targetWorldsInverted={targetWorldsInverted}
            worlds={worlds}
            onWorldsChange={(worlds, inverted) => {
              setTargetWorlds(worlds);
              setTargetWorldsInverted(inverted);
            }}
            showUserIdFilter={false}
          />

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
                        onChange={(e) => handleTriggerConditionChange(index, 'value', e.target.value === '' ? '' : parseInt(e.target.value) || 0)}
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
                  required
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
                <TextField
                  label={t('surveys.rewardMailTitle')}
                  value={rewardMailTitle}
                  onChange={(e) => setRewardMailTitle(e.target.value)}
                  fullWidth
                  size="small"
                  required
                  helperText={t('surveys.rewardMailTitleHelp')}
                />

                <TextField
                  label={t('surveys.rewardMailContent')}
                  value={rewardMailContent}
                  onChange={(e) => setRewardMailContent(e.target.value)}
                  multiline
                  rows={3}
                  fullWidth
                  size="small"
                  required
                  helperText={t('surveys.rewardMailContentHelp')}
                />

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
          disabled={submitting || (!!survey && !isDirty)}
        >
          {getActionLabel(survey ? 'update' : 'create', requiresApproval, t)}
        </Button>
      </Box>
    </ResizableDrawer>
  );
};

export default SurveyFormDialog;


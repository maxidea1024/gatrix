import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Typography,
  IconButton,
  Chip,
  FormControlLabel,
  Switch,
  Divider,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Paper,
} from '@mui/material';
import { Add as AddIcon, Delete as DeleteIcon } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import surveyService, { Survey, TriggerCondition, ParticipationReward } from '../../services/surveyService';

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

  // Form state
  const [platformSurveyId, setPlatformSurveyId] = useState('');
  const [surveyTitle, setSurveyTitle] = useState('');
  const [surveyContent, setSurveyContent] = useState('');
  const [triggerConditions, setTriggerConditions] = useState<TriggerCondition[]>([
    { type: 'userLevel', value: 1 },
  ]);
  const [participationRewards, setParticipationRewards] = useState<ParticipationReward[]>([]);
  const [rewardMailTitle, setRewardMailTitle] = useState('');
  const [rewardMailContent, setRewardMailContent] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Initialize form with survey data
  useEffect(() => {
    if (survey) {
      setPlatformSurveyId(survey.platformSurveyId);
      setSurveyTitle(survey.surveyTitle);
      setSurveyContent(survey.surveyContent || '');
      setTriggerConditions(survey.triggerConditions);
      setParticipationRewards(survey.participationRewards || []);
      setRewardMailTitle(survey.rewardMailTitle || '');
      setRewardMailContent(survey.rewardMailContent || '');
      setIsActive(survey.isActive);
    } else {
      // Reset form
      setPlatformSurveyId('');
      setSurveyTitle('');
      setSurveyContent('');
      setTriggerConditions([{ type: 'userLevel', value: 1 }]);
      setParticipationRewards([]);
      setRewardMailTitle('');
      setRewardMailContent('');
      setIsActive(true);
    }
  }, [survey, open]);

  // Trigger condition handlers
  const handleAddTriggerCondition = () => {
    setTriggerConditions([...triggerConditions, { type: 'userLevel', value: 1 }]);
  };

  const handleRemoveTriggerCondition = (index: number) => {
    if (triggerConditions.length === 1) {
      enqueueSnackbar(t('surveys.atLeastOneCondition'), { variant: 'warning' });
      return;
    }
    setTriggerConditions(triggerConditions.filter((_, i) => i !== index));
  };

  const handleTriggerConditionChange = (index: number, field: keyof TriggerCondition, value: any) => {
    const updated = [...triggerConditions];
    updated[index] = { ...updated[index], [field]: value };
    setTriggerConditions(updated);
  };

  // Reward handlers
  const handleAddReward = () => {
    setParticipationRewards([
      ...participationRewards,
      { rewardType: '', itemId: '', quantity: 1 },
    ]);
  };

  const handleRemoveReward = (index: number) => {
    setParticipationRewards(participationRewards.filter((_, i) => i !== index));
  };

  const handleRewardChange = (index: number, field: keyof ParticipationReward, value: any) => {
    const updated = [...participationRewards];
    updated[index] = { ...updated[index], [field]: value };
    setParticipationRewards(updated);
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

    try {
      setSubmitting(true);
      const data = {
        platformSurveyId: platformSurveyId.trim(),
        surveyTitle: surveyTitle.trim(),
        surveyContent: surveyContent.trim() || undefined,
        triggerConditions,
        participationRewards: participationRewards.length > 0 ? participationRewards : undefined,
        rewardMailTitle: rewardMailTitle.trim() || undefined,
        rewardMailContent: rewardMailContent.trim() || undefined,
        isActive,
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

      if (error.message) {
        if (error.message.includes('Platform survey ID already exists')) {
          errorMessage = t('surveys.platformSurveyIdExists');
        } else {
          errorMessage = error.message;
        }
      }

      enqueueSnackbar(errorMessage, { variant: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box>
          <Typography variant="h6">
            {survey ? t('surveys.editSurvey') : t('surveys.createSurvey')}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {t('surveys.formSubtitle')}
          </Typography>
        </Box>
      </DialogTitle>
      <DialogContent dividers>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {/* Section 1: Survey Participation */}
          <Paper
            variant="outlined"
            sx={{
              p: 2.5,
              borderRadius: 1,
            }}
          >
            <Typography
              variant="subtitle1"
              sx={{
                mb: 2,
                fontWeight: 600,
              }}
            >
              {t('surveys.section.participation')}
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <TextField
                label={t('surveys.platformSurveyId')}
                value={platformSurveyId}
                onChange={(e) => setPlatformSurveyId(e.target.value)}
                required
                fullWidth
                helperText={t('surveys.platformSurveyIdHelp')}
              />

              <TextField
                label={t('surveys.surveyTitle')}
                value={surveyTitle}
                onChange={(e) => setSurveyTitle(e.target.value)}
                required
                fullWidth
              />

              <TextField
                label={t('surveys.surveyContent')}
                value={surveyContent}
                onChange={(e) => setSurveyContent(e.target.value)}
                multiline
                rows={3}
                fullWidth
              />

              <FormControlLabel
                control={
                  <Switch
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                  />
                }
                label={t('surveys.isActive')}
              />

              {/* Trigger Conditions */}
              <Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                  <Typography variant="subtitle2">{t('surveys.triggerConditions')}</Typography>
                  <Button size="small" startIcon={<AddIcon />} onClick={handleAddTriggerCondition}>
                    {t('surveys.addCondition')}
                  </Button>
                </Box>
                {triggerConditions.map((condition, index) => (
                  <Box key={index}>
                    <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
                      <FormControl sx={{ minWidth: 150 }}>
                        <InputLabel>{t('surveys.conditionType')}</InputLabel>
                        <Select
                          value={condition.type}
                          onChange={(e) => handleTriggerConditionChange(index, 'type', e.target.value)}
                          label={t('surveys.conditionType')}
                        >
                          <MenuItem value="userLevel">{t('surveys.condition.userLevel')}</MenuItem>
                          <MenuItem value="joinDays">{t('surveys.condition.joinDays')}</MenuItem>
                        </Select>
                      </FormControl>
                      <TextField
                        label={t('surveys.conditionValue')}
                        type="number"
                        value={condition.value}
                        onChange={(e) => handleTriggerConditionChange(index, 'value', parseInt(e.target.value) || 0)}
                        sx={{ flex: 1 }}
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
                ))}
              </Box>
            </Box>
          </Paper>

          {/* Section 2: Rewards */}
          <Paper
            variant="outlined"
            sx={{
              p: 2.5,
              borderRadius: 1,
            }}
          >
            <Typography
              variant="subtitle1"
              sx={{
                mb: 2,
                fontWeight: 600,
              }}
            >
              {t('surveys.section.rewards')}
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>

              {/* Reward Mail */}
              <Box>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>{t('surveys.rewardMail')}</Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <TextField
                    label={t('surveys.rewardMailTitle')}
                    value={rewardMailTitle}
                    onChange={(e) => setRewardMailTitle(e.target.value)}
                    fullWidth
                  />
                  <TextField
                    label={t('surveys.rewardMailContent')}
                    value={rewardMailContent}
                    onChange={(e) => setRewardMailContent(e.target.value)}
                    multiline
                    rows={3}
                    fullWidth
                  />
                </Box>
              </Box>

              {/* Participation Rewards */}
              <Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                  <Typography variant="subtitle2">{t('surveys.participationRewards')}</Typography>
                  <Button size="small" startIcon={<AddIcon />} onClick={handleAddReward}>
                    {t('surveys.addReward')}
                  </Button>
                </Box>
                {participationRewards.map((reward, index) => (
                  <Box key={index} sx={{ display: 'flex', gap: 1, mb: 1 }}>
                    <TextField
                      label={t('surveys.rewardType')}
                      value={reward.rewardType}
                      onChange={(e) => handleRewardChange(index, 'rewardType', e.target.value)}
                      sx={{ flex: 1 }}
                    />
                    <TextField
                      label={t('surveys.itemId')}
                      value={reward.itemId}
                      onChange={(e) => handleRewardChange(index, 'itemId', e.target.value)}
                      sx={{ flex: 1 }}
                    />
                    <TextField
                      label={t('surveys.quantity')}
                      type="number"
                      value={reward.quantity}
                      onChange={(e) => handleRewardChange(index, 'quantity', parseInt(e.target.value) || 1)}
                      sx={{ width: 100 }}
                    />
                    <IconButton onClick={() => handleRemoveReward(index)}>
                      <DeleteIcon />
                    </IconButton>
                  </Box>
                ))}
              </Box>
            </Box>
          </Paper>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={submitting}>
          {t('common.cancel')}
        </Button>
        <Button onClick={handleSubmit} variant="contained" disabled={submitting}>
          {submitting ? t('common.saving') : t('common.save')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default SurveyFormDialog;


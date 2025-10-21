import React, { useState, useEffect } from 'react';
import {
  Drawer,
  Button,
  TextField,
  FormControlLabel,
  Switch,
  Box,
  Typography,
  AppBar,
  Toolbar,
  IconButton,
  Stack,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  OutlinedInput,
  SelectChangeEvent,
} from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import dayjs, { Dayjs } from 'dayjs';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import {
  IngamePopupNotice,
  CreateIngamePopupNoticeData,
  UpdateIngamePopupNoticeData,
} from '../../services/ingamePopupNoticeService';
import ingamePopupNoticeService from '../../services/ingamePopupNoticeService';
import { messageTemplateService, MessageTemplate } from '../../services/messageTemplateService';
import MultiLanguageMessageInput from '../common/MultiLanguageMessageInput';

interface IngamePopupNoticeFormDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  notice?: IngamePopupNotice | null;
}

const IngamePopupNoticeFormDialog: React.FC<IngamePopupNoticeFormDialogProps> = ({
  open,
  onClose,
  onSuccess,
  notice,
}) => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [isActive, setIsActive] = useState(true);
  const [content, setContent] = useState('');
  const [targetWorlds, setTargetWorlds] = useState<string[]>([]);
  const [targetMarkets, setTargetMarkets] = useState<string[]>([]);
  const [targetPlatforms, setTargetPlatforms] = useState<string[]>([]);
  const [targetClientVersions, setTargetClientVersions] = useState<string[]>([]);
  const [targetAccountIds, setTargetAccountIds] = useState<string[]>([]);
  const [displayPriority, setDisplayPriority] = useState(100);
  const [showOnce, setShowOnce] = useState(false);
  const [startDate, setStartDate] = useState<Dayjs | null>(null);
  const [endDate, setEndDate] = useState<Dayjs | null>(null);
  const [useTemplate, setUseTemplate] = useState(false);
  const [messageTemplateId, setMessageTemplateId] = useState<number | null>(null);
  const [description, setDescription] = useState('');

  // Template state
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<MessageTemplate | null>(null);

  // Load templates
  useEffect(() => {
    const loadTemplates = async () => {
      try {
        const result = await messageTemplateService.list({ isEnabled: true, limit: 1000 });
        setTemplates(result.templates);
      } catch (error) {
        console.error('Failed to load templates:', error);
      }
    };
    loadTemplates();
  }, []);

  // Initialize form with notice data
  useEffect(() => {
    if (notice) {
      setIsActive(notice.isActive);
      setContent(notice.content);
      setTargetWorlds(notice.targetWorlds || []);
      setTargetMarkets(notice.targetMarkets || []);
      setTargetPlatforms(notice.targetPlatforms || []);
      setTargetClientVersions(notice.targetClientVersions || []);
      setTargetAccountIds(notice.targetAccountIds || []);
      setDisplayPriority(notice.displayPriority);
      setShowOnce(notice.showOnce);
      setStartDate(dayjs(notice.startDate));
      setEndDate(dayjs(notice.endDate));
      setUseTemplate(notice.useTemplate);
      setMessageTemplateId(notice.messageTemplateId);
      setDescription(notice.description || '');

      // Load selected template
      if (notice.useTemplate && notice.messageTemplateId) {
        const template = templates.find(t => t.id === notice.messageTemplateId);
        setSelectedTemplate(template || null);
      }
    } else {
      // Reset form
      setIsActive(true);
      setContent('');
      setTargetWorlds([]);
      setTargetMarkets([]);
      setTargetPlatforms([]);
      setTargetClientVersions([]);
      setTargetAccountIds([]);
      setDisplayPriority(100);
      setShowOnce(false);
      setStartDate(null);
      setEndDate(null);
      setUseTemplate(false);
      setMessageTemplateId(null);
      setDescription('');
      setSelectedTemplate(null);
    }
  }, [notice, open, templates]);

  // Handle template selection
  useEffect(() => {
    if (useTemplate && messageTemplateId) {
      const template = templates.find(t => t.id === messageTemplateId);
      setSelectedTemplate(template || null);
      if (template) {
        setContent(template.defaultMessage || '');
      }
    } else {
      setSelectedTemplate(null);
    }
  }, [useTemplate, messageTemplateId, templates]);

  const handleSubmit = async () => {
    // Validation
    if (!content.trim()) {
      enqueueSnackbar(t('ingamePopupNotices.contentRequired'), { variant: 'error' });
      return;
    }

    if (!startDate || !endDate) {
      enqueueSnackbar(t('ingamePopupNotices.datesRequired'), { variant: 'error' });
      return;
    }

    setSubmitting(true);

    try {
      const data: CreateIngamePopupNoticeData | UpdateIngamePopupNoticeData = {
        isActive,
        content: content.trim(),
        targetWorlds: targetWorlds.length > 0 ? targetWorlds : null,
        targetMarkets: targetMarkets.length > 0 ? targetMarkets : null,
        targetPlatforms: targetPlatforms.length > 0 ? targetPlatforms : null,
        targetClientVersions: targetClientVersions.length > 0 ? targetClientVersions : null,
        targetAccountIds: targetAccountIds.length > 0 ? targetAccountIds : null,
        displayPriority,
        showOnce,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        useTemplate,
        messageTemplateId: useTemplate ? messageTemplateId : null,
        description: description.trim() || null,
      };

      if (notice) {
        await ingamePopupNoticeService.updateIngamePopupNotice(notice.id, data);
        enqueueSnackbar(t('ingamePopupNotices.updateSuccess'), { variant: 'success' });
      } else {
        await ingamePopupNoticeService.createIngamePopupNotice(data as CreateIngamePopupNoticeData);
        enqueueSnackbar(t('ingamePopupNotices.createSuccess'), { variant: 'success' });
      }

      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Failed to save ingame popup notice:', error);
      enqueueSnackbar(error?.error?.message || t('ingamePopupNotices.saveFailed'), { variant: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleMultiSelectChange = (
    event: SelectChangeEvent<string[]>,
    setter: React.Dispatch<React.SetStateAction<string[]>>
  ) => {
    const value = event.target.value;
    setter(typeof value === 'string' ? value.split(',') : value);
  };

  const handleVersionAdd = (version: string, setter: React.Dispatch<React.SetStateAction<string[]>>) => {
    if (version.trim()) {
      setter(prev => [...prev, version.trim()]);
    }
  };

  const handleVersionRemove = (version: string, setter: React.Dispatch<React.SetStateAction<string[]>>) => {
    setter(prev => prev.filter(v => v !== version));
  };

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: { width: { xs: '100%', sm: 600, md: 800 } }
      }}
    >
      {/* Header */}
      <AppBar position="static" color="default" elevation={0} sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Toolbar>
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="h6">
              {notice ? t('ingamePopupNotices.editNotice') : t('ingamePopupNotices.createNotice')}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {notice ? t('ingamePopupNotices.editNoticeSubtitle') : t('ingamePopupNotices.createNoticeSubtitle')}
            </Typography>
          </Box>
          <IconButton edge="end" onClick={onClose}>
            <CloseIcon />
          </IconButton>
        </Toolbar>
      </AppBar>

      {/* Content */}
      <Box
        sx={{
          flex: 1,
          overflow: 'auto',
          p: 3,
          '&::-webkit-scrollbar': {
            width: '8px',
          },
          '&::-webkit-scrollbar-thumb': {
            backgroundColor: (theme) =>
              theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)',
            borderRadius: '4px',
          },
          scrollbarWidth: 'thin',
          scrollbarColor: (theme) =>
            theme.palette.mode === 'dark'
              ? 'rgba(255, 255, 255, 0.2) transparent'
              : 'rgba(0, 0, 0, 0.2) transparent',
        }}
      >
        <Stack spacing={3}>
          {/* Active Status */}
          <Box>
            <FormControlLabel
              control={
                <Switch
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                />
              }
              label={t('ingamePopupNotices.isActive')}
            />
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', ml: 4, mt: 0.5 }}>
              {t('ingamePopupNotices.isActiveHelp')}
            </Typography>
          </Box>

          {/* Target Platforms */}
          <FormControl fullWidth>
            <InputLabel>{t('ingamePopupNotices.targetPlatforms')}</InputLabel>
            <Select
              multiple
              value={targetPlatforms}
              onChange={(e) => handleMultiSelectChange(e, setTargetPlatforms)}
              input={<OutlinedInput label={t('ingamePopupNotices.targetPlatforms')} />}
              renderValue={(selected) => (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {selected.map((value) => (
                    <Chip key={value} label={value} size="small" />
                  ))}
                </Box>
              )}
            >
              {['pc', 'pc-wegame', 'ios', 'android', 'harmonyos'].map((platform) => (
                <MenuItem key={platform} value={platform}>
                  {platform}
                </MenuItem>
              ))}
            </Select>
            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, ml: 1.75 }}>
              {t('ingamePopupNotices.targetPlatformsHelp')}
            </Typography>
          </FormControl>

          {/* Target Worlds */}
          <TextField
            label={t('ingamePopupNotices.targetWorlds')}
            value={targetWorlds.join(', ')}
            onChange={(e) => setTargetWorlds(e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
            fullWidth
            placeholder={t('ingamePopupNotices.targetWorldsPlaceholder')}
            helperText={t('ingamePopupNotices.targetWorldsHelp')}
          />

          {/* Target Markets */}
          <TextField
            label={t('ingamePopupNotices.targetMarkets')}
            value={targetMarkets.join(', ')}
            onChange={(e) => setTargetMarkets(e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
            fullWidth
            placeholder={t('ingamePopupNotices.targetMarketsPlaceholder')}
            helperText={t('ingamePopupNotices.targetMarketsHelp')}
          />

          {/* Target Client Versions */}
          <TextField
            label={t('ingamePopupNotices.targetClientVersions')}
            value={targetClientVersions.join(', ')}
            onChange={(e) => setTargetClientVersions(e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
            fullWidth
            placeholder={t('ingamePopupNotices.targetClientVersionsPlaceholder')}
            helperText={t('ingamePopupNotices.targetClientVersionsHelp')}
          />

          {/* Target Account IDs */}
          <TextField
            label={t('ingamePopupNotices.targetAccountIds')}
            value={targetAccountIds.join(', ')}
            onChange={(e) => setTargetAccountIds(e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
            fullWidth
            placeholder={t('ingamePopupNotices.targetAccountIdsPlaceholder')}
            helperText={t('ingamePopupNotices.targetAccountIdsHelp')}
          />

          {/* Date Range */}
          <Box sx={{ display: 'flex', gap: 2, flexDirection: 'column' }}>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <DateTimePicker
                label={t('ingamePopupNotices.startDate')}
                value={startDate}
                onChange={(date) => setStartDate(date)}
                slotProps={{
                  textField: {
                    fullWidth: true,
                    required: true,
                  },
                }}
              />
              <DateTimePicker
                label={t('ingamePopupNotices.endDate')}
                value={endDate}
                onChange={(date) => setEndDate(date)}
                minDateTime={startDate || undefined}
                slotProps={{
                  textField: {
                    fullWidth: true,
                    required: true,
                  },
                }}
              />
            </Box>
            <Typography variant="caption" color="text.secondary" sx={{ ml: 1.75 }}>
              {t('ingamePopupNotices.startDateHelp')} / {t('ingamePopupNotices.endDateHelp')}
            </Typography>
          </Box>

          {/* Display Priority */}
          <TextField
            label={t('ingamePopupNotices.displayPriority')}
            type="number"
            value={displayPriority}
            onChange={(e) => setDisplayPriority(parseInt(e.target.value) || 100)}
            fullWidth
            helperText={t('ingamePopupNotices.displayPriorityHelp')}
          />

          {/* Show Once */}
          <Box>
            <FormControlLabel
              control={
                <Switch
                  checked={showOnce}
                  onChange={(e) => setShowOnce(e.target.checked)}
                />
              }
              label={t('ingamePopupNotices.showOnce')}
            />
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', ml: 4, mt: 0.5 }}>
              {t('ingamePopupNotices.showOnceHelp')}
            </Typography>
          </Box>

          {/* Use Template */}
          <Box>
            <FormControlLabel
              control={
                <Switch
                  checked={useTemplate}
                  onChange={(e) => setUseTemplate(e.target.checked)}
                />
              }
              label={t('ingamePopupNotices.useTemplate')}
            />
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', ml: 4, mt: 0.5 }}>
              {t('ingamePopupNotices.useTemplateHelp')}
            </Typography>
          </Box>

          {/* Message Template Selection */}
          {useTemplate && (
            <FormControl fullWidth>
              <InputLabel>{t('ingamePopupNotices.messageTemplate')}</InputLabel>
              <Select
                value={messageTemplateId || ''}
                onChange={(e) => setMessageTemplateId(e.target.value as number)}
                label={t('ingamePopupNotices.messageTemplate')}
              >
                <MenuItem value="">
                  <em>{t('ingamePopupNotices.selectTemplate')}</em>
                </MenuItem>
                {templates.map((template) => (
                  <MenuItem key={template.id} value={template.id}>
                    {template.name}
                  </MenuItem>
                ))}
              </Select>
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, ml: 1.75 }}>
                {t('ingamePopupNotices.messageTemplateHelp')}
              </Typography>
            </FormControl>
          )}

          {/* Content */}
          <TextField
            label={t('ingamePopupNotices.content')}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            fullWidth
            required
            multiline
            rows={6}
            disabled={useTemplate && !!messageTemplateId}
            placeholder={t('ingamePopupNotices.contentPlaceholder')}
            helperText={t('ingamePopupNotices.contentHelp')}
          />

          {/* Description */}
          <TextField
            label={t('ingamePopupNotices.description')}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            fullWidth
            multiline
            rows={2}
            helperText={t('ingamePopupNotices.descriptionHelp')}
          />
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
          {notice ? t('common.update') : t('common.create')}
        </Button>
      </Box>
    </Drawer>
  );
};

export default IngamePopupNoticeFormDialog;


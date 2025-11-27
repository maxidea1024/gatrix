import React, { useState, useEffect } from 'react';
import {
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
  Paper,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import ResizableDrawer from '../common/ResizableDrawer';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import dayjs, { Dayjs } from 'dayjs';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import { usePlatformConfig } from '../../contexts/PlatformConfigContext';
import { useGameWorld } from '../../contexts/GameWorldContext';
import {
  IngamePopupNotice,
  CreateIngamePopupNoticeData,
  UpdateIngamePopupNoticeData,
} from '../../services/ingamePopupNoticeService';
import ingamePopupNoticeService from '../../services/ingamePopupNoticeService';
import { messageTemplateService, MessageTemplate } from '../../services/messageTemplateService';
import MultiLanguageMessageInput from '../common/MultiLanguageMessageInput';
import { parseUTCForPicker } from '../../utils/dateFormat';
import TargetSettingsGroup, { ChannelSubchannelData } from './TargetSettingsGroup';

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
  const { platforms, channels } = usePlatformConfig();
  const { worlds } = useGameWorld();
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [isActive, setIsActive] = useState(true);
  const [content, setContent] = useState('');

  // Target settings - Initialize with default values to avoid controlled/uncontrolled component warnings
  const [targetPlatforms, setTargetPlatforms] = useState<string[]>([]);
  const [targetPlatformsInverted, setTargetPlatformsInverted] = useState<boolean>(false);
  const [targetChannelSubchannels, setTargetChannelSubchannels] = useState<ChannelSubchannelData[]>([]);
  const [targetChannelSubchannelsInverted, setTargetChannelSubchannelsInverted] = useState<boolean>(false);
  const [targetWorlds, setTargetWorlds] = useState<string[]>([]);
  const [targetWorldsInverted, setTargetWorldsInverted] = useState<boolean>(false);

  // User ID targeting
  const [targetUserIds, setTargetUserIds] = useState<string>('');
  const [targetUserIdsInverted, setTargetUserIdsInverted] = useState<boolean>(false);

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

      // Convert targetChannels/targetSubchannels to targetChannelSubchannels format
      // targetSubchannels format: "channel:subchannel" (e.g., "official:global", "official:asia")
      const targetChannelSubchannels: ChannelSubchannelData[] = [];
      const targetChannels = notice.targetChannels || [];
      const targetSubchannels = notice.targetSubchannels || [];

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

      setTargetPlatforms(notice.targetPlatforms || []);
      setTargetPlatformsInverted(notice.targetPlatformsInverted || false);
      setTargetChannelSubchannels(targetChannelSubchannels);
      setTargetChannelSubchannelsInverted(notice.targetChannelSubchannelsInverted || false);
      setTargetWorlds(notice.targetWorlds || []);
      setTargetWorldsInverted(notice.targetWorldsInverted || false);
      setTargetUserIds((notice as any).targetUserIds || '');
      setTargetUserIdsInverted((notice as any).targetUserIdsInverted || false);

      setDisplayPriority(notice.displayPriority);
      setShowOnce(notice.showOnce);
      // Parse UTC time and convert to user's timezone for display
      setStartDate(parseUTCForPicker(notice.startDate));
      setEndDate(parseUTCForPicker(notice.endDate));
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
      setTargetPlatforms([]);
      setTargetPlatformsInverted(false);
      setTargetChannelSubchannels([]);
      setTargetChannelSubchannelsInverted(false);
      setTargetWorlds([]);
      setTargetWorldsInverted(false);
      setTargetUserIds('');
      setTargetUserIdsInverted(false);
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

    // Note: endDate is now optional - null means no end date (permanent notice)

    setSubmitting(true);

    try {
      // Convert targetChannelSubchannels to targetChannels and targetSubchannels for API
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

      const data: CreateIngamePopupNoticeData | UpdateIngamePopupNoticeData = {
        isActive,
        content: content.trim(),
        targetPlatforms: targetPlatforms.length > 0 ? targetPlatforms : null,
        targetPlatformsInverted: targetPlatformsInverted,
        targetChannels: targetChannels.length > 0 ? targetChannels : null,
        targetChannelsInverted: targetChannelSubchannelsInverted,
        targetSubchannels: targetSubchannels.length > 0 ? targetSubchannels : null,
        targetSubchannelsInverted: targetChannelSubchannelsInverted,
        targetWorlds: targetWorlds.length > 0 ? targetWorlds : null,
        targetWorldsInverted: targetWorldsInverted,
        targetUserIds: targetUserIds.trim() || null,
        targetUserIdsInverted: targetUserIdsInverted,
        displayPriority,
        showOnce,
        // Convert local time to UTC (12:00 KST -> 03:00 UTC)
        startDate: startDate ? startDate.toISOString() : null,
        endDate: endDate ? endDate.toISOString() : null,
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



  return (
    <ResizableDrawer
      open={open}
      onClose={onClose}
      title={notice ? t('ingamePopupNotices.editNotice') : t('ingamePopupNotices.createNotice')}
      subtitle={notice ? t('ingamePopupNotices.editNoticeSubtitle') : t('ingamePopupNotices.createNoticeSubtitle')}
      storageKey="ingamePopupNoticeFormDrawerWidth"
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

          {/* Target Settings Group */}
          <Paper sx={{ p: 2, bgcolor: 'background.default' }}>
            <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 600 }}>
              {t('common.targetSettings')}
            </Typography>
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
              targetUserIds={targetUserIds}
              targetUserIdsInverted={targetUserIdsInverted}
              onUserIdsChange={(ids) => {
                setTargetUserIds(ids);
              }}
              onUserIdsInvertedChange={(inverted) => {
                setTargetUserIdsInverted(inverted);
              }}
              showUserIdFilter={true}
            />
          </Paper>



          {/* Date Range */}
          <Box sx={{ display: 'flex', gap: 2, flexDirection: 'column' }}>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <DateTimePicker
                label={t('ingamePopupNotices.startDate')}
                value={startDate}
                onChange={(date) => setStartDate(date)}
                timeSteps={{ minutes: 1 }}
                readOnly
                slotProps={{
                  textField: {
                    fullWidth: true,
                    required: false,
                  },
                  actionBar: {
                    actions: ['clear', 'cancel', 'accept'],
                  },
                }}
              />
              <DateTimePicker
                label={t('ingamePopupNotices.endDate')}
                value={endDate}
                onChange={(date) => setEndDate(date)}
                minDateTime={startDate || undefined}
                timeSteps={{ minutes: 1 }}
                readOnly
                slotProps={{
                  textField: {
                    fullWidth: true,
                    required: false,
                  },
                  actionBar: {
                    actions: ['clear', 'cancel', 'accept'],
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
    </ResizableDrawer>
  );
};

export default IngamePopupNoticeFormDialog;


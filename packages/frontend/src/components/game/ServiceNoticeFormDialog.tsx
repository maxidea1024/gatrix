import React, { useState, useEffect, useMemo } from 'react';
import {
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Switch,
  Box,
  Typography,
  Chip,
  OutlinedInput,
  SelectChangeEvent,
  Paper,
  Stack,
  Divider,
  IconButton,
  AppBar,
  Toolbar,
} from '@mui/material';
import { Visibility as VisibilityIcon, Close as CloseIcon } from '@mui/icons-material';
import ResizableDrawer from '../common/ResizableDrawer';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import dayjs, { Dayjs } from 'dayjs';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import { ServiceNotice, CreateServiceNoticeData, UpdateServiceNoticeData } from '../../services/serviceNoticeService';
import RichTextEditor from '../mailbox/RichTextEditor';
import { parseUTCForPicker } from '../../utils/dateFormat';
import TargetSettingsGroup, { ChannelSubchannelData } from './TargetSettingsGroup';
import { usePlatformConfig } from '../../contexts/PlatformConfigContext';

interface ServiceNoticeFormDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  notice?: ServiceNotice | null;
}

const PLATFORMS = ['pc', 'pc-wegame', 'ios', 'android', 'harmonyos'];
const CATEGORIES = ['maintenance', 'event', 'notice', 'promotion', 'other'];

const ServiceNoticeFormDialog: React.FC<ServiceNoticeFormDialogProps> = ({
  open,
  onClose,
  onSuccess,
  notice,
}) => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const { platforms: platformConfig, channels: channelConfig } = usePlatformConfig();
  const [submitting, setSubmitting] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  // Form state
  const [isActive, setIsActive] = useState(true);
  const [category, setCategory] = useState<string>('notice');
  const [platforms, setPlatforms] = useState<string[]>([]);
  const [platformsInverted, setPlatformsInverted] = useState(false);
  const [channelSubchannels, setChannelSubchannels] = useState<ChannelSubchannelData[]>([]);
  const [channelSubchannelsInverted, setChannelSubchannelsInverted] = useState(false);
  const [startDate, setStartDate] = useState<Dayjs | null>(null);
  const [endDate, setEndDate] = useState<Dayjs | null>(null);
  const [tabTitle, setTabTitle] = useState('');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [description, setDescription] = useState('');

  // Debounced preview values to prevent flickering
  const [debouncedTabTitle, setDebouncedTabTitle] = useState(tabTitle);
  const [debouncedTitle, setDebouncedTitle] = useState(title);
  const [debouncedContent, setDebouncedContent] = useState(content);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedTabTitle(tabTitle);
      setDebouncedTitle(title);
      setDebouncedContent(content);
    }, 500);

    return () => clearTimeout(timer);
  }, [tabTitle, title, content]);

  // Generate preview HTML
  const previewHtml = useMemo(() => {
    // Use tabTitle if available, otherwise use title
    const displayTitle = debouncedTabTitle.trim() || debouncedTitle || t('serviceNotices.noTitle');

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * {
      box-sizing: border-box;
    }
    html, body {
      margin: 0;
      padding: 0;
      width: 100%;
      height: 100%;
      overflow-x: hidden;
    }
    body {
      padding: 16px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      font-size: 14px;
      line-height: 1.42;
      color: #333;
      background-color: #fff;
    }
    .title {
      font-size: 18px;
      font-weight: 600;
      margin: 0 0 16px 0;
      color: #000;
    }
    .content {
      margin-top: 16px;
      font-size: 14px;
      line-height: 1.42;
      box-sizing: border-box;
      outline: none;
    }

    /* Quill editor exact styles */
    .content > * {
      cursor: text;
    }
    .content p,
    .content ol,
    .content ul,
    .content pre,
    .content blockquote,
    .content h1,
    .content h2,
    .content h3,
    .content h4,
    .content h5,
    .content h6 {
      margin: 0;
      padding: 0;
      counter-reset: list-1 list-2 list-3 list-4 list-5 list-6 list-7 list-8 list-9;
    }
    .content ol,
    .content ul {
      padding-left: 1.5em;
    }
    .content ol > li,
    .content ul > li {
      list-style-type: none;
    }
    .content ul > li::before {
      content: '\\2022';
    }
    .content li::before {
      display: inline-block;
      white-space: nowrap;
      width: 1.2em;
    }
    .content li:not(.ql-direction-rtl)::before {
      margin-left: -1.5em;
      margin-right: 0.3em;
      text-align: right;
    }
    .content ol li {
      counter-reset: list-1 list-2 list-3 list-4 list-5 list-6 list-7 list-8 list-9;
      counter-increment: list-0;
    }
    .content ol li:before {
      content: counter(list-0, decimal) '. ';
    }
    .content h1 {
      font-size: 2em;
    }
    .content h2 {
      font-size: 1.5em;
    }
    .content h3 {
      font-size: 1.17em;
    }
    .content strong {
      font-weight: bold;
    }
    .content em {
      font-style: italic;
    }
    .content u {
      text-decoration: underline;
    }
    .content s {
      text-decoration: line-through;
    }
    .content a {
      color: #06c;
      text-decoration: underline;
    }
    /* Image styles - respect inline styles from editor */
    .content img {
      display: block;
      margin: 0;
    }
    /* Preserve empty paragraphs for blank lines - match Quill editor spacing */
    .content p {
      min-height: 1em;
      margin: 0;
      padding: 0;
    }
    .content p:empty {
      min-height: 1em;
    }
    /* Remove margin from paragraphs containing only images */
    .content p:has(> img:only-child) {
      margin: 0;
      padding: 0;
    }
    .content blockquote {
      border-left: 4px solid #ccc;
      margin-bottom: 5px;
      margin-top: 5px;
      padding-left: 16px;
    }
    .content pre {
      background-color: #f0f0f0;
      border-radius: 3px;
      white-space: pre-wrap;
      margin-bottom: 5px;
      margin-top: 5px;
      padding: 5px 10px;
    }
    .content code {
      background-color: #f0f0f0;
      border-radius: 3px;
      font-size: 85%;
      padding: 2px 4px;
    }
  </style>
</head>
<body>
  <div class="title">${displayTitle}</div>
  <div class="content">
    ${debouncedContent || `<p style="color: #999;">${t('serviceNotices.noContent')}</p>`}
  </div>
</body>
</html>
    `;
    return htmlContent;
  }, [debouncedTabTitle, debouncedTitle, debouncedContent, t]);

  // Initialize form with notice data
  useEffect(() => {
    if (notice) {
      setIsActive(notice.isActive);
      setCategory(notice.category);
      setPlatforms(notice.platforms);
      setPlatformsInverted(false);
      // Convert channels and subchannels to ChannelSubchannelData format
      const channelMap = new Map<string, Set<string>>();
      if (notice.channels && Array.isArray(notice.channels)) {
        notice.channels.forEach(channel => {
          channelMap.set(channel, new Set());
        });
      }
      if (notice.subchannels && Array.isArray(notice.subchannels)) {
        notice.subchannels.forEach(subchannel => {
          const [channel, subch] = subchannel.split(':');
          if (!channelMap.has(channel)) {
            channelMap.set(channel, new Set());
          }
          channelMap.get(channel)!.add(subch);
        });
      }
      const channelSubchannelData: ChannelSubchannelData[] = Array.from(channelMap.entries()).map(([channel, subchannels]) => ({
        channel,
        subchannels: Array.from(subchannels),
      }));
      setChannelSubchannels(channelSubchannelData);
      setChannelSubchannelsInverted(false);
      // Parse UTC time and convert to user's timezone for display
      setStartDate(parseUTCForPicker(notice.startDate));
      setEndDate(parseUTCForPicker(notice.endDate));
      setTabTitle(notice.tabTitle || '');
      setTitle(notice.title);
      setContent(notice.content);
      setDescription(notice.description || '');
    } else {
      // Reset form
      setIsActive(true);
      setCategory('notice');
      setPlatforms([]);
      setPlatformsInverted(false);
      setChannelSubchannels([]);
      setChannelSubchannelsInverted(false);
      setStartDate(null);
      setEndDate(null);
      setTabTitle('');
      setTitle('');
      setContent('');
      setDescription('');
    }
  }, [notice, open]);

  const handleSubmit = async () => {
    // Validation
    if (!category) {
      enqueueSnackbar(t('serviceNotices.categoryRequired'), { variant: 'error' });
      return;
    }

    // Note: platforms is optional - empty array means "all platforms"
    // Note: endDate is now optional - null means no end date (permanent notice)

    if (!title.trim()) {
      enqueueSnackbar(t('serviceNotices.titleRequired'), { variant: 'error' });
      return;
    }

    if (!content.trim()) {
      enqueueSnackbar(t('serviceNotices.contentRequired'), { variant: 'error' });
      return;
    }

    setSubmitting(true);

    try {
      const trimmedTabTitle = tabTitle.trim();
      const trimmedDescription = description.trim();

      // Convert ChannelSubchannelData to channels and subchannels arrays
      const channels: string[] = [];
      const subchannels: string[] = [];
      channelSubchannels.forEach(item => {
        if (!channels.includes(item.channel)) {
          channels.push(item.channel);
        }
        item.subchannels.forEach(subchannel => {
          const subchannelKey = `${item.channel}:${subchannel}`;
          if (!subchannels.includes(subchannelKey)) {
            subchannels.push(subchannelKey);
          }
        });
      });

      const data: CreateServiceNoticeData | UpdateServiceNoticeData = {
        isActive,
        category: category as any,
        platforms,
        channels: channels.length > 0 ? channels : null,
        subchannels: subchannels.length > 0 ? subchannels : null,
        startDate: startDate ? startDate.toISOString() : null,
        endDate: endDate ? endDate.toISOString() : null,
        tabTitle: trimmedTabTitle ? trimmedTabTitle : null,
        title: title.trim(),
        content: content.trim(),
        description: trimmedDescription ? trimmedDescription : null,
      };

      if (notice) {
        await import('../../services/serviceNoticeService').then(m => 
          m.default.updateServiceNotice(notice.id, data)
        );
        enqueueSnackbar(t('serviceNotices.updateSuccess'), { variant: 'success' });
      } else {
        await import('../../services/serviceNoticeService').then(m => 
          m.default.createServiceNotice(data as CreateServiceNoticeData)
        );
        enqueueSnackbar(t('serviceNotices.createSuccess'), { variant: 'success' });
      }

      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Error saving service notice:', error);
      enqueueSnackbar(error.message || t('serviceNotices.saveFailed'), { variant: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ResizableDrawer
      open={open}
      onClose={onClose}
      title={notice ? t('serviceNotices.editNotice') : t('serviceNotices.createNotice')}
      subtitle={notice ? t('serviceNotices.editNoticeSubtitle') : t('serviceNotices.createNoticeSubtitle')}
      storageKey="serviceNoticeFormDrawerWidth"
      defaultWidth={800}
      minWidth={600}
      zIndex={1300}
    >
      {/* Content */}
      <Box
        sx={{
          p: 3,
          flexGrow: 1,
          overflow: 'auto',
          // Chat message list scrollbar style
          '&::-webkit-scrollbar': {
            width: '8px',
          },
          '&::-webkit-scrollbar-track': {
            background: 'transparent',
          },
          '&::-webkit-scrollbar-thumb': {
            background: (theme) =>
              theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)',
            borderRadius: '4px',
          },
          '&::-webkit-scrollbar-thumb:hover': {
            background: (theme) =>
              theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.3)',
          },
          '&::-webkit-scrollbar-thumb:active': {
            background: (theme) =>
              theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.4)',
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
              label={t('serviceNotices.isActive')}
            />
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', ml: 4, mt: 0.5 }}>
              {t('serviceNotices.isActiveHelp')}
            </Typography>
          </Box>

          {/* Target Settings (Platform + Channel/Subchannel) */}
          <TargetSettingsGroup
            targetPlatforms={platforms}
            targetPlatformsInverted={platformsInverted}
            platforms={platformConfig}
            onPlatformsChange={(newPlatforms, inverted) => {
              setPlatforms(newPlatforms);
              setPlatformsInverted(inverted);
            }}
            targetChannelSubchannels={channelSubchannels}
            targetChannelSubchannelsInverted={channelSubchannelsInverted}
            channels={channelConfig}
            onChannelsChange={(newChannels, inverted) => {
              setChannelSubchannels(newChannels);
              setChannelSubchannelsInverted(inverted);
            }}
            targetWorlds={[]}
            targetWorldsInverted={false}
            worlds={[]}
            onWorldsChange={() => {}}
            showUserIdFilter={false}
            showWorldFilter={false}
          />

          {/* Date Range */}
          <Box sx={{ display: 'flex', gap: 2, flexDirection: 'column' }}>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <DateTimePicker
                label={t('serviceNotices.startDate')}
                value={startDate}
                onChange={(date) => setStartDate(date)}
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
                label={t('serviceNotices.endDate')}
                value={endDate}
                onChange={(date) => setEndDate(date)}
                minDateTime={startDate || undefined}
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
              {t('serviceNotices.startDateHelp')} / {t('serviceNotices.endDateHelp')}
            </Typography>
          </Box>

          {/* Category and Title in one row */}
          <Box>
            <Box sx={{ display: 'flex', gap: 2 }}>
              {/* Category */}
              <FormControl required sx={{ minWidth: 200 }}>
                <InputLabel>{t('serviceNotices.category')}</InputLabel>
                <Select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  label={t('serviceNotices.category')}
                >
                  {CATEGORIES.map((cat) => (
                    <MenuItem key={cat} value={cat}>
                      {t(`serviceNotices.categories.${cat}`)}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              {/* Title */}
              <TextField
                label={t('serviceNotices.noticeTitle')}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                fullWidth
                required
              />
            </Box>
            <Typography variant="caption" color="text.secondary" sx={{ ml: 1.75 }}>
              {t('serviceNotices.categoryHelp')} / {t('serviceNotices.noticeTitleHelp')}
            </Typography>
          </Box>

          {/* Tab Title (Optional) - Below Title */}
          <TextField
            label={t('serviceNotices.tabTitle')}
            value={tabTitle}
            onChange={(e) => setTabTitle(e.target.value)}
            fullWidth
            helperText={t('serviceNotices.tabTitleHelp')}
          />

          {/* Content (Rich Text) */}
          <Box>
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="subtitle2" gutterBottom sx={{ mb: 1.5, fontWeight: 600 }}>
                {t('serviceNotices.content')} <span style={{ color: 'error.main' }}>*</span>
              </Typography>
              <RichTextEditor
                value={content}
                onChange={setContent}
                placeholder={t('serviceNotices.contentPlaceholder')}
                minHeight={200}
              />
            </Paper>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5, ml: 1.75 }}>
              {t('serviceNotices.contentHelp')}
            </Typography>
          </Box>

          {/* Description (Optional) */}
          <TextField
            label={t('serviceNotices.description')}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            fullWidth
            multiline
            rows={3}
            helperText={t('serviceNotices.descriptionHelp')}
          />

          {/* Preview Section */}
          <Box>
            <Button
              variant="outlined"
              startIcon={<VisibilityIcon />}
              onClick={() => setShowPreview(!showPreview)}
              fullWidth
            >
              {showPreview ? t('serviceNotices.hidePreview') : t('serviceNotices.showPreview')}
            </Button>

            {showPreview && (
              <Paper
                variant="outlined"
                sx={{
                  mt: 2,
                  p: 0,
                  height: 400,
                  overflow: 'auto',
                }}
              >
                <iframe
                  srcDoc={previewHtml}
                  style={{
                    width: '100%',
                    height: '100%',
                    border: 'none',
                  }}
                  title="Notice Preview"
                />
              </Paper>
            )}
          </Box>
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

export default ServiceNoticeFormDialog;


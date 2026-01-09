import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  Alert,
  AlertTitle,
} from '@mui/material';
import { Close as CloseIcon, ChevronRight as ChevronRightIcon, ChevronLeft as ChevronLeftIcon } from '@mui/icons-material';
import ResizableDrawer from '../common/ResizableDrawer';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import dayjs, { Dayjs } from 'dayjs';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import { useNavigate } from 'react-router-dom';
import { showChangeRequestCreatedToast } from '../../utils/changeRequestToast';
import { getActionLabel } from '../../utils/changeRequestToast';
import { useEnvironment } from '../../contexts/EnvironmentContext';
import { ServiceNotice, CreateServiceNoticeData, UpdateServiceNoticeData } from '../../services/serviceNoticeService';
import RichTextEditor from '../mailbox/RichTextEditor';
import { parseUTCForPicker } from '../../utils/dateFormat';
import TargetSettingsGroup, { ChannelSubchannelData } from './TargetSettingsGroup';
import { usePlatformConfig } from '../../contexts/PlatformConfigContext';
import { parseApiErrorMessage } from '../../utils/errorUtils';
import { useEntityLock } from '../../hooks/useEntityLock';

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
  const { enqueueSnackbar, closeSnackbar } = useSnackbar();
  const navigate = useNavigate();
  const { currentEnvironment } = useEnvironment();
  const requiresApproval = currentEnvironment?.requiresApproval ?? false;
  const { platforms: platformConfig, channels: channelConfig } = usePlatformConfig();
  const [submitting, setSubmitting] = useState(false);
  const [previewCollapsed, setPreviewCollapsed] = useState(true); // Default: collapsed

  // Entity Lock for edit mode
  const { hasLock, lockedBy, pendingCR, forceTakeover } = useEntityLock({
    table: 'g_service_notices',
    entityId: notice?.id || null,
    isEditing: open && !!notice,
    // onLockLost is called when lock is taken - toast is now handled by useEntityLock via SSE
  });

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

  // Ref to track initial content after Quill normalization
  const initialContentRef = useRef<string | null>(null);

  // Debounced preview values to prevent flickering
  const [debouncedTabTitle, setDebouncedTabTitle] = useState(tabTitle);
  const [debouncedTitle, setDebouncedTitle] = useState(title);
  const [debouncedContent, setDebouncedContent] = useState(content);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedTabTitle(tabTitle);
      setDebouncedTitle(title);
      setDebouncedContent(content);
      // Debug: Log content to see if styles are included
      if (content) {
        console.log('Preview HTML content:', content);
      }
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
      font-family: "Microsoft YaHei", "微软雅黑", "Source Han Sans SC", "思源黑体", "Noto Sans SC", "PingFang SC", "Hiragino Sans GB", -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      font-size: 14px;
      line-height: 1.42;
      color: #333;
      background-color: #fff;
    }
    .title {
      font-size: 18px;
      font-weight: 600;
      margin: 0 0 12px 0;
      color: #000;
    }
    .title-divider {
      border: none;
      border-top: 1px solid #e0e0e0;
      margin: 0 0 16px 0;
    }
    .content {
      margin-top: 0;
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
    
    /* Heading styles - Quill classes */
    .content h1,
    .content .ql-size-huge {
      font-size: 2em;
    }
    .content h2,
    .content .ql-size-large {
      font-size: 1.5em;
    }
    .content h3 {
      font-size: 1.17em;
    }
    
    /* Quill size classes */
    .content .ql-size-small {
      font-size: 0.75em;
    }
    .content .ql-size-large {
      font-size: 1.5em;
    }
    .content .ql-size-huge {
      font-size: 2.5em;
    }
    
    /* Quill font classes */
    .content .ql-font-serif {
      font-family: Georgia, "Times New Roman", serif;
    }
    .content .ql-font-monospace {
      font-family: Monaco, "Courier New", monospace;
    }
    
    /* Quill alignment classes */
    .content .ql-align-center {
      text-align: center;
    }
    .content .ql-align-right {
      text-align: right;
    }
    .content .ql-align-justify {
      text-align: justify;
    }
    
    /* Quill indent classes */
    .content .ql-indent-1 {
      padding-left: 3em;
    }
    .content .ql-indent-2 {
      padding-left: 6em;
    }
    .content .ql-indent-3 {
      padding-left: 9em;
    }
    .content .ql-indent-4 {
      padding-left: 12em;
    }
    .content .ql-indent-5 {
      padding-left: 15em;
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
    /* Ensure images and videos don't overflow */
    .content img {
      max-width: 100%;
      height: auto;
    }
    .content iframe {
      max-width: 100%;
    }
    .content .video-wrapper {
      max-width: 100%;
    }
    
    /* Text animation effects */
    @keyframes ql-blink {
      0%, 100% { opacity: 1; }
      50% { opacity: 0; }
    }
    @keyframes ql-pulse {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.05); }
    }
    @keyframes ql-shake {
      0%, 100% { transform: translateX(0); }
      25% { transform: translateX(-3px); }
      75% { transform: translateX(3px); }
    }
    @keyframes ql-bounce {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-5px); }
    }
    @keyframes ql-glow-pulse {
      0%, 100% { text-shadow: 0 0 5px currentColor, 0 0 10px currentColor; }
      50% { text-shadow: 0 0 20px currentColor, 0 0 30px currentColor, 0 0 40px currentColor; }
    }
    @keyframes ql-rainbow {
      0% { background-position: 0% center; }
      100% { background-position: 200% center; }
    }
    @keyframes ql-float {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-8px); }
    }
    @keyframes ql-jelly {
      0%, 100% { transform: scale(1, 1); }
      25% { transform: scale(0.95, 1.05); }
      50% { transform: scale(1.05, 0.95); }
      75% { transform: scale(0.95, 1.05); }
    }
    @keyframes ql-swing {
      0%, 100% { transform: rotate(0deg); }
      25% { transform: rotate(5deg); }
      75% { transform: rotate(-5deg); }
    }
    @keyframes ql-heartbeat {
      0%, 100% { transform: scale(1); }
      14% { transform: scale(1.15); }
      28% { transform: scale(1); }
      42% { transform: scale(1.15); }
      70% { transform: scale(1); }
    }
    
    /* Page background color wrapper */
    .page-background {
      border-radius: 4px;
    }
  </style>
</head>
<body>
  <div class="title">${displayTitle}</div>
  <hr class="title-divider" />
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
      // Reset initialContentRef - will be set on first RichTextEditor onChange
      initialContentRef.current = null;
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

  // Check if form is dirty (data changed)
  const isDirty = useMemo(() => {
    if (!notice) return true;

    // Current State -> Data Payload
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

    // Format date to minute precision for comparison (ignore seconds/milliseconds)
    const formatDateForCompare = (date: Dayjs | null) =>
      date ? date.format('YYYY-MM-DDTHH:mm') : null;
    const formatStringDateForCompare = (dateStr: string | null) =>
      dateStr ? dayjs(dateStr).format('YYYY-MM-DDTHH:mm') : null;

    const currentData = {
      isActive,
      category,
      platforms: [...platforms].sort(),
      channels: channels.length > 0 ? [...channels].sort() : null,
      subchannels: subchannels.length > 0 ? [...subchannels].sort() : null,
      startDate: formatDateForCompare(startDate),
      endDate: formatDateForCompare(endDate),
      tabTitle: tabTitle.trim() || null,
      title: title.trim(),
      content: content.trim(),
      description: description.trim() || null,
    };

    const originalData = {
      isActive: notice.isActive,
      category: notice.category,
      platforms: [...(notice.platforms || [])].sort(),
      channels: notice.channels ? [...notice.channels].sort() : null,
      subchannels: notice.subchannels ? [...notice.subchannels].sort() : null,
      startDate: formatStringDateForCompare(notice.startDate),
      endDate: formatStringDateForCompare(notice.endDate),
      tabTitle: notice.tabTitle?.trim() || null,
      title: notice.title?.trim() || '',
      content: initialContentRef.current?.trim() || notice.content?.trim() || '',
      description: notice.description?.trim() || null,
    };

    return JSON.stringify(currentData) !== JSON.stringify(originalData);
  }, [notice, isActive, category, platforms, channelSubchannels, startDate, endDate, tabTitle, title, content, description]);

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

    // Check if content is empty (excluding HTML tags)
    const strippedContent = content.replace(/<[^>]*>/g, '').trim();
    if (!strippedContent && !content.includes('<img') && !content.includes('<iframe')) {
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
        const result = await import('../../services/serviceNoticeService').then(m =>
          m.default.updateServiceNotice(notice.id, data)
        );
        if (result.isChangeRequest) {
          showChangeRequestCreatedToast(enqueueSnackbar, closeSnackbar, navigate);
        } else {
          enqueueSnackbar(t('serviceNotices.updateSuccess'), { variant: 'success' });
        }
      } else {
        const result = await import('../../services/serviceNoticeService').then(m =>
          m.default.createServiceNotice(data as CreateServiceNoticeData)
        );
        if (result.isChangeRequest) {
          showChangeRequestCreatedToast(enqueueSnackbar, closeSnackbar, navigate);
        } else {
          enqueueSnackbar(t('serviceNotices.createSuccess'), { variant: 'success' });
        }
      }

      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Error saving service notice:', error);
      const fallbackKey = requiresApproval ? 'serviceNotices.requestSaveFailed' : 'serviceNotices.saveFailed';
      enqueueSnackbar(parseApiErrorMessage(error, fallbackKey), { variant: 'error' });
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
      defaultWidth={1000}
      minWidth={800}
      zIndex={1300}
    >
      {/* Content */}
      <Box
        data-resizable-container
        sx={{
          flexGrow: 1,
          overflow: 'hidden',
          display: 'flex',
          position: 'relative',
        }}
      >
        {/* Toggle Button - At the divider position */}
        <IconButton
          onClick={() => setPreviewCollapsed(!previewCollapsed)}
          sx={{
            position: 'absolute',
            left: previewCollapsed ? 'calc(100% - 20px)' : '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 10,
            bgcolor: (theme) => theme.palette.background.paper,
            boxShadow: 2,
            '&:hover': {
              bgcolor: (theme) => theme.palette.action.hover,
            },
          }}
        >
          {previewCollapsed ? <ChevronLeftIcon /> : <ChevronRightIcon />}
        </IconButton>

        {/* Left Panel: Edit Form */}
        <Box
          sx={{
            width: previewCollapsed ? 'calc(100% - 40px)' : '50%',
            height: '100%',
            overflow: 'auto',
            p: 3,
            transition: 'width 0.3s ease-in-out',
          }}
        >
          <Stack spacing={3}>
            {/* Lock Warning */}
            {notice && lockedBy && !hasLock && (
              <Alert
                severity="warning"
                action={
                  <Button color="inherit" size="small" onClick={forceTakeover}>
                    {t('entityLock.takeOver')}
                  </Button>
                }
              >
                <AlertTitle>{t('entityLock.warning', { userName: lockedBy.userName, userEmail: lockedBy.userEmail })}</AlertTitle>
              </Alert>
            )}

            {/* Pending CR Warning */}
            {notice && pendingCR && (
              <Alert severity="info">
                <AlertTitle>{t('entityLock.pendingCR')}</AlertTitle>
                {t('entityLock.pendingCRDetail', { crTitle: pendingCR.crTitle, crId: pendingCR.crId })}
              </Alert>
            )}

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
              onWorldsChange={() => { }}
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
                  timeSteps={{ minutes: 1 }}
                  slotProps={{
                    textField: {
                      fullWidth: true,
                      required: false,
                      slotProps: { input: { readOnly: true } },
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
                  timeSteps={{ minutes: 1 }}
                  slotProps={{
                    textField: {
                      fullWidth: true,
                      required: false,
                      slotProps: { input: { readOnly: true } },
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
                  onChange={(val) => {
                    // Capture first content change as baseline for isDirty comparison
                    if (notice && initialContentRef.current === null) {
                      initialContentRef.current = val;
                    }
                    setContent(val);
                  }}
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
          </Stack>
        </Box>

        {/* Divider */}
        {!previewCollapsed && (
          <Box
            sx={{
              width: '1px',
              height: '100%',
              bgcolor: (theme) => theme.palette.divider,
              flexShrink: 0,
            }}
          />
        )}

        {/* Right Panel: Preview */}
        <Box
          sx={{
            width: previewCollapsed ? '40px' : '50%',
            height: '100%',
            overflow: previewCollapsed ? 'visible' : 'auto',
            p: previewCollapsed ? 0 : 3,
            bgcolor: (theme) =>
              theme.palette.mode === 'dark' ? 'rgba(0, 0, 0, 0.2)' : 'rgba(0, 0, 0, 0.02)',
            transition: 'width 0.3s ease-in-out, padding 0.3s ease-in-out',
            position: 'relative',
          }}
        >
          {!previewCollapsed && (
            <>
              <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
                {t('serviceNotices.preview')}
              </Typography>
              <Paper
                variant="outlined"
                sx={{
                  p: 0,
                  height: 'calc(100% - 72px)',
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
            </>
          )}
        </Box>
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
          disabled={submitting || (!!notice && !isDirty)}
        >
          {getActionLabel(notice ? 'update' : 'create', requiresApproval, t)}
        </Button>
      </Box>
    </ResizableDrawer>
  );
};

export default ServiceNoticeFormDialog;


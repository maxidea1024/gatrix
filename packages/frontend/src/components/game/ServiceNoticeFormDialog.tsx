import React, { useState, useEffect, useMemo } from 'react';
import {
  Drawer,
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
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import dayjs, { Dayjs } from 'dayjs';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import { ServiceNotice, CreateServiceNoticeData, UpdateServiceNoticeData } from '../../services/serviceNoticeService';
import RichTextEditor from '../mailbox/RichTextEditor';
import { parseUTCForPicker } from '../../utils/dateFormat';

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
  const [submitting, setSubmitting] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  // Form state
  const [isActive, setIsActive] = useState(true);
  const [category, setCategory] = useState<string>('notice');
  const [platforms, setPlatforms] = useState<string[]>([]);
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
    .content img {
      max-width: 100%;
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
      setStartDate(null);
      setEndDate(null);
      setTabTitle('');
      setTitle('');
      setContent('');
      setDescription('');
    }
  }, [notice, open]);

  const handlePlatformChange = (event: SelectChangeEvent<string[]>) => {
    const value = event.target.value;
    setPlatforms(typeof value === 'string' ? value.split(',') : value);
  };

  const handleSubmit = async () => {
    // Validation
    if (!category) {
      enqueueSnackbar(t('serviceNotices.categoryRequired'), { variant: 'error' });
      return;
    }

    // Note: platforms is optional - empty array means "all platforms"

    if (!startDate || !endDate) {
      enqueueSnackbar(t('serviceNotices.datesRequired'), { variant: 'error' });
      return;
    }

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

      const data: CreateServiceNoticeData | UpdateServiceNoticeData = {
        isActive,
        category: category as any,
        platforms,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
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
              {notice ? t('serviceNotices.editNotice') : t('serviceNotices.createNotice')}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {notice ? t('serviceNotices.editNoticeSubtitle') : t('serviceNotices.createNoticeSubtitle')}
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

          {/* Platforms */}
          <FormControl fullWidth>
            <InputLabel>{t('serviceNotices.platforms')}</InputLabel>
            <Select
              multiple
              value={platforms}
              onChange={handlePlatformChange}
              input={<OutlinedInput label={t('serviceNotices.platforms')} />}
              renderValue={(selected) => (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {selected.length === 0 ? (
                    <Chip label={t('common.all')} size="small" variant="outlined" />
                  ) : (
                    selected.map((value) => (
                      <Chip key={value} label={value} size="small" />
                    ))
                  )}
                </Box>
              )}
            >
              {PLATFORMS.map((platform) => (
                <MenuItem key={platform} value={platform}>
                  {platform}
                </MenuItem>
              ))}
            </Select>
            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, ml: 1.75 }}>
              {t('serviceNotices.platformsHelp')}
            </Typography>
          </FormControl>

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
                    required: true,
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
                    required: true,
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
    </Drawer>
  );
};

export default ServiceNoticeFormDialog;


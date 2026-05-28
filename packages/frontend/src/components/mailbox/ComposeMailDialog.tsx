import React, { useState, useRef, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Button,
  IconButton,
  Typography,
  Autocomplete,
  TextField,
  Chip,
  Avatar,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Stack,
  Divider,
  Paper,
  alpha,
  useTheme,
} from '@mui/material';
import {
  Close as CloseIcon,
  Send as SendIcon,
  Translate as TranslateIcon,
  PersonAdd as PersonAddIcon,
  Flag as FlagIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import RichTextEditor from './RichTextEditor';

interface User {
  id: number;
  name: string;
  email: string;
  avatarUrl?: string;
}

interface ComposeMailDialogProps {
  open: boolean;
  onClose: () => void;
  onSend: (data: {
    recipients: User[];
    subject: string;
    content: string;
    priority: 'low' | 'normal' | 'high' | 'urgent';
    translatedContent?: string;
    translationLanguage?: string;
  }) => Promise<void>;
  onSearchUsers: (query: string) => Promise<User[]>;
  onTranslate: (content: string, targetLang: string) => Promise<string>;
}

const ComposeMailDialog: React.FC<ComposeMailDialogProps> = ({
  open,
  onClose,
  onSend,
  onSearchUsers,
  onTranslate,
}) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const recipientInputRef = useRef<HTMLInputElement>(null);

  // Form state
  const [recipients, setRecipients] = useState<User[]>([]);
  const [subject, setSubject] = useState('');
  const [content, setContent] = useState('');
  const [priority, setPriority] = useState<
    'low' | 'normal' | 'high' | 'urgent'
  >('normal');

  // User search state
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [userSearchResults, setUserSearchResults] = useState<User[]>([]);
  const [userSearching, setUserSearching] = useState(false);

  // Translation state
  const [translationEnabled, setTranslationEnabled] = useState(false);
  const [translatedContent, setTranslatedContent] = useState('');
  const [translationLanguage, setTranslationLanguage] = useState<
    'ko' | 'en' | 'zh'
  >('en');
  const [translating, setTranslating] = useState(false);

  // Sending state
  const [sending, setSending] = useState(false);

  // Search users with debounce
  useEffect(() => {
    if (!userSearchQuery.trim()) {
      setUserSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setUserSearching(true);
      try {
        const results = await onSearchUsers(userSearchQuery);
        setUserSearchResults(results);
      } catch (error) {
        console.error('Failed to search users:', error);
      } finally {
        setUserSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [userSearchQuery, onSearchUsers]);

  // Handle translation
  const handleTranslate = async () => {
    if (!content.trim()) return;

    setTranslating(true);
    try {
      const plainText = content.replace(/<[^>]*>/g, '');
      const translated = await onTranslate(plainText, translationLanguage);
      setTranslatedContent(translated);
      setTranslationEnabled(true);
    } catch (error) {
      console.error('Translation failed:', error);
    } finally {
      setTranslating(false);
    }
  };

  // Handle retranslate
  const handleRetranslate = async () => {
    await handleTranslate();
  };

  // Handle cancel translation
  const handleCancelTranslation = () => {
    setTranslationEnabled(false);
    setTranslatedContent('');
  };

  // Handle send
  const handleSend = async () => {
    if (recipients.length === 0 || !subject.trim() || !content.trim()) {
      return;
    }

    setSending(true);
    try {
      await onSend({
        recipients,
        subject,
        content,
        priority,
        translatedContent: translationEnabled ? translatedContent : undefined,
        translationLanguage: translationEnabled
          ? translationLanguage
          : undefined,
      });
      handleClose();
    } catch (error) {
      console.error('Failed to send mail:', error);
    } finally {
      setSending(false);
    }
  };

  // Handle close
  const handleClose = () => {
    setRecipients([]);
    setSubject('');
    setContent('');
    setPriority('normal');
    setUserSearchQuery('');
    setUserSearchResults([]);
    setTranslationEnabled(false);
    setTranslatedContent('');
    setTranslationLanguage('en');
    onClose();
  };

  // Focus recipient input when dialog opens
  useEffect(() => {
    if (open) {
      setTimeout(() => {
        recipientInputRef.current?.focus();
      }, 100);
    }
  }, [open]);

  // Priority icon and color
  const getPriorityIcon = () => {
    switch (priority) {
      case 'urgent':
        return <FlagIcon sx={{ color: 'error.main', fontSize: 18 }} />;
      case 'high':
        return <FlagIcon sx={{ color: 'warning.main', fontSize: 18 }} />;
      case 'low':
        return <FlagIcon sx={{ color: 'info.main', fontSize: 18 }} />;
      default:
        return <FlagIcon sx={{ color: 'text.disabled', fontSize: 18 }} />;
    }
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 3,
          minHeight: 600,
          maxHeight: '90vh',
          overflow: 'hidden',
        },
      }}
    >
      {/* Header with gradient */}
      <DialogTitle
        sx={{
          borderBottom: `1px solid`,
          borderColor: 'divider',
          pb: 2,
          pt: 2,
        }}
      >
        <Box
          display="flex"
          alignItems="flex-start"
          justifyContent="space-between"
        >
          <Box>
            <Typography
              variant="h6"
              fontWeight="600"
              gutterBottom
            >
              {t('mailbox.compose')}
            </Typography>
            <Typography
              variant="body2"
              color="text.secondary"
            >
              {t('mailbox.composeSubtitle')}
            </Typography>
          </Box>
          <IconButton
            onClick={handleClose}
            size="small"
            sx={{ mt: -0.5 }}
          >
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      {/* Content */}
      <DialogContent sx={{ pt: 3, pb: 2 }}>
        <Stack spacing={2.5}>
          {/* Recipients - Multiple selection with modern styling */}
          <Box>
            <Box
              sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}
            >
              <PersonAddIcon sx={{ color: 'primary.main', fontSize: 20 }} />
              <Typography
                variant="subtitle2"
                fontWeight="600"
                color="text.primary"
              >
                {t('mailbox.recipients')}
              </Typography>
            </Box>
            <Autocomplete
              multiple
              options={userSearchResults}
              value={recipients}
              onChange={(_, newValue) => setRecipients(newValue)}
              inputValue={userSearchQuery}
              onInputChange={(_, newInputValue) =>
                setUserSearchQuery(newInputValue)
              }
              getOptionLabel={(option) => option.name || option.email || ''}
              loading={userSearching}
              renderInput={(params) => (
                <TextField
                  {...params}
                  placeholder={
                    recipients.length === 0
                      ? t('mailbox.recipientsPlaceholder')
                      : ''
                  }
                  required
                  inputRef={recipientInputRef}
                  variant="outlined"
                  size="small"
                  InputProps={{
                    ...params.InputProps,
                    endAdornment: (
                      <>
                        {userSearching ? (
                          <CircularProgress color="inherit" size={20} />
                        ) : null}
                        {params.InputProps.endAdornment}
                      </>
                    ),
                  }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      backgroundColor: theme.palette.background.paper,
                    },
                  }}
                />
              )}
              renderTags={(value, getTagProps) =>
                value.map((option, index) => {
                  const { key, ...tagProps } = getTagProps({ index });
                  return (
                    <Chip
                      key={key}
                      avatar={
                        <Avatar
                          src={option.avatarUrl}
                          sx={{
                            width: 24,
                            height: 24,
                            border: `2px solid ${alpha(theme.palette.primary.main, 0.2)}`,
                          }}
                        >
                          {option.name.charAt(0)}
                        </Avatar>
                      }
                      label={option.name}
                      {...tagProps}
                      sx={{
                        m: 0.5,
                        fontWeight: 500,
                        backgroundColor: alpha(theme.palette.primary.main, 0.1),
                        '&:hover': {
                          backgroundColor: alpha(
                            theme.palette.primary.main,
                            0.2
                          ),
                        },
                      }}
                    />
                  );
                })
              }
              renderOption={(props, option) => {
                const { key, ...otherProps } = props as any;
                return (
                  <li {...otherProps} key={option.id}>
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1.5,
                        width: '100%',
                        py: 0.5,
                      }}
                    >
                      <Avatar
                        src={option.avatarUrl}
                        sx={{
                          width: 36,
                          height: 36,
                          border: `2px solid ${alpha(theme.palette.primary.main, 0.2)}`,
                        }}
                      >
                        {option.name.charAt(0).toUpperCase()}
                      </Avatar>
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="body2" fontWeight="600">
                          {option.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {option.email}
                        </Typography>
                      </Box>
                    </Box>
                  </li>
                );
              }}
              noOptionsText={
                userSearchQuery ? t('chat.noUsersFound') : t('chat.searchUsers')
              }
            />
          </Box>

          {/* Subject and Priority in one row */}
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField
              label={t('mailbox.subject')}
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              required
              fullWidth
              placeholder={t('mailbox.subjectPlaceholder')}
              sx={{
                flex: 1,
                '& .MuiOutlinedInput-root': {
                  backgroundColor:
                    theme.palette.mode === 'dark'
                      ? alpha(theme.palette.background.default, 0.4)
                      : alpha(theme.palette.primary.main, 0.02),
                  '&:hover': {
                    backgroundColor:
                      theme.palette.mode === 'dark'
                        ? alpha(theme.palette.background.default, 0.6)
                        : alpha(theme.palette.primary.main, 0.04),
                  },
                },
              }}
            />

            {/* Priority with icon */}
            <FormControl
              sx={{
                minWidth: 180,
                '& .MuiOutlinedInput-root': {
                  backgroundColor:
                    theme.palette.mode === 'dark'
                      ? alpha(theme.palette.background.default, 0.4)
                      : alpha(theme.palette.primary.main, 0.02),
                },
              }}
            >
              <InputLabel>{t('mailbox.priorityLabel')}</InputLabel>
              <Select
                value={priority}
                onChange={(e) => setPriority(e.target.value as any)}
                label={t('mailbox.priorityLabel')}
                startAdornment={getPriorityIcon()}
              >
                <MenuItem value="low">
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <FlagIcon sx={{ color: 'info.main', fontSize: 18 }} />
                    {t('mailbox.priority.low')}
                  </Box>
                </MenuItem>
                <MenuItem value="normal">
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <FlagIcon sx={{ color: 'text.disabled', fontSize: 18 }} />
                    {t('mailbox.priority.normal')}
                  </Box>
                </MenuItem>
                <MenuItem value="high">
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <FlagIcon sx={{ color: 'warning.main', fontSize: 18 }} />
                    {t('mailbox.priority.high')}
                  </Box>
                </MenuItem>
                <MenuItem value="urgent">
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <FlagIcon sx={{ color: 'error.main', fontSize: 18 }} />
                    {t('mailbox.priority.urgent')}
                  </Box>
                </MenuItem>
              </Select>
            </FormControl>
          </Box>

          <Divider sx={{ my: 1 }} />

          {/* Rich Text Content with modern styling */}
          <Box>
            <Typography
              variant="subtitle2"
              gutterBottom
              sx={{ mb: 1.5, fontWeight: 600 }}
            >
              {t('mailbox.content')}{' '}
              <span style={{ color: theme.palette.error.main }}>*</span>
            </Typography>
            <RichTextEditor
              value={content}
              onChange={setContent}
              placeholder={t('mailbox.contentPlaceholder')}
              minHeight={200}
            />
          </Box>

          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <TranslateIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
              <Typography variant="subtitle2" fontWeight="600">
                {t('mailbox.translation')}
              </Typography>
            </Box>
            <Box
              sx={{
                display: 'flex',
                gap: 2,
                alignItems: 'center',
                flexWrap: 'wrap',
              }}
            >
              <FormControl size="small" sx={{ minWidth: 150 }}>
                <InputLabel>{t('mailbox.translateTo')}</InputLabel>
                <Select
                  value={translationLanguage}
                  onChange={(e) =>
                    setTranslationLanguage(e.target.value as any)
                  }
                  label={t('mailbox.translateTo')}
                >
                  <MenuItem value="ko">🇰🇷 한국어</MenuItem>
                  <MenuItem value="en">🇺🇸 English</MenuItem>
                  <MenuItem value="zh">🇨🇳 中文</MenuItem>
                </Select>
              </FormControl>

              {!translationEnabled ? (
                <Button
                  variant="outlined"
                  startIcon={
                    translating ? (
                      <CircularProgress size={16} color="inherit" />
                    ) : (
                      <TranslateIcon />
                    )
                  }
                  onClick={handleTranslate}
                  disabled={translating || !content.trim()}
                  size="small"
                >
                  {translating
                    ? t('mailbox.translating')
                    : t('mailbox.autoTranslate')}
                </Button>
              ) : (
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button
                    variant="outlined"
                    startIcon={
                      translating ? (
                        <CircularProgress size={16} color="inherit" />
                      ) : (
                        <TranslateIcon />
                      )
                    }
                    onClick={handleRetranslate}
                    disabled={translating}
                    size="small"
                  >
                    {translating
                      ? t('mailbox.translating')
                      : t('mailbox.retranslate')}
                  </Button>
                  <Button
                    variant="text"
                    onClick={handleCancelTranslation}
                    size="small"
                  >
                    {t('mailbox.cancelTranslation')}
                  </Button>
                </Box>
              )}
            </Box>
          </Box>

          {/* Translated Content */}
          {translationEnabled && (
            <Paper
              elevation={0}
              sx={{
                p: 2,
                borderRadius: 2,
                border: `1px solid ${alpha(theme.palette.success.main, 0.2)}`,
                backgroundColor:
                  theme.palette.mode === 'dark'
                    ? alpha(theme.palette.success.dark, 0.1)
                    : alpha(theme.palette.success.light, 0.1),
              }}
            >
              <Typography
                variant="subtitle2"
                gutterBottom
                sx={{ mb: 1.5, fontWeight: 600, color: 'success.main' }}
              >
                {t('mailbox.translatedContent')}
              </Typography>
              <RichTextEditor
                value={translatedContent}
                onChange={setTranslatedContent}
                minHeight={150}
              />
            </Paper>
          )}
        </Stack>
      </DialogContent>

      {/* Footer */}
      <DialogActions
        sx={{
          borderTop: '1px solid',
          borderColor: 'divider',
          px: 3,
          py: 2,
          gap: 1,
        }}
      >
        <Button
          onClick={handleClose}
          disabled={sending}
        >
          {t('common.cancel')}
        </Button>
        <Button
          variant="contained"
          onClick={handleSend}
          disabled={
            sending ||
            recipients.length === 0 ||
            !subject.trim() ||
            !content.trim()
          }
          startIcon={
            sending ? (
              <CircularProgress size={20} color="inherit" />
            ) : (
              <SendIcon />
            )
          }
        >
          {sending ? t('mailbox.sending') : t('mailbox.send')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ComposeMailDialog;

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
  Tooltip,
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
  const [priority, setPriority] = useState<'low' | 'normal' | 'high' | 'urgent'>('normal');

  // User search state
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [userSearchResults, setUserSearchResults] = useState<User[]>([]);
  const [userSearching, setUserSearching] = useState(false);

  // Translation state
  const [translationEnabled, setTranslationEnabled] = useState(false);
  const [translatedContent, setTranslatedContent] = useState('');
  const [translationLanguage, setTranslationLanguage] = useState<'ko' | 'en' | 'zh'>('en');
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

  // Detect links in content
  useEffect(() => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const plainText = content.replace(/<[^>]*>/g, '');
    const matches = plainText.match(urlRegex);
    if (matches) {
      setDetectedLinks(matches.filter((link, index, self) => self.indexOf(link) === index));
    } else {
      setDetectedLinks([]);
    }
  }, [content]);

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

  // Handle add link
  const handleAddLink = () => {
    if (linkInput.trim() && !detectedLinks.includes(linkInput.trim())) {
      setDetectedLinks([...detectedLinks, linkInput.trim()]);
      setLinkInput('');
      setShowLinkInput(false);
    }
  };

  // Handle remove link
  const handleRemoveLink = (link: string) => {
    setDetectedLinks(detectedLinks.filter((l) => l !== link));
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
        translationLanguage: translationEnabled ? translationLanguage : undefined,
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
    setDetectedLinks([]);
    setShowLinkInput(false);
    setLinkInput('');
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
        },
      }}
    >
      {/* Header */}
      <DialogTitle
        sx={{
          borderBottom: 1,
          borderColor: 'divider',
          pb: 2,
        }}
      >
        <Box display="flex" alignItems="flex-start" justifyContent="space-between">
          <Box>
            <Typography variant="h5" fontWeight="600" gutterBottom>
              {t('mailbox.compose')}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t('mailbox.composeSubtitle')}
            </Typography>
          </Box>
          <IconButton onClick={handleClose} size="small" sx={{ mt: -0.5 }}>
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      {/* Content */}
      <DialogContent sx={{ pt: 3 }}>
        <Stack spacing={3}>
          {/* Recipients - Multiple selection */}
          <Autocomplete
            multiple
            options={userSearchResults}
            value={recipients}
            onChange={(_, newValue) => setRecipients(newValue)}
            inputValue={userSearchQuery}
            onInputChange={(_, newInputValue) => setUserSearchQuery(newInputValue)}
            getOptionLabel={(option) => option.name || option.email || ''}
            loading={userSearching}
            renderInput={(params) => (
              <TextField
                {...params}
                label={t('mailbox.recipients')}
                placeholder={recipients.length === 0 ? t('mailbox.recipientsPlaceholder') : ''}
                required
                inputRef={recipientInputRef}
                InputProps={{
                  ...params.InputProps,
                  endAdornment: (
                    <>
                      {userSearching ? <CircularProgress color="inherit" size={20} /> : null}
                      {params.InputProps.endAdornment}
                    </>
                  ),
                }}
              />
            )}
            renderTags={(value, getTagProps) =>
              value.map((option, index) => {
                const { key, ...tagProps } = getTagProps({ index });
                return (
                  <Chip
                    key={key}
                    avatar={<Avatar src={option.avatarUrl} sx={{ width: 24, height: 24 }}>{option.name.charAt(0)}</Avatar>}
                    label={option.name}
                    {...tagProps}
                    sx={{ m: 0.5 }}
                  />
                );
              })
            }
            renderOption={(props, option) => {
              const { key, ...otherProps } = props as any;
              return (
                <li {...otherProps} key={option.id}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, width: '100%' }}>
                    <Avatar src={option.avatarUrl} sx={{ width: 32, height: 32 }}>
                      {option.name.charAt(0).toUpperCase()}
                    </Avatar>
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="body2">{option.name}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {option.email}
                      </Typography>
                    </Box>
                  </Box>
                </li>
              );
            }}
            noOptionsText={userSearchQuery ? t('chat.noUsersFound') : t('chat.searchUsers')}
          />

          {/* Subject */}
          <TextField
            label={t('mailbox.subject')}
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            required
            fullWidth
            placeholder={t('mailbox.subjectPlaceholder')}
          />

          {/* Priority */}
          <FormControl fullWidth size="small">
            <InputLabel>{t('mailbox.priorityLabel')}</InputLabel>
            <Select
              value={priority}
              onChange={(e) => setPriority(e.target.value as any)}
              label={t('mailbox.priorityLabel')}
            >
              <MenuItem value="low">{t('mailbox.priority.low')}</MenuItem>
              <MenuItem value="normal">{t('mailbox.priority.normal')}</MenuItem>
              <MenuItem value="high">{t('mailbox.priority.high')}</MenuItem>
              <MenuItem value="urgent">{t('mailbox.priority.urgent')}</MenuItem>
            </Select>
          </FormControl>

          <Divider />

          {/* Rich Text Content */}
          <Box>
            <Typography variant="subtitle2" gutterBottom sx={{ mb: 1 }}>
              {t('mailbox.content')} <span style={{ color: 'red' }}>*</span>
            </Typography>
            <RichTextEditor
              value={content}
              onChange={setContent}
              placeholder={t('mailbox.contentPlaceholder')}
              minHeight={200}
            />
          </Box>

          {/* Link Previews */}
          {detectedLinks.length > 0 && (
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                {t('mailbox.attachedLinks')}
              </Typography>
              {detectedLinks.map((link) => (
                <LinkPreview key={link} url={link} onRemove={() => handleRemoveLink(link)} />
              ))}
            </Box>
          )}

          {/* Add Link Button */}
          {showLinkInput ? (
            <Box sx={{ display: 'flex', gap: 1 }}>
              <TextField
                fullWidth
                size="small"
                placeholder="https://example.com"
                value={linkInput}
                onChange={(e) => setLinkInput(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleAddLink();
                  }
                }}
              />
              <Button onClick={handleAddLink} variant="contained" size="small">
                {t('common.add')}
              </Button>
              <Button onClick={() => setShowLinkInput(false)} size="small">
                {t('common.cancel')}
              </Button>
            </Box>
          ) : (
            <Button
              startIcon={<LinkIcon />}
              onClick={() => setShowLinkInput(true)}
              variant="outlined"
              size="small"
              sx={{ alignSelf: 'flex-start' }}
            >
              {t('mailbox.addLink')}
            </Button>
          )}

          <Divider />

          {/* Translation Controls */}
          <Box>
            <Typography variant="subtitle2" gutterBottom sx={{ mb: 1.5 }}>
              {t('mailbox.translation')}
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
              <FormControl sx={{ minWidth: 150 }} size="small">
                <InputLabel>{t('mailbox.translateTo')}</InputLabel>
                <Select
                  value={translationLanguage}
                  onChange={(e) => setTranslationLanguage(e.target.value as any)}
                  label={t('mailbox.translateTo')}
                >
                  <MenuItem value="ko">한국어</MenuItem>
                  <MenuItem value="en">English</MenuItem>
                  <MenuItem value="zh">中文</MenuItem>
                </Select>
              </FormControl>

              {!translationEnabled ? (
                <Button
                  variant="outlined"
                  startIcon={translating ? <CircularProgress size={16} /> : <TranslateIcon />}
                  onClick={handleTranslate}
                  disabled={translating || !content.trim()}
                  size="small"
                >
                  {translating ? t('mailbox.translating') : t('mailbox.autoTranslate')}
                </Button>
              ) : (
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button
                    variant="outlined"
                    startIcon={translating ? <CircularProgress size={16} /> : <TranslateIcon />}
                    onClick={handleRetranslate}
                    disabled={translating}
                    size="small"
                  >
                    {translating ? t('mailbox.translating') : t('mailbox.retranslate')}
                  </Button>
                  <Button
                    variant="outlined"
                    color="secondary"
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
            <Box>
              <Typography variant="subtitle2" gutterBottom sx={{ mb: 1 }}>
                {t('mailbox.translatedContent')}
              </Typography>
              <RichTextEditor
                value={translatedContent}
                onChange={setTranslatedContent}
                minHeight={150}
              />
            </Box>
          )}
        </Stack>
      </DialogContent>

      {/* Actions */}
      <DialogActions
        sx={{
          borderTop: 1,
          borderColor: 'divider',
          px: 3,
          py: 2,
          gap: 1,
        }}
      >
        <Button onClick={handleClose} disabled={sending} size="large">
          {t('common.cancel')}
        </Button>
        <Button
          variant="contained"
          onClick={handleSend}
          disabled={sending || recipients.length === 0 || !subject.trim() || !content.trim()}
          startIcon={sending ? <CircularProgress size={20} color="inherit" /> : <SendIcon />}
          size="large"
        >
          {sending ? t('mailbox.sending') : t('mailbox.send')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ComposeMailDialog;


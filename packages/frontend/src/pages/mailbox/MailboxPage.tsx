import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Box,
  Typography,
  Paper,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  ListItemIcon,
  IconButton,
  Chip,
  Divider,
  Button,
  CircularProgress,
  Checkbox,
  Tooltip,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  FormControl,
  InputLabel,
  Alert,
  Autocomplete,
  Avatar,
  ListItemAvatar,
  Tabs,
  Tab,
  Stack,
} from '@mui/material';
import {
  Mail as MailIcon,
  Inbox as InboxIcon,
  Star as StarIcon,
  StarBorder as StarBorderIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
  Create as CreateIcon,
  MoreVert as MoreIcon,
  Send as SendIcon,
  Close as CloseIcon,
  CheckCircle as CheckCircleIcon,
  Circle as CircleIcon,
  PriorityHigh as PriorityHighIcon,
  Translate as TranslateIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import { format } from 'date-fns';
import { ko, enUS, zhCN } from 'date-fns/locale';
import mailService from '../../services/mailService';
import { Mail, MailFilters, MailStats } from '../../types/mail';
import { useAuth } from '../../contexts/AuthContext';
import { User } from '../../types/chat';
import chatService from '../../services/chatService';
import translationService from '../../services/translationService';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useTheme } from '../../contexts/ThemeContext';

const MailboxPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const { user } = useAuth();
  const { isDark } = useTheme();

  // State
  const [mails, setMails] = useState<Mail[]>([]);
  const [selectedMail, setSelectedMail] = useState<Mail | null>(null);
  const [selectedMailIds, setSelectedMailIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<MailStats | null>(null);
  const [filter, setFilter] = useState<'all' | 'unread' | 'starred'>('all');
  const [composeDialogOpen, setComposeDialogOpen] = useState(false);
  const [currentTab, setCurrentTab] = useState<'received' | 'sent'>('received');

  // Infinite scroll state
  const [hasNextPage, setHasNextPage] = useState(true);
  const [isNextPageLoading, setIsNextPageLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 50;

  // Ref for virtualizer
  const parentRef = useRef<HTMLDivElement>(null);

  // Track which items have been animated
  const animatedItemsRef = useRef<Set<number>>(new Set());

  // Compose dialog state
  const [composeRecipient, setComposeRecipient] = useState<User | null>(null);
  const [composeSubject, setComposeSubject] = useState('');
  const [composeContent, setComposeContent] = useState('');
  const [composePriority, setComposePriority] = useState<'low' | 'normal' | 'high' | 'urgent'>('normal');
  const [composeSending, setComposeSending] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState('');

  // Translation state
  const [translationEnabled, setTranslationEnabled] = useState(false);
  const [translatedContent, setTranslatedContent] = useState('');
  const [translationLanguage, setTranslationLanguage] = useState<'ko' | 'en' | 'zh'>('en');
  const [translating, setTranslating] = useState(false);

  // Delete confirmation dialog state
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [mailToDelete, setMailToDelete] = useState<number | null>(null);
  const [bulkDeleteConfirmOpen, setBulkDeleteConfirmOpen] = useState(false);
  const [userSearchResults, setUserSearchResults] = useState<User[]>([]);
  const [userSearching, setUserSearching] = useState(false);

  // Ref for autofocus
  const recipientInputRef = useRef<HTMLInputElement>(null);

  // Load initial mails
  const loadMails = async (reset: boolean = false) => {
    try {
      if (reset) {
        setLoading(true);
        setMails([]);
        setCurrentPage(1);
        animatedItemsRef.current.clear();
      }

      const pageToLoad = reset ? 1 : currentPage;
      const previousCount = reset ? 0 : mails.length;

      if (currentTab === 'sent') {
        // Load sent mails
        const response = await mailService.getSentMails(pageToLoad, ITEMS_PER_PAGE);
        if (reset) {
          setMails(response.data);
        } else {
          setMails(prev => [...prev, ...response.data]);
        }
        setHasNextPage(response.pagination.page < response.pagination.totalPages);
      } else {
        // Load received mails
        const filters: MailFilters = {
          page: pageToLoad,
          limit: ITEMS_PER_PAGE,
        };

        if (filter === 'unread') {
          filters.isRead = false;
        } else if (filter === 'starred') {
          filters.isStarred = true;
        }

        const response = await mailService.getMails(filters);
        if (reset) {
          setMails(response.data);
        } else {
          setMails(prev => [...prev, ...response.data]);
        }
        setHasNextPage(response.pagination.page < response.pagination.totalPages);
      }
    } catch (error: any) {
      console.error('Failed to load mails:', error);
      enqueueSnackbar(t('mailbox.errors.loadFailed'), { variant: 'error' });
    } finally {
      setLoading(false);
      setIsNextPageLoading(false);
    }
  };

  // Virtualizer
  const rowVirtualizer = useVirtualizer({
    count: hasNextPage ? mails.length + 1 : mails.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 89,
    overscan: 5,
    measureElement:
      typeof window !== 'undefined' && navigator.userAgent.indexOf('Firefox') === -1
        ? (element) => element?.getBoundingClientRect().height
        : undefined,
  });

  // Load next page when scrolling near the end
  useEffect(() => {
    const [lastItem] = [...rowVirtualizer.getVirtualItems()].reverse();

    if (!lastItem) {
      return;
    }

    if (
      lastItem.index >= mails.length - 1 &&
      hasNextPage &&
      !isNextPageLoading
    ) {
      setIsNextPageLoading(true);
      setCurrentPage(prev => prev + 1);
    }
  }, [
    hasNextPage,
    isNextPageLoading,
    mails.length,
    rowVirtualizer.getVirtualItems(),
  ]);

  // Load stats
  const loadStats = async () => {
    try {
      const mailStats = await mailService.getMailStats();
      setStats(mailStats);
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  };

  // Initial load
  // Load mails when filter or tab changes
  useEffect(() => {
    loadMails(true);
    loadStats();
  }, [filter, currentTab]);

  // Load next page when currentPage changes
  useEffect(() => {
    if (currentPage > 1) {
      loadMails(false);
    }
  }, [currentPage]);

  // Handle mail selection
  const handleMailClick = async (mail: Mail) => {
    setSelectedMail(mail);

    // Mark as read if unread
    if (!mail.isRead) {
      try {
        await mailService.markAsRead(mail.id);
        // Update local state
        setMails(prev => prev.map(m =>
          m.id === mail.id ? { ...m, isRead: true } : m
        ));
        loadStats();
        // Notify MainLayout to update unread count
        window.dispatchEvent(new CustomEvent('mail-read'));
      } catch (error) {
        console.error('Failed to mark as read:', error);
      }
    }
  };

  // Handle star toggle
  const handleStarToggle = async (mailId: number, event: React.MouseEvent) => {
    event.stopPropagation();
    try {
      const isStarred = await mailService.toggleStarred(mailId);

      // If in starred filter and unstarring, remove from list
      if (filter === 'starred' && !isStarred) {
        setMails(prev => prev.filter(m => m.id !== mailId));
        // If the unstarred mail was selected, clear selection
        if (selectedMail?.id === mailId) {
          setSelectedMail(null);
        }
      } else {
        // Otherwise just update the star status
        setMails(prev => prev.map(m =>
          m.id === mailId ? { ...m, isStarred } : m
        ));
      }

      loadStats();
    } catch (error) {
      console.error('Failed to toggle star:', error);
      enqueueSnackbar(t('mailbox.errors.starFailed'), { variant: 'error' });
    }
  };

  // Handle delete - show confirmation dialog
  const handleDeleteClick = (mailId: number) => {
    setMailToDelete(mailId);
    setDeleteConfirmOpen(true);
  };

  // Confirm delete
  const handleDeleteConfirm = async () => {
    if (!mailToDelete) return;

    try {
      await mailService.deleteMail(mailToDelete);
      setMails(prev => prev.filter(m => m.id !== mailToDelete));
      if (selectedMail?.id === mailToDelete) {
        setSelectedMail(null);
      }
      enqueueSnackbar(t('mailbox.mailDeleted'), { variant: 'success' });
      loadStats();
    } catch (error) {
      console.error('Failed to delete mail:', error);
      enqueueSnackbar(t('mailbox.errors.deleteFailed'), { variant: 'error' });
    } finally {
      setDeleteConfirmOpen(false);
      setMailToDelete(null);
    }
  };

  // Cancel delete
  const handleDeleteCancel = () => {
    setDeleteConfirmOpen(false);
    setMailToDelete(null);
  };

  // Handle checkbox toggle
  const handleCheckboxToggle = (mailId: number) => {
    setSelectedMailIds(prev => 
      prev.includes(mailId)
        ? prev.filter(id => id !== mailId)
        : [...prev, mailId]
    );
  };

  // Handle select all
  const handleSelectAll = () => {
    if (selectedMailIds.length === mails.length) {
      setSelectedMailIds([]);
    } else {
      setSelectedMailIds(mails.map(m => m.id));
    }
  };

  // Handle bulk delete - show confirmation dialog
  const handleBulkDeleteClick = () => {
    if (selectedMailIds.length === 0) return;
    setBulkDeleteConfirmOpen(true);
  };

  // Confirm bulk delete
  const handleBulkDeleteConfirm = async () => {
    if (selectedMailIds.length === 0) return;

    try {
      await mailService.deleteMultiple(selectedMailIds);
      setMails(prev => prev.filter(m => !selectedMailIds.includes(m.id)));
      setSelectedMailIds([]);
      enqueueSnackbar(
        t('mailbox.mailsDeleted', { count: selectedMailIds.length }),
        { variant: 'success' }
      );
      loadStats();
    } catch (error) {
      console.error('Failed to delete mails:', error);
      enqueueSnackbar(t('mailbox.errors.deleteFailed'), { variant: 'error' });
    } finally {
      setBulkDeleteConfirmOpen(false);
    }
  };

  // Cancel bulk delete
  const handleBulkDeleteCancel = () => {
    setBulkDeleteConfirmOpen(false);
  };

  // Handle bulk mark as read
  const handleBulkMarkAsRead = async () => {
    if (selectedMailIds.length === 0) return;

    try {
      await mailService.markMultipleAsRead(selectedMailIds);
      setMails(prev => prev.map(m =>
        selectedMailIds.includes(m.id) ? { ...m, isRead: true } : m
      ));
      setSelectedMailIds([]);
      enqueueSnackbar(t('mailbox.markedAsRead'), { variant: 'success' });
      loadStats();
      // Notify MainLayout to update unread count
      window.dispatchEvent(new CustomEvent('mail-read'));
    } catch (error) {
      console.error('Failed to mark as read:', error);
      enqueueSnackbar(t('mailbox.errors.markReadFailed'), { variant: 'error' });
    }
  };

  // Handle translation
  const handleTranslate = async () => {
    if (!composeContent.trim()) {
      enqueueSnackbar(t('mailbox.enterContent'), { variant: 'warning' });
      return;
    }

    setTranslating(true);
    try {
      const result = await translationService.translateText({
        text: composeContent,
        targetLanguage: translationLanguage,
        sourceLanguage: 'auto',
      });
      setTranslatedContent(result.translatedText);
      setTranslationEnabled(true);
      enqueueSnackbar(t('mailbox.translationCompleted'), { variant: 'success' });
    } catch (error: any) {
      console.error('Translation failed:', error);
      enqueueSnackbar(error.message || t('mailbox.translationFailed'), { variant: 'error' });
    } finally {
      setTranslating(false);
    }
  };

  // Cancel translation
  const handleCancelTranslation = () => {
    setTranslationEnabled(false);
    setTranslatedContent('');
  };

  // Get date locale
  const getDateLocale = () => {
    switch (i18n.language) {
      case 'ko':
        return ko;
      case 'zh':
        return zhCN;
      default:
        return enUS;
    }
  };

  // Format date
  const formatDate = (dateString: string) => {
    return format(new Date(dateString), 'PPp', { locale: getDateLocale() });
  };

  // Get priority color
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'error';
      case 'high':
        return 'warning';
      case 'low':
        return 'info';
      default:
        return 'default';
    }
  };

  // Search users
  const searchUsers = async (query: string) => {
    if (!query.trim()) {
      setUserSearchResults([]);
      return;
    }

    try {
      setUserSearching(true);
      const response = await chatService.searchUsers(query);
      setUserSearchResults(response);
    } catch (error) {
      console.error('Failed to search users:', error);
    } finally {
      setUserSearching(false);
    }
  };

  // Handle compose dialog open
  const handleComposeOpen = () => {
    setComposeRecipient(null);
    setComposeSubject('');
    setComposeContent('');
    setComposePriority('normal');
    setUserSearchQuery('');
    setUserSearchResults([]);
    setTranslationEnabled(false);
    setTranslatedContent('');
    setTranslationLanguage('en');
    setComposeDialogOpen(true);

    // Focus on recipient input after dialog opens
    setTimeout(() => {
      recipientInputRef.current?.focus();
    }, 100);
  };

  // Handle compose dialog close
  const handleComposeClose = () => {
    setComposeDialogOpen(false);
    setComposeRecipient(null);
    setComposeSubject('');
    setComposeContent('');
    setComposePriority('normal');
    setUserSearchQuery('');
    setUserSearchResults([]);
    setTranslationEnabled(false);
    setTranslatedContent('');
  };

  // Handle send mail
  const handleSendMail = async () => {
    if (!composeRecipient || !composeSubject.trim() || !composeContent.trim()) {
      enqueueSnackbar(t('mailbox.errors.fillAllFields'), { variant: 'warning' });
      return;
    }

    try {
      setComposeSending(true);

      // Combine original and translated content if translation is enabled
      let finalContent = composeContent;
      if (translationEnabled && translatedContent.trim()) {
        finalContent = `${composeContent}\n\n${translatedContent}`;
      }

      await mailService.sendMail({
        recipientId: composeRecipient.id,
        subject: composeSubject,
        content: finalContent,
        priority: composePriority,
      });
      enqueueSnackbar(t('mailbox.mailSent'), { variant: 'success' });
      handleComposeClose();
      loadMails();
      loadStats();
    } catch (error: any) {
      console.error('Failed to send mail:', error);
      enqueueSnackbar(t('mailbox.errors.sendFailed'), { variant: 'error' });
    } finally {
      setComposeSending(false);
    }
  };

  // Debounce user search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (userSearchQuery) {
        searchUsers(userSearchQuery);
      } else {
        setUserSearchResults([]);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [userSearchQuery]);

  // Listen for real-time mail received events
  useEffect(() => {
    const handleMailReceived = () => {
      loadMails();
      loadStats();
    };

    window.addEventListener('mail-received', handleMailReceived);
    return () => {
      window.removeEventListener('mail-received', handleMailReceived);
    };
  }, [filter]);

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', p: 3 }}>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
          <MailIcon sx={{ fontSize: 32, color: 'primary.main' }} />
          <Typography variant="h4" sx={{ fontWeight: 600, flex: 1 }}>
            {t('mailbox.title')}
          </Typography>
          <Button
            variant="contained"
            startIcon={<CreateIcon />}
            onClick={handleComposeOpen}
          >
            {t('mailbox.compose')}
          </Button>
          <IconButton onClick={() => { loadMails(); loadStats(); }}>
            <RefreshIcon />
          </IconButton>
        </Box>
        <Typography variant="body2" color="text.secondary">
          {t('mailbox.subtitle')}
        </Typography>
      </Box>

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={currentTab} onChange={(_, newValue) => {
          setCurrentTab(newValue);
          setCurrentPage(1);
          setSelectedMail(null);
          setSelectedMailIds([]);
        }}>
          <Tab label={t('mailbox.receivedMails')} value="received" />
          <Tab label={t('mailbox.sentMails')} value="sent" />
        </Tabs>
      </Box>

      {/* Stats */}
      {stats && currentTab === 'received' && (
        <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
          <Chip
            label={`${t('mailbox.stats.total')}: ${stats.totalCount}`}
            color="default"
            variant={filter === 'all' ? 'filled' : 'outlined'}
            onClick={() => setFilter('all')}
          />
          <Chip
            label={`${t('mailbox.stats.unread')}: ${stats.unreadCount}`}
            color="primary"
            variant={filter === 'unread' ? 'filled' : 'outlined'}
            onClick={() => setFilter('unread')}
          />
          <Chip
            label={`${t('mailbox.stats.starred')}: ${stats.starredCount}`}
            color="warning"
            variant={filter === 'starred' ? 'filled' : 'outlined'}
            onClick={() => setFilter('starred')}
          />
        </Box>
      )}

      {/* Toolbar */}
      {selectedMailIds.length > 0 && (
        <Box sx={{ mb: 2, display: 'flex', gap: 1, alignItems: 'center' }}>
          <Typography variant="body2" sx={{ mr: 2 }}>
            {selectedMailIds.length} selected
          </Typography>
          <Button
            size="small"
            startIcon={<CheckCircleIcon />}
            onClick={handleBulkMarkAsRead}
          >
            {t('mailbox.markAsRead')}
          </Button>
          <Button
            size="small"
            startIcon={<DeleteIcon />}
            onClick={handleBulkDeleteClick}
            color="error"
          >
            {t('mailbox.delete')}
          </Button>
        </Box>
      )}

      {/* Content */}
      <Box sx={{ flex: 1, display: 'flex', gap: 2, minHeight: 0 }}>
        {/* Mail List */}
        <Paper sx={{ flex: 1, display: 'flex', flexDirection: 'column', maxWidth: 400 }}>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1 }}>
              <CircularProgress
                size={32}
                thickness={2.5}
                sx={{
                  color: 'primary.main',
                  opacity: 0.6,
                }}
              />
            </Box>
          ) : mails.length === 0 ? (
            <Box sx={{ p: 4, textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                {filter === 'unread' ? t('mailbox.noUnreadMails') :
                 filter === 'starred' ? t('mailbox.noStarredMails') :
                 currentTab === 'sent' ? t('mailbox.noSentMails') :
                 t('mailbox.noMails')}
              </Typography>
            </Box>
          ) : (
            <Box
              ref={parentRef}
              sx={{
                flex: 1,
                overflow: 'auto',
                paddingTop: '2px',
                paddingBottom: '2px',
                // Chat scrollbar style
                '&::-webkit-scrollbar': {
                  width: '8px',
                },
                '&::-webkit-scrollbar-track': {
                  background: 'transparent',
                },
                '&::-webkit-scrollbar-thumb': {
                  background: (theme) => theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)',
                  borderRadius: '4px',
                  '&:hover': {
                    background: (theme) => theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.3)',
                  },
                },
                '&::-webkit-scrollbar-thumb:active': {
                  background: (theme) => theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.4)',
                },
                scrollbarWidth: 'thin',
                scrollbarColor: (theme) => theme.palette.mode === 'dark'
                  ? 'rgba(255, 255, 255, 0.2) transparent'
                  : 'rgba(0, 0, 0, 0.2) transparent',
              }}
            >
              <List
                sx={{
                  height: `${rowVirtualizer.getTotalSize()}px`,
                  width: '100%',
                  position: 'relative',
                }}
              >
                {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                  const index = virtualRow.index;

                  if (index >= mails.length) {
                    return (
                      <Box
                        key="loading"
                        sx={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          width: '100%',
                          height: `${virtualRow.size}px`,
                          transform: `translateY(${virtualRow.start}px)`,
                          display: 'flex',
                          justifyContent: 'center',
                          alignItems: 'center',
                          py: 2,
                        }}
                      >
                        <CircularProgress
                          size={20}
                          thickness={2}
                          sx={{
                            color: 'text.disabled',
                            opacity: 0.5,
                          }}
                        />
                      </Box>
                    );
                  }

                  const mail = mails[index];

                  // Check if this item should be animated (only once)
                  const shouldAnimate = !animatedItemsRef.current.has(mail.id);
                  if (shouldAnimate) {
                    animatedItemsRef.current.add(mail.id);
                  }

                  return (
                    <Box
                      key={virtualRow.key}
                      data-index={virtualRow.index}
                      ref={rowVirtualizer.measureElement}
                      sx={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        transform: `translateY(${virtualRow.start}px)`,
                        opacity: shouldAnimate ? 0 : 1,
                        animation: shouldAnimate ? 'fadeInSlide 0.3s ease-out forwards' : 'none',
                        '@keyframes fadeInSlide': {
                          '0%': {
                            opacity: 0,
                          },
                          '100%': {
                            opacity: 1,
                          },
                        },
                      }}
                    >
                        {index > 0 && <Divider />}
                        <ListItem
                          disablePadding
                          secondaryAction={
                            <IconButton
                              edge="end"
                              onClick={(e) => handleStarToggle(mail.id, e)}
                            >
                              {mail.isStarred ? (
                                <StarIcon sx={{ color: 'warning.main' }} />
                              ) : (
                                <StarBorderIcon />
                              )}
                            </IconButton>
                          }
                        >
                          <ListItemButton
                            selected={selectedMail?.id === mail.id}
                            onClick={() => handleMailClick(mail)}
                            sx={{
                              backgroundColor: mail.isRead ? 'transparent' : 'action.hover',
                              py: 1,
                              borderLeft: mail.isRead ? 'none' : '3px solid',
                              borderLeftColor: 'primary.main',
                              opacity: mail.isRead ? 0.7 : 1,
                              '&:hover': {
                                opacity: 1,
                              },
                            }}
                          >
                            <ListItemIcon>
                              <Checkbox
                                edge="start"
                                checked={selectedMailIds.includes(mail.id)}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleCheckboxToggle(mail.id);
                                }}
                              />
                            </ListItemIcon>
                            <ListItemText
                              primaryTypographyProps={{ component: 'div' }}
                              secondaryTypographyProps={{ component: 'div' }}
                              primary={
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                  <Typography
                                    component="span"
                                    variant="body2"
                                    sx={{ fontWeight: mail.isRead ? 400 : 700 }}
                                    noWrap
                                  >
                                    {mail.senderName || t('mailbox.type.system')}
                                  </Typography>
                                  {mail.priority !== 'normal' && (
                                    <Chip
                                      label={t(`mailbox.priority.${mail.priority}`)}
                                      size="small"
                                      color={getPriorityColor(mail.priority) as any}
                                      sx={{ height: 16, fontSize: '0.625rem' }}
                                    />
                                  )}
                                </Box>
                              }
                              secondary={
                                <>
                                  <Typography
                                    component="span"
                                    variant="body2"
                                    sx={{ fontWeight: mail.isRead ? 400 : 700, display: 'block' }}
                                    noWrap
                                  >
                                    {mail.subject}
                                  </Typography>
                                  <Typography component="span" variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                                    {format(new Date(mail.createdAt), 'PPp', { locale: getDateLocale() })}
                                  </Typography>
                                </>
                              }
                            />
                          </ListItemButton>
                        </ListItem>
                      </Box>
                    );
                })}
              </List>
            </Box>
          )}
        </Paper>

        {/* Mail Detail */}
        <Paper sx={{ flex: 2, overflow: 'auto', p: 3 }}>
          {selectedMail ? (
            <Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                <Typography variant="h6">{selectedMail.subject}</Typography>
                <IconButton onClick={() => handleDeleteClick(selectedMail.id)} color="error">
                  <DeleteIcon />
                </IconButton>
              </Box>
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  {t('mailbox.from')}: {selectedMail.senderName || t('mailbox.type.system')}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {t('mailbox.sent')}: {formatDate(selectedMail.createdAt)}
                </Typography>
                {selectedMail.isRead && selectedMail.readAt && (
                  <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                    {t('mailbox.readAt')}: {formatDate(selectedMail.readAt)}
                  </Typography>
                )}
              </Box>
              <Divider sx={{ mb: 2 }} />
              <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
                {selectedMail.content}
              </Typography>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
              <Typography variant="body2" color="text.secondary">
                {mails.length > 0 ? t('mailbox.selectMail') : t('mailbox.noMails')}
              </Typography>
            </Box>
          )}
        </Paper>
      </Box>

      {/* Compose Mail Dialog */}
      <Dialog
        open={composeDialogOpen}
        onClose={handleComposeClose}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 2,
            minHeight: 500,
          }
        }}
      >
        <DialogTitle>
          <Box display="flex" alignItems="center" justifyContent="space-between">
            <Typography variant="h6">{t('mailbox.compose')}</Typography>
            <IconButton onClick={handleComposeClose} size="small">
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent dividers sx={{ minHeight: 500 }}>
          <Stack spacing={3} sx={{ py: 1 }}>
            {/* Recipient */}
            <Autocomplete
              options={userSearchResults}
              value={composeRecipient}
              onChange={(_, newValue) => setComposeRecipient(newValue)}
              inputValue={userSearchQuery}
              onInputChange={(_, newInputValue) => setUserSearchQuery(newInputValue)}
              getOptionLabel={(option) => option.name || option.email || ''}
              loading={userSearching}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label={t('mailbox.recipient')}
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
              renderOption={(props, option) => {
                const { key, ...otherProps } = props as any;
                const displayName = option.name || option.email || 'Unknown';
                const displayEmail = option.email || '';
                const avatarLetter = displayName.charAt(0).toUpperCase();

                return (
                  <li {...otherProps} key={option.id}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, width: '100%' }}>
                      <Avatar
                        src={option.avatarUrl || undefined}
                        sx={{ width: 32, height: 32 }}
                      >
                        {avatarLetter}
                      </Avatar>
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="body2" component="div">
                          {displayName}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" component="div">
                          {displayEmail}
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
              value={composeSubject}
              onChange={(e) => setComposeSubject(e.target.value)}
              required
              fullWidth
            />

            {/* Priority */}
            <FormControl fullWidth>
              <InputLabel>{t('mailbox.priorityLabel')}</InputLabel>
              <Select
                value={composePriority}
                onChange={(e) => setComposePriority(e.target.value as any)}
                label={t('mailbox.priorityLabel')}
              >
                <MenuItem value="low">{t('mailbox.priority.low')}</MenuItem>
                <MenuItem value="normal">{t('mailbox.priority.normal')}</MenuItem>
                <MenuItem value="high">{t('mailbox.priority.high')}</MenuItem>
                <MenuItem value="urgent">{t('mailbox.priority.urgent')}</MenuItem>
              </Select>
            </FormControl>

            {/* Original Content */}
            <TextField
              label={t('mailbox.originalContent')}
              value={composeContent}
              onChange={(e) => setComposeContent(e.target.value)}
              required
              fullWidth
              multiline
              rows={6}
              placeholder={t('mailbox.contentPlaceholder')}
            />

            {/* Translation Controls */}
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
              <FormControl sx={{ minWidth: 150 }}>
                <InputLabel>{t('mailbox.translateTo')}</InputLabel>
                <Select
                  value={translationLanguage}
                  onChange={(e) => setTranslationLanguage(e.target.value as any)}
                  label={t('mailbox.translateTo')}
                  size="small"
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
                  disabled={translating || !composeContent.trim()}
                  size="small"
                >
                  {translating ? t('mailbox.translating') : t('mailbox.autoTranslate')}
                </Button>
              ) : (
                <Button
                  variant="outlined"
                  color="secondary"
                  onClick={handleCancelTranslation}
                  size="small"
                >
                  {t('mailbox.cancelTranslation')}
                </Button>
              )}
            </Box>

            {/* Translated Content */}
            {translationEnabled && (
              <TextField
                label={t('mailbox.translatedContent')}
                value={translatedContent}
                onChange={(e) => setTranslatedContent(e.target.value)}
                fullWidth
                multiline
                rows={6}
                helperText={t('mailbox.translationCompleted')}
              />
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={handleComposeClose} disabled={composeSending}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="contained"
            onClick={handleSendMail}
            disabled={composeSending || !composeRecipient || !composeSubject.trim() || !composeContent.trim()}
            startIcon={composeSending ? <CircularProgress size={20} color="inherit" /> : <SendIcon />}
          >
            {composeSending ? t('mailbox.sending') : t('mailbox.send')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteConfirmOpen}
        onClose={handleDeleteCancel}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>{t('mailbox.deleteConfirmTitle')}</DialogTitle>
        <DialogContent>
          <Typography>{t('mailbox.deleteConfirmMessage')}</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDeleteCancel}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleDeleteConfirm} color="error" variant="contained">
            {t('common.delete')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Bulk Delete Confirmation Dialog */}
      <Dialog
        open={bulkDeleteConfirmOpen}
        onClose={handleBulkDeleteCancel}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>{t('mailbox.bulkDeleteConfirmTitle')}</DialogTitle>
        <DialogContent>
          <Typography>
            {t('mailbox.bulkDeleteConfirmMessage', { count: selectedMailIds.length })}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleBulkDeleteCancel}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleBulkDeleteConfirm} color="error" variant="contained">
            {t('common.delete')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default MailboxPage;


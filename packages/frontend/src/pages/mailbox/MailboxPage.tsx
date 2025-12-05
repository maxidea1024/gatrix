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
  ToggleButtonGroup,
  ToggleButton,
  Fab,
  Badge,
  Fade,
  Zoom,
  keyframes,
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
  ArrowUpward as ArrowUpwardIcon,
  DeleteSweep as DeleteSweepIcon,
  SelectAll as SelectAllIcon,
  MailOutline as MailOutlineIcon,
  Drafts as DraftsIcon,
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
import ComposeMailDialog from '@/components/mailbox/ComposeMailDialog';

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

  // Delete confirmation dialog state
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [mailToDelete, setMailToDelete] = useState<number | null>(null);
  const [bulkDeleteConfirmOpen, setBulkDeleteConfirmOpen] = useState(false);
  const [emptyMailboxConfirmOpen, setEmptyMailboxConfirmOpen] = useState(false);
  const [markAllReadConfirmOpen, setMarkAllReadConfirmOpen] = useState(false);

  // New mail notification state
  const [newMailCount, setNewMailCount] = useState(0);
  const [showNewMailButton, setShowNewMailButton] = useState(false);

  // Select all state
  const [selectAll, setSelectAll] = useState(false);

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

      // Reset new mail notification when refreshing
      if (reset) {
        setNewMailCount(0);
        setShowNewMailButton(false);
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
    // Clear selection when filter or tab changes
    setSelectedMail(null);
    setSelectedMailIds([]);
    setSelectAll(false);
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
      setSelectAll(false);
    } else {
      setSelectedMailIds(mails.map(m => m.id));
      setSelectAll(true);
    }
  };

  // Handle empty mailbox
  const handleEmptyMailboxClick = () => {
    setEmptyMailboxConfirmOpen(true);
  };

  const handleEmptyMailboxConfirm = async () => {
    setEmptyMailboxConfirmOpen(false);

    try {
      // Delete all mails in current filter
      await mailService.deleteAllMails(filter);
      // Reload mails and stats
      await loadMails(true);
      await loadStats();
      setSelectedMail(null);
      setSelectedMailIds([]);
      setSelectAll(false);
      enqueueSnackbar(t('mailbox.mailboxEmptied'), { variant: 'success' });
    } catch (error) {
      console.error('Failed to empty mailbox:', error);
      enqueueSnackbar(t('mailbox.errors.emptyFailed'), { variant: 'error' });
    }
  };

  const handleEmptyMailboxCancel = () => {
    setEmptyMailboxConfirmOpen(false);
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

  // Handle mark all as read click
  const handleMarkAllAsReadClick = () => {
    setMarkAllReadConfirmOpen(true);
  };

  // Handle mark all as read confirm
  const handleMarkAllAsReadConfirm = async () => {
    setMarkAllReadConfirmOpen(false);

    try {
      // Mark all unread mails in the current filter
      await mailService.markAllAsRead(filter);
      // Reload mails and stats
      await loadMails(true);
      await loadStats();
      enqueueSnackbar(t('mailbox.allMarkedAsRead'), { variant: 'success' });
      // Notify MainLayout to update unread count
      window.dispatchEvent(new CustomEvent('mail-read'));
    } catch (error) {
      console.error('Failed to mark all as read:', error);
      enqueueSnackbar(t('mailbox.errors.markReadFailed'), { variant: 'error' });
    }
  };

  // Handle mark all as read cancel
  const handleMarkAllAsReadCancel = () => {
    setMarkAllReadConfirmOpen(false);
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

  // Handle compose dialog open
  const handleComposeOpen = () => {
    setComposeDialogOpen(true);
  };

  // Handle compose dialog close
  const handleComposeClose = () => {
    setComposeDialogOpen(false);
  };

  // Listen for real-time mail received events
  useEffect(() => {
    const handleMailReceived = () => {
      // Check if scroll is at top
      const scrollElement = parentRef.current;
      if (scrollElement) {
        const isAtTop = scrollElement.scrollTop < 50;

        if (isAtTop) {
          // If at top, reload mails
          loadMails(true);
        } else {
          // If not at top, show floating button
          setNewMailCount(prev => prev + 1);
          setShowNewMailButton(true);
        }
      }
      loadStats();
    };

    window.addEventListener('mail-received', handleMailReceived);
    return () => {
      window.removeEventListener('mail-received', handleMailReceived);
    };
  }, [filter]);

  // Handle scroll to top and load new mails
  const handleScrollToNewMails = () => {
    const scrollElement = parentRef.current;
    if (scrollElement) {
      scrollElement.scrollTo({ top: 0, behavior: 'smooth' });
      setTimeout(() => {
        loadMails(true);
        setNewMailCount(0);
        setShowNewMailButton(false);
      }, 300);
    }
  };

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
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, position: 'relative' }}>
        {/* Floating Filter Bar - Spans across both panels */}
        {stats && currentTab === 'received' && (
          <Box
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              zIndex: 100,
              backgroundColor: (theme) => theme.palette.mode === 'dark'
                ? '#2a2d35'
                : 'rgba(0, 0, 0, 0.02)',
              borderBottom: 1,
              borderColor: 'divider',
              px: 2,
              py: 1.5,
              display: 'flex',
              gap: 1,
              alignItems: 'center',
              boxShadow: (theme) => theme.palette.mode === 'dark'
                ? '0 2px 8px rgba(0,0,0,0.3)'
                : '0 2px 8px rgba(0,0,0,0.1)',
            }}
          >
            {/* Select All Checkbox */}
            <Tooltip title={t('mailbox.selectAll')}>
              <Checkbox
                checked={selectAll}
                indeterminate={selectedMailIds.length > 0 && selectedMailIds.length < mails.length}
                onChange={handleSelectAll}
                size="small"
              />
            </Tooltip>

            <ToggleButtonGroup
              value={filter}
              exclusive
              onChange={(e, newFilter) => {
                if (newFilter !== null) {
                  setFilter(newFilter);
                }
              }}
              size="small"
              sx={{
                '& .MuiToggleButton-root': {
                  px: 2,
                  py: 0.5,
                  fontSize: '0.75rem',
                  textTransform: 'none',
                  border: 1,
                  borderColor: 'divider',
                },
              }}
            >
              <ToggleButton value="all">
                {t('mailbox.stats.total')}: {stats.totalCount.toLocaleString()}
              </ToggleButton>
              <ToggleButton value="unread">
                {t('mailbox.stats.unread')}: {stats.unreadCount.toLocaleString()}
              </ToggleButton>
              <ToggleButton value="starred">
                {t('mailbox.stats.starred')}: {stats.starredCount.toLocaleString()}
              </ToggleButton>
            </ToggleButtonGroup>
            <Box sx={{ flex: 1 }} />

            {/* Mark All as Read Button */}
            <Tooltip title={t('mailbox.markAllAsRead')}>
              <span>
                <IconButton
                  size="small"
                  onClick={handleMarkAllAsReadClick}
                  disabled={!stats || stats.unreadCount === 0}
                  color="primary"
                >
                  <CheckCircleIcon />
                </IconButton>
              </span>
            </Tooltip>

            {/* Empty Mailbox Button */}
            <Tooltip title={t('mailbox.emptyMailbox')}>
              <span>
                <IconButton
                  size="small"
                  onClick={handleEmptyMailboxClick}
                  color="error"
                  disabled={!stats || (
                    filter === 'unread' ? stats.unreadCount === 0 :
                      filter === 'starred' ? stats.starredCount === 0 :
                        stats.totalCount === 0
                  )}
                >
                  <DeleteSweepIcon />
                </IconButton>
              </span>
            </Tooltip>

            {/* Refresh Button */}
            <Tooltip title={t('common.refresh')}>
              <IconButton size="small" onClick={() => { loadMails(true); loadStats(); }}>
                <RefreshIcon />
              </IconButton>
            </Tooltip>
          </Box>
        )}

        {/* Mail panels container */}
        <Box sx={{ flex: 1, display: 'flex', gap: 2, minHeight: 0, pt: stats && currentTab === 'received' ? '60px' : 0 }}>
          {/* Mail List */}
          <Paper sx={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            maxWidth: 400,
            position: 'relative',
            borderTopLeftRadius: 0,
            borderTopRightRadius: 0,
          }}>
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
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <IconButton
                                size="small"
                                onClick={(e) => handleStarToggle(mail.id, e)}
                              >
                                {mail.isStarred ? (
                                  <StarIcon sx={{ color: 'warning.main' }} />
                                ) : (
                                  <StarBorderIcon />
                                )}
                              </IconButton>
                            </Box>
                          }
                        >
                          <ListItemButton
                            selected={selectedMail?.id === mail.id}
                            onClick={() => handleMailClick(mail)}
                            sx={{
                              py: 1,
                              '&:hover': {
                                backgroundColor: 'action.hover',
                              },
                            }}
                          >
                            <ListItemIcon sx={{ minWidth: 40 }}>
                              <Checkbox
                                edge="start"
                                checked={selectedMailIds.includes(mail.id)}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleCheckboxToggle(mail.id);
                                }}
                              />
                            </ListItemIcon>
                            <ListItemIcon sx={{ minWidth: 36 }}>
                              {mail.isRead ? (
                                <DraftsIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
                              ) : (
                                <MailOutlineIcon sx={{ color: 'primary.main', fontSize: 20 }} />
                              )}
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
          <Paper sx={{
            flex: 2,
            overflow: 'auto',
            p: 3,
            borderTopLeftRadius: 0,
            borderTopRightRadius: 0,
          }}>
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
                  {Boolean(selectedMail.isRead && selectedMail.readAt) && (
                    <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                      {t('mailbox.readAt')}: {formatDate(selectedMail.readAt)}
                    </Typography>
                  )}
                </Box>
                <Divider sx={{ mb: 2 }} />
                <Box
                  className="ql-editor"
                  sx={{
                    padding: 0,
                    '& p': {
                      margin: 0,
                      padding: 0,
                      minHeight: '1em',
                    },
                    '& p:empty': {
                      minHeight: '1em',
                    },
                    '& a': { color: 'primary.main', textDecoration: 'underline' },
                    '& img': { maxWidth: '100%', height: 'auto' },
                  }}
                  dangerouslySetInnerHTML={{ __html: selectedMail.content }}
                />
              </Box>
            ) : (
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '100%',
                  flexDirection: 'column',
                  gap: 2,
                }}
              >
                <Box
                  sx={{
                    animation: mails.length > 0 ? 'bounce 1.5s ease-in-out infinite' : 'none',
                    '@keyframes bounce': {
                      '0%, 100%': {
                        transform: 'translateY(0) rotate(0deg)',
                        opacity: 0.7,
                      },
                      '25%': {
                        transform: 'translateY(-15px) rotate(-5deg)',
                        opacity: 1,
                      },
                      '50%': {
                        transform: 'translateY(0) rotate(0deg)',
                        opacity: 0.8,
                      },
                      '75%': {
                        transform: 'translateY(-8px) rotate(5deg)',
                        opacity: 1,
                      },
                    },
                  }}
                >
                  <MailIcon sx={{ fontSize: 64, color: 'text.disabled' }} />
                </Box>
                <Typography
                  variant="body1"
                  color="text.secondary"
                  sx={{
                    animation: mails.length > 0 ? 'textBounce 1.5s ease-in-out infinite' : 'none',
                    '@keyframes textBounce': {
                      '0%, 100%': {
                        opacity: 0.6,
                        transform: 'translateY(0)',
                      },
                      '50%': {
                        opacity: 1,
                        transform: 'translateY(-3px)',
                      },
                    },
                  }}
                >
                  {mails.length > 0 ? t('mailbox.selectMail') : t('mailbox.noMails')}
                </Typography>
              </Box>
            )}
          </Paper>

          {/* New Mail Floating Button */}
          <Zoom in={showNewMailButton}>
            <Fab
              color="primary"
              size="medium"
              onClick={handleScrollToNewMails}
              sx={{
                position: 'absolute',
                top: 80,
                left: 180,
                zIndex: 101,
                boxShadow: 3,
              }}
            >
              <Badge badgeContent={newMailCount} color="error">
                <ArrowUpwardIcon />
              </Badge>
            </Fab>
          </Zoom>
        </Box>
      </Box>

      {/* Compose Mail Dialog */}
      <ComposeMailDialog
        open={composeDialogOpen}
        onClose={handleComposeClose}
        onSend={async (data) => {
          // Combine original and translated content if translation is enabled
          let finalContent = data.content;
          if (data.translatedContent && data.translatedContent.trim()) {
            finalContent = `${data.content}\n\n--- Translated (${data.translationLanguage}) ---\n${data.translatedContent}`;
          }

          // Send mail to all recipients
          for (const recipient of data.recipients) {
            await mailService.sendMail({
              recipientId: recipient.id,
              subject: data.subject,
              content: finalContent,
              priority: data.priority,
            });
          }

          enqueueSnackbar(t('mailbox.mailSent'), { variant: 'success' });
          loadMails();
          loadStats();
        }}
        onSearchUsers={async (query) => {
          const results = await chatService.searchUsers(query);
          return results.map(u => ({
            ...u,
            name: u.name || u.username || u.email.split('@')[0],
          })) as any;
        }}
        onTranslate={async (content, targetLang) => {
          const result = await translationService.translateText({
            text: content,
            targetLanguage: targetLang as 'ko' | 'zh' | 'en',
            sourceLanguage: 'auto',
          });
          return result.translatedText;
        }}
      />

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

      {/* Empty Mailbox Confirmation Dialog */}
      <Dialog
        open={emptyMailboxConfirmOpen}
        onClose={handleEmptyMailboxCancel}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>{t('mailbox.emptyMailboxConfirmTitle')}</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            {t('mailbox.emptyMailboxWarning')}
          </Alert>
          <Typography>
            {t('mailbox.emptyMailboxConfirmMessage', {
              count: filter === 'unread' ? (stats?.unreadCount || 0) :
                filter === 'starred' ? (stats?.starredCount || 0) :
                  (stats?.totalCount || 0)
            })}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleEmptyMailboxCancel}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleEmptyMailboxConfirm} color="error" variant="contained">
            {t('mailbox.emptyMailbox')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Mark All as Read Confirmation Dialog */}
      <Dialog
        open={markAllReadConfirmOpen}
        onClose={handleMarkAllAsReadCancel}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>{t('mailbox.markAllAsReadConfirmTitle')}</DialogTitle>
        <DialogContent>
          <Typography>
            {t('mailbox.markAllAsReadConfirmMessage', {
              count: filter === 'unread' ? (stats?.unreadCount || 0) :
                filter === 'starred' ? (stats?.starredCount || 0) :
                  (stats?.totalCount || 0)
            })}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleMarkAllAsReadCancel}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleMarkAllAsReadConfirm} color="primary" variant="contained">
            {t('mailbox.markAllAsRead')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default MailboxPage;


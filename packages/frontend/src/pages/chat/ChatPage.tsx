import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Paper,
  Grid,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
  Chip,
  Drawer,
  List,
  ListItem,
  Divider,
  IconButton,
  Tooltip,
  CircularProgress,
  Badge,
  useMediaQuery,
  Slide,
  useTheme,
  Fade,
} from '@mui/material';
import {
  Add as AddIcon,
  Chat as ChatIcon,
  People as PeopleIcon,
  Settings as SettingsIcon,
  Close as CloseIcon,
  Menu as MenuIcon,
  ChevronLeft as ChevronLeftIcon,
  PersonAdd as PersonAddIcon,
  Mail as MailIcon,
  Security as SecurityIcon,
  ArrowBack as ArrowBackIcon,
  Wifi as ConnectedIcon,
  WifiOff as DisconnectedIcon,
  Circle as StatusIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import { ChatProvider, useChat } from '../../contexts/ChatContext';
import { useAuth } from '../../contexts/AuthContext';
import { apiService } from '../../services/api';
import ChannelList from '../../components/chat/ChannelList';
import ChatElementsMessageList from '../../components/chat/ChatElementsMessageList';
import NotificationManager from '../../components/chat/NotificationManager';
import UserPresence from '../../components/chat/UserPresence';
import UserSearchDialog from '../../components/chat/UserSearchDialog';
import InvitationManager from '../../components/chat/InvitationManager';
import PrivacySettings from '../../components/chat/PrivacySettings';
import ThreadView from '../../components/chat/ThreadView';
import UserStatusPicker, { UserStatus } from '../../components/chat/UserStatusPicker';
import ChatSkeleton from '../../components/chat/ChatSkeleton';
import { CreateChannelRequest, SendMessageRequest } from '../../types/chat';
import { getChatWebSocketService } from '../../services/chatWebSocketService';

const ChatPageContent: React.FC = () => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const { user } = useAuth();
  const { state, actions } = useChat();
  const { joinChannel } = actions;
  const theme = useTheme();

  // ë°˜ì‘??ë¸Œë ˆ?´í¬?¬ì¸??(1200px ?´ìƒ?ì„œ ?¬ì´?œë°”?´ì‚¬?´ë“œ, ë¯¸ë§Œ?ì„œ ?¤íƒ)
  const isLargeScreen = useMediaQuery(theme.breakpoints.up('xl')); // 1536px+
  const isMediumScreen = useMediaQuery(theme.breakpoints.up('lg')); // 1200px+
  const [createChannelOpen, setCreateChannelOpen] = useState(false);
  const [isCreatingChannel, setIsCreatingChannel] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => {
    const saved = localStorage.getItem('chatSidebarOpen');
    return saved !== null ? JSON.parse(saved) : true; // ê¸°ë³¸ê°? ?´ë¦° ?íƒœ
  });
  const [channelFormData, setChannelFormData] = useState<CreateChannelRequest>({
    name: '',
    description: '',
    type: 'public',
  });
  // Get current selected channel from state
  const selectedChannel = state.currentChannelId
    ? state.channels.find(channel => channel.id === state.currentChannelId)
    : null;
  const [memberListOpen, setMemberListOpen] = useState(false);
  const [isWindowFocused, setIsWindowFocused] = useState(true);

  // ?ˆë¡œ???¤ì´?¼ë¡œê·??íƒœ??  const [userSearchOpen, setUserSearchOpen] = useState(false);
  const [invitationManagerOpen, setInvitationManagerOpen] = useState(false);
  const [privacySettingsOpen, setPrivacySettingsOpen] = useState(false);
  const [statusPickerOpen, setStatusPickerOpen] = useState(false);
  // Remember last opened thread per channel
  const LAST_THREAD_KEY = 'chatLastThreadByChannel';
  const loadLastThreadMap = (): Record<string, number> => {
    try { return JSON.parse(localStorage.getItem(LAST_THREAD_KEY) || '{}') as Record<string, number>; } catch { return {}; }
  };
  const saveLastThreadForChannel = (channelId: number, messageId: number | null) => {
    try {
      const map = loadLastThreadMap();
      if (messageId) map[String(channelId)] = messageId; else delete map[String(channelId)];
      localStorage.setItem(LAST_THREAD_KEY, JSON.stringify(map));
    } catch {}
  };
  const pendingThreadToOpenRef = useRef<number | null>(null);

  // Thread sidebar width constants
  const DEFAULT_THREAD_WIDTH = 400;
  const THREAD_MIN_WIDTH = 300;
  const THREAD_MAX_WIDTH = 900;

  // Thread sidebar width (resizable)
  const [threadWidth, setThreadWidth] = useState<number>(() => {
    const saved = Number(localStorage.getItem('chatThreadWidth') || DEFAULT_THREAD_WIDTH);
    const w = isNaN(saved) ? DEFAULT_THREAD_WIDTH : saved;
    return Math.min(Math.max(w, THREAD_MIN_WIDTH), THREAD_MAX_WIDTH);
  });
  const isResizingRef = useRef(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);
  const latestWidthRef = useRef(threadWidth);
  useEffect(() => { latestWidthRef.current = threadWidth; }, [threadWidth]);
  const didForceReloadRef = useRef(false);

  // Deduplicate error toasts within a short window
  const lastErrorRef = useRef<{ msg: string; ts: number } | null>(null);


  function onMouseMoveThreadResizer(e: MouseEvent) {
    if (!isResizingRef.current) return;
    const dx = startXRef.current - e.clientX; // move left -> increase width
    let newWidth = startWidthRef.current + dx;
    newWidth = Math.min(Math.max(newWidth, THREAD_MIN_WIDTH), THREAD_MAX_WIDTH);
    latestWidthRef.current = newWidth;
    setThreadWidth(newWidth);
  }

  function onMouseUpThreadResizer() {
    if (!isResizingRef.current) return;
    isResizingRef.current = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    window.removeEventListener('mousemove', onMouseMoveThreadResizer);
    window.removeEventListener('mouseup', onMouseUpThreadResizer);
    try { localStorage.setItem('chatThreadWidth', String(latestWidthRef.current)); } catch {}
  }

  const onMouseDownThreadResizer = (e: React.MouseEvent) => {
    isResizingRef.current = true;
    startXRef.current = e.clientX;
    startWidthRef.current = threadWidth;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', onMouseMoveThreadResizer);
    window.addEventListener('mouseup', onMouseUpThreadResizer);
  };


  // ë¡œë”© ?íƒœ ?•ì¸ - ì´ˆê¸° ë¡œë”© ì¤‘ì´ê±°ë‚˜ ì±„ë„???†ìœ¼ë©??¤ì¼ˆ?ˆí†¤ ?œì‹œ
  // ?¤ì¼ˆ?ˆí†¤ ?„ì „ ?œê±° - ë°”ë¡œ ì±„íŒ… UI ?œì‹œ
  const isInitialLoading = false;

  // ë¡œë”© ?íƒœ ?”ë²„ê¹?(?„ìš”??ì£¼ì„ ?´ì œ)
  // console.log('?” ChatPage loading state:', {
  //   isLoading: state.isLoading,
  //   loadingStage: state.loadingStage,
  //   channelsLength: state.channels.length,
  //   isInitialLoading
  // });

  // ?¤ë ˆ??ê´€???íƒœ
  const [threadMessage, setThreadMessage] = useState<Message | null>(null);
  const [isThreadOpen, setIsThreadOpen] = useState(false);

  // ?¤ë ˆ??ë·?ëª¨ë“œ ê²°ì • (???”ë©´: ?¬ì´?œë°”?´ì‚¬?´ë“œ, ?‘ì? ?”ë©´: ?¤íƒ)
  const threadViewMode = isMediumScreen ? 'sidebar' : 'stack';
  const [userStatus, setUserStatus] = useState<UserStatus>('online');
  const [statusMessage, setStatusMessage] = useState('');

  // Track window focus for notifications
  useEffect(() => {
    const handleFocus = () => setIsWindowFocused(true);
    const handleBlur = () => setIsWindowFocused(false);

    window.addEventListener('focus', handleFocus);
    window.addEventListener('blur', handleBlur);

    return () => {
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('blur', handleBlur);
    };
  }, []);

  // Prevent page-level vertical scroll on Chat page; scroll is managed inside the chat layout
  useEffect(() => {
    const prevOverflowY = document.body.style.overflowY;
    document.body.style.overflowY = 'hidden';
    return () => { document.body.style.overflowY = prevOverflowY; };
  }, []);

  // Load channels on mount
  useEffect(() => {
    // Channels are loaded in ChatContext when WebSocket connects
  }, []);

  // Handle errors with enqueueSnackbar (deduplicated)
  useEffect(() => {
    if (!state.error) return;

    // Translate error message if it's a known error key we standardize
    let errorMessage = state.error;
    if (state.error === 'Failed to load channels') {
      errorMessage = t('chat.loadChannelsFailed');
    }

    const now = Date.now();
    const prev = lastErrorRef.current;
    if (prev && prev.msg === errorMessage && (now - prev.ts) < 1200) {
      // Skip duplicate within 1.2s window
      actions.clearError();
      return;
    }
    lastErrorRef.current = { msg: errorMessage, ts: now };

    enqueueSnackbar(errorMessage, { variant: 'error' });
    actions.clearError();
  }, [state.error, t, enqueueSnackbar, actions]);


  // Auto-join channel when selected
  const [joinedChannels, setJoinedChannels] = useState<Set<number>>(new Set());
  const [joiningChannels, setJoiningChannels] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (state.currentChannelId &&
        joinChannel &&
        !joinedChannels.has(state.currentChannelId) &&
        !joiningChannels.has(state.currentChannelId) &&
        state.isConnected) { // WebSocket ?°ê²°???íƒœ?ì„œë§?join ?œë„

      console.log('Joining channel:', state.currentChannelId);
      setJoiningChannels(prev => new Set(prev).add(state.currentChannelId!));

      joinChannel(state.currentChannelId).then(() => {
        setJoinedChannels(prev => new Set(prev).add(state.currentChannelId!));
        setJoiningChannels(prev => {
          const newSet = new Set(prev);

          newSet.delete(state.currentChannelId!);
          return newSet;
        });
      }).catch((error) => {
        console.error('Failed to join channel:', error);
        setJoiningChannels(prev => {
          const newSet = new Set(prev);
          newSet.delete(state.currentChannelId!);
          return newSet;
        });
      });
    }
  }, [state.currentChannelId, joinChannel, joinedChannels, joiningChannels, state.isConnected]);

  // ?°ê²°???Šì–´ì¡Œì„ ??join ?íƒœ ì´ˆê¸°??  useEffect(() => {
    if (!state.isConnected) {
      setJoinedChannels(new Set());
      setJoiningChannels(new Set());
    }
  }, [state.isConnected]);

  // localStorage???¬ì´?œë°” ?íƒœ ?€??  useEffect(() => {
    localStorage.setItem('chatSidebarOpen', JSON.stringify(isSidebarOpen));
  }, [isSidebarOpen]);

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  const handleCreateChannel = async () => {
    try {
      if (!channelFormData.name.trim()) {
        enqueueSnackbar(t('chat.channelNameRequired'), { variant: 'error' });
        return;
      }

      setIsCreatingChannel(true);
      console.log('?? Creating channel:', channelFormData);
      const startTime = Date.now();

      const channel = await actions.createChannel(channelFormData);

      const duration = Date.now() - startTime;
      console.log('??Channel created successfully:', { channel, duration: `${duration}ms` });

      // ?ì„±??ì±„ë„ë¡??ë™ ?´ë™
      actions.setCurrentChannel(channel.id);

      setCreateChannelOpen(false);
      setChannelFormData({ name: '', description: '', type: 'public' });
      enqueueSnackbar(t('chat.channelCreated'), { variant: 'success' });
    } catch (error: any) {
      console.error('??Channel creation failed:', error);
      enqueueSnackbar(error.message || t('chat.createChannelFailed'), { variant: 'error' });
    } finally {
      setIsCreatingChannel(false);
    }
  };

  // ì±„ë„ ë³€ê²??? ?´ì „ ì±„ë„???´ë¦° ?¤ë ˆ?œëŠ” ?«ê³ , ??ì±„ë„?ì„œ ë§ˆì?ë§‰ìœ¼ë¡??´ë ¤?ˆë˜ ?¤ë ˆ?œë? ë³µì›
  useEffect(() => {
    // ?«ê¸° (?´ì „ ì±„ë„???¤ë ˆ?œê? ?¨ì•„?ˆëŠ” ë²„ê·¸ ë°©ì?)
    setIsThreadOpen(false);
    setThreadMessage(null);
    pendingThreadToOpenRef.current = null;

    const chId = state.currentChannelId;
    if (!chId) return;

    const map = loadLastThreadMap();
    const lastId = map[String(chId)];
    if (!lastId) return; // ??ì±„ë„?ì„œ ë³µì›???¤ë ˆ?œê? ?†ìœ¼ë©?ì¢…ë£Œ

    const msgs = state.messages[chId] || [];
    const found = msgs.find(m => m.id === lastId);
    if (found) {
      // ?¤ë ˆ??ë³µì› ???½ê°„???œë ˆ?´ë? ì£¼ì–´ ë©”ì¸ ?…ë ¥ì°??¬ì»¤?¤ì? ì¶©ëŒ ë°©ì?
      setTimeout(() => {
        setThreadMessage(found);
        setIsThreadOpen(true);
        pendingThreadToOpenRef.current = null;
      }, 50);
    } else {
      // ë©”ì‹œì§€ê°€ ?„ì§ ë¡œë“œ?˜ì? ?Šì? ê²½ìš°, ë¡œë”© ???´ë„ë¡??ˆì•½?´ë‘ 
      pendingThreadToOpenRef.current = lastId;
    }
  }, [state.currentChannelId]);

  // ë©”ì‹œì§€ ë¡œë”© ?„ë£Œ ?? ?€ê¸?ì¤‘ì¸ ?¤ë ˆ?œê? ?ˆìœ¼ë©??ë™?¼ë¡œ ?´ê¸°
  useEffect(() => {
    const chId = state.currentChannelId;
    const pendingId = pendingThreadToOpenRef.current;
    if (!chId || !pendingId) return;

    const msgs = state.messages[chId] || [];
    if (!msgs.length) return;

    const found = msgs.find(m => m.id === pendingId);
    if (found) {
      setThreadMessage(found);
      setIsThreadOpen(true);
      pendingThreadToOpenRef.current = null;
    }
  }, [state.currentChannelId, state.messages]);
  const handleSendMessage = async (message: string, attachments?: File[]) => {
    if (!state.currentChannelId) return;

    try {
      const messageData: SendMessageRequest = {
        content: message,
        channelId: state.currentChannelId,
        type: attachments && attachments.length > 0 ? 'file' : 'text',
        attachments,
      };

      await actions.sendMessage(state.currentChannelId, messageData);
    } catch (error: any) {
      // ?ëŸ¬??ChatContext?ì„œ ì²˜ë¦¬?˜ë?ë¡??¬ê¸°?œëŠ” ë³„ë„ ? ìŠ¤???œì‹œ?˜ì? ?ŠìŒ
      // ChatContext??SET_ERROR ?¡ì…˜?¼ë¡œ ?ëŸ¬ê°€ ?¤ì •?˜ê³  ?˜ë‹¨??Snackbar?ì„œ ?œì‹œ??    }
  };

  const currentChannel = state.channels.find(c => c.id === state.currentChannelId);

  // ?¬ìš©??ì´ˆë? ?¸ë“¤??  const handleInviteUser = async (userId: number) => {
    if (!state.currentChannelId) {
      throw new Error('No channel selected');
    }

    try {
      await actions.inviteUser(state.currentChannelId, userId);
      console.log('??Invitation sent successfully');
    } catch (error: any) {
      console.error('??Failed to invite user:', error);
      throw error;
    }
  };

  // ?¬ìš©???íƒœ ë³€ê²??¸ë“¤??  const handleStatusChange = async (status: UserStatus, message?: string) => {
    try {
      // WebSocket???µí•´ ?œë²„???íƒœ ?…ë°?´íŠ¸
      const wsService = getChatWebSocketService();
      if (wsService.isConnected()) {
        wsService.updateStatus(status, message);
        setUserStatus(status);
        setStatusMessage(message || '');
        enqueueSnackbar(t('chat.statusUpdated'), { variant: 'success' });
      } else {
        throw new Error('WebSocket not connected');
      }
    } catch (error) {
      console.error('Failed to update status:', error);
      enqueueSnackbar(t('chat.statusUpdateFailed'), { variant: 'error' });
    }
  };

  // ?¤ë ˆ??ê´€???¸ë“¤??  const handleOpenThread = (message: Message) => {
    setThreadMessage(message);
    setIsThreadOpen(true);
    if (state.currentChannelId) {
      saveLastThreadForChannel(state.currentChannelId, message.id);
    }
  };

  const handleCloseThread = () => {
    setIsThreadOpen(false);
    setThreadMessage(null);
    if (state.currentChannelId) {
      // ?¬ìš©?ê? ëª…ì‹œ?ìœ¼ë¡??«ìœ¼ë©??´ë‹¹ ì±„ë„???ë™ ë³µì›?€ ë¹„ì?
      saveLastThreadForChannel(state.currentChannelId, null);
    }
  };

  const getStatusColor = (status: UserStatus) => {
    switch (status) {
      case 'online': return 'success.main';
      case 'away': return 'warning.main';
      case 'busy': return 'error.main';
      case 'invisible': return 'text.disabled';
      default: return 'success.main';
    }
  };

  // ?¤ì¼ˆ?ˆí†¤ ?œê±° - ??ƒ ì±„íŒ… UI ?œì‹œ
  // if (isInitialLoading) {
  //   return <ChatSkeleton stage={state.loadingStage} />;
  // }

  return (
    <Box
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        px: 3,
        py: 3
      }}
      onContextMenu={(e) => {
        // Disable right-click in chat content area
        e.preventDefault();
        return false;
      }}
    >
      {/* Header */}
      <Box sx={{ mb: 3, flexShrink: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
          <ChatIcon sx={{ fontSize: 32, color: 'primary.main' }} />
          <Typography variant="h4" sx={{ fontWeight: 600, flex: 1 }}>
            {t('chat.title')}
          </Typography>
          {/* ?¹ì†Œì¼??°ê²° ?íƒœ */}
          <Tooltip title={state.isConnected ? t('chat.connected') : t('chat.disconnected')} placement="bottom">
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              {state.isConnected ? (
                <ConnectedIcon sx={{
                  color: 'success.main',
                  fontSize: 28
                }} />
              ) : (
                <DisconnectedIcon sx={{
                  color: 'error.main',
                  fontSize: 28
                }} />
              )}
            </Box>
          </Tooltip>
        </Box>
        <Typography variant="body1" color="text.secondary">
          {t('chat.subtitle')}
        </Typography>
      </Box>



      {/* Main Chat Interface - ê¹œë¹¡??ë°©ì?ë¥??„í•´ Fade ?œê±° */}
      <Paper sx={{
        flex: 1,
        display: 'flex',
        minHeight: 0, // ì¤‘ìš”: flex ?„ì´?œì´ ì¶•ì†Œ?????ˆë„ë¡???        overflow: 'hidden'
      }}>
        {/* Channel List Sidebar */}
        <Box
          sx={{
            width: isSidebarOpen ? 300 : 48, // ?«íŒ ?íƒœ?ì„œ??ë²„íŠ¼ ê³µê°„ ?•ë³´
            borderRight: 1,
            borderColor: 'divider',
            height: '100%',
            overflow: 'hidden',
            transition: 'width 0.3s ease-in-out',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* ? ê? ë²„íŠ¼ */}
          <Box sx={{
            p: 1,
            borderBottom: isSidebarOpen ? 1 : 0,
            borderColor: 'divider',
            display: 'flex',
            justifyContent: isSidebarOpen ? 'flex-end' : 'center',
          }}>
            <IconButton
              onClick={toggleSidebar}
              size="small"
              sx={{
                '&:hover': {
                  backgroundColor: 'action.hover',
                }
              }}
            >
              {isSidebarOpen ? <ChevronLeftIcon /> : <MenuIcon />}
            </IconButton>
          </Box>

          {/* ì±„ë„ ëª©ë¡ */}
          {isSidebarOpen && (
            <>
              <Box sx={{ flex: 1, overflow: 'hidden' }}>
                <ChannelList
                  onCreateChannel={() => setCreateChannelOpen(true)}
                />
              </Box>

              {/* ?˜ë‹¨ ê¸°ëŠ¥ ë²„íŠ¼??*/}
              <Box sx={{ p: 1, borderTop: 1, borderColor: 'divider' }}>
                <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1 }}>
                  {/* ???íƒœ ?¤ì • ë²„íŠ¼ */}
                  <Tooltip title={t('chat.setStatus')} placement="top">
                    <IconButton
                      size="small"
                      onClick={() => setStatusPickerOpen(true)}
                      sx={{
                        border: 1,
                        borderColor: 'divider',
                        '&:hover': {
                          borderColor: 'primary.main',
                          backgroundColor: 'primary.50'
                        }
                      }}
                    >
                      <StatusIcon
                        fontSize="small"
                        sx={{ color: getStatusColor(userStatus) }}
                      />
                    </IconButton>
                  </Tooltip>

                  {/* ì´ˆë? ê´€ë¦?ë²„íŠ¼ */}
                  <Tooltip title={t('chat.manageInvitations')} placement="top">
                    <IconButton
                      size="small"
                      onClick={() => setInvitationManagerOpen(true)}
                      sx={{
                        border: 1,
                        borderColor: 'divider',
                        '&:hover': {
                          borderColor: 'primary.main',
                          backgroundColor: 'primary.50'
                        }
                      }}
                    >
                      <Badge
                        badgeContent={state.pendingInvitationsCount}
                        color="error"
                        max={99}
                        invisible={state.pendingInvitationsCount === 0}
                      >
                        <MailIcon fontSize="small" />
                      </Badge>
                    </IconButton>
                  </Tooltip>

                  {/* ?„ë¼?´ë²„???¤ì • ë²„íŠ¼ */}
                  <Tooltip title={t('chat.privacySettings')} placement="top">
                    <IconButton
                      size="small"
                      onClick={() => setPrivacySettingsOpen(true)}
                      sx={{
                        border: 1,
                        borderColor: 'divider',
                        '&:hover': {
                          borderColor: 'primary.main',
                          backgroundColor: 'primary.50'
                        }
                      }}
                    >
                      <SecurityIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Box>
              </Box>
            </>
          )}
        </Box>

        {/* Chat Area */}
        <Box sx={{ flex: 1, height: '100%', display: 'flex', position: 'relative' }}>
          {/* Main Chat - ?¤íƒ ëª¨ë“œ?ì„œ ?¤ë ˆ?œê? ?´ë¦¬ë©??¨ê? */}
          <Box
            sx={{
              flex: 1,
              height: '100%',
              display: threadViewMode === 'stack' && isThreadOpen ? 'none' : 'flex',
              flexDirection: 'column'
            }}
          >
            {state.currentChannelId ? (
              <ChatElementsMessageList
                channelId={state.currentChannelId}
                onSendMessage={handleSendMessage}
                onInviteUser={() => setUserSearchOpen(true)}
                onOpenThread={handleOpenThread}
                isThreadOpen={isThreadOpen}
              />
            ) : (
              <Box
                sx={{
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexDirection: 'column',
                  gap: 2,
                }}
              >
                <ChatIcon sx={{ fontSize: 64, color: 'text.secondary' }} />
                <Typography variant="h6" color="text.secondary">
                  {t('chat.selectChannelToStart')}
                </Typography>
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={() => setCreateChannelOpen(true)}
                >
                  {t('chat.createFirstChannel')}
                </Button>
              </Box>
            )}
          </Box>

          {/* Thread Panel - ?¬ì´?œë°” ëª¨ë“œ (ë¦¬ì‚¬?´ì¦ˆ ê°€?? */}
          {threadViewMode === 'sidebar' && isThreadOpen && threadMessage && (
            <>
              {/* Resizer */}
              <Box
                onMouseDown={onMouseDownThreadResizer}
                onDoubleClick={() => {
                  setThreadWidth(DEFAULT_THREAD_WIDTH);
                  try { localStorage.setItem('chatThreadWidth', String(DEFAULT_THREAD_WIDTH)); } catch {}
                }}
                sx={{
                  width: 8,
                  cursor: 'col-resize',
                  height: '100%',
                  position: 'relative',
                  backgroundColor: 'transparent',
                  '&:before': {
                    content: '""',
                    position: 'absolute',
                    left: '50%',
                    top: 0,
                    bottom: 0,
                    transform: 'translateX(-0.5px)',
                    width: '1px',
                    backgroundColor: 'divider',
                  },
                  '&:hover': { backgroundColor: 'action.hover' },
                }}
              />
              {/* Thread Panel */}
              <Box sx={{ width: threadWidth, minWidth: THREAD_MIN_WIDTH, maxWidth: THREAD_MAX_WIDTH, height: '100%' }}>
                <ThreadView
                  originalMessage={threadMessage}
                  onClose={handleCloseThread}
                />
              </Box>
            </>
          )}

          {/* Thread Panel - ?¤íƒ ëª¨ë“œ (?„ì²´ ?”ë©´ ?¤ë²„?ˆì´) */}
          {threadViewMode === 'stack' && isThreadOpen && threadMessage && (
            <Slide direction="left" in={isThreadOpen} mountOnEnter unmountOnExit>
              <Box
                sx={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  zIndex: 10,
                  backgroundColor: 'background.paper',
                }}
              >
                {/* ?¤ë¡œê°€ê¸??¤ë” */}
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    p: 2,
                    borderBottom: `1px solid ${theme.palette.divider}`,
                    backgroundColor: 'background.paper',
                  }}
                >
                  <IconButton onClick={handleCloseThread} sx={{ mr: 1 }}>
                    <ArrowBackIcon />
                  </IconButton>
                  <Typography variant="h6" sx={{ fontSize: '1rem' }}>
                    {t('chat.thread')}
                  </Typography>
                </Box>

                {/* ?¤ë ˆ??ì»¨í…ì¸?*/}
                <Box sx={{ height: 'calc(100% - 73px)' }}>
                  <ThreadView
                    originalMessage={threadMessage}
                    onClose={handleCloseThread}
                    hideHeader={true}
                  />
                </Box>
              </Box>
            </Slide>
          )}
        </Box>
      </Paper>

      {/* Create Channel Dialog */}
      <Dialog
        open={createChannelOpen}
        onClose={() => setCreateChannelOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box display="flex" alignItems="center" justifyContent="space-between">
            <Box>
              <Typography variant="h6">{t('chat.createChannel')}</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                {t('chat.createChannelSubtitle')}
              </Typography>
            </Box>
            <IconButton onClick={() => setCreateChannelOpen(false)} size="small">
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              label={t('chat.channelName')}
              value={channelFormData.name}
              onChange={(e) => setChannelFormData({ ...channelFormData, name: e.target.value })}
              fullWidth
              required
              autoFocus
              placeholder={t('chat.channelNamePlaceholder')}
            />

            <TextField
              label={t('chat.channelDescription')}
              value={channelFormData.description}
              onChange={(e) => setChannelFormData({ ...channelFormData, description: e.target.value })}
              fullWidth
              multiline
              rows={2}
              placeholder={t('chat.channelDescriptionPlaceholder')}
            />

            <FormControl component="fieldset">
              <FormLabel component="legend">
                {t('chat.channelType')}
              </FormLabel>
              <RadioGroup
                value={channelFormData.type}
                onChange={(e) => setChannelFormData({ ...channelFormData, type: e.target.value as 'public' | 'private' })}
              >
                <FormControlLabel
                  value="public"
                  control={<Radio />}
                  label={
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {t('chat.publicChannel')}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {t('chat.publicChannelDesc')}
                      </Typography>
                    </Box>
                  }
                />
                <FormControlLabel
                  value="private"
                  control={<Radio />}
                  label={
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {t('chat.privateChannel')}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {t('chat.privateChannelDesc')}
                      </Typography>
                    </Box>
                  }
                />
              </RadioGroup>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={handleCreateChannel}
            variant="contained"
            disabled={!channelFormData.name.trim() || isCreatingChannel}
            startIcon={isCreatingChannel ? <CircularProgress size={20} /> : undefined}
            fullWidth
          >
            {isCreatingChannel ? t('chat.creating') : t('chat.createChannel')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Member List Drawer */}
      <Drawer
        anchor="right"
        open={memberListOpen}
        onClose={() => setMemberListOpen(false)}
        PaperProps={{
          sx: { width: 300 },
        }}
      >
        <Box sx={{ p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="h6">
            {t('chat.memberList')}
          </Typography>
          <IconButton onClick={() => setMemberListOpen(false)}>
            <CloseIcon />
          </IconButton>
        </Box>
        <Divider />

        {selectedChannel && (
          <List>
            {selectedChannel.members?.map((user) => (
              <ListItem key={user.id}>
                <UserPresence
                  user={user}
                  variant="list"
                  showStatus={true}
                  showLastSeen={true}
                />
              </ListItem>
            ))}
          </List>
        )}
      </Drawer>

      {/* Notification Manager */}
      <NotificationManager
        currentUserId={user?.id || 0}
        activeChannelId={state.currentChannelId || undefined}
        isWindowFocused={isWindowFocused}
      />

      {/* ?ˆë¡œ???¤ì´?¼ë¡œê·¸ë“¤ */}
      <UserSearchDialog
        open={userSearchOpen}
        onClose={() => setUserSearchOpen(false)}
        onInviteUser={handleInviteUser}
        title={t('chat.inviteUsersToChannel')}
        subtitle={currentChannel ? t('chat.inviteUsersToChannelSubtitle', { channelName: currentChannel.name }) : undefined}
        excludeUserIds={user?.id ? [user.id] : []}
        channelId={state.currentChannelId || undefined}
      />

      <InvitationManager
        open={invitationManagerOpen}
        onClose={() => setInvitationManagerOpen(false)}
        title={t('chat.manageInvitations')}
        subtitle={t('chat.manageInvitationsSubtitle')}
        onInvitationAccepted={async (channelId) => {
          // ì´ˆë? ?˜ë½ ??ì±„ë„ ëª©ë¡ ?ˆë¡œê³ ì¹¨ ???´ë‹¹ ì±„ë„ë¡??´ë™
          console.log('?‰ Invitation accepted, refreshing channels and switching to channel:', channelId);

          try {
            // ì±„ë„ ëª©ë¡ ?ˆë¡œê³ ì¹¨
            await actions.loadChannels();

            // ì±„ë„ ?„í™˜
            actions.setCurrentChannel(channelId);

            // ì´ˆë? ê´€ë¦?ì°??«ê¸°
            setInvitationManagerOpen(false);

            console.log('??Successfully switched to accepted channel:', channelId);
          } catch (error) {
            console.error('??Failed to refresh channels after invitation acceptance:', error);
            // ?¤íŒ¨?´ë„ ì±„ë„ ?„í™˜?€ ?œë„
            actions.setCurrentChannel(channelId);
            setInvitationManagerOpen(false);
          }
        }}
      />

      <PrivacySettings
        open={privacySettingsOpen}
        onClose={() => setPrivacySettingsOpen(false)}
        title={t('chat.privacySettings')}
        subtitle={t('chat.privacySettingsSubtitle')}
      />

      <UserStatusPicker
        open={statusPickerOpen}
        onClose={() => setStatusPickerOpen(false)}
        currentStatus={userStatus}
        currentMessage={statusMessage}
        onStatusChange={handleStatusChange}
        title={t('chat.setStatus')}
        subtitle={t('chat.setStatusSubtitle')}
      />
    </Box>
  );
};

const ChatPage: React.FC = () => {
  return (
    <ChatProvider>
      <ChatPageContent />
    </ChatProvider>
  );
};

export default ChatPage;

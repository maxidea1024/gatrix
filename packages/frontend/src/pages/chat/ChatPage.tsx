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
import { CreateChannelRequest, SendMessageRequest, Message } from '../../types/chat';
import { getChatWebSocketService } from '../../services/chatWebSocketService';

const ChatPageContent: React.FC = () => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const { user } = useAuth();
  const { state, actions } = useChat();
  const { joinChannel } = actions;
  const theme = useTheme();

  // 반응형 브레이크포인트 (1200px 이상에서 사이드바이사이드, 미만에서 스택)
  const isLargeScreen = useMediaQuery(theme.breakpoints.up('xl')); // 1536px+
  const isMediumScreen = useMediaQuery(theme.breakpoints.up('lg')); // 1200px+
  const [createChannelOpen, setCreateChannelOpen] = useState(false);
  const [isCreatingChannel, setIsCreatingChannel] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => {
    const saved = localStorage.getItem('chatSidebarOpen');
    return saved !== null ? JSON.parse(saved) : true; // 기본값: 열린 상태
  });
  const [channelFormData, setChannelFormData] = useState<CreateChannelRequest>({
    name: '',
    description: '',
    type: 'public',
  });
  // Get current selected channel from state
  const selectedChannel = state.currentChannelId
    ? state.channels.find((channel) => channel.id === state.currentChannelId)
    : null;
  const [memberListOpen, setMemberListOpen] = useState(false);
  const [isWindowFocused, setIsWindowFocused] = useState(true);

  // 새로운 다이얼로그 상태들
  const [userSearchOpen, setUserSearchOpen] = useState(false);
  const [invitationManagerOpen, setInvitationManagerOpen] = useState(false);
  const [privacySettingsOpen, setPrivacySettingsOpen] = useState(false);
  const [statusPickerOpen, setStatusPickerOpen] = useState(false);
  // Remember last opened thread per channel
  const LAST_THREAD_KEY = 'chatLastThreadByChannel';
  const loadLastThreadMap = (): Record<string, number> => {
    try {
      return JSON.parse(localStorage.getItem(LAST_THREAD_KEY) || '{}') as Record<string, number>;
    } catch {
      return {};
    }
  };
  const saveLastThreadForChannel = (channelId: number, messageId: number | null) => {
    try {
      const map = loadLastThreadMap();
      if (messageId) map[String(channelId)] = messageId;
      else delete map[String(channelId)];
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
  useEffect(() => {
    latestWidthRef.current = threadWidth;
  }, [threadWidth]);
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
    try {
      localStorage.setItem('chatThreadWidth', String(latestWidthRef.current));
    } catch {}
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

  // 로딩 상태 확인 - 초기 로딩 중이거나 채널이 없으면 스켈레톤 표시
  // 스켈레톤 완전 제거 - 바로 채팅 UI 표시
  const isInitialLoading = false;

  // 로딩 상태 디버깅 (필요시 주석 해제)
  // console.log('🔍 ChatPage loading state:', {
  //   isLoading: state.isLoading,
  //   loadingStage: state.loadingStage,
  //   channelsLength: state.channels.length,
  //   isInitialLoading
  // });

  // 스레드 관련 상태
  const [threadMessage, setThreadMessage] = useState<any>(null);
  const [isThreadOpen, setIsThreadOpen] = useState(false);

  // 스레드 뷰 모드 결정 (큰 화면: 사이드바이사이드, 작은 화면: 스택)
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
    return () => {
      document.body.style.overflowY = prevOverflowY;
    };
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
    if (prev && prev.msg === errorMessage && now - prev.ts < 1200) {
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
    if (
      state.currentChannelId &&
      joinChannel &&
      !joinedChannels.has(state.currentChannelId) &&
      !joiningChannels.has(state.currentChannelId) &&
      state.isConnected
    ) {
      // WebSocket 연결된 상태에서만 join 시도

      console.log('Joining channel:', state.currentChannelId);
      setJoiningChannels((prev) => new Set(prev).add(state.currentChannelId!));

      joinChannel(state.currentChannelId)
        .then(() => {
          setJoinedChannels((prev) => new Set(prev).add(state.currentChannelId!));
          setJoiningChannels((prev) => {
            const newSet = new Set(prev);

            newSet.delete(state.currentChannelId!);
            return newSet;
          });
        })
        .catch((error) => {
          console.error('Failed to join channel:', error);
          setJoiningChannels((prev) => {
            const newSet = new Set(prev);
            newSet.delete(state.currentChannelId!);
            return newSet;
          });
        });
    }
  }, [state.currentChannelId, joinChannel, joinedChannels, joiningChannels, state.isConnected]);

  // 연결이 끊어졌을 때 join 상태 초기화
  useEffect(() => {
    if (!state.isConnected) {
      setJoinedChannels(new Set());
      setJoiningChannels(new Set());
    }
  }, [state.isConnected]);

  // localStorage에 사이드바 상태 저장
  useEffect(() => {
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
      console.log('🚀 Creating channel:', channelFormData);
      const startTime = Date.now();

      const channel = await actions.createChannel(channelFormData);

      const duration = Date.now() - startTime;
      console.log('✅ Channel created successfully:', {
        channel,
        duration: `${duration}ms`,
      });

      // 생성된 채널로 자동 이동
      actions.setCurrentChannel(channel.id);

      setCreateChannelOpen(false);
      setChannelFormData({ name: '', description: '', type: 'public' });
      enqueueSnackbar(t('chat.channelCreated'), { variant: 'success' });
    } catch (error: any) {
      console.error('❌ Channel creation failed:', error);
      enqueueSnackbar(error.message || t('chat.createChannelFailed'), {
        variant: 'error',
      });
    } finally {
      setIsCreatingChannel(false);
    }
  };

  // 채널 변경 시: 이전 채널의 열린 스레드는 닫고, 새 채널에서 마지막으로 열려있던 스레드를 복원
  useEffect(() => {
    // 닫기 (이전 채널의 스레드가 남아있는 버그 방지)
    setIsThreadOpen(false);
    setThreadMessage(null);
    pendingThreadToOpenRef.current = null;

    const chId = state.currentChannelId;
    if (!chId) return;

    const map = loadLastThreadMap();
    const lastId = map[String(chId)];
    if (!lastId) return; // 새 채널에서 복원할 스레드가 없으면 종료

    const msgs = state.messages[chId] || [];
    const found = msgs.find((m) => m.id === lastId);
    if (found) {
      // 스레드 복원 시 약간의 딜레이를 주어 메인 입력창 포커스와 충돌 방지
      setTimeout(() => {
        setThreadMessage(found);
        setIsThreadOpen(true);
        pendingThreadToOpenRef.current = null;
      }, 50);
    } else {
      // 메시지가 아직 로드되지 않은 경우, 로딩 후 열도록 예약해둠
      pendingThreadToOpenRef.current = lastId;
    }
  }, [state.currentChannelId]);

  // 메시지 로딩 완료 후, 대기 중인 스레드가 있으면 자동으로 열기
  useEffect(() => {
    const chId = state.currentChannelId;
    const pendingId = pendingThreadToOpenRef.current;
    if (!chId || !pendingId) return;

    const msgs = state.messages[chId] || [];
    if (!msgs.length) return;

    const found = msgs.find((m) => m.id === pendingId);
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
      // 에러는 ChatContext에서 처리하므로 여기서는 별도 토스트 표시하지 않음
      // ChatContext의 SET_ERROR 액션으로 에러가 설정되고 하단의 Snackbar에서 표시됨
    }
  };

  const currentChannel = state.channels.find((c) => c.id === state.currentChannelId);

  // 사용자 초대 핸들러
  const handleInviteUser = async (userId: number) => {
    if (!state.currentChannelId) {
      throw new Error('No channel selected');
    }

    try {
      await actions.inviteUser(state.currentChannelId, userId);
      console.log('✅ Invitation sent successfully');
    } catch (error: any) {
      console.error('❌ Failed to invite user:', error);
      throw error;
    }
  };

  // 사용자 상태 변경 핸들러
  const handleStatusChange = async (status: UserStatus, message?: string) => {
    try {
      // WebSocket을 통해 서버에 상태 업데이트
      const wsService = getChatWebSocketService(() => localStorage.getItem('accessToken'));
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

  // 스레드 관련 핸들러
  const handleOpenThread = (message: Message) => {
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
      // 사용자가 명시적으로 닫으면 해당 채널의 자동 복원은 비움
      saveLastThreadForChannel(state.currentChannelId, null);
    }
  };

  const getStatusColor = (status: UserStatus) => {
    switch (status) {
      case 'online':
        return 'success.main';
      case 'away':
        return 'warning.main';
      case 'busy':
        return 'error.main';
      case 'invisible':
        return 'text.disabled';
      default:
        return 'success.main';
    }
  };

  // 스켈레톤 제거 - 항상 채팅 UI 표시
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
        py: 3,
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
          {/* 웹소켓 연결 상태 */}
          <Tooltip
            title={state.isConnected ? t('chat.connected') : t('chat.disconnected')}
            placement="bottom"
          >
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              {state.isConnected ? (
                <ConnectedIcon
                  sx={{
                    color: 'success.main',
                    fontSize: 28,
                  }}
                />
              ) : (
                <DisconnectedIcon
                  sx={{
                    color: 'error.main',
                    fontSize: 28,
                  }}
                />
              )}
            </Box>
          </Tooltip>
        </Box>
        <Typography variant="body1" color="text.secondary">
          {t('chat.subtitle')}
        </Typography>
      </Box>

      {/* Main Chat Interface - 깜빡임 방지를 위해 Fade 제거 */}
      <Paper
        sx={{
          flex: 1,
          display: 'flex',
          minHeight: 0, // 중요: flex 아이템이 축소될 수 있도록 함
          overflow: 'hidden',
        }}
      >
        {/* Channel List Sidebar */}
        <Box
          sx={{
            width: isSidebarOpen ? 300 : 48, // 닫힌 상태에서도 버튼 공간 확보
            borderRight: 1,
            borderColor: 'divider',
            height: '100%',
            overflow: 'hidden',
            transition: 'width 0.3s ease-in-out',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* 토글 버튼 */}
          <Box
            sx={{
              p: 1,
              borderBottom: isSidebarOpen ? 1 : 0,
              borderColor: 'divider',
              display: 'flex',
              justifyContent: isSidebarOpen ? 'flex-end' : 'center',
            }}
          >
            <IconButton
              onClick={toggleSidebar}
              size="small"
              sx={{
                '&:hover': {
                  backgroundColor: 'action.hover',
                },
              }}
            >
              {isSidebarOpen ? <ChevronLeftIcon /> : <MenuIcon />}
            </IconButton>
          </Box>

          {/* 채널 목록 */}
          {isSidebarOpen && (
            <>
              <Box sx={{ flex: 1, overflow: 'hidden' }}>
                <ChannelList onCreateChannel={() => setCreateChannelOpen(true)} />
              </Box>

              {/* 하단 기능 버튼들 */}
              <Box sx={{ p: 1, borderTop: 1, borderColor: 'divider' }}>
                <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1 }}>
                  {/* 내 상태 설정 버튼 */}
                  <Tooltip title={t('chat.setStatus')} placement="top">
                    <IconButton
                      size="small"
                      onClick={() => setStatusPickerOpen(true)}
                      sx={{
                        border: 1,
                        borderColor: 'divider',
                        '&:hover': {
                          borderColor: 'primary.main',
                          backgroundColor: 'primary.50',
                        },
                      }}
                    >
                      <StatusIcon fontSize="small" sx={{ color: getStatusColor(userStatus) }} />
                    </IconButton>
                  </Tooltip>

                  {/* 초대 관리 버튼 */}
                  <Tooltip title={t('chat.manageInvitations')} placement="top">
                    <IconButton
                      size="small"
                      onClick={() => setInvitationManagerOpen(true)}
                      sx={{
                        border: 1,
                        borderColor: 'divider',
                        '&:hover': {
                          borderColor: 'primary.main',
                          backgroundColor: 'primary.50',
                        },
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

                  {/* 프라이버시 설정 버튼 */}
                  <Tooltip title={t('chat.privacySettings')} placement="top">
                    <IconButton
                      size="small"
                      onClick={() => setPrivacySettingsOpen(true)}
                      sx={{
                        border: 1,
                        borderColor: 'divider',
                        '&:hover': {
                          borderColor: 'primary.main',
                          backgroundColor: 'primary.50',
                        },
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
        <Box
          sx={{
            flex: 1,
            height: '100%',
            display: 'flex',
            position: 'relative',
          }}
        >
          {/* Main Chat - 스택 모드에서 스레드가 열리면 숨김 */}
          <Box
            sx={{
              flex: 1,
              height: '100%',
              display: threadViewMode === 'stack' && isThreadOpen ? 'none' : 'flex',
              flexDirection: 'column',
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

          {/* Thread Panel - 사이드바 모드 (리사이즈 가능) */}
          {threadViewMode === 'sidebar' && isThreadOpen && threadMessage && (
            <>
              {/* Resizer */}
              <Box
                onMouseDown={onMouseDownThreadResizer}
                onDoubleClick={() => {
                  setThreadWidth(DEFAULT_THREAD_WIDTH);
                  try {
                    localStorage.setItem('chatThreadWidth', String(DEFAULT_THREAD_WIDTH));
                  } catch {}
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
              <Box
                sx={{
                  width: threadWidth,
                  minWidth: THREAD_MIN_WIDTH,
                  maxWidth: THREAD_MAX_WIDTH,
                  height: '100%',
                }}
              >
                <ThreadView originalMessage={threadMessage} onClose={handleCloseThread} />
              </Box>
            </>
          )}

          {/* Thread Panel - 스택 모드 (전체 화면 오버레이) */}
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
                {/* 뒤로가기 헤더 */}
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

                {/* 스레드 컨텐츠 */}
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
              onChange={(e) =>
                setChannelFormData({
                  ...channelFormData,
                  description: e.target.value,
                })
              }
              fullWidth
              multiline
              rows={2}
              placeholder={t('chat.channelDescriptionPlaceholder')}
            />

            <FormControl component="fieldset">
              <FormLabel component="legend">{t('chat.channelType')}</FormLabel>
              <RadioGroup
                value={channelFormData.type}
                onChange={(e) =>
                  setChannelFormData({
                    ...channelFormData,
                    type: e.target.value as 'public' | 'private',
                  })
                }
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
        <Box
          sx={{
            p: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Typography variant="h6">{t('chat.memberList')}</Typography>
          <IconButton onClick={() => setMemberListOpen(false)}>
            <CloseIcon />
          </IconButton>
        </Box>
        <Divider />

        {selectedChannel && (
          <List>
            {selectedChannel.members?.map((member) => (
              <ListItem key={member.id}>
                <UserPresence
                  user={member.user}
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

      {/* 새로운 다이얼로그들 */}
      <UserSearchDialog
        open={userSearchOpen}
        onClose={() => setUserSearchOpen(false)}
        onInviteUser={handleInviteUser}
        title={t('chat.inviteUsersToChannel')}
        subtitle={
          currentChannel
            ? t('chat.inviteUsersToChannelSubtitle', {
                channelName: currentChannel.name,
              })
            : undefined
        }
        excludeUserIds={user?.id ? [user.id] : []}
        channelId={state.currentChannelId || undefined}
      />

      <InvitationManager
        open={invitationManagerOpen}
        onClose={() => setInvitationManagerOpen(false)}
        title={t('chat.manageInvitations')}
        subtitle={t('chat.manageInvitationsSubtitle')}
        onInvitationAccepted={async (channelId) => {
          // 초대 수락 후 채널 목록 새로고침 후 해당 채널로 이동
          console.log(
            '🎉 Invitation accepted, refreshing channels and switching to channel:',
            channelId
          );

          try {
            // Channel list will be refreshed via WebSocket events
            // No explicit loadChannels needed

            // 채널 전환
            actions.setCurrentChannel(channelId);

            // 초대 관리 창 닫기
            setInvitationManagerOpen(false);

            console.log('✅ Successfully switched to accepted channel:', channelId);
          } catch (error) {
            console.error('❌ Failed to refresh channels after invitation acceptance:', error);
            // 실패해도 채널 전환은 시도
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

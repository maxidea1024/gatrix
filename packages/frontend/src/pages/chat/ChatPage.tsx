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
  Alert,
  Snackbar,
  Drawer,
  List,
  ListItem,
  Divider,
  IconButton,
  Tooltip,
  CircularProgress,
  Badge,
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
import UserStatusPicker, { UserStatus } from '../../components/chat/UserStatusPicker';
import { CreateChannelRequest, SendMessageRequest } from '../../types/chat';
import { getChatWebSocketService } from '../../services/chatWebSocketService';

const ChatPageContent: React.FC = () => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const { user } = useAuth();
  const { state, actions } = useChat();
  const { joinChannel } = actions;
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
    ? state.channels.find(channel => channel.id === state.currentChannelId)
    : null;
  const [memberListOpen, setMemberListOpen] = useState(false);
  const [isWindowFocused, setIsWindowFocused] = useState(true);

  // 새로운 다이얼로그 상태들
  const [userSearchOpen, setUserSearchOpen] = useState(false);
  const [invitationManagerOpen, setInvitationManagerOpen] = useState(false);
  const [privacySettingsOpen, setPrivacySettingsOpen] = useState(false);
  const [statusPickerOpen, setStatusPickerOpen] = useState(false);
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

  // Load channels on mount
  useEffect(() => {
    // Channels are loaded in ChatContext when WebSocket connects
  }, []);

  // Auto-join channel when selected
  const [joinedChannels, setJoinedChannels] = useState<Set<number>>(new Set());
  const [joiningChannels, setJoiningChannels] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (state.currentChannelId &&
        joinChannel &&
        !joinedChannels.has(state.currentChannelId) &&
        !joiningChannels.has(state.currentChannelId) &&
        state.isConnected) { // WebSocket 연결된 상태에서만 join 시도

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
      console.log('✅ Channel created successfully:', { channel, duration: `${duration}ms` });

      // 생성된 채널로 자동 이동
      actions.setCurrentChannel(channel.id);

      setCreateChannelOpen(false);
      setChannelFormData({ name: '', description: '', type: 'public' });
      enqueueSnackbar(t('chat.channelCreated'), { variant: 'success' });
    } catch (error: any) {
      console.error('❌ Channel creation failed:', error);
      enqueueSnackbar(error.message || t('chat.createChannelFailed'), { variant: 'error' });
    } finally {
      setIsCreatingChannel(false);
    }
  };

  const handleSendMessage = async (message: string, attachments?: File[]) => {
    if (!state.currentChannelId) return;

    try {
      const messageData: SendMessageRequest = {
        content: message,
        type: attachments && attachments.length > 0 ? 'file' : 'text',
        attachments,
      };

      await actions.sendMessage(state.currentChannelId, messageData);
    } catch (error: any) {
      // 에러는 ChatContext에서 처리하므로 여기서는 별도 토스트 표시하지 않음
      // ChatContext의 SET_ERROR 액션으로 에러가 설정되고 하단의 Snackbar에서 표시됨
    }
  };

  const currentChannel = state.channels.find(c => c.id === state.currentChannelId);

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

  const getStatusColor = (status: UserStatus) => {
    switch (status) {
      case 'online': return 'success.main';
      case 'away': return 'warning.main';
      case 'busy': return 'error.main';
      case 'invisible': return 'text.disabled';
      default: return 'success.main';
    }
  };

  return (
    <Box sx={{ px: 3, py: 3, pb: 6 }}> {/* 하단 패딩을 6으로 늘림 (좌우와 동일한 24px) */}
      <Box sx={{
        height: 'calc(100vh - 160px)', // 하단 여백을 더 확보 (120px → 160px)
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <Box sx={{ mb: 3, flexShrink: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
          <ChatIcon sx={{ fontSize: 32, color: 'primary.main' }} />
          <Typography variant="h4" sx={{ fontWeight: 600, flex: 1 }}>
            {t('chat.title')}
          </Typography>
          {/* 웹소켓 연결 상태 */}
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



      {/* Main Chat Interface */}
      <Paper sx={{
        flex: 1,
        display: 'flex',
        minHeight: 0, // 중요: flex 아이템이 축소될 수 있도록 함
        overflow: 'hidden'
      }}>
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

          {/* 채널 목록 */}
          {isSidebarOpen && (
            <>
              <Box sx={{ flex: 1, overflow: 'hidden' }}>
                <ChannelList
                  onCreateChannel={() => setCreateChannelOpen(true)}
                />
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
        <Box sx={{ flex: 1, height: '100%' }}>
          {state.currentChannelId ? (
            <ChatElementsMessageList
              channelId={state.currentChannelId}
              onSendMessage={handleSendMessage}
              onInviteUser={() => setUserSearchOpen(true)}
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

      {/* Error Display */}
      {state.error && (
        <Snackbar
          open={Boolean(state.error)}
          autoHideDuration={6000}
          onClose={() => actions.clearError()}
        >
          <Alert severity="error" onClose={() => actions.clearError()}>
            {state.error}
          </Alert>
        </Snackbar>
      )}

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

      {/* 새로운 다이얼로그들 */}
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
        onInvitationAccepted={(channelId) => {
          // 초대 수락 후 해당 채널로 이동
          actions.setCurrentChannel(channelId);
          setInvitationManagerOpen(false);
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

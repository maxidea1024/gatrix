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
} from '@mui/material';
import {
  Add as AddIcon,
  Chat as ChatIcon,
  People as PeopleIcon,
  Settings as SettingsIcon,
  Close as CloseIcon,
  Menu as MenuIcon,
  ChevronLeft as ChevronLeftIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import { ChatProvider, useChat } from '../../contexts/ChatContext';
import { useAuth } from '../../contexts/AuthContext';
import ChannelList from '../../components/chat/ChannelList';
import ChatElementsMessageList from '../../components/chat/ChatElementsMessageList';
import NotificationManager from '../../components/chat/NotificationManager';
import UserPresence from '../../components/chat/UserPresence';
import { CreateChannelRequest, SendMessageRequest } from '../../types/chat';

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
        enqueueSnackbar(t('chat.channelNameRequired', 'Channel name is required'), { variant: 'error' });
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
      enqueueSnackbar(t('chat.channelCreated', 'Channel created successfully'), { variant: 'success' });
    } catch (error: any) {
      console.error('❌ Channel creation failed:', error);
      enqueueSnackbar(error.message || t('chat.createChannelFailed', 'Failed to create channel'), { variant: 'error' });
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

  return (
    <Box sx={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden'
    }}>
      {/* Header */}
      <Box sx={{ mb: 3, flexShrink: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
          <IconButton
            onClick={toggleSidebar}
            sx={{
              mr: 1,
              '&:hover': {
                backgroundColor: 'action.hover',
              }
            }}
          >
            {isSidebarOpen ? <ChevronLeftIcon /> : <MenuIcon />}
          </IconButton>
          <ChatIcon sx={{ fontSize: 32, color: 'primary.main' }} />
          <Typography variant="h4" sx={{ fontWeight: 600 }}>
            {t('chat.title', 'Chat')}
          </Typography>
        </Box>
        <Typography variant="body1" color="text.secondary">
          {t('chat.subtitle', 'Communicate with your team members in real-time')}
        </Typography>
      </Box>

      {/* Connection Status */}
      {!state.isConnected && (
        <Alert severity="warning" sx={{ mb: 2, flexShrink: 0 }}>
          {t('chat.disconnected', 'Disconnected from chat service. Trying to reconnect...')}
        </Alert>
      )}

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
            width: isSidebarOpen ? 300 : 0,
            borderRight: isSidebarOpen ? 1 : 0,
            borderColor: 'divider',
            height: '100%',
            overflow: 'hidden',
            transition: 'width 0.3s ease-in-out',
          }}
        >
          {isSidebarOpen && (
            <ChannelList
              onCreateChannel={() => setCreateChannelOpen(true)}
            />
          )}
        </Box>

        {/* Chat Area */}
        <Box sx={{ flex: 1, height: '100%' }}>
          {state.currentChannelId ? (
            <ChatElementsMessageList
              channelId={state.currentChannelId}
              onSendMessage={handleSendMessage}
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
                {t('chat.selectChannelToStart', 'Select a channel to start chatting')}
              </Typography>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => setCreateChannelOpen(true)}
              >
                {t('chat.createFirstChannel', 'Create your first channel')}
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
          {t('chat.createChannel', 'Create Channel')}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              label={t('chat.channelName', 'Channel Name')}
              value={channelFormData.name}
              onChange={(e) => setChannelFormData({ ...channelFormData, name: e.target.value })}
              fullWidth
              required
              placeholder={t('chat.channelNamePlaceholder', 'e.g., general, random, project-alpha')}
            />
            
            <TextField
              label={t('chat.channelDescription', 'Description')}
              value={channelFormData.description}
              onChange={(e) => setChannelFormData({ ...channelFormData, description: e.target.value })}
              fullWidth
              multiline
              rows={2}
              placeholder={t('chat.channelDescriptionPlaceholder', 'What is this channel about?')}
            />

            <FormControl component="fieldset">
              <FormLabel component="legend">
                {t('chat.channelType', 'Channel Type')}
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
                        {t('chat.publicChannel', 'Public Channel')}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {t('chat.publicChannelDesc', 'Anyone in the workspace can join')}
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
                        {t('chat.privateChannel', 'Private Channel')}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {t('chat.privateChannelDesc', 'Only invited members can join')}
                      </Typography>
                    </Box>
                  }
                />
              </RadioGroup>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateChannelOpen(false)}>
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button
            onClick={handleCreateChannel}
            variant="contained"
            disabled={!channelFormData.name.trim() || isCreatingChannel}
            startIcon={isCreatingChannel ? <CircularProgress size={20} /> : undefined}
          >
            {isCreatingChannel ? t('chat.creating', 'Creating...') : t('chat.createChannel', 'Create Channel')}
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
            {t('chat.memberList', 'Member List')}
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

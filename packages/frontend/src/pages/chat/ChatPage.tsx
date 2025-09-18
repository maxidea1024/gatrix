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
} from '@mui/material';
import {
  Add as AddIcon,
  Chat as ChatIcon,
  People as PeopleIcon,
  Settings as SettingsIcon,
  Close as CloseIcon,
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

  useEffect(() => {
    if (state.currentChannelId && joinChannel && !joinedChannels.has(state.currentChannelId)) {
      joinChannel(state.currentChannelId).then(() => {
        setJoinedChannels(prev => new Set(prev).add(state.currentChannelId!));
      }).catch((error) => {
        console.error('Failed to join channel:', error);
      });
    }
  }, [state.currentChannelId, joinChannel, joinedChannels]);

  const handleCreateChannel = async () => {
    try {
      if (!channelFormData.name.trim()) {
        enqueueSnackbar(t('chat.channelNameRequired', 'Channel name is required'), { variant: 'error' });
        return;
      }

      await actions.createChannel(channelFormData);
      setCreateChannelOpen(false);
      setChannelFormData({ name: '', description: '', type: 'public' });
      enqueueSnackbar(t('chat.channelCreated', 'Channel created successfully'), { variant: 'success' });
    } catch (error: any) {
      enqueueSnackbar(error.message || t('chat.createChannelFailed', 'Failed to create channel'), { variant: 'error' });
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
            width: 300, 
            borderRight: 1, 
            borderColor: 'divider',
            height: '100%',
          }}
        >
          <ChannelList 
            onCreateChannel={() => setCreateChannelOpen(true)}
          />
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
            disabled={!channelFormData.name.trim()}
          >
            {t('chat.createChannel', 'Create Channel')}
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

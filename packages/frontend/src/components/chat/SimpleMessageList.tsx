import React, { useEffect, useRef, useState } from 'react';
import { 
  Box, 
  Typography, 
  CircularProgress, 
  Paper, 
  TextField, 
  IconButton, 
  Avatar as MuiAvatar,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Divider
} from '@mui/material';
import { Send as SendIcon } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useChat } from '../../contexts/ChatContext';
import { Message, MessageType } from '../../types/chat';
import { format } from 'date-fns';
import { ko, enUS, zhCN } from 'date-fns/locale';

interface MessageListProps {
  channelId: number;
  onSendMessage?: (message: string, attachments?: File[]) => void;
}

const SimpleMessageList: React.FC<MessageListProps> = ({
  channelId,
  onSendMessage,
}) => {
  const { state, actions } = useChat();
  const { t, i18n } = useTranslation();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [messageInput, setMessageInput] = useState('');

  const currentChannel = state.channels.find(c => c.id === channelId);
  const messages = state.messages[channelId] || [];

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Load messages when channel changes
  useEffect(() => {
    if (channelId && messages.length === 0) {
      actions.loadMessages(channelId);
    }
  }, [channelId]);

  const handleSendMessage = () => {
    if (messageInput.trim() && currentChannel) {
      actions.sendMessage(currentChannel.id, {
        content: messageInput.trim(),
        type: 'text' as MessageType,
      });
      setMessageInput('');
    }
  };

  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSendMessage();
    }
  };

  const formatMessageTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const locale = i18n.language === 'ko' ? ko : i18n.language === 'zh' ? zhCN : enUS;
    return format(date, 'HH:mm', { locale });
  };

  const isMyMessage = (userId: number) => {
    return userId === state.user?.id;
  };

  if (messages.length === 0 && !state.isLoading) {
    return (
      <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <Paper elevation={1} sx={{ p: 2, borderRadius: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <MuiAvatar sx={{ bgcolor: 'primary.main' }}>
              {currentChannel?.name?.charAt(0) || 'C'}
            </MuiAvatar>
            <Box>
              <Typography variant="h6">
                {currentChannel?.name || t('chat.selectChannel', 'Select a channel')}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {currentChannel?.description || ''}
              </Typography>
            </Box>
          </Box>
        </Paper>

        {/* Empty state */}
        <Box sx={{ 
          flex: 1, 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          flexDirection: 'column',
          gap: 2
        }}>
          <Typography variant="h6" color="text.secondary">
            {t('chat.noMessages', 'No messages yet')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t('chat.startConversation', 'Start the conversation!')}
          </Typography>
        </Box>

        {/* Message Input */}
        <Paper elevation={1} sx={{ p: 2, borderRadius: 0 }}>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <TextField
              fullWidth
              multiline
              maxRows={4}
              placeholder={t('chat.typeMessage', 'Type a message...')}
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={!currentChannel}
            />
            <IconButton 
              color="primary" 
              onClick={handleSendMessage}
              disabled={!messageInput.trim() || !currentChannel}
            >
              <SendIcon />
            </IconButton>
          </Box>
        </Paper>
      </Box>
    );
  }

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Paper elevation={1} sx={{ p: 2, borderRadius: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <MuiAvatar sx={{ bgcolor: 'primary.main' }}>
            {currentChannel?.name?.charAt(0) || 'C'}
          </MuiAvatar>
          <Box>
            <Typography variant="h6">
              {currentChannel?.name || ''}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {currentChannel?.memberCount || 0} {t('chat.members', 'members')}
            </Typography>
          </Box>
        </Box>
      </Paper>

      {/* Messages */}
      <Box sx={{ flex: 1, overflow: 'auto', p: 1 }}>
        {state.isLoading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
            <CircularProgress size={24} />
          </Box>
        )}

        <List sx={{ py: 0 }}>
          {messages.map((message, index) => {
            const messageUser = state.users[message.userId];
            const senderName = messageUser?.username || messageUser?.name || `User ${message.userId}`;
            const isOwn = isMyMessage(message.userId);
            
            return (
              <ListItem 
                key={message.id} 
                sx={{ 
                  flexDirection: isOwn ? 'row-reverse' : 'row',
                  alignItems: 'flex-start',
                  py: 1
                }}
              >
                <ListItemAvatar sx={{ minWidth: isOwn ? 'auto' : 56, ml: isOwn ? 1 : 0, mr: isOwn ? 0 : 1 }}>
                  <MuiAvatar 
                    src={messageUser?.avatar}
                    sx={{ 
                      bgcolor: isOwn ? 'primary.main' : 'secondary.main',
                      width: 32,
                      height: 32,
                      fontSize: '0.875rem'
                    }}
                  >
                    {senderName.charAt(0).toUpperCase()}
                  </MuiAvatar>
                </ListItemAvatar>
                
                <Box sx={{ 
                  maxWidth: '70%',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: isOwn ? 'flex-end' : 'flex-start'
                }}>
                  <Paper 
                    elevation={1}
                    sx={{ 
                      p: 1.5,
                      bgcolor: isOwn ? 'primary.main' : 'grey.100',
                      color: isOwn ? 'primary.contrastText' : 'text.primary',
                      borderRadius: 2,
                      borderTopRightRadius: isOwn ? 0.5 : 2,
                      borderTopLeftRadius: isOwn ? 2 : 0.5,
                    }}
                  >
                    {!isOwn && (
                      <Typography variant="caption" sx={{ fontWeight: 'bold', mb: 0.5, display: 'block' }}>
                        {senderName}
                      </Typography>
                    )}
                    <Typography variant="body2">
                      {message.content}
                    </Typography>
                  </Paper>
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, px: 1 }}>
                    {formatMessageTime(message.createdAt)}
                  </Typography>
                </Box>
              </ListItem>
            );
          })}
        </List>
        
        <div ref={messagesEndRef} />
      </Box>

      {/* Message Input */}
      <Paper elevation={1} sx={{ p: 2, borderRadius: 0 }}>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <TextField
            fullWidth
            multiline
            maxRows={4}
            placeholder={t('chat.typeMessage', 'Type a message...')}
            value={messageInput}
            onChange={(e) => setMessageInput(e.target.value)}
            onKeyPress={handleKeyPress}
            disabled={!currentChannel}
          />
          <IconButton 
            color="primary" 
            onClick={handleSendMessage}
            disabled={!messageInput.trim() || !currentChannel}
          >
            <SendIcon />
          </IconButton>
        </Box>
      </Paper>
    </Box>
  );
};

export default SimpleMessageList;

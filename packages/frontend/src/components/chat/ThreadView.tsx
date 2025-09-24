import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Paper,
  Typography,
  IconButton,
  Divider,
  Avatar,
  TextField,
  Button,
  CircularProgress,
  Tooltip,
} from '@mui/material';
import {
  Close as CloseIcon,
  Send as SendIcon,
  Reply as ReplyIcon,
} from '@mui/icons-material';
import { useTheme } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';
import { useChat } from '../../contexts/ChatContext';
import { Message } from '../../types/chat';
import { formatDistanceToNow } from 'date-fns';
import { ko, enUS, zhCN } from 'date-fns/locale';

interface ThreadViewProps {
  originalMessage: Message;
  onClose: () => void;
  hideHeader?: boolean;
}

const ThreadView: React.FC<ThreadViewProps> = ({ originalMessage, onClose, hideHeader = false }) => {
  const theme = useTheme();
  const { t, i18n } = useTranslation();
  const { state, actions } = useChat();
  const [threadMessages, setThreadMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const getDateLocale = () => {
    switch (i18n.language) {
      case 'ko': return ko;
      case 'zh': return zhCN;
      default: return enUS;
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [threadMessages]);

  useEffect(() => {
    loadThreadMessages();
  }, [originalMessage.id]);

  const loadThreadMessages = async () => {
    setIsLoading(true);
    try {
      // 스레드 메시지 로드
      const threadMessages = await actions.getThreadMessages(originalMessage.id);
      setThreadMessages(threadMessages);
    } catch (error) {
      console.error('Failed to load thread messages:', error);
      setThreadMessages([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || isSending) return;

    setIsSending(true);
    try {
      // 스레드 메시지 전송
      await actions.sendMessage({
        content: newMessage,
        channelId: originalMessage.channelId,
        threadId: originalMessage.id
      });

      setNewMessage('');
      // 스레드 메시지 다시 로드
      await loadThreadMessages();
    } catch (error) {
      console.error('Failed to send thread message:', error);
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSendMessage();
    }
  };

  const getUserInfo = (userId: number) => {
    const user = state.users[userId];
    return {
      name: user?.name || user?.username || `User${userId}`,
      avatarUrl: user?.avatarUrl,
    };
  };

  const originalUserInfo = getUserInfo(originalMessage.userId);

  return (
    <Paper
      elevation={3}
      sx={{
        width: 400,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        borderRadius: 0,
        borderLeft: `1px solid ${theme.palette.divider}`,
      }}
    >
      {/* Header */}
      {!hideHeader && (
        <Box
          sx={{
            p: 2,
            borderBottom: `1px solid ${theme.palette.divider}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <ReplyIcon sx={{ fontSize: 20 }} />
            <Typography variant="h6" sx={{ fontSize: '1rem' }}>
              {t('chat.thread')}
            </Typography>
          </Box>
          <IconButton size="small" onClick={onClose}>
            <CloseIcon />
          </IconButton>
        </Box>
      )}

      {/* Original Message */}
      <Box sx={{ p: 2, borderBottom: `1px solid ${theme.palette.divider}` }}>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
          <Avatar
            src={originalUserInfo.avatarUrl}
            sx={{ width: 32, height: 32 }}
          >
            {originalUserInfo.name.charAt(0).toUpperCase()}
          </Avatar>
          <Box sx={{ flex: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                {originalUserInfo.name}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {formatDistanceToNow(new Date(originalMessage.createdAt), {
                  addSuffix: true,
                  locale: getDateLocale(),
                })}
              </Typography>
            </Box>
            <Typography variant="body2" sx={{ wordBreak: 'break-word' }}>
              {originalMessage.content}
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* Thread Messages */}
      <Box sx={{ flex: 1, overflow: 'auto', p: 1 }}>
        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
            <CircularProgress size={24} />
          </Box>
        ) : threadMessages.length === 0 ? (
          <Box sx={{ textAlign: 'center', p: 2, color: 'text.secondary' }}>
            <Typography variant="body2">
              {t('chat.noThreadMessages')}
            </Typography>
          </Box>
        ) : (
          threadMessages.map((message) => {
            const userInfo = getUserInfo(message.userId);
            return (
              <Box key={message.id} sx={{ mb: 2 }}>
                <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
                  <Avatar
                    src={userInfo.avatarUrl}
                    sx={{ width: 28, height: 28 }}
                  >
                    {userInfo.name.charAt(0).toUpperCase()}
                  </Avatar>
                  <Box sx={{ flex: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                      <Typography variant="caption" sx={{ fontWeight: 600 }}>
                        {userInfo.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {formatDistanceToNow(new Date(message.createdAt), {
                          addSuffix: true,
                          locale: getDateLocale(),
                        })}
                      </Typography>
                    </Box>
                    <Typography variant="body2" sx={{ wordBreak: 'break-word' }}>
                      {message.content}
                    </Typography>
                  </Box>
                </Box>
              </Box>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </Box>

      {/* Message Input */}
      <Box sx={{ p: 2, borderTop: `1px solid ${theme.palette.divider}` }}>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-end' }}>
          <TextField
            fullWidth
            multiline
            maxRows={4}
            placeholder={t('chat.replyToThread')}
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            disabled={isSending}
            size="small"
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: 2,
              },
            }}
          />
          <Tooltip title={t('chat.send')}>
            <span>
              <IconButton
                onClick={handleSendMessage}
                disabled={!newMessage.trim() || isSending}
                color="primary"
                sx={{
                  bgcolor: 'primary.main',
                  color: 'white',
                  '&:hover': {
                    bgcolor: 'primary.dark',
                  },
                  '&.Mui-disabled': {
                    bgcolor: 'action.disabled',
                    color: 'action.disabled',
                  },
                }}
              >
                {isSending ? (
                  <CircularProgress size={20} color="inherit" />
                ) : (
                  <SendIcon sx={{ fontSize: 20 }} />
                )}
              </IconButton>
            </span>
          </Tooltip>
        </Box>
      </Box>
    </Paper>
  );
};

export default ThreadView;

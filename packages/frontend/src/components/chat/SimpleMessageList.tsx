import React, { useEffect, useRef } from 'react';
import {
  Box,
  Typography,
  CircularProgress,
  Avatar as MuiAvatar,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Divider,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useChat } from '../../contexts/ChatContext';
import { Message, MessageType } from '../../types/chat';
import { format } from 'date-fns';
import { ko, enUS, zhCN } from 'date-fns/locale';
import AdvancedMessageInput from './AdvancedMessageInput';

interface MessageListProps {
  channelId: number;
  onSendMessage?: (message: string, attachments?: File[]) => void;
}

const SimpleMessageList: React.FC<MessageListProps> = ({ channelId, onSendMessage }) => {
  const { state, actions } = useChat();
  const { t, i18n } = useTranslation();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const currentChannel = state.channels.find((c) => c.id === channelId);
  const messages = state.messages[channelId] || [];

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    const scrollToBottom = () => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    // 초기 스크롤
    scrollToBottom();

    // 미디어 콘텐츠 로딩 완료를 위한 추가 체크
    const checkForMediaContent = () => {
      const messageContainer = messagesEndRef.current?.parentElement;
      if (!messageContainer) return;

      // 이미지, 비디오, iframe 등의 미디어 요소들 찾기
      const mediaElements = messageContainer.querySelectorAll(
        'img, video, iframe, [data-link-preview="container"], [data-link-preview="loaded"], [data-link-preview="loading"]'
      );

      if (mediaElements.length > 0) {
        let loadedCount = 0;
        const totalElements = mediaElements.length;

        const handleMediaLoad = () => {
          loadedCount++;

          if (loadedCount === totalElements) {
            setTimeout(scrollToBottom, 50);
          }
        };

        mediaElements.forEach((element) => {
          if (element.tagName === 'IMG') {
            const img = element as HTMLImageElement;
            if (img.complete) {
              handleMediaLoad();
            } else {
              img.addEventListener('load', handleMediaLoad, { once: true });
              img.addEventListener('error', handleMediaLoad, { once: true });
            }
          } else if (element.tagName === 'VIDEO') {
            const video = element as HTMLVideoElement;
            if (video.readyState >= 1) {
              handleMediaLoad();
            } else {
              video.addEventListener('loadedmetadata', handleMediaLoad, {
                once: true,
              });
              video.addEventListener('error', handleMediaLoad, { once: true });
            }
          } else if (element.tagName === 'IFRAME') {
            const iframe = element as HTMLIFrameElement;
            iframe.addEventListener('load', handleMediaLoad, { once: true });
            iframe.addEventListener('error', handleMediaLoad, { once: true });
            setTimeout(handleMediaLoad, 1000);
          } else {
            handleMediaLoad();
          }
        });

        // 안전장치: 3초 후에도 모든 미디어가 로드되지 않았다면 강제로 스크롤
        setTimeout(() => {
          if (loadedCount < totalElements) {
            scrollToBottom();
          }
        }, 3000);
      }
    };

    // 미디어 콘텐츠 체크를 위한 추가 지연
    setTimeout(checkForMediaContent, 200);
  }, [messages]);

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
              {currentChannel?.name?.charAt(0)}
            </MuiAvatar>
            <Box>
              <Typography variant="h6">
                {currentChannel?.name || t('chat.selectChannel')}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {currentChannel?.description || ''}
              </Typography>
            </Box>
          </Box>
        </Paper>

        {/* Empty state */}
        <Box
          sx={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column',
            gap: 2,
          }}
        >
          <Typography variant="h6" color="text.secondary">
            {t('chat.noMessages')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t('chat.startConversation')}
          </Typography>
        </Box>

        {/* Message Input */}
        <AdvancedMessageInput
          channelId={channelId}
          onSendMessage={(content, attachments) => {
            if (currentChannel) {
              actions.sendMessage({
                content,
                channelId: currentChannel.id,
                type: 'text' as MessageType,
                attachments,
              });
            }
          }}
          placeholder={t('chat.typeMessage')}
          disabled={!currentChannel}
        />
      </Box>
    );
  }

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Paper elevation={1} sx={{ p: 2, borderRadius: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <MuiAvatar sx={{ bgcolor: 'primary.main' }}>{currentChannel?.name?.charAt(0)}</MuiAvatar>
          <Box>
            <Typography variant="h6">{currentChannel?.name || ''}</Typography>
            <Typography variant="body2" color="text.secondary">
              {currentChannel?.memberCount || 0} {t('chat.members')}
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
            const senderName =
              messageUser?.username || messageUser?.name || `User ${message.userId}`;
            const isOwn = isMyMessage(message.userId);

            return (
              <ListItem
                key={message.id}
                sx={{
                  flexDirection: isOwn ? 'row-reverse' : 'row',
                  alignItems: 'flex-start',
                  py: 1,
                }}
              >
                <ListItemAvatar
                  sx={{
                    minWidth: isOwn ? 'auto' : 56,
                    ml: isOwn ? 1 : 0,
                    mr: isOwn ? 0 : 1,
                  }}
                >
                  <MuiAvatar
                    src={messageUser?.avatarUrl}
                    sx={{
                      bgcolor: isOwn ? 'primary.main' : 'secondary.main',
                      width: 32,
                      height: 32,
                      fontSize: '0.875rem',
                    }}
                  >
                    {senderName.charAt(0).toUpperCase()}
                  </MuiAvatar>
                </ListItemAvatar>

                <Box
                  sx={{
                    maxWidth: '70%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: isOwn ? 'flex-end' : 'flex-start',
                  }}
                >
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
                      <Typography
                        variant="caption"
                        sx={{ fontWeight: 'bold', mb: 0.5, display: 'block' }}
                      >
                        {senderName}
                      </Typography>
                    )}
                    <Typography variant="body2">{message.content}</Typography>
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
      <AdvancedMessageInput
        channelId={channelId}
        onSendMessage={(content, attachments) => {
          if (currentChannel) {
            actions.sendMessage({
              content,
              channelId: currentChannel.id,
              type: 'text' as MessageType,
              attachments,
            });
          }
        }}
        placeholder={t('chat.typeMessage')}
        disabled={!currentChannel}
      />
    </Box>
  );
};

export default SimpleMessageList;

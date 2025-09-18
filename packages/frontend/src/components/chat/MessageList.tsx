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
import TypingIndicator from './TypingIndicator';
import MessageContent from './MessageContent';

interface MessageListProps {
  channelId: number;
  onSendMessage?: (message: string, attachments?: File[]) => void;
}

const MessageList: React.FC<MessageListProps> = ({
  channelId,
  onSendMessage,
}) => {
  const { t, i18n } = useTranslation();
  const { state, actions } = useChat();
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const messages = state.messages[channelId] || [];
  const typingUsers = state.typingUsers[channelId] || [];
  const currentChannel = state.channels.find(c => c.id === channelId);

  const getDateLocale = () => {
    switch (i18n.language) {
      case 'ko': return ko;
      case 'zh': return zhCN;
      default: return enUS;
    }
  };

  const loadMoreMessages = async () => {
    if (isLoadingMore) return;

    try {
      setIsLoadingMore(true);
      await actions.loadMoreMessages(channelId);
    } catch (error) {
      console.error('Failed to load more messages:', error);
    } finally {
      setIsLoadingMore(false);
    }
  };

  const handleSendMessage = async (innerHtml: string, textContent: string, innerText: string, nodes: any[]) => {
    if (textContent.trim() && onSendMessage) {
      onSendMessage(textContent.trim());
    }
  };

  const handleAttachmentSend = async (files: File[]) => {
    if (files.length > 0 && onSendMessage) {
      onSendMessage('', files);
    }
  };

  // Convert our Message type to ChatScope MessageModel
  const convertToChatScopeMessages = (messages: Message[]): MessageModel[] => {
    return messages.map((msg, index) => {
      const currentUser = state.user;
      const direction = msg.userId === currentUser?.id ? 'outgoing' : 'incoming';

      // 사용자 정보 안전하게 가져오기
      const messageUser = state.users[msg.userId];
      const senderName = messageUser?.username || messageUser?.name || `User ${msg.userId}`;

      return {
        message: msg.content,
        sentTime: formatMessageTime(msg.createdAt),
        sender: senderName,
        direction: direction as any,
        position: getMessagePosition(msg, index),
        type: getMessageType(msg.type),
      };
    });
  };

  const getMessagePosition = (message: Message, index: number) => {
    const isFirst = index === 0 || messages[index - 1]?.userId !== message.userId;
    const isLast = index === messages.length - 1 || messages[index + 1]?.userId !== message.userId;

    if (isFirst && isLast) return 'single';
    if (isFirst) return 'first';
    if (isLast) return 'last';
    return 'normal';
  };

  const getMessageType = (type: MessageType) => {
    switch (type) {
      case 'image': return 'image';
      case 'video': return 'video';
      case 'audio': return 'audio';
      case 'file': return 'custom';
      default: return 'text';
    }
  };

  const formatMessageTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 24) {
      return format(date, 'HH:mm');
    } else if (diffInHours < 24 * 7) {
      return format(date, 'EEE HH:mm', { locale: getDateLocale() });
    } else {
      return format(date, 'MMM dd, HH:mm', { locale: getDateLocale() });
    }
  };

  const chatScopeMessages = convertToChatScopeMessages(messages);

  if (messages.length === 0 && !state.isLoading) {
    return (
      <MainContainer>
        <ChatContainer>
          <ConversationHeader>
            <Avatar name={currentChannel?.name || ''} />
            <ConversationHeader.Content
              userName={currentChannel?.name || t('chat.selectChannel', 'Select a channel')}
              info={currentChannel?.description || ''}
            />
          </ConversationHeader>

          <ChatMessageList>
            <MessageSeparator content={t('chat.noMessages', 'No messages yet')} />
          </ChatMessageList>

          <MessageInput
            placeholder={t('chat.typeMessage', 'Type a message...')}
            onSend={handleSendMessage}
            attachButton={true}
          />
        </ChatContainer>
      </MainContainer>
    );
  }

  return (
    <MainContainer>
      <ChatContainer>
        {/* Channel Header */}
        <ConversationHeader>
          <Avatar name={currentChannel?.name || ''} />
          <ConversationHeader.Content
            userName={currentChannel?.name || ''}
            info={`${currentChannel?.memberCount || 0} ${t('chat.members', 'members')}`}
          />
          <ConversationHeader.Actions>
            <VoiceCallButton />
            <VideoCallButton />
            <InfoButton />
          </ConversationHeader.Actions>
        </ConversationHeader>

        {/* Messages */}
        <ChatMessageList
          typingIndicator={
            typingUsers.length > 0 ? (
              <ChatTypingIndicator content={
                typingUsers.length === 1
                  ? t('chat.userTyping', '{{user}} is typing...', { user: typingUsers[0].user.username })
                  : t('chat.usersTyping', '{{count}} users are typing...', { count: typingUsers.length })
              } />
            ) : undefined
          }
        >
          {isLoadingMore && (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
              <CircularProgress size={24} />
            </Box>
          )}

          {chatScopeMessages.map((message, index) => {
            const originalMessage = messages[index];
            const messageUser = originalMessage ? state.users[originalMessage.userId] : null;

            return (
              <ChatMessage
                key={index}
                model={message}
              >
                <Avatar
                  src={messageUser?.avatar}
                  name={messageUser?.username || messageUser?.name || `User ${originalMessage?.userId || ''}`}
                />
              </ChatMessage>
            );
          })}
        </ChatMessageList>

        {/* Message Input */}
        <MessageInput
          placeholder={t('chat.typeMessage', 'Type a message...')}
          onSend={handleSendMessage}
          attachButton={true}
          disabled={!currentChannel}
        />
      </ChatContainer>
    </MainContainer>
  );
};

export default MessageList;

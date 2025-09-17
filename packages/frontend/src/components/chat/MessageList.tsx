import React, { useEffect, useRef, useState } from 'react';
import { Box, Typography, CircularProgress } from '@mui/material';
import {
  MainContainer,
  ChatContainer,
  MessageList as ChatMessageList,
  Message as ChatMessage,
  MessageInput,
  TypingIndicator as ChatTypingIndicator,
  Avatar,
  MessageSeparator,
  ConversationHeader,
  VoiceCallButton,
  VideoCallButton,
  InfoButton,
  MessageModel,
} from '@chatscope/chat-ui-kit-react';
import '@chatscope/chat-ui-kit-styles/dist/default/styles.min.css';
import { useTranslation } from 'react-i18next';
import { useChat } from '../../contexts/ChatContext';
import { Message, MessageType } from '../../types/chat';
import { format } from 'date-fns';
import { ko, enUS, zhCN } from 'date-fns/locale';
import TypingIndicator from './TypingIndicator';
import AdvancedMessageInput from './AdvancedMessageInput';
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
      const direction = msg.userId === state.users[msg.userId]?.id ? 'outgoing' : 'incoming';

      return {
        message: msg.content,
        sentTime: formatMessageTime(msg.createdAt),
        sender: msg.user.username,
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
            onAttachmentSend={handleAttachmentSend}
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

          {chatScopeMessages.map((message, index) => (
            <ChatMessage
              key={index}
              model={message}
            >
              <Avatar
                src={messages[index]?.user.avatar}
                name={messages[index]?.user.username || ''}
              />
            </ChatMessage>
          ))}
        </ChatMessageList>

        {/* Advanced Message Input */}
        <AdvancedMessageInput
          channelId={currentChannel?.id || 0}
          onSendMessage={(content, attachments) => {
            if (attachments && attachments.length > 0) {
              handleAttachmentSend(attachments);
            } else {
              handleSendMessage(content);
            }
          }}
          placeholder={t('chat.typeMessage', 'Type a message...')}
          disabled={!currentChannel}
        />
      </ChatContainer>
    </MainContainer>
  );
};

export default MessageList;

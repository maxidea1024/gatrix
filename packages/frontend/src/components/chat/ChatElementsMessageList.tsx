import React, { useEffect, useRef, useState } from 'react';
import { Box, Typography, Paper, IconButton, TextField, useTheme } from '@mui/material';
import { Send as SendIcon, AttachFile as AttachFileIcon } from '@mui/icons-material';
import { 
  MessageList, 
  Input, 
  Button, 
  Avatar,
  MessageBox,
  ChatItem,
  SystemMessage,
  LocationMessage,
  PhotoMessage,
  FileMessage,
  AudioMessage,
  VideoMessage,
  MeetingMessage,
  ReplyMessage,
  SpotifyMessage,
  MeetingLink
} from 'react-chat-elements';
import 'react-chat-elements/dist/main.css';

// 동적 스타일 생성 함수
const createCustomStyles = (isDark: boolean) => `
  .rce-mbox-text {
    color: ${isDark ? '#e8eaed' : '#000000'} !important;
  }
  .rce-mbox-right .rce-mbox-text {
    color: #ffffff !important;
  }
  .rce-mbox-left .rce-mbox-text {
    color: ${isDark ? '#e8eaed' : '#000000'} !important;
  }
  .rce-mbox-title {
    color: ${isDark ? '#9aa0a6' : '#666666'} !important;
  }

  /* 시스템 메시지 스타일 개선 */
  .rce-smsg {
    background: transparent !important;
    border: none !important;
    box-shadow: none !important;
    color: ${isDark ? '#9aa0a6' : '#666666'} !important;
    font-style: italic !important;
    text-align: center !important;
    padding: 20px !important;
  }

  /* 메시지 리스트 배경 및 스크롤 */
  .rce-container-mlist {
    background-color: ${isDark ? '#1e1e1e' : '#f5f5f5'} !important;
    overflow-y: auto !important;
    height: 100% !important;
    flex: 1 !important;
  }

  .message-list {
    background-color: ${isDark ? '#1e1e1e' : '#f5f5f5'} !important;
    overflow-y: auto !important;
    height: 100% !important;
  }

  /* 스크롤바 스타일링 */
  .rce-container-mlist::-webkit-scrollbar {
    width: 8px;
  }

  .rce-container-mlist::-webkit-scrollbar-track {
    background: ${isDark ? '#2a2d3a' : '#f1f1f1'};
  }

  .rce-container-mlist::-webkit-scrollbar-thumb {
    background: ${isDark ? '#5f6368' : '#c1c1c1'};
    border-radius: 4px;
  }

  .rce-container-mlist::-webkit-scrollbar-thumb:hover {
    background: ${isDark ? '#9aa0a6' : '#a8a8a8'};
  }

  /* 입력창 스타일 개선 */
  .rce-input {
    border: 1px solid ${isDark ? '#5f6368' : '#e0e0e0'} !important;
    border-radius: 25px !important;
    background: ${isDark ? '#3c4043' : '#ffffff'} !important;
  }

  .rce-input-textarea {
    color: ${isDark ? '#e8eaed' : '#333333'} !important;
    background: transparent !important;
  }

  /* 버튼 스타일 개선 */
  .rce-button {
    border-radius: 50% !important;
    min-width: 40px !important;
    height: 40px !important;
    padding: 8px !important;
  }
`;
import { useTranslation } from 'react-i18next';
import { useChat } from '../../contexts/ChatContext';
import { Message, MessageType } from '../../types/chat';
import { format } from 'date-fns';
import { ko, enUS, zhCN } from 'date-fns/locale';

interface ChatElementsMessageListProps {
  channelId: number;
  onSendMessage?: (message: string, attachments?: File[]) => void;
}

const ChatElementsMessageList: React.FC<ChatElementsMessageListProps> = ({
  channelId,
  onSendMessage,
}) => {
  const { state, actions } = useChat();
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageInputRef = useRef<HTMLInputElement>(null);
  const [messageInput, setMessageInput] = useState('');

  const currentChannel = state.channels.find(c => c.id === channelId);
  const messages = state.messages[channelId] || [];

  // 디버깅용 로그 (개발 환경에서만)
  if (process.env.NODE_ENV === 'development') {
    console.log('ChatElementsMessageList - channelId:', channelId);
    console.log('ChatElementsMessageList - messages:', messages);
    console.log('ChatElementsMessageList - isConnected:', state.isConnected);
  }

  // 테마에 따른 색상 정의
  const colors = {
    chatBackground: theme.palette.mode === 'dark' ? '#1e1e1e' : '#f5f5f5',
    inputBackground: theme.palette.mode === 'dark' ? '#2a2d3a' : '#f8f9fa',
    inputFieldBackground: theme.palette.mode === 'dark' ? '#3c4043' : '#ffffff',
    inputBorder: theme.palette.mode === 'dark' ? '#5f6368' : '#e0e0e0',
    inputText: theme.palette.mode === 'dark' ? '#e8eaed' : '#333333',
    placeholderText: theme.palette.mode === 'dark' ? '#9aa0a6' : '#666666',
    iconColor: theme.palette.mode === 'dark' ? '#9aa0a6' : '#666666',
    iconHover: theme.palette.mode === 'dark' ? '#484a4d' : '#f0f0f0',
    sendButton: theme.palette.mode === 'dark' ? '#1976d2' : '#007bff',
    sendButtonHover: theme.palette.mode === 'dark' ? '#1565c0' : '#0056b3',
    sendButtonDisabled: theme.palette.mode === 'dark' ? '#5f6368' : '#e0e0e0',
    emptyStateText: theme.palette.mode === 'dark' ? '#e8eaed' : '#333333',
    emptyStateSubtext: theme.palette.mode === 'dark' ? '#9aa0a6' : '#666666',
  };

  // Auto-scroll to bottom when new messages arrive (smart scroll logic)
  useEffect(() => {
    const messageContainer = document.querySelector('.rce-container-mlist');
    if (messageContainer && messages.length > 0) {
      const { scrollTop, scrollHeight, clientHeight } = messageContainer;

      // 스크롤바가 없는 경우 (컨텐츠가 컨테이너보다 작음)
      const hasScrollbar = scrollHeight > clientHeight;

      // 하단에 있는지 확인 (5px 여유)
      const isAtBottom = scrollTop + clientHeight >= scrollHeight - 5;

      // 개발 환경에서만 스크롤 상태 로그
      if (process.env.NODE_ENV === 'development') {
        console.log('📜 Scroll state:', {
          hasScrollbar,
          isAtBottom,
          scrollTop,
          scrollHeight,
          clientHeight,
          shouldAutoScroll: !hasScrollbar || isAtBottom
        });
      }

      // 스크롤바가 없거나 하단에 있을 경우에만 자동 스크롤
      if (!hasScrollbar || isAtBottom) {
        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 50);
      }
    }
  }, [messages]);

  // Auto-focus message input when channel changes or component mounts
  useEffect(() => {
    if (currentChannel && messageInputRef.current) {
      // 약간의 지연을 두어 렌더링 완료 후 포커스
      const timer = setTimeout(() => {
        messageInputRef.current?.focus();
        // 채널 변경 시 하단으로 스크롤
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);

      return () => clearTimeout(timer);
    }
  }, [channelId, currentChannel]);

  // Focus input when clicking anywhere in the chat area
  const handleChatAreaClick = () => {
    if (messageInputRef.current && currentChannel) {
      messageInputRef.current.focus();
    }
  };

  // 테마 변경 시 스타일 업데이트
  useEffect(() => {
    const isDark = theme.palette.mode === 'dark';
    const customStyles = createCustomStyles(isDark);

    // 기존 스타일 제거
    const existingStyle = document.getElementById('chat-custom-styles');
    if (existingStyle) {
      existingStyle.remove();
    }

    // 새 스타일 추가
    const styleElement = document.createElement('style');
    styleElement.id = 'chat-custom-styles';
    styleElement.textContent = customStyles;
    document.head.appendChild(styleElement);

    return () => {
      // 컴포넌트 언마운트 시 스타일 제거
      const styleToRemove = document.getElementById('chat-custom-styles');
      if (styleToRemove) {
        styleToRemove.remove();
      }
    };
  }, [theme.palette.mode]);

  // Load messages when channel changes
  useEffect(() => {
    console.log(`📨 Channel ${channelId} - Current messages:`, messages.length);
    if (channelId && messages.length === 0) {
      console.log(`🔄 Loading messages for channel ${channelId}...`);
      actions.loadMessages(channelId);
    } else if (channelId && messages.length > 0) {
      console.log(`✅ Channel ${channelId} already has ${messages.length} messages`);
    }
  }, [channelId, messages.length]);

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

  const getUserInfo = (userId: number) => {
    const user = state.users[userId];
    return {
      name: user?.username || user?.name || `User ${userId}`,
      avatar: user?.avatar || `https://ui-avatars.com/api/?name=${user?.username || 'User'}&background=random`,
    };
  };

  // Convert our messages to react-chat-elements format
  const convertToReactChatElements = () => {
    return messages.map((message, index) => {
      const userInfo = getUserInfo(message.userId);
      const isOwn = isMyMessage(message.userId);

      return {
        id: message.id,
        position: isOwn ? 'right' : 'left',
        type: 'text',
        title: userInfo.name,
        text: message.content,
        date: new Date(message.createdAt),
        avatar: userInfo.avatar,
        focus: false,
        titleColor: isOwn ? '#ffffff' : '#000000',
        forwarded: false,
        replyButton: false,
        removeButton: false,
        status: 'sent',
        notch: true,
        retracted: false,
        // 텍스트 색상 명시적 설정
        styles: {
          color: isOwn ? '#ffffff' : '#000000',
        },
      };
    });
  };

  const chatMessages = convertToReactChatElements();

  if (messages.length === 0 && !state.isLoading) {
    return (
      <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <Paper elevation={1} sx={{ p: 2, borderRadius: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Avatar
              src={`https://ui-avatars.com/api/?name=${currentChannel?.name || 'Channel'}&background=random`}
              alt={currentChannel?.name || 'Channel'}
              size="large"
              type="circle"
            />
            <Box sx={{ flex: 1 }}>
              <Typography variant="h6">
                {currentChannel?.name || t('chat.selectChannel', 'Select a channel')}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {currentChannel?.description || ''}
              </Typography>
            </Box>
            {/* 연결 상태 표시 */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box
                sx={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  backgroundColor: state.isConnected ? '#4caf50' : '#f44336',
                }}
              />
              <Typography variant="caption" color="text.secondary">
                {state.isConnected ? '연결됨' : '연결 끊김'}
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
            gap: 3,
            p: 4,
            backgroundColor: colors.chatBackground,
            cursor: 'text'
          }}
          onClick={handleChatAreaClick}
        >
          <Box sx={{
            textAlign: 'center',
            color: colors.emptyStateSubtext,
            maxWidth: 400,
          }}>
            <Typography variant="h5" sx={{
              mb: 2,
              fontWeight: 300,
              color: colors.emptyStateSubtext
            }}>
              💬
            </Typography>
            <Typography variant="h6" sx={{
              mb: 1,
              fontWeight: 500,
              color: colors.emptyStateText
            }}>
              {t('chat.noMessages', '아직 메시지가 없습니다')}
            </Typography>
            <Typography variant="body2" sx={{
              color: colors.emptyStateSubtext,
              lineHeight: 1.6
            }}>
              {t('chat.startConversation', '첫 번째 메시지를 보내서 대화를 시작해보세요!')}
            </Typography>
          </Box>
        </Box>

        {/* Message Input */}
        <Box sx={{ p: 2, backgroundColor: colors.inputBackground }}>
          <Box sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            backgroundColor: colors.inputFieldBackground,
            borderRadius: '25px',
            border: `1px solid ${colors.inputBorder}`,
            padding: '8px 16px',
            boxShadow: theme.palette.mode === 'dark' ? '0 2px 8px rgba(0,0,0,0.3)' : '0 2px 8px rgba(0,0,0,0.1)'
          }}>
            <IconButton
              size="small"
              sx={{
                color: colors.iconColor,
                '&:hover': { backgroundColor: colors.iconHover }
              }}
            >
              <AttachFileIcon />
            </IconButton>

            <TextField
              fullWidth
              multiline
              maxRows={4}
              placeholder={t('chat.typeMessage', '메시지를 입력하세요...')}
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={!currentChannel}
              variant="standard"
              inputRef={messageInputRef}
              InputProps={{
                disableUnderline: true,
                sx: {
                  fontSize: '14px',
                  color: colors.inputText,
                  '& input': {
                    padding: '8px 0',
                    color: colors.inputText,
                  },
                  '& textarea': {
                    padding: '8px 0',
                    color: colors.inputText,
                  },
                  '&::placeholder': {
                    color: colors.placeholderText,
                    opacity: 1,
                  }
                }
              }}
              sx={{
                '& .MuiInputBase-input::placeholder': {
                  color: colors.placeholderText,
                  opacity: 1,
                }
              }}
            />

            <IconButton
              onClick={handleSendMessage}
              disabled={!messageInput.trim() || !currentChannel}
              sx={{
                backgroundColor: messageInput.trim() ? colors.sendButton : colors.sendButtonDisabled,
                color: 'white',
                width: 36,
                height: 36,
                '&:hover': {
                  backgroundColor: messageInput.trim() ? colors.sendButtonHover : colors.sendButtonDisabled
                },
                '&:disabled': {
                  backgroundColor: colors.sendButtonDisabled,
                  color: colors.placeholderText
                }
              }}
            >
              <SendIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Box>
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Paper elevation={1} sx={{ p: 2, borderRadius: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Avatar
            src={`https://ui-avatars.com/api/?name=${currentChannel?.name || 'Channel'}&background=random`}
            alt={currentChannel?.name || 'Channel'}
            size="large"
            type="circle"
          />
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
      <Box
        sx={{
          flex: 1,
          overflow: 'auto',
          backgroundColor: colors.chatBackground,
          cursor: 'text',
          height: 0, // flex 컨테이너에서 스크롤을 위해 필요
          display: 'flex',
          flexDirection: 'column'
        }}
        onClick={handleChatAreaClick}
      >
        <MessageList
          className="message-list"
          lockable={false}
          toBottomHeight={0}
          dataSource={chatMessages}
        />
        <div ref={messagesEndRef} />
      </Box>

      {/* Message Input */}
      <Box sx={{ p: 2, backgroundColor: colors.inputBackground }}>
        <Box sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          backgroundColor: colors.inputFieldBackground,
          borderRadius: '25px',
          border: `1px solid ${colors.inputBorder}`,
          padding: '8px 16px',
          boxShadow: theme.palette.mode === 'dark' ? '0 2px 8px rgba(0,0,0,0.3)' : '0 2px 8px rgba(0,0,0,0.1)'
        }}>
          <IconButton
            size="small"
            sx={{
              color: colors.iconColor,
              '&:hover': { backgroundColor: colors.iconHover }
            }}
          >
            <AttachFileIcon />
          </IconButton>

          <TextField
            fullWidth
            multiline
            maxRows={4}
            placeholder={t('chat.typeMessage', '메시지를 입력하세요...')}
            value={messageInput}
            onChange={(e) => setMessageInput(e.target.value)}
            onKeyPress={handleKeyPress}
            disabled={!currentChannel}
            variant="standard"
            inputRef={messageInputRef}
            InputProps={{
              disableUnderline: true,
              sx: {
                fontSize: '14px',
                color: colors.inputText,
                '& input': {
                  padding: '8px 0',
                  color: colors.inputText,
                },
                '& textarea': {
                  padding: '8px 0',
                  color: colors.inputText,
                },
                '&::placeholder': {
                  color: colors.placeholderText,
                  opacity: 1,
                }
              }
            }}
            sx={{
              '& .MuiInputBase-input::placeholder': {
                color: colors.placeholderText,
                opacity: 1,
              }
            }}
          />

          <IconButton
            onClick={handleSendMessage}
            disabled={!messageInput.trim() || !currentChannel}
            sx={{
              backgroundColor: messageInput.trim() ? colors.sendButton : colors.sendButtonDisabled,
              color: 'white',
              width: 36,
              height: 36,
              '&:hover': {
                backgroundColor: messageInput.trim() ? colors.sendButtonHover : colors.sendButtonDisabled
              },
              '&:disabled': {
                backgroundColor: colors.sendButtonDisabled,
                color: colors.placeholderText
              }
            }}
          >
            <SendIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Box>
      </Box>
    </Box>
  );
};

export default ChatElementsMessageList;

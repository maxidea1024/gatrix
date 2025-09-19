import React, { useEffect, useRef, useState } from 'react';
import { Box, Typography, Paper, IconButton, TextField, useTheme, Avatar } from '@mui/material';
import {
  Send as SendIcon,
  AttachFile as AttachFileIcon,
  Wifi as ConnectedIcon,
  WifiOff as DisconnectedIcon
} from '@mui/icons-material';
// React Chat Elements는 더 이상 사용하지 않음 (슬랙 스타일로 직접 구현)
import moment from 'moment-timezone';
import { getStoredTimezone } from '../../utils/dateFormat';
import { extractUrlsFromMessage, extractLinkPreview } from '../../utils/linkPreview';
import LinkPreviewCard from './LinkPreviewCard';
import { LinkPreview } from '../../types/chat';

// 마크다운 스타일링을 위한 타입 정의
interface MessagePart {
  type: 'text' | 'code' | 'codeBlock' | 'bold' | 'italic' | 'strikethrough' | 'underline' | 'link';
  content: string;
  url?: string;
}

// 마크다운 파싱 함수
const parseMarkdown = (text: string): MessagePart[] => {
  const parts: MessagePart[] = [];
  let currentIndex = 0;

  // 정규식 패턴들 (우선순위 순서)
  const patterns = [
    { type: 'codeBlock' as const, regex: /```([\s\S]*?)```/g },
    { type: 'code' as const, regex: /`([^`]+)`/g },
    { type: 'link' as const, regex: /(https?:\/\/[^\s<>"{}|\\^`[\]]+)/g },
    { type: 'bold' as const, regex: /\*\*([^*]+)\*\*/g },
    { type: 'italic' as const, regex: /\*([^*]+)\*/g },
    { type: 'strikethrough' as const, regex: /~~([^~]+)~~/g },
    { type: 'underline' as const, regex: /__([^_]+)__/g },
  ];

  // 모든 매치를 찾아서 위치와 함께 저장
  const matches: Array<{
    type: MessagePart['type'];
    content: string;
    start: number;
    end: number;
    fullMatch: string;
  }> = [];

  patterns.forEach(({ type, regex }) => {
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      matches.push({
        type,
        content: match[1],
        start: match.index,
        end: match.index + match[0].length,
        fullMatch: match[0]
      });
    }
  });

  // 위치순으로 정렬
  matches.sort((a, b) => a.start - b.start);

  // 겹치는 매치 제거 (먼저 나온 것 우선)
  const filteredMatches = [];
  for (const match of matches) {
    const hasOverlap = filteredMatches.some(existing =>
      (match.start < existing.end && match.end > existing.start)
    );
    if (!hasOverlap) {
      filteredMatches.push(match);
    }
  }

  // 텍스트를 파트로 분할
  filteredMatches.forEach(match => {
    // 매치 이전의 일반 텍스트 추가
    if (currentIndex < match.start) {
      const textContent = text.slice(currentIndex, match.start);
      if (textContent) {
        parts.push({ type: 'text', content: textContent });
      }
    }

    // 매치된 부분 추가
    if (match.type === 'link') {
      parts.push({ type: match.type, content: match.content, url: match.content });
    } else {
      parts.push({ type: match.type, content: match.content });
    }
    currentIndex = match.end;
  });

  // 남은 텍스트 추가
  if (currentIndex < text.length) {
    const textContent = text.slice(currentIndex);
    if (textContent) {
      parts.push({ type: 'text', content: textContent });
    }
  }

  return parts.length > 0 ? parts : [{ type: 'text', content: text }];
};

// 링크 미리보기를 포함한 메시지 컴포넌트
const MessageWithPreview: React.FC<{ content: string; theme: any }> = ({ content, theme }) => {
  const [linkPreviews, setLinkPreviews] = useState<LinkPreview[]>([]);
  const [loadingPreviews, setLoadingPreviews] = useState(false);

  // URL 추출 및 미리보기 로딩
  useEffect(() => {
    const urls = extractUrlsFromMessage(content);
    if (urls.length > 0) {
      setLoadingPreviews(true);
      Promise.all(urls.map(url => extractLinkPreview(url)))
        .then(previews => {
          const validPreviews = previews.filter(preview => preview !== null) as LinkPreview[];
          setLinkPreviews(validPreviews);
        })
        .catch(error => {
          console.error('Failed to load link previews:', error);
        })
        .finally(() => {
          setLoadingPreviews(false);
        });
    }
  }, [content]);

  return (
    <>
      <MarkdownMessage content={content} theme={theme} />
      {linkPreviews.length > 0 && (
        <Box sx={{ marginTop: '8px' }}>
          {linkPreviews.map((preview, index) => (
            <LinkPreviewCard key={index} linkPreview={preview} />
          ))}
        </Box>
      )}
    </>
  );
};

// 마크다운 렌더링 컴포넌트
const MarkdownMessage: React.FC<{ content: string; theme: any }> = ({ content, theme }) => {
  const parts = parseMarkdown(content);

  return (
    <>
      {parts.map((part, index) => {
        switch (part.type) {
          case 'codeBlock':
            return (
              <Box
                key={index}
                component="pre"
                sx={{
                  backgroundColor: theme.palette.mode === 'dark' ? '#2d2d2d' : '#f6f8fa',
                  border: `1px solid ${theme.palette.mode === 'dark' ? '#444' : '#e1e4e8'}`,
                  borderRadius: '6px',
                  padding: '12px',
                  margin: '8px 0',
                  overflow: 'auto',
                  fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
                  fontSize: '13px',
                  lineHeight: 1.45,
                  color: theme.palette.mode === 'dark' ? '#e8eaed' : '#24292e',
                  whiteSpace: 'pre-wrap',
                  userSelect: 'text', // 코드 블록 텍스트 선택 허용
                  cursor: 'text'
                }}
              >
                {part.content}
              </Box>
            );
          case 'code':
            return (
              <Box
                key={index}
                component="code"
                sx={{
                  backgroundColor: theme.palette.mode === 'dark' ? '#2d2d2d' : '#f6f8fa',
                  border: `1px solid ${theme.palette.mode === 'dark' ? '#444' : '#e1e4e8'}`,
                  borderRadius: '3px',
                  padding: '2px 4px',
                  fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
                  fontSize: '13px',
                  color: theme.palette.mode === 'dark' ? '#e8eaed' : '#24292e',
                  userSelect: 'text', // 인라인 코드 텍스트 선택 허용
                  cursor: 'text'
                }}
              >
                {part.content}
              </Box>
            );
          case 'bold':
            return (
              <Box key={index} component="strong" sx={{ fontWeight: 700 }}>
                {part.content}
              </Box>
            );
          case 'italic':
            return (
              <Box key={index} component="em" sx={{ fontStyle: 'italic' }}>
                {part.content}
              </Box>
            );
          case 'strikethrough':
            return (
              <Box key={index} component="span" sx={{ textDecoration: 'line-through' }}>
                {part.content}
              </Box>
            );
          case 'underline':
            return (
              <Box key={index} component="span" sx={{ textDecoration: 'underline' }}>
                {part.content}
              </Box>
            );
          case 'link':
            return (
              <Box
                key={index}
                component="a"
                href={part.url}
                target="_blank"
                rel="noopener noreferrer"
                sx={{
                  color: theme.palette.mode === 'dark' ? '#8ab4f8' : '#1976d2',
                  textDecoration: 'none',
                  '&:hover': {
                    textDecoration: 'underline'
                  }
                }}
              >
                {part.content}
              </Box>
            );
          default:
            return <span key={index}>{part.content}</span>;
        }
      })}
    </>
  );
};



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
import { MessageType } from '../../types/chat';


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

  // 새 메시지가 올 때 하단에 있으면 자동 스크롤 (슬랙 스타일 컨테이너용)
  useEffect(() => {
    if (messages.length === 0) return;

    const scrollToBottom = () => {
      const messageContainer = document.querySelector('[data-testid="slack-messages-container"]') as HTMLElement;

      if (!messageContainer) {
        console.log('❌ Slack message container not found');
        return;
      }

      const { scrollTop, scrollHeight, clientHeight } = messageContainer;
      // 하단에서 100px 이내에 있으면 자동 스크롤
      const isAtBottom = scrollTop + clientHeight >= scrollHeight - 100;

      console.log('🔍 Slack scroll check:', {
        scrollTop,
        scrollHeight,
        clientHeight,
        isAtBottom,
        calculatedBottom: scrollHeight - clientHeight,
        difference: (scrollHeight - clientHeight) - scrollTop
      });

      if (isAtBottom) {
        console.log('📜 Auto-scrolling to bottom with smooth animation');
        messageContainer.scrollTo({
          top: scrollHeight,
          behavior: 'smooth'
        });
      } else {
        console.log('🚫 Not at bottom, keeping scroll position');
      }
    };

    // 초기 스크롤 체크
    setTimeout(scrollToBottom, 100);

    // 미디어 콘텐츠 로딩 완료를 위한 추가 체크
    const checkForMediaContent = () => {
      const messageContainer = document.querySelector('[data-testid="slack-messages-container"]') as HTMLElement;
      if (!messageContainer) return;

      // 이미지, 비디오, iframe 등의 미디어 요소들 찾기
      const mediaElements = messageContainer.querySelectorAll('img, video, iframe, [data-link-preview="container"], [data-link-preview="loaded"], [data-link-preview="loading"]');

      if (mediaElements.length > 0) {
        console.log(`🖼️ Found ${mediaElements.length} media elements, setting up load listeners`);

        let loadedCount = 0;
        const totalElements = mediaElements.length;

        const handleMediaLoad = () => {
          loadedCount++;
          console.log(`📸 Media loaded: ${loadedCount}/${totalElements}`);

          // 모든 미디어가 로드되었거나 마지막 요소가 로드된 후 스크롤 체크
          if (loadedCount === totalElements) {
            setTimeout(scrollToBottom, 50);
          }
        };

        mediaElements.forEach((element, index) => {
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
              video.addEventListener('loadedmetadata', handleMediaLoad, { once: true });
              video.addEventListener('error', handleMediaLoad, { once: true });
            }
          } else if (element.tagName === 'IFRAME') {
            const iframe = element as HTMLIFrameElement;
            iframe.addEventListener('load', handleMediaLoad, { once: true });
            iframe.addEventListener('error', handleMediaLoad, { once: true });
            // iframe의 경우 타임아웃도 설정
            setTimeout(handleMediaLoad, 1000);
          } else {
            // 기타 요소들 (링크 프리뷰 등)
            handleMediaLoad();
          }
        });

        // 안전장치: 3초 후에도 모든 미디어가 로드되지 않았다면 강제로 스크롤
        setTimeout(() => {
          if (loadedCount < totalElements) {
            console.log(`⏰ Timeout: Only ${loadedCount}/${totalElements} media loaded, forcing scroll`);
            scrollToBottom();
          }
        }, 3000);
      }
    };

    // 미디어 콘텐츠 체크를 위한 추가 지연
    setTimeout(checkForMediaContent, 200);
  }, [messages]);

  // Auto-focus message input when channel changes or component mounts
  useEffect(() => {
    if (currentChannel && messageInputRef.current) {
      const timer = setTimeout(() => {
        messageInputRef.current?.focus();

        // 채널 변경 시 하단으로 스크롤 (슬랙 스타일)
        const messageContainer = document.querySelector('[data-testid="slack-messages-container"]') as HTMLElement;
        if (messageContainer) {
          console.log('📜 Channel changed - scrolling to bottom with smooth animation');
          messageContainer.scrollTo({
            top: messageContainer.scrollHeight,
            behavior: 'smooth'
          });
        }
      }, 300);

      return () => clearTimeout(timer);
    }
  }, [channelId, currentChannel]);

  // Focus input when clicking anywhere in the chat area (but not when selecting text)
  const handleChatAreaClick = (e: React.MouseEvent) => {
    // Don't focus input if user is selecting text
    const selection = window.getSelection();
    if (selection && selection.toString().length > 0) {
      return;
    }

    // Don't focus input if user clicked on a link or interactive element
    const target = e.target as HTMLElement;
    if (target.tagName === 'A' || target.closest('a') || target.closest('button')) {
      return;
    }

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
  }, [channelId]); // messages.length 의존성 제거

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



  // 상대적 시간 표시 (타임존 + 언어 지원)
  const formatRelativeTime = (timestamp: string) => {
    const userTimezone = getStoredTimezone();
    const now = moment().tz(userTimezone);
    const messageTime = moment(timestamp).tz(userTimezone);
    const diffInSeconds = now.diff(messageTime, 'seconds');

    if (i18n.language === 'ko') {
      if (diffInSeconds < 60) {
        return '방금 전';
      } else if (diffInSeconds < 3600) {
        const minutes = Math.floor(diffInSeconds / 60);
        return `${minutes}분 전`;
      } else if (diffInSeconds < 86400) {
        const hours = Math.floor(diffInSeconds / 3600);
        return `${hours}시간 전`;
      } else if (diffInSeconds < 604800) {
        const days = Math.floor(diffInSeconds / 86400);
        return `${days}일 전`;
      } else {
        // 1주일 이상이면 날짜 표시 (사용자 타임존 적용)
        return messageTime.format('M월 D일');
      }
    } else if (i18n.language === 'zh') {
      if (diffInSeconds < 60) {
        return '刚刚';
      } else if (diffInSeconds < 3600) {
        const minutes = Math.floor(diffInSeconds / 60);
        return `${minutes}分钟前`;
      } else if (diffInSeconds < 86400) {
        const hours = Math.floor(diffInSeconds / 3600);
        return `${hours}小时前`;
      } else if (diffInSeconds < 604800) {
        const days = Math.floor(diffInSeconds / 86400);
        return `${days}天前`;
      } else {
        return messageTime.format('M月D日');
      }
    } else {
      // 영어 (기본값)
      if (diffInSeconds < 60) {
        return 'just now';
      } else if (diffInSeconds < 3600) {
        const minutes = Math.floor(diffInSeconds / 60);
        return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
      } else if (diffInSeconds < 86400) {
        const hours = Math.floor(diffInSeconds / 3600);
        return `${hours} hour${hours > 1 ? 's' : ''} ago`;
      } else if (diffInSeconds < 604800) {
        const days = Math.floor(diffInSeconds / 86400);
        return `${days} day${days > 1 ? 's' : ''} ago`;
      } else {
        return messageTime.format('MMM D');
      }
    }
  };



  const getUserInfo = (userId: number) => {
    const user = state.users[userId];
    return {
      name: user?.username || user?.name || `User ${userId}`,
      avatar: user?.avatar || `https://ui-avatars.com/api/?name=${user?.username || 'User'}&background=random`,
    };
  };

  // 슬랙 스타일 메시지 렌더링을 위해 직접 JSX에서 처리

  if (messages.length === 0 && !state.isLoading) {
    return (
      <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <Paper elevation={1} sx={{ p: 2, borderRadius: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Avatar
              src={`https://ui-avatars.com/api/?name=${currentChannel?.name || 'Channel'}&background=random`}
              alt={currentChannel?.name || 'Channel'}
              sx={{ width: 40, height: 40 }}
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
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              {state.isConnected ? (
                <ConnectedIcon sx={{
                  color: 'success.main',
                  fontSize: 24
                }} />
              ) : (
                <DisconnectedIcon sx={{
                  color: 'error.main',
                  fontSize: 24
                }} />
              )}
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
              onKeyDown={handleKeyPress}
              disabled={!currentChannel}
              variant="standard"
              inputRef={messageInputRef}
              slotProps={{
              input: {
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
            sx={{ width: 40, height: 40 }}
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

      {/* Messages - Slack Style */}
      <Box
        data-testid="slack-messages-container"
        sx={{
          flex: 1,
          overflow: 'auto',
          backgroundColor: colors.chatBackground,
          cursor: 'text',
          height: 0,
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          // 커스텀 스크롤바 스타일
          '&::-webkit-scrollbar': {
            width: '8px',
          },
          '&::-webkit-scrollbar-track': {
            background: 'transparent',
          },
          '&::-webkit-scrollbar-thumb': {
            background: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)',
            borderRadius: '4px',
            '&:hover': {
              background: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.3)',
            },
          },
          '&::-webkit-scrollbar-thumb:active': {
            background: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.4)',
          },
          // Firefox 스크롤바 스타일
          scrollbarWidth: 'thin',
          scrollbarColor: theme.palette.mode === 'dark'
            ? 'rgba(255, 255, 255, 0.2) transparent'
            : 'rgba(0, 0, 0, 0.2) transparent',
        }}
        onClick={handleChatAreaClick}
      >
        {messages.map((message) => {
          const userInfo = getUserInfo(message.userId);
          const messageTime = formatRelativeTime(message.createdAt);

          return (
            <Box
              key={message.id}
              sx={{
                display: 'flex',
                gap: '12px',
                padding: '8px 12px',
                borderRadius: '8px',
                userSelect: 'text', // 메시지 컨테이너에서 텍스트 선택 허용
                '&:hover': {
                  backgroundColor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)'
                }
              }}
            >
              {/* Avatar */}
              <Box
                sx={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '8px',
                  overflow: 'hidden',
                  flexShrink: 0,
                  backgroundColor: theme.palette.mode === 'dark' ? '#5f6368' : '#e0e0e0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <img
                  src={userInfo.avatar}
                  alt={userInfo.name}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover'
                  }}
                  onError={(e) => {
                    // 이미지 로드 실패 시 이니셜 표시
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                    const parent = target.parentElement;
                    if (parent) {
                      parent.innerHTML = `<span style="color: white; font-weight: bold; font-size: 14px;">${userInfo.name.charAt(0).toUpperCase()}</span>`;
                    }
                  }}
                />
              </Box>

              {/* Message Content */}
              <Box sx={{ flex: 1, minWidth: 0 }}>
                {/* Header */}
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'baseline',
                    gap: '8px',
                    marginBottom: '4px'
                  }}
                >
                  <Typography
                    variant="subtitle2"
                    sx={{
                      fontWeight: 600,
                      color: theme.palette.mode === 'dark' ? '#e8eaed' : '#1d1c1d',
                      fontSize: '15px'
                    }}
                  >
                    {userInfo.name}
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{
                      color: theme.palette.mode === 'dark' ? '#9aa0a6' : '#616061',
                      fontSize: '12px'
                    }}
                  >
                    {messageTime}
                  </Typography>
                </Box>

                {/* Message Text */}
                <Typography
                  variant="body2"
                  sx={{
                    color: theme.palette.mode === 'dark' ? '#e8eaed' : '#1d1c1d',
                    fontSize: '15px',
                    lineHeight: 1.46,
                    wordBreak: 'break-word',
                    whiteSpace: 'pre-wrap',
                    userSelect: 'text', // 텍스트 선택 허용
                    cursor: 'text' // 텍스트 커서 표시
                  }}
                  onClick={(e) => e.stopPropagation()} // 클릭 이벤트 전파 방지
                >
                  <MessageWithPreview content={message.content} theme={theme} />
                </Typography>
              </Box>
            </Box>
          );
        })}
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
            onKeyDown={handleKeyPress}
            disabled={!currentChannel}
            variant="standard"
            inputRef={messageInputRef}
            slotProps={{
              input: {
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

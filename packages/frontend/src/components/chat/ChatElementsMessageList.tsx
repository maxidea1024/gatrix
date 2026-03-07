import React, { useEffect, useRef, useState, useMemo, useLayoutEffect, useCallback } from 'react';
import { Box, Typography, Paper, useTheme, Avatar, IconButton, Tooltip } from '@mui/material';
import {
  Reply as ReplyIcon,
  MoreVert as MoreIcon,
  PersonAdd as PersonAddIcon,
  SentimentSatisfiedAlt as AddReactionIcon,
} from '@mui/icons-material';
// React Chat Elements는 더 이상 Used하지 않음 (슬랙 스타일로 직접 구현)
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import dayjsTimezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(dayjsTimezone);
import { getStoredTimezone } from '../../utils/dateFormat';
import { extractUrlsFromMessage, extractLinkPreview } from '../../utils/linkPreview';
import LinkPreviewCard from './LinkPreviewCard';
import { LinkPreview } from '../../types/chat';
import { format } from 'date-fns';
import { ko, enUS, zhCN } from 'date-fns/locale';
import EmojiPicker from './EmojiPicker';

const DEFAULT_AVATAR_URL = 'https://cdn-icons-png.flaticon.com/512/847/847969.png';

// 마크다운 스타일링을 위한 Type 정의
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

  // 모든 매치를 찾아서 위치와 함께 Save
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
        fullMatch: match[0],
      });
    }
  });

  // 위치순으로 Sorting
  matches.sort((a, b) => a.start - b.start);

  // 겹치는 매치 제거 (먼저 나온 것 우선)
  const filteredMatches = [];
  for (const match of matches) {
    const hasOverlap = filteredMatches.some(
      (existing) => match.start < existing.end && match.end > existing.start
    );
    if (!hasOverlap) {
      filteredMatches.push(match);
    }
  }

  // 텍스트를 파트로 분할
  filteredMatches.forEach((match) => {
    // 매치 이전의 일반 텍스트 추가
    if (currentIndex < match.start) {
      const textContent = text.slice(currentIndex, match.start);
      if (textContent) {
        parts.push({ type: 'text', content: textContent });
      }
    }

    // 매치된 부분 추가
    if (match.type === 'link') {
      parts.push({
        type: match.type,
        content: match.content,
        url: match.content,
      });
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
      Promise.all(urls.map((url) => extractLinkPreview(url)))
        .then((previews) => {
          const validPreviews = previews.filter((preview) => preview !== null) as LinkPreview[];
          setLinkPreviews(validPreviews);
        })
        .catch((error) => {
          console.error('Failed to load link previews:', error);
        })
        .finally(() => {
          setLoadingPreviews(false);
        });
    }
  }, [content]);

  // 좌표 텍스트(예: "📍 현재 위치: 37.503400, 127.052500" 또는 "37.5034, 127.0525") 감지
  const parseCoordinatesFromText = (text: string): { lat: number; lng: number } | null => {
    const trimmed = text.trim();
    const regex = /(?:📍\s*현재\s*위치[:：]?\s*)?(-?\d{1,2}(?:\.\d+)?)[,\s]+(-?\d{1,3}(?:\.\d+)?)/;
    const m = trimmed.match(regex);
    if (!m) return null;
    const lat = parseFloat(m[1]);
    const lng = parseFloat(m[2]);
    if (isNaN(lat) || isNaN(lng)) return null;
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
    return { lat, lng };
  };

  const coords = parseCoordinatesFromText(content);

  return (
    <>
      {coords && (
        <Box
          sx={{
            mt: 1,
            mb: 1,
            maxWidth: 360,
            width: '100%',
            borderRadius: 0,
            overflow: 'hidden',
            border: `1px solid ${theme.palette.divider}`,
          }}
        >
          <Box
            sx={{
              position: 'relative',
              width: '100%',
              aspectRatio: '4 / 3',
              backgroundColor: theme.palette.mode === 'dark' ? '#1a1a1a' : '#f5f5f5',
            }}
          >
            <iframe
              title="google-maps-embed"
              src={`https://www.google.com/maps?q=${coords.lat},${coords.lng}&z=15&output=embed`}
              width="100%"
              height="100%"
              style={{ border: 0 }}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </Box>
          <Box
            sx={{
              px: 1,
              py: 0.5,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor:
                theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
            }}
          >
            <Typography variant="caption" color="text.secondary">
              📍 {coords.lat.toFixed(6)}, {coords.lng.toFixed(6)}
            </Typography>
            <Typography
              variant="caption"
              sx={{ color: theme.palette.primary.main, cursor: 'pointer' }}
              onClick={(e) => {
                e.stopPropagation();
                window.open(`https://maps.google.com/?q=${coords.lat},${coords.lng}`, '_blank');
              }}
            >
              Google 지도에서 열기
            </Typography>
          </Box>
        </Box>
      )}
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
                  borderRadius: 0,
                  padding: '12px',
                  margin: '8px 0',
                  overflow: 'auto',
                  fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
                  fontSize: '13px',
                  lineHeight: 1.45,
                  color: theme.palette.mode === 'dark' ? '#e8eaed' : '#24292e',
                  whiteSpace: 'pre-wrap',
                  userSelect: 'text', // 코드 블록 텍스트 선택 허용
                  cursor: 'text',
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
                  cursor: 'text',
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
                    textDecoration: 'underline',
                  },
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

// 동적 스타일 Create 함수
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
import { MessageType, Message } from '../../types/chat';
import AdvancedMessageInput from './AdvancedMessageInput';

interface ChatElementsMessageListProps {
  channelId: number;
  onSendMessage?: (message: string, attachments?: File[]) => void;
  onInviteUser?: () => void;
  onOpenThread?: (message: Message) => void;
  isThreadOpen?: boolean;
}

const ChatElementsMessageList: React.FC<ChatElementsMessageListProps> = ({
  channelId,
  onSendMessage,
  onInviteUser,
  onOpenThread,
  isThreadOpen = false,
}) => {
  const { state, actions } = useChat();
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  // messageInputRef와 messageInput은 AdvancedMessageInput으로 이동됨
  const [focusBump, setFocusBump] = useState(0);

  // EmojiPicker 관련 state
  const [emojiAnchorEl, setEmojiAnchorEl] = useState<HTMLElement | null>(null);
  const [emojiPickerMessageId, setEmojiPickerMessageId] = useState<number | null>(null);
  useEffect(() => {
    const handler = () => setFocusBump((prev) => prev + 1);
    window.addEventListener('focus-main-chat-input', handler);
    return () => window.removeEventListener('focus-main-chat-input', handler);
  }, []);

  const currentChannel = state.channels.find((c) => c.id === channelId);
  // 메인 채팅에서는 스레드 메시지(threadId가 있는 메시지)를 제외하고 표시
  const messages = useMemo(() => {
    const allMessages = state.messages[channelId] || [];
    console.log(
      '🔍 All messages in channel',
      channelId,
      ':',
      allMessages.map((m) => ({
        id: m.id,
        content: m.content.substring(0, 20),
        threadId: m.threadId,
        hasThreadId: !!m.threadId,
      }))
    );

    const filteredMessages = allMessages.filter((message) => !message.threadId);
    console.log(
      '🔍 Filtered messages (no threadId):',
      filteredMessages.map((m) => ({
        id: m.id,
        content: m.content.substring(0, 20),
        threadId: m.threadId,
      }))
    );

    return filteredMessages;
  }, [state.messages, channelId]);
  const typingUsers = state.typingUsers[channelId] || [];

  // Theme에 따른 색상 정의
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

  // 읽음 처리를 위한 ref (중복 방지)
  const lastReadMessageIdRef = useRef<number | null>(null);
  const markAsReadTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 하단 여부 추적 및 리사이즈 관찰용 ref
  const wasAtBottomRef = useRef(true);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const resizeScheduledRef = useRef(false);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // 새 메시지가 올 때 하단에 있으면 자동 스크롤 (슬랙 스타일 컨테이너용)
  useEffect(() => {
    if (messages.length === 0) return;

    const scrollToBottom = () => {
      const messageContainer = messagesContainerRef.current;

      if (!messageContainer) {
        console.log('❌ Slack message container not found');
        return;
      }

      const { scrollTop, scrollHeight, clientHeight } = messageContainer;
      // 하단에서 100px 이내에 있으면 자동 스크롤
      const isAtBottom = scrollTop + clientHeight >= scrollHeight - 100;

      if (isAtBottom) {
        // Instant jump to bottom to avoid visual bouncing
        messageContainer.scrollTop = scrollHeight;
      }
    };

    // 초기 스크롤 체크
    setTimeout(scrollToBottom, 100);

    // 미디어 콘텐츠 로딩 완료를 위한 추가 체크
    const checkForMediaContent = () => {
      const messageContainer = messagesContainerRef.current;
      if (!messageContainer) return;

      // Images, Videos, iframe 등의 미디어 요소들 찾기
      const mediaElements = messageContainer.querySelectorAll(
        'img, video, iframe, [data-link-preview="container"], [data-link-preview="loaded"], [data-link-preview="loading"]'
      );

      if (mediaElements.length > 0) {
        let loadedCount = 0;
        const totalElements = mediaElements.length;

        const handleMediaLoad = () => {
          loadedCount++;

          // 모든 미디어가 로드되었거나 마지막 요소가 로드된 후 스크롤 체크
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
            // iframe의 경우 타임아웃도 Settings
            setTimeout(handleMediaLoad, 1000);
          } else {
            // 기타 요소들 (링크 프리뷰 등)
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

    // 읽음 처리 로직 개선 (중복 방지)
    if (channelId && messages.length > 0) {
      const latestMessage = messages[messages.length - 1];

      // 이미 읽음 처리한 메시지면 스킵
      if (lastReadMessageIdRef.current === latestMessage.id) {
        return;
      }

      // Existing 타임아웃 Cancel
      if (markAsReadTimeoutRef.current) {
        clearTimeout(markAsReadTimeoutRef.current);
      }

      // New 타임아웃 Settings (3초 후 읽음 처리)
      markAsReadTimeoutRef.current = setTimeout(() => {
        // 창이 포커스되어 있고, 스크롤이 하단 근처에 있을 때만 읽음 처리
        const messageContainer = messagesContainerRef.current;
        if (messageContainer && document.hasFocus()) {
          const { scrollTop, scrollHeight, clientHeight } = messageContainer;
          const isNearBottom = scrollTop + clientHeight >= scrollHeight - 200;

          if (isNearBottom) {
            lastReadMessageIdRef.current = latestMessage.id;
            actions.markAsRead(channelId, latestMessage.id);
            console.log(
              `📖 Auto-marked channel ${channelId} as read up to message ${latestMessage.id}`
            );
          }
        }
      }, 3000);
    }

    return () => {
      if (markAsReadTimeoutRef.current) {
        clearTimeout(markAsReadTimeoutRef.current);
      }
    };
  }, [messages, channelId, actions]);

  // 콘텐츠 높이 변화 시에도 하단 유지 (하단에 있었던 경우) - ref 직접 Used으로 깜빡임 방지
  useEffect(() => {
    const el = messagesContainerRef.current;
    if (!el) return;

    const ro = new ResizeObserver(() => {
      if (!wasAtBottomRef.current) return;
      if (!resizeScheduledRef.current) {
        resizeScheduledRef.current = true;
        requestAnimationFrame(() => {
          resizeScheduledRef.current = false;
          el.scrollTop = el.scrollHeight; // 즉시 bottom
        });
      }
    });

    resizeObserverRef.current = ro;
    ro.observe(el);

    return () => {
      ro.disconnect();
      resizeObserverRef.current = null;
    };
  }, []);
  // 새 메시지가 DOM에 반영된 직후 스크롤 처리 (내 메시지는 즉시, 다른 Used자 메시지는 하단에 있을 때만)
  useLayoutEffect(() => {
    if (messages.length === 0) return;

    const last = messages[messages.length - 1] as any;
    const myUserId = state.user?.id;
    if (!myUserId) return;

    const container = messagesContainerRef.current;
    if (!container) return;

    if (last?.userId === myUserId) {
      // 내가 보낸 메시지는 즉시 하단으로 스크롤
      container.scrollTop = container.scrollHeight;
    } else {
      // 다른 Used자 메시지는 하단에 있을 때만 자동 스크롤
      const { scrollTop, scrollHeight, clientHeight } = container;
      const isAtBottom = scrollTop + clientHeight >= scrollHeight - 100;

      if (isAtBottom) {
        // useLayoutEffect 내에서 즉시 bottom 고정 (rAF 없이)
        container.scrollTop = container.scrollHeight;
      }
    }
  }, [messages.length, state.user?.id]);

  // 채널 변경 시 하단으로 스크롤 및 읽음 Status Initialization - 깜빡임 방지를 위해 지연 제거
  useEffect(() => {
    if (currentChannel) {
      // 읽음 Status Initialization
      lastReadMessageIdRef.current = null;
      if (markAsReadTimeoutRef.current) {
        clearTimeout(markAsReadTimeoutRef.current);
        markAsReadTimeoutRef.current = null;
      }

      // 즉시 스크롤하여 깜빡임 방지 - ref 직접 Used으로 성능 개선
      requestAnimationFrame(() => {
        const messageContainer = messagesContainerRef.current;
        if (messageContainer) {
          messageContainer.scrollTop = messageContainer.scrollHeight;
        }
      });
    }
  }, [channelId]);

  // Focus input when clicking anywhere in the chat area (but not when selecting text)
  const handleChatAreaClick = useCallback((e: React.MouseEvent) => {
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
    // AdvancedMessageInput이 포커스를 처리함
  }, []);

  // 스크롤 핸들러 메모이제이션으로 성능 최적화
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const threshold = 100;
    wasAtBottomRef.current = el.scrollTop + el.clientHeight >= el.scrollHeight - threshold;
  }, []);

  // Theme 변경 시 스타일 업데이트
  useEffect(() => {
    const isDark = theme.palette.mode === 'dark';
    const customStyles = createCustomStyles(isDark);

    // Existing 스타일 제거
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

  // handleSendMessage와 handleKeyPress는 AdvancedMessageInput에서 처리됨

  // 상대적 시간 표시 (타임존 + 언어 지원)
  const formatRelativeTime = (timestamp: string) => {
    const userTimezone = getStoredTimezone();
    const now = dayjs().tz(userTimezone);
    const messageTime = dayjs(timestamp).tz(userTimezone);
    const diffInSeconds = now.diff(messageTime, 'seconds');

    const currentLanguage = i18n.language || 'ko'; // Default values을 한국어로 Settings

    if (currentLanguage === 'ko') {
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
        // 1주일 이상이면 날짜 표시 (Used자 타임존 적용)
        return messageTime.format('M월 D일');
      }
    } else if (currentLanguage === 'zh') {
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
      // 영어 (Default values)
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
    const userName = user?.username || user?.name || `User${userId}`;
    return {
      name: userName,
      avatarUrl: user?.avatarUrl || DEFAULT_AVATAR_URL, // avatarUrl 필드만 Used
    };
  };

  // 슬랙 스타일 메시지 렌더링을 위해 직접 JSX에서 처리

  // Headers 컴포넌트들을 항상 메모화 (조건부 hooks 방지)
  const EmptyStateHeader = React.useMemo(
    () => (
      <Paper elevation={1} sx={{ p: 2, borderRadius: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Avatar
            src={`https://ui-avatars.com/api/?name=${currentChannel?.name || 'Channel'}&background=random`}
            alt={currentChannel?.name || 'Channel'}
            sx={{ width: 40, height: 40 }}
          />
          <Box sx={{ flex: 1 }}>
            <Typography variant="h6">{currentChannel?.name || t('chat.selectChannel')}</Typography>
            {currentChannel?.description && (
              <Typography variant="body2" color="text.secondary">
                {currentChannel.description}
              </Typography>
            )}
          </Box>
          {onInviteUser && (
            <Tooltip title={t('chat.inviteUsers')} placement="bottom">
              <IconButton
                size="small"
                onClick={onInviteUser}
                sx={{
                  border: 1,
                  borderColor: 'divider',
                  '&:hover': {
                    borderColor: 'primary.main',
                    backgroundColor: 'primary.50',
                  },
                }}
              >
                <PersonAddIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      </Paper>
    ),
    [currentChannel?.name, currentChannel?.description, t, onInviteUser]
  );

  // 메인 Headers 컴포넌트도 항상 메모화
  const ChatHeader = React.useMemo(
    () => (
      <Paper elevation={1} sx={{ p: 2, borderRadius: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Avatar
            src={`https://ui-avatars.com/api/?name=${currentChannel?.name || 'Channel'}&background=random`}
            alt={currentChannel?.name || 'Channel'}
            sx={{ width: 40, height: 40 }}
          />
          <Box sx={{ flex: 1 }}>
            <Typography variant="h6">{currentChannel?.name || ''}</Typography>
            {(currentChannel?.memberCount ?? 0) > 0 && (
              <Typography variant="body2" color="text.secondary">
                {currentChannel!.memberCount} {t('chat.members')}
              </Typography>
            )}
          </Box>
          {onInviteUser && (
            <Tooltip title={t('chat.inviteUsers')} placement="bottom">
              <IconButton
                size="small"
                onClick={onInviteUser}
                sx={{
                  border: 1,
                  borderColor: 'divider',
                  '&:hover': {
                    borderColor: 'primary.main',
                    backgroundColor: 'primary.50',
                  },
                }}
              >
                <PersonAddIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      </Paper>
    ),
    [currentChannel?.name, currentChannel?.memberCount, t, onInviteUser]
  );

  // 깜빡임 방지를 위해 Loading state 체크 제거
  if (messages.length === 0) {
    return (
      <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        {/* Header - 메모화된 컴포넌트 Used */}
        {EmptyStateHeader}

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
            cursor: 'text',
          }}
          onClick={handleChatAreaClick}
        >
          <Box
            sx={{
              textAlign: 'center',
              color: colors.emptyStateSubtext,
              maxWidth: 400,
            }}
          >
            <Typography
              variant="h5"
              sx={{
                mb: 2,
                fontWeight: 300,
                color: colors.emptyStateSubtext,
              }}
            >
              💬
            </Typography>
            <Typography
              variant="h6"
              sx={{
                mb: 1,
                fontWeight: 500,
                color: colors.emptyStateText,
              }}
            >
              {t('chat.noMessages')}
            </Typography>
            <Typography
              variant="body2"
              sx={{
                color: colors.emptyStateSubtext,
                lineHeight: 1.6,
              }}
            >
              {t('chat.startConversation')}
            </Typography>
          </Box>
        </Box>

        {/* Message Input */}
        <Box sx={{ p: 2, backgroundColor: colors.inputBackground }}>
          <AdvancedMessageInput
            key={channelId}
            channelId={channelId}
            autoFocus={!isThreadOpen}
            isThreadOpen={isThreadOpen}
            focusTrigger={focusBump}
            onSendMessage={(content, attachments) => {
              if (onSendMessage) {
                onSendMessage(content, attachments);
              } else if (currentChannel) {
                actions.sendMessage(currentChannel.id, {
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
      </Box>
    );
  }

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header - 메모화된 컴포넌트 Used */}
      {ChatHeader}

      {/* Messages - Slack Style */}
      <Box
        ref={messagesContainerRef}
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
          overflowAnchor: 'none', // disable scroll anchoring to prevent jump
          // 커스텀 스크롤바 스타일
        }}
        onClick={handleChatAreaClick}
        onScroll={handleScroll}
      >
        {messages.map((message, index) => {
          const userInfo = getUserInfo(message.userId);
          const messageTime = formatRelativeTime(message.createdAt);

          // 날짜 구분선 체크
          const currentDate = new Date(message.createdAt).toDateString();
          const previousDate =
            index > 0 ? new Date(messages[index - 1].createdAt).toDateString() : null;
          const showDateSeparator = index === 0 || currentDate !== previousDate;

          return (
            <React.Fragment key={message.id}>
              {/* 날짜 구분선 */}
              {showDateSeparator && (
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    my: 2,
                    mx: 2,
                  }}
                >
                  <Box
                    sx={{
                      flex: 1,
                      height: '1px',
                      backgroundColor: colors.inputBorder,
                    }}
                  />
                  <Typography
                    variant="caption"
                    sx={{
                      mx: 2,
                      px: 2,
                      py: 0.5,
                      backgroundColor: colors.inputBackground,
                      borderRadius: 0,
                      color: colors.placeholderText,
                      fontSize: '12px',
                      fontWeight: 500,
                      border: `1px solid ${colors.inputBorder}`,
                    }}
                  >
                    {format(new Date(message.createdAt), 'yyyy년 M월 d일 EEEE', {
                      locale: i18n.language === 'ko' ? ko : i18n.language === 'zh' ? zhCN : enUS,
                    })}
                  </Typography>
                  <Box
                    sx={{
                      flex: 1,
                      height: '1px',
                      backgroundColor: colors.inputBorder,
                    }}
                  />
                </Box>
              )}

              {/* 메시지 */}
              <Box
                key={message.id}
                className="message-container"
                sx={{
                  position: 'relative',
                  display: 'flex',
                  gap: '12px',
                  padding: '8px 12px',
                  borderRadius: 0,
                  userSelect: 'text', // 메시지 컨테이너에서 텍스트 선택 허용
                  '&:hover': {
                    backgroundColor:
                      theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
                  },
                }}
              >
                {/* Avatar */}
                <Avatar
                  src={userInfo.avatarUrl}
                  alt={userInfo.name}
                  sx={{
                    width: '36px',
                    height: '36px',
                    fontSize: '14px',
                    fontWeight: 'bold',
                    backgroundColor: theme.palette.mode === 'dark' ? '#5f6368' : '#e0e0e0',
                    color: 'white',
                  }}
                >
                  {userInfo.name.trim().charAt(0).toUpperCase()}
                </Avatar>

                {/* Message Content */}
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  {/* Header */}
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'baseline',
                      gap: '8px',
                      marginBottom: '4px',
                    }}
                  >
                    <Typography
                      variant="subtitle2"
                      sx={{
                        fontWeight: 600,
                        color: theme.palette.mode === 'dark' ? '#e8eaed' : '#1d1c1d',
                        fontSize: '15px',
                      }}
                    >
                      {userInfo.name}
                    </Typography>
                    <Typography
                      variant="caption"
                      sx={{
                        color: theme.palette.mode === 'dark' ? '#9aa0a6' : '#616061',
                        fontSize: '12px',
                      }}
                    >
                      {messageTime}
                    </Typography>
                  </Box>

                  {/* Message Text */}
                  <Typography
                    variant="body2"
                    component="div"
                    sx={{
                      color: theme.palette.mode === 'dark' ? '#e8eaed' : '#1d1c1d',
                      fontSize: '15px',
                      lineHeight: 1.46,
                      wordBreak: 'break-word',
                      whiteSpace: 'pre-wrap',
                      userSelect: 'text', // 텍스트 선택 허용
                      cursor: 'text', // 텍스트 커서 표시
                    }}
                    onClick={(e) => e.stopPropagation()} // 클릭 Event 전파 방지
                  >
                    <MessageWithPreview content={message.content} theme={theme} />
                  </Typography>

                  {/* 리액션 표시 */}
                  {message.reactions && message.reactions.length > 0 && (
                    <Box
                      sx={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: 0.5,
                        mt: 1,
                        alignItems: 'center',
                      }}
                    >
                      {Object.entries(
                        message.reactions.reduce(
                          (acc, reaction) => {
                            if (!acc[reaction.emoji]) {
                              acc[reaction.emoji] = [];
                            }
                            acc[reaction.emoji].push(reaction);
                            return acc;
                          },
                          {} as Record<string, any[]>
                        )
                      ).map(([emoji, reactions]) => (
                        <Box
                          key={emoji}
                          onClick={() => {
                            const userReaction = reactions.find((r) => r.userId === state.user?.id);
                            if (userReaction) {
                              actions.removeReaction(message.id, emoji);
                            } else {
                              actions.addReaction(message.id, emoji);
                            }
                          }}
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 0.5,
                            px: 1,
                            py: 0.5,
                            borderRadius: 0,
                            backgroundColor: reactions.some((r) => r.userId === state.user?.id)
                              ? theme.palette.primary.main + '20'
                              : colors.inputFieldBackground,
                            border: `1px solid ${
                              reactions.some((r) => r.userId === state.user?.id)
                                ? theme.palette.primary.main
                                : colors.inputBorder
                            }`,
                            cursor: 'pointer',
                            '&:hover': {
                              backgroundColor: theme.palette.primary.main + '30',
                            },
                          }}
                        >
                          <Typography sx={{ fontSize: '14px' }}>{emoji}</Typography>
                          <Typography
                            sx={{
                              fontSize: '12px',
                              color: colors.placeholderText,
                              fontWeight: reactions.some((r) => r.userId === state.user?.id)
                                ? 600
                                : 400,
                            }}
                          >
                            {reactions.length}
                          </Typography>
                        </Box>
                      ))}

                      {/* 반응 추가 버튼 */}
                      <Tooltip title={t('chat.addReaction')} arrow>
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEmojiAnchorEl(e.currentTarget);
                            setEmojiPickerMessageId(message.id);
                          }}
                          sx={{
                            width: 28,
                            height: 28,
                            backgroundColor: colors.inputFieldBackground,
                            border: `1px solid ${colors.inputBorder}`,
                            '&:hover': {
                              backgroundColor: theme.palette.primary.main + '20',
                              borderColor: theme.palette.primary.main,
                            },
                          }}
                        >
                          <AddReactionIcon sx={{ fontSize: 16, color: colors.placeholderText }} />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  )}

                  {/* 메시지 액션 버튼들 (호버 시 표시) */}
                  <Box
                    className="message-actions"
                    sx={{
                      position: 'absolute',
                      top: -8,
                      right: 8,
                      display: 'none',
                      gap: 0.5,
                      backgroundColor: colors.inputBackground,
                      borderRadius: 0,
                      border: `1px solid ${colors.inputBorder}`,
                      boxShadow:
                        theme.palette.mode === 'dark'
                          ? '0 2px 8px rgba(0,0,0,0.3)'
                          : '0 2px 8px rgba(0,0,0,0.1)',
                      '.message-container:hover &': {
                        display: 'flex',
                      },
                    }}
                  >
                    {/* 스레드 시작 버튼 */}
                    <Tooltip title={t('chat.startThread')} placement="top">
                      <IconButton
                        size="small"
                        onClick={() => {
                          if (onOpenThread) {
                            onOpenThread(message);
                          }
                        }}
                        sx={{
                          p: 0.5,
                          color: colors.iconColor,
                          '&:hover': {
                            backgroundColor: colors.iconHover,
                          },
                        }}
                      >
                        <ReplyIcon sx={{ fontSize: 16 }} />
                      </IconButton>
                    </Tooltip>

                    {/* 더보기 버튼 */}
                    <IconButton
                      size="small"
                      onClick={() => {
                        // 더보기 메뉴 (추후 구현)
                        console.log('More actions for message:', message.id);
                      }}
                      sx={{
                        p: 0.5,
                        color: colors.iconColor,
                        '&:hover': {
                          backgroundColor: colors.iconHover,
                        },
                      }}
                    >
                      <MoreIcon sx={{ fontSize: 16 }} />
                    </IconButton>

                    {/* 리액션 추가 버튼들 */}
                    {['👍', '❤️', '😂', '😮', '😢', '😡'].map((emoji) => (
                      <Box
                        key={emoji}
                        onClick={() => actions.addReaction(message.id, emoji)}
                        sx={{
                          p: 0.5,
                          borderRadius: 0,
                          cursor: 'pointer',
                          fontSize: '16px',
                          '&:hover': {
                            backgroundColor: colors.iconHover,
                          },
                        }}
                      >
                        {emoji}
                      </Box>
                    ))}
                  </Box>

                  {/* 답글 정보 표시 */}
                  {message.replyToId && (
                    <Box
                      sx={{
                        mt: 1,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                        color: colors.placeholderText,
                        fontSize: '12px',
                      }}
                    >
                      <ReplyIcon sx={{ fontSize: 14 }} />
                      <Typography variant="caption" sx={{ color: colors.placeholderText }}>
                        {message.replyTo?.user?.username || '누군가'}님에게 답장
                      </Typography>
                    </Box>
                  )}

                  {/* 스레드 답글 수 표시 - Slack style */}
                  {(message.threadCount ?? 0) > 0 && (
                    <Box
                      onClick={() => {
                        if (onOpenThread) {
                          onOpenThread(message);
                        }
                      }}
                      sx={{
                        mt: 0.5, // 1 → 0.5로 줄임
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                        color: theme.palette.primary.main,
                        fontSize: '12px',
                        cursor: 'pointer',
                        px: 1, // 좌우 패딩만 유지
                        py: 0.5, // 상하 패딩 줄임 (1 → 0.5)
                        borderRadius: 0,
                        border: '1px solid transparent', // 기본 Status에서는 투명한 테두리
                        backgroundColor: 'transparent', // 기본 Status에서는 투명한 배경
                        position: 'relative',
                        '&:hover': {
                          border: `1px solid ${theme.palette.primary.main}20`,
                          backgroundColor: `${theme.palette.primary.main}08`,
                          '& .thread-time-text': {
                            opacity: 0,
                            visibility: 'hidden',
                          },
                          '& .thread-view-text': {
                            opacity: 1,
                            visibility: 'visible',
                          },
                        },
                      }}
                    >
                      <ReplyIcon sx={{ fontSize: 14 }} />

                      {/* 댓글 개수와 스레드 보기 텍스트 */}
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        {/* 댓글 개수는 항상 표시 */}
                        <Typography
                          variant="caption"
                          sx={{
                            color: theme.palette.primary.main,
                            fontWeight: 500,
                          }}
                        >
                          {t('chat.threadCount', {
                            count: message.threadCount,
                          })}
                        </Typography>

                        {/* 시간/스레드 보기 텍스트 컨테이너 - 같은 위치에서 전환 */}
                        <Box sx={{ position: 'relative' }}>
                          {/* 마지막 댓글 시간 (기본 Status) */}
                          {message.lastThreadMessageAt && (
                            <Typography
                              variant="caption"
                              className="thread-time-text"
                              sx={{
                                color: colors.placeholderText,
                                transition: 'opacity 0.2s ease, visibility 0.2s ease',
                              }}
                            >
                              · {t('chat.lastReply')}:{' '}
                              {formatRelativeTime(message.lastThreadMessageAt)}
                            </Typography>
                          )}

                          {/* 스레드 보기 텍스트 (호버 Status) - 시간 텍스트와 같은 위치 */}
                          <Typography
                            variant="caption"
                            className="thread-view-text"
                            sx={{
                              color: theme.palette.primary.main,
                              fontWeight: 500,
                              opacity: 0,
                              visibility: 'hidden',
                              transition: 'opacity 0.2s ease, visibility 0.2s ease',
                              whiteSpace: 'nowrap',
                              position: 'absolute',
                              top: 0,
                              left: 0,
                            }}
                          >
                            · {t('chat.viewThread')}
                          </Typography>
                        </Box>
                      </Box>
                    </Box>
                  )}
                </Box>
              </Box>
            </React.Fragment>
          );
        })}

        <div ref={messagesEndRef} />
      </Box>

      {/* Message Input */}
      <Box sx={{ p: 2, backgroundColor: colors.inputBackground }}>
        <AdvancedMessageInput
          key={channelId}
          channelId={channelId}
          autoFocus={!isThreadOpen}
          isThreadOpen={isThreadOpen}
          focusTrigger={focusBump}
          onSendMessage={(content, attachments) => {
            if (onSendMessage) {
              onSendMessage(content, attachments);
            } else if (currentChannel) {
              actions.sendMessage(currentChannel.id, {
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

        {/* 반응 추가용 EmojiPicker */}
        <EmojiPicker
          anchorEl={emojiAnchorEl}
          open={Boolean(emojiAnchorEl)}
          onClose={() => {
            setEmojiAnchorEl(null);
            setEmojiPickerMessageId(null);
          }}
          onEmojiSelect={(emoji) => {
            if (emojiPickerMessageId) {
              actions.addReaction(emojiPickerMessageId, emoji);
            }
            setEmojiAnchorEl(null);
            setEmojiPickerMessageId(null);
          }}
        />

        {/* 타이핑 인디케이터 - 입력창 아래에 위치 */}
        {typingUsers.length > 0 && (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              px: 1,
              py: 0.5,
              animation: 'fadeIn 0.2s ease-out',
              '@keyframes fadeIn': {
                from: { opacity: 0 },
                to: { opacity: 1 },
              },
            }}
          >
            <Box
              sx={{
                display: 'flex',
                gap: 0.5,
                alignItems: 'center',
              }}
            >
              {[0, 1, 2].map((i) => (
                <Box
                  key={i}
                  sx={{
                    width: 4,
                    height: 4,
                    borderRadius: '50%',
                    backgroundColor: colors.placeholderText,
                    animation: 'typing-dot 1.4s infinite ease-in-out',
                    animationDelay: `${i * 0.16}s`,
                    '@keyframes typing-dot': {
                      '0%, 80%, 100%': {
                        transform: 'scale(0)',
                        opacity: 0.5,
                      },
                      '40%': {
                        transform: 'scale(1)',
                        opacity: 1,
                      },
                    },
                  }}
                />
              ))}
            </Box>
            <Typography variant="caption" sx={{ color: colors.placeholderText, fontSize: '11px' }}>
              {typingUsers.length === 1
                ? t('chat.userTyping', {
                    username:
                      state.users[typingUsers[0].userId]?.name ||
                      state.users[typingUsers[0].userId]?.username ||
                      t('chat.someone'),
                  })
                : t('chat.multipleUsersTyping', { count: typingUsers.length })}
            </Typography>
          </Box>
        )}
      </Box>
    </Box>
  );
};

// React.memo로 불필요한 리렌더링 방지
export default React.memo(ChatElementsMessageList);

import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  IconButton,
  Divider,
  Avatar,
  CircularProgress,
  Tooltip,
} from '@mui/material';
import { ArrowBack as ArrowBackIcon } from '@mui/icons-material';
import { useTheme } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';
import { useChat } from '../../contexts/ChatContext';
import { Message, LinkPreview } from '../../types/chat';
import { formatDistanceToNow } from 'date-fns';
import { getChatWebSocketService } from '../../services/chatWebSocketService';
import { ko, enUS, zhCN } from 'date-fns/locale';
import AdvancedMessageInput from './AdvancedMessageInput';
import {
  extractUrlsFromMessage,
  extractLinkPreview,
} from '../../utils/linkPreview';
import LinkPreviewCard from './LinkPreviewCard';

interface ThreadViewProps {
  originalMessage: Message;
  onClose: () => void;
  hideHeader?: boolean;
}

// 스레드에서도 링크 미리보기/텍스트 렌더링을 동일하게 지원하기 위한 공용 컴포넌트
const ThreadRichMessage: React.FC<{ content: string }> = ({ content }) => {
  const [linkPreviews, setLinkPreviews] = useState<LinkPreview[]>([]);
  const [loadingPreviews, setLoadingPreviews] = useState(false);

  useEffect(() => {
    const urls = extractUrlsFromMessage(content);
    if (urls.length > 0) {
      setLoadingPreviews(true);
      Promise.all(urls.map((url) => extractLinkPreview(url)))
        .then((previews) => {
          const valid = previews.filter((p) => p !== null) as LinkPreview[];
          setLinkPreviews(valid);
        })
        .catch((err) => {
          console.warn('Thread link preview error:', err);
          setLinkPreviews([]);
        })
        .finally(() => setLoadingPreviews(false));
    } else {
      setLinkPreviews([]);
      setLoadingPreviews(false);
    }
  }, [content]);

  return (
    <>
      <Typography variant="body2" sx={{ wordBreak: 'break-word' }}>
        {content}
      </Typography>
      {loadingPreviews && <Box sx={{ mt: 1 }} data-link-preview="loading" />}
      {linkPreviews.length > 0 && (
        <Box sx={{ mt: 1 }} data-link-preview="loaded">
          {linkPreviews.map((preview, idx) => (
            <LinkPreviewCard key={idx} linkPreview={preview} />
          ))}
        </Box>
      )}
    </>
  );
};

const ThreadView: React.FC<ThreadViewProps> = ({
  originalMessage,
  onClose,
  hideHeader = false,
}) => {
  const theme = useTheme();
  const { t, i18n } = useTranslation();
  const { state, actions } = useChat();
  const inputRef = useRef<HTMLDivElement>(null);
  const [threadMessages, setThreadMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const wasAtBottomRef = useRef(true);

  // 스레드 타이핑 Used자들
  const threadTypingUsers = state.threadTypingUsers[originalMessage.id] || [];

  const getDateLocale = () => {
    switch (i18n.language) {
      case 'ko':
        return ko;
      case 'zh':
        return zhCN;
      default:
        return enUS;
    }
  };

  // 텍스트에서 좌표 추출 (예: "📍 현재 위치: 37.503400, 127.052500" 또는 "37.5034, 127.0525")
  const parseCoordinatesFromText = (
    text: string
  ): { lat: number; lng: number } | null => {
    if (!text) return null;
    const trimmed = text.trim();
    const regex =
      /(?:📍\s*현재\s*위치[:：]?\s*)?(-?\d{1,2}(?:\.\d+)?)[,\s]+(-?\d{1,3}(?:\.\d+)?)/;
    const m = trimmed.match(regex);
    if (!m) return null;
    const lat = parseFloat(m[1]);
    const lng = parseFloat(m[2]);
    if (isNaN(lat) || isNaN(lng)) return null;
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
    return { lat, lng };
  };

  const scrollToBottom = () => {
    const c = containerRef.current;
    if (!c) return;
    // In useLayoutEffect we can set synchronously before paint
    c.scrollTop = c.scrollHeight;
  };

  const handleClose = () => {
    try {
      window.dispatchEvent(new CustomEvent('focus-main-chat-input'));
    } catch {}
    onClose();
  };

  // Stick to bottom for my messages or when user is already at bottom
  useLayoutEffect(() => {
    if (threadMessages.length === 0) return;
    const last = threadMessages[threadMessages.length - 1] as any;
    const myUserId = state.user?.id;
    const shouldStick =
      (last?.userId && myUserId && last.userId === myUserId) ||
      wasAtBottomRef.current;
    if (shouldStick) {
      scrollToBottom();
    }
  }, [threadMessages.length, state.user?.id]);

  // 스레드가 열릴 때 입력창에 포커스 Settings
  useEffect(() => {
    // 스레드가 처음 마운트될 때만 포커스 Settings
    const timer = setTimeout(() => {
      const input = inputRef.current?.querySelector(
        'input, textarea'
      ) as HTMLElement;
      if (input && !input.matches(':focus')) {
        // 이미 포커스가 있지 않을 때만 포커스 Settings
        input.focus();
      }
    }, 150); // 메인 입력창의 포커스 Settings보다 늦게 실행

    return () => clearTimeout(timer);
  }, []); // 의존성 배열을 비워서 마운트 시에만 실행

  useEffect(() => {
    loadThreadMessages();

    // 스레드 메시지 및 리액션 실시간 업데이트 리스너 추가
    const handleThreadMessage = (event: any) => {
      console.log('🧵 ThreadView received thread message:', event);
      const payload = event?.data || event; // 서버에서 온 원본 payload
      const threadId = payload?.threadId;
      const newThreadMessage = payload?.data; // 실제 새 메시지 객체

      console.log('🧵 ThreadView parsed payload:', {
        threadId,
        hasMessage: !!newThreadMessage,
      });

      if (threadId === originalMessage.id && newThreadMessage) {
        // New 스레드 메시지를 현재 목록에 추가
        setThreadMessages((prev) => [...prev, newThreadMessage]);
      }
    };

    const handleReactionUpdated = (event: any) => {
      const payload = event?.data || event;
      const { messageId, reactions } = payload || {};
      if (!messageId) return;
      // 해당 메시지가 스레드 목록에 있으면 리액션만 교체
      setThreadMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, reactions } : m))
      );
    };

    // WebSocket Event 리스너 Register (싱글톤 인스턴스)
    const wsService = getChatWebSocketService(() =>
      localStorage.getItem('accessToken')
    );
    wsService.on('thread_message_created', handleThreadMessage);
    wsService.on('message_reaction_updated', handleReactionUpdated);

    // 컴포넌트 언마운트 시 리스너 제거
    return () => {
      wsService.off('thread_message_created', handleThreadMessage);
      wsService.off('message_reaction_updated', handleReactionUpdated);
    };
  }, [originalMessage.id]);

  const loadThreadMessages = async () => {
    setIsLoading(true);
    try {
      // 스레드 메시지 로드
      const threadMessages = await actions.getThreadMessages(
        originalMessage.id
      );
      setThreadMessages(threadMessages);
    } catch (error) {
      console.error('Failed to load thread messages:', error);
      setThreadMessages([]);
    } finally {
      setIsLoading(false);
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
  // Keep bottom on content size changes when already at bottom
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      if (wasAtBottomRef.current) {
        el.scrollTop = el.scrollHeight;
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <Paper
      elevation={3}
      sx={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        borderRadius: 0,
        borderLeft: 'none',
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
            <IconButton size="small" onClick={handleClose}>
              <ArrowBackIcon />
            </IconButton>
            <Typography variant="h6" sx={{ fontSize: '1rem' }}>
              {t('chat.thread')}
            </Typography>
          </Box>
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
            <Box
              sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}
            >
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
            {(() => {
              const loc: any = (originalMessage as any).metadata?.location;
              const coords = loc
                ? { lat: loc.latitude, lng: loc.longitude }
                : parseCoordinatesFromText(originalMessage.content);
              if (!coords) return null;
              return (
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
                      backgroundColor:
                        theme.palette.mode === 'dark'
                          ? 'rgba(255,255,255,0.04)'
                          : 'rgba(0,0,0,0.02)',
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
                        theme.palette.mode === 'dark'
                          ? 'rgba(255,255,255,0.04)'
                          : 'rgba(0,0,0,0.02)',
                    }}
                  >
                    <Typography variant="caption" color="text.secondary">
                      📍 {coords.lat.toFixed(6)}, {coords.lng.toFixed(6)}
                    </Typography>
                    <Typography
                      variant="caption"
                      sx={{
                        color: theme.palette.primary.main,
                        cursor: 'pointer',
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        window.open(
                          `https://maps.google.com/?q=${coords.lat},${coords.lng}`,
                          '_blank'
                        );
                      }}
                    >
                      Google 지도에서 열기
                    </Typography>
                  </Box>
                </Box>
              );
            })()}

            <ThreadRichMessage content={originalMessage.content} />
          </Box>
        </Box>
      </Box>

      {/* Thread Messages */}
      <Box
        data-testid="thread-messages-container"
        ref={containerRef}
        onScroll={(e) => {
          const el = e.currentTarget;
          const threshold = 100;
          wasAtBottomRef.current =
            el.scrollTop + el.clientHeight >= el.scrollHeight - threshold;
        }}
        sx={{
          flex: 1,
          overflow: 'auto',
          p: 1,
          overflowAnchor: 'none',
        }}
      >
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
              <Box
                key={message.id}
                className="message-container"
                sx={{
                  mb: 2,
                  position: 'relative',
                  p: 0.5,
                  borderRadius: 1,
                  '&:hover': {
                    backgroundColor:
                      theme.palette.mode === 'dark'
                        ? 'rgba(255,255,255,0.04)'
                        : 'rgba(0,0,0,0.02)',
                  },
                }}
              >
                <Box
                  sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}
                >
                  <Avatar
                    src={userInfo.avatarUrl}
                    sx={{ width: 28, height: 28 }}
                  >
                    {userInfo.name.charAt(0).toUpperCase()}
                  </Avatar>
                  <Box sx={{ flex: 1 }}>
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                        mb: 0.5,
                      }}
                    >
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

                    {/* 위치/좌표가 있는 경우 구글맵 임베드 */}
                    {(() => {
                      const loc: any = (message as any).metadata?.location;
                      const coords = loc
                        ? { lat: loc.latitude, lng: loc.longitude }
                        : parseCoordinatesFromText(message.content);
                      if (!coords) return null;
                      return (
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
                              backgroundColor:
                                theme.palette.mode === 'dark'
                                  ? 'rgba(255,255,255,0.04)'
                                  : 'rgba(0,0,0,0.02)',
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
                                theme.palette.mode === 'dark'
                                  ? 'rgba(255,255,255,0.04)'
                                  : 'rgba(0,0,0,0.02)',
                            }}
                          >
                            <Typography
                              variant="caption"
                              color="text.secondary"
                            >
                              📍 {coords.lat.toFixed(6)},{' '}
                              {coords.lng.toFixed(6)}
                            </Typography>
                            <Typography
                              variant="caption"
                              sx={{
                                color: theme.palette.primary.main,
                                cursor: 'pointer',
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                                window.open(
                                  `https://maps.google.com/?q=${coords.lat},${coords.lng}`,
                                  '_blank'
                                );
                              }}
                            >
                              Google 지도에서 열기
                            </Typography>
                          </Box>
                        </Box>
                      );
                    })()}

                    <ThreadRichMessage content={message.content} />

                    {/* Reactions display */}
                    {message.reactions && message.reactions.length > 0 && (
                      <Box
                        sx={{
                          display: 'flex',
                          flexWrap: 'wrap',
                          gap: 0.5,
                          mt: 1,
                        }}
                      >
                        {Object.entries(
                          message.reactions.reduce(
                            (acc, reaction) => {
                              if (!acc[reaction.emoji])
                                acc[reaction.emoji] = [];
                              acc[reaction.emoji].push(reaction);
                              return acc;
                            },
                            {} as Record<string, any[]>
                          )
                        ).map(([emoji, reactions]) => (
                          <Box
                            key={emoji}
                            onClick={() => {
                              const userReaction = (reactions as any[]).find(
                                (r: any) => r.userId === state.user?.id
                              );
                              // Optimistic local update
                              const currentUserId = state.user?.id;
                              if (currentUserId) {
                                setThreadMessages((prev) =>
                                  prev.map((m) => {
                                    if (m.id !== message.id) return m;
                                    const curr = (m.reactions || []) as any[];
                                    const next = userReaction
                                      ? curr.filter(
                                          (r: any) =>
                                            !(
                                              r.userId === currentUserId &&
                                              r.emoji === emoji
                                            )
                                        )
                                      : [
                                          ...curr,
                                          {
                                            userId: currentUserId,
                                            emoji,
                                          } as any,
                                        ];
                                    return { ...m, reactions: next };
                                  })
                                );
                              }
                              // Server request
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
                              backgroundColor: (reactions as any[]).some(
                                (r: any) => r.userId === state.user?.id
                              )
                                ? theme.palette.primary.main + '20'
                                : theme.palette.mode === 'dark'
                                  ? 'rgba(255,255,255,0.04)'
                                  : 'rgba(0,0,0,0.02)',
                              border: `1px solid ${(reactions as any[]).some((r: any) => r.userId === state.user?.id) ? theme.palette.primary.main : theme.palette.divider}`,
                              cursor: 'pointer',
                              '&:hover': {
                                backgroundColor:
                                  theme.palette.primary.main + '30',
                              },
                            }}
                          >
                            <Typography sx={{ fontSize: '14px' }}>
                              {emoji}
                            </Typography>
                            <Typography
                              sx={{
                                fontSize: '12px',
                                color: 'text.secondary',
                                fontWeight: (reactions as any[]).some(
                                  (r: any) => r.userId === state.user?.id
                                )
                                  ? 600
                                  : 400,
                              }}
                            >
                              {(reactions as any[]).length}
                            </Typography>
                          </Box>
                        ))}
                      </Box>
                    )}
                  </Box>
                </Box>

                {/* Floating actions (emoji quick add) */}
                <Box
                  className="message-actions"
                  sx={{
                    position: 'absolute',
                    top: -8,
                    right: 8,
                    display: 'none',
                    gap: 0.5,
                    backgroundColor: theme.palette.background.paper,
                    borderRadius: 0,
                    border: `1px solid ${theme.palette.divider}`,
                    boxShadow: theme.shadows[2],
                    '.message-container:hover &': { display: 'flex' },
                  }}
                >
                  {['👍', '❤️', '😂', '😮', '😢', '😡'].map((emoji) => (
                    <Box
                      key={emoji}
                      onClick={() => {
                        const currentUserId = state.user?.id;
                        if (currentUserId) {
                          setThreadMessages((prev) =>
                            prev.map((m) => {
                              if (m.id !== message.id) return m;
                              const curr = (m.reactions || []) as any[];
                              if (
                                curr.some(
                                  (r: any) =>
                                    r.userId === currentUserId &&
                                    r.emoji === emoji
                                )
                              )
                                return m;
                              return {
                                ...m,
                                reactions: [
                                  ...curr,
                                  { userId: currentUserId, emoji } as any,
                                ],
                              };
                            })
                          );
                        }
                        actions.addReaction(message.id, emoji);
                      }}
                      sx={{
                        p: 0.5,
                        borderRadius: 0,
                        cursor: 'pointer',
                        fontSize: '16px',
                        '&:hover': {
                          backgroundColor: theme.palette.action.hover,
                        },
                      }}
                    >
                      {emoji}
                    </Box>
                  ))}
                </Box>
              </Box>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </Box>

      {/* Message Input */}
      <Box
        sx={{ p: 2, borderTop: `1px solid ${theme.palette.divider}` }}
        ref={inputRef}
      >
        <AdvancedMessageInput
          channelId={originalMessage.channelId}
          threadId={originalMessage.id}
          autoFocus
          onSendMessage={(content, attachments) => {
            actions.sendMessage(originalMessage.channelId, {
              content,
              channelId: originalMessage.channelId,
              type: 'text',
              threadId: originalMessage.id,
              attachments,
            });
          }}
          placeholder={t('chat.replyToThread')}
        />

        {/* 스레드 타이핑 인디케이터 - 입력창 아래에 위치 */}
        {threadTypingUsers.length > 0 && (
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
                    backgroundColor: 'text.secondary',
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
            <Typography
              variant="caption"
              sx={{ color: 'text.secondary', fontSize: '11px' }}
            >
              {threadTypingUsers.length === 1
                ? t('chat.userTyping', {
                    username:
                      state.users[threadTypingUsers[0].userId]?.name ||
                      state.users[threadTypingUsers[0].userId]?.username ||
                      t('chat.someone'),
                  })
                : t('chat.multipleUsersTyping', {
                    count: threadTypingUsers.length,
                  })}
            </Typography>
          </Box>
        )}
      </Box>
    </Paper>
  );
};

export default ThreadView;

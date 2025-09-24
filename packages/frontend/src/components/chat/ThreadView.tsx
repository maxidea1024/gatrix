import React, { useState, useEffect, useRef } from 'react';
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
import {
  ArrowBack as ArrowBackIcon,
  Reply as ReplyIcon,
} from '@mui/icons-material';
import { useTheme } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';
import { useChat } from '../../contexts/ChatContext';
import { Message } from '../../types/chat';
import { formatDistanceToNow } from 'date-fns';
import { getChatWebSocketService } from '../../services/chatWebSocketService';
import { ko, enUS, zhCN } from 'date-fns/locale';
import AdvancedMessageInput from './AdvancedMessageInput';

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
  const [isLoading, setIsLoading] = useState(false);
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

  const handleClose = () => {
    try {
      window.dispatchEvent(new CustomEvent('focus-main-chat-input'));
    } catch {}
    onClose();
  };

  useEffect(() => {
    scrollToBottom();
  }, [threadMessages]);


  // 내가 보낸 스레드 메시지가 DOM에 반영되면 즉시 하단으로 고정 (시각적 점프 제거)
  useEffect(() => {
    if (threadMessages.length === 0) return;
    const last = threadMessages[threadMessages.length - 1] as any;
    const myUserId = state.user?.id;
    if (!myUserId) return;
    if (last?.userId === myUserId) {
      const container = document.querySelector('[data-testid="thread-messages-container"]') as HTMLElement | null;
      if (container) {
        container.scrollTop = container.scrollHeight;
      }
    }
  }, [threadMessages.length, state.user?.id]);

  useEffect(() => {
    loadThreadMessages();

    // 스레드 메시지 및 리액션 실시간 업데이트 리스너 추가
    const handleThreadMessage = (event: any) => {
      console.log('🧵 ThreadView received thread message:', event);
      const payload = event?.data || event; // 서버에서 온 원본 payload
      const threadId = payload?.threadId;
      const newThreadMessage = payload?.data; // 실제 새 메시지 객체

      console.log('🧵 ThreadView parsed payload:', { threadId, hasMessage: !!newThreadMessage });

      if (threadId === originalMessage.id && newThreadMessage) {
        // 새로운 스레드 메시지를 현재 목록에 추가
        setThreadMessages(prev => [...prev, newThreadMessage]);
      }
    };

    const handleReactionUpdated = (event: any) => {
      const payload = event?.data || event;
      const { messageId, reactions } = payload || {};
      if (!messageId) return;
      // 해당 메시지가 스레드 목록에 있으면 리액션만 교체
      setThreadMessages(prev => prev.map(m => (m.id === messageId ? { ...m, reactions } : m)));
    };

    // WebSocket 이벤트 리스너 등록 (싱글톤 인스턴스)
    const wsService = getChatWebSocketService(() => localStorage.getItem('accessToken'));
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
      const threadMessages = await actions.getThreadMessages(originalMessage.id);
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
            <ReplyIcon sx={{ fontSize: 20 }} />
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
      <Box
        data-testid="thread-messages-container"
        sx={{
          flex: 1,
          overflow: 'auto',
          p: 1,
          // 메인 채팅 스크롤바와 동일한 스타일
          '&::-webkit-scrollbar': {
            width: '8px',
          },
          '&::-webkit-scrollbar-track': {
            background: 'transparent',
          },
          '&::-webkit-scrollbar-thumb': {
            background: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)',
            borderRadius: '4px',
          },
          '&::-webkit-scrollbar-thumb:hover': {
            background: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.3)',
          },
          '&::-webkit-scrollbar-thumb:active': {
            background: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.4)',
          },
          scrollbarWidth: 'thin',
          scrollbarColor: theme.palette.mode === 'dark'
            ? 'rgba(255, 255, 255, 0.2) transparent'
            : 'rgba(0, 0, 0, 0.2) transparent',
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
              <Box key={message.id} className="message-container" sx={{ mb: 2, position: 'relative', p: 0.5, borderRadius: 1, '&:hover': { backgroundColor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)' } }}>
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

                    {/* Reactions display */}
                    {message.reactions && message.reactions.length > 0 && (
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 1 }}>
                        {Object.entries(
                          message.reactions.reduce((acc, reaction) => {
                            if (!acc[reaction.emoji]) acc[reaction.emoji] = [];
                            acc[reaction.emoji].push(reaction);
                            return acc;
                          }, {} as Record<string, any[]>)
                        ).map(([emoji, reactions]) => (
                          <Box
                            key={emoji}
                            onClick={() => {
                              const userReaction = (reactions as any[]).find((r: any) => r.userId === state.user?.id);
                              // Optimistic local update
                              const currentUserId = state.user?.id;
                              if (currentUserId) {
                                setThreadMessages(prev => prev.map(m => {
                                  if (m.id !== message.id) return m;
                                  const curr = (m.reactions || []) as any[];
                                  const next = userReaction
                                    ? curr.filter((r: any) => !(r.userId === currentUserId && r.emoji === emoji))
                                    : [...curr, { userId: currentUserId, emoji } as any];
                                  return { ...m, reactions: next };
                                }));
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
                              borderRadius: '12px',
                              backgroundColor: (reactions as any[]).some((r: any) => r.userId === state.user?.id)
                                ? theme.palette.primary.main + '20'
                                : (theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)'),
                              border: `1px solid ${ (reactions as any[]).some((r: any) => r.userId === state.user?.id) ? theme.palette.primary.main : theme.palette.divider }`,
                              cursor: 'pointer',
                              '&:hover': { backgroundColor: theme.palette.primary.main + '30' }
                            }}
                          >
                            <Typography sx={{ fontSize: '14px' }}>{emoji}</Typography>
                            <Typography sx={{ fontSize: '12px', color: 'text.secondary', fontWeight: (reactions as any[]).some((r: any) => r.userId === state.user?.id) ? 600 : 400 }}>
                              {(reactions as any[]).length
                              }
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
                    borderRadius: '8px',
                    border: `1px solid ${theme.palette.divider}`,
                    boxShadow: theme.shadows[2],
                    '.message-container:hover &': { display: 'flex' }
                  }}
                >
                  {['👍', '❤️', '😂', '😮', '😢', '😡'].map((emoji) => (
                    <Box
                      key={emoji}
                      onClick={() => {
                        const currentUserId = state.user?.id;
                        if (currentUserId) {
                          setThreadMessages(prev => prev.map(m => {
                            if (m.id !== message.id) return m;
                            const curr = (m.reactions || []) as any[];
                            if (curr.some((r: any) => r.userId === currentUserId && r.emoji === emoji)) return m;
                            return { ...m, reactions: [...curr, { userId: currentUserId, emoji } as any] };
                          }));
                        }
                        actions.addReaction(message.id, emoji);
                      }}
                      sx={{ p: 0.5, borderRadius: '6px', cursor: 'pointer', fontSize: '16px', '&:hover': { backgroundColor: theme.palette.action.hover } }}
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
      <Box sx={{ p: 2, borderTop: `1px solid ${theme.palette.divider}` }}>
        <AdvancedMessageInput
          channelId={originalMessage.channelId}
          autoFocus
          onSendMessage={(content, attachments) => {
            actions.sendMessage({
              content,
              channelId: originalMessage.channelId,
              type: 'text',
              threadId: originalMessage.id,
              attachments
            });
          }}
          placeholder={t('chat.replyToThread')}
        />
      </Box>
    </Paper>
  );
};

export default ThreadView;

import React, { createContext, useContext, useReducer, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useSnackbar, closeSnackbar } from 'notistack';
import { useAuth } from '../hooks/useAuth';
import { ChatService } from '../services/chatService';
import { getChatWebSocketService } from '../services/chatWebSocketService';
import {
  ChatState,
  ChatContextType,
  Channel,
  Message,
  CreateChannelRequest,
  UpdateChannelRequest,
  SendMessageRequest,
  UpdateMessageRequest,
  TypingIndicator,
  User,
  MessageAttachment
} from '../types/chat';

// 로컬 스토리지에서 메시지 캐시 로드
const loadCachedMessages = (): Record<number, Message[]> => {
  try {
    console.log('🔍 Loading cached messages from localStorage...');
    const cached = localStorage.getItem('chatMessages');
    console.log('📦 Raw cached data:', cached ? 'Found' : 'Not found');

    if (cached) {
      const parsed = JSON.parse(cached);
      console.log('📋 Parsed cached data:', Object.keys(parsed).map(k => `${k}: ${parsed[k].length} messages`));

      // 24시간 이내의 메시지만 유지 (1시간에서 24시간으로 연장)
      const twentyFourHoursAgo = Date.now() - (24 * 60 * 60 * 1000);
      const filteredMessages: Record<number, Message[]> = {};

      Object.entries(parsed).forEach(([channelId, messages]) => {
        const recentMessages = (messages as Message[]).filter(msg =>
          new Date(msg.createdAt).getTime() > twentyFourHoursAgo
        );
        console.log(`⏰ Channel ${channelId}: ${(messages as Message[]).length} total, ${recentMessages.length} recent`);
        if (recentMessages.length > 0) {
          filteredMessages[parseInt(channelId)] = recentMessages;
        }
      });

      console.log('✅ Loaded cached messages for channels:', Object.keys(filteredMessages));
      return filteredMessages;
    } else {
      console.log('❌ No cached messages found');
    }
  } catch (error) {
    console.error('Failed to load cached messages:', error);
  }
  return {};
};

// 메시지를 로컬 스토리지에 저장 (디바운스 적용)
let saveTimeout: NodeJS.Timeout | null = null;
const saveCachedMessages = (messages: Record<number, Message[]>) => {
  try {
    // 기존 타임아웃 취소
    if (saveTimeout) {
      clearTimeout(saveTimeout);
    }

    // 500ms 후에 저장 (디바운스)
    saveTimeout = setTimeout(() => {
      console.log('💾 Saving messages to cache:', Object.keys(messages).map(k => `${k}: ${messages[parseInt(k)].length} messages`));
      localStorage.setItem('chatMessages', JSON.stringify(messages));
    }, 500);
  } catch (error) {
    console.error('Failed to save cached messages:', error);
  }
};

// Initial state
const initialState: ChatState = {
  channels: [],
  currentChannelId: null,
  messages: loadCachedMessages(),
  users: {},
  user: null,
  typingUsers: {},
  notifications: [],
  isConnected: false,
  isLoading: false,
  pendingInvitationsCount: 0,
};

// Action types
type ChatAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_CONNECTED'; payload: boolean }
  | { type: 'SET_CHANNELS'; payload: Channel[] }
  | { type: 'ADD_CHANNEL'; payload: Channel }
  | { type: 'UPDATE_CHANNEL'; payload: Channel }
  | { type: 'REMOVE_CHANNEL'; payload: number }
  | { type: 'SET_CURRENT_CHANNEL'; payload: number | null }
  | { type: 'SET_MESSAGES'; payload: { channelId: number; messages: Message[] } }
  | { type: 'ADD_MESSAGE'; payload: Message }
  | { type: 'UPDATE_MESSAGE'; payload: Message }
  | { type: 'REMOVE_MESSAGE'; payload: { channelId: number; messageId: number } }
  | { type: 'PREPEND_MESSAGES'; payload: { channelId: number; messages: Message[] } }
  | { type: 'SET_USERS'; payload: User[] }
  | { type: 'UPDATE_USER'; payload: User }
  | { type: 'SET_CURRENT_USER'; payload: User }
  | { type: 'SET_TYPING_USERS'; payload: { channelId: number; users: TypingIndicator[] } }
  | { type: 'ADD_TYPING_USER'; payload: TypingIndicator }
  | { type: 'REMOVE_TYPING_USER'; payload: { channelId: number; userId: number } }
  | { type: 'REFRESH_CHANNELS' }
  | { type: 'SET_PENDING_INVITATIONS_COUNT'; payload: number };

// Reducer
const chatReducer = (state: ChatState, action: ChatAction): ChatState => {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };

    case 'SET_CONNECTED':
      return { ...state, isConnected: action.payload };
    
    case 'SET_CHANNELS':
      return { ...state, channels: action.payload };
    
    case 'ADD_CHANNEL':
      return { 
        ...state, 
        channels: [...state.channels, action.payload] 
      };
    
    case 'UPDATE_CHANNEL':
      return {
        ...state,
        channels: state.channels.map(channel =>
          channel.id === action.payload.id ? action.payload : channel
        ),
      };
    
    case 'REMOVE_CHANNEL':
      return {
        ...state,
        channels: state.channels.filter(channel => channel.id !== action.payload),
        currentChannelId: state.currentChannelId === action.payload ? null : state.currentChannelId,
      };
    
    case 'SET_CURRENT_CHANNEL':
      return { ...state, currentChannelId: action.payload };
    
    case 'SET_MESSAGES':
      const newMessagesState = {
        ...state.messages,
        [action.payload.channelId]: action.payload.messages,
      };
      // 메시지 상태 변경 시 localStorage에 저장
      saveCachedMessages(newMessagesState);
      return {
        ...state,
        messages: newMessagesState,
      };
    
    case 'ADD_MESSAGE':
      const channelId = action.payload.channelId;
      const currentMessages = state.messages[channelId] || [];

      // 중복 메시지 방지
      const messageExists = currentMessages.some(msg => msg.id === action.payload.id);
      if (messageExists) {
        return state;
      }

      const updatedMessages = {
        ...state.messages,
        [channelId]: [...currentMessages, action.payload],
      };

      // 새 메시지 추가 시 localStorage에 저장
      saveCachedMessages(updatedMessages);

      return {
        ...state,
        messages: updatedMessages,
      };
    
    case 'UPDATE_MESSAGE':
      const updateChannelId = action.payload.channelId;
      const updatedChannelMessages = (state.messages[updateChannelId] || []).map(msg =>
        msg.id === action.payload.id ? action.payload : msg
      );
      return {
        ...state,
        messages: {
          ...state.messages,
          [updateChannelId]: updatedChannelMessages,
        },
      };
    
    case 'REMOVE_MESSAGE':
      const removeChannelId = action.payload.channelId;
      const filteredMessages = (state.messages[removeChannelId] || []).filter(
        msg => msg.id !== action.payload.messageId
      );
      return {
        ...state,
        messages: {
          ...state.messages,
          [removeChannelId]: filteredMessages,
        },
      };
    
    case 'PREPEND_MESSAGES':
      const prependChannelId = action.payload.channelId;
      const existingMessages = state.messages[prependChannelId] || [];
      const prependedMessages = {
        ...state.messages,
        [prependChannelId]: [...action.payload.messages, ...existingMessages],
      };

      // 이전 메시지 추가 시 localStorage에 저장
      saveCachedMessages(prependedMessages);

      return {
        ...state,
        messages: prependedMessages,
      };
    
    case 'SET_USERS':
      const usersMap = action.payload.reduce((acc, user) => {
        acc[user.id] = user;
        return acc;
      }, {} as Record<number, User>);
      return { ...state, users: { ...state.users, ...usersMap } };
    
    case 'UPDATE_USER':
      return {
        ...state,
        users: {
          ...state.users,
          [action.payload.id]: action.payload,
        },
        user: state.user?.id === action.payload.id ? action.payload : state.user,
      };

    case 'SET_CURRENT_USER':
      return {
        ...state,
        user: action.payload,
        users: {
          ...state.users,
          [action.payload.id]: action.payload,
        },
      };
    
    case 'SET_TYPING_USERS':
      return {
        ...state,
        typingUsers: {
          ...state.typingUsers,
          [action.payload.channelId]: action.payload.users,
        },
      };
    
    case 'ADD_TYPING_USER':
      const typingChannelId = action.payload.channelId;
      const currentTypingUsers = state.typingUsers[typingChannelId] || [];
      const existingIndex = currentTypingUsers.findIndex(u => u.userId === action.payload.userId);
      
      if (existingIndex >= 0) {
        // Update existing typing indicator
        const updatedTypingUsers = [...currentTypingUsers];
        updatedTypingUsers[existingIndex] = action.payload;
        return {
          ...state,
          typingUsers: {
            ...state.typingUsers,
            [typingChannelId]: updatedTypingUsers,
          },
        };
      } else {
        // Add new typing indicator
        return {
          ...state,
          typingUsers: {
            ...state.typingUsers,
            [typingChannelId]: [...currentTypingUsers, action.payload],
          },
        };
      }
    
    case 'REMOVE_TYPING_USER':
      const removeTypingChannelId = action.payload.channelId;
      const filteredTypingUsers = (state.typingUsers[removeTypingChannelId] || []).filter(
        u => u.userId !== action.payload.userId
      );
      return {
        ...state,
        typingUsers: {
          ...state.typingUsers,
          [removeTypingChannelId]: filteredTypingUsers,
        },
      };

    case 'REFRESH_CHANNELS':
      // 채널 목록 새로고침을 위한 플래그 설정
      return {
        ...state,
        isLoading: true, // 새로고침 중임을 표시
      };

    default:
      return state;
  }
};

// Context
const ChatContext = createContext<ChatContextType | null>(null);

// Provider component
export const ChatProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(chatReducer, initialState);
  const { user, getToken } = useAuth();
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const wsService = getChatWebSocketService(getToken);

  // 디버깅: 초기 상태 확인
  console.log('🚀 ChatProvider initialized with messages:', Object.keys(state.messages).map(k => `${k}: ${state.messages[parseInt(k)].length} messages`));

  // 페이지 전환 시 메시지 상태 보존을 위한 ref
  const isInitializedRef = useRef(false);

  // markAsRead 요청 추적을 위한 ref
  const markAsReadRequestsRef = useRef<Set<string>>(new Set());

  // Initialize WebSocket connection
  useEffect(() => {
    if (user && !isInitializedRef.current) {
      isInitializedRef.current = true;

      // 현재 사용자 정보를 설정
      dispatch({ type: 'SET_CURRENT_USER', payload: user });

      const connectWebSocket = async () => {
        try {
          await wsService.connect();
          console.log('WebSocket connected successfully');
          dispatch({ type: 'SET_CONNECTED', payload: true });
          loadChannels();
        } catch (error) {
          console.error('Failed to connect to chat WebSocket:', error);
          enqueueSnackbar(t('chat.connectionFailed'), { variant: 'error' });
        }
      };

      // Set up WebSocket event listeners
      const setupEventListeners = () => {
        wsService.onMessageCreated((message) => {
          console.log('📨 ChatContext received message_created:', message);
          console.log('📨 Message data:', message.data);
          dispatch({ type: 'ADD_MESSAGE', payload: message.data });
        });

        wsService.onMessageUpdated((message) => {
          dispatch({ type: 'UPDATE_MESSAGE', payload: message });
        });

        // 연결 상태 이벤트 리스너
        wsService.on('connection_established', () => {
          console.log('WebSocket connection established');
          dispatch({ type: 'SET_CONNECTED', payload: true });

          // 재연결 시 현재 채널에 다시 참여
          if (state.currentChannelId) {
            console.log('Rejoining current channel after reconnection:', state.currentChannelId);
            wsService.joinChannel(state.currentChannelId);
          }
        });

        wsService.on('connection_lost', () => {
          console.log('WebSocket connection lost');
          dispatch({ type: 'SET_CONNECTED', payload: false });
          enqueueSnackbar(t('chat.connectionLost'), { variant: 'warning' });
        });

        wsService.on('connection_error', (event) => {
          console.error('WebSocket connection error:', event);
          dispatch({ type: 'SET_CONNECTED', payload: false });
          enqueueSnackbar(t('chat.connectionError'), { variant: 'error' });
        });

        wsService.on('connection_failed', (event) => {
          console.error('WebSocket connection failed permanently:', event);
          dispatch({ type: 'SET_CONNECTED', payload: false });
          enqueueSnackbar(t('chat.serviceUnavailable'), { variant: 'error' });
        });

        wsService.on('authentication_failed', async (event) => {
          console.error('WebSocket authentication failed:', event);
          dispatch({ type: 'SET_CONNECTED', payload: false });

          try {
            // 토큰 갱신 시도
            const { AuthService } = await import('../services/auth');
            await AuthService.refreshToken();

            console.log('✅ Token refreshed, reconnecting WebSocket...');

            // WebSocket 재연결
            setTimeout(() => {
              wsService.connect();
            }, 1000);

          } catch (refreshError) {
            console.error('❌ Token refresh failed:', refreshError);
            enqueueSnackbar(t('chat.authenticationFailed'), { variant: 'error' });
          }
        });
      };

      setupEventListeners();
      connectWebSocket();

      wsService.onMessageDeleted((messageId) => {
        // Find the channel for this message
        const channelId = findChannelIdForMessage(messageId);
        if (channelId) {
          dispatch({ type: 'REMOVE_MESSAGE', payload: { channelId, messageId } });
        }
      });

      wsService.onUserTyping((typing) => {
        dispatch({ type: 'ADD_TYPING_USER', payload: typing });
        // Remove typing indicator after 3 seconds
        setTimeout(() => {
          dispatch({ 
            type: 'REMOVE_TYPING_USER', 
            payload: { channelId: typing.channelId, userId: typing.userId } 
          });
        }, 3000);
      });

      wsService.onUserStopTyping((typing) => {
        dispatch({ 
          type: 'REMOVE_TYPING_USER', 
          payload: { channelId: typing.channelId, userId: typing.userId } 
        });
      });

      wsService.onUserOnline((user) => {
        dispatch({ type: 'UPDATE_USER', payload: { ...user, isOnline: true } });
      });

      wsService.onUserOffline((user) => {
        dispatch({ type: 'UPDATE_USER', payload: { ...user, isOnline: false } });
      });

      // 사용자 채널 참여 이벤트 리스너
      wsService.on('user_joined_channel', (event) => {
        console.log('📨 User joined channel in ChatContext:', event);
        const { data } = event;

        // 현재 채널에 새 멤버가 들어온 경우
        if (data.channelId === state.currentChannelId) {
          // 시스템 메시지 추가
          const systemMessage = {
            id: Date.now(), // 임시 ID
            content: t('chat.userJoinedChannel', { userName: data.userName }),
            type: 'system' as const,
            channelId: data.channelId,
            userId: 0, // 시스템 메시지
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            isDeleted: false,
            isEdited: false,
          };

          dispatch({ type: 'ADD_MESSAGE', payload: systemMessage });
        }

        // 채널 목록 새로고침 (멤버 수 업데이트)
        dispatch({ type: 'REFRESH_CHANNELS' });
      });

      // 초대 응답 이벤트 리스너
      wsService.on('invitation_response', (event) => {
        console.log('📨 Invitation response received in ChatContext:', event);
        const { data } = event;

        if (data.action === 'accept') {
          enqueueSnackbar(
            t('chat.invitationAccepted', { inviteeName: data.inviteeName }),
            { variant: 'success' }
          );
        } else {
          enqueueSnackbar(
            t('chat.invitationDeclined', { inviteeName: data.inviteeName }),
            { variant: 'info' }
          );
        }

        // 채널 목록 새로고침
        dispatch({ type: 'REFRESH_CHANNELS' });
      });

      // 채널 초대 이벤트 리스너
      wsService.on('channel_invitation', (event) => {
        console.log('📨 Channel invitation received in ChatContext:', event);
        const { data } = event;

        // 토스트 알림 표시 (백엔드 메시지가 있으면 사용, 없으면 기본 번역 메시지 사용)
        const displayMessage = data.message || t('chat.invitationReceived', {
          inviterName: data.inviterName,
          channelName: data.channelName
        });

        enqueueSnackbar(
          displayMessage,
          {
            variant: 'info',
            autoHideDuration: 30000, // 30초 후 자동 닫힘
            action: (key) => (
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={async () => {
                    try {
                      const response = await fetch(`/api/v1/chat/invitations/${data.invitationId}/respond`, {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
                        },
                        body: JSON.stringify({ action: 'accept' })
                      });

                      if (response.ok) {
                        enqueueSnackbar(t('chat.invitationAccepted'), { variant: 'success' });
                        // 채널 목록 새로고침
                        loadChannels();
                      } else {
                        enqueueSnackbar(t('chat.invitationAcceptFailed'), { variant: 'error' });
                      }
                    } catch (error) {
                      console.error('Failed to accept invitation:', error);
                      enqueueSnackbar(t('chat.invitationAcceptFailed'), { variant: 'error' });
                    }
                    closeSnackbar(key);
                  }}
                  style={{
                    background: '#4caf50',
                    color: 'white',
                    border: 'none',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '12px'
                  }}
                >
                  {t('chat.accept')}
                </button>
                <button
                  onClick={async () => {
                    try {
                      const response = await fetch(`/api/v1/chat/invitations/${data.invitationId}/respond`, {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
                        },
                        body: JSON.stringify({ action: 'decline' })
                      });

                      if (response.ok) {
                        enqueueSnackbar(t('chat.invitationDeclined'), { variant: 'info' });
                      } else {
                        enqueueSnackbar(t('chat.invitationDeclineFailed'), { variant: 'error' });
                      }
                    } catch (error) {
                      console.error('Failed to decline invitation:', error);
                      enqueueSnackbar(t('chat.invitationDeclineFailed'), { variant: 'error' });
                    }
                    closeSnackbar(key);
                  }}
                  style={{
                    background: '#f44336',
                    color: 'white',
                    border: 'none',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '12px'
                  }}
                >
                  {t('chat.decline')}
                </button>
              </div>
            )
          }
        );
      });

      return () => {
        // 이벤트 리스너 정리
        wsService.removeAllListeners();
        wsService.disconnect();
        dispatch({ type: 'SET_CONNECTED', payload: false });
      };
    }
  }, [user?.userId]); // user 객체 전체가 아닌 userId만 의존성으로 사용

  // Helper function to find channel ID for a message
  const findChannelIdForMessage = (messageId: number): number | null => {
    for (const [channelId, messages] of Object.entries(state.messages)) {
      if (messages.some(msg => msg.id === messageId)) {
        return parseInt(channelId);
      }
    }
    return null;
  };

  // Load messages for a channel
  const loadMessages = useCallback(async (channelId: number, forceReload = false) => {
    try {
      console.log('Loading messages for channel:', channelId, 'forceReload:', forceReload);

      // 강제 리로드가 아니고 이미 메시지가 있다면 스킵
      if (!forceReload && state.messages[channelId] && state.messages[channelId].length > 0) {
        console.log('Messages already loaded for channel:', channelId, 'count:', state.messages[channelId].length);
        return;
      }

      // 현재 상태에서 캐시된 메시지 확인
      const currentCachedMessages = loadCachedMessages();
      const cachedMessages = currentCachedMessages[channelId];

      if (!forceReload && cachedMessages && cachedMessages.length > 0) {
        console.log('Using cached messages:', cachedMessages.length);
        // 캐시된 메시지를 먼저 상태에 설정
        dispatch({ type: 'SET_MESSAGES', payload: { channelId, messages: cachedMessages } });

        // 그 다음 서버에서 최신 메시지만 확인
        try {
          const latestCachedMessage = cachedMessages[cachedMessages.length - 1];
          const result = await ChatService.getMessages({
            channelId,
            limit: 20, // 최신 20개만 확인
            after: latestCachedMessage.id // 마지막 캐시된 메시지 이후만
          });

          if (result.messages.length > 0) {
            console.log('Found new messages:', result.messages.length);
            // 새 메시지가 있으면 추가
            result.messages.forEach(message => {
              dispatch({ type: 'ADD_MESSAGE', payload: message });
            });
          }
        } catch (serverError) {
          console.warn('Failed to fetch latest messages from server, using cached messages only:', serverError);
        }
        return;
      }

      // 캐시된 메시지가 없거나 강제 리로드인 경우 서버에서 로딩
      const result = await ChatService.getMessages({
        channelId,
        limit: 50 // 최근 50개 메시지만 로딩
      });
      console.log('Loaded messages from server:', result.messages.length);
      dispatch({ type: 'SET_MESSAGES', payload: { channelId, messages: result.messages } });
    } catch (error: any) {
      console.error('Failed to load messages for channel', channelId, ':', error);
      dispatch({ type: 'SET_ERROR', payload: error.message || 'Failed to load messages' });
    }
  }, [state.messages]);

  // REFRESH_CHANNELS 액션 처리
  useEffect(() => {
    if (state.isLoading && state.channels.length === 0) {
      // 초기 로딩이 아닌 경우에만 새로고침
      return;
    }

    if (state.isLoading) {
      // REFRESH_CHANNELS 액션으로 인한 로딩 상태인 경우 채널 새로고침
      loadChannels();
    }
  }, [state.isLoading]);

  // Load channels
  const loadChannels = useCallback(async () => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      const channels = await ChatService.getChannels();
      dispatch({ type: 'SET_CHANNELS', payload: channels });

      // 마지막 참여 채널 자동 선택
      const lastChannelId = localStorage.getItem('lastChannelId');
      if (lastChannelId && channels.length > 0) {
        const lastChannel = channels.find(c => c.id === parseInt(lastChannelId));
        if (lastChannel) {
          console.log('Auto-selecting last channel:', lastChannel.name, 'ID:', lastChannel.id);
          // 직접 dispatch를 사용하여 채널 선택
          dispatch({ type: 'SET_CURRENT_CHANNEL', payload: lastChannel.id });

          // 메시지 로딩을 위해 setTimeout으로 다음 틱에 실행
          setTimeout(() => {
            // 이미 메시지가 있는지 확인 후 로딩
            const currentMessages = state.messages[lastChannel.id];
            if (!currentMessages || currentMessages.length === 0) {
              loadMessages(lastChannel.id);
            }
            wsService.joinChannel(lastChannel.id);
          }, 0);
        }
      }
    } catch (error: any) {
      dispatch({ type: 'SET_ERROR', payload: error.message || 'Failed to load channels' });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [loadMessages]);

  // Actions
  const actions: ChatContextType['actions'] = {
    setCurrentChannel: (channelId) => {
      const previousChannelId = state.currentChannelId;
      dispatch({ type: 'SET_CURRENT_CHANNEL', payload: channelId });

      // 마지막 채널 ID 저장
      if (channelId) {
        localStorage.setItem('lastChannelId', channelId.toString());
        console.log('Saved last channel ID:', channelId);

        // 채널이 실제로 변경된 경우에만 메시지 로딩
        if (previousChannelId !== channelId) {
          console.log('Channel changed from', previousChannelId, 'to', channelId);
          // 비동기 함수를 setTimeout으로 감싸서 안전하게 호출
          setTimeout(() => {
            loadMessages(channelId);
          }, 0);
        }

        // WebSocket 채널 참여
        wsService.joinChannel(channelId);
      } else {
        localStorage.removeItem('lastChannelId');
      }
    },

    sendMessage: async (channelId, messageData) => {
      try {
        const message = await ChatService.sendMessage(channelId, messageData);
        // Message will be added via WebSocket event
        return message;
      } catch (error: any) {
        dispatch({ type: 'SET_ERROR', payload: error.message || t('chat.sendMessageFailed') });
        throw error;
      }
    },

    editMessage: async (messageId, content) => {
      try {
        const message = await ChatService.updateMessage(messageId, { content });
        // Message will be updated via WebSocket event
        return message;
      } catch (error: any) {
        dispatch({ type: 'SET_ERROR', payload: error.message || 'Failed to edit message' });
        throw error;
      }
    },

    deleteMessage: async (messageId) => {
      try {
        await ChatService.deleteMessage(messageId);
        // Message will be removed via WebSocket event
      } catch (error: any) {
        dispatch({ type: 'SET_ERROR', payload: error.message || 'Failed to delete message' });
        throw error;
      }
    },

    createChannel: async (channelData) => {
      try {
        console.log('📡 ChatContext: Creating channel via API...', channelData);
        const channel = await ChatService.createChannel(channelData);
        console.log('✅ ChatContext: Channel created, adding to state...', channel);
        dispatch({ type: 'ADD_CHANNEL', payload: channel });
        return channel;
      } catch (error: any) {
        console.error('❌ ChatContext: Channel creation failed:', {
          error,
          message: error.message,
          status: error.status,
          code: error.code,
          isNetworkError: error.isNetworkError,
          response: error.response,
          stack: error.stack
        });
        dispatch({ type: 'SET_ERROR', payload: error.message || 'Failed to create channel' });
        throw error;
      }
    },

    updateChannel: async (channelId, updates) => {
      try {
        const channel = await ChatService.updateChannel(channelId, updates);
        dispatch({ type: 'UPDATE_CHANNEL', payload: channel });
        return channel;
      } catch (error: any) {
        dispatch({ type: 'SET_ERROR', payload: error.message || 'Failed to update channel' });
        throw error;
      }
    },

    joinChannel: async (channelId) => {
      try {
        await ChatService.joinChannel(channelId);
        wsService.joinChannel(channelId);
        await loadChannels(); // Refresh channels
      } catch (error: any) {
        dispatch({ type: 'SET_ERROR', payload: error.message || 'Failed to join channel' });
        throw error;
      }
    },

    leaveChannel: async (channelId) => {
      try {
        await ChatService.leaveChannel(channelId);
        wsService.leaveChannel(channelId);
        dispatch({ type: 'REMOVE_CHANNEL', payload: channelId });
      } catch (error: any) {
        dispatch({ type: 'SET_ERROR', payload: error.message || 'Failed to leave channel' });
        throw error;
      }
    },

    addReaction: async (messageId, emoji) => {
      try {
        await ChatService.addReaction(messageId, emoji);
        // Reaction will be updated via WebSocket event
      } catch (error: any) {
        dispatch({ type: 'SET_ERROR', payload: error.message || 'Failed to add reaction' });
        throw error;
      }
    },

    removeReaction: async (messageId, emoji) => {
      try {
        await ChatService.removeReaction(messageId, emoji);
        // Reaction will be updated via WebSocket event
      } catch (error: any) {
        dispatch({ type: 'SET_ERROR', payload: error.message || 'Failed to remove reaction' });
        throw error;
      }
    },

    markAsRead: async (channelId, messageId) => {
      try {
        // 요청 키 생성
        const requestKey = `${channelId}_${messageId || 'latest'}`;

        // 이미 진행 중인 요청이 있으면 스킵
        if (markAsReadRequestsRef.current.has(requestKey)) {
          console.log(`⏭️ Skipping duplicate markAsRead request for channel ${channelId}`);
          return;
        }

        // 디바운스를 위한 키 생성
        const debounceKey = `markAsRead_${requestKey}`;

        // 기존 타임아웃 취소
        if ((window as any)[debounceKey]) {
          clearTimeout((window as any)[debounceKey]);
        }

        // 5초 후에 실행 (디바운스 시간 대폭 증가)
        (window as any)[debounceKey] = setTimeout(async () => {
          // 요청 시작 표시
          markAsReadRequestsRef.current.add(requestKey);

          try {
            await ChatService.markAsRead(channelId, messageId);
            console.log(`✅ Marked channel ${channelId} as read`);
          } catch (error: any) {
            // 네트워크 오류나 타임아웃은 조용히 처리
            if (error.code === 'ECONNABORTED' || error.status >= 500 || error.status === 408) {
              console.warn(`⚠️ Mark as read failed for channel ${channelId} (network/server issue):`, error.message || error);

              // 네트워크 오류인 경우 5초 후 재시도
              setTimeout(() => {
                console.log(`🔄 Retrying markAsRead for channel ${channelId}`);
                actions.markAsRead(channelId, messageId);
              }, 5000);
            } else {
              console.error('Failed to mark as read:', error);
            }
          } finally {
            // 요청 완료 표시
            markAsReadRequestsRef.current.delete(requestKey);
            // 타임아웃 정리
            delete (window as any)[debounceKey];
          }
        }, 500);
      } catch (error: any) {
        console.error('Failed to setup mark as read:', error);
      }
    },

    startTyping: (channelId) => {
      wsService.startTyping(channelId);
    },

    stopTyping: (channelId) => {
      wsService.stopTyping(channelId);
    },

    searchMessages: async (query, channelId) => {
      try {
        return await ChatService.searchMessages(query, channelId);
      } catch (error: any) {
        dispatch({ type: 'SET_ERROR', payload: error.message || 'Failed to search messages' });
        throw error;
      }
    },

    loadMessages: loadMessages,

    loadMoreMessages: async (channelId) => {
      try {
        const currentMessages = state.messages[channelId] || [];
        if (currentMessages.length === 0) return;

        const oldestMessage = currentMessages[0];
        const result = await ChatService.getMessageHistory(channelId, oldestMessage.id);

        if (result.messages.length > 0) {
          dispatch({
            type: 'PREPEND_MESSAGES',
            payload: { channelId, messages: result.messages }
          });
        }
      } catch (error: any) {
        dispatch({ type: 'SET_ERROR', payload: error.message || 'Failed to load more messages' });
        throw error;
      }
    },

    uploadFile: async (file, channelId) => {
      try {
        return await ChatService.uploadFile(file, channelId);
      } catch (error: any) {
        dispatch({ type: 'SET_ERROR', payload: error.message || 'Failed to upload file' });
        throw error;
      }
    },

    inviteUser: async (channelId: number, userId: number, message?: string) => {
      try {
        await ChatService.inviteUser(channelId, userId, message);
        // 초대 성공 시 채널 멤버 목록 새로고침 (필요한 경우)
        // await loadChannels();
      } catch (error: any) {
        dispatch({ type: 'SET_ERROR', payload: error.message || 'Failed to invite user' });
        throw error;
      }
    },

    clearError: () => {
      dispatch({ type: 'SET_ERROR', payload: null });
    },
  };

  // Select channel (used for auto-selection)
  const selectChannel = async (channelId: number) => {
    actions.setCurrentChannel(channelId);
  };

  return (
    <ChatContext.Provider value={{ state, actions }}>
      {children}
    </ChatContext.Provider>
  );
};

// Hook to use chat context
export const useChat = (): ChatContextType => {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
};

export default ChatContext;

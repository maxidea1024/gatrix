import React, {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useCallback,
  useRef,
} from 'react';
import { useTranslation } from 'react-i18next';
import { useSnackbar, closeSnackbar } from 'notistack';
import { useAuth } from '../hooks/useAuth';
import { ChatService } from '../services/chatService';
import { getChatWebSocketService } from '../services/chatWebSocketService';
import { apiService } from '../services/api';
import { AuthService } from '../services/auth';

const DEFAULT_AVATAR_URL = 'https://cdn-icons-png.flaticon.com/512/847/847969.png';
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
  MessageAttachment,
} from '../types/chat';

// Cache schema versioning for localStorage-stored messages
const CHAT_CACHE_VERSION = '2';

// Helper function to load cached messages (called only when ChatProvider mounts)
const loadCachedMessages = (): Record<number, Message[]> => {
  try {
    console.log('🔍 Loading cached messages from localStorage...');

    const cacheVersion = localStorage.getItem('chatMessagesVersion');
    if (cacheVersion !== CHAT_CACHE_VERSION) {
      console.warn('⚠️ Chat cache version mismatch. Ignoring old cache.', {
        cacheVersion,
        expected: CHAT_CACHE_VERSION,
      });
      return {};
    }

    const cached = localStorage.getItem('chatMessages');
    console.log('📦 Raw cached data:', cached ? 'Found' : 'Not found');

    if (cached) {
      const parsed = JSON.parse(cached);
      console.log(
        '📋 Parsed cached data:',
        Object.keys(parsed).map((k) => `${k}: ${parsed[k].length} messages`)
      );

      // 24시간 이내의 메시지만 유지 (1시간에서 24시간으로 연장)
      const twentyFourHoursAgo = Date.now() - 24 * 60 * 60 * 1000;
      const filteredMessages: Record<number, Message[]> = {};

      Object.entries(parsed).forEach(([channelId, messages]) => {
        const recentMessages = (messages as Message[]).filter(
          (msg) => new Date(msg.createdAt).getTime() > twentyFourHoursAgo
        );
        console.log(
          `⏰ Channel ${channelId}: ${(messages as Message[]).length} total, ${recentMessages.length} recent`
        );
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

// 메시지를 로컬 스토리지에 Save (디바운스 적용)
let saveTimeout: NodeJS.Timeout | null = null;
const saveCachedMessages = (messages: Record<number, Message[]>) => {
  try {
    // Existing 타임아웃 Cancel
    if (saveTimeout) {
      clearTimeout(saveTimeout);
    }

    // 500ms 후에 Save (디바운스)
    saveTimeout = setTimeout(() => {
      console.log(
        '💾 Saving messages to cache:',
        Object.keys(messages).map((k) => {
          const channelMessages = messages[parseInt(k)];
          return `${k}: ${channelMessages?.length || 0} messages`;
        })
      );
      localStorage.setItem('chatMessages', JSON.stringify(messages));
      localStorage.setItem('chatMessagesVersion', CHAT_CACHE_VERSION);
    }, 500);
  } catch (error) {
    console.error('Failed to save cached messages:', error);
  }
};

// Initial state factory function (called only when ChatProvider mounts)
const createInitialState = (): ChatState => ({
  channels: [],
  currentChannelId: null,
  messages: loadCachedMessages(),
  users: {},
  user: null,
  typingUsers: {},
  threadTypingUsers: {},
  notifications: [],
  isConnected: false,
  isLoading: false,
  loadingStage: 'idle', // 'idle' | 'syncing' | 'connecting' | 'loading_channels' | 'complete'
  loadingStartTime: null, // 로딩 시작 시간
  pendingInvitationsCount: 0,
  error: null,
});

// Action types
type ChatAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | {
      type: 'SET_LOADING_STAGE';
      payload: 'idle' | 'syncing' | 'connecting' | 'loading_channels' | 'complete';
    }
  | { type: 'SET_LOADING_START_TIME'; payload: number | null }
  | { type: 'SET_CONNECTED'; payload: boolean }
  | { type: 'SET_CHANNELS'; payload: Channel[] }
  | { type: 'ADD_CHANNEL'; payload: Channel }
  | { type: 'UPDATE_CHANNEL'; payload: Channel }
  | { type: 'REMOVE_CHANNEL'; payload: number }
  | { type: 'SET_CURRENT_CHANNEL'; payload: number | null }
  | {
      type: 'SET_MESSAGES';
      payload: { channelId: number; messages: Message[] };
    }
  | { type: 'ADD_MESSAGE'; payload: Message }
  | { type: 'UPDATE_MESSAGE'; payload: Message }
  | {
      type: 'UPDATE_MESSAGE_REACTIONS';
      payload: {
        messageId: number;
        reactions: any;
        action: string;
        emoji: string;
        userId: number;
      };
    }
  | {
      type: 'UPDATE_MESSAGE_THREAD_INFO';
      payload: {
        messageId: number;
        threadCount: number;
        lastThreadMessageAt: string;
      };
    }
  | {
      type: 'REMOVE_MESSAGE';
      payload: { channelId: number; messageId: number };
    }
  | {
      type: 'PREPEND_MESSAGES';
      payload: { channelId: number; messages: Message[] };
    }
  | { type: 'SET_USERS'; payload: User[] }
  | { type: 'UPDATE_USER'; payload: User }
  | { type: 'SET_CURRENT_USER'; payload: User }
  | {
      type: 'SET_TYPING_USERS';
      payload: { channelId: number; users: TypingIndicator[] };
    }
  | { type: 'ADD_TYPING_USER'; payload: TypingIndicator }
  | {
      type: 'REMOVE_TYPING_USER';
      payload: { channelId: number; userId: number };
    }
  | { type: 'ADD_THREAD_TYPING_USER'; payload: TypingIndicator }
  | {
      type: 'REMOVE_THREAD_TYPING_USER';
      payload: { threadId: number; userId: number };
    }
  | { type: 'REFRESH_CHANNELS' }
  | { type: 'SET_PENDING_INVITATIONS_COUNT'; payload: number }
  | { type: 'SET_ERROR'; payload: string | null };

// Reducer
const chatReducer = (state: ChatState, action: ChatAction): ChatState => {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };

    case 'SET_LOADING_STAGE':
      return { ...state, loadingStage: action.payload };

    case 'SET_LOADING_START_TIME':
      return { ...state, loadingStartTime: action.payload };

    case 'SET_CONNECTED':
      return { ...state, isConnected: action.payload };

    case 'SET_CHANNELS':
      return { ...state, channels: action.payload };

    case 'ADD_CHANNEL':
      return {
        ...state,
        channels: [...state.channels, action.payload],
      };

    case 'UPDATE_CHANNEL':
      return {
        ...state,
        channels: state.channels.map((channel) =>
          channel.id === action.payload.id ? action.payload : channel
        ),
      };

    case 'REMOVE_CHANNEL':
      return {
        ...state,
        channels: state.channels.filter((channel) => channel.id !== action.payload),
        currentChannelId: state.currentChannelId === action.payload ? null : state.currentChannelId,
      };

    case 'SET_CURRENT_CHANNEL':
      return { ...state, currentChannelId: action.payload };

    case 'SET_MESSAGES':
      const newMessagesState = {
        ...state.messages,
        [action.payload.channelId]: action.payload.messages,
      };
      // 메시지 Status 변경 시 localStorage에 Save
      saveCachedMessages(newMessagesState);
      return {
        ...state,
        messages: newMessagesState,
      };

    case 'ADD_MESSAGE':
      const channelId = action.payload.channelId;
      const currentMessages = state.messages[channelId] || [];

      console.log('🔄 ADD_MESSAGE reducer:', {
        messageId: action.payload.id,
        channelId,
        currentMessagesCount: currentMessages.length,
        payload: action.payload,
      });

      // 중복 메시지 방지
      const messageExists = currentMessages.some((msg) => msg.id === action.payload.id);
      if (messageExists) {
        console.log('⚠️ Message already exists, skipping:', action.payload.id);
        return state;
      }

      const updatedMessages = {
        ...state.messages,
        [channelId]: [...currentMessages, action.payload],
      };

      console.log('✅ Message added successfully:', {
        messageId: action.payload.id,
        channelId,
        newMessagesCount: updatedMessages[channelId].length,
      });

      // 새 메시지 추가 시 localStorage에 Save
      saveCachedMessages(updatedMessages);

      return {
        ...state,
        messages: updatedMessages,
      };

    case 'UPDATE_MESSAGE':
      const updateChannelId = action.payload.channelId;
      const updatedChannelMessages = (state.messages[updateChannelId] || []).map((msg) =>
        msg.id === action.payload.id ? action.payload : msg
      );
      return {
        ...state,
        messages: {
          ...state.messages,
          [updateChannelId]: updatedChannelMessages,
        },
      };

    case 'UPDATE_MESSAGE_REACTIONS':
      // 모든 채널에서 해당 메시지를 찾아 리액션 정보 업데이트
      const updatedMessagesWithReactions = { ...state.messages };

      for (const channelId in updatedMessagesWithReactions) {
        updatedMessagesWithReactions[channelId] = updatedMessagesWithReactions[channelId].map(
          (msg) => {
            if (msg.id === action.payload.messageId) {
              return {
                ...msg,
                reactions: action.payload.reactions,
              };
            }
            return msg;
          }
        );
      }

      return {
        ...state,
        messages: updatedMessagesWithReactions,
      };

    case 'REMOVE_MESSAGE':
      const removeChannelId = action.payload.channelId;
      const filteredMessages = (state.messages[removeChannelId] || []).filter(
        (msg) => msg.id !== action.payload.messageId
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

      // 이전 메시지 추가 시 localStorage에 Save
      saveCachedMessages(prependedMessages);

      return {
        ...state,
        messages: prependedMessages,
      };

    case 'UPDATE_MESSAGE_THREAD_INFO':
      console.log('🔍 UPDATE_MESSAGE_THREAD_INFO reducer called:', action.payload);

      // 모든 채널에서 해당 메시지를 찾아 스레드 정보 업데이트
      const updatedMessagesWithThreadInfo = { ...state.messages };
      let messageFound = false;

      for (const channelId in updatedMessagesWithThreadInfo) {
        updatedMessagesWithThreadInfo[channelId] = updatedMessagesWithThreadInfo[channelId].map(
          (msg) => {
            if (msg.id === action.payload.messageId) {
              messageFound = true;
              console.log('🔍 Found message to update:', {
                messageId: msg.id,
                oldThreadCount: msg.threadCount,
                newThreadCount: action.payload.threadCount,
                oldLastThreadMessageAt: msg.lastThreadMessageAt,
                newLastThreadMessageAt: action.payload.lastThreadMessageAt,
              });
              return {
                ...msg,
                threadCount: action.payload.threadCount,
                lastThreadMessageAt: action.payload.lastThreadMessageAt,
              };
            }
            return msg;
          }
        );
      }

      console.log('🔍 Message found for thread update:', messageFound);
      if (!messageFound) {
        console.warn('⚠️ Message not found for thread update:', action.payload.messageId);
      }

      return {
        ...state,
        messages: updatedMessagesWithThreadInfo,
      };

    case 'SET_USERS':
      // Safety check: ensure payload is an array
      if (!Array.isArray(action.payload)) {
        console.error('❌ SET_USERS payload is not an array:', action.payload);
        return state;
      }

      const usersMap = action.payload.reduce(
        (acc, user) => {
          acc[user.id] = user;
          return acc;
        },
        {} as Record<number, User>
      );
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
      const existingIndex = currentTypingUsers.findIndex((u) => u.userId === action.payload.userId);

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
        (u) => u.userId !== action.payload.userId
      );
      return {
        ...state,
        typingUsers: {
          ...state.typingUsers,
          [removeTypingChannelId]: filteredTypingUsers,
        },
      };

    case 'ADD_THREAD_TYPING_USER':
      const threadId = action.payload.threadId;
      if (!threadId) return state;

      const currentThreadTypingUsers = state.threadTypingUsers[threadId] || [];
      const existingThreadIndex = currentThreadTypingUsers.findIndex(
        (u) => u.userId === action.payload.userId
      );

      if (existingThreadIndex >= 0) {
        // Update existing typing indicator
        const updatedThreadTypingUsers = [...currentThreadTypingUsers];
        updatedThreadTypingUsers[existingThreadIndex] = action.payload;
        return {
          ...state,
          threadTypingUsers: {
            ...state.threadTypingUsers,
            [threadId]: updatedThreadTypingUsers,
          },
        };
      } else {
        // Add new typing indicator
        return {
          ...state,
          threadTypingUsers: {
            ...state.threadTypingUsers,
            [threadId]: [...currentThreadTypingUsers, action.payload],
          },
        };
      }

    case 'REMOVE_THREAD_TYPING_USER':
      const removeThreadId = action.payload.threadId;
      const filteredThreadTypingUsers = (state.threadTypingUsers[removeThreadId] || []).filter(
        (u) => u.userId !== action.payload.userId
      );
      return {
        ...state,
        threadTypingUsers: {
          ...state.threadTypingUsers,
          [removeThreadId]: filteredThreadTypingUsers,
        },
      };

    case 'REFRESH_CHANNELS':
      // 채널 목록 Refresh을 위한 플래그 Settings
      return {
        ...state,
        isLoading: true, // Refresh 중임을 표시
      };

    case 'SET_PENDING_INVITATIONS_COUNT':
      return {
        ...state,
        pendingInvitationsCount: action.payload,
      };

    case 'SET_ERROR':
      return {
        ...state,
        error: action.payload,
      };

    default:
      return state;
  }
};

// Context
const ChatContext = createContext<ChatContextType | null>(null);

// Provider component
export const ChatProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(chatReducer, undefined, createInitialState);
  const { user, getToken } = useAuth();
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const wsService = getChatWebSocketService(getToken);

  // 디버깅: 초기 Status Confirm (한 번만 실행)
  useEffect(() => {
    console.log(
      '🚀 ChatProvider initialized with messages:',
      Object.keys(state.messages).map((k) => `${k}: ${state.messages[parseInt(k)].length} messages`)
    );
  }, []); // 빈 의존성 배열로 한 번만 실행

  // 페이지 전환 시 메시지 Status 보존을 위한 ref
  const isInitializedRef = useRef(false);

  // markAsRead Request 추적을 위한 ref
  const markAsReadRequestsRef = useRef<Set<string>>(new Set());
  // 채널별 최초 Refresh 여부 (Cache → 서버 메타데이터 동기화)
  const refreshedChannelsRef = useRef<Set<number>>(new Set());
  // Track in-flight message loads to avoid duplicate concurrent fetches per channel
  const loadingMessagesRef = useRef<Set<number>>(new Set());

  // Helper function to find channel ID for a message
  const findChannelIdForMessage = (messageId: number): number | null => {
    for (const [channelId, messages] of Object.entries(state.messages)) {
      if (messages.some((msg) => msg.id === messageId)) {
        return parseInt(channelId);
      }
    }
    return null;
  };

  // Initialize WebSocket connection
  useEffect(() => {
    if (user && !isInitializedRef.current) {
      isInitializedRef.current = true;

      // 현재 User info를 Settings
      dispatch({ type: 'SET_CURRENT_USER', payload: user as any });

      // WebSocket 연결 함수는 이제 위에서 useCallback으로 정의됨

      // Set up WebSocket event listeners
      const setupEventListeners = () => {
        wsService.onMessageCreated((message) => {
          console.log('📨 ChatContext received message_created:', message);
          console.log('📨 Current channel ID:', state.currentChannelId);
          console.log('📨 Message channel ID:', message.channelId);

          // 🔍 메시지에 User info가 포함되어 있는지 Confirm
          console.log('🔍 Message user info check:', {
            hasMessageUser: !!message.user,
            messageUser: message.user,
            userId: message.userId,
            hasUserInState: !!state.users[message.userId],
          });

          // 메시지에 User info가 포함되어 있으면 Used
          if (message.user && message.userId) {
            console.log('✅ Using user info from message:', message.user);
            dispatch({
              type: 'SET_USERS',
              payload: [
                {
                  id: message.userId,
                  username: message.user.name || message.user.username || `User${message.userId}`,
                  name: message.user.name || `User${message.userId}`,
                  email: message.user.email || `user${message.userId}@example.com`,
                  avatarUrl: message.user.avatarUrl || DEFAULT_AVATAR_URL,
                  isOnline: true,
                  lastSeen: new Date().toISOString(),
                },
              ],
            });
          }
          // 메시지에 User info가 없고 state에도 없으면 fallback Used
          else if (message.userId && !state.users[message.userId]) {
            console.log('⚠️ Using fallback user data for userId:', message.userId);
            dispatch({
              type: 'SET_USERS',
              payload: [
                {
                  id: message.userId,
                  username: `User${message.userId}`,
                  name: `User${message.userId}`,
                  email: `user${message.userId}@example.com`,
                  avatarUrl: `https://ui-avatars.com/api/?name=User${message.userId}&background=random`,
                  isOnline: true,
                  lastSeen: new Date().toISOString(),
                },
              ],
            });
          }

          dispatch({ type: 'ADD_MESSAGE', payload: message });
        });

        wsService.onMessageUpdated((message) => {
          dispatch({ type: 'UPDATE_MESSAGE', payload: message });
        });

        // 스레드 메시지 Create Event 리스너
        wsService.on('thread_message_created', (data) => {
          console.log('🧵 Thread message created:', data);
          // 스레드 메시지는 메인 채팅에 추가하지 않음
          // ThreadView 컴포넌트에서 별도로 처리
        });

        // 스레드 정보 업데이트 Event 리스너
        wsService.on('thread_updated', (data) => {
          console.log('🧵 Thread updated:', data);

          // 다양한 래핑 케이스를 All 처리
          // 1) data.data.data (현재 구조)
          // 2) data.data (정규화된 구조)
          // 3) data (직접 전달된 구조)
          const threadInfo = (data && data.data && data.data.data) || (data && data.data) || data;
          console.log('🔍 Resolved threadInfo:', threadInfo);

          const messageId = threadInfo?.messageId;
          const threadCount = threadInfo?.threadCount;
          const lastThreadMessageAt = threadInfo?.lastThreadMessageAt;

          console.log('🔍 Extracted thread info:', {
            messageId,
            threadCount,
            lastThreadMessageAt,
          });

          if (messageId != null) {
            // 원본 메시지의 스레드 정보 업데이트
            dispatch({
              type: 'UPDATE_MESSAGE_THREAD_INFO',
              payload: {
                messageId,
                threadCount: threadCount ?? 0,
                lastThreadMessageAt: lastThreadMessageAt ?? (null as any),
              },
            });
          } else {
            console.error('❌ Could not resolve messageId from thread_updated payload');
          }
        });

        // 리액션 업데이트 Event 리스너
        wsService.on('message_reaction_updated', (data) => {
          console.log('🔍 Message reaction updated:', data);

          // 메시지 리액션 정보를 업데이트
          const reactionData = data.data || data; // data.data 또는 data 직접 Used
          dispatch({
            type: 'UPDATE_MESSAGE_REACTIONS',
            payload: {
              messageId: reactionData.messageId,
              reactions: reactionData.reactions,
              action: reactionData.action,
              emoji: reactionData.emoji,
              userId: reactionData.userId,
            },
          });
        });

        // 연결 Status Event 리스너
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
          dispatch({ type: 'SET_ERROR', payload: t('chat.connectionLost') });
        });

        wsService.on('connection_error', (event) => {
          console.error('WebSocket connection error:', event);
          dispatch({ type: 'SET_CONNECTED', payload: false });
          dispatch({ type: 'SET_ERROR', payload: t('chat.connectionError') });
        });

        wsService.on('connection_failed', (event) => {
          console.error('WebSocket connection failed permanently:', event);
          dispatch({ type: 'SET_CONNECTED', payload: false });
          dispatch({
            type: 'SET_ERROR',
            payload: t('chat.serviceUnavailable'),
          });
        });

        wsService.on('authentication_failed', async (event) => {
          console.error('WebSocket authentication failed:', event);
          dispatch({ type: 'SET_CONNECTED', payload: false });

          try {
            // Refresh token 시도
            await AuthService.refreshToken();

            console.log('✅ Token refreshed, reconnecting WebSocket...');

            // WebSocket 재연결
            setTimeout(() => {
              wsService.connect();
            }, 1000);
          } catch (refreshError) {
            console.error('❌ Token refresh failed:', refreshError);
            dispatch({
              type: 'SET_ERROR',
              payload: t('chat.authenticationFailed'),
            });
          }
        });

        // 메시지 Delete Event 리스너
        wsService.onMessageDeleted((messageId) => {
          // Find the channel for this message
          const channelId = findChannelIdForMessage(messageId);
          if (channelId) {
            dispatch({
              type: 'REMOVE_MESSAGE',
              payload: { channelId, messageId },
            });
          }
        });

        // 타이핑 Event 리스너
        wsService.onUserTyping((typing) => {
          dispatch({ type: 'ADD_TYPING_USER', payload: typing });
          // 5초 후 자동으로 타이핑 인디케이터 제거 (백업 안전장치)
          setTimeout(() => {
            dispatch({
              type: 'REMOVE_TYPING_USER',
              payload: { channelId: typing.channelId, userId: typing.userId },
            });
          }, 5000);
        });
      };

      setupEventListeners();
      // 초기 채널 로딩 시작 (Used자 동기화 + WebSocket 연결 + 채널 로딩)
      loadChannels();

      wsService.onUserStopTyping((typing) => {
        dispatch({
          type: 'REMOVE_TYPING_USER',
          payload: { channelId: typing.channelId, userId: typing.userId },
        });
      });

      // 스레드 타이핑 Event 리스너
      wsService.onUserTypingThread((typing) => {
        dispatch({ type: 'ADD_THREAD_TYPING_USER', payload: typing });
        // 5초 후 자동으로 타이핑 인디케이터 제거 (백업 안전장치)
        setTimeout(() => {
          if (typing.threadId) {
            dispatch({
              type: 'REMOVE_THREAD_TYPING_USER',
              payload: { threadId: typing.threadId, userId: typing.userId },
            });
          }
        }, 5000);
      });

      wsService.onUserStopTypingThread((typing) => {
        if (typing.threadId) {
          dispatch({
            type: 'REMOVE_THREAD_TYPING_USER',
            payload: { threadId: typing.threadId, userId: typing.userId },
          });
        }
      });

      wsService.onUserOnline((user) => {
        dispatch({ type: 'UPDATE_USER', payload: { ...user, isOnline: true } });
      });

      wsService.onUserOffline((user) => {
        dispatch({
          type: 'UPDATE_USER',
          payload: { ...user, isOnline: false },
        });
      });

      // Used자 채널 참여 Event 리스너
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

          dispatch({ type: 'ADD_MESSAGE', payload: systemMessage as any });
        }

        // 채널 목록 Refresh (멤버 수 업데이트)
        dispatch({ type: 'REFRESH_CHANNELS' });
      });

      // 초대 Response Event 리스너 (초대한 사람에게만 표시)
      wsService.on('invitation_response', (event) => {
        console.log('📨 Invitation response received in ChatContext:', event);
        const { data } = event;

        // 백엔드에서 inviterId에게만 전송하므로, 이 Event를 받은 사람은 초대한 사람임
        // 따라서 조건 없이 메시지 표시
        if (user) {
          if (data.action === 'accept') {
            enqueueSnackbar(t('chat.invitationAccepted', { inviteeName: data.inviteeName }), {
              variant: 'success',
            });
          } else {
            enqueueSnackbar(t('chat.invitationDeclined', { inviteeName: data.inviteeName }), {
              variant: 'info',
            });
          }
        }

        // 채널 목록 Refresh
        dispatch({ type: 'REFRESH_CHANNELS' });
      });

      // 채널 초대 Event 리스너
      wsService.on('channel_invitation', (event) => {
        console.log('📨 Channel invitation received in ChatContext:', event);
        const { data } = event;

        // 초대 수 증가
        dispatch({
          type: 'SET_PENDING_INVITATIONS_COUNT',
          payload: state.pendingInvitationsCount + 1,
        });

        // 토스트 Notification 표시 (백엔드 메시지가 있으면 Used, 없으면 기본 Translation 메시지 사용)
        const displayMessage =
          data.message ||
          t('chat.invitationReceived', {
            inviterName: data.inviterName,
            channelName: data.channelName,
          });

        enqueueSnackbar(displayMessage, {
          variant: 'info',
          autoHideDuration: 30000, // 30초 후 자동 닫힘
          action: (key) => (
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={async () => {
                  try {
                    const token = localStorage.getItem('accessToken');
                    if (token) {
                      apiService.setAccessToken(token);
                    }

                    const response = await apiService.post(
                      `/chat/invitations/${data.invitationId}/respond`,
                      {
                        action: 'accept',
                      }
                    );

                    if (response.success) {
                      // 토스트 제거 - 채널 진입으로 충분
                      // 초대 수 감소
                      dispatch({
                        type: 'SET_PENDING_INVITATIONS_COUNT',
                        payload: Math.max(0, state.pendingInvitationsCount - 1),
                      });
                      // 채널 목록 Refresh 후 해당 채널로 이동
                      await loadChannels();
                      if ((response as any).channelId) {
                        console.log(
                          '🎉 Invitation accepted, switching to channel:',
                          (response as any).channelId
                        );
                        dispatch({
                          type: 'SET_CURRENT_CHANNEL',
                          payload: (response as any).channelId,
                        });
                      }
                    } else {
                      enqueueSnackbar(t('chat.invitationAcceptFailed'), {
                        variant: 'error',
                      });
                    }
                  } catch (error) {
                    console.error('Failed to accept invitation:', error);
                    enqueueSnackbar(t('chat.invitationAcceptFailed'), {
                      variant: 'error',
                    });
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
                  fontSize: '12px',
                }}
              >
                {t('chat.accept')}
              </button>
              <button
                onClick={async () => {
                  try {
                    const token = localStorage.getItem('accessToken');
                    if (token) {
                      apiService.setAccessToken(token);
                    }

                    const response = await apiService.post(
                      `/chat/invitations/${data.invitationId}/respond`,
                      {
                        action: 'decline',
                      }
                    );

                    if (response.success) {
                      enqueueSnackbar(t('chat.invitationDeclined'), {
                        variant: 'info',
                      });
                      // 초대 수 감소
                      dispatch({
                        type: 'SET_PENDING_INVITATIONS_COUNT',
                        payload: Math.max(0, state.pendingInvitationsCount - 1),
                      });
                    } else {
                      enqueueSnackbar(t('chat.invitationDeclineFailed'), {
                        variant: 'error',
                      });
                    }
                  } catch (error) {
                    console.error('Failed to decline invitation:', error);
                    enqueueSnackbar(t('chat.invitationDeclineFailed'), {
                      variant: 'error',
                    });
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
                  fontSize: '12px',
                }}
              >
                {t('chat.decline')}
              </button>
            </div>
          ),
        });
      });

      return () => {
        // Event 리스너 Cleanup
        wsService.removeAllListeners();
        wsService.disconnect();
        dispatch({ type: 'SET_CONNECTED', payload: false });
      };
    }
  }, [user?.id]); // user 객체 전체가 아닌 id만 의존성으로 Used

  // Load messages for a channel - 깜빡임 방지를 위해 Loading state Settings 제거
  const loadMessages = useCallback(
    async (channelId: number, forceReload = false) => {
      // Prevent concurrent loads for the same channel
      if (loadingMessagesRef.current.has(channelId)) {
        console.log('⏳ loadMessages already in progress, skipping:', channelId);
        return;
      }
      loadingMessagesRef.current.add(channelId);
      try {
        console.log('🔄 loadMessages called for channel:', channelId, 'forceReload:', forceReload);
        console.log('📊 Current messages state:', state.messages);

        // 강제 리로드가 아니고 이미 메시지가 있고, 해당 채널이 이번 세션에서 한 번 이상 Refresh 되었으면 스킵
        if (
          !forceReload &&
          state.messages[channelId] &&
          state.messages[channelId].length > 0 &&
          refreshedChannelsRef.current.has(channelId)
        ) {
          console.log(
            'Messages already loaded and refreshed for channel:',
            channelId,
            'count:',
            state.messages[channelId].length
          );
          return;
        }

        // Current state에서 Cache된 메시지 Confirm
        const currentCachedMessages = loadCachedMessages();
        const cachedMessages = currentCachedMessages[channelId];

        if (!forceReload && cachedMessages && cachedMessages.length > 0) {
          console.log('Using cached messages:', cachedMessages.length);
          // Cache된 메시지를 먼저 Status에 Settings (빠른 렌더링)
          dispatch({
            type: 'SET_MESSAGES',
            payload: { channelId, messages: cachedMessages },
          });

          // 1) 최신 추가 메시지만 Confirm (after)
          try {
            const latestCachedMessage = cachedMessages[cachedMessages.length - 1];
            const incremental = await ChatService.getMessages({
              channelId,
              limit: 20, // 최신 20개만 Confirm
              after: latestCachedMessage.id?.toString(), // 마지막 Cache된 메시지 이후만 (string)
            });

            if (incremental.messages.length > 0) {
              console.log('Found new messages:', incremental.messages.length);
              // 새 메시지가 있으면 추가
              incremental.messages.forEach((message) => {
                dispatch({ type: 'ADD_MESSAGE', payload: message });
              });
            }
          } catch (serverError) {
            console.warn('Failed incremental fetch, will still do full refresh:', serverError);
          }

          // 2) 메타데이터(threadCount 등) 최신화를 위해 전체 갱신(fetch fresh)
          try {
            const fresh = await ChatService.getMessages({
              channelId,
              limit: 50,
            });
            console.log(
              'Refreshed messages from server (to update metadata):',
              fresh.messages.length
            );
            dispatch({
              type: 'SET_MESSAGES',
              payload: { channelId, messages: fresh.messages },
            });
            refreshedChannelsRef.current.add(channelId);
          } catch (refreshError) {
            console.warn('Failed to refresh full message list:', refreshError);
          }
          return;
        }

        // Cache된 메시지가 없거나 강제 리로드인 경우 서버에서 로딩
        const result = await ChatService.getMessages({
          channelId,
          limit: 50, // 최근 50개 메시지만 로딩
        });
        console.log('Loaded messages from server:', result.messages.length);
        console.log('🔍 First message reactions check:', {
          firstMessage: result.messages[0],
          hasReactions: result.messages[0]?.reactions,
          reactionsLength: result.messages[0]?.reactions?.length,
        });
        dispatch({
          type: 'SET_MESSAGES',
          payload: { channelId, messages: result.messages },
        });
        refreshedChannelsRef.current.add(channelId);
      } catch (error: any) {
        console.error('Failed to load messages for channel', channelId, ':', error);
        dispatch({
          type: 'SET_ERROR',
          payload: error.message || t('chat.loadMessagesFailed'),
        });
      } finally {
        loadingMessagesRef.current.delete(channelId);
      }
    },
    [state.messages, t]
  );

  // REFRESH_CHANNELS 액션 처리
  useEffect(() => {
    if (state.isLoading && state.channels.length === 0) {
      // 초기 로딩이 아닌 경우에만 Refresh
      return;
    }

    if (state.isLoading) {
      // REFRESH_CHANNELS 액션으로 인한 Loading state인 경우 채널 Refresh
      loadChannels();
    }
  }, [state.isLoading]);

  // Load pending invitations count
  const loadPendingInvitationsCount = useCallback(async () => {
    try {
      // Ensure we have a token before making the request
      const token = localStorage.getItem('accessToken');
      if (!token) {
        console.error('❌ No access token available for loading invitations');
        return;
      }

      // Ensure API service has the token
      apiService.setAccessToken(token);

      console.log('🔄 Loading pending invitations count...');
      const response = await apiService.get('/chat/invitations/received', {
        params: { status: 'pending' },
      });

      if (response.success && response.data) {
        const count = response.data.pagination?.total || 0;
        dispatch({ type: 'SET_PENDING_INVITATIONS_COUNT', payload: count });
        console.log('✅ Pending invitations count loaded:', count);
      }
    } catch (error: any) {
      console.error('❌ Failed to load pending invitations count:', error);
      if (error.status === 401) {
        console.error('❌ Authentication error - token may be invalid');
        console.log('🔄 Attempting to sync user to Chat Server...');

        // Chat Server 동기화 시도
        try {
          await apiService.post('/chat/sync-user');
          console.log('✅ User synced to Chat Server, retrying invitations...');

          // 동기화 후 재시도
          setTimeout(() => {
            loadPendingInvitationsCount();
          }, 1000);
        } catch (syncError) {
          console.error('❌ Failed to sync user to Chat Server:', syncError);
          // 동기화 Failed해도 앱은 계속 동작하도록 함
          dispatch({ type: 'SET_PENDING_INVITATIONS_COUNT', payload: 0 });
        }
      } else {
        // 다른 오류의 경우 Set default values
        dispatch({ type: 'SET_PENDING_INVITATIONS_COUNT', payload: 0 });
      }
    }
  }, []);

  // Load users
  const loadUsers = useCallback(async () => {
    try {
      // Ensure we have a token before making the request
      const token = localStorage.getItem('accessToken');
      if (!token) {
        console.error('❌ No access token available for loading users');
        return;
      }

      // Ensure API service has the token
      const { apiService } = await import('../services/api');
      apiService.setAccessToken(token);

      console.log('🔄 Loading users from API...');
      const users = await ChatService.getUsers();
      console.log('✅ Users loaded:', users.length);

      if (Array.isArray(users)) {
        dispatch({ type: 'SET_USERS', payload: users });
        console.log('✅ Users dispatched successfully');
      } else {
        console.error('❌ Users data is not an array:', users);
      }
    } catch (error: any) {
      console.error('❌ Failed to load users:', error);
      if (error.status === 401) {
        console.error('❌ Authentication error - token may be invalid');
      }
    }
  }, []);

  // Load channels
  // WebSocket 연결 함수를 별도로 분리
  const connectWebSocket = useCallback(async () => {
    try {
      // Authentication 토큰 Confirm
      const token = localStorage.getItem('accessToken');
      if (!token) {
        console.error('No authentication token found in localStorage');
        dispatch({ type: 'SET_ERROR', payload: t('auth.loginRequired') });
        return;
      }

      console.log('🔗 Using existing JWT token for WebSocket connection');

      // Ensure API service has the token
      apiService.setAccessToken(token);

      await wsService.connect();
      console.log('✅ WebSocket connected successfully');
      dispatch({ type: 'SET_CONNECTED', payload: true });
    } catch (error) {
      console.error('❌ Failed to connect to chat WebSocket:', error);
      dispatch({ type: 'SET_ERROR', payload: t('chat.connectionFailed') });
    }
  }, [enqueueSnackbar, t]);

  const loadChannels = useCallback(async () => {
    console.log('🔄 loadChannels() called');
    try {
      const startTime = Date.now();
      // 깜빡임 방지를 위해 Loading state Settings 제거
      // dispatch({ type: 'SET_LOADING', payload: true });
      // dispatch({ type: 'SET_LOADING_STAGE', payload: 'syncing' });
      // dispatch({ type: 'SET_LOADING_START_TIME', payload: startTime });
      console.log(
        '🔍 Loading state set: isLoading=false (to prevent flashing), stage=syncing, startTime=',
        startTime
      );

      // 먼저 Used자를 Chat Server에 동기화
      try {
        console.log('🔄 Syncing current user to Chat Server...');
        await ChatService.syncCurrentUser();
        console.log('✅ User synced to Chat Server successfully');

        // Used자 동기화 완료 후 WebSocket 연결
        // dispatch({ type: 'SET_LOADING_STAGE', payload: 'connecting' });
        console.log('🔄 Connecting to WebSocket after user sync...');
        await connectWebSocket();
        console.log('✅ WebSocket connected after user sync');
      } catch (error) {
        console.error('❌ Failed to sync user to Chat Server:', error);
        // 동기화 Failed해도 채팅은 계속 진행
      }

      // dispatch({ type: 'SET_LOADING_STAGE', payload: 'loading_channels' });
      console.log('🔄 Loading channels from API...');
      const channels = await ChatService.getChannels();
      console.log('✅ Channels loaded:', channels);
      dispatch({ type: 'SET_CHANNELS', payload: channels });

      // Used자 데이터와 초대 수도 함께 로드 (개별 오류 처리)
      await Promise.allSettled([
        loadUsers().catch((error) => console.error('❌ Failed to load users:', error)),
        loadPendingInvitationsCount().catch((error) =>
          console.error('❌ Failed to load invitations:', error)
        ),
      ]);

      // 마지막 참여 채널 자동 선택
      const lastChannelId = localStorage.getItem('lastChannelId');
      if (lastChannelId && channels.length > 0) {
        const lastChannel = channels.find((c) => c.id === parseInt(lastChannelId));
        if (lastChannel) {
          console.log('Auto-selecting last channel:', lastChannel.name, 'ID:', lastChannel.id);
          // 채널 선택 + 메시지 로딩 + WS join
          dispatch({ type: 'SET_CURRENT_CHANNEL', payload: lastChannel.id });
          localStorage.setItem('lastChannelId', lastChannel.id.toString());
          // Force initial load to avoid empty message state on first mount
          loadMessages(lastChannel.id, true);
          wsService.joinChannel(lastChannel.id);
        }
      }
    } catch (error: any) {
      const errorMessage = error.message || 'Failed to load channels';
      console.error('❌ Failed to load channels:', errorMessage);
      dispatch({ type: 'SET_ERROR', payload: errorMessage });
    } finally {
      // 깜빡임 방지를 위해 로딩 지연 제거 - 즉시 완료 처리
      const finishLoading = () => {
        // dispatch({ type: 'SET_LOADING', payload: false });
        // dispatch({ type: 'SET_LOADING_STAGE', payload: 'complete' });
        // dispatch({ type: 'SET_LOADING_START_TIME', payload: null });
        console.log('🔍 Loading completed immediately (no delay for smooth UX)');
      };

      // 즉시 완료 처리
      finishLoading();
    }
  }, [connectWebSocket, loadMessages, loadUsers, loadPendingInvitationsCount]);
  // Debounced loader for channel switch (prevent burst loads)
  const debouncedLoadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleLoadMessages = useCallback(
    (cid: number) => {
      if (debouncedLoadTimerRef.current) {
        clearTimeout(debouncedLoadTimerRef.current as any);
      }
      debouncedLoadTimerRef.current = setTimeout(() => {
        loadMessages(cid, true);
      }, 200);
    },
    [loadMessages]
  );

  useEffect(() => {
    return () => {
      if (debouncedLoadTimerRef.current) {
        clearTimeout(debouncedLoadTimerRef.current as any);
      }
    };
  }, []);

  // Actions
  const actions: ChatContextType['actions'] = {
    setCurrentChannel: (channelId) => {
      const previousChannelId = state.currentChannelId;
      dispatch({ type: 'SET_CURRENT_CHANNEL', payload: channelId });

      // 마지막 채널 ID Save
      if (channelId) {
        localStorage.setItem('lastChannelId', channelId.toString());
        console.log('Saved last channel ID:', channelId);

        // 채널이 실제로 변경된 경우에만 메시지 로딩 - 깜빡임 방지를 위해 setTimeout 제거
        if (previousChannelId !== channelId) {
          console.log(
            '✅ Channel changed from',
            previousChannelId,
            'to',
            channelId,
            '- loading messages'
          );
          // Force reload via debounced scheduler to prevent burst loads
          scheduleLoadMessages(channelId);
        } else {
          console.log('⏭️ Same channel selected, skipping message load');
        }

        // WebSocket 채널 참여
        wsService.joinChannel(channelId);
      } else {
        localStorage.removeItem('lastChannelId');
      }
    },

    sendMessage: async (channelId, messageData) => {
      console.log('🚀 ChatContext.sendMessage called:', {
        channelId,
        messageData,
        ChatService: ChatService,
      });

      try {
        console.log('📡 Calling ChatService.sendMessage...');
        const message = await ChatService.sendMessage(channelId, messageData);
        console.log('✅ ChatService.sendMessage success:', message);
        // Message will be added via WebSocket event
        return message;
      } catch (error: any) {
        console.error('❌ ChatService.sendMessage error:', error);
        dispatch({
          type: 'SET_ERROR',
          payload: error.message || t('chat.sendMessageFailed'),
        });
        throw error;
      }
    },

    editMessage: async (messageId, content) => {
      try {
        const message = await ChatService.updateMessage(messageId, { content });
        // Message will be updated via WebSocket event
        return message;
      } catch (error: any) {
        dispatch({
          type: 'SET_ERROR',
          payload: error.message || 'Failed to edit message',
        });
        throw error;
      }
    },

    deleteMessage: async (messageId) => {
      try {
        await ChatService.deleteMessage(messageId);
        // Message will be removed via WebSocket event
      } catch (error: any) {
        dispatch({
          type: 'SET_ERROR',
          payload: error.message || 'Failed to delete message',
        });
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
          stack: error.stack,
        });
        dispatch({
          type: 'SET_ERROR',
          payload: error.message || 'Failed to create channel',
        });
        throw error;
      }
    },

    updateChannel: async (channelId, updates) => {
      try {
        const channel = await ChatService.updateChannel(channelId, updates);
        dispatch({ type: 'UPDATE_CHANNEL', payload: channel });
        return channel;
      } catch (error: any) {
        dispatch({
          type: 'SET_ERROR',
          payload: error.message || 'Failed to update channel',
        });
        throw error;
      }
    },

    joinChannel: async (channelId) => {
      try {
        await ChatService.joinChannel(channelId);
        wsService.joinChannel(channelId);
        // 깜빡임 방지를 위해 전체 채널 목록 재갱신 제거
        // await loadChannels(); // Refresh channels
      } catch (error: any) {
        dispatch({
          type: 'SET_ERROR',
          payload: error.message || 'Failed to join channel',
        });
        throw error;
      }
    },

    leaveChannel: async (channelId) => {
      try {
        await ChatService.leaveChannel(channelId);
        wsService.leaveChannel(channelId);
        dispatch({ type: 'REMOVE_CHANNEL', payload: channelId });
      } catch (error: any) {
        dispatch({
          type: 'SET_ERROR',
          payload: error.message || 'Failed to leave channel',
        });
        throw error;
      }
    },

    addReaction: async (messageId, emoji) => {
      try {
        await ChatService.addReaction(messageId, emoji);
        // Reaction will be updated via WebSocket event
      } catch (error: any) {
        dispatch({
          type: 'SET_ERROR',
          payload: error.message || 'Failed to add reaction',
        });
        throw error;
      }
    },

    removeReaction: async (messageId, emoji) => {
      try {
        await ChatService.removeReaction(messageId, emoji);
        // Reaction will be updated via WebSocket event
      } catch (error: any) {
        dispatch({
          type: 'SET_ERROR',
          payload: error.message || 'Failed to remove reaction',
        });
        throw error;
      }
    },

    markAsRead: async (channelId, messageId) => {
      try {
        // Request 키 Create
        const requestKey = `${channelId}_${messageId || 'latest'}`;

        // 이미 진행 중인 Request이 있으면 스킵
        if (markAsReadRequestsRef.current.has(requestKey)) {
          console.log(`⏭️ Skipping duplicate markAsRead request for channel ${channelId}`);
          return;
        }

        // 디바운스를 위한 키 Create
        const debounceKey = `markAsRead_${requestKey}`;

        // Existing 타임아웃 Cancel
        if ((window as any)[debounceKey]) {
          clearTimeout((window as any)[debounceKey]);
        }

        // 5초 후에 실행 (디바운스 시간 대폭 증가)
        (window as any)[debounceKey] = setTimeout(async () => {
          // Request 시작 표시
          markAsReadRequestsRef.current.add(requestKey);

          try {
            await ChatService.markAsRead(channelId, messageId);
            console.log(`✅ Marked channel ${channelId} as read`);
          } catch (error: any) {
            // 네트워크 오류나 타임아웃은 조용히 처리
            if (error.code === 'ECONNABORTED' || error.status >= 500 || error.status === 408) {
              console.warn(
                `⚠️ Mark as read failed for channel ${channelId} (network/server issue):`,
                error.message || error
              );

              // 네트워크 오류인 경우 5초 후 재시도
              setTimeout(() => {
                console.log(`🔄 Retrying markAsRead for channel ${channelId}`);
                actions.markAsRead(channelId, messageId);
              }, 5000);
            } else {
              console.error('Failed to mark as read:', error);
            }
          } finally {
            // Request 완료 표시
            markAsReadRequestsRef.current.delete(requestKey);
            // 타임아웃 Cleanup
            delete (window as any)[debounceKey];
          }
        }, 500);
      } catch (error: any) {
        console.error('Failed to setup mark as read:', error);
      }
    },

    startTyping: (channelId, threadId) => {
      wsService.startTyping(channelId, threadId);
    },

    stopTyping: (channelId, threadId) => {
      wsService.stopTyping(channelId, threadId);
    },

    searchMessages: async (query, channelId) => {
      try {
        return await ChatService.searchMessages(query, channelId);
      } catch (error: any) {
        dispatch({
          type: 'SET_ERROR',
          payload: error.message || 'Failed to search messages',
        });
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
            payload: { channelId, messages: result.messages },
          });
        }
      } catch (error: any) {
        dispatch({
          type: 'SET_ERROR',
          payload: error.message || 'Failed to load more messages',
        });
        throw error;
      }
    },

    uploadFile: async (file, channelId) => {
      try {
        return await ChatService.uploadFile(file, channelId);
      } catch (error: any) {
        dispatch({
          type: 'SET_ERROR',
          payload: error.message || 'Failed to upload file',
        });
        throw error;
      }
    },

    inviteUser: async (channelId: number, userId: number, message?: string) => {
      try {
        await ChatService.inviteUser(channelId, userId, message);
        // 초대 Success 시 채널 멤버 목록 Refresh (필요한 경우)
        // await loadChannels();
      } catch (error: any) {
        dispatch({
          type: 'SET_ERROR',
          payload: error.message || 'Failed to invite user',
        });
        throw error;
      }
    },

    getThreadMessages: async (threadId: number) => {
      try {
        const result = await ChatService.getThreadMessages(threadId);
        return result.messages || [];
      } catch (error: any) {
        console.error('Failed to load thread messages:', error);
        dispatch({
          type: 'SET_ERROR',
          payload: error.message || 'Failed to load thread messages',
        });
        return [];
      }
    },

    clearError: () => {
      dispatch({ type: 'SET_ERROR', payload: null });
    },

    loadPendingInvitationsCount: loadPendingInvitationsCount,
  };

  // 디버깅을 위해 전역에 노출
  React.useEffect(() => {
    (window as any).chatState = state;
    (window as any).chatActions = actions;
  }, [state, actions]);

  return <ChatContext.Provider value={{ state, actions }}>{children}</ChatContext.Provider>;
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

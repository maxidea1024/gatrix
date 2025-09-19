import React, { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
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

      // 1시간 이내의 메시지만 유지
      const oneHourAgo = Date.now() - (60 * 60 * 1000);
      const filteredMessages: Record<number, Message[]> = {};

      Object.entries(parsed).forEach(([channelId, messages]) => {
        const recentMessages = (messages as Message[]).filter(msg =>
          new Date(msg.createdAt).getTime() > oneHourAgo
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

// 메시지를 로컬 스토리지에 저장
const saveCachedMessages = (messages: Record<number, Message[]>) => {
  try {
    console.log('💾 Saving messages to cache:', Object.keys(messages).map(k => `${k}: ${messages[parseInt(k)].length} messages`));
    localStorage.setItem('chatMessages', JSON.stringify(messages));
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
  error: null,
};

// Action types
type ChatAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
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
  | { type: 'REMOVE_TYPING_USER'; payload: { channelId: number; userId: number } };

// Reducer
const chatReducer = (state: ChatState, action: ChatAction): ChatState => {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    
    case 'SET_ERROR':
      return { ...state, error: action.payload };
    
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
  const wsService = getChatWebSocketService(getToken);

  // 디버깅: 초기 상태 확인
  console.log('🚀 ChatProvider initialized with messages:', Object.keys(state.messages).map(k => `${k}: ${state.messages[parseInt(k)].length} messages`));

  // Initialize WebSocket connection
  useEffect(() => {
    if (user) {
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
          dispatch({ type: 'SET_ERROR', payload: 'Failed to connect to chat service' });
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
        });

        wsService.on('connection_error', (event) => {
          console.error('WebSocket connection error:', event);
          dispatch({ type: 'SET_CONNECTED', payload: false });
        });

        wsService.on('connection_failed', (event) => {
          console.error('WebSocket connection failed permanently:', event);
          dispatch({ type: 'SET_CONNECTED', payload: false });
          dispatch({ type: 'SET_ERROR', payload: 'Chat service is unavailable. Please try again later.' });
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

      return () => {
        wsService.disconnect();
        dispatch({ type: 'SET_CONNECTED', payload: false });
      };
    }
  }, [user]);

  // Helper function to find channel ID for a message
  const findChannelIdForMessage = (messageId: number): number | null => {
    for (const [channelId, messages] of Object.entries(state.messages)) {
      if (messages.some(msg => msg.id === messageId)) {
        return parseInt(channelId);
      }
    }
    return null;
  };

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
            loadMessages(lastChannel.id);
            wsService.joinChannel(lastChannel.id);
          }, 0);
        }
      }
    } catch (error: any) {
      dispatch({ type: 'SET_ERROR', payload: error.message || 'Failed to load channels' });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, []);

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
          loadMessages(channelId);
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
        dispatch({ type: 'SET_ERROR', payload: error.message || t('chat.sendMessageFailed', '메시지 전송에 실패했습니다') });
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
        await ChatService.markAsRead(channelId, messageId);
      } catch (error: any) {
        console.error('Failed to mark as read:', error);
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

    clearError: () => {
      dispatch({ type: 'SET_ERROR', payload: null });
    },
  };

  // Select channel (used for auto-selection)
  const selectChannel = async (channelId: number) => {
    actions.setCurrentChannel(channelId);
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

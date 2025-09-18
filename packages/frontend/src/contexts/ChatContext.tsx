import React, { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
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

// Initial state
const initialState: ChatState = {
  channels: [],
  currentChannelId: null,
  messages: {},
  users: {},
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
      return {
        ...state,
        messages: {
          ...state.messages,
          [action.payload.channelId]: action.payload.messages,
        },
      };
    
    case 'ADD_MESSAGE':
      const channelId = action.payload.channelId;
      const currentMessages = state.messages[channelId] || [];
      return {
        ...state,
        messages: {
          ...state.messages,
          [channelId]: [...currentMessages, action.payload],
        },
      };
    
    case 'UPDATE_MESSAGE':
      const updateChannelId = action.payload.channelId;
      const updatedMessages = (state.messages[updateChannelId] || []).map(msg =>
        msg.id === action.payload.id ? action.payload : msg
      );
      return {
        ...state,
        messages: {
          ...state.messages,
          [updateChannelId]: updatedMessages,
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
      return {
        ...state,
        messages: {
          ...state.messages,
          [prependChannelId]: [...action.payload.messages, ...existingMessages],
        },
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
  const wsService = getChatWebSocketService(getToken);

  // Initialize WebSocket connection
  useEffect(() => {
    if (user) {
      wsService.connect()
        .then(() => {
          dispatch({ type: 'SET_CONNECTED', payload: true });
          loadChannels();
        })
        .catch((error) => {
          console.error('Failed to connect to chat WebSocket:', error);
          dispatch({ type: 'SET_ERROR', payload: 'Failed to connect to chat service' });
        });

      // Set up WebSocket event listeners
      wsService.onMessageCreated((message) => {
        dispatch({ type: 'ADD_MESSAGE', payload: message });
      });

      wsService.onMessageUpdated((message) => {
        dispatch({ type: 'UPDATE_MESSAGE', payload: message });
      });

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
    } catch (error: any) {
      dispatch({ type: 'SET_ERROR', payload: error.message || 'Failed to load channels' });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, []);

  // Actions
  const actions: ChatContextType['actions'] = {
    setCurrentChannel: (channelId) => {
      dispatch({ type: 'SET_CURRENT_CHANNEL', payload: channelId });
      if (channelId && !state.messages[channelId]) {
        loadMessages(channelId);
      }
    },

    sendMessage: async (channelId, messageData) => {
      try {
        const message = await ChatService.sendMessage(channelId, messageData);
        // Message will be added via WebSocket event
        return message;
      } catch (error: any) {
        dispatch({ type: 'SET_ERROR', payload: error.message || 'Failed to send message' });
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
        const channel = await ChatService.createChannel(channelData);
        dispatch({ type: 'ADD_CHANNEL', payload: channel });
        return channel;
      } catch (error: any) {
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

  // Load messages for a channel
  const loadMessages = async (channelId: number) => {
    try {
      const result = await ChatService.getMessages({ channelId, limit: 50 });
      dispatch({ type: 'SET_MESSAGES', payload: { channelId, messages: result.messages } });
    } catch (error: any) {
      dispatch({ type: 'SET_ERROR', payload: error.message || 'Failed to load messages' });
    }
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

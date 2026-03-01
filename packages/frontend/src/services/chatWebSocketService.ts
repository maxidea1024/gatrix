import { WebSocketEvent, WebSocketEventType, Message, TypingIndicator, User } from '../types/chat';
import { io, Socket } from 'socket.io-client';
import { ChatService } from './chatService';
import { AuthService } from './auth';

export type WebSocketEventHandler = (event: WebSocketEvent) => void;

export class ChatWebSocketService {
  private socket: Socket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private eventHandlers: Map<WebSocketEventType, WebSocketEventHandler[]> = new Map();
  private isConnecting = false;
  private shouldReconnect = true;
  private connectionPromise: Promise<void> | null = null;
  private chatServerToken: string | null = null;

  constructor(private getAuthToken: () => string | null) {}

  async connect(): Promise<void> {
    if (this.isConnecting || this.isConnected()) {
      return this.connectionPromise || Promise.resolve();
    }

    this.isConnecting = true;
    this.shouldReconnect = true;

    this.connectionPromise = new Promise(async (resolve, reject) => {
      try {
        // Use existing JWT token (no separate chat token needed)
        const backendToken = localStorage.getItem('accessToken');
        if (!backendToken) {
          throw new Error('No authentication token found');
        }

        console.log('🔗 Using existing JWT token for WebSocket connection');

        const socketUrl = this.getSocketUrl();
        this.socket = io(socketUrl, {
          auth: {
            token: backendToken,
          },
          transports: ['websocket', 'polling'],
          timeout: 10000,
          reconnection: false, // We handle reconnection manually
          forceNew: true, // Force new connection
          upgrade: true, // Allow transport upgrades
          rememberUpgrade: true, // Remember successful upgrades
        });

        this.socket.on('connect', () => {
          console.log('✅ Chat Socket.IO connected successfully');
          console.log('🔗 Socket ID:', this.socket?.id);
          console.log('🚀 Transport:', this.socket?.io.engine.transport.name);
          this.isConnecting = false;
          this.reconnectAttempts = 0;
          this.emit('connection_established', {});
          resolve();
        });

        this.socket.on('disconnect', (reason) => {
          console.log('❌ Chat Socket.IO disconnected:', reason);
          console.log('🔍 Disconnect details:', {
            reason,
            socketId: this.socket?.id,
            transport: this.socket?.io.engine.transport.name,
            reconnectAttempts: this.reconnectAttempts,
            shouldReconnect: this.shouldReconnect,
          });
          this.isConnecting = false;

          // Trigger connection_lost event only if not intentionally disconnected
          if (reason !== 'io client disconnect') {
            this.emit('connection_lost', { reason });
          }

          // Only attempt reconnect for disconnects caused by server shutdown or network issues
          if (this.shouldReconnect && reason !== 'io client disconnect') {
            console.log('🔄 Attempting to reconnect...');
            this.scheduleReconnect();
          } else {
            console.log('🚫 Reconnection not attempted:', reason);
          }
        });

        this.socket.on('connect_error', async (error: any) => {
          console.error('❌ Chat Socket.IO connection error:', error);
          this.isConnecting = false;

          if (
            error.message?.includes('Authentication error') ||
            error.message?.includes('jwt') ||
            error.message?.includes('expired')
          ) {
            console.log('🔄 WebSocket auth failed, attempting token refresh...');

            try {
              // Attempt to refresh token
              await AuthService.refreshToken();

              console.log('✅ Token refreshed, reconnecting WebSocket...');

              // Attempt to reconnect with new token
              setTimeout(() => {
                this.reconnect();
              }, 1000);
            } catch (refreshError) {
              console.error('❌ Token refresh failed:', refreshError);
              this.emit('authentication_failed', { error: error.message });
            }
          } else {
            this.emit('connection_error', { error });
          }

          reject(error);
        });

        // Set up event listeners for chat events
        this.setupSocketEventListeners();

        // Connection timeout
        setTimeout(() => {
          if (this.isConnecting) {
            this.isConnecting = false;
            this.socket?.disconnect();
            reject(new Error('Socket.IO connection timeout'));
          }
        }, 10000);
      } catch (error) {
        this.isConnecting = false;
        reject(error);
      }
    });

    return this.connectionPromise;
  }

  disconnect(): void {
    this.shouldReconnect = false;

    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }

    this.isConnecting = false;
    this.connectionPromise = null;
  }

  isConnected(): boolean {
    return this.socket?.connected || false;
  }

  // Event subscription
  on(eventType: WebSocketEventType, handler: WebSocketEventHandler): void {
    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, []);
    }
    this.eventHandlers.get(eventType)!.push(handler);
  }

  off(eventType: WebSocketEventType, handler: WebSocketEventHandler): void {
    const handlers = this.eventHandlers.get(eventType);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  removeAllListeners(): void {
    this.eventHandlers.clear();
  }

  // Send events to server
  sendEvent(type: WebSocketEventType, data: any): void {
    if (!this.isConnected()) {
      console.warn('Cannot send Socket.IO event: not connected');
      return;
    }

    this.socket!.emit(type, data);
  }

  // Typing indicators
  startTyping(channelId: number, threadId?: number): void {
    this.sendEvent('start_typing', { channelId, threadId });
  }

  stopTyping(channelId: number, threadId?: number): void {
    this.sendEvent('stop_typing', { channelId, threadId });
  }

  // Join/leave channels
  joinChannel(channelId: number): void {
    console.log(`WebSocket: Joining channel ${channelId}`);
    this.sendEvent('join_channel', { channelId });
  }

  leaveChannel(channelId: number): void {
    console.log(`WebSocket: Leaving channel ${channelId}`);
    this.sendEvent('leave_channel', { channelId });
  }

  private setupSocketEventListeners(): void {
    if (!this.socket) return;

    // Chat related events
    this.socket.on('message', (data) => {
      console.log('WebSocket message received:', data);

      // Convert to appropriate event based on message type
      if (data.type === 'message_created') {
        console.log('Emitting message_created event:', data.data);
        this.emit('message_created', data.data);
      } else if (data.type === 'message_updated') {
        console.log('Emitting message_updated event:', data.data);
        this.emit('message_updated', data.data);
      } else if (data.type === 'message_deleted') {
        console.log('Emitting message_deleted event:', data.data);
        this.emit('message_deleted', data.data);
      } else if (data.type === 'thread_message_created') {
        console.log('Emitting thread_message_created event:', data);
        this.emit('thread_message_created', data);
      } else if (data.type === 'thread_updated') {
        console.log('Emitting thread_updated event:', data);
        this.emit('thread_updated', data);
      } else {
        console.log('Emitting generic message event:', data);
        // Default message event
        this.emit('message', data);
      }
    });

    // Only handle events actually sent from backend
    this.socket.on('user_left', (data) => {
      this.emit('user_left', data);
    });

    // Typing events sent from server (user_typing, user_stop_typing)
    this.socket.on('user_typing', (data) => {
      this.emit('user_typing', data);
    });

    this.socket.on('user_stop_typing', (data) => {
      this.emit('user_stop_typing', data);
    });

    // Thread typing events
    this.socket.on('user_typing_thread', (data) => {
      this.emit('user_typing_thread', data);
    });

    this.socket.on('user_stop_typing_thread', (data) => {
      this.emit('user_stop_typing_thread', data);
    });

    // Message send complete event
    this.socket.on('message_sent', (data) => {
      console.log('WebSocket message_sent received:', data);
      this.emit('message_sent', data);
    });

    // New message event (from BroadcastService)
    this.socket.on('new_message', (data) => {
      console.log('WebSocket new_message received:', data);
      this.emit('new_message', data);
    });

    // Invitation related events
    this.socket.on('channel_invitation', (data) => {
      console.log('WebSocket channel_invitation received:', data);
      this.emit('channel_invitation', data);
    });

    this.socket.on('invitation_response', (data) => {
      console.log('WebSocket invitation_response received:', data);
      this.emit('invitation_response', data);
    });

    this.socket.on('invitation_cancelled', (data) => {
      console.log('WebSocket invitation_cancelled received:', data);
      this.emit('invitation_cancelled', data);
    });

    this.socket.on('user_joined_channel', (data) => {
      console.log('WebSocket user_joined_channel received:', data);
      this.emit('user_joined_channel', data);
    });

    // Message reaction related events
    this.socket.on('message_reaction_updated', (data) => {
      console.log('WebSocket message_reaction_updated received:', data);
      this.emit('message_reaction_updated', data);
    });

    // User status change events
    this.socket.on('user_status_changed', (data) => {
      console.log('WebSocket user_status_changed received:', data);
      this.emit('presence_update', data);
    });

    // Connection related events
    this.socket.on('connected', (data) => {
      console.log('WebSocket connected event received:', data);
      this.emit('connection_established', data);
    });

    this.socket.on('error', (data) => {
      this.emit('error', data);
    });
  }

  private emit(eventType: WebSocketEventType, data: any): void {
    const handlers = this.eventHandlers.get(eventType);
    if (handlers) {
      const event: WebSocketEvent = {
        type: eventType,
        data,
        timestamp: new Date().toISOString(),
      };

      handlers.forEach((handler) => {
        try {
          handler(event);
        } catch (error) {
          console.error('Error in WebSocket event handler:', error);
        }
      });
    }
  }

  private getSocketUrl(): string {
    // Choose chat server URL based on environment and current page host
    // In dev: use current host to support LAN access (avoid hardcoded localhost)
    // In prod: prefer runtime/window config then build-time env
    const env = import.meta.env;

    // Runtime-injected config (for production docker/nginx)
    const runtimeUrl = (window as any)?.ENV?.VITE_CHAT_SERVER_URL as string | undefined;
    const runtimePort = (window as any)?.ENV?.VITE_CHAT_SERVER_PORT as string | undefined;
    // Default port: 45100 (docker-compose mapped port for chat-server)
    const defaultPort = runtimePort || env.VITE_CHAT_SERVER_PORT || '45100';

    if (env.PROD) {
      // Production: use runtime config or build-time env, fallback to 45100
      return (
        runtimeUrl ||
        (env.VITE_CHAT_SERVER_URL as string) ||
        `${location.protocol === 'https:' ? 'https' : 'http'}://${location.hostname}:${defaultPort}`
      );
    }

    // Development: allow overriding via VITE_CHAT_SERVER_URL, otherwise use current host with chat dev port
    const devUrl = (env.VITE_CHAT_SERVER_URL as string) || runtimeUrl;
    if (devUrl) {
      return devUrl;
    }

    const protocol = location.protocol === 'https:' ? 'https' : 'http';
    const port = env.VITE_CHAT_SERVER_PORT || '45100';
    return `${protocol}://${location.hostname}:${port}`;
  }

  private reconnect(): void {
    console.log('🔄 Attempting to reconnect WebSocket...');
    this.disconnect();
    this.connect().catch((error) => {
      console.error('❌ Reconnection failed:', error);
      if (this.shouldReconnect) {
        this.scheduleReconnect();
      }
    });
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      this.emit('connection_failed', {
        reason: 'Max reconnection attempts reached',
        attempts: this.reconnectAttempts,
      });
      return;
    }

    // Exponential backoff: 1s, 2s, 4s, 8s, 16s
    const delay = Math.min(this.reconnectDelay * Math.pow(2, this.reconnectAttempts), 30000); // Max 30 seconds
    console.log(`Scheduling reconnection attempt ${this.reconnectAttempts + 1} in ${delay}ms`);

    setTimeout(() => {
      if (!this.shouldReconnect) {
        console.log('Reconnection cancelled');
        return;
      }

      this.reconnectAttempts++;
      this.connect().catch((error) => {
        console.error('Reconnection failed:', error);
        // Reschedule upon reconnect failure
        if (this.shouldReconnect) {
          this.scheduleReconnect();
        }
      });
    }, delay);
  }

  // Update user status
  updateStatus(status: string, customStatus?: string): void {
    if (!this.socket) {
      console.error('❌ Cannot update status: WebSocket not connected');
      return;
    }

    console.log('📤 Sending status update:', { status, customStatus });
    this.socket.emit('update_status', { status, customStatus });
  }

  // Convenience methods for common events
  onMessageCreated(handler: (message: Message) => void): void {
    this.on('message_created', (event) => handler(event.data));
  }

  onMessageUpdated(handler: (message: Message) => void): void {
    this.on('message_updated', (event) => handler(event.data));
  }

  onMessageDeleted(handler: (messageId: number) => void): void {
    this.on('message_deleted', (event) => handler(event.data.messageId));
  }

  onUserTyping(handler: (typing: TypingIndicator) => void): void {
    this.on('user_typing', (event) => handler(event.data));
  }

  onUserStopTyping(handler: (typing: TypingIndicator) => void): void {
    this.on('user_stop_typing', (event) => handler(event.data));
  }

  onUserTypingThread(handler: (typing: TypingIndicator) => void): void {
    this.on('user_typing_thread', (event) => handler(event.data));
  }

  onUserStopTypingThread(handler: (typing: TypingIndicator) => void): void {
    this.on('user_stop_typing_thread', (event) => handler(event.data));
  }

  onUserJoinedChannel(handler: (data: { channelId: number; user: User }) => void): void {
    this.on('user_joined_channel', (event) => handler(event.data));
  }

  onUserLeftChannel(handler: (data: { channelId: number; user: User }) => void): void {
    this.on('user_left_channel', (event) => handler(event.data));
  }

  onUserOnline(handler: (user: User) => void): void {
    this.on('user_online', (event) => handler(event.data));
  }

  onUserOffline(handler: (user: User) => void): void {
    this.on('user_offline', (event) => handler(event.data));
  }

  onReactionAdded(
    handler: (data: { messageId: number; userId: number; emoji: string }) => void
  ): void {
    this.on('reaction_added', (event) => handler(event.data));
  }

  onReactionRemoved(
    handler: (data: { messageId: number; userId: number; emoji: string }) => void
  ): void {
    this.on('reaction_removed', (event) => handler(event.data));
  }

  onChannelUpdated(handler: (channel: any) => void): void {
    this.on('channel_updated', (event) => handler(event.data));
  }
}

// Singleton instance
let chatWebSocketService: ChatWebSocketService | null = null;

export const getChatWebSocketService = (
  getAuthToken: () => string | null
): ChatWebSocketService => {
  if (!chatWebSocketService) {
    chatWebSocketService = new ChatWebSocketService(getAuthToken);
  }
  return chatWebSocketService;
};

export default ChatWebSocketService;

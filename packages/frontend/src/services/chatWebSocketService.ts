import { WebSocketEvent, WebSocketEventType, Message, TypingIndicator, User } from '../types/chat';
import { io, Socket } from 'socket.io-client';

export type WebSocketEventHandler = (event: WebSocketEvent) => void;

export class ChatWebSocketService {
  private socket: Socket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private eventHandlers: Map<WebSocketEventType, WebSocketEventHandler[]> = new Map();
  private isConnecting = false;
  private shouldReconnect = true;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private connectionPromise: Promise<void> | null = null;

  constructor(private getAuthToken: () => string | null) {}

  async connect(): Promise<void> {
    if (this.isConnecting || this.isConnected()) {
      return this.connectionPromise || Promise.resolve();
    }

    this.isConnecting = true;
    this.shouldReconnect = true;

    this.connectionPromise = new Promise((resolve, reject) => {
      try {
        const token = this.getAuthToken();
        if (!token) {
          throw new Error('No authentication token available');
        }

        const socketUrl = this.getSocketUrl();
        this.socket = io(socketUrl, {
          auth: {
            token: token
          },
          transports: ['websocket', 'polling'],
          timeout: 10000,
          reconnection: false, // We handle reconnection manually
        });

        this.socket.on('connect', () => {
          console.log('Chat Socket.IO connected');
          this.isConnecting = false;
          this.reconnectAttempts = 0;
          this.startHeartbeat();
          this.emit('connection_established', {});
          resolve();
        });

        this.socket.on('disconnect', (reason) => {
          console.log('Chat Socket.IO disconnected:', reason);
          this.isConnecting = false;
          this.stopHeartbeat();
          this.emit('connection_lost', { reason });

          if (this.shouldReconnect && reason !== 'io client disconnect') {
            this.scheduleReconnect();
          }
        });

        this.socket.on('connect_error', (error) => {
          console.error('Chat Socket.IO connection error:', error);
          this.isConnecting = false;
          this.emit('connection_error', { error });
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
    this.stopHeartbeat();

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

  // Send events to server
  sendEvent(type: WebSocketEventType, data: any): void {
    if (!this.isConnected()) {
      console.warn('Cannot send Socket.IO event: not connected');
      return;
    }

    this.socket!.emit(type, data);
  }

  // Typing indicators
  startTyping(channelId: number): void {
    this.sendEvent('start_typing', { channelId });
  }

  stopTyping(channelId: number): void {
    this.sendEvent('stop_typing', { channelId });
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

    // 채팅 관련 이벤트들
    this.socket.on('message', (data) => {
      console.log('WebSocket message received:', data);

      // 메시지 타입에 따라 적절한 이벤트로 변환
      if (data.type === 'message_created') {
        console.log('Emitting message_created event:', data.data);
        this.emit('message_created', { data: data.data });
      } else if (data.type === 'message_updated') {
        console.log('Emitting message_updated event:', data.data);
        this.emit('message_updated', { data: data.data });
      } else if (data.type === 'message_deleted') {
        console.log('Emitting message_deleted event:', data.data);
        this.emit('message_deleted', { data: data.data });
      } else {
        console.log('Emitting generic message event:', data);
        // 기본 메시지 이벤트
        this.emit('message', data);
      }
    });

    this.socket.on('user_joined', (data) => {
      this.emit('user_joined', data);
    });

    this.socket.on('user_left', (data) => {
      this.emit('user_left', data);
    });

    this.socket.on('typing', (data) => {
      this.emit('typing', data);
    });

    this.socket.on('stop_typing', (data) => {
      this.emit('stop_typing', data);
    });

    this.socket.on('presence_update', (data) => {
      this.emit('presence_update', data);
    });

    this.socket.on('channel_joined', (data) => {
      this.emit('channel_joined', data);
    });

    this.socket.on('channel_left', (data) => {
      this.emit('channel_left', data);
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

      handlers.forEach(handler => {
        try {
          handler(event);
        } catch (error) {
          console.error('Error in WebSocket event handler:', error);
        }
      });
    }
  }

  private getSocketUrl(): string {
    // 채팅서버는 포트 3001에서 실행됨
    const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:';
    const hostname = window.location.hostname;
    return `${protocol}//${hostname}:3001`;
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      this.emit('connection_failed', { 
        reason: 'Max reconnection attempts reached',
        attempts: this.reconnectAttempts 
      });
      return;
    }

    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts);
    console.log(`Scheduling reconnection attempt ${this.reconnectAttempts + 1} in ${delay}ms`);

    setTimeout(() => {
      this.reconnectAttempts++;
      this.connect().catch(error => {
        console.error('Reconnection failed:', error);
      });
    }, delay);
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      if (this.isConnected()) {
        this.socket!.emit('ping', { timestamp: Date.now() });
      }
    }, 30000); // Send ping every 30 seconds
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
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

  onReactionAdded(handler: (data: { messageId: number; userId: number; emoji: string }) => void): void {
    this.on('reaction_added', (event) => handler(event.data));
  }

  onReactionRemoved(handler: (data: { messageId: number; userId: number; emoji: string }) => void): void {
    this.on('reaction_removed', (event) => handler(event.data));
  }

  onChannelUpdated(handler: (channel: any) => void): void {
    this.on('channel_updated', (event) => handler(event.data));
  }
}

// Singleton instance
let chatWebSocketService: ChatWebSocketService | null = null;

export const getChatWebSocketService = (getAuthToken: () => string | null): ChatWebSocketService => {
  if (!chatWebSocketService) {
    chatWebSocketService = new ChatWebSocketService(getAuthToken);
  }
  return chatWebSocketService;
};

export default ChatWebSocketService;

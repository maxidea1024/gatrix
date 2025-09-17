import { WebSocketEvent, WebSocketEventType, Message, TypingIndicator, User } from '../types/chat';

export type WebSocketEventHandler = (event: WebSocketEvent) => void;

export class ChatWebSocketService {
  private ws: WebSocket | null = null;
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

        const wsUrl = this.getWebSocketUrl();
        this.ws = new WebSocket(`${wsUrl}?token=${encodeURIComponent(token)}`);

        this.ws.onopen = () => {
          console.log('Chat WebSocket connected');
          this.isConnecting = false;
          this.reconnectAttempts = 0;
          this.startHeartbeat();
          this.emit('connection_established', {});
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const data: WebSocketEvent = JSON.parse(event.data);
            this.handleMessage(data);
          } catch (error) {
            console.error('Failed to parse WebSocket message:', error);
          }
        };

        this.ws.onclose = (event) => {
          console.log('Chat WebSocket disconnected:', event.code, event.reason);
          this.isConnecting = false;
          this.stopHeartbeat();
          this.emit('connection_lost', { code: event.code, reason: event.reason });

          if (this.shouldReconnect && event.code !== 1000) {
            this.scheduleReconnect();
          }
        };

        this.ws.onerror = (error) => {
          console.error('Chat WebSocket error:', error);
          this.isConnecting = false;
          this.emit('connection_error', { error });
          reject(error);
        };

        // Connection timeout
        setTimeout(() => {
          if (this.isConnecting) {
            this.isConnecting = false;
            this.ws?.close();
            reject(new Error('WebSocket connection timeout'));
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
    
    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
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
      console.warn('Cannot send WebSocket event: not connected');
      return;
    }

    const event: WebSocketEvent = {
      type,
      data,
      timestamp: new Date().toISOString(),
    };

    this.ws!.send(JSON.stringify(event));
  }

  // Typing indicators
  startTyping(channelId: number): void {
    this.sendEvent('user_typing', { channelId });
  }

  stopTyping(channelId: number): void {
    this.sendEvent('user_stop_typing', { channelId });
  }

  // Join/leave channels
  joinChannel(channelId: number): void {
    this.sendEvent('user_joined_channel', { channelId });
  }

  leaveChannel(channelId: number): void {
    this.sendEvent('user_left_channel', { channelId });
  }

  private handleMessage(event: WebSocketEvent): void {
    console.log('Received WebSocket event:', event.type, event.data);
    this.emit(event.type, event.data);
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

  private getWebSocketUrl(): string {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    return `${protocol}//${host}/ws/chat`;
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
        this.sendEvent('ping' as WebSocketEventType, { timestamp: Date.now() });
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

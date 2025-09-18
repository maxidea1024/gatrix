import { apiService } from './api';
import {
  Channel,
  Message,
  CreateChannelRequest,
  UpdateChannelRequest,
  SendMessageRequest,
  UpdateMessageRequest,
  GetMessagesRequest,
  GetChannelsRequest,
  ChannelMember,
  MessageAttachment,
  ChatNotification,
  User
} from '../types/chat';

export class ChatService {
  private static readonly BASE_URL = '/chat';
  private static readonly DIRECT_CHAT_URL = 'http://localhost:3001/api/v1'; // 임시: 직접 채팅 서버 접근

  // Channel management
  static async getChannels(params?: GetChannelsRequest): Promise<Channel[]> {
    const response = await apiService.get<Channel[]>(`${this.BASE_URL}/channels/my`, { params });
    return response.data || [];
  }

  static async getChannel(channelId: number): Promise<Channel> {
    const response = await apiService.get<Channel>(`${this.BASE_URL}/channels/${channelId}`);
    return response.data;
  }

  static async createChannel(data: CreateChannelRequest): Promise<Channel> {
    console.log('🌐 ChatService: Sending create channel request...', {
      url: `${this.DIRECT_CHAT_URL}/channels`,
      data
    });

    try {
      const startTime = Date.now();

      // 임시: 직접 채팅 서버로 요청 (프록시 우회)
      const token = localStorage.getItem('accessToken');
      const response = await fetch(`${this.DIRECT_CHAT_URL}/channels`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(data)
      });

      const duration = Date.now() - startTime;

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('❌ ChatService: Create channel request failed:', {
          status: response.status,
          statusText: response.statusText,
          data: errorData,
          duration: `${duration}ms`
        });
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();

      console.log('✅ ChatService: Create channel response received:', {
        duration: `${duration}ms`,
        status: response.status,
        data: result
      });

      return result.data || result;
    } catch (error: any) {
      console.error('❌ ChatService: Create channel request failed:', {
        error,
        message: error.message,
        name: error.name,
        stack: error.stack
      });
      throw error;
    }
  }

  static async updateChannel(channelId: number, data: UpdateChannelRequest): Promise<Channel> {
    const response = await apiService.put<Channel>(`${this.BASE_URL}/channels/${channelId}`, data);
    return response.data;
  }

  static async deleteChannel(channelId: number): Promise<void> {
    await apiService.delete(`${this.BASE_URL}/channels/${channelId}`);
  }

  static async joinChannel(channelId: number): Promise<void> {
    await apiService.post(`${this.BASE_URL}/channels/${channelId}/join`);
  }

  static async leaveChannel(channelId: number): Promise<void> {
    await apiService.post(`${this.BASE_URL}/channels/${channelId}/leave`);
  }

  // Channel members
  static async getChannelMembers(channelId: number): Promise<ChannelMember[]> {
    const response = await apiService.get<ChannelMember[]>(`${this.BASE_URL}/channels/${channelId}/members`);
    return response.data || [];
  }

  static async addChannelMember(channelId: number, userId: number): Promise<void> {
    await apiService.post(`${this.BASE_URL}/channels/${channelId}/members`, { userId });
  }

  static async removeChannelMember(channelId: number, userId: number): Promise<void> {
    await apiService.delete(`${this.BASE_URL}/channels/${channelId}/members/${userId}`);
  }

  static async updateMemberRole(channelId: number, userId: number, role: 'admin' | 'member'): Promise<void> {
    await apiService.put(`${this.BASE_URL}/channels/${channelId}/members/${userId}`, { role });
  }

  // Message management
  static async getMessages(params: GetMessagesRequest): Promise<{
    messages: Message[];
    hasMore: boolean;
    total: number;
  }> {
    const { channelId, ...queryParams } = params;
    const response = await apiService.get<{
      messages: Message[];
      hasMore: boolean;
      total: number;
    }>(`${this.BASE_URL}/channels/${channelId}/messages`, { params: queryParams });
    return response.data;
  }

  static async getMessage(messageId: number): Promise<Message> {
    const response = await apiService.get<Message>(`${this.BASE_URL}/messages/${messageId}`);
    return response.data;
  }

  static async sendMessage(channelId: number, data: SendMessageRequest): Promise<Message> {
    const formData = new FormData();
    
    // Add text content and metadata
    formData.append('content', data.content);
    if (data.type) formData.append('type', data.type);
    if (data.replyToId) formData.append('replyToId', data.replyToId.toString());
    if (data.mentions) formData.append('mentions', JSON.stringify(data.mentions));
    if (data.hashtags) formData.append('hashtags', JSON.stringify(data.hashtags));
    if (data.metadata) formData.append('metadata', JSON.stringify(data.metadata));

    // Add file attachments
    if (data.attachments) {
      data.attachments.forEach((file, index) => {
        formData.append(`attachments[${index}]`, file);
      });
    }

    const response = await apiService.post<Message>(
      `${this.BASE_URL}/channels/${channelId}/messages`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );
    return response.data;
  }

  static async updateMessage(messageId: number, data: UpdateMessageRequest): Promise<Message> {
    const response = await apiService.put<Message>(`${this.BASE_URL}/messages/${messageId}`, data);
    return response.data;
  }

  static async deleteMessage(messageId: number): Promise<void> {
    await apiService.delete(`${this.BASE_URL}/messages/${messageId}`);
  }

  // Message reactions
  static async addReaction(messageId: number, emoji: string): Promise<void> {
    await apiService.post(`${this.BASE_URL}/messages/${messageId}/reactions`, { emoji });
  }

  static async removeReaction(messageId: number, emoji: string): Promise<void> {
    await apiService.delete(`${this.BASE_URL}/messages/${messageId}/reactions/${emoji}`);
  }

  // File upload
  static async uploadFile(file: File, channelId: number): Promise<MessageAttachment> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('channelId', channelId.toString());

    const response = await apiService.post<MessageAttachment>(
      `${this.BASE_URL}/upload`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );
    return response.data;
  }

  // Search
  static async searchMessages(query: string, channelId?: number): Promise<Message[]> {
    const params: any = { query };
    if (channelId) params.channelId = channelId;

    const response = await apiService.get<Message[]>(`${this.BASE_URL}/search`, { params });
    return response.data || [];
  }

  // Read status
  static async markAsRead(channelId: number, messageId?: number): Promise<void> {
    const data: any = {};
    if (messageId) data.messageId = messageId;
    
    await apiService.post(`${this.BASE_URL}/channels/${channelId}/read`, data);
  }

  // Notifications
  static async getNotifications(): Promise<ChatNotification[]> {
    const response = await apiService.get<ChatNotification[]>(`${this.BASE_URL}/notifications`);
    return response.data || [];
  }

  static async markNotificationAsRead(notificationId: number): Promise<void> {
    await apiService.put(`${this.BASE_URL}/notifications/${notificationId}/read`);
  }

  static async markAllNotificationsAsRead(): Promise<void> {
    await apiService.put(`${this.BASE_URL}/notifications/read-all`);
  }

  // User management
  static async getUsers(search?: string): Promise<User[]> {
    const params = search ? { search } : {};
    const response = await apiService.get<User[]>(`${this.BASE_URL}/users`, { params });
    return response.data || [];
  }

  static async getUsersInChannel(channelId: number): Promise<User[]> {
    const response = await apiService.get<User[]>(`${this.BASE_URL}/channels/${channelId}/users`);
    return response.data || [];
  }

  // Typing indicators
  static async startTyping(channelId: number): Promise<void> {
    await apiService.post(`${this.BASE_URL}/channels/${channelId}/typing/start`);
  }

  static async stopTyping(channelId: number): Promise<void> {
    await apiService.post(`${this.BASE_URL}/channels/${channelId}/typing/stop`);
  }

  // Direct messages
  static async createDirectMessage(userId: number): Promise<Channel> {
    const response = await apiService.post<Channel>(`${this.BASE_URL}/direct-messages`, { userId });
    return response.data;
  }

  static async getDirectMessageChannel(userId: number): Promise<Channel | null> {
    try {
      const response = await apiService.get<Channel>(`${this.BASE_URL}/direct-messages/${userId}`);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        return null;
      }
      throw error;
    }
  }

  // Channel settings
  static async updateChannelSettings(channelId: number, settings: any): Promise<void> {
    await apiService.put(`${this.BASE_URL}/channels/${channelId}/settings`, settings);
  }

  // Message history and pagination
  static async getMessageHistory(
    channelId: number,
    beforeMessageId?: number,
    limit: number = 50
  ): Promise<{
    messages: Message[];
    hasMore: boolean;
  }> {
    const params: any = { limit };
    if (beforeMessageId) params.before = beforeMessageId;

    const response = await apiService.get<{
      messages: Message[];
      hasMore: boolean;
    }>(`${this.BASE_URL}/channels/${channelId}/history`, { params });
    
    return response.data;
  }
}

export default ChatService;

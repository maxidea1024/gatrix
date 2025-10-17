import { apiService } from './api';
import { AuthService } from './auth';
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
  private static readonly BASE_URL = `${import.meta.env.VITE_API_URL || 'http://localhost:5001/api/v1'}/chat`;

  // Channel management
  static async getChannels(params?: GetChannelsRequest): Promise<Channel[]> {
    const response = await apiService.get<{ data: Channel[]; pagination: any }>(`${this.BASE_URL}/channels/my`, { params });
    console.log('🔍 ChatService.getChannels response:', response);
    // API 응답 구조: { success: true, data: [...] }
    // apiService는 이미 response.data를 반환하므로 response.data가 실제 데이터
    return response.data || [];
  }

  static async getChannel(channelId: number): Promise<Channel> {
    const response = await apiService.get<Channel>(`${this.BASE_URL}/channels/${channelId}`);
    return response.data;
  }

  static async createChannel(data: CreateChannelRequest): Promise<Channel> {
    const response = await apiService.post<Channel>(`${this.BASE_URL}/channels`, data);
    return response.data;
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

    // Backend shape: { success: true, data: Message[], pagination: { total, hasMore, ... } }
    const response = await apiService.get<any>(
      `${this.BASE_URL}/channels/${channelId}/messages`,
      { params: queryParams }
    );

    const data = response;
    const messages: Message[] = Array.isArray(data.data)
      ? data.data
      : (data.data?.messages || []);
    const total: number = typeof data.pagination?.total === 'number'
      ? data.pagination.total
      : (Array.isArray(data.data) ? data.data.length : (data.data?.total || 0));
    const hasMore: boolean = typeof data.pagination?.hasMore === 'boolean'
      ? data.pagination.hasMore
      : !!data.pagination?.hasNext;

    return { messages, hasMore, total };
  }

  static async getMessage(messageId: number): Promise<Message> {
    const response = await apiService.get<Message>(`${this.BASE_URL}/messages/${messageId}`);
    return response.data;
  }

  static async sendMessage(channelId: number, data: SendMessageRequest): Promise<Message> {
    console.log('🔍 ChatService.sendMessage called with:', {
      channelId,
      data,
      url: `${this.BASE_URL}/channels/${channelId}/messages`
    });

    // 첨부파일이 있으면 FormData 사용, 없으면 JSON 사용
    if (data.attachments && data.attachments.length > 0) {
      const formData = new FormData();

      // Add text content and metadata
      formData.append('content', data.content);
      if (data.type) formData.append('type', data.type);
      if (data.replyToId) formData.append('replyToId', data.replyToId.toString());
      if (data.threadId) formData.append('threadId', data.threadId.toString());
      if (data.mentions) formData.append('mentions', JSON.stringify(data.mentions));
      if (data.hashtags) formData.append('hashtags', JSON.stringify(data.hashtags));
      if (data.metadata) formData.append('metadata', JSON.stringify(data.metadata));

      // Add file attachments
      data.attachments.forEach((file, index) => {
        formData.append(`attachments[${index}]`, file);
      });

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
    } else {
      // 첨부파일이 없으면 JSON으로 전송
      const requestData = {
        content: data.content,
        contentType: data.type || 'text',
        replyToMessageId: data.replyToId,
        threadId: data.threadId,
        mentions: data.mentions,
        hashtags: data.hashtags,
        metadata: data.metadata
      };

      console.log('🔍 Sending JSON message data:', requestData);

      const response = await apiService.post<Message>(
        `${this.BASE_URL}/channels/${channelId}/messages`,
        requestData
      );
      return response.data;
    }
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

    console.log(`🔄 ChatService.markAsRead called:`, {
      channelId,
      messageId,
      url: `${this.BASE_URL}/channels/${channelId}/read`,
      data
    });

    try {
      // 토큰 만료 체크 및 갱신
      await this.ensureValidToken();

      // 백엔드를 통해 요청 (직접 라우트 사용)
      const response = await apiService.post(`${this.BASE_URL}/channels/${channelId}/read`, data, {
        timeout: 10000
      });

      console.log(`✅ ChatService.markAsRead success:`, response);
    } catch (error: any) {
      console.error(`❌ ChatService.markAsRead failed:`, error);

      // 401 오류인 경우 토큰 갱신 후 재시도
      if (error.response?.status === 401) {
        try {
          console.log(`🔄 Token expired, refreshing and retrying markAsRead...`);
          await this.refreshTokenAndRetry();

          const response = await apiService.post(`${this.BASE_URL}/channels/${channelId}/read`, data, {
            timeout: 5000
          });

          console.log(`✅ ChatService.markAsRead retry success:`, response);
          return;
        } catch (retryError) {
          console.error(`❌ ChatService.markAsRead retry failed:`, retryError);
        }
      }

      throw error;
    }
  }

  // 토큰 유효성 확인 및 갱신
  private static async ensureValidToken(): Promise<void> {
    const token = localStorage.getItem('accessToken');
    if (!token) {
      throw new Error('No access token available');
    }

    try {
      // JWT 페이로드 디코딩하여 만료 시간 확인
      const payload = JSON.parse(atob(token.split('.')[1]));
      const currentTime = Date.now() / 1000;

      // 토큰이 5분 이내에 만료되면 미리 갱신
      if (payload.exp && payload.exp < currentTime + 300) {
        console.log(`🔄 Token expires soon, refreshing...`);
        await this.refreshTokenAndRetry();
      }
    } catch (error) {
      console.warn('Failed to check token expiry:', error);
      // 토큰 파싱 실패 시에도 갱신 시도
      await this.refreshTokenAndRetry();
    }
  }

  // 토큰 갱신
  private static async refreshTokenAndRetry(): Promise<void> {
    await AuthService.refreshToken();
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
    const response = await apiService.get<any>(`${this.BASE_URL}/users`, { params });

    // Handle different response structures
    if (response.data) {
      // If response.data is an array, return it directly
      if (Array.isArray(response.data)) {
        return response.data as User[];
      }
      // If response.data has a users property, return that
      if ((response.data as any).users && Array.isArray((response.data as any).users)) {
        return (response.data as any).users as User[];
      }
      // If response.data has a data property, return that
      if ((response.data as any).data && Array.isArray((response.data as any).data)) {
        return (response.data as any).data as User[];
      }
    }

    return [];
  }

  // Search users (for mail compose, etc.)
  static async searchUsers(query: string): Promise<User[]> {
    if (!query || query.length < 2) {
      return [];
    }

    try {
      const response = await apiService.get<{ success: boolean; data: User[] }>(
        `/users/search?q=${encodeURIComponent(query)}`
      );
      return response.data || [];
    } catch (error) {
      console.error('Failed to search users:', error);
      return [];
    }
  }

  // User synchronization
  static async syncCurrentUser(): Promise<void> {
    await apiService.post(`${this.BASE_URL}/sync-user`);
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

  // 사용자 초대
  static async inviteUser(channelId: number, userId: number, message?: string): Promise<void> {
    console.log(`🔄 ChatService.inviteUser called:`, {
      channelId,
      userId,
      message,
      url: `${this.BASE_URL}/channels/${channelId}/invite`
    });

    try {
      // 토큰 만료 체크 및 갱신
      await this.ensureValidToken();

      const response = await fetch(`${this.BASE_URL}/channels/${channelId}/invite`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
        },
        body: JSON.stringify({
          inviteeId: userId,
          message: message
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to send invitation');
      }

      console.log(`✅ ChatService.inviteUser success:`, data);
    } catch (error: any) {
      console.error(`❌ ChatService.inviteUser failed:`, error);

      // 401 오류인 경우 토큰 갱신 후 재시도
      if (error.status === 401) {
        try {
          console.log(`🔄 Token expired, refreshing and retrying inviteUser...`);
          await this.refreshTokenAndRetry();

          const response = await fetch(`${this.BASE_URL}/channels/${channelId}/invite`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
            },
            body: JSON.stringify({
              inviteeId: userId,
              message: message
            }),
          });

          const data = await response.json();

          if (!response.ok || !data.success) {
            throw new Error(data.error || 'Failed to send invitation');
          }

          console.log(`✅ ChatService.inviteUser retry success:`, data);
          return;
        } catch (retryError) {
          console.error(`❌ ChatService.inviteUser retry failed:`, retryError);
        }
      }

      throw error;
    }
  }

  // Thread messages
  static async getThreadMessages(threadId: number): Promise<{ messages: Message[]; total: number }> {
    const response = await apiService.get<any>(`${this.BASE_URL}/messages/thread/${threadId}`);
    // Backend shape: { success: true, data: Message[], pagination: { total, ... } }
    const messages: Message[] = Array.isArray(response.data)
      ? response.data
      : (response.data?.messages || []);
    const total: number = (response.pagination && typeof response.pagination.total === 'number')
      ? response.pagination.total
      : (Array.isArray(response.data) ? response.data.length : (response.data?.total || 0));
    return { messages, total };
  }
}

export default ChatService;

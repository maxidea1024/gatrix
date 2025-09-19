import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { config } from '../config';
import logger from '../config/logger';

export interface GatrixUser {
  id: number;
  email: string;
  name: string;
  avatarUrl?: string;
  role: string;
  status: string;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface TokenVerificationResponse {
  success: boolean;
  user?: GatrixUser;
  error?: string;
}

export interface UserSyncData {
  users: GatrixUser[];
  total: number;
  lastSyncAt: Date;
  syncAt?: Date;
}

export class GatrixApiService {
  private static instance: GatrixApiService;
  private apiClient: AxiosInstance;

  private constructor() {
    this.apiClient = axios.create({
      baseURL: config.gatrix.apiUrl,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': config.gatrix.apiSecret, // 백엔드가 인식하는 헤더 사용
        'X-Application-Name': 'chat-server', // 필수 헤더 추가
        'X-Chat-Server-ID': process.env.SERVER_ID || 'unknown',
      },
    });

    this.setupInterceptors();
  }

  public static getInstance(): GatrixApiService {
    if (!GatrixApiService.instance) {
      GatrixApiService.instance = new GatrixApiService();
    }
    return GatrixApiService.instance;
  }

  private setupInterceptors(): void {
    // 요청 인터셉터
    this.apiClient.interceptors.request.use(
      (config) => {
        logger.debug('Gatrix API Request:', {
          method: config.method,
          url: config.url,
          headers: config.headers,
        });
        return config;
      },
      (error) => {
        logger.error('Gatrix API Request Error:', error);
        return Promise.reject(error);
      }
    );

    // 응답 인터셉터
    this.apiClient.interceptors.response.use(
      (response) => {
        logger.debug('Gatrix API Response:', {
          status: response.status,
          url: response.config.url,
          data: response.data,
        });
        return response;
      },
      (error) => {
        logger.error('Gatrix API Response Error:', {
          status: error.response?.status,
          url: error.config?.url,
          data: error.response?.data,
          message: error.message,
        });
        return Promise.reject(error);
      }
    );
  }

  // 토큰 검증 - Server API 사용
  public async verifyToken(token: string): Promise<TokenVerificationResponse> {
    try {
      const response: AxiosResponse<{ success: boolean; user: GatrixUser }> = await this.apiClient.post(
        '/api/v1/server/auth/verify-token',
        { token }
      );

      return response.data;
    } catch (error) {
      logger.error('Token verification failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Token verification failed',
      };
    }
  }

  // 사용자 정보 조회 - Server API 사용
  public async getUserById(userId: number): Promise<GatrixUser | null> {
    try {
      const response: AxiosResponse<{ success: boolean; data: GatrixUser }> = await this.apiClient.get(
        `/api/v1/server/users/${userId}`
      );

      if (response.data.success) {
        return response.data.data;
      }

      return null;
    } catch (error) {
      logger.error(`Failed to get user ${userId}:`, error);
      return null;
    }
  }

  // 여러 사용자 정보 조회 - Server API 사용
  public async getUsersByIds(userIds: number[]): Promise<GatrixUser[]> {
    try {
      if (userIds.length === 0) return [];

      const response: AxiosResponse<{ success: boolean; data: GatrixUser[] }> = await this.apiClient.post(
        '/api/v1/server/users/batch',
        { userIds }
      );

      if (response.data.success) {
        return response.data.data;
      }

      return [];
    } catch (error) {
      logger.error('Failed to get users by IDs:', error);
      return [];
    }
  }

  // 사용자 검색 - 새로 추가된 사용자 검색 API 사용
  public async searchUsers(query: string, limit = 20): Promise<GatrixUser[]> {
    try {
      const response: AxiosResponse<{ success: boolean; data: GatrixUser[] }> = await this.apiClient.get(
        '/api/v1/users/search',
        {
          params: { q: query, limit },
        }
      );

      if (response.data.success) {
        return response.data.data;
      }

      logger.warn('User search API returned unsuccessful response');
      return [];
    } catch (error) {
      logger.error('Failed to search users:', error);
      return [];
    }
  }

  // 사용자 데이터 동기화 - Server API 사용
  public async syncUsers(lastSyncAt?: Date): Promise<UserSyncData | null> {
    try {
      const params = lastSyncAt ? { lastSyncAt: lastSyncAt.toISOString() } : {};

      const response: AxiosResponse<{
        success: boolean;
        data: {
          users: GatrixUser[];
          syncAt: string;
          lastSyncAt: string;
          total: number;
        }
      }> = await this.apiClient.get('/api/v1/server/users/sync', { params });

      if (response.data.success) {
        return {
          users: response.data.data.users,
          syncAt: new Date(response.data.data.syncAt),
          lastSyncAt: new Date(response.data.data.lastSyncAt),
          total: response.data.data.total
        };
      }

      return null;
    } catch (error) {
      logger.error('Failed to sync users:', error);
      return null;
    }
  }

  // 채팅 활동 보고 - Server API 사용
  public async reportChatActivity(data: {
    userId: number;
    channelId: number;
    messageCount: number;
    lastActivityAt: Date;
  }): Promise<boolean> {
    try {
      const response: AxiosResponse<{ success: boolean }> = await this.apiClient.post(
        '/api/v1/server/chat/activity',
        data
      );

      return response.data.success;
    } catch (error) {
      logger.error('Failed to report chat activity:', error);
      return false;
    }
  }

  // 채팅 통계 보고 - Server API 사용
  public async reportChatStats(data: {
    serverId: string;
    connectedUsers: number;
    activeChannels: number;
    messagesPerSecond: number;
    timestamp: Date;
  }): Promise<boolean> {
    try {
      const response: AxiosResponse<{ success: boolean }> = await this.apiClient.post(
        '/api/v1/server/chat/stats',
        data
      );

      return response.data.success;
    } catch (error) {
      logger.error('Failed to report chat stats:', error);
      return false;
    }
  }

  // 알림 전송 요청 - Server API 사용
  public async sendNotification(data: {
    userId: number;
    type: 'message' | 'mention' | 'channel_invite';
    title: string;
    content: string;
    channelId?: number;
    messageId?: number;
    metadata?: any;
  }): Promise<boolean> {
    try {
      const response: AxiosResponse<{ success: boolean }> = await this.apiClient.post(
        '/api/v1/server/notifications',
        data
      );

      return response.data.success;
    } catch (error) {
      logger.error('Failed to send notification:', error);
      return false;
    }
  }

  // 파일 업로드 URL 요청 - Server API 사용
  public async getUploadUrl(data: {
    fileName: string;
    fileSize: number;
    mimeType: string;
    userId: number;
  }): Promise<{ uploadUrl: string; fileUrl: string } | null> {
    try {
      const response: AxiosResponse<{
        success: boolean;
        data: { uploadUrl: string; fileUrl: string };
      }> = await this.apiClient.post('/api/v1/server/files/upload-url', data);

      if (response.data.success) {
        return response.data.data;
      }

      return null;
    } catch (error) {
      logger.error('Failed to get upload URL:', error);
      return null;
    }
  }

  // 사용자 권한 확인 - Server API에는 권한 확인 기능이 없으므로 제거
  public async checkUserPermission(_userId: number, _permission: string): Promise<boolean> {
    try {
      // Server API에는 권한 확인 기능이 없음
      // 필요시 백엔드에 권한 확인 API 추가 필요
      logger.warn('User permission check not available in Server API');
      return false;
    } catch (error) {
      logger.error('Failed to check user permission:', error);
      return false;
    }
  }

  // 헬스 체크 - Server API 사용
  public async healthCheck(): Promise<boolean> {
    try {
      const response: AxiosResponse<{ success: boolean }> = await this.apiClient.get('/health');
      return response.data.success;
    } catch (error) {
      logger.error('Gatrix health check failed:', error);
      return false;
    }
  }

  // 연결 테스트 - Server API 사용
  public async testConnection(): Promise<boolean> {
    try {
      const response: AxiosResponse<{ success: boolean }> = await this.apiClient.get('/api/v1/server/test');
      return response.data.success;
    } catch (error) {
      logger.error('Gatrix connection test failed:', error);
      return false;
    }
  }

  // 채팅 서버 등록 - Server API 사용
  public async registerChatServer(): Promise<boolean> {
    try {
      const response: AxiosResponse<{ success: boolean }> = await this.apiClient.post(
        '/api/v1/server/chat/register',
        {
          serverId: process.env.SERVER_ID,
          host: config.host,
          port: config.port,
          maxConnections: config.websocket.maxConnections,
          capabilities: [
            'real-time-messaging',
            'file-uploads',
            'voice-chat',
            'video-chat',
            'screen-sharing',
          ],
        }
      );

      return response.data.success;
    } catch (error) {
      logger.error('Failed to register chat server:', error);
      return false;
    }
  }

  // 채팅 서버 등록 해제 - Server API 사용
  public async unregisterChatServer(): Promise<boolean> {
    try {
      const response: AxiosResponse<{ success: boolean }> = await this.apiClient.post(
        '/api/v1/server/chat/unregister',
        {
          serverId: process.env.SERVER_ID,
        }
      );

      return response.data.success;
    } catch (error) {
      logger.error('Failed to unregister chat server:', error);
      return false;
    }
  }
}

export const gatrixApiService = GatrixApiService.getInstance();

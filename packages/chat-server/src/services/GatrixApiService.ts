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
        'Authorization': `Bearer ${config.gatrix.apiSecret}`,
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

  // 토큰 검증
  public async verifyToken(token: string): Promise<TokenVerificationResponse> {
    try {
      const response: AxiosResponse<TokenVerificationResponse> = await this.apiClient.post(
        '/api/v1/auth/verify-token',
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

  // 사용자 정보 조회
  public async getUserById(userId: number): Promise<GatrixUser | null> {
    try {
      const response: AxiosResponse<{ success: boolean; data: GatrixUser }> = await this.apiClient.get(
        `/api/v1/users/${userId}`
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

  // 여러 사용자 정보 조회
  public async getUsersByIds(userIds: number[]): Promise<GatrixUser[]> {
    try {
      if (userIds.length === 0) return [];

      const response: AxiosResponse<{ success: boolean; data: GatrixUser[] }> = await this.apiClient.post(
        '/api/v1/users/batch',
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

  // 사용자 검색
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

      return [];
    } catch (error) {
      logger.error('Failed to search users:', error);
      return [];
    }
  }

  // 사용자 데이터 동기화
  public async syncUsers(lastSyncAt?: Date): Promise<UserSyncData | null> {
    try {
      const params: any = {};
      if (lastSyncAt) {
        params.since = lastSyncAt.toISOString();
      }

      const response: AxiosResponse<{ success: boolean; data: UserSyncData }> = await this.apiClient.get(
        '/api/v1/users/sync',
        { params }
      );

      if (response.data.success) {
        return response.data.data;
      }

      return null;
    } catch (error) {
      logger.error('Failed to sync users:', error);
      return null;
    }
  }

  // 채팅 활동 보고
  public async reportChatActivity(data: {
    userId: number;
    channelId: number;
    messageCount: number;
    lastActivityAt: Date;
  }): Promise<boolean> {
    try {
      const response: AxiosResponse<{ success: boolean }> = await this.apiClient.post(
        '/api/v1/chat/activity',
        data
      );

      return response.data.success;
    } catch (error) {
      logger.error('Failed to report chat activity:', error);
      return false;
    }
  }

  // 채팅 통계 보고
  public async reportChatStats(data: {
    serverId: string;
    connectedUsers: number;
    activeChannels: number;
    messagesPerSecond: number;
    timestamp: Date;
  }): Promise<boolean> {
    try {
      const response: AxiosResponse<{ success: boolean }> = await this.apiClient.post(
        '/api/v1/chat/stats',
        data
      );

      return response.data.success;
    } catch (error) {
      logger.error('Failed to report chat stats:', error);
      return false;
    }
  }

  // 알림 전송 요청
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
        '/api/v1/notifications',
        data
      );

      return response.data.success;
    } catch (error) {
      logger.error('Failed to send notification:', error);
      return false;
    }
  }

  // 파일 업로드 URL 요청
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
      }> = await this.apiClient.post('/api/v1/files/upload-url', data);

      if (response.data.success) {
        return response.data.data;
      }

      return null;
    } catch (error) {
      logger.error('Failed to get upload URL:', error);
      return null;
    }
  }

  // 사용자 권한 확인
  public async checkUserPermission(userId: number, permission: string): Promise<boolean> {
    try {
      const response: AxiosResponse<{ success: boolean; hasPermission: boolean }> = await this.apiClient.get(
        `/api/v1/users/${userId}/permissions/${permission}`
      );

      return response.data.success && response.data.hasPermission;
    } catch (error) {
      logger.error('Failed to check user permission:', error);
      return false;
    }
  }

  // 헬스 체크
  public async healthCheck(): Promise<boolean> {
    try {
      const response: AxiosResponse<{ success: boolean }> = await this.apiClient.get('/health');
      return response.data.success;
    } catch (error) {
      logger.error('Gatrix health check failed:', error);
      return false;
    }
  }

  // 연결 테스트
  public async testConnection(): Promise<boolean> {
    try {
      const response: AxiosResponse<{ success: boolean }> = await this.apiClient.get('/api/v1/ping');
      return response.data.success;
    } catch (error) {
      logger.error('Gatrix connection test failed:', error);
      return false;
    }
  }

  // 채팅 서버 등록
  public async registerChatServer(): Promise<boolean> {
    try {
      const response: AxiosResponse<{ success: boolean }> = await this.apiClient.post(
        '/api/v1/chat/servers/register',
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

  // 채팅 서버 등록 해제
  public async unregisterChatServer(): Promise<boolean> {
    try {
      const response: AxiosResponse<{ success: boolean }> = await this.apiClient.delete(
        `/api/v1/chat/servers/${process.env.SERVER_ID}`
      );

      return response.data.success;
    } catch (error) {
      logger.error('Failed to unregister chat server:', error);
      return false;
    }
  }
}

export const gatrixApiService = GatrixApiService.getInstance();

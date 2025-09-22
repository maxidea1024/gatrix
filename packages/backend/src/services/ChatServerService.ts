import axios, { AxiosInstance } from 'axios';
import { config } from '../config';

interface ChatServerTokenResponse {
  success: boolean;
  data: {
    token: string;
    expiresIn: string;
    permissions: string[];
    serverId: string;
  };
}

interface UserData {
  id: number;
  username: string;
  name?: string;
  email?: string;
  avatar?: string;
  avatarUrl?: string;
  status?: 'online' | 'offline' | 'away' | 'busy';
  customStatus?: string;
  lastSeenAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export class ChatServerService {
  private static instance: ChatServerService;
  private axiosInstance: AxiosInstance;
  private apiToken: string;

  private constructor() {
    // 설정에서 API 토큰 가져오기
    this.apiToken = config.chatServer.apiToken;

    this.axiosInstance = axios.create({
      baseURL: config.chatServer.url,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Token': this.apiToken,
      },
    });

    // 응답 인터셉터로 에러 처리
    this.axiosInstance.interceptors.response.use(
      (response) => response,
      (error) => {
        console.error('Chat Server API Error:', {
          url: error.config?.url,
          method: error.config?.method,
          status: error.response?.status,
          data: error.response?.data,
        });
        throw error;
      }
    );
  }

  static getInstance(): ChatServerService {
    if (!ChatServerService.instance) {
      ChatServerService.instance = new ChatServerService();
    }
    return ChatServerService.instance;
  }

  /**
   * API 토큰이 이미 헤더에 설정되어 있으므로 추가 인증 불필요
   */



  /**
   * 사용자 정보를 Chat Server에 동기화
   */
  async syncUser(userData: UserData): Promise<void> {
    try {
      console.log(`🔄 Syncing user ${userData.id} (${userData.username}) to Chat Server...`);

      const response = await this.axiosInstance.post(
        '/api/v1/users/upsert',
        userData
      );

      if (!response.data.success) {
        throw new Error(`Chat Server responded with error: ${response.data.error?.message}`);
      }

      console.log(`✅ User ${userData.id} synced successfully to Chat Server`);
    } catch (error: any) {
      console.error(`❌ Failed to sync user ${userData.id} to Chat Server:`, error.message);
      throw error;
    }
  }

  /**
   * 여러 사용자를 한 번에 동기화
   */
  async syncUsers(users: UserData[]): Promise<void> {
    console.log(`🔄 Syncing ${users.length} users to Chat Server...`);
    
    const results = await Promise.allSettled(
      users.map(user => this.syncUser(user))
    );

    const failed = results.filter(result => result.status === 'rejected');
    if (failed.length > 0) {
      console.error(`❌ Failed to sync ${failed.length} out of ${users.length} users`);
    } else {
      console.log(`✅ All ${users.length} users synced successfully`);
    }
  }

  /**
   * 사용자 상태 업데이트
   */
  async updateUserStatus(userId: number, status: string, customStatus?: string): Promise<void> {
    try {
      const response = await this.axiosInstance.put(
        `/api/v1/users/${userId}/status`,
        { status, customStatus }
      );

      if (!response.data.success) {
        throw new Error(`Chat Server responded with error: ${response.data.error?.message}`);
      }

      console.log(`✅ User ${userId} status updated to ${status}`);
    } catch (error: any) {
      console.error(`❌ Failed to update user ${userId} status:`, error.message);
      throw error;
    }
  }

  /**
   * 사용자 삭제
   */
  async deleteUser(userId: number): Promise<void> {
    try {
      const response = await this.axiosInstance.delete(
        `/api/v1/users/${userId}`
      );

      if (!response.data.success) {
        throw new Error(`Chat Server responded with error: ${response.data.error?.message}`);
      }

      console.log(`✅ User ${userId} deleted from Chat Server`);
    } catch (error: any) {
      console.error(`❌ Failed to delete user ${userId} from Chat Server:`, error.message);
      throw error;
    }
  }

  /**
   * Chat Server 연결 상태 확인
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.axiosInstance.get('/api/v1/');
      return response.data.success === true;
    } catch (error) {
      return false;
    }
  }


}

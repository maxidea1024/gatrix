import axios, { AxiosInstance } from "axios";
import { config } from "../config";
import { createLogger } from "../config/logger";

const logger = createLogger("ChatServerService");

interface UserData {
  id: number;
  username: string;
  name?: string;
  email?: string;
  avatar?: string;
  avatarUrl?: string;
  status?: "online" | "offline" | "away" | "busy";
  customStatus?: string;
  lastSeenAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export class ChatServerService {
  private static instance: ChatServerService;
  private axiosInstance: AxiosInstance;
  private apiToken: string;
  private serviceToken: string;

  private constructor() {
    // 설정에서 API 토큰 가져오기
    this.apiToken = config.chatServer.apiToken;
    this.serviceToken =
      (config.chatServer as any).serviceToken ||
      "gatrix-backend-service-token-default-key-change-in-production";

    this.axiosInstance = axios.create({
      baseURL: config.chatServer.url,
      timeout: 30000,
      headers: {
        "Content-Type": "application/json",
        "X-API-Token": this.serviceToken, // Backend -> Chat Server 특수 토큰 사용
      },
    });

    // 응답 인터셉터로 에러 처리
    this.axiosInstance.interceptors.response.use(
      (response) => response,
      (error) => {
        logger.error("Chat Server API Error:", {
          url: error.config?.url,
          method: error.config?.method,
          status: error.response?.status,
          data: error.response?.data,
        });
        throw error;
      },
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
      logger.info(
        `🔄 Syncing user ${userData.id} (${userData.username}) to Chat Server...`,
      );

      const response = await this.axiosInstance.post(
        "/api/v1/users/upsert",
        userData,
      );

      if (!response.data.success) {
        throw new Error(
          `Chat Server responded with error: ${response.data.error?.message}`,
        );
      }

      logger.info(`✅ User ${userData.id} synced successfully to Chat Server`);
    } catch (error: any) {
      logger.error(`❌ Failed to sync user ${userData.id} to Chat Server:`, {
        message: error.message,
      });
      throw error;
    }
  }

  /**
   * 사용자가 Chat Server에 동기화되어 있는지 확인하고, 없으면 동기화
   */
  async ensureUserSynced(userData: UserData): Promise<void> {
    try {
      // 먼저 사용자가 존재하는지 확인
      const checkResponse = await this.axiosInstance.get(
        `/api/v1/users/check/${userData.id}`,
      );

      if (checkResponse.data.success && checkResponse.data.data?.exists) {
        // 사용자가 이미 존재하면 동기화 스킵
        return;
      }
    } catch (error) {
      // 확인 실패하면 동기화 시도
      logger.debug(
        `🔍 Could not check user existence, proceeding with sync...`,
      );
    }

    // 사용자가 없거나 확인 실패한 경우 동기화
    await this.syncUser(userData);
  }

  /**
   * 여러 사용자를 한 번에 동기화 (개선된 bulk 처리)
   */
  async syncUsers(users: UserData[]): Promise<void> {
    logger.info(`🔄 Bulk syncing ${users.length} users to Chat Server...`);

    try {
      const response = await this.axiosInstance.post(
        "/api/v1/users/sync-users",
        { users },
      );

      if (!response.data.success) {
        throw new Error(
          `Chat Server responded with error: ${response.data.error?.message}`,
        );
      }

      logger.info(
        `✅ Bulk synced ${users.length} users successfully to Chat Server`,
      );
    } catch (error: any) {
      logger.error(`❌ Failed to bulk sync users to Chat Server:`, {
        message: error.message,
      });

      // Fallback to individual sync if bulk fails
      logger.info(`🔄 Falling back to individual sync...`);
      const results = await Promise.allSettled(
        users.map((user) => this.syncUser(user)),
      );

      const failed = results.filter((result) => result.status === "rejected");
      if (failed.length > 0) {
        logger.error(
          `❌ Failed to sync ${failed.length} out of ${users.length} users`,
        );
      } else {
        logger.info(
          `✅ All ${users.length} users synced successfully (fallback)`,
        );
      }
    }
  }

  /**
   * 사용자 상태 업데이트
   */
  async updateUserStatus(
    userId: number,
    status: string,
    customStatus?: string,
  ): Promise<void> {
    try {
      const response = await this.axiosInstance.put(
        `/api/v1/users/${userId}/status`,
        { status, customStatus },
      );

      if (!response.data.success) {
        throw new Error(
          `Chat Server responded with error: ${response.data.error?.message}`,
        );
      }

      logger.info(`✅ User ${userId} status updated to ${status}`);
    } catch (error: any) {
      logger.error(`❌ Failed to update user ${userId} status:`, {
        message: error.message,
      });
      throw error;
    }
  }

  /**
   * 사용자 삭제
   */
  async deleteUser(userId: number): Promise<void> {
    try {
      const response = await this.axiosInstance.delete(
        `/api/v1/users/${userId}`,
      );

      if (!response.data.success) {
        throw new Error(
          `Chat Server responded with error: ${response.data.error?.message}`,
        );
      }

      logger.info(`✅ User ${userId} deleted from Chat Server`);
    } catch (error: any) {
      logger.error(`❌ Failed to delete user ${userId} from Chat Server:`, {
        message: error.message,
      });
      throw error;
    }
  }

  /**
   * Chat WebSocket 토큰 생성
   */
  async generateChatToken(userId: number): Promise<string> {
    try {
      const response = await this.axiosInstance.post("/api/v1/auth/token", {
        userId,
      });

      if (!response.data.success || !response.data.data?.token) {
        throw new Error("Failed to generate chat token");
      }

      return response.data.data.token;
    } catch (error) {
      logger.error("Error generating chat token:", error);
      throw new Error("Failed to generate chat token");
    }
  }

  /**
   * 사용자 채널 목록 조회
   */
  async getUserChannels(userId: number): Promise<any> {
    try {
      // Chat Server의 /api/v1/channels/my 엔드포인트 사용
      // 사용자 ID를 헤더로 전달
      const response = await this.axiosInstance.get("/api/v1/channels/my", {
        headers: {
          "X-User-ID": userId.toString(),
        },
      });

      if (!response.data.success) {
        throw new Error("Failed to get user channels");
      }

      // Chat Server의 응답 구조를 그대로 반환 (data: [], pagination: {...})
      return response.data.data || { data: [], pagination: {} };
    } catch (error) {
      logger.error("Error getting user channels:", error);
      throw new Error("Failed to get user channels");
    }
  }

  /**
   * 채널 생성
   */
  async createChannel(channelData: {
    name: string;
    description?: string;
    type: string;
    createdBy: number;
  }): Promise<any> {
    try {
      const response = await this.axiosInstance.post(
        "/api/v1/channels",
        channelData,
      );

      if (!response.data.success) {
        throw new Error("Failed to create channel");
      }

      return response.data.data?.channel;
    } catch (error) {
      logger.error("Error creating channel:", error);
      throw new Error("Failed to create channel");
    }
  }

  /**
   * 채널 정보 조회
   */
  async getChannel(channelId: number): Promise<any> {
    try {
      const response = await this.axiosInstance.get(
        `/api/v1/channels/${channelId}`,
      );

      if (!response.data.success) {
        return null;
      }

      return response.data.data?.channel;
    } catch (error) {
      logger.error("Error getting channel:", error);
      return null;
    }
  }

  /**
   * 채널 메시지 조회
   */
  async getChannelMessages(
    channelId: number,
    options: {
      page: number;
      limit: number;
    },
  ): Promise<any[]> {
    try {
      const response = await this.axiosInstance.get(
        `/api/v1/channels/${channelId}/messages`,
        {
          params: options,
        },
      );

      if (!response.data.success) {
        throw new Error("Failed to get channel messages");
      }

      return response.data.data?.messages || [];
    } catch (error) {
      logger.error("Error getting channel messages:", error);
      throw new Error("Failed to get channel messages");
    }
  }

  /**
   * Chat Server 연결 상태 확인
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.axiosInstance.get("/api/v1/");
      return response.data.success === true;
    } catch (error) {
      return false;
    }
  }

  /**
   * 사용자 목록 조회
   */
  async getUsers(userId: number, search?: string): Promise<any[]> {
    try {
      const params: any = {};
      if (search) {
        params.search = search;
      }

      const response = await this.axiosInstance.get("/api/v1/users", {
        params,
        headers: {
          "X-User-ID": userId.toString(),
        },
      });

      if (!response.data.success) {
        throw new Error("Failed to get users");
      }

      return response.data.data || [];
    } catch (error) {
      logger.error("Error getting users:", error);
      throw new Error("Failed to get users");
    }
  }

  /**
   * Generate Chat Server API token
   */
  async generateChatApiToken(
    tokenName: string,
    permissions: string[] = ["read", "write", "admin"],
  ): Promise<string> {
    try {
      logger.info(`🔑 Generating Chat Server API token: ${tokenName}`);

      const response = await this.axiosInstance.post("/api/v1/admin/tokens", {
        name: tokenName,
        permissions,
      });

      if (!response.data.success) {
        throw new Error(
          `Chat Server responded with error: ${response.data.error?.message}`,
        );
      }

      const token = response.data.data?.token;
      if (!token) {
        throw new Error("No token returned from Chat Server");
      }

      logger.info(`✅ Chat Server API token generated successfully`);
      return token;
    } catch (error: any) {
      logger.error(
        `❌ Failed to generate Chat Server API token:`,
        error.message,
      );
      throw error;
    }
  }
}

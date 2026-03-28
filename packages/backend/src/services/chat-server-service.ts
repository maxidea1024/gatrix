import axios, { AxiosInstance } from 'axios';
import { config } from '../config';
import { createLogger } from '../config/logger';

const logger = createLogger('ChatServerService');

interface UserData {
  id: string;
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
  private serviceToken: string;

  private constructor() {
    // Get API token from settings
    this.apiToken = config.chatServer.apiToken;
    this.serviceToken =
      (config.chatServer as any).serviceToken ||
      'gatrix-backend-service-token-default-key-change-in-production';

    this.axiosInstance = axios.create({
      baseURL: config.chatServer.url,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Token': this.serviceToken, // Backend -> Chat Server special token
      },
    });

    // Response interceptor for error handling
    this.axiosInstance.interceptors.response.use(
      (response) => response,
      (error) => {
        logger.error('Chat Server API Error:', {
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
   * API token is already set in headers, no additional authentication needed
   */

  /**
   * Sync user info to Chat Server
   */
  async syncUser(userData: UserData): Promise<void> {
    try {
      logger.info(
        `🔄 Syncing user ${userData.id} (${userData.username}) to Chat Server...`
      );

      const response = await this.axiosInstance.post(
        '/api/v1/users/upsert',
        userData
      );

      if (!response.data.success) {
        throw new Error(
          `Chat Server responded with error: ${response.data.error?.message}`
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
   * Ensure user is synced to Chat Server, sync if not exists
   */
  async ensureUserSynced(userData: UserData): Promise<void> {
    try {
      // First check if user already exists
      const checkResponse = await this.axiosInstance.get(
        `/api/v1/users/check/${userData.id}`
      );

      if (checkResponse.data.success && checkResponse.data.data?.exists) {
        // Skip sync if user already exists
        return;
      }
    } catch (error) {
      // Proceed with sync if check fails
      logger.debug(
        `🔍 Could not check user existence, proceeding with sync...`
      );
    }

    // Sync if user doesn't exist or check failed
    await this.syncUser(userData);
  }

  /**
   * Sync multiple users at once (improved bulk processing)
   */
  async syncUsers(users: UserData[]): Promise<void> {
    logger.info(`🔄 Bulk syncing ${users.length} users to Chat Server...`);

    try {
      const response = await this.axiosInstance.post(
        '/api/v1/users/sync-users',
        { users }
      );

      if (!response.data.success) {
        throw new Error(
          `Chat Server responded with error: ${response.data.error?.message}`
        );
      }

      logger.info(
        `✅ Bulk synced ${users.length} users successfully to Chat Server`
      );
    } catch (error: any) {
      logger.error(`❌ Failed to bulk sync users to Chat Server:`, {
        message: error.message,
      });

      // Fallback to individual sync if bulk fails
      logger.info(`🔄 Falling back to individual sync...`);
      const results = await Promise.allSettled(
        users.map((user) => this.syncUser(user))
      );

      const failed = results.filter((result) => result.status === 'rejected');
      if (failed.length > 0) {
        logger.error(
          `❌ Failed to sync ${failed.length} out of ${users.length} users`
        );
      } else {
        logger.info(
          `✅ All ${users.length} users synced successfully (fallback)`
        );
      }
    }
  }

  /**
   * Update user status
   */
  async updateUserStatus(
    userId: string,
    status: string,
    customStatus?: string
  ): Promise<void> {
    try {
      const response = await this.axiosInstance.put(
        `/api/v1/users/${userId}/status`,
        {
          status,
          customStatus,
        }
      );

      if (!response.data.success) {
        throw new Error(
          `Chat Server responded with error: ${response.data.error?.message}`
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
   * Delete user
   */
  async deleteUser(userId: string): Promise<void> {
    try {
      const response = await this.axiosInstance.delete(
        `/api/v1/users/${userId}`
      );

      if (!response.data.success) {
        throw new Error(
          `Chat Server responded with error: ${response.data.error?.message}`
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
   * Generate Chat WebSocket token
   */
  async generateChatToken(userId: string): Promise<string> {
    try {
      const response = await this.axiosInstance.post('/api/v1/auth/token', {
        userId,
      });

      if (!response.data.success || !response.data.data?.token) {
        throw new Error('Failed to generate chat token');
      }

      return response.data.data.token;
    } catch (error) {
      logger.error('Error generating chat token:', error);
      throw new Error('Failed to generate chat token');
    }
  }

  /**
   * Get user channel list
   */
  async getUserChannels(userId: string): Promise<any> {
    try {
      // Use Chat Server's /api/v1/channels/my endpoint
      // Pass user ID via headers
      const response = await this.axiosInstance.get('/api/v1/channels/my', {
        headers: {
          'X-User-ID': userId.toString(),
        },
      });

      if (!response.data.success) {
        throw new Error('Failed to get user channels');
      }

      // Return chat server response structure as-is (data: [], pagination: {...})
      return response.data.data || { data: [], pagination: {} };
    } catch (error) {
      logger.error('Error getting user channels:', error);
      throw new Error('Failed to get user channels');
    }
  }

  /**
   * Create channel
   */
  async createChannel(channelData: {
    name: string;
    description?: string;
    type: string;
    createdBy: string;
  }): Promise<any> {
    try {
      const response = await this.axiosInstance.post(
        '/api/v1/channels',
        channelData
      );

      if (!response.data.success) {
        throw new Error('Failed to create channel');
      }

      return response.data.data?.channel;
    } catch (error) {
      logger.error('Error creating channel:', error);
      throw new Error('Failed to create channel');
    }
  }

  /**
   * Get channel info
   */
  async getChannel(channelId: number): Promise<any> {
    try {
      const response = await this.axiosInstance.get(
        `/api/v1/channels/${channelId}`
      );

      if (!response.data.success) {
        return null;
      }

      return response.data.data?.channel;
    } catch (error) {
      logger.error('Error getting channel:', error);
      return null;
    }
  }

  /**
   * Get channel messages
   */
  async getChannelMessages(
    channelId: number,
    options: {
      page: number;
      limit: number;
    }
  ): Promise<any[]> {
    try {
      const response = await this.axiosInstance.get(
        `/api/v1/channels/${channelId}/messages`,
        {
          params: options,
        }
      );

      if (!response.data.success) {
        throw new Error('Failed to get channel messages');
      }

      return response.data.data?.messages || [];
    } catch (error) {
      logger.error('Error getting channel messages:', error);
      throw new Error('Failed to get channel messages');
    }
  }

  /**
   * Check Chat Server connection status
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.axiosInstance.get('/api/v1/');
      return response.data.success === true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get user list
   */
  async getUsers(userId: string, search?: string): Promise<any[]> {
    try {
      const params: any = {};
      if (search) {
        params.search = search;
      }

      const response = await this.axiosInstance.get('/api/v1/users', {
        params,
        headers: {
          'X-User-ID': userId.toString(),
        },
      });

      if (!response.data.success) {
        throw new Error('Failed to get users');
      }

      return response.data.data || [];
    } catch (error) {
      logger.error('Error getting users:', error);
      throw new Error('Failed to get users');
    }
  }

  /**
   * Generate Chat Server API token
   */
  async generateChatApiToken(
    tokenName: string,
    permissions: string[] = ['read', 'write', 'admin']
  ): Promise<string> {
    try {
      logger.info(`🔑 Generating Chat Server API token: ${tokenName}`);

      const response = await this.axiosInstance.post('/api/v1/admin/tokens', {
        name: tokenName,
        permissions,
      });

      if (!response.data.success) {
        throw new Error(
          `Chat Server responded with error: ${response.data.error?.message}`
        );
      }

      const token = response.data.data?.token;
      if (!token) {
        throw new Error('No token returned from Chat Server');
      }

      logger.info(`✅ Chat Server API token generated successfully`);
      return token;
    } catch (error: any) {
      logger.error(
        `❌ Failed to generate Chat Server API token:`,
        error.message
      );
      throw error;
    }
  }
}

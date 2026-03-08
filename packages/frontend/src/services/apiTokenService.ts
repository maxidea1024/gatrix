import api from './api';
import {
  ApiAccessToken,
  CreateTokenRequest,
  UpdateTokenRequest,
  CreateTokenResponse,
  GetTokensRequest,
  GetTokensResponse,
} from '@/types/apiToken';

class ApiTokenService {
  /**
   * Build project-scoped base path for API token endpoints.
   * Falls back to legacy path if no project path is provided.
   */
  private basePath(projectApiPath: string | null): string {
    return projectApiPath
      ? `${projectApiPath}/api-tokens`
      : '/admin/api-tokens';
  }

  /**
   * Get all API tokens with pagination and filters
   */
  async getTokens(
    params: GetTokensRequest = {},
    projectApiPath: string | null = null
  ): Promise<GetTokensResponse> {
    try {
      const response = await api.get(this.basePath(projectApiPath), { params });

      const backendData = response.data;

      const result = {
        data: backendData.tokens || [],
        total: backendData.pagination?.total || 0,
        page: backendData.pagination?.page || 1,
        limit: backendData.pagination?.limit || 10,
      };

      return result;
    } catch (error) {
      console.error('Error fetching API tokens:', error);
      throw error;
    }
  }

  /**
   * Get API token by ID
   */
  async getTokenById(
    id: number,
    projectApiPath: string | null = null
  ): Promise<ApiAccessToken> {
    try {
      const response = await api.get(`${this.basePath(projectApiPath)}/${id}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching API token:', error);
      throw error;
    }
  }

  /**
   * Create new API token
   */
  async createToken(
    data: CreateTokenRequest,
    projectApiPath: string | null = null
  ): Promise<CreateTokenResponse> {
    try {
      const response = await api.post(this.basePath(projectApiPath), data);
      return response.data;
    } catch (error) {
      console.error('Error creating API token:', error);
      throw error;
    }
  }

  /**
   * Update API token
   */
  async updateToken(
    id: number,
    data: UpdateTokenRequest,
    projectApiPath: string | null = null
  ): Promise<ApiAccessToken> {
    try {
      const response = await api.put(
        `${this.basePath(projectApiPath)}/${id}`,
        data
      );
      return response.data;
    } catch (error) {
      console.error('Error updating API token:', error);
      throw error;
    }
  }

  /**
   * Regenerate API token (creates new token value)
   */
  async regenerateToken(
    id: number,
    projectApiPath: string | null = null
  ): Promise<CreateTokenResponse> {
    try {
      const response = await api.post(
        `${this.basePath(projectApiPath)}/${id}/regenerate`
      );
      return response.data;
    } catch (error) {
      console.error('Error regenerating API token:', error);
      throw error;
    }
  }

  /**
   * Delete API token
   */
  async deleteToken(
    id: number,
    projectApiPath: string | null = null
  ): Promise<void> {
    try {
      await api.delete(`${this.basePath(projectApiPath)}/${id}`);
    } catch (error) {
      console.error('Error deleting API token:', error);
      throw error;
    }
  }

  /**
   * Revoke API token (set as inactive)
   */
  async revokeToken(
    id: number,
    projectApiPath: string | null = null
  ): Promise<ApiAccessToken> {
    try {
      const response = await api.patch(
        `${this.basePath(projectApiPath)}/${id}/revoke`
      );
      return response.data;
    } catch (error) {
      console.error('Error revoking API token:', error);
      throw error;
    }
  }

  /**
   * Activate API token
   */
  async activateToken(
    id: number,
    projectApiPath: string | null = null
  ): Promise<ApiAccessToken> {
    try {
      const response = await api.patch(
        `${this.basePath(projectApiPath)}/${id}/activate`
      );
      return response.data;
    } catch (error) {
      console.error('Error activating API token:', error);
      throw error;
    }
  }

  /**
   * Extend token expiration
   */
  async extendToken(
    id: number,
    expiresAt: string,
    projectApiPath: string | null = null
  ): Promise<ApiAccessToken> {
    try {
      const response = await api.patch(
        `${this.basePath(projectApiPath)}/${id}/extend`,
        {
          expiresAt,
        }
      );
      return response.data;
    } catch (error) {
      console.error('Error extending API token:', error);
      throw error;
    }
  }

  /**
   * Get token usage statistics
   */
  async getTokenStats(projectApiPath: string | null = null): Promise<{
    totalTokens: number;
    activeTokens: number;
    expiredTokens: number;
    recentlyUsed: number;
  }> {
    try {
      const response = await api.get(`${this.basePath(projectApiPath)}/stats`);
      return response.data;
    } catch (error) {
      console.error('Error fetching token stats:', error);
      throw error;
    }
  }

  /**
   * Get tokens for specific environment
   */
  async getTokensForEnvironment(
    environmentId: string,
    projectApiPath: string | null = null
  ): Promise<ApiAccessToken[]> {
    try {
      const response = await api.get(
        `${this.basePath(projectApiPath)}/environmentId/${environmentId}`
      );
      return response.data;
    } catch (error) {
      console.error('Error fetching environment tokens:', error);
      throw error;
    }
  }

  /**
   * Get admin tokens
   */
  async getAdminTokens(
    projectApiPath: string | null = null
  ): Promise<ApiAccessToken[]> {
    try {
      const response = await api.get(`${this.basePath(projectApiPath)}/admin`);
      return response.data;
    } catch (error) {
      console.error('Error fetching admin tokens:', error);
      throw error;
    }
  }
}

export const apiTokenService = new ApiTokenService();
export default apiTokenService;

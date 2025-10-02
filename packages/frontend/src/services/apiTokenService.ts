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
   * Get all API tokens with pagination and filters
   */
  async getTokens(params: GetTokensRequest = {}): Promise<GetTokensResponse> {
    try {
      const response = await api.get('/admin/api-tokens', { params });

      // Backend returns: { success: true, data: { tokens: [...], pagination: {...} } }
      // API service returns the full response, so response.data contains the nested data
      const backendData = response.data; // This is the nested data object from backend

      const result = {
        data: backendData.tokens || [],
        total: backendData.pagination?.total || 0,
        page: backendData.pagination?.page || 1,
        limit: backendData.pagination?.limit || 10
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
  async getTokenById(id: number): Promise<ApiAccessToken> {
    try {
      const response = await api.get(`/admin/api-tokens/${id}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching API token:', error);
      throw error;
    }
  }

  /**
   * Create new API token
   */
  async createToken(data: CreateTokenRequest): Promise<CreateTokenResponse> {
    try {
      const response = await api.post('/admin/api-tokens', data);
      return response.data;
    } catch (error) {
      console.error('Error creating API token:', error);
      throw error;
    }
  }

  /**
   * Update API token
   */
  async updateToken(id: number, data: UpdateTokenRequest): Promise<ApiAccessToken> {
    try {
      const response = await api.put(`/admin/api-tokens/${id}`, data);
      return response.data;
    } catch (error) {
      console.error('Error updating API token:', error);
      throw error;
    }
  }

  /**
   * Regenerate API token (creates new token value)
   */
  async regenerateToken(id: number): Promise<CreateTokenResponse> {
    try {
      const response = await api.post(`/admin/api-tokens/${id}/regenerate`);
      return response.data;
    } catch (error) {
      console.error('Error regenerating API token:', error);
      throw error;
    }
  }

  /**
   * Delete API token
   */
  async deleteToken(id: number): Promise<void> {
    try {
      await api.delete(`/admin/api-tokens/${id}`);
    } catch (error) {
      console.error('Error deleting API token:', error);
      throw error;
    }
  }

  /**
   * Revoke API token (set as inactive)
   */
  async revokeToken(id: number): Promise<ApiAccessToken> {
    try {
      const response = await api.patch(`/admin/api-tokens/${id}/revoke`);
      return response.data;
    } catch (error) {
      console.error('Error revoking API token:', error);
      throw error;
    }
  }

  /**
   * Activate API token
   */
  async activateToken(id: number): Promise<ApiAccessToken> {
    try {
      const response = await api.patch(`/admin/api-tokens/${id}/activate`);
      return response.data;
    } catch (error) {
      console.error('Error activating API token:', error);
      throw error;
    }
  }

  /**
   * Extend token expiration
   */
  async extendToken(id: number, expiresAt: string): Promise<ApiAccessToken> {
    try {
      const response = await api.patch(`/admin/api-tokens/${id}/extend`, { expiresAt });
      return response.data;
    } catch (error) {
      console.error('Error extending API token:', error);
      throw error;
    }
  }

  /**
   * Get token usage statistics
   */
  async getTokenStats(): Promise<{
    totalTokens: number;
    activeTokens: number;
    expiredTokens: number;
    recentlyUsed: number;
  }> {
    try {
      const response = await api.get('/admin/api-tokens/stats');
      return response.data;
    } catch (error) {
      console.error('Error fetching token stats:', error);
      throw error;
    }
  }

  /**
   * Get tokens for specific environment
   */
  async getTokensForEnvironment(environmentId: number): Promise<ApiAccessToken[]> {
    try {
      const response = await api.get(`/admin/api-tokens/environment/${environmentId}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching environment tokens:', error);
      throw error;
    }
  }

  /**
   * Get admin tokens
   */
  async getAdminTokens(): Promise<ApiAccessToken[]> {
    try {
      const response = await api.get('/admin/api-tokens/admin');
      return response.data;
    } catch (error) {
      console.error('Error fetching admin tokens:', error);
      throw error;
    }
  }
}

export const apiTokenService = new ApiTokenService();
export default apiTokenService;

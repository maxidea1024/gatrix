import api from './api';
import {
  ClientCrash,
  CrashDetail,
  CrashInstance,
  CrashStats,
  GetCrashesRequest,
  GetCrashesResponse,
  UpdateCrashStateRequest,
  CrashState
} from '@/types/crash';

class CrashService {
  /**
   * Get all crashes with pagination and filters
   */
  async getCrashes(params: GetCrashesRequest = {}): Promise<GetCrashesResponse> {
    try {
      const response = await api.get('/admin/crashes', { params });
      
      // Backend returns: { success: true, data: { crashes: [...], pagination: {...} } }
      const backendData = response.data;
      
      const result = {
        data: backendData.crashes || [],
        total: backendData.pagination?.total || 0,
        page: backendData.pagination?.page || 1,
        limit: backendData.pagination?.limit || 10,
        totalPages: backendData.pagination?.totalPages || 1
      };
      
      return result;
    } catch (error) {
      console.error('Error fetching crashes:', error);
      throw error;
    }
  }

  /**
   * Get crash by ID with detailed information
   */
  async getCrashById(id: number): Promise<CrashDetail> {
    try {
      const response = await api.get(`/admin/crashes/${id}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching crash details:', error);
      throw error;
    }
  }

  /**
   * Get crash instances for a specific crash
   */
  async getCrashInstances(crashId: number, page = 1, limit = 20): Promise<{
    instances: CrashInstance[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    try {
      const response = await api.get(`/admin/crashes/${crashId}/instances`, {
        params: { page, limit }
      });
      
      const backendData = response.data;
      
      return {
        instances: backendData.instances || [],
        total: backendData.pagination?.total || 0,
        page: backendData.pagination?.page || 1,
        limit: backendData.pagination?.limit || 20,
        totalPages: backendData.pagination?.totalPages || 1
      };
    } catch (error) {
      console.error('Error fetching crash instances:', error);
      throw error;
    }
  }

  /**
   * Get crash statistics
   */
  async getCrashStats(): Promise<CrashStats> {
    try {
      const response = await api.get('/admin/crashes/stats');
      return response.data;
    } catch (error) {
      console.error('Error fetching crash statistics:', error);
      throw error;
    }
  }

  /**
   * Update crash state (open/closed/deleted)
   */
  async updateCrashState(id: number, data: UpdateCrashStateRequest): Promise<ClientCrash> {
    try {
      const response = await api.patch(`/admin/crashes/${id}/state`, data);
      return response.data;
    } catch (error) {
      console.error('Error updating crash state:', error);
      throw error;
    }
  }

  /**
   * Mark crash as closed
   */
  async closeCrash(id: number): Promise<ClientCrash> {
    return this.updateCrashState(id, { state: CrashState.CLOSED });
  }

  /**
   * Mark crash as open
   */
  async openCrash(id: number): Promise<ClientCrash> {
    return this.updateCrashState(id, { state: CrashState.OPEN });
  }

  /**
   * Mark crash as deleted
   */
  async deleteCrash(id: number): Promise<ClientCrash> {
    return this.updateCrashState(id, { state: CrashState.DELETED });
  }

  /**
   * Get crash stack trace content
   */
  async getCrashStackTrace(id: number): Promise<string> {
    try {
      const response = await api.get(`/admin/crashes/${id}/stacktrace`);
      return response.data.stackTrace || '';
    } catch (error) {
      console.error('Error fetching crash stack trace:', error);
      throw error;
    }
  }

  /**
   * Get crash log content
   */
  async getCrashLog(id: number): Promise<string> {
    try {
      const response = await api.get(`/admin/crashes/${id}/log`);
      return response.data.log || '';
    } catch (error) {
      console.error('Error fetching crash log:', error);
      throw error;
    }
  }

  /**
   * Get crash statistics for a specific crash
   */
  async getCrashStatistics(id: number): Promise<{
    versionDistribution: { version: string; count: number }[];
    platformDistribution: { platform: string; count: number }[];
    affectedUsers: number;
    totalInstances: number;
  }> {
    try {
      const response = await api.get(`/admin/crashes/${id}/statistics`);
      return response.data;
    } catch (error) {
      console.error('Error fetching crash statistics:', error);
      throw error;
    }
  }

  /**
   * Search crashes by user nickname or user ID
   */
  async searchCrashes(query: string, page = 1, limit = 10): Promise<GetCrashesResponse> {
    return this.getCrashes({
      search: query,
      page,
      limit
    });
  }

  /**
   * Get crashes by state
   */
  async getCrashesByState(state: CrashState, page = 1, limit = 10): Promise<GetCrashesResponse> {
    return this.getCrashes({
      state,
      page,
      limit
    });
  }

  /**
   * Get recent crashes (last 24 hours)
   */
  async getRecentCrashes(page = 1, limit = 10): Promise<GetCrashesResponse> {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    return this.getCrashes({
      dateFrom: yesterday.toISOString(),
      page,
      limit
    });
  }
}

export const crashService = new CrashService();
export default crashService;

import api from './api';
import {
  ClientCrash,
  CrashDetail,
  CrashEvent,
  CrashStats,
  GetCrashesRequest,
  GetCrashesResponse,
  GetCrashEventsRequest,
  GetCrashEventsResponse,
  UpdateCrashStateRequest,
  UpdateCrashAssigneeRequest,
  UpdateCrashJiraTicketRequest,
  CrashState
} from '@/types/crash';

class CrashService {
  /**
   * Get all crash events with pagination and filters
   */
  async getCrashEvents(params: GetCrashEventsRequest = {}): Promise<GetCrashEventsResponse> {
    try {
      const response = await api.get('/admin/crash-events', { params });

      // Check if response.data is an array (already unwrapped by api service)
      if (Array.isArray(response.data)) {
        // Data is already unwrapped, need to get metadata from response object
        return {
          data: response.data,
          total: (response as any).total || 0,
          page: (response as any).page || 1,
          limit: (response as any).limit || 20,
          totalPages: (response as any).totalPages || 1
        };
      }

      // response.data is the full backend response object
      return {
        data: response.data.data || [],
        total: response.data.total || 0,
        page: response.data.page || 1,
        limit: response.data.limit || 10,
        totalPages: response.data.totalPages || 1
      };
    } catch (error) {
      console.error('Error fetching crash events:', error);
      throw error;
    }
  }

  /**
   * Get all crashes with pagination and filters
   */
  async getCrashes(params: GetCrashesRequest = {}): Promise<GetCrashesResponse> {
    try {
      const response = await api.get('/admin/crashes', { params });

      const backendData = response.data;

      const result = {
        data: backendData.data || backendData.crashes || [],
        total: backendData.total || 0,
        page: backendData.page || 1,
        limit: backendData.limit || 10,
        totalPages: backendData.totalPages || 1
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
  async getCrashById(id: string): Promise<CrashDetail> {
    try {
      const response = await api.get(`/admin/crashes/${id}`);
      return response.data.data || response.data;
    } catch (error) {
      console.error('Error fetching crash details:', error);
      throw error;
    }
  }

  /**
   * Get crash events for a specific crash
   */
  async getCrashEventsByCrashId(crashId: string, limit = 100): Promise<CrashEvent[]> {
    try {
      const response = await api.get(`/admin/crashes/${crashId}/events`, {
        params: { limit }
      });

      return response.data.data || response.data.events || [];
    } catch (error) {
      console.error('Error fetching crash events:', error);
      throw error;
    }
  }

  /**
   * Get crash summary statistics
   */
  async getCrashSummary(): Promise<CrashStats> {
    try {
      const response = await api.get('/admin/crashes/summary');
      return response.data.data || response.data;
    } catch (error) {
      console.error('Error fetching crash summary:', error);
      throw error;
    }
  }

  /**
   * Get crash statistics for a specific crash
   */
  async getCrashStats(id: string): Promise<any> {
    try {
      const response = await api.get(`/admin/crashes/${id}/stats`);
      return response.data.data || response.data;
    } catch (error) {
      console.error('Error fetching crash statistics:', error);
      throw error;
    }
  }

  /**
   * Update crash state
   */
  async updateCrashState(id: string, data: UpdateCrashStateRequest): Promise<void> {
    try {
      await api.patch(`/admin/crashes/${id}/state`, data);
    } catch (error) {
      console.error('Error updating crash state:', error);
      throw error;
    }
  }

  /**
   * Update crash assignee
   */
  async updateCrashAssignee(id: string, data: UpdateCrashAssigneeRequest): Promise<void> {
    try {
      await api.patch(`/admin/crashes/${id}/assignee`, data);
    } catch (error) {
      console.error('Error updating crash assignee:', error);
      throw error;
    }
  }

  /**
   * Update crash Jira ticket
   */
  async updateCrashJiraTicket(id: string, data: UpdateCrashJiraTicketRequest): Promise<void> {
    try {
      await api.patch(`/admin/crashes/${id}/jira`, data);
    } catch (error) {
      console.error('Error updating crash Jira ticket:', error);
      throw error;
    }
  }

  /**
   * Mark crash as closed
   */
  async closeCrash(id: string): Promise<void> {
    return this.updateCrashState(id, { state: CrashState.CLOSED });
  }

  /**
   * Mark crash as open
   */
  async openCrash(id: string): Promise<void> {
    return this.updateCrashState(id, { state: CrashState.OPEN });
  }

  /**
   * Mark crash as resolved
   */
  async resolveCrash(id: string): Promise<void> {
    return this.updateCrashState(id, { state: CrashState.RESOLVED });
  }

  /**
   * Mark crash as deleted
   */
  async deleteCrash(id: string): Promise<void> {
    return this.updateCrashState(id, { state: CrashState.DELETED });
  }

  /**
   * Get filter options
   */
  async getFilterOptions(): Promise<{
    branches: string[];
    platforms: string[];
    environments: string[];
    marketTypes: string[];
    appVersions: string[];
    states: { value: number; label: string }[];
  }> {
    try {
      const response = await api.get('/admin/crash-events/filter-options');
      return response.data.data || response.data;
    } catch (error) {
      console.error('Error fetching filter options:', error);
      throw error;
    }
  }

  /**
   * Search crash events
   */
  async searchCrashEvents(query: string, page = 1, limit = 10): Promise<GetCrashEventsResponse> {
    return this.getCrashEvents({
      search: query,
      page,
      limit
    });
  }

  /**
   * Get recent crash events (last 24 hours)
   */
  async getRecentCrashEvents(page = 1, limit = 10): Promise<GetCrashEventsResponse> {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    return this.getCrashEvents({
      dateFrom: yesterday.toISOString(),
      page,
      limit
    });
  }

  /**
   * Get log file content for a crash event
   */
  async getLogFile(eventId: string): Promise<{ logContent: string; logFilePath: string }> {
    try {
      const response = await api.get(`/admin/crash-events/${eventId}/log`);
      return response.data;
    } catch (error) {
      console.error('Error fetching log file:', error);
      throw error;
    }
  }

  /**
   * Get stack trace for a crash event
   */
  async getStackTrace(eventId: string): Promise<{ stackTrace: string; stackFilePath: string; firstLine?: string }> {
    try {
      const response = await api.get(`/admin/crash-events/${eventId}/stack-trace`);
      return response.data;
    } catch (error) {
      console.error('Error fetching stack trace:', error);
      throw error;
    }
  }
}

export const crashService = new CrashService();
export default crashService;

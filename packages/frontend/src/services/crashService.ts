import api from './api';
import {
  CrashEvent,
  GetCrashEventsRequest,
  GetCrashEventsResponse,
} from '@/types/crash';
import { getStoredTimezone } from '@/utils/dateFormat';

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
      const timezone = getStoredTimezone();
      const response = await api.get(`/admin/crash-events/${eventId}/log`, {
        params: { timezone }
      });
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

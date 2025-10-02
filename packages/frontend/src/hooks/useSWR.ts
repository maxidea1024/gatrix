import useSWR, { SWRConfiguration, SWRResponse, mutate } from 'swr';
import { apiService } from '@/services/api';

// Default fetcher function
const defaultFetcher = async (url: string) => {
  const response = await apiService.get(url);
  if (!response.success) {
    throw new Error(response.error?.message || 'API request failed');
  }
  return response.data;
};

// Custom hook for API requests with SWR
export function useApi<T = any>(
  url: string | null,
  config?: SWRConfiguration
): SWRResponse<T, Error> {
  return useSWR(url, defaultFetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: true,
    shouldRetryOnError: (error: Error) => {
      // Don't retry on 4xx errors
      return !error?.message?.includes('4');
    },
    ...config,
  });
}

// Hook for paginated data
export function usePaginatedApi<T = any>(
  baseUrl: string | null,
  page: number = 1,
  limit: number = 10,
  filters?: Record<string, any>,
  config?: SWRConfiguration
) {
  const params = new URLSearchParams();
  params.append('page', page.toString());
  params.append('limit', limit.toString());
  
  if (filters) {
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params.append(key, value.toString());
      }
    });
  }

  const url = baseUrl ? `${baseUrl}?${params.toString()}` : null;
  
  return useApi<T>(url, config);
}

// Hook for user data
export function useUsers(
  page: number = 1,
  limit: number = 10,
  filters?: {
    role?: string;
    status?: string;
    search?: string;
  },
  config?: SWRConfiguration
) {
  return usePaginatedApi('/admin/users', page, limit, filters, config);
}

// Hook for current user profile
export function useProfile(config?: SWRConfiguration) {
  return useApi<{ user: any }>('/auth/profile', config);
}

// Hook for user statistics
export function useUserStats(config?: SWRConfiguration) {
  return useApi<{
    totalUsers: number;
    activeUsers: number;
    pendingUsers: number;
    adminUsers: number;
  }>('/admin/stats/users', config);
}

// Hook for pending users
export function usePendingUsers(config?: SWRConfiguration) {
  return useApi<{ users: any[] }>('/admin/pending-users', config);
}

// Hook for audit logs
export function useAuditLogs(
  page: number = 1,
  limit: number = 10,
  filters?: {
    user_id?: number;
    action?: string;
    resource_type?: string;
    start_date?: string;
    end_date?: string;
  },
  config?: SWRConfiguration
) {
  return usePaginatedApi('/admin/audit-logs', page, limit, filters, config);
}

// Mutation hooks for common operations
export function useUserMutations() {
  const mutateUsers = () => {
    // Mutate all user-related cache keys
    return Promise.all([
      mutate('/admin/users'),
      mutate('/admin/stats/users'),
      mutate('/admin/pending-users'),
    ]);
  };

  return {
    mutateUsers,
  };
}

// Helper to create optimistic updates
export function createOptimisticUpdate<T>(
  key: string,
  updateFn: (data: T) => T
) {
  return async (asyncFn: () => Promise<any>) => {
    // Get current data from cache (simplified approach)
    const { data: currentData } = useSWR(key, null, { revalidateOnMount: false });

    if (currentData) {
      // Apply optimistic update
      mutate(key, updateFn(currentData), false);
    }

    try {
      // Perform actual update
      const result = await asyncFn();

      // Revalidate to get fresh data
      mutate(key);

      return result;
    } catch (error) {
      // Revert optimistic update on error
      if (currentData) {
        mutate(key, currentData, false);
      }
      throw error;
    }
  };
}

// Hook for infinite loading (useful for large lists)
export function useInfiniteApi<T = any>(
  getKey: (pageIndex: number, previousPageData: T | null) => string | null,
  config?: SWRConfiguration
) {
  return useSWR(getKey, defaultFetcher, config);
}

// Hook for real-time data (with polling)
export function useRealTimeApi<T = any>(
  url: string | null,
  interval: number = 5000,
  config?: SWRConfiguration
) {
  return useApi<T>(url, {
    refreshInterval: interval,
    ...config,
  });
}

// Hook for conditional data fetching
export function useConditionalApi<T = any>(
  url: string | null,
  condition: boolean,
  config?: SWRConfiguration
) {
  return useApi<T>(condition ? url : null, config);
}

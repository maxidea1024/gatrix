/**
 * Service Discovery API Service
 *
 * Client-side service for interacting with service discovery API
 */

import api from './api';

/**
 * Service Ports - Named port mapping
 * Format: { serviceName: port }
 * Example: { game: 7777, internalApi: 8080, externalApi: 8081, metricsApi: 9337 }
 */
export interface ServicePorts {
  [serviceName: string]: number;
}

export interface ServiceLabels {
  service: string; // Required: Service type (e.g., 'world', 'auth')
  group?: string; // Optional: Service group (e.g., 'kr', 'us')
  [key: string]: string | undefined; // Additional custom labels
}

export interface ServiceInstance {
  instanceId: string;
  labels: ServiceLabels; // Replaces type + serviceGroup
  hostname: string;
  externalAddress: string;
  internalAddress: string;
  ports: ServicePorts;
  status: 'initializing' | 'ready' | 'shutting_down' | 'error' | 'terminated' | 'no-response';
  createdAt: string; // Creation time (immutable)
  updatedAt: string; // Last update time
  stats?: Record<string, any>; // Renamed from instanceStats
  meta?: Record<string, any>;
}

export interface ServiceStats {
  total: number;
  byType: Record<string, number>;
  byStatus: Record<string, number>;
}

class ServiceDiscoveryService {
  /**
   * Get all services or services of a specific type
   */
  async getServices(serviceType?: string): Promise<ServiceInstance[]> {
    const params = serviceType ? { serviceType } : {};
    const response = await api.get('/admin/services', { params });
    return response.data;
  }

  /**
   * Get service statistics
   */
  async getServiceStats(): Promise<ServiceStats> {
    const response = await api.get('/admin/services/stats');
    return response.data;
  }

  /**
   * Get service types
   */
  async getServiceTypes(): Promise<string[]> {
    const response = await api.get('/admin/services/types');
    return response.data;
  }

  /**
   * Delete a service instance
   */
  async deleteService(serviceType: string, instanceId: string): Promise<void> {
    await api.delete(`/admin/services/${serviceType}/${instanceId}`);
  }

  /**
   * Clean up all terminated and error services
   */
  async cleanupServices(): Promise<{
    deletedCount: number;
    totalCount: number;
  }> {
    const response = await api.post('/admin/services/cleanup');
    return response.data;
  }

  /**
   * Get cache status summary from a service instance
   * Calls the service's /internal/cache/summary endpoint via backend proxy
   */
  async getCacheSummary(
    serviceType: string,
    instanceId: string
  ): Promise<{
    status: string;
    timestamp?: string;
    lastRefreshedAt?: string | null;
    invalidationCount?: number;
    summary?: Record<string, Record<string, number>>;
    latency?: number;
    error?: string;
  }> {
    const response = await api.get(`/admin/services/${serviceType}/${instanceId}/cache/summary`);
    return response.data;
  }

  /**
   * Get cache status from a service instance (full data)
   * Calls the service's /internal/cache endpoint via backend proxy
   */
  async getCacheStatus(
    serviceType: string,
    instanceId: string
  ): Promise<{
    status: string;
    timestamp?: string;
    lastRefreshedAt?: string | null;
    invalidationCount?: number;
    summary?: Record<string, Record<string, number>>;
    detail?: Record<string, any>;
    latency?: number;
    error?: string;
  }> {
    const response = await api.get(`/admin/services/${serviceType}/${instanceId}/cache`);
    return response.data;
  }

  /**
   * Health check a service instance
   * Pings the service's API port (internalApi/externalApi) /health endpoint
   */
  async healthCheck(
    serviceType: string,
    instanceId: string
  ): Promise<{
    healthy: boolean;
    status: number;
    latency: number;
    response?: any;
    error?: string;
    url: string;
  }> {
    const response = await api.post(`/admin/services/${serviceType}/${instanceId}/health`);
    return response.data;
  }

  /**
   * Get request statistics from a service instance
   * Calls the service's /internal/stats/requests endpoint via backend proxy
   */
  async getRequestStats(
    serviceType: string,
    instanceId: string
  ): Promise<{
    success: boolean;
    data: {
      startTime: string;
      snapshotTime: string;
      uptimeSeconds: number;
      totalRequests: number;
      statusCodes: Record<string, number>;
      endpoints: Record<
        string,
        {
          count: number;
          avgDurationMs: number;
          minDurationMs: number;
          maxDurationMs: number;
          p95DurationMs: number;
          p99DurationMs: number;
          bytesSent: number;
          bytesReceived: number;
        }
      >;
      totals: {
        bytesSent: number;
        bytesReceived: number;
        avgDurationMs: number;
        minDurationMs: number;
        maxDurationMs: number;
      };
    };
    rateLimit: number;
    latency?: number;
    error?: string;
  }> {
    const response = await api.get(`/admin/services/${serviceType}/${instanceId}/stats/requests`);
    return response as any;
  }

  /**
   * Reset request statistics on a service instance
   */
  async resetRequestStats(
    serviceType: string,
    instanceId: string
  ): Promise<{
    success: boolean;
    message: string;
    timestamp: string;
  }> {
    const response = await api.post(
      `/admin/services/${serviceType}/${instanceId}/stats/requests/reset`
    );
    return response.data;
  }

  /**
   * Set request log rate limit on a service instance
   */
  async setRequestLogRateLimit(
    serviceType: string,
    instanceId: string,
    limit: number
  ): Promise<{
    success: boolean;
    rateLimit: number;
    message: string;
  }> {
    const response = await api.post(
      `/admin/services/${serviceType}/${instanceId}/stats/rate-limit`,
      { limit }
    );
    return response.data;
  }

  /**
   * Create SSE connection for real-time updates
   * Safari compatibility: Add timestamp to prevent caching
   */
  createSSEConnection(
    onMessage: (event: { type: string; data: any }) => void,
    onError?: (error: Event) => void
  ): EventSource {
    const token = localStorage.getItem('accessToken');
    // Add timestamp to prevent Safari caching
    const timestamp = Date.now();
    // Use relative URL - Vite proxy will handle it
    const url = `/api/v1/admin/services/sse?token=${token}&t=${timestamp}`;

    const eventSource = new EventSource(url);

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        onMessage(data);
      } catch (error) {
        console.error('Failed to parse SSE message:', error);
      }
    };

    eventSource.onerror = (error) => {
      console.error('SSE connection error:', error);
      if (onError) {
        onError(error);
      }
    };

    return eventSource;
  }
}

export default new ServiceDiscoveryService();

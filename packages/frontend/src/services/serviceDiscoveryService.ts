/**
 * Service Discovery API Service
 *
 * Client-side service for interacting with service discovery API
 */

import api from './api';

export interface ServicePorts {
  tcp?: number[];
  udp?: number[];
  http?: number[];
}

export interface InstanceStats {
  cpuUsage?: number;      // CPU usage percentage (0-100)
  memoryUsage?: number;   // Memory usage in MB
  memoryTotal?: number;   // Total memory in MB
}

export interface ServiceInstance {
  instanceId: string;
  type: string;
  hostname: string;
  externalAddress: string;
  internalAddress: string;
  ports: ServicePorts;
  status: 'initializing' | 'ready' | 'shutting_down' | 'error' | 'terminated';
  updatedAt: string;
  instanceStats?: InstanceStats;
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
  async getServices(type?: string): Promise<ServiceInstance[]> {
    const params = type ? { type } : {};
    const response = await api.get('/admin/services', { params });
    return response.data.data;
  }

  /**
   * Get service statistics
   */
  async getServiceStats(): Promise<ServiceStats> {
    const response = await api.get('/admin/services/stats');
    return response.data.data;
  }

  /**
   * Get service types
   */
  async getServiceTypes(): Promise<string[]> {
    const response = await api.get('/admin/services/types');
    return response.data.data;
  }

  /**
   * Delete a service instance
   */
  async deleteService(type: string, instanceId: string): Promise<void> {
    await api.delete(`/admin/services/${type}/${instanceId}`);
  }

  /**
   * Clean up all terminated and error services
   */
  async cleanupServices(): Promise<{ deletedCount: number; totalCount: number }> {
    const response = await api.post('/admin/services/cleanup');
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


import { apiService } from './api';

export interface ServiceDiscoveryConfig {
  mode: 'redis' | 'etcd';
  etcdHosts: string;
  defaultTtl: number;
  heartbeatInterval: number;
}

/**
 * Service Discovery Configuration Service
 */
class ServiceDiscoveryConfigService {
  /**
   * Get service discovery configuration
   */
  async getConfig(): Promise<ServiceDiscoveryConfig> {
    const response = await apiService.get('/admin/services/config');
    return response.data;
  }

  /**
   * Update service discovery configuration
   */
  async updateConfig(config: Partial<ServiceDiscoveryConfig>): Promise<void> {
    await apiService.put('/admin/services/config', config);
  }
}

export const serviceDiscoveryConfigService = new ServiceDiscoveryConfigService();


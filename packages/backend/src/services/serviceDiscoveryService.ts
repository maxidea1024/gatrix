/**
 * Service Discovery Service
 *
 * Monitoring service for service discovery (Admin only)
 *
 * NOTE: Game servers register directly to etcd/Redis, not via this service
 */

import logger from '../config/logger';
import { ServiceDiscoveryFactory } from './serviceDiscovery/ServiceDiscoveryFactory';
import {
  IServiceDiscoveryProvider,
  ServiceInstance,
  WatchCallback,
} from '../types/serviceDiscovery';

class ServiceDiscoveryService {
  private provider: IServiceDiscoveryProvider;

  constructor() {
    this.provider = ServiceDiscoveryFactory.getInstance();
    logger.info('ServiceDiscoveryService initialized (monitoring mode)');
  }

  /**
   * Get all services or services of a specific type (Admin monitoring)
   */
  async getServices(type?: string): Promise<ServiceInstance[]> {
    return await this.provider.getServices(type);
  }

  /**
   * Get a specific service instance (Admin monitoring)
   */
  async getService(instanceId: string, type: string): Promise<ServiceInstance | null> {
    return await this.provider.getService(instanceId, type);
  }

  /**
   * Watch for service changes (Admin monitoring via SSE)
   */
  async watchServices(callback: WatchCallback): Promise<void> {
    await this.provider.watch(callback);
  }

  /**
   * Unregister a service instance (Admin cleanup)
   */
  async unregister(instanceId: string, type: string): Promise<void> {
    await this.provider.unregister(instanceId, type);
  }

  /**
   * Get service types (unique types from all registered services)
   */
  async getServiceTypes(): Promise<string[]> {
    const services = await this.getServices();
    const types = new Set(services.map(s => s.type));
    return Array.from(types).sort();
  }

  /**
   * Get service statistics
   */
  async getServiceStats(): Promise<{
    total: number;
    byType: Record<string, number>;
    byStatus: Record<string, number>;
  }> {
    const services = await this.getServices();
    
    const byType: Record<string, number> = {};
    const byStatus: Record<string, number> = {};
    
    services.forEach(service => {
      byType[service.type] = (byType[service.type] || 0) + 1;
      byStatus[service.status] = (byStatus[service.status] || 0) + 1;
    });
    
    return {
      total: services.length,
      byType,
      byStatus,
    };
  }

  /**
   * Close service discovery provider
   */
  async close(): Promise<void> {
    await ServiceDiscoveryFactory.close();
    logger.info('ServiceDiscoveryService closed');
  }
}

// Export singleton instance
export default new ServiceDiscoveryService();


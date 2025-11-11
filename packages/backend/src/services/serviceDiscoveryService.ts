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
  UpdateServiceStatusInput,
} from '../types/serviceDiscovery';
import config from '../config';

class ServiceDiscoveryService {
  private provider: IServiceDiscoveryProvider;

  constructor() {
    this.provider = ServiceDiscoveryFactory.getInstance();
    logger.info('ServiceDiscoveryService initialized (monitoring mode)');
  }

  /**
   * Get all active services or services of a specific type and/or group (Admin monitoring)
   */
  async getServices(serviceType?: string, serviceGroup?: string): Promise<ServiceInstance[]> {
    return await this.provider.getServices(serviceType, serviceGroup);
  }

  /**
   * Get all inactive services (terminated, error, no-response) (Admin monitoring)
   */
  async getInactiveServices(serviceType?: string, serviceGroup?: string): Promise<ServiceInstance[]> {
    return await this.provider.getInactiveServices(serviceType, serviceGroup);
  }

  /**
   * Get a specific service instance (Admin monitoring)
   */
  async getService(instanceId: string, serviceType: string): Promise<ServiceInstance | null> {
    return await this.provider.getService(instanceId, serviceType);
  }

  /**
   * Watch for service changes (Admin monitoring via SSE)
   * Returns an unwatch function to remove the callback
   */
  async watchServices(callback: WatchCallback): Promise<() => void> {
    return await this.provider.watch(callback);
  }

  /**
   * Register a service instance (Server SDK)
   * Full snapshot registration
   */
  async register(instance: ServiceInstance): Promise<void> {
    const ttl = config.serviceDiscovery?.heartbeatTTL || 30;
    await this.provider.register(instance, ttl);
    const serviceType = instance.labels.service;
    logger.info(`Service registered: ${serviceType}:${instance.instanceId}`, { labels: instance.labels });
  }

  /**
   * Unregister a service instance (Server SDK or Admin cleanup)
   * @param forceDelete - If true, permanently delete the service. If false, mark as terminated with TTL.
   */
  async unregister(instanceId: string, serviceType: string, forceDelete: boolean = false): Promise<void> {
    await this.provider.unregister(instanceId, serviceType, forceDelete);
  }

  /**
   * Update service status (Server SDK)
   * Partial merge update
   */
  async updateStatus(input: UpdateServiceStatusInput, autoRegisterIfMissing = false): Promise<void> {
    await this.provider.updateStatus(input, autoRegisterIfMissing);
    const serviceType = input.labels.service;
    logger.info(`Service status updated: ${serviceType}:${input.instanceId}`, {
      status: input.status,
      autoRegisterIfMissing
    });
  }

  /**
   * Clean up all inactive services (terminated, error, no-response)
   * Delegates to provider implementation (Redis or etcd)
   */
  async cleanupInactiveServices(): Promise<{ deletedCount: number; serviceTypes: string[] }> {
    // Get inactive services (not active services)
    const inactiveServices = await this.getInactiveServices();

    if (inactiveServices.length === 0) {
      return { deletedCount: 0, serviceTypes: [] };
    }

    // Get unique service types
    const serviceTypes = Array.from(new Set(inactiveServices.map(s => s.labels.service)));

    // Call provider's cleanup method
    return await this.provider.cleanupInactiveServices(serviceTypes);
  }

  /**
   * Get service types (unique types from all registered services)
   */
  async getServiceTypes(): Promise<string[]> {
    const services = await this.getServices();
    const types = new Set(services.map(s => s.labels.service));
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
      const serviceType = service.labels.service;
      byType[serviceType] = (byType[serviceType] || 0) + 1;
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


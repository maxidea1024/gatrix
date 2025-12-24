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
  WatchEvent,
} from '../types/serviceDiscovery';
import config from '../config';
import Environment from '../models/Environment';
import ServerLifecycleEvent from '../models/ServerLifecycleEvent';

class ServiceDiscoveryService {
  private provider: IServiceDiscoveryProvider;
  private lastSeenStatus: Map<string, string> = new Map(); // instanceId -> status

  constructor() {
    this.provider = ServiceDiscoveryFactory.getInstance();
    logger.info('ServiceDiscoveryService initialized (monitoring mode)');

    // Start background event recording
    this.startEventRecording().catch(err => {
      logger.error('Failed to start background event recording:', err);
    });
  }

  /**
   * Start background event recording
   * Watches for all service changes and saves them to the database
   */
  private async startEventRecording(): Promise<void> {
    await this.watchServices(async (event: WatchEvent) => {
      try {
        await this.recordLifecycleEvent(event);
      } catch (err) {
        logger.error('Error recording lifecycle event:', err);
      }
    });

    logger.info('Background event recording started');
  }

  /**
   * Record a lifecycle event to the database
   */
  private async recordLifecycleEvent(event: WatchEvent): Promise<void> {
    const { type, instance } = event;
    const instanceId = instance.instanceId;
    const currentStatus = (instance.status || '').toLowerCase();

    // Handle delete events - clean up tracking and return
    if (type === 'delete') {
      this.lastSeenStatus.delete(instanceId);
      return;
    }

    // Skip recording heartbeats (not a real status change, just keep-alive)
    if (currentStatus === 'heartbeat') {
      return;
    }

    // Only record if status has changed (prevent duplicate READY events during heartbeats)
    const lastStatus = this.lastSeenStatus.get(instanceId);
    if (lastStatus === currentStatus) {
      return;
    }

    const labels = instance.labels;
    const envName = labels.environment || labels.env || 'development';

    // Resolve environment ID
    const env = await Environment.getByName(envName);
    const environmentId = env ? env.id : (await Environment.getDefault())?.id;

    if (!environmentId) {
      logger.warn(`Could not resolve environment for event: ${envName}`, { labels });
      return;
    }

    // Update last seen status if we're going to record
    this.lastSeenStatus.set(instanceId, currentStatus);

    // Determine event type - use actual status as event type
    const eventType = currentStatus.toUpperCase().replace('-', '_'); // e.g., 'ready' -> 'READY', 'no-response' -> 'NO_RESPONSE'

    // Calculate uptime if available
    let uptimeSeconds = 0;
    if (instance.stats?.uptime) {
      uptimeSeconds = Math.floor(Number(instance.stats.uptime));
    } else if (instance.createdAt) {
      const created = new Date(instance.createdAt).getTime();
      const now = new Date().getTime();
      uptimeSeconds = Math.floor((now - created) / 1000);
    }

    // Extract error info
    let errorMessage = instance.stats?.lastError || instance.meta?.terminationError;
    let errorStack: string | undefined;

    if (errorMessage && typeof errorMessage === 'object') {
      errorStack = errorMessage.stack;
      errorMessage = errorMessage.message || errorMessage.toString();
    } else if (instance.stats?.lastErrorStack) {
      errorStack = instance.stats.lastErrorStack;
    }

    await ServerLifecycleEvent.recordEvent({
      environmentId,
      instanceId: instance.instanceId,
      serviceType: labels.service,
      serviceGroup: labels.group,
      hostname: instance.hostname,
      externalAddress: instance.externalAddress,
      internalAddress: instance.internalAddress,
      ports: instance.ports,
      cloudProvider: labels.cloudProvider || instance.meta?.cloudProvider,
      cloudRegion: labels.cloudRegion || instance.meta?.cloudRegion,
      cloudZone: labels.cloudZone || instance.meta?.cloudZone,
      labels: instance.labels,
      appVersion: labels.version || labels.appVersion || instance.meta?.version,
      sdkVersion: labels.sdkVersion || instance.meta?.sdkVersion,
      eventType,
      instanceStatus: instance.status,
      uptimeSeconds,
      heartbeatCount: instance.stats?.heartbeatCount || 0,
      lastHeartbeatAt: instance.updatedAt,
      errorMessage,
      errorStack,
      metadata: {
        stats: instance.stats,
        meta: instance.meta,
      }
    });

    logger.info(`Server lifecycle event recorded: ${labels.service}:${instanceId} -> ${eventType}`);
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
    logger.debug(`Service status updated: ${serviceType}:${input.instanceId}`, {
      status: input.status,
      autoRegisterIfMissing
    });
  }

  /**
   * Detect services with expired leases and mark them as no-response
   * (etcd only - Redis uses keyspace notifications)
   */
  async detectNoResponseServices(): Promise<void> {
    if (this.provider.detectNoResponseServices) {
      await this.provider.detectNoResponseServices();
    }
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
    const serviceTypes = Array.from(new Set(inactiveServices.map((s) => s.labels.service)));

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
   * Start background monitoring (with leader election if supported)
   */
  async startMonitoring(): Promise<void> {
    if (this.provider.startMonitoring) {
      await this.provider.startMonitoring();
    }
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


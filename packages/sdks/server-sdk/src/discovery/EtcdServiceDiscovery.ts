/**
 * etcd Service Discovery Implementation
 */

import { Etcd3, Lease } from 'etcd3';
import { Logger } from '../utils/logger';
import { EtcdConfig } from '../types/config';
import { ServiceInstance, UpdateServiceStatusInput } from '../types/api';
import { IServiceDiscovery } from './ServiceDiscovery';
import { ErrorCode, createError } from '../utils/errors';

export class EtcdServiceDiscovery implements IServiceDiscovery {
  private client: Etcd3;
  private logger: Logger;
  private leases: Map<string, Lease> = new Map();

  constructor(config: EtcdConfig, logger: Logger) {
    this.logger = logger;

    // Parse etcd hosts
    const hosts = config.hosts.split(',').map((host) => host.trim());

    this.client = new Etcd3({
      hosts,
    });

    this.logger.info('etcd client initialized', { hosts });
  }

  /**
   * Register service instance
   */
  async register(instance: ServiceInstance, ttlSeconds: number): Promise<string> {
    try {
      const key = this.getServiceKey(instance.instanceId, instance.type);

      // Create lease with TTL
      const lease = this.client.lease(ttlSeconds);
      const leaseId = await lease.grant();

      this.leases.set(key, lease);

      // Store service instance data with lease
      await this.client.put(key).value(JSON.stringify(instance)).lease(leaseId).exec();

      this.logger.info('Service registered in etcd', {
        instanceId: instance.instanceId,
        type: instance.type,
        key,
        ttl: ttlSeconds,
      });

      return instance.instanceId;
    } catch (error: any) {
      this.logger.error('Failed to register service in etcd', { error: error.message });
      throw createError(
        ErrorCode.SERVICE_DISCOVERY_ERROR,
        `Failed to register service: ${error.message}`,
        undefined,
        error
      );
    }
  }

  /**
   * Send heartbeat (keep-alive)
   */
  async heartbeat(instanceId: string, type: string): Promise<void> {
    try {
      const key = this.getServiceKey(instanceId, type);
      const lease = this.leases.get(key);

      if (!lease) {
        throw new Error('Lease not found for service instance');
      }

      // Keep lease alive
      await lease.keepaliveOnce();

      // Update timestamp
      const instance = await this.getService(instanceId, type);
      if (instance) {
        instance.updatedAt = new Date().toISOString();
        const leaseId = await lease.grant();
        await this.client.put(key).value(JSON.stringify(instance)).lease(leaseId).exec();
      }

      this.logger.debug('Heartbeat sent to etcd', { instanceId, type });
    } catch (error: any) {
      this.logger.error('Failed to send heartbeat to etcd', { error: error.message });
      throw createError(
        ErrorCode.SERVICE_DISCOVERY_ERROR,
        `Failed to send heartbeat: ${error.message}`,
        undefined,
        error
      );
    }
  }

  /**
   * Unregister service instance
   */
  async unregister(instanceId: string, type: string): Promise<void> {
    try {
      const key = this.getServiceKey(instanceId, type);

      // Revoke lease
      const lease = this.leases.get(key);
      if (lease) {
        await lease.revoke();
        this.leases.delete(key);
      }

      // Delete key
      await this.client.delete().key(key).exec();

      this.logger.info('Service unregistered from etcd', { instanceId, type, key });
    } catch (error: any) {
      this.logger.error('Failed to unregister service from etcd', { error: error.message });
      throw createError(
        ErrorCode.SERVICE_DISCOVERY_ERROR,
        `Failed to unregister service: ${error.message}`,
        undefined,
        error
      );
    }
  }

  /**
   * Update service status
   */
  async updateStatus(
    instanceId: string,
    type: string,
    input: UpdateServiceStatusInput
  ): Promise<void> {
    try {
      const key = this.getServiceKey(instanceId, type);
      const instance = await this.getService(instanceId, type);

      if (!instance) {
        throw new Error('Service instance not found');
      }

      // Update instance data
      instance.status = input.status;
      instance.instanceStats = input.instanceStats || instance.instanceStats;
      instance.meta = { ...instance.meta, ...input.meta };
      instance.updatedAt = new Date().toISOString();

      const lease = this.leases.get(key);
      if (lease) {
        const leaseId = await lease.grant();
        await this.client.put(key).value(JSON.stringify(instance)).lease(leaseId).exec();
      } else {
        await this.client.put(key).value(JSON.stringify(instance)).exec();
      }

      this.logger.info('Service status updated in etcd', {
        instanceId,
        type,
        status: input.status,
      });
    } catch (error: any) {
      this.logger.error('Failed to update service status in etcd', { error: error.message });
      throw createError(
        ErrorCode.SERVICE_DISCOVERY_ERROR,
        `Failed to update service status: ${error.message}`,
        undefined,
        error
      );
    }
  }

  /**
   * Get all services or services of a specific type
   */
  async getServices(type?: string): Promise<ServiceInstance[]> {
    try {
      const prefix = type ? `/services/${type}/` : '/services/';
      const result = await this.client.getAll().prefix(prefix).strings();

      const instances: ServiceInstance[] = [];

      for (const [key, value] of Object.entries(result)) {
        try {
          const instance = JSON.parse(value) as ServiceInstance;
          instances.push(instance);
        } catch (error) {
          this.logger.warn('Failed to parse service instance', { key, error });
        }
      }

      this.logger.debug('Services retrieved from etcd', {
        type,
        count: instances.length,
      });

      return instances;
    } catch (error: any) {
      this.logger.error('Failed to get services from etcd', { error: error.message });
      throw createError(
        ErrorCode.SERVICE_DISCOVERY_ERROR,
        `Failed to get services: ${error.message}`,
        undefined,
        error
      );
    }
  }

  /**
   * Get a specific service instance
   */
  async getService(instanceId: string, type: string): Promise<ServiceInstance | null> {
    try {
      const key = this.getServiceKey(instanceId, type);
      const value = await this.client.get(key).string();

      if (!value) {
        return null;
      }

      const instance = JSON.parse(value) as ServiceInstance;

      this.logger.debug('Service retrieved from etcd', { instanceId, type });

      return instance;
    } catch (error: any) {
      this.logger.error('Failed to get service from etcd', { error: error.message });
      return null;
    }
  }

  /**
   * Close etcd client
   */
  async close(): Promise<void> {
    // Revoke all leases
    for (const [key, lease] of this.leases.entries()) {
      try {
        await lease.revoke();
      } catch (error) {
        this.logger.warn('Failed to revoke lease', { key, error });
      }
    }

    this.leases.clear();
    this.client.close();

    this.logger.info('etcd client closed');
  }

  /**
   * Get service key for etcd
   */
  private getServiceKey(instanceId: string, type: string): string {
    return `/services/${type}/${instanceId}`;
  }
}


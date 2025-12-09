/**
 * etcd-based Service Discovery Provider
 *
 * Implements service discovery using etcd as the backend store
 * Requires: npm install etcd3
 */

import logger from '../../config/logger';
import config from '../../config';
import {
  IServiceDiscoveryProvider,
  ServiceInstance,
  WatchCallback,
  UpdateServiceStatusInput,
} from '../../types/serviceDiscovery';
import redisClient from '../../config/redis';

// Dynamic import to make etcd3 optional
let Etcd3: any;

try {
  const etcd3Module = require('etcd3');
  Etcd3 = etcd3Module.Etcd3;
} catch (error) {
  logger.warn('etcd3 module not found. Install with: npm install etcd3');
}

export class EtcdServiceDiscoveryProvider implements IServiceDiscoveryProvider {
  private client: any; // Etcd3 instance
  private leases: Map<string, any> = new Map(); // Map<string, Lease>
  private watchers: any[] = [];
  private election: any; // Election campaign
  private monitorInterval: NodeJS.Timeout | null = null;

  constructor(hosts: string) {
    if (!Etcd3) {
      throw new Error('etcd3 module is not installed. Install with: npm install etcd3');
    }

    // Parse hosts string and convert to etcd3 format
    // Input: "http://etcd:2379" or "http://etcd:2379,http://etcd2:2379"
    // etcd3 expects hosts as array of strings like "etcd:2379"
    const hostArray = hosts.split(',').map(h => {
      const trimmed = h.trim();
      // Remove protocol if present
      const withoutProtocol = trimmed.replace(/^https?:\/\//, '');
      return withoutProtocol;
    });

    this.client = new Etcd3({ hosts: hostArray });
    logger.info(`EtcdServiceDiscoveryProvider initialized with hosts: ${JSON.stringify(hostArray)}`);
  }

  async register(instance: ServiceInstance, ttlSeconds: number): Promise<void> {
    const serviceType = instance.labels.service;
    const key = this.getInstanceKey(serviceType, instance.instanceId);

    try {
      // Disable autoKeepAlive - SDK is responsible for sending heartbeat via /api/v1/server/services/status
      // This prevents stale service instances from being kept alive when SDK restarts without unregistering
      // Add safety buffer (+10s) to lease TTL to allow detection agent to see the expired heartbeat before key is deleted
      const lease = this.client.lease(ttlSeconds + 10, { autoKeepAlive: false });
      const now = new Date().toISOString();

      // Ensure createdAt is set
      const instanceData = {
        ...instance,
        createdAt: instance.createdAt || now,
        updatedAt: instance.updatedAt || now,
      };

      await lease.put(key).value(JSON.stringify(instanceData));
      this.leases.set(`${serviceType}:${instance.instanceId}`, lease);

      // Note: No auto-heartbeat here. SDK/client is responsible for sending heartbeat via /api/v1/server/services/status
      // which will call the heartbeat() method below to renew the lease.

      logger.info(`Service registered: ${serviceType}:${instance.instanceId}`, { labels: instance.labels });
    } catch (error) {
      logger.error(`Failed to register service ${serviceType}:${instance.instanceId}:`, error);
      throw error;
    }
  }

  async heartbeat(instanceId: string, serviceType: string): Promise<void> {
    const key = this.getInstanceKey(serviceType, instanceId);
    const leaseKey = `${serviceType}:${instanceId}`;
    let lease = this.leases.get(leaseKey);

    // Check if service exists and is in inactive state
    try {
      const value = await this.client.get(key).string();
      if (!value) {
        logger.warn(`Service not found for heartbeat: ${serviceType}:${instanceId}`);
        return;
      }

      const instance: ServiceInstance = JSON.parse(value);
      if (instance.status === 'terminated' || instance.status === 'error' || instance.status === 'no-response') {
        logger.warn(
          `Ignoring heartbeat for inactive service: ${serviceType}:${instanceId} (current status: ${instance.status})`,
        );
        return;
      }

      const heartbeatTTL = config?.serviceDiscovery?.heartbeatTTL || 30;

      if (lease) {
        // Renew existing lease
        try {
          await lease.keepaliveOnce();
        } catch (error) {
          // Lease may have expired, create new one
          logger.warn(`Lease expired for ${leaseKey}, creating new lease`);
          lease = this.client.lease(heartbeatTTL + 10, { autoKeepAlive: false });
          instance.updatedAt = new Date().toISOString();
          await lease.put(key).value(JSON.stringify(instance));
          this.leases.set(leaseKey, lease);
        }
      } else {
        // No lease in memory (backend restarted), create new lease with TTL
        logger.debug(`Creating new lease for heartbeat: ${leaseKey}`);
        lease = this.client.lease(heartbeatTTL + 10, { autoKeepAlive: false });
        instance.updatedAt = new Date().toISOString();
        await lease.put(key).value(JSON.stringify(instance));
        this.leases.set(leaseKey, lease);
      }
    } catch (error) {
      logger.error(`Heartbeat failed for ${serviceType}:${instanceId}:`, error);
      throw error;
    }
  }

  async unregister(instanceId: string, serviceType: string, forceDelete: boolean = false): Promise<void> {
    const key = this.getInstanceKey(serviceType, instanceId);
    const leaseKey = `${serviceType}:${instanceId}`;
    const lease = this.leases.get(leaseKey);

    try {
      if (forceDelete) {
        // Force delete: immediately remove the key
        if (lease) {
          // Revoke lease (this will delete the key)
          await lease.revoke();
          this.leases.delete(leaseKey);
        } else {
          // Manually delete if no lease found
          await this.client.delete().key(key);
        }

        logger.info(`Service deleted permanently: ${serviceType}:${instanceId}`);
      } else {
        // Graceful unregister
        // Move to Redis as inactive with TTL, then remove from Etcd
        const currentValue = await this.client.get(key).string();
        if (currentValue) {
          try {
            const serviceData = JSON.parse(currentValue);

            // Update status to terminated
            serviceData.status = 'terminated';
            serviceData.updatedAt = new Date().toISOString();

            // Save to Redis with TTL
            await this.saveInactiveToRedis(serviceData);

            // Remove from Etcd
            if (lease) {
              await lease.revoke();
              this.leases.delete(leaseKey);
            } else {
              await this.client.delete().key(key);
            }

            logger.info(`Service moved to inactive (Redis): ${serviceType}:${instanceId}`);
          } catch (parseError) {
            logger.warn(`Failed to parse service data for ${serviceType}:${instanceId}, deleting instead:`, parseError);
            if (lease) {
              await lease.revoke();
              this.leases.delete(leaseKey);
            } else {
              await this.client.delete().key(key);
            }
          }
        } else {
          // Service not found, cleaning up local lease
          if (lease) {
            await lease.revoke();
            this.leases.delete(leaseKey);
          }
        }
      }
    } catch (error) {
      logger.error(`Failed to unregister service ${serviceType}:${instanceId}:`, error);
      throw error;
    }
  }

  async updateStatus(input: UpdateServiceStatusInput, autoRegisterIfMissing = false): Promise<void> {
    const serviceType = input.labels.service;
    const key = this.getInstanceKey(serviceType, input.instanceId);
    const leaseKey = `${serviceType}:${input.instanceId}`;
    let lease = this.leases.get(leaseKey);

    try {
      const value = await this.client.get(key).string();

      if (!value) {
        if (autoRegisterIfMissing) {
          // Auto-register: create new instance
          const now = new Date().toISOString();
          const newInstance: ServiceInstance = {
            instanceId: input.instanceId,
            labels: input.labels,
            hostname: '',
            externalAddress: '',
            internalAddress: '',
            ports: {}, // Empty ports for auto-registered instance
            status: input.status || 'ready',
            createdAt: now,
            updatedAt: now,
            stats: input.stats || {},
          };

          // Create new lease with configured TTL
          const heartbeatTTL = config?.serviceDiscovery?.heartbeatTTL || 30;
          lease = this.client.lease(heartbeatTTL + 10, { autoKeepAlive: false });
          await lease.put(key).value(JSON.stringify(newInstance));
          this.leases.set(leaseKey, lease);

          logger.info(`Service auto-registered: ${serviceType}:${input.instanceId}`);
          return;
        } else {
          throw new Error(`Service ${serviceType}:${input.instanceId} not found`);
        }
      }

      // Partial merge: update only provided fields
      const instance: ServiceInstance = JSON.parse(value);

      // Ignore updates for inactive services (terminated, error, no-response)
      if (instance.status === 'terminated' || instance.status === 'error' || instance.status === 'no-response') {
        logger.warn(
          `Ignoring updateStatus for inactive service: ${serviceType}:${input.instanceId} (current status: ${instance.status})`,
        );
        return;
      }

      if (input.status !== undefined) {
        instance.status = input.status;
      }

      if (input.stats !== undefined) {
        // Merge stats (not replace)
        instance.stats = { ...instance.stats, ...input.stats };
      }

      instance.updatedAt = new Date().toISOString();

      // For terminated/error servers, move to Redis and delete from Etcd
      if (instance.status === 'terminated' || instance.status === 'error') {
        const terminatedTTL = config?.serviceDiscovery?.terminatedTTL || 300;

        // Save to Redis
        await this.saveInactiveToRedis(instance);

        // Delete from Etcd
        if (lease) {
          try {
            await lease.revoke();
            this.leases.delete(leaseKey);
          } catch (error) {
            logger.warn(`Failed to revoke lease for ${leaseKey}:`, error);
          }
        } else {
          await this.client.delete().key(key);
        }

        logger.debug(`Service moved to inactive (Redis): ${serviceType}:${input.instanceId} -> ${instance.status}`);
        // Return early since it's removed from Etcd
        return;
      } else {
        // For other statuses (ready, etc.)
        const heartbeatTTL = config?.serviceDiscovery?.heartbeatTTL || 30;

        if (lease) {
          // Renew existing lease and update value
          try {
            await lease.keepaliveOnce();
            await lease.put(key).value(JSON.stringify(instance));
          } catch (error) {
            // Lease may have expired, create new one
            logger.warn(`Lease expired for ${leaseKey}, creating new lease`);
            const newLease = this.client.lease(heartbeatTTL + 10, { autoKeepAlive: false });
            await newLease.put(key).value(JSON.stringify(instance));
            this.leases.set(leaseKey, newLease);
          }
        } else {
          // No lease in memory (backend restarted), create new lease with TTL
          logger.debug(`Creating new lease for ${leaseKey} (no existing lease in memory)`);
          const newLease = this.client.lease(heartbeatTTL + 10, { autoKeepAlive: false });
          await newLease.put(key).value(JSON.stringify(instance));
          this.leases.set(leaseKey, newLease);
        }

        logger.debug(`Service status updated: ${serviceType}:${input.instanceId} -> ${instance.status}`);
      }
    } catch (error) {
      logger.error(`Failed to update status for ${serviceType}:${input.instanceId}:`, error);
      throw error;
    }
  }

  async getServices(serviceType?: string, serviceGroup?: string): Promise<ServiceInstance[]> {
    let instances: ServiceInstance[] = [];

    try {
      // 1. Get Active services from Etcd
      const prefix = serviceType ? this.getTypePrefix(serviceType) : '/services/';
      const keys = await this.client.getAll().prefix(prefix).keys();

      for (const key of keys) {
        const value = await this.client.get(key).string();
        if (value) {
          instances.push(JSON.parse(value));
        }
      }

      // 2. Get Inactive services from Redis
      const inactiveInstances = await this.getInactiveFromRedis(serviceType);
      instances = [...instances, ...inactiveInstances];

      // Filter by serviceGroup if specified
      if (serviceGroup) {
        instances = instances.filter(instance => instance.labels.group === serviceGroup);
      }

      // Sort by createdAt (ascending - oldest first, newest last)
      instances.sort((a, b) => {
        const aTime = new Date(a.createdAt).getTime();
        const bTime = new Date(b.createdAt).getTime();
        return aTime - bTime;
      });

      return instances;
    } catch (error) {
      logger.error('Failed to get services:', error);
      throw error;
    }
  }

  async getInactiveServices(serviceType?: string, serviceGroup?: string): Promise<ServiceInstance[]> {
    // In new hybrid mode, get inactive from Redis
    try {
      let inactiveServices = await this.getInactiveFromRedis(serviceType);

      if (serviceGroup) {
        inactiveServices = inactiveServices.filter(s => s.labels?.group === serviceGroup);
      }

      return inactiveServices;
    } catch (error) {
      logger.error('Failed to get inactive services:', error);
      return [];
    }
  }

  async getService(instanceId: string, serviceType: string): Promise<ServiceInstance | null> {
    const key = this.getInstanceKey(serviceType, instanceId);

    try {
      const value = await this.client.get(key).string();
      return value ? JSON.parse(value) : null;
    } catch (error) {
      logger.error(`Failed to get service ${serviceType}:${instanceId}:`, error);
      throw error;
    }
  }

  async watch(callback: WatchCallback): Promise<() => void> {
    try {
      const watcher = await this.client.watch().prefix('/services/').create();

      watcher.on('put', (kv: any) => {
        try {
          const instance: ServiceInstance = JSON.parse(kv.value.toString());
          callback({ type: 'put', instance });
        } catch (error) {
          logger.error('Failed to parse put event:', error);
        }
      });

      watcher.on('delete', (kv: any) => {
        try {
          // Parse key to extract serviceType and id
          const key = kv.key.toString();
          const parts = key.split('/');
          const serviceType = parts[2];
          const id = parts[3];

          // Emit a minimal instance object for delete events to satisfy typing
          const now = new Date().toISOString();
          callback({
            type: 'delete',
            instance: {
              instanceId: id,
              labels: { service: serviceType },
              hostname: '',
              externalAddress: '',
              internalAddress: '',
              ports: {}, // Empty ports for deleted instance
              status: 'terminated',
              createdAt: now,
              updatedAt: now,
            } as ServiceInstance,
          });
        } catch (error) {
          logger.error('Failed to parse delete event:', error);
        }
      });

      this.watchers.push(watcher);
      logger.info('Started watching service changes');

      // Return unwatch function
      return async () => {
        await watcher.cancel();
        const index = this.watchers.indexOf(watcher);
        if (index > -1) {
          this.watchers.splice(index, 1);
        }
        logger.info('Watcher cancelled');
      };
    } catch (error) {
      logger.error('Failed to start watching:', error);
      throw error;
    }
  }

  /**
   * Detect services that stopped sending heartbeats and mark them as no-response.
   * Detection is based on updatedAt vs configured heartbeat TTL.
   */
  async detectNoResponseServices(): Promise<void> {
    try {
      const heartbeatTTL = config?.serviceDiscovery?.heartbeatTTL || 30;
      const now = Date.now();

      // Get all services (active + inactive)
      const allServices = await this.getServices();

      for (const service of allServices) {
        try {
          // Skip already inactive services
          if (service.status === 'terminated' || service.status === 'error' || service.status === 'no-response') {
            continue;
          }

          if (!service.updatedAt) {
            continue;
          }

          const updatedAtMs = new Date(service.updatedAt).getTime();
          if (!updatedAtMs || Number.isNaN(updatedAtMs)) {
            continue;
          }

          const diffSeconds = (now - updatedAtMs) / 1000;
          if (diffSeconds <= heartbeatTTL) {
            continue;
          }

          const leaseKey = `${service.labels.service}:${service.instanceId}`;
          const key = this.getInstanceKey(service.labels.service, service.instanceId);

          logger.warn(
            `Service no-response detected (no heartbeat for ${diffSeconds.toFixed(
              1,
            )}s): ${service.labels.service}:${service.instanceId}`,
          );

          // Mark as no-response
          service.status = 'no-response';
          service.updatedAt = new Date(now).toISOString();

          // Move to Redis
          await this.saveInactiveToRedis(service);

          // Remove from Etcd
          const existingLease = this.leases.get(leaseKey);
          if (existingLease) {
            try {
              await existingLease.revoke();
              this.leases.delete(leaseKey);
            } catch (error) {
              logger.warn(`Failed to revoke lease for ${leaseKey} while marking no-response:`, error);
            }
          } else {
            await this.client.delete().key(key);
          }

          logger.info(
            `Service moved to inactive (Redis, no-response): ${service.labels.service}:${service.instanceId}`,
          );
        } catch (error) {
          logger.error(
            `Failed to process service for no-response detection: ${service.labels.service}:${service.instanceId}`,
            error,
          );
        }
      }
    } catch (error) {
      logger.error('Failed to detect no-response services:', error);
    }
  }

  /**
   * Clean up all inactive services (terminated, error, no-response)
   * Only delete services that have been inactive longer than terminated TTL.
   */
  async cleanupInactiveServices(serviceTypes: string[]): Promise<{ deletedCount: number; serviceTypes: string[] }> {
    // With Hybrid Redis approach, cleanup is automated by Redis TTL.
    // However, we might want to ensure consistency or clean up stragglers in Etcd if any.
    // For now, we mainly rely on Redis TTL.
    return { deletedCount: 0, serviceTypes };
  }

  /**
   * Start background monitoring with Leader Election
   * Only the elected leader will perform finding unresponsive services and cleanup
   */
  async startMonitoring(): Promise<void> {
    try {
      // Create election campaign
      this.election = this.client.election('/election/service-monitor');

      // Listen for election events
      this.election.on('elected', () => {
        logger.info('👑 Backend Elected as Service Discovery Monitor Leader');

        // Start monitoring loop
        this.monitorInterval = setInterval(async () => {
          try {
            await this.detectNoResponseServices();

            const inactiveServices = await this.getInactiveServices();
            if (inactiveServices.length > 0) {
              await this.cleanupInactiveServices([]);
            }
          } catch (error) {
            logger.error('Monitor loop failed:', error);
          }
        }, 5000);
      });

      this.election.on('error', (err: any) => {
        logger.error('Election error:', err);
      });

      // Campaign for leadership
      logger.info('Campaigning for Service Discovery Monitor leadership...');
      await this.election.campaign(config.admin.name || 'backend-node');

    } catch (error) {
      logger.error('Failed to start monitoring campaign:', error);
      // Fallback: If election fails completely, maybe run without election? 
      // For now, let's just log error to avoid dangerous double-writes if etcd is unstable
    }
  }

  async close(): Promise<void> {
    // Clear all heartbeat intervals
    this.leases.forEach((lease) => {
      if ((lease as any)._heartbeatInterval) {
        clearInterval((lease as any)._heartbeatInterval);
      }
    });

    // Revoke all leases
    for (const [key, lease] of this.leases.entries()) {
      try {
        await lease.revoke();
      } catch (error) {
        logger.error(`Failed to revoke lease ${key}:`, error);
      }
    }
    this.leases.clear();

    // Close watchers
    this.watchers.forEach(watcher => {
      try {
        watcher.cancel();
      } catch (error) {
        logger.error('Failed to cancel watcher:', error);
      }
    });
    this.watchers = [];

    // Close client
    this.client.close();

    // Stop monitoring if running
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = null;
    }

    // Resign from election
    if (this.election) {
      try {
        await this.election.resign();
      } catch (error) {
        logger.warn('Failed to resign from election:', error);
      }
    }

    logger.info('EtcdServiceDiscoveryProvider closed');
  }

  // Helper methods
  private getInstanceKey(type: string, id: string): string {
    return `/services/${type}/${id}`;
  }

  private getTypePrefix(type: string): string {
    return `/services/${type}/`;
  }

  // Redis interactions
  private async saveInactiveToRedis(instance: ServiceInstance): Promise<void> {
    const client = redisClient.getClient();
    if (!client) return;

    const ttl = config?.serviceDiscovery?.terminatedTTL || 300;
    const key = `service-discovery:inactive:${instance.labels.service}:${instance.instanceId}`;

    await client.set(key, JSON.stringify(instance), { EX: ttl });
  }

  private async getInactiveFromRedis(serviceType?: string): Promise<ServiceInstance[]> {
    const client = redisClient.getClient();
    if (!client) return [];

    const pattern = serviceType
      ? `service-discovery:inactive:${serviceType}:*`
      : `service-discovery:inactive:*:*`;

    const instances: ServiceInstance[] = [];

    // Scan keys
    const keys: string[] = [];
    for await (const key of client.scanIterator({ MATCH: pattern, COUNT: 100 })) {
      keys.push(key);
    }

    if (keys.length === 0) return [];

    // MGET values
    // Redis MGET requires keys spread arguments in some clients, or array in others. 
    // node-redis v4 .mGet accepts array.
    const values = await client.mGet(keys);

    for (const val of values) {
      if (val) {
        try {
          instances.push(JSON.parse(val));
        } catch (e) {
          logger.warn('Failed to parse inactive service from Redis', e);
        }
      }
    }

    return instances;
  }
}


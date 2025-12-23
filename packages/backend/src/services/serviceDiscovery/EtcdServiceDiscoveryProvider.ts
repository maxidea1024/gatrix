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
  private watchCallbacks: Set<WatchCallback> = new Set();
  private campaign: any; // Election Campaign
  private monitorInterval: NodeJS.Timeout | null = null;
  private redisKeyspaceSubscriber: any = null; // Redis subscriber for keyspace events

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
      // Add safety buffer (+60s) to lease TTL to allow detection agent to see the expired heartbeat before key is deleted
      // If buffer is too small (e.g. 10s), the key might expire before the monitoring loop (5s interval) catches it
      const lease = this.client.lease(ttlSeconds + 60, { autoKeepAlive: false });
      const now = new Date().toISOString();

      // Ensure createdAt is set
      const instanceData = {
        ...instance,
        createdAt: instance.createdAt || now,
        updatedAt: instance.updatedAt || now,
      };

      await lease.put(key).value(JSON.stringify(instanceData));
      this.leases.set(`${serviceType}:${instance.instanceId}`, lease);

      // Mirror to Redis for delete event fallback (when prevKv is not available)
      await this.saveMirrorToRedis(instanceData);

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

            // Publish update event (terminated) BEFORE deleting from Etcd
            // This ensures UI sees the state change to 'terminated' instead of removal
            this.broadcastEvent({
              type: 'put',
              instance: serviceData
            });

            // Remove from Etcd
            if (lease) {
              await lease.revoke();
              this.leases.delete(leaseKey);
            } else {
              await this.client.delete().key(key);
            }

            logger.info(`Service moved to inactive (Redis) and event published: ${serviceType}:${instanceId}`);
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
          // Auto-register: try to restore from Redis mirror first to preserve externalAddress, hostname, ports, etc.
          const mirrorData = await this.getMirrorFromRedis(serviceType, input.instanceId);
          const now = new Date().toISOString();

          let newInstance: ServiceInstance;
          if (mirrorData) {
            // Restore from mirror with updated status
            newInstance = {
              ...mirrorData,
              status: input.status || 'ready',
              updatedAt: now,
              stats: input.stats || mirrorData.stats || {},
            };
            logger.info(`Service auto-registered from mirror: ${serviceType}:${input.instanceId}`, {
              externalAddress: newInstance.externalAddress,
              hostname: newInstance.hostname,
            });
          } else {
            // Create minimal instance (no mirror available)
            newInstance = {
              instanceId: input.instanceId,
              labels: input.labels,
              hostname: '',
              externalAddress: '',
              internalAddress: '',
              ports: {},
              status: input.status || 'ready',
              createdAt: now,
              updatedAt: now,
              stats: input.stats || {},
            };
            logger.info(`Service auto-registered (no mirror): ${serviceType}:${input.instanceId}`);
          }

          // Create new lease with configured TTL
          const heartbeatTTL = config?.serviceDiscovery?.heartbeatTTL || 30;
          lease = this.client.lease(heartbeatTTL + 10, { autoKeepAlive: false });
          await lease.put(key).value(JSON.stringify(newInstance));
          this.leases.set(leaseKey, lease);

          // Mirror to Redis for future recovery
          await this.saveMirrorToRedis(newInstance);

          return;
        } else {
          const error: any = new Error(`Service ${serviceType}:${input.instanceId} not found`);
          error.status = 404;
          throw error;
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
        const inactiveKeepTTL = config?.serviceDiscovery?.inactiveKeepTTL || 60;

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
            const newLease = this.client.lease(heartbeatTTL + 60, { autoKeepAlive: false });
            await newLease.put(key).value(JSON.stringify(instance));
            this.leases.set(leaseKey, newLease);
          }
        } else {
          // No lease in memory (backend restarted), create new lease with TTL
          logger.debug(`Creating new lease for ${leaseKey} (no existing lease in memory)`);
          const newLease = this.client.lease(heartbeatTTL + 60, { autoKeepAlive: false });
          await newLease.put(key).value(JSON.stringify(instance));
          this.leases.set(leaseKey, newLease);
        }

        // Mirror to Redis for delete event fallback (when prevKv is not available)
        await this.saveMirrorToRedis(instance);

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
    this.watchCallbacks.add(callback);

    try {
      // Create watcher for service changes
      const watcher = await this.client.watch().prefix('/services/').create();

      watcher.on('put', (kv: any) => {
        try {
          const instance: ServiceInstance = JSON.parse(kv.value.toString());
          callback({ type: 'put', instance });
        } catch (error) {
          logger.error('Failed to parse put event:', error);
        }
      });

      watcher.on('delete', async (kv: any, previous: any) => {
        try {
          logger.info('Etcd delete event received', {
            hasKv: !!kv,
            kvKeys: kv ? Object.keys(kv) : [],
            hasPrevious: !!previous,
            previousKeys: previous ? Object.keys(previous) : [],
            kvString: JSON.stringify(kv),
            // Avoid stringifying previous if it's too large, or stringify it safely
            previousString: previous ? JSON.stringify(previous) : 'undefined'
          });

          // Parse key to extract serviceType and id
          const key = kv.key.toString();
          const parts = key.split('/');
          const serviceType = parts[2];
          const id = parts[3];

          // Check if this service exists in Redis inactive list
          const inactiveKey = `service-discovery:inactive:${serviceType}:${id}`;
          const client = redisClient.getClient();

          if (client) {
            const exists = await client.exists(inactiveKey);
            if (exists) {
              // Already in inactive list, skip delete event
              logger.debug(`Skipping delete event for ${serviceType}:${id} (already in inactive list)`);
              return;
            }

            // Not in inactive list - this means the service disappeared without proper unregister
            // (e.g., Lease TTL expired due to crash or network issue)
            // Use 'previous' argument (second argument from etcd3 library)
            const now = new Date().toISOString();
            let instanceData: ServiceInstance;

            if (previous && previous.value) {
              try {
                // Use previous value to preserve metadata
                instanceData = JSON.parse(previous.value.toString());
                instanceData.status = 'no-response';
                instanceData.updatedAt = now;
                logger.info(`Service disappeared (using etcd prevKv): ${serviceType}:${id}`);
              } catch (parseError) {
                logger.warn(`Failed to parse previous for ${serviceType}:${id}, trying Redis mirror`);
                // Try to get from Redis mirror
                const mirrorData = await this.getMirrorFromRedis(serviceType, id);
                if (mirrorData) {
                  instanceData = { ...mirrorData, status: 'no-response', updatedAt: now };
                  logger.info(`Service disappeared (using Redis mirror): ${serviceType}:${id}`);
                } else {
                  instanceData = {
                    instanceId: id,
                    labels: { service: serviceType },
                    hostname: 'unknown',
                    externalAddress: '',
                    internalAddress: '',
                    ports: {},
                    status: 'no-response',
                    createdAt: now,
                    updatedAt: now,
                  };
                }
              }
            } else {
              // No previous value available from etcd, try Redis mirror first
              const mirrorData = await this.getMirrorFromRedis(serviceType, id);
              if (mirrorData) {
                instanceData = { ...mirrorData, status: 'no-response', updatedAt: now };
                logger.info(`Service disappeared (using Redis mirror, no prevKv): ${serviceType}:${id}`);
              } else {
                // Fallback to minimal instance
                logger.warn(`No previous data for ${serviceType}:${id} (no etcd prevKv, no Redis mirror), using minimal data`);
                instanceData = {
                  instanceId: id,
                  labels: { service: serviceType },
                  hostname: 'unknown',
                  externalAddress: '',
                  internalAddress: '',
                  ports: {},
                  status: 'no-response',
                  createdAt: now,
                  updatedAt: now,
                };
              }
            }

            // Save to Redis with TTL
            await this.saveInactiveToRedis(instanceData);

            // Broadcast 'put' event with no-response status
            callback({
              type: 'put',
              instance: instanceData,
            });
          }
        } catch (error) {
          logger.error('Failed to handle delete event:', error);
        }
      });

      this.watchers.push(watcher);
      logger.info('Started watching etcd service changes');

      // Also subscribe to Redis keyspace events for inactive service TTL expiration
      await this.setupRedisKeyspaceSubscription();

      // Return unwatch function
      return async () => {
        this.watchCallbacks.delete(callback);
        await watcher.cancel();
        const index = this.watchers.indexOf(watcher);
        if (index > -1) {
          this.watchers.splice(index, 1);
        }
        logger.info('Watcher cancelled');
      };
    } catch (error) {
      // Don't delete callback - keep it for broadcastEvent to work even if watch fails
      logger.error('Failed to start watching:', error);

      // Still setup Redis keyspace subscription even if etcd watch fails
      await this.setupRedisKeyspaceSubscription();

      // Return a no-op unwatch function instead of throwing
      return async () => {
        this.watchCallbacks.delete(callback);
        logger.info('Watcher callback removed (watch had failed)');
      };
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

          // Publish update event (no-response) BEFORE deleting from Etcd
          this.broadcastEvent({
            type: 'put',
            instance: service
          });

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
   * Deletes inactive services from Redis immediately (bypassing TTL wait).
   */
  async cleanupInactiveServices(serviceTypes: string[]): Promise<{ deletedCount: number; serviceTypes: string[] }> {
    const client = redisClient.getClient();
    if (!client) {
      logger.warn('Redis client not available for cleanup');
      return { deletedCount: 0, serviceTypes };
    }

    let totalDeletedCount = 0;
    const affectedServiceTypes: string[] = [];

    try {
      // Get all inactive services from Redis
      const inactiveServices = await this.getInactiveFromRedis();

      if (inactiveServices.length === 0) {
        logger.info('No inactive services to clean up');
        return { deletedCount: 0, serviceTypes: [] };
      }

      // Delete each inactive service
      for (const service of inactiveServices) {
        try {
          const serviceType = service.labels.service;
          const instanceId = service.instanceId;
          const key = `service-discovery:inactive:${serviceType}:${instanceId}`;

          // Delete from Redis
          await client.del(key);
          totalDeletedCount++;

          // Track affected service types
          if (!affectedServiceTypes.includes(serviceType)) {
            affectedServiceTypes.push(serviceType);
          }

          // Broadcast delete event to SSE clients
          this.broadcastEvent({
            type: 'delete',
            instance: service,
          });

          logger.info(`🗑️ Cleaned up inactive service: ${serviceType}:${instanceId}`);
        } catch (error) {
          logger.error(`Failed to cleanup service ${service.labels.service}:${service.instanceId}:`, error);
        }
      }

      logger.info(`✅ Cleanup complete: ${totalDeletedCount} inactive services deleted`);
    } catch (error) {
      logger.error('Failed to cleanup inactive services:', error);
    }

    return { deletedCount: totalDeletedCount, serviceTypes: affectedServiceTypes };
  }

  /**
   * Start background monitoring with Leader Election
   * Only the elected leader will perform finding unresponsive services and cleanup
   */
  async startMonitoring(): Promise<void> {
    try {
      // Create election instance
      const election = this.client.election('/election/service-monitor');

      // Start campaigning and get Campaign object
      const campaignValue = `backend-${Date.now()}`;
      this.campaign = election.campaign(campaignValue);
      logger.info('Started campaigning for Service Discovery Monitor Leader');

      // Listen for elected event on Campaign object
      this.campaign.on('elected', () => {
        logger.info('👑 Backend Elected as Service Discovery Monitor Leader');

        // Start monitoring loop
        // Only detect no-response services - cleanup is done via TTL expiration or manual cleanup
        this.monitorInterval = setInterval(async () => {
          try {
            await this.detectNoResponseServices();
            // Note: Inactive services are cleaned up automatically via Redis TTL expiration
            // Manual cleanup is available via the admin API endpoint
          } catch (error) {
            logger.error('Error in monitoring loop:', error);
          }
        }, 5000); // Check every 5 seconds
      });

      this.campaign.on('error', (err: any) => {
        logger.error('Election campaign error:', err);
        // Stop monitoring if campaign fails
        if (this.monitorInterval) {
          clearInterval(this.monitorInterval);
          this.monitorInterval = null;
        }
      });
    } catch (error) {
      logger.error('Failed to start monitoring:', error);
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

    // Resign from election campaign
    if (this.campaign) {
      try {
        await this.campaign.resign();
      } catch (error) {
        logger.warn('Failed to resign from election campaign:', error);
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

  /**
   * Mirror active service data to Redis.
   * This is used as a fallback when etcd delete event doesn't have prevKv.
   * Only mirrors when inactiveKeepTTL > 0 (i.e., inactive services should be displayed).
   * TTL is set to heartbeatTTL * 3 to ensure data persists long enough for delete event handling.
   */
  private async saveMirrorToRedis(instance: ServiceInstance): Promise<void> {
    // Only mirror if inactiveKeepTTL > 0 (inactive services should be displayed)
    const inactiveKeepTTL = parseInt(process.env.SERVICE_DISCOVERY_INACTIVE_KEEP_TTL || '60', 10);
    if (inactiveKeepTTL <= 0) return;

    const client = redisClient.getClient();
    if (!client) return;

    const heartbeatTTL = config?.serviceDiscovery?.heartbeatTTL || 30;
    // Set TTL to 3x heartbeat TTL + 60s buffer to ensure data persists
    // even after lease expires (which has +60s buffer itself)
    const mirrorTTL = heartbeatTTL * 3 + 120;
    const key = `service-discovery:mirror:${instance.labels.service}:${instance.instanceId}`;

    await client.set(key, JSON.stringify(instance), { EX: mirrorTTL });
    logger.debug(`Mirrored service to Redis with TTL ${mirrorTTL}s: ${key}`);
  }

  /**
   * Get mirrored service data from Redis.
   * Returns null if not found.
   */
  private async getMirrorFromRedis(serviceType: string, instanceId: string): Promise<ServiceInstance | null> {
    const client = redisClient.getClient();
    if (!client) return null;

    const key = `service-discovery:mirror:${serviceType}:${instanceId}`;
    const value = await client.get(key);

    if (value) {
      try {
        return JSON.parse(value);
      } catch (e) {
        logger.warn(`Failed to parse mirror data for ${serviceType}:${instanceId}`, e);
      }
    }
    return null;
  }

  /**
   * Delete mirrored service data from Redis.
   */
  private async deleteMirrorFromRedis(serviceType: string, instanceId: string): Promise<void> {
    const client = redisClient.getClient();
    if (!client) return;

    const key = `service-discovery:mirror:${serviceType}:${instanceId}`;
    await client.del(key);
    logger.debug(`Deleted mirror from Redis: ${key}`);
  }

  private async saveInactiveToRedis(instance: ServiceInstance): Promise<void> {
    const client = redisClient.getClient();
    if (!client) return;

    // Read TTL directly from environment variable to avoid config initialization issues
    const ttl = parseInt(process.env.SERVICE_DISCOVERY_INACTIVE_KEEP_TTL || '60', 10);
    const key = `service-discovery:inactive:${instance.labels.service}:${instance.instanceId}`;

    await client.set(key, JSON.stringify(instance), { EX: ttl });
    logger.debug(`Saved inactive service to Redis with TTL ${ttl}s: ${key}`);

    // Also delete the mirror since service is now inactive
    await this.deleteMirrorFromRedis(instance.labels.service, instance.instanceId);
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

  private broadcastEvent(event: any) {
    logger.info(`📢 Broadcasting event to ${this.watchCallbacks.size} SSE clients:`, {
      type: event.type,
      instanceId: event.instance?.instanceId,
      status: event.instance?.status,
    });
    this.watchCallbacks.forEach(cb => {
      try {
        cb(event);
      } catch (e) {
        logger.error('Error in watch callback:', e);
      }
    });
  }

  /**
   * Setup Redis keyspace subscription for inactive service TTL expiration.
   * When an inactive service's TTL expires, a 'delete' event is broadcasted to SSE clients.
   */
  private async setupRedisKeyspaceSubscription(): Promise<void> {
    if (this.redisKeyspaceSubscriber) {
      // Already subscribed
      return;
    }

    try {
      const client = redisClient.getClient();
      if (!client) {
        logger.warn('Redis client not available for keyspace subscription');
        return;
      }

      // Create a duplicate connection for pub/sub (ioredis requirement)
      this.redisKeyspaceSubscriber = client.duplicate();
      await this.redisKeyspaceSubscriber.connect();

      // Subscribe to keyspace expired events
      await this.redisKeyspaceSubscriber.pSubscribe('__keyevent@0__:expired', async (message: string, channel: string) => {
        try {
          // Check if this is an inactive service key
          // Format: service-discovery:inactive:{serviceType}:{instanceId}
          if (message.startsWith('service-discovery:inactive:')) {
            const parts = message.replace('service-discovery:inactive:', '').split(':');
            if (parts.length === 2) {
              const [serviceType, instanceId] = parts;

              logger.info(`Inactive service TTL expired: ${serviceType}:${instanceId}`);

              // Broadcast delete event to SSE clients
              this.broadcastEvent({
                type: 'delete',
                instance: {
                  instanceId,
                  labels: { service: serviceType },
                  hostname: '',
                  externalAddress: '',
                  internalAddress: '',
                  ports: {},
                  status: 'terminated',
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                } as ServiceInstance,
              });
            }
          }
        } catch (error) {
          logger.error('Failed to handle Redis keyspace expired event:', error);
        }
      });

      logger.info('Redis keyspace subscription started for inactive service expiration');
    } catch (error) {
      logger.error('Failed to setup Redis keyspace subscription:', error);
    }
  }
}


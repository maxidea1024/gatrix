/**
 * Redis-based Service Discovery Provider
 *
 * Implements service discovery using Redis as the backend store
 */

import Redis from 'ioredis';
import logger from '../../config/logger';
import config from '../../config';
import {
  IServiceDiscoveryProvider,
  ServiceInstance,
  WatchCallback,
  WatchEvent,
  UpdateServiceStatusInput,
} from '../../types/serviceDiscovery';

export class RedisServiceDiscoveryProvider implements IServiceDiscoveryProvider {
  private client: Redis;
  private subscriber: Redis;
  private heartbeatIntervals: Map<string, ReturnType<typeof setInterval>> = new Map();
  private watchCallbacks: Set<WatchCallback> = new Set();
  private isWatching = false;
  private trackedServices: Map<string, ServiceInstance> = new Map();

  constructor(host: string, port: number, password?: string, db?: number) {
    this.client = new Redis({
      host,
      port,
      password: password || undefined,
      db: db || 0,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
    });

    this.subscriber = new Redis({
      host,
      port,
      password: password || undefined,
      db: db || 0,
    });

    this.client.on('error', (error) => {
      logger.error('Redis client error in ServiceDiscovery:', error);
    });

    this.subscriber.on('error', (error) => {
      logger.error('Redis subscriber error in ServiceDiscovery:', error);
    });

    logger.info('RedisServiceDiscoveryProvider initialized');
  }

  async register(instance: ServiceInstance, ttlSeconds: number): Promise<void> {
    const serviceType = instance.labels.service;
    const metaKey = this.getMetaKey(serviceType, instance.instanceId);
    const statKey = this.getStatKey(serviceType, instance.instanceId);

    try {
      // Separate meta (immutable) and stat (mutable) data
      const meta = {
        instanceId: instance.instanceId,
        labels: instance.labels,
        hostname: instance.hostname,
        externalAddress: instance.externalAddress,
        internalAddress: instance.internalAddress,
        ports: instance.ports,
        meta: instance.meta, // Static metadata
      };

      const stat = {
        status: instance.status,
        updatedAt: instance.updatedAt,
        stats: instance.stats || {},
      };

      // Store meta without TTL (permanent until explicitly deleted)
      await this.client.set(metaKey, JSON.stringify(meta));

      // Store stat with TTL (auto-cleanup on heartbeat timeout)
      await this.client.set(statKey, JSON.stringify(stat), 'EX', ttlSeconds);

      // Add to type set
      await this.client.sadd(this.getTypeSetKey(serviceType), instance.instanceId);

      // Publish event (merge meta + stat for compatibility)
      await this.publishEvent({
        type: 'put',
        instance,
      });

      // Setup auto-heartbeat
      const interval = setInterval(async () => {
        try {
          await this.heartbeat(instance.instanceId, serviceType);
        } catch (error) {
          logger.error(`Heartbeat failed for ${serviceType}:${instance.instanceId}:`, error);
        }
      }, (ttlSeconds / 2) * 1000);

      this.heartbeatIntervals.set(`${serviceType}:${instance.instanceId}`, interval);

      logger.info(`Service registered: ${serviceType}:${instance.instanceId}`, { labels: instance.labels });
    } catch (error) {
      logger.error(`Failed to register service ${serviceType}:${instance.instanceId}:`, error);
      throw error;
    }
  }

  async heartbeat(instanceId: string, serviceType: string): Promise<void> {
    const statKey = this.getStatKey(serviceType, instanceId);

    try {
      const value = await this.client.get(statKey);
      if (value) {
        const stat = JSON.parse(value);
        stat.updatedAt = new Date().toISOString();

        // Renew TTL with configured heartbeat TTL (not based on remaining TTL)
        const heartbeatTTL = config?.serviceDiscovery?.heartbeatTTL || 30;
        await this.client.set(statKey, JSON.stringify(stat), 'EX', heartbeatTTL);
      } else {
        logger.warn(`Service ${serviceType}:${instanceId} not found or expired`);
      }
    } catch (error) {
      logger.error(`Heartbeat failed for ${serviceType}:${instanceId}:`, error);
      throw error;
    }
  }

  async unregister(instanceId: string, serviceType: string, forceDelete: boolean = false): Promise<void> {
    const metaKey = this.getMetaKey(serviceType, instanceId);
    const statKey = this.getStatKey(serviceType, instanceId);

    try {
      // Get meta and stat before deleting/updating
      const metaValue = await this.client.get(metaKey);
      const statValue = await this.client.get(statKey);

      if (forceDelete) {
        // Force delete: completely remove meta and stat keys
        if (metaValue && statValue) {
          const meta = JSON.parse(metaValue);
          const stat = JSON.parse(statValue);

          // Delete both keys
          await this.client.del(metaKey);
          await this.client.del(statKey);

          // Publish delete event
          const instance: ServiceInstance = { ...meta, ...stat };
          await this.publishEvent({
            type: 'delete',
            instance: {
              ...instance,
              status: 'terminated',
              updatedAt: new Date().toISOString(),
            },
          });

          logger.info(`Service deleted permanently: ${serviceType}:${instanceId}`);
        }
      } else {
        // Graceful unregister: mark as terminated with TTL
        if (metaValue && statValue) {
          const meta = JSON.parse(metaValue);
          const stat = JSON.parse(statValue);

          // Update status to terminated with configured TTL
          stat.status = 'terminated';
          stat.updatedAt = new Date().toISOString();

          // Debug: log config
          logger.debug('Config check in unregister:', {
            hasConfig: !!config,
            hasServiceDiscovery: !!config?.serviceDiscovery,
            terminatedTTL: config?.serviceDiscovery?.terminatedTTL
          });

          const ttl = config?.serviceDiscovery?.terminatedTTL || 300;
          await this.client.set(statKey, JSON.stringify(stat), 'EX', ttl);

          // Publish update event (merge meta + stat for compatibility)
          const instance: ServiceInstance = { ...meta, ...stat };
          await this.publishEvent({
            type: 'put',
            instance,
          });

          logger.info(`Service marked as terminated: ${serviceType}:${instanceId} (will be removed in ${ttl}s)`);
        }
      }

      // Remove from type set if not found
      if (!metaValue || !statValue) {
        await this.client.srem(this.getTypeSetKey(serviceType), instanceId);
      }

      // Clear heartbeat interval
      const intervalKey = `${serviceType}:${instanceId}`;
      const interval = this.heartbeatIntervals.get(intervalKey);
      if (interval) {
        clearInterval(interval);
        this.heartbeatIntervals.delete(intervalKey);
      }
    } catch (error) {
      logger.error(`Failed to unregister service ${serviceType}:${instanceId}:`, error);
      throw error;
    }
  }

  /**
   * Update service status (partial merge)
   * @param input - Partial update input (only changed fields)
   * @param autoRegisterIfMissing - Auto-register if instance doesn't exist
   */
  async updateStatus(input: UpdateServiceStatusInput, autoRegisterIfMissing = false): Promise<void> {
    const serviceType = input.labels.service;
    const metaKey = this.getMetaKey(serviceType, input.instanceId);
    const statKey = this.getStatKey(serviceType, input.instanceId);

    try {
      const metaValue = await this.client.get(metaKey);

      if (!metaValue) {
        if (autoRegisterIfMissing) {
          // Auto-register: create new instance with provided data
          if (!input.hostname || !input.internalAddress || !input.ports) {
            throw new Error(`Auto-register requires hostname, internalAddress, and ports fields`);
          }

          const meta = {
            instanceId: input.instanceId,
            labels: input.labels,
            hostname: input.hostname,
            externalAddress: '', // Will be set by controller from req.ip
            internalAddress: input.internalAddress,
            ports: input.ports,
            meta: input.meta || {},
          };

          const stat = {
            status: input.status || 'ready',
            updatedAt: new Date().toISOString(),
            stats: input.stats || {},
          };

          // Store meta without TTL (permanent)
          await this.client.set(metaKey, JSON.stringify(meta));

          // Store stat with TTL
          const heartbeatTTL = config?.serviceDiscovery?.heartbeatTTL || 30;
          await this.client.set(statKey, JSON.stringify(stat), 'EX', heartbeatTTL);

          // Add to type set
          await this.client.sadd(this.getTypeSetKey(serviceType), input.instanceId);

          // Publish event (merge meta + stat for compatibility)
          const instance: ServiceInstance = { ...meta, ...stat };
          await this.publishEvent({
            type: 'put',
            instance,
          });

          logger.info(`Service auto-registered: ${serviceType}:${input.instanceId}`, { labels: input.labels });
          return;
        } else {
          throw new Error(`Service ${serviceType}:${input.instanceId} not found`);
        }
      }

      // Update stat only (meta is immutable)
      const statValue = await this.client.get(statKey);
      const stat = statValue ? JSON.parse(statValue) : {};

      if (input.status !== undefined) {
        stat.status = input.status;
      }

      if (input.stats !== undefined) {
        // Merge stats (not replace)
        stat.stats = { ...stat.stats, ...input.stats };
      }

      stat.updatedAt = new Date().toISOString();

      // Use configured TTL based on status
      const heartbeatTTL = config?.serviceDiscovery?.heartbeatTTL || 30;
      const terminatedTTL = config?.serviceDiscovery?.terminatedTTL || 300;

      let ttl: number;
      if (stat.status === 'terminated' || stat.status === 'error') {
        ttl = terminatedTTL; // Configured TTL for auto-cleanup
      } else {
        ttl = heartbeatTTL; // Always use configured heartbeat TTL
      }

      await this.client.set(statKey, JSON.stringify(stat), 'EX', ttl);

      // Publish update event (merge meta + stat for compatibility)
      const meta = JSON.parse(metaValue);
      const instance: ServiceInstance = { ...meta, ...stat };
      await this.publishEvent({
        type: 'put',
        instance,
      });

      logger.debug(`Service status updated: ${serviceType}:${input.instanceId} -> ${stat.status} (TTL: ${ttl}s)`);
    } catch (error) {
      logger.error(`Failed to update status for ${serviceType}:${input.instanceId}:`, error);
      throw error;
    }
  }

  async getServices(serviceType?: string, serviceGroup?: string): Promise<ServiceInstance[]> {
    let instances: ServiceInstance[] = [];

    try {
      if (serviceType) {
        // Get all instances of a specific type
        const ids = await this.client.smembers(this.getTypeSetKey(serviceType));
        for (const id of ids) {
          const instance = await this.getService(id, serviceType);
          if (instance) {
            instances.push(instance);
          }
        }
      } else {
        // Get all instances by scanning meta keys
        const metaKeys = await this.client.keys('services:*:meta:*');
        for (const metaKey of metaKeys) {
          // Extract serviceType and instanceId from key: services:{type}:meta:{id}
          const parts = metaKey.split(':');
          if (parts.length === 4) {
            const type = parts[1];
            const id = parts[3];
            const instance = await this.getService(id, type);
            if (instance) {
              instances.push(instance);
            }
          }
        }
      }

      // Filter by serviceGroup if specified
      if (serviceGroup) {
        instances = instances.filter(instance => instance.labels.group === serviceGroup);
      }

      return instances;
    } catch (error) {
      logger.error('Failed to get services:', error);
      throw error;
    }
  }

  async getService(instanceId: string, serviceType: string): Promise<ServiceInstance | null> {
    const metaKey = this.getMetaKey(serviceType, instanceId);
    const statKey = this.getStatKey(serviceType, instanceId);

    try {
      const metaValue = await this.client.get(metaKey);
      const statValue = await this.client.get(statKey);

      if (!metaValue) {
        return null; // Service not found
      }

      const meta = JSON.parse(metaValue);
      const stat = statValue ? JSON.parse(statValue) : {
        status: 'terminated', // If stat is missing, assume terminated
        updatedAt: new Date().toISOString(),
        stats: {},
      };

      // Merge meta + stat
      return { ...meta, ...stat };
    } catch (error) {
      logger.error(`Failed to get service ${serviceType}:${instanceId}:`, error);
      throw error;
    }
  }

  async watch(callback: WatchCallback): Promise<() => void> {
    this.watchCallbacks.add(callback);
    logger.info(`Watch callback added (total: ${this.watchCallbacks.size})`);

    if (!this.isWatching) {
      logger.info('Starting Redis watch - subscribing to keyspace events');

      // Load existing services into trackedServices (meta + stat)
      const metaKeys = await this.client.keys('services:*:meta:*');
      for (const metaKey of metaKeys) {
        const metaValue = await this.client.get(metaKey);
        if (metaValue) {
          try {
            const meta = JSON.parse(metaValue);
            const serviceType = meta.labels.service;
            const instanceId = meta.instanceId;

            // Get corresponding stat
            const statKey = this.getStatKey(serviceType, instanceId);
            const statValue = await this.client.get(statKey);

            if (statValue) {
              const stat = JSON.parse(statValue);
              const instance: ServiceInstance = { ...meta, ...stat };
              const trackedKey = `${serviceType}:${instanceId}`;
              this.trackedServices.set(trackedKey, instance);
            }
          } catch (error) {
            logger.warn(`Failed to parse service data for key ${metaKey}:`, error);
          }
        }
      }
      logger.info(`Loaded ${this.trackedServices.size} existing services into tracker`);

      // Subscribe to custom events channel (published by register/updateStatus/unregister)
      await this.subscriber.subscribe('service:events');
      logger.info('Subscribed to service:events channel');

      // Handle regular messages (custom events channel)
      this.subscriber.on('message', (channel, message) => {
        if (channel === 'service:events') {
          try {
            const event: WatchEvent = JSON.parse(message);
            const serviceType = event.instance.labels.service;
            logger.debug(`Received custom service event: ${event.type} for ${serviceType}:${event.instance.instanceId}`);

            // Track services for TTL expiration detection
            if (event.type === 'put') {
              this.trackedServices.set(
                `${serviceType}:${event.instance.instanceId}`,
                event.instance
              );
            } else if (event.type === 'delete') {
              this.trackedServices.delete(
                `${serviceType}:${event.instance.instanceId}`
              );
            }

            logger.info(`Broadcasting custom event to ${this.watchCallbacks.size} callbacks: ${event.type} ${serviceType}:${event.instance.instanceId}`);
            this.watchCallbacks.forEach(cb => cb(event));
          } catch (error) {
            logger.error('Failed to parse custom watch event:', error);
          }
        }
      });

      // Subscribe to keyspace expired events for stat keys
      await this.subscriber.psubscribe('__keyevent@0__:expired');
      logger.info('Subscribed to keyspace expired events');

      // Handle keyspace expired events
      this.subscriber.on('pmessage', async (pattern, channel, message) => {
        if (pattern === '__keyevent@0__:expired' && message.startsWith('services:') && message.includes(':stat:')) {
          try {
            // Extract service type and instance ID from expired stat key
            // Format: services:{type}:stat:{id}
            const parts = message.split(':');
            if (parts.length === 4 && parts[2] === 'stat') {
              const serviceType = parts[1];
              const instanceId = parts[3];
              const trackedKey = `${serviceType}:${instanceId}`;

              const instance = this.trackedServices.get(trackedKey);
              if (instance) {
                this.trackedServices.delete(trackedKey);

                // Publish delete event
                await this.publishEvent({
                  type: 'delete',
                  instance: {
                    ...instance,
                    status: 'terminated',
                    updatedAt: new Date().toISOString(),
                  },
                });

                logger.info(`Service expired (TTL): ${serviceType}:${instanceId}`);
              }
            }
          } catch (error) {
            logger.error('Failed to handle expired event:', error);
          }
        }
      });

      this.isWatching = true;
      logger.info('Redis watch started successfully (custom events + keyspace expired events)');
    }

    // Return unwatch function
    return () => {
      this.watchCallbacks.delete(callback);
      logger.info(`Watch callback removed (total: ${this.watchCallbacks.size})`);
    };
  }

  async close(): Promise<void> {
    // Clear all heartbeat intervals
    this.heartbeatIntervals.forEach(interval => clearInterval(interval));
    this.heartbeatIntervals.clear();

    // Clear tracked services
    this.trackedServices.clear();

    // Close connections
    await this.client.quit();
    await this.subscriber.quit();

    logger.info('RedisServiceDiscoveryProvider closed');
  }

  // Helper methods
  /**
   * Get Redis key for service instance metadata (immutable)
   */
  private getMetaKey(serviceType: string, instanceId: string): string {
    return `services:${serviceType}:meta:${instanceId}`;
  }

  /**
   * Get Redis key for service instance status (mutable, with TTL)
   */
  private getStatKey(serviceType: string, instanceId: string): string {
    return `services:${serviceType}:stat:${instanceId}`;
  }

  /**
   * @deprecated Use getMetaKey and getStatKey instead
   */
  private getInstanceKey(serviceType: string, id: string): string {
    return `services:${serviceType}:${id}`;
  }

  private getTypeSetKey(serviceType: string): string {
    return `services:type:${serviceType}`;
  }

  private async publishEvent(event: WatchEvent): Promise<void> {
    try {
      const serviceType = event.instance.labels.service;
      const subscribers = await this.client.publish('service:events', JSON.stringify(event));
      logger.info(`Published ${event.type} event for ${serviceType}:${event.instance.instanceId} to ${subscribers} subscribers`);
    } catch (error) {
      logger.error('Failed to publish event:', error);
    }
  }
}


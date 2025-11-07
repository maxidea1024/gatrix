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
  ServiceStatus,
  WatchCallback,
  WatchEvent,
} from '../../types/serviceDiscovery';

export class RedisServiceDiscoveryProvider implements IServiceDiscoveryProvider {
  private client: Redis;
  private subscriber: Redis;
  private heartbeatIntervals: Map<string, ReturnType<typeof setInterval>> = new Map();
  private watchCallbacks: Set<WatchCallback> = new Set();
  private isWatching = false;
  private ttlCheckInterval: ReturnType<typeof setInterval> | null = null;
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
    const key = this.getInstanceKey(instance.type, instance.instanceId);

    try {
      // Store instance data with TTL
      await this.client.set(key, JSON.stringify(instance), 'EX', ttlSeconds);

      // Add to type set
      await this.client.sadd(this.getTypeSetKey(instance.type), instance.instanceId);

      // Publish event
      await this.publishEvent({
        type: 'put',
        instance,
      });

      // Setup auto-heartbeat
      const interval = setInterval(async () => {
        try {
          await this.heartbeat(instance.instanceId, instance.type);
        } catch (error) {
          logger.error(`Heartbeat failed for ${instance.type}:${instance.instanceId}:`, error);
        }
      }, (ttlSeconds / 2) * 1000);

      this.heartbeatIntervals.set(`${instance.type}:${instance.instanceId}`, interval);

      logger.info(`Service registered: ${instance.type}:${instance.instanceId}`);
    } catch (error) {
      logger.error(`Failed to register service ${instance.type}:${instance.instanceId}:`, error);
      throw error;
    }
  }

  async heartbeat(instanceId: string, type: string): Promise<void> {
    const key = this.getInstanceKey(type, instanceId);
    
    try {
      const ttl = await this.client.ttl(key);
      
      if (ttl > 0) {
        const value = await this.client.get(key);
        if (value) {
          const instance: ServiceInstance = JSON.parse(value);
          instance.updatedAt = new Date().toISOString();
          
          // Renew TTL (double the remaining TTL to ensure it doesn't expire)
          await this.client.set(key, JSON.stringify(instance), 'EX', Math.max(ttl * 2, 30));
        }
      } else {
        logger.warn(`Service ${type}:${instanceId} not found or expired`);
      }
    } catch (error) {
      logger.error(`Heartbeat failed for ${type}:${instanceId}:`, error);
      throw error;
    }
  }

  async unregister(instanceId: string, type: string): Promise<void> {
    const key = this.getInstanceKey(type, instanceId);

    try {
      // Get instance before updating
      const value = await this.client.get(key);

      if (value) {
        const instance: ServiceInstance = JSON.parse(value);

        // Update status to terminated with configured TTL (same as etcd)
        // This allows users to see terminated/error servers before cleanup
        instance.status = 'terminated';
        instance.updatedAt = new Date().toISOString();

        await this.client.set(key, JSON.stringify(instance), 'EX', config.serviceDiscovery.terminatedTTL);

        // Publish update event (status changed to terminated)
        await this.publishEvent({
          type: 'put',
          instance,
        });

        logger.info(`Service marked as terminated: ${type}:${instanceId} (will be removed in 5 minutes)`);
      } else {
        // If not found, just remove from type set
        await this.client.srem(this.getTypeSetKey(type), instanceId);
      }

      // Clear heartbeat interval
      const intervalKey = `${type}:${instanceId}`;
      const interval = this.heartbeatIntervals.get(intervalKey);
      if (interval) {
        clearInterval(interval);
        this.heartbeatIntervals.delete(intervalKey);
      }
    } catch (error) {
      logger.error(`Failed to unregister service ${type}:${instanceId}:`, error);
      throw error;
    }
  }

  async updateStatus(
    instanceId: string,
    type: string,
    status: ServiceStatus,
    instanceStats?: any,
    meta?: Record<string, any>
  ): Promise<void> {
    const key = this.getInstanceKey(type, instanceId);

    try {
      const value = await this.client.get(key);
      if (!value) {
        throw new Error(`Service ${type}:${instanceId} not found`);
      }

      const instance: ServiceInstance = JSON.parse(value);
      instance.status = status;
      instance.updatedAt = new Date().toISOString();
      if (instanceStats !== undefined) {
        instance.instanceStats = instanceStats;
      }
      if (meta !== undefined) {
        instance.meta = meta;
      }

      // Use configured TTL for terminated/error servers, otherwise keep existing TTL
      let ttl = await this.client.ttl(key);
      if (status === 'terminated' || status === 'error') {
        ttl = config.serviceDiscovery.terminatedTTL; // Configured TTL for auto-cleanup
      } else {
        ttl = Math.max(ttl, config.serviceDiscovery.heartbeatTTL);
      }

      await this.client.set(key, JSON.stringify(instance), 'EX', ttl);

      // Publish update event
      await this.publishEvent({
        type: 'put',
        instance,
      });

      logger.debug(`Service status updated: ${type}:${instanceId} -> ${status} (TTL: ${ttl}s)`);
    } catch (error) {
      logger.error(`Failed to update status for ${type}:${instanceId}:`, error);
      throw error;
    }
  }

  async getServices(type?: string): Promise<ServiceInstance[]> {
    const instances: ServiceInstance[] = [];
    
    try {
      if (type) {
        // Get all instances of a specific type
        const ids = await this.client.smembers(this.getTypeSetKey(type));
        for (const id of ids) {
          const value = await this.client.get(this.getInstanceKey(type, id));
          if (value) {
            instances.push(JSON.parse(value));
          }
        }
      } else {
        // Get all instances
        const keys = await this.client.keys('services:*');
        for (const key of keys) {
          // Skip type set keys
          if (key.startsWith('services:type:')) {
            continue;
          }
          const value = await this.client.get(key);
          if (value) {
            instances.push(JSON.parse(value));
          }
        }
      }
      
      return instances;
    } catch (error) {
      logger.error('Failed to get services:', error);
      throw error;
    }
  }

  async getService(instanceId: string, type: string): Promise<ServiceInstance | null> {
    const key = this.getInstanceKey(type, instanceId);
    
    try {
      const value = await this.client.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      logger.error(`Failed to get service ${type}:${instanceId}:`, error);
      throw error;
    }
  }

  async watch(callback: WatchCallback): Promise<void> {
    this.watchCallbacks.add(callback);
    logger.info(`Watch callback added (total: ${this.watchCallbacks.size})`);

    if (!this.isWatching) {
      logger.info('Starting Redis watch - subscribing to keyspace events');

      // Load existing services into trackedServices
      const keys = await this.client.keys('services:*');
      for (const key of keys) {
        const value = await this.client.get(key);
        if (value) {
          try {
            const instance: ServiceInstance = JSON.parse(value);
            const trackedKey = `${instance.type}:${instance.instanceId}`;
            this.trackedServices.set(trackedKey, instance);
          } catch (error) {
            logger.warn(`Failed to parse service data for key ${key}:`, error);
          }
        }
      }
      logger.info(`Loaded ${this.trackedServices.size} existing services into tracker`);

      // Subscribe to keyspace events for services:* pattern
      // Pattern: __keyspace@0__:services:*
      await this.subscriber.psubscribe('__keyspace@0__:services:*');

      // Also subscribe to custom events channel for backward compatibility
      await this.subscriber.subscribe('service:events');

      // Handle pattern-based messages (keyspace notifications)
      this.subscriber.on('pmessage', async (pattern, channel, message) => {
        try {
          // channel format: __keyspace@0__:services:type:instanceId
          // message: set, del, expired, etc.
          logger.debug(`Keyspace event: ${channel} -> ${message}`);

          const keyMatch = channel.match(/__keyspace@0__:services:([^:]+):([^:]+)/);
          if (!keyMatch) return;

          const [, type, instanceId] = keyMatch;

          if (message === 'set') {
            // Key was created or updated
            const key = `services:${type}:${instanceId}`;
            const data = await this.client.get(key);
            if (data) {
              const instance: ServiceInstance = JSON.parse(data);

              // Track service
              this.trackedServices.set(`${type}:${instanceId}`, instance);

              // Broadcast put event
              const event: WatchEvent = { type: 'put', instance };
              logger.info(`Broadcasting PUT event to ${this.watchCallbacks.size} callbacks: ${type}:${instanceId}`);
              this.watchCallbacks.forEach(cb => cb(event));
            }
          } else if (message === 'expired') {
            // Key expired (TTL reached 0) - mark as terminated with 5 minutes TTL
            const trackedKey = `${type}:${instanceId}`;
            const instance = this.trackedServices.get(trackedKey);

            if (instance) {
              // If already terminated, this is the final cleanup - send DELETE event
              if (instance.status === 'terminated') {
                this.trackedServices.delete(trackedKey);

                const event: WatchEvent = {
                  type: 'delete',
                  instance: {
                    ...instance,
                    updatedAt: new Date().toISOString(),
                  },
                };
                logger.info(`Broadcasting DELETE event to ${this.watchCallbacks.size} callbacks: ${type}:${instanceId} (final cleanup)`);
                this.watchCallbacks.forEach(cb => cb(event));
              } else {
                // First expiration - mark as terminated and set configured TTL
                const key = `services:${type}:${instanceId}`;
                const terminatedInstance = {
                  ...instance,
                  status: 'terminated' as ServiceStatus,
                  updatedAt: new Date().toISOString(),
                };

                // Save back to Redis with configured TTL
                await this.client.set(key, JSON.stringify(terminatedInstance), 'EX', config.serviceDiscovery.terminatedTTL);

                // Update tracked services
                this.trackedServices.set(trackedKey, terminatedInstance);

                // Broadcast PUT event (status changed to terminated)
                const event: WatchEvent = {
                  type: 'put',
                  instance: terminatedInstance,
                };
                logger.info(`Broadcasting PUT event to ${this.watchCallbacks.size} callbacks: ${type}:${instanceId} (marked as terminated, TTL: ${config.serviceDiscovery.terminatedTTL}s)`);
                this.watchCallbacks.forEach(cb => cb(event));
              }
            }
          } else if (message === 'del') {
            // Key was manually deleted - send DELETE event immediately
            const trackedKey = `${type}:${instanceId}`;
            const instance = this.trackedServices.get(trackedKey);

            if (instance) {
              this.trackedServices.delete(trackedKey);

              const event: WatchEvent = {
                type: 'delete',
                instance: {
                  ...instance,
                  status: 'terminated',
                  updatedAt: new Date().toISOString(),
                },
              };
              logger.info(`Broadcasting DELETE event to ${this.watchCallbacks.size} callbacks: ${type}:${instanceId} (manual delete)`);
              this.watchCallbacks.forEach(cb => cb(event));
            }
          }
        } catch (error) {
          logger.error('Failed to handle keyspace event:', error);
        }
      });

      // Handle regular messages (custom events channel)
      this.subscriber.on('message', (channel, message) => {
        if (channel === 'service:events') {
          try {
            const event: WatchEvent = JSON.parse(message);
            logger.debug(`Received custom service event: ${event.type} for ${event.instance.type}:${event.instance.instanceId}`);

            // Track services for TTL expiration detection
            if (event.type === 'put') {
              this.trackedServices.set(
                `${event.instance.type}:${event.instance.instanceId}`,
                event.instance
              );
            } else if (event.type === 'delete') {
              this.trackedServices.delete(
                `${event.instance.type}:${event.instance.instanceId}`
              );
            }

            logger.info(`Broadcasting custom event to ${this.watchCallbacks.size} callbacks: ${event.type} ${event.instance.type}:${event.instance.instanceId}`);
            this.watchCallbacks.forEach(cb => cb(event));
          } catch (error) {
            logger.error('Failed to parse custom watch event:', error);
          }
        }
      });

      this.isWatching = true;
      logger.info('Redis watch started successfully (keyspace + custom events)');
      logger.info('Started watching service changes with TTL expiration detection');
    }
  }

  /**
   * Check for expired services and emit delete events
   */
  private async checkExpiredServices(): Promise<void> {
    try {
      for (const [key, instance] of this.trackedServices.entries()) {
        const redisKey = this.getInstanceKey(instance.type, instance.instanceId);
        const exists = await this.client.exists(redisKey);

        if (!exists) {
          // Service has expired, emit delete event
          this.trackedServices.delete(key);
          await this.publishEvent({
            type: 'delete',
            instance: {
              ...instance,
              status: 'terminated',
              updatedAt: new Date().toISOString(),
            },
          });
          logger.info(`Service expired (TTL): ${instance.type}:${instance.instanceId}`);
        }
      }
    } catch (error) {
      logger.error('Error checking expired services:', error);
    }
  }

  async close(): Promise<void> {
    // Clear all heartbeat intervals
    this.heartbeatIntervals.forEach(interval => clearInterval(interval));
    this.heartbeatIntervals.clear();

    // Clear TTL check interval
    if (this.ttlCheckInterval) {
      clearInterval(this.ttlCheckInterval);
      this.ttlCheckInterval = null;
    }

    // Clear tracked services
    this.trackedServices.clear();

    // Close connections
    await this.client.quit();
    await this.subscriber.quit();

    logger.info('RedisServiceDiscoveryProvider closed');
  }

  // Helper methods
  private getInstanceKey(type: string, id: string): string {
    return `services:${type}:${id}`;
  }

  private getTypeSetKey(type: string): string {
    return `services:type:${type}`;
  }

  private async publishEvent(event: WatchEvent): Promise<void> {
    try {
      const subscribers = await this.client.publish('service:events', JSON.stringify(event));
      logger.info(`Published ${event.type} event for ${event.instance.type}:${event.instance.instanceId} to ${subscribers} subscribers`);
    } catch (error) {
      logger.error('Failed to publish event:', error);
    }
  }
}


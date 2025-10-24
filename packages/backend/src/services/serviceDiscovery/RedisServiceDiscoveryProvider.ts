/**
 * Redis-based Service Discovery Provider
 *
 * Implements service discovery using Redis as the backend store
 */

import Redis from 'ioredis';
import logger from '../../config/logger';
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
      // Get instance before deleting
      const value = await this.client.get(key);
      
      // Delete instance
      await this.client.del(key);
      
      // Remove from type set
      await this.client.srem(this.getTypeSetKey(type), instanceId);
      
      // Clear heartbeat interval
      const intervalKey = `${type}:${instanceId}`;
      const interval = this.heartbeatIntervals.get(intervalKey);
      if (interval) {
        clearInterval(interval);
        this.heartbeatIntervals.delete(intervalKey);
      }
      
      // Publish delete event
      if (value) {
        const instance: ServiceInstance = JSON.parse(value);
        await this.publishEvent({
          type: 'delete',
          instance,
        });
      }
      
      logger.info(`Service unregistered: ${type}:${instanceId}`);
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

      const ttl = await this.client.ttl(key);
      await this.client.set(key, JSON.stringify(instance), 'EX', Math.max(ttl, 30));

      // Publish update event
      await this.publishEvent({
        type: 'put',
        instance,
      });

      logger.debug(`Service status updated: ${type}:${instanceId} -> ${status}`);
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
        const keys = await this.client.keys('service:instance:*');
        for (const key of keys) {
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
    
    if (!this.isWatching) {
      await this.subscriber.subscribe('service:events');
      
      this.subscriber.on('message', (channel, message) => {
        if (channel === 'service:events') {
          try {
            const event: WatchEvent = JSON.parse(message);
            this.watchCallbacks.forEach(cb => cb(event));
          } catch (error) {
            logger.error('Failed to parse watch event:', error);
          }
        }
      });
      
      this.isWatching = true;
      logger.info('Started watching service changes');
    }
  }

  async close(): Promise<void> {
    // Clear all heartbeat intervals
    this.heartbeatIntervals.forEach(interval => clearInterval(interval));
    this.heartbeatIntervals.clear();
    
    // Close connections
    await this.client.quit();
    await this.subscriber.quit();
    
    logger.info('RedisServiceDiscoveryProvider closed');
  }

  // Helper methods
  private getInstanceKey(type: string, id: string): string {
    return `service:instance:${type}:${id}`;
  }

  private getTypeSetKey(type: string): string {
    return `service:type:${type}`;
  }

  private async publishEvent(event: WatchEvent): Promise<void> {
    try {
      await this.client.publish('service:events', JSON.stringify(event));
    } catch (error) {
      logger.error('Failed to publish event:', error);
    }
  }
}


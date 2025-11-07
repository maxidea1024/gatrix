/**
 * Redis Service Discovery Implementation
 */

import Redis from 'ioredis';
import { Logger } from '../utils/logger';
import { RedisConfig } from '../types/config';
import { ServiceInstance, UpdateServiceStatusInput } from '../types/api';
import { IServiceDiscovery } from './ServiceDiscovery';
import { ErrorCode, createError } from '../utils/errors';

export class RedisServiceDiscovery implements IServiceDiscovery {
  private client: Redis;
  private logger: Logger;
  private ttlSeconds: number = 30; // Default heartbeat TTL, will be updated on register
  private terminatedTTL: number = 300; // Default terminated service TTL (5 minutes)

  constructor(config: RedisConfig, logger: Logger, terminatedTTL: number = 300) {
    this.terminatedTTL = terminatedTTL;
    this.logger = logger;

    this.client = new Redis({
      host: config.host,
      port: config.port,
      password: config.password,
      db: config.db || 0,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
    });

    this.client.on('error', (error) => {
      this.logger.error('Redis client error', { error: error.message });
    });

    this.logger.info('Redis client initialized', {
      host: config.host,
      port: config.port,
    });
  }

  /**
   * Register service instance
   */
  async register(instance: ServiceInstance, ttlSeconds: number): Promise<string> {
    try {
      // Store TTL for heartbeat
      this.ttlSeconds = ttlSeconds;

      const key = this.getServiceKey(instance.instanceId, instance.type);

      // Store service instance data with TTL
      await this.client.setex(key, ttlSeconds, JSON.stringify(instance));

      this.logger.info('Service registered in Redis', {
        instanceId: instance.instanceId,
        type: instance.type,
        key,
        ttl: ttlSeconds,
      });

      return instance.instanceId;
    } catch (error: any) {
      this.logger.error('Failed to register service in Redis', { error: error.message });
      throw createError(
        ErrorCode.SERVICE_DISCOVERY_ERROR,
        `Failed to register service: ${error.message}`,
        undefined,
        error
      );
    }
  }

  /**
   * Send heartbeat (refresh TTL)
   */
  async heartbeat(instanceId: string, type: string): Promise<void> {
    try {
      const key = this.getServiceKey(instanceId, type);

      // Get current instance data
      const data = await this.client.get(key);

      if (!data) {
        throw new Error('Service instance not found');
      }

      const instance = JSON.parse(data) as ServiceInstance;

      // Update timestamp
      instance.updatedAt = new Date().toISOString();

      // Refresh with original TTL (not current TTL!)
      // This ensures the service doesn't expire as long as heartbeat is sent
      await this.client.setex(key, this.ttlSeconds, JSON.stringify(instance));

      this.logger.debug('Heartbeat sent to Redis', {
        instanceId,
        type,
        ttl: this.ttlSeconds,
      });
    } catch (error: any) {
      this.logger.error('Failed to send heartbeat to Redis', { error: error.message });
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
   * Mark as terminated with configured TTL (same as etcd)
   * This allows users to see terminated/error servers before cleanup
   */
  async unregister(instanceId: string, type: string): Promise<void> {
    try {
      const key = this.getServiceKey(instanceId, type);

      // Get current instance data
      const data = await this.client.get(key);

      if (data) {
        const instance = JSON.parse(data) as ServiceInstance;

        // Update status to terminated
        instance.status = 'terminated';
        instance.updatedAt = new Date().toISOString();

        // Set with configured TTL for cleanup (same as etcd)
        await this.client.setex(key, this.terminatedTTL, JSON.stringify(instance));

        this.logger.info('Service marked as terminated', {
          instanceId,
          type,
          key,
          ttl: this.terminatedTTL,
        });
      } else {
        // If not found, just log
        this.logger.warn('Service not found for unregister', { instanceId, type, key });
      }
    } catch (error: any) {
      this.logger.error('Failed to unregister service from Redis', { error: error.message });
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
      const data = await this.client.get(key);

      if (!data) {
        throw new Error('Service instance not found');
      }

      const instance = JSON.parse(data) as ServiceInstance;

      // Update instance data
      instance.status = input.status;
      instance.instanceStats = input.instanceStats || instance.instanceStats;
      instance.meta = { ...instance.meta, ...input.meta };
      instance.updatedAt = new Date().toISOString();

      // Get current TTL
      const ttl = await this.client.ttl(key);

      if (ttl > 0) {
        await this.client.setex(key, ttl, JSON.stringify(instance));
      } else {
        await this.client.setex(key, 30, JSON.stringify(instance));
      }

      this.logger.info('Service status updated in Redis', {
        instanceId,
        type,
        status: input.status,
      });
    } catch (error: any) {
      this.logger.error('Failed to update service status in Redis', { error: error.message });
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
      const pattern = type ? `services:${type}:*` : 'services:*';
      const keys = await this.client.keys(pattern);

      const instances: ServiceInstance[] = [];

      for (const key of keys) {
        const data = await this.client.get(key);
        if (data) {
          try {
            const instance = JSON.parse(data) as ServiceInstance;
            instances.push(instance);
          } catch (error) {
            this.logger.warn('Failed to parse service instance', { key, error });
          }
        }
      }

      this.logger.debug('Services retrieved from Redis', {
        type,
        count: instances.length,
      });

      return instances;
    } catch (error: any) {
      this.logger.error('Failed to get services from Redis', { error: error.message });
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
      const data = await this.client.get(key);

      if (!data) {
        return null;
      }

      const instance = JSON.parse(data) as ServiceInstance;

      this.logger.debug('Service retrieved from Redis', { instanceId, type });

      return instance;
    } catch (error: any) {
      this.logger.error('Failed to get service from Redis', { error: error.message });
      return null;
    }
  }

  /**
   * Close Redis client
   */
  async close(): Promise<void> {
    await this.client.quit();
    this.logger.info('Redis client closed');
  }

  /**
   * Get service key for Redis
   */
  private getServiceKey(instanceId: string, type: string): string {
    return `services:${type}:${instanceId}`;
  }
}


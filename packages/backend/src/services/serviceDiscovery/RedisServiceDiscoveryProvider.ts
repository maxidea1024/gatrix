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
  private keyspaceSubscriber: Redis;
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

    this.keyspaceSubscriber = new Redis({
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

    this.keyspaceSubscriber.on('error', (error) => {
      logger.error('Redis keyspace subscriber error in ServiceDiscovery:', error);
    });

    logger.info('RedisServiceDiscoveryProvider initialized');
  }

  async register(instance: ServiceInstance, ttlSeconds: number): Promise<void> {
    const serviceType = instance.labels.service;
    const metaKey = this.getMetaKey(serviceType, instance.instanceId);
    const statKey = this.getStatKey(serviceType, instance.instanceId);

    try {
      // Separate meta (immutable) and stat (mutable) data
      const now = new Date().toISOString();
      const meta = {
        instanceId: instance.instanceId,
        labels: instance.labels,
        hostname: instance.hostname,
        externalAddress: instance.externalAddress,
        internalAddress: instance.internalAddress,
        ports: instance.ports,
        createdAt: instance.createdAt || now, // Set createdAt if not provided
        meta: instance.meta, // Static metadata
      };

      const stat = {
        status: instance.status,
        updatedAt: instance.updatedAt || now,
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

      // Note: Heartbeat is handled by the SDK client, not by the backend
      // Backend only stores the service data and publishes events

      logger.info(`Service registered: ${serviceType}:${instance.instanceId}`, {
        labels: instance.labels,
      });
    } catch (error) {
      logger.error(`Failed to register service ${serviceType}:${instance.instanceId}:`, error);
      throw error;
    }
  }

  async heartbeat(instanceId: string, serviceType: string): Promise<void> {
    const statKey = this.getStatKey(serviceType, instanceId);

    try {
      // Check if service is marked as terminated
      const terminatedMarkerKey = `services:${serviceType}:terminated:${instanceId}`;
      const isTerminated = await this.client.exists(terminatedMarkerKey);
      if (isTerminated) {
        logger.warn(
          `Ignoring heartbeat for ${serviceType}:${instanceId} - service is marked as terminated`
        );
        return;
      }

      const value = await this.client.get(statKey);
      if (value) {
        const stat = JSON.parse(value);

        // Ignore heartbeat for inactive services
        if (
          stat.status === 'terminated' ||
          stat.status === 'error' ||
          stat.status === 'no-response'
        ) {
          logger.warn(
            `Ignoring heartbeat for inactive service: ${serviceType}:${instanceId} (current status: ${stat.status})`
          );
          return;
        }

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

  async unregister(
    instanceId: string,
    serviceType: string,
    forceDelete: boolean = false
  ): Promise<void> {
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
            inactiveKeepTTL: config?.serviceDiscovery?.inactiveKeepTTL,
          });

          const ttl = config?.serviceDiscovery?.inactiveKeepTTL || 60;
          const terminatedMarkerTTL = config?.serviceDiscovery?.terminatedMarkerTTL || 300; // 5 minutes for audit trail

          // Validate that terminatedMarkerTTL is greater than stat TTL
          if (terminatedMarkerTTL <= ttl) {
            logger.warn(
              `WARNING: terminatedMarkerTTL (${terminatedMarkerTTL}s) must be greater than inactiveKeepTTL (${ttl}s). ` +
                `Otherwise, terminated marker will expire before stat key, causing terminated services to be marked as no-response. ` +
                `Please set terminatedMarkerTTL to at least ${ttl + 60}s (recommended: 300s for 5 minutes).`
            );
          }

          // Set stat key with TTL (15 seconds - service will move to inactive collection)
          await this.client.set(statKey, JSON.stringify(stat), 'EX', ttl);

          // Set terminated marker to distinguish explicit termination from heartbeat timeout
          // Use much longer TTL (5 minutes) to keep the service visible for audit trail
          const terminatedMarkerKey = `services:${serviceType}:terminated:${instanceId}`;
          await this.client.set(terminatedMarkerKey, '1', 'EX', terminatedMarkerTTL);

          // Update trackedServices so keyspace notification handler can find it when stat key expires
          const trackedKey = `${serviceType}:${instanceId}`;
          const instance: ServiceInstance = { ...meta, ...stat };
          this.trackedServices.set(trackedKey, instance);

          // Publish update event (merge meta + stat for compatibility)
          await this.publishEvent({
            type: 'put',
            instance,
          });

          logger.info(
            `Service marked as terminated: ${serviceType}:${instanceId} (will be removed in ${ttl}s)`
          );
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
  async updateStatus(
    input: UpdateServiceStatusInput,
    autoRegisterIfMissing = false
  ): Promise<void> {
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

          const now = new Date().toISOString();
          const meta = {
            instanceId: input.instanceId,
            labels: input.labels,
            hostname: input.hostname,
            externalAddress: '', // Will be set by controller from req.ip
            internalAddress: input.internalAddress,
            ports: input.ports,
            createdAt: now,
            meta: input.meta || {},
          };

          const stat = {
            status: input.status || 'ready',
            updatedAt: now,
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

          logger.info(`Service auto-registered: ${serviceType}:${input.instanceId}`, {
            labels: input.labels,
          });
          return;
        } else {
          const error: any = new Error(`Service ${serviceType}:${input.instanceId} not found`);
          error.status = 404;
          throw error;
        }
      }

      // Check if service is marked as terminated/error - ignore updateStatus calls
      const terminatedMarkerKey = `services:${serviceType}:terminated:${input.instanceId}`;
      const isTerminated = await this.client.exists(terminatedMarkerKey);
      if (isTerminated) {
        logger.debug(
          `Ignoring updateStatus for ${serviceType}:${input.instanceId} - service is marked as terminated`
        );
        return;
      }

      // Update stat only (meta is immutable)
      const statValue = await this.client.get(statKey);
      const stat = statValue ? JSON.parse(statValue) : {};
      const meta = JSON.parse(metaValue);

      // Check if service is already in error or no-response state - ignore updateStatus calls
      if (stat.status === 'error' || stat.status === 'no-response') {
        logger.debug(
          `Ignoring updateStatus for ${serviceType}:${input.instanceId} - already in ${stat.status} state`
        );
        return;
      }

      if (input.status !== undefined) {
        // 'heartbeat' is not a real status - it's just a keep-alive signal
        // We store it as 'heartbeat' in the database so that watchers can distinguish it
        // from a status change to 'ready'. Readers will normalize this to 'ready'.
        stat.status = input.status;
      }

      if (input.stats !== undefined) {
        // Merge stats (not replace)
        stat.stats = { ...stat.stats, ...input.stats };
      }

      stat.updatedAt = new Date().toISOString();

      // Use configured TTL based on status
      const heartbeatTTL = config?.serviceDiscovery?.heartbeatTTL || 30;
      const inactiveKeepTTL = config?.serviceDiscovery?.inactiveKeepTTL || 60;

      let ttl: number;
      if (stat.status === 'terminated' || stat.status === 'error') {
        ttl = inactiveKeepTTL; // How long to keep inactive services visible in UI

        // Set terminated marker so keyspace notification knows to delete this service
        const terminatedMarkerKey = `services:${serviceType}:terminated:${input.instanceId}`;
        await this.client.set(terminatedMarkerKey, '1', 'EX', ttl);

        // Also add to inactive collection for UI display
        const inactiveCollectionKey = `services:${serviceType}:inactive`;
        const inactiveEntry: ServiceInstance = { ...meta, ...stat };
        await this.client.hset(
          inactiveCollectionKey,
          input.instanceId,
          JSON.stringify(inactiveEntry)
        );

        // Create a separate key for tracking inactive item expiration (5 seconds for testing)
        const inactiveItemKey = `services:${serviceType}:inactive:${input.instanceId}`;
        await this.client.set(inactiveItemKey, '1', 'EX', 5);
      } else {
        ttl = heartbeatTTL; // Always use configured heartbeat TTL
      }

      await this.client.set(statKey, JSON.stringify(stat), 'EX', ttl);

      // Publish update event (merge meta + stat for compatibility)
      const eventInstance: ServiceInstance = { ...meta, ...stat };

      // If original status was 'heartbeat', pass it in the event so listeners (like lifecycle recorder) can skip it
      if (input.status === 'heartbeat') {
        eventInstance.status = 'heartbeat';
      }

      await this.publishEvent({
        type: 'put',
        instance: eventInstance,
      });

      logger.debug(`Service status updated: ${serviceType}:${input.instanceId} -> ${stat.status}`);

      logger.debug(
        `Service status updated: ${serviceType}:${input.instanceId} -> ${stat.status} (TTL: ${ttl}s)`
      );
    } catch (error) {
      logger.error(`Failed to update status for ${serviceType}:${input.instanceId}:`, error);
      throw error;
    }
  }

  async getServices(serviceType?: string, serviceGroup?: string): Promise<ServiceInstance[]> {
    let instances: ServiceInstance[] = [];

    try {
      if (serviceType) {
        // Get all active instances of a specific type
        const ids = await this.client.smembers(this.getTypeSetKey(serviceType));
        for (const id of ids) {
          const instance = await this.getService(id, serviceType);
          if (instance) {
            instances.push(instance);
          }
        }
      } else {
        // Get all active instances by scanning meta keys
        const metaKeys = await this.scanKeys('services:*:meta:*');
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
        instances = instances.filter((instance) => instance.labels.group === serviceGroup);
      }

      // Sort by createdAt (ascending - oldest first, newest last)
      instances.sort((a, b) => {
        const aTime = new Date(a.createdAt).getTime();
        const bTime = new Date(b.createdAt).getTime();
        return aTime - bTime;
      });

      // Merge inactive services (for UI visibility of terminated/no-response)
      try {
        const inactiveInstances = await this.getInactiveServices(serviceType, serviceGroup);
        instances = [...instances, ...inactiveInstances];
      } catch (error) {
        logger.warn('Failed to fetch inactive services to merge:', error);
      }

      return instances;
    } catch (error) {
      logger.error('Failed to get services:', error);
      throw error;
    }
  }

  async getInactiveServices(
    serviceType?: string,
    serviceGroup?: string
  ): Promise<ServiceInstance[]> {
    let instances: ServiceInstance[] = [];

    try {
      if (serviceType) {
        // Get inactive collection for this service type
        const inactiveCollectionKey = `services:${serviceType}:inactive`;
        const inactiveData = await this.client.hgetall(inactiveCollectionKey);

        for (const value of Object.values(inactiveData)) {
          try {
            instances.push(JSON.parse(value));
          } catch (e) {
            logger.warn(`Failed to parse inactive service entry`, e);
          }
        }
      } else {
        // Scan for all inactive collections: services:*:inactive
        // Note: Keys might be "services:{type}:inactive".
        // We scan for keys ending with ":inactive" and starting with "services:"
        const pattern = 'services:*:inactive';
        const inactiveKeys = await this.scanKeys(pattern);

        for (const key of inactiveKeys) {
          // Avoid matching "inactive:*" keys if any
          if (!key.endsWith(':inactive')) continue;

          const inactiveData = await this.client.hgetall(key);
          for (const value of Object.values(inactiveData)) {
            try {
              instances.push(JSON.parse(value));
            } catch (e) {
              logger.warn(`Failed to parse inactive service entry`, e);
            }
          }
        }
      }

      // Filter by serviceGroup if specified
      if (serviceGroup) {
        instances = instances.filter((instance) => instance.labels.group === serviceGroup);
      }

      // Sort by createdAt (ascending - oldest first, newest last)
      instances.sort((a, b) => {
        const aTime = new Date(a.createdAt).getTime();
        const bTime = new Date(b.createdAt).getTime();
        return aTime - bTime;
      });

      return instances;
    } catch (error) {
      logger.error('Failed to get inactive services:', error);
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

      // If stat key doesn't exist, service is not active (was cleaned up)
      if (!statValue) {
        return null;
      }

      const meta = JSON.parse(metaValue);
      const stat = JSON.parse(statValue);

      // Normalize 'heartbeat' status to 'ready' for readers
      if (stat.status === 'heartbeat') {
        stat.status = 'ready';
      }

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
      const metaKeys = await this.scanKeys('services:*:meta:*');
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
            logger.debug(
              `Received custom service event: ${event.type} for ${serviceType}:${event.instance.instanceId}`
            );

            // Track services for TTL expiration detection
            if (event.type === 'put') {
              this.trackedServices.set(
                `${serviceType}:${event.instance.instanceId}`,
                event.instance
              );
            } else if (event.type === 'delete') {
              this.trackedServices.delete(`${serviceType}:${event.instance.instanceId}`);
            }

            logger.info(
              `Broadcasting custom event to ${this.watchCallbacks.size} callbacks: ${event.type} ${serviceType}:${event.instance.instanceId}`
            );
            this.watchCallbacks.forEach((cb) => cb(event));
          } catch (error) {
            logger.error('Failed to parse custom watch event:', error);
          }
        }
      });

      // Subscribe to keyspace expired events for stat keys and inactive collections
      // Use separate keyspaceSubscriber to avoid conflicts with subscribe mode
      await this.keyspaceSubscriber.psubscribe('__keyevent@0__:expired');
      logger.info('Subscribed to keyspace expired events');

      // Handle keyspace expired events
      this.keyspaceSubscriber.on('pmessage', async (pattern, channel, message) => {
        logger.info(
          `Received pmessage: pattern=${pattern}, channel=${channel}, message=${message}`
        );
        if (pattern === '__keyevent@0__:expired' && message.startsWith('services:')) {
          try {
            // Handle stat key expiration (heartbeat timeout or explicit termination)
            if (message.includes(':stat:')) {
              // Format: services:{type}:stat:{id}
              const parts = message.split(':');
              if (parts.length === 4 && parts[2] === 'stat') {
                const serviceType = parts[1];
                const instanceId = parts[3];
                const trackedKey = `${serviceType}:${instanceId}`;
                const terminatedMarkerKey = `services:${serviceType}:terminated:${instanceId}`;
                const inactiveCollectionKey = `services:${serviceType}:inactive`;

                // Check if this service was marked as terminated (explicit unregister)
                const isTerminated = await this.client.exists(terminatedMarkerKey);

                // Try to get instance from trackedServices first, then from Redis meta key
                let instance = this.trackedServices.get(trackedKey);
                if (!instance) {
                  // Service not in trackedServices, try to get from Redis meta key
                  const metaKey = this.getMetaKey(serviceType, instanceId);
                  const metaValue = await this.client.get(metaKey);
                  if (metaValue) {
                    instance = JSON.parse(metaValue);
                    logger.debug(`Retrieved service from meta key: ${serviceType}:${instanceId}`);
                  }
                }

                if (instance) {
                  if (isTerminated) {
                    // Explicit termination: clean up marker
                    await this.client.del(terminatedMarkerKey);
                    this.trackedServices.delete(trackedKey);

                    // Store in inactive collection for 5 seconds (for testing - normally 300 seconds)
                    const inactiveEntry: ServiceInstance = {
                      ...instance,
                      status: 'terminated',
                      updatedAt: new Date().toISOString(),
                    };
                    await this.client.hset(
                      inactiveCollectionKey,
                      instanceId,
                      JSON.stringify(inactiveEntry)
                    );

                    // Create a separate key for tracking inactive item expiration (5 seconds for testing)
                    const inactiveItemKey = `services:${serviceType}:inactive:${instanceId}`;
                    await this.client.set(inactiveItemKey, '1', 'EX', 5);

                    // Publish update event to notify UI of terminated status
                    await this.publishEvent({
                      type: 'put',
                      instance: inactiveEntry,
                    });

                    logger.info(`Service terminated (explicit): ${serviceType}:${instanceId}`);
                  } else {
                    // No heartbeat received: mark as no-response and store in inactive collection
                    this.trackedServices.delete(trackedKey);

                    const inactiveEntry: ServiceInstance = {
                      ...instance,
                      status: 'no-response',
                      updatedAt: new Date().toISOString(),
                    };

                    // Store in inactive collection for 5 seconds (for testing - normally 300 seconds)
                    await this.client.hset(
                      inactiveCollectionKey,
                      instanceId,
                      JSON.stringify(inactiveEntry)
                    );

                    // Create a separate key for tracking inactive item expiration (5 seconds for testing)
                    const inactiveItemKey = `services:${serviceType}:inactive:${instanceId}`;
                    await this.client.set(inactiveItemKey, '1', 'EX', 5);

                    // Publish update event to notify UI of no-response status
                    await this.publishEvent({
                      type: 'put',
                      instance: inactiveEntry,
                    });

                    logger.info(
                      `Service no-response (heartbeat timeout): ${serviceType}:${instanceId}`
                    );
                  }

                  // Delete meta key after processing
                  const metaKey = this.getMetaKey(serviceType, instanceId);
                  await this.client.del(metaKey);
                  logger.debug(`Deleted meta key: ${metaKey}`);
                } else {
                  logger.warn(
                    `Service not found in trackedServices or Redis meta: ${serviceType}:${instanceId}`
                  );
                }
              }
            }
            // Handle inactive item expiration (publish delete event)
            else if (message.includes(':inactive:')) {
              // Format: services:{type}:inactive:{id}
              logger.info(`Inactive item key expired: ${message}`);
              const parts = message.split(':');
              if (parts.length === 4 && parts[2] === 'inactive') {
                const serviceType = parts[1];
                const instanceId = parts[3];
                const inactiveCollectionKey = `services:${serviceType}:inactive`;

                logger.info(`Attempting to retrieve inactive entry: ${serviceType}:${instanceId}`);

                // Retrieve the inactive entry from the collection before it's deleted
                const inactiveData = await this.client.hget(inactiveCollectionKey, instanceId);
                if (inactiveData) {
                  try {
                    const inactiveEntry: ServiceInstance = JSON.parse(inactiveData);

                    // Remove from inactive collection
                    await this.client.hdel(inactiveCollectionKey, instanceId);

                    // Publish delete event
                    await this.publishEvent({
                      type: 'delete',
                      instance: inactiveEntry,
                    });

                    logger.info(
                      `Service deleted from inactive collection: ${serviceType}:${instanceId} (status: ${inactiveEntry.status})`
                    );
                  } catch (error) {
                    logger.error('Failed to parse inactive entry:', error);
                  }
                } else {
                  logger.warn(
                    `Inactive entry not found in collection: ${serviceType}:${instanceId}`
                  );
                }
              } else {
                logger.warn(
                  `Invalid inactive item key format: ${message} (parts: ${parts.length})`
                );
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

  /**
   * Clean up all inactive services (terminated, error, no-response)
   * Directly clears inactive collections and terminated meta keys from Redis
   */
  async cleanupInactiveServices(
    serviceTypes: string[]
  ): Promise<{ deletedCount: number; serviceTypes: string[] }> {
    let totalDeletedCount = 0;

    for (const serviceType of serviceTypes) {
      try {
        // 1. Clean up inactive collection (if exists)
        const inactiveCollectionKey = `services:${serviceType}:inactive`;
        const inactiveData = await this.client.hgetall(inactiveCollectionKey);
        const inactiveEntryCount = Object.keys(inactiveData).length;

        if (inactiveEntryCount > 0) {
          // Delete the entire inactive collection hash
          await this.client.del(inactiveCollectionKey);
          totalDeletedCount += inactiveEntryCount;
          logger.info(
            `🗑️ Cleared inactive collection for ${serviceType}: ${inactiveEntryCount} entries deleted`
          );

          // Also delete all inactive item keys (services:{type}:inactive:{id})
          const inactiveItemKeys = await this.scanKeys(`services:${serviceType}:inactive:*`);
          if (inactiveItemKeys.length > 0) {
            await this.client.del(...inactiveItemKeys);
            logger.info(
              `🗑️ Deleted ${inactiveItemKeys.length} inactive item keys for ${serviceType}`
            );
          }

          // Publish delete events for each inactive service
          for (const [instanceId, value] of Object.entries(inactiveData)) {
            try {
              const instance: ServiceInstance = JSON.parse(value);
              await this.publishEvent({
                type: 'delete',
                instance,
              });
            } catch (error) {
              logger.error(`Failed to parse inactive entry for delete event: ${instanceId}`, error);
            }
          }
        }

        // 2. Clean up terminated meta keys (meta without stat)
        const metaKeys = await this.scanKeys(`services:${serviceType}:meta:*`);
        for (const metaKey of metaKeys) {
          const parts = metaKey.split(':');
          if (parts.length === 4) {
            const instanceId = parts[3];
            const statKey = this.getStatKey(serviceType, instanceId);

            // Check if stat key exists
            const statExists = await this.client.exists(statKey);
            if (!statExists) {
              // Stat key doesn't exist, so this is a terminated service
              try {
                const metaValue = await this.client.get(metaKey);
                if (metaValue) {
                  const instance: ServiceInstance = JSON.parse(metaValue);
                  instance.status = 'terminated';
                  instance.updatedAt = new Date().toISOString();

                  // Delete the meta key
                  await this.client.del(metaKey);
                  totalDeletedCount++;
                  logger.info(`🗑️ Deleted terminated service: ${serviceType}:${instanceId}`);

                  // Publish delete event
                  await this.publishEvent({
                    type: 'delete',
                    instance,
                  });
                }
              } catch (error) {
                logger.error(
                  `Failed to cleanup terminated service ${serviceType}:${instanceId}:`,
                  error
                );
              }
            }
          }
        }
      } catch (error) {
        logger.error(`Failed to cleanup inactive services for ${serviceType}:`, error);
      }
    }

    logger.info(`✅ Cleanup completed: ${totalDeletedCount} inactive services deleted`);
    return { deletedCount: totalDeletedCount, serviceTypes };
  }

  async close(): Promise<void> {
    // Clear all heartbeat intervals
    this.heartbeatIntervals.forEach((interval) => clearInterval(interval));
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
      logger.info(
        `Published ${event.type} event for ${serviceType}:${event.instance.instanceId} to ${subscribers} subscribers`
      );
    } catch (error) {
      logger.error('Failed to publish event:', error);
    }
  }

  /**
   * Helper to scan keys safely using SCAN instead of KEYS
   */
  private async scanKeys(pattern: string): Promise<string[]> {
    return new Promise((resolve, reject) => {
      const keys: string[] = [];
      const stream = this.client.scanStream({ match: pattern, count: 100 });

      stream.on('data', (resultKeys: string[]) => {
        // ioredis scanStream returns an array of keys
        for (const key of resultKeys) {
          keys.push(key);
        }
      });

      stream.on('end', () => {
        resolve(keys);
      });

      stream.on('error', (err) => {
        reject(err);
      });
    });
  }
}

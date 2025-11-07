/**
 * Service Discovery
 * Handles service registration and discovery using etcd or Redis
 */

import { ulid } from 'ulid';
import { Logger } from '../utils/logger';
import { ErrorCode, createError } from '../utils/errors';
import {
  ServiceInstance,
  RegisterServiceInput,
  UpdateServiceStatusInput,
  GetServicesParams,
} from '../types/api';
import { ServiceDiscoveryConfig, RedisConfig, EtcdConfig } from '../types/config';
import { EtcdServiceDiscovery } from './EtcdServiceDiscovery';
import { RedisServiceDiscovery } from './RedisServiceDiscovery';

export interface IServiceDiscovery {
  register(instance: ServiceInstance, ttlSeconds: number): Promise<string>;
  heartbeat(instanceId: string, type: string): Promise<void>;
  unregister(instanceId: string, type: string): Promise<void>;
  updateStatus(instanceId: string, type: string, input: UpdateServiceStatusInput): Promise<void>;
  getServices(type?: string): Promise<ServiceInstance[]>;
  getService(instanceId: string, type: string): Promise<ServiceInstance | null>;
  close(): Promise<void>;
}

export class ServiceDiscovery {
  private logger: Logger;
  private config: ServiceDiscoveryConfig;
  private provider?: IServiceDiscovery;
  private instanceId?: string;
  private serviceType?: string;
  private heartbeatInterval?: NodeJS.Timeout;

  constructor(
    config: ServiceDiscoveryConfig,
    redisConfig?: RedisConfig,
    etcdConfig?: EtcdConfig,
    logger?: Logger
  ) {
    this.config = {
      enabled: config.enabled !== false,
      mode: config.mode || 'redis',
      ttlSeconds: config.ttlSeconds || 30,
      terminatedTTL: config.terminatedTTL || 300, // Default 5 minutes
      heartbeatIntervalMs: config.heartbeatIntervalMs || 10000,
    };
    this.logger = logger || new Logger();

    if (this.config.enabled) {
      this.initializeProvider(redisConfig, etcdConfig);
    }
  }

  /**
   * Initialize service discovery provider
   */
  private initializeProvider(redisConfig?: RedisConfig, etcdConfig?: EtcdConfig): void {
    if (this.config.mode === 'etcd') {
      // Use etcd config from serviceDiscovery config or global config
      const etcdCfg = this.config.etcd || etcdConfig;
      if (!etcdCfg) {
        throw createError(
          ErrorCode.INVALID_CONFIG,
          'etcd configuration is required when mode is "etcd"'
        );
      }
      this.provider = new EtcdServiceDiscovery(etcdCfg, this.logger);
    } else if (this.config.mode === 'redis') {
      // Use redis config from serviceDiscovery config or global config
      const redisCfg = this.config.redis || redisConfig;
      if (!redisCfg) {
        throw createError(
          ErrorCode.INVALID_CONFIG,
          'Redis configuration is required when mode is "redis"'
        );
      }
      this.provider = new RedisServiceDiscovery(redisCfg, this.logger, this.config.terminatedTTL);
    } else {
      throw createError(
        ErrorCode.INVALID_CONFIG,
        `Unknown service discovery mode: ${this.config.mode}`
      );
    }

    this.logger.info('Service discovery provider initialized', { mode: this.config.mode });
  }

  /**
   * Register this service instance
   */
  async register(input: RegisterServiceInput): Promise<string> {
    if (!this.config.enabled || !this.provider) {
      this.logger.warn('Service discovery is disabled');
      return '';
    }

    // Use provided instanceId or generate new ULID
    const instanceId = input.instanceId || ulid();
    this.instanceId = instanceId;
    this.serviceType = input.type;

    const instance: ServiceInstance = {
      instanceId,
      type: input.type,
      serviceGroup: input.serviceGroup,
      hostname: input.hostname,
      externalAddress: input.externalAddress,
      internalAddress: input.internalAddress,
      ports: input.ports,
      status: input.status || 'initializing',
      instanceStats: input.instanceStats,
      meta: input.meta,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await this.provider.register(instance, this.config.ttlSeconds!);

    this.logger.info('Service registered', { instanceId, type: input.type });

    // Start auto-heartbeat
    this.startAutoHeartbeat();

    return instanceId;
  }

  /**
   * Start automatic heartbeat
   */
  private startAutoHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    if (!this.instanceId || !this.serviceType) {
      return;
    }

    this.heartbeatInterval = setInterval(async () => {
      try {
        await this.heartbeat();
      } catch (error: any) {
        this.logger.error('Heartbeat failed', { error: error.message });
      }
    }, this.config.heartbeatIntervalMs);

    this.logger.info('Auto-heartbeat started', {
      intervalMs: this.config.heartbeatIntervalMs,
    });
  }

  /**
   * Stop automatic heartbeat
   */
  private stopAutoHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = undefined;
      this.logger.info('Auto-heartbeat stopped');
    }
  }

  /**
   * Send heartbeat
   */
  async heartbeat(): Promise<void> {
    if (!this.config.enabled || !this.provider || !this.instanceId || !this.serviceType) {
      return;
    }

    await this.provider.heartbeat(this.instanceId, this.serviceType);
    this.logger.debug('Heartbeat sent', { instanceId: this.instanceId });
  }

  /**
   * Unregister this service instance
   */
  async unregister(): Promise<void> {
    if (!this.config.enabled || !this.provider || !this.instanceId || !this.serviceType) {
      return;
    }

    this.stopAutoHeartbeat();

    await this.provider.unregister(this.instanceId, this.serviceType);

    this.logger.info('Service unregistered', { instanceId: this.instanceId });

    this.instanceId = undefined;
    this.serviceType = undefined;
  }

  /**
   * Update service status
   */
  async updateStatus(input: UpdateServiceStatusInput): Promise<void> {
    if (!this.config.enabled || !this.provider || !this.instanceId || !this.serviceType) {
      return;
    }

    await this.provider.updateStatus(this.instanceId, this.serviceType, input);

    this.logger.info('Service status updated', {
      instanceId: this.instanceId,
      status: input.status,
    });
  }

  /**
   * Get all services or services of a specific type
   */
  async getServices(type?: string): Promise<ServiceInstance[]> {
    if (!this.config.enabled || !this.provider) {
      return [];
    }

    return await this.provider.getServices(type);
  }

  /**
   * Get services with filtering
   */
  async getServicesFiltered(params?: GetServicesParams): Promise<ServiceInstance[]> {
    if (!this.config.enabled || !this.provider) {
      return [];
    }

    // Get all services or services of a specific type
    let services = await this.provider.getServices(params?.type);

    // Filter by service group
    if (params?.serviceGroup) {
      services = services.filter((s) => s.serviceGroup === params.serviceGroup);
    }

    // Filter by status
    if (params?.status) {
      services = services.filter((s) => s.status === params.status);
    }

    // Exclude self (default: true)
    const excludeSelf = params?.excludeSelf !== false;
    if (excludeSelf && this.instanceId) {
      services = services.filter((s) => s.instanceId !== this.instanceId);
    }

    return services;
  }

  /**
   * Get a specific service instance
   */
  async getService(instanceId: string, type: string): Promise<ServiceInstance | null> {
    if (!this.config.enabled || !this.provider) {
      return null;
    }

    return await this.provider.getService(instanceId, type);
  }

  /**
   * Close service discovery and cleanup
   */
  async close(): Promise<void> {
    this.stopAutoHeartbeat();

    if (this.instanceId && this.serviceType) {
      await this.unregister();
    }

    if (this.provider) {
      await this.provider.close();
    }

    this.logger.info('Service discovery closed');
  }

  /**
   * Get current instance ID
   */
  getInstanceId(): string | undefined {
    return this.instanceId;
  }

  /**
   * Get current service type
   */
  getServiceType(): string | undefined {
    return this.serviceType;
  }
}


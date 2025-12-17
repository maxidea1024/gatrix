/**
 * Service Discovery Service
 * Provides service discovery operations via Backend API
 */

import * as os from 'os';
import { Logger } from '../utils/logger';
import { ApiClient } from '../client/ApiClient';
import { ServiceInstance, GetServicesParams, RegisterServiceInput, UpdateServiceStatusInput, ServiceLabels } from '../types/api';
import { getFirstNicAddress } from '../utils/network';

export class ServiceDiscoveryService {
  private apiClient: ApiClient;
  private logger: Logger;
  private instanceId?: string;
  private labels?: ServiceLabels;
  private heartbeatInterval?: NodeJS.Timeout;
  private heartbeatIntervalMs: number = 15000; // 15 seconds (half of default 30s TTL)
  private isUpdating: boolean = false; // Prevent concurrent heartbeat requests

  // Backup registration data for auto-recovery
  private registrationBackup?: {
    hostname: string;
    internalAddress: string;
    externalAddress: string;
    ports: any;
    meta?: any;
    status?: string;
  };

  constructor(apiClient: ApiClient, logger: Logger) {
    this.apiClient = apiClient;
    this.logger = logger;
  }

  /**
   * Set current instance ID for excludeSelf filtering
   */
  setInstanceId(instanceId: string): void {
    this.instanceId = instanceId;
  }

  /**
   * Get current instance ID
   */
  getInstanceId(): string | undefined {
    return this.instanceId;
  }

  /**
   * Get current service labels
   */
  getLabels(): ServiceLabels | undefined {
    return this.labels;
  }

  /**
   * Get current service type (from labels.service)
   */
  getServiceType(): string | undefined {
    return this.labels?.service;
  }

  /**
   * Register service instance via Backend API (full snapshot)
   * POST /api/v1/server/services/register
   *
   * Note:
   * - externalAddress is auto-detected by backend from req.ip
   * - hostname is auto-detected from os.hostname() if omitted
   * - internalAddress is auto-detected from first NIC if omitted
   */
  async register(input: RegisterServiceInput): Promise<{ instanceId: string; hostname: string; internalAddress: string; externalAddress: string }> {
    // Auto-detect hostname and internalAddress if not provided
    const internalAddress = input.internalAddress || getFirstNicAddress();
    const hostname = input.hostname || os.hostname();

    const registrationInput = {
      ...input,
      hostname,
      internalAddress
    };

    this.logger.debug('Registering service via API', registrationInput);

    const response = await this.apiClient.post<{ instanceId: string; hostname: string; internalAddress: string; externalAddress: string }>(
      '/api/v1/server/services/register',
      registrationInput
    );

    if (!response.success || !response.data) {
      throw new Error(response.error?.message || 'Failed to register service');
    }

    const { instanceId, externalAddress } = response.data;
    this.instanceId = instanceId;
    this.labels = input.labels;

    // Backup registration data for auto-recovery (includes externalAddress for re-registration)
    this.registrationBackup = {
      hostname,
      internalAddress,
      externalAddress,
      ports: input.ports,
      meta: input.meta,
      status: input.status,
    };

    this.logger.info('Service registered via API', {
      instanceId,
      labels: input.labels,
      hostname,
      internalAddress,
      externalAddress
    });

    // Start heartbeat to keep service alive in Redis
    this.startHeartbeat();

    return { instanceId, hostname, internalAddress, externalAddress };
  }

  /**
   * Unregister service instance via Backend API
   * POST /api/v1/server/services/unregister
   *
   * Note: This method does NOT retry on failure because it's called during shutdown.
   * Retrying would delay the shutdown process unnecessarily.
   */
  async unregister(): Promise<void> {
    if (!this.instanceId || !this.labels) {
      this.logger.warn('No service instance to unregister');
      return;
    }

    // Stop heartbeat first
    this.stopHeartbeat();

    this.logger.debug('Unregistering service via API', {
      instanceId: this.instanceId,
      labels: this.labels,
    });

    try {
      const response = await this.apiClient.postNoRetry('/api/v1/server/services/unregister', {
        instanceId: this.instanceId,
        labels: this.labels,
      });

      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to unregister service');
      }

      this.logger.info('Service unregistered via API', {
        instanceId: this.instanceId,
        labels: this.labels,
      });
    } catch (error) {
      // Log error but don't throw - unregister is best-effort during shutdown
      this.logger.warn('Failed to unregister service', {
        instanceId: this.instanceId,
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      // Always clear instance ID, labels, and backup, even if unregister fails
      this.instanceId = undefined;
      this.labels = undefined;
      this.registrationBackup = undefined;
    }
  }

  /**
   * Update service status via Backend API (partial merge)
   * POST /api/v1/server/services/status
   *
   * Only sends changed fields. Stats are merged, not replaced.
   * Meta is not sent (immutable after registration).
   *
   * If autoRegisterIfMissing=true and instance doesn't exist, it will auto-register
   * using the provided hostname, internalAddress, ports, and meta fields.
   */
  async updateStatus(input: UpdateServiceStatusInput): Promise<void> {
    // Silently skip if not registered - register() must be called first
    if (!this.instanceId || !this.labels) {
      this.logger.debug('Skipping updateStatus - service not registered yet');
      return;
    }

    this.logger.debug('Updating service status via API', {
      instanceId: this.instanceId,
      labels: this.labels,
      status: input.status,
      stats: input.stats,
      autoRegisterIfMissing: input.autoRegisterIfMissing,
    });

    const payload: any = {
      instanceId: this.instanceId,
      labels: this.labels,
      status: input.status,
      stats: input.stats,
    };

    // Add auto-register fields if provided
    if (input.autoRegisterIfMissing) {
      payload.hostname = input.hostname;
      payload.internalAddress = input.internalAddress;
      payload.ports = input.ports;
      payload.meta = input.meta;
    }

    const response = await this.apiClient.post('/api/v1/server/services/status', payload);

    if (!response.success) {
      const errorMessage = response.error?.message || 'Failed to update service status';

      // Check if error is "Service not found" and we have backup data
      if (errorMessage.includes('not found')) {
        if (this.registrationBackup) {
          this.logger.warn('Service not found in registry, attempting auto-registration', {
            instanceId: this.instanceId,
            service: this.labels?.service,
          });

          try {
            // Re-register using backup data
            await this.register({
              instanceId: this.instanceId,
              labels: this.labels!,
              hostname: this.registrationBackup.hostname,
              internalAddress: this.registrationBackup.internalAddress,
              ports: this.registrationBackup.ports,
              meta: this.registrationBackup.meta,
              status: (input.status || this.registrationBackup.status || 'ready') as any,
              stats: input.stats,
            });

            this.logger.info('Service auto-registered successfully', {
              instanceId: this.instanceId,
              service: this.labels?.service,
            });

            // Successfully re-registered, return without error
            return;
          } catch (reregisterError: any) {
            this.logger.error('Failed to auto-register service', {
              instanceId: this.instanceId,
              error: reregisterError.message || String(reregisterError),
            });
            // Fall through to throw original error
          }
        } else {
          // No backup data - this happens when server was restarted but register() was not called first
          // Clear the stale instanceId and labels to force a fresh register()
          this.logger.error('Service not found and no backup data available. Did you call register() first?', {
            instanceId: this.instanceId,
            service: this.labels?.service,
          });
          this.stopHeartbeat();
          this.instanceId = undefined;
          this.labels = undefined;
          throw new Error('Service not found. Please call register() to re-register the service.');
        }
      }

      throw new Error(errorMessage);
    }

    this.logger.debug('Service status updated via API', {
      instanceId: this.instanceId,
      labels: this.labels,
      status: input.status,
    });
  }

  /**
   * Fetch services with filtering via Backend API
   * GET /api/v1/server/services?serviceType=world&group=kr&environment=prod&status=ready
   *
   * Supports filtering by:
   * - service: labels.service
   * - group: labels.group
   * - environment: labels.environment
   * - status: service status
   * - Any custom label key-value pairs
   */
  async fetchServices(params?: GetServicesParams): Promise<ServiceInstance[]> {
    this.logger.debug('Fetching services via API', params);

    const queryParams: any = {};

    if (params?.service) {
      queryParams.serviceType = params.service;
    }

    if (params?.group) {
      queryParams.group = params.group;
    }

    if (params?.environment) {
      queryParams.environment = params.environment;
    }

    if (params?.region) {
      queryParams.region = params.region;
    }

    if (params?.status) {
      queryParams.status = params.status;
    }

    if (params?.excludeSelf !== undefined) {
      queryParams.excludeSelf = params.excludeSelf;
    }

    // Add any custom label filters
    if (params?.labels) {
      Object.assign(queryParams, params.labels);
    }

    const headers: any = {};
    if (this.instanceId) {
      headers['X-Instance-Id'] = this.instanceId;
    }

    const response = await this.apiClient.get<ServiceInstance[]>('/api/v1/server/services', {
      params: queryParams,
      headers,
    });

    if (!response.success || !response.data) {
      throw new Error(response.error?.message || 'Failed to fetch services');
    }

    const services = response.data;

    this.logger.info('Services fetched via API', { count: services.length });

    return services;
  }

  /**
   * Fetch a specific service instance
   * GET /api/v1/server/services/:serviceType/:instanceId
   */
  async fetchService(serviceType: string, instanceId: string): Promise<ServiceInstance | null> {
    this.logger.debug('Fetching service via API', { serviceType, instanceId });

    const response = await this.apiClient.get<ServiceInstance>(
      `/api/v1/server/services/${serviceType}/${instanceId}`
    );

    if (!response.success || !response.data) {
      return null;
    }

    this.logger.info('Service fetched via API', { serviceType, instanceId });

    return response.data;
  }


  /**
   * Start automatic heartbeat to keep service alive in Redis
   * Sends heartbeat every 15 seconds (half of default 30s TTL)
   */
  private startHeartbeat(): void {
    if (this.heartbeatInterval) {
      this.logger.warn('Heartbeat already running');
      return;
    }

    this.heartbeatInterval = setInterval(async () => {
      // Skip if previous update is still in progress (e.g., retrying after backend restart)
      if (this.isUpdating) {
        this.logger.debug('Skipping heartbeat - previous update still in progress', {
          instanceId: this.instanceId,
        });
        return;
      }

      try {
        if (!this.instanceId || !this.labels) {
          this.stopHeartbeat();
          return;
        }

        this.isUpdating = true;
        await this.updateStatus({
          status: 'ready',
          autoRegisterIfMissing: true,
        });

        this.logger.debug('Heartbeat sent', {
          instanceId: this.instanceId,
          service: this.labels.service,
        });
      } catch (error) {
        this.logger.warn('Heartbeat failed', {
          instanceId: this.instanceId,
          error: error instanceof Error ? error.message : String(error),
        });
      } finally {
        this.isUpdating = false;
      }
    }, this.heartbeatIntervalMs);

    this.logger.info('Heartbeat started', {
      instanceId: this.instanceId,
      intervalMs: this.heartbeatIntervalMs,
    });
  }

  /**
   * Stop automatic heartbeat
   */
  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = undefined;
      this.logger.info('Heartbeat stopped', {
        instanceId: this.instanceId,
      });
    }
  }
}


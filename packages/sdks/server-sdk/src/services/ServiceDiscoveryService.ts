/**
 * Service Discovery Service
 * Provides service discovery operations via Backend API
 */

import { Logger } from '../utils/logger';
import { ApiClient } from '../client/ApiClient';
import { ServiceInstance, GetServicesParams } from '../types/api';

export class ServiceDiscoveryService {
  private apiClient: ApiClient;
  private logger: Logger;
  private instanceId?: string;

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
   * Get services with filtering via Backend API
   * GET /api/v1/server/services
   */
  async getServices(params?: GetServicesParams): Promise<ServiceInstance[]> {
    this.logger.debug('Fetching services via API', params);

    const queryParams: any = {};

    if (params?.type) {
      queryParams.type = params.type;
    }

    if (params?.serviceGroup) {
      queryParams.serviceGroup = params.serviceGroup;
    }

    if (params?.status) {
      queryParams.status = params.status;
    }

    if (params?.excludeSelf !== undefined) {
      queryParams.excludeSelf = params.excludeSelf;
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
   * Get a specific service instance
   * GET /api/v1/server/services/:type/:instanceId
   */
  async getService(type: string, instanceId: string): Promise<ServiceInstance | null> {
    this.logger.debug('Fetching service via API', { type, instanceId });

    const response = await this.apiClient.get<ServiceInstance>(
      `/api/v1/server/services/${type}/${instanceId}`
    );

    if (!response.success || !response.data) {
      return null;
    }

    this.logger.info('Service fetched via API', { type, instanceId });

    return response.data;
  }
}


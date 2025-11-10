/**
 * Service Discovery Service
 * Provides service discovery operations via Backend API
 */

import { Logger } from '../utils/logger';
import { ApiClient } from '../client/ApiClient';
import { ServiceInstance, GetServicesParams, RegisterServiceInput, UpdateServiceStatusInput, WhitelistData, ServiceLabels } from '../types/api';
import { getFirstNicAddress } from '../utils/network';

export class ServiceDiscoveryService {
  private apiClient: ApiClient;
  private logger: Logger;
  private instanceId?: string;
  private labels?: ServiceLabels;

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
   * - internalAddress is auto-detected from first NIC if omitted
   */
  async register(input: RegisterServiceInput): Promise<{ instanceId: string; externalAddress: string }> {
    // Auto-detect internalAddress if not provided
    const registrationInput = {
      ...input,
      internalAddress: input.internalAddress || getFirstNicAddress()
    };

    this.logger.debug('Registering service via API', registrationInput);

    const response = await this.apiClient.post<{ instanceId: string; externalAddress: string }>(
      '/api/v1/server/services/register',
      registrationInput
    );

    if (!response.success || !response.data) {
      throw new Error(response.error?.message || 'Failed to register service');
    }

    const { instanceId, externalAddress } = response.data;
    this.instanceId = instanceId;
    this.labels = input.labels;

    this.logger.info('Service registered via API', {
      instanceId,
      labels: input.labels,
      internalAddress: registrationInput.internalAddress,
      externalAddress
    });

    return { instanceId, externalAddress };
  }

  /**
   * Unregister service instance via Backend API
   * POST /api/v1/server/services/unregister
   */
  async unregister(): Promise<void> {
    if (!this.instanceId || !this.labels) {
      this.logger.warn('No service instance to unregister');
      return;
    }

    this.logger.debug('Unregistering service via API', {
      instanceId: this.instanceId,
      labels: this.labels,
    });

    const response = await this.apiClient.post('/api/v1/server/services/unregister', {
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

    this.instanceId = undefined;
    this.labels = undefined;
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
    if (!this.instanceId || !this.labels) {
      throw new Error('Service not registered');
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
      throw new Error(response.error?.message || 'Failed to update service status');
    }

    this.logger.info('Service status updated via API', {
      instanceId: this.instanceId,
      labels: this.labels,
      status: input.status,
    });
  }

  /**
   * Get services with filtering via Backend API
   * GET /api/v1/server/services?serviceType=world&serviceGroup=kr&status=ready&env=prod
   *
   * Supports filtering by:
   * - serviceType: labels.service
   * - serviceGroup: labels.group
   * - status: service status
   * - Any custom label key-value pairs
   */
  async getServices(params?: GetServicesParams): Promise<ServiceInstance[]> {
    this.logger.debug('Fetching services via API', params);

    const queryParams: any = {};

    if (params?.serviceType) {
      queryParams.serviceType = params.serviceType;
    }

    if (params?.serviceGroup) {
      queryParams.group = params.serviceGroup;
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
   * Get a specific service instance
   * GET /api/v1/server/services/:serviceType/:instanceId
   */
  async getService(serviceType: string, instanceId: string): Promise<ServiceInstance | null> {
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
   * Check if service type is in maintenance
   * GET /api/v1/server/services/maintenance/:serviceType
   */
  async isServiceInMaintenance(serviceType: string): Promise<boolean> {
    this.logger.debug('Checking maintenance status via API', { serviceType });

    const response = await this.apiClient.get<{ serviceType: string; isInMaintenance: boolean }>(
      `/api/v1/server/services/maintenance/${serviceType}`
    );

    if (!response.success || !response.data) {
      throw new Error(response.error?.message || 'Failed to check maintenance status');
    }

    this.logger.info('Maintenance status checked via API', {
      serviceType,
      isInMaintenance: response.data.isInMaintenance
    });

    return response.data.isInMaintenance;
  }

  /**
   * Get maintenance message for service type
   * GET /api/v1/server/services/maintenance/:serviceType/message?lang=ko
   */
  async getServiceMaintenanceMessage(serviceType: string, lang?: 'ko' | 'en' | 'zh'): Promise<string | null> {
    this.logger.debug('Fetching maintenance message via API', { serviceType, lang });

    const params: any = {};
    if (lang) {
      params.lang = lang;
    }

    const response = await this.apiClient.get<{
      serviceType: string;
      isInMaintenance: boolean;
      message: string | null;
      startTime?: string;
      endTime?: string;
    }>(`/api/v1/server/services/maintenance/${serviceType}/message`, { params });

    if (!response.success || !response.data) {
      throw new Error(response.error?.message || 'Failed to get maintenance message');
    }

    this.logger.info('Maintenance message fetched via API', {
      serviceType,
      isInMaintenance: response.data.isInMaintenance,
      hasMessage: !!response.data.message
    });

    return response.data.message;
  }

  /**
   * Get whitelists (IP and Account)
   * GET /api/v1/server/whitelists
   */
  async getWhitelists(): Promise<WhitelistData> {
    this.logger.debug('Fetching whitelists via API');

    const response = await this.apiClient.get<WhitelistData>('/api/v1/server/whitelists');

    if (!response.success || !response.data) {
      throw new Error(response.error?.message || 'Failed to fetch whitelists');
    }

    this.logger.info('Whitelists fetched via API', {
      ipCount: response.data.ipWhitelist.ips.length,
      accountCount: response.data.accountWhitelist.accountIds.length
    });

    return response.data;
  }

  /**
   * Check if IP is whitelisted
   * Helper method that fetches whitelists and checks IP
   */
  async isIpWhitelisted(ip: string): Promise<boolean> {
    const whitelists = await this.getWhitelists();

    if (!whitelists.ipWhitelist.enabled) {
      return false;
    }

    // Check exact match
    if (whitelists.ipWhitelist.ips.includes(ip)) {
      return true;
    }

    // Check CIDR match (basic implementation)
    // For production, use a proper CIDR library like 'ip-cidr'
    for (const cidr of whitelists.ipWhitelist.ips) {
      if (cidr.includes('/')) {
        // CIDR notation detected - for now, just check prefix
        const [network] = cidr.split('/');
        if (ip.startsWith(network.split('.').slice(0, 3).join('.'))) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Check if account is whitelisted
   * Helper method that fetches whitelists and checks account ID
   */
  async isAccountWhitelisted(accountId: string): Promise<boolean> {
    const whitelists = await this.getWhitelists();

    if (!whitelists.accountWhitelist.enabled) {
      return false;
    }

    return whitelists.accountWhitelist.accountIds.includes(accountId);
  }
}


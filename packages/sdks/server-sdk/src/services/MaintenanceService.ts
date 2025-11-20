/**
 * Maintenance Service
 * Handles global maintenance status retrieval and caching
 */

import { ApiClient } from '../client/ApiClient';
import { Logger } from '../utils/logger';
import { MaintenanceStatus } from '../types/api';

export class MaintenanceService {
  private apiClient: ApiClient;
  private logger: Logger;
  private cachedStatus: MaintenanceStatus | null = null;

  constructor(apiClient: ApiClient, logger: Logger) {
    this.apiClient = apiClient;
    this.logger = logger;
  }

  /**
   * Fetch maintenance status from backend
   * GET /api/v1/server/maintenance
   */
  async getStatus(): Promise<MaintenanceStatus> {
    this.logger.debug('Fetching maintenance status');

    const response = await this.apiClient.get<MaintenanceStatus>(
      '/api/v1/server/maintenance'
    );

    if (!response.success || !response.data) {
      throw new Error(response.error?.message || 'Failed to fetch maintenance status');
    }

    this.cachedStatus = response.data;

    this.logger.info('Maintenance status fetched', {
      isUnderMaintenance: response.data.isUnderMaintenance,
    });

    return response.data;
  }

  /**
   * Refresh maintenance cache
   */
  async refresh(): Promise<MaintenanceStatus> {
    this.logger.info('Refreshing maintenance cache');
    return await this.getStatus();
  }

  /**
   * Get cached maintenance status
   */
  getCached(): MaintenanceStatus | null {
    return this.cachedStatus;
  }

  /**
   * Update cached maintenance status
   * Used by cache manager or event listener when maintenance changes
   */
  updateCache(status: MaintenanceStatus | null): void {
    this.cachedStatus = status;
  }
}


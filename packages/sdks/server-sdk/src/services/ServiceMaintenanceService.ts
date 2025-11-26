/**
 * Service Maintenance Service
 * Handles global service maintenance status retrieval and caching
 */

import { ApiClient } from '../client/ApiClient';
import { Logger } from '../utils/logger';
import { MaintenanceStatus } from '../types/api';

export class ServiceMaintenanceService {
  private apiClient: ApiClient;
  private logger: Logger;
  private cachedStatus: MaintenanceStatus | null = null;

  constructor(apiClient: ApiClient, logger: Logger) {
    this.apiClient = apiClient;
    this.logger = logger;
  }

  /**
   * Fetch service maintenance status from backend
   * GET /api/v1/server/maintenance
   */
  async getStatus(): Promise<MaintenanceStatus> {
    this.logger.debug('Fetching service maintenance status');

    const response = await this.apiClient.get<MaintenanceStatus>(
      '/api/v1/server/maintenance'
    );

    if (!response.success || !response.data) {
      throw new Error(response.error?.message || 'Failed to fetch service maintenance status');
    }

    this.cachedStatus = response.data;

    this.logger.info('Service maintenance status fetched', {
      isUnderMaintenance: response.data.isUnderMaintenance,
    });

    return response.data;
  }

  /**
   * Refresh service maintenance cache
   */
  async refresh(): Promise<MaintenanceStatus> {
    this.logger.info('Refreshing service maintenance cache');
    return await this.getStatus();
  }

  /**
   * Get cached service maintenance status
   */
  getCached(): MaintenanceStatus | null {
    return this.cachedStatus;
  }

  /**
   * Update cached service maintenance status
   * Used by cache manager or event listener when maintenance changes
   */
  updateCache(status: MaintenanceStatus | null): void {
    this.cachedStatus = status;
  }

  /**
   * Check if service is currently in maintenance based on flag and time window
   */
  isInMaintenance(): boolean {
    if (!this.cachedStatus) {
      return false;
    }

    const { isUnderMaintenance, detail } = this.cachedStatus;

    if (!isUnderMaintenance) {
      return false;
    }

    const now = new Date();

    // Check if maintenance has not started yet
    if (detail?.startsAt) {
      const startDate = new Date(detail.startsAt);
      if (!Number.isNaN(startDate.getTime()) && now < startDate) {
        return false;
      }
    }

    // Check if maintenance has already ended
    if (detail?.endsAt) {
      const endDate = new Date(detail.endsAt);
      if (!Number.isNaN(endDate.getTime()) && now > endDate) {
        return false;
      }
    }

    return true;
  }

  /**
   * Get localized maintenance message for the service
   * Returns null when maintenance is not active
   */
  getMessage(lang: 'ko' | 'en' | 'zh' = 'en'): string | null {
    if (!this.isInMaintenance() || !this.cachedStatus?.detail) {
      return null;
    }

    const detail = this.cachedStatus.detail;

    // Try localized message first
    const localized = detail.localeMessages?.[lang];
    if (localized && localized.trim().length > 0) {
      return localized;
    }

    // Fallback to default message
    return detail.message || null;
  }
}


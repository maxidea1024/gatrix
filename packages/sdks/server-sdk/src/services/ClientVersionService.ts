/**
 * Client Version Service
 * Handles client version list and retrieval
 * Uses per-environment API pattern: GET /api/v1/server/:env/client-versions
 * Extends BaseEnvironmentService for common fetch/caching logic
 */

import { ApiClient } from '../client/ApiClient';
import { Logger } from '../utils/logger';
import { EnvironmentResolver } from '../utils/EnvironmentResolver';
import { ClientVersion, ClientVersionListResponse } from '../types/api';
import { BaseEnvironmentService } from './BaseEnvironmentService';

export class ClientVersionService extends BaseEnvironmentService<
  ClientVersion,
  ClientVersionListResponse,
  number
> {
  constructor(apiClient: ApiClient, logger: Logger, envResolver: EnvironmentResolver) {
    super(apiClient, logger, envResolver);
  }

  // ==================== Abstract Method Implementations ====================

  protected getEndpoint(environment: string): string {
    return `/api/v1/server/${encodeURIComponent(environment)}/client-versions`;
  }

  protected extractItems(response: ClientVersionListResponse): ClientVersion[] {
    return response.clientVersions;
  }

  protected getServiceName(): string {
    return 'client versions';
  }

  protected getItemId(item: ClientVersion): number {
    return item.id;
  }

  // ==================== Override for ETag Invalidation ====================

  /**
   * Refresh cached client versions for a specific environment
   */
  async refreshByEnvironment(environment: string): Promise<ClientVersion[]> {
    this.logger.info('Refreshing client versions cache', { environment });
    // Invalidate ETag cache to force fresh data fetch
    this.apiClient.invalidateEtagCache(this.getEndpoint(environment));
    return await this.listByEnvironment(environment);
  }

  /**
   * Update a single client version in cache (immutable)
   * @param item Client version to update
   * @param environment Environment name (required)
   */
  updateSingleClientVersion(item: ClientVersion, environment: string): void {
    this.updateItemInCache(item, environment);
  }

  // ==================== Domain-specific Methods ====================

  /**
   * Get client version by platform and version string
   * @param platform Platform name
   * @param version Version string
   * @param environment Environment name (required)
   */
  getByPlatformAndVersion(
    platform: string,
    version: string,
    environment: string
  ): ClientVersion | null {
    const versions = this.getCached(environment);
    return versions.find((v) => v.platform === platform && v.clientVersion === version) || null;
  }

  /**
   * Get latest client version by platform
   * Returns the first version with ONLINE status for the given platform
   * @param platform Platform name
   * @param environment Environment name (required)
   * @param status Optional status filter
   */
  getLatestByPlatform(
    platform: string,
    environment: string,
    status?: string
  ): ClientVersion | null {
    const versions = this.getCached(environment);
    const filtered = versions.filter((v) => {
      if (v.platform !== platform) return false;
      if (status && v.clientStatus !== status) return false;
      return true;
    });

    if (filtered.length === 0) return null;

    // Sort by version descending (semantic version comparison)
    const sorted = filtered.sort((a, b) => {
      return this.compareSemver(b.clientVersion, a.clientVersion);
    });

    return sorted[0];
  }

  /**
   * Get all client versions by platform
   * @param platform Platform name
   * @param environment Environment name (required)
   */
  getByPlatform(platform: string, environment: string): ClientVersion[] {
    const versions = this.getCached(environment);
    return versions.filter((v) => v.platform === platform);
  }

  /**
   * Compare semantic versions
   * Returns positive if a > b, negative if a < b, 0 if equal
   */
  private compareSemver(a: string, b: string): number {
    const partsA = a.split('.').map((p) => parseInt(p, 10) || 0);
    const partsB = b.split('.').map((p) => parseInt(p, 10) || 0);
    const maxLen = Math.max(partsA.length, partsB.length);

    for (let i = 0; i < maxLen; i++) {
      const numA = partsA[i] || 0;
      const numB = partsB[i] || 0;
      if (numA !== numB) {
        return numA - numB;
      }
    }

    return 0;
  }

  /**
   * Check if a client version is in maintenance based on time window
   */
  isMaintenanceActive(version: ClientVersion): boolean {
    if (version.clientStatus !== 'MAINTENANCE') {
      return false;
    }

    const now = new Date();

    // Check if maintenance has not started yet
    if (version.maintenanceStartDate) {
      const startDate = new Date(version.maintenanceStartDate);
      if (!Number.isNaN(startDate.getTime()) && now < startDate) {
        return false;
      }
    }

    // Check if maintenance has already ended
    if (version.maintenanceEndDate) {
      const endDate = new Date(version.maintenanceEndDate);
      if (!Number.isNaN(endDate.getTime()) && now > endDate) {
        return false;
      }
    }

    return true;
  }

  /**
   * Get maintenance message for a client version with language support
   */
  getMaintenanceMessage(version: ClientVersion, lang: 'ko' | 'en' | 'zh' = 'en'): string | null {
    if (!this.isMaintenanceActive(version)) {
      return null;
    }

    // Try to find localized message
    if (version.maintenanceLocales && version.maintenanceLocales.length > 0) {
      const locale = version.maintenanceLocales.find((l) => l.lang === lang);
      if (locale) {
        return locale.message;
      }
    }

    // Fallback to default message
    return version.maintenanceMessage || null;
  }
}

/**
 * Client Version Service
 * Handles client version list and retrieval
 * Supports both single-environment (default) and multi-environment (Edge) modes
 */

import { ApiClient } from '../client/ApiClient';
import { Logger } from '../utils/logger';
import { ClientVersion, ClientVersionListResponse } from '../types/api';

export class ClientVersionService {
  private apiClient: ApiClient;
  private logger: Logger;
  // Target environments (empty = single environment mode)
  private environments: string[];
  // Multi-environment cache: Map<environmentId, ClientVersion[]>
  private cachedVersionsByEnv: Map<string, ClientVersion[]> = new Map();
  // Default environment ID (for single-environment mode)
  private defaultEnvId: string = 'default';

  constructor(apiClient: ApiClient, logger: Logger, environments: string[] = []) {
    this.apiClient = apiClient;
    this.logger = logger;
    this.environments = environments;
  }

  private isMultiEnvironment(): boolean {
    return this.environments.length > 0;
  }

  /**
   * Get all client versions
   * Single-env mode: GET /api/v1/server/client-versions
   * Multi-env mode: GET /api/v1/server/client-versions?environments=env1,env2,env3
   */
  async list(): Promise<ClientVersion[]> {
    let endpoint = `/api/v1/server/client-versions`;
    if (this.isMultiEnvironment()) {
      endpoint += `?environments=${this.environments.join(',')}`;
    }

    this.logger.debug('Fetching client versions', { environments: this.environments });

    const response = await this.apiClient.get<ClientVersionListResponse>(endpoint);

    if (!response.success || !response.data) {
      throw new Error(response.error?.message || 'Failed to fetch client versions');
    }

    const versions = response.data.clientVersions;

    // Group by environment
    this.cachedVersionsByEnv.clear();
    for (const version of versions) {
      // In single-env mode, all data goes to 'default'
      let envKey = this.defaultEnvId;
      if (this.isMultiEnvironment()) {
        // Use environmentName if available (user preference), fallback to environmentId
        // Also check if the configured environments contain the name or ID to ensure consistency
        if (version.environmentName && this.environments.includes(version.environmentName)) {
          envKey = version.environmentName;
        } else if (version.environmentId && this.environments.includes(version.environmentId)) {
          envKey = version.environmentId;
        } else {
          // Fallback: mostly for cases where response might not exactly match request due to case or resolving
          // Prefer name if available
          envKey = version.environmentName || version.environmentId || this.defaultEnvId;
        }
      }

      if (!this.cachedVersionsByEnv.has(envKey)) {
        this.cachedVersionsByEnv.set(envKey, []);
      }
      this.cachedVersionsByEnv.get(envKey)!.push(version);
    }

    this.logger.info('Client versions fetched', {
      count: versions.length,
      environmentCount: this.cachedVersionsByEnv.size,
      environments: this.environments,
    });

    return versions;
  }

  /**
   * Get cached client versions
   * @param environmentId Only used in multi-environment mode
   */
  getCached(environmentId?: string): ClientVersion[] {
    const envId = this.isMultiEnvironment() ? (environmentId || this.defaultEnvId) : this.defaultEnvId;
    return this.cachedVersionsByEnv.get(envId) || [];
  }

  /**
   * Get all cached client versions (all environments)
   * Only meaningful in multi-environment mode
   */
  getAllCached(): Map<string, ClientVersion[]> {
    return this.cachedVersionsByEnv;
  }

  /**
   * Refresh cached client versions
   */
  async refresh(): Promise<ClientVersion[]> {
    this.logger.info('Refreshing client versions cache');
    return await this.list();
  }

  /**
   * Update cache with new data
   * @param environmentId Only used in multi-environment mode
   */
  updateCache(versions: ClientVersion[], environmentId?: string): void {
    const envId = this.isMultiEnvironment() ? (environmentId || this.defaultEnvId) : this.defaultEnvId;
    this.cachedVersionsByEnv.set(envId, versions);
    this.logger.debug('Client versions cache updated', { environmentId: envId, count: versions.length });
  }

  /**
   * Get client version by platform and version string
   */
  getByPlatformAndVersion(platform: string, version: string, environmentId?: string): ClientVersion | null {
    const versions = this.getCached(environmentId);
    return versions.find(
      (v) => v.platform === platform && v.clientVersion === version
    ) || null;
  }

  /**
   * Get latest client version by platform
   * Returns the first version with ONLINE status for the given platform
   */
  getLatestByPlatform(platform: string, environmentId?: string, status?: string): ClientVersion | null {
    const versions = this.getCached(environmentId);
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
   */
  getByPlatform(platform: string, environmentId?: string): ClientVersion[] {
    const versions = this.getCached(environmentId);
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


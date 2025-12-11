/**
 * Client Version Service
 * Handles client version list and retrieval
 * Supports both single-environment (default) and multi-environment (Edge) modes
 */

import { ApiClient } from '../client/ApiClient';
import { Logger } from '../utils/logger';
import { ClientVersion, ClientVersionListResponse, ClientVersionByEnvResponse } from '../types/api';

export class ClientVersionService {
  private apiClient: ApiClient;
  private logger: Logger;
  // Target environments ('*' = all environments, string[] = specific, empty = single mode)
  // Note: environments are identified by environmentName
  private environments: string[] | '*';
  // Multi-environment cache: Map<environment (environmentName), ClientVersion[]>
  private cachedVersionsByEnv: Map<string, ClientVersion[]> = new Map();
  // Default environment key (for single-environment mode)
  private defaultEnvKey: string = 'default';

  constructor(apiClient: ApiClient, logger: Logger, environments: string[] | '*' = []) {
    this.apiClient = apiClient;
    this.logger = logger;
    this.environments = environments;
  }

  private isMultiEnvironment(): boolean {
    return this.environments === '*' || (Array.isArray(this.environments) && this.environments.length > 0);
  }

  private isAllEnvironments(): boolean {
    return this.environments === '*';
  }

  /**
   * Get all client versions
   * Single-env mode: GET /api/v1/server/client-versions -> { clientVersions: [...] }
   * Multi-env mode: GET /api/v1/server/client-versions?environments=... -> { byEnvironment: { [env]: [...] } }
   * All-env mode: GET /api/v1/server/client-versions?environments=* -> { byEnvironment: { [env]: [...] } }
   */
  async list(): Promise<ClientVersion[]> {
    let endpoint = `/api/v1/server/client-versions`;
    if (this.isAllEnvironments()) {
      endpoint += `?environments=*`;
    } else if (this.isMultiEnvironment()) {
      endpoint += `?environments=${(this.environments as string[]).join(',')}`;
    }

    this.logger.debug('Fetching client versions', { environments: this.environments });

    // Clear cache before fetching
    this.cachedVersionsByEnv.clear();

    if (this.isMultiEnvironment()) {
      // Multi-environment mode: backend returns { byEnvironment: { [env]: data[] } }
      const response = await this.apiClient.get<ClientVersionByEnvResponse>(endpoint);

      if (!response.success || !response.data) {
        throw new Error(response.error?.message || 'Failed to fetch client versions');
      }

      const byEnvironment = response.data.byEnvironment;
      let totalCount = 0;

      // Store directly by environment key (already separated by backend)
      for (const [envName, versions] of Object.entries(byEnvironment)) {
        this.cachedVersionsByEnv.set(envName, versions);
        totalCount += versions.length;
      }

      this.logger.info('Client versions fetched', {
        count: totalCount,
        environmentCount: this.cachedVersionsByEnv.size,
        environments: this.environments,
      });

      // Return all versions as flat array for backward compatibility
      return Array.from(this.cachedVersionsByEnv.values()).flat();
    } else {
      // Single-environment mode: backend returns { clientVersions: [...] }
      const response = await this.apiClient.get<ClientVersionListResponse>(endpoint);

      if (!response.success || !response.data) {
        throw new Error(response.error?.message || 'Failed to fetch client versions');
      }

      const versions = response.data.clientVersions;
      this.cachedVersionsByEnv.set(this.defaultEnvKey, versions);

      this.logger.info('Client versions fetched', {
        count: versions.length,
        environments: 'single',
      });

      return versions;
    }
  }

  /**
   * Get cached client versions
   * @param environment Environment name. Only used in multi-environment mode.
   *                    If omitted in multi-environment mode, returns all versions as flat array.
   */
  getCached(environment?: string): ClientVersion[] {
    if (!this.isMultiEnvironment()) {
      // Single-environment mode: return default key
      return this.cachedVersionsByEnv.get(this.defaultEnvKey) || [];
    }

    // Multi-environment mode
    if (environment) {
      // Specific environment requested
      return this.cachedVersionsByEnv.get(environment) || [];
    }

    // No environment specified: return all versions as flat array
    return Array.from(this.cachedVersionsByEnv.values()).flat();
  }

  /**
   * Get all cached client versions (all environments)
   * Only meaningful in multi-environment mode
   */
  getAllCached(): Map<string, ClientVersion[]> {
    return this.cachedVersionsByEnv;
  }

  /**
   * Clear all cached data
   */
  clearCache(): void {
    this.cachedVersionsByEnv.clear();
    this.logger.debug('Client versions cache cleared');
  }

  /**
   * Refresh cached client versions
   * Invalidates ETag cache first to ensure fresh data is fetched
   */
  async refresh(): Promise<ClientVersion[]> {
    this.logger.info('Refreshing client versions cache');
    // Invalidate ETag cache to force fresh data fetch
    this.apiClient.invalidateEtagCache('/api/v1/server/client-versions');
    return await this.list();
  }

  /**
   * Update cache with new data
   * @param environment Environment name. Only used in multi-environment mode.
   */
  updateCache(versions: ClientVersion[], environment?: string): void {
    const envKey = this.isMultiEnvironment() ? (environment || this.defaultEnvKey) : this.defaultEnvKey;
    this.cachedVersionsByEnv.set(envKey, versions);
    this.logger.debug('Client versions cache updated', { environment: envKey, count: versions.length });
  }

  /**
   * Get client version by platform and version string
   * @param environment Environment name. Only used in multi-environment mode.
   */
  getByPlatformAndVersion(platform: string, version: string, environment?: string): ClientVersion | null {
    const versions = this.getCached(environment);
    return versions.find(
      (v) => v.platform === platform && v.clientVersion === version
    ) || null;
  }

  /**
   * Get latest client version by platform
   * Returns the first version with ONLINE status for the given platform
   * @param environment Environment name. Only used in multi-environment mode.
   */
  getLatestByPlatform(platform: string, environment?: string, status?: string): ClientVersion | null {
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
   * @param environment Environment name. Only used in multi-environment mode.
   */
  getByPlatform(platform: string, environment?: string): ClientVersion[] {
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


/**
 * Client Version Service
 * Handles client version list and retrieval
 * Uses per-environment API pattern: GET /api/v1/server/:env/client-versions
 */

import { ApiClient } from '../client/ApiClient';
import { Logger } from '../utils/logger';
import { ClientVersion, ClientVersionListResponse } from '../types/api';

export class ClientVersionService {
  private apiClient: ApiClient;
  private logger: Logger;
  // Default environment for single-environment mode
  private defaultEnvironment: string;
  // Multi-environment cache: Map<environment (environmentName), ClientVersion[]>
  private cachedVersionsByEnv: Map<string, ClientVersion[]> = new Map();

  constructor(apiClient: ApiClient, logger: Logger, defaultEnvironment: string = 'development') {
    this.apiClient = apiClient;
    this.logger = logger;
    this.defaultEnvironment = defaultEnvironment;
  }

  /**
   * Get client versions for a specific environment
   * GET /api/v1/server/:env/client-versions -> { clientVersions: [...] }
   */
  async listByEnvironment(environment: string): Promise<ClientVersion[]> {
    const endpoint = `/api/v1/server/${encodeURIComponent(environment)}/client-versions`;

    this.logger.debug('Fetching client versions', { environment });

    const response = await this.apiClient.get<ClientVersionListResponse>(endpoint);

    if (!response.success || !response.data) {
      throw new Error(response.error?.message || 'Failed to fetch client versions');
    }

    const versions = response.data.clientVersions;
    this.cachedVersionsByEnv.set(environment, versions);

    this.logger.info('Client versions fetched', {
      count: versions.length,
      environment,
    });

    return versions;
  }

  /**
   * Get client versions for multiple environments
   * Fetches each environment separately and caches results
   */
  async listByEnvironments(environments: string[]): Promise<ClientVersion[]> {
    this.logger.debug('Fetching client versions for multiple environments', { environments });

    const results: ClientVersion[] = [];

    for (const env of environments) {
      try {
        const versions = await this.listByEnvironment(env);
        results.push(...versions);
      } catch (error) {
        this.logger.error(`Failed to fetch client versions for environment ${env}`, { error });
      }
    }

    this.logger.info('Client versions fetched for all environments', {
      count: results.length,
      environmentCount: environments.length,
    });

    return results;
  }

  /**
   * Get all client versions (uses default environment for single-env mode)
   * For backward compatibility
   */
  async list(): Promise<ClientVersion[]> {
    return this.listByEnvironment(this.defaultEnvironment);
  }

  /**
   * Get cached client versions
   * @param environment Environment name. If omitted, returns all versions as flat array.
   */
  getCached(environment?: string): ClientVersion[] {
    if (environment) {
      return this.cachedVersionsByEnv.get(environment) || [];
    }
    // No environment specified: return all versions as flat array
    return Array.from(this.cachedVersionsByEnv.values()).flat();
  }

  /**
   * Get all cached client versions (all environments)
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
   * Refresh cached client versions for a specific environment
   */
  async refreshByEnvironment(environment: string): Promise<ClientVersion[]> {
    this.logger.info('Refreshing client versions cache', { environment });
    // Invalidate ETag cache to force fresh data fetch
    this.apiClient.invalidateEtagCache(`/api/v1/server/${encodeURIComponent(environment)}/client-versions`);
    return await this.listByEnvironment(environment);
  }

  /**
   * Refresh cached client versions (uses default environment)
   * For backward compatibility
   */
  async refresh(): Promise<ClientVersion[]> {
    return this.refreshByEnvironment(this.defaultEnvironment);
  }

  /**
   * Update cache with new data
   */
  updateCache(versions: ClientVersion[], environment?: string): void {
    const envKey = environment || this.defaultEnvironment;
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


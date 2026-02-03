/**
 * Whitelist Service
 * Handles IP and Account whitelist retrieval and caching
 * Uses per-environment API pattern: GET /api/v1/server/:env/whitelists
 *
 * DESIGN PRINCIPLES:
 * - All methods that access cached data MUST receive environment explicitly in multi-env mode
 * - Environment resolution is delegated to EnvironmentResolver
 * - In multi-environment mode (edge), environment MUST always be provided
 */

import { ApiClient } from '../client/ApiClient';
import { Logger } from '../utils/logger';
import { EnvironmentResolver } from '../utils/EnvironmentResolver';

export interface IpWhitelistEntry {
  id: number;
  ipAddress: string;
}

export interface AccountWhitelistEntry {
  id: number;
  accountId: string;
}

export interface WhitelistData {
  ipWhitelist: IpWhitelistEntry[];
  accountWhitelist: AccountWhitelistEntry[];
}

export interface WhitelistResponse {
  success: boolean;
  data?: WhitelistData;
  error?: {
    message: string;
  };
}

export class WhitelistService {
  private apiClient: ApiClient;
  private logger: Logger;
  private envResolver: EnvironmentResolver;
  // Multi-environment cache: Map<environment (environmentName), WhitelistData>
  private cachedWhitelistByEnv: Map<string, WhitelistData> = new Map();
  // Whether this feature is enabled
  private featureEnabled: boolean = true;

  constructor(apiClient: ApiClient, logger: Logger, envResolver: EnvironmentResolver) {
    this.apiClient = apiClient;
    this.logger = logger;
    this.envResolver = envResolver;
  }

  /**
   * Set feature enabled flag
   * When false, refresh methods will log a warning
   */
  setFeatureEnabled(enabled: boolean): void {
    this.featureEnabled = enabled;
  }

  /**
   * Check if feature is enabled
   */
  isFeatureEnabled(): boolean {
    return this.featureEnabled;
  }

  /**
   * Get all whitelists (IP and Account) for a specific environment
   * GET /api/v1/server/:env/whitelists
   */
  async listByEnvironment(environment: string): Promise<WhitelistData> {
    const endpoint = `/api/v1/server/${encodeURIComponent(environment)}/whitelists`;

    this.logger.debug('Fetching whitelists', { environment });

    const response = await this.apiClient.get<WhitelistData>(endpoint);

    if (!response.success || !response.data) {
      throw new Error(response.error?.message || 'Failed to fetch whitelists');
    }

    this.cachedWhitelistByEnv.set(environment, response.data);
    this.logger.info('Whitelists fetched', {
      environment,
      ipCount: response.data.ipWhitelist.length,
      accountCount: response.data.accountWhitelist.length,
    });

    return response.data;
  }

  /**
   * Get whitelists for multiple environments
   */
  async listByEnvironments(environments: string[]): Promise<WhitelistData[]> {
    this.logger.debug('Fetching whitelists for multiple environments', {
      environments,
    });

    const results: WhitelistData[] = [];

    for (const env of environments) {
      try {
        const data = await this.listByEnvironment(env);
        results.push(data);
      } catch (error) {
        this.logger.error(`Failed to fetch whitelists for environment ${env}`, {
          error,
        });
      }
    }

    return results;
  }

  /**
   * Refresh whitelist cache for a specific environment
   * @param environment Environment name
   * @param suppressWarnings If true, suppress feature disabled warnings (used by refreshAll)
   */
  async refreshByEnvironment(
    environment: string,
    suppressWarnings?: boolean
  ): Promise<WhitelistData> {
    if (!this.featureEnabled && !suppressWarnings) {
      this.logger.warn('WhitelistService.refreshByEnvironment() called but feature is disabled', {
        environment,
      });
    }
    this.logger.debug('Refreshing whitelist cache', { environment });
    return await this.listByEnvironment(environment);
  }

  /**
   * Get cached whitelists
   * @param environment Environment name (required)
   */
  getCached(environment: string): WhitelistData {
    return (
      this.cachedWhitelistByEnv.get(environment) || {
        ipWhitelist: [],
        accountWhitelist: [],
      }
    );
  }

  /**
   * Get all cached whitelists (all environments)
   */
  getAllCached(): Map<string, WhitelistData> {
    return this.cachedWhitelistByEnv;
  }

  /**
   * Clear all cached data
   */
  clearCache(): void {
    this.cachedWhitelistByEnv.clear();
    this.logger.debug('Whitelist cache cleared');
  }

  /**
   * Clear cached data for a specific environment
   */
  clearCacheForEnvironment(environment: string): void {
    this.cachedWhitelistByEnv.delete(environment);
    this.logger.debug('Whitelist cache cleared for environment', {
      environment,
    });
  }

  /**
   * Get cached IP whitelist
   * @param environment Environment name (required)
   */
  getCachedIpWhitelist(environment: string): IpWhitelistEntry[] {
    return this.getCached(environment).ipWhitelist;
  }

  /**
   * Get cached Account whitelist
   * @param environment Environment name (required)
   */
  getCachedAccountWhitelist(environment: string): AccountWhitelistEntry[] {
    return this.getCached(environment).accountWhitelist;
  }

  /**
   * Check if IP is whitelisted (supports CIDR notation)
   * Note: Backend already filters for enabled and valid entries
   * @param ip IP address to check
   * @param environment Environment name (required)
   */
  isIpWhitelisted(ip: string, environment: string): boolean {
    const whitelist = this.getCached(environment);
    return whitelist.ipWhitelist.some((entry) => {
      // Check exact IP match
      if (entry.ipAddress === ip) {
        return true;
      }

      // Check CIDR match if ipAddress contains CIDR notation
      if (entry.ipAddress.includes('/')) {
        return this.isIpInCIDR(ip, entry.ipAddress);
      }

      return false;
    });
  }

  /**
   * Check if IP is within CIDR range
   * Supports IPv4 CIDR notation (e.g., 192.168.1.0/24)
   */
  private isIpInCIDR(ip: string, cidr: string): boolean {
    try {
      const [cidrIp, cidrMask] = cidr.split('/');
      const mask = parseInt(cidrMask, 10);

      if (isNaN(mask) || mask < 0 || mask > 32) {
        this.logger.warn('Invalid CIDR mask', { cidr });
        return false;
      }

      // Convert IP strings to 32-bit integers
      const ipNum = this.ipToNumber(ip);
      const cidrIpNum = this.ipToNumber(cidrIp);

      if (ipNum === null || cidrIpNum === null) {
        return false;
      }

      // Calculate network mask
      const maskBits = (0xffffffff << (32 - mask)) >>> 0;

      // Check if IP is in CIDR range
      return (ipNum & maskBits) === (cidrIpNum & maskBits);
    } catch (error) {
      this.logger.warn('Error checking CIDR', { ip, cidr, error });
      return false;
    }
  }

  /**
   * Convert IP address string to 32-bit number
   */
  private ipToNumber(ip: string): number | null {
    const parts = ip.split('.');
    if (parts.length !== 4) {
      return null;
    }

    let num = 0;
    for (let i = 0; i < 4; i++) {
      const part = parseInt(parts[i], 10);
      if (isNaN(part) || part < 0 || part > 255) {
        return null;
      }
      num = (num << 8) + part;
    }

    return num >>> 0; // Convert to unsigned 32-bit integer
  }

  /**
   * Check if account is whitelisted
   * Note: Backend already filters for enabled and valid entries
   * @param accountId Account ID to check
   * @param environment Environment name (required)
   */
  isAccountWhitelisted(accountId: string, environment: string): boolean {
    const whitelist = this.getCached(environment);
    return whitelist.accountWhitelist.some((entry) => {
      return entry.accountId === accountId;
    });
  }

  /**
   * Update cached whitelist data
   * Called when whitelist.updated event is received
   * @param whitelist Whitelist data to cache
   * @param environment Environment name (required)
   */
  updateCache(whitelist: WhitelistData, environment: string): void {
    this.logger.debug('Updating whitelist cache', {
      environment,
      ipCount: whitelist.ipWhitelist.length,
      accountCount: whitelist.accountWhitelist.length,
    });
    this.cachedWhitelistByEnv.set(environment, whitelist);
  }
}

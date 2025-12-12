/**
 * Whitelist Service
 * Handles IP and Account whitelist retrieval and caching
 * Uses per-environment API pattern: GET /api/v1/server/:env/whitelists
 */

import { ApiClient } from '../client/ApiClient';
import { Logger } from '../utils/logger';

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
  // Default environment for single-environment mode
  private defaultEnvironment: string;
  // Multi-environment cache: Map<environment (environmentName), WhitelistData>
  private cachedWhitelistByEnv: Map<string, WhitelistData> = new Map();

  constructor(apiClient: ApiClient, logger: Logger, defaultEnvironment: string = 'development') {
    this.apiClient = apiClient;
    this.logger = logger;
    this.defaultEnvironment = defaultEnvironment;
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
    this.logger.debug('Fetching whitelists for multiple environments', { environments });

    const results: WhitelistData[] = [];

    for (const env of environments) {
      try {
        const data = await this.listByEnvironment(env);
        results.push(data);
      } catch (error) {
        this.logger.error(`Failed to fetch whitelists for environment ${env}`, { error });
      }
    }

    return results;
  }

  /**
   * Get all whitelists (uses default environment)
   * For backward compatibility
   */
  async list(): Promise<WhitelistData> {
    return this.listByEnvironment(this.defaultEnvironment);
  }

  /**
   * Refresh whitelist cache for a specific environment
   */
  async refreshByEnvironment(environment: string): Promise<WhitelistData> {
    this.logger.debug('Refreshing whitelist cache', { environment });
    return await this.listByEnvironment(environment);
  }

  /**
   * Refresh whitelist cache (uses default environment)
   * For backward compatibility
   */
  async refresh(): Promise<WhitelistData> {
    return this.refreshByEnvironment(this.defaultEnvironment);
  }

  /**
   * Get cached whitelists
   * @param environment Environment name. If omitted, returns default environment data.
   */
  getCached(environment?: string): WhitelistData {
    const envKey = environment || this.defaultEnvironment;
    return this.cachedWhitelistByEnv.get(envKey) || { ipWhitelist: [], accountWhitelist: [] };
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
   * Get cached IP whitelist
   */
  getCachedIpWhitelist(environment?: string): IpWhitelistEntry[] {
    return this.getCached(environment).ipWhitelist;
  }

  /**
   * Get cached Account whitelist
   */
  getCachedAccountWhitelist(environment?: string): AccountWhitelistEntry[] {
    return this.getCached(environment).accountWhitelist;
  }

  /**
   * Check if IP is whitelisted (supports CIDR notation)
   * Note: Backend already filters for enabled and valid entries
   */
  isIpWhitelisted(ip: string, environment?: string): boolean {
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
   */
  isAccountWhitelisted(accountId: string, environment?: string): boolean {
    const whitelist = this.getCached(environment);
    return whitelist.accountWhitelist.some((entry) => {
      return entry.accountId === accountId;
    });
  }

  /**
   * Update cached whitelist data
   * Called when whitelist.updated event is received
   */
  updateCache(whitelist: WhitelistData, environment?: string): void {
    const envKey = environment || this.defaultEnvironment;
    this.logger.debug('Updating whitelist cache', {
      environment: envKey,
      ipCount: whitelist.ipWhitelist.length,
      accountCount: whitelist.accountWhitelist.length,
    });
    this.cachedWhitelistByEnv.set(envKey, whitelist);
  }
}

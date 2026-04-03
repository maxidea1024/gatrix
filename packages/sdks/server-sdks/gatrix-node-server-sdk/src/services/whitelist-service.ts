/**
 * Whitelist Service
 * Handles IP and Account whitelist retrieval and caching
 * Uses per-environment API pattern: GET /api/v1/server/whitelists
 *
 * DESIGN PRINCIPLES:
 * - All methods that access cached data MUST receive environment explicitly in multi-env mode
 * - Environment resolution is delegated to string
 * - In multi-environment mode (edge), environment MUST always be provided
 */

import { ApiClient } from '../client/api-client';
import { ApiClientFactory } from '../client/api-client-factory';
import { Logger } from '../utils/logger';
import { CacheStorageProvider } from '../cache/storage-provider';
import { validateAll } from '../utils/validation';

export interface IpWhitelistEntry {
  id: string;
  ipAddress: string;
}

export interface AccountWhitelistEntry {
  id: string;
  accountId: string;
  ipAddress?: string | null;
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
  private defaultEnvironmentId: string;
  private storage?: CacheStorageProvider;
  // Multi-environment cache: Map<environmentId, WhitelistData>
  private cachedWhitelistByEnv: Map<string, WhitelistData> = new Map();
  // Whether this feature is enabled
  private featureEnabled: boolean = true;
  // Optional factory for multi-environment mode
  private apiClientFactory?: ApiClientFactory;

  constructor(
    apiClient: ApiClient,
    logger: Logger,
    defaultEnvironmentId: string,
    storage?: CacheStorageProvider
  ) {
    this.apiClient = apiClient;
    this.logger = logger;
    this.defaultEnvironmentId = defaultEnvironmentId;
    this.storage = storage;
  }

  /**
   * Update the default environment ID.
   * Called by CacheManager after /ready resolves the real environmentId.
   */
  setDefaultEnvironmentId(environmentId: string): void {
    this.defaultEnvironmentId = environmentId;
  }

  /**
   * Set ApiClientFactory for multi-environment mode.
   * When set, listByEnvironment() uses the factory to get a per-environment ApiClient.
   */
  setApiClientFactory(factory: ApiClientFactory): void {
    this.apiClientFactory = factory;
  }

  /**
   * Get the appropriate ApiClient for a given environment.
   * Uses the factory if available, otherwise falls back to the default client.
   */
  private getApiClient(environmentId?: string): ApiClient {
    if (this.apiClientFactory) {
      return this.apiClientFactory.getClient(environmentId);
    }
    return this.apiClient;
  }

  /**
   * Initialize service and load data from local storage
   */
  async initializeAsync(environmentId?: string): Promise<void> {
    if (!this.storage) return;

    const resolvedEnv = environmentId || this.defaultEnvironmentId;
    try {
      const cachedJson = await this.storage.get(`Whitelist_${resolvedEnv}`);
      if (cachedJson) {
        this.cachedWhitelistByEnv.set(resolvedEnv, JSON.parse(cachedJson));
        this.logger.debug('Loaded whitelist from local storage', {
          environmentId: resolvedEnv,
        });
      }
    } catch (error: any) {
      this.logger.warn('Failed to load whitelist from local storage', {
        environmentId: resolvedEnv,
        error: error.message,
      });
    }
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
   * Fetch IP whitelists for a specific environment
   * GET /api/v1/server/ip-whitelists
   */
  async fetchIpWhitelist(environmentId?: string): Promise<IpWhitelistEntry[]> {
    const endpoint = `/api/v1/server/ip-whitelists`;
    const resolvedEnv = environmentId || this.defaultEnvironmentId;
    const client = this.getApiClient(resolvedEnv);

    this.logger.debug('Fetching IP whitelists', { environmentId: resolvedEnv });

    const response = await client.get<IpWhitelistEntry[]>(endpoint);

    if (!response.success || !response.data) {
      throw new Error(
        response.error?.message || 'Failed to fetch IP whitelists'
      );
    }

    // Update only ipWhitelist part of cache
    const cached = this.getCached(resolvedEnv);
    const updatedData: WhitelistData = {
      ...cached,
      ipWhitelist: response.data,
    };
    this.cachedWhitelistByEnv.set(resolvedEnv, updatedData);

    if (this.storage) {
      await this.storage.save(
        `Whitelist_${resolvedEnv}`,
        JSON.stringify(updatedData)
      );
    }

    this.logger.info('IP whitelists fetched', {
      environmentId: resolvedEnv,
      count: response.data.length,
    });

    return response.data;
  }

  /**
   * Fetch account whitelists for a specific environment
   * GET /api/v1/server/account-whitelists
   */
  async fetchAccountWhitelist(
    environmentId?: string
  ): Promise<AccountWhitelistEntry[]> {
    const endpoint = `/api/v1/server/account-whitelists`;
    const resolvedEnv = environmentId || this.defaultEnvironmentId;
    const client = this.getApiClient(resolvedEnv);

    this.logger.debug('Fetching account whitelists', {
      environmentId: resolvedEnv,
    });

    const response = await client.get<AccountWhitelistEntry[]>(endpoint);

    if (!response.success || !response.data) {
      throw new Error(
        response.error?.message || 'Failed to fetch account whitelists'
      );
    }

    // Update only accountWhitelist part of cache
    const cached = this.getCached(resolvedEnv);
    const updatedData: WhitelistData = {
      ...cached,
      accountWhitelist: response.data,
    };
    this.cachedWhitelistByEnv.set(resolvedEnv, updatedData);

    if (this.storage) {
      await this.storage.save(
        `Whitelist_${resolvedEnv}`,
        JSON.stringify(updatedData)
      );
    }

    this.logger.info('Account whitelists fetched', {
      environmentId: resolvedEnv,
      count: response.data.length,
    });

    return response.data;
  }

  /**
   * Fetch all whitelists (IP + Account) for a specific environment
   * Calls both separate endpoints
   */
  async listByEnvironment(environmentId?: string): Promise<WhitelistData> {
    const resolvedEnv = environmentId || this.defaultEnvironmentId;

    await Promise.all([
      this.fetchIpWhitelist(resolvedEnv),
      this.fetchAccountWhitelist(resolvedEnv),
    ]);

    return this.getCached(resolvedEnv);
  }

  /**
   * Get whitelists for multiple environments
   */
  async listByEnvironments(environmentIds: string[]): Promise<WhitelistData[]> {
    this.logger.debug('Fetching whitelists for multiple environments', {
      environmentIds,
    });

    const results: WhitelistData[] = [];

    for (const env of environmentIds) {
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
   * @param environmentId Environment ID (optional, only used in multi-env mode such as edge)
   * @param suppressWarnings If true, suppress feature disabled warnings (used by refreshAll)
   */
  async refreshByEnvironment(
    suppressWarnings?: boolean,
    environmentId?: string
  ): Promise<WhitelistData> {
    const resolvedEnv = environmentId || this.defaultEnvironmentId;
    if (!this.featureEnabled && !suppressWarnings) {
      this.logger.warn(
        'WhitelistService.refreshByEnvironment() called but feature is disabled',
        {
          environmentId: resolvedEnv,
        }
      );
    }
    this.logger.debug('Refreshing whitelist cache', {
      environmentId: resolvedEnv,
    });
    return await this.listByEnvironment(resolvedEnv);
  }

  /**
   * Get cached whitelists
   * @param environmentId Environment ID (optional, only used in multi-env mode such as edge)
   */
  getCached(environmentId?: string): WhitelistData {
    const resolvedEnv = environmentId || this.defaultEnvironmentId;
    return (
      this.cachedWhitelistByEnv.get(resolvedEnv) || {
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
  clearCacheForEnvironment(environmentId?: string): void {
    const resolvedEnv = environmentId || this.defaultEnvironmentId;
    this.cachedWhitelistByEnv.delete(resolvedEnv);
    this.logger.debug('Whitelist cache cleared for environment', {
      environmentId: resolvedEnv,
    });
  }

  /**
   * Get cached IP whitelist
   * @param environmentId Environment ID (optional, only used in multi-env mode such as edge)
   */
  getCachedIpWhitelist(environmentId?: string): IpWhitelistEntry[] {
    return this.getCached(environmentId).ipWhitelist;
  }

  /**
   * Get cached Account whitelist
   * @param environmentId Environment ID (optional, only used in multi-env mode such as edge)
   */
  getCachedAccountWhitelist(environmentId?: string): AccountWhitelistEntry[] {
    return this.getCached(environmentId).accountWhitelist;
  }

  /**
   * Check if IP is whitelisted (supports CIDR notation)
   * Note: Backend already filters for enabled and valid entries
   * @param ip IP address to check
   * @param environmentId Environment ID (optional, only used in multi-env mode such as edge)
   */
  isIpWhitelisted(ip: string, environmentId?: string): boolean {
    validateAll([{ param: 'ip', value: ip, type: 'string' }]);
    const whitelist = this.getCached(environmentId);
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
   * Supports AND condition: if account whitelist entry has ipAddress, both must match
   * @param accountId Account ID to check
   * @param environmentId Environment ID (optional, only used in multi-env mode such as edge)
   * @param clientIp Client IP for AND condition check (optional)
   */
  isAccountWhitelisted(
    accountId: string,
    environmentId?: string,
    clientIp?: string
  ): boolean {
    validateAll([{ param: 'accountId', value: accountId, type: 'string' }]);
    const whitelist = this.getCached(environmentId);
    return whitelist.accountWhitelist.some((entry) => {
      if (entry.accountId !== accountId) {
        return false;
      }
      // If entry has ipAddress specified, check IP match (AND condition)
      if (entry.ipAddress) {
        return clientIp === entry.ipAddress;
      }
      return true;
    });
  }

  /**
   * Unified whitelist check: account first (with optional IP AND condition), then IP only.
   * Priority: 1) account whitelist (AND ip if specified) → 2) IP whitelist
   * @param options.accountId Account ID to check (optional)
   * @param options.clientIp Client IP address (optional)
   * @param options.environmentId Environment ID (optional)
   * @returns true if whitelisted by either account or IP
   */
  isWhitelisted(options: {
    accountId?: string;
    clientIp?: string;
    environmentId?: string;
  }): boolean {
    const { accountId, clientIp, environmentId } = options;

    // 1. Check account whitelist first (higher priority)
    if (accountId) {
      if (this.isAccountWhitelisted(accountId, environmentId, clientIp)) {
        return true;
      }
    }

    // 2. Check IP whitelist (lower priority)
    if (clientIp) {
      if (this.isIpWhitelisted(clientIp, environmentId)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Update cached whitelist data
   * Called when whitelist.updated event is received
   * @param whitelist Whitelist data to cache
   * @param environmentId Environment ID (optional, only used in multi-env mode such as edge)
   */
  updateCache(whitelist: WhitelistData, environmentId?: string): void {
    const resolvedEnv = environmentId || this.defaultEnvironmentId;
    this.logger.debug('Updating whitelist cache', {
      environmentId: resolvedEnv,
      ipCount: whitelist.ipWhitelist.length,
      accountCount: whitelist.accountWhitelist.length,
    });
    this.cachedWhitelistByEnv.set(resolvedEnv, whitelist);
  }
}

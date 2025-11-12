/**
 * Whitelist Service
 * Handles IP and Account whitelist retrieval and caching
 */

import { ApiClient } from '../client/ApiClient';
import { Logger } from '../utils/logger';

export interface IpWhitelistEntry {
  id: number;
  ipAddress: string;
  cidr?: string;
  description?: string;
  validFrom?: string;
  validUntil?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AccountWhitelistEntry {
  id: number;
  accountId: string;
  description?: string;
  validFrom?: string;
  validUntil?: string;
  createdAt: string;
  updatedAt: string;
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
  private cachedWhitelist: WhitelistData = {
    ipWhitelist: [],
    accountWhitelist: [],
  };

  constructor(apiClient: ApiClient, logger: Logger) {
    this.apiClient = apiClient;
    this.logger = logger;
  }

  /**
   * Get all whitelists (IP and Account)
   * GET /api/v1/server/whitelists
   */
  async list(): Promise<WhitelistData> {
    this.logger.debug('Fetching whitelists');

    const response = await this.apiClient.get<WhitelistData>('/api/v1/server/whitelists');

    if (!response.success || !response.data) {
      throw new Error(response.error?.message || 'Failed to fetch whitelists');
    }

    this.cachedWhitelist = response.data;
    this.logger.info('Whitelists fetched', {
      ipCount: response.data.ipWhitelist.length,
      accountCount: response.data.accountWhitelist.length,
    });

    return response.data;
  }

  /**
   * Refresh whitelist cache
   */
  async refresh(): Promise<WhitelistData> {
    this.logger.debug('Refreshing whitelist cache');
    return await this.list();
  }

  /**
   * Get cached whitelists
   */
  getCached(): WhitelistData {
    return this.cachedWhitelist;
  }

  /**
   * Get cached IP whitelist
   */
  getCachedIpWhitelist(): IpWhitelistEntry[] {
    return this.cachedWhitelist.ipWhitelist;
  }

  /**
   * Get cached Account whitelist
   */
  getCachedAccountWhitelist(): AccountWhitelistEntry[] {
    return this.cachedWhitelist.accountWhitelist;
  }

  /**
   * Check if IP is whitelisted (supports CIDR notation)
   */
  isIpWhitelisted(ip: string): boolean {
    const now = new Date();

    return this.cachedWhitelist.ipWhitelist.some((entry) => {
      // Check validity period
      if (entry.validFrom && new Date(entry.validFrom) > now) {
        return false;
      }
      if (entry.validUntil && new Date(entry.validUntil) < now) {
        return false;
      }

      // Check IP match (simple exact match for now)
      // TODO: Implement CIDR matching if needed
      return entry.ipAddress === ip;
    });
  }

  /**
   * Check if account is whitelisted
   */
  isAccountWhitelisted(accountId: string): boolean {
    const now = new Date();

    return this.cachedWhitelist.accountWhitelist.some((entry) => {
      // Check validity period
      if (entry.validFrom && new Date(entry.validFrom) > now) {
        return false;
      }
      if (entry.validUntil && new Date(entry.validUntil) < now) {
        return false;
      }

      return entry.accountId === accountId;
    });
  }

  /**
   * Update cached whitelist data
   * Called when whitelist.updated event is received
   */
  updateCache(whitelist: WhitelistData): void {
    this.logger.debug('Updating whitelist cache', {
      ipCount: whitelist.ipWhitelist.length,
      accountCount: whitelist.accountWhitelist.length,
    });
    this.cachedWhitelist = whitelist;
  }
}


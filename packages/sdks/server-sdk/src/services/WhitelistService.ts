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


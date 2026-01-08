import { WhitelistModel, Whitelist, CreateWhitelistData, UpdateWhitelistData, WhitelistFilters, WhitelistListResponse } from '../models/AccountWhitelist';
import { GatrixError } from '../middleware/errorHandler';
import logger from '../config/logger';
import { pubSubService } from './PubSubService';
import { SERVER_SDK_ETAG } from '../constants/cacheKeys';

export interface BulkCreateEntry {
  nickname: string;
  ipAddress?: string;
  startDate?: Date;
  endDate?: Date;
  purpose?: string;
}

export class WhitelistService {
  static async getAllWhitelists(
    environment: string,
    filters: Omit<WhitelistFilters, 'environment'> = {},
    pagination: { page?: number; limit?: number } = {}
  ): Promise<WhitelistListResponse> {
    try {
      const page = parseInt(pagination.page?.toString() || '1');
      const limit = Math.min(parseInt(pagination.limit?.toString() || '10'), 100); // Max 100 items per page

      const result = await WhitelistModel.findAll(page, limit, {
        ...filters,
        environment,
      });

      return result;
    } catch (error) {
      logger.error('Error getting all whitelists:', error);
      throw new GatrixError('Failed to get whitelists', 500);
    }
  }

  static async getWhitelistById(id: number, environment: string): Promise<Whitelist> {
    try {
      const whitelist = await WhitelistModel.findById(id, environment);
      if (!whitelist) {
        throw new GatrixError('Whitelist entry not found', 404);
      }

      return whitelist;
    } catch (error) {
      if (error instanceof GatrixError) {
        throw error;
      }
      logger.error('Error getting whitelist by ID:', error, { id, environment });
      throw new GatrixError('Failed to get whitelist entry', 500);
    }
  }

  static async createWhitelist(environment: string, data: CreateWhitelistData): Promise<Whitelist> {
    try {
      // Validate dates if provided
      if (data.startDate && data.endDate && data.startDate > data.endDate) {
        throw new GatrixError('Start date cannot be after end date', 400);
      }

      const whitelist = await WhitelistModel.create(data, environment);

      logger.info('Whitelist entry created successfully:', {
        id: whitelist.id,
        environment: whitelist.environment,
        accountId: whitelist.accountId,
        createdBy: whitelist.createdBy,
      });

      // Publish whitelist.updated event for SDK real-time updates
      try {
        await pubSubService.publishSDKEvent({
          type: 'whitelist.updated',
          data: {
            id: whitelist.id,
            timestamp: Date.now(),
            environment
          },
        });

        await pubSubService.invalidateKey(`${SERVER_SDK_ETAG.WHITELISTS}:${environment}`);
      } catch (eventError) {
        logger.warn('Failed to publish whitelist.updated event:', eventError);
        // Don't throw - event publishing failure shouldn't fail the request
      }

      return whitelist;
    } catch (error) {
      if (error instanceof GatrixError) {
        throw error;
      }
      logger.error('Error creating whitelist:', error);
      throw new GatrixError('Failed to create whitelist entry', 500);
    }
  }

  static async updateWhitelist(id: number, environment: string, data: UpdateWhitelistData): Promise<Whitelist> {
    try {
      // Check if whitelist exists
      const existing = await this.getWhitelistById(id, environment);

      // Validate dates if provided
      const startDate = data.startDate !== undefined ? data.startDate : existing.startDate;
      const endDate = data.endDate !== undefined ? data.endDate : existing.endDate;

      if (startDate && endDate && startDate > endDate) {
        throw new GatrixError('Start date cannot be after end date', 400);
      }

      const updated = await WhitelistModel.update(id, data, environment);
      if (!updated) {
        throw new GatrixError('Failed to update whitelist entry', 500);
      }

      logger.info('Whitelist entry updated successfully:', {
        id: updated.id,
        environment: updated.environment,
        accountId: updated.accountId,
      });

      // Publish whitelist.updated event for SDK real-time updates
      try {
        await pubSubService.publishSDKEvent({
          type: 'whitelist.updated',
          data: {
            id: updated.id,
            timestamp: Date.now(),
            environment
          },
        });

        await pubSubService.invalidateKey(`${SERVER_SDK_ETAG.WHITELISTS}:${environment}`);
      } catch (eventError) {
        logger.warn('Failed to publish whitelist.updated event:', eventError);
        // Don't throw - event publishing failure shouldn't fail the request
      }

      return updated;
    } catch (error) {
      if (error instanceof GatrixError) {
        throw error;
      }
      logger.error('Error updating whitelist:', error, { id, environment });
      throw new GatrixError('Failed to update whitelist entry', 500);
    }
  }

  static async deleteWhitelist(id: number, environment: string): Promise<void> {
    try {
      // Check if whitelist exists
      const existing = await this.getWhitelistById(id, environment);

      const deleted = await WhitelistModel.delete(id, environment);
      if (!deleted) {
        throw new GatrixError('Failed to delete whitelist entry', 500);
      }

      logger.info('Whitelist entry deleted successfully:', {
        id,
        environment: existing.environment,
        accountId: existing.accountId,
      });

      // Publish whitelist.updated event for SDK real-time updates
      try {
        await pubSubService.publishSDKEvent({
          type: 'whitelist.updated',
          data: {
            id,
            timestamp: Date.now(),
            environment
          },
        });

        await pubSubService.invalidateKey(`${SERVER_SDK_ETAG.WHITELISTS}:${environment}`);
      } catch (eventError) {
        logger.warn('Failed to publish whitelist.updated event:', eventError);
        // Don't throw - event publishing failure shouldn't fail the request
      }
    } catch (error) {
      if (error instanceof GatrixError) {
        throw error;
      }
      logger.error('Error deleting whitelist:', error, { id, environment });
      throw new GatrixError('Failed to delete whitelist entry', 500);
    }
  }

  static async bulkCreateWhitelists(environment: string, entries: BulkCreateEntry[], createdBy: number): Promise<number> {
    try {
      if (entries.length === 0) {
        throw new GatrixError('No entries provided for bulk creation', 400);
      }

      if (entries.length > 1000) {
        throw new GatrixError('Cannot create more than 1000 entries at once', 400);
      }

      // Validate each entry
      for (const entry of entries) {
        if (!entry.nickname || entry.nickname.trim() === '') {
          throw new GatrixError('All entries must have a nickname', 400);
        }

        if (entry.startDate && entry.endDate && entry.startDate > entry.endDate) {
          throw new GatrixError(`Invalid date range for entry: ${entry.nickname}`, 400);
        }
      }

      // Convert to CreateWhitelistData format
      const createData: CreateWhitelistData[] = entries.map(entry => ({
        accountId: entry.nickname.trim(),
        ipAddress: entry.ipAddress?.trim() || undefined,
        startDate: entry.startDate,
        endDate: entry.endDate,
        purpose: entry.purpose?.trim() || undefined,
        createdBy,
        isEnabled: true,
      }));

      const createdCount = await WhitelistModel.bulkCreate(createData, environment);

      logger.info('Bulk whitelist creation completed:', {
        environment,
        requestedCount: entries.length,
        createdCount,
        createdBy,
      });

      try {
        // Publish event for SDK update (using 0 as ID to signify bulk change)
        await pubSubService.publishSDKEvent({
          type: 'whitelist.updated',
          data: {
            id: 0,
            timestamp: Date.now(),
            environment
          },
        });

        await pubSubService.invalidateKey(`${SERVER_SDK_ETAG.WHITELISTS}:${environment}`);
      } catch (eventError) {
        logger.warn('Failed to invalidate whitelist ETag cache after bulk create:', eventError);
      }

      return createdCount;
    } catch (error) {
      if (error instanceof GatrixError) {
        throw error;
      }
      logger.error('Error bulk creating whitelists:', error);
      throw new GatrixError('Failed to bulk create whitelist entries', 500);
    }
  }

  /**
   * Toggle enabled status of account whitelist entry
   */
  static async toggleWhitelistStatus(id: number, environment: string, updatedBy: number): Promise<Whitelist> {
    try {
      const existing = await this.getWhitelistById(id, environment);

      const updated = await WhitelistModel.update(id, {
        isEnabled: !existing.isEnabled,
        updatedBy,
      }, environment);

      if (!updated) {
        throw new GatrixError('Failed to update whitelist entry', 500);
      }

      logger.info('Account whitelist status toggled:', {
        id: updated.id,
        environment: updated.environment,
        accountId: updated.accountId,
        isEnabled: updated.isEnabled,
        updatedBy,
      });

      // Publish whitelist.updated event for SDK real-time updates
      try {
        await pubSubService.publishSDKEvent({
          type: 'whitelist.updated',
          data: {
            id: updated.id,
            timestamp: Date.now(),
            environment
          },
        });

        await pubSubService.invalidateKey(`${SERVER_SDK_ETAG.WHITELISTS}:${environment}`);
      } catch (eventError) {
        logger.warn('Failed to publish whitelist.updated event:', eventError);
        // Don't throw - event publishing failure shouldn't fail the request
      }

      return updated;
    } catch (error) {
      if (error instanceof GatrixError) {
        throw error;
      }
      logger.error('Error toggling account whitelist status:', error, { id, environment });
      throw new GatrixError('Failed to toggle account whitelist status', 500);
    }
  }

  static async testWhitelist(environment: string, accountId?: string, ipAddress?: string): Promise<{
    isAllowed: boolean;
    matchedRules: Array<{
      type: 'account' | 'ip';
      rule: string;
      reason: string;
    }>;
  }> {
    try {
      const matchedRules: Array<{
        type: 'account' | 'ip';
        rule: string;
        reason: string;
      }> = [];

      // Check account whitelist
      if (accountId) {
        const accountWhitelists = await WhitelistModel.findByAccountId(accountId, environment);
        const now = new Date();

        for (const whitelist of accountWhitelists) {
          // Check if whitelist is currently active
          const startDate = whitelist.startDate ? new Date(whitelist.startDate) : null;
          const endDate = whitelist.endDate ? new Date(whitelist.endDate) : null;

          if (startDate && startDate > now) continue;
          if (endDate && endDate < now) continue;

          // If whitelist has ipAddress specified, check IP match (AND condition)
          if (whitelist.ipAddress) {
            if (!ipAddress || whitelist.ipAddress !== ipAddress) {
              continue; // IP doesn't match, skip this whitelist entry
            }
          }

          matchedRules.push({
            type: 'account',
            rule: `${whitelist.accountId}${whitelist.ipAddress ? ` (${whitelist.ipAddress})` : ''}`,
            reason: whitelist.purpose || 'Account whitelist match'
          });
        }
      }

      // Check IP whitelist
      if (ipAddress) {
        const { IpWhitelistModel } = await import('../models/IpWhitelist');
        const ipWhitelists = await IpWhitelistModel.findAll(1, 1000, { environment, isEnabled: true });
        const now = new Date();
        const { ipMatchesCIDR } = await import('../utils/ipValidation');

        for (const ipWhitelist of ipWhitelists.ipWhitelists) {
          if (!ipWhitelist.isEnabled) continue;

          const startDate = ipWhitelist.startDate ? new Date(ipWhitelist.startDate) : null;
          const endDate = ipWhitelist.endDate ? new Date(ipWhitelist.endDate) : null;

          if (startDate && startDate > now) continue;
          if (endDate && endDate < now) continue;

          // Check both exact match and CIDR match
          if (ipWhitelist.ipAddress === ipAddress || ipMatchesCIDR(ipAddress, ipWhitelist.ipAddress)) {
            matchedRules.push({
              type: 'ip',
              rule: ipWhitelist.ipAddress,
              reason: ipWhitelist.purpose || 'IP whitelist match'
            });
          }
        }
      }

      return {
        isAllowed: matchedRules.length > 0,
        matchedRules
      };
    } catch (error) {
      logger.error('Error test whitelist:', error, { environment });
      throw new GatrixError('Failed to test whitelist', 500);
    }
  }
}

import { WhitelistModel, Whitelist, CreateWhitelistData, UpdateWhitelistData, WhitelistFilters, WhitelistListResponse } from '../models/AccountWhitelist';
import { CustomError } from '../middleware/errorHandler';
import logger from '../config/logger';

export interface BulkCreateEntry {
  nickname: string;
  ipAddress?: string;
  startDate?: Date;
  endDate?: Date;
  purpose?: string;
}

export class WhitelistService {
  static async getAllWhitelists(
    filters: WhitelistFilters = {},
    pagination: { page?: number; limit?: number } = {}
  ): Promise<WhitelistListResponse> {
    try {
      const page = parseInt(pagination.page?.toString() || '1');
      const limit = Math.min(parseInt(pagination.limit?.toString() || '10'), 100); // Max 100 items per page

      const result = await WhitelistModel.findAll(page, limit, filters);

      return result;
    } catch (error) {
      logger.error('Error getting all whitelists:', error);
      throw new CustomError('Failed to get whitelists', 500);
    }
  }

  static async getWhitelistById(id: number): Promise<Whitelist> {
    try {
      const whitelist = await WhitelistModel.findById(id);
      if (!whitelist) {
        throw new CustomError('Whitelist entry not found', 404);
      }

      return whitelist;
    } catch (error) {
      if (error instanceof CustomError) {
        throw error;
      }
      logger.error('Error getting whitelist by ID:', error);
      throw new CustomError('Failed to get whitelist entry', 500);
    }
  }

  static async createWhitelist(data: CreateWhitelistData): Promise<Whitelist> {
    try {
      // Validate dates if provided
      if (data.startDate && data.endDate && data.startDate > data.endDate) {
        throw new CustomError('Start date cannot be after end date', 400);
      }

      const whitelist = await WhitelistModel.create(data);

      logger.info('Whitelist entry created successfully:', {
        id: whitelist.id,
        accountId: whitelist.accountId,
        createdBy: whitelist.createdBy,
      });

      return whitelist;
    } catch (error) {
      if (error instanceof CustomError) {
        throw error;
      }
      logger.error('Error creating whitelist:', error);
      throw new CustomError('Failed to create whitelist entry', 500);
    }
  }

  static async updateWhitelist(id: number, data: UpdateWhitelistData): Promise<Whitelist> {
    try {
      // Check if whitelist exists
      const existing = await WhitelistModel.findById(id);
      if (!existing) {
        throw new CustomError('Whitelist entry not found', 404);
      }

      // Validate dates if provided
      const startDate = data.startDate !== undefined ? data.startDate : existing.startDate;
      const endDate = data.endDate !== undefined ? data.endDate : existing.endDate;
      
      if (startDate && endDate && startDate > endDate) {
        throw new CustomError('Start date cannot be after end date', 400);
      }

      const updated = await WhitelistModel.update(id, data);
      if (!updated) {
        throw new CustomError('Failed to update whitelist entry', 500);
      }

      logger.info('Whitelist entry updated successfully:', {
        id: updated.id,
        accountId: updated.accountId,
      });

      return updated;
    } catch (error) {
      if (error instanceof CustomError) {
        throw error;
      }
      logger.error('Error updating whitelist:', error);
      throw new CustomError('Failed to update whitelist entry', 500);
    }
  }

  static async deleteWhitelist(id: number): Promise<void> {
    try {
      // Check if whitelist exists
      const existing = await WhitelistModel.findById(id);
      if (!existing) {
        throw new CustomError('Whitelist entry not found', 404);
      }

      const deleted = await WhitelistModel.delete(id);
      if (!deleted) {
        throw new CustomError('Failed to delete whitelist entry', 500);
      }

      logger.info('Whitelist entry deleted successfully:', {
        id,
        accountId: existing.accountId,
      });
    } catch (error) {
      if (error instanceof CustomError) {
        throw error;
      }
      logger.error('Error deleting whitelist:', error);
      throw new CustomError('Failed to delete whitelist entry', 500);
    }
  }

  static async bulkCreateWhitelists(entries: BulkCreateEntry[], createdBy: number): Promise<number> {
    try {
      if (entries.length === 0) {
        throw new CustomError('No entries provided for bulk creation', 400);
      }

      if (entries.length > 1000) {
        throw new CustomError('Cannot create more than 1000 entries at once', 400);
      }

      // Validate each entry
      for (const entry of entries) {
        if (!entry.nickname || entry.nickname.trim() === '') {
          throw new CustomError('All entries must have a nickname', 400);
        }

        if (entry.startDate && entry.endDate && entry.startDate > entry.endDate) {
          throw new CustomError(`Invalid date range for entry: ${entry.nickname}`, 400);
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
      }));

      const createdCount = await WhitelistModel.bulkCreate(createData);

      logger.info('Bulk whitelist creation completed:', {
        requestedCount: entries.length,
        createdCount,
        createdBy,
      });

      return createdCount;
    } catch (error) {
      if (error instanceof CustomError) {
        throw error;
      }
      logger.error('Error bulk creating whitelists:', error);
      throw new CustomError('Failed to bulk create whitelist entries', 500);
    }
  }

  static async testWhitelist(accountId?: string, ipAddress?: string): Promise<{
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
        const accountWhitelists = await WhitelistModel.findByAccountId(accountId);
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
        const { IpWhitelistService } = await import('./IpWhitelistService');
        const isWhitelisted = await IpWhitelistService.isIpWhitelisted(ipAddress);

        if (isWhitelisted) {
          // Get the specific whitelist entries that match
          const { IpWhitelistModel } = await import('../models/IpWhitelist');
          const ipWhitelists = await IpWhitelistModel.findAll(1, 1000, { isEnabled: true });
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
      }

      return {
        isAllowed: matchedRules.length > 0,
        matchedRules
      };
    } catch (error) {
      logger.error('Error testing whitelist:', error);
      throw new CustomError('Failed to test whitelist', 500);
    }
  }
}

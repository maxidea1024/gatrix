import { 
  IpWhitelistModel, 
  IpWhitelist, 
  CreateIpWhitelistData, 
  UpdateIpWhitelistData, 
  IpWhitelistFilters, 
  IpWhitelistListResponse 
} from '../models/IpWhitelist';
import { CustomError } from '../middleware/errorHandler';
import { normalizeIPOrCIDR, isValidIPOrCIDR } from '../utils/ipValidation';
import logger from '../config/logger';

export class IpWhitelistService {
  /**
   * Get all IP whitelist entries with pagination and filtering
   */
  static async getAllIpWhitelists(
    filters: IpWhitelistFilters = {},
    pagination: { page?: number; limit?: number } = {}
  ): Promise<IpWhitelistListResponse> {
    try {
      const page = parseInt(pagination.page?.toString() || '1');
      const limit = Math.min(parseInt(pagination.limit?.toString() || '10'), 100); // Max 100 items per page

      const result = await IpWhitelistModel.findAll(page, limit, filters);

      return result;
    } catch (error) {
      logger.error('Error getting all IP whitelists:', error);
      throw new CustomError('Failed to get IP whitelists', 500);
    }
  }

  /**
   * Get IP whitelist entry by ID
   */
  static async getIpWhitelistById(id: number): Promise<IpWhitelist> {
    try {
      const ipWhitelist = await IpWhitelistModel.findById(id);
      
      if (!ipWhitelist) {
        throw new CustomError('IP whitelist entry not found', 404);
      }

      return ipWhitelist;
    } catch (error) {
      if (error instanceof CustomError) {
        throw error;
      }
      logger.error('Error getting IP whitelist by ID:', error);
      throw new CustomError('Failed to get IP whitelist entry', 500);
    }
  }

  /**
   * Create new IP whitelist entry
   */
  static async createIpWhitelist(data: CreateIpWhitelistData): Promise<IpWhitelist> {
    try {
      // Validate and normalize IP address
      if (!data.ipAddress || !data.ipAddress.trim()) {
        throw new CustomError('IP address is required', 400);
      }

      if (!data.purpose || !data.purpose.trim()) {
        throw new CustomError('Purpose is required', 400);
      }

      // Normalize IP address/CIDR
      const normalizedIP = normalizeIPOrCIDR(data.ipAddress);

      // Check if IP already exists
      const existing = await IpWhitelistModel.findByIpAddress(normalizedIP);
      if (existing) {
        throw new CustomError('IP address already exists in whitelist', 409);
      }

      // Clean up data to ensure no undefined values
      const createData: CreateIpWhitelistData = {
        ip: normalizedIP,
        description: data.purpose.trim(),
        is_active: data.isEnabled ?? true,
        created_by: data.createdBy,
        ipAddress: normalizedIP,
        purpose: data.purpose.trim(),
        isEnabled: data.isEnabled ?? true,
        createdBy: data.createdBy,
      };

      // Only add date fields if they have valid values
      if (data.startDate) {
        createData.startDate = data.startDate instanceof Date ? data.startDate : new Date(data.startDate);
      }

      if (data.endDate) {
        createData.endDate = data.endDate instanceof Date ? data.endDate : new Date(data.endDate);
      }

      console.log('Creating IP whitelist with data:', createData);

      const created = await IpWhitelistModel.create(createData);

      logger.info('IP whitelist entry created:', {
        id: created.id,
        ipAddress: created.ipAddress,
        purpose: created.purpose,
        createdBy: created.createdBy,
      });

      return created;
    } catch (error) {
      if (error instanceof CustomError) {
        throw error;
      }
      logger.error('Error creating IP whitelist:', error);
      throw new CustomError('Failed to create IP whitelist entry', 500);
    }
  }

  /**
   * Update IP whitelist entry
   */
  static async updateIpWhitelist(id: number, data: UpdateIpWhitelistData): Promise<IpWhitelist> {
    try {
      // Check if entry exists
      const existing = await IpWhitelistModel.findById(id);
      if (!existing) {
        throw new CustomError('IP whitelist entry not found', 404);
      }

      const updateData: UpdateIpWhitelistData = { ...data };

      // Validate and normalize IP address if provided
      if (data.ipAddress !== undefined) {
        if (!data.ipAddress || !data.ipAddress.trim()) {
          throw new CustomError('IP address cannot be empty', 400);
        }

        const normalizedIP = normalizeIPOrCIDR(data.ipAddress);

        // Check if new IP already exists (excluding current entry)
        const existingWithIP = await IpWhitelistModel.findByIpAddress(normalizedIP);
        if (existingWithIP && existingWithIP.id !== id) {
          throw new CustomError('IP address already exists in whitelist', 409);
        }

        updateData.ipAddress = normalizedIP;
      }

      // Validate purpose if provided
      if (data.purpose !== undefined) {
        if (!data.purpose || !data.purpose.trim()) {
          throw new CustomError('Purpose cannot be empty', 400);
        }
        updateData.purpose = data.purpose.trim();
      }

      // Validate dates if provided
      if (data.startDate !== undefined && data.endDate !== undefined) {
        if (data.startDate && data.endDate && data.startDate >= data.endDate) {
          throw new CustomError('Start date must be before end date', 400);
        }
      }

      const updated = await IpWhitelistModel.update(id, updateData);

      logger.info('IP whitelist entry updated:', {
        id: updated.id,
        ipAddress: updated.ipAddress,
        purpose: updated.purpose,
        updatedBy: updated.updatedBy,
      });

      return updated;
    } catch (error) {
      if (error instanceof CustomError) {
        throw error;
      }
      logger.error('Error updating IP whitelist:', error);
      throw new CustomError('Failed to update IP whitelist entry', 500);
    }
  }

  /**
   * Delete IP whitelist entry
   */
  static async deleteIpWhitelist(id: number): Promise<void> {
    try {
      // Check if entry exists
      const existing = await IpWhitelistModel.findById(id);
      if (!existing) {
        throw new CustomError('IP whitelist entry not found', 404);
      }

      await IpWhitelistModel.delete(id);

      logger.info('IP whitelist entry deleted:', {
        id,
        ipAddress: existing.ipAddress,
        purpose: existing.purpose,
      });
    } catch (error) {
      if (error instanceof CustomError) {
        throw error;
      }
      logger.error('Error deleting IP whitelist:', error);
      throw new CustomError('Failed to delete IP whitelist entry', 500);
    }
  }

  /**
   * Toggle enabled status of IP whitelist entry
   */
  static async toggleIpWhitelistStatus(id: number, updatedBy: number): Promise<IpWhitelist> {
    try {
      const existing = await IpWhitelistModel.findById(id);
      if (!existing) {
        throw new CustomError('IP whitelist entry not found', 404);
      }

      const updated = await IpWhitelistModel.update(id, {
        isEnabled: !existing.isEnabled,
        updatedBy,
      });

      logger.info('IP whitelist status toggled:', {
        id: updated.id,
        ipAddress: updated.ipAddress,
        isEnabled: updated.isEnabled,
        updatedBy,
      });

      return updated;
    } catch (error) {
      if (error instanceof CustomError) {
        throw error;
      }
      logger.error('Error toggling IP whitelist status:', error);
      throw new CustomError('Failed to toggle IP whitelist status', 500);
    }
  }

  /**
   * Check if an IP address is whitelisted
   */
  static async isIpWhitelisted(ipAddress: string): Promise<boolean> {
    try {
      if (!isValidIPOrCIDR(ipAddress)) {
        return false;
      }

      // Get all enabled IP whitelist entries
      const result = await IpWhitelistModel.findAll(1, 1000, { is_active: true });

      // Check if IP matches any whitelist entry
      for (const entry of result.ipWhitelists) {
        if (entry.ipAddress === ipAddress) {
          return true;
        }

        // TODO: Implement CIDR matching logic here using ipMatchesCIDR
        // For now, we only do exact matches
      }

      return false;
    } catch (error) {
      logger.error('Error checking IP whitelist:', error);
      return false; // Fail safe - don't block if there's an error
    }
  }

  /**
   * Bulk create IP whitelist entries
   */
  static async bulkCreateIpWhitelists(
    entries: Omit<CreateIpWhitelistData, 'createdBy'>[],
    createdBy: number
  ): Promise<number> {
    try {
      if (!entries || entries.length === 0) {
        throw new CustomError('No entries provided', 400);
      }

      if (entries.length > 100) {
        throw new CustomError('Too many entries. Maximum 100 entries allowed per bulk operation', 400);
      }

      let createdCount = 0;
      const errors: string[] = [];

      for (const entry of entries) {
        try {
          await this.createIpWhitelist({
            ...entry,
            createdBy,
          });
          createdCount++;
        } catch (error: any) {
          errors.push(`${entry.ipAddress}: ${error.message}`);
        }
      }

      if (errors.length > 0) {
        logger.warn('Bulk IP whitelist creation had errors:', errors);
      }

      logger.info('Bulk IP whitelist creation completed:', {
        requestedCount: entries.length,
        createdCount,
        errorCount: errors.length,
        createdBy,
      });

      return createdCount;
    } catch (error) {
      if (error instanceof CustomError) {
        throw error;
      }
      logger.error('Error bulk creating IP whitelists:', error);
      throw new CustomError('Failed to bulk create IP whitelist entries', 500);
    }
  }
}

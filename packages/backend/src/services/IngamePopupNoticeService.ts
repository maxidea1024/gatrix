import { RowDataPacket, ResultSetHeader } from 'mysql2';
import database from '../config/database';
import { convertFromMySQLDateTime, convertToMySQLDateTime } from '../utils/dateUtils';
import { getCurrentEnvironmentId } from '../utils/environmentContext';
import { pubSubService } from './PubSubService';
import { Environment } from '../models/Environment';

export interface IngamePopupNotice {
  id: number;
  environmentId: string;
  isActive: boolean;
  content: string; // Database field for admin UI
  message: string; // Actual message content (from template or direct)
  targetWorlds: string[] | null;
  targetWorldsInverted?: boolean;
  targetPlatforms: string[] | null;
  targetPlatformsInverted?: boolean;
  targetChannels: string[] | null;
  targetChannelsInverted?: boolean;
  targetSubchannels: string[] | null;
  targetSubchannelsInverted?: boolean;
  targetUserIds: string | null;
  targetUserIdsInverted?: boolean;
  displayPriority: number;
  showOnce: boolean;
  startDate?: string | null;
  endDate?: string | null;
  messageTemplateId: number | null;
  useTemplate: boolean;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: number;
  updatedBy: number | null;
}

export interface CreateIngamePopupNoticeData {
  isActive: boolean;
  message?: string; // SDK response field (not stored in DB)
  content?: string; // Database field (legacy)
  messageTemplateId?: number | null;
  useTemplate?: boolean;
  description?: string | null;
  targetWorlds?: string[] | null;
  targetWorldsInverted?: boolean;
  targetPlatforms?: string[] | null;
  targetPlatformsInverted?: boolean;
  targetChannels?: string[] | null;
  targetChannelsInverted?: boolean;
  targetSubchannels?: string[] | null;
  targetSubchannelsInverted?: boolean;
  targetUserIds?: string | null;
  targetUserIdsInverted?: boolean;
  displayPriority?: number;
  showOnce?: boolean;
  startDate?: string | null;
  endDate?: string | null;
}

export interface UpdateIngamePopupNoticeData extends Partial<CreateIngamePopupNoticeData> { }

export interface IngamePopupNoticeFilters {
  isActive?: boolean;
  currentlyVisible?: boolean;
  world?: string;
  market?: string;
  platform?: string | string[];
  platformOperator?: 'any_of' | 'include_all';
  clientVersion?: string;
  accountId?: string;
  search?: string;
  environmentId?: string;
}

class IngamePopupNoticeService {
  /**
   * Helper to resolve environment name from ID (which might be ULID or composite string)
   */
  private async resolveEnvironmentName(envId: string): Promise<string> {
    if (!envId) return '';

    try {
      // Try to get from Environment model first
      const env = await Environment.query().findById(envId);
      if (env) {
        return env.environmentName;
      }
      // Fallback: assume format {name}.{ulid} or just use as is if split fails
      return envId.split('.')[0];
    } catch (error) {
      // Fallback on error
      return envId.split('.')[0];
    }
  }

  /**
   * Get ingame popup notices with pagination and filters
   */
  async getIngamePopupNotices(
    page: number = 1,
    limit: number = 10,
    filters: IngamePopupNoticeFilters = {}
  ): Promise<{ notices: IngamePopupNotice[]; total: number }> {
    const pool = database.getPool();
    const offset = (page - 1) * limit;
    const whereClauses: string[] = [];
    const queryParams: any[] = [];

    // Environment filter (always applied)
    const envId = filters.environmentId ?? getCurrentEnvironmentId();
    whereClauses.push('environmentId = ?');
    queryParams.push(envId);

    // Apply filters
    if (filters.isActive !== undefined) {
      whereClauses.push('isActive = ?');
      queryParams.push(filters.isActive);
    }

    if (filters.currentlyVisible !== undefined) {
      // Filter by currently visible (isActive + within date range)
      // startDate is optional - if null, treat as immediately available
      // endDate is optional - if null, treat as permanent (no end date)
      if (filters.currentlyVisible) {
        whereClauses.push('isActive = 1 AND (startDate IS NULL OR startDate <= NOW()) AND (endDate IS NULL OR endDate >= NOW())');
      } else {
        whereClauses.push('(isActive = 0 OR (startDate IS NOT NULL AND startDate > NOW()) OR (endDate IS NOT NULL AND endDate < NOW()))');
      }
    }

    // Target filters - check if JSON array contains the value OR is empty/null (all targets)
    if (filters.world) {
      whereClauses.push('(targetWorlds IS NULL OR JSON_LENGTH(targetWorlds) = 0 OR JSON_CONTAINS(targetWorlds, ?))');
      queryParams.push(JSON.stringify(filters.world));
    }

    if (filters.market) {
      whereClauses.push('(targetMarkets IS NULL OR JSON_LENGTH(targetMarkets) = 0 OR JSON_CONTAINS(targetMarkets, ?))');
      queryParams.push(JSON.stringify(filters.market));
    }

    if (filters.platform) {
      const platforms = Array.isArray(filters.platform) ? filters.platform : [filters.platform];
      const operator = filters.platformOperator || 'any_of';

      if (operator === 'include_all') {
        // All specified platforms must be included OR be empty/null (all platforms)
        const platformChecks = platforms.map(() => 'JSON_CONTAINS(targetPlatforms, ?)').join(' AND ');
        whereClauses.push(`(targetPlatforms IS NULL OR JSON_LENGTH(targetPlatforms) = 0 OR (${platformChecks}))`);
        platforms.forEach(platform => queryParams.push(JSON.stringify(platform)));
      } else {
        // Any of the specified platforms (default) OR be empty/null (all platforms)
        const platformChecks = platforms.map(() => 'JSON_CONTAINS(targetPlatforms, ?)').join(' OR ');
        whereClauses.push(`(targetPlatforms IS NULL OR JSON_LENGTH(targetPlatforms) = 0 OR (${platformChecks}))`);
        platforms.forEach(platform => queryParams.push(JSON.stringify(platform)));
      }
    }

    if (filters.clientVersion) {
      whereClauses.push('(targetClientVersions IS NULL OR JSON_LENGTH(targetClientVersions) = 0 OR JSON_CONTAINS(targetClientVersions, ?))');
      queryParams.push(JSON.stringify(filters.clientVersion));
    }

    if (filters.accountId) {
      whereClauses.push('(targetAccountIds IS NULL OR JSON_LENGTH(targetAccountIds) = 0 OR JSON_CONTAINS(targetAccountIds, ?))');
      queryParams.push(JSON.stringify(filters.accountId));
    }

    if (filters.search) {
      whereClauses.push('(content LIKE ? OR description LIKE ?)');
      const searchPattern = `%${filters.search}%`;
      queryParams.push(searchPattern, searchPattern);
    }

    const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    // Get total count
    const [countRows] = await pool.execute<RowDataPacket[]>(
      `SELECT COUNT(*) as total FROM g_ingame_popup_notices ${whereClause}`,
      queryParams
    );
    const total = countRows[0].total;

    // Get paginated results
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT * FROM g_ingame_popup_notices ${whereClause} ORDER BY displayPriority ASC, createdAt DESC LIMIT ${limit} OFFSET ${offset}`,
      queryParams
    );

    const notices = rows.map(row => this.formatNotice(row));

    return { notices, total };
  }

  /**
   * Get ingame popup notice by ID
   */
  async getIngamePopupNoticeById(id: number, environmentId?: string): Promise<IngamePopupNotice | null> {
    const pool = database.getPool();
    const envId = environmentId ?? getCurrentEnvironmentId();
    const [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT * FROM g_ingame_popup_notices WHERE id = ? AND environmentId = ?',
      [id, envId]
    );

    if (rows.length === 0) {
      return null;
    }

    return this.formatNotice(rows[0]);
  }

  /**
   * Create ingame popup notice
   */
  async createIngamePopupNotice(data: CreateIngamePopupNoticeData, createdBy: number, environmentId?: string): Promise<IngamePopupNotice> {
    const pool = database.getPool();
    const envId = environmentId ?? getCurrentEnvironmentId();

    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO g_ingame_popup_notices (
        environmentId, isActive, content, targetWorlds, targetWorldsInverted, targetPlatforms, targetPlatformsInverted,
        targetChannels, targetChannelsInverted, targetSubchannels, targetSubchannelsInverted,
        targetUserIds, targetUserIdsInverted,
        displayPriority, showOnce, startDate, endDate,
        messageTemplateId, useTemplate, description, createdBy
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        envId,
        data.isActive,
        data.content,
        data.targetWorlds ? JSON.stringify(data.targetWorlds) : null,
        data.targetWorldsInverted ?? false,
        data.targetPlatforms ? JSON.stringify(data.targetPlatforms) : null,
        data.targetPlatformsInverted ?? false,
        data.targetChannels ? JSON.stringify(data.targetChannels) : null,
        data.targetChannelsInverted ?? false,
        data.targetSubchannels ? JSON.stringify(data.targetSubchannels) : null,
        data.targetSubchannelsInverted ?? false,
        data.targetUserIds ?? null,
        data.targetUserIdsInverted ?? false,
        data.displayPriority ?? 100,
        data.showOnce ?? false,
        convertToMySQLDateTime(data.startDate),
        data.endDate ? convertToMySQLDateTime(data.endDate) : null,
        data.messageTemplateId ?? null,
        data.useTemplate ?? false,
        data.description ?? null,
        createdBy
      ]
    );

    const notice = await this.getIngamePopupNoticeById(result.insertId, envId);
    if (!notice) {
      throw new Error('Failed to create ingame popup notice');
    }

    // Resolve environment name before publishing
    const envName = await this.resolveEnvironmentName(envId);

    // Publish SDK event
    await pubSubService.publishSDKEvent({
      type: 'popup.created',
      data: {
        id: notice.id,
        timestamp: Date.now(),
        isVisible: notice.isActive,
        environment: envName
      }
    });

    return notice;
  }

  /**
   * Update ingame popup notice
   */
  async updateIngamePopupNotice(id: number, data: UpdateIngamePopupNoticeData, updatedBy: number, environmentId?: string): Promise<IngamePopupNotice> {
    const pool = database.getPool();
    const envId = environmentId ?? getCurrentEnvironmentId();
    const updates: string[] = [];
    const values: any[] = [];

    if (data.isActive !== undefined) {
      updates.push('isActive = ?');
      values.push(data.isActive);
    }

    if (data.content !== undefined) {
      updates.push('content = ?');
      values.push(data.content);
    }

    if (data.targetWorlds !== undefined) {
      updates.push('targetWorlds = ?');
      values.push(data.targetWorlds ? JSON.stringify(data.targetWorlds) : null);
    }

    if (data.targetWorldsInverted !== undefined) {
      updates.push('targetWorldsInverted = ?');
      values.push(data.targetWorldsInverted);
    }

    if (data.targetPlatforms !== undefined) {
      updates.push('targetPlatforms = ?');
      values.push(data.targetPlatforms ? JSON.stringify(data.targetPlatforms) : null);
    }

    if (data.targetPlatformsInverted !== undefined) {
      updates.push('targetPlatformsInverted = ?');
      values.push(data.targetPlatformsInverted);
    }

    if (data.targetChannels !== undefined) {
      updates.push('targetChannels = ?');
      values.push(data.targetChannels ? JSON.stringify(data.targetChannels) : null);
    }

    if (data.targetChannelsInverted !== undefined) {
      updates.push('targetChannelsInverted = ?');
      values.push(data.targetChannelsInverted);
    }

    if (data.targetSubchannels !== undefined) {
      updates.push('targetSubchannels = ?');
      values.push(data.targetSubchannels ? JSON.stringify(data.targetSubchannels) : null);
    }

    if (data.targetSubchannelsInverted !== undefined) {
      updates.push('targetSubchannelsInverted = ?');
      values.push(data.targetSubchannelsInverted);
    }

    if (data.targetUserIds !== undefined) {
      updates.push('targetUserIds = ?');
      values.push(data.targetUserIds ?? null);
    }

    if (data.targetUserIdsInverted !== undefined) {
      updates.push('targetUserIdsInverted = ?');
      values.push(data.targetUserIdsInverted);
    }

    if (data.displayPriority !== undefined) {
      updates.push('displayPriority = ?');
      values.push(data.displayPriority);
    }

    if (data.showOnce !== undefined) {
      updates.push('showOnce = ?');
      values.push(data.showOnce);
    }

    if (data.startDate !== undefined) {
      updates.push('startDate = ?');
      values.push(data.startDate ? convertToMySQLDateTime(data.startDate) : null);
    }

    if (data.endDate !== undefined) {
      updates.push('endDate = ?');
      values.push(data.endDate ? convertToMySQLDateTime(data.endDate) : null);
    }

    updates.push('updatedBy = ?');
    values.push(updatedBy);

    updates.push('updatedAt = NOW()');
    values.push(id, envId);

    await pool.execute(
      `UPDATE g_ingame_popup_notices SET ${updates.join(', ')} WHERE id = ? AND environmentId = ?`,
      values
    );

    const notice = await this.getIngamePopupNoticeById(id, envId);
    if (!notice) {
      throw new Error('Ingame popup notice not found');
    }

    // Resolve environment name before publishing
    const envName = await this.resolveEnvironmentName(envId);

    // Publish SDK event
    await pubSubService.publishSDKEvent({
      type: 'popup.updated',
      data: {
        id: notice.id,
        timestamp: Date.now(),
        isVisible: notice.isActive,
        environment: envName
      }
    });

    return notice;
  }

  /**
   * Delete ingame popup notice
   */
  async deleteIngamePopupNotice(id: number, environmentId?: string): Promise<void> {
    const pool = database.getPool();
    const envId = environmentId ?? getCurrentEnvironmentId();

    // Resolve environment name before deleting (need it for event)
    const envName = await this.resolveEnvironmentName(envId);

    await pool.execute('DELETE FROM g_ingame_popup_notices WHERE id = ? AND environmentId = ?', [id, envId]);

    // Publish SDK event
    await pubSubService.publishSDKEvent({
      type: 'popup.deleted',
      data: {
        id,
        timestamp: Date.now(),
        environment: envName
      }
    });
  }

  /**
   * Delete multiple ingame popup notices
   */
  async deleteMultipleIngamePopupNotices(ids: number[], environmentId?: string): Promise<void> {
    const pool = database.getPool();
    const envId = environmentId ?? getCurrentEnvironmentId();
    const placeholders = ids.map(() => '?').join(',');

    // Resolve environment name before deleting
    const envName = await this.resolveEnvironmentName(envId);

    await pool.execute(
      `DELETE FROM g_ingame_popup_notices WHERE id IN (${placeholders}) AND environmentId = ?`,
      [...ids, envId]
    );

    // Publish SDK events for each deleted notice
    for (const id of ids) {
      await pubSubService.publishSDKEvent({
        type: 'popup.deleted',
        data: {
          id,
          timestamp: Date.now(),
          environment: envName
        }
      });
    }
  }

  /**
   * Toggle active status
   */
  async toggleActive(id: number, environmentId?: string): Promise<IngamePopupNotice> {
    const pool = database.getPool();
    const envId = environmentId ?? getCurrentEnvironmentId();
    await pool.execute(
      'UPDATE g_ingame_popup_notices SET isActive = NOT isActive, updatedAt = NOW() WHERE id = ? AND environmentId = ?',
      [id, envId]
    );

    const notice = await this.getIngamePopupNoticeById(id, envId);
    if (!notice) {
      throw new Error('Ingame popup notice not found');
    }

    // Resolve environment name before publishing
    const envName = await this.resolveEnvironmentName(envId);

    // Publish SDK event for toggle
    await pubSubService.publishSDKEvent({
      type: 'popup.updated',
      data: {
        id: notice.id,
        timestamp: Date.now(),
        isVisible: notice.isActive,
        environment: envName
      }
    });

    return notice;
  }

  /**
   * Format notice from database row
   */
  private formatNotice(row: any): IngamePopupNotice {
    // Helper function to convert dates safely (can return null)
    const convertDate = (date: any): string | null => {
      if (!date) return null;
      if (date instanceof Date) {
        return date.toISOString();
      }
      return convertFromMySQLDateTime(date) || null;
    };

    // Helper function to convert dates (must return string)
    const convertDateRequired = (date: any): string => {
      if (!date) return new Date().toISOString();
      if (date instanceof Date) {
        return date.toISOString();
      }
      return convertFromMySQLDateTime(date) || new Date().toISOString();
    };

    return {
      id: row.id,
      environmentId: row.environmentId,
      isActive: Boolean(row.isActive),
      content: row.content, // Database field for admin UI
      message: row.content, // Map database 'content' field to SDK 'message' field
      targetWorlds: typeof row.targetWorlds === 'string' ? JSON.parse(row.targetWorlds) : row.targetWorlds,
      targetWorldsInverted: Boolean(row.targetWorldsInverted),
      targetPlatforms: typeof row.targetPlatforms === 'string' ? JSON.parse(row.targetPlatforms) : row.targetPlatforms,
      targetPlatformsInverted: Boolean(row.targetPlatformsInverted),
      targetChannels: typeof row.targetChannels === 'string' ? JSON.parse(row.targetChannels) : row.targetChannels,
      targetChannelsInverted: Boolean(row.targetChannelsInverted),
      targetSubchannels: typeof row.targetSubchannels === 'string' ? JSON.parse(row.targetSubchannels) : row.targetSubchannels,
      targetSubchannelsInverted: Boolean(row.targetSubchannelsInverted),
      targetUserIds: row.targetUserIds || null,
      targetUserIdsInverted: Boolean(row.targetUserIdsInverted),
      displayPriority: Number(row.displayPriority) || 100,
      showOnce: Boolean(row.showOnce),
      startDate: convertDate(row.startDate),
      endDate: convertDate(row.endDate),
      messageTemplateId: row.messageTemplateId || null,
      useTemplate: Boolean(row.useTemplate),
      description: row.description || null,
      createdAt: convertDateRequired(row.createdAt),
      updatedAt: convertDateRequired(row.updatedAt),
      createdBy: row.createdBy,
      updatedBy: row.updatedBy || null
    };
  }

  /**
   * Format notice for Server SDK response
   * Returns only essential fields for game client
   * Note: row is already formatted by formatNotice, so dates are already ISO 8601 strings
   */
  formatNoticeForServerSDK(row: any): any {
    // Helper function to parse array fields
    const parseArray = (value: any): any[] => {
      if (Array.isArray(value)) return value;
      if (typeof value === 'string') {
        try {
          return JSON.parse(value);
        } catch {
          return [];
        }
      }
      return [];
    };

    // Parse targetUserIds from comma-separated string to array
    const targetUserIds = row.targetUserIds
      ? row.targetUserIds.split(',').map((id: string) => id.trim()).filter((id: string) => id)
      : [];

    const targetPlatforms = parseArray(row.targetPlatforms);
    const targetChannels = parseArray(row.targetChannels);
    const targetSubchannels = parseArray(row.targetSubchannels);
    const targetWorlds = parseArray(row.targetWorlds);

    // Filter out "channel:*" subchannels if channel-only targeting is used
    // If a channel is in targetChannels, remove "channel:*" from targetSubchannels
    const filteredSubchannels = targetSubchannels.filter(subchannel => {
      if (typeof subchannel === 'string' && subchannel.includes(':')) {
        const [channel] = subchannel.split(':');
        // If this is "channel:*" and the channel is in targetChannels, exclude it
        if (subchannel.endsWith(':*') && targetChannels.includes(channel)) {
          return false;
        }
      }
      return true;
    });

    // Build response object, only including non-empty arrays
    const response: any = {
      id: row.id,
      content: row.content,
      displayPriority: row.displayPriority,
      showOnce: Boolean(row.showOnce),
    };

    // Only include startDate if it's not null
    if (row.startDate) {
      response.startDate = row.startDate;
    }

    // Only include endDate if it's not null
    if (row.endDate) {
      response.endDate = row.endDate;
    }

    // Add targeting fields only if they have values
    if (targetPlatforms.length > 0) {
      response.targetPlatforms = targetPlatforms;
      response.targetPlatformsInverted = Boolean(row.targetPlatformsInverted);
    }

    if (targetChannels.length > 0) {
      response.targetChannels = targetChannels;
      response.targetChannelsInverted = Boolean(row.targetChannelsInverted);
    }

    if (filteredSubchannels.length > 0) {
      response.targetSubchannels = filteredSubchannels;
      response.targetSubchannelsInverted = Boolean(row.targetSubchannelsInverted);
    }

    if (targetWorlds.length > 0) {
      response.targetWorlds = targetWorlds;
      response.targetWorldsInverted = Boolean(row.targetWorldsInverted);
    }

    if (targetUserIds.length > 0) {
      response.targetUserIds = targetUserIds;
      response.targetUserIdsInverted = Boolean(row.targetUserIdsInverted);
    }

    return response;
  }
}

export default new IngamePopupNoticeService();

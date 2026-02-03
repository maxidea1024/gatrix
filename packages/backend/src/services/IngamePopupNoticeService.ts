import { RowDataPacket, ResultSetHeader } from 'mysql2';
import database from '../config/database';
import { convertFromMySQLDateTime, convertToMySQLDateTime } from '../utils/dateUtils';
import { pubSubService } from './PubSubService';

export interface IngamePopupNotice {
  id: number;
  environment: string;
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

export interface UpdateIngamePopupNoticeData extends Partial<CreateIngamePopupNoticeData> {}

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
  environment: string;
}

class IngamePopupNoticeService {
  /**
   * Get ingame popup notices with pagination and filters
   */
  async getIngamePopupNotices(
    page: number = 1,
    limit: number = 10,
    filters: IngamePopupNoticeFilters
  ): Promise<{ notices: IngamePopupNotice[]; total: number }> {
    const pool = database.getPool();
    const offset = (page - 1) * limit;
    const whereClauses: string[] = [];
    const queryParams: (string | number | boolean | null)[] = [];

    // Environment filter (always applied)
    const environment = filters.environment;
    whereClauses.push('environment = ?');
    queryParams.push(environment);

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
        whereClauses.push(
          'isActive = 1 AND (startDate IS NULL OR startDate <= UTC_TIMESTAMP()) AND (endDate IS NULL OR endDate >= UTC_TIMESTAMP())'
        );
      } else {
        whereClauses.push(
          '(isActive = 0 OR (startDate IS NOT NULL AND startDate > UTC_TIMESTAMP()) OR (endDate IS NOT NULL AND endDate < UTC_TIMESTAMP()))'
        );
      }
    }

    // Target filters - check if JSON array contains the value OR is empty/null (all targets)
    if (filters.world) {
      whereClauses.push(
        '(targetWorlds IS NULL OR JSON_LENGTH(targetWorlds) = 0 OR JSON_CONTAINS(targetWorlds, ?))'
      );
      queryParams.push(JSON.stringify(filters.world));
    }

    if (filters.market) {
      whereClauses.push(
        '(targetMarkets IS NULL OR JSON_LENGTH(targetMarkets) = 0 OR JSON_CONTAINS(targetMarkets, ?))'
      );
      queryParams.push(JSON.stringify(filters.market));
    }

    if (filters.platform) {
      const platforms = Array.isArray(filters.platform) ? filters.platform : [filters.platform];
      const operator = filters.platformOperator || 'any_of';

      if (operator === 'include_all') {
        // All specified platforms must be included OR be empty/null (all platforms)
        const platformChecks = platforms
          .map(() => 'JSON_CONTAINS(targetPlatforms, ?)')
          .join(' AND ');
        whereClauses.push(
          `(targetPlatforms IS NULL OR JSON_LENGTH(targetPlatforms) = 0 OR (${platformChecks}))`
        );
        platforms.forEach((platform) => queryParams.push(JSON.stringify(platform)));
      } else {
        // Any of the specified platforms (default) OR be empty/null (all platforms)
        const platformChecks = platforms
          .map(() => 'JSON_CONTAINS(targetPlatforms, ?)')
          .join(' OR ');
        whereClauses.push(
          `(targetPlatforms IS NULL OR JSON_LENGTH(targetPlatforms) = 0 OR (${platformChecks}))`
        );
        platforms.forEach((platform) => queryParams.push(JSON.stringify(platform)));
      }
    }

    if (filters.clientVersion) {
      whereClauses.push(
        '(targetClientVersions IS NULL OR JSON_LENGTH(targetClientVersions) = 0 OR JSON_CONTAINS(targetClientVersions, ?))'
      );
      queryParams.push(JSON.stringify(filters.clientVersion));
    }

    if (filters.accountId) {
      whereClauses.push(
        '(targetAccountIds IS NULL OR JSON_LENGTH(targetAccountIds) = 0 OR JSON_CONTAINS(targetAccountIds, ?))'
      );
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

    const notices = rows.map((row) => this.formatNotice(row));

    return { notices, total };
  }

  /**
   * Get ingame popup notice by ID
   */
  async getIngamePopupNoticeById(
    id: number,
    environment: string
  ): Promise<IngamePopupNotice | null> {
    const pool = database.getPool();
    const [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT * FROM g_ingame_popup_notices WHERE id = ? AND environment = ?',
      [id, environment]
    );

    if (rows.length === 0) {
      return null;
    }

    return this.formatNotice(rows[0]);
  }

  /**
   * Create ingame popup notice
   */
  async createIngamePopupNotice(
    data: CreateIngamePopupNoticeData,
    createdBy: number,
    environment: string
  ): Promise<IngamePopupNotice> {
    const pool = database.getPool();

    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO g_ingame_popup_notices (
        environment, isActive, content, targetWorlds, targetWorldsInverted, targetPlatforms, targetPlatformsInverted,
        targetChannels, targetChannelsInverted, targetSubchannels, targetSubchannelsInverted,
        targetUserIds, targetUserIdsInverted,
        displayPriority, showOnce, startDate, endDate,
        messageTemplateId, useTemplate, description, createdBy
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        environment,
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
        createdBy,
      ]
    );

    const notice = await this.getIngamePopupNoticeById(result.insertId, environment);
    if (!notice) {
      throw new Error('Failed to create ingame popup notice');
    }

    // Publish SDK event
    await pubSubService.publishSDKEvent({
      type: 'popup.created',
      data: {
        id: notice.id,
        timestamp: Date.now(),
        isVisible: notice.isActive,
        environment: environment,
      },
    });

    return notice;
  }

  /**
   * Update ingame popup notice
   */
  async updateIngamePopupNotice(
    id: number,
    data: UpdateIngamePopupNoticeData,
    updatedBy: number,
    environment: string
  ): Promise<IngamePopupNotice> {
    const pool = database.getPool();
    const updates: string[] = [];
    const values: (string | number | boolean | null)[] = [];

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

    updates.push('updatedAt = UTC_TIMESTAMP()');
    values.push(id, environment);

    await pool.execute(
      `UPDATE g_ingame_popup_notices SET ${updates.join(', ')} WHERE id = ? AND environment = ?`,
      values
    );

    const notice = await this.getIngamePopupNoticeById(id, environment);
    if (!notice) {
      throw new Error('Ingame popup notice not found');
    }

    // Publish SDK event
    await pubSubService.publishSDKEvent({
      type: 'popup.updated',
      data: {
        id: notice.id,
        timestamp: Date.now(),
        isVisible: notice.isActive,
        environment: environment,
      },
    });

    return notice;
  }

  /**
   * Delete ingame popup notice
   */
  async deleteIngamePopupNotice(id: number, environment: string): Promise<void> {
    const pool = database.getPool();

    await pool.execute('DELETE FROM g_ingame_popup_notices WHERE id = ? AND environment = ?', [
      id,
      environment,
    ]);

    // Publish SDK event
    await pubSubService.publishSDKEvent({
      type: 'popup.deleted',
      data: {
        id,
        timestamp: Date.now(),
        environment: environment,
      },
    });
  }

  /**
   * Delete multiple ingame popup notices
   */
  async deleteMultipleIngamePopupNotices(ids: number[], environment: string): Promise<void> {
    const pool = database.getPool();
    const placeholders = ids.map(() => '?').join(',');

    await pool.execute(
      `DELETE FROM g_ingame_popup_notices WHERE id IN (${placeholders}) AND environment = ?`,
      [...ids, environment]
    );

    // Publish SDK events for each deleted notice
    for (const id of ids) {
      await pubSubService.publishSDKEvent({
        type: 'popup.deleted',
        data: {
          id,
          timestamp: Date.now(),
          environment: environment,
        },
      });
    }
  }

  /**
   * Toggle active status
   */
  async toggleActive(id: number, environment: string): Promise<IngamePopupNotice> {
    const pool = database.getPool();
    await pool.execute(
      'UPDATE g_ingame_popup_notices SET isActive = NOT isActive, updatedAt = UTC_TIMESTAMP() WHERE id = ? AND environment = ?',
      [id, environment]
    );

    const notice = await this.getIngamePopupNoticeById(id, environment);
    if (!notice) {
      throw new Error('Ingame popup notice not found');
    }

    // Publish SDK event for toggle
    await pubSubService.publishSDKEvent({
      type: 'popup.updated',
      data: {
        id: notice.id,
        timestamp: Date.now(),
        isVisible: notice.isActive,
        environment: environment,
      },
    });

    return notice;
  }

  /**
   * Format notice from database row
   */
  private formatNotice(row: RowDataPacket): IngamePopupNotice {
    // Helper function to convert mysql2 Date to UTC ISO string
    // mysql2 returns DATETIME as Date interpreted as local time, but DB stores UTC
    // So we extract local time components and format them as UTC
    const convertDateToUTC = (date: any): string | null => {
      if (!date) return null;
      if (date instanceof Date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');
        const ms = String(date.getMilliseconds()).padStart(3, '0');
        return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.${ms}Z`;
      }
      return convertFromMySQLDateTime(date) || null;
    };

    // Helper function to convert dates (must return string)
    const convertDateRequired = (date: any): string => {
      const result = convertDateToUTC(date);
      return result || new Date().toISOString();
    };

    return {
      id: row.id,
      environment: row.environment,
      isActive: Boolean(row.isActive),
      content: row.content, // Database field for admin UI
      message: row.content, // Map database 'content' field to SDK 'message' field
      targetWorlds:
        typeof row.targetWorlds === 'string' ? JSON.parse(row.targetWorlds) : row.targetWorlds,
      targetWorldsInverted: Boolean(row.targetWorldsInverted),
      targetPlatforms:
        typeof row.targetPlatforms === 'string'
          ? JSON.parse(row.targetPlatforms)
          : row.targetPlatforms,
      targetPlatformsInverted: Boolean(row.targetPlatformsInverted),
      targetChannels:
        typeof row.targetChannels === 'string'
          ? JSON.parse(row.targetChannels)
          : row.targetChannels,
      targetChannelsInverted: Boolean(row.targetChannelsInverted),
      targetSubchannels:
        typeof row.targetSubchannels === 'string'
          ? JSON.parse(row.targetSubchannels)
          : row.targetSubchannels,
      targetSubchannelsInverted: Boolean(row.targetSubchannelsInverted),
      targetUserIds: row.targetUserIds || null,
      targetUserIdsInverted: Boolean(row.targetUserIdsInverted),
      displayPriority: Number(row.displayPriority) || 100,
      showOnce: Boolean(row.showOnce),
      startDate: convertDateToUTC(row.startDate),
      endDate: convertDateToUTC(row.endDate),
      messageTemplateId: row.messageTemplateId || null,
      useTemplate: Boolean(row.useTemplate),
      description: row.description || null,
      createdAt: convertDateRequired(row.createdAt),
      updatedAt: convertDateRequired(row.updatedAt),
      createdBy: row.createdBy,
      updatedBy: row.updatedBy || null,
    };
  }

  /**
   * Format notice for Server SDK response
   * Returns only essential fields for game client
   * Note: row is already formatted by formatNotice, so dates are already ISO 8601 strings
   */
  formatNoticeForServerSDK(row: IngamePopupNotice): any {
    // Helper function to parse array fields
    const parseArray = (value: string | string[] | null | undefined): any[] => {
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
      ? row.targetUserIds
          .split(',')
          .map((id: string) => id.trim())
          .filter((id: string) => id)
      : [];

    const targetPlatforms = parseArray(row.targetPlatforms);
    const targetChannels = parseArray(row.targetChannels);
    const targetSubchannels = parseArray(row.targetSubchannels);
    const targetWorlds = parseArray(row.targetWorlds);

    // Filter out "channel:*" subchannels if channel-only targeting is used
    // If a channel is in targetChannels, remove "channel:*" from targetSubchannels
    const filteredSubchannels = targetSubchannels.filter((subchannel) => {
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

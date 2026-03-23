import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { generateULID } from '../utils/ulid';
import database from '../config/database';
import {
  convertDateFieldsFromMySQL,
  convertToMySQLDateTime,
} from '../utils/date-utils';
import { pubSubService } from './pub-sub-service';

import { createLogger } from '../config/logger';

const logger = createLogger('ServiceNoticeService');
import { SERVER_SDK_ETAG } from '../constants/cache-keys';

export interface ServiceNotice {
  id: string;
  environmentId: string;
  isActive: boolean;
  isPinned: boolean;
  category: 'maintenance' | 'event' | 'notice' | 'promotion' | 'other';
  platforms: string[];
  channels?: string[];
  subchannels?: string[];
  startDate: string | null;
  endDate: string | null;
  tabTitle?: string;
  title: string;
  content: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateServiceNoticeData {
  isActive: boolean;
  isPinned?: boolean;
  category: 'maintenance' | 'event' | 'notice' | 'promotion' | 'other';
  platforms: string[];
  channels?: string[] | null;
  subchannels?: string[] | null;
  startDate?: string | null;
  endDate?: string | null;
  tabTitle?: string;
  title: string;
  content: string;
  description?: string;
}

export interface UpdateServiceNoticeData extends Partial<CreateServiceNoticeData> {}

export interface ServiceNoticeFilters {
  isActive?: boolean;
  isPinned?: boolean;
  currentlyVisible?: boolean;
  category?: string;
  platform?: string | string[];
  platformOperator?: 'any_of' | 'include_all';
  channel?: string | string[];
  channelOperator?: 'any_of' | 'include_all';
  subchannel?: string | string[];
  subchannelOperator?: 'any_of' | 'include_all';
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  environmentId: string;
}

class ServiceNoticeService {
  /**
   * Get service notices with pagination and filters
   */
  async getServiceNotices(
    page: number = 1,
    limit: number = 10,
    filters: ServiceNoticeFilters
  ): Promise<{ notices: ServiceNotice[]; total: number }> {
    const pool = database.getPool();
    const offset = (page - 1) * limit;
    const whereClauses: string[] = [];
    const queryParams: (string | number | boolean | null)[] = [];

    // Environment filter (always applied)
    const environmentId = filters.environmentId;
    whereClauses.push('environmentId = ?');
    queryParams.push(environmentId);

    // Apply filters
    if (filters.isActive !== undefined) {
      whereClauses.push('isActive = ?');
      queryParams.push(filters.isActive);
    }

    if (filters.isPinned !== undefined) {
      whereClauses.push('isPinned = ?');
      queryParams.push(filters.isPinned);
    }

    if (filters.currentlyVisible !== undefined) {
      // Filter by currently visible (isActive + within date range)
      // startDate is optional - if null, treat as immediately available
      if (filters.currentlyVisible) {
        whereClauses.push(
          'isActive = 1 AND (startDate IS NULL OR startDate <= UTC_TIMESTAMP()) AND endDate >= UTC_TIMESTAMP()'
        );
      } else {
        whereClauses.push(
          '(isActive = 0 OR (startDate IS NOT NULL AND startDate > UTC_TIMESTAMP()) OR endDate < UTC_TIMESTAMP())'
        );
      }
    }

    if (filters.category) {
      whereClauses.push('category = ?');
      queryParams.push(filters.category);
    }

    if (filters.platform) {
      const platforms = Array.isArray(filters.platform)
        ? filters.platform
        : [filters.platform];
      const operator = filters.platformOperator || 'any_of';

      if (operator === 'include_all') {
        // AND condition: notice must include ALL selected platforms OR be empty (all platforms)
        platforms.forEach((platform) => {
          whereClauses.push(
            '(JSON_LENGTH(platforms) = 0 OR JSON_CONTAINS(platforms, ?))'
          );
          queryParams.push(JSON.stringify(platform));
        });
      } else {
        // OR condition: notice must include ANY of the selected platforms OR be empty (all platforms)
        const platformConditions = platforms
          .map(() => 'JSON_CONTAINS(platforms, ?)')
          .join(' OR ');
        whereClauses.push(
          `(JSON_LENGTH(platforms) = 0 OR (${platformConditions}))`
        );
        platforms.forEach((platform) => {
          queryParams.push(JSON.stringify(platform));
        });
      }
    }

    if (filters.channel) {
      const channels = Array.isArray(filters.channel)
        ? filters.channel
        : [filters.channel];
      const operator = filters.channelOperator || 'any_of';

      if (operator === 'include_all') {
        // AND condition: notice must include ALL selected channels OR be empty (all channels)
        channels.forEach((channel) => {
          whereClauses.push(
            '(JSON_LENGTH(channels) = 0 OR JSON_CONTAINS(channels, ?))'
          );
          queryParams.push(JSON.stringify(channel));
        });
      } else {
        // OR condition: notice must include ANY of the selected channels OR be empty (all channels)
        const channelConditions = channels
          .map(() => 'JSON_CONTAINS(channels, ?)')
          .join(' OR ');
        whereClauses.push(
          `(JSON_LENGTH(channels) = 0 OR (${channelConditions}))`
        );
        channels.forEach((channel) => {
          queryParams.push(JSON.stringify(channel));
        });
      }
    }

    if (filters.subchannel) {
      const subchannels = Array.isArray(filters.subchannel)
        ? filters.subchannel
        : [filters.subchannel];
      const operator = filters.subchannelOperator || 'any_of';

      if (operator === 'include_all') {
        // AND condition: notice must include ALL selected subchannels OR be empty (all subchannels)
        subchannels.forEach((subchannel) => {
          whereClauses.push(
            '(JSON_LENGTH(subchannels) = 0 OR JSON_CONTAINS(subchannels, ?))'
          );
          queryParams.push(JSON.stringify(subchannel));
        });
      } else {
        // OR condition: notice must include ANY of the selected subchannels OR be empty (all subchannels)
        const subchannelConditions = subchannels
          .map(() => 'JSON_CONTAINS(subchannels, ?)')
          .join(' OR ');
        whereClauses.push(
          `(JSON_LENGTH(subchannels) = 0 OR (${subchannelConditions}))`
        );
        subchannels.forEach((subchannel) => {
          queryParams.push(JSON.stringify(subchannel));
        });
      }
    }

    if (filters.search) {
      whereClauses.push(
        '(title LIKE ? OR content LIKE ? OR description LIKE ?)'
      );
      const searchPattern = `%${filters.search}%`;
      queryParams.push(searchPattern, searchPattern, searchPattern);
    }

    const whereClause =
      whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    // Get total count
    const [countResult] = await pool.execute<RowDataPacket[]>(
      `SELECT COUNT(*) as total FROM g_service_notices ${whereClause}`,
      queryParams
    );
    const total = countResult[0].total;

    // Build ORDER BY clause
    let orderByClause = 'ORDER BY isPinned DESC, updatedAt DESC';
    if (filters.sortBy) {
      // Validate sort column to prevent SQL injection
      const allowedSortColumns = [
        'title',
        'category',
        'isActive',
        'isPinned',
        'createdAt',
        'updatedAt',
        'startDate',
        'endDate',
      ];
      if (allowedSortColumns.includes(filters.sortBy)) {
        const sortOrder = filters.sortOrder === 'asc' ? 'ASC' : 'DESC';
        orderByClause = `ORDER BY ${filters.sortBy} ${sortOrder}, id DESC`; // Add id for consistent tie-breaking
      }
    }

    // Get paginated results
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT * FROM g_service_notices ${whereClause} ${orderByClause} LIMIT ${limit} OFFSET ${offset}`,
      queryParams
    );

    const notices = rows.map((row) => {
      const notice = {
        id: row.id,
        environmentId: row.environmentId,
        isActive: Boolean(row.isActive),
        isPinned: Boolean(row.isPinned),
        category: row.category,
        platforms:
          typeof row.platforms === 'string'
            ? JSON.parse(row.platforms)
            : row.platforms,
        channels:
          typeof row.channels === 'string'
            ? JSON.parse(row.channels)
            : row.channels,
        subchannels:
          typeof row.subchannels === 'string'
            ? JSON.parse(row.subchannels)
            : row.subchannels,
        startDate: row.startDate,
        endDate: row.endDate,
        tabTitle: row.tabTitle,
        title: row.title,
        content: row.content,
        description: row.description,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      };
      // Convert MySQL DATETIME to ISO 8601
      return convertDateFieldsFromMySQL(notice, [
        'startDate',
        'endDate',
        'createdAt',
        'updatedAt',
      ]);
    });

    return { notices, total };
  }

  /**
   * Get service notice by ID
   */
  async getServiceNoticeById(
    id: string,
    environmentId: string
  ): Promise<ServiceNotice | null> {
    const pool = database.getPool();
    const [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT * FROM g_service_notices WHERE id = ? AND environmentId = ?',
      [id, environmentId]
    );

    if (rows.length === 0) {
      return null;
    }

    const row = rows[0];
    const notice = {
      id: row.id,
      environmentId: row.environmentId,
      isActive: Boolean(row.isActive),
      isPinned: Boolean(row.isPinned),
      category: row.category,
      platforms:
        typeof row.platforms === 'string'
          ? JSON.parse(row.platforms)
          : row.platforms,
      startDate: row.startDate,
      endDate: row.endDate,
      tabTitle: row.tabTitle,
      title: row.title,
      content: row.content,
      description: row.description,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
    // Convert MySQL DATETIME to ISO 8601
    return convertDateFieldsFromMySQL(notice, [
      'startDate',
      'endDate',
      'createdAt',
      'updatedAt',
    ]);
  }

  /**
   * Create service notice
   */
  async createServiceNotice(
    data: CreateServiceNoticeData,
    environmentId: string
  ): Promise<ServiceNotice> {
    const pool = database.getPool();

    logger.debug('Creating service notice with data:', {
      startDate: data.startDate,
      endDate: data.endDate,
      convertedStartDate: convertToMySQLDateTime(data.startDate),
      convertedEndDate: data.endDate
        ? convertToMySQLDateTime(data.endDate)
        : null,
    });

    const generatedId = generateULID();

    await pool.execute<ResultSetHeader>(
      `INSERT INTO g_service_notices
      (id, environmentId, isActive, isPinned, category, platforms, channels, subchannels, startDate, endDate, tabTitle, title, content, description)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        generatedId,
        environmentId,
        data.isActive,
        data.isPinned || false,
        data.category,
        JSON.stringify(data.platforms),
        data.channels ? JSON.stringify(data.channels) : null,
        data.subchannels ? JSON.stringify(data.subchannels) : null,
        data.startDate ? convertToMySQLDateTime(data.startDate) : null,
        data.endDate ? convertToMySQLDateTime(data.endDate) : null,
        data.tabTitle || null,
        data.title,
        data.content,
        data.description || null,
      ]
    );

    const notice = await this.getServiceNoticeById(generatedId, environmentId);
    if (!notice) {
      throw new Error('Failed to retrieve created service notice');
    }

    // Invalidate ETag cache and publish SDK Event with full data for cache update
    try {
      // Invalidate ETag cache so SDK fetches fresh data
      await pubSubService.invalidateKey(
        `${SERVER_SDK_ETAG.SERVICE_NOTICES}:${environmentId}`
      );

      await pubSubService.publishSDKEvent(
        {
          type: 'service_notice.created',
          data: {
            id: notice.id,
            environmentId: environmentId,

            serviceNotice: notice,
          },
        },
        { environmentId: environmentId }
      );
    } catch (err) {
      logger.error('Failed to publish service notice event', err);
    }

    return notice;
  }

  /**
   * Update service notice
   */
  async updateServiceNotice(
    id: string,
    data: UpdateServiceNoticeData,
    environmentId: string
  ): Promise<ServiceNotice> {
    const pool = database.getPool();
    const updates: string[] = [];
    const values: (string | number | boolean | null)[] = [];

    logger.debug('updateServiceNotice called', {
      id,
      environmentId,
      dataKeys: Object.keys(data),
      hasTitle: !!data.title,
      hasContent: !!data.content,
    });

    if (data.isActive !== undefined) {
      updates.push('isActive = ?');
      values.push(data.isActive);
    }

    if (data.isPinned !== undefined) {
      updates.push('isPinned = ?');
      values.push(data.isPinned);
    }

    if (data.category) {
      updates.push('category = ?');
      values.push(data.category);
    }

    if (data.platforms) {
      updates.push('platforms = ?');
      values.push(JSON.stringify(data.platforms));
    }

    if (data.channels !== undefined) {
      updates.push('channels = ?');
      values.push(data.channels ? JSON.stringify(data.channels) : null);
    }

    if (data.subchannels !== undefined) {
      updates.push('subchannels = ?');
      values.push(data.subchannels ? JSON.stringify(data.subchannels) : null);
    }

    if (data.startDate !== undefined) {
      updates.push('startDate = ?');
      values.push(
        data.startDate ? convertToMySQLDateTime(data.startDate) : null
      );
    }

    if (data.endDate !== undefined) {
      updates.push('endDate = ?');
      values.push(data.endDate ? convertToMySQLDateTime(data.endDate) : null);
    }

    if (data.tabTitle !== undefined) {
      updates.push('tabTitle = ?');
      values.push(data.tabTitle || null);
    }

    if (data.title) {
      updates.push('title = ?');
      values.push(data.title);
    }

    if (data.content) {
      updates.push('content = ?');
      values.push(data.content);
    }

    if (data.description !== undefined) {
      updates.push('description = ?');
      values.push(data.description || null);
    }

    // Check if there are meaningful updates (beyond just updatedAt)
    if (updates.length === 0) {
      logger.warn('updateServiceNotice: no meaningful fields to update', {
        id,
        environmentId,
        dataKeys: Object.keys(data),
      });
    }

    updates.push('updatedAt = UTC_TIMESTAMP()');
    values.push(id, environmentId);

    const [result] = await pool.execute<ResultSetHeader>(
      `UPDATE g_service_notices SET ${updates.join(', ')} WHERE id = ? AND environmentId = ?`,
      values
    );

    if (result.affectedRows === 0) {
      logger.warn('updateServiceNotice: no rows affected by update', {
        id,
        environmentId,
      });
      throw new Error(
        'Service notice not found or update failed: no rows affected'
      );
    }

    const notice = await this.getServiceNoticeById(id, environmentId);
    if (!notice) {
      throw new Error('Service notice not found');
    }

    logger.info('Updated service notice retrieved from DB', {
      id: notice.id,
      isActive: notice.isActive,
      inputIsActive: data.isActive,
      updates: updates,
      environmentId,
    });

    // Invalidate ETag cache and publish SDK Event with full data for cache update
    try {
      // Invalidate ETag cache so SDK fetches fresh data
      await pubSubService.invalidateKey(
        `${SERVER_SDK_ETAG.SERVICE_NOTICES}:${environmentId}`
      );

      await pubSubService.publishSDKEvent(
        {
          type: 'service_notice.updated',
          data: {
            id: notice.id,
            environmentId: environmentId,

            serviceNotice: notice,
          },
        },
        { environmentId: environmentId }
      );

      logger.info('Service notice update event published', {
        id: notice.id,
        isActive: notice.isActive,
      });
    } catch (err) {
      logger.error('Failed to publish service notice event', err);
    }

    return notice;
  }

  /**
   * Delete service notice
   */
  async deleteServiceNotice(id: string, environmentId: string): Promise<void> {
    const pool = database.getPool();
    await pool.execute(
      'DELETE FROM g_service_notices WHERE id = ? AND environmentId = ?',
      [id, environmentId]
    );

    // Invalidate ETag cache and publish SDK Event (Deletion)
    try {
      // Invalidate ETag cache so SDK fetches fresh data
      await pubSubService.invalidateKey(
        `${SERVER_SDK_ETAG.SERVICE_NOTICES}:${environmentId}`
      );

      await pubSubService.publishSDKEvent(
        {
          type: 'service_notice.deleted',
          data: {
            id: id,
            environmentId: environmentId,
          },
        },
        { environmentId: environmentId }
      );
    } catch (err) {
      logger.error('Failed to publish service notice event', err);
    }
  }

  /**
   * Delete multiple service notices
   */
  async deleteMultipleServiceNotices(
    ids: string[],
    environmentId: string
  ): Promise<void> {
    if (ids.length === 0) return;

    const pool = database.getPool();
    const placeholders = ids.map(() => '?').join(',');
    await pool.execute(
      `DELETE FROM g_service_notices WHERE id IN (${placeholders}) AND environmentId = ?`,
      [...ids, environmentId]
    );

    // Publish SDK Event (Deletion)
    try {
      await pubSubService.publishSDKEvent(
        {
          type: 'service_notice.deleted',
          data: {
            environmentId: environmentId,
          },
        },
        { environmentId: environmentId }
      );
    } catch (err) {
      logger.error('Failed to publish service notice event', err);
    }
  }

  /**
   * Toggle active status
   */
  async toggleActive(
    id: string,
    environmentId: string
  ): Promise<ServiceNotice> {
    const pool = database.getPool();
    await pool.execute(
      'UPDATE g_service_notices SET isActive = NOT isActive, updatedAt = UTC_TIMESTAMP() WHERE id = ? AND environmentId = ?',
      [id, environmentId]
    );

    const notice = await this.getServiceNoticeById(id, environmentId);
    if (!notice) {
      throw new Error('Service notice not found');
    }

    // Invalidate ETag cache and publish SDK Event
    try {
      // Invalidate ETag cache so SDK fetches fresh data
      await pubSubService.invalidateKey(
        `${SERVER_SDK_ETAG.SERVICE_NOTICES}:${environmentId}`
      );

      await pubSubService.publishSDKEvent(
        {
          type: 'service_notice.updated',
          data: {
            id: notice.id,
            environmentId: environmentId,

            serviceNotice: notice,
          },
        },
        { environmentId: environmentId }
      );
    } catch (err) {
      logger.error('Failed to publish service notice event', err);
    }

    return notice;
  }
}

export default new ServiceNoticeService();

import { RowDataPacket, ResultSetHeader } from 'mysql2';
import database from '../config/database';
import { convertDateFieldsFromMySQL, convertToMySQLDateTime } from '../utils/dateUtils';
import { pubSubService } from './PubSubService';
import { Environment } from '../models/Environment';
import logger from '../config/logger';
import { SERVER_SDK_ETAG } from '../constants/cacheKeys';

export interface ServiceNotice {
  id: number;
  environment: string;
  isActive: boolean;
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

export interface UpdateServiceNoticeData extends Partial<CreateServiceNoticeData> { }

export interface ServiceNoticeFilters {
  isActive?: boolean;
  currentlyVisible?: boolean;
  category?: string;
  platform?: string | string[];
  platformOperator?: 'any_of' | 'include_all';
  channel?: string | string[];
  channelOperator?: 'any_of' | 'include_all';
  subchannel?: string | string[];
  subchannelOperator?: 'any_of' | 'include_all';
  search?: string;
  environment: string;
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
    const queryParams: any[] = [];

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
      if (filters.currentlyVisible) {
        whereClauses.push('isActive = 1 AND (startDate IS NULL OR startDate <= NOW()) AND endDate >= NOW()');
      } else {
        whereClauses.push('(isActive = 0 OR (startDate IS NOT NULL AND startDate > NOW()) OR endDate < NOW())');
      }
    }

    if (filters.category) {
      whereClauses.push('category = ?');
      queryParams.push(filters.category);
    }

    if (filters.platform) {
      const platforms = Array.isArray(filters.platform) ? filters.platform : [filters.platform];
      const operator = filters.platformOperator || 'any_of';

      if (operator === 'include_all') {
        // AND condition: notice must include ALL selected platforms OR be empty (all platforms)
        platforms.forEach(platform => {
          whereClauses.push('(JSON_LENGTH(platforms) = 0 OR JSON_CONTAINS(platforms, ?))');
          queryParams.push(JSON.stringify(platform));
        });
      } else {
        // OR condition: notice must include ANY of the selected platforms OR be empty (all platforms)
        const platformConditions = platforms.map(() => 'JSON_CONTAINS(platforms, ?)').join(' OR ');
        whereClauses.push(`(JSON_LENGTH(platforms) = 0 OR (${platformConditions}))`);
        platforms.forEach(platform => {
          queryParams.push(JSON.stringify(platform));
        });
      }
    }

    if (filters.channel) {
      const channels = Array.isArray(filters.channel) ? filters.channel : [filters.channel];
      const operator = filters.channelOperator || 'any_of';

      if (operator === 'include_all') {
        // AND condition: notice must include ALL selected channels OR be empty (all channels)
        channels.forEach(channel => {
          whereClauses.push('(JSON_LENGTH(channels) = 0 OR JSON_CONTAINS(channels, ?))');
          queryParams.push(JSON.stringify(channel));
        });
      } else {
        // OR condition: notice must include ANY of the selected channels OR be empty (all channels)
        const channelConditions = channels.map(() => 'JSON_CONTAINS(channels, ?)').join(' OR ');
        whereClauses.push(`(JSON_LENGTH(channels) = 0 OR (${channelConditions}))`);
        channels.forEach(channel => {
          queryParams.push(JSON.stringify(channel));
        });
      }
    }

    if (filters.subchannel) {
      const subchannels = Array.isArray(filters.subchannel) ? filters.subchannel : [filters.subchannel];
      const operator = filters.subchannelOperator || 'any_of';

      if (operator === 'include_all') {
        // AND condition: notice must include ALL selected subchannels OR be empty (all subchannels)
        subchannels.forEach(subchannel => {
          whereClauses.push('(JSON_LENGTH(subchannels) = 0 OR JSON_CONTAINS(subchannels, ?))');
          queryParams.push(JSON.stringify(subchannel));
        });
      } else {
        // OR condition: notice must include ANY of the selected subchannels OR be empty (all subchannels)
        const subchannelConditions = subchannels.map(() => 'JSON_CONTAINS(subchannels, ?)').join(' OR ');
        whereClauses.push(`(JSON_LENGTH(subchannels) = 0 OR (${subchannelConditions}))`);
        subchannels.forEach(subchannel => {
          queryParams.push(JSON.stringify(subchannel));
        });
      }
    }

    if (filters.search) {
      whereClauses.push('(title LIKE ? OR content LIKE ? OR description LIKE ?)');
      const searchPattern = `%${filters.search}%`;
      queryParams.push(searchPattern, searchPattern, searchPattern);
    }

    const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    // Get total count
    const [countResult] = await pool.execute<RowDataPacket[]>(
      `SELECT COUNT(*) as total FROM g_service_notices ${whereClause}`,
      queryParams
    );
    const total = countResult[0].total;

    // Get paginated results
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT * FROM g_service_notices ${whereClause} ORDER BY createdAt DESC LIMIT ${limit} OFFSET ${offset}`,
      queryParams
    );

    const notices = rows.map(row => {
      const notice = {
        id: row.id,
        environment: row.environment,
        isActive: Boolean(row.isActive),
        category: row.category,
        platforms: typeof row.platforms === 'string' ? JSON.parse(row.platforms) : row.platforms,
        channels: typeof row.channels === 'string' ? JSON.parse(row.channels) : row.channels,
        subchannels: typeof row.subchannels === 'string' ? JSON.parse(row.subchannels) : row.subchannels,
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
      return convertDateFieldsFromMySQL(notice, ['startDate', 'endDate', 'createdAt', 'updatedAt']);
    });

    return { notices, total };
  }

  /**
   * Get service notice by ID
   */
  async getServiceNoticeById(id: number, environment: string): Promise<ServiceNotice | null> {
    const pool = database.getPool();
    const [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT * FROM g_service_notices WHERE id = ? AND environment = ?',
      [id, environment]
    );

    if (rows.length === 0) {
      return null;
    }

    const row = rows[0];
    const notice = {
      id: row.id,
      environment: row.environment,
      isActive: Boolean(row.isActive),
      category: row.category,
      platforms: typeof row.platforms === 'string' ? JSON.parse(row.platforms) : row.platforms,
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
    return convertDateFieldsFromMySQL(notice, ['startDate', 'endDate', 'createdAt', 'updatedAt']);
  }

  /**
   * Create service notice
   */
  async createServiceNotice(data: CreateServiceNoticeData, environment: string): Promise<ServiceNotice> {
    const pool = database.getPool();

    // Debug logging
    console.log('Creating service notice with data:', {
      startDate: data.startDate,
      endDate: data.endDate,
      convertedStartDate: convertToMySQLDateTime(data.startDate),
      convertedEndDate: data.endDate ? convertToMySQLDateTime(data.endDate) : null,
    });

    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO g_service_notices
      (environment, isActive, category, platforms, channels, subchannels, startDate, endDate, tabTitle, title, content, description)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        environment,
        data.isActive,
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

    const notice = await this.getServiceNoticeById(result.insertId, environment);
    if (!notice) {
      throw new Error('Failed to retrieve created service notice');
    }

    // Invalidate ETag cache and publish SDK Event with full data for cache update
    try {
      // Invalidate ETag cache so SDK fetches fresh data
      await pubSubService.invalidateKey(`${SERVER_SDK_ETAG.SERVICE_NOTICES}:${environment}`);

      await pubSubService.publishSDKEvent({
        type: 'service_notice.created',
        data: {
          id: notice.id,
          environment: environment,
          timestamp: Date.now(),
          serviceNotice: notice
        }
      });
    } catch (err) {
      logger.error('Failed to publish service notice event', err);
    }

    return notice;
  }

  /**
   * Update service notice
   */
  async updateServiceNotice(id: number, data: UpdateServiceNoticeData, environment: string): Promise<ServiceNotice> {
    const pool = database.getPool();
    const updates: string[] = [];
    const values: any[] = [];

    if (data.isActive !== undefined) {
      updates.push('isActive = ?');
      values.push(data.isActive);
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
      values.push(data.startDate ? convertToMySQLDateTime(data.startDate) : null);
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

    updates.push('updatedAt = NOW()');
    values.push(id, environment);

    await pool.execute(
      `UPDATE g_service_notices SET ${updates.join(', ')} WHERE id = ? AND environment = ?`,
      values
    );

    const notice = await this.getServiceNoticeById(id, environment);
    if (!notice) {
      throw new Error('Service notice not found');
    }

    // Invalidate ETag cache and publish SDK Event with full data for cache update
    try {
      // Invalidate ETag cache so SDK fetches fresh data
      await pubSubService.invalidateKey(`${SERVER_SDK_ETAG.SERVICE_NOTICES}:${environment}`);

      await pubSubService.publishSDKEvent({
        type: 'service_notice.updated',
        data: {
          id: notice.id,
          environment: environment,
          timestamp: Date.now(),
          serviceNotice: notice
        }
      });
    } catch (err) {
      logger.error('Failed to publish service notice event', err);
    }

    return notice;
  }

  /**
   * Delete service notice
   */
  async deleteServiceNotice(id: number, environment: string): Promise<void> {
    const pool = database.getPool();
    await pool.execute('DELETE FROM g_service_notices WHERE id = ? AND environment = ?', [id, environment]);

    // Invalidate ETag cache and publish SDK Event (Deletion)
    try {
      // Invalidate ETag cache so SDK fetches fresh data
      await pubSubService.invalidateKey(`${SERVER_SDK_ETAG.SERVICE_NOTICES}:${environment}`);

      await pubSubService.publishSDKEvent({
        type: 'service_notice.deleted',
        data: {
          id: id,
          environment: environment,
          timestamp: Date.now()
        }
      });
    } catch (err) {
      logger.error('Failed to publish service notice event', err);
    }
  }

  /**
   * Delete multiple service notices
   */
  async deleteMultipleServiceNotices(ids: number[], environment: string): Promise<void> {
    if (ids.length === 0) return;

    const pool = database.getPool();
    const placeholders = ids.map(() => '?').join(',');
    await pool.execute(
      `DELETE FROM g_service_notices WHERE id IN (${placeholders}) AND environment = ?`,
      [...ids, environment]
    );

    // Publish SDK Event (Deletion)
    try {
      await pubSubService.publishSDKEvent({
        type: 'service_notice.deleted',
        data: {
          environment: environment,
          timestamp: Date.now()
        }
      });
    } catch (err) {
      logger.error('Failed to publish service notice event', err);
    }
  }

  /**
   * Toggle active status
   */
  async toggleActive(id: number, environment: string): Promise<ServiceNotice> {
    const pool = database.getPool();
    await pool.execute(
      'UPDATE g_service_notices SET isActive = NOT isActive, updatedAt = NOW() WHERE id = ? AND environment = ?',
      [id, environment]
    );

    const notice = await this.getServiceNoticeById(id, environment);
    if (!notice) {
      throw new Error('Service notice not found');
    }

    // Invalidate ETag cache and publish SDK Event
    try {
      // Invalidate ETag cache so SDK fetches fresh data
      await pubSubService.invalidateKey(`${SERVER_SDK_ETAG.SERVICE_NOTICES}:${environment}`);

      await pubSubService.publishSDKEvent({
        type: 'service_notice.updated',
        data: {
          id: notice.id,
          environment: environment,
          timestamp: Date.now()
        }
      });
    } catch (err) {
      logger.error('Failed to publish service notice event', err);
    }

    return notice;
  }
}

export default new ServiceNoticeService();

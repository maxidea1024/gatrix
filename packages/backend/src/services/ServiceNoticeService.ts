import db from '../config/knex';
import { convertToMySQLDateTime } from '../utils/dateUtils';
import { pubSubService } from './PubSubService';
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
   * Format row from database
   */
  private formatNotice(row: any): ServiceNotice {
    return {
      id: row.id,
      environment: row.environment,
      isActive: Boolean(row.isActive),
      category: row.category,
      platforms: typeof row.platforms === 'string' ? JSON.parse(row.platforms) : (row.platforms || []),
      channels: row.channels ? (typeof row.channels === 'string' ? JSON.parse(row.channels) : row.channels) : undefined,
      subchannels: row.subchannels ? (typeof row.subchannels === 'string' ? JSON.parse(row.subchannels) : row.subchannels) : undefined,
      startDate: row.startDate,
      endDate: row.endDate,
      tabTitle: row.tabTitle,
      title: row.title,
      content: row.content,
      description: row.description,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  /**
   * Get service notices with pagination and filters
   */
  async getServiceNotices(
    page: number = 1,
    limit: number = 10,
    filters: ServiceNoticeFilters
  ): Promise<{ notices: ServiceNotice[]; total: number }> {
    const offset = (page - 1) * limit;
    const environment = filters.environment;

    let query = db('g_service_notices').where('environment', environment);

    // Apply filters
    if (filters.isActive !== undefined) {
      query = query.where('isActive', filters.isActive);
    }

    if (filters.currentlyVisible !== undefined) {
      if (filters.currentlyVisible) {
        query = query.where('isActive', true)
          .where(function () {
            this.whereNull('startDate').orWhere('startDate', '<=', db.raw('UTC_TIMESTAMP()'));
          })
          .where('endDate', '>=', db.raw('UTC_TIMESTAMP()'));
      } else {
        query = query.where(function () {
          this.where('isActive', false)
            .orWhere(function () {
              this.whereNotNull('startDate').andWhere('startDate', '>', db.raw('UTC_TIMESTAMP()'));
            })
            .orWhere('endDate', '<', db.raw('UTC_TIMESTAMP()'));
        });
      }
    }

    if (filters.category) {
      query = query.where('category', filters.category);
    }

    if (filters.platform) {
      const platforms = Array.isArray(filters.platform) ? filters.platform : [filters.platform];
      const operator = filters.platformOperator || 'any_of';

      if (operator === 'include_all') {
        platforms.forEach(platform => {
          query = query.where(function () {
            this.whereRaw('JSON_LENGTH(platforms) = 0')
              .orWhereRaw('JSON_CONTAINS(platforms, ?)', [JSON.stringify(platform)]);
          });
        });
      } else {
        query = query.where(function () {
          this.whereRaw('JSON_LENGTH(platforms) = 0');
          platforms.forEach(platform => {
            this.orWhereRaw('JSON_CONTAINS(platforms, ?)', [JSON.stringify(platform)]);
          });
        });
      }
    }

    if (filters.channel) {
      const channels = Array.isArray(filters.channel) ? filters.channel : [filters.channel];
      const operator = filters.channelOperator || 'any_of';

      if (operator === 'include_all') {
        channels.forEach(channel => {
          query = query.where(function () {
            this.whereRaw('JSON_LENGTH(channels) = 0')
              .orWhereRaw('JSON_CONTAINS(channels, ?)', [JSON.stringify(channel)]);
          });
        });
      } else {
        query = query.where(function () {
          this.whereRaw('JSON_LENGTH(channels) = 0');
          channels.forEach(channel => {
            this.orWhereRaw('JSON_CONTAINS(channels, ?)', [JSON.stringify(channel)]);
          });
        });
      }
    }

    if (filters.subchannel) {
      const subchannels = Array.isArray(filters.subchannel) ? filters.subchannel : [filters.subchannel];
      const operator = filters.subchannelOperator || 'any_of';

      if (operator === 'include_all') {
        subchannels.forEach(subchannel => {
          query = query.where(function () {
            this.whereRaw('JSON_LENGTH(subchannels) = 0')
              .orWhereRaw('JSON_CONTAINS(subchannels, ?)', [JSON.stringify(subchannel)]);
          });
        });
      } else {
        query = query.where(function () {
          this.whereRaw('JSON_LENGTH(subchannels) = 0');
          subchannels.forEach(subchannel => {
            this.orWhereRaw('JSON_CONTAINS(subchannels, ?)', [JSON.stringify(subchannel)]);
          });
        });
      }
    }

    if (filters.search) {
      const searchPattern = `%${filters.search}%`;
      query = query.where(function () {
        this.where('title', 'like', searchPattern)
          .orWhere('content', 'like', searchPattern)
          .orWhere('description', 'like', searchPattern);
      });
    }

    // Get total count
    const countResult = await query.clone().count('* as total').first();
    const total = Number(countResult?.total || 0);

    // Get paginated results
    const rows = await query
      .orderBy('updatedAt', 'desc')
      .limit(limit)
      .offset(offset);

    const notices = rows.map((row: any) => this.formatNotice(row));

    return { notices, total };
  }

  /**
   * Get service notice by ID
   */
  async getServiceNoticeById(id: number, environment: string): Promise<ServiceNotice | null> {
    const row = await db('g_service_notices')
      .where('id', id)
      .where('environment', environment)
      .first();

    if (!row) {
      return null;
    }

    return this.formatNotice(row);
  }

  /**
   * Create service notice
   */
  async createServiceNotice(data: CreateServiceNoticeData, environment: string): Promise<ServiceNotice> {
    logger.debug('Creating service notice with data:', {
      startDate: data.startDate,
      endDate: data.endDate,
      convertedStartDate: convertToMySQLDateTime(data.startDate),
      convertedEndDate: data.endDate ? convertToMySQLDateTime(data.endDate) : null,
    });

    const [insertId] = await db('g_service_notices').insert({
      environment,
      isActive: data.isActive,
      category: data.category,
      platforms: JSON.stringify(data.platforms),
      channels: data.channels ? JSON.stringify(data.channels) : null,
      subchannels: data.subchannels ? JSON.stringify(data.subchannels) : null,
      startDate: data.startDate ? convertToMySQLDateTime(data.startDate) : null,
      endDate: data.endDate ? convertToMySQLDateTime(data.endDate) : null,
      tabTitle: data.tabTitle || null,
      title: data.title,
      content: data.content,
      description: data.description || null,
    });

    const notice = await this.getServiceNoticeById(insertId, environment);
    if (!notice) {
      throw new Error('Failed to retrieve created service notice');
    }

    // Invalidate ETag cache and publish SDK Event with full data for cache update
    try {
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
    const updateData: Record<string, any> = {};

    if (data.isActive !== undefined) {
      updateData.isActive = data.isActive;
    }

    if (data.category) {
      updateData.category = data.category;
    }

    if (data.platforms) {
      updateData.platforms = JSON.stringify(data.platforms);
    }

    if (data.channels !== undefined) {
      updateData.channels = data.channels ? JSON.stringify(data.channels) : null;
    }

    if (data.subchannels !== undefined) {
      updateData.subchannels = data.subchannels ? JSON.stringify(data.subchannels) : null;
    }

    if (data.startDate !== undefined) {
      updateData.startDate = data.startDate ? convertToMySQLDateTime(data.startDate) : null;
    }

    if (data.endDate !== undefined) {
      updateData.endDate = data.endDate ? convertToMySQLDateTime(data.endDate) : null;
    }

    if (data.tabTitle !== undefined) {
      updateData.tabTitle = data.tabTitle || null;
    }

    if (data.title) {
      updateData.title = data.title;
    }

    if (data.content) {
      updateData.content = data.content;
    }

    if (data.description !== undefined) {
      updateData.description = data.description || null;
    }

    updateData.updatedAt = db.fn.now();

    await db('g_service_notices')
      .where('id', id)
      .where('environment', environment)
      .update(updateData);

    const notice = await this.getServiceNoticeById(id, environment);
    if (!notice) {
      throw new Error('Service notice not found');
    }

    // Invalidate ETag cache and publish SDK Event with full data for cache update
    try {
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
    await db('g_service_notices')
      .where('id', id)
      .where('environment', environment)
      .del();

    // Invalidate ETag cache and publish SDK Event (Deletion)
    try {
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

    await db('g_service_notices')
      .whereIn('id', ids)
      .where('environment', environment)
      .del();

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
    await db('g_service_notices')
      .where('id', id)
      .where('environment', environment)
      .update({
        isActive: db.raw('NOT isActive'),
        updatedAt: db.fn.now()
      });

    const notice = await this.getServiceNoticeById(id, environment);
    if (!notice) {
      throw new Error('Service notice not found');
    }

    // Invalidate ETag cache and publish SDK Event
    try {
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

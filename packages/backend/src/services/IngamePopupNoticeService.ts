import db from '../config/knex';
import { convertToMySQLDateTime } from '../utils/dateUtils';
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
  environment: string;
}

class IngamePopupNoticeService {
  /**
   * Format notice from database row
   * knex postProcessResponse already converts Date objects to ISO strings
   */
  private formatNotice(row: any): IngamePopupNotice {
    return {
      id: row.id,
      environment: row.environment,
      isActive: Boolean(row.isActive),
      content: row.content,
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
      startDate: row.startDate,
      endDate: row.endDate,
      messageTemplateId: row.messageTemplateId || null,
      useTemplate: Boolean(row.useTemplate),
      description: row.description || null,
      createdAt: row.createdAt || new Date().toISOString(),
      updatedAt: row.updatedAt || new Date().toISOString(),
      createdBy: row.createdBy,
      updatedBy: row.updatedBy || null
    };
  }

  /**
   * Get ingame popup notices with pagination and filters
   */
  async getIngamePopupNotices(
    page: number = 1,
    limit: number = 10,
    filters: IngamePopupNoticeFilters
  ): Promise<{ notices: IngamePopupNotice[]; total: number }> {
    const offset = (page - 1) * limit;
    const environment = filters.environment;

    let query = db('g_ingame_popup_notices').where('environment', environment);

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
          .where(function () {
            this.whereNull('endDate').orWhere('endDate', '>=', db.raw('UTC_TIMESTAMP()'));
          });
      } else {
        query = query.where(function () {
          this.where('isActive', false)
            .orWhere(function () {
              this.whereNotNull('startDate').andWhere('startDate', '>', db.raw('UTC_TIMESTAMP()'));
            })
            .orWhere(function () {
              this.whereNotNull('endDate').andWhere('endDate', '<', db.raw('UTC_TIMESTAMP()'));
            });
        });
      }
    }

    // Target filters
    if (filters.world) {
      query = query.where(function () {
        this.whereNull('targetWorlds')
          .orWhereRaw('JSON_LENGTH(targetWorlds) = 0')
          .orWhereRaw('JSON_CONTAINS(targetWorlds, ?)', [JSON.stringify(filters.world)]);
      });
    }

    if (filters.market) {
      query = query.where(function () {
        this.whereNull('targetMarkets')
          .orWhereRaw('JSON_LENGTH(targetMarkets) = 0')
          .orWhereRaw('JSON_CONTAINS(targetMarkets, ?)', [JSON.stringify(filters.market)]);
      });
    }

    if (filters.platform) {
      const platforms = Array.isArray(filters.platform) ? filters.platform : [filters.platform];
      const operator = filters.platformOperator || 'any_of';

      if (operator === 'include_all') {
        query = query.where(function () {
          this.whereNull('targetPlatforms').orWhereRaw('JSON_LENGTH(targetPlatforms) = 0');
          platforms.forEach(platform => {
            this.orWhereRaw('JSON_CONTAINS(targetPlatforms, ?)', [JSON.stringify(platform)]);
          });
        });
      } else {
        query = query.where(function () {
          this.whereNull('targetPlatforms').orWhereRaw('JSON_LENGTH(targetPlatforms) = 0');
          platforms.forEach(platform => {
            this.orWhereRaw('JSON_CONTAINS(targetPlatforms, ?)', [JSON.stringify(platform)]);
          });
        });
      }
    }

    if (filters.clientVersion) {
      query = query.where(function () {
        this.whereNull('targetClientVersions')
          .orWhereRaw('JSON_LENGTH(targetClientVersions) = 0')
          .orWhereRaw('JSON_CONTAINS(targetClientVersions, ?)', [JSON.stringify(filters.clientVersion)]);
      });
    }

    if (filters.accountId) {
      query = query.where(function () {
        this.whereNull('targetAccountIds')
          .orWhereRaw('JSON_LENGTH(targetAccountIds) = 0')
          .orWhereRaw('JSON_CONTAINS(targetAccountIds, ?)', [JSON.stringify(filters.accountId)]);
      });
    }

    if (filters.search) {
      const searchPattern = `%${filters.search}%`;
      query = query.where(function () {
        this.where('content', 'like', searchPattern)
          .orWhere('description', 'like', searchPattern);
      });
    }

    // Get total count
    const countResult = await query.clone().count('* as total').first();
    const total = Number(countResult?.total || 0);

    // Get paginated results
    const rows = await query
      .orderBy('displayPriority', 'asc')
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .offset(offset);

    const notices = rows.map((row: any) => this.formatNotice(row));

    return { notices, total };
  }

  /**
   * Get ingame popup notice by ID
   */
  async getIngamePopupNoticeById(id: number, environment: string): Promise<IngamePopupNotice | null> {
    const row = await db('g_ingame_popup_notices')
      .where('id', id)
      .where('environment', environment)
      .first();

    if (!row) {
      return null;
    }

    return this.formatNotice(row);
  }

  /**
   * Create ingame popup notice
   */
  async createIngamePopupNotice(data: CreateIngamePopupNoticeData, createdBy: number, environment: string): Promise<IngamePopupNotice> {
    const [insertId] = await db('g_ingame_popup_notices').insert({
      environment,
      isActive: data.isActive,
      content: data.content,
      targetWorlds: data.targetWorlds ? JSON.stringify(data.targetWorlds) : null,
      targetWorldsInverted: data.targetWorldsInverted ?? false,
      targetPlatforms: data.targetPlatforms ? JSON.stringify(data.targetPlatforms) : null,
      targetPlatformsInverted: data.targetPlatformsInverted ?? false,
      targetChannels: data.targetChannels ? JSON.stringify(data.targetChannels) : null,
      targetChannelsInverted: data.targetChannelsInverted ?? false,
      targetSubchannels: data.targetSubchannels ? JSON.stringify(data.targetSubchannels) : null,
      targetSubchannelsInverted: data.targetSubchannelsInverted ?? false,
      targetUserIds: data.targetUserIds ?? null,
      targetUserIdsInverted: data.targetUserIdsInverted ?? false,
      displayPriority: data.displayPriority ?? 100,
      showOnce: data.showOnce ?? false,
      startDate: convertToMySQLDateTime(data.startDate),
      endDate: data.endDate ? convertToMySQLDateTime(data.endDate) : null,
      messageTemplateId: data.messageTemplateId ?? null,
      useTemplate: data.useTemplate ?? false,
      description: data.description ?? null,
      createdBy
    });

    const notice = await this.getIngamePopupNoticeById(insertId, environment);
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
        environment: environment
      }
    });

    return notice;
  }

  /**
   * Update ingame popup notice
   */
  async updateIngamePopupNotice(id: number, data: UpdateIngamePopupNoticeData, updatedBy: number, environment: string): Promise<IngamePopupNotice> {
    const updateData: Record<string, any> = {};

    if (data.isActive !== undefined) {
      updateData.isActive = data.isActive;
    }

    if (data.content !== undefined) {
      updateData.content = data.content;
    }

    if (data.targetWorlds !== undefined) {
      updateData.targetWorlds = data.targetWorlds ? JSON.stringify(data.targetWorlds) : null;
    }

    if (data.targetWorldsInverted !== undefined) {
      updateData.targetWorldsInverted = data.targetWorldsInverted;
    }

    if (data.targetPlatforms !== undefined) {
      updateData.targetPlatforms = data.targetPlatforms ? JSON.stringify(data.targetPlatforms) : null;
    }

    if (data.targetPlatformsInverted !== undefined) {
      updateData.targetPlatformsInverted = data.targetPlatformsInverted;
    }

    if (data.targetChannels !== undefined) {
      updateData.targetChannels = data.targetChannels ? JSON.stringify(data.targetChannels) : null;
    }

    if (data.targetChannelsInverted !== undefined) {
      updateData.targetChannelsInverted = data.targetChannelsInverted;
    }

    if (data.targetSubchannels !== undefined) {
      updateData.targetSubchannels = data.targetSubchannels ? JSON.stringify(data.targetSubchannels) : null;
    }

    if (data.targetSubchannelsInverted !== undefined) {
      updateData.targetSubchannelsInverted = data.targetSubchannelsInverted;
    }

    if (data.targetUserIds !== undefined) {
      updateData.targetUserIds = data.targetUserIds ?? null;
    }

    if (data.targetUserIdsInverted !== undefined) {
      updateData.targetUserIdsInverted = data.targetUserIdsInverted;
    }

    if (data.displayPriority !== undefined) {
      updateData.displayPriority = data.displayPriority;
    }

    if (data.showOnce !== undefined) {
      updateData.showOnce = data.showOnce;
    }

    if (data.startDate !== undefined) {
      updateData.startDate = data.startDate ? convertToMySQLDateTime(data.startDate) : null;
    }

    if (data.endDate !== undefined) {
      updateData.endDate = data.endDate ? convertToMySQLDateTime(data.endDate) : null;
    }

    updateData.updatedBy = updatedBy;
    updateData.updatedAt = db.fn.now();

    await db('g_ingame_popup_notices')
      .where('id', id)
      .where('environment', environment)
      .update(updateData);

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
        environment: environment
      }
    });

    return notice;
  }

  /**
   * Delete ingame popup notice
   */
  async deleteIngamePopupNotice(id: number, environment: string): Promise<void> {
    await db('g_ingame_popup_notices')
      .where('id', id)
      .where('environment', environment)
      .del();

    // Publish SDK event
    await pubSubService.publishSDKEvent({
      type: 'popup.deleted',
      data: {
        id,
        timestamp: Date.now(),
        environment: environment
      }
    });
  }

  /**
   * Delete multiple ingame popup notices
   */
  async deleteMultipleIngamePopupNotices(ids: number[], environment: string): Promise<void> {
    await db('g_ingame_popup_notices')
      .whereIn('id', ids)
      .where('environment', environment)
      .del();

    // Publish SDK events for each deleted notice
    for (const id of ids) {
      await pubSubService.publishSDKEvent({
        type: 'popup.deleted',
        data: {
          id,
          timestamp: Date.now(),
          environment: environment
        }
      });
    }
  }

  /**
   * Toggle active status
   */
  async toggleActive(id: number, environment: string): Promise<IngamePopupNotice> {
    await db('g_ingame_popup_notices')
      .where('id', id)
      .where('environment', environment)
      .update({
        isActive: db.raw('NOT isActive'),
        updatedAt: db.fn.now()
      });

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
        environment: environment
      }
    });

    return notice;
  }

  /**
   * Format notice for Server SDK response
   * Returns only essential fields for game client
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
      ? row.targetUserIds.split(',').map((id: string) => id.trim()).filter((id: string) => id)
      : [];

    const targetPlatforms = parseArray(row.targetPlatforms);
    const targetChannels = parseArray(row.targetChannels);
    const targetSubchannels = parseArray(row.targetSubchannels);
    const targetWorlds = parseArray(row.targetWorlds);

    // Filter out "channel:*" subchannels if channel-only targeting is used
    const filteredSubchannels = targetSubchannels.filter(subchannel => {
      if (typeof subchannel === 'string' && subchannel.includes(':')) {
        const [channel] = subchannel.split(':');
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

    if (row.startDate) {
      response.startDate = row.startDate;
    }

    if (row.endDate) {
      response.endDate = row.endDate;
    }

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

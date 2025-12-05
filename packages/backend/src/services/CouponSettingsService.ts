import db from '../config/knex';
import { GatrixError } from '../middleware/errorHandler';
import { ulid } from 'ulid';
import { convertToMySQLDateTime } from '../utils/dateUtils';
import { queueService } from './QueueService';
import logger from '../config/logger';
import { generateCouponCode, CodePattern } from '../utils/couponCodeGenerator';
import { getCurrentEnvironmentId } from '../utils/environmentContext';

export type CouponType = 'SPECIAL' | 'NORMAL';
export type CouponStatus = 'ACTIVE' | 'DISABLED' | 'DELETED';
export type UsageLimitType = 'USER' | 'CHARACTER';

export interface CouponSetting {
  id: string;
  environmentId?: string;
  code: string | null;
  type: CouponType;
  name: string;
  description?: string | null;
  tags?: any | null;
  maxTotalUses?: number | null;
  perUserLimit: number;
  usageLimitType?: UsageLimitType;
  rewardTemplateId?: string | null;
  rewardData?: any | null;
  rewardEmailTitle?: string | null;
  rewardEmailBody?: string | null;
  startsAt: string; // MySQL DATETIME
  expiresAt: string; // MySQL DATETIME
  status: CouponStatus;
  codePattern?: CodePattern;
  targetPlatformsInverted?: boolean;
  targetChannelsInverted?: boolean;
  targetWorldsInverted?: boolean;
  createdBy?: number | null;
  updatedBy?: number | null;
}

export interface CreateCouponSettingInput {
  code?: string | null;
  type: CouponType;
  name: string;
  description?: string | null;
  tags?: any | null;
  maxTotalUses?: number | null;
  perUserLimit?: number;
  usageLimitType?: UsageLimitType;
  rewardTemplateId?: string | null;
  rewardData?: any | null;
  rewardEmailTitle?: string | null;
  rewardEmailBody?: string | null;
  startsAt: string | Date;
  expiresAt: string | Date;
  status?: CouponStatus;
  codePattern?: CodePattern; // NORMAL only
  quantity?: number; // NORMAL only
  targetWorlds?: string[] | null;
  targetPlatforms?: string[] | null;
  targetChannels?: string[] | null;
  targetSubchannels?: string[] | null;
  targetUsers?: string[] | null;
  targetPlatformsInverted?: boolean;
  targetChannelsInverted?: boolean;
  targetWorldsInverted?: boolean;
  targetUserIdsInverted?: boolean;
  createdBy?: number | null;
}

export interface UpdateCouponSettingInput extends Partial<CreateCouponSettingInput> {
  updatedBy?: number | null;
}

export interface CouponUsageQuery {
  page?: number;
  limit?: number;
  search?: string; // userId or userName
  platform?: string;
  channel?: string;
  subChannel?: string;
  gameWorldId?: string;
  characterId?: string;
  from?: string | Date;
  to?: string | Date;
}

export class CouponSettingsService {
  // List settings with pagination and filters
  static async listSettings(params: {
    page?: number;
    limit?: number;
    search?: string;
    type?: CouponType;
    status?: CouponStatus;
    environmentId?: string;
  }): Promise<{ settings: any[]; total: number; page: number; limit: number }> {
    const page = params.page || 1;
    const limit = params.limit || 20;
    const offset = (page - 1) * limit;
    const envId = params.environmentId ?? getCurrentEnvironmentId();

    // Build query with environment filter
    const query = db('g_coupon_settings').where('environmentId', envId);

    if (params.type) {
      query.where('type', params.type);
    }
    if (params.status) {
      query.where('status', params.status);
    }
    if (params.search) {
      const pattern = `%${params.search}%`;
      query.where(function () {
        this.where('code', 'like', pattern).orWhere('name', 'like', pattern);
      });
    }

    // Get total count
    const countResult = await query.clone().count('* as total').first();
    const total = Number(countResult?.total || 0);

    // Get paginated settings
    const rows = await query.clone().orderBy('createdAt', 'desc').limit(limit).offset(offset);

    const settings = rows.map((r: any) => ({
      ...r,
      tags: typeof r.tags === 'string' ? JSON.parse(r.tags) : r.tags,
      rewardData: typeof r.rewardData === 'string' ? JSON.parse(r.rewardData) : r.rewardData,
      issuedCount: Number(r.issuedCount || 0),
      usedCount: Number(r.usedCount || 0),
    })) as any[];

    return { settings, total, page, limit };
  }

  // Get single setting with targeting arrays
  static async getSettingById(id: string, environmentId?: string): Promise<any> {
    const envId = environmentId ?? getCurrentEnvironmentId();
    const base = await db('g_coupon_settings').where('id', id).where('environmentId', envId).first();
    if (!base) throw new GatrixError('Coupon setting not found', 404);

    base.tags = typeof base.tags === 'string' ? JSON.parse(base.tags) : base.tags;
    base.rewardData = typeof base.rewardData === 'string' ? JSON.parse(base.rewardData) : base.rewardData;

    const [worlds, platforms, channels, subchannels, users] = await Promise.all([
      db('g_coupon_target_worlds').where('settingId', id).orderBy('gameWorldId', 'asc').select('gameWorldId'),
      db('g_coupon_target_platforms').where('settingId', id).orderBy('platform', 'asc').select('platform'),
      db('g_coupon_target_channels').where('settingId', id).orderBy('channel', 'asc').select('channel'),
      db('g_coupon_target_subchannels').where('settingId', id).orderBy('subchannel', 'asc').select('subchannel'),
      db('g_coupon_target_users').where('settingId', id).orderBy('userId', 'asc').select('userId'),
    ]);

    return {
      ...base,
      targetWorlds: worlds.map((w: any) => w.gameWorldId),
      targetPlatforms: platforms.map((p: any) => p.platform),
      targetChannels: channels.map((c: any) => c.channel),
      targetSubchannels: subchannels.map((s: any) => s.subchannel),
      targetUsers: users.map((u: any) => u.userId),
    };
  }

  // Create new setting
  static async createSetting(input: CreateCouponSettingInput): Promise<any> {
    if (input.rewardTemplateId && input.rewardData) {
      throw new GatrixError('Use either rewardTemplateId or rewardData, not both', 400);
    }

    // Convert dates to MySQL DATETIME
    const startsAt = input.startsAt ? convertToMySQLDateTime(input.startsAt) : null;
    const expiresAt = convertToMySQLDateTime(input.expiresAt);
    if (!expiresAt) throw new GatrixError('Invalid expiration date', 400);

    const id = ulid();

    // Normalize business rules
    const isSpecial = input.type === 'SPECIAL';
    const isNormal = input.type === 'NORMAL';

    if (isSpecial) {
      const code = (input.code || '').trim();
      if (!code || code.length < 4) throw new GatrixError('code must be at least 4 characters for SPECIAL', 400);
    }

    const perUserLimit = isSpecial ? 1 : (input.perUserLimit ?? 1);
    const settingCode = isNormal ? null : (input.code ?? null);
    const maxTotalUses = isNormal ? null : (input.maxTotalUses ?? null);

    const codePattern = isNormal ? (input.codePattern ?? 'ALPHANUMERIC_8') : 'ALPHANUMERIC_8';
    if (isNormal && !['ALPHANUMERIC_8', 'ALPHANUMERIC_16', 'ALPHANUMERIC_16_HYPHEN'].includes(codePattern)) {
      throw new GatrixError('Invalid code pattern', 400);
    }

    const envId = getCurrentEnvironmentId();

    // Insert main row
    await db('g_coupon_settings').insert({
      id,
      environmentId: envId,
      code: settingCode,
      type: input.type,
      name: input.name,
      description: input.description ?? null,
      tags: input.tags ? JSON.stringify(input.tags) : null,
      maxTotalUses,
      perUserLimit,
      usageLimitType: input.usageLimitType ?? 'USER',
      rewardTemplateId: input.rewardTemplateId ?? null,
      rewardData: input.rewardData ? JSON.stringify(input.rewardData) : null,
      rewardEmailTitle: input.rewardEmailTitle ?? null,
      rewardEmailBody: input.rewardEmailBody ?? null,
      startsAt,
      expiresAt,
      status: input.status ?? 'ACTIVE',
      codePattern,
      targetPlatformsInverted: input.targetPlatformsInverted ?? false,
      targetChannelsInverted: input.targetChannelsInverted ?? false,
      targetWorldsInverted: input.targetWorldsInverted ?? false,
      targetUserIdsInverted: input.targetUserIdsInverted ?? false,
      createdBy: input.createdBy ?? null,
    });

    // If NORMAL, handle coupon code generation
    if (isNormal) {
      const quantity = Math.max(1, Number(input.quantity || 1));
      const ASYNC_THRESHOLD = 10000;

      if (quantity < ASYNC_THRESHOLD) {
        await this.generateCouponCodesSynchronous(id, quantity);
      } else {
        await this.generateCouponCodesAsynchronous(id, quantity);
      }
    }

    // Insert targeting arrays
    await this.insertTargets('g_coupon_target_worlds', 'gameWorldId', id, input.targetWorlds);
    await this.insertTargets('g_coupon_target_platforms', 'platform', id, input.targetPlatforms);
    await this.insertTargets('g_coupon_target_channels', 'channel', id, input.targetChannels);
    await this.insertTargetsWithChannel('g_coupon_target_subchannels', 'subchannel', id, input.targetSubchannels);
    await this.insertTargets('g_coupon_target_users', 'userId', id, input.targetUsers);

    return await this.getSettingById(id);
  }

  // Helper to bulk insert targeting arrays
  private static async insertTargets(table: string, column: string, settingId: string, values?: string[] | null): Promise<void> {
    if (!values || values.length === 0) return;
    const BATCH_SIZE = 1000;

    const rows = values.map(v => ({ id: ulid(), settingId, [column]: v }));

    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      await db(table).insert(batch);
    }
  }

  // Helper for subchannels with channel info
  private static async insertTargetsWithChannel(table: string, column: string, settingId: string, values?: string[] | null): Promise<void> {
    if (!values || values.length === 0) return;
    const BATCH_SIZE = 1000;

    const rows = values.map(v => {
      const parts = v.split(':');
      const channel = parts.length === 2 ? parts[0] : '';
      const subchannel = parts.length === 2 ? parts[1] : v;
      return { id: ulid(), settingId, [column]: subchannel, channel };
    });

    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      await db(table).insert(batch);
    }
  }

  // Update existing setting (replace targeting if provided)
  static async updateSetting(id: string, input: UpdateCouponSettingInput, environmentId?: string): Promise<any> {
    const envId = environmentId ?? getCurrentEnvironmentId();
    // Ensure exists
    await this.getSettingById(id, envId);

    if (input.rewardTemplateId && input.rewardData) {
      throw new GatrixError('Use either rewardTemplateId or rewardData, not both', 400);
    }

    const updates: Record<string, any> = {};

    if (input.code !== undefined) updates.code = input.code;
    if (input.type !== undefined) updates.type = input.type;
    if (input.name !== undefined) updates.name = input.name;
    if (input.description !== undefined) updates.description = input.description;
    if (input.tags !== undefined) updates.tags = input.tags ? JSON.stringify(input.tags) : null;
    if (input.maxTotalUses !== undefined) updates.maxTotalUses = input.maxTotalUses;
    if (input.perUserLimit !== undefined) updates.perUserLimit = input.perUserLimit;
    if (input.usageLimitType !== undefined) updates.usageLimitType = input.usageLimitType;
    if (input.rewardTemplateId !== undefined) updates.rewardTemplateId = input.rewardTemplateId;
    if (input.rewardData !== undefined) updates.rewardData = input.rewardData ? JSON.stringify(input.rewardData) : null;
    if (input.rewardEmailTitle !== undefined) updates.rewardEmailTitle = input.rewardEmailTitle;
    if (input.rewardEmailBody !== undefined) updates.rewardEmailBody = input.rewardEmailBody;

    if (input.startsAt !== undefined) {
      if (input.startsAt === null) {
        updates.startsAt = null;
      } else {
        const v = convertToMySQLDateTime(input.startsAt);
        if (!v) throw new GatrixError('Invalid startsAt', 400);
        updates.startsAt = v;
      }
    }
    if (input.expiresAt !== undefined) {
      const v = convertToMySQLDateTime(input.expiresAt);
      if (!v) throw new GatrixError('Invalid expiresAt', 400);
      updates.expiresAt = v;
    }
    if (input.status !== undefined) updates.status = input.status;
    if (input.targetPlatformsInverted !== undefined) updates.targetPlatformsInverted = input.targetPlatformsInverted;
    if (input.targetChannelsInverted !== undefined) updates.targetChannelsInverted = input.targetChannelsInverted;
    if (input.targetWorldsInverted !== undefined) updates.targetWorldsInverted = input.targetWorldsInverted;
    if (input.updatedBy !== undefined) updates.updatedBy = input.updatedBy;

    if (Object.keys(updates).length > 0) {
      await db('g_coupon_settings').where('id', id).where('environmentId', envId).update(updates);
    }

    // Replace targeting if provided
    await this.replaceTargets('g_coupon_target_worlds', 'gameWorldId', id, input.targetWorlds);
    await this.replaceTargets('g_coupon_target_platforms', 'platform', id, input.targetPlatforms);
    await this.replaceTargets('g_coupon_target_channels', 'channel', id, input.targetChannels);
    await this.replaceTargetsWithChannel('g_coupon_target_subchannels', 'subchannel', id, input.targetSubchannels);
    await this.replaceTargets('g_coupon_target_users', 'userId', id, input.targetUsers);

    return await this.getSettingById(id, envId);
  }

  // Helper to replace targeting arrays
  private static async replaceTargets(table: string, column: string, settingId: string, values?: string[] | null): Promise<void> {
    if (values === undefined) return; // not provided
    await db(table).where('settingId', settingId).delete();
    if (!values || values.length === 0) return;
    await this.insertTargets(table, column, settingId, values);
  }

  // Helper to replace subchannels with channel info
  private static async replaceTargetsWithChannel(table: string, column: string, settingId: string, values?: string[] | null): Promise<void> {
    if (values === undefined) return;
    await db(table).where('settingId', settingId).delete();
    if (!values || values.length === 0) return;
    await this.insertTargetsWithChannel(table, column, settingId, values);
  }

  // Soft delete setting
  static async deleteSetting(id: string, environmentId?: string): Promise<void> {
    const envId = environmentId ?? getCurrentEnvironmentId();
    const setting = await db('g_coupon_settings')
      .where('id', id)
      .where('environmentId', envId)
      .select('generationJobId', 'generationStatus')
      .first();

    if (!setting) throw new GatrixError('Coupon setting not found', 404);

    // Cancel BullMQ job if it's in progress
    if (setting.generationJobId && (setting.generationStatus === 'IN_PROGRESS' || setting.generationStatus === 'PENDING')) {
      try {
        const queue = queueService.getQueue('coupon-generation');
        if (queue) {
          const job = await queue.getJob(setting.generationJobId);
          if (job) {
            await job.remove();
            logger.info('Cancelled coupon generation job', { jobId: setting.generationJobId, settingId: id });
          }
        }
      } catch (error) {
        logger.error('Failed to cancel coupon generation job', { jobId: setting.generationJobId, settingId: id, error });
      }
    }

    // Update status to DELETED and reset cache
    const affectedRows = await db('g_coupon_settings')
      .where('id', id)
      .where('environmentId', envId)
      .update({ status: 'DELETED', generationStatus: 'FAILED', issuedCount: 0, usedCount: 0 });

    if (affectedRows === 0) throw new GatrixError('Coupon setting not found', 404);
  }

  /**
   * Disable expired coupons (status ACTIVE and expiresAt < NOW())
   * Returns number of affected rows.
   */
  static async disableExpiredCoupons(): Promise<number> {
    const affectedRows = await db('g_coupon_settings')
      .where('status', 'ACTIVE')
      .where('expiresAt', '<', db.fn.now())
      .update({
        status: 'DISABLED',
        disabledBy: db.raw("COALESCE(disabledBy, 'system')"),
        disabledAt: db.fn.now(),
        disabledReason: db.raw("COALESCE(disabledReason, 'Expired by scheduler')"),
      });
    return affectedRows || 0;
  }

  // Usage listing by setting (or all settings if id is not provided)
  static async getUsageBySetting(id: string | undefined, query: CouponUsageQuery, environmentId?: string) {
    const envId = environmentId ?? getCurrentEnvironmentId();
    // If id is provided, ensure setting exists
    if (id) {
      await this.getSettingById(id, envId);
    }

    const page = query.page || 1;
    const limit = query.limit || 20;
    const offset = (page - 1) * limit;

    // Build base query
    const buildQuery = () => {
      const q = db('g_coupon_uses as cu')
        .leftJoin('g_coupon_settings as cs', 'cu.settingId', 'cs.id')
        .leftJoin('g_coupons as c', 'cu.issuedCouponId', 'c.id');

      if (id) q.where('cu.settingId', id);
      if (query.search) {
        const pattern = `%${query.search}%`;
        q.where(function () {
          this.where('cu.userId', 'like', pattern).orWhere('cu.userName', 'like', pattern);
        });
      }
      if (query.platform) q.where('cu.platform', query.platform);
      if (query.channel) q.where('cu.channel', query.channel);
      if (query.subChannel) q.where('cu.subchannel', query.subChannel);
      if (query.gameWorldId) q.where('cu.gameWorldId', query.gameWorldId);
      if ((query as any).characterId) q.where('cu.characterId', (query as any).characterId);
      if (query.from) q.where('cu.usedAt', '>=', convertToMySQLDateTime(query.from));
      if (query.to) q.where('cu.usedAt', '<=', convertToMySQLDateTime(query.to));

      return q;
    };

    // Get total count
    const countResult = await buildQuery().count('* as total').first();
    const total = Number(countResult?.total || 0);

    // Get records
    const rows = await buildQuery()
      .select([
        'cu.id', 'cu.settingId', 'cu.issuedCouponId', 'cu.userId', 'cu.characterId',
        'cu.userName', 'cu.sequence', 'cu.usedAt', 'cu.userIp', 'cu.gameWorldId',
        'cu.platform', 'cu.channel', 'cu.subchannel',
        'cs.name as couponName',
        db.raw('COALESCE(c.code, cs.code) as couponCode'),
        'cs.startsAt as couponStartsAt',
        'cs.expiresAt as couponExpiresAt',
      ])
      .orderBy('cu.usedAt', 'desc')
      .limit(limit)
      .offset(offset);

    if (rows.length > 0) {
      logger.info('[CouponUsage] Sample record:', {
        id: rows[0].id,
        userId: rows[0].userId,
        platform: rows[0].platform,
        channel: rows[0].channel,
        subchannel: rows[0].subchannel,
        couponName: rows[0].couponName,
      });
    }

    return { records: rows, total, page, limit };
  }

  /**
   * Get coupon usage records for export (all records without pagination)
   */
  static async getUsageForExport(query: CouponUsageQuery = {}): Promise<any[]> {
    const q = db('g_coupon_uses as cu')
      .leftJoin('g_coupon_settings as cs', 'cu.settingId', 'cs.id')
      .leftJoin('g_coupons as c', 'cu.issuedCouponId', 'c.id')
      .select([
        'cu.id', 'cu.userId', 'cu.userName', 'cu.characterId', 'cu.sequence',
        'cu.usedAt', 'cu.gameWorldId', 'cu.platform', 'cu.channel', 'cu.subchannel',
        'cs.name as couponName',
        db.raw('COALESCE(c.code, cs.code) as couponCode'),
        'cs.startsAt as couponStartsAt',
        'cs.expiresAt as couponExpiresAt',
      ])
      .orderBy('cu.usedAt', 'desc');

    if ((query as any).settingId) q.where('cu.settingId', (query as any).settingId);
    if ((query as any).couponCode) q.whereRaw('COALESCE(c.code, cs.code) = ?', [(query as any).couponCode]);
    if (query.platform) q.where('cu.platform', query.platform);
    if (query.channel) q.where('cu.channel', query.channel);
    if (query.subChannel) q.where('cu.subchannel', query.subChannel);
    if (query.gameWorldId) q.where('cu.gameWorldId', query.gameWorldId);
    if ((query as any).characterId) q.where('cu.characterId', (query as any).characterId);
    if (query.from) q.where('cu.usedAt', '>=', convertToMySQLDateTime(query.from));
    if (query.to) q.where('cu.usedAt', '<=', convertToMySQLDateTime(query.to));

    return await q;
  }

  /**
   * Get coupon usage records for export with pagination (chunked)
   * Returns records in chunks for streaming/pagination
   */
  static async getUsageForExportChunked(query: CouponUsageQuery & { offset?: number; limit?: number } = {}) {
    const offset = query.offset || 0;
    const limit = Math.min(query.limit || 1000, 10000);

    const buildQuery = () => {
      const q = db('g_coupon_uses as cu')
        .leftJoin('g_coupon_settings as cs', 'cu.settingId', 'cs.id')
        .leftJoin('g_coupons as c', 'cu.issuedCouponId', 'c.id');

      if ((query as any).settingId) q.where('cu.settingId', (query as any).settingId);
      if ((query as any).couponCode) q.whereRaw('COALESCE(c.code, cs.code) = ?', [(query as any).couponCode]);
      if (query.platform) q.where('cu.platform', query.platform);
      if (query.channel) q.where('cu.channel', query.channel);
      if (query.subChannel) q.where('cu.subchannel', query.subChannel);
      if (query.gameWorldId) q.where('cu.gameWorldId', query.gameWorldId);
      if ((query as any).characterId) q.where('cu.characterId', (query as any).characterId);
      if (query.from) q.where('cu.usedAt', '>=', convertToMySQLDateTime(query.from));
      if (query.to) q.where('cu.usedAt', '<=', convertToMySQLDateTime(query.to));

      return q;
    };

    const countResult = await buildQuery().count('* as total').first();
    const total = Number(countResult?.total || 0);

    const rows = await buildQuery()
      .select([
        'cu.id', 'cu.userId', 'cu.userName', 'cu.characterId', 'cu.sequence',
        'cu.usedAt', 'cu.gameWorldId', 'cu.platform', 'cu.channel', 'cu.subchannel',
        'cs.name as couponName',
        db.raw('COALESCE(c.code, cs.code) as couponCode'),
        'cs.startsAt as couponStartsAt',
        'cs.expiresAt as couponExpiresAt',
      ])
      .orderBy('cu.usedAt', 'desc')
      .limit(limit)
      .offset(offset);

    return { records: rows, total, offset, limit, hasMore: offset + limit < total };
  }

  /**
   * Get status statistics for issued coupon codes (optimized with direct query)
   */
  static async getIssuedCodesStats(settingId: string): Promise<{ issued: number; used: number; unused: number }> {
    const row = await db('g_coupon_settings')
      .where('id', settingId)
      .whereNot('status', 'DELETED')
      .select('issuedCount', 'usedCount')
      .first();

    if (!row) {
      throw new GatrixError('Coupon setting not found', 404);
    }

    const issued = Number(row.issuedCount || 0);
    const used = Number(row.usedCount || 0);
    const unused = issued - used;

    logger.debug(`[CouponStats] settingId=${settingId}, issued=${issued}, used=${used}, unused=${unused}`);

    return { issued, used, unused };
  }

  /**
   * Get all issued coupon codes for export (with optional search filter)
   * Returns codes in chunks for streaming/pagination
   */
  static async getIssuedCodesForExport(settingId: string, query: { search?: string; offset?: number; limit?: number } = {}) {
    await this.getSettingById(settingId);

    const offset = query.offset || 0;
    const limit = Math.min(query.limit || 1000, 10000);

    const buildQuery = () => {
      const q = db('g_coupons').where('settingId', settingId);
      if (query.search) q.where('code', 'like', `%${query.search}%`);
      return q;
    };

    const countResult = await buildQuery().count('* as total').first();
    const total = Number(countResult?.total || 0);

    const codes = await buildQuery()
      .select('id', 'settingId', 'code', 'status', 'createdAt', 'usedAt')
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .offset(offset);

    return { codes, total, offset, limit, hasMore: offset + limit < total };
  }

  /**
   * List issued coupon codes for a specific setting with pagination and optional search
   */
  static async getIssuedCodes(settingId: string, query: { page?: number; limit?: number; search?: string }) {
    const startTime = Date.now();
    const page = query.page || 1;
    const limit = query.limit || 20;
    const offset = (page - 1) * limit;

    let total: number;
    if (!query.search) {
      // Use cached count from g_coupon_settings if no search filter
      const setting = await db('g_coupon_settings')
        .where('id', settingId)
        .whereNot('status', 'DELETED')
        .select('issuedCount')
        .first();

      if (!setting) {
        throw new GatrixError('Coupon setting not found', 404);
      }

      total = Number(setting.issuedCount || 0);
      logger.debug(`[getIssuedCodes] Cache hit: total=${total}, time=${Date.now() - startTime}ms`);
    } else {
      const countResult = await db('g_coupons')
        .where('settingId', settingId)
        .where('code', 'like', `%${query.search}%`)
        .count('* as total')
        .first();
      total = Number(countResult?.total || 0);
    }

    const codesQuery = db('g_coupons')
      .where('settingId', settingId)
      .select('id', 'settingId', 'code', 'status', 'createdAt', 'usedAt')
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .offset(offset);

    if (query.search) {
      codesQuery.where('code', 'like', `%${query.search}%`);
    }

    const codes = await codesQuery;
    logger.debug(`[getIssuedCodes] Data query: rows=${codes.length}, offset=${offset}, time=${Date.now() - startTime}ms`);

    return { codes, total, page, limit };
  }

  /**
   * Get generation status for async coupon code generation
   */
  static async getGenerationStatus(settingId: string): Promise<any> {
    const row = await db('g_coupon_settings')
      .where('id', settingId)
      .select('generationStatus', 'generatedCount', 'totalCount')
      .first();

    if (!row) throw new GatrixError('Coupon setting not found', 404);

    return {
      status: row.generationStatus || 'COMPLETED',
      generatedCount: row.generatedCount || 0,
      totalCount: row.totalCount || 0,
      progress: row.totalCount > 0 ? Math.round((row.generatedCount / row.totalCount) * 100) : 0,
    };
  }

  /**
   * Recalculate and verify cache consistency for all coupon settings
   * Returns list of settings with cache mismatches
   */
  static async recalculateCacheForAll(): Promise<any[]> {
    try {
      // Get all settings with their actual counts
      const results = await db.raw(`
        SELECT
          cs.id,
          cs.issuedCount as cached_issued,
          COALESCE(c.actual_issued, 0) as actual_issued,
          cs.usedCount as cached_used,
          COALESCE(cu.actual_used, 0) as actual_used
        FROM g_coupon_settings cs
        LEFT JOIN (
          SELECT settingId, COUNT(*) as actual_issued
          FROM g_coupons
          GROUP BY settingId
        ) c ON cs.id = c.settingId
        LEFT JOIN (
          SELECT settingId, COUNT(*) as actual_used
          FROM g_coupon_uses
          GROUP BY settingId
        ) cu ON cs.id = cu.settingId
      `);

      const rows = results[0] || [];
      const mismatches: any[] = [];

      for (const row of rows) {
        if (row.cached_issued !== row.actual_issued || row.cached_used !== row.actual_used) {
          mismatches.push({
            settingId: row.id,
            cached_issued: row.cached_issued,
            actual_issued: row.actual_issued,
            cached_used: row.cached_used,
            actual_used: row.actual_used,
          });

          await db('g_coupon_settings')
            .where('id', row.id)
            .update({ issuedCount: row.actual_issued, usedCount: row.actual_used });
        }
      }

      if (mismatches.length > 0) {
        logger.warn('Cache mismatches found and fixed', { count: mismatches.length, mismatches });
      }

      return mismatches;
    } catch (error) {
      logger.error('Failed to recalculate cache', { error });
      throw new GatrixError('Failed to recalculate cache', 500);
    }
  }

  /**
   * Recalculate cache for a specific coupon setting
   */
  static async recalculateCacheForSetting(settingId: string): Promise<{ issued: number; used: number }> {
    try {
      const issuedResult = await db('g_coupons').where('settingId', settingId).count('* as count').first();
      const issuedCount = Number(issuedResult?.count || 0);

      const usedResult = await db('g_coupon_uses').where('settingId', settingId).count('* as count').first();
      const usedCount = Number(usedResult?.count || 0);

      await db('g_coupon_settings')
        .where('id', settingId)
        .update({ issuedCount, usedCount });

      logger.info('Cache recalculated for setting', { settingId, issuedCount, usedCount });

      return { issued: issuedCount, used: usedCount };
    } catch (error) {
      logger.error('Failed to recalculate cache for setting', { settingId, error });
      throw new GatrixError('Failed to recalculate cache', 500);
    }
  }

  /**
   * Generate coupon codes synchronously (for small quantities)
   */
  private static async generateCouponCodesSynchronous(settingId: string, quantity: number): Promise<void> {
    const BATCH_SIZE = 1000;
    const DUPLICATE_CHECK_BATCH = 100;
    const localSet = new Set<string>();

    // Get codePattern and environmentId from settings
    const setting = await db('g_coupon_settings').where('id', settingId).select('codePattern', 'environmentId').first();
    const codePattern = (setting?.codePattern || 'ALPHANUMERIC_8') as CodePattern;
    const environmentId = setting?.environmentId;

    if (!environmentId) {
      throw new GatrixError('Setting not found or missing environmentId', 404);
    }

    const codes: Array<{ id: string; settingId: string; code: string; environmentId: string }> = [];

    // Generate all codes
    for (let i = 0; i < quantity; i++) {
      let code: string = '';
      let found = false;

      // Try to find a unique code
      for (let attempt = 0; attempt < 10; attempt++) {
        code = generateCouponCode(codePattern);
        if (localSet.has(code)) continue;

        // Check database for duplicates in batches
        if (i % DUPLICATE_CHECK_BATCH === 0) {
          const dup = await db('g_coupons').where('code', code).select(db.raw('1 as ok')).first();
          if (!dup) {
            found = true;
            break;
          }
        } else {
          found = true;
          break;
        }
      }

      if (!found) {
        logger.warn('Failed to generate unique code after 10 attempts', { settingId, attempt: i });
        continue;
      }

      localSet.add(code);
      codes.push({ id: ulid(), settingId, code, environmentId });
    }

    // Insert codes in batches
    if (codes.length > 0) {
      for (let i = 0; i < codes.length; i += BATCH_SIZE) {
        const batch = codes.slice(i, i + BATCH_SIZE);
        await db('g_coupons').insert(batch);
      }

      // Update issuedCount cache
      await db('g_coupon_settings').where('id', settingId).update({ issuedCount: codes.length });
    }
  }

  /**
   * Generate coupon codes asynchronously (for large quantities)
   * Enqueues a BullMQ job and returns immediately
   */
  private static async generateCouponCodesAsynchronous(settingId: string, quantity: number): Promise<void> {
    try {
      // Update status to PENDING
      await db('g_coupon_settings')
        .where('id', settingId)
        .update({ generationStatus: 'PENDING', totalCount: quantity });

      // Create queue if not exists
      const queueName = 'coupon-generation';
      if (!queueService.getQueue(queueName)) {
        const { CouponGenerationJob } = await import('./jobs/CouponGenerationJob');
        await queueService.createQueue(queueName, async (job: any) => {
          await CouponGenerationJob.process(job);
        }, {
          concurrency: 1,
          removeOnComplete: 100,
          removeOnFail: 50,
        });
      }

      // Enqueue job
      const job = await queueService.addJob(queueName, 'generate-codes', {
        settingId,
        quantity,
      });

      if (job) {
        logger.info('Coupon generation job enqueued', { jobId: job.id, settingId, quantity });
      }
    } catch (error) {
      logger.error('Failed to enqueue coupon generation job', { settingId, quantity, error });
      throw new GatrixError('Failed to enqueue coupon generation job', 500);
    }
  }
}


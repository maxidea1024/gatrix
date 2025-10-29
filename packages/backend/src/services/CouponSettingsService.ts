import database from '../config/database';
import { CustomError } from '../middleware/errorHandler';
import { ulid } from 'ulid';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { convertToMySQLDateTime } from '../utils/dateUtils';
import { queueService } from './QueueService';
import logger from '../config/logger';

export type CouponType = 'SPECIAL' | 'NORMAL';
export type CouponStatus = 'ACTIVE' | 'DISABLED' | 'DELETED';

export interface CouponSetting {
  id: string;
  code: string | null;
  type: CouponType;
  name: string;
  description?: string | null;
  tags?: any | null;
  maxTotalUses?: number | null;
  perUserLimit: number;
  rewardTemplateId?: string | null;
  rewardData?: any | null;
  rewardEmailTitle?: string | null;
  rewardEmailBody?: string | null;
  startsAt: string; // MySQL DATETIME
  expiresAt: string; // MySQL DATETIME
  status: CouponStatus;
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
  rewardTemplateId?: string | null;
  rewardData?: any | null;
  rewardEmailTitle?: string | null;
  rewardEmailBody?: string | null;
  startsAt: string | Date;
  expiresAt: string | Date;
  status?: CouponStatus;
  quantity?: number; // NORMAL only
  targetWorlds?: string[] | null;
  targetPlatforms?: string[] | null;
  targetChannels?: string[] | null;
  targetSubchannels?: string[] | null;
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
  gameWorldId?: string;
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
  }): Promise<{ settings: any[]; total: number; page: number; limit: number }>{
    const pool = database.getPool();
    const page = params.page || 1;
    const limit = params.limit || 20;
    const offset = (page - 1) * limit;

    const where: string[] = [];
    const args: any[] = [];

    if (params.type) {
      where.push('type = ?');
      args.push(params.type);
    }
    if (params.status) {
      where.push('status = ?');
      args.push(params.status);
    }
    if (params.search) {
      where.push('(code LIKE ? OR nameKey LIKE ?)');
      const pattern = `%${params.search}%`;
      args.push(pattern, pattern);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    // Get total count
    const [countRows] = await pool.execute<RowDataPacket[]>(
      `SELECT COUNT(*) as total FROM g_coupon_settings ${whereSql}`,
      args
    );
    const total = Number(countRows[0].total || 0);

    // Get paginated settings (use cached count columns)
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT * FROM g_coupon_settings ${whereSql} ORDER BY createdAt DESC LIMIT ${limit} OFFSET ${offset}`,
      args
    );

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
  static async getSettingById(id: string): Promise<any> {
    const pool = database.getPool();

    const [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT * FROM g_coupon_settings WHERE id = ?',
      [id]
    );
    if (rows.length === 0) throw new CustomError('Coupon setting not found', 404);

    const base: any = rows[0];
    base.tags = typeof base.tags === 'string' ? JSON.parse(base.tags) : base.tags;
    base.rewardData = typeof base.rewardData === 'string' ? JSON.parse(base.rewardData) : base.rewardData;

    const [worlds] = await pool.execute<RowDataPacket[]>(
      'SELECT gameWorldId FROM g_coupon_target_worlds WHERE settingId = ? ORDER BY gameWorldId ASC',
      [id]
    );
    const [platforms] = await pool.execute<RowDataPacket[]>(
      'SELECT platform FROM g_coupon_target_platforms WHERE settingId = ? ORDER BY platform ASC',
      [id]
    );
    const [channels] = await pool.execute<RowDataPacket[]>(
      'SELECT channel FROM g_coupon_target_channels WHERE settingId = ? ORDER BY channel ASC',
      [id]
    );
    const [subchannels] = await pool.execute<RowDataPacket[]>(
      'SELECT subchannel FROM g_coupon_target_subchannels WHERE settingId = ? ORDER BY subchannel ASC',
      [id]
    );

    return {
      ...base,
      targetWorlds: worlds.map(w => w.gameWorldId),
      targetPlatforms: platforms.map(p => p.platform),
      targetChannels: channels.map(c => c.channel),
      targetSubchannels: subchannels.map(s => s.subchannel),
    };
  }

  // Create new setting
  static async createSetting(input: CreateCouponSettingInput): Promise<any> {
    const pool = database.getPool();

    if (input.rewardTemplateId && input.rewardData) {
      throw new CustomError('Use either rewardTemplateId or rewardData, not both', 400);
    }

    // Convert dates to MySQL DATETIME
    const startsAt = convertToMySQLDateTime(input.startsAt);
    const expiresAt = convertToMySQLDateTime(input.expiresAt);
    if (!startsAt || !expiresAt) throw new CustomError('Invalid date range', 400);

    const id = ulid();

    // Normalize business rules
    const isSpecial = input.type === 'SPECIAL';
    const isNormal = input.type === 'NORMAL';

    if (isSpecial) {
      // SPECIAL: code must be >= 4
      const code = (input.code || '').trim();
      if (!code || code.length < 4) throw new CustomError('code must be at least 4 characters for SPECIAL', 400);
    }

    // SPECIAL: perUserLimit forced to 1; NORMAL: ignore maxTotalUses
    const perUserLimit = isSpecial ? 1 : (input.perUserLimit ?? 1);
    const settingCode = isNormal ? null : (input.code ?? null);
    const maxTotalUses = isNormal ? null : (input.maxTotalUses ?? null);

    // Insert main row
    await pool.execute(
      `INSERT INTO g_coupon_settings
       (id, code, type, name, description, tags, maxTotalUses, perUserLimit, rewardTemplateId, rewardData,
        rewardEmailTitle, rewardEmailBody, startsAt, expiresAt, status, createdBy)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        settingCode,
        input.type,
        input.name,
        input.description ?? null,
        input.tags ? JSON.stringify(input.tags) : null,
        maxTotalUses,
        perUserLimit,
        input.rewardTemplateId ?? null,
        input.rewardData ? JSON.stringify(input.rewardData) : null,
        input.rewardEmailTitle ?? null,
        input.rewardEmailBody ?? null,
        startsAt,
        expiresAt,
        input.status ?? 'ACTIVE',
        input.createdBy ?? null,
      ]
    );

    // Helper to bulk insert targeting arrays
    // If NORMAL, handle coupon code generation (sync or async based on quantity)
    if (isNormal) {
      const quantity = Math.max(1, Number(input.quantity || 1));
      const ASYNC_THRESHOLD = 10000; // Use async for quantities >= 10,000

      if (quantity < ASYNC_THRESHOLD) {
        // Synchronous processing for small quantities
        await this.generateCouponCodesSynchronous(id, quantity);
      } else {
        // Asynchronous processing for large quantities
        await this.generateCouponCodesAsynchronous(id, quantity);
      }
    }

    const insertTargets = async (table: string, column: string, values?: string[] | null) => {
      if (!values || values.length === 0) return;
      const BATCH_SIZE = 1000; // Batch size to avoid MySQL prepared statement placeholder limit
      const rows = values.map(v => [ulid(), id, v]);

      // Insert in batches
      for (let i = 0; i < rows.length; i += BATCH_SIZE) {
        const batch = rows.slice(i, i + BATCH_SIZE);
        const placeholders = batch.map(() => '(?, ?, ?)').join(',');
        await pool.execute(
          `INSERT INTO ${table} (id, settingId, ${column}) VALUES ${placeholders}`,
          batch.flat()
        );
      }
    };

    await insertTargets('g_coupon_target_worlds', 'gameWorldId', input.targetWorlds);
    await insertTargets('g_coupon_target_platforms', 'platform', input.targetPlatforms);
    await insertTargets('g_coupon_target_channels', 'channel', input.targetChannels);
    await insertTargets('g_coupon_target_subchannels', 'subchannel', input.targetSubchannels);

    return await this.getSettingById(id);
  }

  // Update existing setting (replace targeting if provided)
  static async updateSetting(id: string, input: UpdateCouponSettingInput): Promise<any> {
    const pool = database.getPool();

    // Ensure exists
    await this.getSettingById(id);

    if (input.rewardTemplateId && input.rewardData) {
      throw new CustomError('Use either rewardTemplateId or rewardData, not both', 400);
    }

    const updates: string[] = [];
    const values: any[] = [];

    const add = (sql: string, v: any) => { updates.push(sql); values.push(v); };

    if (input.code !== undefined) add('code = ?', input.code);
    if (input.type !== undefined) add('type = ?', input.type);
    if (input.name !== undefined) add('name = ?', input.name);
    if (input.description !== undefined) add('description = ?', input.description);
    if (input.tags !== undefined) add('tags = ?', input.tags ? JSON.stringify(input.tags) : null);
    if (input.maxTotalUses !== undefined) add('maxTotalUses = ?', input.maxTotalUses);
    if (input.perUserLimit !== undefined) add('perUserLimit = ?', input.perUserLimit);
    if (input.rewardTemplateId !== undefined) add('rewardTemplateId = ?', input.rewardTemplateId);
    if (input.rewardData !== undefined) add('rewardData = ?', input.rewardData ? JSON.stringify(input.rewardData) : null);
    if (input.rewardEmailTitle !== undefined) add('rewardEmailTitle = ?', input.rewardEmailTitle);
    if (input.rewardEmailBody !== undefined) add('rewardEmailBody = ?', input.rewardEmailBody);

    if (input.startsAt !== undefined) {
      const v = convertToMySQLDateTime(input.startsAt);
      if (!v) throw new CustomError('Invalid startsAt', 400);
      add('startsAt = ?', v);
    }
    if (input.expiresAt !== undefined) {
      const v = convertToMySQLDateTime(input.expiresAt);
      if (!v) throw new CustomError('Invalid expiresAt', 400);
      add('expiresAt = ?', v);
    }
    if (input.status !== undefined) add('status = ?', input.status);
    if (input.updatedBy !== undefined) add('updatedBy = ?', input.updatedBy);

    if (updates.length) {
      values.push(id);
      await pool.execute(
        `UPDATE g_coupon_settings SET ${updates.join(', ')} WHERE id = ?`,
        values
      );
    }

    // Replace targeting if provided
    const replaceTargets = async (table: string, column: string, values?: string[] | null) => {
      if (values === undefined) return; // not provided
      await pool.execute(`DELETE FROM ${table} WHERE settingId = ?`, [id]);
      if (!values || values.length === 0) return;
      const rows = values.map(v => [ulid(), id, v]);
      const placeholders = rows.map(() => '(?, ?, ?)').join(',');
      await pool.execute(
        `INSERT INTO ${table} (id, settingId, ${column}) VALUES ${placeholders}`,
        rows.flat()
      );
    };

    await replaceTargets('g_coupon_target_worlds', 'gameWorldId', input.targetWorlds);
    await replaceTargets('g_coupon_target_platforms', 'platform', input.targetPlatforms);
    await replaceTargets('g_coupon_target_channels', 'channel', input.targetChannels);
    await replaceTargets('g_coupon_target_subchannels', 'subchannel', input.targetSubchannels);

    return await this.getSettingById(id);
  }

  // Soft delete setting
  static async deleteSetting(id: string): Promise<void> {
    const pool = database.getPool();

    // Get the setting to check if there's an active generation job
    const [settingRows] = await pool.execute<RowDataPacket[]>(
      `SELECT generationJobId, generationStatus FROM g_coupon_settings WHERE id = ?`,
      [id]
    );

    if (settingRows.length === 0) throw new CustomError('Coupon setting not found', 404);

    const setting = settingRows[0] as any;

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
        // Continue with deletion even if job cancellation fails
      }
    }

    // Update status to DELETED and reset cache
    const [res] = await pool.execute<ResultSetHeader>(
      `UPDATE g_coupon_settings SET status = 'DELETED', generationStatus = 'FAILED', issuedCount = 0, usedCount = 0 WHERE id = ?`,
      [id]
    );
    if (res.affectedRows === 0) throw new CustomError('Coupon setting not found', 404);
  }

  /**
   * Disable expired coupons (status ACTIVE and expiresAt < NOW())
   * Returns number of affected rows.
   */
  static async disableExpiredCoupons(): Promise<number> {
    const pool = database.getPool();
    const [res] = await pool.execute<ResultSetHeader>(
      `UPDATE g_coupon_settings
       SET status = 'DISABLED',
           disabledBy = COALESCE(disabledBy, 'system'),
           disabledAt = NOW(),
           disabledReason = COALESCE(disabledReason, 'Expired by scheduler')
       WHERE status = 'ACTIVE' AND expiresAt < NOW()`
    );
    return (res as ResultSetHeader).affectedRows || 0;
  }

  // Usage listing by setting
  static async getUsageBySetting(id: string, query: CouponUsageQuery) {
    const pool = database.getPool();

    // Ensure setting exists
    const setting = await this.getSettingById(id);

    const page = query.page || 1;
    const limit = query.limit || 20;
    const offset = (page - 1) * limit;

    const where: string[] = ['settingId = ?'];
    const args: any[] = [id];

    // Track if any filters are applied
    const hasFilters = query.search || query.platform || query.gameWorldId || query.from || query.to;

    if (query.search) {
      where.push('(userId LIKE ? OR userName LIKE ?)');
      const pattern = `%${query.search}%`;
      args.push(pattern, pattern);
    }
    if (query.platform) {
      where.push('platform = ?');
      args.push(query.platform);
    }
    if (query.gameWorldId) {
      where.push('gameWorldId = ?');
      args.push(query.gameWorldId);
    }
    if (query.from) {
      where.push('usedAt >= ?');
      args.push(convertToMySQLDateTime(query.from));
    }
    if (query.to) {
      where.push('usedAt <= ?');
      args.push(convertToMySQLDateTime(query.to));
    }

    const whereSql = `WHERE ${where.join(' AND ')}`;

    // Use cached count if no filters applied
    let total: number;
    if (!hasFilters) {
      total = Number(setting.usedCount || 0);
    } else {
      const [countRows] = await pool.execute<RowDataPacket[]>(
        `SELECT COUNT(*) as total FROM g_coupon_uses ${whereSql}`,
        args
      );
      total = Number(countRows[0].total || 0);
    }

    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT * FROM g_coupon_uses ${whereSql} ORDER BY usedAt DESC LIMIT ${limit} OFFSET ${offset}`,
      args
    );

    return { records: rows, total, page, limit };
  }

  /**
   * Get status statistics for issued coupon codes (optimized with direct query)
   */
  static async getIssuedCodesStats(settingId: string): Promise<{ issued: number; used: number; unused: number }> {
    const pool = database.getPool();

    // Direct query to get only the cached counts (no full setting fetch)
    const [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT issuedCount, usedCount FROM g_coupon_settings WHERE id = ? AND status != ?',
      [settingId, 'DELETED']
    );

    if (rows.length === 0) {
      throw new CustomError('Coupon setting not found', 404);
    }

    const row = rows[0] as any;
    const issued = Number(row.issuedCount || 0);
    const used = Number(row.usedCount || 0);
    const unused = issued - used;

    console.log(`[CouponStats] settingId=${settingId}, issued=${issued}, used=${used}, unused=${unused}`);

    return { issued, used, unused };
  }

  /**
   * Get all issued coupon codes for export (with optional search filter)
   * Returns codes in chunks for streaming/pagination
   */
  static async getIssuedCodesForExport(settingId: string, query: { search?: string; offset?: number; limit?: number } = {}) {
    const pool = database.getPool();

    // Ensure setting exists
    await this.getSettingById(settingId);

    const offset = query.offset || 0;
    const limit = Math.min(query.limit || 1000, 10000); // Max 10000 per request

    const where: string[] = ['settingId = ?'];
    const args: any[] = [settingId];

    if (query.search) {
      where.push('code LIKE ?');
      args.push(`%${query.search}%`);
    }

    const whereSql = `WHERE ${where.join(' AND ')}`;

    // Get total count
    const [countRows] = await pool.execute<RowDataPacket[]>(
      `SELECT COUNT(*) as total FROM g_coupons ${whereSql}`,
      args
    );
    const total = Number(countRows[0].total || 0);

    // Get codes
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT id, settingId, code, status, createdAt, usedAt FROM g_coupons ${whereSql} ORDER BY createdAt DESC LIMIT ${limit} OFFSET ${offset}`,
      args
    );

    return { codes: rows, total, offset, limit, hasMore: offset + limit < total };
  }

  /**
   * List issued coupon codes for a specific setting with pagination and optional search
   * Optimized: Using covering index for fast pagination on large datasets
   */
  static async getIssuedCodes(settingId: string, query: { page?: number; limit?: number; search?: string }) {
    const pool = database.getPool();
    const startTime = Date.now();

    const page = query.page || 1;
    const limit = query.limit || 20;
    const offset = (page - 1) * limit;

    const where: string[] = ['settingId = ?'];
    const args: any[] = [settingId];

    if (query.search) {
      where.push('code LIKE ?');
      args.push(`%${query.search}%`);
    }

    const whereSql = `WHERE ${where.join(' AND ')}`;

    // Get total count
    let total: number;
    if (!query.search) {
      // Use cached count from g_coupon_settings if no search filter
      const [settingRows] = await pool.execute<RowDataPacket[]>(
        'SELECT issuedCount FROM g_coupon_settings WHERE id = ? AND status != ?',
        [settingId, 'DELETED']
      );

      if (settingRows.length === 0) {
        throw new CustomError('Coupon setting not found', 404);
      }

      total = Number(settingRows[0].issuedCount || 0);
      console.log(`[getIssuedCodes] Cache hit: total=${total}, time=${Date.now() - startTime}ms`);
    } else {
      // Count only when search filter is applied
      const countStart = Date.now();
      const [countRows] = await pool.execute<RowDataPacket[]>(
        `SELECT COUNT(*) as total FROM g_coupons ${whereSql}`,
        args
      );
      total = Number(countRows[0].total || 0);
      console.log(`[getIssuedCodes] COUNT query: total=${total}, time=${Date.now() - countStart}ms`);
    }

    // Get codes using covering index for fast pagination
    // The index (settingId, createdAt DESC, id) allows MySQL to satisfy the query without accessing the table
    const dataStart = Date.now();
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT id, settingId, code, status, createdAt, usedAt FROM g_coupons ${whereSql} ORDER BY createdAt DESC LIMIT ${limit} OFFSET ${offset}`,
      args
    );
    console.log(`[getIssuedCodes] Data query: rows=${rows.length}, offset=${offset}, time=${Date.now() - dataStart}ms, total=${Date.now() - startTime}ms`);

    return { codes: rows, total, page, limit };
  }

  /**
   * Get generation status for async coupon code generation
   */
  static async getGenerationStatus(settingId: string): Promise<any> {
    const pool = database.getPool();

    const [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT generationStatus, generatedCount, totalCount FROM g_coupon_settings WHERE id = ?',
      [settingId]
    );

    if (rows.length === 0) throw new CustomError('Coupon setting not found', 404);

    const row = rows[0] as any;
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
    const pool = database.getPool();

    try {
      // Get all settings with their actual counts
      const [results] = await pool.execute<RowDataPacket[]>(`
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

      const mismatches: any[] = [];

      // Update cache for all settings
      for (const row of results as any[]) {
        if (row.cached_issued !== row.actual_issued || row.cached_used !== row.actual_used) {
          mismatches.push({
            settingId: row.id,
            cached_issued: row.cached_issued,
            actual_issued: row.actual_issued,
            cached_used: row.cached_used,
            actual_used: row.actual_used,
          });

          // Update cache
          await pool.execute(
            'UPDATE g_coupon_settings SET issuedCount = ?, usedCount = ? WHERE id = ?',
            [row.actual_issued, row.actual_used, row.id]
          );
        }
      }

      if (mismatches.length > 0) {
        logger.warn('Cache mismatches found and fixed', { count: mismatches.length, mismatches });
      }

      return mismatches;
    } catch (error) {
      logger.error('Failed to recalculate cache', { error });
      throw new CustomError('Failed to recalculate cache', 500);
    }
  }

  /**
   * Recalculate cache for a specific coupon setting
   */
  static async recalculateCacheForSetting(settingId: string): Promise<{ issued: number; used: number }> {
    const pool = database.getPool();

    try {
      // Get actual counts
      const [issuedResult] = await pool.execute<RowDataPacket[]>(
        'SELECT COUNT(*) as count FROM g_coupons WHERE settingId = ?',
        [settingId]
      );
      const issuedCount = (issuedResult[0] as any).count || 0;

      const [usedResult] = await pool.execute<RowDataPacket[]>(
        'SELECT COUNT(*) as count FROM g_coupon_uses WHERE settingId = ?',
        [settingId]
      );
      const usedCount = (usedResult[0] as any).count || 0;

      // Update cache
      await pool.execute(
        'UPDATE g_coupon_settings SET issuedCount = ?, usedCount = ? WHERE id = ?',
        [issuedCount, usedCount, settingId]
      );

      logger.info('Cache recalculated for setting', { settingId, issuedCount, usedCount });

      return { issued: issuedCount, used: usedCount };
    } catch (error) {
      logger.error('Failed to recalculate cache for setting', { settingId, error });
      throw new CustomError('Failed to recalculate cache', 500);
    }
  }

  /**
   * Generate coupon codes synchronously (for small quantities)
   */
  private static async generateCouponCodesSynchronous(settingId: string, quantity: number): Promise<void> {
    const pool = database.getPool();
    const BATCH_SIZE = 1000;
    const DUPLICATE_CHECK_BATCH = 100;
    const localSet = new Set<string>();
    const genCode = () => ulid().substring(0, 16).toUpperCase();
    const codes: Array<[string, string, string]> = [];

    // Generate all codes
    for (let i = 0; i < quantity; i++) {
      let code: string;
      let found = false;

      // Try to find a unique code
      for (let attempt = 0; attempt < 10; attempt++) {
        code = genCode();
        if (localSet.has(code)) continue;

        // Check database for duplicates in batches
        if (i % DUPLICATE_CHECK_BATCH === 0) {
          const [dup] = await pool.execute<RowDataPacket[]>(
            'SELECT 1 as ok FROM g_coupons WHERE code = ? LIMIT 1',
            [code]
          );
          if (dup.length === 0) {
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

      localSet.add(code!);
      codes.push([ulid(), settingId, code!]);
    }

    // Insert codes in batches
    if (codes.length > 0) {
      for (let i = 0; i < codes.length; i += BATCH_SIZE) {
        const batch = codes.slice(i, i + BATCH_SIZE);
        const placeholders = batch.map(() => '(?, ?, ?)').join(',');
        await pool.execute(
          `INSERT INTO g_coupons (id, settingId, code) VALUES ${placeholders}`,
          batch.flat()
        );
      }

      // Update issuedCount cache
      await pool.execute(
        'UPDATE g_coupon_settings SET issuedCount = ? WHERE id = ?',
        [codes.length, settingId]
      );
    }
  }

  /**
   * Generate coupon codes asynchronously (for large quantities)
   * Enqueues a BullMQ job and returns immediately
   */
  private static async generateCouponCodesAsynchronous(settingId: string, quantity: number): Promise<void> {
    try {
      // Update status to PENDING
      const pool = database.getPool();
      await pool.execute(
        'UPDATE g_coupon_settings SET generationStatus = ?, totalCount = ? WHERE id = ?',
        ['PENDING', quantity, settingId]
      );

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
      throw new CustomError('Failed to enqueue coupon generation job', 500);
    }
  }
}


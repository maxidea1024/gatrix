import database from '../config/database';
import { CustomError } from '../middleware/errorHandler';
import { ulid } from 'ulid';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { convertToMySQLDateTime } from '../utils/dateUtils';

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
  }): Promise<{ settings: CouponSetting[]; total: number; page: number; limit: number }>{
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
      where.push('(code LIKE ? OR name LIKE ?)');
      const pattern = `%${params.search}%`;
      args.push(pattern, pattern);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const [countRows] = await pool.execute<RowDataPacket[]>(
      `SELECT COUNT(*) as total FROM g_coupon_settings ${whereSql}`,
      args
    );
    const total = Number(countRows[0].total || 0);

    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT * FROM g_coupon_settings ${whereSql} ORDER BY createdAt DESC LIMIT ${limit} OFFSET ${offset}`,
      args
    );

    const settings = rows.map((r: any) => ({
      ...r,
      tags: typeof r.tags === 'string' ? JSON.parse(r.tags) : r.tags,
      rewardData: typeof r.rewardData === 'string' ? JSON.parse(r.rewardData) : r.rewardData,
    })) as CouponSetting[];

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
        startsAt, expiresAt, status, createdBy)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
        startsAt,
        expiresAt,
        input.status ?? 'ACTIVE',
        input.createdBy ?? null,
      ]
    );

    // Helper to bulk insert targeting arrays
    // If NORMAL, generate issued coupon codes
    if (isNormal) {
      const quantity = Math.max(1, Number(input.quantity || 1));
      const localSet = new Set<string>();
      const genCode = () => ulid().substring(0, 16).toUpperCase();
      const codes: Array<[string, string, string]> = [];
      for (let i = 0; i < quantity; i++) {
        let code: string;
        // Try to find a unique code
        // Note: Very low collision probability; add DB check to be safe
        for (let attempt = 0; ; attempt++) {
          code = genCode();
          if (localSet.has(code)) continue;
          const [dup] = await pool.execute<RowDataPacket[]>(
            'SELECT 1 as ok FROM g_coupons WHERE code = ? LIMIT 1',
            [code]
          );
          if (dup.length === 0) break;
          if (attempt > 5) break; // fallback after few attempts
        }
        localSet.add(code!);
        codes.push([ulid(), id, code!]);
      }
      if (codes.length > 0) {
        const placeholders = codes.map(() => '(?, ?, ?)').join(',');
        await pool.execute(
          `INSERT INTO g_coupons (id, settingId, code) VALUES ${placeholders}`,
          codes.flat()
        );
      }
    }

    const insertTargets = async (table: string, column: string, values?: string[] | null) => {
      if (!values || values.length === 0) return;
      const rows = values.map(v => [ulid(), id, v]);
      const placeholders = rows.map(() => '(?, ?, ?)').join(',');
      await pool.execute(
        `INSERT INTO ${table} (id, settingId, ${column}) VALUES ${placeholders}`,
        rows.flat()
      );
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
    const [res] = await pool.execute<ResultSetHeader>(
      `UPDATE g_coupon_settings SET status = 'DELETED' WHERE id = ?`,
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
    await this.getSettingById(id);

    const page = query.page || 1;
    const limit = query.limit || 20;
    const offset = (page - 1) * limit;

    const where: string[] = ['settingId = ?'];
    const args: any[] = [id];

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

    const [countRows] = await pool.execute<RowDataPacket[]>(
      `SELECT COUNT(*) as total FROM g_coupon_uses ${whereSql}`,
      args
    );
    const total = Number(countRows[0].total || 0);

    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT * FROM g_coupon_uses ${whereSql} ORDER BY usedAt DESC LIMIT ${limit} OFFSET ${offset}`,
      args
    );

    return { records: rows, total, page, limit };
  }
}


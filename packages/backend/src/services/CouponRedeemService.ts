import database from '../config/database';
import { CustomError } from '../middleware/errorHandler';
import { ulid } from 'ulid';
import { RowDataPacket, ResultSetHeader, PoolConnection } from 'mysql2/promise';
import logger from '../config/logger';

export interface RedeemRequest {
  userId: string;
  userName: string;
  gameWorldId?: string;
  platform?: string;
  channel?: string;
  subchannel?: string;
  requestId?: string;
}

export interface RedeemResponse {
  reward: any;
  userUsedCount: number;
  sequence: number;
  usedAt: string;
}

/**
 * Service for redeeming coupon codes
 * Handles validation, transaction processing, and usage recording
 */
export class CouponRedeemService {
  /**
   * Redeem a coupon code
   */
  static async redeemCoupon(code: string, request: RedeemRequest): Promise<RedeemResponse> {
    const pool = database.getPool();
    const connection = await pool.getConnection();

    try {
      // Validate input
      if (!request.userId || !request.userName) {
        throw new CustomError('userId and userName are required', 400);
      }

      // Sanitize userName (max 128 chars)
      const sanitizedUserName = (request.userName || '').substring(0, 128).trim();
      if (!sanitizedUserName) {
        throw new CustomError('userName cannot be empty', 400);
      }

      // Start transaction
      await connection.beginTransaction();

      // 1. Find coupon code
      const [couponRows] = await connection.execute<RowDataPacket[]>(
        'SELECT * FROM g_coupons WHERE code = ? FOR UPDATE',
        [code]
      );

      if (couponRows.length === 0) {
        throw new CustomError('Coupon code not found', 404);
      }

      const coupon = couponRows[0] as any;

      // 2. Check if coupon is already used
      if (coupon.status === 'USED') {
        throw new CustomError('Coupon has already been used', 409);
      }

      // 3. Get coupon setting
      const [settingRows] = await connection.execute<RowDataPacket[]>(
        'SELECT * FROM g_coupon_settings WHERE id = ?',
        [coupon.settingId]
      );

      if (settingRows.length === 0) {
        throw new CustomError('Coupon setting not found', 404);
      }

      const setting = settingRows[0] as any;

      // 4. Check if setting is active
      if (setting.status !== 'ACTIVE') {
        throw new CustomError('Coupon is not active', 422);
      }

      // 5. Check date range
      const now = new Date();
      const startsAt = new Date(setting.startsAt);
      const expiresAt = new Date(setting.expiresAt);

      if (now < startsAt || now > expiresAt) {
        throw new CustomError('Coupon is not available in this period', 422);
      }

      // 6. Check targeting conditions
      await this.validateTargeting(connection, setting.id, request);

      // 7. Check per-user limit
      const [usageRows] = await connection.execute<RowDataPacket[]>(
        'SELECT COUNT(*) as count FROM g_coupon_uses WHERE settingId = ? AND userId = ?',
        [setting.id, request.userId]
      );

      const userUsedCount = (usageRows[0] as any).count || 0;

      if (userUsedCount >= setting.perUserLimit) {
        throw new CustomError('User has reached the usage limit for this coupon', 409);
      }

      // 8. Update coupon status to USED
      const usedAt = new Date().toISOString().slice(0, 19).replace('T', ' ');
      await connection.execute(
        'UPDATE g_coupons SET status = ?, usedAt = ? WHERE id = ?',
        ['USED', usedAt, coupon.id]
      );

      // 9. Record usage
      const sequence = userUsedCount + 1;
      const useId = ulid();

      await connection.execute(
        `INSERT INTO g_coupon_uses 
         (id, settingId, issuedCouponId, userId, userName, sequence, usedAt, gameWorldId, platform, channel, subchannel)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          useId,
          setting.id,
          coupon.id,
          request.userId,
          sanitizedUserName,
          sequence,
          usedAt,
          request.gameWorldId || null,
          request.platform || null,
          request.channel || null,
          request.subchannel || null,
        ]
      );

      // 10. Commit transaction
      await connection.commit();

      logger.info('Coupon redeemed successfully', {
        code,
        userId: request.userId,
        settingId: setting.id,
        sequence,
      });

      // 11. Build response
      const reward = setting.rewardData ? (typeof setting.rewardData === 'string' ? JSON.parse(setting.rewardData) : setting.rewardData) : {};

      return {
        reward,
        userUsedCount: sequence,
        sequence,
        usedAt,
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Validate targeting conditions
   */
  private static async validateTargeting(
    connection: PoolConnection,
    settingId: string,
    request: RedeemRequest
  ): Promise<void> {
    // Check if any targeting conditions are set
    const [worldRows] = await connection.execute<RowDataPacket[]>(
      'SELECT COUNT(*) as count FROM g_coupon_target_worlds WHERE settingId = ?',
      [settingId]
    );

    const [platformRows] = await connection.execute<RowDataPacket[]>(
      'SELECT COUNT(*) as count FROM g_coupon_target_platforms WHERE settingId = ?',
      [settingId]
    );

    const [channelRows] = await connection.execute<RowDataPacket[]>(
      'SELECT COUNT(*) as count FROM g_coupon_target_channels WHERE settingId = ?',
      [settingId]
    );

    const [subchannelRows] = await connection.execute<RowDataPacket[]>(
      'SELECT COUNT(*) as count FROM g_coupon_target_subchannels WHERE settingId = ?',
      [settingId]
    );

    const hasWorldTargeting = (worldRows[0] as any).count > 0;
    const hasPlatformTargeting = (platformRows[0] as any).count > 0;
    const hasChannelTargeting = (channelRows[0] as any).count > 0;
    const hasSubchannelTargeting = (subchannelRows[0] as any).count > 0;

    // Validate world targeting
    if (hasWorldTargeting && request.gameWorldId) {
      const [worldMatch] = await connection.execute<RowDataPacket[]>(
        'SELECT COUNT(*) as count FROM g_coupon_target_worlds WHERE settingId = ? AND gameWorldId = ?',
        [settingId, request.gameWorldId]
      );
      if ((worldMatch[0] as any).count === 0) {
        throw new CustomError('Coupon is not available for this game world', 422);
      }
    }

    // Validate platform targeting
    if (hasPlatformTargeting && request.platform) {
      const [platformMatch] = await connection.execute<RowDataPacket[]>(
        'SELECT COUNT(*) as count FROM g_coupon_target_platforms WHERE settingId = ? AND platform = ?',
        [settingId, request.platform]
      );
      if ((platformMatch[0] as any).count === 0) {
        throw new CustomError('Coupon is not available for this platform', 422);
      }
    }

    // Validate channel targeting
    if (hasChannelTargeting && request.channel) {
      const [channelMatch] = await connection.execute<RowDataPacket[]>(
        'SELECT COUNT(*) as count FROM g_coupon_target_channels WHERE settingId = ? AND channel = ?',
        [settingId, request.channel]
      );
      if ((channelMatch[0] as any).count === 0) {
        throw new CustomError('Coupon is not available for this channel', 422);
      }
    }

    // Validate subchannel targeting
    if (hasSubchannelTargeting && request.subchannel) {
      const [subchannelMatch] = await connection.execute<RowDataPacket[]>(
        'SELECT COUNT(*) as count FROM g_coupon_target_subchannels WHERE settingId = ? AND subchannel = ?',
        [settingId, request.subchannel]
      );
      if ((subchannelMatch[0] as any).count === 0) {
        throw new CustomError('Coupon is not available for this subchannel', 422);
      }
    }
  }
}


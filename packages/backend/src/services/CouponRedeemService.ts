import database from '../config/database';
import { GatrixError } from '../middleware/errorHandler';
import { ulid } from 'ulid';
import { RowDataPacket, PoolConnection } from 'mysql2/promise';
import logger from '../config/logger';

/**
 * Coupon Redeem Error Codes
 * These codes are used by SDK to identify specific error conditions
 */
export const CouponErrorCode = {
  // Validation errors (400)
  INVALID_PARAMETERS: 'COUPON_INVALID_PARAMETERS',

  // Not found errors (404)
  CODE_NOT_FOUND: 'COUPON_CODE_NOT_FOUND',

  // Conflict errors (409)
  ALREADY_USED: 'COUPON_ALREADY_USED',
  USER_LIMIT_EXCEEDED: 'COUPON_USER_LIMIT_EXCEEDED',

  // Unprocessable errors (422)
  NOT_ACTIVE: 'COUPON_NOT_ACTIVE',
  NOT_STARTED: 'COUPON_NOT_STARTED',
  EXPIRED: 'COUPON_EXPIRED',
  INVALID_WORLD: 'COUPON_INVALID_WORLD',
  INVALID_PLATFORM: 'COUPON_INVALID_PLATFORM',
  INVALID_CHANNEL: 'COUPON_INVALID_CHANNEL',
  INVALID_SUBCHANNEL: 'COUPON_INVALID_SUBCHANNEL',
  INVALID_USER: 'COUPON_INVALID_USER',
} as const;

export type CouponErrorCodeType = (typeof CouponErrorCode)[keyof typeof CouponErrorCode];

export interface RedeemRequest {
  userId: string;
  userName: string;
  characterId?: string;
  worldId?: string;
  platform?: string;
  channel?: string;
  subChannel?: string;
}

export interface RedeemResponse {
  reward: any;
  userUsedCount: number;
  sequence: number;
  usedAt: string;
  rewardEmailTitle?: string | null;
  rewardEmailBody?: string | null;
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
        throw new GatrixError('userId and userName are required', 400, true, CouponErrorCode.INVALID_PARAMETERS);
      }

      // Sanitize userName (max 128 chars)
      const sanitizedUserName = (request.userName || '').substring(0, 128).trim();
      if (!sanitizedUserName) {
        throw new GatrixError('userName cannot be empty', 400, true, CouponErrorCode.INVALID_PARAMETERS);
      }

      // Start transaction
      await connection.beginTransaction();

      // 1. Find coupon code
      const [couponRows] = await connection.execute<RowDataPacket[]>(
        'SELECT * FROM g_coupons WHERE code = ? FOR UPDATE',
        [code]
      );

      if (couponRows.length === 0) {
        throw new GatrixError('Coupon code not found', 404, true, CouponErrorCode.CODE_NOT_FOUND);
      }

      const coupon = couponRows[0] as any;

      // 2. Check if coupon is already used
      if (coupon.status === 'USED') {
        throw new GatrixError('Coupon has already been used', 409, true, CouponErrorCode.ALREADY_USED);
      }

      // 3. Get coupon setting
      const [settingRows] = await connection.execute<RowDataPacket[]>(
        'SELECT * FROM g_coupon_settings WHERE id = ?',
        [coupon.settingId]
      );

      if (settingRows.length === 0) {
        throw new GatrixError('Coupon setting not found', 404, true, CouponErrorCode.CODE_NOT_FOUND);
      }

      const setting = settingRows[0] as any;

      // 4. Check if setting is active
      if (setting.status !== 'ACTIVE') {
        throw new GatrixError('Coupon is not active', 422, true, CouponErrorCode.NOT_ACTIVE);
      }

      // 5. Check date range
      const now = new Date();
      // startsAt is optional - if null, coupon is immediately available
      const startsAt = setting.startsAt ? new Date(setting.startsAt) : null;
      const expiresAt = new Date(setting.expiresAt);

      // Check if coupon has started (if startsAt is set)
      if (startsAt && now < startsAt) {
        throw new GatrixError('Coupon is not available yet', 422, true, CouponErrorCode.NOT_STARTED);
      }

      // Check if coupon has expired
      if (now > expiresAt) {
        throw new GatrixError('Coupon has expired', 422, true, CouponErrorCode.EXPIRED);
      }

      // 6. Check targeting conditions
      await this.validateTargeting(connection, setting.id, request, setting);

      // 7. Check per-user/character limit based on usageLimitType
      const usageLimitType = setting.usageLimitType || 'USER';
      let usageQuery = 'SELECT COUNT(*) as count FROM g_coupon_uses WHERE settingId = ? AND ';
      const usageParams: any[] = [setting.id];

      if (usageLimitType === 'CHARACTER' && request.characterId) {
        usageQuery += 'characterId = ?';
        usageParams.push(request.characterId);
      } else {
        usageQuery += 'userId = ?';
        usageParams.push(request.userId);
      }

      const [usageRows] = await connection.execute<RowDataPacket[]>(usageQuery, usageParams);
      const userUsedCount = (usageRows[0] as any).count || 0;

      if (userUsedCount >= setting.perUserLimit) {
        throw new GatrixError('User has reached the usage limit for this coupon', 409, true, CouponErrorCode.USER_LIMIT_EXCEEDED);
      }

      // 8. Update coupon status to USED
      const usedAtISO = now.toISOString(); // ISO 8601 format for API response
      const usedAtMySQL = now.toISOString().slice(0, 19).replace('T', ' '); // MySQL DATETIME format for storage
      await connection.execute(
        'UPDATE g_coupons SET status = ?, usedAt = ? WHERE id = ?',
        ['USED', usedAtMySQL, coupon.id]
      );

      // 9. Record usage
      const sequence = userUsedCount + 1;
      const useId = ulid();

      await connection.execute(
        `INSERT INTO g_coupon_uses
         (id, settingId, issuedCouponId, userId, characterId, userName, sequence, usedAt, gameWorldId, platform, channel, subchannel)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          useId,
          setting.id,
          coupon.id,
          request.userId,
          request.characterId || null,
          sanitizedUserName,
          sequence,
          usedAtMySQL,
          request.worldId || null,
          request.platform || null,
          request.channel || null,
          request.subChannel || null,
        ]
      );

      // 10. Update usedCount cache in g_coupon_settings (within transaction for consistency)
      // This ensures cache is only updated if the entire transaction succeeds
      await connection.execute(
        'UPDATE g_coupon_settings SET usedCount = usedCount + 1 WHERE id = ?',
        [setting.id]
      );

      // 11. Check if all coupons are now used and auto-disable if needed
      // For SPECIAL type: check if usedCount >= maxTotalUses
      // For NORMAL type: check if usedCount >= generatedCount
      let shouldAutoDisable = false;
      if (setting.type === 'SPECIAL' && setting.maxTotalUses && setting.maxTotalUses > 0) {
        // For SPECIAL: check if we just reached maxTotalUses
        const newUsedCount = (setting.usedCount || 0) + 1;
        if (newUsedCount >= setting.maxTotalUses) {
          shouldAutoDisable = true;
        }
      } else if (setting.type === 'NORMAL') {
        // For NORMAL: check if we just used the last issued code
        const newUsedCount = (setting.usedCount || 0) + 1;
        const totalIssued = setting.generatedCount || setting.issuedCount || 0;
        if (totalIssued > 0 && newUsedCount >= totalIssued) {
          shouldAutoDisable = true;
        }
      }

      if (shouldAutoDisable) {
        await connection.execute(
          `UPDATE g_coupon_settings
           SET status = 'DISABLED',
               disabledBy = 'system',
               disabledAt = NOW(),
               disabledReason = 'All coupons have been used'
           WHERE id = ?`,
          [setting.id]
        );
        logger.info('Coupon setting auto-disabled (all used)', {
          settingId: setting.id,
          type: setting.type,
          usedCount: (setting.usedCount || 0) + 1,
          maxTotalUses: setting.maxTotalUses,
          generatedCount: setting.generatedCount,
        });
      }

      // 12. Commit transaction (all changes including cache update are atomic)
      await connection.commit();

      logger.info('Coupon redeemed successfully', {
        code,
        userId: request.userId,
        settingId: setting.id,
        sequence,
      });

      // 11. Build response
      let reward: any[] = [];

      // Get reward from template or direct data
      if (setting.rewardTemplateId) {
        // Get reward items from template
        const [templateRows] = await connection.execute<RowDataPacket[]>(
          'SELECT rewardItems FROM g_reward_templates WHERE id = ?',
          [setting.rewardTemplateId]
        );

        if (templateRows.length > 0) {
          const template = templateRows[0] as any;
          const rewardItems = typeof template.rewardItems === 'string' ? JSON.parse(template.rewardItems) : template.rewardItems;
          if (Array.isArray(rewardItems)) {
            reward = rewardItems.map((item: any) => ({
              type: parseInt(item.rewardType || item.type || 0),
              id: parseInt(item.itemId || item.id || 0),
              quantity: parseInt(item.quantity || 0),
            }));
          }
        }
      } else if (setting.rewardData) {
        // Get reward from direct data
        const rewardData = typeof setting.rewardData === 'string' ? JSON.parse(setting.rewardData) : setting.rewardData;
        // Ensure reward is always an array and transform to API format
        if (Array.isArray(rewardData)) {
          reward = rewardData.map((item: any) => ({
            type: parseInt(item.rewardType || item.type || 0),
            id: parseInt(item.itemId || item.id || 0),
            quantity: parseInt(item.quantity || 0),
          }));
        }
      }

      return {
        reward,
        userUsedCount: sequence,
        sequence,
        usedAt: usedAtISO, // Return ISO 8601 format for API response
        rewardEmailTitle: setting.rewardEmailTitle || null,
        rewardEmailBody: setting.rewardEmailBody || null,
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
    request: RedeemRequest,
    setting: any
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

    const [userRows] = await connection.execute<RowDataPacket[]>(
      'SELECT COUNT(*) as count FROM g_coupon_target_users WHERE settingId = ?',
      [settingId]
    );

    const hasWorldTargeting = (worldRows[0] as any).count > 0;
    const hasPlatformTargeting = (platformRows[0] as any).count > 0;
    const hasChannelTargeting = (channelRows[0] as any).count > 0;
    const hasSubchannelTargeting = (subchannelRows[0] as any).count > 0;
    const hasUserTargeting = (userRows[0] as any).count > 0;

    // Validate world targeting
    if (hasWorldTargeting && request.worldId) {
      const [worldMatch] = await connection.execute<RowDataPacket[]>(
        'SELECT COUNT(*) as count FROM g_coupon_target_worlds WHERE settingId = ? AND gameWorldId = ?',
        [settingId, request.worldId]
      );
      if ((worldMatch[0] as any).count === 0) {
        throw new GatrixError('Coupon is not available for this game world', 422, true, CouponErrorCode.INVALID_WORLD);
      }
    }

    // Validate platform targeting
    if (hasPlatformTargeting && request.platform) {
      const [platformMatch] = await connection.execute<RowDataPacket[]>(
        'SELECT COUNT(*) as count FROM g_coupon_target_platforms WHERE settingId = ? AND platform = ?',
        [settingId, request.platform]
      );
      if ((platformMatch[0] as any).count === 0) {
        throw new GatrixError('Coupon is not available for this platform', 422, true, CouponErrorCode.INVALID_PLATFORM);
      }
    }

    // Validate channel targeting
    if (hasChannelTargeting && request.channel) {
      const [channelMatch] = await connection.execute<RowDataPacket[]>(
        'SELECT COUNT(*) as count FROM g_coupon_target_channels WHERE settingId = ? AND channel = ?',
        [settingId, request.channel]
      );
      const isMatched = (channelMatch[0] as any).count > 0;
      const isInverted = setting.targetChannelsInverted || false;

      // If inverted: should NOT match. If normal: should match
      if (isInverted ? isMatched : !isMatched) {
        throw new GatrixError('Coupon is not available for this channel', 422, true, CouponErrorCode.INVALID_CHANNEL);
      }
    }

    // Validate subchannel targeting
    if (hasSubchannelTargeting && request.subChannel) {
      const [subchannelMatch] = await connection.execute<RowDataPacket[]>(
        'SELECT COUNT(*) as count FROM g_coupon_target_subchannels WHERE settingId = ? AND subchannel = ?',
        [settingId, request.subChannel]
      );
      const isMatched = (subchannelMatch[0] as any).count > 0;
      const isInverted = setting.targetChannelsInverted || false;

      // If inverted: should NOT match. If normal: should match
      if (isInverted ? isMatched : !isMatched) {
        throw new GatrixError('Coupon is not available for this subchannel', 422, true, CouponErrorCode.INVALID_SUBCHANNEL);
      }
    }

    // Validate user ID targeting
    if (hasUserTargeting) {
      const [userMatch] = await connection.execute<RowDataPacket[]>(
        'SELECT COUNT(*) as count FROM g_coupon_target_users WHERE settingId = ? AND userId = ?',
        [settingId, request.userId]
      );
      const isMatched = (userMatch[0] as any).count > 0;
      const isInverted = setting.targetUserIdsInverted || false;

      // If inverted: should NOT match. If normal: should match
      if (isInverted ? isMatched : !isMatched) {
        throw new GatrixError('Coupon is not available for this user', 422, true, CouponErrorCode.INVALID_USER);
      }
    }
  }
}


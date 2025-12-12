import db from '../config/knex';
import { Knex } from 'knex';
import { GatrixError } from '../middleware/errorHandler';
import { ulid } from 'ulid';
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
  rewardMailTitle?: string | null;
  rewardMailContent?: string | null;
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
    // Validate input
    if (!request.userId || !request.userName) {
      throw new GatrixError('userId and userName are required', 400, true, CouponErrorCode.INVALID_PARAMETERS);
    }

    // Sanitize userName (max 128 chars)
    const sanitizedUserName = (request.userName || '').substring(0, 128).trim();
    if (!sanitizedUserName) {
      throw new GatrixError('userName cannot be empty', 400, true, CouponErrorCode.INVALID_PARAMETERS);
    }

    return await db.transaction(async (trx) => {
      // 1. Find coupon code with lock
      const coupon = await trx('g_coupons').where('code', code).forUpdate().first();

      if (!coupon) {
        throw new GatrixError('Coupon code not found', 404, true, CouponErrorCode.CODE_NOT_FOUND);
      }

      // 2. Check if coupon is already used
      if (coupon.status === 'USED') {
        throw new GatrixError('Coupon has already been used', 409, true, CouponErrorCode.ALREADY_USED);
      }

      // 3. Get coupon setting
      const setting = await trx('g_coupon_settings').where('id', coupon.settingId).first();

      if (!setting) {
        throw new GatrixError('Coupon setting not found', 404, true, CouponErrorCode.CODE_NOT_FOUND);
      }

      // 4. Check if setting is active
      if (setting.status !== 'ACTIVE') {
        throw new GatrixError('Coupon is not active', 422, true, CouponErrorCode.NOT_ACTIVE);
      }

      // 5. Check date range
      const now = new Date();
      const startsAt = setting.startsAt ? new Date(setting.startsAt) : null;
      const expiresAt = new Date(setting.expiresAt);

      if (startsAt && now < startsAt) {
        throw new GatrixError('Coupon is not available yet', 422, true, CouponErrorCode.NOT_STARTED);
      }

      if (now > expiresAt) {
        throw new GatrixError('Coupon has expired', 422, true, CouponErrorCode.EXPIRED);
      }

      // 6. Check targeting conditions
      await this.validateTargeting(trx, setting.id, request, setting);

      // 7. Check per-user/character limit based on usageLimitType
      const usageLimitType = setting.usageLimitType || 'USER';
      const usageQuery = trx('g_coupon_uses').where('settingId', setting.id);

      if (usageLimitType === 'CHARACTER' && request.characterId) {
        usageQuery.where('characterId', request.characterId);
      } else {
        usageQuery.where('userId', request.userId);
      }

      const usageResult = await usageQuery.count('* as count').first();
      const userUsedCount = Number(usageResult?.count || 0);

      if (userUsedCount >= setting.perUserLimit) {
        throw new GatrixError('User has reached the usage limit for this coupon', 409, true, CouponErrorCode.USER_LIMIT_EXCEEDED);
      }

      // 8. Update coupon status to USED
      const usedAtISO = now.toISOString();
      const usedAtMySQL = now.toISOString().slice(0, 19).replace('T', ' ');
      await trx('g_coupons').where('id', coupon.id).update({ status: 'USED', usedAt: usedAtMySQL });

      // 9. Record usage
      const sequence = userUsedCount + 1;
      const useId = ulid();

      await trx('g_coupon_uses').insert({
        id: useId,
        settingId: setting.id,
        issuedCouponId: coupon.id,
        userId: request.userId,
        characterId: request.characterId || null,
        userName: sanitizedUserName,
        sequence,
        usedAt: usedAtMySQL,
        gameWorldId: request.worldId || null,
        platform: request.platform || null,
        channel: request.channel || null,
        subchannel: request.subChannel || null,
      });

      // 10. Update usedCount cache
      await trx('g_coupon_settings').where('id', setting.id).increment('usedCount', 1);

      // 11. Check if all coupons are now used and auto-disable if needed
      let shouldAutoDisable = false;
      if (setting.type === 'SPECIAL' && setting.maxTotalUses && setting.maxTotalUses > 0) {
        const newUsedCount = (setting.usedCount || 0) + 1;
        if (newUsedCount >= setting.maxTotalUses) {
          shouldAutoDisable = true;
        }
      } else if (setting.type === 'NORMAL') {
        const newUsedCount = (setting.usedCount || 0) + 1;
        const totalIssued = setting.generatedCount || setting.issuedCount || 0;
        if (totalIssued > 0 && newUsedCount >= totalIssued) {
          shouldAutoDisable = true;
        }
      }

      if (shouldAutoDisable) {
        await trx('g_coupon_settings').where('id', setting.id).update({
          status: 'DISABLED',
          disabledBy: 'system',
          disabledAt: trx.fn.now(),
          disabledReason: 'All coupons have been used',
        });
        logger.info('Coupon setting auto-disabled (all used)', {
          settingId: setting.id,
          type: setting.type,
          usedCount: (setting.usedCount || 0) + 1,
          maxTotalUses: setting.maxTotalUses,
          generatedCount: setting.generatedCount,
        });
      }

      logger.info('Coupon redeemed successfully', {
        code,
        userId: request.userId,
        settingId: setting.id,
        sequence,
      });

      // 12. Build response
      let reward: any[] = [];

      if (setting.rewardTemplateId) {
        const template = await trx('g_reward_templates').where('id', setting.rewardTemplateId).select('rewardItems').first();

        if (template) {
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
        const rewardData = typeof setting.rewardData === 'string' ? JSON.parse(setting.rewardData) : setting.rewardData;
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
        usedAt: usedAtISO,
        rewardMailTitle: setting.rewardEmailTitle || null,
        rewardMailContent: setting.rewardEmailBody || null,
      };
    });
  }

  /**
   * Validate targeting conditions
   */
  private static async validateTargeting(
    trx: Knex.Transaction,
    settingId: string,
    request: RedeemRequest,
    setting: any
  ): Promise<void> {
    // Check if any targeting conditions are set (parallel queries)
    const [worldCount, platformCount, channelCount, subchannelCount, userCount] = await Promise.all([
      trx('g_coupon_target_worlds').where('settingId', settingId).count('* as count').first(),
      trx('g_coupon_target_platforms').where('settingId', settingId).count('* as count').first(),
      trx('g_coupon_target_channels').where('settingId', settingId).count('* as count').first(),
      trx('g_coupon_target_subchannels').where('settingId', settingId).count('* as count').first(),
      trx('g_coupon_target_users').where('settingId', settingId).count('* as count').first(),
    ]);

    const hasWorldTargeting = Number(worldCount?.count || 0) > 0;
    const hasPlatformTargeting = Number(platformCount?.count || 0) > 0;
    const hasChannelTargeting = Number(channelCount?.count || 0) > 0;
    const hasSubchannelTargeting = Number(subchannelCount?.count || 0) > 0;
    const hasUserTargeting = Number(userCount?.count || 0) > 0;

    // Validate world targeting
    if (hasWorldTargeting && request.worldId) {
      const worldMatch = await trx('g_coupon_target_worlds')
        .where('settingId', settingId)
        .where('gameWorldId', request.worldId)
        .count('* as count')
        .first();
      if (Number(worldMatch?.count || 0) === 0) {
        throw new GatrixError('Coupon is not available for this game world', 422, true, CouponErrorCode.INVALID_WORLD);
      }
    }

    // Validate platform targeting
    if (hasPlatformTargeting && request.platform) {
      const platformMatch = await trx('g_coupon_target_platforms')
        .where('settingId', settingId)
        .where('platform', request.platform)
        .count('* as count')
        .first();
      if (Number(platformMatch?.count || 0) === 0) {
        throw new GatrixError('Coupon is not available for this platform', 422, true, CouponErrorCode.INVALID_PLATFORM);
      }
    }

    // Validate channel targeting
    if (hasChannelTargeting && request.channel) {
      const channelMatch = await trx('g_coupon_target_channels')
        .where('settingId', settingId)
        .where('channel', request.channel)
        .count('* as count')
        .first();
      const isMatched = Number(channelMatch?.count || 0) > 0;
      const isInverted = setting.targetChannelsInverted || false;

      if (isInverted ? isMatched : !isMatched) {
        throw new GatrixError('Coupon is not available for this channel', 422, true, CouponErrorCode.INVALID_CHANNEL);
      }
    }

    // Validate subchannel targeting
    if (hasSubchannelTargeting && request.subChannel) {
      const subchannelMatch = await trx('g_coupon_target_subchannels')
        .where('settingId', settingId)
        .where('subchannel', request.subChannel)
        .count('* as count')
        .first();
      const isMatched = Number(subchannelMatch?.count || 0) > 0;
      const isInverted = setting.targetChannelsInverted || false;

      if (isInverted ? isMatched : !isMatched) {
        throw new GatrixError('Coupon is not available for this subchannel', 422, true, CouponErrorCode.INVALID_SUBCHANNEL);
      }
    }

    // Validate user ID targeting
    if (hasUserTargeting) {
      const userMatch = await trx('g_coupon_target_users')
        .where('settingId', settingId)
        .where('userId', request.userId)
        .count('* as count')
        .first();
      const isMatched = Number(userMatch?.count || 0) > 0;
      const isInverted = setting.targetUserIdsInverted || false;

      if (isInverted ? isMatched : !isMatched) {
        throw new GatrixError('Coupon is not available for this user', 422, true, CouponErrorCode.INVALID_USER);
      }
    }
  }
}


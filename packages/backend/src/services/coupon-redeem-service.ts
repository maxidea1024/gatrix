import db from '../config/knex';
import { Knex } from 'knex';
import { GatrixError } from '../middleware/error-handler';
import { ulid } from 'ulid';
import { createLogger } from '../config/logger';
import redisClient from '../config/redis';
import { queueService } from './queue-service';
import { CouponRedeemJobPayload } from './jobs/coupon-redeem-job';

const logger = createLogger('CouponRedeemService');

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

export type CouponErrorCodeType =
  (typeof CouponErrorCode)[keyof typeof CouponErrorCode];

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
  static async redeemCoupon(
    code: string,
    request: RedeemRequest,
    environmentId: string
  ): Promise<RedeemResponse> {
    // Validate input
    if (!request.userId || !request.userName) {
      throw new GatrixError(
        'userId and userName are required',
        400,
        true,
        CouponErrorCode.INVALID_PARAMETERS
      );
    }

    // Sanitize userName (max 128 chars)
    const sanitizedUserName = (request.userName || '').substring(0, 128).trim();
    if (!sanitizedUserName) {
      throw new GatrixError(
        'userName cannot be empty',
        400,
        true,
        CouponErrorCode.INVALID_PARAMETERS
      );
    }

    // --- PHASE 1: Read-only validation outside transaction ---
    // First try to find in g_coupons (NORMAL coupon)
    let coupon = await db('g_coupons')
      .where('code', code)
      .where('environmentId', environmentId)
      .first();

    let setting: any;
    let isSpecialCoupon = false;
    let couponId: string | null = null;

    if (coupon) {
      // NORMAL coupon found
      couponId = coupon.id;

      // Check if coupon is already used
      if (coupon.status === 'USED') {
        throw new GatrixError(
          'Coupon has already been used',
          409,
          true,
          CouponErrorCode.ALREADY_USED
        );
      }

      // Get coupon setting
      setting = await db('g_coupon_settings')
        .where('id', coupon.settingId)
        .where('environmentId', environmentId)
        .first();
    } else {
      // Not found in g_coupons, try SPECIAL coupon in g_coupon_settings
      setting = await db('g_coupon_settings')
        .where('code', code)
        .where('environmentId', environmentId)
        .where('type', 'SPECIAL')
        .first();

      if (setting) {
        isSpecialCoupon = true;
      }
    }

    if (!setting) {
      throw new GatrixError(
        'Coupon code not found',
        404,
        true,
        CouponErrorCode.CODE_NOT_FOUND
      );
    }

    // Check if setting is active
    if (setting.status !== 'ACTIVE') {
      throw new GatrixError(
        'Coupon is not active',
        422,
        true,
        CouponErrorCode.NOT_ACTIVE
      );
    }

    // Check date range
    const now = new Date();
    const startsAt = setting.startsAt ? new Date(setting.startsAt) : null;
    const expiresAt = new Date(setting.expiresAt);

    if (startsAt && now < startsAt) {
      throw new GatrixError(
        'Coupon is not available yet',
        422,
        true,
        CouponErrorCode.NOT_STARTED
      );
    }

    if (now > expiresAt) {
      throw new GatrixError(
        'Coupon has expired',
        422,
        true,
        CouponErrorCode.EXPIRED
      );
    }

    // Check targeting conditions BEFORE locking
    await this.validateTargeting(db, setting.id, request, setting);

    // --- PHASE 2: Extreme Redis Optimization (Zero DB Lock) ---
    const redis = redisClient.getClient();
    const useId = ulid();
    const usedAtISO = now.toISOString();
    const usedAtMySQL = now.toISOString().slice(0, 19).replace('T', ' ');

    let sequence = 1;

    // 1. Atomic Check for NORMAL Coupons (SETNX Lock)
    if (!isSpecialCoupon && coupon) {
      const lockKey = `coupon:redeemed:${environmentId}:${code}`;
      const acquired = await redis.setnx(lockKey, useId);
      
      if (acquired) {
        // Expire the lock after 90 days to prevent infinite memory growth
        await redis.expire(lockKey, 60 * 60 * 24 * 90);
      } else {
        throw new GatrixError(
          'Coupon has already been used',
          409,
          true,
          CouponErrorCode.ALREADY_USED
        );
      }
    }

    // 2. Atomic Check for User/Character Limits
    const usageLimitType = setting.usageLimitType || 'USER';
    const limitTargetId = usageLimitType === 'CHARACTER' && request.characterId ? request.characterId : request.userId;
    const usageKey = `coupon:usage:${environmentId}:${setting.id}:${limitTargetId}`;
    
    // Increment the usage count atomically
    sequence = await redis.incr(usageKey);
    
    // Lazy Loading: If sequence is 1, it might be a cache miss. Verify with DB to prevent abuse.
    if (sequence === 1) {
      const usageQuery = db('g_coupon_uses').where('settingId', setting.id);
      if (usageLimitType === 'CHARACTER' && request.characterId) {
        usageQuery.where('characterId', request.characterId);
      } else {
        usageQuery.where('userId', request.userId);
      }
      const usageResult = await usageQuery.count('* as count').first();
      const dbUsedCount = Number(usageResult?.count || 0);
      
      if (dbUsedCount > 0) {
        // Correct the Redis counter (dbUsedCount + 1 since they are using it now)
        sequence = dbUsedCount + 1;
        await redis.set(usageKey, sequence);
      }
    }

    // Check if the sequence exceeds the perUserLimit
    if (sequence > setting.perUserLimit) {
      // Rollback the increment since they exceeded the limit
      await redis.decr(usageKey);
      
      // Also rollback the code lock if it was a NORMAL coupon
      if (!isSpecialCoupon && coupon) {
        await redis.del(`coupon:redeemed:${environmentId}:${code}`);
      }

      throw new GatrixError(
        'User has reached the usage limit for this coupon',
        409,
        true,
        CouponErrorCode.USER_LIMIT_EXCEEDED
      );
    }

    // 3. Optional: Global limit check for SPECIAL coupons (Best effort)
    if (isSpecialCoupon && setting.maxTotalUses && setting.maxTotalUses > 0) {
      const globalUsageKey = `coupon:global_usage:${environmentId}:${setting.id}`;
      let globalCount = await redis.incr(globalUsageKey);
      
      if (globalCount === 1) {
        // Lazy load global count
        const dbSetting = await db('g_coupon_settings').where('id', setting.id).select('usedCount').first();
        if (dbSetting && Number(dbSetting.usedCount || 0) > 0) {
          globalCount = Number(dbSetting.usedCount || 0) + 1;
          await redis.set(globalUsageKey, globalCount);
        }
      }

      if (globalCount > setting.maxTotalUses) {
        await redis.decr(globalUsageKey);
        await redis.decr(usageKey);
        throw new GatrixError(
          'Coupon has reached its maximum usage limit',
          409,
          true,
          CouponErrorCode.ALREADY_USED
        );
      }
    }

    // 4. Dispatch Async Job to BullMQ for DB Persistence
    const payload: CouponRedeemJobPayload = {
      useId,
      environmentId,
      settingId: setting.id,
      code,
      couponId: couponId || null,
      settingType: setting.type as 'NORMAL' | 'SPECIAL',
      sequence,
      usedAtMySQL,
      userId: request.userId,
      characterId: request.characterId || null,
      userName: sanitizedUserName,
      worldId: request.worldId || null,
      platform: request.platform || null,
      channel: request.channel || null,
      subchannel: request.subChannel || null,
    };

    await queueService.addJob('coupon-redeem', 'redeem', payload, {
      jobId: useId, // Idempotency
    });

    logger.info('Coupon redeemed successfully (Async queued)', {
      code,
      userId: request.userId,
      settingId: setting.id,
      sequence,
      environmentId,
      isSpecialCoupon,
    });

    // 5. Build response without waiting for DB Write
    let reward: any[] = [];

    if (setting.rewardTemplateId) {
      const template = await db('g_reward_templates')
        .where('id', setting.rewardTemplateId)
        .where('environmentId', environmentId)
        .select('rewardItems')
        .first();

      if (template) {
        const rewardItems =
          typeof template.rewardItems === 'string'
            ? JSON.parse(template.rewardItems)
            : template.rewardItems;
        if (Array.isArray(rewardItems)) {
          reward = rewardItems.map((item: any) => ({
            type: parseInt(item.rewardType || item.type || 0),
            id: parseInt(item.itemId || item.id || 0),
            quantity: parseInt(item.quantity || 0),
          }));
        }
      }
    } else if (setting.rewardData) {
      const rewardData =
        typeof setting.rewardData === 'string'
          ? JSON.parse(setting.rewardData)
          : setting.rewardData;
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
  }

  /**
   * Validate targeting conditions
   */
  private static async validateTargeting(
    dbOrTrx: Knex | Knex.Transaction,
    settingId: string,
    request: RedeemRequest,
    setting: any
  ): Promise<void> {
    // Check if any targeting conditions are set (parallel queries)
    const [
      worldCount,
      platformCount,
      channelCount,
      subchannelCount,
      userCount,
    ] = await Promise.all([
      dbOrTrx('g_coupon_target_worlds')
        .where('settingId', settingId)
        .count('* as count')
        .first(),
      dbOrTrx('g_coupon_target_platforms')
        .where('settingId', settingId)
        .count('* as count')
        .first(),
      dbOrTrx('g_coupon_target_channels')
        .where('settingId', settingId)
        .count('* as count')
        .first(),
      dbOrTrx('g_coupon_target_subchannels')
        .where('settingId', settingId)
        .count('* as count')
        .first(),
      dbOrTrx('g_coupon_target_users')
        .where('settingId', settingId)
        .count('* as count')
        .first(),
    ]);

    const hasWorldTargeting = Number(worldCount?.count || 0) > 0;
    const hasPlatformTargeting = Number(platformCount?.count || 0) > 0;
    const hasChannelTargeting = Number(channelCount?.count || 0) > 0;
    const hasSubchannelTargeting = Number(subchannelCount?.count || 0) > 0;
    const hasUserTargeting = Number(userCount?.count || 0) > 0;

    // Validate world targeting
    if (hasWorldTargeting && request.worldId) {
      const worldMatch = await dbOrTrx('g_coupon_target_worlds')
        .where('settingId', settingId)
        .where('gameWorldId', request.worldId)
        .count('* as count')
        .first();
      if (Number(worldMatch?.count || 0) === 0) {
        throw new GatrixError(
          'Coupon is not available for this game world',
          422,
          true,
          CouponErrorCode.INVALID_WORLD
        );
      }
    }

    // Validate platform targeting
    if (hasPlatformTargeting && request.platform) {
      const platformMatch = await dbOrTrx('g_coupon_target_platforms')
        .where('settingId', settingId)
        .where('platform', request.platform)
        .count('* as count')
        .first();
      if (Number(platformMatch?.count || 0) === 0) {
        throw new GatrixError(
          'Coupon is not available for this platform',
          422,
          true,
          CouponErrorCode.INVALID_PLATFORM
        );
      }
    }

    // Validate channel targeting
    if (hasChannelTargeting && request.channel) {
      const channelMatch = await dbOrTrx('g_coupon_target_channels')
        .where('settingId', settingId)
        .where('channel', request.channel)
        .count('* as count')
        .first();
      const isMatched = Number(channelMatch?.count || 0) > 0;
      const isInverted = setting.targetChannelsInverted || false;

      if (isInverted ? isMatched : !isMatched) {
        throw new GatrixError(
          'Coupon is not available for this channel',
          422,
          true,
          CouponErrorCode.INVALID_CHANNEL
        );
      }
    }

    // Validate subchannel targeting
    if (hasSubchannelTargeting && request.subChannel) {
      const subchannelMatch = await dbOrTrx('g_coupon_target_subchannels')
        .where('settingId', settingId)
        .where('subchannel', request.subChannel)
        .count('* as count')
        .first();
      const isMatched = Number(subchannelMatch?.count || 0) > 0;
      const isInverted = setting.targetChannelsInverted || false;

      if (isInverted ? isMatched : !isMatched) {
        throw new GatrixError(
          'Coupon is not available for this subchannel',
          422,
          true,
          CouponErrorCode.INVALID_SUBCHANNEL
        );
      }
    }

    // Validate user ID targeting
    if (hasUserTargeting) {
      const userMatch = await dbOrTrx('g_coupon_target_users')
        .where('settingId', settingId)
        .where('userId', request.userId)
        .count('* as count')
        .first();
      const isMatched = Number(userMatch?.count || 0) > 0;
      const isInverted = setting.targetUserIdsInverted || false;

      if (isInverted ? isMatched : !isMatched) {
        throw new GatrixError(
          'Coupon is not available for this user',
          422,
          true,
          CouponErrorCode.INVALID_USER
        );
      }
    }
  }
}

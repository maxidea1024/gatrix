import db from '../config/knex';
import { Knex } from 'knex';
import { GatrixError } from '../middleware/error-handler';
import { ulid } from 'ulid';
import { createLogger } from '../config/logger';
import redisClient from '../config/redis';
import { queueService } from './queue-service';
import { CouponRedeemJobPayload } from './jobs/coupon-redeem-job';
import { convertToMySQLDateTime } from '../utils/date-utils';

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

    // --- PHASE 2: Redis Atomic Validation (Zero DB Write-Lock) ---
    // IMPORTANT: PHASE 1 above already performed read-only DB queries to validate
    // coupon existence, status, date range, and targeting. No SELECT ... FOR UPDATE
    // was used — only lightweight reads that release connections immediately.
    // PHASE 2 uses Redis atomic operations to guard against concurrent race conditions
    // that the read-only DB checks cannot prevent (e.g., two users redeeming the same
    // NORMAL code simultaneously between the DB read and the async DB write).
    const redis = redisClient.getClient();
    const useId = ulid();
    const usedAtISO = now.toISOString();
    const usedAtMySQL = convertToMySQLDateTime(now)!;

    // TTL for NORMAL coupon SETNX keys.
    // After TTL expiry, the DB status check in PHASE 1 (coupon.status === 'USED')
    // continues to serve as the permanent defense against duplicate redemption.
    const NORMAL_COUPON_LOCK_TTL = 60 * 60 * 24 * 90; // 90 days

    let sequence = 1;

    // 1. Atomic Dedup for NORMAL Coupons — SET NX EX (single atomic command)
    //    Using SET with NX + EX flags ensures the key is created with TTL atomically.
    //    Previously setnx + expire were two separate commands, which could leave keys
    //    without TTL if the process crashed between them.
    if (!isSpecialCoupon && coupon) {
      const lockKey = `coupon:redeemed:${environmentId}:${code}`;
      const acquired = await redis.set(
        lockKey,
        useId,
        'EX',
        NORMAL_COUPON_LOCK_TTL,
        'NX'
      );

      if (acquired !== 'OK') {
        throw new GatrixError(
          'Coupon has already been used',
          409,
          true,
          CouponErrorCode.ALREADY_USED
        );
      }
    }

    // 2. Per-User/Character Usage Limit — Atomic INCR with Lazy-Loading Correction
    const usageLimitType = setting.usageLimitType || 'USER';
    const limitTargetId =
      usageLimitType === 'CHARACTER' && request.characterId
        ? request.characterId
        : request.userId;
    const usageKey = `coupon:usage:${environmentId}:${setting.id}:${limitTargetId}`;

    // Lazy-Loading strategy: On cache miss (INCR returns 1), we query MySQL to check
    // if the user already has prior redemptions from before Redis was introduced.
    // To prevent a race condition where concurrent INCRs during the DB query could have
    // their count overwritten by a stale redis.set(), we use a Lua script that atomically
    // performs: INCR → if result is 1 AND dbCount > 0 → conditionally correct only if
    // the key still holds 1 (no concurrent INCR occurred).
    const dbUsedCount = await this.getDbUsedCount(
      setting.id,
      usageLimitType,
      request
    );

    // Lua script: Atomically INCR + conditionally correct for lazy-loading.
    // KEYS[1] = usageKey, ARGV[1] = dbUsedCount (pre-fetched from MySQL)
    // Returns the final sequence number after any correction.
    const INCR_WITH_CORRECTION_LUA = `
      local seq = redis.call('INCR', KEYS[1])
      if seq == 1 then
        local dbCount = tonumber(ARGV[1])
        if dbCount and dbCount > 0 then
          local corrected = dbCount + 1
          redis.call('SET', KEYS[1], corrected)
          return corrected
        end
      end
      return seq
    `;
    sequence = (await redis.eval(
      INCR_WITH_CORRECTION_LUA,
      1,
      usageKey,
      String(dbUsedCount)
    )) as number;

    // Check if the sequence exceeds the perUserLimit
    if (sequence > setting.perUserLimit) {
      // Rollback: use pipeline for atomic batch execution of all rollback operations.
      // Pipeline guarantees all commands are sent in a single network round-trip and
      // executed sequentially on the Redis server without interleaving from other clients.
      const rollbackPipeline = redis.pipeline();
      rollbackPipeline.decr(usageKey);
      if (!isSpecialCoupon && coupon) {
        rollbackPipeline.del(`coupon:redeemed:${environmentId}:${code}`);
      }
      await rollbackPipeline.exec();

      throw new GatrixError(
        'User has reached the usage limit for this coupon',
        409,
        true,
        CouponErrorCode.USER_LIMIT_EXCEEDED
      );
    }

    // 3. Global total usage limit check for SPECIAL coupons
    //    Uses the same Lazy-Loading Lua pattern to prevent race conditions.
    if (isSpecialCoupon && setting.maxTotalUses && setting.maxTotalUses > 0) {
      const globalUsageKey = `coupon:global_usage:${environmentId}:${setting.id}`;

      // Pre-fetch DB count for lazy-loading correction
      const dbSetting = await db('g_coupon_settings')
        .where('id', setting.id)
        .select('usedCount')
        .first();
      const dbGlobalCount = Number(dbSetting?.usedCount || 0);

      // Lua: Atomic INCR + lazy-loading correction for global counter
      const globalCount = (await redis.eval(
        INCR_WITH_CORRECTION_LUA,
        1,
        globalUsageKey,
        String(dbGlobalCount)
      )) as number;

      if (globalCount > setting.maxTotalUses) {
        // Rollback all counters atomically via pipeline
        const rollbackPipeline = redis.pipeline();
        rollbackPipeline.decr(globalUsageKey);
        rollbackPipeline.decr(usageKey);
        await rollbackPipeline.exec();

        throw new GatrixError(
          'Coupon has reached its maximum usage limit',
          409,
          true,
          CouponErrorCode.ALREADY_USED
        );
      }
    }

    // 4. Dispatch Async Job to BullMQ for DB Persistence
    //    CRITICAL: We must verify that the job was successfully enqueued before
    //    returning success to the caller. If addJob fails (e.g., Redis outage for
    //    BullMQ), the user would receive a success response with rewards but the
    //    redemption would never be persisted to MySQL, causing a silent data loss.
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

    const job = await queueService.addJob('coupon-redeem', 'redeem', payload, {
      jobId: useId, // Idempotency: BullMQ deduplicates by jobId
    });

    // If job dispatch failed, rollback all Redis state to prevent orphaned locks.
    // Without this, the coupon would be marked as "used" in Redis but never
    // persisted to DB — the user gets an error, yet cannot retry because Redis
    // still holds the lock.
    if (!job) {
      logger.error('CRITICAL: Failed to enqueue coupon redeem job, rolling back Redis state', {
        useId,
        code,
        userId: request.userId,
        settingId: setting.id,
      });

      const rollbackPipeline = redis.pipeline();
      rollbackPipeline.decr(usageKey);
      if (!isSpecialCoupon && coupon) {
        rollbackPipeline.del(`coupon:redeemed:${environmentId}:${code}`);
      }
      if (isSpecialCoupon && setting.maxTotalUses && setting.maxTotalUses > 0) {
        rollbackPipeline.decr(`coupon:global_usage:${environmentId}:${setting.id}`);
      }
      await rollbackPipeline.exec();

      throw new GatrixError(
        'Failed to process coupon redemption. Please try again.',
        500
      );
    }

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
   * Query MySQL for existing usage count for lazy-loading Redis correction.
   * This is called BEFORE the Lua script so the DB count can be passed as an argument.
   */
  private static async getDbUsedCount(
    settingId: string,
    usageLimitType: string,
    request: RedeemRequest
  ): Promise<number> {
    const usageQuery = db('g_coupon_uses').where('settingId', settingId);
    if (usageLimitType === 'CHARACTER' && request.characterId) {
      usageQuery.where('characterId', request.characterId);
    } else {
      usageQuery.where('userId', request.userId);
    }
    const usageResult = await usageQuery.count('* as count').first();
    return Number(usageResult?.count || 0);
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
      // BUG FIX: Was incorrectly referencing targetChannelsInverted.
      // Subchannels have their own independent inversion flag.
      const isInverted = setting.targetSubchannelsInverted || false;

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

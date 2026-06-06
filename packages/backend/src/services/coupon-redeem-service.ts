import db from '../config/knex';
import { Knex } from 'knex';
import { GatrixError } from '../middleware/error-handler';
import { ulid } from 'ulid';
import { createLogger } from '../config/logger';
import redisClient from '../config/redis';
import { queueService } from './queue-service';
import { CouponRedeemJobPayload } from './jobs/coupon-redeem-job';
import { convertToMySQLDateTime } from '../utils/date-utils';
import {
  resolveSettingCached,
  validateTargetingCached,
  getRewardCached,
  invalidateSettingCache,
} from './coupon-redeem-cache';

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
  /** Expose cache invalidation for CMS use */
  static invalidateSettingCache = invalidateSettingCache;

  /**
   * Redeem a coupon code — Redis-cached critical path.
   * DB queries: 0 on cache hit, 1-2 on first request for a given code.
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

    // --- PHASE 1: Resolve setting from Redis cache (DB only on miss) ---
    const resolved = await resolveSettingCached(code, environmentId);

    if (resolved.setting?.__used) {
      throw new GatrixError(
        'Coupon has already been used',
        409,
        true,
        CouponErrorCode.ALREADY_USED
      );
    }

    if (!resolved.setting) {
      throw new GatrixError(
        'Coupon code not found',
        404,
        true,
        CouponErrorCode.CODE_NOT_FOUND
      );
    }

    const { setting, couponId, isSpecialCoupon } = resolved;

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

    // Check targeting conditions (Redis Sets, DB only on first load)
    const targetingError = await validateTargetingCached(
      environmentId,
      setting.id,
      request,
      setting
    );
    if (targetingError) {
      const errorMap: Record<string, { msg: string; code: string }> = {
        INVALID_WORLD: {
          msg: 'Coupon is not available for this game world',
          code: CouponErrorCode.INVALID_WORLD,
        },
        INVALID_PLATFORM: {
          msg: 'Coupon is not available for this platform',
          code: CouponErrorCode.INVALID_PLATFORM,
        },
        INVALID_CHANNEL: {
          msg: 'Coupon is not available for this channel',
          code: CouponErrorCode.INVALID_CHANNEL,
        },
        INVALID_SUBCHANNEL: {
          msg: 'Coupon is not available for this subchannel',
          code: CouponErrorCode.INVALID_SUBCHANNEL,
        },
        INVALID_USER: {
          msg: 'Coupon is not available for this user',
          code: CouponErrorCode.INVALID_USER,
        },
      };
      const err = errorMap[targetingError] || {
        msg: 'Targeting validation failed',
        code: targetingError,
      };
      throw new GatrixError(err.msg, 422, true, err.code as any);
    }

    // --- PHASE 2: MEGA Redis Atomic Validation (Zero DB Write-Lock) ---
    // We combine Deduplication, Per-User Limits, Global Limits, and Stream buffering
    // into a single atomic Lua script to reduce network round-trips to exactly 1.
    const redis = redisClient.getClient();
    const useId = ulid();
    const usedAtISO = now.toISOString();
    const usedAtMySQL = convertToMySQLDateTime(now)!;

    const NORMAL_COUPON_LOCK_TTL = 60 * 60 * 24 * 90; // 90 days

    const usageLimitType = setting.usageLimitType || 'USER';
    const limitTargetId =
      usageLimitType === 'CHARACTER' && request.characterId
        ? request.characterId
        : request.userId;

    const lockKey = `coupon:redeemed:${environmentId}:${code}`;
    const usageKey = `coupon:usage:${environmentId}:${setting.id}:${limitTargetId}`;
    const globalUsageKey = `coupon:global_usage:${environmentId}:${setting.id}`;
    const streamKey = 'coupon:stream:usage';

    const payload: CouponRedeemJobPayload = {
      useId,
      environmentId,
      settingId: setting.id,
      code,
      couponId: couponId || null,
      settingType: setting.type as 'NORMAL' | 'SPECIAL',
      sequence: 0, // Ignored, will be injected by batch processor
      usedAtMySQL,
      userId: request.userId,
      characterId: request.characterId || null,
      userName: sanitizedUserName,
      worldId: request.worldId || null,
      platform: request.platform || null,
      channel: request.channel || null,
      subchannel: request.subChannel || null,
    };

    const MEGA_LUA = `
      -- MEGA COUPON VALIDATION SCRIPT
      -- KEYS[1] = lockKey, KEYS[2] = usageKey, KEYS[3] = globalUsageKey, KEYS[4] = streamKey
      -- ARGV[1] = useId, ARGV[2] = lockTTL, ARGV[3] = isNormal (1/0), ARGV[4] = dbUsedCount
      -- ARGV[5] = perUserLimit, ARGV[6] = isSpecialCoupon (1/0), ARGV[7] = maxTotalUses
      -- ARGV[8] = dbGlobalCount, ARGV[9] = payloadJSON

      -- Step 1: NORMAL coupon dedup
      if tonumber(ARGV[3]) == 1 then
        local ok = redis.call('SET', KEYS[1], ARGV[1], 'EX', ARGV[2], 'NX')
        if not ok then return {1, 0} end -- 1 = ALREADY_USED
      end

      -- Step 2: Per-user INCR usage
      local seq = redis.call('INCR', KEYS[2])
      if seq == 1 then
        local dbCount = tonumber(ARGV[4])
        if dbCount and dbCount > 0 then
          seq = dbCount + 1
          redis.call('SET', KEYS[2], seq)
        end
      end

      -- Step 3: Check Per-user limit
      if seq > tonumber(ARGV[5]) then
        redis.call('DECR', KEYS[2])
        if tonumber(ARGV[3]) == 1 then redis.call('DEL', KEYS[1]) end
        return {2, seq} -- 2 = USER_LIMIT_EXCEEDED
      end

      -- Step 4: Check Global limit (SPECIAL)
      if tonumber(ARGV[6]) == 1 and tonumber(ARGV[7]) > 0 then
        local gSeq = redis.call('INCR', KEYS[3])
        if gSeq == 1 then
          local gDbCount = tonumber(ARGV[8])
          if gDbCount and gDbCount > 0 then
            gSeq = gDbCount + 1
            redis.call('SET', KEYS[3], gSeq)
          end
        end
        if gSeq > tonumber(ARGV[7]) then
          redis.call('DECR', KEYS[3])
          redis.call('DECR', KEYS[2])
          if tonumber(ARGV[3]) == 1 then redis.call('DEL', KEYS[1]) end
          return {1, seq} -- 1 = ALREADY_USED (Global limit reached)
        end
      end

      -- Step 5: Push to Stream (Append sequence as a separate field to avoid JSON parsing in Lua)
      redis.call('XADD', KEYS[4], '*', 'payload', ARGV[9], 'sequence', seq)

      return {0, seq} -- 0 = SUCCESS
    `;

    // Pipeline EXISTS checks for Lazy Loading
    const pipe = redis.pipeline();
    pipe.exists(usageKey);
    if (isSpecialCoupon && setting.maxTotalUses > 0) {
      pipe.exists(globalUsageKey);
    }
    const existsResults = await pipe.exec();

    let dbUsedCount = 0;
    let dbGlobalCount = 0;

    if (existsResults && existsResults[0] && existsResults[0][1] === 0) {
      dbUsedCount = await this.getDbUsedCount(
        setting.id,
        usageLimitType,
        request
      );
    }
    if (
      isSpecialCoupon &&
      setting.maxTotalUses > 0 &&
      existsResults &&
      existsResults[1] &&
      existsResults[1][1] === 0
    ) {
      const dbSetting = await db('g_coupon_settings')
        .where('id', setting.id)
        .select('usedCount')
        .first();
      dbGlobalCount = Number(dbSetting?.usedCount || 0);
    }

    const [status, sequence] = (await redis.eval(
      MEGA_LUA,
      4,
      lockKey,
      usageKey,
      globalUsageKey,
      streamKey,
      useId,
      String(NORMAL_COUPON_LOCK_TTL),
      isSpecialCoupon ? '0' : '1',
      String(dbUsedCount),
      String(setting.perUserLimit),
      isSpecialCoupon ? '1' : '0',
      String(setting.maxTotalUses || 0),
      String(dbGlobalCount),
      JSON.stringify(payload)
    )) as [number, number];

    if (status === 1) {
      throw new GatrixError(
        'Coupon has already been used',
        409,
        true,
        CouponErrorCode.ALREADY_USED
      );
    }
    if (status === 2) {
      throw new GatrixError(
        'User has reached the usage limit for this coupon',
        409,
        true,
        CouponErrorCode.USER_LIMIT_EXCEEDED
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

    // 5. Build response — reward from Redis cache (DB only on miss)
    const reward = await getRewardCached(environmentId, setting);

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

  /**
   * DB-only coupon redemption (legacy path for benchmark comparison).
   * This method performs the entire validation + write inside a single MySQL transaction.
   * Available only in non-production environments via ?mode=db-only query param.
   *
   * WARNING: This path is susceptible to InnoDB deadlocks under high concurrency
   * because it holds row-level locks on g_coupon_settings during the entire transaction.
   */
  static async redeemCouponDbOnly(
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

    const sanitizedUserName = (request.userName || '').substring(0, 128).trim();
    if (!sanitizedUserName) {
      throw new GatrixError(
        'userName cannot be empty',
        400,
        true,
        CouponErrorCode.INVALID_PARAMETERS
      );
    }

    return db.transaction(async (trx) => {
      // Find coupon
      const coupon = await trx('g_coupons')
        .where('code', code)
        .where('environmentId', environmentId)
        .first();

      let setting: any;
      let isSpecialCoupon = false;
      let couponId: string | null = null;

      if (coupon) {
        couponId = coupon.id;
        if (coupon.status === 'USED') {
          throw new GatrixError(
            'Coupon has already been used',
            409,
            true,
            CouponErrorCode.ALREADY_USED
          );
        }
        setting = await trx('g_coupon_settings')
          .where('id', coupon.settingId)
          .where('environmentId', environmentId)
          .first();
      } else {
        setting = await trx('g_coupon_settings')
          .where('code', code)
          .where('environmentId', environmentId)
          .where('type', 'SPECIAL')
          .first();
        if (setting) isSpecialCoupon = true;
      }

      if (!setting) {
        throw new GatrixError(
          'Coupon code not found',
          404,
          true,
          CouponErrorCode.CODE_NOT_FOUND
        );
      }
      if (setting.status !== 'ACTIVE') {
        throw new GatrixError(
          'Coupon is not active',
          422,
          true,
          CouponErrorCode.NOT_ACTIVE
        );
      }

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

      // Validate targeting inside transaction
      await this.validateTargeting(trx, setting.id, request, setting);

      // Lock the setting row for update
      const lockedSetting = await trx('g_coupon_settings')
        .where('id', setting.id)
        .forUpdate()
        .first();

      // Check per-user usage limit
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
        throw new GatrixError(
          'User has reached the usage limit for this coupon',
          409,
          true,
          CouponErrorCode.USER_LIMIT_EXCEEDED
        );
      }

      // Check global limit for SPECIAL coupons
      if (isSpecialCoupon && setting.maxTotalUses && setting.maxTotalUses > 0) {
        if ((lockedSetting.usedCount || 0) >= setting.maxTotalUses) {
          throw new GatrixError(
            'Coupon has reached its maximum usage limit',
            409,
            true,
            CouponErrorCode.ALREADY_USED
          );
        }
      }

      const usedAtISO = now.toISOString();
      const usedAtMySQL = convertToMySQLDateTime(now)!;

      // Mark NORMAL coupon as used
      if (!isSpecialCoupon && coupon) {
        await trx('g_coupons')
          .where('id', coupon.id)
          .update({ status: 'USED', usedAt: usedAtMySQL });
      }

      // Record usage
      const sequence = userUsedCount + 1;
      const useId = ulid();

      await trx('g_coupon_uses').insert({
        id: useId,
        settingId: setting.id,
        issuedCouponId: couponId,
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

      // Update usedCount
      await trx('g_coupon_settings')
        .where('id', setting.id)
        .increment('usedCount', 1);

      // Build response
      let reward: any[] = [];
      if (setting.rewardTemplateId) {
        const template = await trx('g_reward_templates')
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
    });
  }
}

/**
 * Redis caching layer for coupon redemption.
 * Eliminates DB queries from the critical path by caching setting, targeting, and reward data.
 * CMS mutations call invalidateSettingCache() for immediate consistency.
 */
import db from '../config/knex';
import redisClient from '../config/redis';
import { createLogger } from '../config/logger';

const logger = createLogger('CouponRedeemCache');

// Safety-net TTL. CMS changes trigger immediate invalidation via invalidateSettingCache().
const CACHE_TTL = 600; // 10 minutes

// --- Key helpers ---
const K = {
  setting: (env: string, id: string) => `coupon:s:${env}:${id}`,
  code: (env: string, code: string) => `coupon:c:${env}:${code}`,
  reward: (env: string, id: string) => `coupon:r:${env}:${id}`,
  targetLoaded: (env: string, id: string) => `coupon:tl:${env}:${id}`,
  targetSet: (env: string, id: string, type: string) => `coupon:t:${env}:${id}:${type}`,
};

const TARGET_TYPES = ['worlds', 'platforms', 'channels', 'subchannels', 'users'] as const;

/**
 * Invalidate all Redis caches for a coupon setting.
 * Must be called by CouponSettingsService on create/update/delete.
 */
export async function invalidateSettingCache(
  environmentId: string,
  settingId: string,
  codes?: string[]
): Promise<void> {
  const redis = redisClient.getClient();
  const keys = [
    K.setting(environmentId, settingId),
    K.reward(environmentId, settingId),
    K.targetLoaded(environmentId, settingId),
    ...TARGET_TYPES.map(t => K.targetSet(environmentId, settingId, t)),
  ];
  if (codes) {
    for (const c of codes) keys.push(K.code(environmentId, c));
  }
  if (keys.length > 0) await redis.del(...keys);
  logger.debug('Cache invalidated', { settingId, keys: keys.length });
}

/**
 * Resolve coupon setting. Strategy:
 * - NORMAL: DB lookup for code→couponId (unavoidable, 1:1), then Redis for setting by settingId
 * - SPECIAL: Redis for setting by code (many:1, high cache hit rate)
 * Setting/targeting/reward are always cached by settingId (shared across all codes).
 */
export async function resolveSettingCached(
  code: string,
  environmentId: string
): Promise<{ setting: any; couponId: string | null; isSpecialCoupon: boolean }> {
  const redis = redisClient.getClient();

  // 1. Try SPECIAL coupon first (code == setting.code, highly cacheable)
  const specialCacheKey = K.code(environmentId, code);
  const cachedSettingId = await redis.get(specialCacheKey);
  if (cachedSettingId) {
    // SPECIAL setting cached by code
    const settingData = await redis.get(K.setting(environmentId, cachedSettingId));
    if (settingData) {
      return { setting: JSON.parse(settingData), couponId: null, isSpecialCoupon: true };
    }
  }

  // 2. DB lookup for NORMAL coupon (lightweight read, no lock, no transaction)
  const coupon = await db('g_coupons').where('code', code).where('environmentId', environmentId).first();

  if (coupon) {
    // NORMAL coupon — check status (fast DB read, already indexed)
    if (coupon.status === 'USED') {
      return { setting: { __used: true }, couponId: coupon.id, isSpecialCoupon: false };
    }

    // Try to load setting from Redis by settingId (shared across all codes in same batch)
    const settingCacheKey = K.setting(environmentId, coupon.settingId);
    const cachedSetting = await redis.get(settingCacheKey);
    if (cachedSetting) {
      return { setting: JSON.parse(cachedSetting), couponId: coupon.id, isSpecialCoupon: false };
    }

    // Cache miss — load setting from DB and cache by settingId
    const setting = await db('g_coupon_settings').where('id', coupon.settingId).where('environmentId', environmentId).first();
    if (!setting) return { setting: null, couponId: null, isSpecialCoupon: false };
    await redis.set(settingCacheKey, JSON.stringify(setting), 'EX', CACHE_TTL);
    return { setting, couponId: coupon.id, isSpecialCoupon: false };
  }

  // 3. Not in g_coupons — try SPECIAL coupon in DB
  const specialSetting = await db('g_coupon_settings')
    .where('code', code).where('environmentId', environmentId).where('type', 'SPECIAL').first();
  if (!specialSetting) return { setting: null, couponId: null, isSpecialCoupon: false };

  // Cache SPECIAL: code→settingId mapping + setting data
  const pipe = redis.pipeline();
  pipe.set(specialCacheKey, specialSetting.id, 'EX', CACHE_TTL);
  pipe.set(K.setting(environmentId, specialSetting.id), JSON.stringify(specialSetting), 'EX', CACHE_TTL);
  await pipe.exec();

  return { setting: specialSetting, couponId: null, isSpecialCoupon: true };
}

/**
 * Validate targeting using Redis Sets (DB only on first load).
 */
export async function validateTargetingCached(
  environmentId: string,
  settingId: string,
  request: { worldId?: string; platform?: string; channel?: string; subChannel?: string; userId: string },
  setting: any
): Promise<string | null> {
  const redis = redisClient.getClient();
  const loadedKey = K.targetLoaded(environmentId, settingId);

  if (!(await redis.exists(loadedKey))) {
    // Load from DB into Redis Sets
    const [worlds, platforms, channels, subchannels, users] = await Promise.all([
      db('g_coupon_target_worlds').where('settingId', settingId).select('gameWorldId'),
      db('g_coupon_target_platforms').where('settingId', settingId).select('platform'),
      db('g_coupon_target_channels').where('settingId', settingId).select('channel'),
      db('g_coupon_target_subchannels').where('settingId', settingId).select('subchannel'),
      db('g_coupon_target_users').where('settingId', settingId).select('userId'),
    ]);
    const pipe = redis.pipeline();
    const prefix = (t: string) => K.targetSet(environmentId, settingId, t);
    if (worlds.length > 0) { pipe.sadd(prefix('worlds'), ...worlds.map((w: any) => w.gameWorldId)); pipe.expire(prefix('worlds'), CACHE_TTL); }
    if (platforms.length > 0) { pipe.sadd(prefix('platforms'), ...platforms.map((p: any) => p.platform)); pipe.expire(prefix('platforms'), CACHE_TTL); }
    if (channels.length > 0) { pipe.sadd(prefix('channels'), ...channels.map((c: any) => c.channel)); pipe.expire(prefix('channels'), CACHE_TTL); }
    if (subchannels.length > 0) { pipe.sadd(prefix('subchannels'), ...subchannels.map((s: any) => s.subchannel)); pipe.expire(prefix('subchannels'), CACHE_TTL); }
    if (users.length > 0) { pipe.sadd(prefix('users'), ...users.map((u: any) => u.userId)); pipe.expire(prefix('users'), CACHE_TTL); }
    pipe.set(loadedKey, '1', 'EX', CACHE_TTL);
    await pipe.exec();
  }

  const prefix = (t: string) => K.targetSet(environmentId, settingId, t);

  // Batch EXISTS checks in a single pipeline (1 round-trip instead of 5)
  const existsPipe = redis.pipeline();
  existsPipe.exists(prefix('worlds'));
  existsPipe.exists(prefix('platforms'));
  existsPipe.exists(prefix('channels'));
  existsPipe.exists(prefix('subchannels'));
  existsPipe.exists(prefix('users'));
  const existsResults = await existsPipe.exec();
  const [hasWorlds, hasPlatforms, hasChannels, hasSubchannels, hasUsers] =
    (existsResults || []).map(r => r && r[1] === 1);

  // Only check membership for targeting types that exist
  if (hasWorlds && request.worldId) {
    if (!(await redis.sismember(prefix('worlds'), request.worldId)))
      return 'INVALID_WORLD';
  }
  if (hasPlatforms && request.platform) {
    if (!(await redis.sismember(prefix('platforms'), request.platform)))
      return 'INVALID_PLATFORM';
  }
  if (hasChannels && request.channel) {
    const match = await redis.sismember(prefix('channels'), request.channel);
    const inv = setting.targetChannelsInverted || false;
    if (inv ? match : !match) return 'INVALID_CHANNEL';
  }
  if (hasSubchannels && request.subChannel) {
    const match = await redis.sismember(prefix('subchannels'), request.subChannel);
    const inv = setting.targetSubchannelsInverted || false;
    if (inv ? match : !match) return 'INVALID_SUBCHANNEL';
  }
  if (hasUsers) {
    const match = await redis.sismember(prefix('users'), request.userId);
    const inv = setting.targetUserIdsInverted || false;
    if (inv ? match : !match) return 'INVALID_USER';
  }

  return null; // all passed
}

/**
 * Get reward items from Redis cache, falling back to DB on miss.
 */
export async function getRewardCached(environmentId: string, setting: any): Promise<any[]> {
  const redis = redisClient.getClient();
  const key = K.reward(environmentId, setting.id);

  const cached = await redis.get(key);
  if (cached) return JSON.parse(cached);

  let reward: any[] = [];
  if (setting.rewardTemplateId) {
    const tpl = await db('g_reward_templates')
      .where('id', setting.rewardTemplateId).where('environmentId', environmentId)
      .select('rewardItems').first();
    if (tpl) {
      const items = typeof tpl.rewardItems === 'string' ? JSON.parse(tpl.rewardItems) : tpl.rewardItems;
      if (Array.isArray(items)) {
        reward = items.map((i: any) => ({
          type: parseInt(i.rewardType || i.type || 0),
          id: parseInt(i.itemId || i.id || 0),
          quantity: parseInt(i.quantity || 0),
        }));
      }
    }
  } else if (setting.rewardData) {
    const data = typeof setting.rewardData === 'string' ? JSON.parse(setting.rewardData) : setting.rewardData;
    if (Array.isArray(data)) {
      reward = data.map((i: any) => ({
        type: parseInt(i.rewardType || i.type || 0),
        id: parseInt(i.itemId || i.id || 0),
        quantity: parseInt(i.quantity || 0),
      }));
    }
  }

  await redis.set(key, JSON.stringify(reward), 'EX', CACHE_TTL);
  return reward;
}

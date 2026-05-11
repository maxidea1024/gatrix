import { Job } from 'bullmq';
import { QueueJobData } from '../queue-service';
import db from '../../config/knex';
import { createLogger } from '../../config/logger';

const logger = createLogger('CouponRedeemJob');

export interface CouponRedeemJobPayload {
  useId: string;
  environmentId: string;
  settingId: string;
  code: string;
  couponId: string | null;
  settingType: 'NORMAL' | 'SPECIAL';
  sequence: number;
  usedAtMySQL: string;
  userId: string;
  characterId: string | null;
  userName: string;
  worldId: string | null;
  platform: string | null;
  channel: string | null;
  subchannel: string | null;
}

/**
 * Process async persistence of coupon redemptions
 * This decoupling allows Zero-DB-Lock redemption for the users.
 */
export async function processCouponRedeemJob(
  job: Job<QueueJobData>
): Promise<void> {
  const payload = job.data.payload as CouponRedeemJobPayload;
  logger.info(
    `Processing async coupon redeem for user ${payload.userId}, code ${payload.code}`,
    {
      jobId: job.id,
      useId: payload.useId,
    }
  );

  const trx = await db.transaction();
  try {
    // 1. Update g_coupons (NORMAL only)
    if (payload.settingType === 'NORMAL' && payload.couponId) {
      await trx('g_coupons').where('id', payload.couponId).update({
        status: 'USED',
        usedAt: payload.usedAtMySQL,
        usedByUserId: payload.userId,
        usedByWorldId: payload.worldId,
        usedByCharacterId: payload.characterId,
        usedByPlatform: payload.platform,
        usedByChannel: payload.channel,
      });
    }

    // 2. Insert g_coupon_uses (Idempotent using raw ON DUPLICATE KEY or ignore)
    await trx.raw(
      `
      INSERT IGNORE INTO g_coupon_uses (
        id, settingId, issuedCouponId, userId, characterId, userName,
        sequence, usedAt, gameWorldId, platform, channel, subchannel
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
      [
        payload.useId,
        payload.settingId,
        payload.couponId,
        payload.userId,
        payload.characterId,
        payload.userName,
        payload.sequence,
        payload.usedAtMySQL,
        payload.worldId,
        payload.platform,
        payload.channel,
        payload.subchannel,
      ]
    );

    // 3. Update total usedCount (SPECIAL only)
    //    IDEMPOTENCY: Using COUNT(*) subquery instead of INCREMENT(1) to prevent
    //    double-counting when BullMQ retries this job. If the job committed successfully
    //    but BullMQ didn't receive the "completed" ack (e.g., process crash after commit),
    //    a retry would increment usedCount again. The COUNT approach is inherently
    //    idempotent: it always reflects the true number of usage records.
    if (payload.settingType === 'SPECIAL') {
      await trx.raw(
        `UPDATE g_coupon_settings SET usedCount = (
          SELECT COUNT(*) FROM g_coupon_uses WHERE settingId = ?
        ) WHERE id = ?`,
        [payload.settingId, payload.settingId]
      );
    }

    await trx.commit();
    logger.debug(`Coupon redeem job ${job.id} committed successfully`);
  } catch (error) {
    await trx.rollback();
    logger.error('Failed to persist coupon redeem async:', {
      jobId: job.id,
      error,
    });
    throw error; // Let BullMQ handle retries
  }
}

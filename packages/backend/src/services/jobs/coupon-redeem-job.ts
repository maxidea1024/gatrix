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

  // STEP 1: Transaction for coupon status update + usage record insertion.
  // The usedCount update is intentionally OUTSIDE this transaction to prevent
  // InnoDB deadlocks. Under high concurrency, the previous COUNT(*) subquery
  // inside the transaction caused deadlocks: each transaction acquired a shared
  // lock on g_coupon_uses rows (for COUNT) then tried to acquire an exclusive
  // lock on g_coupon_settings (for UPDATE), creating circular wait conditions.
  let wasInserted = false;

  const trx = await db.transaction();
  try {
    // 1. Update g_coupons status (NORMAL only — marks code as consumed)
    //    User metadata is stored in g_coupon_uses, not in g_coupons.
    if (payload.settingType === 'NORMAL' && payload.couponId) {
      await trx('g_coupons').where('id', payload.couponId).update({
        status: 'USED',
        usedAt: payload.usedAtMySQL,
      });
    }

    // 2. Insert g_coupon_uses (Idempotent via INSERT IGNORE on primary key)
    //    We check affectedRows to determine if this was a genuinely new insert
    //    vs. a duplicate (BullMQ retry of already-committed job).
    const [insertResult] = await trx.raw(
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
    wasInserted = (insertResult?.affectedRows ?? 0) > 0;

    await trx.commit();
  } catch (error) {
    await trx.rollback();
    logger.error('Failed to persist coupon redeem async:', {
      jobId: job.id,
      error,
    });
    throw error; // Let BullMQ handle retries
  }

  // STEP 2: Update usedCount OUTSIDE the transaction.
  // IDEMPOTENCY: Only increment when INSERT IGNORE actually inserted a new row.
  // If this is a BullMQ retry of an already-committed job, affectedRows is 0
  // and we skip the increment — preventing double-counting.
  // DEADLOCK-FREE: A simple `usedCount = usedCount + 1` acquires only a single
  // row-level exclusive lock on g_coupon_settings, with no subquery scanning
  // g_coupon_uses. This eliminates the circular lock dependency that caused
  // deadlocks under high concurrency.
  if (wasInserted) {
    try {
      await db.raw(
        `UPDATE g_coupon_settings SET usedCount = usedCount + 1 WHERE id = ?`,
        [payload.settingId]
      );
    } catch (countError) {
      // Non-fatal: usedCount is a display-only aggregate counter.
      // Redis maintains the authoritative real-time count for concurrency control.
      // The next successful job for this settingId will naturally increment past this.
      // If persistent drift is a concern, a scheduled reconciliation job can fix it.
      logger.warn('Failed to increment usedCount (non-fatal, Redis is authoritative):', {
        jobId: job.id,
        settingId: payload.settingId,
        error: countError,
      });
    }
  } else {
    logger.debug(`Coupon redeem job ${job.id} skipped usedCount increment (duplicate insert)`, {
      useId: payload.useId,
    });
  }

  logger.debug(`Coupon redeem job ${job.id} completed successfully`);
}

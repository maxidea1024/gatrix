import db from '../../config/knex';
import redisClient from '../../config/redis';
import { createLogger } from '../../config/logger';
import { CouponRedeemJobPayload } from './coupon-redeem-job';
import os from 'os';

const logger = createLogger('CouponBatchProcessor');

export class CouponBatchProcessor {
  private isProcessing = false;
  private isRecovering = false;
  private intervalId: NodeJS.Timeout | null = null;
  private recoveryIntervalId: NodeJS.Timeout | null = null;
  private readonly BATCH_SIZE = 1000;
  private readonly STREAM_KEY = 'coupon:stream:usage';
  private readonly GROUP_NAME = 'gatrix_batch_workers';
  private readonly CONSUMER_NAME = `worker-${os.hostname()}-${process.pid}`;

  public async start(intervalMs: number = 2000) {
    if (this.intervalId) return;

    // Initialize Stream Consumer Group
    try {
      const redis = redisClient.getClient();
      // MKSTREAM creates the stream if it doesn't exist
      await redis.xgroup(
        'CREATE',
        this.STREAM_KEY,
        this.GROUP_NAME,
        '0',
        'MKSTREAM'
      );
      logger.info(
        `Initialized Redis Consumer Group '${this.GROUP_NAME}' on stream '${this.STREAM_KEY}'`
      );
    } catch (err: any) {
      if (err.message && err.message.includes('BUSYGROUP')) {
        // Group already exists, which is fine
        logger.debug(`Consumer Group '${this.GROUP_NAME}' already exists.`);
      } else {
        logger.error('Failed to create Redis Consumer Group', { error: err });
      }
    }

    this.intervalId = setInterval(() => this.processBatch(), intervalMs);
    // Run recovery every minute for crashed processes
    this.recoveryIntervalId = setInterval(() => this.recoverPending(), 60000);

    logger.info(
      `Started CouponBatchProcessor (consumer: ${this.CONSUMER_NAME}, batchSize: ${this.BATCH_SIZE})`
    );
  }

  public stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    if (this.recoveryIntervalId) {
      clearInterval(this.recoveryIntervalId);
      this.recoveryIntervalId = null;
    }
  }

  public async processBatch(): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      const redis = redisClient.getClient();

      // Read new messages from the stream
      // > means read messages never delivered to other consumers
      const streams = (await redis.xreadgroup(
        'GROUP',
        this.GROUP_NAME,
        this.CONSUMER_NAME,
        'COUNT',
        this.BATCH_SIZE,
        'BLOCK',
        10, // Minimal block to prevent tight loop, but keep responsive
        'STREAMS',
        this.STREAM_KEY,
        '>'
      )) as any;

      if (!streams || streams.length === 0) {
        this.isProcessing = false;
        return;
      }

      const stream = streams[0]; // We only requested one stream
      const messages = stream[1]; // Array of [id, fields]

      if (!messages || messages.length === 0) {
        this.isProcessing = false;
        return;
      }

      await this.processMessages(messages);
    } catch (error) {
      logger.error('Error in CouponBatchProcessor.processBatch', { error });
    } finally {
      this.isProcessing = false;
    }
  }

  public async recoverPending(): Promise<void> {
    if (this.isRecovering) return;
    this.isRecovering = true;
    try {
      const redis = redisClient.getClient();
      // Auto-claim messages pending for more than 30 seconds
      // MINID - means start from the very beginning of pending
      const claimRes = (await redis.xautoclaim(
        this.STREAM_KEY,
        this.GROUP_NAME,
        this.CONSUMER_NAME,
        30000,
        '-',
        'COUNT',
        this.BATCH_SIZE
      )) as any;

      const messages = claimRes[1];
      if (messages && messages.length > 0) {
        logger.info(
          `Recovered ${messages.length} pending messages from crashed consumers`
        );
        await this.processMessages(messages);
      }
    } catch (error) {
      logger.error('Error recovering pending stream messages', { error });
    } finally {
      this.isRecovering = false;
    }
  }

  private async processMessages(messages: any[]): Promise<void> {
    const redis = redisClient.getClient();
    const payloads: CouponRedeemJobPayload[] = [];
    const messageIds: string[] = [];

    for (const [id, fields] of messages) {
      messageIds.push(id);
      // Redis streams fields are stored as key-value pairs in an array: ['payload', '{...}', 'sequence', '1']
      const payloadIndex = fields.indexOf('payload');
      const sequenceIndex = fields.indexOf('sequence');
      if (payloadIndex !== -1 && fields[payloadIndex + 1]) {
        try {
          const payload = JSON.parse(fields[payloadIndex + 1]);
          if (sequenceIndex !== -1 && fields[sequenceIndex + 1]) {
            payload.sequence = parseInt(fields[sequenceIndex + 1], 10);
          }
          payloads.push(payload);
        } catch (e) {
          logger.error('Failed to parse stream message payload', {
            messageId: id,
          });
        }
      }
    }
    logger.info(`Processing coupon batch of ${payloads.length} items`);

    const trx = await db.transaction();
    try {
      // 1. Bulk Insert into g_coupon_uses
      const insertData = payloads.map((p) => ({
        id: p.useId,
        settingId: p.settingId,
        issuedCouponId: p.couponId,
        userId: p.userId,
        characterId: p.characterId,
        userName: p.userName,
        sequence: p.sequence,
        usedAt: p.usedAtMySQL,
        gameWorldId: p.worldId,
        platform: p.platform,
        channel: p.channel,
        subchannel: p.subchannel,
      }));

      // Use insert() with ON DUPLICATE KEY UPDATE id=id (equivalent to INSERT IGNORE in Knex)
      await trx('g_coupon_uses').insert(insertData).onConflict('id').ignore();

      // 2. Bulk Update g_coupons status (NORMAL coupons only)
      const normalCouponIds = payloads
        .filter((p) => p.settingType === 'NORMAL' && p.couponId)
        .map((p) => p.couponId as string);

      if (normalCouponIds.length > 0) {
        await trx('g_coupons').whereIn('id', normalCouponIds).update({
          status: 'USED',
          usedAt: db.fn.now(),
        });
      }

      // 3. Aggregate used counts per setting and update
      const countsPerSetting = payloads.reduce(
        (acc, p) => {
          acc[p.settingId] = (acc[p.settingId] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      );

      for (const [settingId, count] of Object.entries(countsPerSetting)) {
        await trx('g_coupon_settings')
          .where('id', settingId)
          .increment('usedCount', count);
      }

      await trx.commit();

      // 4. Acknowledge and delete messages only AFTER successful commit
      if (messageIds.length > 0) {
        const pipeline = redis.pipeline();
        pipeline.xack(this.STREAM_KEY, this.GROUP_NAME, ...messageIds);
        // Optional: xdel to save memory, or let XTRIM handle it later
        pipeline.xdel(this.STREAM_KEY, ...messageIds);
        await pipeline.exec();
      }

      logger.info(
        `Successfully committed coupon batch of ${payloads.length} items`
      );
    } catch (dbError) {
      await trx.rollback();
      logger.error(
        'Failed to commit coupon batch. Messages will remain pending in Redis Stream for recovery',
        { error: dbError }
      );
      // DO NOT XACK here. The messages will remain in PEL (Pending Entries List)
      // and will be retried automatically by recoverPending() after the timeout.
    }
  }
}

export const couponBatchProcessor = new CouponBatchProcessor();

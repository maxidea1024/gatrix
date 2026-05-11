import db from '../../config/knex';
import redisClient from '../../config/redis';
import { createLogger } from '../../config/logger';
import os from 'os';
import { ulid } from 'ulid';

const logger = createLogger('SurveyLogBatchProcessor');

export interface SurveyLogPayload {
  environmentId: string;
  surveyId: string;
  action: 'JOINED' | 'SENT';
  accountId: string;
  characterId?: string;
  userName?: string;
  worldId?: string;
  platform?: string;
  channel?: string;
  subchannel?: string;
  createdAtMySQL: string;
}

export class SurveyLogBatchProcessor {
  private isProcessing = false;
  private isRecovering = false;
  private intervalId: NodeJS.Timeout | null = null;
  private recoveryIntervalId: NodeJS.Timeout | null = null;
  private readonly BATCH_SIZE = parseInt(process.env.SURVEY_LOG_BATCH_SIZE || '1000', 10);
  private readonly STREAM_KEY = 'survey:stream:logs';
  private readonly GROUP_NAME = 'gatrix_survey_log_workers';
  private readonly CONSUMER_NAME = `worker-${os.hostname()}-${process.pid}`;

  public async start(intervalMs: number = 2000) {
    if (this.intervalId) return;

    // Initialize Stream Consumer Group
    try {
      const redis = redisClient.getClient();
      await redis.xgroup('CREATE', this.STREAM_KEY, this.GROUP_NAME, '0', 'MKSTREAM');
      logger.info(`Initialized Redis Consumer Group '${this.GROUP_NAME}' on stream '${this.STREAM_KEY}'`);
    } catch (err: any) {
      if (err.message && err.message.includes('BUSYGROUP')) {
        logger.debug(`Consumer Group '${this.GROUP_NAME}' already exists.`);
      } else {
        logger.error('Failed to create Redis Consumer Group', { error: err });
      }
    }

    this.intervalId = setInterval(() => this.processBatch(), intervalMs);
    // Run recovery every minute for crashed processes
    this.recoveryIntervalId = setInterval(() => this.recoverPending(), 60000);
    
    logger.info(`Started SurveyLogBatchProcessor (consumer: ${this.CONSUMER_NAME}, batchSize: ${this.BATCH_SIZE})`);
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
      const streams = await redis.xreadgroup(
        'GROUP', this.GROUP_NAME, this.CONSUMER_NAME,
        'COUNT', this.BATCH_SIZE,
        'BLOCK', 10,
        'STREAMS', this.STREAM_KEY, '>'
      ) as any;

      if (!streams || streams.length === 0) {
        this.isProcessing = false;
        return;
      }

      const stream = streams[0];
      const messages = stream[1];

      if (!messages || messages.length === 0) {
        this.isProcessing = false;
        return;
      }

      await this.processMessages(messages);

    } catch (error) {
      logger.error('Error in SurveyLogBatchProcessor.processBatch', { error });
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
      const claimRes = await redis.xautoclaim(
        this.STREAM_KEY, this.GROUP_NAME, this.CONSUMER_NAME,
        30000, '-', 'COUNT', this.BATCH_SIZE
      ) as any;
      
      const messages = claimRes[1];
      if (messages && messages.length > 0) {
        logger.info(`Recovered ${messages.length} pending messages from crashed consumers`);
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
    const payloads: SurveyLogPayload[] = [];
    const messageIds: string[] = [];

    for (const [id, fields] of messages) {
      messageIds.push(id);
      const payloadIndex = fields.indexOf('payload');
      if (payloadIndex !== -1 && fields[payloadIndex + 1]) {
        try {
          const payload = JSON.parse(fields[payloadIndex + 1]);
          payloads.push(payload);
        } catch (e) {
          logger.error('Failed to parse stream message payload', { messageId: id });
        }
      }
    }

    if (payloads.length === 0) {
        // Ack invalid messages so they don't block
        if (messageIds.length > 0) {
            await redis.xack(this.STREAM_KEY, this.GROUP_NAME, ...messageIds);
        }
        return;
    }

    logger.info(`Processing survey log batch of ${payloads.length} items`);

    const trx = await db.transaction();
    try {
      // 1. Bulk Insert into g_survey_logs
      const insertData = payloads.map(p => ({
        id: ulid(),
        environmentId: p.environmentId,
        surveyId: p.surveyId,
        action: p.action,
        accountId: p.accountId,
        characterId: p.characterId || null,
        userName: p.userName || null,
        worldId: p.worldId || null,
        platform: p.platform || null,
        channel: p.channel || null,
        subchannel: p.subchannel || null,
        createdAt: p.createdAtMySQL,
      }));
      
      // Use insert() with ignore() for safe bulk insert
      await trx('g_survey_logs')
        .insert(insertData)
        .onConflict('id')
        .ignore();

      await trx.commit();
      
      // 2. Acknowledge and delete messages
      if (messageIds.length > 0) {
        const pipeline = redis.pipeline();
        pipeline.xack(this.STREAM_KEY, this.GROUP_NAME, ...messageIds);
        pipeline.xdel(this.STREAM_KEY, ...messageIds);
        await pipeline.exec();
      }

      logger.info(`Successfully committed survey log batch of ${payloads.length} items`);
    } catch (dbError) {
      await trx.rollback();
      logger.error('Failed to commit survey log batch. Messages will remain pending.', { error: dbError });
    }
  }
}

export const surveyLogBatchProcessor = new SurveyLogBatchProcessor();

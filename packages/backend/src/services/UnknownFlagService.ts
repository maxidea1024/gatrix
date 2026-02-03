/**
 * Unknown Flag Service
 * Handles reporting and management of unknown feature flag accesses
 * Uses Redis for buffering with scheduled flush to DB (handles high volume)
 */

import db from '../config/knex';
import logger from '../config/logger';
import redisClient from '../config/redis';

// Redis key prefix for unknown flags buffer
const REDIS_KEY_PREFIX = 'unknown_flags:buffer:';
const REDIS_METADATA_PREFIX = 'unknown_flags:meta:';

export interface UnknownFlag {
  id: number;
  flagName: string;
  environment: string;
  appName: string | null;
  sdkVersion: string | null;
  accessCount: number;
  firstReportedAt: Date;
  lastReportedAt: Date;
  isResolved: boolean;
  resolvedAt: Date | null;
  resolvedBy: string | null;
}

export interface ReportUnknownFlagInput {
  flagName: string;
  environment: string;
  appName?: string;
  sdkVersion?: string;
}

export class UnknownFlagService {
  /**
   * Report an unknown flag access (called from SDK)
   * Buffers in Redis using HINCRBY for efficient counting
   * Flush happens via scheduled job
   */
  async reportUnknownFlag(input: ReportUnknownFlagInput): Promise<void> {
    try {
      const client = redisClient.getClient();

      // Create unique key for this flag + environment combo
      const bufferKey = `${REDIS_KEY_PREFIX}${input.environment}:${input.flagName}`;
      const metadataKey = `${REDIS_METADATA_PREFIX}${input.environment}:${input.flagName}`;

      // Increment count in Redis (atomic operation, handles high volume)
      await client.hIncrBy(bufferKey, 'count', 1);

      // Store metadata (will be overwritten if already exists, which is fine)
      if (input.appName || input.sdkVersion) {
        const metadata: Record<string, string> = {};
        if (input.appName) metadata.appName = input.appName;
        if (input.sdkVersion) metadata.sdkVersion = input.sdkVersion;
        await client.hSet(metadataKey, metadata);
      }

      // Set TTL to expire old data (24 hours) - auto cleanup if not flushed
      await client.expire(bufferKey, 86400);
      await client.expire(metadataKey, 86400);

      logger.debug('Unknown flag buffered in Redis', {
        flagName: input.flagName,
        environment: input.environment,
      });
    } catch (error) {
      logger.error('Failed to buffer unknown flag in Redis', { error, input });
      // Fallback to direct DB write if Redis fails
      await this.directDbReport(input);
    }
  }

  /**
   * Fallback to direct DB write if Redis is unavailable
   */
  private async directDbReport(input: ReportUnknownFlagInput): Promise<void> {
    const updated = await db('unknown_flags')
      .where({
        flagName: input.flagName,
        environment: input.environment,
      })
      .update({
        accessCount: db.raw('accessCount + 1'),
        lastReportedAt: db.raw('UTC_TIMESTAMP()'),
        appName: input.appName || db.raw('appName'),
        sdkVersion: input.sdkVersion || db.raw('sdkVersion'),
      });

    if (updated === 0) {
      await db('unknown_flags').insert({
        flagName: input.flagName,
        environment: input.environment,
        appName: input.appName || null,
        sdkVersion: input.sdkVersion || null,
        accessCount: 1,
        firstReportedAt: db.raw('UTC_TIMESTAMP()'),
        lastReportedAt: db.raw('UTC_TIMESTAMP()'),
        isResolved: false,
      });
    }
  }

  /**
   * Flush buffered data from Redis to DB
   * Called by scheduled job (e.g., every minute)
   */
  async flushBufferToDb(): Promise<{ flushed: number; errors: number }> {
    const client = redisClient.getClient();
    let flushed = 0;
    let errors = 0;

    try {
      // Find all buffer keys
      const bufferKeys = await client.keys(`${REDIS_KEY_PREFIX}*`);

      for (const bufferKey of bufferKeys) {
        try {
          // Extract environment and flagName from key
          const keyParts = bufferKey.replace(REDIS_KEY_PREFIX, '').split(':');
          if (keyParts.length < 2) continue;

          const environment = keyParts[0];
          const flagName = keyParts.slice(1).join(':'); // flagName might contain ":"

          // Get count and delete atomically using GETDEL (or GET + DEL)
          const countData = await client.hGetAll(bufferKey);
          const count = parseInt(countData.count || '0', 10);

          if (count === 0) {
            await client.del(bufferKey);
            continue;
          }

          // Get metadata
          const metadataKey = `${REDIS_METADATA_PREFIX}${environment}:${flagName}`;
          const metadata = await client.hGetAll(metadataKey);

          // Delete keys first (to avoid double counting on retry)
          await client.del(bufferKey);
          await client.del(metadataKey);

          // Upsert to database
          await this.upsertToDb({
            flagName,
            environment,
            appName: metadata.appName || null,
            sdkVersion: metadata.sdkVersion || null,
            count,
          });

          flushed++;
          logger.debug('Flushed unknown flag to DB', { flagName, environment, count });
        } catch (error) {
          errors++;
          logger.error('Failed to flush buffer key', { bufferKey, error });
        }
      }

      if (flushed > 0 || errors > 0) {
        logger.info('Unknown flags buffer flush completed', { flushed, errors });
      }
    } catch (error) {
      logger.error('Failed to flush unknown flags buffer', { error });
    }

    return { flushed, errors };
  }

  /**
   * Upsert aggregated data to database
   */
  private async upsertToDb(data: {
    flagName: string;
    environment: string;
    appName: string | null;
    sdkVersion: string | null;
    count: number;
  }): Promise<void> {
    const updated = await db('unknown_flags')
      .where({
        flagName: data.flagName,
        environment: data.environment,
      })
      .update({
        accessCount: db.raw(`accessCount + ${data.count}`),
        lastReportedAt: db.raw('UTC_TIMESTAMP()'),
        appName: data.appName || db.raw('appName'),
        sdkVersion: data.sdkVersion || db.raw('sdkVersion'),
      });

    if (updated === 0) {
      await db('unknown_flags').insert({
        flagName: data.flagName,
        environment: data.environment,
        appName: data.appName,
        sdkVersion: data.sdkVersion,
        accessCount: data.count,
        firstReportedAt: db.raw('UTC_TIMESTAMP()'),
        lastReportedAt: db.raw('UTC_TIMESTAMP()'),
        isResolved: false,
      });
    }
  }

  /**
   * Get all unknown flags
   */
  async getUnknownFlags(
    options: {
      includeResolved?: boolean;
      environment?: string;
      limit?: number;
    } = {}
  ): Promise<UnknownFlag[]> {
    let query = db('unknown_flags').select('*');

    if (!options.includeResolved) {
      query = query.where('isResolved', false);
    }

    if (options.environment) {
      query = query.where('environment', options.environment);
    }

    query = query.orderBy('lastReportedAt', 'desc');

    if (options.limit) {
      query = query.limit(options.limit);
    }

    return query;
  }

  /**
   * Resolve an unknown flag (mark as handled)
   */
  async resolveUnknownFlag(id: number, resolvedBy: string): Promise<void> {
    await db('unknown_flags')
      .where({ id })
      .update({
        isResolved: true,
        resolvedAt: db.raw('UTC_TIMESTAMP()'),
        resolvedBy,
      });
  }

  /**
   * Unresolve an unknown flag (mark as unresolved again)
   */
  async unresolveUnknownFlag(id: number): Promise<void> {
    await db('unknown_flags').where({ id }).update({
      isResolved: false,
      resolvedAt: null,
      resolvedBy: null,
    });
  }

  /**
   * Delete an unknown flag record
   */
  async deleteUnknownFlag(id: number): Promise<void> {
    await db('unknown_flags').where({ id }).delete();
  }

  /**
   * Get count of unresolved unknown flags
   */
  async getUnresolvedCount(): Promise<number> {
    const result = await db('unknown_flags')
      .where('isResolved', false)
      .count('id as count')
      .first();
    return Number(result?.count || 0);
  }

  /**
   * Get buffer statistics from Redis
   */
  async getBufferStats(): Promise<{ bufferedCount: number }> {
    try {
      const client = redisClient.getClient();
      const bufferKeys = await client.keys(`${REDIS_KEY_PREFIX}*`);
      return { bufferedCount: bufferKeys.length };
    } catch {
      return { bufferedCount: 0 };
    }
  }
}

export const unknownFlagService = new UnknownFlagService();

/**
 * Scheduled job handler for flushing buffer
 * Register this in QueueService scheduler
 */
export async function processUnknownFlagsFlushJob(): Promise<{ flushed: number; errors: number }> {
  return unknownFlagService.flushBufferToDb();
}

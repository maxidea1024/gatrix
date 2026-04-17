/**
 * Unknown Flag Service
 * Handles reporting and management of unknown feature flag accesses
 * Uses Redis for buffering with scheduled flush to DB (handles high volume)
 */

import db from '../config/knex';
import { createLogger } from '../config/logger';

const logger = createLogger('UnknownFlagService');
import redisClient from '../config/redis';

// Redis key prefix for unknown flags buffer
const REDIS_KEY_PREFIX = 'unknown_flags:buffer:';
const REDIS_METADATA_PREFIX = 'unknown_flags:meta:';

export interface UnknownFlag {
  id: string;
  flagName: string;
  environmentId: string;
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
  environmentId: string;
  appName?: string;
  sdkVersion?: string;
  count?: number;
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
      const count = input.count || 1;

      // Create unique key for this flag + environment + app combo
      // Include appName in key to prevent merging data from different applications
      const safeAppName = input.appName || '__none__';
      const bufferKey = `${REDIS_KEY_PREFIX}${input.environmentId}:${safeAppName}:${input.flagName}`;
      const metadataKey = `${REDIS_METADATA_PREFIX}${input.environmentId}:${safeAppName}:${input.flagName}`;

      // Increment count in Redis (atomic operation, handles high volume)
      await client.hincrby(bufferKey, 'count', count);

      // Store metadata (sdkVersion may vary per request, last writer wins which is acceptable)
      if (input.sdkVersion) {
        await client.hset(metadataKey, 'sdkVersion', input.sdkVersion);
      }

      // Set TTL to expire old data (24 hours) - auto cleanup if not flushed
      await client.expire(bufferKey, 86400);
      await client.expire(metadataKey, 86400);

      logger.debug('Unknown flag buffered in Redis', {
        flagName: input.flagName,
        environmentId: input.environmentId,
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
    const count = input.count || 1;
    const updated = await db('g_unknown_flags')
      .where({
        flagName: input.flagName,
        environmentId: input.environmentId,
        appName: input.appName || null,
        sdkVersion: input.sdkVersion || null,
      })
      .update({
        accessCount: db.raw(`accessCount + ${count}`),
        lastReportedAt: db.raw('UTC_TIMESTAMP()'),
      });

    if (updated === 0) {
      await db('g_unknown_flags').insert({
        flagName: input.flagName,
        environmentId: input.environmentId,
        appName: input.appName || null,
        sdkVersion: input.sdkVersion || null,
        accessCount: count,
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
          // Extract environment, appName, and flagName from key
          // Key format: prefix + environmentId:appName:flagName
          const keyParts = bufferKey.replace(REDIS_KEY_PREFIX, '').split(':');
          if (keyParts.length < 3) continue;

          const environmentId = keyParts[0];
          const rawAppName = keyParts[1];
          const appName = rawAppName === '__none__' ? null : rawAppName;
          const flagName = keyParts.slice(2).join(':'); // flagName might contain ":"

          // Get count and delete atomically using GETDEL (or GET + DEL)
          const countData = await client.hgetall(bufferKey);
          const count = parseInt(countData.count || '0', 10);

          if (count === 0) {
            await client.del(bufferKey);
            continue;
          }

          // Get metadata (sdkVersion)
          const metadataKey = `${REDIS_METADATA_PREFIX}${environmentId}:${rawAppName}:${flagName}`;
          const metadata = await client.hgetall(metadataKey);

          // Delete keys first (to avoid double counting on retry)
          await client.del(bufferKey);
          await client.del(metadataKey);

          // Upsert to database — appName is now correctly parsed from key
          await this.upsertToDb({
            flagName,
            environmentId,
            appName,
            sdkVersion: metadata.sdkVersion || null,
            count,
          });

          flushed++;
          logger.debug('Flushed unknown flag to DB', {
            flagName,
            environmentId,
            appName,
            count,
          });
        } catch (error) {
          errors++;
          logger.error('Failed to flush buffer key', { bufferKey, error });
        }
      }

      if (flushed > 0 || errors > 0) {
        logger.info('Unknown flags buffer flush completed', {
          flushed,
          errors,
        });
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
    environmentId: string;
    appName: string | null;
    sdkVersion: string | null;
    count: number;
  }): Promise<void> {
    const updated = await db('g_unknown_flags')
      .where({
        flagName: data.flagName,
        environmentId: data.environmentId,
        appName: data.appName,
        sdkVersion: data.sdkVersion,
      })
      .update({
        accessCount: db.raw(`accessCount + ${data.count}`),
        lastReportedAt: db.raw('UTC_TIMESTAMP()'),
      });

    if (updated === 0) {
      await db('g_unknown_flags').insert({
        flagName: data.flagName,
        environmentId: data.environmentId,
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
      environmentId?: string;
      limit?: number;
    } = {}
  ): Promise<UnknownFlag[]> {
    let query = db('g_unknown_flags')
      .select(
        'g_unknown_flags.*',
        'g_environments.displayName as environmentName',
        'g_projects.displayName as projectName',
        'g_organisations.displayName as orgName'
      )
      .leftJoin(
        'g_environments',
        'g_unknown_flags.environmentId',
        'g_environments.id'
      )
      .leftJoin('g_projects', 'g_environments.projectId', 'g_projects.id')
      .leftJoin('g_organisations', 'g_projects.orgId', 'g_organisations.id');

    if (!options.includeResolved) {
      query = query.where('g_unknown_flags.isResolved', false);
    }

    if (options.environmentId) {
      query = query.where(
        'g_unknown_flags.environmentId',
        options.environmentId
      );
    }

    query = query.orderBy('g_unknown_flags.lastReportedAt', 'desc');

    if (options.limit) {
      query = query.limit(options.limit);
    }

    return query;
  }

  /**
   * Resolve an unknown flag (mark as handled)
   */
  async resolveUnknownFlag(id: string, resolvedBy: string): Promise<void> {
    await db('g_unknown_flags')
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
  async unresolveUnknownFlag(id: string): Promise<void> {
    await db('g_unknown_flags').where({ id }).update({
      isResolved: false,
      resolvedAt: null,
      resolvedBy: null,
    });
  }

  /**
   * Delete an unknown flag record
   */
  async deleteUnknownFlag(id: string): Promise<void> {
    await db('g_unknown_flags').where({ id }).delete();
  }

  /**
   * Get count of unresolved unknown flags
   */
  async getUnresolvedCount(): Promise<number> {
    const result = await db('g_unknown_flags')
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
export async function processUnknownFlagsFlushJob(): Promise<{
  flushed: number;
  errors: number;
}> {
  return unknownFlagService.flushBufferToDb();
}

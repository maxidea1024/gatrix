/**
 * Context Field Usage Service
 * Tracks which context fields are being used in SDK flag evaluations.
 * Uses Redis for buffering with scheduled flush to DB (handles high volume).
 * Pattern follows unknown-flag-service.ts
 */

import db from '../config/knex';
import { createLogger } from '../config/logger';

const logger = createLogger('ContextFieldUsageService');
import redisClient from '../config/redis';
import { ulid } from 'ulid';

// Redis key prefix for context field usage buffer
const REDIS_KEY_PREFIX = 'ctx_field_usage:buffer:';

export interface ContextFieldUsageRecord {
  id: string;
  projectId: string;
  environmentId: string;
  fieldName: string;
  appName: string | null;
  sdkVersion: string | null;
  accessCount: number;
  firstSeenAt: Date;
  lastSeenAt: Date;
  description: string | null;
  tags: string[] | null;
  isIgnored: boolean;
}

export interface ReportContextFieldUsageInput {
  projectId: string;
  environmentId: string;
  appName?: string;
  sdkVersion?: string;
  fieldNames: string[];
  counts?: Record<string, number>;
}

export class ContextFieldUsageService {
  /**
   * Report context field usage (called from eval endpoints / Edge flush)
   * Buffers in Redis using HINCRBY for efficient counting
   */
  async reportContextFields(
    input: ReportContextFieldUsageInput
  ): Promise<void> {
    try {
      const client = redisClient.getClient();
      const safeAppName = input.appName || '__none__';

      for (const fieldName of input.fieldNames) {
        const count = input.counts?.[fieldName] || 1;
        const bufferKey = `${REDIS_KEY_PREFIX}${input.projectId}:${input.environmentId}:${safeAppName}:${fieldName}`;

        // Increment count in Redis (atomic operation)
        await client.hincrby(bufferKey, 'count', count);

        // Store metadata (last writer wins, acceptable)
        if (input.sdkVersion) {
          await client.hset(bufferKey, 'sdkVersion', input.sdkVersion);
        }

        // Set TTL to expire old data (24 hours) - auto cleanup if not flushed
        await client.expire(bufferKey, 86400);
      }

      logger.debug('Context field usage buffered in Redis', {
        projectId: input.projectId,
        environmentId: input.environmentId,
        fieldCount: input.fieldNames.length,
      });
    } catch (error) {
      logger.error('Failed to buffer context field usage in Redis', {
        error,
        input: {
          projectId: input.projectId,
          environmentId: input.environmentId,
          fieldCount: input.fieldNames.length,
        },
      });
      // Fallback to direct DB write
      await this.directDbReport(input);
    }
  }

  /**
   * Fallback to direct DB write if Redis is unavailable
   */
  private async directDbReport(
    input: ReportContextFieldUsageInput
  ): Promise<void> {
    for (const fieldName of input.fieldNames) {
      const count = input.counts?.[fieldName] || 1;
      await this.upsertToDb({
        projectId: input.projectId,
        environmentId: input.environmentId,
        fieldName,
        appName: input.appName || null,
        sdkVersion: input.sdkVersion || null,
        count,
      });
    }
  }

  /**
   * Flush buffered data from Redis to DB
   * Called by scheduled job (every minute)
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
          // Extract projectId, environmentId, appName, and fieldName from key
          // Key format: prefix + projectId:environmentId:appName:fieldName
          const keyParts = bufferKey.replace(REDIS_KEY_PREFIX, '').split(':');
          if (keyParts.length < 4) continue;

          const projectId = keyParts[0];
          const environmentId = keyParts[1];
          const rawAppName = keyParts[2];
          const appName = rawAppName === '__none__' ? null : rawAppName;
          const fieldName = keyParts.slice(3).join(':'); // fieldName might contain ":"

          // Get count and metadata
          const data = await client.hgetall(bufferKey);
          const count = parseInt(data.count || '0', 10);

          if (count === 0) {
            await client.del(bufferKey);
            continue;
          }

          // Delete key first (to avoid double counting on retry)
          await client.del(bufferKey);

          // Upsert to database
          await this.upsertToDb({
            projectId,
            environmentId,
            fieldName,
            appName,
            sdkVersion: data.sdkVersion || null,
            count,
          });

          flushed++;
          logger.debug('Flushed context field usage to DB', {
            projectId,
            environmentId,
            fieldName,
            appName,
            count,
          });
        } catch (error) {
          errors++;
          logger.error('Failed to flush context field usage buffer key', {
            bufferKey,
            error,
          });
        }
      }

      if (flushed > 0 || errors > 0) {
        logger.info('Context field usage buffer flush completed', {
          flushed,
          errors,
        });
      }
    } catch (error) {
      logger.error('Failed to flush context field usage buffer', { error });
    }

    return { flushed, errors };
  }

  /**
   * Upsert aggregated data to database
   */
  private async upsertToDb(data: {
    projectId: string;
    environmentId: string;
    fieldName: string;
    appName: string | null;
    sdkVersion: string | null;
    count: number;
  }): Promise<void> {
    // Try update first
    const updated = await db('g_context_field_usage')
      .where({
        projectId: data.projectId,
        environmentId: data.environmentId,
        fieldName: data.fieldName,
        appName: data.appName,
      })
      .update({
        accessCount: db.raw(`accessCount + ${data.count}`),
        lastSeenAt: db.raw('UTC_TIMESTAMP()'),
        sdkVersion: data.sdkVersion,
      });

    if (updated === 0) {
      // Insert new record
      try {
        await db('g_context_field_usage').insert({
          id: ulid(),
          projectId: data.projectId,
          environmentId: data.environmentId,
          fieldName: data.fieldName,
          appName: data.appName,
          sdkVersion: data.sdkVersion,
          accessCount: data.count,
          firstSeenAt: db.raw('UTC_TIMESTAMP()'),
          lastSeenAt: db.raw('UTC_TIMESTAMP()'),
          isIgnored: false,
        });
      } catch (err: any) {
        // Handle race condition: if another process inserted between our check and insert
        if (err.code === 'ER_DUP_ENTRY') {
          await db('g_context_field_usage')
            .where({
              projectId: data.projectId,
              environmentId: data.environmentId,
              fieldName: data.fieldName,
              appName: data.appName,
            })
            .update({
              accessCount: db.raw(`accessCount + ${data.count}`),
              lastSeenAt: db.raw('UTC_TIMESTAMP()'),
              sdkVersion: data.sdkVersion,
            });
        } else {
          throw err;
        }
      }
    }
  }

  /**
   * Get discovered context fields for a project
   */
  async getDiscoveredFields(
    projectId: string,
    options: {
      environmentId?: string;
      appName?: string;
      includeIgnored?: boolean;
      search?: string;
    } = {}
  ): Promise<ContextFieldUsageRecord[]> {
    let query = db('g_context_field_usage')
      .where('g_context_field_usage.projectId', projectId)
      .select(
        'g_context_field_usage.*',
        'g_environments.displayName as environmentName'
      )
      .leftJoin(
        'g_environments',
        'g_context_field_usage.environmentId',
        'g_environments.id'
      );

    if (!options.includeIgnored) {
      query = query.where('g_context_field_usage.isIgnored', false);
    }

    if (options.environmentId) {
      query = query.where(
        'g_context_field_usage.environmentId',
        options.environmentId
      );
    }

    if (options.appName) {
      query = query.where('g_context_field_usage.appName', options.appName);
    }

    if (options.search) {
      query = query.where((qb: any) => {
        qb.where(
          'g_context_field_usage.fieldName',
          'like',
          `%${options.search}%`
        ).orWhere(
          'g_context_field_usage.description',
          'like',
          `%${options.search}%`
        );
      });
    }

    query = query.orderBy('g_context_field_usage.lastSeenAt', 'desc');

    const rows = await query;

    return rows.map((r: any) => ({
      ...r,
      isIgnored: Boolean(r.isIgnored),
      tags: r.tags
        ? typeof r.tags === 'string'
          ? JSON.parse(r.tags)
          : r.tags
        : [],
    }));
  }

  /**
   * Get distinct app names used in context field usage for a project
   */
  async getAppNames(projectId: string): Promise<string[]> {
    const result = await db('g_context_field_usage')
      .where('projectId', projectId)
      .whereNotNull('appName')
      .distinct('appName')
      .orderBy('appName', 'asc');

    return result.map((r: any) => r.appName);
  }

  /**
   * Get distinct environment IDs used in context field usage for a project
   */
  async getEnvironmentIds(projectId: string): Promise<string[]> {
    const result = await db('g_context_field_usage')
      .where('projectId', projectId)
      .distinct('environmentId')
      .orderBy('environmentId', 'asc');

    return result.map((r: any) => r.environmentId);
  }

  /**
   * Update metadata for a discovered context field
   */
  async updateFieldMeta(
    id: string,
    data: {
      description?: string;
      tags?: string[];
      isIgnored?: boolean;
    }
  ): Promise<void> {
    const updateData: any = {};

    if (data.description !== undefined)
      updateData.description = data.description;
    if (data.tags !== undefined) updateData.tags = JSON.stringify(data.tags);
    if (data.isIgnored !== undefined) updateData.isIgnored = data.isIgnored;

    await db('g_context_field_usage').where({ id }).update(updateData);
  }

  /**
   * Delete a discovered context field record
   */
  async deleteField(id: string): Promise<void> {
    await db('g_context_field_usage').where({ id }).delete();
  }

  /**
   * Infer field type from field name for promote functionality
   */
  inferFieldType(fieldName: string): string {
    // System fields
    const systemFieldTypes: Record<string, string> = {
      userId: 'string',
      sessionId: 'string',
      appName: 'string',
      appVersion: 'semver',
      remoteAddress: 'string',
      currentTime: 'date',
    };

    if (systemFieldTypes[fieldName]) {
      return systemFieldTypes[fieldName];
    }

    // Heuristic inference from field name
    const lowerName = fieldName.toLowerCase();
    if (lowerName.includes('version')) return 'semver';
    if (
      lowerName.includes('date') ||
      lowerName.includes('time') ||
      lowerName.includes('timestamp')
    )
      return 'date';
    if (
      lowerName.includes('count') ||
      lowerName.includes('age') ||
      lowerName.includes('level')
    )
      return 'number';
    if (lowerName.includes('country') || lowerName === 'country')
      return 'country';
    if (lowerName.includes('countrycode3') || lowerName === 'countrycode3')
      return 'countryCode3';
    if (lowerName.includes('language') || lowerName.includes('lang'))
      return 'languageCode';
    if (lowerName.includes('locale')) return 'localeCode';
    if (lowerName.includes('timezone') || lowerName === 'tz') return 'timezone';
    if (
      lowerName.startsWith('is') ||
      lowerName.startsWith('has') ||
      lowerName.startsWith('enable') ||
      lowerName.startsWith('allow')
    )
      return 'boolean';

    // Default
    return 'string';
  }
}

export const contextFieldUsageService = new ContextFieldUsageService();

/**
 * Scheduled job handler for flushing buffer
 */
export async function processContextFieldUsageFlushJob(): Promise<{
  flushed: number;
  errors: number;
}> {
  return contextFieldUsageService.flushBufferToDb();
}

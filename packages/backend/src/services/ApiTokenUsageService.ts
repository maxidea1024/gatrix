import redisClient from '../config/redis';
import { ApiAccessToken } from '../models/ApiAccessToken';
import logger from '../config/logger';
import { queueService } from './QueueService';
import { getInstanceId } from '../utils/AppInstance';

interface TokenMeta {
  lastUsedAt: string; // ISO string
  instanceId: string;
}

interface AggregatedStats {
  totalUsageCount: number;
  latestUsedAt: Date;
  instances: string[];
}

export class ApiTokenUsageService {
  private static instance: ApiTokenUsageService;
  private readonly syncIntervalMs: number;
  private isInitialized = false;

  private constructor() {
    this.syncIntervalMs = parseInt(process.env.API_TOKEN_SYNC_INTERVAL_MS || '60000');

    logger.info('ApiTokenUsageService initialized', {
      instanceId: getInstanceId(),
      syncIntervalMs: this.syncIntervalMs
    });
  }

  static getInstance(): ApiTokenUsageService {
    if (!ApiTokenUsageService.instance) {
      ApiTokenUsageService.instance = new ApiTokenUsageService();
    }
    return ApiTokenUsageService.instance;
  }

  /**
   * Initialize service - register recurring schedule
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      if (!queueService.getQueue('token-usage-sync')) {
        await queueService.createQueue('token-usage-sync', this.processTokenUsageSyncJob.bind(this), {
          concurrency: 1,
          removeOnComplete: 10,
          removeOnFail: 5
        });
      }

      await queueService.addJob('token-usage-sync', 'sync-token-usage', {}, {
        repeat: {
          every: this.syncIntervalMs
        }
      });

      this.isInitialized = true;
      logger.info('ApiTokenUsageService initialized with recurring sync job', {
        intervalMs: this.syncIntervalMs
      });

    } catch (error) {
      logger.error('Failed to initialize ApiTokenUsageService:', error);
      throw error;
    }
  }

  /**
   * Record token usage (atomic increment in Redis)
   */
  async recordTokenUsage(tokenId: string): Promise<void> {
    try {
      const client = redisClient.getClient();
      if (!client) return;

      const instanceId = getInstanceId();
      const countKey = `token_usage:count:${tokenId}:${instanceId}`;
      const metaKey = `token_usage:meta:${tokenId}:${instanceId}`;
      const now = new Date().toISOString();

      // Atomic increment
      await client.incr(countKey);

      // Update metadata (fire and forget)
      // We set TTL to 2x sync interval to prevent garbage accumulation if sync fails repeatedly
      const ttlSeconds = Math.ceil(this.syncIntervalMs * 2 / 1000);

      await client.set(metaKey, JSON.stringify({
        lastUsedAt: now,
        instanceId
      }), 'EX', ttlSeconds);

      // Ensure count key also has TTL (refresh on every usage)
      await client.expire(countKey, ttlSeconds);

    } catch (error) {
      logger.error('Failed to record token usage in cache:', error);
    }
  }

  /**
   * Process sync job from QueueService
   */
  private async processTokenUsageSyncJob(): Promise<void> {
    try {
      logger.info('Starting token usage synchronization', {
        instanceId: getInstanceId()
      });

      await this.syncTokenUsageToDatabase();

      logger.info('Token usage synchronization completed', {
        instanceId: getInstanceId()
      });

    } catch (error) {
      logger.error('Token usage synchronization failed:', error);
      throw error;
    }
  }

  /**
   * Sync cached usage to database
   */
  private async syncTokenUsageToDatabase(): Promise<void> {
    const client = redisClient.getClient();
    if (!client) return;

    try {
      // Find all count keys: token_usage:count:*
      // Note: In production with millions of keys, SCAN should be used. 
      // For now, assuming manageable key set or use scanStream if supported by ioredis wrapper.
      // using keys() for simplicity as per existing pattern, but SAFE practice is SCAN.
      // However ioredis 'keys' is blocking. Let's use scan if possible? 
      // Let's stick to keys() for now to match previous logic complexity, 
      // but acknowledge that scan is better for massive scale.
      const pattern = 'token_usage:count:*';
      const countKeys = await client.keys(pattern);

      if (countKeys.length === 0) {
        return;
      }

      logger.info(`Found ${countKeys.length} token usage counters to sync`);

      const tokenAggregates = new Map<number, AggregatedStats>();

      for (const countKey of countKeys) {
        try {
          // Atomic GETSET to 0 to claim the current count without losing concurrent increments
          const countStr = await client.getset(countKey, '0');
          const count = parseInt(countStr || '0', 10);

          if (count > 0) {
            // Extract info from key
            const parts = countKey.split(':');
            // token_usage:count:{tokenId}:{instanceId}
            if (parts.length === 4) {
              const tokenId = parseInt(parts[2], 10);
              const instanceId = parts[3];
              const metaKey = `token_usage:meta:${tokenId}:${instanceId}`;

              // Get metadata
              const metaStr = await client.get(metaKey);
              let lastUsedAt = new Date();

              if (metaStr) {
                const meta: TokenMeta = JSON.parse(metaStr);
                lastUsedAt = new Date(meta.lastUsedAt);
              }

              // Aggregate
              const existing = tokenAggregates.get(tokenId);
              if (!existing) {
                tokenAggregates.set(tokenId, {
                  totalUsageCount: count,
                  latestUsedAt: lastUsedAt,
                  instances: [instanceId]
                });
              } else {
                existing.totalUsageCount += count;
                if (lastUsedAt > existing.latestUsedAt) {
                  existing.latestUsedAt = lastUsedAt;
                }
                if (!existing.instances.includes(instanceId)) {
                  existing.instances.push(instanceId);
                }
              }
            }
          } else {
            // Count IS 0. 
            // Either created by getset above (race?) or just empty.
            // Check if key should be deleted to keep Redis clean
            // Metadata key expiration handles cleanup, we can leave countKey to expire via TTL
            // or explicitly delete if both are effectively empty.
            // Rely on TTL set in recordTokenUsage.
          }
        } catch (error) {
          logger.error(`Failed to process usage key ${countKey}:`, error);
        }
      }

      // Update Database
      for (const [tokenId, aggregate] of tokenAggregates) {
        try {
          await this.updateTokenUsageInDatabase(tokenId, aggregate);
        } catch (error) {
          logger.error(`Failed to update token ${tokenId} usage in database:`, error);
        }
      }

      logger.info(`Successfully synced usage data for ${tokenAggregates.size} tokens`);

    } catch (error) {
      logger.error('Failed to sync token usage to database:', error);
      throw error;
    }
  }

  /**
   * Update usage in DB
   */
  private async updateTokenUsageInDatabase(tokenId: number, aggregate: AggregatedStats): Promise<void> {
    try {
      const currentToken = await ApiAccessToken.query().findById(tokenId);
      if (!currentToken) {
        logger.warn(`Token ${tokenId} not found in database`);
        return;
      }

      const newUsageCount = (currentToken.usageCount || 0) + aggregate.totalUsageCount;
      const newLastUsedAt = aggregate.latestUsedAt;

      const formatForMySQL = (date: Date) => {
        return date.toISOString().slice(0, 19).replace('T', ' ');
      };

      await ApiAccessToken.knex().raw(`
        UPDATE g_api_access_tokens
        SET usageCount = ?, lastUsedAt = ?, updatedAt = ?
        WHERE id = ?
      `, [
        newUsageCount,
        formatForMySQL(newLastUsedAt),
        formatForMySQL(new Date()),
        tokenId
      ]);

      logger.debug('Database updated for token', {
        tokenId,
        added: aggregate.totalUsageCount,
        newTotal: newUsageCount,
        instances: aggregate.instances
      });

      // Invalidate cache
      await this.invalidateTokenCache(tokenId);

    } catch (error) {
      logger.error(`Failed to update token ${tokenId} in database:`, error);
      throw error;
    }
  }

  private async invalidateTokenCache(tokenId: number): Promise<void> {
    try {
      const client = redisClient.getClient();
      if (!client) return;

      const pattern = 'api_token:*';
      const keys = await client.keys(pattern);
      if (keys.length > 0) {
        await client.del(...keys);
      }
    } catch (error) {
      logger.error(`Failed to invalidate token cache for token ${tokenId}:`, error);
    }
  }

  async shutdown(): Promise<void> {
    try {
      await this.syncTokenUsageToDatabase();
      logger.info('ApiTokenUsageService shutdown completed');
    } catch (error) {
      logger.error('Error during ApiTokenUsageService shutdown:', error);
    }
  }
}

export default ApiTokenUsageService.getInstance();

import { mysqlPool } from '../config/mysql';
import { createLogger } from './logger';
import { CHANNELS, CONFIG_TYPES } from '../config/redis-keys';
import Redis from 'ioredis';
import { config } from '../config';
import { DsnAuthResult } from '../middleware/dsn-auth';

const logger = createLogger('dsn-store');

interface StoredDsn {
  projectId: string;         // gatrix project ID (ULID)
  internalProjectId: number; // MySQL project row ID
  dsnKeyId: number;
  label: string;
  publicKey: string;
  secretKey: string;
  isActive: boolean;
  rateLimitWindow: number;
  rateLimitCount: number;
}

/**
 * In-memory store for DSN keys.
 *
 * Strategy:
 * - Load all active DSN keys on worker/API startup.
 * - Subscribe to Pub/Sub for instant invalidation on DSN CRUD.
 * - No TTL, no Redis cache — pure in-memory O(1) lookup.
 *
 * Eliminates per-request Redis GET + MySQL fallback chain.
 */
export class DsnStore {
  private dsnMap: Map<string, StoredDsn> = new Map(); // publicKey → StoredDsn
  private subscriber: Redis | null = null;

  /**
   * Initialize store: load all DSN keys, then subscribe to Pub/Sub.
   */
  async init(): Promise<void> {
    await this.loadAll();

    this.subscriber = new Redis({
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password || undefined,
      db: config.redis.db,
      maxRetriesPerRequest: null,
    });

    await this.subscriber.subscribe(CHANNELS.CONFIG_CHANGED);
    this.subscriber.on('message', async (_channel: string, message: string) => {
      try {
        const { type } = JSON.parse(message);
        if (type === CONFIG_TYPES.DSN_KEYS) {
          await this.loadAll();
          logger.info('DSN keys reloaded via Pub/Sub', { count: this.dsnMap.size });
        }
      } catch (e) {
        logger.warn('Failed to process DSN config change', {
          error: e instanceof Error ? e.message : String(e),
        });
      }
    });

    logger.info('DsnStore initialized', { dsnKeyCount: this.dsnMap.size });
  }

  /**
   * O(1) lookup by public key. No Redis/MySQL calls.
   * Returns a DsnAuthResult compatible with the existing dsnAuthHook,
   * or null if the key is unknown/inactive.
   */
  lookup(publicKey: string): DsnAuthResult | null {
    const stored = this.dsnMap.get(publicKey);
    if (!stored || !stored.isActive) return null;

    return {
      projectId: stored.projectId,
      dsnKey: {
        id: stored.dsnKeyId,
        project_id: stored.internalProjectId,
        label: stored.label,
        public_key: stored.publicKey,
        secret_key: stored.secretKey,
        is_active: stored.isActive,
        rate_limit_window: stored.rateLimitWindow,
        rate_limit_count: stored.rateLimitCount,
        created_at: new Date(), // not used at runtime, placeholder
      },
    };
  }

  /**
   * Reload all active DSN keys from MySQL.
   */
  async loadAll(): Promise<void> {
    const [rows] = await mysqlPool.query(`
      SELECT dk.*, ap.gatrix_project_id, ap.id as internal_project_id
      FROM g_argus_dsnKeys dk
      JOIN g_argus_projects ap ON dk.project_id = ap.id
      WHERE dk.is_active = 1
    `);

    this.dsnMap.clear();
    for (const row of rows as any[]) {
      this.dsnMap.set(row.public_key, {
        projectId: row.gatrix_project_id,
        internalProjectId: row.internal_project_id,
        dsnKeyId: row.id,
        label: row.label,
        publicKey: row.public_key,
        secretKey: row.secret_key,
        isActive: row.is_active === 1,
        rateLimitWindow: row.rate_limit_window || 60,
        rateLimitCount: row.rate_limit_count || 0,
      });
    }
  }

  async close(): Promise<void> {
    if (this.subscriber) {
      await this.subscriber.quit();
      this.subscriber = null;
    }
  }
}

/**
 * Singleton instance — initialized in api.ts or worker.ts.
 */
export const dsnStore = new DsnStore();

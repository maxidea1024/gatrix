import db from '../config/knex';
import { createLogger } from './logger';
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
 * - ConfigSubscriber handles Pub/Sub dispatch for cache invalidation
 *   (single shared Redis connection instead of per-store connections).
 * - No TTL, no Redis cache — pure in-memory O(1) lookup.
 *
 * Eliminates per-request Redis GET + MySQL fallback chain.
 */
export class DsnStore {
  private dsnMap: Map<string, StoredDsn> = new Map(); // publicKey → StoredDsn

  /**
   * Initialize store: load all DSN keys from MySQL.
   * Pub/Sub subscription is handled by ConfigSubscriber (single connection).
   */
  async init(): Promise<void> {
    await this.loadAll();
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
   * Builds a new Map and swaps atomically to prevent empty-window during reload.
   * Called by ConfigSubscriber on Pub/Sub notification.
   */
  async loadAll(): Promise<void> {
    const rows = await db('g_argus_dsnKeys as dk')
      .select('dk.*', 'ap.gatrix_project_id', 'ap.id as internal_project_id')
      .join('g_argus_projects as ap', 'dk.project_id', 'ap.id')
      .where('dk.is_active', 1);

    // Build new map first, then swap atomically
    const newMap = new Map<string, StoredDsn>();
    for (const row of rows as any[]) {
      newMap.set(row.public_key, {
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

    // Atomic swap — no empty window
    this.dsnMap = newMap;
  }

  async close(): Promise<void> {
    // No-op: Pub/Sub is managed by ConfigSubscriber
  }
}

/**
 * Singleton instance — initialized in api.ts or worker.ts.
 */
export const dsnStore = new DsnStore();

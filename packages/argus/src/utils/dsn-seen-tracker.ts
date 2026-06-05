import { mysqlPool } from '../config/mysql';
import { createLogger } from './logger';

const logger = createLogger('dsn-seen-tracker');

/**
 * In-memory throttle to avoid hammering MySQL on every single event.
 * Tracks the last time we updated each DSN key's last_seen.
 * Only updates once per minute per key.
 */
const lastUpdateMap = new Map<number, number>();
const THROTTLE_MS = 60_000; // 1 minute

/**
 * Fire-and-forget: update last_seen (and first_seen if null) for a DSN key.
 * Uses UTC_TIMESTAMP() to avoid MySQL timezone issues.
 * Throttled to at most once per minute per key.
 */
export function updateDsnKeyLastSeen(dsnKeyId: number): void {
  const now = Date.now();
  const lastUpdate = lastUpdateMap.get(dsnKeyId) || 0;

  if (now - lastUpdate < THROTTLE_MS) {
    return; // throttled
  }

  lastUpdateMap.set(dsnKeyId, now);

  mysqlPool
    .query(
      `UPDATE g_argus_dsnKeys
       SET last_seen = UTC_TIMESTAMP(),
           first_seen = COALESCE(first_seen, UTC_TIMESTAMP())
       WHERE id = ?`,
      [dsnKeyId]
    )
    .catch((err) => {
      logger.warn('Failed to update DSN key last_seen', {
        dsnKeyId,
        error: err instanceof Error ? err.message : String(err),
      });
    });
}

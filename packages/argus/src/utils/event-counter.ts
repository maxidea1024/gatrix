import { redis } from '../config/redis';
import { COUNTERS } from '../config/redis-keys';
import { createLogger } from './logger';

const logger = createLogger('event-counter');

/**
 * Default TTL (seconds) for event counter sorted sets and HLL keys.
 * Entries older than this are automatically expired by Redis.
 */
const COUNTER_TTL_SEC = 86400; // 24 hours

/**
 * Redis-based event counting for alert evaluation.
 *
 * Replaces ClickHouse COUNT queries with O(1) Redis operations:
 * - Event count: ZADD to a Sorted Set (score=timestamp, member=eventId)
 *   → ZCOUNT for windowed counts
 * - User count: PFADD to a HyperLogLog per issue
 *   → PFCOUNT for approximate unique user counts
 * - Project-level: INCR on a simple counter
 *
 * All keys have TTL set to prevent unbounded Redis memory growth.
 */

/**
 * Record an event occurrence for an issue.
 * Called by error-worker after processing each event.
 */
export async function recordEventForIssue(
  projectId: string,
  issueId: number,
  eventId: string,
  userId?: string
): Promise<void> {
  try {
    const now = Date.now();
    const pipeline = redis.pipeline();

    const eventKey = COUNTERS.EVENT_COUNT(projectId, issueId);
    const userKey = COUNTERS.USER_COUNT(projectId, issueId);
    const projectKey = COUNTERS.PROJECT_EVENT_COUNT(projectId);

    // Event count: Sorted Set with timestamp as score + TTL
    pipeline.zadd(eventKey, now.toString(), eventId);
    pipeline.expire(eventKey, COUNTER_TTL_SEC);

    // Unique user count: HyperLogLog + TTL (only if userId is available)
    if (userId) {
      pipeline.pfadd(userKey, userId);
      pipeline.expire(userKey, COUNTER_TTL_SEC);
    }

    // Project-level event counter + TTL
    pipeline.incr(projectKey);
    pipeline.expire(projectKey, COUNTER_TTL_SEC);

    await pipeline.exec();
  } catch (e) {
    // Non-blocking — never fail event processing for counter errors
    logger.warn('Failed to record event counter', {
      projectId,
      issueId,
      error: e instanceof Error ? e.message : String(e),
    });
  }
}

/**
 * Get event count for an issue within a time window.
 * Uses Redis ZCOUNT (O(log N)) instead of ClickHouse query.
 */
export async function getEventCountInWindow(
  projectId: string,
  issueId: number,
  intervalSeconds: number
): Promise<number> {
  try {
    const minScore = Date.now() - intervalSeconds * 1000;
    return await redis.zcount(
      COUNTERS.EVENT_COUNT(projectId, issueId),
      minScore,
      '+inf'
    );
  } catch (e) {
    logger.warn('Failed to get event count from Redis', {
      error: e instanceof Error ? e.message : String(e),
    });
    return 0;
  }
}

/**
 * Get approximate unique user count for an issue.
 * Uses Redis PFCOUNT (O(1)) instead of ClickHouse UNIQ query.
 *
 * Note: HyperLogLog gives approximate counts (standard error ~0.81%).
 * For alert thresholds, this is more than sufficient.
 */
export async function getUniqueUserCount(
  projectId: string,
  issueId: number
): Promise<number> {
  try {
    return await redis.pfcount(COUNTERS.USER_COUNT(projectId, issueId));
  } catch (e) {
    logger.warn('Failed to get user count from Redis', {
      error: e instanceof Error ? e.message : String(e),
    });
    return 0;
  }
}

/**
 * Get project-level event count.
 */
export async function getProjectEventCount(projectId: string): Promise<number> {
  try {
    const val = await redis.get(COUNTERS.PROJECT_EVENT_COUNT(projectId));
    return val ? parseInt(val, 10) : 0;
  } catch (e) {
    logger.warn('Failed to get project event count', {
      error: e instanceof Error ? e.message : String(e),
    });
    return 0;
  }
}

/**
 * Clean up expired entries from event count sorted sets.
 * Removes entries older than maxAgeMs from all known counter keys.
 *
 * Called periodically by BatchFlusher. Since each key already has a TTL,
 * this is mainly a memory optimization to trim old entries from
 * still-active sorted sets.
 */
export async function cleanupExpiredCounters(maxAgeMs: number): Promise<void> {
  try {
    const cutoff = Date.now() - maxAgeMs;
    // Scan for event counter keys using a cursor-based approach
    let cursor = '0';
    let cleaned = 0;

    do {
      const [nextCursor, keys] = await redis.scan(
        cursor,
        'MATCH', 'argus:evt-count:*',
        'COUNT', '100'
      );
      cursor = nextCursor;

      if (keys.length > 0) {
        const pipeline = redis.pipeline();
        for (const key of keys) {
          pipeline.zremrangebyscore(key, '-inf', cutoff);
        }
        await pipeline.exec();
        cleaned += keys.length;
      }
    } while (cursor !== '0');

    logger.debug('Counter cleanup complete', { keysScanned: cleaned, maxAgeMs });
  } catch (e) {
    logger.warn('Counter cleanup failed', {
      error: e instanceof Error ? e.message : String(e),
    });
  }
}

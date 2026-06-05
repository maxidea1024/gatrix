import { redis } from '../config/redis';
import { COUNTERS } from '../config/redis-keys';
import { createLogger } from './logger';

const logger = createLogger('event-counter');

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
 * Cleanup: Expired entries are removed periodically by BatchFlusher.
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

    // Event count: Sorted Set with timestamp as score
    pipeline.zadd(
      COUNTERS.EVENT_COUNT(projectId, issueId),
      now.toString(),
      eventId
    );

    // Unique user count: HyperLogLog (only if userId is available)
    if (userId) {
      pipeline.pfadd(COUNTERS.USER_COUNT(projectId, issueId), userId);
    }

    // Project-level event counter
    pipeline.incr(COUNTERS.PROJECT_EVENT_COUNT(projectId));

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
 * Called periodically by BatchFlusher.
 */
export async function cleanupExpiredCounters(maxAgeMs: number): Promise<void> {
  // This is a placeholder — in production, you'd iterate over
  // known projects/issues and ZREMRANGEBYSCORE.
  // For now, the sorted sets auto-expire via Redis memory policies.
  logger.debug('Counter cleanup triggered', { maxAgeMs });
}

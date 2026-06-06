import {
  mysqlPool,
  redis,
  createLogger,
  ArgusErrorEvent,
  COUNTERS,
  BUFFERS,
} from '@gatrix/argus';

import { issueLookupCache } from './issue-cache';

const logger = createLogger('issue-grouper');

export interface IssueGroupResult {
  issue_id: number;
  is_new: boolean;
  is_regression: boolean;
}

/**
 * Group an error event into an existing issue or create a new one.
 *
 * Optimizations vs the original implementation:
 * 1. In-memory cache hit → zero MySQL queries (common case).
 * 2. No FOR UPDATE lock — GroupMQ guarantees per-project FIFO ordering,
 *    so concurrent writes to the same project are impossible.
 * 3. times_seen and last_seen are deferred to Redis (BatchFlusher writes to MySQL periodically).
 * 4. short_id uses Redis atomic increment instead of SELECT MAX().
 */
export async function groupIntoIssue(
  internalProjectId: number,
  projectId: string,
  event: ArgusErrorEvent,
  primaryHash: string,
  fingerprint: string[]
): Promise<IssueGroupResult> {
  // 1. Check in-memory cache first (O(1) lookup)
  const cached = issueLookupCache.get(projectId, primaryHash);
  if (cached) {
    return handleExistingIssue(
      cached.issueId,
      cached.status,
      cached.substatus,
      projectId,
      primaryHash,
      event
    );
  }

  // 2. Cache miss → plain SELECT (no FOR UPDATE, no connection.getConnection())
  const [existing] = await mysqlPool.query(
    `SELECT id, status, substatus FROM g_argus_issues
     WHERE project_id = ? AND primary_hash = ?`,
    [internalProjectId, primaryHash]
  );

  const rows = existing as any[];

  if (rows.length > 0) {
    const issue = rows[0];

    // Populate cache for next time
    issueLookupCache.set(projectId, primaryHash, {
      issueId: issue.id,
      status: issue.status,
      substatus: issue.substatus || null,
    });

    return handleExistingIssue(
      issue.id,
      issue.status,
      issue.substatus,
      projectId,
      primaryHash,
      event
    );
  }

  // 3. New issue — create with Redis-based short_id
  return createNewIssue(
    internalProjectId,
    projectId,
    event,
    primaryHash,
    fingerprint
  );
}

/**
 * Handle an existing issue: increment counters via Redis,
 * and only touch MySQL for rare events (regressions).
 */
async function handleExistingIssue(
  issueId: number,
  status: string,
  _substatus: string | null,
  projectId: string,
  primaryHash: string,
  event: ArgusErrorEvent
): Promise<IssueGroupResult> {
  const isRegression = status === 'resolved';

  // Defer times_seen and last_seen to Redis (BatchFlusher writes periodically)
  const pipeline = redis.pipeline();
  pipeline.hincrby(COUNTERS.ISSUE_TIMES_SEEN, `issue:${issueId}`, 1);
  pipeline.hset(
    BUFFERS.ISSUE_LAST_SEEN,
    `issue:${issueId}`,
    Date.now().toString()
  );
  await pipeline.exec();

  if (isRegression) {
    // Regressions are rare — write to MySQL immediately for correct status
    await mysqlPool.query(
      `UPDATE g_argus_issues
       SET status = 'unresolved',
           substatus = 'regressed',
           last_release = ?
       WHERE id = ?`,
      [event.release || null, issueId]
    );

    // Update cache with new status
    issueLookupCache.set(projectId, primaryHash, {
      issueId,
      status: 'unresolved',
      substatus: 'regressed',
    });

    logger.info('Issue regression detected', { issueId });
  } else if (event.release) {
    // Update last_release in Redis buffer (will be flushed by BatchFlusher)
    // For now, do a lightweight MySQL update for last_release only
    await mysqlPool.query(
      'UPDATE g_argus_issues SET last_release = ? WHERE id = ?',
      [event.release, issueId]
    );
  }

  return {
    issue_id: issueId,
    is_new: false,
    is_regression: isRegression,
  };
}

/**
 * Create a new issue with atomically-assigned short_id from Redis.
 * Uses INSERT IGNORE to safely handle duplicates on worker restart/retry.
 */
async function createNewIssue(
  internalProjectId: number,
  projectId: string,
  event: ArgusErrorEvent,
  primaryHash: string,
  fingerprint: string[]
): Promise<IssueGroupResult> {
  // Atomic increment — no race condition possible
  const nextShortId = await redis.hincrby(
    COUNTERS.ISSUE_SHORT_ID(projectId),
    'seq',
    1
  );

  const title = buildIssueTitle(event);
  const culprit = buildCulprit(event);

  const [insertResult] = await mysqlPool.query(
    `INSERT IGNORE INTO g_argus_issues
     (project_id, short_id, title, culprit, type, level, platform,
      primary_hash, fingerprint, first_seen, last_seen, times_seen,
      first_release, last_release, status, priority)
     VALUES (?, ?, ?, ?, 'error', ?, ?, ?, ?, UTC_TIMESTAMP(), UTC_TIMESTAMP(), 1, ?, ?, 'unresolved', 'medium')`,
    [
      internalProjectId,
      nextShortId,
      title,
      culprit,
      event.level || 'error',
      event.platform || 'other',
      primaryHash,
      JSON.stringify(fingerprint),
      event.release || null,
      event.release || null,
    ]
  );

  const issueId = (insertResult as any).insertId;

  // INSERT IGNORE returns insertId=0 when the row already exists (duplicate primary_hash).
  // Fall back to SELECT and treat as existing issue.
  if (issueId === 0) {
    const [rows] = await mysqlPool.query(
      'SELECT id, status, substatus FROM g_argus_issues WHERE project_id = ? AND primary_hash = ?',
      [internalProjectId, primaryHash]
    );
    const existing = (rows as any[])[0];
    if (existing) {
      issueLookupCache.set(projectId, primaryHash, {
        issueId: existing.id,
        status: existing.status,
        substatus: existing.substatus || null,
      });
      return handleExistingIssue(
        existing.id,
        existing.status,
        existing.substatus,
        projectId,
        primaryHash,
        event
      );
    }
    // Extremely rare: IGNORE triggered but row not found — log and re-throw
    throw new Error(
      `INSERT IGNORE returned 0 but no existing issue found for hash ${primaryHash}`
    );
  }

  // Populate cache immediately
  issueLookupCache.set(projectId, primaryHash, {
    issueId,
    status: 'unresolved',
    substatus: null,
  });

  logger.info('New issue created', {
    issueId,
    shortId: nextShortId,
    projectId,
    title,
  });

  return {
    issue_id: issueId,
    is_new: true,
    is_regression: false,
  };
}

/**
 * Initialize short_id counters in Redis from current MySQL MAX values.
 * Must be called once at worker startup, before processing any events.
 */
export async function initShortIdCounters(): Promise<void> {
  const [rows] = await mysqlPool.query(
    'SELECT project_id, COALESCE(MAX(short_id), 0) as max_id FROM g_argus_issues GROUP BY project_id'
  );

  for (const row of rows as any[]) {
    const key = COUNTERS.ISSUE_SHORT_ID(row.project_id);
    // HSETNX: only set if not already present (avoids resetting on restart)
    await redis.hsetnx(key, 'seq', row.max_id);
  }

  logger.info('Short ID counters initialized', {
    projectCount: (rows as any[]).length,
  });
}

// ── Helper functions ──

function buildIssueTitle(event: ArgusErrorEvent): string {
  const exc = event.exception;
  if (exc?.type && exc?.value) {
    const value =
      exc.value.length > 200 ? exc.value.slice(0, 200) + '...' : exc.value;
    return `${exc.type}: ${value}`;
  }
  if (exc?.type) {
    return exc.type;
  }
  return 'Unknown Error';
}

function buildCulprit(event: ArgusErrorEvent): string {
  const frames = event.exception?.stacktrace?.frames || [];
  const inAppFrame = [...frames].reverse().find((f) => f.in_app);
  const topFrame = inAppFrame || frames[frames.length - 1];

  if (!topFrame) return '';

  const parts = [topFrame.filename, topFrame.function].filter(Boolean);
  if (topFrame.lineno) {
    parts.push(`line ${topFrame.lineno}`);
  }
  return parts.join(' in ');
}

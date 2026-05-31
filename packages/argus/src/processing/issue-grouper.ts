import { mysqlPool } from '../config/mysql';
import { createLogger } from '../utils/logger';
import { ArgusErrorEvent } from '../types/events';

const logger = createLogger('issue-grouper');

export interface IssueGroupResult {
  issue_id: number;
  is_new: boolean;
  is_regression: boolean;
}

/**
 * Group an error event into an existing issue or create a new one.
 * Uses primary_hash for grouping lookup.
 */
export async function groupIntoIssue(
  internalProjectId: number,
  projectId: string,
  event: ArgusErrorEvent,
  primaryHash: string,
  fingerprint: string[]
): Promise<IssueGroupResult> {
  const connection = await mysqlPool.getConnection();

  try {
    // Look up existing issue by project_id + primary_hash
    const [existing] = await connection.query(
      `SELECT id, status, times_seen FROM g_argus_issues
       WHERE project_id = ? AND primary_hash = ?
       FOR UPDATE`,
      [internalProjectId, primaryHash]
    );

    const rows = existing as any[];

    if (rows.length > 0) {
      const issue = rows[0];
      const isRegression = issue.status === 'resolved';
      const newTimesSeen = Number(issue.times_seen) + 1;

      // Determine substatus:
      // 1. Regression: previously resolved issue gets a new event
      // 2. Escalating: event count exceeds threshold (100+ events and growing fast)
      let substatusClause = 'substatus';
      if (isRegression) {
        substatusClause = `'regressed'`;
      } else if (
        !isRegression &&
        issue.status === 'unresolved' &&
        (!issue.substatus || issue.substatus === 'ongoing') &&
        newTimesSeen > 100 &&
        newTimesSeen % 50 === 0 // Re-evaluate every 50 events
      ) {
        substatusClause = `'escalating'`;
      }

      // Update existing issue
      await connection.query(
        `UPDATE g_argus_issues
         SET times_seen = times_seen + 1,
             last_seen = NOW(),
             last_release = ?,
             status = IF(status = 'resolved', 'unresolved', status),
             substatus = ${substatusClause}
         WHERE id = ?`,
        [event.release || null, issue.id]
      );

      if (isRegression) {
        logger.info('Issue regression detected', {
          issueId: issue.id,
          projectId,
        });
      }

      return {
        issue_id: issue.id,
        is_new: false,
        is_regression: isRegression,
      };
    }

    // Create new issue — get next short_id
    const [maxRows] = await connection.query(
      `SELECT COALESCE(MAX(short_id), 0) + 1 as next_id
        FROM g_argus_issues WHERE project_id = ?`,
      [internalProjectId]
    );
    const nextShortId = (maxRows as any[])[0]?.next_id || 1;

    // Build title from exception
    const title = buildIssueTitle(event);
    const culprit = buildCulprit(event);

    const [insertResult] = await connection.query(
      `INSERT INTO g_argus_issues
       (project_id, short_id, title, culprit, type, level, platform,
        primary_hash, fingerprint, first_seen, last_seen, times_seen,
        first_release, last_release, status, priority)
       VALUES (?, ?, ?, ?, 'error', ?, ?, ?, ?, NOW(), NOW(), 1, ?, ?, 'unresolved', 'medium')`,
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
  } finally {
    connection.release();
  }
}

function buildIssueTitle(event: ArgusErrorEvent): string {
  const exc = event.exception;
  if (exc?.type && exc?.value) {
    // Truncate long values
    const value = exc.value.length > 200 ? exc.value.slice(0, 200) + '...' : exc.value;
    return `${exc.type}: ${value}`;
  }
  if (exc?.type) {
    return exc.type;
  }
  return 'Unknown Error';
}

function buildCulprit(event: ArgusErrorEvent): string {
  const frames = event.exception?.stacktrace?.frames || [];
  // Find last in-app frame
  const inAppFrame = [...frames].reverse().find((f) => f.in_app);
  const topFrame = inAppFrame || frames[frames.length - 1];

  if (!topFrame) return '';

  const parts = [topFrame.filename, topFrame.function].filter(Boolean);
  if (topFrame.lineno) {
    parts.push(`line ${topFrame.lineno}`);
  }
  return parts.join(' in ');
}

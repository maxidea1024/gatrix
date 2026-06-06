/**
 * Phase 4: Migrate mysqlPool -> knex in issues.ts, feedback.ts, crons.ts, alerts.ts
 * Uses latin1 encoding to preserve original bytes.
 * Complex dynamic SQL uses db.raw() for safety.
 */
import * as fs from 'fs';
import * as path from 'path';

const ARGUS_SRC = path.join(__dirname, '..', 'src');

function migrate(relPath: string, replacements: [string, string][]) {
  const filePath = path.join(ARGUS_SRC, relPath);
  let content = fs.readFileSync(filePath, 'latin1');
  let changed = 0;

  for (const [from, to] of replacements) {
    if (!content.includes(from)) {
      console.error(`  X NOT FOUND in ${relPath}: "${from.slice(0, 80)}..."`);
      continue;
    }
    content = content.replace(from, to);
    changed++;
  }

  fs.writeFileSync(filePath, content, 'latin1');
  console.log(`  OK ${relPath} (${changed} replacements)`);
}

console.log('Phase 4: Migrating high-complexity routes...\n');

// --- issues.ts (19 occurrences) ---
migrate('routes/issues.ts', [
  // Import
  [
    `import { mysqlPool } from '../config/mysql';`,
    `import db from '../config/knex';`,
  ],
  // Filter by status
  [
    `const [issueRows] = await mysqlPool.query(
            'SELECT id FROM g_argus_issues WHERE project_id = ? AND status = ?',
            [projectId, status]
          );
          const issueIds = (issueRows as any[]).map((r: any) => r.id);`,
    `const issueRows = await db('g_argus_issues')
            .select('id')
            .where({ project_id: projectId, status });
          const issueIds = issueRows.map((r: any) => r.id);`,
  ],
  // Search query
  [
    `const [queryRows] = await mysqlPool.query(
              'SELECT id FROM g_argus_issues WHERE project_id = ? AND (title LIKE ? OR culprit LIKE ?)',
              [projectId, \`%\${query}%\`, \`%\${query}%\`]
            );
            const queryIssueIds = (queryRows as any[]).map((r: any) => r.id);`,
    `const queryRows = await db('g_argus_issues')
              .select('id')
              .where('project_id', projectId)
              .andWhere(function() {
                this.where('title', 'like', \`%\${query}%\`).orWhere('culprit', 'like', \`%\${query}%\`);
              });
            const queryIssueIds = queryRows.map((r: any) => r.id);`,
  ],
  // Main list query (complex dynamic SQL -> db.raw)
  [
    `const [rows] = await mysqlPool.query(sql, params);
        const issues = rows as any[];`,
    `const rawResult = await db.raw(sql, params);
        const issues = rawResult[0] as any[];`,
  ],
  // Count query (dynamic SQL -> db.raw)
  [
    `const [countRows] = await mysqlPool.query(countSql, countParams);
        const total = (countRows as any[])[0]?.total || 0;`,
    `const countRaw = await db.raw(countSql, countParams);
        const total = (countRaw[0] as any[])[0]?.total || 0;`,
  ],
  // ALTER TABLE (DDL -> db.raw)
  [
    `await mysqlPool.query(\`ALTER TABLE g_argus_issues ADD COLUMN IF NOT EXISTS external_url VARCHAR(512) DEFAULT NULL\`);
          await mysqlPool.query(\`ALTER TABLE g_argus_issues ADD COLUMN IF NOT EXISTS external_key VARCHAR(100) DEFAULT NULL\`);`,
    `await db.raw(\`ALTER TABLE g_argus_issues ADD COLUMN IF NOT EXISTS external_url VARCHAR(512) DEFAULT NULL\`);
          await db.raw(\`ALTER TABLE g_argus_issues ADD COLUMN IF NOT EXISTS external_key VARCHAR(100) DEFAULT NULL\`);`,
  ],
  // INSERT issue
  [
    `const [result] = await mysqlPool.query(
          \`INSERT INTO g_argus_issues
            (project_id, title, culprit, level, status, priority, primary_hash, times_seen, first_seen, last_seen)
           VALUES (?, ?, ?, ?, 'unresolved', 'medium', ?, 0, UTC_TIMESTAMP(), UTC_TIMESTAMP())\`,
          [
            projectId,
            body.title.trim(),
            body.culprit || '',
            body.level || 'info',
            fingerprint,
          ]
        );

        const insertId = (result as any).insertId;`,
    `const [insertId] = await db('g_argus_issues').insert({
          project_id: projectId,
          title: body.title.trim(),
          culprit: body.culprit || '',
          level: body.level || 'info',
          status: 'unresolved',
          priority: 'medium',
          primary_hash: fingerprint,
          times_seen: 0,
          first_seen: db.fn.now(),
          last_seen: db.fn.now(),
        });`,
  ],
  // Get tracker
  [
    `const [trackerRows] = await mysqlPool.query(
              'SELECT * FROM g_argus_issue_trackers WHERE id = ? AND project_id = ?',
              [body.tracker_id, projectId]
            );
            const tracker = (trackerRows as any[])[0];`,
    `const trackerRows = await db('g_argus_issue_trackers')
              .where({ id: body.tracker_id, project_id: projectId });
            const tracker = trackerRows[0];`,
  ],
  // Update external link
  [
    `await mysqlPool.query(
                'UPDATE g_argus_issues SET external_url = ?, external_key = ? WHERE id = ?',
                [externalUrl, externalKey, insertId]
              );`,
    `await db('g_argus_issues')
                .where('id', insertId)
                .update({ external_url: externalUrl, external_key: externalKey });`,
  ],
  // Get single issue
  [
    `const [rows] = await mysqlPool.query(
          'SELECT * FROM g_argus_issues WHERE id = ? AND project_id = ?',
          [issueId, projectId]
        );

        const results = rows as any[];`,
    `const results = await db('g_argus_issues')
          .where({ id: issueId, project_id: projectId });`,
  ],
  // Update issue (dynamic SET -> db.raw for complex pattern)
  [
    `params.push(issueId, projectId);

        await mysqlPool.query(
          \`UPDATE g_argus_issues SET \${updates.join(', ')} WHERE id = ? AND project_id = ?\`,
          params
        );`,
    `params.push(issueId, projectId);

        await db.raw(
          \`UPDATE g_argus_issues SET \${updates.join(', ')} WHERE id = ? AND project_id = ?\`,
          params
        );`,
  ],
  // Activity: status_change
  [
    `await mysqlPool.query(
              \`INSERT INTO g_argus_issue_activity (project_id, issue_id, user_name, action, data) VALUES (?, ?, ?, 'status_change', ?)\`,
              [projectId, issueId, userName, JSON.stringify({ to: body.status })]
            );`,
    `await db('g_argus_issue_activity').insert({
              project_id: projectId, issue_id: issueId, user_name: userName,
              action: 'status_change', data: JSON.stringify({ to: body.status }),
            });`,
  ],
  // Activity: assign
  [
    `await mysqlPool.query(
              \`INSERT INTO g_argus_issue_activity (project_id, issue_id, user_name, action, data) VALUES (?, ?, ?, 'assign', ?)\`,
              [projectId, issueId, userName, JSON.stringify({ to: body.assigned_to })]
            );`,
    `await db('g_argus_issue_activity').insert({
              project_id: projectId, issue_id: issueId, user_name: userName,
              action: 'assign', data: JSON.stringify({ to: body.assigned_to }),
            });`,
  ],
  // Activity: priority_change
  [
    `await mysqlPool.query(
              \`INSERT INTO g_argus_issue_activity (project_id, issue_id, user_name, action, data) VALUES (?, ?, ?, 'priority_change', ?)\`,
              [projectId, issueId, userName, JSON.stringify({ to: body.priority })]
            );`,
    `await db('g_argus_issue_activity').insert({
              project_id: projectId, issue_id: issueId, user_name: userName,
              action: 'priority_change', data: JSON.stringify({ to: body.priority }),
            });`,
  ],
  // Bulk update (dynamic SQL -> db.raw)
  [
    `const [result] = await mysqlPool.query(
          \`UPDATE g_argus_issues SET \${updates.join(', ')} WHERE id IN (\${placeholders}) AND project_id = ?\`,
          params
        );`,
    `await db.raw(
          \`UPDATE g_argus_issues SET \${updates.join(', ')} WHERE id IN (\${placeholders}) AND project_id = ?\`,
          params
        );`,
  ],
  // Merge issues - transaction (connection -> db.transaction)
  [
    `const connection = await mysqlPool.getConnection();
      try {
        await connection.beginTransaction();

        // Get all issues sorted by times_seen DESC \?\?the most seen one becomes primary
        const [rows] = await connection.query(
          \`SELECT id, times_seen, first_seen, last_seen, primary_hash
           FROM g_argus_issues
           WHERE project_id = ? AND id IN (\${issue_ids.map(() => '?').join(',')})
           ORDER BY times_seen DESC\`,
          [projectId, ...issue_ids]
        );
        const issues = rows as any[];

        if (issues.length < 2) {
          await connection.rollback();
          return reply.code(404).send({ error: 'Not enough matching issues found' });
        }

        const primary = issues[0];
        const mergedIds = issues.slice(1).map((i: any) => i.id);

        // Aggregate stats into primary
        const totalTimesSeen = issues.reduce((sum: number, i: any) => sum + i.times_seen, 0);
        const earliestFirstSeen = issues.reduce((earliest: string, i: any) => i.first_seen < earliest ? i.first_seen : earliest, issues[0].first_seen);
        const latestLastSeen = issues.reduce((latest: string, i: any) => i.last_seen > latest ? i.last_seen : latest, issues[0].last_seen);

        // Update primary issue
        await connection.query(
          \`UPDATE g_argus_issues SET times_seen = ?, first_seen = ?, last_seen = ? WHERE id = ?\`,
          [totalTimesSeen, earliestFirstSeen, latestLastSeen, primary.id]
        );

        // Update ClickHouse events to point to primary issue
        // Note: ClickHouse does not support UPDATE, so we store merge mapping in MySQL
        // Mark merged issues as "merged" status with a reference to primary
        await connection.query(
          \`UPDATE g_argus_issues
           SET status = 'merged', substatus = ?, times_seen = 0
           WHERE id IN (\${mergedIds.map(() => '?').join(',')}) AND project_id = ?\`,
          [String(primary.id), ...mergedIds, projectId]
        );

        await connection.commit();`,
    `try {
        const mergeResult = await db.transaction(async (trx) => {
          // Get all issues sorted by times_seen DESC - the most seen one becomes primary
          const issues = await trx('g_argus_issues')
            .select('id', 'times_seen', 'first_seen', 'last_seen', 'primary_hash')
            .where('project_id', projectId)
            .whereIn('id', issue_ids)
            .orderBy('times_seen', 'desc');

          if (issues.length < 2) {
            return null; // signal not enough issues
          }

          const primary = issues[0];
          const mergedIds = issues.slice(1).map((i: any) => i.id);

          // Aggregate stats into primary
          const totalTimesSeen = issues.reduce((sum: number, i: any) => sum + i.times_seen, 0);
          const earliestFirstSeen = issues.reduce((earliest: string, i: any) => i.first_seen < earliest ? i.first_seen : earliest, issues[0].first_seen);
          const latestLastSeen = issues.reduce((latest: string, i: any) => i.last_seen > latest ? i.last_seen : latest, issues[0].last_seen);

          // Update primary issue
          await trx('g_argus_issues')
            .where('id', primary.id)
            .update({ times_seen: totalTimesSeen, first_seen: earliestFirstSeen, last_seen: latestLastSeen });

          // Mark merged issues as "merged" status with reference to primary
          await trx('g_argus_issues')
            .whereIn('id', mergedIds)
            .where('project_id', projectId)
            .update({ status: 'merged', substatus: String(primary.id), times_seen: 0 });

          return { primary, mergedIds, totalTimesSeen };
        });

        if (!mergeResult) {
          return reply.code(404).send({ error: 'Not enough matching issues found' });
        }

        const { primary, mergedIds, totalTimesSeen } = mergeResult;`,
  ],
  // Remove old catch/finally for connection
  [
    `} catch (error) {
        await connection.rollback();
        logger.error('Failed to merge issues', {
          projectId,
          error: error instanceof Error ? error.message : String(error),
        });
        return reply.code(500).send({ error: 'Failed to merge issues' });
      } finally {
        connection.release();
      }`,
    `} catch (error) {
        logger.error('Failed to merge issues', {
          projectId,
          error: error instanceof Error ? error.message : String(error),
        });
        return reply.code(500).send({ error: 'Failed to merge issues' });
      }`,
  ],
  // Activity list
  [
    `const [rows] = await mysqlPool.query(
          \`SELECT * FROM g_argus_issue_activity
           WHERE project_id = ? AND issue_id = ?
           ORDER BY created_at DESC
           LIMIT ? OFFSET ?\`,
          [projectId, issueId, limitVal, offsetVal]
        );`,
    `const rows = await db('g_argus_issue_activity')
          .where({ project_id: projectId, issue_id: issueId })
          .orderBy('created_at', 'desc')
          .limit(limitVal)
          .offset(offsetVal);`,
  ],
  // Add comment
  [
    `await mysqlPool.query(
          \`INSERT INTO g_argus_issue_activity (project_id, issue_id, user_name, action, data) VALUES (?, ?, ?, 'comment', ?)\`,
          [projectId, issueId, userName, JSON.stringify({ text: text.trim() })]
        );`,
    `await db('g_argus_issue_activity').insert({
          project_id: projectId, issue_id: issueId, user_name: userName,
          action: 'comment', data: JSON.stringify({ text: text.trim() }),
        });`,
  ],
]);

console.log('\nPhase 4a (issues.ts) complete!');

/**
 * Phase 4b: Migrate mysqlPool -> knex in feedback.ts, crons.ts, alerts.ts
 * Uses latin1 encoding to preserve original bytes.
 * For complex dynamic SQL, uses db.raw().
 * For DDL (CREATE TABLE, ALTER TABLE), uses db.raw().
 * For simple CRUD, uses knex query builder.
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

/**
 * Simple global replace: replaces ALL occurrences of a pattern.
 * Used for repetitive patterns like `mysqlPool.query(` -> `db.raw(`.
 */
function migrateAll(relPath: string, replacements: [string, string][]) {
  const filePath = path.join(ARGUS_SRC, relPath);
  let content = fs.readFileSync(filePath, 'latin1');
  let changed = 0;

  for (const [from, to] of replacements) {
    let count = 0;
    while (content.includes(from)) {
      content = content.replace(from, to);
      count++;
    }
    if (count > 0) changed += count;
    else console.error(`  X NOT FOUND in ${relPath}: "${from.slice(0, 60)}..."`);
  }

  fs.writeFileSync(filePath, content, 'latin1');
  console.log(`  OK ${relPath} (${changed} replacements)`);
}

console.log('Phase 4b: Migrating feedback.ts, crons.ts, alerts.ts...\n');

// --- feedback.ts (20 occurrences) ---
// Strategy: import change + simple patterns first, then all remaining `mysqlPool.query` -> `db.raw`
migrate('routes/feedback.ts', [
  // Import
  [
    `import { mysqlPool } from '../config/mysql';`,
    `import db from '../config/knex';`,
  ],
  // Manual links query (whereIn with dynamic placeholders)
  [
    `const [linkRows] = await mysqlPool.query(
              \`SELECT feedback_id, issue_id FROM g_argus_feedback_issue_links WHERE project_id = ? AND feedback_id IN (\${feedbackIds.map(() => '?').join(',')})\`,
              [projectId, ...feedbackIds]
            );
            for (const row of (linkRows as any[])) {`,
    `const linkRows = await db('g_argus_feedback_issue_links')
              .select('feedback_id', 'issue_id')
              .where('project_id', projectId)
              .whereIn('feedback_id', feedbackIds);
            for (const row of linkRows) {`,
  ],
  // Issue enrichment query (whereIn)
  [
    `const [issueRows] = await mysqlPool.query(
                \`SELECT id, title, status FROM g_argus_issues WHERE id IN (\${allIssueIds.map(() => '?').join(',')})\`,
                [...allIssueIds]
              );
              const issueMap: Record<number, { id: number; title: string; status: string }> = {};
              for (const row of (issueRows as any[])) {`,
    `const issueRows = await db('g_argus_issues')
                .select('id', 'title', 'status')
                .whereIn('id', allIssueIds);
              const issueMap: Record<number, { id: number; title: string; status: string }> = {};
              for (const row of issueRows) {`,
  ],
  // Extra issue map
  [
    `const [rows] = await mysqlPool.query(
              \`SELECT id, title, status FROM g_argus_issues WHERE id IN (\${manualIssueIdsNotFetched.map(() => '?').join(',')})\`,
              [...manualIssueIdsNotFetched]
            );
            for (const row of (rows as any[])) {`,
    `const rows = await db('g_argus_issues')
              .select('id', 'title', 'status')
              .whereIn('id', manualIssueIdsNotFetched);
            for (const row of rows) {`,
  ],
  // Get feedback_ids by issue
  [
    `const [linkRows] = await mysqlPool.query(
          'SELECT feedback_id FROM g_argus_feedback_issue_links WHERE project_id = ? AND issue_id = ?',
          [projectId, Number(issueId)]
        );
        const feedbackIds = (linkRows as any[]).map(r => r.feedback_id);`,
    `const linkRows = await db('g_argus_feedback_issue_links')
          .select('feedback_id')
          .where({ project_id: projectId, issue_id: Number(issueId) });
        const feedbackIds = linkRows.map((r: any) => r.feedback_id);`,
  ],
  // Activity: status_change
  [
    `await mysqlPool.query(
              'INSERT INTO g_argus_feedback_activity (project_id, feedback_id, action, data, created_at) VALUES (?, ?, ?, ?, UTC_TIMESTAMP())',
              [projectId, feedbackId, 'status_change', JSON.stringify({ from: '', to: body.status })]
            );`,
    `await db('g_argus_feedback_activity').insert({
              project_id: projectId, feedback_id: feedbackId, action: 'status_change',
              data: JSON.stringify({ from: '', to: body.status }), created_at: db.fn.now(),
            });`,
  ],
  // Activity: assign
  [
    `await mysqlPool.query(
              'INSERT INTO g_argus_feedback_activity (project_id, feedback_id, action, data, created_at) VALUES (?, ?, ?, ?, UTC_TIMESTAMP())',
              [projectId, feedbackId, 'assign', JSON.stringify({ assigned_to: body.assigned_to })]
            );`,
    `await db('g_argus_feedback_activity').insert({
              project_id: projectId, feedback_id: feedbackId, action: 'assign',
              data: JSON.stringify({ assigned_to: body.assigned_to }), created_at: db.fn.now(),
            });`,
  ],
  // Activity: spam
  [
    `await mysqlPool.query(
              'INSERT INTO g_argus_feedback_activity (project_id, feedback_id, action, data, created_at) VALUES (?, ?, ?, ?, UTC_TIMESTAMP())',
              [projectId, feedbackId, body.is_spam ? 'mark_spam' : 'unmark_spam', null]
            );`,
    `await db('g_argus_feedback_activity').insert({
              project_id: projectId, feedback_id: feedbackId,
              action: body.is_spam ? 'mark_spam' : 'unmark_spam',
              data: null, created_at: db.fn.now(),
            });`,
  ],
  // Spam keywords list
  [
    `const [rows] = await mysqlPool.query(
          'SELECT * FROM g_argus_spam_keywords WHERE project_id = ? ORDER BY created_at DESC',
          [projectId]
        );`,
    `const rows = await db('g_argus_spam_keywords')
          .where('project_id', projectId)
          .orderBy('created_at', 'desc');`,
  ],
  // Auto-create spam table (in catch)
  [
    `await mysqlPool.query(\`
            CREATE TABLE IF NOT EXISTS g_argus_spam_keywords (`,
    `await db.raw(\`
            CREATE TABLE IF NOT EXISTS g_argus_spam_keywords (`,
  ],
  // Create spam table (in post)
  [
    `await mysqlPool.query(\`
          CREATE TABLE IF NOT EXISTS g_argus_spam_keywords (`,
    `await db.raw(\`
          CREATE TABLE IF NOT EXISTS g_argus_spam_keywords (`,
  ],
  // Insert spam keyword
  [
    `const [result] = await mysqlPool.query(
          'INSERT INTO g_argus_spam_keywords (project_id, keyword, is_regex) VALUES (?, ?, ?)',
          [projectId, keyword.trim(), is_regex ? 1 : 0]
        );

        return reply.code(201).send({ data: { id: (result as any).insertId } });`,
    `const [insertId] = await db('g_argus_spam_keywords').insert({
          project_id: projectId,
          keyword: keyword.trim(),
          is_regex: is_regex ? 1 : 0,
        });

        return reply.code(201).send({ data: { id: insertId } });`,
  ],
  // Delete spam keyword
  [
    `await mysqlPool.query(
          'DELETE FROM g_argus_spam_keywords WHERE id = ? AND project_id = ?',
          [keywordId, projectId]
        );`,
    `await db('g_argus_spam_keywords')
          .where({ id: keywordId, project_id: projectId })
          .del();`,
  ],
  // Get keywords for auto-spam
  [
    `const [keywords] = await mysqlPool.query(
          'SELECT keyword, is_regex FROM g_argus_spam_keywords WHERE project_id = ?',
          [projectId]
        );
        const kws = keywords as any[];`,
    `const kws = await db('g_argus_spam_keywords')
          .select('keyword', 'is_regex')
          .where('project_id', projectId);`,
  ],
  // Activity list
  [
    `const [rows] = await mysqlPool.query(
          \`SELECT * FROM g_argus_feedback_activity
           WHERE project_id = ? AND feedback_id = ?
           ORDER BY created_at DESC LIMIT ? OFFSET ?\`,
          [projectId, feedbackId, limitVal, offsetVal]
        );`,
    `const rows = await db('g_argus_feedback_activity')
          .where({ project_id: projectId, feedback_id: feedbackId })
          .orderBy('created_at', 'desc')
          .limit(limitVal)
          .offset(offsetVal);`,
  ],
  // Add comment
  [
    `const [result] = await mysqlPool.query(
          'INSERT INTO g_argus_feedback_activity (project_id, feedback_id, user_name, action, data, created_at) VALUES (?, ?, ?, ?, ?, UTC_TIMESTAMP())',
          [projectId, feedbackId, user_name || null, 'comment', JSON.stringify({ text: text.trim() })]
        );
        return reply.code(201).send({ data: { id: (result as any).insertId } });`,
    `const [insertId] = await db('g_argus_feedback_activity').insert({
          project_id: projectId, feedback_id: feedbackId,
          user_name: user_name || null, action: 'comment',
          data: JSON.stringify({ text: text.trim() }),
          created_at: db.fn.now(),
        });
        return reply.code(201).send({ data: { id: insertId } });`,
  ],
  // Upsert link
  [
    `await mysqlPool.query(
             \`INSERT INTO g_argus_feedback_issue_links (project_id, feedback_id, issue_id)
              VALUES (?, ?, ?)
              ON DUPLICATE KEY UPDATE issue_id = VALUES(issue_id), updated_at = UTC_TIMESTAMP()\`,
             [projectId, feedbackId, issue_id]
           );`,
    `await db.raw(
             \`INSERT INTO g_argus_feedback_issue_links (project_id, feedback_id, issue_id)
              VALUES (?, ?, ?)
              ON DUPLICATE KEY UPDATE issue_id = VALUES(issue_id), updated_at = UTC_TIMESTAMP()\`,
             [projectId, feedbackId, issue_id]
           );`,
  ],
  // Unlink
  [
    `await mysqlPool.query(
             'DELETE FROM g_argus_feedback_issue_links WHERE project_id = ? AND feedback_id = ?',
             [projectId, feedbackId]
           );`,
    `await db('g_argus_feedback_issue_links')
             .where({ project_id: projectId, feedback_id: feedbackId })
             .del();`,
  ],
]);

// DDL in helper functions at bottom
migrateAll('routes/feedback.ts', [
  [
    `await mysqlPool.query(\`
      CREATE TABLE IF NOT EXISTS g_argus_feedback_activity (`,
    `await db.raw(\`
      CREATE TABLE IF NOT EXISTS g_argus_feedback_activity (`,
  ],
  [
    `await mysqlPool.query(\`
      CREATE TABLE IF NOT EXISTS g_argus_feedback_issue_links (`,
    `await db.raw(\`
      CREATE TABLE IF NOT EXISTS g_argus_feedback_issue_links (`,
  ],
]);

// --- crons.ts ---
// Use global replacement strategy: replace import, then all `mysqlPool.query` -> `db.raw`
migrate('routes/crons.ts', [
  [
    `import { mysqlPool } from '../config/mysql';`,
    `import db from '../config/knex';`,
  ],
]);
migrateAll('routes/crons.ts', [
  [`mysqlPool.query(`, `db.raw(`],
]);

// --- alerts.ts ---
migrate('routes/alerts.ts', [
  [
    `import { mysqlPool } from '../config/mysql';`,
    `import db from '../config/knex';`,
  ],
]);
migrateAll('routes/alerts.ts', [
  [`mysqlPool.query(`, `db.raw(`],
]);

console.log('\nPhase 4b complete!');

/**
 * Phase 1: Migrate mysqlPool -> knex in 5 low-complexity route files
 * Uses latin1 encoding to preserve original bytes (avoids Korean comment corruption).
 */
import * as fs from 'fs';
import * as path from 'path';

const ARGUS_SRC = path.join(__dirname, '..', 'src');

function migrate(relPath: string, replacements: [string, string][]) {
  const filePath = path.join(ARGUS_SRC, relPath);
  // latin1 preserves every byte as-is (no multi-byte re-encoding)
  let content = fs.readFileSync(filePath, 'latin1');
  let changed = 0;

  for (const [from, to] of replacements) {
    if (!content.includes(from)) {
      console.error(`  X NOT FOUND in ${relPath}: "${from.slice(0, 60)}..."`);
      continue;
    }
    content = content.replace(from, to);
    changed++;
  }

  fs.writeFileSync(filePath, content, 'latin1');
  console.log(`  OK ${relPath} (${changed} replacements)`);
}

console.log('Phase 1: Migrating low-complexity routes...\n');

// --- releases.ts ---
migrate('routes/releases.ts', [
  [
    `import { mysqlPool } from '../config/mysql';`,
    `import db from '../config/knex';`,
  ],
  [
    `          mysqlPool.query(
            \`SELECT first_release as release_name, COUNT(*) as new_issues 
             FROM g_argus_issues 
             WHERE project_id = ? AND first_release IS NOT NULL 
             GROUP BY first_release\`,
            [projectId]
          ),`,
    `          db('g_argus_issues')
            .select('first_release as release_name')
            .count('* as new_issues')
            .where('project_id', projectId)
            .whereNotNull('first_release')
            .groupBy('first_release'),`,
  ],
  [
    `const newIssuesRows = newIssuesResult[0] as any[];`,
    `const newIssuesRows = newIssuesResult as any[];`,
  ],
]);

// --- performance.ts ---
migrate('routes/performance.ts', [
  [
    `import { mysqlPool } from '../config/mysql';`,
    `import db from '../config/knex';`,
  ],
  [
    `          const [issueRows] = await mysqlPool.query(
            \`SELECT id, title, level FROM g_argus_issues WHERE id IN (\${issueIds.map(() => '?').join(',')})\`,
            issueIds
          ) as any;`,
    `          const issueRows = await db('g_argus_issues')
            .select('id', 'title', 'level')
            .whereIn('id', issueIds);`,
  ],
]);

// --- dashboards.ts ---
migrate('routes/dashboards.ts', [
  [
    `import { mysqlPool } from '../config/mysql';`,
    `import db from '../config/knex';`,
  ],
  [
    `const [rows] = await mysqlPool.query(
          \`SELECT id, project_id, title, description, widgets_config, created_at, updated_at
           FROM g_argus_dashboards WHERE project_id = ? ORDER BY updated_at DESC\`,
          [projectId]
        );`,
    `const rows = await db('g_argus_dashboards')
          .select('id', 'project_id', 'title', 'description', 'widgets_config', 'created_at', 'updated_at')
          .where('project_id', projectId)
          .orderBy('updated_at', 'desc');`,
  ],
  [
    `const [rows] = await mysqlPool.query(
          \`SELECT * FROM g_argus_dashboards WHERE id = ? AND project_id = ?\`,
          [dashboardId, projectId]
        );`,
    `const rows = await db('g_argus_dashboards')
          .where({ id: dashboardId, project_id: projectId });`,
  ],
  [
    `const arr = rows as any[];`,
    `const arr = rows;`,
  ],
  [
    `const [result] = await mysqlPool.query(
          \`INSERT INTO g_argus_dashboards (project_id, title, description, widgets_config)
           VALUES (?, ?, ?, ?)\`,
          [projectId, title, description || '', JSON.stringify(widgets)]
        );
        const insertId = (result as any).insertId;`,
    `const [insertId] = await db('g_argus_dashboards').insert({
          project_id: projectId,
          title,
          description: description || '',
          widgets_config: JSON.stringify(widgets),
        });`,
  ],
  [
    `values.push(dashboardId, projectId);
        await mysqlPool.query(
          \`UPDATE g_argus_dashboards SET \${updates.join(', ')}, updated_at = UTC_TIMESTAMP() WHERE id = ? AND project_id = ?\`,
          values
        );`,
    `const updateObj: any = {};
        if (title !== undefined) updateObj.title = title;
        if (description !== undefined) updateObj.description = description;
        if (widgets_config !== undefined) updateObj.widgets_config = JSON.stringify(widgets_config);
        updateObj.updated_at = db.fn.now();
        await db('g_argus_dashboards')
          .where({ id: dashboardId, project_id: projectId })
          .update(updateObj);`,
  ],
  [
    `await mysqlPool.query(
          \`DELETE FROM g_argus_dashboards WHERE id = ? AND project_id = ?\`,
          [dashboardId, projectId]
        );`,
    `await db('g_argus_dashboards')
          .where({ id: dashboardId, project_id: projectId })
          .del();`,
  ],
]);

// --- discover.ts ---
migrate('routes/discover.ts', [
  [
    `import { mysqlPool } from '../config/mysql';`,
    `import db from '../config/knex';`,
  ],
  [
    `let sql = 'SELECT * FROM g_argus_saved_queries WHERE project_id = ?';
        const params: any[] = [projectId];

        if (query_type) {
          sql += ' AND query_type = ?';
          params.push(query_type);
        }

        sql += ' ORDER BY updated_at DESC';

        const [rows] = await mysqlPool.execute(sql, params);`,
    `const query = db('g_argus_saved_queries').where('project_id', projectId);
        if (query_type) {
          query.where('query_type', query_type);
        }
        const rows = await query.orderBy('updated_at', 'desc');`,
  ],
  [
    `const [result] = await mysqlPool.execute(
          \`INSERT INTO g_argus_saved_queries (project_id, name, description, query_type, query_config, display_type, is_global, created_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)\`,
          [projectId, name, description || null, query_type || 'discover', JSON.stringify(query_config), display_type || 'table', is_global ? 1 : 0, createdBy]
        );
        const insertId = (result as any).insertId;`,
    `const [insertId] = await db('g_argus_saved_queries').insert({
          project_id: projectId,
          name,
          description: description || null,
          query_type: query_type || 'discover',
          query_config: JSON.stringify(query_config),
          display_type: display_type || 'table',
          is_global: is_global ? 1 : 0,
          created_by: createdBy,
        });`,
  ],
  [
    `const updates: string[] = [];
        const values: any[] = [];

        if (name !== undefined) { updates.push('name = ?'); values.push(name); }
        if (description !== undefined) { updates.push('description = ?'); values.push(description); }
        if (query_config !== undefined) { updates.push('query_config = ?'); values.push(JSON.stringify(query_config)); }
        if (display_type !== undefined) { updates.push('display_type = ?'); values.push(display_type); }
        if (is_favorite !== undefined) { updates.push('is_favorite = ?'); values.push(is_favorite ? 1 : 0); }

        if (updates.length === 0) return reply.code(400).send({ error: 'Nothing to update' });

        values.push(queryId, projectId);
        await mysqlPool.execute(
          \`UPDATE g_argus_saved_queries SET \${updates.join(', ')} WHERE id = ? AND project_id = ?\`,
          values
        );`,
    `const updateObj: any = {};
        if (name !== undefined) updateObj.name = name;
        if (description !== undefined) updateObj.description = description;
        if (query_config !== undefined) updateObj.query_config = JSON.stringify(query_config);
        if (display_type !== undefined) updateObj.display_type = display_type;
        if (is_favorite !== undefined) updateObj.is_favorite = is_favorite ? 1 : 0;

        if (Object.keys(updateObj).length === 0) return reply.code(400).send({ error: 'Nothing to update' });

        await db('g_argus_saved_queries')
          .where({ id: queryId, project_id: projectId })
          .update(updateObj);`,
  ],
  [
    `await mysqlPool.execute(
          'DELETE FROM g_argus_saved_queries WHERE id = ? AND project_id = ?',
          [queryId, projectId]
        );`,
    `await db('g_argus_saved_queries')
          .where({ id: queryId, project_id: projectId })
          .del();`,
  ],
]);

// --- global-integrations.ts ---
migrate('routes/global-integrations.ts', [
  [
    `import { mysqlPool } from '../config/mysql';`,
    `import db from '../config/knex';`,
  ],
  [
    `await mysqlPool.query(\`
      CREATE TABLE IF NOT EXISTS g_argus_global_integrations (`,
    `await db.raw(\`
      CREATE TABLE IF NOT EXISTS g_argus_global_integrations (`,
  ],
  [
    `const [rows] = await mysqlPool.execute(
          'SELECT id, name, url, is_active, created_at, updated_at FROM g_argus_global_integrations WHERE provider = ? AND is_active = 1 LIMIT 1',
          [provider]
        );
        const configured = (rows as any[]).length > 0;
        return reply.send({ data: { configured, config: (rows as any[])[0] || null } });`,
    `const rows = await db('g_argus_global_integrations')
          .select('id', 'name', 'url', 'is_active', 'created_at', 'updated_at')
          .where({ provider, is_active: 1 })
          .limit(1);
        const configured = rows.length > 0;
        return reply.send({ data: { configured, config: rows[0] || null } });`,
  ],
  [
    `await mysqlPool.execute(
          \`INSERT INTO g_argus_global_integrations (provider, name, url, credentials)
           VALUES (?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
           name = VALUES(name), credentials = VALUES(credentials), is_active = 1\`,
          [provider, body.name || null, body.url || null, JSON.stringify(body.credentials)]
        );`,
    `await db.raw(
          \`INSERT INTO g_argus_global_integrations (provider, name, url, credentials)
           VALUES (?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
           name = VALUES(name), credentials = VALUES(credentials), is_active = 1\`,
          [provider, body.name || null, body.url || null, JSON.stringify(body.credentials)]
        );`,
  ],
  [
    `await mysqlPool.execute(
          'UPDATE g_argus_global_integrations SET is_active = 0 WHERE provider = ?',
          [provider]
        );`,
    `await db('g_argus_global_integrations')
          .where('provider', provider)
          .update({ is_active: 0 });`,
  ],
]);

console.log('\nPhase 1 complete!');

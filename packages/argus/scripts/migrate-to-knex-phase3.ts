/**
 * Phase 3: Migrate mysqlPool -> knex in 5 medium-complexity route files
 * Uses latin1 encoding to preserve original bytes.
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

console.log('Phase 3: Migrating medium-complexity routes...\n');

// --- sourcemaps.ts (12 occurrences) ---
migrate('routes/sourcemaps.ts', [
  [
    `import { mysqlPool } from '../config/mysql';`,
    `import db from '../config/knex';`,
  ],
  // List releases
  [
    `const [rows] = await mysqlPool.query(
          \`SELECT * FROM g_argus_sourcemap_releases
           WHERE project_id = ?
           ORDER BY created_at DESC
           LIMIT 50\`,
          [projectId]
        );`,
    `const rows = await db('g_argus_sourcemap_releases')
          .where('project_id', projectId)
          .orderBy('created_at', 'desc')
          .limit(50);`,
  ],
  // Upsert: SELECT existing
  [
    `const [existing] = await mysqlPool.query(
          \`SELECT id FROM g_argus_sourcemap_releases
           WHERE project_id = ? AND \\\`release\\\` = ? AND \\\`dist\\\` = ?\`,
          [projectId, release, dist]
        );
        const existingRows = existing as any[];`,
    `const existingRows = await db('g_argus_sourcemap_releases')
          .select('id')
          .where({ project_id: projectId, release, dist });`,
  ],
  // Delete old files
  [
    `await mysqlPool.query(
            \`DELETE FROM g_argus_sourcemap_files WHERE release_id = ?\`,
            [releaseId]
          );`,
    `await db('g_argus_sourcemap_files').where('release_id', releaseId).del();`,
  ],
  // INSERT new release
  [
    `const [insertResult] = await mysqlPool.query(
            \`INSERT INTO g_argus_sourcemap_releases (project_id, \\\`release\\\`, \\\`dist\\\`, file_count)
             VALUES (?, ?, ?, ?)\`,
            [projectId, release, dist, files.length]
          );
          releaseId = (insertResult as any).insertId;`,
    `const [insertedId] = await db('g_argus_sourcemap_releases').insert({
            project_id: projectId,
            release,
            dist,
            file_count: files.length,
          });
          releaseId = insertedId;`,
  ],
  // Bulk INSERT files
  [
    `const ph = dbRows.map(() => '(?, ?, ?, ?, ?, ?)').join(', ');
          await mysqlPool.query(
            \`INSERT INTO g_argus_sourcemap_files
             (release_id, project_id, file_path, file_name, sourcemap_path, file_size)
             VALUES \${ph}\`,
            dbRows.flat()
          );`,
    `await db('g_argus_sourcemap_files').insert(
            dbRows.map(([release_id, project_id, file_path, file_name, sourcemap_path, file_size]) => ({
              release_id, project_id, file_path, file_name, sourcemap_path, file_size,
            }))
          );`,
  ],
  // Update file count
  [
    `await mysqlPool.query(
          \`UPDATE g_argus_sourcemap_releases SET file_count = ? WHERE id = ?\`,
          [files.length, releaseId]
        );`,
    `await db('g_argus_sourcemap_releases').where('id', releaseId).update({ file_count: files.length });`,
  ],
  // Delete release
  [
    `await mysqlPool.query(
          \`DELETE FROM g_argus_sourcemap_releases WHERE id = ? AND project_id = ?\`,
          [releaseId, projectId]
        );`,
    `await db('g_argus_sourcemap_releases').where({ id: releaseId, project_id: projectId }).del();`,
  ],
  // List files for release
  [
    `const [rows] = await mysqlPool.query(
          \`SELECT id, file_path, file_name, file_size, created_at
           FROM g_argus_sourcemap_files
           WHERE release_id = ? AND project_id = ?\`,
          [releaseId, projectId]
        );`,
    `const rows = await db('g_argus_sourcemap_files')
          .select('id', 'file_path', 'file_name', 'file_size', 'created_at')
          .where({ release_id: releaseId, project_id: projectId });`,
  ],
  // Lookup: find release
  [
    `const [releaseRows] = await mysqlPool.query(
          \`SELECT id FROM g_argus_sourcemap_releases
           WHERE project_id = ? AND \\\`release\\\` = ? AND \\\`dist\\\` = ?
           ORDER BY created_at DESC LIMIT 1\`,
          [projectId, release, dist || '']
        );
        const releases = releaseRows as any[];`,
    `const releases = await db('g_argus_sourcemap_releases')
          .select('id')
          .where({ project_id: projectId, release, dist: dist || '' })
          .orderBy('created_at', 'desc')
          .limit(1);`,
  ],
  // Lookup: find file (exact)
  [
    `const [fileRows] = await mysqlPool.query(
          \`SELECT sourcemap_path, file_path FROM g_argus_sourcemap_files
           WHERE release_id = ? AND project_id = ? AND file_path = ?\`,
          [releaseId, projectId, file_path]
        );
        let files = fileRows as any[];`,
    `let files = await db('g_argus_sourcemap_files')
          .select('sourcemap_path', 'file_path')
          .where({ release_id: releaseId, project_id: projectId, file_path });`,
  ],
  // Lookup: suffix match
  [
    `const [suffixRows] = await mysqlPool.query(
            \`SELECT sourcemap_path, file_path FROM g_argus_sourcemap_files
             WHERE release_id = ? AND project_id = ? AND file_path LIKE ?\`,
            [releaseId, projectId, \`%\${stripped}\`]
          );
          files = suffixRows as any[];`,
    `files = await db('g_argus_sourcemap_files')
            .select('sourcemap_path', 'file_path')
            .where({ release_id: releaseId, project_id: projectId })
            .andWhere('file_path', 'like', \`%\${stripped}\`);`,
  ],
]);

// --- notification-channels.ts (6 occurrences) ---
migrate('routes/notification-channels.ts', [
  [
    `import { mysqlPool } from '../config/mysql';`,
    `import db from '../config/knex';`,
  ],
  // CREATE TABLE
  [
    `await mysqlPool.query(\`
      CREATE TABLE IF NOT EXISTS g_argus_notification_channels (`,
    `await db.raw(\`
      CREATE TABLE IF NOT EXISTS g_argus_notification_channels (`,
  ],
  // List
  [
    `const [rows] = await mysqlPool.execute(
          \`SELECT id, project_id, provider, name, config, enabled, created_at, updated_at
           FROM g_argus_notification_channels WHERE project_id = ? ORDER BY created_at DESC\`,
          [projectId]
        );
        // Parse JSON config
        const channels = (rows as any[]).map(row => ({`,
    `const rows = await db('g_argus_notification_channels')
          .select('id', 'project_id', 'provider', 'name', 'config', 'enabled', 'created_at', 'updated_at')
          .where('project_id', projectId)
          .orderBy('created_at', 'desc');
        // Parse JSON config
        const channels = rows.map((row: any) => ({`,
  ],
  // Create
  [
    `const [result] = await mysqlPool.execute(
          \`INSERT INTO g_argus_notification_channels (project_id, provider, name, config)
           VALUES (?, ?, ?, ?)\`,
          [projectId, provider, name || null, JSON.stringify(config || {})]
        );
        const insertId = (result as any).insertId;`,
    `const [insertId] = await db('g_argus_notification_channels').insert({
          project_id: projectId,
          provider,
          name: name || null,
          config: JSON.stringify(config || {}),
        });`,
  ],
  // Update (dynamic SET -> knex update)
  [
    `values.push(channelId, projectId);
        await mysqlPool.execute(
          \`UPDATE g_argus_notification_channels SET \${updates.join(', ')} WHERE id = ? AND project_id = ?\`,
          values
        );`,
    `const updateObj: any = {};
        if (body.name !== undefined) updateObj.name = body.name;
        if (body.enabled !== undefined) updateObj.enabled = body.enabled ? 1 : 0;
        if (body.config !== undefined) updateObj.config = JSON.stringify(body.config);
        await db('g_argus_notification_channels')
          .where({ id: channelId, project_id: projectId })
          .update(updateObj);`,
  ],
  // Delete
  [
    `await mysqlPool.execute(
          'DELETE FROM g_argus_notification_channels WHERE id = ? AND project_id = ?',
          [channelId, projectId]
        );`,
    `await db('g_argus_notification_channels')
          .where({ id: channelId, project_id: projectId })
          .del();`,
  ],
]);

// --- github-app.ts (5 occurrences) ---
migrate('routes/github-app.ts', [
  [
    `import { mysqlPool } from '../config/mysql';`,
    `import db from '../config/knex';`,
  ],
  // CREATE TABLE
  [
    `await mysqlPool.query(\`
      CREATE TABLE IF NOT EXISTS g_argus_github_installations (`,
    `await db.raw(\`
      CREATE TABLE IF NOT EXISTS g_argus_github_installations (`,
  ],
  // INSERT installation (upsert)
  [
    `await mysqlPool.execute(
            \`INSERT INTO g_argus_github_installations (installation_id, account_name, target_type)
             VALUES (?, ?, ?)
             ON DUPLICATE KEY UPDATE account_name = VALUES(account_name), target_type = VALUES(target_type)\`,
            [body.installation.id, body.installation.account.login, body.installation.target_type]
          );`,
    `await db.raw(
            \`INSERT INTO g_argus_github_installations (installation_id, account_name, target_type)
             VALUES (?, ?, ?)
             ON DUPLICATE KEY UPDATE account_name = VALUES(account_name), target_type = VALUES(target_type)\`,
            [body.installation.id, body.installation.account.login, body.installation.target_type]
          );`,
  ],
  // DELETE installation
  [
    `await mysqlPool.execute('DELETE FROM g_argus_github_installations WHERE installation_id = ?', [body.installation.id]);`,
    `await db('g_argus_github_installations').where('installation_id', body.installation.id).del();`,
  ],
  // SELECT installation
  [
    `const [rows] = await mysqlPool.execute('SELECT installation_id FROM g_argus_github_installations ORDER BY created_at DESC LIMIT 1');
        const installation = (rows as any[])[0];`,
    `const rows = await db('g_argus_github_installations')
          .select('installation_id')
          .orderBy('created_at', 'desc')
          .limit(1);
        const installation = rows[0];`,
  ],
]);

// --- projects.ts (12 occurrences) ---
migrate('routes/projects.ts', [
  [
    `import { mysqlPool } from '../config/mysql';`,
    `import db from '../config/knex';`,
  ],
  // List projects (raw subquery -> knex raw for complex subqueries)
  [
    `const [rows] = await mysqlPool.query(
          \`SELECT p.*, 
            (SELECT COUNT(*) FROM g_argus_issues WHERE project_id = p.id AND status = 'unresolved') as unresolved_issues,
            (SELECT COUNT(*) FROM g_argus_dsnKeys WHERE project_id = p.id AND is_active = 1) as active_dsn_count
           FROM g_argus_projects p
           ORDER BY p.updated_at DESC\`
        );`,
    `const rows = await db('g_argus_projects as p')
          .select(
            'p.*',
            db.raw("(SELECT COUNT(*) FROM g_argus_issues WHERE project_id = p.id AND status = 'unresolved') as unresolved_issues"),
            db.raw('(SELECT COUNT(*) FROM g_argus_dsnKeys WHERE project_id = p.id AND is_active = 1) as active_dsn_count'),
          )
          .orderBy('p.updated_at', 'desc');`,
  ],
  // Create project - transaction (replace getConnection with db.transaction)
  [
    `const connection = await mysqlPool.getConnection();
      try {
        await connection.beginTransaction();

        // Create project
        const [result] = await connection.query(
          \`INSERT INTO g_argus_projects (gatrix_project_id, name, slug, platform)
           VALUES (?, ?, ?, ?)\`,
          [body.gatrix_project_id, body.name, body.slug, body.platform || 'javascript']
        );
        const projectId = (result as any).insertId;

        // Auto-generate default DSN key
        const publicKey = generateKey(32);
        const secretKey = generateKey(32);

        await connection.query(
          \`INSERT INTO g_argus_dsnKeys (project_id, label, public_key, secret_key)
           VALUES (?, 'Default', ?, ?)\`,
          [projectId, publicKey, secretKey]
        );

        await connection.commit();

        // Fetch the created project with DSN
        const [rows] = await mysqlPool.query(
          \`SELECT p.*, d.public_key, d.secret_key
           FROM g_argus_projects p
           JOIN g_argus_dsnKeys d ON d.project_id = p.id
           WHERE p.id = ?\`,
          [projectId]
        );

        const project = (rows as any[])[0];`,
    `let projectId: number;
      let publicKey: string;
      let secretKey: string;

      try {
        // Auto-generate default DSN key
        publicKey = generateKey(32);
        secretKey = generateKey(32);

        await db.transaction(async (trx) => {
          const [id] = await trx('g_argus_projects').insert({
            gatrix_project_id: body.gatrix_project_id,
            name: body.name,
            slug: body.slug,
            platform: body.platform || 'javascript',
          });
          projectId = id;

          await trx('g_argus_dsnKeys').insert({
            project_id: projectId,
            label: 'Default',
            public_key: publicKey,
            secret_key: secretKey,
          });
        });

        const rows = await db('g_argus_projects as p')
          .select('p.*', 'd.public_key', 'd.secret_key')
          .join('g_argus_dsnKeys as d', 'd.project_id', 'p.id')
          .where('p.id', projectId!);

        const project = rows[0];`,
  ],
  // catch block - remove rollback/release
  [
    `await connection.rollback();
        if (error.code === 'ER_DUP_ENTRY') {`,
    `if (error.code === 'ER_DUP_ENTRY') {`,
  ],
  [
    `} finally {
        connection.release();
      }`,
    `}`,
  ],
  // Get project detail
  [
    `const [rows] = await mysqlPool.query(
          isNumeric
            ? 'SELECT * FROM g_argus_projects WHERE id = ?'
            : 'SELECT * FROM g_argus_projects WHERE gatrix_project_id = ?',
          [projectId]
        );
        const results = rows as any[];`,
    `const results = await db('g_argus_projects')
          .where(isNumeric ? 'id' : 'gatrix_project_id', projectId);`,
  ],
  // Get DSN keys
  [
    `const [dsnRows] = await mysqlPool.query(
          'SELECT id, label, public_key, is_active, rate_limit_window, rate_limit_count, first_seen, last_seen, created_at FROM g_argus_dsnKeys WHERE project_id = ?',
          [projectId]
        );

        const project = results[0];
        project.dsn_keys = (dsnRows as any[]).map((d: any) => ({`,
    `const dsnRows = await db('g_argus_dsnKeys')
          .select('id', 'label', 'public_key', 'is_active', 'rate_limit_window', 'rate_limit_count', 'first_seen', 'last_seen', 'created_at')
          .where('project_id', projectId);

        const project = results[0];
        project.dsn_keys = dsnRows.map((d: any) => ({`,
  ],
  // Update project (dynamic SET -> knex update)
  [
    `params.push(projectId);
      const isNumeric = /^\\d+$/.test(projectId);
      const whereCol = isNumeric ? 'id' : 'gatrix_project_id';

      try {
        await mysqlPool.query(
          \`UPDATE g_argus_projects SET \${updates.join(', ')} WHERE \${whereCol} = ?\`,
          params
        );`,
    `const isNumeric = /^\\d+$/.test(projectId);
      const whereCol = isNumeric ? 'id' : 'gatrix_project_id';
      const updateObj: any = {};
      if (body.name) updateObj.name = body.name;
      if (body.platform) updateObj.platform = body.platform;
      if (body.error_quota_daily !== undefined) updateObj.error_quota_daily = body.error_quota_daily;
      if (body.transaction_sample_rate !== undefined) updateObj.transaction_sample_rate = body.transaction_sample_rate;
      if (body.session_sample_rate !== undefined) updateObj.session_sample_rate = body.session_sample_rate;
      if (body.retention_days !== undefined) updateObj.retention_days = body.retention_days;

      try {
        await db('g_argus_projects').where(whereCol, projectId).update(updateObj);`,
  ],
  // Create DSN key
  [
    `const [result] = await mysqlPool.query(
          \`INSERT INTO g_argus_dsnKeys (project_id, label, public_key, secret_key, rate_limit_count, rate_limit_window)
           VALUES (?, ?, ?, ?, ?, ?)\`,
          [projectId, body.label || 'Default', publicKey, secretKey, body.rate_limit_count ?? 0, body.rate_limit_window ?? 0]
        );

        const dsnKeyId = (result as any).insertId;

        const [projRows] = await mysqlPool.query('SELECT gatrix_project_id FROM g_argus_projects WHERE id = ?', [projectId]);
        const gatrixProjectId = (projRows as any[])[0]?.gatrix_project_id || projectId;`,
    `const [dsnKeyId] = await db('g_argus_dsnKeys').insert({
          project_id: projectId,
          label: body.label || 'Default',
          public_key: publicKey,
          secret_key: secretKey,
          rate_limit_count: body.rate_limit_count ?? 0,
          rate_limit_window: body.rate_limit_window ?? 0,
        });

        const projRows = await db('g_argus_projects').select('gatrix_project_id').where('id', projectId);
        const gatrixProjectId = projRows[0]?.gatrix_project_id || projectId;`,
  ],
  // Hard delete DSN key
  [
    `await mysqlPool.query(
          'DELETE FROM g_argus_dsnKeys WHERE id = ? AND project_id = ?',
          [keyId, projectId]
        );`,
    `await db('g_argus_dsnKeys').where({ id: keyId, project_id: projectId }).del();`,
  ],
  // Revoke DSN key
  [
    `await mysqlPool.query(
          'UPDATE g_argus_dsnKeys SET is_active = 0 WHERE id = ? AND project_id = ?',
          [keyId, projectId]
        );`,
    `await db('g_argus_dsnKeys').where({ id: keyId, project_id: projectId }).update({ is_active: 0 });`,
  ],
  // Update DSN key (dynamic)
  [
    `params.push(keyId, projectId);

        await mysqlPool.query(
          \`UPDATE g_argus_dsnKeys SET \${updates.join(', ')} WHERE id = ? AND project_id = ?\`,
          params
        );`,
    `const dsnUpdateObj: any = { label: body.label!.trim() };
        if (body.rate_limit_count !== undefined) dsnUpdateObj.rate_limit_count = body.rate_limit_count;
        if (body.rate_limit_window !== undefined) dsnUpdateObj.rate_limit_window = body.rate_limit_window;

        await db('g_argus_dsnKeys').where({ id: keyId, project_id: projectId }).update(dsnUpdateObj);`,
  ],
]);

// --- integrations.ts (12 occurrences) ---
migrate('routes/integrations.ts', [
  [
    `import { mysqlPool } from '../config/mysql';`,
    `import db from '../config/knex';`,
  ],
  // List integrations
  [
    `const [rows] = await mysqlPool.execute(
          \`SELECT id, project_id, provider, repo_url, default_branch, enabled, created_at, updated_at
           FROM g_argus_integrations WHERE project_id = ? ORDER BY created_at DESC\`,
          [projectId]
        );`,
    `const rows = await db('g_argus_integrations')
          .select('id', 'project_id', 'provider', 'repo_url', 'default_branch', 'enabled', 'created_at', 'updated_at')
          .where('project_id', projectId)
          .orderBy('created_at', 'desc');`,
  ],
  // Create integration
  [
    `const [result] = await mysqlPool.execute(
          \`INSERT INTO g_argus_integrations (project_id, provider, repo_url, default_branch, access_token)
           VALUES (?, ?, ?, ?, ?)\`,
          [projectId, provider, repo_url, default_branch || 'main', access_token || null]
        );
        const insertId = (result as any).insertId;`,
    `const [insertId] = await db('g_argus_integrations').insert({
          project_id: projectId,
          provider,
          repo_url,
          default_branch: default_branch || 'main',
          access_token: access_token || null,
        });`,
  ],
  // Update integration (dynamic SET -> raw for field loop pattern)
  [
    `values.push(integrationId, projectId);
        await mysqlPool.execute(
          \`UPDATE g_argus_integrations SET \${updates.join(', ')} WHERE id = ? AND project_id = ?\`,
          values
        );`,
    `const intUpdateObj: any = {};
        for (const field of allowedFields) {
          if (body[field] !== undefined) intUpdateObj[field] = body[field];
        }
        await db('g_argus_integrations')
          .where({ id: integrationId, project_id: projectId })
          .update(intUpdateObj);`,
  ],
  // Delete integration
  [
    `await mysqlPool.execute(
          'DELETE FROM g_argus_integrations WHERE id = ? AND project_id = ?',
          [integrationId, projectId]
        );`,
    `await db('g_argus_integrations')
          .where({ id: integrationId, project_id: projectId })
          .del();`,
  ],
  // List commits (dynamic query)
  [
    `let query = 'SELECT * FROM g_argus_commits WHERE project_id = ?';
        const params: any[] = [projectId];

        if (release) {
          query += ' AND release_version = ?';
          params.push(release);
        }

        query += ' ORDER BY timestamp DESC LIMIT ?';
        params.push(parseInt(limit as string, 10));

        const [rows] = await mysqlPool.execute(query, params);`,
    `const q = db('g_argus_commits').where('project_id', projectId);
        if (release) {
          q.where('release_version', release);
        }
        const rows = await q.orderBy('timestamp', 'desc').limit(parseInt(limit as string, 10));`,
  ],
  // Ingest commits (bulk upsert -> db.raw)
  [
    `const placeholders = values.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ');
        await mysqlPool.query(
          \`INSERT INTO g_argus_commits
           (project_id, commit_hash, author_name, author_email, message, timestamp, release_version, files_changed, additions, deletions)
           VALUES \${placeholders}
           ON DUPLICATE KEY UPDATE
           message = VALUES(message), release_version = COALESCE(VALUES(release_version), release_version)\`,
          values.flat()
        );`,
    `const placeholders = values.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ');
        await db.raw(
          \`INSERT INTO g_argus_commits
           (project_id, commit_hash, author_name, author_email, message, timestamp, release_version, files_changed, additions, deletions)
           VALUES \${placeholders}
           ON DUPLICATE KEY UPDATE
           message = VALUES(message), release_version = COALESCE(VALUES(release_version), release_version)\`,
          values.flat()
        );`,
  ],
  // Suspect commits
  [
    `const [commits] = await mysqlPool.execute(
          \`SELECT * FROM g_argus_commits
           WHERE project_id = ?
             AND timestamp >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 7 DAY)
           ORDER BY timestamp DESC
           LIMIT 20\`,
          [projectId]
        );

        return reply.send({ data: commits });`,
    `const commits = await db('g_argus_commits')
          .where('project_id', projectId)
          .andWhere('timestamp', '>=', db.raw('DATE_SUB(UTC_TIMESTAMP(), INTERVAL 7 DAY)'))
          .orderBy('timestamp', 'desc')
          .limit(20);

        return reply.send({ data: commits });`,
  ],
  // List ownership rules
  [
    `const [rows] = await mysqlPool.execute(
          'SELECT * FROM g_argus_ownership_rules WHERE project_id = ? ORDER BY priority DESC, id ASC',
          [projectId]
        );`,
    `const rows = await db('g_argus_ownership_rules')
          .where('project_id', projectId)
          .orderBy([{ column: 'priority', order: 'desc' }, { column: 'id', order: 'asc' }]);`,
  ],
  // Create ownership rule
  [
    `const [result] = await mysqlPool.execute(
          \`INSERT INTO g_argus_ownership_rules (project_id, name, match_type, match_pattern, owners, priority, auto_assign)
           VALUES (?, ?, ?, ?, ?, ?, ?)\`,
          [projectId, name, match_type, match_pattern, JSON.stringify(owners), priority || 0, auto_assign !== false ? 1 : 0]
        );
        const insertId = (result as any).insertId;`,
    `const [insertId] = await db('g_argus_ownership_rules').insert({
          project_id: projectId,
          name,
          match_type,
          match_pattern,
          owners: JSON.stringify(owners),
          priority: priority || 0,
          auto_assign: auto_assign !== false ? 1 : 0,
        });`,
  ],
  // Update ownership rule (dynamic)
  [
    `values.push(ruleId, projectId);
        await mysqlPool.execute(
          \`UPDATE g_argus_ownership_rules SET \${updates.join(', ')} WHERE id = ? AND project_id = ?\`,
          values
        );`,
    `const ownUpdateObj: any = {};
        for (const field of allowedFields) {
          if (body[field] !== undefined) ownUpdateObj[field] = body[field];
        }
        if (body.owners !== undefined) ownUpdateObj.owners = JSON.stringify(body.owners);
        await db('g_argus_ownership_rules')
          .where({ id: ruleId, project_id: projectId })
          .update(ownUpdateObj);`,
  ],
  // Delete ownership rule
  [
    `await mysqlPool.execute(
          'DELETE FROM g_argus_ownership_rules WHERE id = ? AND project_id = ?',
          [ruleId, projectId]
        );`,
    `await db('g_argus_ownership_rules')
          .where({ id: ruleId, project_id: projectId })
          .del();`,
  ],
]);

console.log('\nPhase 3 complete!');

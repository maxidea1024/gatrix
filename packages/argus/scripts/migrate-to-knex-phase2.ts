/**
 * Phase 2: Migrate mysqlPool -> knex in utils + services (3 files)
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
      console.error(`  X NOT FOUND in ${relPath}: "${from.slice(0, 60)}..."`);
      continue;
    }
    content = content.replace(from, to);
    changed++;
  }

  fs.writeFileSync(filePath, content, 'latin1');
  console.log(`  OK ${relPath} (${changed} replacements)`);
}

console.log('Phase 2: Migrating utils + services...\n');

// --- dsn-store.ts ---
migrate('utils/dsn-store.ts', [
  [
    `import { mysqlPool } from '../config/mysql';`,
    `import db from '../config/knex';`,
  ],
  [
    `const [rows] = await mysqlPool.query(\`
      SELECT dk.*, ap.gatrix_project_id, ap.id as internal_project_id
      FROM g_argus_dsnKeys dk
      JOIN g_argus_projects ap ON dk.project_id = ap.id
      WHERE dk.is_active = 1
    \`);

    // Build new map first, then swap atomically
    const newMap = new Map<string, StoredDsn>();
    for (const row of rows as any[]) {`,
    `const rows = await db('g_argus_dsnKeys as dk')
      .select('dk.*', 'ap.gatrix_project_id', 'ap.id as internal_project_id')
      .join('g_argus_projects as ap', 'dk.project_id', 'ap.id')
      .where('dk.is_active', 1);

    // Build new map first, then swap atomically
    const newMap = new Map<string, StoredDsn>();
    for (const row of rows as any[]) {`,
  ],
]);

// --- dsn-seen-tracker.ts ---
migrate('utils/dsn-seen-tracker.ts', [
  [
    `import { mysqlPool } from '../config/mysql';`,
    `import db from '../config/knex';`,
  ],
  [
    `mysqlPool
    .query(
      \`UPDATE g_argus_dsnKeys
       SET last_seen = UTC_TIMESTAMP(),
           first_seen = COALESCE(first_seen, UTC_TIMESTAMP())
       WHERE id = ?\`,
      [dsnKeyId]
    )
    .catch((err) => {`,
    `db('g_argus_dsnKeys')
    .where('id', dsnKeyId)
    .update({
      last_seen: db.fn.now(),
      first_seen: db.raw('COALESCE(first_seen, UTC_TIMESTAMP())'),
    })
    .catch((err: any) => {`,
  ],
]);

// --- githubAppService.ts ---
migrate('services/githubAppService.ts', [
  [
    `import { mysqlPool } from '../config/mysql';`,
    `import db from '../config/knex';`,
  ],
  [
    `const [rows] = await mysqlPool.execute(
      'SELECT credentials FROM g_argus_global_integrations WHERE provider = "github" AND is_active = 1 LIMIT 1'
    );
    const row = (rows as any[])[0];`,
    `const rows = await db('g_argus_global_integrations')
      .select('credentials')
      .where({ provider: 'github', is_active: 1 })
      .limit(1);
    const row = rows[0];`,
  ],
]);

console.log('\nPhase 2 complete!');

/**
 * Phase 5: Migrate mysqlPool -> knex in uptime.ts, issue-trackers.ts
 * Uses latin1 + global replacement for remaining raw SQL.
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
    else
      console.error(`  X NOT FOUND in ${relPath}: "${from.slice(0, 60)}..."`);
  }
  fs.writeFileSync(filePath, content, 'latin1');
  console.log(`  OK ${relPath} (${changed} replacements)`);
}

console.log('Phase 5: Migrating uptime.ts, issue-trackers.ts...\n');

// --- uptime.ts ---
migrate('routes/uptime.ts', [
  [
    `import { mysqlPool } from '../config/mysql';`,
    `import db from '../config/knex';`,
  ],
]);
migrateAll('routes/uptime.ts', [
  [`mysqlPool.query(`, `db.raw(`],
  [`mysqlPool.execute(`, `db.raw(`],
]);

// --- issue-trackers.ts ---
migrate('routes/issue-trackers.ts', [
  [
    `import { mysqlPool } from '../config/mysql';`,
    `import db from '../config/knex';`,
  ],
]);
migrateAll('routes/issue-trackers.ts', [
  [`mysqlPool.query(`, `db.raw(`],
  [`mysqlPool.execute(`, `db.raw(`],
]);

console.log('\nPhase 5 complete!');

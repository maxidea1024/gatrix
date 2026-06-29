const fs = require('fs');
const path = require('path');

exports.up = async function (connection) {
  console.log('[067a] Creating Argus core tables from SQL migrations...');

  const sqlDir = path.resolve(__dirname, '..', '..', '..', '..', 'argus', 'migrations', 'mysql');
  const files = fs.readdirSync(sqlDir).filter(f => f.endsWith('.sql')).sort();

  for (const file of files) {
    console.log(`[067a] Running ${file}...`);
    const sql = fs.readFileSync(path.join(sqlDir, file), 'utf8');

    // Split by semicolons, filter empty statements, execute each individually
    const statements = sql
      .split(';')
      .map(s => s.replace(/--.*$/gm, '').trim())
      .filter(s => s.length > 0);

    for (const stmt of statements) {
      try {
        await connection.execute(stmt);
      } catch (e) {
        // Ignore "already exists" / "duplicate column" errors for idempotency
        if (e.errno === 1060 || e.errno === 1061 || e.errno === 1050) {
          console.log(`[067a]   Skipped (already exists): ${e.message.substring(0, 80)}`);
        } else {
          console.log(`[067a]   ⚠ ${e.message.substring(0, 120)}`);
        }
      }
    }
    console.log(`[067a] ✓ ${file} done`);
  }
};

exports.down = async function (connection) {
  // Dropping core argus tables in reverse dependency order is too risky.
  // This is intentionally a no-op.
  console.log('[067a] Down migration is a no-op for safety.');
};

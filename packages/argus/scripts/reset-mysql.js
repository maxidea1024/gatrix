// Drop all argus tables and recreate from migration files
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

async function main() {
  const pool = await mysql.createPool({
    host: process.env.MYSQL_HOST || 'localhost',
    port: parseInt(process.env.MYSQL_PORT || '43306'),
    user: process.env.MYSQL_USER || 'gatrix_user',
    password: process.env.MYSQL_PASSWORD || 'gatrix_password',
    database: process.env.MYSQL_DATABASE || 'gatrix',
    multipleStatements: true,
  });

  console.log('🗑️  Dropping all argus tables...');
  await pool.query('SET FOREIGN_KEY_CHECKS = 0');
  
  const tables = [
    'g_argus_fingerprintRules', 'g_argus_environments',
    'g_argus_cronCheckins', 'g_argus_cronMonitors',
    'g_argus_sourceMaps', 'g_argus_sourcemap_files', 'g_argus_sourcemap_releases',
    'g_argus_releaseCommits', 'g_argus_releases',
    'g_argus_dsnKeys', 'g_argus_issues',
    'g_argus_saved_queries',
    'g_argus_alert_history', 'g_argus_alert_rules', 'g_argus_alertRules',
    'g_argus_projects',
  ];

  for (const t of tables) {
    try {
      await pool.query(`DROP TABLE IF EXISTS ${t}`);
      console.log(`   ✓ ${t} dropped`);
    } catch (e) {
      console.log(`   ⚠ ${t}: ${e.message}`);
    }
  }
  
  await pool.query('SET FOREIGN_KEY_CHECKS = 1');

  console.log('\n📦 Recreating tables from migrations...');
  const migDir = path.join(__dirname, '..', 'migrations', 'mysql');
  const files = fs.readdirSync(migDir).filter(f => f.endsWith('.sql')).sort();

  for (const file of files) {
    const sql = fs.readFileSync(path.join(migDir, file), 'utf8');
    try {
      await pool.query(sql);
      console.log(`   ✓ ${file}`);
    } catch (e) {
      console.log(`   ✗ ${file}: ${e.message}`);
    }
  }

  // Re-insert the project with correct gatrix_project_id
  console.log('\n🔧 Inserting default project...');
  try {
    await pool.query(
      `INSERT INTO g_argus_projects (gatrix_project_id, name, slug, platform)
       VALUES ('01KN8GSHBJ10JTQ9D0HD60RKFV', 'Default Project', 'default', 'javascript')
       ON DUPLICATE KEY UPDATE name = VALUES(name)`
    );
    console.log('   ✓ Default project inserted');
  } catch (e) {
    console.log(`   ✗ ${e.message}`);
  }

  await pool.end();
  console.log('\n✅ Done!');
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });

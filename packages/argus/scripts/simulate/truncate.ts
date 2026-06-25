/**
 * Simulate Data — Truncate ClickHouse / MySQL tables
 */
import { CH_CONFIG } from './config';

export async function truncateClickHouse(ch: any): Promise<void> {
  const chTables = [
    'errors', 'transactions', 'spans', 'sessions',
    'user_feedback', 'logs', 'metrics', 'activities',
  ];
  for (const table of chTables) {
    try {
      await ch.exec({ query: `TRUNCATE TABLE IF EXISTS ${CH_CONFIG.database}.${table}` });
      console.log(`   ✓ CH ${table} truncated`);
    } catch {
      console.log(`   ⚠ CH ${table} not found (skip)`);
    }
  }
}

export async function truncateMySQL(pool: any): Promise<void> {
  const mysqlTables = [
    'g_argus_issues', 'g_argus_releases', 'g_argus_releaseCommits',
  ];
  for (const table of mysqlTables) {
    try {
      await pool.query('SET FOREIGN_KEY_CHECKS = 0');
      await pool.query(`TRUNCATE TABLE ${table}`);
      await pool.query('SET FOREIGN_KEY_CHECKS = 1');
      console.log(`   ✓ MySQL ${table} truncated`);
    } catch {
      console.log(`   ⚠ MySQL ${table} not found (skip)`);
    }
  }
}

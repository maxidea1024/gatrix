import mysql from 'mysql2/promise';
import { createClient } from '@clickhouse/client';

async function run() {
  console.log('Clearing MySQL g_argus_issues...');
  const pool = mysql.createPool({
    host: 'localhost', port: 43306, user: 'gatrix_user', password: 'gatrix_password', database: 'gatrix'
  });
  await pool.query('DELETE FROM g_argus_issues');
  console.log('MySQL cleared.');

  console.log('Clearing ClickHouse errors...');
  const ch = createClient({ host: 'http://localhost:48123', database: 'argus' });
  await ch.exec({ query: 'TRUNCATE TABLE argus.errors' });
  console.log('ClickHouse cleared.');

  process.exit(0);
}

run().catch(console.error);

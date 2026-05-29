const { createClient } = require('@clickhouse/client');
const mysql = require('mysql2/promise');
require('dotenv').config();

async function truncate() {
  const chClient = createClient({
    url: `http://${process.env.CLICKHOUSE_HOST || 'localhost'}:${process.env.CLICKHOUSE_PORT || '8123'}`,
    database: process.env.ARGUS_CLICKHOUSE_DATABASE || 'argus',
    username: process.env.CLICKHOUSE_USERNAME || 'default',
    password: process.env.CLICKHOUSE_PASSWORD || '',
  });

  const mysqlConn = await mysql.createConnection({
    host: process.env.MYSQL_HOST || 'localhost',
    port: parseInt(process.env.MYSQL_PORT || '3306', 10),
    user: process.env.MYSQL_USER || 'gatrix_user',
    password: process.env.MYSQL_PASSWORD || 'gatrix_password',
    database: process.env.MYSQL_DATABASE || 'gatrix',
  });

  console.log('Truncating ClickHouse tables...');
  const chTables = ['errors', 'transactions', 'spans', 'sessions', 'user_feedback', 'metrics_1m', 'metrics_1h', 'metrics_1d'];
  for (const table of chTables) {
    try {
      await chClient.exec({ query: `TRUNCATE TABLE IF EXISTS ${table}` });
      console.log(`- ${table} truncated`);
    } catch (e) {
      console.log(`- ${table} not truncated:`, e.message);
    }
  }

  console.log('Truncating MySQL tables...');
  const mysqlTables = ['g_argus_issues', 'g_argus_releases', 'g_argus_releaseCommits'];
  for (const table of mysqlTables) {
    try {
      await mysqlConn.query(`SET FOREIGN_KEY_CHECKS = 0`);
      await mysqlConn.query(`TRUNCATE TABLE ${table}`);
      await mysqlConn.query(`SET FOREIGN_KEY_CHECKS = 1`);
      console.log(`- ${table} truncated`);
    } catch (e) {
      console.log(`- ${table} not truncated:`, e.message);
    }
  }

  await mysqlConn.end();
  console.log('Done!');
}

truncate().catch(console.error);

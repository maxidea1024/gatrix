const mysql = require('mysql2/promise');
require('dotenv').config({ path: './packages/backend/.env' });

async function run() {
  const c = await mysql.createConnection({
    host: process.env.DB_HOST || 'mysql',
    user: process.env.DB_USER || 'gatrix_user',
    password: process.env.DB_PASSWORD || 'gatrix_password',
    database: process.env.DB_NAME || 'gatrix',
    port: process.env.DB_PORT || 3306,
  });

  await c.execute(`
    ALTER TABLE g_argus_saved_queries
    MODIFY COLUMN query_type ENUM(
      'discover','logs','traces','metrics','issues',
      'analytics-insights','analytics-funnels','analytics-retention','analytics-flows'
    ) NOT NULL DEFAULT 'discover'
  `);

  const [rows] = await c.execute(
    "SHOW COLUMNS FROM g_argus_saved_queries WHERE Field = 'query_type'"
  );
  console.log('Updated query_type:', JSON.stringify(rows[0]));
  await c.end();
}

run().catch(e => console.error('Error:', e.message));

const mysql = require('mysql2/promise');
require('dotenv').config({ path: './packages/backend/.env' });

async function checkColumn() {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'mysql',
      user: process.env.DB_USER || 'gatrix_user',
      password: process.env.DB_PASSWORD || 'gatrix_password',
      database: process.env.DB_NAME || 'gatrix',
      port: process.env.DB_PORT || 3306,
    });

    const [rows] = await connection.execute(
      "SHOW COLUMNS FROM g_argus_saved_queries WHERE Field = 'query_type'"
    );
    console.log('query_type column definition:');
    console.log(JSON.stringify(rows, null, 2));

    await connection.end();
  } catch (error) {
    console.error('Error:', error.message);
  }
}

checkColumn();

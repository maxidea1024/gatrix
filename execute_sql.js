const fs = require('fs');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: './packages/backend/.env' });

async function executeSqlFile() {
  try {
    // Connect to database
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'mysql',
      user: process.env.DB_USER || 'gatrix_user',
      password: process.env.DB_PASSWORD || 'gatrix_password',
      database: process.env.DB_NAME || 'gatrix',
      port: process.env.DB_PORT || 3306,
    });

    console.log('[INFO] Connected to database successfully.');

    // Read SQL file
    const sqlContent = fs.readFileSync('./archived/insert_additional_users.sql', 'utf8');

    // Remove comments and split queries
    const queries = sqlContent
      .split('\n')
      .filter((line) => !line.trim().startsWith('--') && line.trim() !== '')
      .join('\n')
      .split(';')
      .filter((query) => query.trim() !== '');

    console.log(`[INFO] Executing ${queries.length} queries...`);

    // Execute each query
    for (let i = 0; i < queries.length; i++) {
      const query = queries[i].trim();
      if (query) {
        try {
          const [result] = await connection.execute(query);
          console.log(`[SUCCESS] Query ${i + 1} executed: ${result.affectedRows} rows affected`);
        } catch (error) {
          console.error(`[ERROR] Query ${i + 1} failed:`, error.message);
        }
      }
    }

    // Close connection
    await connection.end();
    console.log('[INFO] Database connection closed.');

    // Verify results
    const checkConnection = await mysql.createConnection({
      host: process.env.DB_HOST || 'mysql',
      user: process.env.DB_USER || 'gatrix_user',
      password: process.env.DB_PASSWORD || 'gatrix_password',
      database: process.env.DB_NAME || 'gatrix',
      port: process.env.DB_PORT || 3306,
    });

    const [rows] = await checkConnection.execute(
      'SELECT COUNT(*) as count FROM g_users WHERE role = "user"'
    );
    console.log(`[INFO] Total users in database: ${rows[0].count}`);

    await checkConnection.end();
  } catch (error) {
    console.error('[ERROR] An error occurred:', error.message);
    process.exit(1);
  }
}

executeSqlFile();

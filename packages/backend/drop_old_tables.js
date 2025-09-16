const mysql = require('mysql2/promise');

async function dropOldTables() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'motif_dev',
    password: process.env.DB_PASSWORD || 'dev123$',
    database: process.env.DB_NAME || 'uwo_gate'
  });

  try {
    console.log('Dropping old remote config tables...');
    
    // Disable foreign key checks temporarily
    await connection.execute('SET FOREIGN_KEY_CHECKS = 0');

    // Get all tables that start with g_remote_config
    const [tables] = await connection.execute(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = DATABASE()
      AND table_name LIKE 'g_remote_config%'
    `);

    console.log('Raw tables result:', tables);
    const oldTables = tables.map(row => row.TABLE_NAME || row.table_name);
    console.log('Found tables to drop:', oldTables);

    for (const table of oldTables) {
      try {
        await connection.execute(`DROP TABLE IF EXISTS ${table}`);
        console.log(`Dropped table: ${table}`);
      } catch (error) {
        console.log(`Failed to drop ${table}: ${error.message}`);
      }
    }

    // Re-enable foreign key checks
    await connection.execute('SET FOREIGN_KEY_CHECKS = 1');

    console.log('Old tables dropped successfully!');
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await connection.end();
  }
}

dropOldTables();

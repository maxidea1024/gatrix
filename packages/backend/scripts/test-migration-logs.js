const mysql = require('mysql2/promise');

async function testMigrationLogs() {
  console.log('Testing migration logs...');

  try {
    // Create connection
    const connection = await mysql.createConnection({
      host: 'localhost',
      port: 3306,
      user: 'motif_dev',
      password: 'dev123$',
      database: 'uwo_gate',
    });

    console.log('Connected to database');

    // Drop migrations table to simulate first-time setup
    await connection.execute('DROP TABLE IF EXISTS migrations');
    console.log('Migrations table dropped');

    // Check if table exists
    const [tables] = await connection.execute("SHOW TABLES LIKE 'migrations'");
    console.log('Migrations table exists:', tables.length > 0);

    await connection.end();
    console.log('Database connection closed');

    console.log('\nNow run: yarn migrate:up');
    console.log('You should see improved log messages without error details');
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testMigrationLogs();

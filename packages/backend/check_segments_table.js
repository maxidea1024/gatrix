const mysql = require('mysql2/promise');

async function checkTable() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'motif_dev',
    password: process.env.DB_PASSWORD || 'dev123$',
    database: process.env.DB_NAME || 'uwo_gate',
  });

  try {
    console.log('Checking g_remote_config_segments table structure...');
    const [rows] = await connection.execute('DESCRIBE g_remote_config_segments');
    console.log('Table structure:');
    console.table(rows);
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await connection.end();
  }
}

checkTable();

require('dotenv').config();
const mysql = require('mysql2/promise');

async function checkUsersTable() {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'gatrix'
    });

    const [rows] = await connection.execute('DESCRIBE g_users');
    console.log('g_users table structure:');
    console.table(rows);

    await connection.end();
  } catch (error) {
    console.error('Error:', error);
  }
}

checkUsersTable();

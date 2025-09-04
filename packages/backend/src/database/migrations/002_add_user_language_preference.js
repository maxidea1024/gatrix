const mysql = require('mysql2/promise');

exports.up = async function() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'gatrix'
  });

  console.log('Adding preferredLanguage field to g_users table...');

  try {
    // Add preferredLanguage column to g_users table
    await connection.execute(`
      ALTER TABLE g_users 
      ADD COLUMN preferredLanguage VARCHAR(10) DEFAULT 'en' 
      AFTER avatarUrl
    `);

    // Add index for better performance
    await connection.execute(`
      ALTER TABLE g_users 
      ADD INDEX idx_preferred_language (preferredLanguage)
    `);

    console.log('✅ Successfully added preferredLanguage field to g_users table');
  } catch (error) {
    console.error('❌ Error adding preferredLanguage field:', error);
    throw error;
  } finally {
    await connection.end();
  }
};

exports.down = async function() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'gatrix'
  });

  console.log('Removing preferredLanguage field from g_users table...');

  try {
    // Remove index first
    await connection.execute(`
      ALTER TABLE g_users 
      DROP INDEX idx_preferred_language
    `);

    // Remove column
    await connection.execute(`
      ALTER TABLE g_users 
      DROP COLUMN preferredLanguage
    `);

    console.log('✅ Successfully removed preferredLanguage field from g_users table');
  } catch (error) {
    console.error('❌ Error removing preferredLanguage field:', error);
    throw error;
  } finally {
    await connection.end();
  }
};

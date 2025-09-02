const mysql = require('mysql2/promise');

/**
 * Add createdBy field to g_users table
 */
async function up() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'gatrix_db',
    charset: 'utf8mb4'
  });

  try {
    console.log('Adding createdBy field to g_users table...');

    // Add createdBy column
    await connection.execute(`
      ALTER TABLE g_users 
      ADD COLUMN createdBy INT NULL COMMENT '생성자 사용자 ID' AFTER updatedAt
    `);

    // Add foreign key constraint
    await connection.execute(`
      ALTER TABLE g_users 
      ADD CONSTRAINT fk_users_creator 
      FOREIGN KEY (createdBy) REFERENCES g_users(id) ON DELETE SET NULL
    `);

    // Add index for performance
    await connection.execute(`
      CREATE INDEX idx_users_created_by ON g_users(createdBy)
    `);

    console.log('✓ createdBy field added to g_users table');

  } catch (error) {
    console.error('Error adding createdBy field to g_users table:', error);
    throw error;
  } finally {
    await connection.end();
  }
}

/**
 * Remove createdBy field from g_users table
 */
async function down() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'gatrix_db',
    charset: 'utf8mb4'
  });

  try {
    console.log('Removing createdBy field from g_users table...');

    // Drop foreign key constraint
    await connection.execute(`
      ALTER TABLE g_users 
      DROP FOREIGN KEY fk_users_creator
    `);

    // Drop index
    await connection.execute(`
      DROP INDEX idx_users_created_by ON g_users
    `);

    // Drop column
    await connection.execute(`
      ALTER TABLE g_users 
      DROP COLUMN createdBy
    `);

    console.log('✓ createdBy field removed from g_users table');

  } catch (error) {
    console.error('Error removing createdBy field from g_users table:', error);
    throw error;
  } finally {
    await connection.end();
  }
}

module.exports = { up, down };

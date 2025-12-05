/**
 * Migration: Create user environments table
 * 
 * Creates g_user_environments table for user-environment access mapping.
 * - Admin users can have allowAllEnvironments = true
 * - Regular users need explicit environment assignments
 * - admin@gatrix.com gets allowAllEnvironments = true by default
 */

async function up(connection) {
  console.log('Running migration 052: Create user environments table');

  // Create g_user_environments table (for specific environment access)
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_user_environments (
      id INT AUTO_INCREMENT PRIMARY KEY,
      userId INT NOT NULL,
      environmentId CHAR(26) NOT NULL,
      createdBy INT NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uk_user_environment (userId, environmentId),
      INDEX idx_user_id (userId),
      INDEX idx_environment_id (environmentId),
      CONSTRAINT fk_user_environments_user FOREIGN KEY (userId) REFERENCES g_users(id) ON DELETE CASCADE,
      CONSTRAINT fk_user_environments_env FOREIGN KEY (environmentId) REFERENCES g_remote_config_environments(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  console.log('Created g_user_environments table');

  // Add allowAllEnvironments column to g_users table (if not exists)
  const [columns] = await connection.execute(`
    SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'g_users'
    AND COLUMN_NAME = 'allowAllEnvironments'
  `);

  if (columns.length === 0) {
    await connection.execute(`
      ALTER TABLE g_users
      ADD COLUMN allowAllEnvironments BOOLEAN NOT NULL DEFAULT FALSE
    `);
    console.log('Added allowAllEnvironments column to g_users');
  } else {
    console.log('allowAllEnvironments column already exists in g_users');
  }

  // Set allowAllEnvironments = true for admin@gatrix.com
  await connection.execute(`
    UPDATE g_users SET allowAllEnvironments = TRUE WHERE email = 'admin@gatrix.com'
  `);

  console.log('Set allowAllEnvironments = TRUE for admin@gatrix.com');

  console.log('Migration 052 completed');
}

async function down(connection) {
  console.log('Rolling back migration 052: Drop user environments table');

  // Remove allowAllEnvironments column from g_users
  await connection.execute(`
    ALTER TABLE g_users DROP COLUMN allowAllEnvironments
  `);

  // Drop g_user_environments table
  await connection.execute(`
    DROP TABLE IF EXISTS g_user_environments
  `);

  console.log('Rollback 052 completed');
}

module.exports = { up, down };


/**
 * Migration: Extend environments table for multi-environment support
 *
 * This migration:
 * 1. Creates g_projects table
 * 2. Adds new columns to g_environments table
 *    - environmentType, isSystemDefined, displayOrder, color, projectId
 * 3. Creates predefined environments (development, qa, production)
 *
 * Note: g_environments table is already created in 005 with VARCHAR(127) id
 */

// Helper function to check if a column exists
async function columnExists(connection, tableName, columnName) {
  const [rows] = await connection.execute(`
    SELECT COUNT(*) as cnt FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?
  `, [tableName, columnName]);
  return rows[0].cnt > 0;
}

// Simple ULID generator for migration
function generateUlid() {
  const ENCODING = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  const ENCODING_LEN = ENCODING.length;
  const TIME_LEN = 10;
  const RANDOM_LEN = 16;

  function encodeTime(now, len) {
    let str = '';
    for (let i = len; i > 0; i--) {
      const mod = now % ENCODING_LEN;
      str = ENCODING[mod] + str;
      now = Math.floor(now / ENCODING_LEN);
    }
    return str;
  }

  function encodeRandom(len) {
    let str = '';
    for (let i = 0; i < len; i++) {
      str += ENCODING[Math.floor(Math.random() * ENCODING_LEN)];
    }
    return str;
  }

  return encodeTime(Date.now(), TIME_LEN) + encodeRandom(RANDOM_LEN);
}

// Generate environment ID in format: {environmentName}.{ulid}
function generateEnvironmentId(environmentName) {
  return `${environmentName}.${generateUlid()}`;
}

exports.up = async function (connection) {
  console.log('Starting multi-environment support migration...');

  // 1. Create projects table
  console.log('Creating g_projects table...');
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_projects (
      id VARCHAR(127) NOT NULL PRIMARY KEY,
      projectName VARCHAR(100) NOT NULL UNIQUE,
      displayName VARCHAR(200) NOT NULL,
      description TEXT NULL,
      isDefault BOOLEAN NOT NULL DEFAULT FALSE,
      isActive BOOLEAN NOT NULL DEFAULT TRUE,
      createdBy INT NOT NULL,
      updatedBy INT NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

      INDEX idx_project_name (projectName),
      INDEX idx_project_default (isDefault),
      INDEX idx_project_active (isActive),
      CONSTRAINT fk_projects_created_by FOREIGN KEY (createdBy) REFERENCES g_users(id),
      CONSTRAINT fk_projects_updated_by FOREIGN KEY (updatedBy) REFERENCES g_users(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // Insert default project
  const defaultProjectId = generateUlid();
  await connection.execute(`
    INSERT INTO g_projects (id, projectName, displayName, description, isDefault, createdBy)
    VALUES (?, 'default', 'Default Project', 'Default project for all environments', TRUE, 1)
    ON DUPLICATE KEY UPDATE displayName = VALUES(displayName)
  `, [defaultProjectId]);

  console.log('✓ g_projects table created');

  // 2. Add new columns to g_environments (already has VARCHAR(127) id from 005)
  console.log('Ensuring g_environments table exists and adding new columns...');

  // Ensure g_environments exists (it should have been created in 005, but safety first for some environments)
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_environments (
      id VARCHAR(127) NOT NULL PRIMARY KEY COMMENT 'Format: {environmentName}.{ulid}',
      environmentName VARCHAR(100) NOT NULL UNIQUE,
      displayName VARCHAR(200) NOT NULL,
      description TEXT NULL,
      isDefault BOOLEAN NOT NULL DEFAULT FALSE,
      requiresApproval BOOLEAN NOT NULL DEFAULT FALSE,
      requiredApprovers INT NOT NULL DEFAULT 1,
      createdBy INT NOT NULL,
      updatedBy INT NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

      INDEX idx_environment_name (environmentName),
      INDEX idx_is_default (isDefault)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // Check and add environmentType column
  if (!await columnExists(connection, 'g_environments', 'environmentType')) {
    await connection.execute(`
      ALTER TABLE g_environments
      ADD COLUMN environmentType ENUM('development', 'staging', 'production') NOT NULL DEFAULT 'development'
      AFTER description
    `);
    console.log('✓ Added environmentType column');
  }

  // Check and add isSystemDefined column
  if (!await columnExists(connection, 'g_environments', 'isSystemDefined')) {
    await connection.execute(`
      ALTER TABLE g_environments
      ADD COLUMN isSystemDefined BOOLEAN NOT NULL DEFAULT FALSE
      AFTER environmentType
    `);
    console.log('✓ Added isSystemDefined column');
  }

  // Check and add displayOrder column
  if (!await columnExists(connection, 'g_environments', 'displayOrder')) {
    await connection.execute(`
      ALTER TABLE g_environments
      ADD COLUMN displayOrder INT NOT NULL DEFAULT 0
      AFTER isSystemDefined
    `);
    console.log('✓ Added displayOrder column');
  }

  // Check and add color column
  if (!await columnExists(connection, 'g_environments', 'color')) {
    await connection.execute(`
      ALTER TABLE g_environments
      ADD COLUMN color VARCHAR(7) NOT NULL DEFAULT '#607D8B'
      AFTER displayOrder
    `);
    console.log('✓ Added color column');
  }

  // Check and add projectId column
  if (!await columnExists(connection, 'g_environments', 'projectId')) {
    await connection.execute(`
      ALTER TABLE g_environments
      ADD COLUMN projectId VARCHAR(127) NULL
      AFTER color
    `);

    // Add foreign key for projectId
    await connection.execute(`
      ALTER TABLE g_environments
      ADD CONSTRAINT fk_env_project FOREIGN KEY (projectId) REFERENCES g_projects(id) ON DELETE SET NULL
    `);
    console.log('✓ Added projectId column with foreign key');
  }

  // 3. Get the default project ID
  const [defaultProject] = await connection.execute(`
    SELECT id FROM g_projects WHERE isDefault = TRUE LIMIT 1
  `);
  const projectId = defaultProject[0]?.id || defaultProjectId;

  // 4. Insert predefined environments
  console.log('Creating predefined environments...');

  // Development environment
  await connection.execute(`
    INSERT INTO g_environments
    (id, environmentName, displayName, description, environmentType, isSystemDefined, isDefault, displayOrder, color, projectId, requiresApproval, requiredApprovers, createdBy)
    VALUES (?, 'development', 'Development', 'Development environment for testing and feature development', 'development', TRUE, TRUE, 1, '#4CAF50', ?, FALSE, 1, 1)
    ON DUPLICATE KEY UPDATE displayName = VALUES(displayName)
  `, [generateEnvironmentId('development'), projectId]);

  // QA environment
  await connection.execute(`
    INSERT INTO g_environments
    (id, environmentName, displayName, description, environmentType, isSystemDefined, isDefault, displayOrder, color, projectId, requiresApproval, requiredApprovers, createdBy)
    VALUES (?, 'qa', 'QA', 'QA environment for quality assurance testing', 'staging', TRUE, FALSE, 2, '#FF9800', ?, TRUE, 1, 1)
    ON DUPLICATE KEY UPDATE displayName = VALUES(displayName)
  `, [generateEnvironmentId('qa'), projectId]);

  // Production environment
  await connection.execute(`
    INSERT INTO g_environments
    (id, environmentName, displayName, description, environmentType, isSystemDefined, isDefault, displayOrder, color, projectId, requiresApproval, requiredApprovers, createdBy)
    VALUES (?, 'production', 'Production', 'Production environment for live users', 'production', TRUE, FALSE, 3, '#F44336', ?, TRUE, 2, 1)
    ON DUPLICATE KEY UPDATE displayName = VALUES(displayName)
  `, [generateEnvironmentId('production'), projectId]);

  console.log('✓ Predefined environments created');
  console.log('Multi-environment support migration completed successfully');
};

exports.down = async function (connection) {
  console.log('Rolling back multi-environment support migration...');

  // Remove foreign key constraint first
  try {
    await connection.execute(`ALTER TABLE g_environments DROP FOREIGN KEY fk_env_project`);
  } catch (e) {
    console.log('Foreign key fk_env_project may not exist, continuing...');
  }

  // Remove added columns from g_environments
  const columnsToRemove = ['projectId', 'color', 'displayOrder', 'isSystemDefined', 'environmentType'];

  for (const column of columnsToRemove) {
    try {
      if (await columnExists(connection, 'g_environments', column)) {
        await connection.execute(`ALTER TABLE g_environments DROP COLUMN ${column}`);
        console.log(`✓ Dropped column: ${column}`);
      }
    } catch (e) {
      console.log(`Error dropping column ${column}:`, e.message);
    }
  }

  // Delete predefined environments
  await connection.execute(`DELETE FROM g_environments WHERE environmentName IN ('development', 'qa', 'production')`);

  // Drop projects table
  await connection.execute('DROP TABLE IF EXISTS g_projects');
  console.log('✓ Dropped g_projects table');

  console.log('Multi-environment support migration rollback completed');
};


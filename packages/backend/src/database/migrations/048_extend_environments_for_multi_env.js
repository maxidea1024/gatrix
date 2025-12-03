/**
 * Migration: Extend environments table for multi-environment support
 *
 * This migration:
 * 1. Creates g_projects table with ULID as primary key
 * 2. Changes g_remote_config_environments.id from INT to CHAR(26) (ULID)
 * 3. Adds new columns to g_remote_config_environments table
 *    - environmentType: Type classification (development, staging, production)
 *    - isSystemDefined: Whether this is a system-defined environment (cannot be deleted)
 *    - displayOrder: Display order for UI
 *    - color: Color for UI display
 *    - projectId: Reference to g_projects
 * 4. Creates predefined environments (development, qa, production)
 */

// Simple ULID generator for migration (no external dependencies)
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

exports.up = async function(connection) {
  console.log('Starting multi-environment support migration with ULID...');

  // 1. Create projects table with ULID
  console.log('Creating g_projects table...');
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_projects (
      id CHAR(26) NOT NULL PRIMARY KEY,
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

  // Insert default project with ULID
  const defaultProjectId = generateUlid();
  await connection.execute(`
    INSERT INTO g_projects (id, projectName, displayName, description, isDefault, createdBy)
    VALUES (?, 'default', 'Default Project', 'Default project for all environments', TRUE, 1)
    ON DUPLICATE KEY UPDATE displayName = VALUES(displayName)
  `, [defaultProjectId]);

  console.log('✓ g_projects table created');

  // 2. Migrate g_remote_config_environments to use ULID
  console.log('Migrating g_remote_config_environments to use ULID...');

  // 2.1 Get existing environment data
  const [existingEnvs] = await connection.execute(`
    SELECT * FROM g_remote_config_environments
  `);

  // 2.2 Get tables that reference g_remote_config_environments
  const referencingTables = [
    { table: 'g_remote_config_templates', fk: 'fk_rc_template_environment', column: 'environmentId' },
    { table: 'g_remote_config_change_requests', fk: 'fk_rc_cr_target_environment', column: 'targetEnvironmentId' },
    { table: 'g_remote_config_change_requests', fk: 'fk_rc_cr_source_environment', column: 'sourceEnvironmentId' },
    { table: 'g_remote_config_promotions', fk: 'fk_rc_promo_source_env', column: 'sourceEnvironmentId' },
    { table: 'g_remote_config_promotions', fk: 'fk_rc_promo_target_env', column: 'targetEnvironmentId' }
  ];

  // 2.3 Drop foreign keys referencing g_remote_config_environments
  for (const ref of referencingTables) {
    try {
      const [tableExists] = await connection.execute(`
        SELECT COUNT(*) as cnt FROM INFORMATION_SCHEMA.TABLES
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
      `, [ref.table]);

      if (tableExists[0].cnt > 0) {
        await connection.execute(`ALTER TABLE ${ref.table} DROP FOREIGN KEY ${ref.fk}`);
        console.log(`✓ Dropped FK ${ref.fk} from ${ref.table}`);
      }
    } catch (e) {
      console.log(`FK ${ref.fk} may not exist, continuing...`);
    }
  }

  // 2.4 Create mapping from old INT id to new ULID
  const idMapping = {};
  for (const env of existingEnvs) {
    idMapping[env.id] = generateUlid();
  }

  // 2.5 Add new ULID column to g_remote_config_environments
  await connection.execute(`
    ALTER TABLE g_remote_config_environments
    ADD COLUMN newId CHAR(26) NULL AFTER id
  `);

  // 2.6 Populate new ULID values
  for (const [oldId, newId] of Object.entries(idMapping)) {
    await connection.execute(`
      UPDATE g_remote_config_environments SET newId = ? WHERE id = ?
    `, [newId, oldId]);
  }

  // 2.7 Update referencing tables with new ULID values
  for (const ref of referencingTables) {
    try {
      const [tableExists] = await connection.execute(`
        SELECT COUNT(*) as cnt FROM INFORMATION_SCHEMA.TABLES
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
      `, [ref.table]);

      if (tableExists[0].cnt > 0) {
        // Add new ULID column
        await connection.execute(`
          ALTER TABLE ${ref.table}
          ADD COLUMN ${ref.column}New CHAR(26) NULL AFTER ${ref.column}
        `);

        // Migrate data
        for (const [oldId, newId] of Object.entries(idMapping)) {
          await connection.execute(`
            UPDATE ${ref.table} SET ${ref.column}New = ? WHERE ${ref.column} = ?
          `, [newId, oldId]);
        }

        // Drop old column and rename new column
        await connection.execute(`ALTER TABLE ${ref.table} DROP COLUMN ${ref.column}`);
        await connection.execute(`ALTER TABLE ${ref.table} CHANGE ${ref.column}New ${ref.column} CHAR(26) NOT NULL`);

        console.log(`✓ Migrated ${ref.table}.${ref.column} to ULID`);
      }
    } catch (e) {
      console.log(`Error migrating ${ref.table}.${ref.column}:`, e.message);
    }
  }

  // 2.8 Drop old primary key and set new one
  await connection.execute(`ALTER TABLE g_remote_config_environments DROP PRIMARY KEY`);
  await connection.execute(`ALTER TABLE g_remote_config_environments DROP COLUMN id`);
  await connection.execute(`ALTER TABLE g_remote_config_environments CHANGE newId id CHAR(26) NOT NULL`);
  await connection.execute(`ALTER TABLE g_remote_config_environments ADD PRIMARY KEY (id)`);

  console.log('✓ Migrated g_remote_config_environments.id to ULID');

  // 2.9 Recreate foreign keys
  for (const ref of referencingTables) {
    try {
      const [tableExists] = await connection.execute(`
        SELECT COUNT(*) as cnt FROM INFORMATION_SCHEMA.TABLES
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
      `, [ref.table]);

      if (tableExists[0].cnt > 0) {
        await connection.execute(`
          ALTER TABLE ${ref.table}
          ADD CONSTRAINT ${ref.fk} FOREIGN KEY (${ref.column}) REFERENCES g_remote_config_environments(id)
        `);
        console.log(`✓ Recreated FK ${ref.fk} on ${ref.table}`);
      }
    } catch (e) {
      console.log(`Error recreating FK ${ref.fk}:`, e.message);
    }
  }

  // 3. Add new columns to g_remote_config_environments
  console.log('Adding new columns to g_remote_config_environments...');

  // Check and add environmentType column
  const [envTypeExists] = await connection.execute(`
    SELECT COUNT(*) as cnt FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'g_remote_config_environments'
    AND COLUMN_NAME = 'environmentType'
  `);

  if (envTypeExists[0].cnt === 0) {
    await connection.execute(`
      ALTER TABLE g_remote_config_environments
      ADD COLUMN environmentType ENUM('development', 'staging', 'production') NOT NULL DEFAULT 'development'
      AFTER description
    `);
    console.log('✓ Added environmentType column');
  }

  // Check and add isSystemDefined column
  const [sysDefExists] = await connection.execute(`
    SELECT COUNT(*) as cnt FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'g_remote_config_environments'
    AND COLUMN_NAME = 'isSystemDefined'
  `);

  if (sysDefExists[0].cnt === 0) {
    await connection.execute(`
      ALTER TABLE g_remote_config_environments
      ADD COLUMN isSystemDefined BOOLEAN NOT NULL DEFAULT FALSE
      AFTER environmentType
    `);
    console.log('✓ Added isSystemDefined column');
  }

  // Check and add displayOrder column
  const [orderExists] = await connection.execute(`
    SELECT COUNT(*) as cnt FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'g_remote_config_environments'
    AND COLUMN_NAME = 'displayOrder'
  `);

  if (orderExists[0].cnt === 0) {
    await connection.execute(`
      ALTER TABLE g_remote_config_environments
      ADD COLUMN displayOrder INT NOT NULL DEFAULT 0
      AFTER isSystemDefined
    `);
    console.log('✓ Added displayOrder column');
  }

  // Check and add color column
  const [colorExists] = await connection.execute(`
    SELECT COUNT(*) as cnt FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'g_remote_config_environments'
    AND COLUMN_NAME = 'color'
  `);

  if (colorExists[0].cnt === 0) {
    await connection.execute(`
      ALTER TABLE g_remote_config_environments
      ADD COLUMN color VARCHAR(7) NOT NULL DEFAULT '#607D8B'
      AFTER displayOrder
    `);
    console.log('✓ Added color column');
  }

  // Check and add projectId column
  const [projIdExists] = await connection.execute(`
    SELECT COUNT(*) as cnt FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'g_remote_config_environments'
    AND COLUMN_NAME = 'projectId'
  `);

  if (projIdExists[0].cnt === 0) {
    await connection.execute(`
      ALTER TABLE g_remote_config_environments
      ADD COLUMN projectId CHAR(26) NULL
      AFTER color
    `);

    // Add foreign key for projectId
    await connection.execute(`
      ALTER TABLE g_remote_config_environments
      ADD CONSTRAINT fk_rc_env_project FOREIGN KEY (projectId) REFERENCES g_projects(id) ON DELETE SET NULL
    `);
    console.log('✓ Added projectId column with foreign key');
  }

  // 4. Get the default project ID
  const [defaultProject] = await connection.execute(`
    SELECT id FROM g_projects WHERE isDefault = TRUE LIMIT 1
  `);
  const projectId = defaultProject[0]?.id || defaultProjectId;

  // 5. Update existing environments or insert predefined ones
  console.log('Creating/updating predefined environments...');

  // Check if predefined environments exist
  const [devEnv] = await connection.execute(`
    SELECT id FROM g_remote_config_environments WHERE environmentName = 'development'
  `);
  const [qaEnv] = await connection.execute(`
    SELECT id FROM g_remote_config_environments WHERE environmentName = 'qa'
  `);
  const [prodEnv] = await connection.execute(`
    SELECT id FROM g_remote_config_environments WHERE environmentName = 'production'
  `);

  if (devEnv.length > 0) {
    await connection.execute(`
      UPDATE g_remote_config_environments
      SET environmentType = 'development', isSystemDefined = TRUE, isDefault = TRUE, displayOrder = 1, color = '#4CAF50', projectId = ?
      WHERE environmentName = 'development'
    `, [projectId]);
  } else {
    await connection.execute(`
      INSERT INTO g_remote_config_environments
      (id, environmentName, displayName, description, environmentType, isSystemDefined, isDefault, displayOrder, color, projectId, requiresApproval, requiredApprovers, createdBy)
      VALUES (?, 'development', 'Development', 'Development environment for testing and feature development', 'development', TRUE, TRUE, 1, '#4CAF50', ?, FALSE, 1, 1)
    `, [generateUlid(), projectId]);
  }

  if (qaEnv.length > 0) {
    await connection.execute(`
      UPDATE g_remote_config_environments
      SET environmentType = 'staging', isSystemDefined = TRUE, displayOrder = 2, color = '#FF9800', projectId = ?
      WHERE environmentName = 'qa'
    `, [projectId]);
  } else {
    await connection.execute(`
      INSERT INTO g_remote_config_environments
      (id, environmentName, displayName, description, environmentType, isSystemDefined, isDefault, displayOrder, color, projectId, requiresApproval, requiredApprovers, createdBy)
      VALUES (?, 'qa', 'QA', 'QA environment for quality assurance testing', 'staging', TRUE, FALSE, 2, '#FF9800', ?, TRUE, 1, 1)
    `, [generateUlid(), projectId]);
  }

  if (prodEnv.length > 0) {
    await connection.execute(`
      UPDATE g_remote_config_environments
      SET environmentType = 'production', isSystemDefined = TRUE, displayOrder = 3, color = '#F44336', projectId = ?
      WHERE environmentName = 'production'
    `, [projectId]);
  } else {
    await connection.execute(`
      INSERT INTO g_remote_config_environments
      (id, environmentName, displayName, description, environmentType, isSystemDefined, isDefault, displayOrder, color, projectId, requiresApproval, requiredApprovers, createdBy)
      VALUES (?, 'production', 'Production', 'Production environment for live users', 'production', TRUE, FALSE, 3, '#F44336', ?, TRUE, 2, 1)
    `, [generateUlid(), projectId]);
  }

  console.log('✓ Predefined environments created/updated');
  console.log('Multi-environment support migration completed successfully');
};

exports.down = async function(connection) {
  console.log('Rolling back multi-environment support migration...');
  console.log('WARNING: This rollback will convert ULIDs back to INT IDs. Data may be lost.');

  // Remove foreign key constraint first
  try {
    await connection.execute(`
      ALTER TABLE g_remote_config_environments DROP FOREIGN KEY fk_rc_env_project
    `);
  } catch (e) {
    console.log('Foreign key fk_rc_env_project may not exist, continuing...');
  }

  // Remove added columns from g_remote_config_environments
  const columnsToRemove = ['projectId', 'color', 'displayOrder', 'isSystemDefined', 'environmentType'];

  for (const column of columnsToRemove) {
    try {
      const [exists] = await connection.execute(`
        SELECT COUNT(*) as cnt FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'g_remote_config_environments'
        AND COLUMN_NAME = ?
      `, [column]);

      if (exists[0].cnt > 0) {
        await connection.execute(`
          ALTER TABLE g_remote_config_environments DROP COLUMN ${column}
        `);
        console.log(`✓ Dropped column: ${column}`);
      }
    } catch (e) {
      console.log(`Error dropping column ${column}:`, e.message);
    }
  }

  // Note: Converting ULID back to INT is complex and may result in data loss
  // This rollback does not convert the id column back to INT
  console.log('Note: The id column remains as CHAR(26). Manual intervention may be required.');

  // Drop projects table
  await connection.execute('DROP TABLE IF EXISTS g_projects');
  console.log('✓ Dropped g_projects table');

  console.log('Multi-environment support migration rollback completed');
};


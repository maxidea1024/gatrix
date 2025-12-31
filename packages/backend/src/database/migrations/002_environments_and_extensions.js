/**
 * Extended Schema for Multi-Environment Support
 * 
 * This migration adds:
 * 1. g_projects table for project management
 * 2. g_environments table (using 'environment' as primary key)
 * 3. Environment columns to various tables
 * 4. API access tokens and user permissions
 * 5. Server lifecycle events
 * 6. Store products
 * 7. Remote config templates and metrics
 * 8. Banners
 * 9. Monitoring alerts
 */

exports.up = async function (connection) {
    console.log('Creating extended schema for multi-environment support...');

    // ========================================
    // 1. Projects table
    // ========================================
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
    console.log('✓ g_projects table created');

    // ========================================
    // 2. Environments table (environment as primary key)
    // ========================================
    await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_environments (
      environment VARCHAR(100) NOT NULL PRIMARY KEY COMMENT 'Environment name (lowercase, numbers, underscore, hyphen)',
      displayName VARCHAR(200) NOT NULL,
      description TEXT NULL,
      environmentType ENUM('development', 'staging', 'production') NOT NULL DEFAULT 'development',
      isSystemDefined BOOLEAN NOT NULL DEFAULT FALSE,
      isHidden BOOLEAN NOT NULL DEFAULT FALSE,
      displayOrder INT NOT NULL DEFAULT 0,
      color VARCHAR(7) NOT NULL DEFAULT '#607D8B',
      projectId VARCHAR(127) NULL,
      isDefault BOOLEAN NOT NULL DEFAULT FALSE,
      requiresApproval BOOLEAN NOT NULL DEFAULT FALSE,
      requiredApprovers INT NOT NULL DEFAULT 1,
      createdBy INT NOT NULL,
      updatedBy INT NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

      INDEX idx_is_default (isDefault),
      INDEX idx_display_order (displayOrder),
      CONSTRAINT fk_env_project FOREIGN KEY (projectId) REFERENCES g_projects(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
    console.log('✓ g_environments table created');

    // ========================================
    // 3. API Access Tokens
    // ========================================
    await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_api_access_tokens (
      id VARCHAR(26) NOT NULL PRIMARY KEY COMMENT 'ULID',
      tokenName VARCHAR(255) NOT NULL,
      tokenValue VARCHAR(64) NOT NULL UNIQUE COMMENT 'Hashed token value',
      tokenType ENUM('client', 'server', 'admin', 'all') NOT NULL DEFAULT 'client',
      allowedIps JSON NULL COMMENT 'Array of allowed IP addresses or CIDR ranges',
      allowAllEnvironments BOOLEAN NOT NULL DEFAULT FALSE COMMENT 'If true, token can access all environments',
      isActive BOOLEAN NOT NULL DEFAULT TRUE,
      expiresAt TIMESTAMP NULL,
      lastUsedAt TIMESTAMP NULL,
      usageCount BIGINT UNSIGNED NOT NULL DEFAULT 0,
      createdBy INT NOT NULL,
      updatedBy INT NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

      INDEX idx_token_value (tokenValue),
      INDEX idx_token_type (tokenType),
      INDEX idx_is_active (isActive),
      INDEX idx_expires_at (expiresAt),
      CONSTRAINT fk_api_tokens_created_by FOREIGN KEY (createdBy) REFERENCES g_users(id),
      CONSTRAINT fk_api_tokens_updated_by FOREIGN KEY (updatedBy) REFERENCES g_users(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
    console.log('✓ g_api_access_tokens table created');

    // ========================================
    // 4. API Access Token Environments (Many-to-Many)
    // ========================================
    await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_api_access_token_environments (
      id VARCHAR(26) NOT NULL PRIMARY KEY COMMENT 'ULID',
      tokenId VARCHAR(26) NOT NULL,
      environment VARCHAR(100) NOT NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

      UNIQUE KEY unique_token_env (tokenId, environment),
      CONSTRAINT fk_token_env_token FOREIGN KEY (tokenId) REFERENCES g_api_access_tokens(id) ON DELETE CASCADE,
      CONSTRAINT fk_token_env_environment FOREIGN KEY (environment) REFERENCES g_environments(environment) ON DELETE CASCADE ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
    console.log('✓ g_api_access_token_environments table created');

    // ========================================
    // 5. User Environments (Many-to-Many)
    // ========================================
    await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_user_environments (
      id VARCHAR(26) NOT NULL PRIMARY KEY COMMENT 'ULID',
      userId INT NOT NULL,
      environment VARCHAR(100) NOT NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

      UNIQUE KEY unique_user_env (userId, environment),
      CONSTRAINT fk_user_env_user FOREIGN KEY (userId) REFERENCES g_users(id) ON DELETE CASCADE,
      CONSTRAINT fk_user_env_environment FOREIGN KEY (environment) REFERENCES g_environments(environment) ON DELETE CASCADE ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
    console.log('✓ g_user_environments table created');

    // ========================================
    // 6. User Permissions
    // ========================================
    await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_user_permissions (
      id VARCHAR(26) NOT NULL PRIMARY KEY COMMENT 'ULID',
      userId INT NOT NULL,
      environment VARCHAR(100) NOT NULL,
      permission VARCHAR(100) NOT NULL COMMENT 'Permission key (e.g., client_versions.edit)',
      createdBy INT NOT NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

      UNIQUE KEY unique_user_env_perm (userId, environment, permission),
      INDEX idx_user_id (userId),
      INDEX idx_environment (environment),
      CONSTRAINT fk_user_perm_user FOREIGN KEY (userId) REFERENCES g_users(id) ON DELETE CASCADE,
      CONSTRAINT fk_user_perm_environment FOREIGN KEY (environment) REFERENCES g_environments(environment) ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT fk_user_perm_created_by FOREIGN KEY (createdBy) REFERENCES g_users(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
    console.log('✓ g_user_permissions table created');

    // ========================================
    // 7. Server Lifecycle Events
    // ========================================
    await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_server_lifecycle_events (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      environment VARCHAR(100) NOT NULL,
      instanceId VARCHAR(127) NOT NULL,
      serviceType VARCHAR(63) NOT NULL,
      serviceGroup VARCHAR(63),
      hostname VARCHAR(255) NULL,
      internalAddress VARCHAR(255) NULL,
      externalAddress VARCHAR(255) NULL,
      appVersion VARCHAR(63) NULL,
      sdkVersion VARCHAR(63) NULL,
      eventType VARCHAR(31) NOT NULL COMMENT 'REGISTER, READY, UNREGISTER, STATUS_CHANGE, TIMEOUT',
      instanceStatus VARCHAR(31) NOT NULL,
      uptimeSeconds INT UNSIGNED DEFAULT 0,
      heartbeatCount INT UNSIGNED DEFAULT 0,
      lastHeartbeatAt TIMESTAMP NULL,
      ports JSON NULL,
      labels JSON NULL,
      metadata JSON NULL,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

      INDEX idx_lifecycle_instanceId (instanceId),
      INDEX idx_lifecycle_serviceType (serviceType),
      INDEX idx_lifecycle_serviceGroup (serviceGroup),
      INDEX idx_lifecycle_environment (environment),
      INDEX idx_lifecycle_createdAt (createdAt),
      CONSTRAINT fk_lifecycle_environment FOREIGN KEY (environment) REFERENCES g_environments(environment) ON DELETE CASCADE ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
    console.log('✓ g_server_lifecycle_events table created');

    // ========================================
    // 8. Remote Config Templates
    // ========================================
    await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_remote_config_templates (
      id VARCHAR(26) NOT NULL PRIMARY KEY COMMENT 'ULID',
      environment VARCHAR(100) NOT NULL,
      name VARCHAR(255) NOT NULL,
      displayName VARCHAR(255) NULL,
      description TEXT NULL,
      templateSchema JSON NULL COMMENT 'JSON Schema for template values',
      defaultValue JSON NULL,
      status ENUM('draft', 'published', 'archived') NOT NULL DEFAULT 'draft',
      version INT NOT NULL DEFAULT 1,
      createdBy INT NOT NULL,
      updatedBy INT NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

      UNIQUE KEY unique_env_name (environment, name),
      INDEX idx_environment (environment),
      INDEX idx_status (status),
      CONSTRAINT fk_rc_templates_environment FOREIGN KEY (environment) REFERENCES g_environments(environment) ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT fk_rc_templates_created_by FOREIGN KEY (createdBy) REFERENCES g_users(id),
      CONSTRAINT fk_rc_templates_updated_by FOREIGN KEY (updatedBy) REFERENCES g_users(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
    console.log('✓ g_remote_config_templates table created');

    // ========================================
    // 9. Remote Config Metrics
    // ========================================
    await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_remote_config_metrics (
      id VARCHAR(26) NOT NULL PRIMARY KEY COMMENT 'ULID',
      environment VARCHAR(100) NOT NULL,
      configKey VARCHAR(255) NOT NULL,
      fetchCount BIGINT UNSIGNED NOT NULL DEFAULT 0,
      lastFetchedAt TIMESTAMP NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

      UNIQUE KEY unique_env_key (environment, configKey),
      INDEX idx_environment (environment),
      CONSTRAINT fk_rc_metrics_environment FOREIGN KEY (environment) REFERENCES g_environments(environment) ON DELETE CASCADE ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
    console.log('✓ g_remote_config_metrics table created');

    // ========================================
    // 10. Banners
    // ========================================
    await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_banners (
      bannerId VARCHAR(26) NOT NULL PRIMARY KEY COMMENT 'ULID',
      environment VARCHAR(100) NOT NULL,
      name VARCHAR(255) NOT NULL,
      position VARCHAR(50) NOT NULL DEFAULT 'main' COMMENT 'Banner position (main, side, popup, etc)',
      isActive BOOLEAN NOT NULL DEFAULT TRUE,
      priority INT NOT NULL DEFAULT 0,
      imageUrl VARCHAR(1000) NULL,
      linkUrl VARCHAR(1000) NULL,
      linkType ENUM('internal', 'external', 'none') NOT NULL DEFAULT 'none',
      targetPlatforms JSON NULL,
      targetChannels JSON NULL,
      startDate TIMESTAMP NULL,
      endDate TIMESTAMP NULL,
      displayConditions JSON NULL,
      createdBy INT NOT NULL,
      updatedBy INT NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

      UNIQUE KEY unique_env_name (environment, name),
      INDEX idx_environment (environment),
      INDEX idx_position (position),
      INDEX idx_is_active (isActive),
      INDEX idx_dates (startDate, endDate),
      CONSTRAINT fk_banners_environment FOREIGN KEY (environment) REFERENCES g_environments(environment) ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT fk_banners_created_by FOREIGN KEY (createdBy) REFERENCES g_users(id),
      CONSTRAINT fk_banners_updated_by FOREIGN KEY (updatedBy) REFERENCES g_users(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
    console.log('✓ g_banners table created');

    // ========================================
    // 11. Monitoring Alerts
    // ========================================
    await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_monitoring_alerts (
      id VARCHAR(26) NOT NULL PRIMARY KEY COMMENT 'ULID',
      alertType VARCHAR(50) NOT NULL,
      severity ENUM('info', 'warning', 'error', 'critical') NOT NULL DEFAULT 'warning',
      title VARCHAR(255) NOT NULL,
      message TEXT NULL,
      source VARCHAR(100) NULL,
      metadata JSON NULL,
      isAcknowledged BOOLEAN NOT NULL DEFAULT FALSE,
      acknowledgedBy INT NULL,
      acknowledgedAt TIMESTAMP NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

      INDEX idx_alert_type (alertType),
      INDEX idx_severity (severity),
      INDEX idx_is_acknowledged (isAcknowledged),
      INDEX idx_created_at (createdAt)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
    console.log('✓ g_monitoring_alerts table created');

    // ========================================
    // 12. Store Products
    // ========================================
    await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_store_products (
      id VARCHAR(26) NOT NULL PRIMARY KEY COMMENT 'ULID',
      environment VARCHAR(100) NOT NULL,
      productId VARCHAR(100) NOT NULL COMMENT 'Product identifier in store',
      cmsProductId VARCHAR(100) NULL COMMENT 'CMS product ID for linking',
      productName VARCHAR(255) NOT NULL,
      productNameEn VARCHAR(255) NULL,
      productNameZh VARCHAR(255) NULL,
      description TEXT NULL,
      descriptionEn TEXT NULL,
      descriptionZh TEXT NULL,
      price DECIMAL(15, 2) NOT NULL,
      currency VARCHAR(10) NOT NULL DEFAULT 'USD',
      productType VARCHAR(50) NOT NULL DEFAULT 'consumable',
      isActive BOOLEAN NOT NULL DEFAULT TRUE,
      metadata JSON NULL,
      createdBy INT NOT NULL,
      updatedBy INT NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

      UNIQUE KEY unique_env_product (environment, productId),
      INDEX idx_environment (environment),
      INDEX idx_product_type (productType),
      INDEX idx_is_active (isActive),
      CONSTRAINT fk_store_products_environment FOREIGN KEY (environment) REFERENCES g_environments(environment) ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT fk_store_products_created_by FOREIGN KEY (createdBy) REFERENCES g_users(id),
      CONSTRAINT fk_store_products_updated_by FOREIGN KEY (updatedBy) REFERENCES g_users(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
    console.log('✓ g_store_products table created');

    // ========================================
    // 13. Add allowAllEnvironments column to g_users
    // ========================================
    try {
        const [cols] = await connection.execute(
            `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'g_users'`
        );
        const existingCols = cols.map(c => c.COLUMN_NAME);

        if (!existingCols.includes('allowAllEnvironments')) {
            await connection.execute(`
        ALTER TABLE g_users 
        ADD COLUMN allowAllEnvironments BOOLEAN NOT NULL DEFAULT FALSE COMMENT 'If true, user can access all environments'
      `);
            console.log('✓ Added allowAllEnvironments column to g_users');
        }
    } catch (err) {
        console.log(`  Skipping g_users allowAllEnvironments: ${err.message}`);
    }

    // ========================================
    // 14. Add environment column to existing tables
    // ========================================
    const tablesToAddEnv = [
        { table: 'g_game_worlds', afterColumn: 'id' },
        { table: 'g_client_versions', afterColumn: 'id' },
        { table: 'g_service_notices', afterColumn: 'id' },
        { table: 'g_ingame_popup_notices', afterColumn: 'id' },
        { table: 'g_surveys', afterColumn: 'id' },
        { table: 'g_coupon_settings', afterColumn: 'id' },
        { table: 'g_jobs', afterColumn: 'id' },
        { table: 'g_vars', afterColumn: 'id' },
        { table: 'g_message_templates', afterColumn: 'id' },
        { table: 'g_remote_config_segments', afterColumn: 'id' },
        { table: 'g_remote_config_campaigns', afterColumn: 'id' },
    ];

    for (const { table, afterColumn } of tablesToAddEnv) {
        try {
            // Check if column exists
            const [columns] = await connection.execute(
                `SELECT COUNT(*) as cnt FROM INFORMATION_SCHEMA.COLUMNS 
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = 'environment'`,
                [table]
            );

            if (columns[0].cnt === 0) {
                await connection.execute(`
          ALTER TABLE ${table}
          ADD COLUMN environment VARCHAR(100) NOT NULL DEFAULT 'development' AFTER ${afterColumn}
        `);

                // Add foreign key
                const fkName = `fk_${table.replace('g_', '')}_environment`;
                await connection.execute(`
          ALTER TABLE ${table}
          ADD CONSTRAINT ${fkName} FOREIGN KEY (environment) 
          REFERENCES g_environments(environment) ON DELETE CASCADE ON UPDATE CASCADE
        `);

                console.log(`✓ Added environment column to ${table}`);
            }
        } catch (err) {
            console.log(`  Skipping ${table}: ${err.message}`);
        }
    }

    // ========================================
    // 14. Add columns to g_game_worlds
    // ========================================
    try {
        const [cols] = await connection.execute(
            `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'g_game_worlds'`
        );
        const existingCols = cols.map(c => c.COLUMN_NAME);

        if (!existingCols.includes('serverAddress')) {
            await connection.execute(`
        ALTER TABLE g_game_worlds 
        ADD COLUMN serverAddress VARCHAR(500) NOT NULL DEFAULT '' COMMENT 'Game server address for SDK clients'
      `);
        }
        if (!existingCols.includes('maintenanceStartDate')) {
            await connection.execute(`
        ALTER TABLE g_game_worlds 
        ADD COLUMN maintenanceStartDate TIMESTAMP NULL COMMENT 'Scheduled maintenance start time'
      `);
        }
        if (!existingCols.includes('maintenanceEndDate')) {
            await connection.execute(`
        ALTER TABLE g_game_worlds 
        ADD COLUMN maintenanceEndDate TIMESTAMP NULL COMMENT 'Scheduled maintenance end time'
      `);
        }
        if (!existingCols.includes('maintenanceOptions')) {
            await connection.execute(`
        ALTER TABLE g_game_worlds 
        ADD COLUMN maintenanceOptions JSON NULL COMMENT 'Maintenance options (allowWhitelist, showCountdown, countdownSeconds)'
      `);
        }
        if (!existingCols.includes('infraSettings')) {
            await connection.execute(`
        ALTER TABLE g_game_worlds 
        ADD COLUMN infraSettings TEXT NULL COMMENT 'Infrastructure settings (JSON or YAML)'
      `);
        }
        console.log('✓ Extended g_game_worlds columns');
    } catch (err) {
        console.log(`  Skipping g_game_worlds extensions: ${err.message}`);
    }

    // ========================================
    // 15. Fix unique constraints for multi-env
    // ========================================
    try {
        // g_client_versions: unique per environment + platform + version
        await connection.execute(`
      ALTER TABLE g_client_versions DROP INDEX unique_platform_version
    `).catch(() => { });
        await connection.execute(`
      ALTER TABLE g_client_versions 
      ADD UNIQUE KEY unique_env_platform_version (environment, platform, clientVersion)
    `).catch(() => { });

        // g_vars: unique per environment + varKey
        await connection.execute(`
      ALTER TABLE g_vars DROP INDEX varKey
    `).catch(() => { });
        await connection.execute(`
      ALTER TABLE g_vars 
      ADD UNIQUE KEY unique_env_varkey (environment, varKey)
    `).catch(() => { });

        // g_game_worlds: unique per environment + worldId
        await connection.execute(`
      ALTER TABLE g_game_worlds DROP INDEX worldId
    `).catch(() => { });
        await connection.execute(`
      ALTER TABLE g_game_worlds 
      ADD UNIQUE KEY unique_env_worldid (environment, worldId)
    `).catch(() => { });

        // g_jobs: unique per environment + name
        await connection.execute(`
      ALTER TABLE g_jobs 
      ADD UNIQUE KEY unique_env_name (environment, name)
    `).catch(() => { });

        // g_message_templates: unique per environment + name
        await connection.execute(`
      ALTER TABLE g_message_templates DROP INDEX name
    `).catch(() => { });
        await connection.execute(`
      ALTER TABLE g_message_templates 
      ADD UNIQUE KEY unique_env_name (environment, name)
    `).catch(() => { });

        console.log('✓ Fixed unique constraints for multi-environment');
    } catch (err) {
        console.log(`  Unique constraint updates: ${err.message}`);
    }

    // ========================================
    // 16. Add channel targeting to service notices
    // ========================================
    try {
        const [cols] = await connection.execute(
            `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'g_service_notices'`
        );
        const existingCols = cols.map(c => c.COLUMN_NAME);

        if (!existingCols.includes('targetChannels')) {
            await connection.execute(`
        ALTER TABLE g_service_notices 
        ADD COLUMN targetChannels JSON NULL COMMENT 'Target channels for the notice'
      `);
        }
        if (!existingCols.includes('targetChannelsInverted')) {
            await connection.execute(`
        ALTER TABLE g_service_notices 
        ADD COLUMN targetChannelsInverted BOOLEAN NOT NULL DEFAULT FALSE COMMENT 'Invert channel targeting'
      `);
        }
        console.log('✓ Added channel targeting to g_service_notices');
    } catch (err) {
        console.log(`  Skipping service notices channel targeting: ${err.message}`);
    }

    // ========================================
    // 17. Add userAgent to crash_events
    // ========================================
    try {
        await connection.execute(`
      ALTER TABLE crash_events 
      ADD COLUMN userAgent TEXT NULL COMMENT 'User agent string'
    `);
        console.log('✓ Added userAgent to crash_events');
    } catch (err) {
        // Column might already exist
    }

    // ========================================
    // 18. Add rewardTemplateId to g_surveys
    // ========================================
    try {
        const [cols] = await connection.execute(
            `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'g_surveys'`
        );
        const existingCols = cols.map(c => c.COLUMN_NAME);

        if (!existingCols.includes('rewardTemplateId')) {
            await connection.execute(`
        ALTER TABLE g_surveys 
        ADD COLUMN rewardTemplateId VARCHAR(26) NULL COMMENT 'Reference to reward template'
      `);
        }
        console.log('✓ Added rewardTemplateId to g_surveys');
    } catch (err) {
        // Column might already exist
    }

    // ========================================
    // 19. Add channel to g_coupon_target_subchannels
    // ========================================
    try {
        await connection.execute(`
      ALTER TABLE g_coupon_target_subchannels 
      ADD COLUMN channel VARCHAR(64) NULL COMMENT 'Parent channel for subchannel targeting'
    `);
        console.log('✓ Added channel to g_coupon_target_subchannels');
    } catch (err) {
        // Column might already exist
    }

    // ========================================
    // 20. Insert default project
    // ========================================
    const { ulid } = require('ulid');
    const defaultProjectId = ulid();

    await connection.execute(`
    INSERT IGNORE INTO g_projects (id, projectName, displayName, description, isDefault, createdBy)
    VALUES (?, 'default', 'Default Project', 'Default project for all environments', TRUE, 1)
  `, [defaultProjectId]);

    // ========================================
    // 21. Insert predefined environments
    // ========================================
    await connection.execute(`
    INSERT IGNORE INTO g_environments 
    (environment, displayName, description, environmentType, isSystemDefined, isDefault, displayOrder, color, projectId, requiresApproval, requiredApprovers, createdBy)
    VALUES 
    ('development', 'Development', 'Development environment for testing', 'development', TRUE, TRUE, 1, '#4CAF50', ?, FALSE, 1, 1),
    ('qa', 'QA', 'QA environment for quality assurance', 'staging', TRUE, FALSE, 2, '#FF9800', ?, TRUE, 1, 1),
    ('production', 'Production', 'Production environment for live users', 'production', TRUE, FALSE, 3, '#F44336', ?, TRUE, 2, 1),
    ('gatrix-env', 'Gatrix Internal', 'Hidden internal environment for Gatrix system', 'development', TRUE, FALSE, 999, '#607D8B', ?, FALSE, 1, 1)
  `, [defaultProjectId, defaultProjectId, defaultProjectId, defaultProjectId]);

    // Set gatrix-env as hidden
    await connection.execute(`
    UPDATE g_environments SET isHidden = TRUE WHERE environment = 'gatrix-env'
  `);

    console.log('✓ Predefined environments created');

    // ========================================
    // 22. Seed system KVs for environments
    // ========================================
    const systemKvs = [
        { key: 'kv:platforms', value: '["pc","android","ios","harmonyos","pc-wegame"]', type: 'array', desc: 'Supported platforms' },
        { key: 'kv:channels', value: '[]', type: 'array', desc: 'Supported channels' },
        { key: '$clientVersionPassiveData', value: '{}', type: 'object', desc: 'Client version passive data' },
    ];

    const [envs] = await connection.execute(`SELECT environment FROM g_environments WHERE isHidden = FALSE`);

    for (const env of envs) {
        for (const kv of systemKvs) {
            await connection.execute(`
        INSERT IGNORE INTO g_vars (varKey, varValue, valueType, description, isSystemDefined, isCopyable, environment, createdBy)
        VALUES (?, ?, ?, ?, TRUE, FALSE, ?, 1)
      `, [kv.key, kv.value, kv.type, kv.desc, env.environment]);
        }
    }
    console.log('✓ System KVs seeded for environments');

    // ========================================
    // 23. Seed default tags
    // ========================================
    const defaultTags = [
        { name: 'Android', color: '#3DDC84' },
        { name: 'iOS', color: '#000000' },
        { name: 'PC', color: '#0078D7' },
        { name: 'HarmonyOS', color: '#FF6B6B' },
        { name: 'PC-Wegame', color: '#FFB800' },
    ];

    for (const tag of defaultTags) {
        await connection.execute(`
      INSERT IGNORE INTO g_tags (name, color, description, createdBy)
      VALUES (?, ?, ?, 1)
    `, [tag.name, tag.color, `Default tag for ${tag.name} platform`]);
    }
    console.log('✓ Default tags seeded');

    // ========================================
    // 24. Add superadmin wildcard permission
    // ========================================
    const [adminUsers] = await connection.execute(`SELECT id FROM g_users WHERE role = 'admin'`);

    for (const admin of adminUsers) {
        for (const env of envs) {
            await connection.execute(`
        INSERT IGNORE INTO g_user_permissions (id, userId, environment, permission, createdBy)
        VALUES (?, ?, ?, '*', 1)
      `, [ulid(), admin.id, env.environment]);
        }
    }
    console.log('✓ Superadmin permissions granted');

    console.log('🎉 Extended schema creation completed successfully!');
};

exports.down = async function (connection) {
    console.log('Rolling back extended schema...');

    // Drop tables in reverse order
    const tables = [
        'g_store_products',
        'g_monitoring_alerts',
        'g_banners',
        'g_remote_config_metrics',
        'g_remote_config_templates',
        'g_server_lifecycle_events',
        'g_user_permissions',
        'g_user_environments',
        'g_api_access_token_environments',
        'g_api_access_tokens',
        'g_environments',
        'g_projects',
    ];

    for (const table of tables) {
        await connection.execute(`DROP TABLE IF EXISTS ${table}`);
        console.log(`✓ Dropped table: ${table}`);
    }

    console.log('✓ Extended schema rollback completed');
};

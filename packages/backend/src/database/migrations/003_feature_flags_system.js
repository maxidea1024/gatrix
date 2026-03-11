/**
 * 003 - Feature Flags System
 * Feature flags, strategies, variants, segments, context fields, metrics
 * All IDs use ULID (CHAR(26))
 */

exports.up = async function (connection) {
  console.log('[003] Creating feature flags system tables...');

  // Feature flags
  await connection.execute(`
    CREATE TABLE g_feature_flags (
      id CHAR(26) NOT NULL PRIMARY KEY COMMENT 'ULID',
      projectId CHAR(26) NOT NULL,
      flagName VARCHAR(255) NOT NULL,
      displayName VARCHAR(500) NULL,
      description TEXT NULL,
      flagType ENUM('release', 'experiment', 'operational', 'killSwitch', 'permission', 'remoteConfig') NOT NULL DEFAULT 'release',
      featureType VARCHAR(50) NULL,
      isArchived BOOLEAN NOT NULL DEFAULT FALSE,
      archivedAt TIMESTAMP NULL,
      impressionDataEnabled BOOLEAN NOT NULL DEFAULT FALSE,
      staleAfterDays INT NOT NULL DEFAULT 30,
      tags JSON NULL,
      version INT NOT NULL DEFAULT 1,
      isFavorite BOOLEAN NOT NULL DEFAULT FALSE,
      isStale BOOLEAN NOT NULL DEFAULT FALSE,
      links JSON NULL,
      createdBy CHAR(26) NOT NULL,
      updatedBy CHAR(26) NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_ff_project FOREIGN KEY (projectId) REFERENCES g_projects(id) ON DELETE CASCADE,
      UNIQUE KEY unique_project_flag (projectId, flagName),
      INDEX idx_project_id (projectId),
      INDEX idx_flag_name (flagName),
      INDEX idx_flag_type (flagType),
      INDEX idx_is_archived (isArchived)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // Feature flag environments
  await connection.execute(`
    CREATE TABLE g_feature_flag_environments (
      id CHAR(26) NOT NULL PRIMARY KEY COMMENT 'ULID',
      flagId CHAR(26) NOT NULL,
      environmentId CHAR(26) NOT NULL,
      isEnabled BOOLEAN NOT NULL DEFAULT FALSE,
      lastSeenAt TIMESTAMP NULL,
      baselinePayload JSON NULL,
      createdBy CHAR(26) NULL,
      updatedBy CHAR(26) NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_ffe_flag FOREIGN KEY (flagId) REFERENCES g_feature_flags(id) ON DELETE CASCADE,
      UNIQUE KEY unique_flag_env (flagId, environmentId),
      INDEX idx_flag_id (flagId),
      INDEX idx_environment_id (environmentId)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // Feature strategies
  await connection.execute(`
    CREATE TABLE g_feature_strategies (
      id CHAR(26) NOT NULL PRIMARY KEY COMMENT 'ULID',
      flagId CHAR(26) NOT NULL,
      environmentId CHAR(26) NOT NULL,
      strategyName VARCHAR(255) NOT NULL,
      parameters JSON NULL,
      constraints JSON NULL,
      sortOrder INT NOT NULL DEFAULT 0,
      isEnabled BOOLEAN NOT NULL DEFAULT TRUE,
      createdBy CHAR(26) NOT NULL,
      updatedBy CHAR(26) NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_fs_flag FOREIGN KEY (flagId) REFERENCES g_feature_flags(id) ON DELETE CASCADE,
      INDEX idx_flag_id (flagId),
      INDEX idx_sort_order (sortOrder)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // Feature variants
  await connection.execute(`
    CREATE TABLE g_feature_variants (
      id CHAR(26) NOT NULL PRIMARY KEY COMMENT 'ULID',
      flagId CHAR(26) NOT NULL,
      environmentId CHAR(26) NOT NULL,
      variantName VARCHAR(255) NOT NULL,
      weight INT NOT NULL DEFAULT 0,
      weightLock BOOLEAN NOT NULL DEFAULT FALSE,
      value JSON NULL,
      valueType ENUM('string', 'number', 'boolean', 'json') NOT NULL DEFAULT 'json',
      stickiness VARCHAR(100) NOT NULL DEFAULT 'default',
      overrides JSON NULL,
      createdBy CHAR(26) NOT NULL,
      updatedBy CHAR(26) NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_fv_flag FOREIGN KEY (flagId) REFERENCES g_feature_flags(id) ON DELETE CASCADE,
      UNIQUE KEY unique_flag_variant (flagId, environmentId, variantName),
      INDEX idx_flag_env (flagId, environmentId)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // Feature segments
  await connection.execute(`
    CREATE TABLE g_feature_segments (
      id CHAR(26) NOT NULL PRIMARY KEY COMMENT 'ULID',
      projectId CHAR(26) NOT NULL,
      segmentName VARCHAR(255) NOT NULL,
      displayName VARCHAR(500) NULL,
      description TEXT NULL,
      constraints JSON NOT NULL,
      isActive BOOLEAN NOT NULL DEFAULT TRUE,
      tags JSON NULL,
      createdBy CHAR(26) NOT NULL,
      updatedBy CHAR(26) NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_fseg_project FOREIGN KEY (projectId) REFERENCES g_projects(id) ON DELETE CASCADE,
      UNIQUE KEY unique_project_segment (projectId, segmentName),
      INDEX idx_project_id (projectId)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // Feature flag-segment junction
  await connection.execute(`
    CREATE TABLE g_feature_flag_segments (
      id CHAR(26) NOT NULL PRIMARY KEY COMMENT 'ULID',
      strategyId CHAR(26) NOT NULL,
      segmentId CHAR(26) NOT NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_ffs_strategy FOREIGN KEY (strategyId) REFERENCES g_feature_strategies(id) ON DELETE CASCADE,
      CONSTRAINT fk_ffs_segment FOREIGN KEY (segmentId) REFERENCES g_feature_segments(id) ON DELETE CASCADE,
      UNIQUE KEY unique_strategy_segment (strategyId, segmentId)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // Feature context fields
  await connection.execute(`
    CREATE TABLE g_feature_context_fields (
      id CHAR(26) NOT NULL PRIMARY KEY COMMENT 'ULID',
      projectId CHAR(26) NOT NULL,
      fieldName VARCHAR(255) NOT NULL,
      fieldType ENUM('string', 'number', 'boolean', 'date', 'semver', 'datetime') NOT NULL,
      description TEXT NULL,
      legalValues JSON NULL,
      stickiness BOOLEAN NOT NULL DEFAULT FALSE,
      isDefaultStickinessField BOOLEAN NOT NULL DEFAULT FALSE,
      sortOrder INT NOT NULL DEFAULT 0,
      tags JSON NULL,
      isEnabled BOOLEAN NOT NULL DEFAULT TRUE,
      isGameContextField BOOLEAN NOT NULL DEFAULT FALSE,
      createdBy CHAR(26) NULL,
      updatedBy CHAR(26) NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_fcf_project FOREIGN KEY (projectId) REFERENCES g_projects(id) ON DELETE CASCADE,
      UNIQUE KEY unique_project_field (projectId, fieldName),
      INDEX idx_project_id (projectId),
      INDEX idx_field_name (fieldName),
      INDEX idx_stickiness (stickiness)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // Feature metrics
  await connection.execute(`
    CREATE TABLE g_feature_metrics (
      id CHAR(26) NOT NULL PRIMARY KEY COMMENT 'ULID',
      environmentId CHAR(26) NOT NULL,
      flagName VARCHAR(255) NOT NULL,
      metricsBucket DATETIME NOT NULL,
      yesCount INT NOT NULL DEFAULT 0,
      noCount INT NOT NULL DEFAULT 0,
      variantCounts JSON NULL,
      appName VARCHAR(255) NULL,
      sdkVersion VARCHAR(50) NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY unique_env_flag_bucket (environmentId, flagName, metricsBucket),
      INDEX idx_env_flag_bucket (environmentId, flagName, metricsBucket)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // Feature variant metrics
  await connection.execute(`
    CREATE TABLE g_feature_variant_metrics (
      id CHAR(26) NOT NULL PRIMARY KEY COMMENT 'ULID',
      environmentId CHAR(26) NOT NULL,
      flagName VARCHAR(255) NOT NULL,
      variantName VARCHAR(255) NOT NULL,
      metricsBucket DATETIME NOT NULL,
      count INT NOT NULL DEFAULT 0,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY unique_env_flag_variant_bucket (environmentId, flagName, variantName, metricsBucket)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // Feature flag types (matches main branch: 026)
  await connection.execute(`
    CREATE TABLE g_feature_flag_types (
      flagType VARCHAR(50) PRIMARY KEY COMMENT 'Type identifier',
      displayName VARCHAR(255) NOT NULL,
      description TEXT NULL,
      lifetimeDays INT NULL COMMENT 'Expected lifetime in days, NULL means does not expire',
      iconName VARCHAR(50) NULL,
      sortOrder INT NOT NULL DEFAULT 0,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_sort_order (sortOrder)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // Insert default flag types
  await connection.execute(`
    INSERT INTO g_feature_flag_types (flagType, displayName, description, lifetimeDays, iconName, sortOrder) VALUES
    ('release', 'Release', 'Release feature toggles are used to release new features.', 40, 'RocketLaunch', 1),
    ('experiment', 'Experiment', 'Experiment feature toggles are used to test and verify multiple different versions of a feature.', 40, 'Science', 2),
    ('operational', 'Operational', 'Operational feature toggles are used to control aspects of a rollout.', 7, 'Build', 3),
    ('killSwitch', 'Kill switch', 'Kill switch feature toggles are used to quickly turn on or off critical functionality in your system.', NULL, 'PowerSettingsNew', 4),
    ('permission', 'Permission', 'Permission feature toggles are used to control permissions in your system.', NULL, 'VpnKey', 5),
    ('remoteConfig', 'Remote Config', 'Remote config toggles are used for remote configuration values.', NULL, 'Tune', 6)
    ON DUPLICATE KEY UPDATE displayName = VALUES(displayName)
  `);

  // Feature code references
  await connection.execute(`
    CREATE TABLE g_feature_code_references (
      id CHAR(26) NOT NULL PRIMARY KEY COMMENT 'ULID',
      flagId CHAR(26) NOT NULL,
      filePath VARCHAR(500) NOT NULL,
      lineNumber INT NULL,
      codeSnippet TEXT NULL,
      repository VARCHAR(255) NULL,
      branch VARCHAR(100) NULL,
      commitHash VARCHAR(40) NULL,
      lastScannedAt TIMESTAMP NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_fcr_flag FOREIGN KEY (flagId) REFERENCES g_feature_flags(id) ON DELETE CASCADE,
      INDEX idx_flag_id (flagId)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // Unknown flags (matches main branch: 037+038+044)
  await connection.execute(`
    CREATE TABLE g_unknown_flags (
      id INT AUTO_INCREMENT PRIMARY KEY,
      flagName VARCHAR(255) NOT NULL,
      environmentId VARCHAR(100) NOT NULL,
      appName VARCHAR(100) NULL,
      sdkVersion VARCHAR(100) NULL,
      accessCount INT NOT NULL DEFAULT 1,
      firstReportedAt DATETIME NOT NULL,
      lastReportedAt DATETIME NOT NULL,
      isResolved TINYINT(1) NOT NULL DEFAULT 0,
      resolvedAt DATETIME NULL,
      resolvedBy VARCHAR(255) NULL,
      UNIQUE KEY uk_flag_env_app_sdk (flagName, environmentId, appName, sdkVersion)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // Impact metric configs (matches main branch: 062+063+064+065)
  await connection.execute(`
    CREATE TABLE g_impact_metric_configs (
      id VARCHAR(26) NOT NULL PRIMARY KEY,
      flagId VARCHAR(255) DEFAULT NULL,
      title VARCHAR(255) NOT NULL,
      metricName VARCHAR(255) NOT NULL,
      chartType VARCHAR(20) NOT NULL DEFAULT 'line',
      groupBy JSON DEFAULT NULL,
      labelSelectors JSON DEFAULT NULL,
      aggregationMode VARCHAR(20) NOT NULL DEFAULT 'count',
      chartRange VARCHAR(20) NOT NULL DEFAULT 'hour',
      displayOrder INT NOT NULL DEFAULT 0,
      layoutX INT NOT NULL DEFAULT 0,
      layoutY INT NOT NULL DEFAULT 0,
      layoutW INT NOT NULL DEFAULT 6,
      layoutH INT NOT NULL DEFAULT 2,
      createdBy VARCHAR(255) DEFAULT NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT (UTC_TIMESTAMP()),
      updatedAt TIMESTAMP NOT NULL DEFAULT (UTC_TIMESTAMP()) ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_imc_flagId (flagId)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  console.log('[003] ✓ Feature flags system tables completed');
};

exports.down = async function (connection) {
  const tables = [
    'g_impact_metric_configs', 'g_unknown_flags', 'g_feature_code_references',
    'g_feature_flag_types', 'g_feature_variant_metrics', 'g_feature_metrics',
    'g_feature_flag_segments', 'g_feature_segments',
    'g_feature_variants', 'g_feature_strategies',
    'g_feature_flag_environments', 'g_feature_flags',
    'g_feature_context_fields',
  ];
  for (const t of tables) {
    await connection.execute(`DROP TABLE IF EXISTS ${t}`);
  }
};

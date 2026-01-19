/**
 * Feature Flags System Database Schema
 * Creates all tables for the feature flag system
 * Uses ULID for primary keys
 * 
 * Tables:
 * - g_feature_flags: Feature flag definitions
 * - g_feature_strategies: Targeting strategies for flags
 * - g_feature_variants: A/B test variants
 * - g_feature_segments: Reusable user segments
 * - g_feature_flag_segments: Flag-Segment junction table
 * - g_feature_context_fields: Context field definitions
 * - g_feature_metrics: Flag usage metrics
 */

exports.up = async function (connection) {
  console.log('Creating Feature Flags system tables...');

  // 1. Feature Flags table
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_feature_flags (
      id VARCHAR(26) PRIMARY KEY COMMENT 'ULID',
      environment VARCHAR(100) NOT NULL COMMENT 'Environment name',
      flagName VARCHAR(255) NOT NULL COMMENT 'Unique flag identifier',
      displayName VARCHAR(500) NULL COMMENT 'Human-readable name',
      description TEXT NULL COMMENT 'Flag description',
      flagType ENUM('release', 'experiment', 'operational', 'permission') NOT NULL DEFAULT 'release' COMMENT 'Type of flag',
      isEnabled BOOLEAN NOT NULL DEFAULT TRUE COMMENT 'Whether flag is globally enabled',
      isArchived BOOLEAN NOT NULL DEFAULT FALSE COMMENT 'Whether flag is archived',
      archivedAt TIMESTAMP NULL COMMENT 'When flag was archived',
      impressionDataEnabled BOOLEAN NOT NULL DEFAULT FALSE COMMENT 'Track impression data',
      lastSeenAt TIMESTAMP NULL COMMENT 'Last time flag was evaluated',
      staleAfterDays INT NOT NULL DEFAULT 30 COMMENT 'Days until flag is considered stale',
      tags JSON NULL COMMENT 'Tags array for categorization',
      createdBy INT NOT NULL,
      updatedBy INT NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_feature_flags_created_by FOREIGN KEY (createdBy) REFERENCES g_users(id) ON DELETE RESTRICT,
      CONSTRAINT fk_feature_flags_updated_by FOREIGN KEY (updatedBy) REFERENCES g_users(id) ON DELETE SET NULL,
      UNIQUE KEY unique_env_flag (environment, flagName),
      INDEX idx_environment (environment),
      INDEX idx_flag_name (flagName),
      INDEX idx_flag_type (flagType),
      INDEX idx_is_enabled (isEnabled),
      INDEX idx_is_archived (isArchived),
      INDEX idx_last_seen_at (lastSeenAt),
      INDEX idx_created_by (createdBy),
      INDEX idx_updated_by (updatedBy)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Feature flag definitions'
  `);
  console.log('✓ g_feature_flags table created');

  // 2. Feature Strategies table
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_feature_strategies (
      id VARCHAR(26) PRIMARY KEY COMMENT 'ULID',
      flagId VARCHAR(26) NOT NULL COMMENT 'Reference to feature flag',
      strategyName VARCHAR(255) NOT NULL COMMENT 'Strategy name (default, userWithId, gradualRollout, etc.)',
      parameters JSON NULL COMMENT 'Strategy parameters (rollout, stickiness, groupId)',
      constraints JSON NULL COMMENT 'Array of constraints [{contextName, operator, values}]',
      sortOrder INT NOT NULL DEFAULT 0 COMMENT 'Order of strategy evaluation',
      isEnabled BOOLEAN NOT NULL DEFAULT TRUE COMMENT 'Whether strategy is active',
      createdBy INT NOT NULL,
      updatedBy INT NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_feature_strategies_flag FOREIGN KEY (flagId) REFERENCES g_feature_flags(id) ON DELETE CASCADE,
      CONSTRAINT fk_feature_strategies_created_by FOREIGN KEY (createdBy) REFERENCES g_users(id) ON DELETE RESTRICT,
      CONSTRAINT fk_feature_strategies_updated_by FOREIGN KEY (updatedBy) REFERENCES g_users(id) ON DELETE SET NULL,
      INDEX idx_flag_id (flagId),
      INDEX idx_strategy_name (strategyName),
      INDEX idx_sort_order (sortOrder),
      INDEX idx_is_enabled (isEnabled)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Feature flag targeting strategies'
  `);
  console.log('✓ g_feature_strategies table created');

  // 3. Feature Variants table
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_feature_variants (
      id VARCHAR(26) PRIMARY KEY COMMENT 'ULID',
      flagId VARCHAR(26) NOT NULL COMMENT 'Reference to feature flag',
      variantName VARCHAR(255) NOT NULL COMMENT 'Variant identifier',
      weight INT NOT NULL DEFAULT 0 COMMENT 'Weight percentage (0-1000, divide by 10 for actual %)',
      payload JSON NULL COMMENT 'Variant payload data',
      payloadType ENUM('string', 'number', 'boolean', 'json') NOT NULL DEFAULT 'json' COMMENT 'Type of payload',
      stickiness VARCHAR(100) NOT NULL DEFAULT 'default' COMMENT 'Stickiness attribute (userId, sessionId, default)',
      overrides JSON NULL COMMENT 'User/context overrides [{contextName, values}]',
      createdBy INT NOT NULL,
      updatedBy INT NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_feature_variants_flag FOREIGN KEY (flagId) REFERENCES g_feature_flags(id) ON DELETE CASCADE,
      CONSTRAINT fk_feature_variants_created_by FOREIGN KEY (createdBy) REFERENCES g_users(id) ON DELETE RESTRICT,
      CONSTRAINT fk_feature_variants_updated_by FOREIGN KEY (updatedBy) REFERENCES g_users(id) ON DELETE SET NULL,
      UNIQUE KEY unique_flag_variant (flagId, variantName),
      INDEX idx_flag_id (flagId),
      INDEX idx_variant_name (variantName),
      INDEX idx_weight (weight)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Feature flag A/B test variants'
  `);
  console.log('✓ g_feature_variants table created');

  // 4. Feature Segments table
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_feature_segments (
      id VARCHAR(26) PRIMARY KEY COMMENT 'ULID',
      environment VARCHAR(100) NOT NULL COMMENT 'Environment name',
      segmentName VARCHAR(255) NOT NULL COMMENT 'Unique segment identifier',
      displayName VARCHAR(500) NULL COMMENT 'Human-readable name',
      description TEXT NULL COMMENT 'Segment description',
      constraints JSON NOT NULL COMMENT 'Array of constraints [{contextName, operator, values}]',
      isActive BOOLEAN NOT NULL DEFAULT TRUE COMMENT 'Whether segment is active',
      tags JSON NULL COMMENT 'Tags array for categorization',
      createdBy INT NOT NULL,
      updatedBy INT NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_feature_segments_created_by FOREIGN KEY (createdBy) REFERENCES g_users(id) ON DELETE RESTRICT,
      CONSTRAINT fk_feature_segments_updated_by FOREIGN KEY (updatedBy) REFERENCES g_users(id) ON DELETE SET NULL,
      UNIQUE KEY unique_env_segment (environment, segmentName),
      INDEX idx_environment (environment),
      INDEX idx_segment_name (segmentName),
      INDEX idx_is_active (isActive)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Reusable user segments'
  `);
  console.log('✓ g_feature_segments table created');

  // 5. Feature Flag-Segment junction table
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_feature_flag_segments (
      id VARCHAR(26) PRIMARY KEY COMMENT 'ULID',
      strategyId VARCHAR(26) NOT NULL COMMENT 'Reference to strategy',
      segmentId VARCHAR(26) NOT NULL COMMENT 'Reference to segment',
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_flag_segments_strategy FOREIGN KEY (strategyId) REFERENCES g_feature_strategies(id) ON DELETE CASCADE,
      CONSTRAINT fk_flag_segments_segment FOREIGN KEY (segmentId) REFERENCES g_feature_segments(id) ON DELETE CASCADE,
      UNIQUE KEY unique_strategy_segment (strategyId, segmentId),
      INDEX idx_strategy_id (strategyId),
      INDEX idx_segment_id (segmentId)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Flag strategy to segment mappings'
  `);
  console.log('✓ g_feature_flag_segments table created');

  // 6. Feature Context Fields table
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_feature_context_fields (
      id VARCHAR(26) PRIMARY KEY COMMENT 'ULID',
      fieldName VARCHAR(255) NOT NULL UNIQUE COMMENT 'Context field name',
      fieldType ENUM('string', 'number', 'boolean', 'date', 'semver') NOT NULL COMMENT 'Field data type',
      description TEXT NULL COMMENT 'Field description',
      legalValues JSON NULL COMMENT 'Allowed values (if restricted)',
      stickiness BOOLEAN NOT NULL DEFAULT FALSE COMMENT 'Can be used for stickiness',
      sortOrder INT NOT NULL DEFAULT 0 COMMENT 'Display order',
      createdBy INT NULL,
      updatedBy INT NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_context_fields_created_by FOREIGN KEY (createdBy) REFERENCES g_users(id) ON DELETE SET NULL,
      CONSTRAINT fk_context_fields_updated_by FOREIGN KEY (updatedBy) REFERENCES g_users(id) ON DELETE SET NULL,
      INDEX idx_field_name (fieldName),
      INDEX idx_field_type (fieldType),
      INDEX idx_stickiness (stickiness),
      INDEX idx_sort_order (sortOrder)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Context field definitions'
  `);
  console.log('✓ g_feature_context_fields table created');

  // 7. Feature Metrics table
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_feature_metrics (
      id VARCHAR(26) PRIMARY KEY COMMENT 'ULID',
      environment VARCHAR(100) NOT NULL COMMENT 'Environment name',
      flagName VARCHAR(255) NOT NULL COMMENT 'Flag identifier',
      metricsBucket DATETIME NOT NULL COMMENT 'Hourly bucket timestamp',
      yesCount INT NOT NULL DEFAULT 0 COMMENT 'Count of enabled evaluations',
      noCount INT NOT NULL DEFAULT 0 COMMENT 'Count of disabled evaluations',
      variantCounts JSON NULL COMMENT 'Variant distribution {variantName: count}',
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY unique_env_flag_bucket (environment, flagName, metricsBucket),
      INDEX idx_environment (environment),
      INDEX idx_flag_name (flagName),
      INDEX idx_metrics_bucket (metricsBucket),
      INDEX idx_env_flag_bucket (environment, flagName, metricsBucket)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Feature flag usage metrics'
  `);
  console.log('✓ g_feature_metrics table created');

  // Insert default context fields with ULIDs
  const { ulid } = require('ulid');
  const defaultFields = [
    { fieldName: 'userId', fieldType: 'string', description: 'Unique user identifier', stickiness: true, sortOrder: 1 },
    { fieldName: 'sessionId', fieldType: 'string', description: 'Session identifier', stickiness: true, sortOrder: 2 },
    { fieldName: 'environmentName', fieldType: 'string', description: 'Environment name (development, staging, production)', stickiness: false, sortOrder: 3 },
    { fieldName: 'appName', fieldType: 'string', description: 'Application name (web, mobile-ios, mobile-android)', stickiness: false, sortOrder: 4 },
    { fieldName: 'appVersion', fieldType: 'semver', description: 'Application version (semver format)', stickiness: false, sortOrder: 5 },
    { fieldName: 'country', fieldType: 'string', description: 'Country code (ISO 3166-1 alpha-2)', stickiness: false, sortOrder: 6 },
    { fieldName: 'city', fieldType: 'string', description: 'City name', stickiness: false, sortOrder: 7 },
    { fieldName: 'ip', fieldType: 'string', description: 'IP address', stickiness: false, sortOrder: 8 },
    { fieldName: 'userAgent', fieldType: 'string', description: 'User agent string', stickiness: false, sortOrder: 9 },
    { fieldName: 'currentTime', fieldType: 'date', description: 'Current timestamp (ISO 8601)', stickiness: false, sortOrder: 10 },
  ];

  for (const field of defaultFields) {
    await connection.execute(
      `INSERT INTO g_feature_context_fields (id, fieldName, fieldType, description, stickiness, sortOrder)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE description = VALUES(description)`,
      [ulid(), field.fieldName, field.fieldType, field.description, field.stickiness, field.sortOrder]
    );
  }
  console.log('✓ Default context fields inserted');

  console.log('Feature Flags system tables created successfully!');
};

exports.down = async function (connection) {
  console.log('Dropping Feature Flags system tables...');

  // Drop in reverse order due to foreign key constraints
  await connection.execute('DROP TABLE IF EXISTS g_feature_metrics');
  await connection.execute('DROP TABLE IF EXISTS g_feature_flag_segments');
  await connection.execute('DROP TABLE IF EXISTS g_feature_segments');
  await connection.execute('DROP TABLE IF EXISTS g_feature_variants');
  await connection.execute('DROP TABLE IF EXISTS g_feature_strategies');
  await connection.execute('DROP TABLE IF EXISTS g_feature_flags');
  await connection.execute('DROP TABLE IF EXISTS g_feature_context_fields');

  console.log('Feature Flags system tables dropped successfully!');
};

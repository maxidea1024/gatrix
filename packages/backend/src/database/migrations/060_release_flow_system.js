/**
 * Release Flow System Database Schema
 * Creates tables for multi-stage rollout flows (templates and plans)
 */

exports.up = async function (connection) {
    console.log('Creating Release Flow system tables...');

    // 1. Release Flows table (Templates and Active Plans)
    await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_release_flows (
      id VARCHAR(26) PRIMARY KEY COMMENT 'ULID',
      flowName VARCHAR(255) NOT NULL COMMENT 'Flow identifier',
      displayName VARCHAR(500) NULL COMMENT 'Human-readable name',
      description TEXT NULL COMMENT 'Flow description',
      discriminator ENUM('template', 'plan') NOT NULL DEFAULT 'template' COMMENT 'Type of flow',
      flagId VARCHAR(26) NULL COMMENT 'Reference to feature flag (for plans)',
      environment VARCHAR(100) NULL COMMENT 'Environment name (for plans)',
      activeMilestoneId VARCHAR(26) NULL COMMENT 'Currently active milestone ID',
      isArchived BOOLEAN NOT NULL DEFAULT FALSE COMMENT 'Whether flow/template is archived',
      archivedAt TIMESTAMP NULL COMMENT 'When archived',
      createdBy INT NOT NULL,
      updatedBy INT NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_release_flows_flag FOREIGN KEY (flagId) REFERENCES g_feature_flags(id) ON DELETE CASCADE,
      CONSTRAINT fk_release_flows_created_by FOREIGN KEY (createdBy) REFERENCES g_users(id) ON DELETE RESTRICT,
      CONSTRAINT fk_release_flows_updated_by FOREIGN KEY (updatedBy) REFERENCES g_users(id) ON DELETE SET NULL,
      INDEX idx_flow_name (flowName),
      INDEX idx_discriminator (discriminator),
      INDEX idx_flag_env (flagId, environment),
      INDEX idx_is_archived (isArchived)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Release flow definitions and instances'
  `);
    console.log('✓ g_release_flows table created');

    // 2. Release Flow Milestones table
    await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_release_flow_milestones (
      id VARCHAR(26) PRIMARY KEY COMMENT 'ULID',
      flowId VARCHAR(26) NOT NULL COMMENT 'Reference to release flow',
      name VARCHAR(255) NOT NULL COMMENT 'Milestone name',
      sortOrder INT NOT NULL DEFAULT 0 COMMENT 'Order of milestone in flow',
      startedAt TIMESTAMP NULL COMMENT 'When this milestone was activated (for plans)',
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_rf_milestones_flow FOREIGN KEY (flowId) REFERENCES g_release_flows(id) ON DELETE CASCADE,
      INDEX idx_flow_id (flowId),
      INDEX idx_sort_order (sortOrder)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Milestones within a release flow'
  `);
    console.log('✓ g_release_flow_milestones table created');

    // 3. Release Flow Strategies table
    await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_release_flow_strategies (
      id VARCHAR(26) PRIMARY KEY COMMENT 'ULID',
      milestoneId VARCHAR(26) NOT NULL COMMENT 'Reference to milestone',
      strategyName VARCHAR(255) NOT NULL COMMENT 'Strategy name',
      parameters JSON NULL COMMENT 'Strategy parameters',
      constraints JSON NULL COMMENT 'Array of constraints',
      sortOrder INT NOT NULL DEFAULT 0 COMMENT 'Order of strategy evaluation',
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_rf_strategies_milestone FOREIGN KEY (milestoneId) REFERENCES g_release_flow_milestones(id) ON DELETE CASCADE,
      INDEX idx_milestone_id (milestoneId),
      INDEX idx_sort_order (sortOrder)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Strategies within a milestone'
  `);
    console.log('✓ g_release_flow_strategies table created');

    // 4. Release Flow Strategy Segments table
    await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_release_flow_strategy_segments (
      id VARCHAR(26) PRIMARY KEY COMMENT 'ULID',
      strategyId VARCHAR(26) NOT NULL COMMENT 'Reference to strategy',
      segmentId VARCHAR(26) NOT NULL COMMENT 'Reference to segment',
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_rf_segments_strategy FOREIGN KEY (strategyId) REFERENCES g_release_flow_strategies(id) ON DELETE CASCADE,
      CONSTRAINT fk_rf_segments_segment FOREIGN KEY (segmentId) REFERENCES g_feature_segments(id) ON DELETE CASCADE,
      UNIQUE KEY unique_rf_strategy_segment (strategyId, segmentId),
      INDEX idx_strategy_id (strategyId),
      INDEX idx_segment_id (segmentId)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Milestone strategy to segment mappings'
  `);
    console.log('✓ g_release_flow_strategy_segments table created');

    console.log('Release Flow system tables created successfully!');
};

exports.down = async function (connection) {
    console.log('Dropping Release Flow system tables...');

    // Drop in reverse order
    await connection.execute('DROP TABLE IF EXISTS g_release_flow_strategy_segments');
    await connection.execute('DROP TABLE IF EXISTS g_release_flow_strategies');
    await connection.execute('DROP TABLE IF EXISTS g_release_flow_milestones');
    await connection.execute('DROP TABLE IF EXISTS g_release_flows');

    console.log('Release Flow system tables dropped successfully!');
};

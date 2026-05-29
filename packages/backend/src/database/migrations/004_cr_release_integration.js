/**
 * 004 - Change Requests, Release Flows, Integrations, Signals, Actions, Service Accounts
 * All IDs use ULID (CHAR(26))
 */

exports.up = async function (connection) {
  console.log('[004] Creating CR, release flow, integration tables...');

  // ========================================
  // Change Request System
  // ========================================

  await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_change_requests (
      id CHAR(26) NOT NULL PRIMARY KEY COMMENT 'ULID',
      requesterId CHAR(26) NOT NULL,
      environmentId CHAR(26) NOT NULL,
      status ENUM('draft','open','approved','applied','rejected','conflict') NOT NULL DEFAULT 'draft',
      title VARCHAR(255) NOT NULL,
      description TEXT NULL,
      reason TEXT NULL,
      impactAnalysis TEXT NULL,
      priority ENUM('low','medium','high','critical') NOT NULL DEFAULT 'medium',
      category VARCHAR(50) NOT NULL DEFAULT 'general',
      type VARCHAR(50) NULL,
      rejectedBy CHAR(26) NULL,
      rejectedAt TIMESTAMP NULL,
      rejectionReason TEXT NULL,
      executedBy CHAR(26) NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_cr_requester FOREIGN KEY (requesterId) REFERENCES g_users(id) ON DELETE CASCADE,
      INDEX idx_environment_id (environmentId),
      INDEX idx_status (status),
      INDEX idx_requester_id (requesterId)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_change_items (
      id CHAR(26) NOT NULL PRIMARY KEY COMMENT 'ULID',
      changeRequestId CHAR(26) NOT NULL,
      actionGroupId CHAR(26) NULL,
      targetTable VARCHAR(100) NOT NULL,
      targetId VARCHAR(127) NOT NULL,
      operation ENUM('create','update','delete') NOT NULL,
      beforeData JSON NULL,
      afterData JSON NULL,
      entityVersion INT NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_ci_cr FOREIGN KEY (changeRequestId) REFERENCES g_change_requests(id) ON DELETE CASCADE,
      INDEX idx_cr_id (changeRequestId)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_approvals (
      id CHAR(26) NOT NULL PRIMARY KEY COMMENT 'ULID',
      changeRequestId CHAR(26) NOT NULL,
      approverId CHAR(26) NOT NULL,
      comment TEXT NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_appr_cr FOREIGN KEY (changeRequestId) REFERENCES g_change_requests(id) ON DELETE CASCADE,
      INDEX idx_cr_id (changeRequestId)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_action_groups (
      id CHAR(26) NOT NULL PRIMARY KEY COMMENT 'ULID',
      changeRequestId CHAR(26) NOT NULL,
      actionType VARCHAR(50) NOT NULL,
      title VARCHAR(255) NOT NULL,
      description TEXT NULL,
      orderIndex INT NOT NULL DEFAULT 0,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_ag_cr FOREIGN KEY (changeRequestId) REFERENCES g_change_requests(id) ON DELETE CASCADE,
      INDEX idx_cr_id (changeRequestId)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_outbox_events (
      id CHAR(26) NOT NULL PRIMARY KEY COMMENT 'ULID',
      aggregateType VARCHAR(100) NOT NULL,
      aggregateId VARCHAR(127) NOT NULL,
      eventType VARCHAR(100) NOT NULL,
      payload JSON NOT NULL,
      environmentId CHAR(26) NULL,
      status ENUM('pending','processing','completed','failed','dead_letter') NOT NULL DEFAULT 'pending',
      retryCount INT NOT NULL DEFAULT 0,
      maxRetries INT NOT NULL DEFAULT 3,
      processedAt TIMESTAMP NULL,
      error TEXT NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_status (status),
      INDEX idx_aggregate (aggregateType, aggregateId),
      INDEX idx_created (createdAt)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_entity_locks (
      id CHAR(26) NOT NULL PRIMARY KEY COMMENT 'ULID',
      entityType VARCHAR(100) NOT NULL,
      entityId VARCHAR(127) NOT NULL,
      lockedBy CHAR(26) NOT NULL,
      lockReason VARCHAR(255) NULL,
      expiresAt TIMESTAMP NOT NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_entity (entityType, entityId),
      INDEX idx_expires (expiresAt)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // ========================================
  // Release Flow System
  // ========================================

  await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_release_flows (
      id CHAR(26) NOT NULL PRIMARY KEY COMMENT 'ULID',
      flowName VARCHAR(255) NOT NULL,
      displayName VARCHAR(255) NULL,
      description TEXT NULL,
      discriminator ENUM('template', 'plan') NOT NULL DEFAULT 'template',
      flagId CHAR(26) NULL,
      environmentId CHAR(26) NULL,
      activeMilestoneId CHAR(26) NULL,
      status ENUM('pending','active','paused','completed','cancelled','failed') NOT NULL DEFAULT 'pending',
      isArchived BOOLEAN NOT NULL DEFAULT FALSE,
      archivedAt TIMESTAMP NULL,
      createdBy CHAR(26) NOT NULL,
      updatedBy CHAR(26) NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_rf_flag FOREIGN KEY (flagId) REFERENCES g_feature_flags(id) ON DELETE CASCADE,
      INDEX idx_flag_id (flagId),
      INDEX idx_discriminator (discriminator),
      INDEX idx_status (status),
      INDEX idx_environment_id (environmentId)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_release_flow_milestones (
      id CHAR(26) NOT NULL PRIMARY KEY COMMENT 'ULID',
      flowId CHAR(26) NOT NULL,
      name VARCHAR(255) NOT NULL,
      sortOrder INT NOT NULL DEFAULT 0,
      startedAt TIMESTAMP NULL,
      transitionCondition JSON NULL,
      progressionExecutedAt TIMESTAMP NULL,
      pausedAt TIMESTAMP NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_rfm_flow FOREIGN KEY (flowId) REFERENCES g_release_flows(id) ON DELETE CASCADE,
      INDEX idx_flow_id (flowId)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_release_flow_strategies (
      id CHAR(26) NOT NULL PRIMARY KEY COMMENT 'ULID',
      milestoneId CHAR(26) NOT NULL,
      strategyName VARCHAR(255) NOT NULL,
      parameters JSON NULL,
      constraints JSON NULL,
      sortOrder INT NOT NULL DEFAULT 0,
      isEnabled BOOLEAN NOT NULL DEFAULT TRUE,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_rfs_milestone FOREIGN KEY (milestoneId) REFERENCES g_release_flow_milestones(id) ON DELETE CASCADE,
      INDEX idx_milestone_id (milestoneId)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_release_flow_strategy_segments (
      id CHAR(26) NOT NULL PRIMARY KEY COMMENT 'ULID',
      strategyId CHAR(26) NOT NULL,
      segmentId CHAR(26) NOT NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_rfss_strategy FOREIGN KEY (strategyId) REFERENCES g_release_flow_strategies(id) ON DELETE CASCADE,
      CONSTRAINT fk_rfss_segment FOREIGN KEY (segmentId) REFERENCES g_feature_segments(id) ON DELETE CASCADE,
      UNIQUE KEY uniq_strategy_segment (strategyId, segmentId)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_release_flow_safeguards (
      id CHAR(26) NOT NULL PRIMARY KEY COMMENT 'ULID',
      flowId CHAR(26) NOT NULL,
      milestoneId CHAR(26) NULL,
      safeguardType ENUM('error_rate','latency','custom_metric','manual') NOT NULL,
      threshold DECIMAL(10,4) NULL,
      comparison ENUM('gt','gte','lt','lte','eq') NULL,
      metricQuery TEXT NULL,
      windowMinutes INT NOT NULL DEFAULT 5,
      action ENUM('pause','rollback','notify') NOT NULL DEFAULT 'pause',
      isEnabled BOOLEAN NOT NULL DEFAULT TRUE,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_rfsf_flow FOREIGN KEY (flowId) REFERENCES g_release_flows(id) ON DELETE CASCADE,
      INDEX idx_flow_id (flowId)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // ========================================
  // Integration System
  // ========================================

  await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_integrations (
      id CHAR(26) NOT NULL PRIMARY KEY COMMENT 'ULID',
      name VARCHAR(255) NOT NULL,
      type VARCHAR(50) NOT NULL,
      description TEXT NULL,
      config JSON NULL,
      isEnabled BOOLEAN NOT NULL DEFAULT TRUE,
      environmentId CHAR(26) NULL,
      createdBy CHAR(26) NULL,
      updatedBy CHAR(26) NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_type (type),
      INDEX idx_is_enabled (isEnabled)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_integration_events (
      id CHAR(26) NOT NULL PRIMARY KEY COMMENT 'ULID',
      integrationId CHAR(26) NOT NULL,
      eventType VARCHAR(100) NOT NULL,
      payload JSON NULL,
      status VARCHAR(50) NOT NULL DEFAULT 'pending',
      response JSON NULL,
      error TEXT NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_ie_integration FOREIGN KEY (integrationId) REFERENCES g_integrations(id) ON DELETE CASCADE,
      INDEX idx_integration_id (integrationId),
      INDEX idx_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // ========================================
  // Signal Endpoints
  // ========================================

  await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_signal_endpoints (
      id CHAR(26) NOT NULL PRIMARY KEY COMMENT 'ULID',
      name VARCHAR(255) NOT NULL,
      description TEXT NULL,
      environmentId CHAR(26) NOT NULL,
      isActive BOOLEAN NOT NULL DEFAULT TRUE,
      createdBy CHAR(26) NULL,
      updatedBy CHAR(26) NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_environment_id (environmentId)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_signal_endpoint_tokens (
      id CHAR(26) NOT NULL PRIMARY KEY COMMENT 'ULID',
      endpointId CHAR(26) NOT NULL,
      tokenValue VARCHAR(255) NOT NULL UNIQUE,
      name VARCHAR(255) NOT NULL,
      isActive BOOLEAN NOT NULL DEFAULT TRUE,
      expiresAt TIMESTAMP NULL,
      createdBy CHAR(26) NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_set_endpoint FOREIGN KEY (endpointId) REFERENCES g_signal_endpoints(id) ON DELETE CASCADE,
      INDEX idx_endpoint_id (endpointId)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_signals (
      id CHAR(26) NOT NULL PRIMARY KEY COMMENT 'ULID',
      endpointId CHAR(26) NOT NULL,
      tokenId CHAR(26) NULL,
      signalType VARCHAR(100) NOT NULL,
      payload JSON NULL,
      sourceIp VARCHAR(45) NULL,
      isProcessed BOOLEAN NOT NULL DEFAULT FALSE,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_sig_endpoint FOREIGN KEY (endpointId) REFERENCES g_signal_endpoints(id) ON DELETE CASCADE,
      INDEX idx_endpoint_id (endpointId),
      INDEX idx_signal_type (signalType),
      INDEX idx_is_processed (isProcessed)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // ========================================
  // Action System
  // ========================================

  // Action sets table (main branch columns + CHAR(26) IDs)
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_action_sets (
      id CHAR(26) NOT NULL PRIMARY KEY COMMENT 'ULID',
      name VARCHAR(255) NOT NULL,
      description TEXT NULL,
      isEnabled BOOLEAN NOT NULL DEFAULT TRUE,
      actorId CHAR(26) NULL COMMENT 'Service account user ID that executes the actions',
      source VARCHAR(100) NOT NULL DEFAULT 'signal-endpoint',
      sourceId CHAR(26) NULL,
      filters JSON NULL,
      createdBy CHAR(26) NULL,
      updatedBy CHAR(26) NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_is_enabled (isEnabled),
      INDEX idx_actor_id (actorId),
      INDEX idx_source (source, sourceId)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // Actions table
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_actions (
      id CHAR(26) NOT NULL PRIMARY KEY COMMENT 'ULID',
      actionSetId CHAR(26) NOT NULL,
      sortOrder INT NOT NULL DEFAULT 0,
      actionType VARCHAR(100) NOT NULL,
      executionParams JSON NULL,
      createdBy CHAR(26) NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_action_set_id (actionSetId),
      INDEX idx_sort_order (sortOrder),
      CONSTRAINT fk_actions_set FOREIGN KEY (actionSetId) REFERENCES g_action_sets(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // Action set events table (execution log)
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_action_set_events (
      id CHAR(26) NOT NULL PRIMARY KEY COMMENT 'ULID',
      actionSetId CHAR(26) NOT NULL,
      signalId CHAR(26) NOT NULL,
      state VARCHAR(50) NOT NULL DEFAULT 'started',
      eventSignal JSON NOT NULL,
      eventActionSet JSON NOT NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_action_set_id (actionSetId),
      INDEX idx_signal_id (signalId),
      INDEX idx_state (state),
      INDEX idx_created_at (createdAt)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // ========================================
  // Service Account Tokens
  // ========================================

  await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_service_account_tokens (
      id CHAR(26) NOT NULL PRIMARY KEY COMMENT 'ULID',
      environmentId CHAR(26) NOT NULL,
      name VARCHAR(255) NOT NULL,
      description TEXT NULL,
      tokenValue VARCHAR(255) NOT NULL UNIQUE,
      permissions JSON NULL,
      isActive BOOLEAN NOT NULL DEFAULT TRUE,
      expiresAt TIMESTAMP NULL,
      lastUsedAt TIMESTAMP NULL,
      createdBy CHAR(26) NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_environment_id (environmentId),
      INDEX idx_is_active (isActive)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // ========================================
  // Sessions
  // ========================================

  await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_sessions (
      id CHAR(26) NOT NULL PRIMARY KEY COMMENT 'ULID',
      userId CHAR(26) NOT NULL,
      token VARCHAR(255) NOT NULL UNIQUE,
      ipAddress VARCHAR(45) NULL,
      userAgent TEXT NULL,
      expiresAt TIMESTAMP NOT NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_token (token),
      INDEX idx_user_id (userId),
      INDEX idx_expires (expiresAt)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  console.log('[004] ??CR, release flow, integration tables completed');
};

exports.down = async function (connection) {
  const tables = [
    'g_sessions',
    'g_service_account_tokens',
    'g_action_set_events', 'g_actions', 'g_action_sets',
    'g_signals', 'g_signal_endpoint_tokens', 'g_signal_endpoints',
    'g_integration_events', 'g_integrations',
    'g_release_flow_safeguards',
    'g_release_flow_strategy_segments', 'g_release_flow_strategies',
    'g_release_flow_milestones', 'g_release_flows',
    'g_entity_locks', 'g_outbox_events', 'g_action_groups',
    'g_approvals', 'g_change_items', 'g_change_requests',
  ];
  for (const t of tables) {
    await connection.execute(`DROP TABLE IF EXISTS ${t}`);
  }
};

/**
 * Initial Database Schema for Gatrix
 * Creates all tables with updated field names and tracking columns
 * Updated: 2025-09-12 - Consolidated all migrations into one
 */


exports.up = async function(connection) {
  // Connection is provided by the migration system

  console.log('Creating initial database schema...');

  // 1. Users table
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) NOT NULL UNIQUE,
      passwordHash VARCHAR(255) NULL,
      role VARCHAR(50) NOT NULL DEFAULT 'user',
      status VARCHAR(50) NOT NULL DEFAULT 'active',
      authType VARCHAR(50) NOT NULL DEFAULT 'local',
      emailVerified BOOLEAN NOT NULL DEFAULT FALSE,
      emailVerifiedAt TIMESTAMP NULL,
      lastLoginAt TIMESTAMP NULL,
      avatarUrl VARCHAR(500) NULL,
      preferredLanguage VARCHAR(10) NULL,
      createdBy INT NULL,
      updatedBy INT NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      tags JSON NULL,
      INDEX idx_email (email),
      INDEX idx_role (role),
      INDEX idx_status (status),
      INDEX idx_authType (authType),
      INDEX idx_preferredLanguage (preferredLanguage),
      INDEX idx_created_by (createdBy),
      INDEX idx_updated_by (updatedBy),
      CONSTRAINT fk_users_created_by FOREIGN KEY (createdBy) REFERENCES g_users(id) ON DELETE SET NULL,
      CONSTRAINT fk_users_updated_by FOREIGN KEY (updatedBy) REFERENCES g_users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // 2. OAuth accounts table
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_oauth_accounts (
      id INT AUTO_INCREMENT PRIMARY KEY,
      userId INT NOT NULL,
      provider VARCHAR(50) NOT NULL,
      providerId VARCHAR(255) NOT NULL,
      providerData JSON NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_oauth_user FOREIGN KEY (userId) REFERENCES g_users(id) ON DELETE CASCADE,
      UNIQUE KEY unique_provider_account (provider, providerId),
      INDEX idx_user_provider (userId, provider)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // 3. Password reset tokens table
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_password_reset_tokens (
      id INT AUTO_INCREMENT PRIMARY KEY,
      userId INT NOT NULL,
      token VARCHAR(255) NOT NULL UNIQUE,
      expiresAt TIMESTAMP NOT NULL,
      usedAt TIMESTAMP NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_password_reset_user FOREIGN KEY (userId) REFERENCES g_users(id) ON DELETE CASCADE,
      INDEX idx_token (token),
      INDEX idx_expires (expiresAt)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // 4. Audit logs table
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_audit_logs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      userId INT NULL,
      action VARCHAR(100) NOT NULL,
      entityType VARCHAR(100) NULL,
      entityId INT NULL,
      oldValues JSON NULL,
      newValues JSON NULL,
      ipAddress VARCHAR(45) NULL,
      userAgent TEXT NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_audit_user FOREIGN KEY (userId) REFERENCES g_users(id) ON DELETE SET NULL,
      INDEX idx_user_action (userId, action),
      INDEX idx_entity (entityType, entityId),
      INDEX idx_created (createdAt)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // 5. Game worlds table
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_game_worlds (
      id INT AUTO_INCREMENT PRIMARY KEY,
      worldId VARCHAR(50) NOT NULL UNIQUE,
      name VARCHAR(255) NOT NULL,
      description TEXT NULL,
      isVisible BOOLEAN NOT NULL DEFAULT TRUE,
      isMaintenance BOOLEAN NOT NULL DEFAULT FALSE,
      displayOrder INT NOT NULL DEFAULT 0,
      tags JSON NULL,
      customPayload JSON NULL COMMENT 'Custom payload for game world configuration',
      createdBy INT NOT NULL,
      updatedBy INT NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_world_id (worldId),
      INDEX idx_visible (isVisible),
      INDEX idx_maintenance (isMaintenance),
      INDEX idx_display_order (displayOrder),
      INDEX idx_created_by (createdBy),
      INDEX idx_updated_by (updatedBy),
      CONSTRAINT fk_game_worlds_created_by FOREIGN KEY (createdBy) REFERENCES g_users(id) ON DELETE RESTRICT,
      CONSTRAINT fk_game_worlds_updated_by FOREIGN KEY (updatedBy) REFERENCES g_users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // 6. Client versions table
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_client_versions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      platform VARCHAR(100) NOT NULL COMMENT '플랫폼 (예: android, ios, web, pc)',
      clientVersion VARCHAR(50) NOT NULL COMMENT '클라이언트 버전 (semver 형식)',
      clientStatus VARCHAR(50) NOT NULL COMMENT '클라이언트 상태',
      gameServerAddress VARCHAR(500) NOT NULL COMMENT '게임서버 주소',
      gameServerAddressForWhiteList VARCHAR(500) NULL COMMENT '화이트리스트 전용 게임서버 주소',
      patchAddress VARCHAR(500) NOT NULL COMMENT '패치파일 다운로드 주소',
      patchAddressForWhiteList VARCHAR(500) NULL COMMENT '화이트리스트 전용 패치파일 다운로드 주소',
      guestModeAllowed BOOLEAN NOT NULL DEFAULT FALSE COMMENT '게스트 모드 허용 여부',
      externalClickLink VARCHAR(500) NULL COMMENT '외부 클릭 링크',
      memo TEXT NULL COMMENT '메모',
      customPayload TEXT NULL COMMENT '사용자 정의 페이로드 (JSON 형식)',
      createdAt DATETIME NOT NULL,
      updatedAt DATETIME NOT NULL,
      createdBy INT NOT NULL COMMENT '생성자 사용자 ID',
      updatedBy INT NOT NULL COMMENT '수정자 사용자 ID',
      CONSTRAINT fk_client_versions_creator FOREIGN KEY (createdBy) REFERENCES g_users(id) ON DELETE RESTRICT,
      CONSTRAINT fk_client_versions_updater FOREIGN KEY (updatedBy) REFERENCES g_users(id) ON DELETE RESTRICT,
      INDEX idx_platform (platform),
      INDEX idx_client_version (clientVersion),
      INDEX idx_client_status (clientStatus),
      INDEX idx_created_at (createdAt),
      UNIQUE KEY unique_platform_version (platform, clientVersion)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // 7. Account whitelist table
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_account_whitelist (
      id INT AUTO_INCREMENT PRIMARY KEY,
      accountId VARCHAR(32) NOT NULL,
      ipAddress VARCHAR(45) NULL,
      startDate DATETIME NULL,
      endDate DATETIME NULL,
      purpose TEXT NULL,
      isEnabled BOOLEAN NOT NULL DEFAULT TRUE,
      tags JSON NULL,
      createdBy INT NOT NULL,
      updatedBy INT NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_whitelist_creator FOREIGN KEY (createdBy) REFERENCES g_users(id) ON DELETE RESTRICT,
      CONSTRAINT fk_whitelist_updater FOREIGN KEY (updatedBy) REFERENCES g_users(id) ON DELETE SET NULL,
      UNIQUE KEY unique_account_id (accountId),
      INDEX idx_account_id (accountId),
      INDEX idx_ip_address (ipAddress),
      INDEX idx_date_range (startDate, endDate),
      INDEX idx_enabled (isEnabled),
      INDEX idx_created_by (createdBy),
      INDEX idx_updated_by (updatedBy)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // 8. IP whitelist table
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_ip_whitelist (
      id INT AUTO_INCREMENT PRIMARY KEY,
      ipAddress VARCHAR(45) NOT NULL,
      purpose VARCHAR(500) NOT NULL,
      isEnabled BOOLEAN NOT NULL DEFAULT TRUE,
      startDate DATETIME NULL,
      endDate DATETIME NULL,
      tags JSON NULL,
      createdBy INT NOT NULL,
      updatedBy INT NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_ip_whitelist_creator FOREIGN KEY (createdBy) REFERENCES g_users(id) ON DELETE RESTRICT,
      CONSTRAINT fk_ip_whitelist_updater FOREIGN KEY (updatedBy) REFERENCES g_users(id) ON DELETE SET NULL,
      INDEX idx_ip_address (ipAddress),
      INDEX idx_enabled (isEnabled),
      INDEX idx_date_range (startDate, endDate)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // 9. Tags table
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_tags (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(100) NOT NULL UNIQUE,
      color VARCHAR(7) NOT NULL DEFAULT '#607D8B',
      description TEXT NULL,
      createdBy INT NULL,
      updatedBy INT NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_tags_creator FOREIGN KEY (createdBy) REFERENCES g_users(id) ON DELETE SET NULL,
      CONSTRAINT fk_tags_updater FOREIGN KEY (updatedBy) REFERENCES g_users(id) ON DELETE SET NULL,
      INDEX idx_name (name)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // 10. Tag assignments table
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_tag_assignments (
      id INT AUTO_INCREMENT PRIMARY KEY,
      tagId INT NOT NULL,
      entityType VARCHAR(50) NOT NULL,
      entityId INT NOT NULL,
      createdBy INT NOT NULL,
      updatedBy INT NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_tag_assignments_tag FOREIGN KEY (tagId) REFERENCES g_tags(id) ON DELETE CASCADE,
      CONSTRAINT fk_tag_assignments_created_by FOREIGN KEY (createdBy) REFERENCES g_users(id) ON DELETE RESTRICT,
      CONSTRAINT fk_tag_assignments_updated_by FOREIGN KEY (updatedBy) REFERENCES g_users(id) ON DELETE SET NULL,
      INDEX idx_entity (entityType, entityId),
      INDEX idx_created_by (createdBy),
      INDEX idx_updated_by (updatedBy),
      UNIQUE KEY unique_assignment (tagId, entityType, entityId)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // 11. Variables table
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_vars (
      id INT AUTO_INCREMENT PRIMARY KEY,
      varKey VARCHAR(255) NOT NULL UNIQUE,
      varValue TEXT NULL,
      valueType VARCHAR(50) NOT NULL DEFAULT 'string' COMMENT 'Type of value: string, number, boolean, color, object, array',
      description TEXT NULL,
      isSystemDefined BOOLEAN NOT NULL DEFAULT FALSE COMMENT 'Whether this is a system-defined variable',
      isCopyable BOOLEAN NOT NULL DEFAULT TRUE COMMENT 'Whether this variable can be copied',
      createdBy INT NOT NULL,
      updatedBy INT NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_varKey (varKey),
      INDEX idx_created_by (createdBy),
      INDEX idx_updated_by (updatedBy),
      CONSTRAINT fk_vars_created_by FOREIGN KEY (createdBy) REFERENCES g_users(id) ON DELETE RESTRICT,
      CONSTRAINT fk_vars_updated_by FOREIGN KEY (updatedBy) REFERENCES g_users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_message_templates (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(191) NOT NULL UNIQUE,
      type VARCHAR(50) NOT NULL DEFAULT 'maintenance',
      isEnabled BOOLEAN NOT NULL DEFAULT TRUE,
      supportsMultiLanguage BOOLEAN NOT NULL DEFAULT FALSE,
      defaultMessage TEXT NULL,
      subject VARCHAR(500) NULL,
      content TEXT NULL,
      variables JSON NULL,
      createdBy BIGINT NULL,
      updatedBy BIGINT NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_name (name),
      INDEX idx_type (type),
      INDEX idx_enabled (isEnabled)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_message_template_locales (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      templateId BIGINT UNSIGNED NOT NULL,
      lang VARCHAR(10) NOT NULL,
      message TEXT NOT NULL,
      createdBy INT NOT NULL,
      updatedBy INT NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (templateId) REFERENCES g_message_templates(id) ON DELETE CASCADE,
      CONSTRAINT fk_message_locales_created_by FOREIGN KEY (createdBy) REFERENCES g_users(id) ON DELETE RESTRICT,
      CONSTRAINT fk_message_locales_updated_by FOREIGN KEY (updatedBy) REFERENCES g_users(id) ON DELETE SET NULL,
      INDEX idx_template (templateId),
      INDEX idx_lang (lang),
      INDEX idx_created_by (createdBy),
      INDEX idx_updated_by (updatedBy)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  console.log('✓ Extended tables created');

  // 13. Job types table
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_job_types (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(100) NOT NULL UNIQUE,
      displayName VARCHAR(200) NOT NULL,
      description TEXT NULL,
      jobSchema JSON NULL,
      isEnabled BOOLEAN NOT NULL DEFAULT TRUE,
      createdBy INT NULL,
      updatedBy INT NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_job_types_creator FOREIGN KEY (createdBy) REFERENCES g_users(id) ON DELETE SET NULL,
      CONSTRAINT fk_job_types_updater FOREIGN KEY (updatedBy) REFERENCES g_users(id) ON DELETE SET NULL,
      INDEX idx_name (name),
      INDEX idx_display_name (displayName),
      INDEX idx_enabled (isEnabled)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // 14. Jobs table
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_jobs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      memo TEXT NULL,
      jobTypeId INT NOT NULL,
      jobDataMap JSON NULL,
      isEnabled BOOLEAN NOT NULL DEFAULT TRUE,
      createdBy INT NULL,
      updatedBy INT NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_jobs_type FOREIGN KEY (jobTypeId) REFERENCES g_job_types(id) ON DELETE RESTRICT,
      CONSTRAINT fk_jobs_creator FOREIGN KEY (createdBy) REFERENCES g_users(id) ON DELETE SET NULL,
      CONSTRAINT fk_jobs_updater FOREIGN KEY (updatedBy) REFERENCES g_users(id) ON DELETE SET NULL,
      INDEX idx_name (name),
      INDEX idx_type (jobTypeId),
      INDEX idx_enabled (isEnabled)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // 15. Job executions table
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_job_executions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      jobId INT NOT NULL,
      status VARCHAR(50) NOT NULL DEFAULT 'pending',
      startedAt TIMESTAMP NULL,
      completedAt TIMESTAMP NULL,
      result JSON NULL,
      error TEXT NULL,
      logs TEXT NULL,
      triggeredBy VARCHAR(50) NOT NULL DEFAULT 'schedule',
      triggeredByUserId INT NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_job_executions_job FOREIGN KEY (jobId) REFERENCES g_jobs(id) ON DELETE CASCADE,
      CONSTRAINT fk_job_executions_user FOREIGN KEY (triggeredByUserId) REFERENCES g_users(id) ON DELETE SET NULL,
      INDEX idx_job_status (jobId, status),
      INDEX idx_status (status),
      INDEX idx_started (startedAt),
      INDEX idx_completed (completedAt)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  console.log('✓ Job system tables created');

  // 16. Remote configs table
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_remote_configs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      keyName VARCHAR(255) NOT NULL UNIQUE,
      defaultValue TEXT NULL,
      valueType ENUM('string', 'number', 'boolean', 'json', 'yaml') NOT NULL DEFAULT 'string',
      description TEXT NULL,
      isActive BOOLEAN NOT NULL DEFAULT TRUE,
      createdBy INT NULL,
      updatedBy INT NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_remote_configs_creator FOREIGN KEY (createdBy) REFERENCES g_users(id) ON DELETE SET NULL,
      CONSTRAINT fk_remote_configs_updater FOREIGN KEY (updatedBy) REFERENCES g_users(id) ON DELETE SET NULL,
      INDEX idx_key_name (keyName),
      INDEX idx_value_type (valueType),
      INDEX idx_active (isActive)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // 17. Remote config versions table
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_remote_config_versions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      configId INT NOT NULL,
      versionNumber INT NOT NULL,
      value TEXT NULL,
      status ENUM('draft', 'staged', 'published', 'archived') NOT NULL DEFAULT 'draft',
      changeDescription TEXT NULL,
      publishedAt TIMESTAMP NULL,
      createdBy INT NULL,
      updatedBy INT NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_config_versions_config FOREIGN KEY (configId) REFERENCES g_remote_configs(id) ON DELETE CASCADE,
      CONSTRAINT fk_config_versions_creator FOREIGN KEY (createdBy) REFERENCES g_users(id) ON DELETE SET NULL,
      CONSTRAINT fk_config_versions_updater FOREIGN KEY (updatedBy) REFERENCES g_users(id) ON DELETE SET NULL,
      INDEX idx_config_version (configId, versionNumber),
      INDEX idx_status (status),
      INDEX idx_published (publishedAt)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // 18. Remote config deployments table
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_remote_config_deployments (
      id INT AUTO_INCREMENT PRIMARY KEY,
      deploymentName VARCHAR(255) NULL,
      description TEXT NULL,
      configsSnapshot JSON NULL,
      deployedBy INT NULL,
      deployedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      rollbackDeploymentId INT NULL,
      CONSTRAINT fk_deployments_deployer FOREIGN KEY (deployedBy) REFERENCES g_users(id) ON DELETE SET NULL,
      CONSTRAINT fk_deployments_rollback FOREIGN KEY (rollbackDeploymentId) REFERENCES g_remote_config_deployments(id) ON DELETE SET NULL,
      INDEX idx_deployed_at (deployedAt),
      INDEX idx_deployed_by (deployedBy)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // 19. Remote config campaigns table
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_remote_config_campaigns (
      id INT AUTO_INCREMENT PRIMARY KEY,
      campaignName VARCHAR(255) NOT NULL,
      description TEXT NULL,
      startDate TIMESTAMP NULL,
      endDate TIMESTAMP NULL,
      targetConditions JSON NULL,
      trafficPercentage DECIMAL(5,2) NOT NULL DEFAULT 100.00,
      isActive BOOLEAN NOT NULL DEFAULT FALSE,
      priority INT NOT NULL DEFAULT 0,
      status ENUM('draft', 'scheduled', 'running', 'completed', 'paused') NOT NULL DEFAULT 'draft',
      createdBy INT NULL,
      updatedBy INT NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_campaigns_creator FOREIGN KEY (createdBy) REFERENCES g_users(id) ON DELETE SET NULL,
      CONSTRAINT fk_campaigns_updater FOREIGN KEY (updatedBy) REFERENCES g_users(id) ON DELETE SET NULL,
      INDEX idx_campaign_name (campaignName),
      INDEX idx_active (isActive),
      INDEX idx_status (status),
      INDEX idx_priority (priority),
      INDEX idx_traffic_percentage (trafficPercentage),
      INDEX idx_start_date (startDate),
      INDEX idx_end_date (endDate)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // 20. Remote config variants table (A/B Testing)
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_remote_config_variants (
      id INT AUTO_INCREMENT PRIMARY KEY,
      configId INT NOT NULL,
      variantName VARCHAR(255) NOT NULL,
      value TEXT NULL,
      trafficPercentage DECIMAL(5,2) NOT NULL DEFAULT 0.00,
      conditions JSON NULL,
      isActive BOOLEAN NOT NULL DEFAULT TRUE,
      createdBy INT NULL,
      updatedBy INT NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_variants_config FOREIGN KEY (configId) REFERENCES g_remote_configs(id) ON DELETE CASCADE,
      CONSTRAINT fk_variants_creator FOREIGN KEY (createdBy) REFERENCES g_users(id) ON DELETE SET NULL,
      CONSTRAINT fk_variants_updater FOREIGN KEY (updatedBy) REFERENCES g_users(id) ON DELETE SET NULL,
      INDEX idx_config_id (configId),
      INDEX idx_variant_name (variantName),
      INDEX idx_traffic_percentage (trafficPercentage),
      INDEX idx_is_active (isActive),
      INDEX idx_created_at (createdAt),
      UNIQUE KEY unique_config_variant (configId, variantName)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // 21. Remote config context fields table
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_remote_config_context_fields (
      id INT AUTO_INCREMENT PRIMARY KEY,
      fieldName VARCHAR(255) NOT NULL UNIQUE,
      fieldType ENUM('string', 'number', 'boolean', 'array') NOT NULL,
      description TEXT NULL,
      isRequired BOOLEAN NOT NULL DEFAULT FALSE,
      defaultValue TEXT NULL,
      validationRules JSON NULL,
      createdBy INT NULL,
      updatedBy INT NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_rc_context_fields_creator FOREIGN KEY (createdBy) REFERENCES g_users(id) ON DELETE SET NULL,
      CONSTRAINT fk_rc_context_fields_updater FOREIGN KEY (updatedBy) REFERENCES g_users(id) ON DELETE SET NULL,
      INDEX idx_field_name (fieldName),
      INDEX idx_field_type (fieldType),
      INDEX idx_required (isRequired)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // 22. Remote config segments table (formerly rules)
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_remote_config_segments (
      id INT AUTO_INCREMENT PRIMARY KEY,
      segmentName VARCHAR(255) NOT NULL,
      conditions JSON NOT NULL,
      value TEXT NULL COMMENT 'Segment description',
      priority INT NOT NULL DEFAULT 0,
      isActive BOOLEAN NOT NULL DEFAULT TRUE,
      createdBy INT NULL,
      updatedBy INT NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

      CONSTRAINT fk_segments_creator FOREIGN KEY (createdBy) REFERENCES g_users(id) ON DELETE SET NULL,
      CONSTRAINT fk_segments_updater FOREIGN KEY (updatedBy) REFERENCES g_users(id) ON DELETE SET NULL,
      INDEX idx_segments_active (isActive),
      INDEX idx_segments_priority (priority),
      INDEX idx_segments_name (segmentName)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  console.log('✓ Remote config and context tables created');

  // Get admin credentials from environment variables
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@gatrix.com';
  const adminName = process.env.ADMIN_NAME || 'Admin';
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';

  // Hash the admin password
  const bcrypt = require('bcryptjs');
  const passwordHash = await bcrypt.hash(adminPassword, 12);

  // Insert default admin user
  await connection.execute(`
    INSERT IGNORE INTO g_users (id, name, email, passwordHash, role, status, emailVerified, createdAt, updatedAt)
    VALUES (1, ?, ?, ?, 'admin', 'active', TRUE, NOW(), NOW())
  `, [adminName, adminEmail, passwordHash]);

  // 30. Service notices table
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_service_notices (
      id INT AUTO_INCREMENT PRIMARY KEY COMMENT 'Auto-increment ID',
      isActive BOOLEAN NOT NULL DEFAULT TRUE COMMENT 'Active status',
      category ENUM('maintenance', 'event', 'notice', 'promotion', 'other') NOT NULL COMMENT 'Notice category',
      platforms JSON NOT NULL COMMENT 'Target platforms (pc, pc-wegame, ios, android, harmonyos)',
      startDate DATETIME NULL COMMENT 'Start date/time (UTC)',
      endDate DATETIME NOT NULL COMMENT 'End date/time (UTC)',
      tabTitle VARCHAR(200) NULL COMMENT 'Optional tab title (used in list views)',
      title VARCHAR(500) NOT NULL COMMENT 'Notice title',
      content TEXT NOT NULL COMMENT 'Notice content (rich text HTML)',
      description TEXT NULL COMMENT 'Optional description',
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Created timestamp',
      updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Updated timestamp',
      INDEX idx_service_notices_is_active (isActive),
      INDEX idx_service_notices_category (category),
      INDEX idx_service_notices_start_date (startDate),
      INDEX idx_service_notices_end_date (endDate),
      INDEX idx_service_notices_created_at (createdAt)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // 31. In-game popup notices table
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_ingame_popup_notices (
      id INT AUTO_INCREMENT PRIMARY KEY COMMENT 'Unique identifier',
      isActive BOOLEAN NOT NULL DEFAULT TRUE COMMENT 'Whether the notice is active',
      content TEXT NOT NULL COMMENT 'Plain text content of the popup notice',
      targetWorlds JSON NULL COMMENT 'Target game world IDs (array of strings)',
      targetWorldsInverted BOOLEAN NOT NULL DEFAULT FALSE COMMENT 'Invert world targeting',
      targetPlatforms JSON NULL COMMENT 'Target platforms (array of strings)',
      targetPlatformsInverted BOOLEAN NOT NULL DEFAULT FALSE COMMENT 'Invert platform targeting',
      targetChannels JSON NULL COMMENT 'Target channels (array of strings)',
      targetChannelsInverted BOOLEAN NOT NULL DEFAULT FALSE COMMENT 'Invert channel targeting',
      targetSubchannels JSON NULL COMMENT 'Target subchannels (array of strings)',
      targetSubchannelsInverted BOOLEAN NOT NULL DEFAULT FALSE COMMENT 'Invert subchannel targeting',
      targetUserIds VARCHAR(1000) NULL COMMENT 'Target user IDs (comma-separated or JSON)',
      targetUserIdsInverted BOOLEAN NOT NULL DEFAULT FALSE COMMENT 'Invert user ID targeting',
      displayPriority INT NOT NULL DEFAULT 100 COMMENT 'Display priority (lower number = higher priority)',
      showOnce BOOLEAN NOT NULL DEFAULT FALSE COMMENT 'Whether to show only once per user',
      startDate TIMESTAMP NULL COMMENT 'Start date and time for the notice (optional)',
      endDate TIMESTAMP NOT NULL COMMENT 'End date and time for the notice',
      messageTemplateId BIGINT UNSIGNED NULL COMMENT 'Reference to message template (if using template)',
      useTemplate BOOLEAN NOT NULL DEFAULT FALSE COMMENT 'Whether to use message template',
      description TEXT NULL COMMENT 'Internal description/memo for admins',
      createdBy INT NOT NULL COMMENT 'User ID who created the notice',
      updatedBy INT NULL COMMENT 'User ID who last updated the notice',
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_ingame_popup_notices_active (isActive),
      INDEX idx_ingame_popup_notices_dates (startDate, endDate),
      INDEX idx_ingame_popup_notices_priority (displayPriority),
      INDEX idx_ingame_popup_notices_template (messageTemplateId),
      INDEX idx_ingame_popup_notices_created_by (createdBy),
      INDEX idx_ingame_popup_notices_updated_by (updatedBy),
      CONSTRAINT fk_ingame_popup_notices_creator FOREIGN KEY (createdBy) REFERENCES g_users(id) ON DELETE RESTRICT,
      CONSTRAINT fk_ingame_popup_notices_updater FOREIGN KEY (updatedBy) REFERENCES g_users(id) ON DELETE SET NULL,
      CONSTRAINT fk_ingame_popup_notices_template FOREIGN KEY (messageTemplateId) REFERENCES g_message_templates(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='In-game popup notice system'
  `);

  // 32. Mails table
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_mails (
      id INT AUTO_INCREMENT PRIMARY KEY COMMENT 'Mail ID',
      senderId INT NULL COMMENT 'Sender user ID',
      recipientId INT NOT NULL COMMENT 'Recipient user ID',
      mailType VARCHAR(50) NOT NULL COMMENT 'Mail type (system, user, event, etc)',
      category VARCHAR(50) NULL COMMENT 'Mail category',
      title VARCHAR(500) NOT NULL COMMENT 'Mail title',
      content TEXT NOT NULL COMMENT 'Mail content',
      mailData JSON NULL COMMENT 'Additional mail data',
      isRead BOOLEAN NOT NULL DEFAULT FALSE COMMENT 'Whether mail has been read',
      isDeleted BOOLEAN NOT NULL DEFAULT FALSE COMMENT 'Whether mail has been deleted',
      isStarred BOOLEAN NOT NULL DEFAULT FALSE COMMENT 'Whether mail is starred',
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_recipient (recipientId, isDeleted, createdAt),
      INDEX idx_sender (senderId, createdAt),
      INDEX idx_read_status (recipientId, isRead, isDeleted),
      INDEX idx_mail_type (mailType, recipientId),
      INDEX idx_category (category, recipientId),
      INDEX idx_starred (recipientId, isStarred, isDeleted),
      FOREIGN KEY (senderId) REFERENCES g_users(id) ON DELETE SET NULL,
      FOREIGN KEY (recipientId) REFERENCES g_users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // 33. Surveys table
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_surveys (
      id VARCHAR(26) PRIMARY KEY COMMENT 'ULID',
      platformSurveyId VARCHAR(191) NOT NULL UNIQUE COMMENT 'SDO platform survey ID',
      surveyTitle VARCHAR(500) NOT NULL COMMENT 'Survey title',
      surveyContent TEXT NULL COMMENT 'Survey description/content',
      triggerConditions JSON NOT NULL COMMENT 'Survey trigger conditions',
      participationRewards JSON NULL COMMENT 'Rewards for survey participation',
      rewardMailTitle VARCHAR(500) NULL COMMENT 'Reward mail title',
      rewardMailContent TEXT NULL COMMENT 'Reward mail content',
      isActive BOOLEAN NOT NULL DEFAULT TRUE COMMENT 'Survey active status',
      createdBy INT NULL COMMENT 'User ID who created this survey',
      updatedBy INT NULL COMMENT 'User ID who last updated this survey',
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_platform_survey_id (platformSurveyId),
      INDEX idx_is_active (isActive),
      INDEX idx_created_at (createdAt),
      INDEX idx_updated_at (updatedAt)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // 34. Invitations table
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_invitations (
      id VARCHAR(36) PRIMARY KEY COMMENT 'UUID for invitation',
      token VARCHAR(36) NOT NULL UNIQUE COMMENT 'Unique token for invitation link',
      email VARCHAR(255) NOT NULL COMMENT 'Email address of the invitee',
      role VARCHAR(50) NOT NULL DEFAULT 'user' COMMENT 'Role to assign to user when they accept',
      isActive BOOLEAN NOT NULL DEFAULT TRUE COMMENT 'Whether invitation is still active',
      expiresAt TIMESTAMP NOT NULL COMMENT 'When the invitation expires',
      usedAt TIMESTAMP NULL COMMENT 'When the invitation was used',
      usedBy INT NULL COMMENT 'User ID who used the invitation',
      createdBy INT NOT NULL COMMENT 'User ID who created the invitation',
      updatedBy INT NULL COMMENT 'User ID who last updated the invitation',
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_invitations_email (email),
      INDEX idx_invitations_token (token),
      INDEX idx_invitations_active (isActive),
      INDEX idx_invitations_expires (expiresAt),
      INDEX idx_invitations_created_by (createdBy),
      INDEX idx_invitations_used_by (usedBy),
      CONSTRAINT fk_invitations_creator FOREIGN KEY (createdBy) REFERENCES g_users(id) ON DELETE RESTRICT,
      CONSTRAINT fk_invitations_updater FOREIGN KEY (updatedBy) REFERENCES g_users(id) ON DELETE SET NULL,
      CONSTRAINT fk_invitations_used_by FOREIGN KEY (usedBy) REFERENCES g_users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='User invitation system'
  `);

  // 35. Crashes table
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS crashes (
      id VARCHAR(26) PRIMARY KEY COMMENT 'ULID',
      chash VARCHAR(32) NOT NULL COMMENT 'MD5 hash of stack trace',
      branch VARCHAR(50) NOT NULL COMMENT 'Branch name (qa_2025, main, etc)',
      environment VARCHAR(50) NOT NULL COMMENT 'Environment (dev, staging, production, qa)',
      platform VARCHAR(50) NOT NULL COMMENT 'Platform (windows, ios, android, mac)',
      marketType VARCHAR(50) NULL COMMENT 'Market type (googleplay, apple, etc)',
      isEditor BOOLEAN DEFAULT FALSE COMMENT 'Whether crash occurred in editor',
      firstLine VARCHAR(200) NULL COMMENT 'First line of stack trace',
      stackFilePath VARCHAR(500) NULL COMMENT 'Path to stack trace file',
      crashesCount INT UNSIGNED DEFAULT 1 COMMENT 'Number of times this crash occurred',
      firstCrashEventId VARCHAR(26) NULL COMMENT 'ULID of first crash event',
      lastCrashEventId VARCHAR(26) NULL COMMENT 'ULID of last crash event',
      firstCrashAt TIMESTAMP NOT NULL COMMENT 'First occurrence timestamp',
      lastCrashAt TIMESTAMP NOT NULL COMMENT 'Last occurrence timestamp',
      crashesState TINYINT UNSIGNED DEFAULT 0 COMMENT '0:OPEN, 1:CLOSED, 2:DELETED, 3:RESOLVED, 4:REPEATED',
      assignee VARCHAR(100) NULL COMMENT 'Assigned developer/team',
      jiraTicket VARCHAR(200) NULL COMMENT 'Jira ticket URL',
      maxAppVersion VARCHAR(50) NULL COMMENT 'Maximum app version where crash occurred',
      maxResVersion VARCHAR(50) NULL COMMENT 'Maximum resource version where crash occurred',
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uk_chash_branch (chash, branch),
      INDEX idx_environment (environment),
      INDEX idx_platform (platform),
      INDEX idx_marketType (marketType),
      INDEX idx_state (crashesState),
      INDEX idx_assignee (assignee),
      INDEX idx_firstCrashAt (firstCrashAt),
      INDEX idx_lastCrashAt (lastCrashAt),
      INDEX idx_createdAt (createdAt)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // 36. Crash events table
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS crash_events (
      id VARCHAR(26) PRIMARY KEY COMMENT 'ULID',
      crashId VARCHAR(26) NOT NULL COMMENT 'Reference to crashes.id',
      platform VARCHAR(50) NOT NULL COMMENT 'Platform (windows, ios, android, mac)',
      marketType VARCHAR(50) NULL COMMENT 'Market type (googleplay, apple, etc)',
      branch VARCHAR(50) NOT NULL COMMENT 'Branch name',
      environment VARCHAR(50) NOT NULL COMMENT 'Environment (dev, staging, production, qa)',
      isEditor BOOLEAN DEFAULT FALSE COMMENT 'Whether crash occurred in editor',
      appVersion VARCHAR(50) NULL COMMENT 'App version (semver format)',
      resVersion VARCHAR(50) NULL COMMENT 'Resource version',
      accountId VARCHAR(100) NULL COMMENT 'Account ID',
      characterId VARCHAR(100) NULL COMMENT 'Character ID',
      gameUserId VARCHAR(100) NULL COMMENT 'Game user ID',
      userName VARCHAR(100) NULL COMMENT 'User name',
      gameServerId VARCHAR(100) NULL COMMENT 'Game server ID',
      userMessage VARCHAR(255) NULL COMMENT 'User message (max 255 chars)',
      logFilePath VARCHAR(500) NULL COMMENT 'Path to log file',
      crashEventIp VARCHAR(45) NULL COMMENT 'IP address (IPv4/IPv6)',
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_crashId (crashId),
      INDEX idx_platform (platform),
      INDEX idx_environment (environment),
      INDEX idx_branch (branch),
      INDEX idx_accountId (accountId),
      INDEX idx_gameServerId (gameServerId),
      INDEX idx_createdAt (createdAt),
      FOREIGN KEY (crashId) REFERENCES crashes(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // 37. Crash retention settings table
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS crash_retention_settings (
      id INT PRIMARY KEY AUTO_INCREMENT,
      crashEventsRetentionDays INT DEFAULT 90 COMMENT 'Retention period for crash events in days',
      crashesRetentionDays INT DEFAULT 365 COMMENT 'Retention period for crashes in days',
      stackFilesRetentionDays INT DEFAULT 365 COMMENT 'Retention period for stack files in days',
      logFilesRetentionDays INT DEFAULT 30 COMMENT 'Retention period for log files in days',
      updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      updatedBy INT NULL COMMENT 'User ID who updated settings'
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // Insert default crash retention settings
  await connection.execute(`
    INSERT IGNORE INTO crash_retention_settings (
      crashEventsRetentionDays,
      crashesRetentionDays,
      stackFilesRetentionDays,
      logFilesRetentionDays
    ) VALUES (90, 365, 365, 30)
  `);

  // 38. Reward item templates table
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_reward_item_templates (
      id VARCHAR(26) PRIMARY KEY COMMENT 'ULID',
      name VARCHAR(255) NOT NULL COMMENT 'Template name',
      description TEXT NULL COMMENT 'Template description',
      rewardItems JSON NOT NULL COMMENT 'Reward items configuration',
      tags JSON NULL COMMENT 'Template tags for categorization',
      createdBy INT NULL COMMENT 'User ID who created this template',
      updatedBy INT NULL COMMENT 'User ID who last updated this template',
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_name (name),
      INDEX idx_created_at (createdAt),
      INDEX idx_updated_at (updatedAt)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // 39. Coupon settings table
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_coupon_settings (
      id VARCHAR(26) PRIMARY KEY COMMENT 'ULID',
      code VARCHAR(64) NULL UNIQUE COMMENT 'Identifier (SPECIAL: name-based; NORMAL: optional)',
      type ENUM('SPECIAL','NORMAL') NOT NULL,
      name VARCHAR(128) NOT NULL,
      description VARCHAR(128) NULL,
      tags JSON NULL,
      maxTotalUses BIGINT NULL,
      perUserLimit INT NOT NULL DEFAULT 1,
      usageLimitType ENUM('USER','CHARACTER') NOT NULL DEFAULT 'USER',
      rewardTemplateId VARCHAR(26) NULL,
      rewardData JSON NULL,
      rewardEmailTitle VARCHAR(255) NULL,
      rewardEmailBody TEXT NULL,
      startsAt DATETIME NULL COMMENT 'Optional: if null, coupon starts immediately',
      expiresAt DATETIME NOT NULL,
      status ENUM('ACTIVE','DISABLED','DELETED') NOT NULL DEFAULT 'ACTIVE',
      codePattern VARCHAR(32) NULL COMMENT 'NORMAL only: ALPHANUMERIC_8, ALPHANUMERIC_16, ALPHANUMERIC_16_HYPHEN',
      generationJobId VARCHAR(26) NULL COMMENT 'NORMAL only: job ID for code generation',
      generationStatus ENUM('PENDING','IN_PROGRESS','COMPLETED','FAILED') NULL COMMENT 'NORMAL only: generation status',
      generatedCount INT NOT NULL DEFAULT 0 COMMENT 'NORMAL only: number of generated codes',
      issuedCount INT NOT NULL DEFAULT 0 COMMENT 'NORMAL only: number of issued codes',
      usedCount INT NOT NULL DEFAULT 0 COMMENT 'Cache: number of used codes',
      targetPlatformsInverted BOOLEAN NOT NULL DEFAULT FALSE COMMENT 'Invert platform targeting',
      targetChannelsInverted BOOLEAN NOT NULL DEFAULT FALSE COMMENT 'Invert channel targeting',
      targetWorldsInverted BOOLEAN NOT NULL DEFAULT FALSE COMMENT 'Invert world targeting',
      targetUserIdsInverted BOOLEAN NOT NULL DEFAULT FALSE COMMENT 'Invert user ID targeting',
      disabledBy VARCHAR(64) NULL,
      disabledAt DATETIME NULL,
      disabledReason TEXT NULL,
      createdBy INT NULL,
      updatedBy INT NULL,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_coupon_settings_type (type),
      INDEX idx_coupon_settings_status (status),
      INDEX idx_coupon_settings_startsAt (startsAt),
      INDEX idx_coupon_settings_expiresAt (expiresAt)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // 40. Coupon target worlds table
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_coupon_target_worlds (
      id VARCHAR(26) PRIMARY KEY COMMENT 'ULID',
      settingId VARCHAR(26) NOT NULL,
      gameWorldId VARCHAR(64) NOT NULL,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_setting_world (settingId, gameWorldId),
      INDEX idx_setting (settingId)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // 41. Coupon target platforms table
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_coupon_target_platforms (
      id VARCHAR(26) PRIMARY KEY COMMENT 'ULID',
      settingId VARCHAR(26) NOT NULL,
      platform VARCHAR(32) NOT NULL,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_setting_platform (settingId, platform),
      INDEX idx_setting (settingId)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // 42. Coupon target channels table
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_coupon_target_channels (
      id VARCHAR(26) PRIMARY KEY COMMENT 'ULID',
      settingId VARCHAR(26) NOT NULL,
      channel VARCHAR(64) NOT NULL,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_setting_channel (settingId, channel),
      INDEX idx_setting (settingId)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // 43. Coupon target subchannels table
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_coupon_target_subchannels (
      id VARCHAR(26) PRIMARY KEY COMMENT 'ULID',
      settingId VARCHAR(26) NOT NULL,
      subchannel VARCHAR(64) NOT NULL,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_setting_subchannel (settingId, subchannel),
      INDEX idx_setting (settingId)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // 43.5. Coupon target users table
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_coupon_target_users (
      id VARCHAR(26) PRIMARY KEY COMMENT 'ULID',
      settingId VARCHAR(26) NOT NULL,
      userId VARCHAR(64) NOT NULL,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_setting_user (settingId, userId),
      INDEX idx_setting (settingId)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // 44. Issued coupons table
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_coupons (
      id VARCHAR(26) PRIMARY KEY COMMENT 'ULID',
      settingId VARCHAR(26) NOT NULL,
      code VARCHAR(32) NOT NULL UNIQUE,
      status ENUM('ISSUED','USED','REVOKED') NOT NULL DEFAULT 'ISSUED',
      issuedBatchJobId VARCHAR(26) NULL,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      usedAt DATETIME NULL,
      INDEX idx_setting_status (settingId, status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // 45. Coupon uses table
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_coupon_uses (
      id VARCHAR(26) PRIMARY KEY COMMENT 'ULID',
      settingId VARCHAR(26) NOT NULL,
      issuedCouponId VARCHAR(26) NULL,
      userId VARCHAR(64) NOT NULL,
      characterId VARCHAR(64) NULL COMMENT 'Character ID for character-level usage limit',
      userName VARCHAR(128) NOT NULL DEFAULT '',
      sequence INT NOT NULL,
      usedAt DATETIME NOT NULL,
      userIp VARCHAR(45) NULL,
      gameWorldId VARCHAR(64) NULL,
      platform VARCHAR(32) NULL,
      channel VARCHAR(64) NULL,
      subchannel VARCHAR(64) NULL,
      UNIQUE KEY uniq_setting_user_seq (settingId, userId, sequence),
      INDEX idx_setting_usedAt (settingId, usedAt)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // 46. Coupon logs table
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_coupon_logs (
      id VARCHAR(26) PRIMARY KEY COMMENT 'ULID',
      settingId VARCHAR(26) NOT NULL,
      issuedCouponId VARCHAR(26) NULL,
      userId VARCHAR(64) NULL,
      action ENUM('USE','INVALID','EXPIRED','FAILED') NOT NULL,
      detail TEXT NULL,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_setting_createdAt (settingId, createdAt)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // 47. Coupon batch jobs table
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_coupon_batch_jobs (
      id VARCHAR(26) PRIMARY KEY COMMENT 'ULID',
      settingId VARCHAR(26) NOT NULL,
      totalCount BIGINT NOT NULL,
      issuedCount BIGINT NOT NULL DEFAULT 0,
      status ENUM('PENDING','RUNNING','DONE','FAILED') NOT NULL DEFAULT 'PENDING',
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_setting (settingId)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // 48. Reward templates table
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_reward_templates (
      id VARCHAR(26) PRIMARY KEY COMMENT 'ULID',
      nameKey VARCHAR(128) NULL,
      descriptionKey VARCHAR(128) NULL,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // 49. Reward items table
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_reward_items (
      id VARCHAR(26) PRIMARY KEY COMMENT 'ULID',
      rewardTemplateId VARCHAR(26) NOT NULL,
      itemType VARCHAR(64) NOT NULL,
      itemId VARCHAR(64) NULL,
      amount BIGINT NOT NULL,
      data JSON NULL,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_reward_template (rewardTemplateId)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // Insert default job types
  await connection.execute(`
    INSERT IGNORE INTO g_job_types (name, displayName, description, jobSchema, isEnabled) VALUES
    ('mailsend', 'Email Sender', 'Send email messages', '{"to":{"type":"string","required":true,"description":"Recipient email address"},"subject":{"type":"string","required":true,"description":"Email subject"},"body":{"type":"text","required":true,"description":"Email body content"}}', TRUE),
    ('http_request', 'HTTP Request', 'Make HTTP requests', '{"url":{"type":"string","required":true,"description":"Request URL"},"method":{"type":"select","required":true,"description":"HTTP method","options":["GET","POST","PUT","DELETE","PATCH"],"default":"GET"},"headers":{"type":"object","required":false,"description":"Request headers (JSON format)"},"body":{"type":"text","required":false,"description":"Request body"}}', TRUE),
    ('ssh_command', 'SSH Command', 'Execute SSH commands', '{"host":{"type":"string","required":true,"description":"SSH host address"},"username":{"type":"string","required":true,"description":"SSH username"},"command":{"type":"text","required":true,"description":"Command to execute"},"port":{"type":"number","required":false,"description":"SSH port","default":22}}', TRUE),
    ('log_message', 'Log Message', 'Log messages', '{"level":{"type":"select","required":true,"description":"Log level","options":["debug","info","warn","error"],"default":"info"},"message":{"type":"text","required":true,"description":"Log message content"}}', TRUE)
  `);

  // Insert sample context fields
  await connection.execute(`
    INSERT IGNORE INTO g_remote_config_context_fields
    (id, fieldName, fieldType, description, isRequired, defaultValue, createdBy) VALUES
    (1, 'player_vip_level', 'number', 'VIP 레벨 (0-10)', FALSE, '0', 1),
    (2, 'player_level', 'number', '플레이어 레벨', FALSE, '1', 1),
    (3, 'device_platform', 'string', '디바이스 플랫폼 (ios, android, web)', FALSE, 'web', 1),
    (4, 'user_country', 'string', '사용자 국가 코드', FALSE, 'KR', 1),
    (5, 'app_version', 'string', '앱 버전', FALSE, '1.0.0', 1)
  `);

  // Insert sample segments
  await connection.execute(`
    INSERT IGNORE INTO g_remote_config_segments
    (id, segmentName, conditions, value, priority, isActive, createdBy) VALUES
    (1, 'VIP 사용자',
     JSON_OBJECT('conditions', JSON_ARRAY(
       JSON_OBJECT('field', 'player_vip_level', 'operator', 'greater_than_or_equal', 'value', 3)
     )),
     'VIP 레벨 3 이상인 사용자', 1, TRUE, 1),
    (2, '신규 사용자',
     JSON_OBJECT('conditions', JSON_ARRAY(
       JSON_OBJECT('field', 'player_level', 'operator', 'less_than', 'value', 10)
     )),
     '플레이어 레벨 10 미만인 신규 사용자', 2, TRUE, 1),
    (3, '모바일 사용자',
     JSON_OBJECT('conditions', JSON_ARRAY(
       JSON_OBJECT('field', 'device_platform', 'operator', 'in', 'value', 'ios,android')
     )),
     'iOS 또는 Android 플랫폼 사용자', 3, TRUE, 1),
    (4, '고레벨 사용자',
     JSON_OBJECT('conditions', JSON_ARRAY(
       JSON_OBJECT('field', 'player_level', 'operator', 'greater_than_or_equal', 'value', 50)
     )),
     '플레이어 레벨 50 이상인 고레벨 사용자', 4, TRUE, 1),
    (5, '웹 사용자',
     JSON_OBJECT('conditions', JSON_ARRAY(
       JSON_OBJECT('field', 'device_platform', 'operator', 'equals', 'value', 'web')
     )),
     '웹 플랫폼 사용자', 5, TRUE, 1)
  `);

  console.log('✓ Default data inserted');
  console.log('🎉 Initial schema creation completed successfully!');
};

exports.down = async function(connection) {
  // Connection is provided by the migration system

  console.log('Rolling back initial schema...');

  // Drop tables in reverse order (respecting foreign key constraints)
  const tables = [
    'g_reward_items',
    'g_reward_templates',
    'g_coupon_batch_jobs',
    'g_coupon_logs',
    'g_coupon_uses',
    'g_coupons',
    'g_coupon_target_users',
    'g_coupon_target_subchannels',
    'g_coupon_target_channels',
    'g_coupon_target_platforms',
    'g_coupon_target_worlds',
    'g_coupon_settings',
    'g_reward_item_templates',
    'crash_retention_settings',
    'crash_events',
    'crashes',
    'g_invitations',
    'g_surveys',
    'g_mails',
    'g_ingame_popup_notices',
    'g_service_notices',
    'g_remote_config_context_fields',
    'g_remote_config_variants',
    'g_remote_config_campaigns',
    'g_remote_config_deployments',
    'g_remote_config_versions',
    'g_remote_configs',
    'g_job_executions',
    'g_jobs',
    'g_job_types',
    'g_message_template_locales',
    'g_message_templates',
    'g_vars',
    'g_tag_assignments',
    'g_tags',
    'g_ip_whitelist',
    'g_account_whitelist',
    'g_client_versions',
    'g_game_worlds',
    'g_audit_logs',
    'g_password_reset_tokens',
    'g_oauth_accounts',
    'g_users'
  ];

  for (const table of tables) {
    await connection.execute(`DROP TABLE IF EXISTS ${table}`);
    console.log(`✓ Dropped table: ${table}`);
  }

  console.log('✓ Initial schema rollback completed');
};

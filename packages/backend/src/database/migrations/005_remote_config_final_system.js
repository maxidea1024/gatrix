const mysql = require('mysql2/promise');

exports.up = async function() {
  console.log('Starting Remote Config Final System migration...');
  
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'motif_dev',
    password: process.env.DB_PASSWORD || 'dev123$',
    database: process.env.DB_NAME || 'uwo_gate'
  });

  console.log('Creating Remote Config system tables...');

  // 1. Environments table
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_remote_config_environments (
      id INT AUTO_INCREMENT PRIMARY KEY,
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
      INDEX idx_is_default (isDefault),
      CONSTRAINT fk_rc_env_created_by FOREIGN KEY (createdBy) REFERENCES g_users(id),
      CONSTRAINT fk_rc_env_updated_by FOREIGN KEY (updatedBy) REFERENCES g_users(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // 2. Templates table (main template storage)
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_remote_config_templates (
      id INT AUTO_INCREMENT PRIMARY KEY,
      environmentId INT NOT NULL,
      templateName VARCHAR(200) NOT NULL,
      displayName VARCHAR(300) NOT NULL,
      description TEXT NULL,
      templateType VARCHAR(50) NOT NULL,
      status VARCHAR(50) NOT NULL DEFAULT 'draft',
      templateData JSON NOT NULL,
      version INT NOT NULL DEFAULT 1,
      etag VARCHAR(64) NOT NULL,
      publishedAt TIMESTAMP NULL,
      archivedAt TIMESTAMP NULL,
      createdBy INT NOT NULL,
      updatedBy INT NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      
      UNIQUE KEY uk_template_env_name (environmentId, templateName),
      INDEX idx_template_type (templateType),
      INDEX idx_template_status (status),
      INDEX idx_template_etag (etag),
      INDEX idx_template_published (publishedAt),
      CONSTRAINT fk_rc_template_environment FOREIGN KEY (environmentId) REFERENCES g_remote_config_environments(id) ON DELETE CASCADE,
      CONSTRAINT fk_rc_template_created_by FOREIGN KEY (createdBy) REFERENCES g_users(id),
      CONSTRAINT fk_rc_template_updated_by FOREIGN KEY (updatedBy) REFERENCES g_users(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // 3. Template versions table (version history)
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_remote_config_template_versions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      templateId INT NOT NULL,
      version INT NOT NULL,
      templateData JSON NOT NULL,
      changeDescription TEXT NULL,
      etag VARCHAR(64) NOT NULL,
      createdBy INT NOT NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      
      UNIQUE KEY uk_template_version (templateId, version),
      INDEX idx_version_etag (etag),
      INDEX idx_version_created (createdAt),
      CONSTRAINT fk_rc_version_template FOREIGN KEY (templateId) REFERENCES g_remote_config_templates(id) ON DELETE CASCADE,
      CONSTRAINT fk_rc_version_created_by FOREIGN KEY (createdBy) REFERENCES g_users(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // 4. Change requests table (approval workflow)
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_remote_config_change_requests (
      id INT AUTO_INCREMENT PRIMARY KEY,
      templateId INT NOT NULL,
      requestType VARCHAR(50) NOT NULL,
      title VARCHAR(300) NOT NULL,
      description TEXT NULL,
      proposedData JSON NOT NULL,
      currentData JSON NULL,
      status VARCHAR(50) NOT NULL DEFAULT 'pending',
      requiredApprovals INT NOT NULL DEFAULT 1,
      receivedApprovals INT NOT NULL DEFAULT 0,
      approvers JSON NULL,
      rejectionReason TEXT NULL,
      scheduledAt TIMESTAMP NULL,
      completedAt TIMESTAMP NULL,
      createdBy INT NOT NULL,
      updatedBy INT NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      
      INDEX idx_request_status (status),
      INDEX idx_request_type (requestType),
      INDEX idx_request_scheduled (scheduledAt),
      INDEX idx_request_completed (completedAt),
      CONSTRAINT fk_rc_request_template FOREIGN KEY (templateId) REFERENCES g_remote_config_templates(id) ON DELETE CASCADE,
      CONSTRAINT fk_rc_request_created_by FOREIGN KEY (createdBy) REFERENCES g_users(id),
      CONSTRAINT fk_rc_request_updated_by FOREIGN KEY (updatedBy) REFERENCES g_users(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // 5. Segments table (reusable targeting conditions)
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_remote_config_segments (
      id INT AUTO_INCREMENT PRIMARY KEY,
      environmentId INT NOT NULL,
      segmentName VARCHAR(200) NOT NULL,
      displayName VARCHAR(300) NOT NULL,
      description TEXT NULL,
      conditions JSON NOT NULL,
      isActive BOOLEAN NOT NULL DEFAULT TRUE,
      createdBy INT NOT NULL,
      updatedBy INT NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      
      UNIQUE KEY uk_segment_env_name (environmentId, segmentName),
      INDEX idx_segment_active (isActive),
      CONSTRAINT fk_rc_segment_environment FOREIGN KEY (environmentId) REFERENCES g_remote_config_environments(id) ON DELETE CASCADE,
      CONSTRAINT fk_rc_segment_created_by FOREIGN KEY (createdBy) REFERENCES g_users(id),
      CONSTRAINT fk_rc_segment_updated_by FOREIGN KEY (updatedBy) REFERENCES g_users(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // API tokens are managed by the existing g_api_access_tokens table

  // 7. Metrics table
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_remote_config_metrics (
      id INT AUTO_INCREMENT PRIMARY KEY,
      environmentId INT NOT NULL,
      templateId INT NULL,
      configKey VARCHAR(200) NOT NULL,
      eventType VARCHAR(50) NOT NULL,
      value JSON NULL,
      userContext JSON NULL,
      applicationName VARCHAR(255) NULL,
      sdkVersion VARCHAR(50) NULL,
      evaluationTime INT NULL,
      timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      
      INDEX idx_metrics_env (environmentId),
      INDEX idx_metrics_template (templateId),
      INDEX idx_metrics_key (configKey),
      INDEX idx_metrics_event (eventType),
      INDEX idx_metrics_timestamp (timestamp),
      INDEX idx_metrics_app (applicationName),
      CONSTRAINT fk_rc_metrics_environment FOREIGN KEY (environmentId) REFERENCES g_remote_config_environments(id) ON DELETE CASCADE,
      CONSTRAINT fk_rc_metrics_template FOREIGN KEY (templateId) REFERENCES g_remote_config_templates(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // 8. Campaigns table (time-based override conditions)
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_remote_config_campaigns (
      id INT AUTO_INCREMENT PRIMARY KEY,
      environmentId INT NOT NULL,
      templateId INT NOT NULL,
      campaignName VARCHAR(200) NOT NULL,
      displayName VARCHAR(300) NOT NULL,
      description TEXT NULL,
      overrideData JSON NOT NULL,
      priority INT NOT NULL DEFAULT 0,
      startDate TIMESTAMP NOT NULL,
      endDate TIMESTAMP NOT NULL,
      isActive BOOLEAN NOT NULL DEFAULT TRUE,
      targetSegments JSON NULL,
      trafficPercentage INT NOT NULL DEFAULT 100,
      createdBy INT NOT NULL,
      updatedBy INT NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

      UNIQUE KEY uk_campaign_env_name (environmentId, campaignName),
      INDEX idx_campaign_template (templateId),
      INDEX idx_campaign_dates (startDate, endDate),
      INDEX idx_campaign_active (isActive),
      INDEX idx_campaign_priority (priority),
      CONSTRAINT fk_rc_campaign_environment FOREIGN KEY (environmentId) REFERENCES g_remote_config_environments(id) ON DELETE CASCADE,
      CONSTRAINT fk_rc_campaign_template FOREIGN KEY (templateId) REFERENCES g_remote_config_templates(id) ON DELETE CASCADE,
      CONSTRAINT fk_rc_campaign_created_by FOREIGN KEY (createdBy) REFERENCES g_users(id),
      CONSTRAINT fk_rc_campaign_updated_by FOREIGN KEY (updatedBy) REFERENCES g_users(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // 9. Edit sessions table (conflict prevention)
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_remote_config_edit_sessions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      templateId INT NOT NULL,
      userId INT NOT NULL,
      sessionToken VARCHAR(255) NOT NULL UNIQUE,
      lockedFields JSON NULL,
      lastActivity TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      expiresAt TIMESTAMP NOT NULL,

      INDEX idx_session_template (templateId),
      INDEX idx_session_user (userId),
      INDEX idx_session_token (sessionToken),
      INDEX idx_session_expires (expiresAt),
      CONSTRAINT fk_rc_session_template FOREIGN KEY (templateId) REFERENCES g_remote_config_templates(id) ON DELETE CASCADE,
      CONSTRAINT fk_rc_session_user FOREIGN KEY (userId) REFERENCES g_users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await connection.end();
  console.log('Remote Config Final System migration completed successfully!');
};

exports.down = async function() {
  console.log('Rolling back Remote Config Final System migration...');
  
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'motif_dev',
    password: process.env.DB_PASSWORD || 'dev123$',
    database: process.env.DB_NAME || 'uwo_gate'
  });

  const tables = [
    'g_remote_config_edit_sessions',
    'g_remote_config_metrics',
    'g_remote_config_segments',
    'g_remote_config_change_requests',
    'g_remote_config_template_versions',
    'g_remote_config_templates',
    'g_remote_config_environments'
  ];

  for (const table of tables) {
    await connection.execute(`DROP TABLE IF EXISTS ${table}`);
    console.log(`Dropped table: ${table}`);
  }

  await connection.end();
  console.log('Remote Config Final System rollback completed!');
};

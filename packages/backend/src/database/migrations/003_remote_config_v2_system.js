/**
 * Remote Config V2 System Migration
 * Creates all tables for the new template-based remote config system
 */

const mysql = require('mysql2/promise');
require('dotenv').config();

exports.up = async function() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'motif_dev',
    password: process.env.DB_PASSWORD || 'dev123$',
    database: process.env.DB_NAME || 'uwo_gate'
  });

  console.log('Creating Remote Config V2 system tables...');

  // 1. Environments table
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_remote_config_v2_environments (
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
      CONSTRAINT fk_v2_env_created_by FOREIGN KEY (createdBy) REFERENCES g_users(id),
      CONSTRAINT fk_v2_env_updated_by FOREIGN KEY (updatedBy) REFERENCES g_users(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // 2. Templates table (main template storage)
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_remote_config_v2_templates (
      id INT AUTO_INCREMENT PRIMARY KEY,
      environmentId INT NOT NULL,
      templateName VARCHAR(200) NOT NULL,
      displayName VARCHAR(300) NOT NULL,
      description TEXT NULL,
      templateType VARCHAR(50) NOT NULL,
      status VARCHAR(50) NOT NULL DEFAULT 'draft',
      version INT NOT NULL DEFAULT 1,
      templateData JSON NOT NULL,
      metadata JSON NULL,
      etag VARCHAR(100) NULL,
      createdBy INT NOT NULL,
      updatedBy INT NULL,
      publishedAt TIMESTAMP NULL,
      archivedAt TIMESTAMP NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      
      UNIQUE KEY unique_env_template (environmentId, templateName),
      INDEX idx_env_status (environmentId, status),
      INDEX idx_template_type (templateType),
      INDEX idx_status (status),
      INDEX idx_published_at (publishedAt),
      CONSTRAINT fk_v2_template_env FOREIGN KEY (environmentId) REFERENCES g_remote_config_v2_environments(id),
      CONSTRAINT fk_v2_template_created_by FOREIGN KEY (createdBy) REFERENCES g_users(id),
      CONSTRAINT fk_v2_template_updated_by FOREIGN KEY (updatedBy) REFERENCES g_users(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // 3. Template versions (for history tracking)
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_remote_config_v2_template_versions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      templateId INT NOT NULL,
      version INT NOT NULL,
      templateData JSON NOT NULL,
      metadata JSON NULL,
      changeDescription VARCHAR(500) NULL,
      createdBy INT NOT NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      
      UNIQUE KEY unique_template_version (templateId, version),
      INDEX idx_template_id (templateId),
      CONSTRAINT fk_v2_version_template FOREIGN KEY (templateId) REFERENCES g_remote_config_v2_templates(id),
      CONSTRAINT fk_v2_version_created_by FOREIGN KEY (createdBy) REFERENCES g_users(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // 4. Change requests (approval workflow)
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_remote_config_v2_change_requests (
      id INT AUTO_INCREMENT PRIMARY KEY,
      templateId INT NOT NULL,
      environmentId INT NOT NULL,
      requestType VARCHAR(50) NOT NULL,
      status VARCHAR(50) NOT NULL DEFAULT 'pending',
      proposedChanges JSON NOT NULL,
      currentData JSON NULL,
      description TEXT NULL,
      requestedBy INT NOT NULL,
      approvedBy INT NULL,
      approvedAt TIMESTAMP NULL,
      rejectionReason TEXT NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      
      INDEX idx_template_id (templateId),
      INDEX idx_environment_id (environmentId),
      INDEX idx_status (status),
      INDEX idx_requested_by (requestedBy),
      CONSTRAINT fk_v2_change_template FOREIGN KEY (templateId) REFERENCES g_remote_config_v2_templates(id),
      CONSTRAINT fk_v2_change_env FOREIGN KEY (environmentId) REFERENCES g_remote_config_v2_environments(id),
      CONSTRAINT fk_v2_change_requested_by FOREIGN KEY (requestedBy) REFERENCES g_users(id),
      CONSTRAINT fk_v2_change_approved_by FOREIGN KEY (approvedBy) REFERENCES g_users(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // 5. Segments (reusable targeting conditions)
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_remote_config_v2_segments (
      id INT AUTO_INCREMENT PRIMARY KEY,
      environmentId INT NOT NULL,
      segmentName VARCHAR(200) NOT NULL,
      displayName VARCHAR(300) NOT NULL,
      description TEXT NULL,
      segmentConditions JSON NOT NULL,
      isActive BOOLEAN NOT NULL DEFAULT TRUE,
      createdBy INT NOT NULL,
      updatedBy INT NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      
      UNIQUE KEY unique_env_segment (environmentId, segmentName),
      INDEX idx_environment_id (environmentId),
      INDEX idx_is_active (isActive),
      CONSTRAINT fk_v2_segment_env FOREIGN KEY (environmentId) REFERENCES g_remote_config_v2_environments(id),
      CONSTRAINT fk_v2_segment_created_by FOREIGN KEY (createdBy) REFERENCES g_users(id),
      CONSTRAINT fk_v2_segment_updated_by FOREIGN KEY (updatedBy) REFERENCES g_users(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // 6. API Access Tokens - Using existing g_api_access_tokens table

  // 7. Metrics (aggregated data from SDKs)
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_remote_config_v2_metrics (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      environmentName VARCHAR(100) NOT NULL,
      configKey VARCHAR(200) NOT NULL,
      variantName VARCHAR(200) NULL,
      applicationName VARCHAR(200) NOT NULL,
      
      flagValue VARCHAR(50) NULL,
      campaignId INT NULL,
      
      requestCount INT NOT NULL DEFAULT 0,
      uniqueUsers INT NOT NULL DEFAULT 0,
      successCount INT NOT NULL DEFAULT 0,
      errorCount INT NOT NULL DEFAULT 0,
      
      hourBucket TIMESTAMP NOT NULL,
      dateBucket DATE NOT NULL,
      
      platformType VARCHAR(50) NULL,
      appVersion VARCHAR(50) NULL,
      
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      
      INDEX idx_env_key_hour (environmentName, configKey, hourBucket),
      INDEX idx_date_bucket (dateBucket),
      INDEX idx_platform (platformType),
      
      UNIQUE KEY unique_metric (environmentName, configKey, variantName, hourBucket, platformType, appVersion)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // 8. Edit sessions (for conflict resolution)
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_remote_config_v2_edit_sessions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      templateId INT NOT NULL,
      userId INT NOT NULL,
      sessionId VARCHAR(100) NOT NULL UNIQUE,
      lockData JSON NULL,
      expiresAt TIMESTAMP NOT NULL,
      lastActivity TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      
      INDEX idx_template_id (templateId),
      INDEX idx_user_id (userId),
      INDEX idx_expires_at (expiresAt),
      CONSTRAINT fk_v2_session_template FOREIGN KEY (templateId) REFERENCES g_remote_config_v2_templates(id),
      CONSTRAINT fk_v2_session_user FOREIGN KEY (userId) REFERENCES g_users(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await connection.end();
  console.log('Remote Config V2 system tables created successfully');
};

exports.down = async function() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'motif_dev',
    password: process.env.DB_PASSWORD || 'dev123$',
    database: process.env.DB_NAME || 'uwo_gate'
  });

  console.log('Dropping Remote Config V2 system tables...');

  await connection.execute('DROP TABLE IF EXISTS g_remote_config_v2_edit_sessions');
  await connection.execute('DROP TABLE IF EXISTS g_remote_config_v2_metrics');
  // g_api_v2_access_tokens table removed - using g_api_access_tokens instead
  await connection.execute('DROP TABLE IF EXISTS g_remote_config_v2_segments');
  await connection.execute('DROP TABLE IF EXISTS g_remote_config_v2_change_requests');
  await connection.execute('DROP TABLE IF EXISTS g_remote_config_v2_template_versions');
  await connection.execute('DROP TABLE IF EXISTS g_remote_config_v2_templates');
  await connection.execute('DROP TABLE IF EXISTS g_remote_config_v2_environments');

  await connection.end();
  console.log('Remote Config V2 system tables dropped successfully');
};

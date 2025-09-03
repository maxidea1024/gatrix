/**
 * Initial Database Schema for Gatrix
 * Creates all tables with updated field names and tracking columns
 * Updated: 2025-09-03 - Added createdBy/updatedBy fields, changed enums to strings
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
      emailVerified BOOLEAN NOT NULL DEFAULT FALSE,
      emailVerifiedAt TIMESTAMP NULL,
      lastLoginAt TIMESTAMP NULL,
      avatarUrl VARCHAR(500) NULL,
      createdBy INT NULL,
      updatedBy INT NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_email (email),
      INDEX idx_role (role),
      INDEX idx_status (status),
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
      description TEXT NULL,
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

  // Insert default job types
  await connection.execute(`
    INSERT IGNORE INTO g_job_types (name, displayName, description, jobSchema, isEnabled) VALUES
    ('mailsend', 'Email Sender', 'Send email messages', '{"to":{"type":"string","required":true,"description":"Recipient email address"},"subject":{"type":"string","required":true,"description":"Email subject"},"body":{"type":"text","required":true,"description":"Email body content"}}', TRUE),
    ('http_request', 'HTTP Request', 'Make HTTP requests', '{"url":{"type":"string","required":true,"description":"Request URL"},"method":{"type":"select","required":true,"description":"HTTP method","options":["GET","POST","PUT","DELETE","PATCH"],"default":"GET"},"headers":{"type":"object","required":false,"description":"Request headers (JSON format)"},"body":{"type":"text","required":false,"description":"Request body"}}', TRUE),
    ('ssh_command', 'SSH Command', 'Execute SSH commands', '{"host":{"type":"string","required":true,"description":"SSH host address"},"username":{"type":"string","required":true,"description":"SSH username"},"command":{"type":"text","required":true,"description":"Command to execute"},"port":{"type":"number","required":false,"description":"SSH port","default":22}}', TRUE),
    ('log_message', 'Log Message', 'Log messages', '{"level":{"type":"select","required":true,"description":"Log level","options":["debug","info","warn","error"],"default":"info"},"message":{"type":"text","required":true,"description":"Log message content"}}', TRUE)
  `);

  console.log('✓ Default data inserted');
  console.log('🎉 Initial schema creation completed successfully!');

  await connection.end();
};

exports.down = async function() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'gatrix'
  });

  console.log('Rolling back initial schema...');

  // Drop tables in reverse order (respecting foreign key constraints)
  const tables = [
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
  await connection.end();
};

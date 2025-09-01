/**
 * Initial Database Schema for Gatrix
 * Creates all tables with camelCase field names
 */

const mysql = require('mysql2/promise');

exports.up = async function() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'gatrix'
  });

  console.log('Creating initial database schema...');

  // 1. Users table
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) NOT NULL UNIQUE,
      password VARCHAR(255) NULL,
      role ENUM('admin', 'user') NOT NULL DEFAULT 'user',
      status ENUM('active', 'inactive', 'deleted') NOT NULL DEFAULT 'active',
      emailVerified BOOLEAN NOT NULL DEFAULT FALSE,
      emailVerifiedAt TIMESTAMP NULL,
      lastLoginAt TIMESTAMP NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_email (email),
      INDEX idx_role (role),
      INDEX idx_status (status)
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
      name VARCHAR(255) NOT NULL,
      description TEXT NULL,
      serverUrl VARCHAR(500) NOT NULL,
      isActive BOOLEAN NOT NULL DEFAULT TRUE,
      isMaintenance BOOLEAN NOT NULL DEFAULT FALSE,
      maintenanceMessage TEXT NULL,
      displayOrder INT NOT NULL DEFAULT 0,
      tags JSON NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_active (isActive),
      INDEX idx_maintenance (isMaintenance),
      INDEX idx_display_order (displayOrder)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // 6. Client versions table
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_client_versions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      version VARCHAR(50) NOT NULL,
      platform ENUM('pc', 'mobile', 'pc-wegame') NOT NULL DEFAULT 'pc',
      downloadUrl VARCHAR(500) NOT NULL,
      isRequired BOOLEAN NOT NULL DEFAULT FALSE,
      releaseNotes TEXT NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY unique_version_platform (version, platform),
      INDEX idx_platform (platform),
      INDEX idx_required (isRequired)
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
      memo TEXT NULL,
      tags JSON NULL,
      createdBy INT NOT NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_whitelist_creator FOREIGN KEY (createdBy) REFERENCES g_users(id) ON DELETE RESTRICT,
      UNIQUE KEY unique_account_id (accountId),
      INDEX idx_account_id (accountId),
      INDEX idx_ip_address (ipAddress),
      INDEX idx_date_range (startDate, endDate)
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
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_tag_assignments_tag FOREIGN KEY (tagId) REFERENCES g_tags(id) ON DELETE CASCADE,
      INDEX idx_entity (entityType, entityId),
      UNIQUE KEY unique_assignment (tagId, entityType, entityId)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // 11. Variables table
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_vars (
      id INT AUTO_INCREMENT PRIMARY KEY,
      \`key\` VARCHAR(255) NOT NULL UNIQUE,
      value TEXT NULL,
      description TEXT NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_key (\`key\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // 12. Message templates table
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_message_templates (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL UNIQUE,
      subject VARCHAR(500) NULL,
      content TEXT NOT NULL,
      type ENUM('email', 'sms', 'push', 'system') NOT NULL DEFAULT 'email',
      variables JSON NULL,
      isActive BOOLEAN NOT NULL DEFAULT TRUE,
      createdBy INT NULL,
      updatedBy INT NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_message_templates_creator FOREIGN KEY (createdBy) REFERENCES g_users(id) ON DELETE SET NULL,
      CONSTRAINT fk_message_templates_updater FOREIGN KEY (updatedBy) REFERENCES g_users(id) ON DELETE SET NULL,
      INDEX idx_name (name),
      INDEX idx_type (type),
      INDEX idx_active (isActive)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  console.log('✓ Extended tables created');

  // 13. Job types table
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_job_types (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(100) NOT NULL UNIQUE,
      description TEXT NULL,
      \`schema\` JSON NULL,
      isActive BOOLEAN NOT NULL DEFAULT TRUE,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_name (name),
      INDEX idx_active (isActive)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // 14. Jobs table
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_jobs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      description TEXT NULL,
      jobTypeId INT NOT NULL,
      config JSON NULL,
      schedule VARCHAR(100) NULL,
      isActive BOOLEAN NOT NULL DEFAULT TRUE,
      lastRunAt TIMESTAMP NULL,
      nextRunAt TIMESTAMP NULL,
      createdBy INT NULL,
      updatedBy INT NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_jobs_type FOREIGN KEY (jobTypeId) REFERENCES g_job_types(id) ON DELETE RESTRICT,
      CONSTRAINT fk_jobs_creator FOREIGN KEY (createdBy) REFERENCES g_users(id) ON DELETE SET NULL,
      CONSTRAINT fk_jobs_updater FOREIGN KEY (updatedBy) REFERENCES g_users(id) ON DELETE SET NULL,
      INDEX idx_name (name),
      INDEX idx_type (jobTypeId),
      INDEX idx_active (isActive),
      INDEX idx_schedule (schedule),
      INDEX idx_next_run (nextRunAt)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // 15. Job executions table
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_job_executions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      jobId INT NOT NULL,
      status ENUM('pending', 'running', 'completed', 'failed', 'cancelled') NOT NULL DEFAULT 'pending',
      startedAt TIMESTAMP NULL,
      completedAt TIMESTAMP NULL,
      result JSON NULL,
      error TEXT NULL,
      logs TEXT NULL,
      triggeredBy ENUM('schedule', 'manual', 'api') NOT NULL DEFAULT 'schedule',
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
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@gatrix.local';
  const adminName = process.env.ADMIN_NAME || 'Admin';
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';

  // Hash the admin password
  const bcrypt = require('bcryptjs');
  const passwordHash = await bcrypt.hash(adminPassword, 12);

  // Insert default admin user
  await connection.execute(`
    INSERT IGNORE INTO g_users (id, name, email, password, role, status, emailVerified, createdAt, updatedAt)
    VALUES (1, ?, ?, ?, 'admin', 'active', TRUE, NOW(), NOW())
  `, [adminName, adminEmail, passwordHash]);

  // Insert default job types
  await connection.execute(`
    INSERT IGNORE INTO g_job_types (name, description, \`schema\`, isActive) VALUES
    ('mailsend', 'Send email messages', '{"type":"object","properties":{"to":{"type":"string"},"subject":{"type":"string"},"body":{"type":"string"}}}', TRUE),
    ('http_request', 'Make HTTP requests', '{"type":"object","properties":{"url":{"type":"string"},"method":{"type":"string"},"headers":{"type":"object"},"body":{"type":"string"}}}', TRUE),
    ('ssh_command', 'Execute SSH commands', '{"type":"object","properties":{"host":{"type":"string"},"command":{"type":"string"},"username":{"type":"string"}}}', TRUE),
    ('log_message', 'Log messages', '{"type":"object","properties":{"level":{"type":"string"},"message":{"type":"string"}}}', TRUE)
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

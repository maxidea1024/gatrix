/**
 * Unified Database Schema for Gatrix - Complete camelCase
 * Creates all tables with camelCase field names
 */

const name = 'Unified camelCase database schema for Gatrix';

async function up(connection) {
  console.log('Creating unified camelCase database schema...');

  // 1. Users table
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) NOT NULL UNIQUE,
      passwordHash VARCHAR(255) NULL,
      role ENUM('admin', 'user') NOT NULL DEFAULT 'user',
      status ENUM('active', 'inactive', 'deleted') NOT NULL DEFAULT 'active',
      emailVerified BOOLEAN NOT NULL DEFAULT FALSE,
      emailVerifiedAt TIMESTAMP NULL,
      lastLoginAt TIMESTAMP NULL,
      avatarUrl VARCHAR(500) NULL,
      oauthProvider VARCHAR(50) NULL,
      oauthId VARCHAR(255) NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_email (email),
      INDEX idx_role (role),
      INDEX idx_status (status),
      INDEX idx_oauth (oauthProvider, oauthId)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // 2. Job Types table
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_job_types (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(100) NOT NULL UNIQUE,
      displayName VARCHAR(255) NOT NULL,
      description TEXT NULL,
      schemaDefinition JSON NULL,
      isEnabled BOOLEAN NOT NULL DEFAULT TRUE,
      createdBy INT NULL,
      updatedBy INT NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (createdBy) REFERENCES g_users(id) ON DELETE SET NULL,
      FOREIGN KEY (updatedBy) REFERENCES g_users(id) ON DELETE SET NULL,
      INDEX idx_name (name),
      INDEX idx_enabled (isEnabled)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // 3. Jobs table
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_jobs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      description TEXT NULL,
      jobTypeId INT NOT NULL,
      isEnabled BOOLEAN NOT NULL DEFAULT TRUE,
      jobDataMap JSON NULL,
      memo TEXT NULL,
      retryCount INT NOT NULL DEFAULT 0,
      maxRetryCount INT NOT NULL DEFAULT 3,
      timeoutSeconds INT NULL,
      createdBy INT NULL,
      updatedBy INT NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (jobTypeId) REFERENCES g_job_types(id) ON DELETE RESTRICT,
      FOREIGN KEY (createdBy) REFERENCES g_users(id) ON DELETE SET NULL,
      FOREIGN KEY (updatedBy) REFERENCES g_users(id) ON DELETE SET NULL,
      INDEX idx_name (name),
      INDEX idx_job_type (jobTypeId),
      INDEX idx_enabled (isEnabled)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // 4. Job Executions table
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_job_executions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      jobId INT NOT NULL,
      scheduleId INT NULL,
      status ENUM('pending', 'running', 'completed', 'failed', 'timeout', 'cancelled') NOT NULL DEFAULT 'pending',
      startedAt TIMESTAMP NULL,
      completedAt TIMESTAMP NULL,
      result JSON NULL,
      errorMessage TEXT NULL,
      retryAttempt INT NOT NULL DEFAULT 0,
      executionTimeMs INT NULL,
      executedBy INT NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (jobId) REFERENCES g_jobs(id) ON DELETE CASCADE,
      FOREIGN KEY (executedBy) REFERENCES g_users(id) ON DELETE SET NULL,
      INDEX idx_job_status (jobId, status),
      INDEX idx_status_created (status, createdAt),
      INDEX idx_started_at (startedAt)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // 5. IP Whitelists table - Force camelCase without backticks
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_ip_whitelists (
      id INT AUTO_INCREMENT PRIMARY KEY,
      ipAddress VARCHAR(45) NOT NULL,
      description TEXT NULL,
      isEnabled BOOLEAN NOT NULL DEFAULT TRUE,
      createdBy INT NULL,
      updatedBy INT NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (createdBy) REFERENCES g_users(id) ON DELETE SET NULL,
      FOREIGN KEY (updatedBy) REFERENCES g_users(id) ON DELETE SET NULL,
      UNIQUE KEY unique_ip (ipAddress),
      INDEX idx_enabled (isEnabled)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // 6. Variables table
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_vars (
      varKey VARCHAR(255) PRIMARY KEY,
      varValue TEXT NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // 7. OAuth Accounts table
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_oauth_accounts (
      id INT AUTO_INCREMENT PRIMARY KEY,
      userId INT NOT NULL,
      provider ENUM('google', 'github') NOT NULL,
      providerId VARCHAR(255) NOT NULL,
      providerEmail VARCHAR(255) NULL,
      providerName VARCHAR(255) NULL,
      providerAvatar VARCHAR(500) NULL,
      accessToken TEXT NULL,
      refreshToken TEXT NULL,
      expiresAt TIMESTAMP NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (userId) REFERENCES g_users(id) ON DELETE CASCADE,
      INDEX idx_user (userId),
      INDEX idx_provider (provider, providerId)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // 8. Password Reset Tokens table
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_password_reset_tokens (
      id INT AUTO_INCREMENT PRIMARY KEY,
      userId INT NOT NULL,
      token VARCHAR(255) NOT NULL UNIQUE,
      expiresAt TIMESTAMP NOT NULL,
      used BOOLEAN NOT NULL DEFAULT FALSE,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (userId) REFERENCES g_users(id) ON DELETE CASCADE,
      INDEX idx_user (userId),
      INDEX idx_token (token),
      INDEX idx_expires (expiresAt)
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
      FOREIGN KEY (createdBy) REFERENCES g_users(id) ON DELETE SET NULL,
      FOREIGN KEY (updatedBy) REFERENCES g_users(id) ON DELETE SET NULL,
      INDEX idx_name (name)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // 10. Tag Assignments table
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_tag_assignments (
      id INT AUTO_INCREMENT PRIMARY KEY,
      tagId INT NOT NULL,
      entityType VARCHAR(50) NOT NULL,
      entityId INT NOT NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (tagId) REFERENCES g_tags(id) ON DELETE CASCADE,
      INDEX idx_tag (tagId),
      INDEX idx_entity (entityType, entityId)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // 11. Message Templates table
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_message_templates (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(191) NOT NULL UNIQUE,
      type ENUM('maintenance', 'general', 'notification') NOT NULL DEFAULT 'maintenance',
      isEnabled BOOLEAN NOT NULL DEFAULT TRUE,
      defaultMessage TEXT NULL,
      createdBy BIGINT NULL,
      updatedBy BIGINT NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_name (name),
      INDEX idx_type (type)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // 12. Message Template Locales table
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_message_template_locales (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      templateId BIGINT UNSIGNED NOT NULL,
      lang ENUM('ko', 'en', 'zh') NOT NULL,
      message TEXT NOT NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (templateId) REFERENCES g_message_templates(id) ON DELETE CASCADE,
      INDEX idx_template (templateId),
      INDEX idx_lang (lang)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  console.log('✓ All tables created with camelCase fields');

  // Check actual column names for all tables
  const tables = ['g_users', 'g_job_types', 'g_vars'];
  for (const table of tables) {
    try {
      const [columns] = await connection.execute(`DESCRIBE ${table}`);
      console.log(`${table} columns:`, columns.map(col => col.Field));
    } catch (error) {
      console.log(`❌ Could not describe ${table}:`, error.message);
    }
  }

  console.log('Inserting default data...');

  // Insert default admin user (using actual column names from g_users)
  await connection.execute(`
    INSERT IGNORE INTO g_users (id, name, email, passwordHash, role, status, emailVerified) VALUES
    (1, 'Admin', 'admin@example.com', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj/RK.s5uDfm', 'admin', 'active', TRUE)
  `);

  // Insert default job types (using actual column names from g_job_types)
  await connection.execute(`
    INSERT IGNORE INTO g_job_types (name, displayName, description, schemaDefinition, isEnabled) VALUES
    ('mailsend', 'Email Send', 'Send email messages', '{"type":"object","properties":{"to":{"type":"string"},"subject":{"type":"string"},"body":{"type":"string"}}}', TRUE),
    ('http_request', 'HTTP Request', 'Make HTTP requests', '{"type":"object","properties":{"url":{"type":"string"},"method":{"type":"string"},"headers":{"type":"object"},"body":{"type":"string"}}}', TRUE),
    ('ssh_command', 'SSH Command', 'Execute SSH commands', '{"type":"object","properties":{"host":{"type":"string"},"command":{"type":"string"},"username":{"type":"string"}}}', TRUE),
    ('log_message', 'Log Message', 'Log messages', '{"type":"object","properties":{"level":{"type":"string"},"message":{"type":"string"}}}', TRUE)
  `);

  // Insert default variables (using actual column names from g_vars)
  await connection.execute(`
    INSERT IGNORE INTO g_vars (varKey, varValue) VALUES
    ('maintenance_mode', 'false'),
    ('maintenance_message', 'System maintenance in progress'),
    ('app_version', '1.0.0'),
    ('max_login_attempts', '5'),
    ('session_timeout', '3600')
  `);

  console.log('✓ Default data inserted');
  console.log('🎉 Unified camelCase schema creation completed successfully!');
}

async function down(connection) {
  console.log('Rolling back unified schema...');
  
  const tables = [
    'g_job_executions',
    'g_jobs',
    'g_job_types',
    'g_vars',
    'g_ip_whitelists',
    'g_users'
  ];

  for (const table of tables) {
    await connection.execute(`DROP TABLE IF EXISTS ${table}`);
  }
  
  console.log('✓ Unified schema rollback completed');
}

module.exports = { name, up, down };

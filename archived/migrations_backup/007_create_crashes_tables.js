/**
 * Migration: Create crashes tables
 *
 * Creates tables for client crash reporting system:
 * - crashes: Main crash groups (deduplicated by hash + branch)
 * - crash_events: Individual crash occurrences
 * - crash_retention_settings: Retention policy settings
 */

exports.up = async function (connection) {
  console.log('Creating crashes tables...');

  // Disable foreign key checks to allow dropping tables with dependencies
  await connection.execute('SET FOREIGN_KEY_CHECKS = 0');

  // Drop existing tables if they exist (clean slate)
  await connection.execute('DROP TABLE IF EXISTS crash_events');
  await connection.execute('DROP TABLE IF EXISTS crash_instances');
  await connection.execute('DROP TABLE IF EXISTS crashes');
  await connection.execute('DROP TABLE IF EXISTS crash_retention_settings');

  // Re-enable foreign key checks
  await connection.execute('SET FOREIGN_KEY_CHECKS = 1');

  console.log('✓ Dropped existing crash tables');

  // Create crashes table
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

  console.log('✓ Created crashes table');

  // Create crash_events table
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

  console.log('✓ Created crash_events table');

  // Create crash_retention_settings table
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

  console.log('✓ Created crash_retention_settings table');

  // Insert default retention settings
  await connection.execute(`
    INSERT INTO crash_retention_settings (
      crashEventsRetentionDays,
      crashesRetentionDays,
      stackFilesRetentionDays,
      logFilesRetentionDays
    ) VALUES (90, 365, 365, 30)
  `);

  console.log('✓ Inserted default retention settings');
  console.log('Crashes tables created successfully');
};

exports.down = async function (connection) {
  console.log('Rolling back crashes tables...');

  // Drop tables in reverse order (respecting foreign key constraints)
  await connection.execute('DROP TABLE IF EXISTS crash_events');
  console.log('✓ Dropped crash_events table');

  await connection.execute('DROP TABLE IF EXISTS crashes');
  console.log('✓ Dropped crashes table');

  await connection.execute('DROP TABLE IF EXISTS crash_retention_settings');
  console.log('✓ Dropped crash_retention_settings table');

  console.log('Crashes tables rollback completed');
};

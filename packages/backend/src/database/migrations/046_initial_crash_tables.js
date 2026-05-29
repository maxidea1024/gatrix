/**
 * Initial crash tables migration
 * Creates g_crashes, g_crash_events, g_crash_retention_settings in gatrix_crash database
 */

exports.name = '001_initial_crash_tables';

exports.up = async function (connection) {
  // Crashes
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_crashes (
      id CHAR(26) NOT NULL PRIMARY KEY COMMENT 'ULID',
      chash VARCHAR(32) NOT NULL,
      branch VARCHAR(50) NOT NULL,
      environmentId CHAR(26) NOT NULL,
      platform VARCHAR(50) NOT NULL,
      marketType VARCHAR(50) NULL,
      isEditor BOOLEAN DEFAULT FALSE,
      firstLine VARCHAR(200) NULL,
      stackFilePath VARCHAR(500) NULL,
      crashesCount INT UNSIGNED DEFAULT 1,
      firstCrashEventId CHAR(26) NULL,
      lastCrashEventId CHAR(26) NULL,
      firstCrashAt TIMESTAMP NOT NULL,
      lastCrashAt TIMESTAMP NOT NULL,
      crashesState TINYINT UNSIGNED DEFAULT 0,
      assignee VARCHAR(100) NULL,
      jiraTicket VARCHAR(200) NULL,
      maxAppVersion VARCHAR(50) NULL,
      maxResVersion VARCHAR(50) NULL,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uk_chash_branch (chash, branch),
      INDEX idx_environment_id (environmentId),
      INDEX idx_state (crashesState)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // Crash events
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_crash_events (
      id CHAR(26) NOT NULL PRIMARY KEY COMMENT 'ULID',
      crashId CHAR(26) NOT NULL,
      platform VARCHAR(50) NOT NULL,
      marketType VARCHAR(50) NULL,
      branch VARCHAR(50) NOT NULL,
      environmentId CHAR(26) NOT NULL,
      isEditor BOOLEAN DEFAULT FALSE,
      appVersion VARCHAR(50) NULL,
      resVersion VARCHAR(50) NULL,
      accountId VARCHAR(100) NULL,
      characterId VARCHAR(100) NULL,
      gameUserId VARCHAR(100) NULL,
      userName VARCHAR(100) NULL,
      gameServerId VARCHAR(100) NULL,
      userMessage VARCHAR(255) NULL,
      logFilePath VARCHAR(500) NULL,
      crashEventIp VARCHAR(45) NULL,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_crashId (crashId),
      FOREIGN KEY (crashId) REFERENCES g_crashes(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // Crash retention settings
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_crash_retention_settings (
      id CHAR(26) NOT NULL PRIMARY KEY COMMENT 'ULID',
      crashEventsRetentionDays INT DEFAULT 90,
      crashesRetentionDays INT DEFAULT 365,
      stackFilesRetentionDays INT DEFAULT 365,
      logFilesRetentionDays INT DEFAULT 30,
      updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      updatedBy CHAR(26) NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  console.log('[001] ✓ Initial crash tables created');
};

exports.down = async function (connection) {
  const tables = [
    'g_crash_retention_settings',
    'g_crash_events',
    'g_crashes',
  ];
  for (const t of tables) {
    await connection.execute(`DROP TABLE IF EXISTS ${t}`);
  }
  console.log('[001] ✓ Initial crash tables dropped');
};

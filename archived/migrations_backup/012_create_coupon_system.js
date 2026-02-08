/**
 * Migration: Create coupon system tables (g_ prefixed)
 *
 * Notes:
 * - Column names use camelCase per project convention
 * - Table names use g_ prefix and snake_case for consistency
 * - DATETIME is used (MySQL format). Do NOT store ISO 8601 strings directly
 */

exports.up = async function (connection) {
  console.log('Creating coupon system tables...');

  // 1) Coupon settings (definition)
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

  // 2) Targeting tables
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

  // 3) Issued codes (NORMAL only)
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

  // 4) Coupon uses (per-user limit support)
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_coupon_uses (
      id VARCHAR(26) PRIMARY KEY COMMENT 'ULID',
      settingId VARCHAR(26) NOT NULL,
      issuedCouponId VARCHAR(26) NULL,
      userId VARCHAR(64) NOT NULL,
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

  // 5) Coupon logs (audit)
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

  // 6) Batch jobs (NORMAL issuance)
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

  // 7) Reward templates
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_reward_templates (
      id VARCHAR(26) PRIMARY KEY COMMENT 'ULID',
      nameKey VARCHAR(128) NULL,
      descriptionKey VARCHAR(128) NULL,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

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

  console.log('Coupon system tables created.');
};

exports.down = async function (connection) {
  console.log('Dropping coupon system tables...');

  await connection.execute('DROP TABLE IF EXISTS g_reward_items');
  await connection.execute('DROP TABLE IF EXISTS g_reward_templates');
  await connection.execute('DROP TABLE IF EXISTS g_coupon_batch_jobs');
  await connection.execute('DROP TABLE IF EXISTS g_coupon_logs');
  await connection.execute('DROP TABLE IF EXISTS g_coupon_uses');
  await connection.execute('DROP TABLE IF EXISTS g_coupons');
  await connection.execute('DROP TABLE IF EXISTS g_coupon_target_subchannels');
  await connection.execute('DROP TABLE IF EXISTS g_coupon_target_channels');
  await connection.execute('DROP TABLE IF EXISTS g_coupon_target_platforms');
  await connection.execute('DROP TABLE IF EXISTS g_coupon_target_worlds');
  await connection.execute('DROP TABLE IF EXISTS g_coupon_settings');

  console.log('Coupon system tables dropped.');
};

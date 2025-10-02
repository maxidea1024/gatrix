/**
 * Create Crashes Tables Migration
 * Creates crashes and crash_instances tables for client crash tracking
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

  console.log('Creating crashes tables...');

  // Create crashes table
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS crashes (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      crash_id VARCHAR(255) NOT NULL UNIQUE COMMENT 'Unique crash identifier',
      user_id BIGINT UNSIGNED NULL COMMENT 'User ID if available',
      user_nickname VARCHAR(255) NULL COMMENT 'User nickname',
      platform ENUM('android', 'ios', 'windows', 'macos', 'linux') NOT NULL COMMENT 'Platform type',
      branch ENUM('release', 'patch', 'beta', 'alpha', 'dev') NOT NULL DEFAULT 'release' COMMENT 'Build branch',
      market_type ENUM('google_play', 'app_store', 'huawei', 'xiaomi', 'oppo', 'vivo', 'samsung', 'amazon', 'direct') NULL COMMENT 'Market type for Android',
      server_group VARCHAR(100) NULL COMMENT 'Server group/region',
      device_type VARCHAR(255) NULL COMMENT 'Device type/model',
      version VARCHAR(100) NOT NULL COMMENT 'App version',
      crash_type VARCHAR(100) NOT NULL COMMENT 'Type of crash',
      crash_message TEXT NULL COMMENT 'Crash message',
      stack_trace_file VARCHAR(500) NULL COMMENT 'Stack trace file path',
      logs_file VARCHAR(500) NULL COMMENT 'Logs file path',
      state TINYINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '0: OPEN, 1: CLOSED, 2: DELETED',
      first_occurred_at TIMESTAMP NOT NULL COMMENT 'First occurrence timestamp',
      last_occurred_at TIMESTAMP NOT NULL COMMENT 'Last occurrence timestamp',
      occurrence_count INT UNSIGNED NOT NULL DEFAULT 1 COMMENT 'Number of occurrences',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      
      INDEX idx_crashes_crash_id (crash_id),
      INDEX idx_crashes_user_id (user_id),
      INDEX idx_crashes_user_nickname (user_nickname),
      INDEX idx_crashes_platform (platform),
      INDEX idx_crashes_branch (branch),
      INDEX idx_crashes_market_type (market_type),
      INDEX idx_crashes_server_group (server_group),
      INDEX idx_crashes_device_type (device_type),
      INDEX idx_crashes_version (version),
      INDEX idx_crashes_crash_type (crash_type),
      INDEX idx_crashes_state (state),
      INDEX idx_crashes_first_occurred_at (first_occurred_at),
      INDEX idx_crashes_last_occurred_at (last_occurred_at),
      INDEX idx_crashes_created_at (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  console.log('✓ Created crashes table');

  // Create crash_instances table
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS crash_instances (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      cid BIGINT UNSIGNED NOT NULL COMMENT 'Reference to crashes.id',
      user_id BIGINT UNSIGNED NULL COMMENT 'User ID if available',
      user_nickname VARCHAR(255) NULL COMMENT 'User nickname',
      platform ENUM('android', 'ios', 'windows', 'macos', 'linux') NOT NULL COMMENT 'Platform type',
      branch ENUM('release', 'patch', 'beta', 'alpha', 'dev') NOT NULL DEFAULT 'release' COMMENT 'Build branch',
      market_type ENUM('google_play', 'app_store', 'huawei', 'xiaomi', 'oppo', 'vivo', 'samsung', 'amazon', 'direct') NULL COMMENT 'Market type for Android',
      server_group VARCHAR(100) NULL COMMENT 'Server group/region',
      device_type VARCHAR(255) NULL COMMENT 'Device type/model',
      version VARCHAR(100) NOT NULL COMMENT 'App version',
      crash_type VARCHAR(100) NOT NULL COMMENT 'Type of crash',
      crash_message TEXT NULL COMMENT 'Crash message',
      stack_trace_file VARCHAR(500) NULL COMMENT 'Stack trace file path',
      logs_file VARCHAR(500) NULL COMMENT 'Logs file path',
      occurred_at TIMESTAMP NOT NULL COMMENT 'When this instance occurred',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      
      FOREIGN KEY (cid) REFERENCES crashes(id) ON DELETE CASCADE,
      INDEX idx_crash_instances_cid (cid),
      INDEX idx_crash_instances_user_id (user_id),
      INDEX idx_crash_instances_user_nickname (user_nickname),
      INDEX idx_crash_instances_platform (platform),
      INDEX idx_crash_instances_branch (branch),
      INDEX idx_crash_instances_market_type (market_type),
      INDEX idx_crash_instances_server_group (server_group),
      INDEX idx_crash_instances_device_type (device_type),
      INDEX idx_crash_instances_version (version),
      INDEX idx_crash_instances_crash_type (crash_type),
      INDEX idx_crash_instances_occurred_at (occurred_at),
      INDEX idx_crash_instances_created_at (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  console.log('✓ Created crash_instances table');

  await connection.end();
  console.log('Crashes tables created successfully');
};

exports.down = async function() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'motif_dev',
    password: process.env.DB_PASSWORD || 'dev123$',
    database: process.env.DB_NAME || 'uwo_gate'
  });

  console.log('Rolling back crashes tables...');

  // Drop tables in reverse order (respecting foreign key constraints)
  await connection.execute('DROP TABLE IF EXISTS crash_instances');
  console.log('✓ Dropped crash_instances table');

  await connection.execute('DROP TABLE IF EXISTS crashes');
  console.log('✓ Dropped crashes table');

  await connection.end();
  console.log('Crashes tables rollback completed');
};

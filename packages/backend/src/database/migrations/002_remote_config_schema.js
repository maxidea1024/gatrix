/**
 * Remote Config System Database Schema
 * Creates all tables for Firebase Remote Config-like functionality
 * Features: Git-style versioning, A/B testing, Campaigns, Rules, Context fields
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

  console.log('Creating Remote Config database schema...');

  // 1. 메인 설정 테이블
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_remote_configs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      keyName VARCHAR(255) NOT NULL UNIQUE,
      defaultValue TEXT,
      valueType ENUM('string', 'number', 'boolean', 'json', 'yaml') NOT NULL DEFAULT 'string',
      description TEXT,
      isActive BOOLEAN NOT NULL DEFAULT TRUE,
      createdBy INT,
      updatedBy INT,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_keyName (keyName),
      INDEX idx_isActive (isActive),
      INDEX idx_createdBy (createdBy),
      INDEX idx_updatedBy (updatedBy),
      FOREIGN KEY (createdBy) REFERENCES g_users(id) ON DELETE SET NULL,
      FOREIGN KEY (updatedBy) REFERENCES g_users(id) ON DELETE SET NULL
    )
  `);

  // 2. 버전 관리 (Git-like staging)
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_remote_config_versions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      configId INT NOT NULL,
      versionNumber INT NOT NULL,
      value TEXT,
      status ENUM('draft', 'staged', 'published', 'archived') NOT NULL DEFAULT 'draft',
      changeDescription TEXT,
      publishedAt TIMESTAMP NULL,
      createdBy INT,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_config_status (configId, status),
      INDEX idx_version (configId, versionNumber),
      INDEX idx_publishedAt (publishedAt),
      INDEX idx_createdBy (createdBy),
      FOREIGN KEY (configId) REFERENCES g_remote_configs(id) ON DELETE CASCADE,
      FOREIGN KEY (createdBy) REFERENCES g_users(id) ON DELETE SET NULL
    )
  `);

  // 3. 컨텍스트 필드 정의
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_remote_config_context_fields (
      id INT AUTO_INCREMENT PRIMARY KEY,
      fieldName VARCHAR(255) NOT NULL UNIQUE,
      fieldType ENUM('string', 'number', 'boolean', 'array') NOT NULL,
      description TEXT,
      isRequired BOOLEAN NOT NULL DEFAULT FALSE,
      defaultValue TEXT,
      validationRules JSON,
      createdBy INT,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_fieldName (fieldName),
      INDEX idx_fieldType (fieldType),
      INDEX idx_isRequired (isRequired),
      INDEX idx_createdBy (createdBy),
      FOREIGN KEY (createdBy) REFERENCES g_users(id) ON DELETE SET NULL
    )
  `);

  // 4. 조건부 규칙
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_remote_config_rules (
      id INT AUTO_INCREMENT PRIMARY KEY,
      configId INT NOT NULL,
      ruleName VARCHAR(255) NOT NULL,
      conditions JSON NOT NULL,
      value TEXT,
      priority INT NOT NULL DEFAULT 0,
      isActive BOOLEAN NOT NULL DEFAULT TRUE,
      createdBy INT,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_config_priority (configId, priority DESC),
      INDEX idx_isActive (isActive),
      INDEX idx_createdBy (createdBy),
      FOREIGN KEY (configId) REFERENCES g_remote_configs(id) ON DELETE CASCADE,
      FOREIGN KEY (createdBy) REFERENCES g_users(id) ON DELETE SET NULL
    )
  `);

  // 5. A/B 테스트 변형
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_remote_config_variants (
      id INT AUTO_INCREMENT PRIMARY KEY,
      configId INT NOT NULL,
      variantName VARCHAR(255) NOT NULL,
      value TEXT,
      trafficPercentage DECIMAL(5,2) NOT NULL DEFAULT 0.00,
      conditions JSON,
      isActive BOOLEAN NOT NULL DEFAULT TRUE,
      createdBy INT,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_config_active (configId, isActive),
      INDEX idx_trafficPercentage (trafficPercentage),
      INDEX idx_createdBy (createdBy),
      FOREIGN KEY (configId) REFERENCES g_remote_configs(id) ON DELETE CASCADE,
      FOREIGN KEY (createdBy) REFERENCES g_users(id) ON DELETE SET NULL
    )
  `);

  // 6. 캠페인 관리
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_remote_config_campaigns (
      id INT AUTO_INCREMENT PRIMARY KEY,
      campaignName VARCHAR(255) NOT NULL,
      description TEXT,
      startDate TIMESTAMP NULL,
      endDate TIMESTAMP NULL,
      targetConditions JSON,
      isActive BOOLEAN NOT NULL DEFAULT TRUE,
      createdBy INT,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_dates (startDate, endDate),
      INDEX idx_isActive (isActive),
      INDEX idx_campaignName (campaignName),
      INDEX idx_createdBy (createdBy),
      FOREIGN KEY (createdBy) REFERENCES g_users(id) ON DELETE SET NULL
    )
  `);

  // 7. 캠페인-설정 연결
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_remote_config_campaign_configs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      campaignId INT NOT NULL,
      configId INT NOT NULL,
      campaignValue TEXT,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY unique_campaign_config (campaignId, configId),
      INDEX idx_campaignId (campaignId),
      INDEX idx_configId (configId),
      FOREIGN KEY (campaignId) REFERENCES g_remote_config_campaigns(id) ON DELETE CASCADE,
      FOREIGN KEY (configId) REFERENCES g_remote_configs(id) ON DELETE CASCADE
    )
  `);

  // 8. 배포 히스토리
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_remote_config_deployments (
      id INT AUTO_INCREMENT PRIMARY KEY,
      deploymentName VARCHAR(255),
      description TEXT,
      configsSnapshot JSON,
      deployedBy INT,
      deployedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      rollbackDeploymentId INT NULL,
      INDEX idx_deployedAt (deployedAt),
      INDEX idx_deployedBy (deployedBy),
      INDEX idx_rollbackDeploymentId (rollbackDeploymentId),
      FOREIGN KEY (deployedBy) REFERENCES g_users(id) ON DELETE SET NULL,
      FOREIGN KEY (rollbackDeploymentId) REFERENCES g_remote_config_deployments(id) ON DELETE SET NULL
    )
  `);

  // 9. Campaign Logs for tracking status changes
  await connection.execute(`
    CREATE TABLE g_remote_config_campaign_logs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      campaignId INT NOT NULL,
      action ENUM('activated', 'deactivated') NOT NULL,
      reason VARCHAR(255) NOT NULL COMMENT 'scheduler, manual, priority_conflict, etc.',
      timestamp TIMESTAMP NOT NULL,
      details TEXT NULL COMMENT 'Additional details in JSON format',
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

      INDEX idx_campaignId_timestamp (campaignId, timestamp),
      INDEX idx_action (action),
      INDEX idx_reason (reason),
      FOREIGN KEY (campaignId) REFERENCES g_remote_config_campaigns(id) ON DELETE CASCADE
    )
  `);

  console.log('✅ Remote Config database schema created successfully');
  await connection.end();
};

exports.down = async function() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'motif_dev',
    password: process.env.DB_PASSWORD || 'dev123$',
    database: process.env.DB_NAME || 'uwo_gate'
  });

  console.log('Rolling back Remote Config schema...');

  // Drop tables in reverse order (respecting foreign key constraints)
  const tables = [
    'g_remote_config_deployments',
    'g_remote_config_campaign_configs',
    'g_remote_config_campaigns',
    'g_remote_config_variants',
    'g_remote_config_rules',
    'g_remote_config_context_fields',
    'g_remote_config_versions',
    'g_remote_configs'
  ];

  for (const table of tables) {
    await connection.execute(`DROP TABLE IF EXISTS ${table}`);
    console.log(`✅ Dropped table: ${table}`);
  }

  console.log('✅ Remote Config schema rollback completed');
  await connection.end();
};

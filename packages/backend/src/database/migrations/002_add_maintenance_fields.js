/**
 * Migration: Add maintenance fields to client_versions and game_worlds
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

  console.log('Adding maintenance fields to client_versions and game_worlds...');

  // Add maintenance fields to g_client_versions table (if not exists)
  try {
    await connection.execute(`
      ALTER TABLE g_client_versions
      ADD COLUMN maintenanceStartDate DATETIME NULL COMMENT '점검 시작일시'
    `);
  } catch (e) { if (e.code !== 'ER_DUP_FIELDNAME') throw e; }

  try {
    await connection.execute(`
      ALTER TABLE g_client_versions
      ADD COLUMN maintenanceEndDate DATETIME NULL COMMENT '점검 종료일시'
    `);
  } catch (e) { if (e.code !== 'ER_DUP_FIELDNAME') throw e; }

  try {
    await connection.execute(`
      ALTER TABLE g_client_versions
      ADD COLUMN maintenanceMessage TEXT NULL COMMENT '기본 점검 메시지'
    `);
  } catch (e) { if (e.code !== 'ER_DUP_FIELDNAME') throw e; }

  try {
    await connection.execute(`
      ALTER TABLE g_client_versions
      ADD COLUMN supportsMultiLanguage BOOLEAN DEFAULT FALSE COMMENT '언어별 메시지 사용 여부'
    `);
  } catch (e) { if (e.code !== 'ER_DUP_FIELDNAME') throw e; }

  // Add maintenance fields to g_game_worlds table (if not exists)
  try {
    await connection.execute(`
      ALTER TABLE g_game_worlds
      ADD COLUMN maintenanceStartDate DATETIME NULL COMMENT '점검 시작일시'
    `);
  } catch (e) { if (e.code !== 'ER_DUP_FIELDNAME') throw e; }

  try {
    await connection.execute(`
      ALTER TABLE g_game_worlds
      ADD COLUMN maintenanceEndDate DATETIME NULL COMMENT '점검 종료일시'
    `);
  } catch (e) { if (e.code !== 'ER_DUP_FIELDNAME') throw e; }

  try {
    await connection.execute(`
      ALTER TABLE g_game_worlds
      ADD COLUMN maintenanceMessage TEXT NULL COMMENT '기본 점검 메시지'
    `);
  } catch (e) { if (e.code !== 'ER_DUP_FIELDNAME') throw e; }

  try {
    await connection.execute(`
      ALTER TABLE g_game_worlds
      ADD COLUMN supportsMultiLanguage BOOLEAN DEFAULT FALSE COMMENT '언어별 메시지 사용 여부'
    `);
  } catch (e) { if (e.code !== 'ER_DUP_FIELDNAME') throw e; }

  // Create table for client version maintenance locales
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_client_version_maintenance_locales (
      id INT AUTO_INCREMENT PRIMARY KEY,
      clientVersionId INT NOT NULL,
      lang VARCHAR(10) NOT NULL COMMENT '언어 코드 (ko, en, zh)',
      message TEXT NOT NULL COMMENT '언어별 점검 메시지',
      createdBy INT NOT NULL,
      updatedBy INT NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (clientVersionId) REFERENCES g_client_versions(id) ON DELETE CASCADE,
      FOREIGN KEY (createdBy) REFERENCES g_users(id) ON DELETE RESTRICT,
      FOREIGN KEY (updatedBy) REFERENCES g_users(id) ON DELETE SET NULL,
      INDEX idx_client_version (clientVersionId),
      INDEX idx_lang (lang),
      UNIQUE KEY unique_client_version_lang (clientVersionId, lang)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // Create table for game world maintenance locales
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_game_world_maintenance_locales (
      id INT AUTO_INCREMENT PRIMARY KEY,
      gameWorldId INT NOT NULL,
      lang VARCHAR(10) NOT NULL COMMENT '언어 코드 (ko, en, zh)',
      message TEXT NOT NULL COMMENT '언어별 점검 메시지',
      createdBy INT NOT NULL,
      updatedBy INT NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (gameWorldId) REFERENCES g_game_worlds(id) ON DELETE CASCADE,
      FOREIGN KEY (createdBy) REFERENCES g_users(id) ON DELETE RESTRICT,
      FOREIGN KEY (updatedBy) REFERENCES g_users(id) ON DELETE SET NULL,
      INDEX idx_game_world (gameWorldId),
      INDEX idx_lang (lang),
      UNIQUE KEY unique_game_world_lang (gameWorldId, lang)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await connection.end();
  console.log('Maintenance fields migration completed successfully!');
};

exports.down = async function() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'motif_dev',
    password: process.env.DB_PASSWORD || 'dev123$',
    database: process.env.DB_NAME || 'uwo_gate'
  });

  console.log('Rolling back maintenance fields migration...');

  // Drop maintenance locale tables
  await connection.execute('DROP TABLE IF EXISTS g_game_world_maintenance_locales');
  await connection.execute('DROP TABLE IF EXISTS g_client_version_maintenance_locales');

  // Remove maintenance fields from g_game_worlds table
  await connection.execute(`
    ALTER TABLE g_game_worlds
    DROP COLUMN IF EXISTS maintenanceStartDate,
    DROP COLUMN IF EXISTS maintenanceEndDate,
    DROP COLUMN IF EXISTS maintenanceMessage,
    DROP COLUMN IF EXISTS supportsMultiLanguage
  `);

  // Remove maintenance fields from g_client_versions table
  await connection.execute(`
    ALTER TABLE g_client_versions
    DROP COLUMN IF EXISTS maintenanceStartDate,
    DROP COLUMN IF EXISTS maintenanceEndDate,
    DROP COLUMN IF EXISTS maintenanceMessage,
    DROP COLUMN IF EXISTS supportsMultiLanguage
  `);

  await connection.end();
  console.log('Maintenance fields rollback completed successfully!');
};

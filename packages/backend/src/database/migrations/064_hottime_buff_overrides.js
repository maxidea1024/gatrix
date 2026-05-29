"use strict";

exports.name = "064_hottime_buff_overrides";

exports.up = async function (connection) {
  await connection.query(`
    CREATE TABLE IF NOT EXISTS g_hottime_buff_overrides (
      id VARCHAR(36) NOT NULL PRIMARY KEY,
      environmentId VARCHAR(100) NOT NULL,
      cmsId INT NOT NULL COMMENT 'HotTimeBuff CMS ID (schedule-level control)',
      enabled TINYINT(1) NOT NULL DEFAULT 1 COMMENT 'Enable/disable (all worldBuffs in this entry on/off)',
      startDateOverride VARCHAR(30) DEFAULT NULL COMMENT 'Start date override (null = use CMS default)',
      endDateOverride VARCHAR(30) DEFAULT NULL COMMENT 'End date override (null = use CMS default)',
      startHourOverride TINYINT DEFAULT NULL COMMENT 'Start hour override (null = use CMS default)',
      endHourOverride TINYINT DEFAULT NULL COMMENT 'End hour override (null = use CMS default)',
      minLvOverride SMALLINT DEFAULT NULL COMMENT 'Min level override (null = use CMS default)',
      maxLvOverride SMALLINT DEFAULT NULL COMMENT 'Max level override (null = use CMS default)',
      bitFlagDayOfWeekOverride SMALLINT DEFAULT NULL COMMENT 'Day-of-week bitflag override (null = use CMS default)',
      worldBuffIdOverride JSON DEFAULT NULL COMMENT 'World buff ID subset override as JSON array (null = use all CMS buffs)',
      updatedBy VARCHAR(100) DEFAULT NULL COMMENT 'Operator who made the change',
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uk_env_cmsid (environmentId, cmsId),
      INDEX idx_environment (environmentId),
      INDEX idx_enabled (environmentId, enabled)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // Add column for existing tables
  const [cols] = await connection.query(
    "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'g_hottime_buff_overrides' AND COLUMN_NAME = 'worldBuffIdOverride'"
  );
  if (!cols || cols.length === 0) {
    await connection.query(
      "ALTER TABLE g_hottime_buff_overrides ADD COLUMN worldBuffIdOverride JSON DEFAULT NULL COMMENT 'World buff ID subset override as JSON array' AFTER bitFlagDayOfWeekOverride"
    );
  }
};

exports.down = async function (connection) {
  await connection.query(`DROP TABLE IF EXISTS g_hottime_buff_overrides;`);
};

"use strict";

exports.name = "065_hottime_buff_overrides_worldid";

exports.up = async function (connection) {
  const [[{ db: currentDb }]] = await connection.query("SELECT DATABASE() AS db");

  // 1. Drop old worldId-related columns if they exist (from previous version)
  const [genCols] = await connection.query(
    "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'g_hottime_buff_overrides' AND COLUMN_NAME = 'worldIdKey'",
    [currentDb]
  );
  if (genCols && genCols.length > 0) {
    // Must drop unique key first if it references worldIdKey
    const [idx] = await connection.query(
      "SHOW INDEX FROM g_hottime_buff_overrides WHERE Key_name = 'uk_env_cms_world'"
    );
    if (idx && idx.length > 0) {
      await connection.query("ALTER TABLE g_hottime_buff_overrides DROP INDEX uk_env_cms_world");
    }
    await connection.query("ALTER TABLE g_hottime_buff_overrides DROP COLUMN worldIdKey");
  }

  const [oldWorldIdCol] = await connection.query(
    "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'g_hottime_buff_overrides' AND COLUMN_NAME = 'worldId'",
    [currentDb]
  );
  if (oldWorldIdCol && oldWorldIdCol.length > 0) {
    await connection.query("ALTER TABLE g_hottime_buff_overrides DROP COLUMN worldId");
  }

  // 2. Add worldIds column (JSON array of target world IDs; NULL = global/all worlds)
  const [cols] = await connection.query(
    "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'g_hottime_buff_overrides' AND COLUMN_NAME = 'worldIds'",
    [currentDb]
  );
  if (!cols || cols.length === 0) {
    await connection.query(
      "ALTER TABLE g_hottime_buff_overrides ADD COLUMN worldIds TEXT DEFAULT NULL COMMENT 'JSON array of target worldIds (NULL = all worlds / global)' AFTER environmentId"
    );
  }

  // 2b. Ensure worldBuffIdOverride column exists (may be missing if 064 partially ran)
  const [wbiCols] = await connection.query(
    "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'g_hottime_buff_overrides' AND COLUMN_NAME = 'worldBuffIdOverride'",
    [currentDb]
  );
  if (!wbiCols || wbiCols.length === 0) {
    await connection.query(
      "ALTER TABLE g_hottime_buff_overrides ADD COLUMN worldBuffIdOverride JSON DEFAULT NULL COMMENT 'World buff ID subset override as JSON array' AFTER bitFlagDayOfWeekOverride"
    );
  }

  // 3. Ensure unique key on (environmentId, cmsId) — one override row per cmsId
  // Drop compound key if it exists
  const [compoundIdx] = await connection.query(
    "SHOW INDEX FROM g_hottime_buff_overrides WHERE Key_name = 'uk_env_cms_world'"
  );
  if (compoundIdx && compoundIdx.length > 0) {
    await connection.query("ALTER TABLE g_hottime_buff_overrides DROP INDEX uk_env_cms_world");
  }

  // Create/restore simple unique key
  const [simpleIdx] = await connection.query(
    "SHOW INDEX FROM g_hottime_buff_overrides WHERE Key_name = 'uk_env_cmsid'"
  );
  if (!simpleIdx || simpleIdx.length === 0) {
    await connection.query(
      "ALTER TABLE g_hottime_buff_overrides ADD UNIQUE KEY uk_env_cmsid (environmentId, cmsId)"
    );
  }
};

exports.down = async function (connection) {
  const [[{ db: currentDb }]] = await connection.query("SELECT DATABASE() AS db");

  // Drop worldIds column
  const [cols] = await connection.query(
    "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'g_hottime_buff_overrides' AND COLUMN_NAME = 'worldIds'",
    [currentDb]
  );
  if (cols && cols.length > 0) {
    await connection.query("ALTER TABLE g_hottime_buff_overrides DROP COLUMN worldIds");
  }
};

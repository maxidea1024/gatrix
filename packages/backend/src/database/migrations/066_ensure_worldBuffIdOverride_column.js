"use strict";

exports.name = "066_ensure_worldBuffIdOverride_column";

exports.up = async function (connection) {
  const [[{ db: currentDb }]] = await connection.query("SELECT DATABASE() AS db");

  // Ensure worldBuffIdOverride column exists
  // (may be missing if 064 ran on a pre-existing table without TABLE_SCHEMA filtering)
  const [cols] = await connection.query(
    "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'g_hottime_buff_overrides' AND COLUMN_NAME = 'worldBuffIdOverride'",
    [currentDb]
  );
  if (!cols || cols.length === 0) {
    await connection.query(
      "ALTER TABLE g_hottime_buff_overrides ADD COLUMN worldBuffIdOverride JSON DEFAULT NULL COMMENT 'World buff ID subset override as JSON array' AFTER bitFlagDayOfWeekOverride"
    );
  }

  // Also ensure worldIds column exists (in case 065 partially ran)
  const [wCols] = await connection.query(
    "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'g_hottime_buff_overrides' AND COLUMN_NAME = 'worldIds'",
    [currentDb]
  );
  if (!wCols || wCols.length === 0) {
    await connection.query(
      "ALTER TABLE g_hottime_buff_overrides ADD COLUMN worldIds TEXT DEFAULT NULL COMMENT 'JSON array of target worldIds (NULL = all worlds / global)' AFTER environmentId"
    );
  }
};

exports.down = async function (connection) {
  // No-op — these columns should persist
};

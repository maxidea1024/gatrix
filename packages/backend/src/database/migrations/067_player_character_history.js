// Migration: Create g_player_history and g_character_history tables
// These tables were missing, causing 500 errors on deployed servers
// while working locally (where tables were created manually).
exports.name = '067_player_character_history';

exports.up = async function (connection) {
  // ── g_player_history ──────────────────────────────────────────────
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_player_history (
      id VARCHAR(26) NOT NULL PRIMARY KEY,
      environmentId VARCHAR(26) NOT NULL,
      totalPlayers INT NOT NULL DEFAULT 0,
      newPlayers INT NOT NULL DEFAULT 0,
      totalCharacters INT NOT NULL DEFAULT 0,
      newCharacters INT NOT NULL DEFAULT 0,
      recordedAt DATETIME NOT NULL,
      INDEX idx_player_hist_env_recorded (environmentId, recordedAt)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  console.log('[067] g_player_history table ensured');

  // ── g_character_history ───────────────────────────────────────────
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_character_history (
      id VARCHAR(26) NOT NULL PRIMARY KEY,
      environmentId VARCHAR(26) NOT NULL,
      worldId VARCHAR(100) NULL COMMENT 'null = total across all worlds',
      worldName VARCHAR(255) NULL,
      totalCharacters INT NOT NULL DEFAULT 0,
      newCharacters INT NOT NULL DEFAULT 0,
      recordedAt DATETIME NOT NULL,
      INDEX idx_char_hist_env_recorded (environmentId, recordedAt),
      INDEX idx_char_hist_env_world_recorded (environmentId, worldId, recordedAt)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  console.log('[067] g_character_history table ensured');
};

exports.down = async function (connection) {
  await connection.execute(`DROP TABLE IF EXISTS g_character_history`);
  console.log('[067] g_character_history table dropped');

  await connection.execute(`DROP TABLE IF EXISTS g_player_history`);
  console.log('[067] g_player_history table dropped');
};

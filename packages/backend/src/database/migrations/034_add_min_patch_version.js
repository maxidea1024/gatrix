/**
 * Migration: Add minPatchVersion column to g_client_versions table
 */
exports.up = async function (connection) {
  console.log('[034] Adding minPatchVersion column to g_client_versions...');

  await connection.execute(`
    ALTER TABLE g_client_versions
    ADD COLUMN minPatchVersion VARCHAR(50) NULL DEFAULT NULL
    COMMENT 'Minimum patch version required. If set, clients with lower patch version will receive FORCED_UPDATE status.'
  `);

  console.log('[034] ??minPatchVersion column added');
};

exports.down = async function (connection) {
  await connection.execute(`
    ALTER TABLE g_client_versions
    DROP COLUMN minPatchVersion
  `);
};

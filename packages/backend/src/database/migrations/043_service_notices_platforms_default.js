/**
 * 043 - Add default value for platforms column in g_service_notices
 *
 * The platforms column is NOT NULL but has no default value, causing CR execution
 * to fail with "Field 'platforms' doesn't have a default value" when creating
 * service notices through the Change Request system.
 */

exports.up = async function (connection) {
  console.log('[043] Adding default value for platforms column in g_service_notices...');
  await connection.execute(`
    ALTER TABLE g_service_notices
    MODIFY COLUMN platforms JSON NOT NULL DEFAULT ('[]')
  `);
  console.log('[043] ??platforms column now defaults to empty JSON array');
};

exports.down = async function (connection) {
  await connection.execute(`
    ALTER TABLE g_service_notices
    MODIFY COLUMN platforms JSON NOT NULL
  `);
};

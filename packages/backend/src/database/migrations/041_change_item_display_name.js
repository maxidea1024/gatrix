/**
 * 041 - Add displayName and beforeDraftData columns to g_change_items
 *
 * displayName: Human-readable label for the changed entity (resolved via EntityLabelResolver).
 * beforeDraftData: Previous snapshot for complex entities (feature flags, segments) to enable diff comparison.
 */

exports.up = async function (connection) {
  console.log('[041] Adding displayName column to g_change_items...');
  await connection.execute(`
    ALTER TABLE g_change_items
    ADD COLUMN displayName VARCHAR(255) NULL COMMENT 'Human-readable entity label' AFTER targetId
  `);

  console.log('[041] Adding beforeDraftData column to g_change_items...');
  await connection.execute(`
    ALTER TABLE g_change_items
    ADD COLUMN beforeDraftData JSON NULL COMMENT 'Previous snapshot for diff comparison' AFTER draftData
  `);

  console.log('[041] ??displayName and beforeDraftData columns added');
};

exports.down = async function (connection) {
  await connection.execute(`
    ALTER TABLE g_change_items
    DROP COLUMN IF EXISTS beforeDraftData,
    DROP COLUMN IF EXISTS displayName
  `);
};

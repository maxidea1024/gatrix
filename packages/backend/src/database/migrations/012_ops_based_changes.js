/**
 * Migration: Convert to Op-based Change Items
 *
 * This migration:
 * 1. Replaces beforeData/afterData with ops (JSON array of field-level operations)
 * 2. Each op: { path: string, oldValue: any, newValue: any, opType: 'SET'|'DEL'|'MOD' }
 */

exports.up = async function (connection) {
  console.log('Converting to Op-based Change Items...');

  // Drop existing data (as per user request - full reset)
  await connection.execute(`DELETE FROM g_change_items`);
  await connection.execute(`DELETE FROM g_action_groups`);
  await connection.execute(`DELETE FROM g_approvals`);
  await connection.execute(`DELETE FROM g_outbox_events`);
  await connection.execute(`DELETE FROM g_entity_locks`);
  await connection.execute(`DELETE FROM g_change_requests`);
  console.log('  ✓ Cleared existing CR data');

  // Modify g_change_items: remove beforeData/afterData, add ops
  // Check if ops column already exists
  const [opsColExists] = await connection.execute(`
        SHOW COLUMNS FROM g_change_items LIKE 'ops'
    `);

  if (opsColExists.length === 0) {
    // Drop old columns
    try {
      await connection.execute(`
                ALTER TABLE g_change_items
                DROP COLUMN beforeData,
                DROP COLUMN afterData
            `);
      console.log('  ✓ Dropped beforeData/afterData columns');
    } catch (e) {
      console.log('  ⏭ beforeData/afterData columns already removed or do not exist');
    }

    // Add ops column
    await connection.execute(`
            ALTER TABLE g_change_items
            ADD COLUMN ops JSON NOT NULL COMMENT 'Array of field-level operations: [{path, oldValue, newValue, opType}]'
        `);
    console.log('  ✓ Added ops column to g_change_items');

    // Add opType column to store the overall entity operation type
    await connection.execute(`
            ALTER TABLE g_change_items
            ADD COLUMN opType ENUM('CREATE', 'UPDATE', 'DELETE') NOT NULL DEFAULT 'UPDATE' COMMENT 'Entity-level operation type'
        `);
    console.log('  ✓ Added opType column to g_change_items');
  } else {
    console.log('  ⏭ ops column already exists in g_change_items');
  }

  console.log('✓ Op-based Change Items migration completed!');
};

exports.down = async function (connection) {
  console.log('Rolling back Op-based Change Items migration...');

  // Remove ops column, restore beforeData/afterData
  try {
    await connection.execute(`
            ALTER TABLE g_change_items
            DROP COLUMN ops,
            DROP COLUMN opType
        `);
  } catch (e) {
    /* ignore */
  }

  try {
    await connection.execute(`
            ALTER TABLE g_change_items
            ADD COLUMN beforeData JSON NULL,
            ADD COLUMN afterData JSON NULL
        `);
  } catch (e) {
    /* ignore */
  }

  console.log('✓ Rollback completed');
};

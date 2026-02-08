/**
 * Migration: Fix g_tag_assignments entityId column type
 *
 * Changes entityId from INT to VARCHAR(26) to support ULID-based entity IDs
 * This fixes the issue where all reward templates were sharing the same tag assignments
 * because ULID strings were being converted to INT (resulting in 0 or 1)
 */

exports.up = async function (connection) {
  console.log('Fixing g_tag_assignments entityId column type...');

  try {
    // First, drop the foreign key constraint
    await connection.execute(`
      ALTER TABLE g_tag_assignments
      DROP CONSTRAINT fk_tag_assignments_tag
    `);
    console.log('✓ Dropped foreign key constraint');

    // Drop the unique constraint that includes entityId
    await connection.execute(`
      ALTER TABLE g_tag_assignments
      DROP INDEX unique_assignment
    `);
    console.log('✓ Dropped unique_assignment constraint');

    // Change entityId column type from INT to VARCHAR(26)
    await connection.execute(`
      ALTER TABLE g_tag_assignments
      MODIFY COLUMN entityId VARCHAR(26) NOT NULL COMMENT 'Entity ID (supports both INT and ULID)'
    `);
    console.log('✓ Changed entityId column type to VARCHAR(26)');

    // Recreate the unique constraint
    await connection.execute(`
      ALTER TABLE g_tag_assignments
      ADD CONSTRAINT unique_assignment UNIQUE KEY (tagId, entityType, entityId)
    `);
    console.log('✓ Recreated unique_assignment constraint');

    // Recreate the foreign key constraint
    await connection.execute(`
      ALTER TABLE g_tag_assignments
      ADD CONSTRAINT fk_tag_assignments_tag FOREIGN KEY (tagId) REFERENCES g_tags(id) ON DELETE CASCADE
    `);
    console.log('✓ Recreated foreign key constraint');

    console.log('✅ Successfully fixed g_tag_assignments entityId column type');
  } catch (error) {
    console.error('Error during migration:', error);
    throw error;
  }
};

exports.down = async function (connection) {
  console.log('Rolling back g_tag_assignments entityId column type fix...');

  try {
    // Drop the foreign key constraint
    await connection.execute(`
      ALTER TABLE g_tag_assignments
      DROP CONSTRAINT fk_tag_assignments_tag
    `);
    console.log('✓ Dropped foreign key constraint');

    // Drop the unique constraint
    await connection.execute(`
      ALTER TABLE g_tag_assignments
      DROP INDEX unique_assignment
    `);
    console.log('✓ Dropped unique_assignment constraint');

    // Change entityId column type back to INT
    await connection.execute(`
      ALTER TABLE g_tag_assignments
      MODIFY COLUMN entityId INT NOT NULL COMMENT 'Entity ID'
    `);
    console.log('✓ Changed entityId column type back to INT');

    // Recreate the unique constraint
    await connection.execute(`
      ALTER TABLE g_tag_assignments
      ADD CONSTRAINT unique_assignment UNIQUE KEY (tagId, entityType, entityId)
    `);
    console.log('✓ Recreated unique_assignment constraint');

    // Recreate the foreign key constraint
    await connection.execute(`
      ALTER TABLE g_tag_assignments
      ADD CONSTRAINT fk_tag_assignments_tag FOREIGN KEY (tagId) REFERENCES g_tags(id) ON DELETE CASCADE
    `);
    console.log('✓ Recreated foreign key constraint');

    console.log('✅ Successfully rolled back g_tag_assignments entityId column type');
  } catch (error) {
    console.error('Error during rollback:', error);
    throw error;
  }
};

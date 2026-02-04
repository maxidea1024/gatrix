/**
 * Cleanup context field type: 
 * 1. Convert any 'datetime' values back to 'date'
 * 2. Remove 'datetime' from fieldType ENUM in g_feature_context_fields
 */

exports.up = async function (connection) {
    console.log('Cleaning up context field types...');

    // 1. Convert any 'datetime' back to 'date'
    await connection.execute(`
    UPDATE g_feature_context_fields 
    SET fieldType = 'date' 
    WHERE fieldType = 'datetime'
  `);
    console.log('✓ Converted any datetime values back to date');

    // 2. Modify ENUM to remove 'datetime'
    await connection.execute(`
    ALTER TABLE g_feature_context_fields 
    MODIFY COLUMN fieldType ENUM('string', 'number', 'boolean', 'date', 'semver') NOT NULL 
    COMMENT 'Field data type'
  `);
    console.log('✓ Removed datetime from fieldType ENUM');

    console.log('Migration completed successfully!');
};

exports.down = async function (connection) {
    // Re-add 'datetime' for rollback purposes if needed
    await connection.execute(`
    ALTER TABLE g_feature_context_fields 
    MODIFY COLUMN fieldType ENUM('string', 'number', 'boolean', 'date', 'datetime', 'semver') NOT NULL 
    COMMENT 'Field data type'
  `);
};

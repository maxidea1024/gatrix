/**
 * Add 'datetime' to fieldType ENUM in g_feature_context_fields table
 * Also update existing 'date' values to 'datetime' for consistency
 */

exports.up = async function (connection) {
    console.log('Adding datetime to fieldType ENUM...');

    // Modify the ENUM to include 'datetime' 
    await connection.execute(`
    ALTER TABLE g_feature_context_fields 
    MODIFY COLUMN fieldType ENUM('string', 'number', 'boolean', 'date', 'datetime', 'semver') NOT NULL 
    COMMENT 'Field data type'
  `);
    console.log('✓ Added datetime to fieldType ENUM');

    // Update existing 'date' values to 'datetime' for consistency
    await connection.execute(`
    UPDATE g_feature_context_fields 
    SET fieldType = 'datetime' 
    WHERE fieldType = 'date'
  `);
    console.log('✓ Updated existing date fields to datetime');

    console.log('Migration completed successfully!');
};

exports.down = async function (connection) {
    console.log('Reverting datetime ENUM change...');

    // Update 'datetime' back to 'date'
    await connection.execute(`
    UPDATE g_feature_context_fields 
    SET fieldType = 'date' 
    WHERE fieldType = 'datetime'
  `);

    // Remove 'datetime' from ENUM
    await connection.execute(`
    ALTER TABLE g_feature_context_fields 
    MODIFY COLUMN fieldType ENUM('string', 'number', 'boolean', 'date', 'semver') NOT NULL 
    COMMENT 'Field data type'
  `);

    console.log('Reverted datetime ENUM change');
};

/**
 * Add 'none' option to variantType enum in g_feature_flags table
 * This allows flags without payload (simple boolean flags)
 */

exports.up = async function (connection) {
    console.log('Adding none option to variantType enum...');

    await connection.execute(`
    ALTER TABLE g_feature_flags
    MODIFY COLUMN variantType ENUM('none', 'string', 'number', 'json') NULL DEFAULT NULL
    COMMENT 'Type of variant payload data (none = no payload)'
  `);

    console.log('✓ none option added to variantType enum');
};

exports.down = async function (connection) {
    console.log('Removing none option from variantType enum...');

    // First update any 'none' values to NULL
    await connection.execute(`
    UPDATE g_feature_flags SET variantType = NULL WHERE variantType = 'none'
  `);

    await connection.execute(`
    ALTER TABLE g_feature_flags
    MODIFY COLUMN variantType ENUM('string', 'number', 'json') NOT NULL DEFAULT 'string'
    COMMENT 'Type of variant payload data'
  `);

    console.log('✓ none option removed from variantType enum');
};

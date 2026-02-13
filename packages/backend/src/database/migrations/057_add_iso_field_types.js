/**
 * Add countryCode3, languageCode, localeCode, timezone to fieldType ENUM
 * in g_feature_context_fields table.
 */

exports.up = async function (connection) {
    console.log('Adding countryCode3, languageCode, localeCode, timezone to fieldType ENUM...');

    await connection.execute(`
    ALTER TABLE g_feature_context_fields
    MODIFY COLUMN fieldType ENUM('string', 'number', 'boolean', 'date', 'semver', 'array', 'country', 'countryCode3', 'languageCode', 'localeCode', 'timezone') NOT NULL
    COMMENT 'Field data type'
  `);

    console.log('✓ Added countryCode3, languageCode, localeCode, timezone to fieldType ENUM');
};

exports.down = async function (connection) {
    console.log('Reverting: removing countryCode3, languageCode, localeCode, timezone from fieldType ENUM...');

    // Convert new types back to string
    await connection.execute(`
    UPDATE g_feature_context_fields
    SET fieldType = 'string'
    WHERE fieldType IN ('countryCode3', 'languageCode', 'localeCode', 'timezone')
  `);

    await connection.execute(`
    ALTER TABLE g_feature_context_fields
    MODIFY COLUMN fieldType ENUM('string', 'number', 'boolean', 'date', 'semver', 'array', 'country') NOT NULL
    COMMENT 'Field data type'
  `);

    console.log('✓ Reverted fieldType ENUM');
};

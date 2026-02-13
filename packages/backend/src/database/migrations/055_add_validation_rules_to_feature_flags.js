/**
 * Add validationRules JSON column to g_feature_flags table
 * Stores per-type validation rules (string: minLength/maxLength/pattern/legalValues/trimWhitespace,
 * number: min/max/integerOnly, json: jsonSchema, common: allowEmpty)
 */

exports.up = async function (connection) {
    console.log('Adding validationRules column to g_feature_flags table...');

    await connection.execute(`
    ALTER TABLE g_feature_flags
    ADD COLUMN validationRules JSON NULL COMMENT 'Validation rules for flag values (type-specific)'
  `);

    console.log('✓ validationRules column added to g_feature_flags table');
};

exports.down = async function (connection) {
    console.log('Removing validationRules column from g_feature_flags table...');

    await connection.execute(`
    ALTER TABLE g_feature_flags
    DROP COLUMN validationRules
  `);

    console.log('✓ validationRules column removed from g_feature_flags table');
};

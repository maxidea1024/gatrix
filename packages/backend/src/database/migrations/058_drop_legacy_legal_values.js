/**
 * Drop the legacy legalValues column from g_feature_context_fields.
 * Legal values are now stored exclusively in validationRules JSON field.
 */
exports.up = async function (connection) {
    // Check if legalValues column exists before dropping
    const [columns] = await connection.execute(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME = 'g_feature_context_fields'
     AND COLUMN_NAME = 'legalValues'`
    );

    if (columns.length > 0) {
        await connection.execute(`
      ALTER TABLE g_feature_context_fields
      DROP COLUMN legalValues
    `);
        console.log('✓ Dropped legacy legalValues column from g_feature_context_fields');
    } else {
        console.log('⚠ legalValues column does not exist, skipping');
    }
};

exports.down = async function (connection) {
    await connection.execute(`
    ALTER TABLE g_feature_context_fields
    ADD COLUMN legalValues JSON NULL COMMENT 'Legacy: Allowed values (moved to validationRules)'
    AFTER description
  `);
    console.log('✓ Re-added legalValues column to g_feature_context_fields');
};

/**
 * Add validationRules JSON column to g_feature_context_fields table.
 * Migrate existing legalValues data into validationRules.legalValues.
 */

exports.up = async function (connection) {
    console.log('Adding validationRules column to g_feature_context_fields...');

    await connection.execute(`
    ALTER TABLE g_feature_context_fields
    ADD COLUMN validationRules JSON NULL COMMENT 'Validation rules for context field values'
    AFTER legalValues
  `);

    // Migrate existing legalValues into validationRules
    const [rows] = await connection.execute(
        `SELECT id, legalValues FROM g_feature_context_fields WHERE legalValues IS NOT NULL AND legalValues != '[]' AND legalValues != 'null'`
    );

    for (const row of rows) {
        try {
            const legalValues = JSON.parse(row.legalValues);
            if (Array.isArray(legalValues) && legalValues.length > 0) {
                const validationRules = JSON.stringify({ legalValues });
                await connection.execute(
                    `UPDATE g_feature_context_fields SET validationRules = ? WHERE id = ?`,
                    [validationRules, row.id]
                );
            }
        } catch (e) {
            console.warn(`Skipping migration for context field id=${row.id}: invalid legalValues JSON`);
        }
    }

    console.log(`✓ validationRules column added and ${rows.length} existing legalValues migrated`);
};

exports.down = async function (connection) {
    console.log('Removing validationRules column from g_feature_context_fields...');

    await connection.execute(`
    ALTER TABLE g_feature_context_fields
    DROP COLUMN validationRules
  `);

    console.log('✓ validationRules column removed from g_feature_context_fields');
};

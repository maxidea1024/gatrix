/**
 * Migration: Rename allowEmpty to isRequired in validationRules JSON
 * - In g_feature_flags: validationRules column
 * - In g_feature_context_fields: validationRules column
 * Semantics are inverted: allowEmpty:false → isRequired:true
 */

exports.up = async function (connection) {
    // Update feature flags
    const [flags] = await connection.execute(
        `SELECT id, validationRules FROM g_feature_flags WHERE validationRules IS NOT NULL`
    );

    for (const flag of flags) {
        try {
            const rules = typeof flag.validationRules === 'string'
                ? JSON.parse(flag.validationRules)
                : flag.validationRules;

            if (rules && 'allowEmpty' in rules) {
                if (rules.allowEmpty === false) {
                    rules.isRequired = true;
                }
                delete rules.allowEmpty;

                await connection.execute(
                    `UPDATE g_feature_flags SET validationRules = ? WHERE id = ?`,
                    [JSON.stringify(rules), flag.id]
                );
            }
        } catch (e) {
            console.warn(`Failed to migrate validationRules for flag id=${flag.id}:`, e.message);
        }
    }

    // Update context fields
    const [fields] = await connection.execute(
        `SELECT id, validationRules FROM g_feature_context_fields WHERE validationRules IS NOT NULL`
    );

    for (const field of fields) {
        try {
            const rules = typeof field.validationRules === 'string'
                ? JSON.parse(field.validationRules)
                : field.validationRules;

            if (rules && 'allowEmpty' in rules) {
                if (rules.allowEmpty === false) {
                    rules.isRequired = true;
                }
                delete rules.allowEmpty;

                await connection.execute(
                    `UPDATE g_feature_context_fields SET validationRules = ? WHERE id = ?`,
                    [JSON.stringify(rules), field.id]
                );
            }
        } catch (e) {
            console.warn(`Failed to migrate validationRules for context field id=${field.id}:`, e.message);
        }
    }

    console.log('✓ Renamed allowEmpty to isRequired in validationRules');
};

exports.down = async function (connection) {
    // Revert: isRequired:true → allowEmpty:false
    const [flags] = await connection.execute(
        `SELECT id, validationRules FROM g_feature_flags WHERE validationRules IS NOT NULL`
    );

    for (const flag of flags) {
        try {
            const rules = typeof flag.validationRules === 'string'
                ? JSON.parse(flag.validationRules)
                : flag.validationRules;

            if (rules && 'isRequired' in rules) {
                if (rules.isRequired === true) {
                    rules.allowEmpty = false;
                }
                delete rules.isRequired;

                await connection.execute(
                    `UPDATE g_feature_flags SET validationRules = ? WHERE id = ?`,
                    [JSON.stringify(rules), flag.id]
                );
            }
        } catch (e) {
            console.warn(`Failed to revert validationRules for flag id=${flag.id}:`, e.message);
        }
    }

    const [fields] = await connection.execute(
        `SELECT id, validationRules FROM g_feature_context_fields WHERE validationRules IS NOT NULL`
    );

    for (const field of fields) {
        try {
            const rules = typeof field.validationRules === 'string'
                ? JSON.parse(field.validationRules)
                : field.validationRules;

            if (rules && 'isRequired' in rules) {
                if (rules.isRequired === true) {
                    rules.allowEmpty = false;
                }
                delete rules.isRequired;

                await connection.execute(
                    `UPDATE g_feature_context_fields SET validationRules = ? WHERE id = ?`,
                    [JSON.stringify(rules), field.id]
                );
            }
        } catch (e) {
            console.warn(`Failed to revert validationRules for context field id=${field.id}:`, e.message);
        }
    }

    console.log('✓ Reverted isRequired back to allowEmpty in validationRules');
};

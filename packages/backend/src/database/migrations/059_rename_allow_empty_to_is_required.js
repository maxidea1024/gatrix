/**
 * Migration: Rename allowEmpty to isRequired in validationRules JSON
 * - In g_feature_flags: validationRules column
 * - In g_feature_context_fields: validationRules column
 * Semantics are inverted: allowEmpty:false → isRequired:true
 */

exports.up = async function (knex) {
    // Update feature flags
    const flags = await knex('g_feature_flags')
        .whereNotNull('validationRules')
        .select('id', 'validationRules');

    for (const flag of flags) {
        try {
            const rules = typeof flag.validationRules === 'string'
                ? JSON.parse(flag.validationRules)
                : flag.validationRules;

            if (rules && 'allowEmpty' in rules) {
                // Invert: allowEmpty:false → isRequired:true, allowEmpty:true → isRequired:false (or remove)
                if (rules.allowEmpty === false) {
                    rules.isRequired = true;
                }
                delete rules.allowEmpty;

                await knex('g_feature_flags')
                    .where('id', flag.id)
                    .update({ validationRules: JSON.stringify(rules) });
            }
        } catch (e) {
            console.warn(`Failed to migrate validationRules for flag id=${flag.id}:`, e.message);
        }
    }

    // Update context fields
    const fields = await knex('g_feature_context_fields')
        .whereNotNull('validationRules')
        .select('id', 'validationRules');

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

                await knex('g_feature_context_fields')
                    .where('id', field.id)
                    .update({ validationRules: JSON.stringify(rules) });
            }
        } catch (e) {
            console.warn(`Failed to migrate validationRules for context field id=${field.id}:`, e.message);
        }
    }
};

exports.down = async function (knex) {
    // Revert: isRequired:true → allowEmpty:false
    const flags = await knex('g_feature_flags')
        .whereNotNull('validationRules')
        .select('id', 'validationRules');

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

                await knex('g_feature_flags')
                    .where('id', flag.id)
                    .update({ validationRules: JSON.stringify(rules) });
            }
        } catch (e) {
            console.warn(`Failed to revert validationRules for flag id=${flag.id}:`, e.message);
        }
    }

    const fields = await knex('g_feature_context_fields')
        .whereNotNull('validationRules')
        .select('id', 'validationRules');

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

                await knex('g_feature_context_fields')
                    .where('id', field.id)
                    .update({ validationRules: JSON.stringify(rules) });
            }
        } catch (e) {
            console.warn(`Failed to revert validationRules for context field id=${field.id}:`, e.message);
        }
    }
};

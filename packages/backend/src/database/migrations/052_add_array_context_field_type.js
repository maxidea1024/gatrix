/**
 * Migration: Add array/country to context field types, migrate NOT operators
 *
 * 1. Add 'array' and 'country' to fieldType ENUM in g_feature_context_fields
 * 2. Migrate NOT operators (str_neq, str_not_in, num_not_in, semver_not_in)
 *    to positive operators + inverted flag in g_feature_strategy_constraints
 * 3. Add new operators (exists, not_exists, date_eq, arr_includes, arr_all, arr_empty)
 *    to operator validation (if ENUM-based)
 */
exports.up = async function (connection) {
    console.log('Adding array/country field types and migrating NOT operators...');

    // Step 1: Add 'array' and 'country' to fieldType ENUM
    await connection.execute(`
    ALTER TABLE g_feature_context_fields
    MODIFY COLUMN fieldType ENUM('string', 'number', 'boolean', 'date', 'semver', 'array', 'country') NOT NULL
    COMMENT 'Field data type'
  `);
    console.log('  ✓ Added array and country to fieldType ENUM');

    // Step 2: Migrate NOT operators in strategy constraints
    // str_neq -> str_eq + inverted=true
    const [strNeqRows] = await connection.execute(`
    SELECT id FROM g_feature_strategy_constraints WHERE operator = 'str_neq'
  `);
    if (strNeqRows.length > 0) {
        await connection.execute(`
      UPDATE g_feature_strategy_constraints
      SET operator = 'str_eq', inverted = 1
      WHERE operator = 'str_neq'
    `);
        console.log(`  ✓ Migrated ${strNeqRows.length} str_neq -> str_eq + inverted`);
    }

    // str_not_in -> str_in + inverted=true
    const [strNotInRows] = await connection.execute(`
    SELECT id FROM g_feature_strategy_constraints WHERE operator = 'str_not_in'
  `);
    if (strNotInRows.length > 0) {
        await connection.execute(`
      UPDATE g_feature_strategy_constraints
      SET operator = 'str_in', inverted = 1
      WHERE operator = 'str_not_in'
    `);
        console.log(`  ✓ Migrated ${strNotInRows.length} str_not_in -> str_in + inverted`);
    }

    // num_not_in -> num_in + inverted=true
    const [numNotInRows] = await connection.execute(`
    SELECT id FROM g_feature_strategy_constraints WHERE operator = 'num_not_in'
  `);
    if (numNotInRows.length > 0) {
        await connection.execute(`
      UPDATE g_feature_strategy_constraints
      SET operator = 'num_in', inverted = 1
      WHERE operator = 'num_not_in'
    `);
        console.log(`  ✓ Migrated ${numNotInRows.length} num_not_in -> num_in + inverted`);
    }

    // semver_not_in -> semver_in + inverted=true
    const [semverNotInRows] = await connection.execute(`
    SELECT id FROM g_feature_strategy_constraints WHERE operator = 'semver_not_in'
  `);
    if (semverNotInRows.length > 0) {
        await connection.execute(`
      UPDATE g_feature_strategy_constraints
      SET operator = 'semver_in', inverted = 1
      WHERE operator = 'semver_not_in'
    `);
        console.log(`  ✓ Migrated ${semverNotInRows.length} semver_not_in -> semver_in + inverted`);
    }

    console.log('✓ Migration complete: field types added and NOT operators migrated');
};

exports.down = async function (connection) {
    console.log('Reverting: restoring NOT operators and removing array/country types...');

    // Step 1: Revert inverted constraints back to NOT operators
    await connection.execute(`
    UPDATE g_feature_strategy_constraints
    SET operator = 'str_neq', inverted = 0
    WHERE operator = 'str_eq' AND inverted = 1
  `);

    await connection.execute(`
    UPDATE g_feature_strategy_constraints
    SET operator = 'str_not_in', inverted = 0
    WHERE operator = 'str_in' AND inverted = 1
  `);

    await connection.execute(`
    UPDATE g_feature_strategy_constraints
    SET operator = 'num_not_in', inverted = 0
    WHERE operator = 'num_in' AND inverted = 1
  `);

    await connection.execute(`
    UPDATE g_feature_strategy_constraints
    SET operator = 'semver_not_in', inverted = 0
    WHERE operator = 'semver_in' AND inverted = 1
  `);

    // Step 2: Convert any array/country fields back to string
    await connection.execute(`
    UPDATE g_feature_context_fields
    SET fieldType = 'string'
    WHERE fieldType IN ('array', 'country')
  `);

    // Step 3: Revert fieldType ENUM
    await connection.execute(`
    ALTER TABLE g_feature_context_fields
    MODIFY COLUMN fieldType ENUM('string', 'number', 'boolean', 'date', 'semver') NOT NULL
    COMMENT 'Field data type'
  `);

    console.log('✓ Revert complete');
};

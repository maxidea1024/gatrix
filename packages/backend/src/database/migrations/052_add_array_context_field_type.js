/**
 * Migration: Add array/country to context field types, migrate NOT operators
 *
 * 1. Add 'array' and 'country' to fieldType ENUM in g_feature_context_fields
 * 2. Migrate NOT operators (str_neq, str_not_in, num_not_in, semver_not_in)
 *    to positive operators + inverted flag in g_feature_strategies.constraints (JSON)
 *    and g_feature_segments.constraints (JSON)
 */

// NOT operator mapping: oldOperator -> { newOperator }
const NOT_OPERATOR_MAP = {
  str_neq: 'str_eq',
  str_not_in: 'str_in',
  num_not_in: 'num_in',
  semver_not_in: 'semver_in',
};

/**
 * Update JSON constraints in a table column, replacing NOT operators with inverted flag
 */
async function migrateNotOperatorsInTable(connection, tableName) {
  let totalMigrated = 0;

  for (const [oldOp, newOp] of Object.entries(NOT_OPERATOR_MAP)) {
    // Find rows containing the old operator in constraints JSON
    const [rows] = await connection.execute(
      `SELECT id, constraints FROM ${tableName} WHERE JSON_SEARCH(constraints, 'one', ?) IS NOT NULL`,
      [oldOp]
    );

    for (const row of rows) {
      let constraints = row.constraints;
      if (typeof constraints === 'string') {
        constraints = JSON.parse(constraints);
      }
      if (!Array.isArray(constraints)) continue;

      let changed = false;
      for (const c of constraints) {
        if (c.operator === oldOp) {
          c.operator = newOp;
          c.inverted = true;
          changed = true;
        }
      }

      if (changed) {
        await connection.execute(
          `UPDATE ${tableName} SET constraints = ? WHERE id = ?`,
          [JSON.stringify(constraints), row.id]
        );
        totalMigrated++;
      }
    }
  }

  return totalMigrated;
}

/**
 * Revert: convert inverted operators back to NOT operators in JSON constraints
 */
async function revertNotOperatorsInTable(connection, tableName) {
  // Find all rows with inverted constraints
  const [rows] = await connection.execute(
    `SELECT id, constraints FROM ${tableName} WHERE JSON_SEARCH(constraints, 'one', 'true', NULL, '$[*].inverted') IS NOT NULL`
  );

  const reverseMap = {};
  for (const [oldOp, newOp] of Object.entries(NOT_OPERATOR_MAP)) {
    reverseMap[newOp] = oldOp;
  }

  for (const row of rows) {
    let constraints = row.constraints;
    if (typeof constraints === 'string') {
      constraints = JSON.parse(constraints);
    }
    if (!Array.isArray(constraints)) continue;

    let changed = false;
    for (const c of constraints) {
      if (c.inverted && reverseMap[c.operator]) {
        c.operator = reverseMap[c.operator];
        delete c.inverted;
        changed = true;
      }
    }

    if (changed) {
      await connection.execute(
        `UPDATE ${tableName} SET constraints = ? WHERE id = ?`,
        [JSON.stringify(constraints), row.id]
      );
    }
  }
}

exports.up = async function (connection) {
  console.log('Adding array/country field types and migrating NOT operators...');

  // Step 1: Add 'array' and 'country' to fieldType ENUM
  await connection.execute(`
    ALTER TABLE g_feature_context_fields
    MODIFY COLUMN fieldType ENUM('string', 'number', 'boolean', 'date', 'semver', 'array', 'country') NOT NULL
    COMMENT 'Field data type'
  `);
  console.log('  ✓ Added array and country to fieldType ENUM');

  // Step 2: Migrate NOT operators in strategy constraints (JSON column)
  const strategiesMigrated = await migrateNotOperatorsInTable(connection, 'g_feature_strategies');
  if (strategiesMigrated > 0) {
    console.log(`  ✓ Migrated ${strategiesMigrated} strategies with NOT operators`);
  }

  // Step 3: Migrate NOT operators in segment constraints (JSON column)
  const segmentsMigrated = await migrateNotOperatorsInTable(connection, 'g_feature_segments');
  if (segmentsMigrated > 0) {
    console.log(`  ✓ Migrated ${segmentsMigrated} segments with NOT operators`);
  }

  console.log('✓ Migration complete: field types added and NOT operators migrated');
};

exports.down = async function (connection) {
  console.log('Reverting: restoring NOT operators and removing array/country types...');

  // Step 1: Revert inverted constraints back to NOT operators
  await revertNotOperatorsInTable(connection, 'g_feature_strategies');
  await revertNotOperatorsInTable(connection, 'g_feature_segments');

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

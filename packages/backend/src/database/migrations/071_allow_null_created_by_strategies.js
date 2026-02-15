/**
 * Migration: Allow NULL for createdBy in g_feature_strategies
 * This is needed for auto-progression in release flows where a plan is 
 * progressed by a system scheduler rather than a specific user.
 */

exports.up = async function (connection) {
    console.log('Altering g_feature_strategies to allow NULL in createdBy...');

    // 1. Drop existing foreign key constraint
    // We need to know the exact constraint name if it's not consistent, 
    // but it's defined as fk_feature_strategies_created_by in 021_feature_flags_system.js
    try {
        await connection.execute(`
      ALTER TABLE g_feature_strategies
      DROP FOREIGN KEY fk_feature_strategies_created_by
    `);
    } catch (error) {
        console.log('Constraint fk_feature_strategies_created_by not found or already dropped');
    }

    // 2. Modify column to be NULLable
    await connection.execute(`
    ALTER TABLE g_feature_strategies
    MODIFY COLUMN createdBy INT NULL
  `);

    // 3. Re-add foreign key constraint with SET NULL behavior
    await connection.execute(`
    ALTER TABLE g_feature_strategies
    ADD CONSTRAINT fk_feature_strategies_created_by 
    FOREIGN KEY (createdBy) REFERENCES g_users(id) ON DELETE SET NULL
  `);

    console.log('✓ g_feature_strategies.createdBy is now nullable');
};

exports.down = async function (connection) {
    // Note: Reverting to NOT NULL might fail if there are existing NULL values
    console.log('Reverting g_feature_strategies.createdBy to NOT NULL...');

    // To revert, we'd need to fill NULLs with a valid user ID first
    // For simplicity, we just try to revert the nullability if possible

    try {
        await connection.execute(`
      ALTER TABLE g_feature_strategies
      DROP FOREIGN KEY fk_feature_strategies_created_by
    `);
    } catch (error) { }

    // Fill NULLs with 1 (assuming admin user exists) before making NOT NULL
    await connection.execute('UPDATE g_feature_strategies SET createdBy = 1 WHERE createdBy IS NULL');

    await connection.execute(`
    ALTER TABLE g_feature_strategies
    MODIFY COLUMN createdBy INT NOT NULL
  `);

    await connection.execute(`
    ALTER TABLE g_feature_strategies
    ADD CONSTRAINT fk_feature_strategies_created_by 
    FOREIGN KEY (createdBy) REFERENCES g_users(id) ON DELETE RESTRICT
  `);
};

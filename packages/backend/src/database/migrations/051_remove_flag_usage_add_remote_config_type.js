/**
 * Migration: Remove flagUsage column, add 'remoteConfig' to flagType enum
 *
 * Previously flagUsage='remoteConfig' was used to distinguish remote configs.
 * Now flagType='remoteConfig' is used instead, consolidating into one field.
 */
exports.up = async function (connection) {
    console.log('Adding remoteConfig to flagType enum and migrating flagUsage data...');

    // Step 1: Modify flagType enum to include 'remoteConfig'
    await connection.execute(`
    ALTER TABLE g_feature_flags
    MODIFY COLUMN flagType ENUM('release', 'experiment', 'operational', 'killSwitch', 'permission', 'remoteConfig') NOT NULL DEFAULT 'release'
  `);
    console.log('  ✓ Added remoteConfig to flagType enum');

    // Step 2: Migrate existing remoteConfig flagUsage to flagType
    await connection.execute(`
    UPDATE g_feature_flags
    SET flagType = 'remoteConfig'
    WHERE flagUsage = 'remoteConfig'
  `);
    console.log('  ✓ Migrated existing remoteConfig flags');

    // Step 3: Drop flagUsage index
    try {
        await connection.execute(`
      DROP INDEX idx_feature_flags_flag_usage ON g_feature_flags
    `);
        console.log('  ✓ Dropped flagUsage index');
    } catch (e) {
        console.log('  - flagUsage index not found, skipping');
    }

    // Step 4: Drop flagUsage column
    await connection.execute(`
    ALTER TABLE g_feature_flags
    DROP COLUMN flagUsage
  `);
    console.log('  ✓ Removed flagUsage column');

    // Step 5: Add remoteConfig to flag_types reference table if it exists
    try {
        await connection.execute(`
      INSERT IGNORE INTO g_feature_flag_types (flagType, displayName, description, lifetimeDays, iconName, sortOrder)
      VALUES ('remoteConfig', 'Remote Config', 'Remote configuration values delivered to clients', NULL, 'Settings', 60)
    `);
        console.log('  ✓ Added remoteConfig to flag_types table');
    } catch (e) {
        console.log('  - flag_types table insert skipped:', e.message);
    }

    console.log('✓ Migration complete: flagUsage removed, remoteConfig added to flagType');
};

exports.down = async function (connection) {
    console.log('Reverting: Re-adding flagUsage column and removing remoteConfig from flagType...');

    // Step 1: Add flagUsage column back
    await connection.execute(`
    ALTER TABLE g_feature_flags
    ADD COLUMN flagUsage ENUM('flag', 'remoteConfig') NOT NULL DEFAULT 'flag'
    AFTER flagType
  `);

    // Step 2: Migrate remoteConfig flagType back to flagUsage
    await connection.execute(`
    UPDATE g_feature_flags
    SET flagUsage = 'remoteConfig', flagType = 'release'
    WHERE flagType = 'remoteConfig'
  `);

    // Step 3: Re-add flagUsage index
    await connection.execute(`
    CREATE INDEX idx_feature_flags_flag_usage ON g_feature_flags (flagUsage)
  `);

    // Step 4: Revert flagType enum
    await connection.execute(`
    ALTER TABLE g_feature_flags
    MODIFY COLUMN flagType ENUM('release', 'experiment', 'operational', 'killSwitch', 'permission') NOT NULL DEFAULT 'release'
  `);

    // Step 5: Remove from flag_types table
    try {
        await connection.execute(`
      DELETE FROM g_feature_flag_types WHERE flagType = 'remoteConfig'
    `);
    } catch (e) {
        console.log('  - flag_types cleanup skipped:', e.message);
    }

    console.log('✓ Revert complete');
};

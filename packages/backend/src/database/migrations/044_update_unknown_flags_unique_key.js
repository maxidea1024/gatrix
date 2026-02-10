/**
 * Migration: Update unique key for unknown_flags to include appName and sdkVersion
 */

exports.up = async function (connection) {
    console.log('Updating unknown_flags unique key...');

    try {
        // Drop existing unique key
        await connection.execute(`ALTER TABLE unknown_flags DROP INDEX uk_flag_env`);
    } catch (e) {
        console.log('Note: uk_flag_env index may not exist');
    }

    // Create new unique key including appName and sdkVersion
    // Note: If appName/sdkVersion are NULL, MySQL will allow multiple rows. 
    // We specify they should be NOT NULL in the future or handle NULLs.
    // For now, adding them to the unique key as is.
    await connection.execute(`
    ALTER TABLE unknown_flags 
    ADD UNIQUE KEY uk_flag_env_app_sdk (flagName, environment, appName, sdkVersion)
  `);

    console.log('✓ unique key updated for unknown_flags');
};

exports.down = async function (connection) {
    try {
        await connection.execute(`ALTER TABLE unknown_flags DROP INDEX uk_flag_env_app_sdk`);
        await connection.execute(`ALTER TABLE unknown_flags ADD UNIQUE KEY uk_flag_env (flagName, environment)`);
    } catch (e) {
        console.error('Error rolling back unknown_flags unique key:', e);
    }
};

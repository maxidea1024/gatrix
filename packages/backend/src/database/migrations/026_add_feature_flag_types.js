/**
 * Add feature flag types table for configurable lifetime settings per type
 * Types are predefined (release, experiment, operational, killSwitch, permission)
 * but lifetime can be customized per type
 */

exports.up = async function (connection) {
    console.log('Creating g_feature_flag_types table...');

    await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_feature_flag_types (
      flagType VARCHAR(50) PRIMARY KEY COMMENT 'Type identifier (release, experiment, operational, killSwitch, permission)',
      displayName VARCHAR(255) NOT NULL COMMENT 'Human-readable name',
      description TEXT NULL COMMENT 'Type description',
      lifetimeDays INT NULL COMMENT 'Expected lifetime in days, NULL means does not expire',
      iconName VARCHAR(50) NULL COMMENT 'Icon name for UI',
      sortOrder INT NOT NULL DEFAULT 0 COMMENT 'Display order',
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_sort_order (sortOrder)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Feature flag type definitions with lifetime settings'
  `);
    console.log('✓ g_feature_flag_types table created');

    // Insert default flag types
    console.log('Inserting default flag types...');
    await connection.execute(`
    INSERT INTO g_feature_flag_types (flagType, displayName, description, lifetimeDays, iconName, sortOrder) VALUES
    ('release', 'Release', 'Release feature toggles are used to release new features.', 40, 'RocketLaunch', 1),
    ('experiment', 'Experiment', 'Experiment feature toggles are used to test and verify multiple different versions of a feature.', 40, 'Science', 2),
    ('operational', 'Operational', 'Operational feature toggles are used to control aspects of a rollout.', 7, 'Build', 3),
    ('killSwitch', 'Kill switch', 'Kill switch feature toggles are used to quickly turn on or off critical functionality in your system.', NULL, 'PowerSettingsNew', 4),
    ('permission', 'Permission', 'Permission feature toggles are used to control permissions in your system.', NULL, 'VpnKey', 5)
    ON DUPLICATE KEY UPDATE displayName = VALUES(displayName)
  `);
    console.log('✓ Default flag types inserted');
};

exports.down = async function (connection) {
    console.log('Dropping g_feature_flag_types table...');
    await connection.execute('DROP TABLE IF EXISTS g_feature_flag_types');
    console.log('✓ g_feature_flag_types table dropped');
};

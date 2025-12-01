/**
 * Seed default environments for Remote Config system
 */

exports.up = async function(connection) {
  console.log('Seeding Remote Config environments...');

  // Insert default environments
  await connection.execute(`
    INSERT IGNORE INTO g_remote_config_environments 
    (environmentName, displayName, description, isDefault, requiresApproval, requiredApprovers, createdBy) 
    VALUES 
    ('development', 'Development', 'Development environment for testing and feature development', TRUE, FALSE, 1, 1),
    ('staging', 'Staging', 'Staging environment for pre-production testing and validation', FALSE, TRUE, 1, 1),
    ('production', 'Production', 'Production environment for live users', FALSE, TRUE, 2, 1)
  `);

  console.log('Remote Config environments seeded successfully');
};

exports.down = async function(connection) {
  console.log('Removing seeded Remote Config environments...');

  await connection.execute(`
    DELETE FROM g_remote_config_environments 
    WHERE environmentName IN ('development', 'staging', 'production')
  `);

  console.log('Remote Config environments removed successfully');
};


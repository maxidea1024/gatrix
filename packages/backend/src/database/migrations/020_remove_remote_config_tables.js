/**
 * Migration: Remove Remote Config Tables
 * 
 * This migration removes all remote config related tables as the feature is being rebuilt from scratch.
 */

exports.up = async function (connection) {
    console.log('Removing remote config related tables...');

    // Drop tables in order (respecting foreign key constraints)
    const remoteConfigTables = [
        'g_remote_config_edit_sessions',
        'g_remote_config_metrics',
        'g_remote_config_change_requests',
        'g_remote_config_template_versions',
        'g_remote_config_templates',
        'g_remote_config_segments',
        'g_remote_config_context_fields',
        'g_remote_config_variants',
        'g_remote_config_campaigns',
        'g_remote_config_deployments',
        'g_remote_config_rules',
        'g_remote_config_versions',
        'g_remote_configs',
    ];

    for (const table of remoteConfigTables) {
        try {
            await connection.execute(`DROP TABLE IF EXISTS ${table}`);
            console.log(`✓ Dropped table: ${table}`);
        } catch (error) {
            console.warn(`⚠ Could not drop table ${table}: ${error.message}`);
        }
    }

    console.log('✓ Remote config tables removed successfully');
};

exports.down = async function (connection) {
    console.log('⚠ This migration cannot be rolled back - remote config tables have been permanently removed');
    console.log('To restore remote config functionality, a new migration with the updated schema must be created');
};

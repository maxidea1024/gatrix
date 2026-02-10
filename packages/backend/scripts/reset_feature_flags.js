const path = require('path');
const fs = require('fs');
require('ts-node/register');
const db = require('../src/config/knex').default;

async function resetFeatureFlags() {
    console.log('Starting partial reset of Feature Flag system...');

    try {
        // 1. Drop Tables
        const tables = [
            'g_feature_metrics',
            'g_feature_flag_segments',
            'g_feature_segments',
            'g_feature_variants',
            'g_feature_strategies',
            'g_feature_flag_environments',
            'g_unknown_flags',
            'unknown_flags', // Added this based on error log
            'g_network_traffic',
            'NetworkTraffic',
            'g_feature_flags',
            'g_feature_context_fields'
        ];

        // Disable foreign key checks to avoid constraint errors during drop
        await db.raw('SET FOREIGN_KEY_CHECKS = 0');

        for (const table of tables) {
            console.log(`Dropping table: ${table}`);
            await db.schema.dropTableIfExists(table);
        }

        await db.raw('SET FOREIGN_KEY_CHECKS = 1');
        console.log('✓ Feature Flag tables dropped.');

        // 2. Clear Migration Records
        console.log('Removing migration records (021 and above)...');
        await db('g_migrations')
            .where('id', '>=', '021')
            .del();

        console.log('✓ Migration records cleaned.');

        console.log('Partial reset complete. Run "yarn migrate" to recreate tables.');

    } catch (error) {
        console.error('Error resetting feature flags:', error);
    } finally {
        await db.destroy();
    }
}

resetFeatureFlags();

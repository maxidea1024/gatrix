/**
 * Migration: Refactor all remaining environmentId columns to environment
 * 
 * This migration:
 * 1. Renames environmentId to environment in tables that only have environmentId
 * 2. Removes environmentId from tables that have both environmentId and environment
 * 3. Adds environment column to tables that missed it
 * 4. Updates all foreign keys to reference g_environments(environmentName)
 */

const TABLES_TO_RENAME = [
    'g_remote_config_templates',
    'g_remote_config_metrics'
];

const TABLES_TO_REMOVE_ID = [
    'g_remote_config_segments',
    'g_remote_config_campaigns'
];

const TABLES_TO_ADD_ENV = [
    'g_remote_config_change_requests',
    'g_remote_config_deployments',
    'g_remote_configs',
    'g_remote_config_versions',
    'g_remote_config_variants'
];

module.exports = {
    id: '070_refactor_all_environment_ids',

    async up(db) {
        console.log('Starting migration 070: Refactor all environment IDs...');

        // 1. Rename environmentId to environment
        for (const tableName of TABLES_TO_RENAME) {
            try {
                // Check if environmentId exists
                const [idColExists] = await db.query(
                    `SELECT COUNT(*) as cnt FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = 'environmentId'`,
                    [tableName]
                );

                if (idColExists[0].cnt > 0) {
                    console.log(`Renaming environmentId to environment in ${tableName}...`);

                    // Drop FK first
                    try {
                        const [fkName] = await db.query(`
              SELECT CONSTRAINT_NAME FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
              WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = 'environmentId'
              AND REFERENCED_TABLE_NAME = 'g_environments'
            `, [tableName]);

                        if (fkName.length > 0) {
                            await db.query(`ALTER TABLE ${tableName} DROP FOREIGN KEY ${fkName[0].CONSTRAINT_NAME}`);
                        }
                    } catch (e) { }

                    // Rename column
                    await db.query(`
            ALTER TABLE ${tableName}
            CHANGE COLUMN environmentId environment VARCHAR(100) NOT NULL
          `);

                    // Update values if they were ULIDs
                    await db.query(`
            UPDATE ${tableName} t
            JOIN g_environments e ON t.environment = e.id
            SET t.environment = e.environmentName
            WHERE t.environment LIKE '%.%'
          `);

                    // Add new FK
                    await db.query(`
            ALTER TABLE ${tableName}
            ADD CONSTRAINT fk_${tableName}_environment
            FOREIGN KEY (environment) REFERENCES g_environments(environmentName)
            ON DELETE CASCADE ON UPDATE CASCADE
          `);
                }
            } catch (e) {
                console.error(`Error processing ${tableName}:`, e);
            }
        }

        // 2. Remove environmentId from tables that have both
        for (const tableName of TABLES_TO_REMOVE_ID) {
            try {
                const [idColExists] = await db.query(
                    `SELECT COUNT(*) as cnt FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = 'environmentId'`,
                    [tableName]
                );

                if (idColExists[0].cnt > 0) {
                    console.log(`Removing redundant environmentId from ${tableName}...`);

                    // Drop FK first
                    try {
                        const [fkName] = await db.query(`
              SELECT CONSTRAINT_NAME FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
              WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = 'environmentId'
              AND REFERENCED_TABLE_NAME = 'g_environments'
            `, [tableName]);

                        if (fkName.length > 0) {
                            await db.query(`ALTER TABLE ${tableName} DROP FOREIGN KEY ${fkName[0].CONSTRAINT_NAME}`);
                        }
                    } catch (e) { }

                    // Drop column
                    await db.query(`ALTER TABLE ${tableName} DROP COLUMN environmentId`);
                }
            } catch (e) {
                console.error(`Error processing ${tableName}:`, e);
            }
        }

        // 3. Add environment to tables that missed it
        for (const tableName of TABLES_TO_ADD_ENV) {
            try {
                const [envColExists] = await db.query(
                    `SELECT COUNT(*) as cnt FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = 'environment'`,
                    [tableName]
                );

                if (envColExists[0].cnt === 0) {
                    console.log(`Adding environment to ${tableName}...`);

                    await db.query(`
            ALTER TABLE ${tableName}
            ADD COLUMN environment VARCHAR(100) NOT NULL DEFAULT 'development' AFTER id
          `);

                    await db.query(`
            ALTER TABLE ${tableName}
            ALTER COLUMN environment DROP DEFAULT
          `);

                    await db.query(`
            ALTER TABLE ${tableName}
            ADD CONSTRAINT fk_${tableName}_environment
            FOREIGN KEY (environment) REFERENCES g_environments(environmentName)
            ON DELETE CASCADE ON UPDATE CASCADE
          `);
                }
            } catch (e) {
                console.error(`Error processing ${tableName}:`, e);
            }
        }

        console.log('Migration 070 completed successfully');
    },

    async down(db) {
        console.log('Rollback for 070 is not fully implemented due to complexity of mapping back to ULIDs.');
    }
};

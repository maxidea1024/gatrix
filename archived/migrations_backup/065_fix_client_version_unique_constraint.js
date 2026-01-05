/**
 * Migration: Fix UNIQUE constraints for client versions (Multi-environment support)
 * 
 * This migration updates the UNIQUE constraint on g_client_versions.
 * Previously, (platform, clientVersion) was unique globally.
 * Now, (environmentId, platform, clientVersion) will be unique.
 */

const TABLE_NAME = 'g_client_versions';
const OLD_INDEX_NAME = 'unique_platform_version';
const NEW_INDEX_NAME = 'uk_env_platform_version';

module.exports = {
    id: '065_fix_client_version_unique_constraint',

    async up(db) {
        // Check if table exists
        const [tableExists] = await db.query(
            `SELECT COUNT(*) as cnt FROM INFORMATION_SCHEMA.TABLES
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
            [TABLE_NAME]
        );

        if (tableExists[0].cnt === 0) {
            console.log(`Table ${TABLE_NAME} does not exist, skipping...`);
            return;
        }

        // Check if environmentId column exists
        const [envColExists] = await db.query(
            `SELECT COUNT(*) as cnt FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = 'environmentId'`,
            [TABLE_NAME]
        );

        if (envColExists[0].cnt === 0) {
            console.log(`Column environmentId does not exist in ${TABLE_NAME}, skipping...`);
            return;
        }

        // Check if old unique key exists
        const [indexExists] = await db.query(
            `SELECT COUNT(*) as cnt FROM INFORMATION_SCHEMA.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?`,
            [TABLE_NAME, OLD_INDEX_NAME]
        );

        if (indexExists[0].cnt > 0) {
            console.log(`Dropping old unique key ${OLD_INDEX_NAME} from ${TABLE_NAME}...`);
            try {
                await db.query(`ALTER TABLE ${TABLE_NAME} DROP INDEX ${OLD_INDEX_NAME}`);
            } catch (e) {
                console.log(`Failed to drop index ${OLD_INDEX_NAME}: ${e.message}`);
            }
        }

        // Check if new unique key already exists
        const [newIndexExists] = await db.query(
            `SELECT COUNT(*) as cnt FROM INFORMATION_SCHEMA.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?`,
            [TABLE_NAME, NEW_INDEX_NAME]
        );

        if (newIndexExists[0].cnt === 0) {
            console.log(`Creating new unique key ${NEW_INDEX_NAME} on ${TABLE_NAME}...`);
            await db.query(`
        ALTER TABLE ${TABLE_NAME}
        ADD CONSTRAINT ${NEW_INDEX_NAME} UNIQUE (environmentId, platform, clientVersion)
      `);
        } else {
            console.log(`Unique key ${NEW_INDEX_NAME} already exists on ${TABLE_NAME}, skipping...`);
        }

        console.log(`Successfully updated unique constraint on ${TABLE_NAME}`);
    },

    async down(db) {
        console.log('Warning: Rollback of unique constraint changes may fail if duplicate data exists');

        // Drop new unique key if it exists
        const [newIndexExists] = await db.query(
            `SELECT COUNT(*) as cnt FROM INFORMATION_SCHEMA.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?`,
            [TABLE_NAME, NEW_INDEX_NAME]
        );

        if (newIndexExists[0].cnt > 0) {
            console.log(`Dropping unique key ${NEW_INDEX_NAME} from ${TABLE_NAME}...`);
            try {
                await db.query(`ALTER TABLE ${TABLE_NAME} DROP INDEX ${NEW_INDEX_NAME}`);
            } catch (e) {
                console.log(`Failed to drop index ${NEW_INDEX_NAME}: ${e.message}`);
            }
        }

        // Recreate old unique key (platform, clientVersion)
        console.log(`Recreating original unique key ${OLD_INDEX_NAME} on ${TABLE_NAME}...`);
        try {
            await db.query(`
        ALTER TABLE ${TABLE_NAME}
        ADD CONSTRAINT ${OLD_INDEX_NAME} UNIQUE (platform, clientVersion)
      `);
        } catch (e) {
            console.log(`Failed to recreate index ${OLD_INDEX_NAME}: ${e.message} - duplicate data may exist (which is good, it means the migration worked!)`);
        }
    }
};

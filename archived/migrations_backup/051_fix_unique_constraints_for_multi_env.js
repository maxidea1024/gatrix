/**
 * Migration: Fix UNIQUE constraints for multi-environment support
 *
 * This migration updates UNIQUE constraints on tables that now have environmentId,
 * changing single-column UNIQUE keys to composite keys including environmentId.
 * This allows the same worldId, tagName, etc. to exist in different environments.
 */

const UNIQUE_KEY_UPDATES = [
  {
    table: 'g_game_worlds',
    oldKey: 'worldId',
    newColumns: ['environmentId', 'worldId'],
    newKeyName: 'uk_env_worldId'
  },
  {
    table: 'g_tags',
    oldKey: 'name',
    newColumns: ['environmentId', 'name'],
    newKeyName: 'uk_env_tag_name'
  },
  {
    table: 'g_vars',
    oldKey: 'varKey',
    newColumns: ['environmentId', 'varKey'],
    newKeyName: 'uk_env_varKey'
  },
  {
    table: 'g_message_templates',
    oldKey: 'name',
    newColumns: ['environmentId', 'name'],
    newKeyName: 'uk_env_template_name'
  },
  {
    table: 'g_banners',
    oldKey: 'uk_banner_name',
    newColumns: ['environmentId', 'name'],
    newKeyName: 'uk_env_banner_name'
  }
];

module.exports = {
  id: '051_fix_unique_constraints_for_multi_env',

  async up(db) {
    for (const update of UNIQUE_KEY_UPDATES) {
      const { table, oldKey, newColumns, newKeyName } = update;

      // Check if table exists
      const [tableExists] = await db.query(
        `SELECT COUNT(*) as cnt FROM INFORMATION_SCHEMA.TABLES
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
        [table]
      );

      if (tableExists[0].cnt === 0) {
        console.log(`Table ${table} does not exist, skipping...`);
        continue;
      }

      // Check if environmentId column exists
      const [envColExists] = await db.query(
        `SELECT COUNT(*) as cnt FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = 'environmentId'`,
        [table]
      );

      if (envColExists[0].cnt === 0) {
        console.log(`Column environmentId does not exist in ${table}, skipping...`);
        continue;
      }

      // Check if old unique key exists
      const [indexExists] = await db.query(
        `SELECT COUNT(*) as cnt FROM INFORMATION_SCHEMA.STATISTICS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?`,
        [table, oldKey]
      );

      if (indexExists[0].cnt > 0) {
        console.log(`Dropping old unique key ${oldKey} from ${table}...`);
        try {
          await db.query(`ALTER TABLE ${table} DROP INDEX ${oldKey}`);
        } catch (e) {
          console.log(`Failed to drop index ${oldKey}: ${e.message}`);
        }
      }

      // Check if new unique key already exists
      const [newIndexExists] = await db.query(
        `SELECT COUNT(*) as cnt FROM INFORMATION_SCHEMA.STATISTICS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?`,
        [table, newKeyName]
      );

      if (newIndexExists[0].cnt === 0) {
        console.log(`Creating new unique key ${newKeyName} on ${table} (${newColumns.join(', ')})...`);
        await db.query(`
          ALTER TABLE ${table}
          ADD CONSTRAINT ${newKeyName} UNIQUE (${newColumns.join(', ')})
        `);
      } else {
        console.log(`Unique key ${newKeyName} already exists on ${table}, skipping...`);
      }

      console.log(`Successfully updated unique constraint on ${table}`);
    }

    console.log('Migration 051 completed successfully');
  },

  async down(db) {
    // Reverting would require dropping new composite key and recreating single-column key
    // This could fail if duplicate data was inserted, so we only log a warning
    console.log('Warning: Rollback of unique constraint changes may fail if duplicate data exists');

    for (const update of UNIQUE_KEY_UPDATES.reverse()) {
      const { table, oldKey, newColumns, newKeyName } = update;

      // Check if table exists
      const [tableExists] = await db.query(
        `SELECT COUNT(*) as cnt FROM INFORMATION_SCHEMA.TABLES
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
        [table]
      );

      if (tableExists[0].cnt === 0) {
        continue;
      }

      // Drop new unique key if it exists
      const [newIndexExists] = await db.query(
        `SELECT COUNT(*) as cnt FROM INFORMATION_SCHEMA.STATISTICS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?`,
        [table, newKeyName]
      );

      if (newIndexExists[0].cnt > 0) {
        console.log(`Dropping unique key ${newKeyName} from ${table}...`);
        try {
          await db.query(`ALTER TABLE ${table} DROP INDEX ${newKeyName}`);
        } catch (e) {
          console.log(`Failed to drop index ${newKeyName}: ${e.message}`);
        }
      }

      // Recreate old unique key (last column of newColumns is the original key column)
      const originalColumn = newColumns[newColumns.length - 1];
      console.log(`Recreating original unique key ${oldKey} on ${table} (${originalColumn})...`);
      try {
        await db.query(`
          ALTER TABLE ${table}
          ADD CONSTRAINT ${oldKey} UNIQUE (${originalColumn})
        `);
      } catch (e) {
        console.log(`Failed to recreate index ${oldKey}: ${e.message} - duplicate data may exist`);
      }
    }
  }
};


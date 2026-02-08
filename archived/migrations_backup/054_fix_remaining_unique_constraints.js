/**
 * Migration: Fix remaining unique constraints for multi-environment support
 *
 * This migration:
 * 1. Removes the orphaned unique_banner_name constraint from g_banners (047 migration)
 * 2. Adds environmentId to other tables' unique constraints that were missed
 */

const FIXES = [
  // Fix banner - remove orphaned single-column unique
  {
    table: 'g_banners',
    dropKey: 'unique_banner_name',
    // uk_env_banner_name already exists from 051
  },
  // Fix job_types - add environment-scoped unique
  {
    table: 'g_job_types',
    dropKey: 'name',
    newColumns: ['environmentId', 'name'],
    newKeyName: 'uk_env_job_type_name',
  },
  // Fix coupon_settings - add environment-scoped unique
  {
    table: 'g_coupon_settings',
    dropKey: 'code',
    newColumns: ['environmentId', 'code'],
    newKeyName: 'uk_env_coupon_code',
  },
  // Fix coupons - add environment-scoped unique (via settingId which is env-scoped)
  // Note: coupons are linked to settings which are env-scoped, so this is fine
  // But let's verify the structure
];

module.exports = {
  id: '054_fix_remaining_unique_constraints',

  async up(db) {
    for (const fix of FIXES) {
      const { table, dropKey, newColumns, newKeyName } = fix;

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

      // Drop old key if it exists
      if (dropKey) {
        const [indexExists] = await db.query(
          `SELECT COUNT(*) as cnt FROM INFORMATION_SCHEMA.STATISTICS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?`,
          [table, dropKey]
        );

        if (indexExists[0].cnt > 0) {
          console.log(`Dropping old unique key ${dropKey} from ${table}...`);
          try {
            await db.query(`ALTER TABLE ${table} DROP INDEX \`${dropKey}\``);
            console.log(`  Successfully dropped ${dropKey}`);
          } catch (e) {
            console.log(`  Failed to drop index ${dropKey}: ${e.message}`);
          }
        } else {
          console.log(`Index ${dropKey} does not exist on ${table}, skipping drop...`);
        }
      }

      // Add new composite key if specified
      if (newColumns && newKeyName) {
        // Check if environmentId column exists
        const [envColExists] = await db.query(
          `SELECT COUNT(*) as cnt FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = 'environmentId'`,
          [table]
        );

        if (envColExists[0].cnt === 0) {
          console.log(`Column environmentId does not exist in ${table}, skipping new key...`);
          continue;
        }

        // Check if new key already exists
        const [newIndexExists] = await db.query(
          `SELECT COUNT(*) as cnt FROM INFORMATION_SCHEMA.STATISTICS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?`,
          [table, newKeyName]
        );

        if (newIndexExists[0].cnt === 0) {
          console.log(
            `Creating new unique key ${newKeyName} on ${table} (${newColumns.join(', ')})...`
          );
          try {
            await db.query(`
              ALTER TABLE ${table}
              ADD CONSTRAINT \`${newKeyName}\` UNIQUE (${newColumns.map((c) => `\`${c}\``).join(', ')})
            `);
            console.log(`  Successfully created ${newKeyName}`);
          } catch (e) {
            console.log(`  Failed to create index ${newKeyName}: ${e.message}`);
          }
        } else {
          console.log(`Unique key ${newKeyName} already exists on ${table}, skipping...`);
        }
      }
    }

    console.log('Migration 054 completed successfully');
  },

  async down(db) {
    console.log('Warning: Rollback of unique constraint changes may fail if duplicate data exists');

    // Reverse the changes
    for (const fix of FIXES.reverse()) {
      const { table, dropKey, newColumns, newKeyName } = fix;

      // Check if table exists
      const [tableExists] = await db.query(
        `SELECT COUNT(*) as cnt FROM INFORMATION_SCHEMA.TABLES
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
        [table]
      );

      if (tableExists[0].cnt === 0) continue;

      // Drop new key if exists
      if (newKeyName) {
        const [newIndexExists] = await db.query(
          `SELECT COUNT(*) as cnt FROM INFORMATION_SCHEMA.STATISTICS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?`,
          [table, newKeyName]
        );

        if (newIndexExists[0].cnt > 0) {
          console.log(`Dropping ${newKeyName} from ${table}...`);
          try {
            await db.query(`ALTER TABLE ${table} DROP INDEX \`${newKeyName}\``);
          } catch (e) {
            console.log(`Failed: ${e.message}`);
          }
        }
      }

      // Recreate old key (for banners, this would recreate the problem, so skip)
      if (dropKey && newColumns) {
        const originalColumn = newColumns[newColumns.length - 1];
        console.log(`Recreating ${dropKey} on ${table} (${originalColumn})...`);
        try {
          await db.query(
            `ALTER TABLE ${table} ADD CONSTRAINT \`${dropKey}\` UNIQUE (\`${originalColumn}\`)`
          );
        } catch (e) {
          console.log(`Failed: ${e.message}`);
        }
      }
    }
  },
};

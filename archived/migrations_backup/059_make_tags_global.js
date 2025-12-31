/**
 * Migration: Make tags global (remove environment dependency)
 */

module.exports = {
    id: '059_make_tags_global',

    async up(db) {
        console.log('Making tags global...');

        // 1. Deduplicate tags by name (keep the one with smallest ID)
        // MySQL specific syntax for delete with join
        console.log('Deduplicating tags...');
        await db.query(`
      DELETE t1 FROM g_tags t1 
      INNER JOIN g_tags t2 
      WHERE t1.id > t2.id AND t1.name = t2.name
    `);

        // 2. Drop foreign key constraint
        console.log('Dropping tags foreign key...');
        try {
            await db.query(`
        ALTER TABLE g_tags
        DROP FOREIGN KEY fk_g_tags_environment
      `);
        } catch (e) {
            console.log('Foreign key fk_g_tags_environment may not exist or different name, trying to continue...');
            // Try to find constraint name if standard one fails
            try {
                const [rows] = await db.query(`
          SELECT CONSTRAINT_NAME 
          FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
          WHERE TABLE_NAME = 'g_tags' AND COLUMN_NAME = 'environmentId' AND REFERENCED_TABLE_NAME = 'g_environments'
        `);
                if (rows.length > 0) {
                    const fkName = rows[0].CONSTRAINT_NAME;
                    console.log(`Found FK name: ${fkName}, dropping...`);
                    await db.query(`ALTER TABLE g_tags DROP FOREIGN KEY ${fkName}`);
                }
            } catch (innerErr) {
                console.log('Could not find or drop FK via schema lookup, ignoring:', innerErr.message);
            }
        }

        // 3. Drop index
        console.log('Dropping tags environment index...');
        try {
            await db.query(`
        DROP INDEX idx_g_tags_environmentId ON g_tags
      `);
        } catch (e) {
            console.log('Index idx_g_tags_environmentId may not exist, continuing...');
        }

        // 4. Drop column
        console.log('Dropping environmentId column from g_tags...');
        await db.query(`
      ALTER TABLE g_tags
      DROP COLUMN environmentId
    `);

        console.log('Tags are now global.');
    },

    async down(db) {
        console.log('Reverting tags to be environment-specific...');

        // We need to add environmentId back. 
        // We will assign all existing tags to 'development' default environment.

        const [envRows] = await db.query(
            `SELECT id FROM g_environments WHERE environmentName = 'development' LIMIT 1`
        );

        // If development environment doesn't exist (unlikely), pick any or fail
        let defaultEnvId = envRows.length > 0 ? envRows[0].id : null;

        if (!defaultEnvId) {
            console.log('Development environment not found, cannot revert properly without an environment ID.');
            // Fallback: try to find ANY environment
            const [anyEnv] = await db.query(`SELECT id FROM g_environments LIMIT 1`);
            if (anyEnv.length > 0) defaultEnvId = anyEnv[0].id;
        }

        if (!defaultEnvId) {
            throw new Error('No environments found to assign tags to.');
        }

        await db.query(`
      ALTER TABLE g_tags
      ADD COLUMN environmentId VARCHAR(127) NOT NULL DEFAULT '${defaultEnvId}'
    `);

        // Remove default constraint
        await db.query(`
      ALTER TABLE g_tags
      ALTER COLUMN environmentId DROP DEFAULT
    `);

        // Add FK
        await db.query(`
      ALTER TABLE g_tags
      ADD CONSTRAINT fk_g_tags_environment
      FOREIGN KEY (environmentId) REFERENCES g_environments(id)
      ON DELETE RESTRICT ON UPDATE CASCADE
    `);

        // Add Index
        await db.query(`
      CREATE INDEX idx_g_tags_environmentId ON g_tags(environmentId)
    `);

        console.log('Tags are environment-specific again.');
    }
};

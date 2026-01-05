/**
 * Migration: Refactor environment identification in server lifecycle events
 * 
 * This migration:
 * 1. Renames environmentId to environment in g_server_lifecycle_events
 * 2. Updates the column to store environmentName instead of ULID
 * 3. Updates the foreign key to reference g_environments(environmentName)
 */

module.exports = {
    id: '069_refactor_lifecycle_environment',

    async up(db) {
        console.log('Starting migration 069: Refactor lifecycle environment...');

        // 1. Check if the table exists
        const [tableExists] = await db.query(
            `SELECT COUNT(*) as cnt FROM INFORMATION_SCHEMA.TABLES
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'g_server_lifecycle_events'`
        );

        if (tableExists[0].cnt === 0) {
            console.log('Table g_server_lifecycle_events does not exist, skipping...');
            return;
        }

        // 2. Drop existing foreign key
        try {
            await db.query(`
        ALTER TABLE g_server_lifecycle_events
        DROP FOREIGN KEY fk_lifecycle_environment
      `);
            console.log('Dropped existing foreign key fk_lifecycle_environment');
        } catch (e) {
            console.log('Foreign key fk_lifecycle_environment may not exist or already dropped');
        }

        // 3. Rename column environmentId to environment
        // Note: We use CHANGE COLUMN to rename and ensure type is VARCHAR(100) to match g_environments.environmentName
        await db.query(`
      ALTER TABLE g_server_lifecycle_events
      CHANGE COLUMN environmentId environment VARCHAR(100) NOT NULL
    `);
        console.log('Renamed environmentId to environment');

        // 4. Update values from ULID to environmentName (if necessary)
        // We join with g_environments to find the name corresponding to the old ID
        // If the value was already a name (e.g. 'development'), it will stay the same if we join on id or environmentName
        // But since we want to be safe, we'll try to map it.
        // Wait, if g_environments.id exists, we map it. If not, we assume it's already the name.
        const [idColExists] = await db.query(
            `SELECT COUNT(*) as cnt FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'g_environments' AND COLUMN_NAME = 'id'`
        );

        if (idColExists[0].cnt > 0) {
            await db.query(`
        UPDATE g_server_lifecycle_events sle
        JOIN g_environments e ON sle.environment = e.id
        SET sle.environment = e.environmentName
      `);
            console.log('Updated environment values from ULID to environmentName');
        }

        // 5. Add new foreign key referencing environmentName
        await db.query(`
      ALTER TABLE g_server_lifecycle_events
      ADD CONSTRAINT fk_lifecycle_environment
      FOREIGN KEY (environment) REFERENCES g_environments(environmentName)
      ON DELETE CASCADE ON UPDATE CASCADE
    `);
        console.log('Added new foreign key fk_lifecycle_environment');

        // 6. Update index
        try {
            await db.query(`DROP INDEX idx_lifecycle_environmentId ON g_server_lifecycle_events`);
        } catch (e) {
            console.log('Index idx_lifecycle_environmentId may not exist');
        }

        await db.query(`CREATE INDEX idx_lifecycle_environment ON g_server_lifecycle_events(environment)`);
        console.log('Updated index for environment column');

        console.log('Migration 069 completed successfully');
    },

    async down(db) {
        console.log('Rolling back migration 069...');

        // This is complex to rollback perfectly if we don't know the IDs, 
        // but we can at least rename the column back.

        try {
            await db.query(`
        ALTER TABLE g_server_lifecycle_events
        DROP FOREIGN KEY fk_lifecycle_environment
      `);
        } catch (e) { }

        await db.query(`
      ALTER TABLE g_server_lifecycle_events
      CHANGE COLUMN environment environmentId VARCHAR(127) NOT NULL
    `);

        // We can't easily map names back to ULIDs without g_environments.id
        // If g_environments.id exists, we could try.

        console.log('Rollback 069 completed (column renamed back to environmentId)');
    }
};

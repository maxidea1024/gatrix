/**
 * Migration: Rename serverVersion to appVersion in server lifecycle events table
 */

module.exports = {
  id: '068_rename_serverversion_to_appversion',

  async up(db) {
    // Rename column serverVersion to appVersion
    await db.query(`
      ALTER TABLE g_server_lifecycle_events
        CHANGE COLUMN serverVersion appVersion VARCHAR(63);
    `);

    console.log('Migration 068_rename_serverversion_to_appversion completed successfully');
  },

  async down(db) {
    await db.query(`
      ALTER TABLE g_server_lifecycle_events
        CHANGE COLUMN appVersion serverVersion VARCHAR(63);
    `);
    console.log('Migration 068_rename_serverversion_to_appversion reverted successfully');
  },
};

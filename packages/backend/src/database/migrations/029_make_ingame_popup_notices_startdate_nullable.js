/**
 * Migration 029: Make startDate nullable in g_ingame_popup_notices
 * This allows notices to start immediately without specifying a start date
 */

async function up(pool) {
  console.log('Running migration 029: Make startDate nullable in g_ingame_popup_notices');

  try {
    await pool.execute(`
      ALTER TABLE g_ingame_popup_notices 
      MODIFY COLUMN startDate TIMESTAMP NULL COMMENT 'Start date and time for the notice (optional, starts immediately if null)'
    `);

    console.log('Migration 029 completed successfully');
  } catch (error) {
    console.error('Migration 029 failed:', error);
    throw error;
  }
}

async function down(pool) {
  console.log('Rolling back migration 029: Make startDate nullable in g_ingame_popup_notices');

  try {
    await pool.execute(`
      ALTER TABLE g_ingame_popup_notices 
      MODIFY COLUMN startDate TIMESTAMP NOT NULL COMMENT 'Start date and time for the notice'
    `);

    console.log('Migration 029 rollback completed successfully');
  } catch (error) {
    console.error('Migration 029 rollback failed:', error);
    throw error;
  }
}

module.exports = { up, down };


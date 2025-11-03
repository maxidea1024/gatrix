/**
 * Migration 029: Make startDate nullable in g_ingame_popup_notices
 *
 * Note: This migration is a no-op because g_ingame_popup_notices.startDate
 * is already nullable from the initial schema or earlier migrations.
 */

async function up(pool) {
  console.log('Skipping: g_ingame_popup_notices.startDate is already nullable');
  // No-op: column already nullable
}

async function down(pool) {
  console.log('Skipping rollback: no changes were made in this migration');
  // No-op: nothing to rollback
}

module.exports = { up, down };


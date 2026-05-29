/**
 * 028 - Add isInternal and isVisible columns to g_organisations
 *
 * - isInternal: System-only organisations (e.g., Edge infrastructure org). Hidden from workspace UI.
 * - isVisible: User-controlled visibility (for future use, e.g., hide/show org from lists).
 */

exports.up = async function (connection) {
  console.log('[028] Adding isInternal and isVisible columns to g_organisations...');

  await connection.execute(`
    ALTER TABLE g_organisations
      ADD COLUMN isInternal BOOLEAN NOT NULL DEFAULT FALSE AFTER isActive,
      ADD COLUMN isVisible BOOLEAN NOT NULL DEFAULT TRUE AFTER isInternal
  `);
  console.log('[028] ??Added isInternal and isVisible columns');

  console.log('[028] ??Migration complete');
};

exports.down = async function (connection) {
  await connection.execute(`
    ALTER TABLE g_organisations
      DROP COLUMN isInternal,
      DROP COLUMN isVisible
  `);
};

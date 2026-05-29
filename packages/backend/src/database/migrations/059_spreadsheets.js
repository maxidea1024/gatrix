/**
 * 059 - Spreadsheets
 *
 * Generic spreadsheet feature (Google Sheets-like).
 * Stores Univer IWorkbookData JSON snapshots.
 * Org-level scope — not tied to any specific project.
 */

exports.up = async function (connection) {
  console.log('[059] Creating spreadsheets table...');

  await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_spreadsheets (
      id VARCHAR(21) NOT NULL PRIMARY KEY COMMENT 'nanoid',
      orgId CHAR(26) NOT NULL COMMENT 'FK to g_organisations.id (ULID)',
      title VARCHAR(500) NOT NULL DEFAULT 'Untitled Spreadsheet',
      description TEXT NULL,
      sheetData LONGTEXT NOT NULL COMMENT 'Univer IWorkbookData JSON snapshot',
      thumbnail TEXT NULL COMMENT 'Base64-encoded preview image',
      isPinned TINYINT(1) NOT NULL DEFAULT 0,
      createdBy CHAR(26) NOT NULL COMMENT 'FK to g_users.id (ULID)',
      updatedBy CHAR(26) NULL COMMENT 'FK to g_users.id (ULID)',
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_org (orgId),
      INDEX idx_org_pinned (orgId, isPinned, updatedAt),
      INDEX idx_created_by (createdBy)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  console.log('[059] Migration complete.');
};

exports.down = async function (connection) {
  console.log('[059] Rolling back spreadsheets migration...');

  await connection.execute(`DROP TABLE IF EXISTS g_spreadsheets`);

  console.log('[059] Rollback complete.');
};

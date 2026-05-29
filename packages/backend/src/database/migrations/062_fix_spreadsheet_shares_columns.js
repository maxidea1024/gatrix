"use strict";

exports.name = "062_fix_spreadsheet_shares_columns";

exports.up = async function (connection) {
  // Fix column sizes: ULID is 26 chars, nanoid varies
  await connection.query(`
    ALTER TABLE g_spreadsheet_shares
      MODIFY COLUMN id VARCHAR(36) NOT NULL,
      MODIFY COLUMN spreadsheetId VARCHAR(36) NOT NULL,
      MODIFY COLUMN shareToken VARCHAR(64) DEFAULT NULL,
      MODIFY COLUMN createdBy VARCHAR(36) NOT NULL;
  `);
};

exports.down = async function (connection) {
  // no-op: reverting would break data
};

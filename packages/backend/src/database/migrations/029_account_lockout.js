/**
 * 029 - Account Lockout
 * Add failedLoginAttempts and lockedAt columns to g_users for brute-force protection
 */

exports.up = async function (connection) {
  console.log('[029] Adding account lockout columns to g_users...');

  await connection.execute(`
    ALTER TABLE g_users
      ADD COLUMN failedLoginAttempts INT NOT NULL DEFAULT 0 AFTER preferredLanguage,
      ADD COLUMN lockedAt TIMESTAMP NULL AFTER failedLoginAttempts
  `);

  console.log('[029] ??Account lockout columns added');
};

exports.down = async function (connection) {
  await connection.execute(`
    ALTER TABLE g_users
      DROP COLUMN failedLoginAttempts,
      DROP COLUMN lockedAt
  `);
};

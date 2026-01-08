/**
 * Migration: Add rejection info to change requests
 * - rejectedBy: ID of the user who rejected
 * - rejectedAt: Timestamp when rejected
 * - rejectionReason: Comment explaining rejection
 */

exports.up = async function (connection) {
    // Add rejection info columns to g_change_requests
    // g_users.id is INT (signed), so rejectedBy should also be INT (signed)
    await connection.execute(`
        ALTER TABLE g_change_requests
        ADD COLUMN rejectedBy INT NULL,
        ADD COLUMN rejectedAt TIMESTAMP NULL,
        ADD COLUMN rejectionReason TEXT NULL
    `);

    console.log('[Migration 006] Added rejection info columns to g_change_requests');
};

exports.down = async function (connection) {
    await connection.execute(`
        ALTER TABLE g_change_requests
        DROP COLUMN rejectionReason,
        DROP COLUMN rejectedAt,
        DROP COLUMN rejectedBy
    `);

    console.log('[Migration 006] Removed rejection info columns from g_change_requests');
};

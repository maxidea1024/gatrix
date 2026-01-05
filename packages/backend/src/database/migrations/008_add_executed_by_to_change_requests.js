
exports.up = async function (connection) {
    console.log('Adding executedBy to g_change_requests...');

    await connection.execute(`
    ALTER TABLE g_change_requests
    ADD COLUMN executedBy INT NULL AFTER rejectionReason,
    ADD CONSTRAINT fk_cr_executedBy FOREIGN KEY (executedBy) REFERENCES g_users(id) ON DELETE SET NULL
  `);

    console.log('✓ Added executedBy column to g_change_requests');
};

exports.down = async function (connection) {
    console.log('Removing executedBy from g_change_requests...');

    try {
        await connection.execute(`ALTER TABLE g_change_requests DROP FOREIGN KEY fk_cr_executedBy`);
    } catch (e) { /* ignore */ }

    await connection.execute(`ALTER TABLE g_change_requests DROP COLUMN executedBy`);
};

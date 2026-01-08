
exports.up = async function (connection) {
    console.log('Adding type column to g_change_requests...');
    await connection.execute(`
        ALTER TABLE g_change_requests
        ADD COLUMN type VARCHAR(50) NULL DEFAULT NULL AFTER category
    `);
    console.log('✓ Added type column to g_change_requests');
};

exports.down = async function (connection) {
    console.log('Removing type column from g_change_requests...');
    await connection.execute(`ALTER TABLE g_change_requests DROP COLUMN type`);
    console.log('✓ Removed type column from g_change_requests');
};


exports.up = async function (connection) {
    // Ensure flagId allows NULL
    await connection.execute(`
        ALTER TABLE g_impact_metric_configs
        MODIFY COLUMN flagId VARCHAR(255) NULL DEFAULT NULL
    `);
};

exports.down = async function (connection) {
    // Revert logic is tricky if data exists with NULLs, but theoretically we could go back to NOT NULL if needed.
    // For now, let's assume we don't want to revert this strictly to NOT NULL unless we clean data.
    // But to match previous state (if it was NOT NULL), we would do:
    // await connection.execute('ALTER TABLE g_impact_metric_configs MODIFY COLUMN flagId VARCHAR(255) NOT NULL');
    // However, since 062 says DEFAULT NULL, this migration is just a fix/guarantee.
    // So down migration can just do nothing or set it back to whatever it was.
};

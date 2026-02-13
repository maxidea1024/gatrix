
exports.up = async function (connection) {
    // Add chartType and groupBy columns to g_impact_metric_configs
    await connection.execute(`
        ALTER TABLE g_impact_metric_configs
        ADD COLUMN chartType VARCHAR(20) NOT NULL DEFAULT 'line',
        ADD COLUMN groupBy JSON DEFAULT NULL
    `);
};

exports.down = async function (connection) {
    await connection.execute(`
        ALTER TABLE g_impact_metric_configs
        DROP COLUMN chartType,
        DROP COLUMN groupBy
    `);
};

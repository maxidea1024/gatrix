/**
 * Migration: Impact Metric Configurations
 *
 * Stores per-flag metric chart configurations.
 * Each row = one chart panel registered by the user.
 */
exports.up = async function (connection) {
    await connection.execute(`
        CREATE TABLE IF NOT EXISTS g_impact_metric_configs (
            id VARCHAR(26) NOT NULL PRIMARY KEY,
            flagId VARCHAR(255) DEFAULT NULL,
            title VARCHAR(255) NOT NULL,
            metricName VARCHAR(255) NOT NULL,
            labelSelectors JSON DEFAULT NULL,
            aggregationMode VARCHAR(20) NOT NULL DEFAULT 'count',
            chartRange VARCHAR(20) NOT NULL DEFAULT 'hour',
            displayOrder INT NOT NULL DEFAULT 0,
            createdBy VARCHAR(255) DEFAULT NULL,
            createdAt TIMESTAMP NOT NULL DEFAULT (UTC_TIMESTAMP()),
            updatedAt TIMESTAMP NOT NULL DEFAULT (UTC_TIMESTAMP()) ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_imc_flagId (flagId)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
};

exports.down = async function (connection) {
    await connection.execute(`DROP TABLE IF EXISTS g_impact_metric_configs`);
};

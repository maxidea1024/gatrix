/**
 * Migration: Add layout columns to impact metric configs
 *
 * Adds grid layout position and size columns for Grafana-like
 * drag-and-drop dashboard layout with react-grid-layout.
 * Uses 12-column grid system.
 */
exports.up = async function (connection) {
    await connection.execute(`
        ALTER TABLE g_impact_metric_configs
        ADD COLUMN layoutX INT NOT NULL DEFAULT 0 AFTER displayOrder,
        ADD COLUMN layoutY INT NOT NULL DEFAULT 0 AFTER layoutX,
        ADD COLUMN layoutW INT NOT NULL DEFAULT 6 AFTER layoutY,
        ADD COLUMN layoutH INT NOT NULL DEFAULT 2 AFTER layoutW
    `);
};

exports.down = async function (connection) {
    await connection.execute(`
        ALTER TABLE g_impact_metric_configs
        DROP COLUMN layoutX,
        DROP COLUMN layoutY,
        DROP COLUMN layoutW,
        DROP COLUMN layoutH
    `);
};

/**
 * 010 - Add projectId to g_feature_flag_types
 *
 * Feature flag types should be project-scoped per RBAC spec.
 * Existing system default types remain with projectId = NULL.
 */

exports.up = async function (connection) {
    console.log('[010] Adding projectId to g_feature_flag_types...');

    // Check if projectId column already exists
    const [columns] = await connection.execute(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'g_feature_flag_types' AND COLUMN_NAME = 'projectId'`
    );

    if (columns.length === 0) {
        await connection.execute(`
      ALTER TABLE g_feature_flag_types
        ADD COLUMN projectId CHAR(26) NULL AFTER flagType,
        ADD INDEX idx_project_id (projectId)
    `);
        console.log('  ??g_feature_flag_types: added projectId column');
    } else {
        console.log('  ??g_feature_flag_types: projectId column already exists, skipping');
    }

    console.log('[010] ??g_feature_flag_types projectId migration completed');
};

exports.down = async function (connection) {
    const [columns] = await connection.execute(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'g_feature_flag_types' AND COLUMN_NAME = 'projectId'`
    );

    if (columns.length > 0) {
        await connection.execute(`
      ALTER TABLE g_feature_flag_types
        DROP INDEX idx_project_id,
        DROP COLUMN projectId
    `);
    }
};

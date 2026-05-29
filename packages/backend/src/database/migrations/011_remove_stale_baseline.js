/**
 * 011 - Remove staleAfterDays from g_feature_flags
 *       Remove baselinePayload from g_feature_flag_environments
 *
 * staleAfterDays is replaced by g_feature_flag_types.lifetimeDays.
 * baselinePayload is unused.
 */

exports.up = async function (connection) {
    console.log('[011] Removing staleAfterDays and baselinePayload columns...');

    // Remove staleAfterDays from g_feature_flags
    const [staleCols] = await connection.execute(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'g_feature_flags' AND COLUMN_NAME = 'staleAfterDays'`
    );
    if (staleCols.length > 0) {
        await connection.execute(`
      ALTER TABLE g_feature_flags DROP COLUMN staleAfterDays
    `);
        console.log('  ??g_feature_flags: removed staleAfterDays column');
    } else {
        console.log('  ??g_feature_flags: staleAfterDays column already removed, skipping');
    }

    // Remove baselinePayload from g_feature_flag_environments
    const [baselineCols] = await connection.execute(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'g_feature_flag_environments' AND COLUMN_NAME = 'baselinePayload'`
    );
    if (baselineCols.length > 0) {
        await connection.execute(`
      ALTER TABLE g_feature_flag_environments DROP COLUMN baselinePayload
    `);
        console.log('  ??g_feature_flag_environments: removed baselinePayload column');
    } else {
        console.log('  ??g_feature_flag_environments: baselinePayload column already removed, skipping');
    }

    console.log('[011] ??Column removal migration completed');
};

exports.down = async function (connection) {
    // Re-add staleAfterDays to g_feature_flags
    const [staleCols] = await connection.execute(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'g_feature_flags' AND COLUMN_NAME = 'staleAfterDays'`
    );
    if (staleCols.length === 0) {
        await connection.execute(`
      ALTER TABLE g_feature_flags ADD COLUMN staleAfterDays INT NOT NULL DEFAULT 30 AFTER impressionDataEnabled
    `);
    }

    // Re-add baselinePayload to g_feature_flag_environments
    const [baselineCols] = await connection.execute(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'g_feature_flag_environments' AND COLUMN_NAME = 'baselinePayload'`
    );
    if (baselineCols.length === 0) {
        await connection.execute(`
      ALTER TABLE g_feature_flag_environments ADD COLUMN baselinePayload JSON NULL AFTER lastSeenAt
    `);
    }
};

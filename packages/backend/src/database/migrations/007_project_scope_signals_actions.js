/**
 * 007 - Add projectId to signal endpoints and action sets
 *
 * g_signal_endpoints:
 *   - Rename environmentId -> projectId (these are project-scoped, not environment-scoped)
 *
 * g_action_sets:
 *   + projectId CHAR(26) NOT NULL (project-scoped)
 */

exports.up = async function (connection) {
    console.log('[007] Adding projectId to signal endpoints and action sets...');

    // Helper: check if column exists
    async function hasColumn(table, column) {
        const [cols] = await connection.execute(
            `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
            [table, column]
        );
        return cols.length > 0;
    }

    // ?€?€ g_signal_endpoints: rename environmentId -> projectId ?€?€
    if (await hasColumn('g_signal_endpoints', 'environmentId')) {
        // Drop existing index on environmentId
        try {
            await connection.execute(`ALTER TABLE g_signal_endpoints DROP INDEX idx_environment_id`);
        } catch (e) { /* index might not exist */ }

        await connection.execute(`
      ALTER TABLE g_signal_endpoints
        CHANGE COLUMN environmentId projectId CHAR(26) NOT NULL
    `);

        await connection.execute(`
      ALTER TABLE g_signal_endpoints
        ADD INDEX idx_project_id (projectId)
    `);

        console.log('  ??g_signal_endpoints: renamed environmentId -> projectId');
    }

    // Also rename isActive -> isEnabled if needed (model uses isEnabled)
    if (await hasColumn('g_signal_endpoints', 'isActive')) {
        await connection.execute(`
      ALTER TABLE g_signal_endpoints
        CHANGE COLUMN isActive isEnabled BOOLEAN NOT NULL DEFAULT TRUE
    `);
        console.log('  ??g_signal_endpoints: renamed isActive -> isEnabled');
    }

    // ?€?€ g_action_sets: add projectId ?€?€
    if (!(await hasColumn('g_action_sets', 'projectId'))) {
        // Allow NULL initially so existing rows survive, then we can backfill if needed
        await connection.execute(`
      ALTER TABLE g_action_sets
        ADD COLUMN projectId CHAR(26) NULL AFTER id,
        ADD INDEX idx_project_id (projectId)
    `);

        console.log('  ??g_action_sets: added projectId');
    }

    // ?€?€ g_signal_endpoint_tokens: fix column names if needed ?€?€
    // Migration 004 created tokenValue, but model uses tokenHash
    if ((await hasColumn('g_signal_endpoint_tokens', 'tokenValue')) &&
        !(await hasColumn('g_signal_endpoint_tokens', 'tokenHash'))) {
        await connection.execute(`
      ALTER TABLE g_signal_endpoint_tokens
        CHANGE COLUMN tokenValue tokenHash VARCHAR(255) NOT NULL
    `);
        console.log('  ??g_signal_endpoint_tokens: renamed tokenValue -> tokenHash');
    }

    // Migration 004 created name, but model uses tokenName
    if ((await hasColumn('g_signal_endpoint_tokens', 'name')) &&
        !(await hasColumn('g_signal_endpoint_tokens', 'tokenName'))) {
        // Drop unique index on name first if exists
        try {
            await connection.execute(`ALTER TABLE g_signal_endpoint_tokens DROP INDEX tokenValue`);
        } catch (e) { /* index might not exist or have different name */ }

        await connection.execute(`
      ALTER TABLE g_signal_endpoint_tokens
        CHANGE COLUMN name tokenName VARCHAR(255) NOT NULL
    `);
        console.log('  ??g_signal_endpoint_tokens: renamed name -> tokenName');
    }

    // Migration 004 uses endpointId, but model expects signalEndpointId
    if ((await hasColumn('g_signal_endpoint_tokens', 'endpointId')) &&
        !(await hasColumn('g_signal_endpoint_tokens', 'signalEndpointId'))) {
        // Drop FK first
        try {
            await connection.execute(`ALTER TABLE g_signal_endpoint_tokens DROP FOREIGN KEY fk_set_endpoint`);
        } catch (e) { /* FK might not exist */ }
        try {
            await connection.execute(`ALTER TABLE g_signal_endpoint_tokens DROP INDEX idx_endpoint_id`);
        } catch (e) { /* index might not exist */ }

        await connection.execute(`
      ALTER TABLE g_signal_endpoint_tokens
        CHANGE COLUMN endpointId signalEndpointId CHAR(26) NOT NULL
    `);

        await connection.execute(`
      ALTER TABLE g_signal_endpoint_tokens
        ADD INDEX idx_signal_endpoint_id (signalEndpointId),
        ADD CONSTRAINT fk_set_signal_endpoint FOREIGN KEY (signalEndpointId) REFERENCES g_signal_endpoints(id) ON DELETE CASCADE
    `);

        console.log('  ??g_signal_endpoint_tokens: renamed endpointId -> signalEndpointId');
    }

    // Drop isActive from tokens if exists (model doesn't use it)
    if (await hasColumn('g_signal_endpoint_tokens', 'isActive')) {
        await connection.execute(`
      ALTER TABLE g_signal_endpoint_tokens DROP COLUMN isActive
    `);
        console.log('  ??g_signal_endpoint_tokens: dropped isActive');
    }

    // Drop expiresAt from tokens if exists (model doesn't use it)
    if (await hasColumn('g_signal_endpoint_tokens', 'expiresAt')) {
        await connection.execute(`
      ALTER TABLE g_signal_endpoint_tokens DROP COLUMN expiresAt
    `);
        console.log('  ??g_signal_endpoint_tokens: dropped expiresAt');
    }

    console.log('[007] ??Project scoping for signal endpoints and action sets completed');
};

exports.down = async function (connection) {
    async function hasColumn(table, column) {
        const [cols] = await connection.execute(
            `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
            [table, column]
        );
        return cols.length > 0;
    }

    // g_signal_endpoints: revert projectId -> environmentId
    if (await hasColumn('g_signal_endpoints', 'projectId')) {
        try {
            await connection.execute(`ALTER TABLE g_signal_endpoints DROP INDEX idx_project_id`);
        } catch (e) { /* ignore */ }

        await connection.execute(`
      ALTER TABLE g_signal_endpoints
        CHANGE COLUMN projectId environmentId CHAR(26) NOT NULL
    `);

        await connection.execute(`
      ALTER TABLE g_signal_endpoints
        ADD INDEX idx_environment_id (environmentId)
    `);
    }

    // g_signal_endpoints: revert isEnabled -> isActive
    if (await hasColumn('g_signal_endpoints', 'isEnabled')) {
        await connection.execute(`
      ALTER TABLE g_signal_endpoints
        CHANGE COLUMN isEnabled isActive BOOLEAN NOT NULL DEFAULT TRUE
    `);
    }

    // g_action_sets: drop projectId
    if (await hasColumn('g_action_sets', 'projectId')) {
        await connection.execute(`ALTER TABLE g_action_sets DROP COLUMN projectId`);
    }
};

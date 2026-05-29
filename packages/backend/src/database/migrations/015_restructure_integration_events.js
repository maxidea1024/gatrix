/**
 * 015 - Restructure g_integration_events to match main branch schema
 *
 * Current: id, integrationId, eventType, payload, status, response, error, createdAt, updatedAt
 * Target:  id, integrationId, eventType, state, stateDetails, eventData, details, createdAt, updatedAt
 */

exports.up = async function (connection) {
    console.log('[015] Restructuring g_integration_events...');

    // Add new columns (skip if already exist from a previous partial run or schema overlap)
    const [cols] = await connection.execute(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'g_integration_events' AND COLUMN_NAME = 'state'`
    );
    if (cols.length === 0) {
        await connection.execute(`
        ALTER TABLE g_integration_events
        ADD COLUMN state VARCHAR(20) NOT NULL DEFAULT 'success' AFTER eventType,
        ADD COLUMN stateDetails TEXT NULL AFTER state,
        ADD COLUMN eventData JSON NULL AFTER stateDetails,
        ADD COLUMN details JSON NULL AFTER eventData
      `);
    }

    // Copy data from old columns (may not exist after fresh reset)
    try {
        await connection.execute(`
        UPDATE g_integration_events
        SET state = COALESCE(status, 'success'),
            eventData = payload
      `);
    } catch (e) { /* old columns may not exist */ }

    // Drop old columns (may already be absent after reset)
    for (const col of ['payload', 'status', 'response', 'error']) {
        try {
            await connection.execute(`ALTER TABLE g_integration_events DROP COLUMN ${col}`);
        } catch (e) { /* column may not exist */ }
    }

    try {
        await connection.execute(`ALTER TABLE g_integration_events DROP INDEX idx_status`);
    } catch (e) { /* may not exist */ }

    console.log('[015] Done');
};

exports.down = async function (connection) {
    await connection.execute(`
    ALTER TABLE g_integration_events
    ADD COLUMN payload JSON NULL AFTER eventType,
    ADD COLUMN status VARCHAR(50) NOT NULL DEFAULT 'pending' AFTER payload,
    ADD COLUMN response JSON NULL AFTER status,
    ADD COLUMN error TEXT NULL AFTER response
  `);
    await connection.execute(`
    UPDATE g_integration_events SET status = state, payload = eventData
  `);
    await connection.execute(`ALTER TABLE g_integration_events DROP COLUMN state`);
    await connection.execute(`ALTER TABLE g_integration_events DROP COLUMN stateDetails`);
    await connection.execute(`ALTER TABLE g_integration_events DROP COLUMN eventData`);
    await connection.execute(`ALTER TABLE g_integration_events DROP COLUMN details`);
};

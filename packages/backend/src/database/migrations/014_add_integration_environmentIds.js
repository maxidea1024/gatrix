/**
 * 014 - Restructure g_integrations and g_integration_events to match main branch schema
 *
 * g_integrations:
 *   Current: id, name, type, description, config, isEnabled, environmentId, createdBy, updatedBy, createdAt, updatedAt
 *   Target:  id, provider, description, isEnabled, parameters, events, environmentIds, createdBy, updatedBy, createdAt, updatedAt
 *
 * g_integration_events:
 *   Current: id, integrationId, eventType, payload, status, response, error, createdAt, updatedAt
 *   Target:  id, integrationId, eventType, state, stateDetails, eventData, details, createdAt, updatedAt
 */

exports.up = async function (connection) {
  console.log('[014] Restructuring g_integrations and g_integration_events...');

  // ========== g_integrations ==========
  // Add new columns
  await connection.execute(`
    ALTER TABLE g_integrations
    ADD COLUMN provider VARCHAR(50) NOT NULL DEFAULT '' AFTER description,
    ADD COLUMN parameters JSON NULL AFTER provider,
    ADD COLUMN events JSON NULL AFTER parameters,
    ADD COLUMN environmentIds JSON NULL AFTER events
  `);

  // Copy data from old columns
  await connection.execute(`
    UPDATE g_integrations
    SET provider = COALESCE(type, ''),
        parameters = COALESCE(config, '{}')
  `);

  // Drop old columns and indexes
  try {
    await connection.execute(`ALTER TABLE g_integrations DROP INDEX idx_type`);
  } catch (e) { /* may not exist */ }

  await connection.execute(`ALTER TABLE g_integrations DROP COLUMN name`);
  await connection.execute(`ALTER TABLE g_integrations DROP COLUMN type`);
  await connection.execute(`ALTER TABLE g_integrations DROP COLUMN config`);
  await connection.execute(`ALTER TABLE g_integrations DROP COLUMN environmentId`);

  await connection.execute(`ALTER TABLE g_integrations ADD INDEX idx_provider (provider)`);

  // ========== g_integration_events ==========
  // Add new columns
  await connection.execute(`
    ALTER TABLE g_integration_events
    ADD COLUMN state VARCHAR(20) NOT NULL DEFAULT 'success' AFTER eventType,
    ADD COLUMN stateDetails TEXT NULL AFTER state,
    ADD COLUMN eventData JSON NULL AFTER stateDetails,
    ADD COLUMN details JSON NULL AFTER eventData
  `);

  // Copy data from old columns
  await connection.execute(`
    UPDATE g_integration_events
    SET state = COALESCE(status, 'success'),
        eventData = payload
  `);

  // Drop old columns
  await connection.execute(`ALTER TABLE g_integration_events DROP COLUMN payload`);
  await connection.execute(`ALTER TABLE g_integration_events DROP COLUMN status`);
  await connection.execute(`ALTER TABLE g_integration_events DROP COLUMN response`);
  await connection.execute(`ALTER TABLE g_integration_events DROP COLUMN error`);

  // Drop old index on status if exists
  try {
    await connection.execute(`ALTER TABLE g_integration_events DROP INDEX idx_status`);
  } catch (e) { /* may not exist */ }

  console.log('[014] Done');
};

exports.down = async function (connection) {
  // Reverse g_integration_events
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

  // Reverse g_integrations
  await connection.execute(`
    ALTER TABLE g_integrations
    ADD COLUMN name VARCHAR(255) NOT NULL DEFAULT '' AFTER id,
    ADD COLUMN type VARCHAR(50) NOT NULL DEFAULT '' AFTER name,
    ADD COLUMN config JSON NULL AFTER isEnabled,
    ADD COLUMN environmentId CHAR(26) NULL AFTER config
  `);
  await connection.execute(`UPDATE g_integrations SET type = provider, config = parameters`);
  await connection.execute(`ALTER TABLE g_integrations DROP COLUMN provider`);
  await connection.execute(`ALTER TABLE g_integrations DROP COLUMN parameters`);
  await connection.execute(`ALTER TABLE g_integrations DROP COLUMN events`);
  await connection.execute(`ALTER TABLE g_integrations DROP COLUMN environmentIds`);
  try { await connection.execute(`ALTER TABLE g_integrations DROP INDEX idx_provider`); } catch (e) { }
  await connection.execute(`ALTER TABLE g_integrations ADD INDEX idx_type (type)`);
};

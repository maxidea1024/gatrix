/**
 * Actions System
 *
 * Action sets define automated actions that are triggered when matching
 * signals are received. Actions execute using a service account's permissions.
 * Actions are global scope (not project-scoped).
 */

exports.up = async function (connection) {
  console.log('Creating actions system...');

  // Action sets table (grouping of actions with match criteria)
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_action_sets (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      description TEXT NULL,
      isEnabled BOOLEAN NOT NULL DEFAULT TRUE,
      actorId INT NULL COMMENT 'Service account user ID that executes the actions',
      source VARCHAR(100) NOT NULL DEFAULT 'signal-endpoint' COMMENT 'Signal source type to match',
      sourceId INT NULL COMMENT 'Specific signal endpoint ID to match',
      filters JSON NULL COMMENT 'Payload filter conditions (constraint-style)',
      createdBy INT NOT NULL,
      updatedBy INT NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_is_enabled (isEnabled),
      INDEX idx_actor_id (actorId),
      INDEX idx_source (source, sourceId),
      CONSTRAINT fk_action_sets_actor FOREIGN KEY (actorId) REFERENCES g_users(id) ON DELETE SET NULL,
      CONSTRAINT fk_action_sets_created_by FOREIGN KEY (createdBy) REFERENCES g_users(id) ON DELETE RESTRICT,
      CONSTRAINT fk_action_sets_updated_by FOREIGN KEY (updatedBy) REFERENCES g_users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // Actions table (individual actions within an action set)
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_actions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      actionSetId INT NOT NULL,
      sortOrder INT NOT NULL DEFAULT 0 COMMENT 'Execution order',
      actionType VARCHAR(100) NOT NULL COMMENT 'Type of action to execute (e.g. TOGGLE_FLAG, ENABLE_FLAG)',
      executionParams JSON NULL COMMENT 'Action-specific parameters',
      createdBy INT NOT NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_action_set_id (actionSetId),
      INDEX idx_sort_order (sortOrder),
      CONSTRAINT fk_actions_set FOREIGN KEY (actionSetId) REFERENCES g_action_sets(id) ON DELETE CASCADE,
      CONSTRAINT fk_actions_created_by FOREIGN KEY (createdBy) REFERENCES g_users(id) ON DELETE RESTRICT
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // Action set events table (execution log with snapshots)
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_action_set_events (
      id INT AUTO_INCREMENT PRIMARY KEY,
      actionSetId INT NOT NULL,
      signalId INT NOT NULL,
      state VARCHAR(50) NOT NULL DEFAULT 'started' COMMENT 'started, success, failed',
      eventSignal JSON NOT NULL COMMENT 'Snapshot of the signal at execution time',
      eventActionSet JSON NOT NULL COMMENT 'Snapshot of the action set + individual action states',
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_action_set_id (actionSetId),
      INDEX idx_signal_id (signalId),
      INDEX idx_state (state),
      INDEX idx_created_at (createdAt)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  console.log('✓ Actions system created');
};

exports.down = async function (connection) {
  await connection.execute('DROP TABLE IF EXISTS g_action_set_events');
  await connection.execute('DROP TABLE IF EXISTS g_actions');
  await connection.execute('DROP TABLE IF EXISTS g_action_sets');
};

/**
 * Release Flow Lifecycle Enhancement
 * Adds transition conditions, progression tracking, and plan status
 */

exports.up = async function (connection) {
    console.log('Adding Release Flow lifecycle columns...');

    // 1. Add status column to g_release_flows
    await connection.execute(`
    ALTER TABLE g_release_flows
    ADD COLUMN status ENUM('draft', 'active', 'paused', 'completed') NOT NULL DEFAULT 'draft'
    COMMENT 'Current lifecycle status of the plan'
    AFTER activeMilestoneId
  `);
    console.log('✓ Added status column to g_release_flows');

    // 2. Add lifecycle columns to g_release_flow_milestones
    await connection.execute(`
    ALTER TABLE g_release_flow_milestones
    ADD COLUMN transitionCondition JSON NULL
    COMMENT 'Transition condition (e.g. { intervalMinutes: 30 })'
    AFTER startedAt
  `);

    await connection.execute(`
    ALTER TABLE g_release_flow_milestones
    ADD COLUMN progressionExecutedAt TIMESTAMP NULL
    COMMENT 'When the automatic progression was executed'
    AFTER transitionCondition
  `);

    await connection.execute(`
    ALTER TABLE g_release_flow_milestones
    ADD COLUMN pausedAt TIMESTAMP NULL
    COMMENT 'When the milestone was paused'
    AFTER progressionExecutedAt
  `);
    console.log('✓ Added lifecycle columns to g_release_flow_milestones');

    // 3. Add index for finding active plans that need progression
    await connection.execute(`
    ALTER TABLE g_release_flows
    ADD INDEX idx_status (status)
  `);
    console.log('✓ Added status index to g_release_flows');

    // 4. Create safeguards table (Phase 2, created now for schema readiness)
    await connection.execute(`
    CREATE TABLE IF NOT EXISTS g_release_flow_safeguards (
      id VARCHAR(26) PRIMARY KEY COMMENT 'ULID',
      flowId VARCHAR(26) NOT NULL COMMENT 'Reference to release flow plan',
      milestoneId VARCHAR(26) NOT NULL COMMENT 'Reference to milestone',
      metricName VARCHAR(500) NOT NULL COMMENT 'Metric name to monitor',
      aggregationMode VARCHAR(50) NOT NULL DEFAULT 'count' COMMENT 'rps, count, avg, sum, p50, p95, p99',
      operator VARCHAR(10) NOT NULL DEFAULT '>' COMMENT 'Comparison operator (> or <)',
      threshold DOUBLE NOT NULL DEFAULT 0 COMMENT 'Threshold value',
      timeRange VARCHAR(50) NOT NULL DEFAULT 'hour' COMMENT 'hour, day, week, month',
      action VARCHAR(50) NOT NULL DEFAULT 'pause' COMMENT 'Action when triggered (pause)',
      isTriggered BOOLEAN NOT NULL DEFAULT FALSE COMMENT 'Whether safeguard has been triggered',
      triggeredAt TIMESTAMP NULL COMMENT 'When safeguard was triggered',
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_rf_safeguards_flow FOREIGN KEY (flowId) REFERENCES g_release_flows(id) ON DELETE CASCADE,
      CONSTRAINT fk_rf_safeguards_milestone FOREIGN KEY (milestoneId) REFERENCES g_release_flow_milestones(id) ON DELETE CASCADE,
      INDEX idx_flow_id (flowId),
      INDEX idx_milestone_id (milestoneId)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Safeguard configurations for release flow milestones'
  `);
    console.log('✓ Created g_release_flow_safeguards table');

    console.log('Release Flow lifecycle enhancement completed!');
};

exports.down = async function (connection) {
    console.log('Reverting Release Flow lifecycle columns...');

    await connection.execute('DROP TABLE IF EXISTS g_release_flow_safeguards');

    await connection.execute(`
    ALTER TABLE g_release_flow_milestones
    DROP COLUMN IF EXISTS pausedAt,
    DROP COLUMN IF EXISTS progressionExecutedAt,
    DROP COLUMN IF EXISTS transitionCondition
  `);

    await connection.execute(`
    ALTER TABLE g_release_flows
    DROP INDEX IF EXISTS idx_status,
    DROP COLUMN IF EXISTS status
  `);

    console.log('Release Flow lifecycle columns reverted!');
};

/**
 * Migration: Add version column and Action Group structure for CR System Redesign
 *
 * This migration adds:
 * 1. `version` column to all CR-target tables for conflict detection
 * 2. `g_action_groups` table for grouping operations by user intent
 * 3. `g_outbox_events` table for Outbox Pattern event publishing
 * 4. `g_entity_locks` table for soft/hard lock management
 * 5. Updates to `g_change_items` for Action Group reference
 * 6. Updates to `g_environments` for policy settings
 */

exports.up = async function (connection) {
    console.log('Starting CR System Redesign migration...');

    // ────────────────────────────────────────────────
    // 1. Add version column to all CR-target tables
    // ────────────────────────────────────────────────
    const versionTables = [
        'g_service_notices',
        'g_client_versions',
        'g_store_products',
        'g_surveys',
        'g_ingame_popup_notices',
        'g_game_worlds',
        'g_banners',
        'g_account_whitelist',
        'g_ip_whitelist',
        'g_vars',
        'g_reward_templates',
        'g_coupons',
        'g_message_templates'
    ];

    for (const tableName of versionTables) {
        // Check if table exists
        const [tableExists] = await connection.execute(`
            SELECT TABLE_NAME FROM information_schema.TABLES
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
        `, [tableName]);

        if (tableExists.length === 0) {
            console.log(`  ⏭ Table ${tableName} does not exist, skipping...`);
            continue;
        }

        // Check if version column already exists
        const [columnExists] = await connection.execute(`
            SHOW COLUMNS FROM ${tableName} LIKE 'version'
        `);

        if (columnExists.length === 0) {
            await connection.execute(`
                ALTER TABLE ${tableName}
                ADD COLUMN version INT NOT NULL DEFAULT 1 COMMENT 'Entity version for CR conflict detection'
            `);
            console.log(`  ✓ Added version column to ${tableName}`);
        } else {
            console.log(`  ⏭ Version column already exists in ${tableName}`);
        }
    }

    // ────────────────────────────────────────────────
    // 2. Create g_action_groups table
    // ────────────────────────────────────────────────
    await connection.execute(`
        CREATE TABLE IF NOT EXISTS g_action_groups (
            id VARCHAR(26) PRIMARY KEY COMMENT 'ULID',
            changeRequestId VARCHAR(26) NOT NULL,
            actionType VARCHAR(50) NOT NULL COMMENT 'CREATE_ENTITY, UPDATE_RULE, TOGGLE_FLAG, DELETE_ENTITY, etc.',
            title VARCHAR(255) NOT NULL COMMENT 'Human-readable action title',
            description TEXT NULL COMMENT 'Intent description',
            orderIndex INT NOT NULL DEFAULT 0 COMMENT 'Order within CR',
            createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_cr_id (changeRequestId),
            CONSTRAINT fk_ag_request FOREIGN KEY (changeRequestId) REFERENCES g_change_requests(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✓ Created g_action_groups table');

    // ────────────────────────────────────────────────
    // 3. Create g_outbox_events table
    // ────────────────────────────────────────────────
    await connection.execute(`
        CREATE TABLE IF NOT EXISTS g_outbox_events (
            id VARCHAR(26) PRIMARY KEY COMMENT 'ULID',
            changeRequestId VARCHAR(26) NOT NULL,
            entityType VARCHAR(100) NOT NULL COMMENT 'Table name',
            entityId VARCHAR(255) NOT NULL,
            eventType VARCHAR(50) NOT NULL COMMENT 'created, updated, deleted',
            payload JSON NOT NULL COMMENT 'Event payload',
            status ENUM('pending', 'processing', 'completed', 'failed') NOT NULL DEFAULT 'pending',
            retryCount INT NOT NULL DEFAULT 0,
            errorMessage TEXT NULL,
            createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            processedAt TIMESTAMP NULL,
            INDEX idx_status (status),
            INDEX idx_cr_id (changeRequestId),
            INDEX idx_entity (entityType, entityId),
            CONSTRAINT fk_outbox_request FOREIGN KEY (changeRequestId) REFERENCES g_change_requests(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✓ Created g_outbox_events table');

    // ────────────────────────────────────────────────
    // 4. Create g_entity_locks table
    // ────────────────────────────────────────────────
    await connection.execute(`
        CREATE TABLE IF NOT EXISTS g_entity_locks (
            id VARCHAR(26) PRIMARY KEY COMMENT 'ULID',
            entityType VARCHAR(100) NOT NULL COMMENT 'Table name',
            entityId VARCHAR(255) NOT NULL,
            environment VARCHAR(100) NOT NULL,
            lockedBy INT NOT NULL COMMENT 'User ID',
            lockType ENUM('soft', 'hard') NOT NULL DEFAULT 'soft',
            expiresAt TIMESTAMP NULL COMMENT 'NULL means no expiry',
            createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY uk_entity_lock (entityType, entityId, environment),
            INDEX idx_locked_by (lockedBy),
            INDEX idx_expires (expiresAt),
            CONSTRAINT fk_lock_user FOREIGN KEY (lockedBy) REFERENCES g_users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✓ Created g_entity_locks table');

    // ────────────────────────────────────────────────
    // 5. Update g_change_items table
    // ────────────────────────────────────────────────

    // Add actionGroupId column
    const [agColExists] = await connection.execute(`
        SHOW COLUMNS FROM g_change_items LIKE 'actionGroupId'
    `);

    if (agColExists.length === 0) {
        await connection.execute(`
            ALTER TABLE g_change_items
            ADD COLUMN actionGroupId VARCHAR(26) NULL AFTER changeRequestId,
            ADD COLUMN entityVersion INT NULL COMMENT 'Entity version at submission time' AFTER targetId,
            ADD INDEX idx_action_group (actionGroupId)
        `);

        // Add FK constraint (separate statement to handle potential issues)
        try {
            await connection.execute(`
                ALTER TABLE g_change_items
                ADD CONSTRAINT fk_ci_action_group FOREIGN KEY (actionGroupId) REFERENCES g_action_groups(id) ON DELETE SET NULL
            `);
        } catch (e) {
            console.warn('  ⚠ Could not add FK constraint to g_change_items.actionGroupId (non-fatal):', e.message);
        }

        console.log('✓ Updated g_change_items with actionGroupId and entityVersion columns');
    } else {
        console.log('  ⏭ g_change_items already has actionGroupId column');
    }

    // ────────────────────────────────────────────────
    // 6. Update g_change_requests table
    // ────────────────────────────────────────────────

    // Check if entityVersionSnapshot column exists
    const [evsColExists] = await connection.execute(`
        SHOW COLUMNS FROM g_change_requests LIKE 'entityVersionSnapshot'
    `);

    if (evsColExists.length === 0) {
        await connection.execute(`
            ALTER TABLE g_change_requests
            ADD COLUMN entityVersionSnapshot JSON NULL COMMENT 'Snapshot of entity versions at submission' AFTER type
        `);
        console.log('✓ Added entityVersionSnapshot to g_change_requests');
    } else {
        console.log('  ⏭ entityVersionSnapshot column already exists in g_change_requests');
    }

    // ────────────────────────────────────────────────
    // 7. Update g_environments table with policy columns
    // ────────────────────────────────────────────────

    // Note: fourEyesRequired is not needed as requiresApproval already exists in g_environments
    const envPolicyColumns = [
        { name: 'strictConflictCheck', type: 'BOOLEAN NOT NULL DEFAULT FALSE', comment: 'Block apply on version conflict' }
    ];

    for (const col of envPolicyColumns) {
        const [colExists] = await connection.execute(`
            SHOW COLUMNS FROM g_environments LIKE '${col.name}'
        `);

        if (colExists.length === 0) {
            await connection.execute(`
                ALTER TABLE g_environments
                ADD COLUMN ${col.name} ${col.type} COMMENT '${col.comment}'
            `);
            console.log(`  ✓ Added ${col.name} to g_environments`);
        } else {
            console.log(`  ⏭ ${col.name} column already exists in g_environments`);
        }
    }

    // Set production environment to strict conflict check mode by default
    await connection.execute(`
        UPDATE g_environments
        SET strictConflictCheck = TRUE
        WHERE environment = 'production'
    `);
    console.log('✓ Set production environment to strict CR policies');

    console.log('✓ CR System Redesign migration completed successfully!');
};

exports.down = async function (connection) {
    console.log('Rolling back CR System Redesign migration...');

    // Drop new tables
    try {
        await connection.execute(`ALTER TABLE g_change_items DROP FOREIGN KEY fk_ci_action_group`);
    } catch (e) { /* ignore */ }

    await connection.execute(`DROP TABLE IF EXISTS g_entity_locks`);
    await connection.execute(`DROP TABLE IF EXISTS g_outbox_events`);
    await connection.execute(`DROP TABLE IF EXISTS g_action_groups`);

    // Remove added columns from g_change_items
    try {
        await connection.execute(`
            ALTER TABLE g_change_items
            DROP COLUMN actionGroupId,
            DROP COLUMN entityVersion
        `);
    } catch (e) { /* ignore */ }

    // Remove entityVersionSnapshot from g_change_requests
    try {
        await connection.execute(`
            ALTER TABLE g_change_requests
            DROP COLUMN entityVersionSnapshot
        `);
    } catch (e) { /* ignore */ }

    // Remove policy columns from g_environments
    try {
        await connection.execute(`
            ALTER TABLE g_environments
            DROP COLUMN strictConflictCheck
        `);
    } catch (e) { /* ignore */ }

    // Remove version columns from tables (optional - might want to keep data)
    const versionTables = [
        'g_service_notices', 'g_client_versions', 'g_store_products',
        'g_surveys', 'g_ingame_popup_notices', 'g_game_worlds',
        'g_banners', 'g_account_whitelist', 'g_ip_whitelist', 'g_vars',
        'g_reward_templates', 'g_coupons', 'g_message_templates'
    ];

    for (const tableName of versionTables) {
        try {
            const [tableExists] = await connection.execute(`
                SELECT TABLE_NAME FROM information_schema.TABLES
                WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
            `, [tableName]);

            if (tableExists.length > 0) {
                await connection.execute(`ALTER TABLE ${tableName} DROP COLUMN version`);
                console.log(`  ✓ Removed version column from ${tableName}`);
            }
        } catch (e) { /* ignore */ }
    }

    console.log('✓ Rollback completed');
};

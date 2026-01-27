/**
 * Feature Flag Schema Refactoring - Unleash Style
 * 
 * Changes:
 * 1. g_feature_flags: Remove 'environment' column - flags are now global
 * 2. g_feature_flag_environments: NEW table for per-environment settings
 *    - Links flagId + environment
 *    - Contains isEnabled, strategies, variants per environment
 * 3. g_feature_strategies: Add 'environment' column (linked to flag environment settings)
 * 4. g_feature_variants: Add 'environment' column (linked to flag environment settings)
 * 5. g_feature_segments: Remove 'environment' column - segments are now global
 * 
 * After this migration:
 * - Feature flags, segments, context fields are GLOBAL
 * - Only strategies, variants, enabled state are PER-ENVIRONMENT
 */

exports.up = async function (connection) {
    console.log('Refactoring Feature Flags to Unleash-style schema...');
    const { ulid } = require('ulid');

    // Step 1: Get all environments
    const [environments] = await connection.execute(
        'SELECT DISTINCT environment FROM g_feature_flags'
    );
    console.log(`Found ${environments.length} environments: ${environments.map(e => e.environment).join(', ')}`);

    // Step 2: Create new g_feature_flag_environments table
    await connection.execute(`
        CREATE TABLE IF NOT EXISTS g_feature_flag_environments (
            id VARCHAR(26) PRIMARY KEY COMMENT 'ULID',
            flagId VARCHAR(26) NOT NULL COMMENT 'Reference to feature flag',
            environment VARCHAR(100) NOT NULL COMMENT 'Environment name',
            isEnabled BOOLEAN NOT NULL DEFAULT FALSE COMMENT 'Whether flag is enabled in this environment',
            lastSeenAt TIMESTAMP NULL COMMENT 'Last time flag was evaluated in this environment',
            createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY unique_flag_env (flagId, environment),
            INDEX idx_flag_id (flagId),
            INDEX idx_environment (environment),
            INDEX idx_is_enabled (isEnabled)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Per-environment feature flag settings'
    `);
    console.log('✓ Created g_feature_flag_environments table');

    // Step 3: Backup existing strategies/variants with their environment info
    // Add environment column to strategies table (temporary - to track which env they belong to)
    const [stratCols] = await connection.execute(
        "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'g_feature_strategies' AND COLUMN_NAME = 'environment'"
    );
    if (stratCols.length === 0) {
        await connection.execute(`
            ALTER TABLE g_feature_strategies 
            ADD COLUMN environment VARCHAR(100) NULL COMMENT 'Environment for this strategy' AFTER flagId
        `);
        console.log('✓ Added environment column to g_feature_strategies');
    }

    // Add environment column to variants table
    const [varCols] = await connection.execute(
        "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'g_feature_variants' AND COLUMN_NAME = 'environment'"
    );
    if (varCols.length === 0) {
        await connection.execute(`
            ALTER TABLE g_feature_variants 
            ADD COLUMN environment VARCHAR(100) NULL COMMENT 'Environment for this variant' AFTER flagId
        `);
        console.log('✓ Added environment column to g_feature_variants');
    }

    // Step 4: Update strategies and variants with environment info from their flags
    await connection.execute(`
        UPDATE g_feature_strategies s
        JOIN g_feature_flags f ON s.flagId = f.id
        SET s.environment = f.environment
        WHERE s.environment IS NULL
    `);
    console.log('✓ Updated strategies with environment info');

    await connection.execute(`
        UPDATE g_feature_variants v
        JOIN g_feature_flags f ON v.flagId = f.id
        SET v.environment = f.environment
        WHERE v.environment IS NULL
    `);
    console.log('✓ Updated variants with environment info');

    // Step 5: Get unique flags (by flagName)
    const [uniqueFlags] = await connection.execute(`
        SELECT flagName, 
               MIN(id) as firstId,
               MIN(displayName) as displayName,
               MIN(description) as description,
               MIN(flagType) as flagType,
               MIN(isArchived) as isArchived,
               MIN(archivedAt) as archivedAt,
               MIN(impressionDataEnabled) as impressionDataEnabled,
               MIN(staleAfterDays) as staleAfterDays,
               MIN(createdBy) as createdBy,
               MIN(createdAt) as createdAt,
               MIN(variantType) as variantType
        FROM g_feature_flags
        GROUP BY flagName
    `);
    console.log(`Found ${uniqueFlags.length} unique flags to consolidate`);

    // Step 6: Create mapping table (old id -> new id)
    const flagMapping = new Map(); // oldId -> { newFlagId, environment }
    const newFlagIds = new Map();  // flagName -> newFlagId

    // Step 7: Create new consolidated flags and environment settings
    for (const flag of uniqueFlags) {
        const newFlagId = ulid();
        newFlagIds.set(flag.flagName, newFlagId);

        // Get all instances of this flag across environments
        const [flagInstances] = await connection.execute(
            'SELECT id, environment, isEnabled, lastSeenAt FROM g_feature_flags WHERE flagName = ?',
            [flag.flagName]
        );

        for (const instance of flagInstances) {
            flagMapping.set(instance.id, {
                newFlagId,
                environment: instance.environment
            });

            // Create environment setting
            await connection.execute(`
                INSERT INTO g_feature_flag_environments (id, flagId, environment, isEnabled, lastSeenAt)
                VALUES (?, ?, ?, ?, ?)
            `, [ulid(), newFlagId, instance.environment, instance.isEnabled, instance.lastSeenAt]);
        }
    }
    console.log('✓ Created flag-environment mappings');

    // Step 8: Create temporary new flags table
    await connection.execute(`
        CREATE TABLE g_feature_flags_new (
            id VARCHAR(26) PRIMARY KEY COMMENT 'ULID',
            flagName VARCHAR(255) NOT NULL UNIQUE COMMENT 'Unique flag identifier',
            displayName VARCHAR(500) NULL COMMENT 'Human-readable name',
            description TEXT NULL COMMENT 'Flag description',
            flagType ENUM('release', 'experiment', 'operational', 'permission') NOT NULL DEFAULT 'release' COMMENT 'Type of flag',
            isArchived BOOLEAN NOT NULL DEFAULT FALSE COMMENT 'Whether flag is archived',
            archivedAt TIMESTAMP NULL COMMENT 'When flag was archived',
            impressionDataEnabled BOOLEAN NOT NULL DEFAULT FALSE COMMENT 'Track impression data',
            staleAfterDays INT NOT NULL DEFAULT 30 COMMENT 'Days until flag is considered stale',
            tags JSON NULL COMMENT 'Tags array for categorization',
            variantType ENUM('string', 'number', 'json') NULL COMMENT 'Variant payload type',
            createdBy INT NOT NULL,
            updatedBy INT NULL,
            createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            CONSTRAINT fk_feature_flags_new_created_by FOREIGN KEY (createdBy) REFERENCES g_users(id) ON DELETE RESTRICT,
            CONSTRAINT fk_feature_flags_new_updated_by FOREIGN KEY (updatedBy) REFERENCES g_users(id) ON DELETE SET NULL,
            INDEX idx_flag_name (flagName),
            INDEX idx_flag_type (flagType),
            INDEX idx_is_archived (isArchived),
            INDEX idx_created_by (createdBy)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Feature flag definitions (global)'
    `);
    console.log('✓ Created g_feature_flags_new table');

    // Step 9: Insert consolidated flags
    for (const flag of uniqueFlags) {
        const newFlagId = newFlagIds.get(flag.flagName);
        await connection.execute(`
            INSERT INTO g_feature_flags_new (id, flagName, displayName, description, flagType, isArchived, archivedAt, impressionDataEnabled, staleAfterDays, variantType, createdBy, createdAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [newFlagId, flag.flagName, flag.displayName, flag.description, flag.flagType, flag.isArchived, flag.archivedAt, flag.impressionDataEnabled, flag.staleAfterDays, flag.variantType, flag.createdBy, flag.createdAt]);
    }
    console.log('✓ Inserted consolidated flags');

    // Step 10: Drop FK constraints on strategies and variants
    try {
        await connection.execute('ALTER TABLE g_feature_strategies DROP FOREIGN KEY fk_feature_strategies_flag');
    } catch (e) { /* ignore if not exists */ }
    try {
        await connection.execute('ALTER TABLE g_feature_variants DROP FOREIGN KEY fk_feature_variants_flag');
    } catch (e) { /* ignore if not exists */ }
    console.log('✓ Dropped old foreign key constraints');

    // Step 11: Update strategies and variants with new flagIds
    for (const [oldId, mapping] of flagMapping) {
        await connection.execute(
            'UPDATE g_feature_strategies SET flagId = ? WHERE flagId = ?',
            [mapping.newFlagId, oldId]
        );
        await connection.execute(
            'UPDATE g_feature_variants SET flagId = ? WHERE flagId = ?',
            [mapping.newFlagId, oldId]
        );
    }
    console.log('✓ Updated strategies and variants with new flagIds');

    // Step 12: Drop old flags table and rename new one
    await connection.execute('DROP TABLE g_feature_flags');
    await connection.execute('RENAME TABLE g_feature_flags_new TO g_feature_flags');
    console.log('✓ Replaced g_feature_flags table');

    // Step 13: Add foreign key constraints back
    await connection.execute(`
        ALTER TABLE g_feature_flag_environments 
        ADD CONSTRAINT fk_flag_env_flag FOREIGN KEY (flagId) REFERENCES g_feature_flags(id) ON DELETE CASCADE
    `);
    await connection.execute(`
        ALTER TABLE g_feature_strategies 
        ADD CONSTRAINT fk_feature_strategies_flag FOREIGN KEY (flagId) REFERENCES g_feature_flags(id) ON DELETE CASCADE
    `);
    await connection.execute(`
        ALTER TABLE g_feature_variants 
        ADD CONSTRAINT fk_feature_variants_flag FOREIGN KEY (flagId) REFERENCES g_feature_flags(id) ON DELETE CASCADE
    `);
    console.log('✓ Added new foreign key constraints');

    // Step 14: Make environment NOT NULL on strategies and variants
    await connection.execute(`
        ALTER TABLE g_feature_strategies 
        MODIFY COLUMN environment VARCHAR(100) NOT NULL COMMENT 'Environment for this strategy'
    `);
    await connection.execute(`
        ALTER TABLE g_feature_variants 
        MODIFY COLUMN environment VARCHAR(100) NOT NULL COMMENT 'Environment for this variant'
    `);
    console.log('✓ Made environment columns NOT NULL');

    // Step 15: Update segments - remove environment column (make global)
    // First, deduplicate segments by name
    const [uniqueSegments] = await connection.execute(`
        SELECT segmentName, 
               MIN(id) as firstId,
               MIN(displayName) as displayName,
               MIN(description) as description,
               MIN(constraints) as constraints,
               MIN(isActive) as isActive,
               MIN(tags) as tags,
               MIN(createdBy) as createdBy,
               MIN(createdAt) as createdAt
        FROM g_feature_segments
        GROUP BY segmentName
    `);

    // Create new segments table without environment
    await connection.execute(`
        CREATE TABLE g_feature_segments_new (
            id VARCHAR(26) PRIMARY KEY COMMENT 'ULID',
            segmentName VARCHAR(255) NOT NULL UNIQUE COMMENT 'Unique segment identifier',
            displayName VARCHAR(500) NULL COMMENT 'Human-readable name',
            description TEXT NULL COMMENT 'Segment description',
            constraints JSON NOT NULL COMMENT 'Array of constraints [{contextName, operator, values}]',
            isActive BOOLEAN NOT NULL DEFAULT TRUE COMMENT 'Whether segment is active',
            tags JSON NULL COMMENT 'Tags array for categorization',
            createdBy INT NOT NULL,
            updatedBy INT NULL,
            createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            CONSTRAINT fk_feature_segments_new_created_by FOREIGN KEY (createdBy) REFERENCES g_users(id) ON DELETE RESTRICT,
            CONSTRAINT fk_feature_segments_new_updated_by FOREIGN KEY (updatedBy) REFERENCES g_users(id) ON DELETE SET NULL,
            INDEX idx_segment_name (segmentName),
            INDEX idx_is_active (isActive)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Reusable user segments (global)'
    `);

    // Create segment mapping (old id -> new id)
    const segmentMapping = new Map();
    for (const seg of uniqueSegments) {
        const newSegId = ulid();
        segmentMapping.set(seg.segmentName, newSegId);

        await connection.execute(`
            INSERT INTO g_feature_segments_new (id, segmentName, displayName, description, constraints, isActive, tags, createdBy, createdAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [newSegId, seg.segmentName, seg.displayName, seg.description, seg.constraints, seg.isActive, seg.tags, seg.createdBy, seg.createdAt]);
    }

    // Update flag_segments junction table
    const [oldSegments] = await connection.execute('SELECT DISTINCT segmentId FROM g_feature_flag_segments');
    for (const oldSeg of oldSegments) {
        const [segInfo] = await connection.execute('SELECT segmentName FROM g_feature_segments WHERE id = ?', [oldSeg.segmentId]);
        if (segInfo.length > 0) {
            const newSegId = segmentMapping.get(segInfo[0].segmentName);
            if (newSegId) {
                await connection.execute(
                    'UPDATE g_feature_flag_segments SET segmentId = ? WHERE segmentId = ?',
                    [newSegId, oldSeg.segmentId]
                );
            }
        }
    }

    // Drop FK on junction, swap tables
    try {
        await connection.execute('ALTER TABLE g_feature_flag_segments DROP FOREIGN KEY fk_flag_segments_segment');
    } catch (e) { /* ignore */ }

    await connection.execute('DROP TABLE g_feature_segments');
    await connection.execute('RENAME TABLE g_feature_segments_new TO g_feature_segments');

    await connection.execute(`
        ALTER TABLE g_feature_flag_segments 
        ADD CONSTRAINT fk_flag_segments_segment FOREIGN KEY (segmentId) REFERENCES g_feature_segments(id) ON DELETE CASCADE
    `);
    console.log('✓ Migrated segments to global');

    console.log('Feature Flags schema refactoring complete!');
};

exports.down = async function (connection) {
    console.log('This migration cannot be safely rolled back. Please restore from backup.');
    throw new Error('Rollback not supported for this migration');
};

/**
 * Remove stickiness column from g_feature_variants table
 * Stickiness should be managed at flag/strategy level, not per variant
 */

exports.up = async function (connection) {
    console.log('Removing stickiness column from g_feature_variants...');

    await connection.execute(`
    ALTER TABLE g_feature_variants
    DROP COLUMN stickiness
  `);

    console.log('✓ stickiness column removed from g_feature_variants');
};

exports.down = async function (connection) {
    console.log('Adding stickiness column back to g_feature_variants...');

    await connection.execute(`
    ALTER TABLE g_feature_variants
    ADD COLUMN stickiness VARCHAR(100) NOT NULL DEFAULT 'default' 
    COMMENT 'Stickiness attribute (userId, sessionId, default)'
    AFTER payloadType
  `);

    console.log('✓ stickiness column added back to g_feature_variants');
};

/**
 * Add links column to g_feature_flags table
 * Links allow users to attach external resources like issue trackers, docs, etc.
 */

exports.up = async function (connection) {
    console.log('Adding links column to g_feature_flags table...');

    await connection.execute(`
    ALTER TABLE g_feature_flags
    ADD COLUMN links JSON NULL
    COMMENT 'JSON array of links: [{url, title?}]' AFTER tags
  `);

    console.log('✓ links column added to g_feature_flags table');
};

exports.down = async function (connection) {
    console.log('Removing links column from g_feature_flags table...');

    await connection.execute(`
    ALTER TABLE g_feature_flags
    DROP COLUMN links
  `);

    console.log('✓ links column removed from g_feature_flags table');
};

/**
 * 009 - Fix g_signals column names to match model
 *
 * Original columns: endpointId, tokenId, signalType
 * Model expects:    source, sourceId, createdByTokenId
 *
 * Rename columns to match the model interface.
 */

exports.up = async function (connection) {
    console.log('[009] Fixing g_signals column names...');

    // Check if column needs renaming (old schema has endpointId)
    const [columns] = await connection.execute(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'g_signals' AND COLUMN_NAME = 'endpointId'`
    );

    if (columns.length > 0) {
        // Rename endpointId -> sourceId
        await connection.execute(`
      ALTER TABLE g_signals CHANGE COLUMN endpointId sourceId CHAR(26) NOT NULL
    `);
        console.log('  ??g_signals: endpointId -> sourceId');

        // Rename tokenId -> createdByTokenId
        await connection.execute(`
      ALTER TABLE g_signals CHANGE COLUMN tokenId createdByTokenId CHAR(26) NULL
    `);
        console.log('  ??g_signals: tokenId -> createdByTokenId');

        // Rename signalType -> source
        await connection.execute(`
      ALTER TABLE g_signals CHANGE COLUMN signalType source VARCHAR(100) NOT NULL
    `);
        console.log('  ??g_signals: signalType -> source');

        // Drop sourceIp column (not used in model)
        const [ipCol] = await connection.execute(
            `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'g_signals' AND COLUMN_NAME = 'sourceIp'`
        );
        if (ipCol.length > 0) {
            await connection.execute(`ALTER TABLE g_signals DROP COLUMN sourceIp`);
            console.log('  ??g_signals: dropped sourceIp');
        }
    } else {
        console.log('  ??g_signals: columns already correct, skipping');
    }

    console.log('[009] ??g_signals columns fixed');
};

exports.down = async function (connection) {
    const [columns] = await connection.execute(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'g_signals' AND COLUMN_NAME = 'sourceId'`
    );

    if (columns.length > 0) {
        await connection.execute(`
      ALTER TABLE g_signals CHANGE COLUMN source signalType VARCHAR(100) NOT NULL
    `);
        await connection.execute(`
      ALTER TABLE g_signals CHANGE COLUMN createdByTokenId tokenId CHAR(26) NULL
    `);
        await connection.execute(`
      ALTER TABLE g_signals CHANGE COLUMN sourceId endpointId CHAR(26) NOT NULL
    `);
        await connection.execute(`
      ALTER TABLE g_signals ADD COLUMN sourceIp VARCHAR(45) NULL AFTER isProcessed
    `);
    }
};

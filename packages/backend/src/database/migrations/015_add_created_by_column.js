/**
 * Migration: Add createdBy column to g_service_notices and afterData/beforeData to g_change_items
 * 
 * This migration adds:
 * 1. createdBy column to g_service_notices to track who created each service notice.
 * 2. afterData and beforeData columns to g_change_items for storing full entity snapshots.
 */

exports.up = async function (connection) {
    // === g_service_notices: Add createdBy column ===
    console.log('Checking createdBy column in g_service_notices...');

    const [serviceNoticesCols] = await connection.execute(`
    SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'g_service_notices' AND COLUMN_NAME = 'createdBy'
  `);

    if (serviceNoticesCols.length === 0) {
        await connection.execute(`
      ALTER TABLE g_service_notices 
      ADD COLUMN createdBy INT NULL AFTER updatedAt
    `);
        console.log('createdBy column added to g_service_notices');
    } else {
        console.log('createdBy column already exists in g_service_notices, skipping...');
    }

    // === g_change_items: Add afterData column ===
    console.log('Checking afterData column in g_change_items...');

    const [afterDataCols] = await connection.execute(`
    SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'g_change_items' AND COLUMN_NAME = 'afterData'
  `);

    if (afterDataCols.length === 0) {
        await connection.execute(`
      ALTER TABLE g_change_items 
      ADD COLUMN afterData JSON NULL AFTER targetId
    `);
        console.log('afterData column added to g_change_items');
    } else {
        console.log('afterData column already exists in g_change_items, skipping...');
    }

    // === g_change_items: Add beforeData column ===
    console.log('Checking beforeData column in g_change_items...');

    const [beforeDataCols] = await connection.execute(`
    SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'g_change_items' AND COLUMN_NAME = 'beforeData'
  `);

    if (beforeDataCols.length === 0) {
        await connection.execute(`
      ALTER TABLE g_change_items 
      ADD COLUMN beforeData JSON NULL AFTER afterData
    `);
        console.log('beforeData column added to g_change_items');
    } else {
        console.log('beforeData column already exists in g_change_items, skipping...');
    }

    console.log('Migration completed successfully');
};

exports.down = async function (connection) {
    console.log('Removing added columns...');

    // Drop createdBy from g_service_notices
    const [serviceNoticesCols] = await connection.execute(`
    SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'g_service_notices' AND COLUMN_NAME = 'createdBy'
  `);

    if (serviceNoticesCols.length > 0) {
        await connection.execute(`
      ALTER TABLE g_service_notices 
      DROP COLUMN createdBy
    `);
        console.log('createdBy column removed from g_service_notices');
    }

    // Drop afterData from g_change_items
    const [afterDataCols] = await connection.execute(`
    SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'g_change_items' AND COLUMN_NAME = 'afterData'
  `);

    if (afterDataCols.length > 0) {
        await connection.execute(`
      ALTER TABLE g_change_items 
      DROP COLUMN afterData
    `);
        console.log('afterData column removed from g_change_items');
    }

    // Drop beforeData from g_change_items
    const [beforeDataCols] = await connection.execute(`
    SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'g_change_items' AND COLUMN_NAME = 'beforeData'
  `);

    if (beforeDataCols.length > 0) {
        await connection.execute(`
      ALTER TABLE g_change_items 
      DROP COLUMN beforeData
    `);
        console.log('beforeData column removed from g_change_items');
    }

    console.log('Columns removed successfully');
};

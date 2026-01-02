/**
 * Migration: Add fileDiffs column to planningDataUploads table
 */

exports.up = async function (connection) {
    console.log('Adding fileDiffs column to planningDataUploads...');

    await connection.execute(`
    ALTER TABLE planningDataUploads 
    ADD COLUMN fileDiffs JSON NULL COMMENT 'Detailed diff for each changed file' 
    AFTER changedFiles
  `);

    console.log('✓ fileDiffs column added');
};

exports.down = async function (connection) {
    console.log('Removing fileDiffs column from planningDataUploads...');
    await connection.execute('ALTER TABLE planningDataUploads DROP COLUMN fileDiffs');
    console.log('✓ fileDiffs column removed');
};

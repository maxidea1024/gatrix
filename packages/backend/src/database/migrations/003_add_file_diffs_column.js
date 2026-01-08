/**
 * Migration: Add fileDiffs column to planningDataUploads table
 */

exports.up = async function (connection) {
  console.log('Adding fileDiffs column to planningDataUploads...');

  // Check if column already exists
  const [columns] = await connection.execute(`
        SHOW COLUMNS FROM planningDataUploads LIKE 'fileDiffs'
    `);

  if (columns.length === 0) {
    await connection.execute(`
            ALTER TABLE planningDataUploads 
            ADD COLUMN fileDiffs JSON NULL COMMENT 'Detailed diff for each changed file' 
            AFTER changedFiles
        `);
    console.log('✓ fileDiffs column added');
  } else {
    console.log('⏭ fileDiffs column already exists, skipping...');
  }
};

exports.down = async function (connection) {
  console.log('Removing fileDiffs column from planningDataUploads...');
  await connection.execute('ALTER TABLE planningDataUploads DROP COLUMN fileDiffs');
  console.log('✓ fileDiffs column removed');
};

module.exports = {
    name: 'add_is_pinned_to_service_notices',
    async up(connection) {
        // Check if column exists
        const [rows] = await connection.query(`
      SELECT COUNT(*) as count 
      FROM information_schema.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'g_service_notices' 
      AND COLUMN_NAME = 'isPinned'
    `);

        if (rows[0].count === 0) {
            // Add isPinned column after isActive
            await connection.query(`
        ALTER TABLE g_service_notices 
        ADD COLUMN isPinned BOOLEAN NOT NULL DEFAULT 0 AFTER isActive
      `);
        }
    },
    async down(connection) {
        const [rows] = await connection.query(`
      SELECT COUNT(*) as count 
      FROM information_schema.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'g_service_notices' 
      AND COLUMN_NAME = 'isPinned'
    `);

        if (rows[0].count > 0) {
            await connection.query('ALTER TABLE g_service_notices DROP COLUMN isPinned');
        }
    }
};

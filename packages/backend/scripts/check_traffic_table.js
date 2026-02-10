require('ts-node/register');
const db = require('../src/config/knex').default;

async function checkTable() {
    try {
        const [rows] = await db.raw("SHOW TABLES LIKE 'g_network_traffic'");
        console.log('g_network_traffic exists:', rows.length > 0);
    } catch (error) {
        console.error('Error checking table:', error);
    } finally {
        await db.destroy();
    }
}

checkTable();

require('ts-node/register');
const db = require('../src/config/knex').default;

async function checkTrafficTable() {
    try {
        const [rows] = await db.raw("SHOW TABLES LIKE 'NetworkTraffic'");
        console.log('NetworkTraffic exists:', rows.length > 0);
    } catch (error) {
        console.error('Error checking table:', error);
    } finally {
        await db.destroy();
    }
}

checkTrafficTable();

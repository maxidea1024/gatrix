require('ts-node/register');
const db = require('../src/config/knex').default;

async function listTables() {
    try {
        const [rows] = await db.raw('SHOW TABLES');
        console.log('Tables in database:', rows.map(r => Object.values(r)[0]));
    } catch (error) {
        console.error('Error listing tables:', error);
    } finally {
        await db.destroy();
    }
}

listTables();

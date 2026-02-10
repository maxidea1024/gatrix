require('ts-node/register');
const db = require('../src/config/knex').default;

async function checkUser() {
    try {
        const [rows] = await db.raw('SELECT * FROM g_users WHERE id = 1');
        console.log('User 1:', rows);
    } catch (error) {
        console.error('Error checking user:', error);
    } finally {
        await db.destroy();
    }
}

checkUser();

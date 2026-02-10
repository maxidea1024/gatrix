require('ts-node/register');
const db = require('../src/config/knex').default;

async function listMigrations() {
    try {
        const rows = await db('g_migrations').select('*').orderBy('id');
        console.log('Migrations in DB:', rows.map(r => r.id));
    } catch (error) {
        console.error('Error listing migrations:', error);
    } finally {
        await db.destroy();
    }
}

listMigrations();

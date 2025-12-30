import knex from './src/config/knex';

async function listDatabases() {
    try {
        const [databases] = await knex.raw('SHOW DATABASES');
        console.log('Databases:', databases.map((db: any) => db.Database).join(', '));
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await knex.destroy();
    }
}

listDatabases();

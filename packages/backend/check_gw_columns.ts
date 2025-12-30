import knex from './src/config/knex';

async function checkGameWorlds() {
    try {
        const columns = await knex('g_game_worlds').columnInfo();
        console.log('Columns in g_game_worlds:', Object.keys(columns).join(', '));
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await knex.destroy();
    }
}

checkGameWorlds();

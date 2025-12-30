import knex from './src/config/knex';

async function listColumns() {
    try {
        const [tables] = await knex.raw('SHOW TABLES');
        const tableNames = tables.map((t: any) => Object.values(t)[0]);

        for (const tableName of tableNames) {
            const [columns] = await knex.raw(`SHOW COLUMNS FROM ${tableName}`);
            const hasEnvId = columns.some((c: any) => c.Field === 'environmentId');
            const hasEnv = columns.some((c: any) => c.Field === 'environment');

            if (hasEnvId || hasEnv) {
                console.log(`Table: ${tableName}`);
                console.log(`  Columns: ${columns.map((c: any) => c.Field).join(', ')}`);
            }
        }
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await knex.destroy();
    }
}

listColumns();

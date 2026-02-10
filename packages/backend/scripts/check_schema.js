require('ts-node/register');
const db = require('../src/config/knex').default;

async function checkSchema() {
    try {
        console.log('\n--- g_feature_variants ---');
        const variants = await db.raw('DESCRIBE g_feature_variants');
        variants[0].forEach(col => console.log(`${col.Field}: ${col.Type}`));

        console.log('\n--- g_feature_flags ---');
        const flags = await db.raw('DESCRIBE g_feature_flags');
        flags[0].forEach(col => console.log(`${col.Field}: ${col.Type}`));

        console.log('\n--- g_feature_flag_environments ---');
        const envs = await db.raw('DESCRIBE g_feature_flag_environments');
        envs[0].forEach(col => console.log(`${col.Field}: ${col.Type}`));

    } catch (error) {
        console.error(error);
    } finally {
        await db.destroy();
    }
}


checkSchema();

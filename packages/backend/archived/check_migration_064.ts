import { knexConfig } from '../src/config/knex';
import Knex from 'knex';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from root .env
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function main() {
    // Override DB connection for local execution against Docker
    const config = { ...knexConfig };
    if (config.connection && typeof config.connection !== 'string' && typeof config.connection !== 'function') {
        (config.connection as any).host = '127.0.0.1';
        (config.connection as any).port = 43306;
        (config.connection as any).user = 'gatrix_user';
        (config.connection as any).password = 'gatrix_password';
        (config.connection as any).database = 'gatrix';
    }

    const knex = Knex(config);

    try {
        console.log('=== Checking Migration 064 Status ===\n');

        // 1. Check if migration is recorded as executed
        console.log('1. Checking g_migrations table...');
        const migrations = await knex('g_migrations')
            .where('id', 'like', '%064%')
            .select('*');
        console.log('   Migration records:', migrations);

        // 2. Check if isHidden column exists
        console.log('\n2. Checking if isHidden column exists in g_environments...');
        const columns = await knex.raw(`
            SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'g_environments' AND COLUMN_NAME = 'isHidden'
        `);
        console.log('   isHidden column exists:', columns[0].length > 0);

        // 3. Check if gatrix-env exists
        console.log('\n3. Checking if gatrix-env environment exists...');
        const gatrixEnv = await knex('g_environments')
            .where('environmentName', 'gatrix-env')
            .first();
        console.log('   gatrix-env:', gatrixEnv ? 'EXISTS' : 'NOT FOUND');
        if (gatrixEnv) {
            console.log('   Details:', {
                id: gatrixEnv.id,
                displayName: gatrixEnv.displayName,
                isHidden: gatrixEnv.isHidden,
                isSystemDefined: gatrixEnv.isSystemDefined
            });
        }

        // 4. List all environments
        console.log('\n4. All environments:');
        const allEnvs = await knex('g_environments').select('id', 'environmentName', 'displayName', 'isHidden', 'isSystemDefined');
        allEnvs.forEach(env => console.log('   -', env.environmentName, '| isHidden:', env.isHidden, '| isSystemDefined:', env.isSystemDefined));

    } catch (error) {
        console.error('Unexpected error:', error);
    } finally {
        await knex.destroy();
    }
}

main();


const mysql = require('mysql2/promise');

async function run() {
    const config = {
        host: 'localhost',
        user: 'root',
        password: 'gatrix_rootpassword',
        database: 'gatrix'
    };

    console.log(`Connecting to database ${config.database}...`);

    let conn;
    try {
        conn = await mysql.createConnection(config);
    } catch (err) {
        console.error('Connection failed:', err);
        process.exit(1);
    }

    try {
        await conn.execute('SET FOREIGN_KEY_CHECKS = 0');

        const tables = ['g_change_requests', 'g_change_items', 'g_action_groups', 'g_approvals'];
        for (const table of tables) {
            try {
                await conn.execute(`TRUNCATE TABLE ${table}`);
                console.log(`Truncated ${table}`);
            } catch (e) {
                console.log(`Error truncating ${table}:`, e.message);
            }
        }

        await conn.execute('SET FOREIGN_KEY_CHECKS = 1');
        console.log('All tables truncated successfully.');
    } finally {
        if (conn) await conn.end();
    }
}

run().catch(console.error);

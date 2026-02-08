const knex = require('knex');

const db = knex({
  client: 'mysql2',
  connection: {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'password',
    database: process.env.DB_NAME || 'gatrix_chat',
  },
});

async function checkTokens() {
  try {
    console.log('Checking API tokens in database...');

    const tokens = await db('chat_api_tokens').select('*');

    console.log('Found tokens:');
    tokens.forEach((token) => {
      console.log({
        id: token.id,
        name: token.name,
        token: token.token.substring(0, 20) + '...',
        permissions: token.permissions,
        permissionsType: typeof token.permissions,
        isActive: token.isActive,
      });
    });
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await db.destroy();
  }
}

checkTokens();

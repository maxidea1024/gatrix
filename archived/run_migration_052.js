const knex = require('knex')({
  client: 'mysql2',
  connection: {
    host: 'gatrix-mysql-dev',
    user: 'root',
    password: 'root',
    database: 'gatrix',
  },
});

async function run() {
  const conn = await knex.client.pool.acquire().promise;

  // Create g_user_environments table
  await conn.execute(`
    CREATE TABLE IF NOT EXISTS g_user_environments (
      id INT AUTO_INCREMENT PRIMARY KEY,
      userId INT NOT NULL,
      environmentId CHAR(26) NOT NULL,
      createdBy INT NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uk_user_environment (userId, environmentId),
      INDEX idx_user_id (userId),
      INDEX idx_environment_id (environmentId),
      CONSTRAINT fk_user_environments_user FOREIGN KEY (userId) REFERENCES g_users(id) ON DELETE CASCADE,
      CONSTRAINT fk_user_environments_env FOREIGN KEY (environmentId) REFERENCES g_remote_config_environments(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  console.log('Created g_user_environments table');

  // Check if column exists
  const [cols] = await conn.execute(`SHOW COLUMNS FROM g_users LIKE 'allowAllEnvironments'`);
  if (cols.length === 0) {
    await conn.execute(
      `ALTER TABLE g_users ADD COLUMN allowAllEnvironments BOOLEAN NOT NULL DEFAULT FALSE`
    );
    console.log('Added allowAllEnvironments column');
  } else {
    console.log('allowAllEnvironments column already exists');
  }

  // Set for admin
  await conn.execute(
    `UPDATE g_users SET allowAllEnvironments = TRUE WHERE email = 'admin@gatrix.com'`
  );
  console.log('Set allowAllEnvironments for admin@gatrix.com');

  knex.client.pool.release(conn);
  await knex.destroy();
  console.log('Migration complete');
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});

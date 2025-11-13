exports.up = async function(knex) {
  // Add missing columns to chat_users to align with models/services
  const hasTable = await knex.schema.hasTable('chat_users');
  if (!hasTable) return;

  // Helper to conditionally add a column
  const addColumnIfNotExists = async (tableName, columnName, cb) => {
    const exists = await knex.schema.hasColumn(tableName, columnName);
    if (!exists) {
      await knex.schema.alterTable(tableName, cb);
    }
  };

  // name (string)
  await addColumnIfNotExists('chat_users', 'name', (table) => {
    table.string('name', 255).nullable();
  });

  // avatarUrl (string)
  await addColumnIfNotExists('chat_users', 'avatarUrl', (table) => {
    table.string('avatarUrl', 500).nullable();
  });

  // role (enum)
  await addColumnIfNotExists('chat_users', 'role', (table) => {
    table.enum('role', ['admin', 'user']).defaultTo('user');
  });

  // status (enum)
  await addColumnIfNotExists('chat_users', 'status', (table) => {
    table.enum('status', ['active', 'pending', 'suspended']).defaultTo('active');
  });

  // chatStatus (enum)
  await addColumnIfNotExists('chat_users', 'chatStatus', (table) => {
    table.enum('chatStatus', ['online', 'offline', 'away', 'busy']).defaultTo('offline');
  });

  // customStatus (string)
  await addColumnIfNotExists('chat_users', 'customStatus', (table) => {
    table.string('customStatus', 255).nullable();
  });

  // lastLoginAt (timestamp)
  await addColumnIfNotExists('chat_users', 'lastLoginAt', (table) => {
    table.timestamp('lastLoginAt').nullable();
  });

  // lastActivityAt (timestamp)
  await addColumnIfNotExists('chat_users', 'lastActivityAt', (table) => {
    table.timestamp('lastActivityAt').nullable();
  });
};

exports.down = async function(knex) {
  const hasTable = await knex.schema.hasTable('chat_users');
  if (!hasTable) return;

  await knex.schema.alterTable('chat_users', (table) => {
    // Drop in reverse order to be safe
    table.dropColumn('lastActivityAt');
    table.dropColumn('lastLoginAt');
    table.dropColumn('customStatus');
    table.dropColumn('chatStatus');
    table.dropColumn('status');
    table.dropColumn('role');
    table.dropColumn('avatarUrl');
    table.dropColumn('name');
  });
};


exports.up = async function(knex) {
  const hasTable = await knex.schema.hasTable('chat_users');
  if (!hasTable) return;

  const hasName = await knex.schema.hasColumn('chat_users', 'name');
  if (!hasName) {
    await knex.schema.alterTable('chat_users', (table) => {
      table.string('name', 255).nullable().after('email');
    });
  }
};

exports.down = async function(knex) {
  const hasTable = await knex.schema.hasTable('chat_users');
  if (!hasTable) return;

  const hasName = await knex.schema.hasColumn('chat_users', 'name');
  if (hasName) {
    await knex.schema.alterTable('chat_users', (table) => {
      table.dropColumn('name');
    });
  }
};


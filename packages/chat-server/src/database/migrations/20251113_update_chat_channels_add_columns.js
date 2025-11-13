exports.up = async function(knex) {
  const tableName = 'chat_channels';
  const hasTable = await knex.schema.hasTable(tableName);
  if (!hasTable) return;

  const addIfMissing = async (col, cb) => {
    const exists = await knex.schema.hasColumn(tableName, col);
    if (!exists) {
      await knex.schema.alterTable(tableName, cb);
    }
  };

  // isArchived flag
  await addIfMissing('isArchived', (table) => {
    table.boolean('isArchived').defaultTo(false);
  });

  // archiveReason text
  await addIfMissing('archiveReason', (table) => {
    table.text('archiveReason').nullable();
  });

  // avatarUrl
  await addIfMissing('avatarUrl', (table) => {
    table.string('avatarUrl', 500).nullable();
  });

  // settings JSON
  await addIfMissing('settings', (table) => {
    table.json('settings').nullable();
  });

  // maxMembers
  await addIfMissing('maxMembers', (table) => {
    table.integer('maxMembers').unsigned().defaultTo(1000);
  });

  // name (alias for channelName)
  await addIfMissing('name', (table) => {
    table.string('name', 255).nullable().after('id');
  });
};

exports.down = async function(knex) {
  const tableName = 'chat_channels';
  const hasTable = await knex.schema.hasTable(tableName);
  if (!hasTable) return;

  await knex.schema.alterTable(tableName, (table) => {
    table.dropColumn('name');
    table.dropColumn('maxMembers');
    table.dropColumn('settings');
    table.dropColumn('avatarUrl');
    table.dropColumn('archiveReason');
    table.dropColumn('isArchived');
  });
};


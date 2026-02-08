/**
 * Migration: Seed system KVs for predefined environments
 */

const SYSTEM_KVS = [
  {
    key: '$clientVersionPassiveData',
    value: '{}',
    valueType: 'object',
    description: 'Passive data sent with client version info queries from client SDK',
    isCopyable: 0,
  },
  {
    key: '$platforms',
    value: JSON.stringify([
      { label: 'PC', value: 'pc' },
      { label: 'PC-WeGame', value: 'pc-wegame' },
      { label: 'iOS', value: 'ios' },
      { label: 'Android', value: 'android' },
      { label: 'HarmonyOS', value: 'harmonyos' },
    ]),
    valueType: 'array',
    description:
      '[elementType:object] Platform definitions with label and value. Used for platform selection in UI.',
    isCopyable: 0,
  },
  {
    key: '$channels',
    value: JSON.stringify([
      {
        label: 'PC',
        value: 'pc',
        subChannels: [{ label: 'PC', value: 'pc' }],
      },
      {
        label: 'iOS',
        value: 'ios',
        subChannels: [{ label: 'iOS', value: 'ios' }],
      },
    ]),
    valueType: 'array',
    description:
      '[elementType:object] Channel definitions with label, value, and subChannels. Used for channel selection in UI.',
    isCopyable: 0,
  },
];

exports.up = async function (connection) {
  console.log('Seeding system KVs for predefined environments...');

  // Get IDs for system environments
  const [envs] = await connection.execute(`
    SELECT id, environmentName FROM g_environments 
    WHERE environmentName IN ('development', 'qa', 'production')
  `);

  if (envs.length === 0) {
    console.log('No system environments found, skipping KV seed.');
    return;
  }

  for (const env of envs) {
    console.log(`Seeding KVs for ${env.environmentName} (${env.id})...`);

    for (const kv of SYSTEM_KVS) {
      // Check if exists
      const [existing] = await connection.execute(
        `
        SELECT id FROM g_vars 
        WHERE varKey = ? AND environmentId = ?
      `,
        [kv.key, env.id]
      );

      if (existing.length === 0) {
        await connection.execute(
          `
          INSERT INTO g_vars (environmentId, varKey, varValue, valueType, description, isSystemDefined, isCopyable, createdBy, createdAt, updatedAt)
          VALUES (?, ?, ?, ?, ?, TRUE, ?, 1, NOW(), NOW())
        `,
          [env.id, kv.key, kv.value, kv.valueType, kv.description, kv.isCopyable]
        );
        console.log(`  + Created ${kv.key}`);
      } else {
        // Update system definition flags just in case
        await connection.execute(
          `
          UPDATE g_vars 
          SET isSystemDefined = TRUE, description = ?
          WHERE id = ?
        `,
          [kv.description, existing[0].id]
        );
        console.log(`  . Updated ${kv.key}`);
      }
    }
  }

  console.log('System KV seed completed.');
};

exports.down = async function (connection) {
  console.log('Rolling back system KV seed...');
  // We don't necessarily want to delete these on rollback as they might be used
  // But strictly speaking, looking at migration reversible nature:
  // We could delete them if they match exact default values, but risk data loss.
  // Skipping deletion for safety.
  console.log('Skipping deletion of KVs to prevent data loss.');
};

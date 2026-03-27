/**
 * Quick check: what does the getFlag API actually return for isEnabled per environment?
 */
const path = require('path');
process.chdir(path.join(__dirname, 'packages/backend'));
require('dotenv').config({ path: '.env' });
const knex = require('knex');

async function main() {
  const db = knex({
    client: 'mysql2',
    connection: {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '3306'),
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'gatrix',
    },
  });

  try {
    // Get all feature flags and their environment settings
    const flags = await db('g_feature_flags').select('id', 'flagName').limit(5);
    console.log('=== Feature Flags ===');
    for (const flag of flags) {
      console.log(`\nFlag: ${flag.flagName} (id: ${flag.id})`);
      const envSettings = await db('g_feature_flag_environments')
        .where('flagId', flag.id)
        .select('environmentId', 'isEnabled');
      for (const env of envSettings) {
        console.log(`  env: ${env.environmentId} => isEnabled: ${env.isEnabled} (type: ${typeof env.isEnabled})`);
      }
    }

    // Check if any CRs reference these flags
    const items = await db('g_change_items')
      .where('targetTable', 'g_feature_flags')
      .select('targetId', 'changeRequestId', 'draftData');

    console.log('\n=== Change Items for feature flags ===');
    for (const item of items) {
      const cr = await db('g_change_requests').where('id', item.changeRequestId).select('status', 'title').first();
      const dd = typeof item.draftData === 'string' ? JSON.parse(item.draftData) : item.draftData;
      console.log(`targetId: ${item.targetId} | CR status: ${cr?.status} | title: ${cr?.title}`);
      if (dd) {
        const keys = Object.keys(dd);
        console.log(`  draftData keys: ${keys.join(', ')}`);
        for (const [k, v] of Object.entries(dd)) {
          if (typeof v === 'object' && v !== null && (v as any).isEnabled !== undefined) {
            console.log(`  ${k}.isEnabled = ${(v as any).isEnabled}`);
          }
        }
      }
    }
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await db.destroy();
  }
}

main();

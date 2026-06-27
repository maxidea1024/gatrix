/**
 * Quick Activities-Only Simulator
 *
 * Inserts product analytics activities data into ClickHouse
 * without touching other tables (errors, transactions, etc.)
 *
 * Usage: npx tsx scripts/simulate-activities.ts
 */
import { createClient } from '@clickhouse/client';
import { CH_CONFIG } from './simulate/config';
import { generateAndInsertActivities } from './simulate/activities';

async function main() {
  console.log('📊 Argus Activities Simulator (Product Analytics)');
  console.log('═'.repeat(50));

  const ch = createClient({
    url: CH_CONFIG.url,
    database: CH_CONFIG.database,
    username: CH_CONFIG.username,
    password: CH_CONFIG.password,
    clickhouse_settings: {
      date_time_input_format: 'best_effort',
      max_insert_block_size: 100000,
    },
  });

  // Truncate activities only
  console.log('\n🗑️  Truncating activities table...');
  try {
    await ch.exec({
      query: `TRUNCATE TABLE IF EXISTS ${CH_CONFIG.database}.activities`,
    });
    console.log('   ✓ activities truncated');
  } catch {
    console.log('   ⚠ activities table not found (skip)');
  }

  // Generate and insert
  const count = await generateAndInsertActivities(ch);

  await ch.close();
  console.log('\n═'.repeat(50));
  console.log(`✅ Done! ${count.toLocaleString()} activities inserted.`);
  console.log('   Refresh the Argus Analytics pages to see data.');
}

main().catch((e) => {
  console.error('❌ Fatal error:', e);
  process.exit(1);
});

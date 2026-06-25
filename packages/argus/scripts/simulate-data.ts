/**
 * Argus Data Simulator — Online Game (NodeJS / Lua / UE4) Production-Grade Data
 *
 * Generates realistic error events, structured logs, transactions, sessions,
 * and user feedback for an online game MMO production environment.
 *
 * Usage: npx tsx scripts/simulate-data.ts
 */

import { createClient } from '@clickhouse/client';
import mysql from 'mysql2/promise';

import {
  MYSQL_CONFIG,
  CH_CONFIG,
  PROJECT_ID,
  DAYS_BACK,
  TOTAL_ERROR_EVENTS,
  TOTAL_TRANSACTIONS,
  TOTAL_SESSIONS,
  TOTAL_FEEDBACK,
  USERS,
  SCENARIOS,
  truncateClickHouse,
  truncateMySQL,
  generateErrorEvents,
  insertIssuesIntoMySQL,
  insertEventsIntoClickHouse,
  generateAndInsertLogs,
  generateAndInsertTransactions,
  generateAndInsertSessions,
  generateAndInsertFeedback,
  generateAndInsertMetrics,
  generateAndInsertActivities,
} from './simulate';

async function main() {
  console.log('🎮 Argus Data Simulator — Online Game (NodeJS / Lua / UE4)');
  console.log('═'.repeat(60));
  console.log(
    `   Scale: ${(TOTAL_ERROR_EVENTS / 1000).toFixed(0)}K events, ${(TOTAL_TRANSACTIONS / 1000).toFixed(0)}K txns, ${(TOTAL_SESSIONS / 1000).toFixed(0)}K sessions, ${TOTAL_FEEDBACK} feedback`
  );
  console.log(
    `   Users: ${USERS.length.toLocaleString()}, Period: ${DAYS_BACK} days`
  );
  console.log(`   Scenarios: ${SCENARIOS.length} unique error types`);
  console.log('');

  // Connect
  const pool = mysql.createPool({ ...MYSQL_CONFIG, connectionLimit: 10 });
  const ch = createClient({
    url: CH_CONFIG.url,
    database: CH_CONFIG.database,
    username: CH_CONFIG.username,
    password: CH_CONFIG.password,
    clickhouse_settings: {
      date_time_input_format: 'best_effort',
      max_insert_block_size: '100000' as any,
    },
  });

  // ──────── 1. TRUNCATE ALL DATA ────────
  console.log('🗑️  Truncating all existing data...');
  await truncateClickHouse(ch);
  await truncateMySQL(pool);

  // ──────── 2. FETCH DSN KEYS ────────
  console.log('\n🔑 Fetching DSN keys from MySQL...');
  let dsnKeyRows: any[] = [];
  try {
    const [rows] = await pool.query(
      'SELECT id, is_active FROM g_argus_dsn_keys WHERE project_id = ?',
      [PROJECT_ID]
    );
    dsnKeyRows = rows as any[];
  } catch (e) {
    console.log('   ⚠ Error fetching DSN keys (table missing?).');
  }
  const activeDsnKeys: number[] = (dsnKeyRows as any[])
    .filter((k: any) => k.is_active)
    .map((k: any) => k.id);
  if (activeDsnKeys.length === 0) {
    console.log('   ⚠ No active DSN keys found. Events will use dsn_key_id=0.');
    activeDsnKeys.push(0);
  } else {
    console.log(
      `   ✓ Found ${activeDsnKeys.length} active DSN keys: [${activeDsnKeys.join(', ')}]`
    );
  }
  const dsnKeyTimestamps = new Map<number, { min: Date; max: Date }>();

  // ──────── 3. GENERATE EVENTS ────────
  console.log('\n🎲 Generating error events...');
  const { allEvents, issueMap } = generateErrorEvents(activeDsnKeys, dsnKeyTimestamps, TOTAL_ERROR_EVENTS);
  console.log(`   ✓ ${allEvents.length.toLocaleString()} error events generated`);
  console.log(`   ✓ ${issueMap.size} unique issues`);

  // ──────── 4. INSERT ISSUES INTO MYSQL ────────
  await insertIssuesIntoMySQL(pool, issueMap);

  // ──────── 5. INSERT EVENTS INTO CLICKHOUSE ────────
  await insertEventsIntoClickHouse(ch, allEvents, CH_CONFIG.database);

  // ──────── 6. GENERATE & INSERT LOGS ────────
  await generateAndInsertLogs(ch, CH_CONFIG.database, allEvents, issueMap);

  // ──────── 7. GENERATE & INSERT TRANSACTIONS ────────
  await generateAndInsertTransactions(ch, CH_CONFIG.database, TOTAL_TRANSACTIONS, activeDsnKeys);

  // ──────── 8. GENERATE & INSERT SESSIONS ────────
  await generateAndInsertSessions(ch, CH_CONFIG.database, TOTAL_SESSIONS, activeDsnKeys);

  // ──────── 9. GENERATE & INSERT FEEDBACK ────────
  await generateAndInsertFeedback(ch, CH_CONFIG.database, TOTAL_FEEDBACK, activeDsnKeys, allEvents);

  // ──────── 10. GENERATE & INSERT METRICS ────────
  await generateAndInsertMetrics(ch, CH_CONFIG.database, 10000);

  // ──────── 11. UPDATE DSN KEY first_seen/last_seen ────────
  console.log('\n🔑 Updating DSN key timestamps...');
  for (const [keyId, timestamps] of dsnKeyTimestamps) {
    if (keyId === 0) continue;
    try {
      await pool.query(
        `UPDATE g_argus_dsn_keys SET first_seen_at = ?, last_seen_at = ? WHERE id = ?`,
        [timestamps.min, timestamps.max, keyId]
      );
    } catch {
      // skip
    }
  }
  console.log(`   ✓ Updated ${dsnKeyTimestamps.size} DSN keys`);

  // ──────── 12. GENERATE & INSERT ACTIVITIES ────────
  await generateAndInsertActivities(ch);

  await pool.end();
  await ch.close();
  console.log('\n🎮 Done! Refresh the Argus dashboard.');
}

main().catch((e) => {
  console.error('❌ Fatal error:', e);
  process.exit(1);
});

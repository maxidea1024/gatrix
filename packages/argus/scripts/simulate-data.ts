/**
 * Argus Data Simulator — Full-Set Production-Grade Data
 *
 * Generates ALL data needed for Argus in a single run:
 *   - Error events + Issues (ClickHouse + MySQL)
 *   - Structured logs (ClickHouse)
 *   - Transactions & Spans (ClickHouse)
 *   - Sessions (ClickHouse)
 *   - Feedback with enriched columns + attachments (ClickHouse)
 *   - Feedback-Issue links + Feedback activity (MySQL)
 *   - Releases + Commits (MySQL)
 *   - Issue enrichment: status distribution + activity (MySQL)
 *   - Metrics (ClickHouse)
 *   - Product Analytics Activities (ClickHouse)
 *   - Cron & Uptime Monitors + Check-ins (MySQL + ClickHouse)
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
  generateAndInsertMetrics,
  generateAndInsertActivities,
  // Full-set modules
  generateAndInsertReleases,
  generateAndInsertEnrichedFeedback,
  seedFeedbackLinksAndActivity,
  generateAndInsertMonitors,
  enrichIssues,
} from './simulate';

async function main() {
  console.log('🎮 Argus Data Simulator — Full-Set Production Data');
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

  const startTime = Date.now();

  // ──────── 1. TRUNCATE ALL DATA ────────
  console.log('🗑️  Truncating ALL existing data...');
  await truncateClickHouse(ch);
  await truncateMySQL(pool);

  // ──────── 2. FETCH DSN KEYS & INTERNAL PROJECT ID ────────
  console.log('\n🔑 Fetching DSN keys...');
  let dsnKeyRows: any[] = [];
  try {
    const [rows] = await pool.query(
      'SELECT id, is_active FROM g_argus_dsn_keys WHERE project_id = ?',
      [PROJECT_ID]
    );
    dsnKeyRows = rows as any[];
  } catch {
    console.log('   ⚠ g_argus_dsn_keys table not found.');
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

  // Get internal project ID (numeric) for MySQL FK references
  let internalProjectId = 1;
  try {
    const [rows] = await pool.query(
      'SELECT id FROM g_argus_projects WHERE gatrix_project_id = ? LIMIT 1',
      [PROJECT_ID]
    );
    if ((rows as any[]).length > 0) {
      internalProjectId = (rows as any[])[0].id;
    }
  } catch {}
  console.log(`   ✓ Internal project ID: ${internalProjectId}`);

  // ──────── 3. GENERATE ERROR EVENTS ────────
  console.log('\n🎲 Generating error events...');
  const { allEvents, issueMap } = generateErrorEvents(
    activeDsnKeys,
    dsnKeyTimestamps,
    TOTAL_ERROR_EVENTS
  );
  console.log(
    `   ✓ ${allEvents.length.toLocaleString()} error events generated`
  );
  console.log(`   ✓ ${issueMap.size} unique issues`);

  // ──────── 4. INSERT ISSUES INTO MYSQL ────────
  const fingerprintToId = await insertIssuesIntoMySQL(pool, issueMap);

  // ──────── 4b. MAP issue_id INTO EVENTS ────────
  console.log('\n🔗 Mapping issue_id into events...');
  let mapped = 0;
  for (const event of allEvents) {
    const fp = event.fingerprint?.[0];
    if (fp && fingerprintToId.has(fp)) {
      event.issue_id = fingerprintToId.get(fp)!;
      mapped++;
    }
  }
  console.log(
    `   ✓ ${mapped.toLocaleString()} / ${allEvents.length.toLocaleString()} events mapped to issue_id`
  );

  // ──────── 5. INSERT EVENTS INTO CLICKHOUSE ────────
  await insertEventsIntoClickHouse(ch, allEvents, CH_CONFIG.database);

  // ──────── 6. GENERATE & INSERT LOGS ────────
  await generateAndInsertLogs(ch, CH_CONFIG.database, allEvents, issueMap);

  // ──────── 7. GENERATE & INSERT TRANSACTIONS & SPANS ────────
  await generateAndInsertTransactions(
    ch,
    CH_CONFIG.database,
    TOTAL_TRANSACTIONS,
    activeDsnKeys
  );

  // ──────── 8. GENERATE & INSERT SESSIONS ────────
  await generateAndInsertSessions(
    ch,
    CH_CONFIG.database,
    TOTAL_SESSIONS,
    activeDsnKeys
  );

  // ──────── 9. GENERATE & INSERT ENRICHED FEEDBACK ────────
  const { feedbackIds } = await generateAndInsertEnrichedFeedback(
    ch,
    CH_CONFIG.database,
    TOTAL_FEEDBACK,
    activeDsnKeys,
    allEvents
  );

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
    } catch {}
  }
  console.log(`   ✓ Updated ${dsnKeyTimestamps.size} DSN keys`);

  // ──────── 12. GENERATE & INSERT ACTIVITIES (Product Analytics) ────────
  await generateAndInsertActivities(ch);

  // ──────── 13. INSERT RELEASES & COMMITS ────────
  await generateAndInsertReleases(pool, internalProjectId);

  // ──────── 14. ENRICH ISSUES (status, assignee, priority, activity) ────────
  await enrichIssues(pool, internalProjectId);

  // ──────── 15. SEED FEEDBACK-ISSUE LINKS & FEEDBACK ACTIVITY ────────
  await seedFeedbackLinksAndActivity(pool, ch, feedbackIds, internalProjectId);

  // ──────── 16. SEED CRON & UPTIME MONITORS ────────
  await generateAndInsertMonitors(
    pool,
    ch,
    CH_CONFIG.database,
    internalProjectId
  );

  // ──────── DONE ────────
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  await pool.end();
  await ch.close();

  console.log('\n' + '═'.repeat(60));
  console.log(`🎮 Done! Full-set data inserted in ${elapsed}s.`);
  console.log('   Refresh the Argus dashboard to see all data.');
  console.log('');
  console.log('   Summary:');
  console.log(
    `   • ${TOTAL_ERROR_EVENTS.toLocaleString()} error events + ${issueMap.size} issues`
  );
  console.log(
    `   • ${TOTAL_TRANSACTIONS.toLocaleString()} transactions with spans`
  );
  console.log(`   • ${TOTAL_SESSIONS.toLocaleString()} sessions`);
  console.log(
    `   • ${TOTAL_FEEDBACK.toLocaleString()} feedback (enriched + links + activity)`
  );
  console.log(`   • Releases with commits`);
  console.log(`   • Cron & uptime monitors with check-ins`);
  console.log(`   • Product analytics activities`);
  console.log(`   • Issue status distribution + activity`);
}

main().catch((e) => {
  console.error('❌ Fatal error:', e);
  process.exit(1);
});

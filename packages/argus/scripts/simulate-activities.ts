/**
 * Argus Activity Data Simulator
 *
 * Generates realistic user behavior events for Product Analytics features:
 * Insights, Funnels, Retention, Flows.
 *
 * Each simulated user follows coherent session patterns:
 *   1. New users: app_opened → user_login → character_created → tutorial_completed
 *   2. Regular sessions: app_opened → user_login → (various actions) → user_logout
 *   3. Some users churn after Day 0 (natural retention decay)
 *   4. Core users log in daily
 *
 * Target scale:
 *   ~500,000 activity events
 *   ~5,000 unique users
 *   ~14 days of data
 *
 * Usage: npx tsx scripts/simulate-activities.ts
 */

import { createClient } from '@clickhouse/client';
import dotenv from 'dotenv';
import path from 'path';
import crypto from 'crypto';

dotenv.config({ path: path.join(__dirname, '../../../.env.local') });
dotenv.config({ path: path.join(__dirname, '../../../.env') });

// ═══════════════════ CONFIG ═══════════════════

const CH_CONFIG = {
  url: `http://${process.env.CLICKHOUSE_HOST || 'localhost'}:${process.env.CLICKHOUSE_PORT || '8123'}`,
  database: process.env.ARGUS_CLICKHOUSE_DATABASE || 'argus',
  username: process.env.CLICKHOUSE_USERNAME || 'default',
  password: process.env.CLICKHOUSE_PASSWORD || '',
};

const PROJECT_ID = '01KN8GSHBJ10JTQ9D0HD60RKFV';
const DAYS_BACK = 45;
const NOW = new Date();
const TOTAL_USERS = 5_000;
const CHUNK_SIZE = 5_000;

// ═══════════════════ HELPERS ═══════════════════

function uuid(): string {
  return crypto.randomUUID().replace(/-/g, '');
}
function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function randomPick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
function weightedPick<T>(items: readonly T[], weights: readonly number[]): T {
  const total = weights.reduce((s, w) => s + w, 0);
  let r = Math.random() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}

// ═══════════════════ CONSTANTS ═══════════════════

const PLATFORMS = [
  'Steam',
  'Epic',
  'Direct',
  'PlayStation',
  'Xbox',
  'iOS',
] as const;
const PLATFORM_WEIGHTS = [35, 20, 10, 15, 12, 8];

const ENVIRONMENTS = ['production', 'staging'] as const;
const ENV_WEIGHTS = [95, 5];

const RELEASES = ['1.14.0', '1.13.2', '1.13.1', '1.12.5'] as const;
const RELEASE_WEIGHTS = [50, 30, 15, 5];

const COUNTRIES = [
  'KR',
  'JP',
  'US',
  'CN',
  'TW',
  'TH',
  'DE',
  'FR',
  'BR',
  'RU',
] as const;
const COUNTRY_WEIGHTS = [40, 15, 12, 10, 5, 4, 4, 3, 4, 3];

const CITIES: Record<string, readonly string[]> = {
  KR: ['Seoul', 'Busan', 'Incheon', 'Daegu', 'Daejeon'],
  JP: ['Tokyo', 'Osaka', 'Yokohama', 'Nagoya'],
  US: ['Los Angeles', 'New York', 'San Francisco', 'Seattle'],
  CN: ['Shanghai', 'Beijing', 'Guangzhou', 'Shenzhen'],
  TW: ['Taipei', 'Kaohsiung'],
  TH: ['Bangkok', 'Chiang Mai'],
  DE: ['Berlin', 'Munich', 'Hamburg'],
  FR: ['Paris', 'Lyon', 'Marseille'],
  BR: ['São Paulo', 'Rio de Janeiro'],
  RU: ['Moscow', 'Saint Petersburg'],
};

const OS_LIST = [
  'Windows 11',
  'Windows 10',
  'macOS 14',
  'macOS 15',
  'iOS 17',
  'Android 14',
  'PlayStation 5',
  'Xbox Series',
] as const;
const OS_WEIGHTS = [35, 20, 10, 8, 8, 5, 8, 6];

const APP_VERSIONS = [
  '1.14.0-b201',
  '1.14.0-b198',
  '1.13.2-b195',
  '1.13.1-b190',
] as const;
const APP_VERSION_WEIGHTS = [50, 25, 18, 7];

// ═══════════════════ EVENT DEFINITIONS ═══════════════════

/**
 * Event definitions with properties templates.
 * Events are ordered by typical session flow for Funnel analysis.
 */
const EVENT_DEFS = {
  // Reserved / System Events
  '$session_start': {
    weight: 10,
    props: () => ({
      properties: {
        source: randomPick(['direct', 'launcher', 'shortcut', 'deeplink']),
      },
    }),
  },
  user_login: {
    weight: 8,
    props: () => ({
      properties: {
        method: randomPick(['password', 'social', 'sso', 'steam', 'epic']),
      },
    }),
  },

  // Onboarding (funnel step 3-4)
  character_created: {
    weight: 2,
    props: () => ({
      properties: {
        class: randomPick(['warrior', 'mage', 'archer', 'priest', 'assassin']),
        race: randomPick(['human', 'elf', 'dwarf', 'orc']),
      },
      numeric_properties: { creation_time_seconds: randomInt(30, 300) },
    }),
  },
  tutorial_completed: {
    weight: 1,
    props: () => ({
      properties: { tutorial_id: `tut_${randomInt(1, 5)}` },
      numeric_properties: { duration_seconds: randomInt(120, 600) },
    }),
  },

  // Core gameplay
  battle_started: {
    weight: 6,
    props: () => ({
      properties: {
        mode: randomPick(['pve', 'pvp', 'raid', 'dungeon', 'arena']),
        difficulty: randomPick(['normal', 'hard', 'hell', 'nightmare']),
      },
      numeric_properties: { party_size: randomInt(1, 6) },
    }),
  },
  battle_won: {
    weight: 5,
    props: () => ({
      properties: { reward_type: randomPick(['gold', 'item', 'exp', 'mixed']) },
      numeric_properties: {
        duration_seconds: randomInt(60, 900),
        damage_dealt: randomInt(10000, 500000),
      },
    }),
  },
  battle_lost: {
    weight: 3,
    props: () => ({
      properties: {
        death_reason: randomPick(['boss_aoe', 'timeout', 'disconnect', 'wipe']),
      },
      numeric_properties: { duration_seconds: randomInt(30, 600) },
    }),
  },
  character_level_up: {
    weight: 4,
    props: () => ({
      numeric_properties: {
        new_level: randomInt(2, 100),
        time_to_level_hours: randomInt(1, 48),
      },
    }),
  },

  // Economy
  item_purchased: {
    weight: 6,
    props: () => ({
      properties: {
        item_type: randomPick([
          'weapon',
          'armor',
          'potion',
          'cosmetic',
          'mount',
          'pet',
        ]),
        currency: randomPick(['gold', 'diamond', 'cash']),
      },
      numeric_properties: {
        price: randomPick([100, 500, 1000, 2500, 5000, 10000]),
        quantity: randomInt(1, 10),
      },
    }),
  },
  item_sold: {
    weight: 4,
    props: () => ({
      properties: {
        item_type: randomPick(['weapon', 'armor', 'potion', 'material']),
      },
      numeric_properties: { price: randomInt(50, 5000) },
    }),
  },
  gold_earned: {
    weight: 7,
    props: () => ({
      properties: {
        source: randomPick([
          'quest',
          'mob_drop',
          'trade',
          'daily_reward',
          'achievement',
        ]),
      },
      numeric_properties: { amount: randomInt(100, 50000) },
    }),
  },

  // Social
  guild_joined: {
    weight: 1,
    props: () => ({
      properties: { guild_size: String(randomInt(5, 200)) },
    }),
  },
  chat_message_sent: {
    weight: 8,
    props: () => ({
      properties: {
        channel: randomPick(['global', 'guild', 'party', 'whisper', 'trade']),
      },
    }),
  },

  // Navigation
  menu_opened: {
    weight: 7,
    props: () => ({
      properties: {
        menu: randomPick([
          'inventory',
          'shop',
          'settings',
          'map',
          'quest_log',
          'character',
          'guild',
          'ranking',
        ]),
      },
    }),
  },
  settings_changed: {
    weight: 2,
    props: () => ({
      properties: {
        setting: randomPick([
          'graphics',
          'sound',
          'controls',
          'language',
          'notifications',
        ]),
      },
    }),
  },

  // Session end
  '$session_end': {
    weight: 5,
    props: () => ({
      properties: { reason: randomPick(['manual', 'timeout', 'maintenance']) },
      numeric_properties: { session_duration_minutes: randomInt(5, 180) },
    }),
  },
  '$page_view': {
    weight: 12,
    props: () => ({
      properties: {
        url: randomPick([
          '/game/play',
          '/game/port',
          '/game/battle',
          '/settings',
          '/inventory',
          '/guild',
        ]),
      },
    }),
  },
  '$click': {
    weight: 15,
    props: () => ({
      properties: {
        target: randomPick(['button#play', 'button#shop', 'tab#inventory', 'button#settings']),
      },
    }),
  },
  '$error': {
    weight: 2,
    props: () => ({
      properties: {
        error_type: randomPick(['TypeError', 'ReferenceError', 'NetworkError']),
        message: randomPick(['Cannot read properties of undefined', 'Connection lost']),
      },
    }),
  },
  '$feedback': {
    weight: 1,
    props: () => ({
      properties: {
        satisfaction: randomPick(['5', '4', '3', '2', '1']),
      },
    }),
  },
} as const;

type EventName = keyof typeof EVENT_DEFS;
const EVENT_NAMES = Object.keys(EVENT_DEFS) as EventName[];
const EVENT_WEIGHTS = EVENT_NAMES.map((n) => EVENT_DEFS[n].weight);

// ═══════════════════ USER MODEL ═══════════════════

interface SimUser {
  user_id: string;
  platform: string;
  environment: string;
  release: string;
  country: string;
  city: string;
  os: string;
  app_version: string;
  joinDay: number; // day offset from start (0 = 14 days ago)
  retentionClass: 'churned' | 'casual' | 'regular' | 'core';
}

function createUser(index: number): SimUser {
  const country = weightedPick(COUNTRIES, COUNTRY_WEIGHTS);
  const joinDay = randomInt(0, DAYS_BACK - 1);

  // Retention classes with realistic distribution
  const retentionClass = weightedPick(
    ['churned', 'casual', 'regular', 'core'] as const,
    [30, 35, 25, 10]
  );

  return {
    user_id: `user_${String(index).padStart(6, '0')}`,
    platform: weightedPick(PLATFORMS, PLATFORM_WEIGHTS),
    environment: weightedPick(ENVIRONMENTS, ENV_WEIGHTS),
    release: weightedPick(RELEASES, RELEASE_WEIGHTS),
    country,
    city: randomPick(CITIES[country] || ['Unknown']),
    os: weightedPick(OS_LIST, OS_WEIGHTS),
    app_version: weightedPick(APP_VERSIONS, APP_VERSION_WEIGHTS),
    joinDay,
    retentionClass,
  };
}

// ═══════════════════ SESSION SIMULATION ═══════════════════

interface ActivityRow {
  event_id: string;
  project_id: string;
  timestamp: string;
  event_name: string;
  user_id: string;
  device_id: string;
  session_id: string;
  platform: string;
  environment: string;
  release: string;
  country: string;
  city: string;
  os: string;
  app_version: string;
  properties: Record<string, string>;
  numeric_properties: Record<string, number>;
}

/**
 * Generate all activity events for a single user across their entire lifetime.
 * This produces coherent session sequences for meaningful funnel/retention data.
 */
function generateUserActivities(user: SimUser): ActivityRow[] {
  const activities: ActivityRow[] = [];
  const startDay = user.joinDay;

  // How many days this user plays after joining
  let activeDays: number;
  switch (user.retentionClass) {
    case 'churned':
      activeDays = randomInt(1, 2); // plays 1-2 days, then gone
      break;
    case 'casual':
      activeDays = randomInt(3, 6); // plays intermittently
      break;
    case 'regular':
      activeDays = randomInt(7, 11);
      break;
    case 'core':
      activeDays = DAYS_BACK - startDay; // plays every day
      break;
  }

  const daysToPlay = new Set<number>();
  if (user.retentionClass === 'core') {
    // Core plays every day
    for (let d = startDay; d < startDay + activeDays && d < DAYS_BACK; d++) {
      daysToPlay.add(d);
    }
  } else {
    // Others play on random days after join
    daysToPlay.add(startDay); // always play on join day
    for (let i = 1; i < activeDays; i++) {
      const day =
        startDay +
        randomInt(1, Math.min(activeDays + 2, DAYS_BACK - startDay - 1));
      if (day < DAYS_BACK) daysToPlay.add(day);
    }
  }

  const sortedDays = [...daysToPlay].sort((a, b) => a - b);
  let isFirstSession = true;

  for (const day of sortedDays) {
    const sessionsToday =
      user.retentionClass === 'core' ? randomInt(2, 4) : randomInt(1, 2);

    for (let s = 0; s < sessionsToday; s++) {
      const sessionId = uuid();
      // Base timestamp for this session
      const dayStart = new Date(NOW.getTime() - (DAYS_BACK - day) * 86400000);
      // Random hour with peak-time weighting (KST evening = UTC 11-15)
      const peakHours = [11, 12, 13, 14, 15, 16, 17];
      const offPeakHours = [
        1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 18, 19, 20, 21, 22, 23, 0,
      ];
      const hour =
        Math.random() < 0.7 ? randomPick(peakHours) : randomPick(offPeakHours);
      dayStart.setUTCHours(hour, randomInt(0, 59), randomInt(0, 59));
      let ts = dayStart.getTime();

      // Session flow
      const sessionEvents: EventName[] = [];

      // Always start with $session_start + user_login
      sessionEvents.push('$session_start', 'user_login');

      // First session: onboarding flow (funnel-critical!)
      if (isFirstSession) {
        sessionEvents.push('character_created');
        if (Math.random() < 0.7) {
          sessionEvents.push('tutorial_completed');
        }
        isFirstSession = false;
      }

      // Random gameplay events
      const numGameplayEvents =
        user.retentionClass === 'core'
          ? randomInt(8, 20)
          : user.retentionClass === 'regular'
            ? randomInt(5, 12)
            : randomInt(2, 6);

      const gameplayEvents: EventName[] = [
        '$page_view',
        '$click',
        '$error',
        '$feedback',
        'battle_started',
        'battle_won',
        'battle_lost',
        'character_level_up',
        'item_purchased',
        'item_sold',
        'gold_earned',
        'guild_joined',
        'chat_message_sent',
        'menu_opened',
        'settings_changed',
      ];

      for (let e = 0; e < numGameplayEvents; e++) {
        sessionEvents.push(
          weightedPick(
            gameplayEvents,
            gameplayEvents.map((n) => EVENT_DEFS[n].weight)
          )
        );
      }

      // End with logout (most of the time)
      if (Math.random() < 0.85) {
        sessionEvents.push('$session_end');
      }

      // Convert to ActivityRow
      for (const eventName of sessionEvents) {
        ts += randomInt(2000, 60000); // 2s-60s between events
        const eventDef = EVENT_DEFS[eventName];
        const generated = eventDef.props();

        activities.push({
          event_id: uuid(),
          project_id: PROJECT_ID,
          timestamp: new Date(ts)
            .toISOString()
            .replace('T', ' ')
            .replace('Z', ''),
          event_name: eventName,
          user_id: user.user_id,
          device_id: `device_${user.user_id}`,
          session_id: sessionId,
          platform: user.platform,
          environment: user.environment,
          release: user.release,
          country: user.country,
          city: user.city,
          os: user.os,
          app_version: user.app_version,
          properties: (generated as any).properties || {},
          numeric_properties: (generated as any).numeric_properties || {},
        });
      }
    }
  }

  return activities;
}

// ═══════════════════ MAIN ═══════════════════

async function main() {
  console.log('🎮 Argus Activity Simulator');
  console.log('═'.repeat(60));

  const ch = createClient(CH_CONFIG);

  // Test connection
  const result = await ch.query({ query: 'SELECT 1' });
  await result.json();
  console.log('✅ ClickHouse connected');

  // Run DDL (create table if not exists)
  const ddlPath = path.join(
    __dirname,
    '../migrations/clickhouse/014_create_custom_events_table.sql'
  );
  const fs = await import('fs');
  const ddl = fs.readFileSync(ddlPath, 'utf-8');
  await ch.command({ query: ddl });
  console.log('✅ Table argus.activities ready');

  // Clear existing activity data for this project
  await ch.command({
    query: `ALTER TABLE argus.activities DELETE WHERE project_id = '${PROJECT_ID}'`,
  });
  console.log('🗑️  Cleared existing activity data');

  // Generate users
  console.log(`\n👤 Generating ${TOTAL_USERS.toLocaleString()} users...`);
  const users: SimUser[] = [];
  for (let i = 0; i < TOTAL_USERS; i++) {
    users.push(createUser(i));
  }

  // Stats
  const classCounts = { churned: 0, casual: 0, regular: 0, core: 0 };
  for (const u of users) classCounts[u.retentionClass]++;
  console.log(
    `   Churned: ${classCounts.churned} | Casual: ${classCounts.casual} | Regular: ${classCounts.regular} | Core: ${classCounts.core}`
  );

  // Generate all activities
  console.log('\n📊 Generating activities...');
  let totalEvents = 0;
  let batchBuffer: ActivityRow[] = [];
  let batchCount = 0;

  for (let i = 0; i < users.length; i++) {
    const userActivities = generateUserActivities(users[i]);
    batchBuffer.push(...userActivities);
    totalEvents += userActivities.length;

    // Flush in chunks
    while (batchBuffer.length >= CHUNK_SIZE) {
      const chunk = batchBuffer.splice(0, CHUNK_SIZE);
      await ch.insert({
        table: 'argus.activities',
        values: chunk,
        format: 'JSONEachRow',
      });
      batchCount++;
      if (batchCount % 20 === 0) {
        console.log(
          `   Inserted ${(batchCount * CHUNK_SIZE).toLocaleString()} events...`
        );
      }
    }

    // Progress
    if ((i + 1) % 1000 === 0) {
      console.log(
        `   Processed ${i + 1}/${TOTAL_USERS} users (${totalEvents.toLocaleString()} events so far)`
      );
    }
  }

  // Flush remaining
  if (batchBuffer.length > 0) {
    await ch.insert({
      table: 'argus.activities',
      values: batchBuffer,
      format: 'JSONEachRow',
    });
  }

  // Summary
  console.log('\n' + '═'.repeat(60));
  console.log('✅ Activity Simulation Complete!\n');
  console.log(`   Total Events:  ${totalEvents.toLocaleString()}`);
  console.log(`   Total Users:   ${TOTAL_USERS.toLocaleString()}`);
  console.log(`   Time Range:    ${DAYS_BACK} days`);
  console.log(`   Project:       ${PROJECT_ID}`);

  // Event distribution
  const eventCounts: Record<string, number> = {};
  // Quick count by re-scanning (we already inserted, so this is just for logging)
  const countResult = await ch.query({
    query: `
      SELECT event_name, count() AS cnt
      FROM argus.activities
      WHERE project_id = '${PROJECT_ID}'
      GROUP BY event_name
      ORDER BY cnt DESC
    `,
  });
  const countRows = (await countResult.json()) as any;
  console.log('\n   Event Distribution:');
  for (const row of countRows.data || []) {
    console.log(
      `     ${String(row.event_name).padEnd(25)} ${Number(row.cnt).toLocaleString()}`
    );
  }

  // Retention preview
  const retentionResult = await ch.query({
    query: `
      SELECT
        dateDiff('day', toDate(first_ts), toDate(return_ts)) AS return_day,
        count(DISTINCT user_id) AS users
      FROM (
        SELECT f.user_id, f.first_ts, r.timestamp AS return_ts
        FROM (
          SELECT user_id, min(timestamp) AS first_ts
          FROM argus.activities
          WHERE project_id = '${PROJECT_ID}' AND event_name = 'user_login'
          GROUP BY user_id
        ) f
        INNER JOIN argus.activities r
          ON r.user_id = f.user_id AND r.project_id = '${PROJECT_ID}'
          AND r.event_name = 'user_login' AND r.timestamp >= f.first_ts
      )
      WHERE return_day <= 7
      GROUP BY return_day
      ORDER BY return_day
    `,
  });
  const retRows = (await retentionResult.json()) as any;
  console.log('\n   Retention Preview (login → login):');
  const day0Users = retRows.data?.[0]?.users || 1;
  for (const row of retRows.data || []) {
    const pct = Math.round((Number(row.users) / Number(day0Users)) * 100);
    console.log(`     Day ${row.return_day}: ${pct}%`);
  }

  await ch.close();
  console.log('\n🎮 Done! Check Analytics in the Argus dashboard.');
}

main().catch((e) => {
  console.error('❌ Fatal error:', e);
  process.exit(1);
});

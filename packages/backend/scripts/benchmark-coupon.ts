/**
 * Coupon System Benchmark: Redis Atomic Validation + Data Integrity + DB Health Monitor
 *
 * Full pipeline stress test: HTTP API → Redis → BullMQ → DB persistence.
 * Monitors MySQL connection pool and InnoDB lock behavior in real-time.
 * Generates a visual HTML report at the end.
 *
 * Usage: npx ts-node scripts/benchmark-coupon.ts
 */

import knex from '../src/config/knex';
import { ulid } from 'ulid';
import {
  generateCouponCode,
  CodePattern,
} from '../src/utils/coupon-code-generator';
import {
  generateHtmlReport,
  DbSample,
  DbMonitorReport,
  PhaseResult,
  IntegrityCheck,
} from './benchmark-coupon-report-html';
import redisClient from '../src/config/redis';
import { join } from 'path';

// --- Configuration ---
const BASE_URL = 'http://localhost:5000/api/v1';
const API_TOKEN = 'unsecured-server-api-token';
const STRESS_QUANTITY = 10_000; // 10K codes for quick comparison
const STRESS_CONCURRENCY = 200; // High enough to saturate pool max=10
const SPECIAL_CONCURRENCY = 50;
const SPECIAL_TOTAL_USERS = 100;
const SPECIAL_PER_USER_LIMIT = 3;
const SPECIAL_MAX_TOTAL_USES = 200;
const BULLMQ_SETTLE_WAIT_MS = 30000;
const DB_SAMPLE_INTERVAL_MS = 200; // Sample faster to catch pool spikes

// Realistic test data pools
const PLATFORMS = [
  'steam',
  'epic',
  'xbox',
  'playstation',
  'mobile_ios',
  'mobile_android',
];
const CHANNELS = [
  'official',
  'partner',
  'influencer',
  'event',
  'media',
  'community',
];
const SUB_CHANNELS = [
  'youtube',
  'twitch',
  'twitter',
  'facebook',
  'discord',
  'reddit',
  'tiktok',
  'instagram',
];
const WORLD_IDS = ['world_1', 'world_2', 'world_3', 'world_4', 'world_5'];
const KOREAN_SURNAMES = [
  '김',
  '이',
  '박',
  '최',
  '정',
  '강',
  '조',
  '윤',
  '장',
  '임',
];
const KOREAN_NAMES = [
  '민수',
  '서연',
  '지훈',
  '하은',
  '준호',
  '수빈',
  '도윤',
  '예린',
  '시우',
  '지아',
];

function randomPick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
function generateUserId(i: number) {
  return `bench_user_${String(i).padStart(8, '0')}`;
}
function generateUserName() {
  return `${randomPick(KOREAN_SURNAMES)}${randomPick(KOREAN_NAMES)}${Math.floor(Math.random() * 9999)}`;
}
function generateCharacterId(userId: string) {
  return `char_${userId}_${Math.floor(Math.random() * 5) + 1}`;
}

// ============================================================
// DB Monitor — samples MySQL global status periodically
// ============================================================
class DbMonitor {
  private samples: DbSample[] = [];
  private interval: NodeJS.Timeout | null = null;
  private startTime = 0;
  private baseLockWaits = 0;
  private baseLockTime = 0;
  private baseDeadlocks = 0;
  private finalDeadlocks = 0;

  async captureBaseline() {
    const s = await this.query();
    this.baseLockWaits = s.lockWaits;
    this.baseLockTime = s.lockTime;
    this.baseDeadlocks = s.deadlocks;
  }

  start() {
    this.startTime = Date.now();
    this.samples = [];
    this.interval = setInterval(async () => {
      try {
        const s = await this.query();
        const [procs] = await knex.raw('SHOW PROCESSLIST');
        const active = (procs as any[]).filter(
          (p: any) => p.Command !== 'Sleep' && p.Command !== 'Daemon'
        ).length;
        // Sample knex/tarn pool stats
        const pool = (knex as any).client.pool;
        const poolUsed = pool ? pool.numUsed() : 0;
        const poolFree = pool ? pool.numFree() : 0;
        const poolPending = pool ? pool.numPendingAcquires() : 0;
        this.samples.push({
          elapsedMs: Date.now() - this.startTime,
          threadsConnected: s.threadsConnected,
          threadsRunning: s.threadsRunning,
          activeQueries: active,
          poolUsed,
          poolFree,
          poolPendingAcquires: poolPending,
        });
      } catch {
        /* ignore sampling errors */
      }
    }, DB_SAMPLE_INTERVAL_MS);
  }

  async stop(): Promise<DbMonitorReport> {
    if (this.interval) clearInterval(this.interval);
    const fin = await this.query();
    this.finalDeadlocks = fin.deadlocks;
    if (this.samples.length === 0) {
      return {
        samples: [],
        peakConnections: 0,
        avgConnections: 0,
        peakRunning: 0,
        avgRunning: 0,
        totalLockWaits: 0,
        totalLockTimeMs: 0,
        deadlocksDelta: 0,
        peakActiveQueries: 0,
        peakPoolUsed: 0,
        peakPoolPending: 0,
        avgPoolPending: 0,
      };
    }
    const c = this.samples.map((s) => s.threadsConnected);
    const r = this.samples.map((s) => s.threadsRunning);
    const a = this.samples.map((s) => s.activeQueries);
    const pu = this.samples.map((s) => s.poolUsed);
    const pp = this.samples.map((s) => s.poolPendingAcquires);
    return {
      samples: this.samples,
      peakConnections: Math.max(...c),
      avgConnections: Math.round(c.reduce((x, y) => x + y, 0) / c.length),
      peakRunning: Math.max(...r),
      avgRunning:
        Math.round((r.reduce((x, y) => x + y, 0) / r.length) * 10) / 10,
      totalLockWaits: fin.lockWaits - this.baseLockWaits,
      totalLockTimeMs: fin.lockTime - this.baseLockTime,
      deadlocksDelta: this.finalDeadlocks - this.baseDeadlocks,
      peakActiveQueries: Math.max(...a),
      peakPoolUsed: Math.max(...pu),
      peakPoolPending: Math.max(...pp),
      avgPoolPending:
        Math.round((pp.reduce((x, y) => x + y, 0) / pp.length) * 10) / 10,
    };
  }

  private async query() {
    const [rows] = await knex.raw(
      `SHOW GLOBAL STATUS WHERE Variable_name IN ('Threads_connected','Threads_running','Innodb_row_lock_waits','Innodb_row_lock_time')`
    );
    const m: Record<string, number> = {};
    for (const row of rows as any[]) m[row.Variable_name] = Number(row.Value);
    let deadlocks = 0;
    try {
      const [d] = await knex.raw(`SHOW GLOBAL STATUS LIKE 'Innodb_deadlocks'`);
      if ((d as any[]).length > 0) deadlocks = Number((d as any[])[0].Value);
    } catch {}
    return {
      threadsConnected: m['Threads_connected'] || 0,
      threadsRunning: m['Threads_running'] || 0,
      lockWaits: m['Innodb_row_lock_waits'] || 0,
      lockTime: m['Innodb_row_lock_time'] || 0,
      deadlocks,
    };
  }
}

// ============================================================
// HTTP helper
// ============================================================
async function redeemCoupon(
  code: string,
  body: Record<string, any>,
  mode?: 'db-only'
) {
  const start = Date.now();
  const modeQuery = mode ? `?mode=${mode}` : '';
  try {
    const resp = await fetch(
      `${BASE_URL}/server/coupons/${encodeURIComponent(code)}/redeem${modeQuery}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Token': API_TOKEN,
          'X-Application-Name': 'benchmark',
        },
        body: JSON.stringify(body),
      }
    );
    const data: any = await resp.json();
    return {
      ok: resp.ok,
      status: resp.status,
      data,
      latencyMs: Date.now() - start,
    };
  } catch (err: any) {
    return {
      ok: false,
      status: 0,
      data: { error: err.message } as any,
      latencyMs: Date.now() - start,
    };
  }
}

// ============================================================
// DB Helpers
// ============================================================
async function getEnvironmentId(): Promise<string> {
  const env = await knex('g_environments').where('name', 'development').first();
  if (!env) throw new Error('No development environment found');
  return env.id;
}

async function cleanupBenchmarkData(environmentId: string) {
  console.log('🧹 Cleaning up previous benchmark data...');
  const benchSettings = await knex('g_coupon_settings')
    .where('environmentId', environmentId)
    .where('name', 'like', 'BENCH_%')
    .select('id');
  const ids = benchSettings.map((s: any) => s.id);
  if (ids.length > 0) {
    await knex('g_coupon_uses').whereIn('settingId', ids).del();
    await knex('g_coupons').whereIn('settingId', ids).del();
    for (const t of [
      'g_coupon_target_worlds',
      'g_coupon_target_platforms',
      'g_coupon_target_channels',
      'g_coupon_target_subchannels',
      'g_coupon_target_users',
    ])
      await knex(t).whereIn('settingId', ids).del();
    await knex('g_coupon_settings').whereIn('id', ids).del();
  }

  // Clean up Redis coupon keys from previous benchmark runs
  const redis = redisClient.getClient();
  for (const prefix of [
    'coupon:redeemed:',
    'coupon:usage:',
    'coupon:global_usage:',
  ]) {
    const keys = await redis.keys(`${prefix}${environmentId}:*`);
    if (keys.length > 0) {
      // Delete in batches of 1000 to avoid blocking Redis
      for (let i = 0; i < keys.length; i += 1000) {
        await redis.del(...keys.slice(i, i + 1000));
      }
      console.log(`   Cleaned ${keys.length} Redis keys (${prefix}*)`);
    }
  }
  console.log(`   Cleaned ${ids.length} DB settings`);
}

function printDbMonitor(
  label: string,
  db: DbMonitorReport,
  poolTimeoutErrors = 0
) {
  console.log(`\n   🗄 ${label} — DB Health:`);
  console.log(`   ├─ Peak Connections:     ${db.peakConnections}`);
  console.log(`   ├─ Avg Connections:      ${db.avgConnections}`);
  console.log(`   ├─ Peak Running:         ${db.peakRunning}`);
  console.log(`   ├─ Peak Active Queries:  ${db.peakActiveQueries}`);
  console.log(`   ├─ InnoDB Lock Waits:    ${db.totalLockWaits}`);
  console.log(`   ├─ InnoDB Lock Time:     ${db.totalLockTimeMs}ms`);
  console.log(
    `   ├─ InnoDB Deadlocks:     ${db.deadlocksDelta} ${db.deadlocksDelta === 0 ? '✅' : '❌'}`
  );
  console.log(`   ├─ Pool Peak Used:       ${db.peakPoolUsed} / 10`);
  console.log(
    `   ├─ Pool Peak Pending:    ${db.peakPoolPending} ${db.peakPoolPending > 0 ? '⚠️  QUEUED' : '✅'}`
  );
  console.log(`   ├─ Pool Avg Pending:     ${db.avgPoolPending}`);
  console.log(
    `   └─ Pool Timeout Errors:  ${poolTimeoutErrors} ${poolTimeoutErrors > 0 ? '❌ EXHAUSTION' : '✅'}`
  );
}

// ============================================================
// Phase 1: NORMAL coupon benchmark
// ============================================================
async function benchmarkNormal(environmentId: string): Promise<PhaseResult> {
  console.log('\n' + '='.repeat(80));
  console.log('📋 PHASE 1: Redis+BullMQ Stress Test');
  console.log(
    `   ${STRESS_QUANTITY.toLocaleString()} codes, concurrency=${STRESS_CONCURRENCY}`
  );
  console.log('='.repeat(80));

  // Create setting
  const settingId = ulid();
  const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 19)
    .replace('T', ' ');
  await knex('g_coupon_settings').insert({
    id: settingId,
    environmentId,
    type: 'NORMAL',
    name: 'BENCH_REDIS_5K',
    description: 'Benchmark: Redis+BullMQ stress',
    perUserLimit: 1,
    usageLimitType: 'USER',
    expiresAt,
    status: 'ACTIVE',
    codePattern: 'ALPHANUMERIC_8',
  });
  console.log(`   ✅ Setting: ${settingId}`);

  // Generate codes
  console.log(`   ⏳ Generating ${STRESS_QUANTITY.toLocaleString()} codes...`);
  const genStart = Date.now();
  const codes: string[] = [];
  const codeSet = new Set<string>();
  while (codes.length < STRESS_QUANTITY) {
    const batch: {
      id: string;
      settingId: string;
      code: string;
      environmentId: string;
    }[] = [];
    while (
      batch.length < 2000 &&
      codes.length + batch.length < STRESS_QUANTITY
    ) {
      const code = generateCouponCode('ALPHANUMERIC_8' as CodePattern);
      if (!codeSet.has(code)) {
        codeSet.add(code);
        batch.push({ id: ulid(), settingId, code, environmentId });
        codes.push(code);
      }
    }
    if (batch.length > 0) {
      const ph = batch.map(() => '(?, ?, ?, ?)').join(', ');
      const vals = batch.flatMap((r) => [
        r.id,
        r.settingId,
        r.code,
        r.environmentId,
      ]);
      await knex.raw(
        `INSERT IGNORE INTO g_coupons (id, settingId, code, environmentId) VALUES ${ph}`,
        vals
      );
    }
  }
  console.log(
    `   ✅ Generated in ${((Date.now() - genStart) / 1000).toFixed(1)}s`
  );
  await knex('g_coupon_settings')
    .where('id', settingId)
    .update({ issuedCount: codes.length, totalCount: codes.length });

  // Redeem with DB monitoring
  const monitor = new DbMonitor();
  await monitor.captureBaseline();
  monitor.start();

  console.log(`   ⏳ Redeeming...`);
  const latencies: number[] = [];
  let successCount = 0,
    duplicateCount = 0,
    limitCount = 0,
    errorCount = 0,
    poolTimeoutErrors = 0;
  const errorDetails: Record<string, number> = {};
  const redeemStart = Date.now();

  for (let i = 0; i < codes.length; i += STRESS_CONCURRENCY) {
    const batch = codes.slice(i, i + STRESS_CONCURRENCY);
    await Promise.all(
      batch.map(async (code, j) => {
        const idx = i + j;
        const result = await redeemCoupon(code, {
          userId: generateUserId(idx),
          userName: generateUserName(),
          characterId: generateCharacterId(generateUserId(idx)),
          worldId: randomPick(WORLD_IDS),
          platform: randomPick(PLATFORMS),
          channel: randomPick(CHANNELS),
          subChannel: randomPick(SUB_CHANNELS),
        });
        latencies.push(result.latencyMs);
        if (result.ok) successCount++;
        else if (result.status === 409) {
          result.data?.error?.code === 'ALREADY_USED'
            ? duplicateCount++
            : limitCount++;
        } else {
          errorCount++;
          if (result.status === 500 || result.status === 0) poolTimeoutErrors++;
          const errKey = `${result.status}:${result.data?.error?.code || result.data?.error?.message || result.data?.message || 'unknown'}`;
          errorDetails[errKey] = (errorDetails[errKey] || 0) + 1;
        }
      })
    );
    if (
      (i + STRESS_CONCURRENCY) % 1000 === 0 ||
      i + STRESS_CONCURRENCY >= codes.length
    ) {
      const done = Math.min(i + STRESS_CONCURRENCY, codes.length);
      process.stdout.write(
        `\r   Redeemed: ${done.toLocaleString()} / ${codes.length.toLocaleString()} (${((Date.now() - redeemStart) / 1000).toFixed(1)}s, ~${Math.round((done / (Date.now() - redeemStart)) * 1000)} req/s)`
      );
    }
  }
  const redeemTimeMs = Date.now() - redeemStart;
  const dbReport = await monitor.stop();
  console.log('');

  // Duplicate test
  console.log(`   ⏳ Duplicate test (1000 codes)...`);
  let dupReject = 0,
    dupPass = 0;
  for (let i = 0; i < 1000; i += 50) {
    await Promise.all(
      codes.slice(i, i + 50).map(async (code) => {
        const r = await redeemCoupon(code, {
          userId: generateUserId(999999),
          userName: generateUserName(),
          platform: randomPick(PLATFORMS),
          channel: randomPick(CHANNELS),
        });
        r.ok ? dupPass++ : r.status === 409 ? dupReject++ : null;
      })
    );
  }
  console.log(
    `   ✅ Duplicates: ${dupReject}/1000 rejected, ${dupPass} leaked`
  );

  // Print metrics
  const sorted = [...latencies].sort((a, b) => a - b);
  const throughput = Math.round(codes.length / (redeemTimeMs / 1000));
  console.log(
    `\n   📊 NORMAL Results: ${throughput} req/s, Avg ${(sorted.reduce((a, b) => a + b, 0) / sorted.length).toFixed(0)}ms, P99 ${sorted[Math.floor(sorted.length * 0.99)]}ms`
  );
  console.log(`   ├─ Success: ${successCount}, Errors: ${errorCount}`);
  if (Object.keys(errorDetails).length > 0) {
    console.log(`   ├─ Error breakdown:`);
    for (const [key, count] of Object.entries(errorDetails).sort(
      (a, b) => b[1] - a[1]
    )) {
      console.log(`   │  ${key}: ${count}`);
    }
  }
  printDbMonitor('REDIS+BULLMQ', dbReport, poolTimeoutErrors);

  // Wait for BullMQ
  console.log(
    `\n   ⏳ Waiting ${BULLMQ_SETTLE_WAIT_MS / 1000}s for BullMQ to flush...`
  );
  await new Promise((r) => setTimeout(r, BULLMQ_SETTLE_WAIT_MS));

  // Integrity check
  const usedCoupons = await knex('g_coupons')
    .where('settingId', settingId)
    .where('status', 'USED')
    .count('* as count')
    .first();
  const usageRecords = await knex('g_coupon_uses')
    .where('settingId', settingId)
    .count('* as count')
    .first();
  const settingRow = await knex('g_coupon_settings')
    .where('id', settingId)
    .select('usedCount')
    .first();
  const dbUsed = Number(usedCoupons?.count || 0);
  const dbUses = Number(usageRecords?.count || 0);
  const cached = Number(settingRow?.usedCount || 0);

  const integrity: IntegrityCheck[] = [
    {
      label: 'g_coupons (USED)',
      expected: successCount,
      actual: dbUsed,
      pass: dbUsed === successCount,
    },
    {
      label: 'g_coupon_uses',
      expected: successCount,
      actual: dbUses,
      pass: dbUses === successCount,
    },
    {
      label: 'usedCount cache',
      expected: successCount,
      actual: cached,
      pass: cached === successCount,
    },
    {
      label: 'Duplicate rejection',
      expected: 1000,
      actual: dupReject,
      pass: dupReject === 1000,
    },
  ];
  integrity.forEach((c) =>
    console.log(
      `   ${c.pass ? '✅' : '❌'} ${c.label}: ${c.actual} (expected ${c.expected})`
    )
  );

  return {
    name: `Redis+BullMQ Stress (${STRESS_QUANTITY.toLocaleString()} codes, concurrency=${STRESS_CONCURRENCY})`,
    totalTimeMs: redeemTimeMs,
    throughput,
    successCount,
    totalRequests: codes.length,
    duplicateCount,
    limitExceededCount: limitCount,
    globalLimitCount: 0,
    errorCount,
    poolTimeoutErrors,
    latencies,
    dbMonitor: dbReport,
    integrity,
  };
}

// ============================================================
// Phase 2: SPECIAL coupon benchmark
// ============================================================
async function benchmarkSpecial(environmentId: string): Promise<PhaseResult> {
  console.log('\n' + '='.repeat(80));
  console.log('📋 PHASE 2: SPECIAL Coupon Benchmark');
  console.log(
    `   ${SPECIAL_TOTAL_USERS} users × perUserLimit=${SPECIAL_PER_USER_LIMIT}, maxTotalUses=${SPECIAL_MAX_TOTAL_USES}`
  );
  console.log('='.repeat(80));

  const settingId = ulid();
  const specialCode = `BENCH-SP-${Date.now().toString(36).toUpperCase()}`;
  const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 19)
    .replace('T', ' ');
  await knex('g_coupon_settings').insert({
    id: settingId,
    environmentId,
    code: specialCode,
    type: 'SPECIAL',
    name: 'BENCH_SPECIAL_STRESS',
    description: 'Benchmark: SPECIAL stress test',
    perUserLimit: SPECIAL_PER_USER_LIMIT,
    maxTotalUses: SPECIAL_MAX_TOTAL_USES,
    usageLimitType: 'USER',
    expiresAt,
    status: 'ACTIVE',
    codePattern: 'ALPHANUMERIC_8',
  });
  console.log(`   ✅ Setting: ${settingId}, code: ${specialCode}`);

  // Build shuffled requests (each user tries perUserLimit+2 times)
  const attemptsPerUser = SPECIAL_PER_USER_LIMIT + 2;
  const requests: { userId: string; userName: string }[] = [];
  for (let u = 0; u < SPECIAL_TOTAL_USERS; u++) {
    const userId = generateUserId(u + 500000);
    const userName = generateUserName();
    for (let a = 0; a < attemptsPerUser; a++)
      requests.push({ userId, userName });
  }
  for (let i = requests.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [requests[i], requests[j]] = [requests[j], requests[i]];
  }
  const totalAttempts = requests.length;
  console.log(`   ⏳ ${totalAttempts} attempts...`);

  const monitor = new DbMonitor();
  await monitor.captureBaseline();
  monitor.start();

  const latencies: number[] = [];
  let successCount = 0,
    limitExceededCount = 0,
    globalLimitCount = 0,
    errorCount = 0;
  const redeemStart = Date.now();

  for (let i = 0; i < requests.length; i += SPECIAL_CONCURRENCY) {
    const batch = requests.slice(i, i + SPECIAL_CONCURRENCY);
    await Promise.all(
      batch.map(async (req) => {
        const result = await redeemCoupon(specialCode, {
          userId: req.userId,
          userName: req.userName,
          characterId: generateCharacterId(req.userId),
          worldId: randomPick(WORLD_IDS),
          platform: randomPick(PLATFORMS),
          channel: randomPick(CHANNELS),
          subChannel: randomPick(SUB_CHANNELS),
        });
        latencies.push(result.latencyMs);
        if (result.ok) successCount++;
        else if (result.status === 409) {
          const code = result.data?.error?.code;
          if (code === 'USER_LIMIT_EXCEEDED') limitExceededCount++;
          else if (code === 'ALREADY_USED') globalLimitCount++;
          else limitExceededCount++;
        } else errorCount++;
      })
    );
    if (
      (i + SPECIAL_CONCURRENCY) % 500 === 0 ||
      i + SPECIAL_CONCURRENCY >= requests.length
    ) {
      const done = Math.min(i + SPECIAL_CONCURRENCY, requests.length);
      process.stdout.write(
        `\r   Processed: ${done} / ${totalAttempts} (${((Date.now() - redeemStart) / 1000).toFixed(1)}s)`
      );
    }
  }
  const redeemTimeMs = Date.now() - redeemStart;
  const dbReport = await monitor.stop();
  console.log('');

  const throughput = Math.round(totalAttempts / (redeemTimeMs / 1000));
  const sorted = [...latencies].sort((a, b) => a - b);
  console.log(
    `\n   📊 SPECIAL Results: ${throughput} req/s, Success ${successCount}, LimitHit ${limitExceededCount + globalLimitCount}`
  );
  printDbMonitor('SPECIAL', dbReport);

  console.log(
    `\n   ⏳ Waiting ${BULLMQ_SETTLE_WAIT_MS / 1000}s for BullMQ to flush...`
  );
  await new Promise((r) => setTimeout(r, BULLMQ_SETTLE_WAIT_MS));

  // Integrity
  const usageRecords = await knex('g_coupon_uses')
    .where('settingId', settingId)
    .count('* as count')
    .first();
  const dbUses = Number(usageRecords?.count || 0);
  const userCounts = await knex('g_coupon_uses')
    .where('settingId', settingId)
    .groupBy('userId')
    .select('userId')
    .count('* as count');
  let usersOverLimit = 0,
    maxUserUsage = 0;
  for (const row of userCounts) {
    const cnt = Number(row.count);
    if (cnt > SPECIAL_PER_USER_LIMIT) usersOverLimit++;
    if (cnt > maxUserUsage) maxUserUsage = cnt;
  }
  const settingRow = await knex('g_coupon_settings')
    .where('id', settingId)
    .select('usedCount')
    .first();
  const cached = Number(settingRow?.usedCount || 0);

  const integrity: IntegrityCheck[] = [
    {
      label: 'Success ≤ maxTotalUses',
      expected: SPECIAL_MAX_TOTAL_USES,
      actual: successCount,
      pass: successCount <= SPECIAL_MAX_TOTAL_USES,
    },
    {
      label: 'Users over per-user limit',
      expected: 0,
      actual: usersOverLimit,
      pass: usersOverLimit === 0,
    },
    {
      label: 'Max per-user usage ≤ limit',
      expected: SPECIAL_PER_USER_LIMIT,
      actual: maxUserUsage,
      pass: maxUserUsage <= SPECIAL_PER_USER_LIMIT,
    },
    {
      label: 'DB records match success',
      expected: successCount,
      actual: dbUses,
      pass: dbUses === successCount,
    },
    {
      label: 'usedCount cache',
      expected: successCount,
      actual: cached,
      pass: cached === successCount,
    },
  ];
  integrity.forEach((c) =>
    console.log(
      `   ${c.pass ? '✅' : '❌'} ${c.label}: ${c.actual} (expected ${c.expected})`
    )
  );

  return {
    name: `SPECIAL Coupon — Redis+BullMQ (${SPECIAL_TOTAL_USERS} users, perUser=${SPECIAL_PER_USER_LIMIT}, maxTotal=${SPECIAL_MAX_TOTAL_USES})`,
    totalTimeMs: redeemTimeMs,
    throughput,
    successCount,
    totalRequests: totalAttempts,
    duplicateCount: 0,
    limitExceededCount,
    globalLimitCount,
    errorCount,
    poolTimeoutErrors: 0,
    latencies,
    dbMonitor: dbReport,
    integrity,
  };
}

// ============================================================
// Phase 0: DB-only baseline (same test, no Redis/BullMQ)
// ============================================================

async function benchmarkNormalDbOnly(
  environmentId: string
): Promise<PhaseResult> {
  console.log('\n' + '='.repeat(80));
  console.log('📋 PHASE 0 (BASELINE): DB-Only Transaction Stress Test');
  console.log(
    `   ${STRESS_QUANTITY.toLocaleString()} codes, concurrency=${STRESS_CONCURRENCY}, mode=db-only`
  );
  console.log('='.repeat(80));

  // Create setting
  const settingId = ulid();
  const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 19)
    .replace('T', ' ');
  await knex('g_coupon_settings').insert({
    id: settingId,
    environmentId,
    type: 'NORMAL',
    name: 'BENCH_DBONLY_5K',
    description: 'Benchmark: DB-only baseline',
    perUserLimit: 1,
    usageLimitType: 'USER',
    expiresAt,
    status: 'ACTIVE',
    codePattern: 'ALPHANUMERIC_8',
  });
  console.log(`   ✅ Setting: ${settingId}`);

  // Generate codes
  console.log(`   ⏳ Generating ${STRESS_QUANTITY.toLocaleString()} codes...`);
  const genStart = Date.now();
  const codes: string[] = [];
  const codeSet = new Set<string>();
  while (codes.length < STRESS_QUANTITY) {
    const batch: {
      id: string;
      settingId: string;
      code: string;
      environmentId: string;
    }[] = [];
    while (
      batch.length < 2000 &&
      codes.length + batch.length < STRESS_QUANTITY
    ) {
      const code = generateCouponCode('ALPHANUMERIC_8' as CodePattern);
      if (!codeSet.has(code)) {
        codeSet.add(code);
        batch.push({ id: ulid(), settingId, code, environmentId });
        codes.push(code);
      }
    }
    if (batch.length > 0) {
      const ph = batch.map(() => '(?, ?, ?, ?)').join(', ');
      const vals = batch.flatMap((r) => [
        r.id,
        r.settingId,
        r.code,
        r.environmentId,
      ]);
      await knex.raw(
        `INSERT IGNORE INTO g_coupons (id, settingId, code, environmentId) VALUES ${ph}`,
        vals
      );
    }
  }
  console.log(
    `   ✅ Generated in ${((Date.now() - genStart) / 1000).toFixed(1)}s`
  );
  await knex('g_coupon_settings')
    .where('id', settingId)
    .update({ issuedCount: codes.length, totalCount: codes.length });

  // Redeem with DB monitoring — using ?mode=db-only
  const monitor = new DbMonitor();
  await monitor.captureBaseline();
  monitor.start();

  console.log(
    `   ⏳ Redeeming (DB-only mode, concurrency=${STRESS_CONCURRENCY})...`
  );
  const latencies: number[] = [];
  let successCount = 0,
    duplicateCount = 0,
    limitCount = 0,
    errorCount = 0,
    poolTimeoutErrors = 0;
  const errorDetails: Record<string, number> = {};
  const redeemStart = Date.now();

  for (let i = 0; i < codes.length; i += STRESS_CONCURRENCY) {
    const batch = codes.slice(i, i + STRESS_CONCURRENCY);
    await Promise.all(
      batch.map(async (code, j) => {
        const idx = i + j;
        const result = await redeemCoupon(
          code,
          {
            userId: generateUserId(idx),
            userName: generateUserName(),
            characterId: generateCharacterId(generateUserId(idx)),
            worldId: randomPick(WORLD_IDS),
            platform: randomPick(PLATFORMS),
            channel: randomPick(CHANNELS),
            subChannel: randomPick(SUB_CHANNELS),
          },
          'db-only'
        );
        latencies.push(result.latencyMs);
        if (result.ok) successCount++;
        else if (result.status === 409) {
          result.data?.error?.code === 'ALREADY_USED'
            ? duplicateCount++
            : limitCount++;
        } else {
          errorCount++;
          if (result.status === 500 || result.status === 0) poolTimeoutErrors++;
          const errKey = `${result.status}:${result.data?.error?.code || result.data?.error?.message || result.data?.message || 'unknown'}`;
          errorDetails[errKey] = (errorDetails[errKey] || 0) + 1;
        }
      })
    );
    if (
      (i + STRESS_CONCURRENCY) % 1000 === 0 ||
      i + STRESS_CONCURRENCY >= codes.length
    ) {
      const done = Math.min(i + STRESS_CONCURRENCY, codes.length);
      process.stdout.write(
        `\r   Redeemed: ${done.toLocaleString()} / ${codes.length.toLocaleString()} (${((Date.now() - redeemStart) / 1000).toFixed(1)}s, ~${Math.round((done / (Date.now() - redeemStart)) * 1000)} req/s)`
      );
    }
  }
  const redeemTimeMs = Date.now() - redeemStart;
  const dbReport = await monitor.stop();
  console.log('');

  // Print metrics
  const sorted = [...latencies].sort((a, b) => a - b);
  const throughput = Math.round(codes.length / (redeemTimeMs / 1000));
  console.log(
    `\n   📊 DB-Only Results: ${throughput} req/s, Avg ${(sorted.reduce((a, b) => a + b, 0) / sorted.length).toFixed(0)}ms, P99 ${sorted[Math.floor(sorted.length * 0.99)]}ms`
  );
  console.log(`   ├─ Success: ${successCount}, Errors: ${errorCount}`);
  if (Object.keys(errorDetails).length > 0) {
    console.log(`   ├─ Error breakdown:`);
    for (const [key, count] of Object.entries(errorDetails).sort(
      (a, b) => b[1] - a[1]
    )) {
      console.log(`   │  ${key}: ${count}`);
    }
  }
  printDbMonitor('DB-ONLY', dbReport, poolTimeoutErrors);

  // No BullMQ wait needed — DB-only writes synchronously

  // Integrity check — no BullMQ, results are immediate
  const usedCoupons = await knex('g_coupons')
    .where('settingId', settingId)
    .where('status', 'USED')
    .count('* as count')
    .first();
  const usageRecords = await knex('g_coupon_uses')
    .where('settingId', settingId)
    .count('* as count')
    .first();
  const settingRow = await knex('g_coupon_settings')
    .where('id', settingId)
    .select('usedCount')
    .first();
  const dbUsed = Number(usedCoupons?.count || 0);
  const dbUses = Number(usageRecords?.count || 0);
  const cached = Number(settingRow?.usedCount || 0);

  const integrity: IntegrityCheck[] = [
    {
      label: 'g_coupons (USED)',
      expected: successCount,
      actual: dbUsed,
      pass: dbUsed === successCount,
    },
    {
      label: 'g_coupon_uses',
      expected: successCount,
      actual: dbUses,
      pass: dbUses === successCount,
    },
    {
      label: 'usedCount cache',
      expected: successCount,
      actual: cached,
      pass: cached === successCount,
    },
  ];
  integrity.forEach((c) =>
    console.log(
      `   ${c.pass ? '✅' : '❌'} ${c.label}: ${c.actual} (expected ${c.expected})`
    )
  );

  return {
    name: `DB-Only Baseline (${STRESS_QUANTITY.toLocaleString()} codes, concurrency=${STRESS_CONCURRENCY})`,
    totalTimeMs: redeemTimeMs,
    throughput,
    successCount,
    totalRequests: codes.length,
    duplicateCount,
    limitExceededCount: limitCount,
    globalLimitCount: 0,
    errorCount,
    poolTimeoutErrors,
    latencies,
    dbMonitor: dbReport,
    integrity,
  };
}

// ============================================================
// Main
// ============================================================
async function main() {
  console.log('🚀 Coupon System Benchmark (Redis vs DB-Only Comparison)');
  console.log('='.repeat(80));
  console.log(`   Started: ${new Date().toISOString()}`);
  console.log(`   Target:  ${BASE_URL}`);

  try {
    const healthResp = await fetch(`${BASE_URL}/ready`);
    if (!healthResp.ok)
      throw new Error(`Server not ready: ${healthResp.status}`);
    console.log(`   Server:  ✅ Ready`);

    const environmentId = await getEnvironmentId();
    console.log(`   Env ID:  ${environmentId}`);

    await cleanupBenchmarkData(environmentId);

    // Phase 0: DB-only baseline
    const dbOnlyResult = await benchmarkNormalDbOnly(environmentId);

    // Cleanup between phases to reset DB state
    await cleanupBenchmarkData(environmentId);

    // Phase 1: Redis + BullMQ
    const normalResult = await benchmarkNormal(environmentId);

    // Phase 2: SPECIAL coupon
    const specialResult = await benchmarkSpecial(environmentId);

    // Final summary
    console.log('\n' + '='.repeat(80));
    console.log('🏆 FINAL SUMMARY');
    console.log('='.repeat(80));

    // Performance comparison
    const speedup =
      dbOnlyResult.throughput > 0
        ? (
            ((normalResult.throughput - dbOnlyResult.throughput) /
              dbOnlyResult.throughput) *
            100
          ).toFixed(1)
        : 'N/A';
    console.log(
      `\n   ⚡ Performance Comparison (${STRESS_QUANTITY.toLocaleString()} codes, concurrency=${STRESS_CONCURRENCY}):`
    );
    console.log(
      `   ├─ DB-Only:      ${dbOnlyResult.throughput} req/s, P99=${[...dbOnlyResult.latencies].sort((a, b) => a - b)[Math.floor(dbOnlyResult.latencies.length * 0.99)]}ms`
    );
    console.log(
      `   ├─ Redis+BullMQ: ${normalResult.throughput} req/s, P99=${[...normalResult.latencies].sort((a, b) => a - b)[Math.floor(normalResult.latencies.length * 0.99)]}ms`
    );
    console.log(`   └─ Throughput Δ: ${speedup}%`);

    console.log(`\n   🚨 Connection Pool Pressure (pool max=10):`);
    console.log(
      `   ├─ DB-Only:      Peak Pending=${dbOnlyResult.dbMonitor.peakPoolPending}, Avg Pending=${dbOnlyResult.dbMonitor.avgPoolPending}, Timeouts=${dbOnlyResult.poolTimeoutErrors}`
    );
    console.log(
      `   ├─ Redis+BullMQ: Peak Pending=${normalResult.dbMonitor.peakPoolPending}, Avg Pending=${normalResult.dbMonitor.avgPoolPending}, Timeouts=${normalResult.poolTimeoutErrors}`
    );
    console.log(
      `   └─ Deadlocks:    DB-ONLY=${dbOnlyResult.dbMonitor.deadlocksDelta}, REDIS=${normalResult.dbMonitor.deadlocksDelta}, SPECIAL=${specialResult.dbMonitor.deadlocksDelta}`
    );

    const allIntegrity = [
      ...dbOnlyResult.integrity,
      ...normalResult.integrity,
      ...specialResult.integrity,
    ];
    const allPassed =
      allIntegrity.every((c) => c.pass) &&
      dbOnlyResult.dbMonitor.deadlocksDelta === 0 &&
      normalResult.dbMonitor.deadlocksDelta === 0 &&
      specialResult.dbMonitor.deadlocksDelta === 0;

    console.log('');
    for (const c of allIntegrity)
      console.log(`   ${c.pass ? '✅' : '❌'} ${c.label}`);
    console.log(
      `\n   ${allPassed ? '🎉 ALL CHECKS PASSED' : '💥 SOME CHECKS FAILED'}`
    );

    // Generate HTML and JSON reports
    const reportPath = generateHtmlReport(
      [dbOnlyResult, normalResult, specialResult],
      join(__dirname)
    );
    const jsonPath = join(
      __dirname,
      `benchmark-report-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
    );

    // Using require('fs') to avoid top-level import conflicts in the script
    require('fs').writeFileSync(
      jsonPath,
      JSON.stringify(
        {
          timestamp: new Date().toISOString(),
          results: {
            dbOnly: {
              throughput: dbOnlyResult.throughput,
              avgLatency:
                dbOnlyResult.latencies.reduce((a, b) => a + b, 0) /
                dbOnlyResult.latencies.length,
              p99Latency: [...dbOnlyResult.latencies].sort((a, b) => a - b)[
                Math.floor(dbOnlyResult.latencies.length * 0.99)
              ],
              successCount: dbOnlyResult.successCount,
              errorCount: dbOnlyResult.errorCount,
            },
            redisMegaLua: {
              throughput: normalResult.throughput,
              avgLatency:
                normalResult.latencies.reduce((a, b) => a + b, 0) /
                normalResult.latencies.length,
              p99Latency: [...normalResult.latencies].sort((a, b) => a - b)[
                Math.floor(normalResult.latencies.length * 0.99)
              ],
              successCount: normalResult.successCount,
              errorCount: normalResult.errorCount,
            },
            special: {
              throughput: specialResult.throughput,
              successCount: specialResult.successCount,
              errorCount: specialResult.errorCount,
            },
          },
          improvements: {
            throughputPercent: speedup,
          },
        },
        null,
        2
      )
    );

    console.log(`\n   📄 HTML Report: ${reportPath}`);
    console.log(`   📄 JSON Report: ${jsonPath}`);
    console.log('\n   🧹 Cleaning up...');
    await cleanupBenchmarkData(environmentId);

    console.log(`\n   Completed: ${new Date().toISOString()}`);
  } catch (error) {
    console.error('Fatal error:', error);
  } finally {
    await knex.destroy();
    try {
      await redisClient.getClient().quit();
    } catch {}
    process.exit(0);
  }
}

main();

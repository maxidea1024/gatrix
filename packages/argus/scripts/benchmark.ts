/**
 * Argus Pipeline Benchmark
 *
 * Tests ingest throughput by sending concurrent error events to the API.
 * Measures: total time, events/sec, latency percentiles (p50, p95, p99).
 *
 * Usage:
 *   npx ts-node scripts/benchmark.ts [--events 1000] [--concurrency 50] [--dsn <publicKey>]
 *
 * Prerequisites:
 *   - Argus API running on port 45300
 *   - At least one active DSN key in the database
 */

const BASE_URL = process.env.ARGUS_URL || 'http://localhost:45300/argus/api';

// ── CLI Args ──
function parseArgs() {
  const args = process.argv.slice(2);
  const config = {
    events: 1000,
    concurrency: 50,
    dsn: '',
    projectId: '',
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--events' && args[i + 1]) config.events = parseInt(args[i + 1], 10);
    if (args[i] === '--concurrency' && args[i + 1]) config.concurrency = parseInt(args[i + 1], 10);
    if (args[i] === '--dsn' && args[i + 1]) config.dsn = args[i + 1];
    if (args[i] === '--project' && args[i + 1]) config.projectId = args[i + 1];
  }
  return config;
}

// ── Synthetic Event Generator ──
function generateErrorEvent(index: number) {
  const errorTypes = [
    { type: 'TypeError', value: 'Cannot read property "foo" of undefined' },
    { type: 'ReferenceError', value: 'bar is not defined' },
    { type: 'SyntaxError', value: 'Unexpected token }' },
    { type: 'RangeError', value: 'Maximum call stack size exceeded' },
    { type: 'NetworkError', value: 'Failed to fetch /api/data' },
  ];

  const error = errorTypes[index % errorTypes.length];
  const envs = ['production', 'staging', 'development'];
  const releases = ['1.0.0', '1.1.0', '1.2.0-beta', '2.0.0'];

  return {
    type: 'error',
    event_id: `bench-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
    level: index % 20 === 0 ? 'fatal' : 'error',
    platform: 'javascript',
    environment: envs[index % envs.length],
    release: releases[index % releases.length],
    exception: {
      type: error.type,
      value: `${error.value} (event #${index})`,
      stacktrace: {
        frames: [
          {
            filename: `src/components/Widget${index % 10}.tsx`,
            function: `handleClick_${index % 50}`,
            lineno: 42 + (index % 100),
            colno: 12,
            in_app: true,
          },
          {
            filename: 'node_modules/react/index.js',
            function: 'dispatchEvent',
            lineno: 1234,
            colno: 5,
            in_app: false,
          },
        ],
      },
    },
    tags: {
      browser: ['Chrome', 'Firefox', 'Safari'][index % 3],
      os: ['Windows', 'macOS', 'Linux'][index % 3],
    },
    user: {
      id: `user-${index % 200}`,
      email: `user${index % 200}@example.com`,
    },
  };
}

// ── Latency Tracker ──
class LatencyTracker {
  private latencies: number[] = [];
  private errors = 0;
  private statusCodes: Map<number, number> = new Map();

  record(latencyMs: number, status: number) {
    this.latencies.push(latencyMs);
    this.statusCodes.set(status, (this.statusCodes.get(status) || 0) + 1);
  }

  recordError() {
    this.errors++;
  }

  report() {
    if (this.latencies.length === 0) {
      return { count: 0, errors: this.errors };
    }

    const sorted = [...this.latencies].sort((a, b) => a - b);
    const sum = sorted.reduce((a, b) => a + b, 0);

    return {
      count: sorted.length,
      errors: this.errors,
      min: sorted[0].toFixed(1),
      max: sorted[sorted.length - 1].toFixed(1),
      avg: (sum / sorted.length).toFixed(1),
      p50: sorted[Math.floor(sorted.length * 0.5)].toFixed(1),
      p95: sorted[Math.floor(sorted.length * 0.95)].toFixed(1),
      p99: sorted[Math.floor(sorted.length * 0.99)].toFixed(1),
      statusCodes: Object.fromEntries(this.statusCodes),
    };
  }
}

// ── Fetch DSN if not provided ──
async function fetchDsnKey(): Promise<{ dsn: string; projectId: string }> {
  // Try to get from the database via the API's internal diagnostics
  // Fall back to manual input
  console.log('ℹ️  Attempting to auto-discover DSN key...');

  // Try querying MySQL directly using the same env vars
  try {
    const mysql2 = require('mysql2/promise');
    const dotenv = require('dotenv');
    const path = require('path');
    dotenv.config({ path: path.join(__dirname, '../.env') });
    dotenv.config({ path: path.join(__dirname, '../../../.env') });

    const pool = await mysql2.createPool({
      host: process.env.MYSQL_HOST || 'localhost',
      port: parseInt(process.env.MYSQL_PORT || '3306', 10),
      user: process.env.MYSQL_USER || 'root',
      password: process.env.MYSQL_PASSWORD || '',
      database: process.env.MYSQL_DATABASE || 'gatrix',
    });

    const [rows] = await pool.query(`
      SELECT dk.public_key, ap.gatrix_project_id
      FROM g_argus_dsnKeys dk
      JOIN g_argus_projects ap ON dk.project_id = ap.id
      WHERE dk.is_active = 1
      LIMIT 1
    `);

    await pool.end();

    if ((rows as any[]).length > 0) {
      const row = (rows as any[])[0];
      console.log(`✅ Found DSN key: ${row.public_key.slice(0, 12)}...`);
      console.log(`✅ Project ID: ${row.gatrix_project_id}`);
      return { dsn: row.public_key, projectId: row.gatrix_project_id };
    }
  } catch (e: any) {
    console.log(`⚠️  Could not auto-discover DSN: ${e.message}`);
  }

  throw new Error('No DSN key found. Provide --dsn <publicKey> --project <projectId>');
}

// ── Send single event ──
async function sendEvent(
  projectId: string,
  dsn: string,
  event: any,
  tracker: LatencyTracker
): Promise<void> {
  const start = performance.now();
  try {
    const response = await fetch(`${BASE_URL}/${projectId}/ingest`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${dsn}`,
      },
      body: JSON.stringify(event),
    });
    const latency = performance.now() - start;
    tracker.record(latency, response.status);
  } catch {
    tracker.recordError();
  }
}

// ── Send batch ──
async function sendBatch(
  projectId: string,
  dsn: string,
  events: any[],
  tracker: LatencyTracker
): Promise<void> {
  const start = performance.now();
  try {
    const response = await fetch(`${BASE_URL}/${projectId}/ingest/batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${dsn}`,
      },
      body: JSON.stringify({ events }),
    });
    const latency = performance.now() - start;
    tracker.record(latency, response.status);
  } catch {
    tracker.recordError();
  }
}

// ── Run concurrent tasks ──
async function runConcurrent<T>(
  tasks: (() => Promise<T>)[],
  concurrency: number
): Promise<void> {
  let idx = 0;
  const workers = Array.from({ length: Math.min(concurrency, tasks.length) }, async () => {
    while (idx < tasks.length) {
      const taskIdx = idx++;
      await tasks[taskIdx]();
    }
  });
  await Promise.all(workers);
}

// ── Main ──
async function main() {
  const cfg = parseArgs();

  console.log('');
  console.log('═══════════════════════════════════════════════════');
  console.log('         🔬 Argus Pipeline Benchmark');
  console.log('═══════════════════════════════════════════════════');

  // Resolve DSN
  let dsn = cfg.dsn;
  let projectId = cfg.projectId;

  if (!dsn || !projectId) {
    const discovered = await fetchDsnKey();
    dsn = dsn || discovered.dsn;
    projectId = projectId || discovered.projectId;
  }

  // ── Health check ──
  try {
    const health = await fetch('http://localhost:45300/health');
    if (!health.ok) throw new Error(`HTTP ${health.status}`);
    console.log(`\n✅ API server reachable at ${BASE_URL}`);
  } catch (e: any) {
    console.error(`\n❌ API server not reachable at ${BASE_URL}: ${e.message}`);
    console.error('   Make sure Argus API is running (yarn dev:api)');
    process.exit(1);
  }

  console.log(`\n📊 Config:`);
  console.log(`   Events:      ${cfg.events}`);
  console.log(`   Concurrency: ${cfg.concurrency}`);
  console.log(`   DSN:         ${dsn.slice(0, 12)}...`);
  console.log(`   Project:     ${projectId}`);
  console.log('');

  // ════════════════════════════════════════════
  // Scenario 1: Single event ingest
  // ════════════════════════════════════════════
  console.log('── Scenario 1: Single Event Ingest ──');
  console.log(`   Sending ${cfg.events} individual events...`);

  const singleTracker = new LatencyTracker();
  const singleTasks = Array.from({ length: cfg.events }, (_, i) => {
    return () => sendEvent(projectId, dsn, generateErrorEvent(i), singleTracker);
  });

  const singleStart = performance.now();
  await runConcurrent(singleTasks, cfg.concurrency);
  const singleElapsed = performance.now() - singleStart;

  const singleReport = singleTracker.report();
  const singleEps = (singleReport.count / (singleElapsed / 1000)).toFixed(0);

  console.log(`\n   ✅ Results:`);
  console.log(`   Total time:    ${(singleElapsed / 1000).toFixed(2)}s`);
  console.log(`   Throughput:    ${singleEps} events/sec`);
  console.log(`   Latency (ms):  min=${singleReport.min}  avg=${singleReport.avg}  p50=${singleReport.p50}  p95=${singleReport.p95}  p99=${singleReport.p99}  max=${singleReport.max}`);
  console.log(`   Status codes:  ${JSON.stringify(singleReport.statusCodes)}`);
  console.log(`   Errors:        ${singleReport.errors}`);
  console.log('');

  // ════════════════════════════════════════════
  // Scenario 2: Batch event ingest
  // ════════════════════════════════════════════
  const BATCH_SIZE = 50;
  const batchCount = Math.ceil(cfg.events / BATCH_SIZE);

  console.log('── Scenario 2: Batch Event Ingest ──');
  console.log(`   Sending ${cfg.events} events in ${batchCount} batches of ${BATCH_SIZE}...`);

  const batchTracker = new LatencyTracker();
  const batchTasks = Array.from({ length: batchCount }, (_, batchIdx) => {
    const events = Array.from(
      { length: Math.min(BATCH_SIZE, cfg.events - batchIdx * BATCH_SIZE) },
      (_, i) => generateErrorEvent(batchIdx * BATCH_SIZE + i)
    );
    return () => sendBatch(projectId, dsn, events, batchTracker);
  });

  const batchStart = performance.now();
  await runConcurrent(batchTasks, cfg.concurrency);
  const batchElapsed = performance.now() - batchStart;

  const batchReport = batchTracker.report();
  const batchEps = (cfg.events / (batchElapsed / 1000)).toFixed(0);

  console.log(`\n   ✅ Results:`);
  console.log(`   Total time:    ${(batchElapsed / 1000).toFixed(2)}s`);
  console.log(`   Throughput:    ${batchEps} events/sec (${batchReport.count} batches)`);
  console.log(`   Latency (ms):  min=${batchReport.min}  avg=${batchReport.avg}  p50=${batchReport.p50}  p95=${batchReport.p95}  p99=${batchReport.p99}  max=${batchReport.max}`);
  console.log(`   Status codes:  ${JSON.stringify(batchReport.statusCodes)}`);
  console.log(`   Errors:        ${batchReport.errors}`);
  console.log('');

  // ════════════════════════════════════════════
  // Summary
  // ════════════════════════════════════════════
  console.log('═══════════════════════════════════════════════════');
  console.log('                    Summary');
  console.log('═══════════════════════════════════════════════════');
  console.log(`   Single ingest:  ${singleEps} events/sec  (p95: ${singleReport.p95}ms)`);
  console.log(`   Batch ingest:   ${batchEps} events/sec  (p95: ${batchReport.p95}ms)`);
  console.log(`   Batch speedup:  ${(parseInt(batchEps) / parseInt(singleEps)).toFixed(1)}x`);
  console.log('═══════════════════════════════════════════════════');
  console.log('');
}

main().catch((e) => {
  console.error('Benchmark failed:', e.message);
  process.exit(1);
});

#!/usr/bin/env ts-node
/**
 * Argus Event Simulator — Sends realistic test data to the Argus ingest API.
 *
 * Usage:
 *   npx ts-node packages/argus/scripts/simulate-events.ts
 *
 * Requires a valid DSN key. Reads from env ARGUS_DSN_KEY or auto-discovers.
 */
import axios from 'axios';
import { v4 as uuid } from 'uuid';

// ============ Config ============
const ARGUS_URL = process.env.ARGUS_URL || 'http://localhost:45300';
const DSN_KEY = process.env.ARGUS_DSN_KEY || ''; // Will auto-discover if empty
const PROJECT_ID = process.env.ARGUS_PROJECT_ID || '1';

const ERROR_COUNT = 40;
const TRANSACTION_COUNT = 120;
const SESSION_COUNT = 80;
const FEEDBACK_COUNT = 10;

// ============ Helpers ============
function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pastTimestamp(hoursAgo: number): string {
  const d = new Date(Date.now() - Math.random() * hoursAgo * 3600000);
  return d.toISOString();
}

function generateFingerprint(): string[] {
  return [uuid().replace(/-/g, '').slice(0, 32)];
}

// ============ Error Generators ============
const ERROR_TYPES = [
  { type: 'TypeError', value: "Cannot read properties of undefined (reading 'map')", culprit: 'UserList.render' },
  { type: 'ReferenceError', value: 'playerData is not defined', culprit: 'GameScene.update' },
  { type: 'RangeError', value: 'Maximum call stack size exceeded', culprit: 'EventEmitter.emit' },
  { type: 'NetworkError', value: 'Failed to fetch: /api/v1/inventory', culprit: 'InventoryService.load' },
  { type: 'SyntaxError', value: "Unexpected token '<' in JSON at position 0", culprit: 'ResponseParser.parse' },
  { type: 'TimeoutError', value: 'Request timed out after 30000ms', culprit: 'HttpClient.request' },
  { type: 'DatabaseError', value: 'Connection pool exhausted', culprit: 'DatabaseService.query' },
  { type: 'AuthenticationError', value: 'JWT token expired', culprit: 'AuthMiddleware.verify' },
  { type: 'ValidationError', value: 'Invalid email format', culprit: 'UserRegistration.validate' },
  { type: 'PermissionError', value: 'Insufficient permissions for resource', culprit: 'AccessControl.check' },
];

const PLATFORMS = ['javascript', 'node', 'python', 'java'];
const ENVIRONMENTS = ['production', 'staging', 'development'];
const RELEASES = ['1.0.0', '1.1.0', '1.2.0-beta.1', '1.2.0-beta.2', '1.2.0'];
const BROWSERS = ['Chrome', 'Firefox', 'Safari', 'Edge'];
const OS_NAMES = ['Windows', 'macOS', 'Linux', 'iOS', 'Android'];
const USER_IDS = Array.from({ length: 30 }, (_, i) => `user_${1000 + i}`);

function generateErrorEvent() {
  const errDef = randomItem(ERROR_TYPES);
  const fp = generateFingerprint();
  return {
    type: 'error',
    event_id: uuid().replace(/-/g, ''),
    timestamp: pastTimestamp(24),
    platform: randomItem(PLATFORMS),
    environment: randomItem(ENVIRONMENTS),
    release: randomItem(RELEASES),
    level: randomItem(['fatal', 'error', 'warning'] as const),
    logger: randomItem(['app', 'server', 'worker', 'scheduler']),
    transaction: randomItem(['/api/users', '/api/game/match', '/api/inventory', '/dashboard']),
    fingerprint: fp,
    exception: {
      type: errDef.type,
      value: errDef.value,
      mechanism: randomItem(['onerror', 'onunhandledrejection', 'instrument', 'generic']),
      stacktrace: {
        frames: [
          {
            filename: `src/${errDef.culprit.replace('.', '/')}.ts`,
            function: errDef.culprit.split('.')[1],
            lineno: randomInt(10, 500),
            colno: randomInt(1, 80),
            in_app: true,
          },
          {
            filename: 'node_modules/express/lib/router/index.js',
            function: 'processParams',
            lineno: randomInt(100, 400),
            colno: randomInt(1, 40),
            in_app: false,
          },
        ],
      },
    },
    breadcrumbs: [
      { timestamp: pastTimestamp(24), category: 'navigation', message: 'Page loaded' },
      { timestamp: pastTimestamp(24), category: 'http', message: `GET /api/data`, data: { status_code: 200 } },
      { timestamp: pastTimestamp(24), category: 'ui.click', message: 'button#submit' },
    ],
    user: {
      id: randomItem(USER_IDS),
      email: `${randomItem(USER_IDS)}@example.com`,
      ip_address: `192.168.${randomInt(0, 255)}.${randomInt(1, 254)}`,
    },
    contexts: {
      os: { name: randomItem(OS_NAMES), version: `${randomInt(10, 15)}.${randomInt(0, 9)}` },
      browser: { name: randomItem(BROWSERS), version: `${randomInt(90, 125)}.0` },
    },
    tags: {
      component: randomItem(['frontend', 'backend', 'worker']),
      region: randomItem(['us-east-1', 'eu-west-1', 'ap-northeast-1']),
    },
  };
}

// ============ Transaction Generators ============
const TRANSACTION_NAMES = [
  'GET /api/v1/users',
  'POST /api/v1/auth/login',
  'GET /api/v1/game/match',
  'POST /api/v1/inventory/update',
  'GET /api/v1/leaderboard',
  'POST /api/v1/chat/send',
  'GET /api/v1/notifications',
  'POST /api/v1/payment/process',
  'GET /api/v1/settings',
  'PUT /api/v1/profile',
];

const TXN_OPS = ['http.server', 'http.client', 'db.query', 'queue.process'];

function generateTransactionEvent() {
  const duration = randomInt(50, 5000);
  const now = new Date(Date.now() - Math.random() * 24 * 3600000);
  const start = new Date(now.getTime() - duration);

  const trace_id = uuid().replace(/-/g, '');
  const span_id = uuid().replace(/-/g, '').slice(0, 16);
  
  const numSpans = randomInt(2, 8);
  const spans = [];
  let currentStart = start.getTime();
  let parentSpanId = span_id;
  for (let i = 0; i < numSpans; i++) {
    const spanDur = randomInt(10, Math.max(10, Math.floor(duration / numSpans)));
    spans.push({
      span_id: uuid().replace(/-/g, '').slice(0, 16),
      parent_span_id: parentSpanId,
      trace_id,
      op: randomItem(['db.query', 'http.client', 'cache.get', 'function']),
      description: `Dummy operation ${i}`,
      start_timestamp: new Date(currentStart).toISOString(),
      timestamp: new Date(currentStart + spanDur).toISOString(),
      duration: spanDur,
      status: 'ok',
      data: { 'db.system': 'mysql' }
    });
    // Create some hierarchy
    if (Math.random() > 0.5) parentSpanId = spans[spans.length - 1].span_id;
    currentStart += spanDur;
  }

  return {
    type: 'transaction',
    event_id: uuid().replace(/-/g, ''),
    timestamp: now.toISOString(),
    platform: randomItem(PLATFORMS),
    environment: randomItem(ENVIRONMENTS),
    release: randomItem(RELEASES),
    transaction: randomItem(TRANSACTION_NAMES),
    transaction_op: randomItem(TXN_OPS),
    trace_id,
    span_id,
    start_timestamp: start.toISOString(),
    duration,
    spans,
    transaction_status: randomItem(['ok', 'ok', 'ok', 'ok', 'internal_error', 'deadline_exceeded']),
    http_method: randomItem(['GET', 'POST', 'PUT', 'DELETE']),
    http_status_code: randomItem([200, 200, 200, 201, 400, 404, 500]),
    user: {
      id: randomItem(USER_IDS),
    },
    tags: {
      region: randomItem(['us-east-1', 'eu-west-1', 'ap-northeast-1']),
    },
    measurements: {
      fp: Math.random() * 3000,
      fcp: Math.random() * 2000,
      lcp: Math.random() * 5000,
    },
  };
}

// ============ Session Generators ============
function generateSessionEvent() {
  const status = randomItem(['ok', 'ok', 'ok', 'exited', 'exited', 'crashed', 'abnormal'] as const);
  return {
    type: 'session',
    event_id: uuid().replace(/-/g, ''),
    timestamp: pastTimestamp(24),
    platform: randomItem(PLATFORMS),
    environment: randomItem(ENVIRONMENTS),
    release: randomItem(RELEASES),
    session_id: uuid(),
    started: pastTimestamp(24),
    status,
    seq: 0,
    duration: status === 'ok' || status === 'exited' ? randomInt(1000, 600000) : randomInt(100, 30000),
    errors: status === 'crashed' ? randomInt(1, 5) : 0,
    distinct_id: randomItem(USER_IDS),
    user_agent: `Mozilla/5.0 (${randomItem(OS_NAMES)}) Chrome/${randomInt(90, 125)}.0`,
  };
}

// ============ Feedback Generators ============
const FEEDBACK_MESSAGES = [
  "The dashboard keeps crashing when I try to view reports.",
  "Login page is very slow today. Takes over 10 seconds.",
  "Excellent performance improvements in the latest update!",
  "Getting 'undefined' errors on the inventory page.",
  "Mobile layout is broken on iOS Safari.",
  "The search feature doesn't return expected results.",
  "Game client crashes during matchmaking since last patch.",
  "Payment processing failed multiple times.",
  "Please add dark mode support for the admin panel.",
  "Export to CSV is not working for large datasets.",
];

function generateFeedbackEvent() {
  const userId = randomItem(USER_IDS);
  return {
    type: 'feedback',
    event_id: uuid().replace(/-/g, ''),
    timestamp: pastTimestamp(48),
    platform: randomItem(PLATFORMS),
    environment: randomItem(ENVIRONMENTS),
    release: randomItem(RELEASES),
    name: `User ${userId.split('_')[1]}`,
    email: `${userId}@example.com`,
    message: randomItem(FEEDBACK_MESSAGES),
    contact_email: `${userId}@example.com`,
    url: randomItem(['/dashboard', '/game/lobby', '/settings', '/inventory', '/leaderboard']),
    source: randomItem(['widget', 'api', 'dialog']),
  };
}

// ============ Main ============
async function discoverDsnKey(): Promise<string> {
  if (DSN_KEY) return DSN_KEY;

  console.log('🔍 Auto-discovering DSN key...');
  const resp = await axios.get(`${ARGUS_URL}/argus/api/projects/${PROJECT_ID}`);
  const keys = resp.data?.data?.dsn_keys;
  if (keys && keys.length > 0) {
    const key = keys[0].public_key;
    console.log(`✅ Found DSN key: ${key.slice(0, 8)}...`);
    return key;
  }
  throw new Error('No DSN key found. Create a project first.');
}

async function sendBatch(dsnKey: string, events: any[], label: string) {
  const url = `${ARGUS_URL}/argus/api/${PROJECT_ID}/ingest/batch`;
  try {
    const resp = await axios.post(
      url,
      { events },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${dsnKey}`,
        },
        timeout: 30000,
      }
    );
    console.log(`  ✅ ${label}: ${events.length} events → ${resp.status} (${resp.data?.event_ids?.length || 0} accepted)`);
  } catch (error: any) {
    console.error(`  ❌ ${label}: ${error.response?.status || error.code} — ${error.response?.data?.message || error.message}`);
  }
}

async function main() {
  console.log('🚀 Argus Event Simulator');
  console.log(`   Target: ${ARGUS_URL}`);
  console.log(`   Project ID: ${PROJECT_ID}`);
  console.log('');

  const dsnKey = await discoverDsnKey();

  // Generate events
  console.log('📦 Generating events...');

  const errors = Array.from({ length: ERROR_COUNT }, generateErrorEvent);
  const transactions = Array.from({ length: TRANSACTION_COUNT }, generateTransactionEvent);
  const sessions = Array.from({ length: SESSION_COUNT }, generateSessionEvent);
  const feedbacks = Array.from({ length: FEEDBACK_COUNT }, generateFeedbackEvent);

  console.log(`   ${errors.length} errors, ${transactions.length} transactions, ${sessions.length} sessions, ${feedbacks.length} feedbacks`);
  console.log('');

  // Send in batches
  console.log('📤 Sending to Argus...');

  // Send errors in chunks of 20
  for (let i = 0; i < errors.length; i += 20) {
    await sendBatch(dsnKey, errors.slice(i, i + 20), `Errors [${i + 1}-${Math.min(i + 20, errors.length)}]`);
  }

  // Send transactions in chunks of 30
  for (let i = 0; i < transactions.length; i += 30) {
    await sendBatch(dsnKey, transactions.slice(i, i + 30), `Transactions [${i + 1}-${Math.min(i + 30, transactions.length)}]`);
  }

  // Send sessions in chunks of 20
  for (let i = 0; i < sessions.length; i += 20) {
    await sendBatch(dsnKey, sessions.slice(i, i + 20), `Sessions [${i + 1}-${Math.min(i + 20, sessions.length)}]`);
  }

  // Send feedback
  await sendBatch(dsnKey, feedbacks, `Feedback [all]`);

  console.log('');
  console.log('⏳ Waiting 5s for worker processing...');
  await new Promise((r) => setTimeout(r, 5000));

  // Verify
  console.log('');
  console.log('🔎 Verifying data in API...');

  const checks = [
    { name: 'Overview', url: `${ARGUS_URL}/argus/api/overview/${PROJECT_ID}?period=24h` },
    { name: 'Issues', url: `${ARGUS_URL}/argus/api/${PROJECT_ID}/issues` },
    { name: 'Performance', url: `${ARGUS_URL}/argus/api/performance/${PROJECT_ID}/transactions?period=24h` },
    { name: 'Sessions', url: `${ARGUS_URL}/argus/api/sessions/${PROJECT_ID}?period=24h` },
    { name: 'Feedback', url: `${ARGUS_URL}/argus/api/feedback/${PROJECT_ID}?period=48h` },
  ];

  for (const check of checks) {
    try {
      const resp = await axios.get(check.url);
      const data = resp.data?.data;
      let summary = '';
      if (check.name === 'Overview') {
        summary = `errors=${data?.error_summary?.total_errors || 0}, txns=${data?.transaction_summary?.total_transactions || 0}, sessions=${data?.session_summary?.total_sessions || 0}`;
      } else if (check.name === 'Issues') {
        summary = `total=${resp.data?.total || 0}`;
      } else if (check.name === 'Performance') {
        summary = `transactions=${(Array.isArray(data) ? data : []).length} types`;
      } else if (check.name === 'Sessions') {
        summary = `total=${data?.summary?.total_sessions || 0}, crash_free=${data?.summary?.crash_free_rate || 0}%`;
      } else if (check.name === 'Feedback') {
        summary = `total=${data?.total || 0}`;
      }
      console.log(`  ✅ ${check.name}: ${summary}`);
    } catch (error: any) {
      console.error(`  ❌ ${check.name}: ${error.response?.status || error.message}`);
    }
  }

  console.log('');
  console.log('🎉 Simulation complete!');
}

main().catch((err) => {
  console.error('💥 Fatal error:', err.message);
  process.exit(1);
});

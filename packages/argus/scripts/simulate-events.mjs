/**
 * Argus Event Simulator — Sends realistic test data to the Argus ingest API.
 * Usage: node packages/argus/scripts/simulate-events.mjs
 */

const ARGUS_URL = process.env.ARGUS_URL || 'http://localhost:45300';
const PROJECT_ID = process.env.ARGUS_PROJECT_ID || '1';

const ERROR_COUNT = 40;
const TRANSACTION_COUNT = 120;
const SESSION_COUNT = 80;
const FEEDBACK_COUNT = 10;

// ============ Helpers ============
function uuid() {
  return 'xxxxxxxxxxxx4xxxyxxxxxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function randomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pastTimestamp(hoursAgo) {
  return new Date(Date.now() - Math.random() * hoursAgo * 3600000).toISOString();
}

// ============ Data Pools ============
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

const TRANSACTION_NAMES = [
  'GET /api/v1/users', 'POST /api/v1/auth/login', 'GET /api/v1/game/match',
  'POST /api/v1/inventory/update', 'GET /api/v1/leaderboard', 'POST /api/v1/chat/send',
  'GET /api/v1/notifications', 'POST /api/v1/payment/process', 'GET /api/v1/settings', 'PUT /api/v1/profile',
];

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

// ============ Event Generators ============
function genError() {
  const e = randomItem(ERROR_TYPES);
  return {
    type: 'error', event_id: uuid(), timestamp: pastTimestamp(24),
    platform: randomItem(PLATFORMS), environment: randomItem(ENVIRONMENTS), release: randomItem(RELEASES),
    level: randomItem(['fatal', 'error', 'warning']),
    logger: randomItem(['app', 'server', 'worker', 'scheduler']),
    transaction: randomItem(['/api/users', '/api/game/match', '/api/inventory', '/dashboard']),
    fingerprint: [uuid()],
    exception: {
      type: e.type, value: e.value,
      mechanism: randomItem(['onerror', 'onunhandledrejection', 'instrument', 'generic']),
      stacktrace: { frames: [
        { filename: `src/${e.culprit.replace('.', '/')}.ts`, function: e.culprit.split('.')[1], lineno: randomInt(10, 500), colno: randomInt(1, 80), in_app: true },
        { filename: 'node_modules/express/lib/router/index.js', function: 'processParams', lineno: randomInt(100, 400), colno: randomInt(1, 40), in_app: false },
      ]},
    },
    breadcrumbs: [
      { timestamp: pastTimestamp(24), category: 'navigation', message: 'Page loaded' },
      { timestamp: pastTimestamp(24), category: 'http', message: 'GET /api/data', data: { status_code: 200 } },
    ],
    user: { id: randomItem(USER_IDS), email: `${randomItem(USER_IDS)}@example.com`, ip_address: `192.168.${randomInt(0, 255)}.${randomInt(1, 254)}` },
    contexts: { os: { name: randomItem(OS_NAMES), version: `${randomInt(10, 15)}.${randomInt(0, 9)}` }, browser: { name: randomItem(BROWSERS), version: `${randomInt(90, 125)}.0` } },
    tags: { component: randomItem(['frontend', 'backend', 'worker']), region: randomItem(['us-east-1', 'eu-west-1', 'ap-northeast-1']) },
  };
}

function genTransaction() {
  const dur = randomInt(50, 5000);
  const now = new Date(Date.now() - Math.random() * 24 * 3600000);
  return {
    type: 'transaction', event_id: uuid(), timestamp: now.toISOString(),
    platform: randomItem(PLATFORMS), environment: randomItem(ENVIRONMENTS), release: randomItem(RELEASES),
    transaction: randomItem(TRANSACTION_NAMES), transaction_op: randomItem(['http.server', 'http.client', 'db.query', 'queue.process']),
    trace_id: uuid(), span_id: uuid().slice(0, 16),
    start_timestamp: new Date(now.getTime() - dur).toISOString(), duration: dur,
    transaction_status: randomItem(['ok', 'ok', 'ok', 'ok', 'internal_error', 'deadline_exceeded']),
    http_method: randomItem(['GET', 'POST', 'PUT', 'DELETE']),
    http_status_code: randomItem([200, 200, 200, 201, 400, 404, 500]),
    user: { id: randomItem(USER_IDS) },
    tags: { region: randomItem(['us-east-1', 'eu-west-1', 'ap-northeast-1']) },
    measurements: { fp: Math.random() * 3000, fcp: Math.random() * 2000, lcp: Math.random() * 5000 },
  };
}

function genSession() {
  const status = randomItem(['ok', 'ok', 'ok', 'exited', 'exited', 'crashed', 'abnormal']);
  return {
    type: 'session', event_id: uuid(), timestamp: pastTimestamp(24),
    platform: randomItem(PLATFORMS), environment: randomItem(ENVIRONMENTS), release: randomItem(RELEASES),
    session_id: uuid(), started: pastTimestamp(24), status, seq: 0,
    duration: status === 'crashed' ? randomInt(100, 30000) : randomInt(1000, 600000),
    errors: status === 'crashed' ? randomInt(1, 5) : 0,
    distinct_id: randomItem(USER_IDS),
    user_agent: `Mozilla/5.0 (${randomItem(OS_NAMES)}) Chrome/${randomInt(90, 125)}.0`,
  };
}

function genFeedback() {
  const uid = randomItem(USER_IDS);
  return {
    type: 'feedback', event_id: uuid(), timestamp: pastTimestamp(48),
    platform: randomItem(PLATFORMS), environment: randomItem(ENVIRONMENTS), release: randomItem(RELEASES),
    name: `User ${uid.split('_')[1]}`, email: `${uid}@example.com`,
    message: randomItem(FEEDBACK_MESSAGES),
    contact_email: `${uid}@example.com`,
    url: randomItem(['/dashboard', '/game/lobby', '/settings', '/inventory', '/leaderboard']),
    source: randomItem(['widget', 'api', 'dialog']),
  };
}

// ============ HTTP ============
async function postJSON(url, body, headers = {}) {
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
  const text = await resp.text();
  return { status: resp.status, data: text ? JSON.parse(text) : null };
}

async function getJSON(url) {
  const resp = await fetch(url);
  const text = await resp.text();
  return { status: resp.status, data: text ? JSON.parse(text) : null };
}

// ============ Main ============
async function main() {
  console.log('🚀 Argus Event Simulator');
  console.log(`   Target: ${ARGUS_URL}`);
  console.log(`   Project ID: ${PROJECT_ID}`);
  console.log('');

  // Discover DSN key
  console.log('🔍 Discovering DSN key...');
  const projResp = await getJSON(`${ARGUS_URL}/argus/api/projects/${PROJECT_ID}`);
  if (projResp.status !== 200) {
    console.error(`❌ Project ${PROJECT_ID} not found (${projResp.status}). Create it first.`);
    process.exit(1);
  }
  const dsnKey = projResp.data?.data?.dsn_keys?.[0]?.public_key;
  if (!dsnKey) {
    console.error('❌ No active DSN key found.');
    process.exit(1);
  }
  console.log(`✅ DSN key: ${dsnKey.slice(0, 8)}...`);
  console.log('');

  const authHeaders = { Authorization: `Bearer ${dsnKey}` };

  // Generate
  console.log('📦 Generating events...');
  const errors = Array.from({ length: ERROR_COUNT }, genError);
  const txns = Array.from({ length: TRANSACTION_COUNT }, genTransaction);
  const sessions = Array.from({ length: SESSION_COUNT }, genSession);
  const feedbacks = Array.from({ length: FEEDBACK_COUNT }, genFeedback);
  console.log(`   ${errors.length} errors, ${txns.length} transactions, ${sessions.length} sessions, ${feedbacks.length} feedbacks`);
  console.log('');

  // Send
  console.log('📤 Sending to Argus...');
  const batchUrl = `${ARGUS_URL}/argus/api/${PROJECT_ID}/ingest/batch`;

  for (let i = 0; i < errors.length; i += 20) {
    const batch = errors.slice(i, i + 20);
    const r = await postJSON(batchUrl, { events: batch }, authHeaders);
    console.log(`  ${r.status === 202 ? '✅' : '❌'} Errors [${i + 1}-${Math.min(i + 20, errors.length)}]: ${r.status}`);
  }

  for (let i = 0; i < txns.length; i += 30) {
    const batch = txns.slice(i, i + 30);
    const r = await postJSON(batchUrl, { events: batch }, authHeaders);
    console.log(`  ${r.status === 202 ? '✅' : '❌'} Transactions [${i + 1}-${Math.min(i + 30, txns.length)}]: ${r.status}`);
  }

  for (let i = 0; i < sessions.length; i += 20) {
    const batch = sessions.slice(i, i + 20);
    const r = await postJSON(batchUrl, { events: batch }, authHeaders);
    console.log(`  ${r.status === 202 ? '✅' : '❌'} Sessions [${i + 1}-${Math.min(i + 20, sessions.length)}]: ${r.status}`);
  }

  const fr = await postJSON(batchUrl, { events: feedbacks }, authHeaders);
  console.log(`  ${fr.status === 202 ? '✅' : '❌'} Feedback [all ${feedbacks.length}]: ${fr.status}`);

  console.log('');
  console.log('⏳ Waiting 5s for worker processing...');
  await new Promise((r) => setTimeout(r, 5000));

  // Verify
  console.log('');
  console.log('🔎 Verifying data...');
  const checks = [
    { name: 'Overview', url: `${ARGUS_URL}/argus/api/overview/${PROJECT_ID}?period=24h`, fmt: (d) => `errors=${d?.error_summary?.total_errors||0}, txns=${d?.transaction_summary?.total_transactions||0}, sessions=${d?.session_summary?.total_sessions||0}` },
    { name: 'Issues', url: `${ARGUS_URL}/argus/api/${PROJECT_ID}/issues`, fmt: (_, r) => `total=${r?.total||0}` },
    { name: 'Performance', url: `${ARGUS_URL}/argus/api/performance/${PROJECT_ID}/transactions?period=24h`, fmt: (d) => `${(Array.isArray(d)?d:[]).length} transaction types` },
    { name: 'Sessions', url: `${ARGUS_URL}/argus/api/sessions/${PROJECT_ID}?period=24h`, fmt: (d) => `total=${d?.summary?.total_sessions||0}, crash_free=${d?.summary?.crash_free_rate||0}%` },
    { name: 'Feedback', url: `${ARGUS_URL}/argus/api/feedback/${PROJECT_ID}?period=48h`, fmt: (d) => `total=${d?.total||0}` },
  ];

  for (const c of checks) {
    try {
      const r = await getJSON(c.url);
      console.log(`  ✅ ${c.name}: ${c.fmt(r.data?.data, r.data)}`);
    } catch (e) {
      console.error(`  ❌ ${c.name}: ${e.message}`);
    }
  }

  console.log('');
  console.log('🎉 Simulation complete!');
}

main().catch((err) => { console.error('💥 Fatal:', err.message); process.exit(1); });

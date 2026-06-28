/**
 * Argus Tracking Realtime Simulator
 *
 * Continuously inserts errors, transactions, and logs into ClickHouse
 * to feed the Tracking Realtime dashboard (/argus/tracking-realtime).
 *
 * Usage: npx tsx scripts/simulate-tracking-realtime.ts
 */
import { createClient, ClickHouseClient } from '@clickhouse/client';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../.env.local') });
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

// ─── Config ───────────────────────────────────────────────────────────────────

const PROJECT_ID = '01KVVVJEGKQ10X59AZW7P0ASCH';
const CH_URL = `http://${process.env.CLICKHOUSE_HOST || 'localhost'}:${process.env.CLICKHOUSE_PORT || '8123'}`;
const CH_DB = process.env.ARGUS_CLICKHOUSE_DATABASE || 'argus';
const CH_USER = process.env.CLICKHOUSE_USERNAME || 'default';
const CH_PASS = process.env.CLICKHOUSE_PASSWORD || '';

// Rates (per second)
const ERRORS_PER_SEC = 2;     // ~120/min → visible on EPM chart
const TXNS_PER_SEC = 10;      // ~600/min
const LOGS_PER_SEC = 15;      // ~900/min
const TICK_MS = 1000;

// ─── Data Pools ───────────────────────────────────────────────────────────────

const ERROR_TYPES = [
  { type: 'TypeError', values: ['Cannot read properties of undefined (reading \'map\')', 'null is not an object', 'undefined is not a function'] },
  { type: 'ReferenceError', values: ['player is not defined', 'quest is not defined', 'inventory is not defined'] },
  { type: 'NetworkError', values: ['Failed to fetch', 'Network request failed', 'ERR_CONNECTION_REFUSED'] },
  { type: 'TimeoutError', values: ['Request timeout after 30000ms', 'Socket timeout', 'ETIMEDOUT'] },
  { type: 'DatabaseError', values: ['Connection pool exhausted', 'Deadlock detected', 'Query timeout'] },
  { type: 'AuthenticationError', values: ['Invalid token', 'Session expired', 'Rate limit exceeded'] },
  { type: 'ValidationError', values: ['Invalid input: level must be >= 1', 'Missing required field: character_id', 'Price must be positive'] },
  { type: 'OutOfMemoryError', values: ['JavaScript heap out of memory', 'Buffer allocation failed'] },
];

const TXN_TEMPLATES = [
  { name: 'POST /api/auth/login', durMin: 50, durMax: 800 },
  { name: 'POST /api/character/save', durMin: 30, durMax: 1500 },
  { name: 'GET /api/character/profile', durMin: 10, durMax: 200 },
  { name: 'POST /api/trade/complete', durMin: 50, durMax: 2000 },
  { name: 'POST /api/combat/engage', durMin: 20, durMax: 500 },
  { name: 'GET /api/rankings/guild', durMin: 100, durMax: 8000 },
  { name: 'POST /api/matchmaking/queue', durMin: 200, durMax: 5000 },
  { name: 'POST /api/chat/send', durMin: 5, durMax: 100 },
  { name: 'GET /api/market/listings', durMin: 30, durMax: 3000 },
  { name: 'GET /api/inventory/items', durMin: 15, durMax: 400 },
  { name: 'POST /api/quest/accept', durMin: 20, durMax: 600 },
  { name: 'PUT /api/settings/update', durMin: 10, durMax: 200 },
];

const LOG_LEVELS = [
  { level: 'info', weight: 50 },
  { level: 'debug', weight: 20 },
  { level: 'warning', weight: 15 },
  { level: 'error', weight: 10 },
  { level: 'fatal', weight: 2 },
  { level: 'trace', weight: 3 },
];
const TOTAL_LOG_WEIGHT = LOG_LEVELS.reduce((s, l) => s + l.weight, 0);

const LOG_MESSAGES: Record<string, string[]> = {
  info: [
    'Request processed successfully', 'User session started', 'Cache hit for key: player_data',
    'Database connection established', 'Health check passed', 'Cron job completed',
  ],
  debug: [
    'SQL query executed in 12ms', 'Cache miss, fetching from DB', 'Serializing response payload',
    'WebSocket connection opened', 'Rate limiter: 145/1000 requests used',
  ],
  warning: [
    'Slow query detected: 2340ms', 'Memory usage at 78%', 'Connection pool near capacity (48/50)',
    'Deprecated API called: /v1/users', 'Redis reconnecting...',
  ],
  error: [
    'Failed to process payment', 'Database query timeout after 30s', 'Unhandled rejection in worker',
    'S3 upload failed: access denied', 'Invalid JWT signature',
  ],
  fatal: [
    'Out of memory: killing process', 'Database cluster unreachable', 'Critical: All replicas down',
  ],
  trace: [
    'Entering function: handleRequest', 'Exiting function: validateToken', 'Stack trace captured',
  ],
};

const SERVICES = ['game-server', 'auth-service', 'inventory-api', 'matchmaking', 'chat-service', 'payment-gateway', 'analytics-worker'];
const ENVIRONMENTS = ['production', 'staging'];
const RELEASES = ['v2.5.0', 'v2.4.3', 'v2.4.2', 'v2.3.1'];
const PLATFORMS = ['node', 'python', 'go', 'java'];
const LOGGERS = ['app.server', 'db.query', 'cache.redis', 'auth.jwt', 'ws.handler', 'worker.cron', 'api.gateway'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function hash32(): string {
  return Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
}

function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function weightedLevel(): string {
  let r = Math.random() * TOTAL_LOG_WEIGHT;
  for (const l of LOG_LEVELS) {
    r -= l.weight;
    if (r <= 0) return l.level;
  }
  return 'info';
}

// ─── Generators ───────────────────────────────────────────────────────────────

function generateError(): Record<string, any> {
  const errType = pick(ERROR_TYPES);
  const now = new Date();
  return {
    event_id: hash32(),
    project_id: PROJECT_ID,
    issue_id: randomInt(1, 50),
    timestamp: now.toISOString(),
    received_at: now.toISOString(),
    platform: pick(PLATFORMS),
    level: Math.random() < 0.1 ? 'fatal' : 'error',
    type: errType.type,
    value: pick(errType.values),
    mechanism: 'generic',
    fingerprint: [errType.type],
    primary_hash: hash32(),
    exception: JSON.stringify({ type: errType.type, value: pick(errType.values) }),
    stacktrace_frames: '[]',
    breadcrumbs: '[]',
    user_id: `user_${randomInt(1, 10000)}`,
    user_email: `user${randomInt(1, 10000)}@example.com`,
    user_ip: `${randomInt(1, 255)}.${randomInt(1, 255)}.${randomInt(1, 255)}.${randomInt(1, 255)}`,
    user_name: `Player${randomInt(1, 10000)}`,
    environment: pick(ENVIRONMENTS),
    release: pick(RELEASES),
    server_name: `${pick(SERVICES)}-${randomInt(1, 5)}`,
    transaction: pick(TXN_TEMPLATES).name,
    os_name: pick(['Linux', 'Windows', 'macOS']),
    os_version: pick(['5.15', '11', '14.2']),
    browser_name: '',
    browser_version: '',
    runtime_name: pick(['node', 'python', 'go']),
    runtime_version: pick(['18.17.0', '3.11.4', '1.21.3']),
    tags: { service: pick(SERVICES), shard: `shard-${randomInt(1, 4)}` },
    extra: {},
    contexts: '{}',
    dsn_key_id: 1,
  };
}

function generateTransaction(): Record<string, any> {
  const tmpl = pick(TXN_TEMPLATES);
  const now = new Date();
  const duration = randomInt(tmpl.durMin, tmpl.durMax);
  // Occasionally produce slow outliers
  const finalDuration = Math.random() < 0.05 ? duration * randomInt(3, 10) : duration;
  const status = Math.random() < 0.03 ? 'internal_error' : 'ok';

  return {
    event_id: hash32(),
    project_id: PROJECT_ID,
    trace_id: hash32(),
    span_id: hash32().substring(0, 16),
    transaction: tmpl.name,
    transaction_hash: tmpl.name.replace(/\W/g, '_'),
    op: 'http.server',
    status,
    timestamp: now.toISOString(),
    start_timestamp: new Date(now.getTime() - finalDuration).toISOString(),
    duration: finalDuration,
    environment: pick(ENVIRONMENTS),
    release: pick(RELEASES),
    platform: pick(PLATFORMS),
    tags: { service: pick(SERVICES), method: tmpl.name.split(' ')[0] },
    measurements: { duration: finalDuration },
    contexts: {},
    user_id: `user_${randomInt(1, 10000)}`,
    dsn_key_id: 1,
  };
}

function generateLog(): Record<string, any> {
  const level = weightedLevel();
  const messages = LOG_MESSAGES[level] || LOG_MESSAGES.info;
  const now = new Date();

  return {
    log_id: hash32(),
    project_id: PROJECT_ID,
    trace_id: hash32(),
    span_id: hash32().substring(0, 16),
    issue_id: '',
    timestamp: now.toISOString(),
    level,
    logger_name: pick(LOGGERS),
    message: pick(messages),
    body: '',
    environment: pick(ENVIRONMENTS),
    release: pick(RELEASES),
    service: pick(SERVICES),
    attributes: {
      'server.name': `${pick(SERVICES)}-${randomInt(1, 5)}`,
      environment: pick(ENVIRONMENTS),
    },
  };
}

// ─── Feedback Generator ───────────────────────────────────────────────────────

const FEEDBACK_MESSAGES = {
  positive: [
    '이번 업데이트 정말 좋아요! 새 퀘스트 시스템 최고!',
    '성능 개선 체감돼요, 훨씬 부드러워졌어요.',
    '길드 기능 추가 정말 필요했는데 감사합니다!',
    'UI가 깔끔해져서 좋아요.',
    'Great update! The new quest system is amazing.',
    'Love the performance improvements, much smoother now.',
    'The new guild features are exactly what we needed!',
    'UI looks much cleaner in this release.',
  ],
  negative: [
    '항해 중 갑자기 튕겼어요. 전투 중이라 손해가 커요.',
    '결제했는데 아이템이 안 들어왔어요. 주문번호 확인 부탁드립니다.',
    '최근 패치 이후 렉이 심해졌어요. 특히 리스본 항구에서요.',
    '캐릭터 장비 탭 열면 크래시 납니다.',
    '해전 중 프레임 드랍이 심해요. 10fps 이하로 떨어져요.',
    '매칭이 2분 넘게 걸리다 실패해요.',
    'Game crashes every time I open the market.',
    'Login takes forever since the last update.',
    'My character data was lost after the patch!',
    'The matchmaking is completely broken.',
    'Lag spikes make PvP unplayable.',
  ],
  neutral: [
    '다크 모드 추가해주세요.',
    '캐릭터 커스터마이징 좀 더 다양했으면 좋겠어요.',
    '다음 확장팩은 언제 나오나요?',
    '튜토리얼이 좀 더 자세했으면 좋겠어요.',
    'NPC 대화가 도중에 끊겨요. 퀘스트 진행이 안 됩니다.',
    'Would be nice to have a dark mode option.',
    'Can you add more character customization?',
    'When will the next expansion be released?',
    'The tutorial could be more detailed.',
  ],
};

const FEEDBACK_NAMES_KO = ['김민준', '이서연', '박지호', '최유진', '정하은', '강도현', '송민서', '한지우'];
const FEEDBACK_NAMES_EN = ['CaptainJack', 'Player_Alpha', 'TestUser01', 'StarNavigator'];
const FEEDBACK_NAMES = [...FEEDBACK_NAMES_KO, ...FEEDBACK_NAMES_EN];
const FEEDBACK_BROWSERS = ['Chrome', 'Firefox', 'Safari', 'Edge', 'GameClient'];
const FEEDBACK_OSES = ['Windows', 'macOS', 'Android', 'iOS', 'Linux'];
const FEEDBACK_DEVICES = ['PC', 'PC', 'PC', 'iPhone 15', 'Galaxy S24', 'iPad Pro', 'Steam Deck', ''];
const FEEDBACK_CATEGORIES = ['bug', 'feature', 'performance', 'ux', 'other'];
const FEEDBACK_SENTIMENTS = [
  { sentiment: 'negative', weight: 40 },
  { sentiment: 'positive', weight: 35 },
  { sentiment: 'neutral', weight: 25 },
];
const TOTAL_SENTIMENT_WEIGHT = FEEDBACK_SENTIMENTS.reduce((s, f) => s + f.weight, 0);

function weightedSentiment(): string {
  let r = Math.random() * TOTAL_SENTIMENT_WEIGHT;
  for (const f of FEEDBACK_SENTIMENTS) {
    r -= f.weight;
    if (r <= 0) return f.sentiment;
  }
  return 'neutral';
}

function generateFeedback(): Record<string, any> {
  const sentiment = weightedSentiment();
  const messages = FEEDBACK_MESSAGES[sentiment as keyof typeof FEEDBACK_MESSAGES] || FEEDBACK_MESSAGES.neutral;
  const now = new Date();
  const category = sentiment === 'negative' && Math.random() < 0.6 ? 'bug' : pick(FEEDBACK_CATEGORIES);
  const name = pick(FEEDBACK_NAMES);
  const email = `${name.replace(/\s/g, '').toLowerCase()}@test.com`;
  const browser = pick(FEEDBACK_BROWSERS);
  const os = pick(FEEDBACK_OSES);

  const attachments: string[] = [];
  if (Math.random() < 0.3) {
    const count = randomInt(1, 3);
    for (let a = 0; a < count; a++) {
      const w = pick([800, 1024, 1280, 1920]);
      const h = pick([600, 768, 720, 1080]);
      attachments.push(
        `https://picsum.photos/seed/${hash32().substring(0, 8)}/${w}/${h}`
      );
    }
  }

  return {
    feedback_id: hash32(),
    project_id: PROJECT_ID,
    event_id: hash32(),
    timestamp: now.toISOString(),
    name,
    email,
    message: pick(messages),
    contact_email: Math.random() < 0.3 ? email : '',
    url: pick(['/game/play', '/game/port', '/game/battle', '/settings', '/inventory', '/guild', '/market']),
    environment: pick(ENVIRONMENTS),
    release: pick(RELEASES),
    source: pick(['widget', 'dialog', 'api', 'sdk']),
    tags: {},
    category,
    sentiment,
    status: 'unresolved',
    is_spam: 0,
    is_read: 0,
    attachments,
    browser,
    browser_version: `${randomInt(90, 130)}.0.${randomInt(1000, 9999)}.${randomInt(10, 99)}`,
    os,
    os_version: pick(['10', '11', '14.5', '17.2', '6.8', '15.1']),
    device: pick(FEEDBACK_DEVICES),
    user_id: `user_${randomInt(1, 10000)}`,
    locale: pick(['ko-KR', 'en-US', 'ja-JP', 'zh-CN', '']),
    avatar_url: `https://i.pravatar.cc/150?u=${encodeURIComponent(name)}`,
  };
}

// ─── Main Loop ────────────────────────────────────────────────────────────────

let ch: ClickHouseClient;

async function insertBatch(table: string, rows: Record<string, any>[]) {
  if (rows.length === 0) return;
  try {
    await ch.insert({
      table: `${CH_DB}.${table}`,
      values: rows,
      format: 'JSONEachRow',
    });
  } catch (err) {
    console.error(`  ❌ Insert to ${table} failed:`, (err as Error).message);
  }
}

let totalErrors = 0;
let totalTxns = 0;
let totalLogs = 0;
let totalFeedback = 0;
let tickCount = 0;

async function tick() {
  tickCount++;
  const errors = Array.from({ length: ERRORS_PER_SEC }, generateError);
  const txns = Array.from({ length: TXNS_PER_SEC }, generateTransaction);
  const logs = Array.from({ length: LOGS_PER_SEC }, generateLog);
  // ~1 feedback per 2 seconds
  const feedbacks = tickCount % 2 === 0 ? [generateFeedback()] : [];

  await Promise.all([
    insertBatch('errors', errors),
    insertBatch('transactions', txns),
    insertBatch('logs', logs),
    insertBatch('user_feedback', feedbacks),
  ]);

  totalErrors += errors.length;
  totalTxns += txns.length;
  totalLogs += logs.length;
  totalFeedback += feedbacks.length;
}

async function main() {
  console.log('🔴 Argus Tracking Realtime Simulator');
  console.log('═'.repeat(50));
  console.log(`  ClickHouse: ${CH_URL} / ${CH_DB}`);
  console.log(`  Project:    ${PROJECT_ID}`);
  console.log(`  Rate:       ${ERRORS_PER_SEC} err/s, ${TXNS_PER_SEC} txn/s, ${LOGS_PER_SEC} log/s`);
  console.log(`  Total:      ~${(ERRORS_PER_SEC + TXNS_PER_SEC + LOGS_PER_SEC)} events/sec`);
  console.log('═'.repeat(50));
  console.log('');

  ch = createClient({
    url: CH_URL,
    database: CH_DB,
    username: CH_USER,
    password: CH_PASS,
    clickhouse_settings: {
      date_time_input_format: 'best_effort',
    },
  });

  // Status reporter
  const statusInterval = setInterval(() => {
    const elapsed = Math.round((Date.now() - startTime) / 1000);
    console.log(
      `  📊 [${elapsed}s] errors: ${totalErrors.toLocaleString()}, txns: ${totalTxns.toLocaleString()}, logs: ${totalLogs.toLocaleString()}, fb: ${totalFeedback.toLocaleString()}`
    );
  }, 10_000);

  const startTime = Date.now();
  console.log('  ▶ Streaming events to ClickHouse... (Ctrl+C to stop)\n');

  // Main loop
  const interval = setInterval(tick, TICK_MS);

  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n\n  ⏹ Stopping...');
    clearInterval(interval);
    clearInterval(statusInterval);
    const elapsed = Math.round((Date.now() - startTime) / 1000);
    console.log(`  📊 Final: ${totalErrors.toLocaleString()} errors, ${totalTxns.toLocaleString()} txns, ${totalLogs.toLocaleString()} logs, ${totalFeedback.toLocaleString()} fb in ${elapsed}s`);
    await ch.close();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});

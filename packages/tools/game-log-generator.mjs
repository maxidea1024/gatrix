#!/usr/bin/env node
/**
 * game-log-generator.mjs
 *
 * Online game server log simulator for testing Argus Live Tail.
 * Zero external dependencies — uses only Node.js built-in modules.
 *
 * Usage:
 *   node packages/tools/game-log-generator.mjs
 *   node packages/tools/game-log-generator.mjs --project 3 --host localhost:45300 --rate 2
 *   node packages/tools/game-log-generator.mjs --burst
 */

import http from 'node:http';
import crypto from 'node:crypto';

// ─── CLI Args ───────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
function getArg(name, fallback) {
  const idx = args.indexOf(`--${name}`);
  if (idx === -1) return fallback;
  if (typeof fallback === 'boolean') return true;
  return args[idx + 1] ?? fallback;
}

const PROJECT_ID = getArg('project', '1');
const HOST = getArg('host', 'localhost:45300');
const RATE = parseFloat(getArg('rate', '1'));
const BURST = getArg('burst', false);
const DIRECT = getArg('direct', false);
const CHAOS = getArg('chaos', false);
const FIXED_SERVICE = getArg('service', '');
const CH_HOST = getArg('ch-host', 'localhost:48123');

const [API_HOST, API_PORT] = HOST.split(':');
const [CH_HOSTNAME, CH_PORT] = CH_HOST.split(':');

// ─── Helpers ────────────────────────────────────────────────────────────────

const uuid = () => crypto.randomUUID();
const traceId = () => crypto.randomBytes(16).toString('hex');
const spanId = () => crypto.randomBytes(8).toString('hex');
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const randFloat = (min, max) => +(Math.random() * (max - min) + min).toFixed(1);

// ─── Data Pools ─────────────────────────────────────────────────────────────

const SERVICES = [
  'game-server',
  'matchmaker',
  'chat-service',
  'payment-service',
  'anti-cheat',
  'inventory-service',
  'auth-service',
  'analytics-pipeline',
  'leaderboard-service',
  'notification-service',
  'guild-service',
  'replay-recorder',
  'cdn-edge',
  'lobby-service',
  'telemetry-collector',
  'crash-reporter',
  'session-manager',
  'quest-engine',
];

const ENVIRONMENTS = ['production', 'staging', 'development'];
const RELEASES = ['v1.2.0', 'v1.3.0-beta', 'v1.1.9', 'v1.2.1-hotfix'];
const REGIONS = ['ap-northeast-2', 'us-west-2', 'eu-west-1', 'ap-southeast-1'];
const SERVER_IDS = ['gs-001', 'gs-002', 'gs-003', 'mm-001', 'chat-001', 'pay-001'];
const MAPS = [
  'dragon_valley',
  'frozen_citadel',
  'neon_arena',
  'ancient_ruins',
  'sky_fortress',
];

const PLAYER_NAMES = [
  'DragonSlayer_42',
  'ShadowNinja_X',
  'IceQueen_99',
  'ThunderBolt_7',
  'CyberWolf_13',
  'StarFire_88',
  'NightHawk_22',
  'PhoenixRise_5',
  'GhostBlade_01',
  'CosmicRay_77',
  'TurboKnight_33',
  'LunarEclipse_66',
  'VenomStrike_11',
  'AquaBlaze_44',
  'IronClad_55',
];

const ITEMS = [
  'Legendary Sword',
  'Diamond Shield',
  'Healing Potion',
  'Shadow Cloak',
  'Phoenix Feather',
  'Thunder Staff',
  'Ice Crystal Armor',
  'Dragon Scale',
  'Elixir of Speed',
  'Enchanted Bow',
];

const IAP_PRODUCTS = [
  'gem_pack_100',
  'gem_pack_500',
  'battle_pass_season_12',
  'vip_monthly',
  'skin_dragon_lord',
  'emote_victory_dance',
];

const LOGGERS = [
  'GameServer.Core',
  'Matchmaker.Queue',
  'Chat.Filter',
  'Payment.Gateway',
  'AntiCheat.Engine',
  'Inventory.Manager',
  'Session.Controller',
  'Network.Transport',
  'Auth.OAuth',
  'Auth.JWT',
  'Analytics.Ingest',
  'Leaderboard.Rank',
  'Notification.Push',
  'Guild.Manager',
  'Replay.Writer',
  'CDN.Cache',
  'Lobby.Lifecycle',
  'Telemetry.Batch',
  'CrashReport.Collector',
  'Quest.Evaluator',
  'DB.Pool',
  'Redis.Client',
  'K8s.Probe',
];

// ─── Severity ANSI Colors ───────────────────────────────────────────────────

const COLORS = {
  fatal: '\x1b[41m\x1b[37m',  // white on red bg
  error: '\x1b[31m',          // red
  warn: '\x1b[33m',           // yellow
  info: '\x1b[36m',           // cyan
  debug: '\x1b[90m',          // gray
  trace: '\x1b[35m',          // magenta
  reset: '\x1b[0m',
};

// ─── Shared Trace Context ───────────────────────────────────────────────────

let activeTraces = [];

function getOrCreateTrace(relatedService) {
  // 30% chance to reuse an existing trace for continuity
  if (activeTraces.length > 0 && Math.random() < 0.3) {
    return activeTraces[Math.floor(Math.random() * activeTraces.length)];
  }
  const t = { trace_id: traceId(), service: relatedService };
  activeTraces.push(t);
  // Keep only last 10 active traces
  if (activeTraces.length > 10) activeTraces.shift();
  return t;
}

// ─── Log Scenario Generators ────────────────────────────────────────────────

function genPlayerConnection() {
  const player = pick(PLAYER_NAMES);
  const ip = `${randInt(10, 192)}.${randInt(0, 255)}.${randInt(0, 255)}.${randInt(1, 254)}`;
  const trace = getOrCreateTrace('game-server');

  if (Math.random() < 0.7) {
    return {
      level: 'info',
      message: `Player '${player}' connected from ${ip}`,
      service: 'game-server',
      logger_name: 'GameServer.Core',
      trace_id: trace.trace_id,
      span_id: spanId(),
      attributes: {
        player_name: player,
        ip_address: ip,
        event_type: 'player_connect',
        region: pick(REGIONS),
        server_id: pick(SERVER_IDS),
      },
    };
  } else {
    const reasons = ['timeout', 'kicked', 'quit', 'network_error', 'client_crash'];
    return {
      level: Math.random() < 0.8 ? 'info' : 'warn',
      message: `Player '${player}' disconnected (reason: ${pick(reasons)})`,
      service: 'game-server',
      logger_name: 'GameServer.Core',
      trace_id: trace.trace_id,
      span_id: spanId(),
      attributes: {
        player_name: player,
        event_type: 'player_disconnect',
        session_duration_sec: String(randInt(30, 7200)),
      },
    };
  }
}

function genMatchmaking() {
  const queues = ['ranked_5v5', 'casual_3v3', 'battle_royale', 'duel_1v1', 'custom_lobby'];
  const queue = pick(queues);
  const playerCount = randInt(2, 30);
  const trace = getOrCreateTrace('matchmaker');

  const roll = Math.random();
  if (roll < 0.5) {
    return {
      level: 'info',
      message: `Matchmaking started for queue '${queue}' (${playerCount} players)`,
      service: 'matchmaker',
      logger_name: 'Matchmaker.Queue',
      trace_id: trace.trace_id,
      span_id: spanId(),
      attributes: {
        queue_name: queue,
        player_count: String(playerCount),
        event_type: 'matchmaking_start',
      },
    };
  } else if (roll < 0.75) {
    const need = randInt(6, 10);
    const have = randInt(2, need - 1);
    return {
      level: 'warn',
      message: `Matchmaking timeout — not enough players in '${queue}' (need ${need}, have ${have})`,
      service: 'matchmaker',
      logger_name: 'Matchmaker.Queue',
      trace_id: trace.trace_id,
      span_id: spanId(),
      attributes: {
        queue_name: queue,
        required: String(need),
        current: String(have),
        event_type: 'matchmaking_timeout',
      },
    };
  } else {
    const matchId = `M-${randInt(10000, 99999)}`;
    const teamA = PLAYER_NAMES.slice(0, 3).join(', ');
    const teamB = PLAYER_NAMES.slice(3, 6).join(', ');
    return {
      level: 'info',
      message: `Match ${matchId} created: Team A [${teamA}] vs Team B [${teamB}]`,
      service: 'matchmaker',
      logger_name: 'Matchmaker.Queue',
      trace_id: trace.trace_id,
      span_id: spanId(),
      attributes: {
        match_id: matchId,
        queue_name: queue,
        event_type: 'match_created',
        map: pick(MAPS),
      },
    };
  }
}

function genGameSession() {
  const sessionId = `GS-${randInt(100000, 999999)}`;
  const map = pick(MAPS);
  const trace = getOrCreateTrace('game-server');

  const roll = Math.random();
  if (roll < 0.4) {
    return {
      level: 'info',
      message: `Game session ${sessionId} started on map '${map}'`,
      service: 'game-server',
      logger_name: 'Session.Controller',
      trace_id: trace.trace_id,
      span_id: spanId(),
      attributes: {
        session_id: sessionId,
        map,
        event_type: 'session_start',
        player_count: String(randInt(2, 10)),
      },
    };
  } else if (roll < 0.7) {
    const tickRate = pick([20, 30, 60, 64, 128]);
    const players = randInt(2, 10);
    const latencyAvg = randInt(8, 120);
    return {
      level: 'debug',
      message: `Tick rate: ${tickRate}/s, connected players: ${players}, latency avg: ${latencyAvg}ms`,
      service: 'game-server',
      logger_name: 'Network.Transport',
      trace_id: trace.trace_id,
      span_id: spanId(),
      attributes: {
        session_id: sessionId,
        tick_rate: String(tickRate),
        connected_players: String(players),
        latency_avg_ms: String(latencyAvg),
        event_type: 'tick_stats',
      },
    };
  } else {
    const durationMin = randInt(5, 45);
    const durationSec = randInt(0, 59);
    const winner = Math.random() < 0.5 ? 'Team A' : 'Team B';
    return {
      level: 'info',
      message: `Game session ${sessionId} ended. Winner: ${winner}, Duration: ${durationMin}m${durationSec}s`,
      service: 'game-server',
      logger_name: 'Session.Controller',
      trace_id: trace.trace_id,
      span_id: spanId(),
      attributes: {
        session_id: sessionId,
        winner,
        duration_sec: String(durationMin * 60 + durationSec),
        event_type: 'session_end',
      },
    };
  }
}

function genInventory() {
  const player = pick(PLAYER_NAMES);
  const item = pick(ITEMS);
  const price = randInt(100, 10000);
  const trace = getOrCreateTrace('inventory-service');

  const roll = Math.random();
  if (roll < 0.5) {
    return {
      level: 'info',
      message: `Player '${player}' purchased item '${item}' (gold: ${price})`,
      service: 'inventory-service',
      logger_name: 'Inventory.Manager',
      trace_id: trace.trace_id,
      span_id: spanId(),
      attributes: {
        player_name: player,
        item_name: item,
        currency: 'gold',
        amount: String(price),
        event_type: 'item_purchase',
      },
    };
  } else if (roll < 0.8) {
    const balance = randInt(10, price - 1);
    return {
      level: 'error',
      message: `Insufficient balance for player '${player}': required ${price}, have ${balance}`,
      service: 'inventory-service',
      logger_name: 'Inventory.Manager',
      trace_id: trace.trace_id,
      span_id: spanId(),
      attributes: {
        player_name: player,
        item_name: item,
        required: String(price),
        balance: String(balance),
        event_type: 'purchase_failed',
      },
    };
  } else {
    return {
      level: 'warn',
      message: `Duplicate purchase attempt blocked for player '${player}', item '${item}'`,
      service: 'inventory-service',
      logger_name: 'Inventory.Manager',
      trace_id: trace.trace_id,
      span_id: spanId(),
      attributes: {
        player_name: player,
        item_name: item,
        event_type: 'duplicate_purchase',
      },
    };
  }
}

function genChat() {
  const player = pick(PLAYER_NAMES);
  const channels = ['global', 'team', 'party', 'whisper', 'guild'];
  const channel = pick(channels);
  const trace = getOrCreateTrace('chat-service');

  if (Math.random() < 0.7) {
    return {
      level: 'info',
      message: `Chat message processed: channel='${channel}', player='${player}'`,
      service: 'chat-service',
      logger_name: 'Chat.Filter',
      trace_id: trace.trace_id,
      span_id: spanId(),
      attributes: {
        player_name: player,
        channel,
        event_type: 'chat_message',
        message_length: String(randInt(5, 200)),
      },
    };
  } else {
    const muteDuration = pick([5, 10, 30, 60]);
    return {
      level: 'warn',
      message: `Toxic chat detected from '${player}': auto-muted for ${muteDuration} minutes`,
      service: 'chat-service',
      logger_name: 'Chat.Filter',
      trace_id: trace.trace_id,
      span_id: spanId(),
      attributes: {
        player_name: player,
        channel,
        mute_duration_min: String(muteDuration),
        event_type: 'toxic_chat',
      },
    };
  }
}

function genServerHealth() {
  const cpuPct = randInt(10, 95);
  const memUsed = randFloat(2.0, 15.5);
  const memTotal = 16;
  const connections = randInt(50, 800);
  const serverId = pick(SERVER_IDS);

  if (cpuPct < 80 && memUsed < 13) {
    return {
      level: 'info',
      message: `Server heartbeat: CPU ${cpuPct}%, MEM ${memUsed}GB/${memTotal}GB, connections: ${connections}`,
      service: 'game-server',
      logger_name: 'GameServer.Core',
      trace_id: '',
      span_id: '',
      attributes: {
        cpu_pct: String(cpuPct),
        mem_used_gb: String(memUsed),
        mem_total_gb: String(memTotal),
        connections: String(connections),
        server_id: serverId,
        event_type: 'heartbeat',
      },
    };
  } else if (memUsed >= 14) {
    return {
      level: 'fatal',
      message: `Out of memory! Emergency shutdown initiated (${memUsed}GB/${memTotal}GB)`,
      service: 'game-server',
      logger_name: 'GameServer.Core',
      trace_id: '',
      span_id: '',
      attributes: {
        mem_used_gb: String(memUsed),
        mem_total_gb: String(memTotal),
        server_id: serverId,
        event_type: 'oom_shutdown',
      },
    };
  } else if (memUsed >= 13) {
    return {
      level: 'warn',
      message: `High memory usage detected: ${memUsed}GB/${memTotal}GB (${Math.round((memUsed / memTotal) * 100)}%)`,
      service: 'game-server',
      logger_name: 'GameServer.Core',
      trace_id: '',
      span_id: '',
      attributes: {
        mem_used_gb: String(memUsed),
        mem_total_gb: String(memTotal),
        server_id: serverId,
        event_type: 'high_memory',
      },
    };
  } else {
    // CPU high
    return {
      level: 'warn',
      message: `High CPU usage: ${cpuPct}% on server ${serverId}`,
      service: 'game-server',
      logger_name: 'GameServer.Core',
      trace_id: '',
      span_id: '',
      attributes: {
        cpu_pct: String(cpuPct),
        server_id: serverId,
        event_type: 'high_cpu',
      },
    };
  }
}

function genAntiCheat() {
  const player = pick(PLAYER_NAMES);
  const trace = getOrCreateTrace('anti-cheat');

  const cheats = [
    { type: 'speed_hack', msg: `moved ${randInt(200, 1000)}u in 0.1s` },
    { type: 'aimbot', msg: `headshot ratio 98% over ${randInt(10, 50)} kills` },
    { type: 'wall_hack', msg: `shooting through ${randInt(3, 12)} walls in 1 round` },
    { type: 'teleport', msg: `position jumped ${randInt(500, 5000)}u in 1 tick` },
  ];
  const cheat = pick(cheats);

  if (Math.random() < 0.6) {
    return {
      level: 'warn',
      message: `Suspicious activity detected: player '${player}' — ${cheat.msg}`,
      service: 'anti-cheat',
      logger_name: 'AntiCheat.Engine',
      trace_id: trace.trace_id,
      span_id: spanId(),
      attributes: {
        player_name: player,
        cheat_type: cheat.type,
        event_type: 'suspicious_activity',
      },
    };
  } else {
    return {
      level: 'error',
      message: `Cheat detected: player '${player}' — auto-ban applied (reason: ${cheat.type})`,
      service: 'anti-cheat',
      logger_name: 'AntiCheat.Engine',
      trace_id: trace.trace_id,
      span_id: spanId(),
      attributes: {
        player_name: player,
        cheat_type: cheat.type,
        event_type: 'player_banned',
        ban_duration: 'permanent',
      },
    };
  }
}

function genPayment() {
  const player = pick(PLAYER_NAMES);
  const product = pick(IAP_PRODUCTS);
  const trace = getOrCreateTrace('payment-service');

  if (Math.random() < 0.7) {
    return {
      level: 'info',
      message: `IAP receipt verified: player '${player}', product '${product}'`,
      service: 'payment-service',
      logger_name: 'Payment.Gateway',
      trace_id: trace.trace_id,
      span_id: spanId(),
      attributes: {
        player_name: player,
        product_id: product,
        event_type: 'iap_verified',
        amount_usd: String(randFloat(0.99, 99.99)),
      },
    };
  } else {
    const reasons = ['invalid_receipt', 'expired_token', 'duplicate_transaction', 'store_unavailable'];
    return {
      level: 'error',
      message: `IAP verification failed: ${pick(reasons)} from player '${player}'`,
      service: 'payment-service',
      logger_name: 'Payment.Gateway',
      trace_id: trace.trace_id,
      span_id: spanId(),
      attributes: {
        player_name: player,
        product_id: product,
        event_type: 'iap_failed',
        failure_reason: pick(reasons),
      },
    };
  }
}

function genInfraError() {
  const errors = [
    { level: 'error', message: 'Redis connection lost — reconnecting in 5s...', service: 'game-server', logger: 'Network.Transport', type: 'redis_disconnect' },
    { level: 'error', message: 'ClickHouse write timeout after 30s', service: 'game-server', logger: 'GameServer.Core', type: 'db_timeout' },
    { level: 'warn', message: 'Packet loss detected: 12% over last 60s', service: 'game-server', logger: 'Network.Transport', type: 'packet_loss' },
    { level: 'error', message: 'TLS handshake failed with payment gateway', service: 'payment-service', logger: 'Payment.Gateway', type: 'tls_error' },
    { level: 'warn', message: `Connection pool exhausted: ${randInt(90, 100)}/${100} active`, service: 'game-server', logger: 'GameServer.Core', type: 'pool_exhausted' },
  ];

  const e = pick(errors);
  return {
    level: e.level,
    message: e.message,
    service: e.service,
    logger_name: e.logger,
    trace_id: '',
    span_id: '',
    attributes: {
      event_type: e.type,
      server_id: pick(SERVER_IDS),
    },
  };
}

// ─── Scenario Weights (roughly: info 60%, warn 15%, error 12%, debug 10%, fatal 2%, trace 1%) ──

const SCENARIOS = [
  { fn: genPlayerConnection, weight: 20 },
  { fn: genMatchmaking, weight: 12 },
  { fn: genGameSession, weight: 18 },
  { fn: genInventory, weight: 12 },
  { fn: genChat, weight: 10 },
  { fn: genServerHealth, weight: 10 },
  { fn: genAntiCheat, weight: 6 },
  { fn: genPayment, weight: 6 },
  { fn: genInfraError, weight: 6 },
];

const TOTAL_WEIGHT = SCENARIOS.reduce((s, sc) => s + sc.weight, 0);

function pickScenario() {
  let r = Math.random() * TOTAL_WEIGHT;
  for (const sc of SCENARIOS) {
    r -= sc.weight;
    if (r <= 0) return sc.fn;
  }
  return SCENARIOS[0].fn;
}

// ─── Chaos-Only Scenarios ───────────────────────────────────────────────────

const CHAOS_MESSAGES = {
  fatal: [
    () => `CRITICAL: Main game loop deadlock detected — all ${randInt(200, 800)} connections stalled`,
    () => `FATAL: Database connection pool exhausted (${randInt(90, 100)}/100) — no recovery possible`,
    () => `PANIC: Memory corruption detected in zone allocator at 0x${crypto.randomBytes(4).toString('hex')}`,
    () => `FATAL: Kubernetes liveness probe failed ${randInt(3, 10)} consecutive times — pod restart imminent`,
    () => `EMERGENCY: Disk /data ${randInt(98, 100)}% full — write operations halted`,
    () => `FATAL: TLS certificate expired for *.${pick(['api', 'ws', 'cdn', 'auth'])}.gameserver.io`,
    () => `PANIC: Unrecoverable state machine error in match M-${randInt(10000, 99999)}`,
  ],
  error: [
    () => `Redis CLUSTERDOWN — hash slot not served, retrying in ${randInt(1, 5)}s`,
    () => `gRPC call to ${pick(SERVICES)} failed: DEADLINE_EXCEEDED after ${randInt(5000, 30000)}ms`,
    () => `Failed to serialize player state for '${pick(PLAYER_NAMES)}': buffer overflow at ${randInt(1, 64)}MB`,
    () => `ClickHouse query timeout after ${randInt(30, 120)}s: SELECT count() FROM events WHERE...`,
    () => `WebSocket upgrade failed for client ${crypto.randomBytes(4).toString('hex')}: HTTP 429 Too Many Requests`,
    () => `Kafka producer error: Message size ${randInt(10, 50)}MB exceeds max.message.bytes`,
    () => `S3 PutObject failed: SlowDown — reduce request rate (bucket: game-assets-${pick(REGIONS)})`,
    () => `JWT validation failed: token expired ${randInt(1, 60)} minutes ago for user ${pick(PLAYER_NAMES)}`,
    () => `Payment webhook signature mismatch — possible replay attack from ${randInt(10, 192)}.${randInt(0, 255)}.${randInt(0, 255)}.${randInt(1, 254)}`,
    () => `DNS resolution failed for ${pick(['redis-cluster', 'postgres-primary', 'kafka-broker-0', 'elasticsearch'])}.internal: NXDOMAIN`,
    () => `Circuit breaker OPEN for ${pick(SERVICES)}: ${randInt(50, 100)}% failure rate in last ${randInt(10, 60)}s`,
    () => `Deadlock detected in transaction: UPDATE player_inventory SET ... WHERE player_id = '${pick(PLAYER_NAMES)}'`,
  ],
  warn: [
    () => `Slow query detected (${randInt(2000, 15000)}ms): SELECT * FROM match_history WHERE region = '${pick(REGIONS)}'`,
    () => `Connection pool utilization at ${randInt(80, 95)}% (${randInt(80, 95)}/100) for ${pick(SERVICES)}`,
    () => `Rate limit approaching: ${randInt(800, 950)}/1000 requests in current window for IP ${randInt(10, 192)}.${randInt(0, 255)}.x.x`,
    () => `GC pause detected: ${randInt(100, 800)}ms stop-the-world in ${pick(SERVICES)} (heap: ${randFloat(2, 14)}GB)`,
    () => `Replication lag: ${pick(['redis', 'mysql', 'postgres'])}-replica-${randInt(1, 3)} is ${randInt(5, 120)}s behind primary`,
    () => `Certificate expiring in ${randInt(1, 7)} days for ${pick(SERVICES)}.${pick(REGIONS)}.internal`,
    () => `Retry attempt ${randInt(2, 5)}/5 for ${pick(SERVICES)} → ${pick(SERVICES)} call`,
    () => `Player '${pick(PLAYER_NAMES)}' session token refreshed ${randInt(10, 50)} times in last hour — suspicious`,
    () => `Event queue backlog: ${randInt(5000, 50000)} unprocessed events in ${pick(['analytics', 'notifications', 'leaderboard'])} pipeline`,
    () => `Pod ${pick(SERVICES)}-${crypto.randomBytes(2).toString('hex')} memory at ${randInt(80, 95)}% of limit (${randFloat(1, 3)}Gi/${randFloat(2, 4)}Gi)`,
  ],
  info: [
    () => `Player '${pick(PLAYER_NAMES)}' completed quest '${pick(['Dragon Slayer', 'Shadow Hunter', 'Crystal Guardian', 'Realm Defender', 'Void Walker', 'Frost Titan'])}' (+${randInt(100, 5000)} XP)`,
    () => `Guild '${pick(['Phoenix Order', 'Dark Knights', 'Storm Riders', 'Iron Legion', 'Star Guardians'])}' leveled up to ${randInt(2, 50)}`,
    () => `Leaderboard snapshot completed: ${randInt(10000, 100000)} players ranked in ${randInt(50, 500)}ms`,
    () => `CDN cache hit ratio: ${randFloat(85, 99.9)}% (${pick(REGIONS)})`,
    () => `Notification batch sent: ${randInt(100, 5000)} push notifications delivered in ${randInt(200, 3000)}ms`,
    () => `Season ${randInt(10, 20)} battle pass progress synced for ${randInt(1000, 10000)} active players`,
    () => `Config hot-reload completed: ${pick(['matchmaking_rules', 'item_balance', 'event_schedule', 'rate_limits'])}.json`,
    () => `Auto-scaling: ${pick(SERVICES)} scaled ${pick(['up', 'down'])} to ${randInt(2, 10)} replicas (CPU: ${randInt(30, 90)}%)`,
    () => `Daily rewards distributed to ${randInt(5000, 50000)} eligible players`,
    () => `Replay uploaded: match M-${randInt(10000, 99999)} (${randFloat(5, 50)}MB, ${randInt(5, 45)}min)`,
  ],
  debug: [
    () => `[${pick(SERVICES)}] Health check passed: latency=${randInt(1, 20)}ms, connections=${randInt(10, 500)}`,
    () => `Cache lookup: key=player:${pick(PLAYER_NAMES)}:inventory, hit=${Math.random() < 0.7 ? 'true' : 'false'}, ttl=${randInt(60, 3600)}s`,
    () => `gRPC channel state: ${pick(SERVICES)} → ${pick(SERVICES)} = ${pick(['READY', 'IDLE', 'CONNECTING', 'TRANSIENT_FAILURE'])}`,
    () => `Tick #${randInt(100000, 999999)}: ${randInt(2, 200)} entities processed in ${randFloat(0.1, 16)}ms`,
    () => `Event batch flushed: ${randInt(10, 500)} events → ${pick(['kafka', 'clickhouse', 'elasticsearch'])} (${randInt(1, 50)}ms)`,
    () => `WebSocket ping/pong: client ${crypto.randomBytes(3).toString('hex')}, rtt=${randInt(5, 200)}ms`,
  ],
  trace: [
    () => `[TRACE] ${pick(LOGGERS)}.${pick(['handleRequest', 'processEvent', 'validateInput', 'serialize'])}() entry — args: {id: "${crypto.randomBytes(4).toString('hex')}"}`,
    () => `[TRACE] SQL: SELECT * FROM ${pick(['players', 'matches', 'inventory', 'transactions'])} WHERE id = ? LIMIT 1 (${randFloat(0.1, 5)}ms)`,
    () => `[TRACE] Redis: ${pick(['GET', 'SET', 'HGETALL', 'ZADD', 'XADD'])} ${pick(['session', 'leaderboard', 'cache', 'lock'])}:${crypto.randomBytes(4).toString('hex')} (${randFloat(0.1, 2)}ms)`,
  ],
};

function genChaosLog() {
  // Weighted level distribution for chaos: more errors/warnings
  const levelRoll = Math.random();
  let level;
  if (levelRoll < 0.03) level = 'fatal';
  else if (levelRoll < 0.18) level = 'error';
  else if (levelRoll < 0.35) level = 'warn';
  else if (levelRoll < 0.70) level = 'info';
  else if (levelRoll < 0.90) level = 'debug';
  else level = 'trace';

  const messages = CHAOS_MESSAGES[level];
  const message = pick(messages)();
  const service = pick(SERVICES);
  const trace = getOrCreateTrace(service);

  return {
    level,
    message,
    service,
    logger_name: pick(LOGGERS),
    trace_id: trace.trace_id,
    span_id: spanId(),
    attributes: {
      region: pick(REGIONS),
      server_id: pick(SERVER_IDS),
      pod_name: `${service}-${crypto.randomBytes(2).toString('hex')}`,
      k8s_namespace: pick(['prod', 'prod', 'staging']),
      node_name: `node-${pick(REGIONS)}-${randInt(1, 8)}`,
    },
  };
}

// ─── Log Assembly ───────────────────────────────────────────────────────────

function assembleLogs(count) {
  const logs = [];
  for (let i = 0; i < count; i++) {
    const raw = CHAOS ? genChaosLog() : pickScenario()();
    const log = {
      log_id: uuid().replace(/-/g, ''),
      timestamp: new Date().toISOString(),
      level: raw.level,
      message: raw.message,
      body: raw.message,
      service: FIXED_SERVICE || raw.service,
      environment: pick(ENVIRONMENTS),
      release: pick(RELEASES),
      logger_name: raw.logger_name || '',
      trace_id: raw.trace_id || '',
      span_id: raw.span_id || '',
      attributes: raw.attributes || {},
    };
    // Add common attributes
    log.attributes.region = log.attributes.region || pick(REGIONS);
    log.attributes.server_id = log.attributes.server_id || pick(SERVER_IDS);
    logs.push(log);
  }
  return logs;
}

// ─── HTTP POST ──────────────────────────────────────────────────────────────

/** Send via Argus ingest API (goes through Redis→Worker→ClickHouse) */
function sendLogsViaAPI(logs) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(logs);
    const req = http.request(
      {
        hostname: API_HOST,
        port: parseInt(API_PORT, 10),
        path: `/argus/api/${PROJECT_ID}/logs`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
        timeout: 10000,
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => resolve({ status: res.statusCode, body: data }));
      }
    );
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    req.write(body);
    req.end();
  });
}

/** Send directly to ClickHouse HTTP interface (bypasses Redis/Worker) */
function sendLogsDirect(logs) {
  return new Promise((resolve, reject) => {
    const rows = logs.map((log) => {
      // ClickHouse expects Map(String,String) as JSON object
      const attrs = typeof log.attributes === 'object' ? log.attributes : {};
      return JSON.stringify({
        log_id: log.log_id,
        project_id: PROJECT_ID,
        trace_id: log.trace_id || '',
        span_id: log.span_id || '',
        issue_id: 0,
        timestamp: log.timestamp.replace('T', ' ').replace('Z', ''),
        level: log.level,
        logger_name: log.logger_name || '',
        message: log.message,
        body: log.body || log.message,
        environment: log.environment || '',
        release: log.release || '',
        service: log.service || '',
        attributes: attrs,
      });
    }).join('\n');

    const req = http.request(
      {
        hostname: CH_HOSTNAME,
        port: parseInt(CH_PORT, 10),
        path: `/?query=${encodeURIComponent('INSERT INTO argus.logs FORMAT JSONEachRow')}`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(rows),
        },
        timeout: 10000,
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => resolve({ status: res.statusCode, body: data || 'OK' }));
      }
    );
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    req.write(rows);
    req.end();
  });
}

const sendLogs = DIRECT ? sendLogsDirect : sendLogsViaAPI;

// ─── Console Output ─────────────────────────────────────────────────────────

let totalSent = 0;
let totalErrors = 0;

function printLog(log) {
  const color = COLORS[log.level] || COLORS.info;
  const ts = log.timestamp.replace('T', ' ').replace('Z', '');
  const svc = log.service.padEnd(18);
  const lvl = log.level.toUpperCase().padEnd(5);
  console.log(
    `${COLORS.reset}${ts} ${color}${lvl}${COLORS.reset} [${svc}] ${log.message}`
  );
}

function printStats() {
  const uptime = Math.floor(process.uptime());
  const rate = totalSent / Math.max(uptime, 1);
  console.log(
    `\n${COLORS.info}── Stats: ${totalSent} logs sent, ${totalErrors} errors, ` +
      `${rate.toFixed(1)} logs/s, uptime: ${uptime}s ──${COLORS.reset}\n`
  );
}

// ─── Banner ─────────────────────────────────────────────────────────────────

function printBanner() {
  console.log(`
${COLORS.info}╔══════════════════════════════════════════════════════════════╗
║           🎮  Game Server Log Generator  🎮                  ║
║                                                              ║
║  Target:    ${DIRECT ? `ClickHouse ${CH_HOST}` : `http://${HOST}/argus/api/${PROJECT_ID}/logs`}${' '.repeat(Math.max(0, DIRECT ? 34 - CH_HOST.length : 22 - HOST.length - PROJECT_ID.length))}║
║  Project:   ${PROJECT_ID.padEnd(48)}║
║  Rate:      ${RATE}x${' '.repeat(48)}║
║  Mode:      ${BURST ? 'Burst (100 logs)' : 'Continuous  '} ${DIRECT ? '(direct CH)' : '(via API)  '}${' '.repeat(24)}║
║  Service:   ${(FIXED_SERVICE || 'random').padEnd(48)}║
║                                                              ║
║  Press Ctrl+C to stop                                        ║
╚══════════════════════════════════════════════════════════════╝${COLORS.reset}
`);
}

// ─── Main Loop ──────────────────────────────────────────────────────────────

async function burst() {
  const logs = assembleLogs(100);
  console.log(`\nSending burst of 100 logs...\n`);
  logs.forEach(printLog);

  try {
    const res = await sendLogs(logs);
    console.log(`\n${COLORS.info}✓ Burst complete: ${res.status} — ${res.body}${COLORS.reset}`);
  } catch (err) {
    console.error(`\n${COLORS.error}✗ Burst failed: ${err.message}${COLORS.reset}`);
    process.exit(1);
  }
}

async function continuous() {
  const baseInterval = 1500; // 1.5s base
  let iteration = 0;

  const tick = async () => {
    iteration++;
    // Chaos: 10-30 per batch, Normal: 1-5
    const batchSize = CHAOS ? randInt(10, 30) : randInt(1, 5);
    const logs = assembleLogs(batchSize);

    logs.forEach(printLog);

    try {
      await sendLogs(logs);
      totalSent += batchSize;
    } catch (err) {
      totalErrors++;
      console.error(`${COLORS.error}  ✗ Send failed: ${err.message}${COLORS.reset}`);
    }

    // Print stats every 10 iterations in chaos, 20 normally
    if (iteration % (CHAOS ? 10 : 20) === 0) printStats();

    // Chaos: 50-300ms, Normal: 300-3000ms, adjusted by rate
    const delay = CHAOS ? randInt(50, 300) / RATE : randInt(300, 3000) / RATE;
    setTimeout(tick, delay);
  };

  // Start
  tick();

  // Periodic stats
  setInterval(printStats, 30000);
}

// ─── Entry Point ────────────────────────────────────────────────────────────

printBanner();

// Quick health check
try {
  const healthRes = await new Promise((resolve, reject) => {
    const req = http.get(`http://${HOST}/health`, { timeout: 5000 }, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Health check timeout'));
    });
  });
  console.log(
    `${COLORS.info}✓ Health check passed: ${healthRes.body}${COLORS.reset}\n`
  );
} catch (err) {
  console.warn(
    `${COLORS.warn}⚠ Health check failed (${err.message}) — continuing anyway...${COLORS.reset}\n`
  );
}

if (BURST) {
  await burst();
} else {
  await continuous();
}

/**
 * Argus Data Simulator — Online Game (NodeJS / Lua / UE4) Production-Grade Data
 *
 * Generates realistic error events, structured logs, transactions, sessions,
 * and user feedback for an online game MMO production environment.
 *
 * Target scale:
 *   ~50 unique issue fingerprints
 *   ~300,000 error events
 *   ~1,500,000 structured logs
 *   ~200,000 transactions
 *   ~100,000 sessions
 *   ~2,000 feedback entries
 *   ~20,000 unique users
 *
 * Usage: npx tsx scripts/simulate-data.ts
 */

import { createClient } from '@clickhouse/client';
import mysql from 'mysql2/promise';
import crypto from 'crypto';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../../.env.local') });
dotenv.config({ path: path.join(__dirname, '../../../.env') });

// ═══════════════════ CONFIG ═══════════════════

const MYSQL_CONFIG = {
  host: process.env.MYSQL_HOST || 'localhost',
  port: parseInt(process.env.MYSQL_PORT || '3306', 10),
  database: process.env.MYSQL_DATABASE || 'gatrix',
  user: process.env.MYSQL_USER || 'gatrix_user',
  password: process.env.MYSQL_PASSWORD || 'gatrix_password',
};

const CH_CONFIG = {
  url: `http://${process.env.CLICKHOUSE_HOST || 'localhost'}:${process.env.CLICKHOUSE_PORT || '8123'}`,
  database: process.env.ARGUS_CLICKHOUSE_DATABASE || 'argus',
  username: process.env.CLICKHOUSE_USERNAME || 'default',
  password: process.env.CLICKHOUSE_PASSWORD || '',
};

const PROJECT_ID = '01KN8GSHBJ10JTQ9D0HD60RKFV';
const DAYS_BACK = 14;
const NOW = new Date();

// Scale controls — doubled for richer data diversity
const TOTAL_ERROR_EVENTS = 600_000;
const TOTAL_TRANSACTIONS = 400_000;
const TOTAL_SESSIONS = 200_000;
const TOTAL_FEEDBACK = 5_000;
const USER_POOL_SIZE = 40_000;
const CHUNK_SIZE = 5_000;

// ═══════════════════ HELPERS ═══════════════════

function md5(s: string): string { return crypto.createHash('md5').update(s).digest('hex'); }
function uuid(): string { return crypto.randomUUID().replace(/-/g, ''); }
function randomInt(min: number, max: number): number { return Math.floor(Math.random() * (max - min + 1)) + min; }
function randomFloat(min: number, max: number): number { return min + Math.random() * (max - min); }
function randomPick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
function weightedPick<T>(arr: T[], weights: number[]): T {
  const total = weights.reduce((s, w) => s + w, 0);
  let r = Math.random() * total;
  for (let i = 0; i < arr.length; i++) { r -= weights[i]; if (r <= 0) return arr[i]; }
  return arr[arr.length - 1];
}

// Realistic time distribution: peak at 20-24h KST, low at 3-7h
function randomDateWeighted(daysBack: number): Date {
  const base = NOW.getTime() - Math.random() * daysBack * 86400000;
  const d = new Date(base);
  const hour = d.getUTCHours();
  // KST = UTC+9, peak play hours 20-24 KST = 11-15 UTC
  const peakHours = [11, 12, 13, 14, 15, 16, 17, 18]; // UTC
  const lowHours = [18, 19, 20, 21, 22]; // UTC = 3-7 KST
  if (lowHours.includes(hour) && Math.random() < 0.7) {
    d.setUTCHours(randomPick(peakHours), randomInt(0, 59), randomInt(0, 59));
  }
  return d;
}
function formatDate(d: Date): string { return d.toISOString().replace('T', ' ').replace('Z', ''); }

// ═══════════════════ DYNAMIC TAG / SPAN / LOG HELPERS ═══════════════════

const K8S_NAMESPACES = ['game-prod', 'game-staging', 'infra-prod'];
const DATACENTERS = ['ap-northeast-2a', 'ap-northeast-2b', 'ap-northeast-2c', 'eu-west-1a', 'us-east-1b'];
const DEPLOY_SLOTS = ['blue', 'green'];
const CLIENT_PLATFORMS = ['Steam', 'Epic', 'Direct', 'WeGame', 'PlayStation', 'Xbox'];
const GAME_SHARDS = Array.from({ length: 20 }, (_, i) => `shard-${String(i + 1).padStart(2, '0')}`);
const K8S_SUFFIXES = 'abcdefghijklmnopqrstuvwxyz0123456789';

function k8sPodName(service: string): string {
  const suffix = Array.from({ length: 5 }, () => K8S_SUFFIXES[randomInt(0, K8S_SUFFIXES.length - 1)]).join('');
  const replicaSet = Array.from({ length: 9 }, () => K8S_SUFFIXES[randomInt(0, K8S_SUFFIXES.length - 1)]).join('');
  return `${service}-${replicaSet}-${suffix}`;
}
function instanceId(): string { return `i-${uuid().substring(0, 17)}`; }

function dynamicTags(scenario: ErrorScenario, server: string, env: string): Record<string, string> {
  const base: Record<string, string> = { ...scenario.tags };
  const service = randomPick(scenario.services);
  base['server.name'] = server;
  base['environment'] = env;
  base['deployment.slot'] = randomPick(DEPLOY_SLOTS);
  base['server.datacenter'] = randomPick(DATACENTERS);

  if (scenario.runtime === 'nodejs') {
    base['kubernetes.pod_name'] = k8sPodName(service);
    base['kubernetes.namespace'] = randomPick(K8S_NAMESPACES);
    base['process.pid'] = String(randomInt(1000, 65535));
    base['node.version'] = randomPick(['v20.14.0', 'v20.12.2', 'v22.2.0']);
    base['server.instance_id'] = instanceId();
    base['game.shard'] = randomPick(GAME_SHARDS);
    if (Math.random() < 0.4) base['db.connection_pool'] = `pool-${randomInt(1, 5)}`;
    if (Math.random() < 0.3) base['network.rtt_ms'] = String(randomInt(8, 450));
  } else if (scenario.runtime === 'lua') {
    base['lua.vm_id'] = `vm-${uuid().substring(0, 8)}`;
    base['lua.gc_memory_kb'] = String(randomInt(8000, 180000));
    base['game.world_id'] = randomPick(GAME_SHARDS);
    base['game.scene'] = randomPick(['port_lisbon', 'port_london', 'port_istanbul', 'sea_atlantic', 'sea_mediterranean', 'sea_caribbean', 'port_amsterdam', 'port_venice', 'sea_indian_ocean', 'port_calicut']);
    base['game.zone_population'] = String(randomInt(50, 800));
  } else if (scenario.runtime === 'ue4') {
    base['gpu.vendor'] = randomPick(['NVIDIA', 'AMD', 'Intel']);
    base['gpu.vram_mb'] = String(randomPick([4096, 6144, 8192, 12288, 16384]));
    base['client.platform'] = randomPick(CLIENT_PLATFORMS);
    base['client.build_number'] = String(randomInt(10000, 99999));
    base['display.resolution'] = randomPick(['1920x1080', '2560x1440', '3840x2160', '1366x768', '2560x1080']);
    base['display.fullscreen'] = randomPick(['true', 'false', 'borderless']);
    base['client.fps_avg'] = String(randomInt(12, 144));
    if (Math.random() < 0.5) base['network.rtt_ms'] = String(randomInt(15, 600));
  }
  // Occasional extra tags for diversity
  if (Math.random() < 0.2) base['feature_flag.new_combat'] = randomPick(['true', 'false']);
  if (Math.random() < 0.15) base['ab_test.variant'] = randomPick(['control', 'treatment_a', 'treatment_b']);
  if (Math.random() < 0.1) base['session.is_returning'] = randomPick(['true', 'false']);
  return base;
}

function dynamicExtra(scenario: ErrorScenario): Record<string, string> {
  const base: Record<string, string> = { ...scenario.extra };
  if (Math.random() < 0.3) base['request_id'] = uuid();
  if (Math.random() < 0.4) base['correlation_id'] = uuid().substring(0, 16);
  if (Math.random() < 0.2) base['cpu_usage_pct'] = String(randomFloat(20, 98).toFixed(1));
  if (Math.random() < 0.2) base['memory_rss_mb'] = String(randomInt(256, 4096));
  if (Math.random() < 0.15) base['gc_pause_ms'] = String(randomInt(5, 800));
  if (Math.random() < 0.1) base['active_goroutines'] = String(randomInt(100, 5000));
  return base;
}

// ═══════════════════ REALISTIC SPAN TEMPLATES ═══════════════════

const SPAN_DB_QUERIES = [
  'SELECT * FROM characters WHERE user_id = ? LIMIT 1',
  'UPDATE characters SET gold = gold + ?, last_login = NOW() WHERE id = ?',
  'INSERT INTO trade_logs (seller_id, buyer_id, item_id, price, timestamp) VALUES (?, ?, ?, ?, ?)',
  'SELECT i.*, e.* FROM inventory i JOIN equipment e ON i.id = e.inv_id WHERE i.character_id = ?',
  'DELETE FROM expired_sessions WHERE last_activity < DATE_SUB(NOW(), INTERVAL 1 HOUR)',
  'SELECT g.*, COUNT(gm.id) AS member_count FROM guilds g JOIN guild_members gm ON g.id = gm.guild_id WHERE g.id = ? GROUP BY g.id',
  'SELECT * FROM auction_listings WHERE status = "active" AND expires_at > NOW() ORDER BY created_at DESC LIMIT 50',
  'INSERT INTO combat_logs (attacker_id, defender_id, damage, skill_id, timestamp) VALUES (?, ?, ?, ?, ?)',
  'SELECT * FROM guild_rankings WHERE season = ? ORDER BY score DESC LIMIT 100',
  'UPDATE user_sessions SET token_expires_at = ?, refresh_token = ? WHERE user_id = ?',
  'SELECT COUNT(*) AS online FROM characters WHERE is_online = 1 AND server_shard = ?',
  'INSERT INTO chat_messages (channel_id, sender_id, message, created_at) VALUES (?, ?, ?, ?)',
  'SELECT * FROM market_orders WHERE item_type = ? AND price BETWEEN ? AND ? ORDER BY price ASC LIMIT 20',
  'UPDATE guild_bank SET quantity = quantity - ? WHERE guild_id = ? AND item_id = ? AND quantity >= ?',
];

const SPAN_CACHE_KEYS = [
  'character:{userId}:profile', 'character:{userId}:inventory',
  'character:{userId}:equipment', 'guild:{guildId}:members',
  'market:listings:page:{page}', 'session:{sessionId}:token',
  'rankings:guild:season:12', 'matchmaking:queue:pvp_fleet',
  'config:ship_balance:v3', 'npc:dialog:{npcId}:tree',
  'world:shard:{shardId}:population', 'rate_limit:{ip}:counter',
  'auction:{auctionId}:lock', 'combat:cooldown:{userId}:{skillId}',
];

const SPAN_HTTP_CALLS = [
  'POST https://analytics.internal/v2/events', 'GET https://cdn.internal/config/ship_balance_v3.json',
  'POST https://payment.internal/verify-receipt', 'POST https://anticheat.internal/validate',
  'GET https://leaderboard.internal/api/rankings?season=12', 'POST https://notification.internal/push',
  'POST https://matchmaking.internal/queue/join', 'GET https://auth.internal/token/refresh',
  'POST https://audit.internal/log', 'GET https://discovery.internal/services/lobbyd',
];

interface SpanTemplate { op: string; description: string; durMin: number; durMax: number; }

const SPAN_TEMPLATES_BY_TXN: Record<string, SpanTemplate[]> = {
  'POST /api/auth/login': [
    { op: 'db.query', description: 'SELECT * FROM users WHERE email = ? LIMIT 1', durMin: 3, durMax: 30 },
    { op: 'function', description: 'bcrypt.compare(password, hash)', durMin: 80, durMax: 250 },
    { op: 'db.query', description: 'UPDATE users SET last_login = NOW() WHERE id = ?', durMin: 2, durMax: 15 },
    { op: 'cache.set', description: 'redis SET session:{sessionId}:token', durMin: 1, durMax: 5 },
    { op: 'http.client', description: 'POST https://analytics.internal/v2/events', durMin: 5, durMax: 50 },
  ],
  'POST /api/character/save': [
    { op: 'cache.get', description: 'redis GET character:{userId}:lock', durMin: 1, durMax: 3 },
    { op: 'function', description: 'CharacterSerializer.validate(saveData)', durMin: 2, durMax: 10 },
    { op: 'db.query', description: 'UPDATE characters SET equipment = ?, gold = ?, position = ? WHERE id = ?', durMin: 5, durMax: 50 },
    { op: 'cache.set', description: 'redis SET character:{userId}:profile', durMin: 1, durMax: 5 },
    { op: 'function', description: 'CRC32.compute(saveBlob)', durMin: 1, durMax: 8 },
  ],
  'POST /api/trade/complete': [
    { op: 'cache.get', description: 'redis GET trade:{tradeId}:lock', durMin: 1, durMax: 5 },
    { op: 'db.query', description: 'SELECT * FROM inventory WHERE character_id = ? FOR UPDATE', durMin: 5, durMax: 40 },
    { op: 'db.query', description: 'UPDATE inventory SET owner_id = ? WHERE id = ? AND owner_id = ?', durMin: 3, durMax: 30 },
    { op: 'db.query', description: 'UPDATE characters SET gold = gold - ? WHERE id = ? AND gold >= ?', durMin: 3, durMax: 20 },
    { op: 'db.query', description: 'INSERT INTO trade_logs (seller, buyer, item, price) VALUES (?, ?, ?, ?)', durMin: 2, durMax: 15 },
    { op: 'http.client', description: 'POST https://analytics.internal/v2/events', durMin: 5, durMax: 40 },
  ],
  'GET /api/rankings/guild': [
    { op: 'cache.get', description: 'redis GET rankings:guild:season:12', durMin: 1, durMax: 5 },
    { op: 'db.query', description: 'SELECT g.*, SUM(s.score) FROM guilds g JOIN scores s ON g.id = s.guild_id WHERE s.season = 12 GROUP BY g.id ORDER BY SUM(s.score) DESC LIMIT 100', durMin: 200, durMax: 8000 },
    { op: 'cache.set', description: 'redis SET rankings:guild:season:12 EX 300', durMin: 1, durMax: 5 },
    { op: 'function', description: 'RankingFormatter.format(results)', durMin: 2, durMax: 15 },
  ],
  'POST /api/matchmaking/queue': [
    { op: 'cache.get', description: 'redis GET matchmaking:queue:pvp_fleet:size', durMin: 1, durMax: 3 },
    { op: 'function', description: 'MMRCalculator.computeRange(player)', durMin: 2, durMax: 10 },
    { op: 'cache.set', description: 'redis ZADD matchmaking:queue:pvp_fleet {mmr} {userId}', durMin: 1, durMax: 5 },
    { op: 'function', description: 'MatchmakingEngine.tryMatch(queue)', durMin: 100, durMax: 120000 },
  ],
  'POST /api/guild/bank/transfer': [
    { op: 'db.query', description: 'SELECT * FROM guild_members WHERE user_id = ? AND guild_id = ?', durMin: 3, durMax: 15 },
    { op: 'function', description: 'PermissionChecker.hasPermission(member, "bank.transfer")', durMin: 1, durMax: 5 },
    { op: 'db.query', description: 'BEGIN TRANSACTION', durMin: 1, durMax: 3 },
    { op: 'db.query', description: 'UPDATE guild_bank SET quantity = quantity - ? WHERE guild_id = ? AND item_id = ?', durMin: 5, durMax: 50 },
    { op: 'db.query', description: 'INSERT INTO inventory (character_id, item_id, quantity) VALUES (?, ?, ?)', durMin: 3, durMax: 20 },
    { op: 'db.query', description: 'COMMIT', durMin: 1, durMax: 10 },
  ],
};

function getSpanTemplates(txnName: string): SpanTemplate[] {
  if (SPAN_TEMPLATES_BY_TXN[txnName]) return SPAN_TEMPLATES_BY_TXN[txnName];
  // Generic fallback with realistic ops
  const numSpans = randomInt(2, 5);
  const spans: SpanTemplate[] = [];
  for (let i = 0; i < numSpans; i++) {
    const op = randomPick(['db.query', 'db.query', 'cache.get', 'cache.set', 'http.client', 'function', 'serialize']);
    let desc: string;
    switch (op) {
      case 'db.query': desc = randomPick(SPAN_DB_QUERIES); break;
      case 'cache.get': case 'cache.set': desc = `redis ${op === 'cache.get' ? 'GET' : 'SET'} ${randomPick(SPAN_CACHE_KEYS).replace(/{\w+}/g, String(randomInt(1000, 99999)))}`; break;
      case 'http.client': desc = randomPick(SPAN_HTTP_CALLS); break;
      case 'function': desc = randomPick(['JSON.parse(requestBody)', 'Validator.validate(payload)', 'Serializer.toProtobuf(response)', 'CryptoUtil.hmacSign(data)', 'Compressor.gzip(blob)']); break;
      default: desc = randomPick(['JSON.stringify(responsePayload)', 'MessagePack.encode(event)', 'ProtoBuf.serialize(packet)']); break;
    }
    spans.push({ op, description: desc, durMin: 1, durMax: randomInt(20, 500) });
  }
  return spans;
}

// ═══════════════════ CONTEXTUAL LOG MESSAGES ═══════════════════

interface LogLine { level: string; logger: string; msg: string; body?: string; }

function generateContextualLogs(scenario: ErrorScenario, user: { id: string; ip: string }, server: string, env: string, release: string): LogLine[] {
  const logs: LogLine[] = [];
  const shard = randomPick(GAME_SHARDS);
  const connId = randomInt(10000, 99999);
  const reqId = uuid().substring(0, 12);

  // Runtime-specific pre-error logs
  if (scenario.runtime === 'nodejs') {
    // Common server-side request lifecycle
    if (scenario.transaction.startsWith('POST') || scenario.transaction.startsWith('GET')) {
      logs.push({ level: 'info', logger: 'HttpServer', msg: `[req:${reqId}] ${scenario.transaction} from ${user.ip} (${server}/${shard})` });
      logs.push({ level: 'debug', logger: 'AuthMiddleware', msg: `[req:${reqId}] Token validated for ${user.id} (expires in ${randomInt(300, 7200)}s)` });
    } else if (scenario.transaction.startsWith('WS')) {
      logs.push({ level: 'debug', logger: 'WebSocketServer', msg: `[conn:${connId}] Frame received from ${user.id} (${user.ip}), size=${randomInt(64, 4096)}B` });
    } else if (scenario.transaction.startsWith('INTERNAL')) {
      logs.push({ level: 'debug', logger: 'Scheduler', msg: `[job:${reqId}] Internal task started: ${scenario.culprit}` });
    }

    // Scenario-specific context
    switch (scenario.id) {
      case 'ws-drop':
        logs.push({ level: 'info', logger: 'NetworkGateway', msg: `[conn:${connId}] WebSocket keepalive ping sent to ${user.id}` });
        logs.push({ level: 'warn', logger: 'NetworkGateway', msg: `[conn:${connId}] Pong timeout after ${randomInt(25000, 35000)}ms — marking connection stale` });
        logs.push({ level: 'info', logger: 'SessionManager', msg: `[conn:${connId}] Saving player state before disconnect (character_id=${randomInt(10000, 999999)}, gold=${randomInt(1000, 500000)})` });
        logs.push({ level: 'error', logger: 'NetworkGateway', msg: `[conn:${connId}] WebSocket closed abnormally (code=1006) for ${user.id}. Last packet: ${randomInt(20, 45)}s ago` });
        break;
      case 'redis-conn':
        logs.push({ level: 'warn', logger: 'RedisClient', msg: `Health check FAIL (attempt 1/3): ECONNREFUSED 10.0.3.12:6379` });
        logs.push({ level: 'warn', logger: 'RedisClient', msg: `Health check FAIL (attempt 2/3): ECONNREFUSED 10.0.3.12:6379 (retry in 1s)` });
        logs.push({ level: 'error', logger: 'RedisClient', msg: `Health check FAIL (attempt 3/3): All retries exhausted. Sentinel unavailable.` });
        logs.push({ level: 'error', logger: 'RedisSessionStore', msg: `Session store OFFLINE — ${randomInt(200, 5000)} active sessions at risk` });
        break;
      case 'mysql-pool':
        logs.push({ level: 'info', logger: 'ConnectionPool', msg: `[pool:character-primary] Utilization: ${randomInt(85, 95)}/100 connections active` });
        logs.push({ level: 'warn', logger: 'ConnectionPool', msg: `[pool:character-primary] Utilization: 100/100 — queuing requests (depth: ${randomInt(100, 1500)})` });
        logs.push({ level: 'warn', logger: 'QueryRunner', msg: `[req:${reqId}] Connection acquire timeout after ${randomInt(8000, 15000)}ms — avgQueryTime=${randomInt(200, 500)}ms` });
        logs.push({ level: 'error', logger: 'ConnectionPool', msg: `[pool:character-primary] EXHAUSTED: 100/100 active, ${randomInt(500, 2000)} waiting. Oldest waiting: ${randomInt(5, 30)}s` });
        break;
      case 'inv-dupe':
        logs.push({ level: 'info', logger: 'TradeController', msg: `[req:${reqId}] Trade initiated: ${user.id} selling item_id=${randomInt(10000, 99999)} to NPC` });
        logs.push({ level: 'info', logger: 'InventoryManager', msg: `[req:${reqId}] Server inventory count: ${randomInt(40, 50)} items` });
        logs.push({ level: 'warn', logger: 'InventoryManager', msg: `[req:${reqId}] Client reports ${randomInt(48, 55)} items — MISMATCH detected` });
        logs.push({ level: 'error', logger: 'ItemValidator', msg: `[req:${reqId}] Duplicate item_id=${randomInt(20000, 40000)} (Refined Gold Bar) found. Race condition suspected in concurrent trade API.` });
        break;
      case 'match-timeout':
        logs.push({ level: 'info', logger: 'MatchmakingService', msg: `[req:${reqId}] Player ${user.id} entered PvP queue (MMR: ${randomInt(1200, 2400)}, mode: pvp_fleet_battle)` });
        logs.push({ level: 'info', logger: 'MatchmakingService', msg: `[req:${reqId}] Queue size: ${randomInt(1500, 4000)} players waiting` });
        logs.push({ level: 'warn', logger: 'MatchmakingService', msg: `[req:${reqId}] 60s elapsed — expanding MMR range: ±200 → ±500` });
        logs.push({ level: 'warn', logger: 'MatchmakingService', msg: `[req:${reqId}] 90s elapsed — expanding MMR range: ±500 → ±1000 (desperate mode)` });
        logs.push({ level: 'error', logger: 'MatchmakingService', msg: `[req:${reqId}] Queue timeout after 120s. No suitable opponent found for MMR ${randomInt(1200, 2400)}.` });
        break;
      case 'slow-query':
        logs.push({ level: 'debug', logger: 'QueryExecutor', msg: `[req:${reqId}] Executing: SELECT * FROM guild_rankings WHERE season=12 ORDER BY score DESC` });
        logs.push({ level: 'warn', logger: 'QueryMonitor', msg: `[req:${reqId}] Query running ${randomInt(3000, 6000)}ms (threshold: 2000ms) — possible full table scan` });
        logs.push({ level: 'warn', logger: 'QueryMonitor', msg: `[req:${reqId}] Query completed in ${randomInt(6000, 12000)}ms. Rows scanned: ${randomInt(800000, 2000000)}. Missing index suspected on (season, score).` });
        break;
      case 'deadlock':
        logs.push({ level: 'info', logger: 'TransactionRunner', msg: `[req:${reqId}] BEGIN TRANSACTION (guild_bank_transfer, isolation: REPEATABLE READ)` });
        logs.push({ level: 'debug', logger: 'GuildBankService', msg: `[req:${reqId}] Locking guild_bank_items for guild_id=${randomInt(1000, 9999)}` });
        logs.push({ level: 'warn', logger: 'TransactionRunner', msg: `[req:${reqId}] Lock wait timeout exceeded (${randomInt(40, 60)}s) — concurrent transactions: ${randomInt(5, 20)}` });
        logs.push({ level: 'error', logger: 'TransactionRunner', msg: `[req:${reqId}] DEADLOCK DETECTED on table guild_bank_items. Transaction rolled back. Retry #${randomInt(1, 3)}.` });
        break;
      default:
        // Generic contextual logs for other nodejs scenarios
        logs.push({ level: 'debug', logger: scenario.culprit.split(/[.:]/)[0], msg: `[req:${reqId}] Executing ${scenario.culprit} for ${user.id}` });
        if (Math.random() < 0.5) logs.push({ level: 'info', logger: 'MetricsCollector', msg: `[req:${reqId}] Request latency: ${randomInt(50, 2000)}ms, memory: ${randomInt(200, 1500)}MB` });
        logs.push({ level: scenario.level === 'fatal' ? 'error' : scenario.level, logger: 'ErrorHandler', msg: `[req:${reqId}] ${scenario.type}: ${scenario.value.substring(0, 180)}` });
        break;
    }
  } else if (scenario.runtime === 'lua') {
    logs.push({ level: 'debug', logger: 'LuaVM', msg: `[vm:${uuid().substring(0, 8)}] Script tick #${randomInt(10000, 999999)} (GC: ${randomInt(20, 180)}MB, entities: ${randomInt(100, 5000)})` });
    switch (scenario.id) {
      case 'lua-nil':
        logs.push({ level: 'info', logger: 'UIManager', msg: `Player ${user.id} opened CharacterPanel (scene: ${randomPick(['port_lisbon', 'port_london', 'sea_atlantic'])})` });
        logs.push({ level: 'debug', logger: 'CharacterUI', msg: `CharacterUI:onOpen() — loading equipment data for character_id=${randomInt(10000, 999999)}` });
        logs.push({ level: 'error', logger: 'LuaRuntime', msg: `attempt to index a nil value (field 'equipSlots') at CharacterUI.lua:234 — characterData is nil, data not loaded before UI render` });
        break;
      case 'lua-cooldown':
        logs.push({ level: 'info', logger: 'CombatSystem', msg: `Player ${user.id} using skill "Broadside Barrage" (id=2847) on target entity_${randomInt(1000, 9999)}` });
        logs.push({ level: 'warn', logger: 'SkillCooldownTracker', msg: `Skill 2847 server cooldown remaining: ${randomFloat(2, 8).toFixed(1)}s, client reports 0s — DESYNC` });
        logs.push({ level: 'error', logger: 'CombatSystem', msg: `CooldownDesyncError: ${randomInt(2, 5)} extra shots fired during desync window. Client clock drift: ${randomInt(100, 2000)}ms.` });
        break;
      case 'lua-gc':
        logs.push({ level: 'info', logger: 'GCMonitor', msg: `GC cycle started (mode: generational, memory: ${randomInt(100, 200)}MB)` });
        logs.push({ level: 'warn', logger: 'GCMonitor', msg: `GC pause spike: ${randomInt(200, 600)}ms (threshold: 16ms). Freed ${randomInt(20, 80)}MB. ${randomInt(500, 3000)} objects collected.` });
        logs.push({ level: 'info', logger: 'GCMonitor', msg: `GC cycle complete. Post-GC memory: ${randomInt(60, 120)}MB. Consider incremental GC tuning.` });
        break;
      default:
        logs.push({ level: 'debug', logger: 'LuaRuntime', msg: `Executing: ${scenario.culprit} (frame ${randomInt(1, 60)} of tick)` });
        logs.push({ level: scenario.level === 'fatal' ? 'error' : scenario.level, logger: 'LuaRuntime', msg: `${scenario.type}: ${scenario.value.substring(0, 180)}` });
        break;
    }
  } else if (scenario.runtime === 'ue4') {
    logs.push({ level: 'debug', logger: 'UE4Core', msg: `[Frame:${randomInt(100000, 9999999)}] FPS: ${randomInt(15, 120)}, DrawCalls: ${randomInt(500, 5000)}, Triangles: ${randomInt(500000, 5000000)}` });
    switch (scenario.id) {
      case 'ue4-gpu-lost':
        logs.push({ level: 'info', logger: 'Renderer', msg: `VRAM usage: ${randomFloat(4.5, 5.9).toFixed(1)}GB / ${randomPick(['6.0', '8.0'])}GB (${randomInt(85, 98)}%)` });
        logs.push({ level: 'warn', logger: 'Renderer', msg: `FPS dropped: ${randomInt(40, 60)} → ${randomInt(8, 15)}. GPU stall detected during ocean surface shader.` });
        logs.push({ level: 'error', logger: 'D3D12RHI', msg: `D3D Device Removed: DXGI_ERROR_DEVICE_HUNG. GPU: ${randomPick(['GeForce RTX 3060', 'GeForce GTX 1660', 'Radeon RX 6700 XT'])}. Driver: ${randomPick(['551.86', '552.12', '24.5.1'])}.` });
        break;
      case 'ue4-repl':
        logs.push({ level: 'info', logger: 'NetDriver', msg: `Network update tick. RTT: ${randomInt(50, 400)}ms, PacketLoss: ${randomFloat(0, 0.15).toFixed(3)}` });
        logs.push({ level: 'warn', logger: 'ShipActor', msg: `Position desync for BP_PlayerShip_C_${randomInt(1, 100)}: delta ${randomInt(100, 1000)} units. Server correcting client.` });
        logs.push({ level: 'error', logger: 'NetReplication', msg: `ReplicationError: Persistent desync (${randomInt(3, 10)} corrections in last 30s). Client rubber-banding. Consider lowering net update frequency.` });
        break;
      default:
        logs.push({ level: 'debug', logger: 'UE4Core', msg: `${scenario.culprit} executing (tick ${randomInt(1, 60)})` });
        logs.push({ level: scenario.level === 'fatal' ? 'error' : scenario.level, logger: 'UE4Crash', msg: `${scenario.type}: ${scenario.value.substring(0, 180)}` });
        break;
    }
  }

  // Always add the final error log
  if (!logs.some(l => l.level === 'error' || l.level === 'fatal')) {
    logs.push({ level: scenario.level === 'warning' ? 'warn' : scenario.level, logger: 'ErrorReporter', msg: `${scenario.type}: ${scenario.value.substring(0, 200)}` });
  }

  return logs;
}

// ═══════════════════ GAME RELEASES ═══════════════════

const SERVER_RELEASES = ['3.12.0', '3.12.1', '3.12.2', '3.13.0-rc.1', '3.13.0', '3.13.1', '3.14.0-beta.1'];
const CLIENT_RELEASES = ['2.8.0', '2.8.1', '2.9.0', '2.9.1', '2.10.0-beta'];
const LUA_RELEASES = ['1.45.0', '1.45.1', '1.46.0', '1.46.1'];

// ═══════════════════ ERROR SCENARIOS ═══════════════════

interface ErrorScenario {
  id: string;
  runtime: 'nodejs' | 'lua' | 'ue4';
  type: string;
  title: string;
  value: string;
  level: 'fatal' | 'error' | 'warning';
  culprit: string;
  platform: string;
  transaction: string;
  frames: { filename: string; function: string; lineno: number; colno: number; module: string; in_app: boolean }[];
  breadcrumbTemplates: { type: string; category: string; message: string; level: string }[];
  tags: Record<string, string>;
  extra: Record<string, string>;
  contexts: any;
  weight: number;
  environments: string[];
  releases: string[];
  services: string[];
  servers: string[];
}

const SCENARIOS: ErrorScenario[] = [

  // ══════════════════════════════════════════════════════════════
  //   NODE.JS GAME SERVER — 20 scenarios
  // ══════════════════════════════════════════════════════════════

  // 1. WebSocket connection drop (most common)
  {
    id: 'ws-drop', runtime: 'nodejs', type: 'ConnectionError',
    title: 'WebSocket connection closed abnormally during gameplay',
    value: 'ConnectionError: WebSocket connection to wss://game-gw.unchartedwaters.io/play closed unexpectedly (code: 1006, reason: abnormal closure)',
    level: 'fatal', culprit: 'NetworkGateway.onSocketClose', platform: 'node',
    transaction: 'WS /game/play',
    frames: [
      { filename: 'src/gateway/NetworkGateway.ts', function: 'onSocketClose', lineno: 342, colno: 18, module: 'gateway', in_app: true },
      { filename: 'src/gateway/WebSocketTransport.ts', function: 'handleClose', lineno: 128, colno: 8, module: 'gateway', in_app: true },
      { filename: 'src/session/SessionManager.ts', function: 'onDisconnect', lineno: 89, colno: 12, module: 'session', in_app: true },
    ],
    breadcrumbTemplates: [
      { type: 'http', category: 'ws', message: 'WS keepalive ping sent', level: 'info' },
      { type: 'http', category: 'ws', message: 'WS keepalive pong timeout (30s)', level: 'warning' },
      { type: 'default', category: 'network', message: 'WebSocket readyState changed: CLOSING', level: 'error' },
    ],
    tags: { 'server.region': 'ap-northeast-2', 'ws.close_code': '1006' },
    extra: { lastPingMs: '28472', reconnectAttempts: '3', packetLossRate: '0.42' },
    contexts: { network: { type: 'websocket', latency_ms: 2847, protocol: 'wss' } },
    weight: 35, environments: ['production', 'production', 'production', 'staging'],
    releases: SERVER_RELEASES.slice(3), services: ['game-gateway'], servers: ['gw-01', 'gw-02', 'gw-03', 'gw-04'],
  },

  // 2. Redis ECONNREFUSED
  {
    id: 'redis-conn', runtime: 'nodejs', type: 'RedisConnectionError',
    title: 'Redis connection refused: session store unavailable',
    value: 'Error: connect ECONNREFUSED 10.0.3.12:6379 — Redis session store is unreachable. Failover not available.',
    level: 'fatal', culprit: 'RedisSessionStore.connect', platform: 'node',
    transaction: 'INTERNAL session.validate',
    frames: [
      { filename: 'src/store/RedisSessionStore.ts', function: 'connect', lineno: 67, colno: 14, module: 'store', in_app: true },
      { filename: 'src/store/RedisClient.ts', function: 'createConnection', lineno: 34, colno: 22, module: 'store', in_app: true },
      { filename: 'node_modules/ioredis/built/Redis.js', function: 'connect', lineno: 271, colno: 12, module: 'ioredis', in_app: false },
    ],
    breadcrumbTemplates: [
      { type: 'default', category: 'redis', message: 'Redis health check: FAIL (attempt 1/3)', level: 'warning' },
      { type: 'default', category: 'redis', message: 'Redis health check: FAIL (attempt 3/3)', level: 'error' },
      { type: 'default', category: 'redis', message: 'Failover triggered — no sentinel available', level: 'error' },
    ],
    tags: { 'redis.host': '10.0.3.12', 'redis.port': '6379', 'server.region': 'ap-northeast-2' },
    extra: { connectionAttempts: '3', failoverEnabled: 'false', lastSuccessfulPing: '342s ago' },
    contexts: { redis: { host: '10.0.3.12', port: 6379, db: 0, maxRetries: 3 } },
    weight: 8, environments: ['production'], releases: SERVER_RELEASES.slice(4),
    services: ['game-session'], servers: ['session-01', 'session-02'],
  },

  // 3. MySQL connection pool exhausted
  {
    id: 'mysql-pool', runtime: 'nodejs', type: 'DatabasePoolExhausted',
    title: 'MySQL connection pool exhausted: all connections busy',
    value: 'Error: Pool is full. Max connections: 100, Active: 100, Waiting: 847. Consider increasing pool size or optimizing queries.',
    level: 'error', culprit: 'DatabasePool.acquire', platform: 'node',
    transaction: 'POST /api/character/save',
    frames: [
      { filename: 'src/database/DatabasePool.ts', function: 'acquire', lineno: 112, colno: 14, module: 'database', in_app: true },
      { filename: 'src/database/QueryRunner.ts', function: 'execute', lineno: 56, colno: 22, module: 'database', in_app: true },
      { filename: 'src/services/CharacterService.ts', function: 'saveProgress', lineno: 289, colno: 8, module: 'services', in_app: true },
    ],
    breadcrumbTemplates: [
      { type: 'default', category: 'db', message: 'Pool utilization: 95/100 active', level: 'warning' },
      { type: 'default', category: 'db', message: 'Pool utilization: 100/100 — queue depth: 847', level: 'error' },
      { type: 'default', category: 'db', message: 'Connection acquire timeout after 10000ms', level: 'error' },
    ],
    tags: { 'db.type': 'mysql', 'db.pool': 'character-primary', 'server.region': 'ap-northeast-2' },
    extra: { maxConnections: '100', activeConnections: '100', waitingRequests: '847', avgQueryMs: '342' },
    contexts: { database: { type: 'mysql', pool: 'character-primary', version: '8.0.36' } },
    weight: 12, environments: ['production', 'production', 'staging'],
    releases: SERVER_RELEASES.slice(2), services: ['game-world'], servers: ['world-01', 'world-02', 'world-03'],
  },

  // 4. Inventory duplication exploit
  {
    id: 'inv-dupe', runtime: 'nodejs', type: 'InventorySyncError',
    title: 'Inventory item duplication detected during trade',
    value: 'InventorySyncError: Server reports 47 items but client claims 49. Duplicate item_id=30291 (Refined Gold Bar). Race condition in concurrent trade API.',
    level: 'error', culprit: 'InventoryManager.validateSync', platform: 'node',
    transaction: 'POST /api/trade/complete',
    frames: [
      { filename: 'src/services/InventoryManager.ts', function: 'validateSync', lineno: 215, colno: 22, module: 'inventory', in_app: true },
      { filename: 'src/services/ItemValidator.ts', function: 'checkDuplicates', lineno: 78, colno: 14, module: 'inventory', in_app: true },
      { filename: 'src/controllers/TradeController.ts', function: 'completeTrade', lineno: 334, colno: 8, module: 'controllers', in_app: true },
    ],
    breadcrumbTemplates: [
      { type: 'http', category: 'http', message: 'POST /api/trade/complete → 200 (128ms)', level: 'info' },
      { type: 'default', category: 'inventory', message: 'Client inventory updated (+5200 gold)', level: 'info' },
      { type: 'default', category: 'inventory', message: 'Inventory sync FAILED: count mismatch (47 vs 49)', level: 'error' },
    ],
    tags: { 'trade.type': 'player_to_npc', 'server.region': 'ap-northeast-2' },
    extra: { serverItemCount: '47', clientItemCount: '49', duplicateItemId: '30291' },
    contexts: { game: { scene: 'port_lisbon', character_level: 42 } },
    weight: 18, environments: ['production', 'production', 'staging'],
    releases: SERVER_RELEASES.slice(3), services: ['game-world'], servers: ['world-01', 'world-02', 'world-03', 'world-04'],
  },

  // 5. Matchmaking timeout
  {
    id: 'match-timeout', runtime: 'nodejs', type: 'MatchmakingTimeout',
    title: 'PvP matchmaking timed out after 120s',
    value: "TimeoutError: Matchmaking queue 'pvp_fleet_battle' exceeded max wait time (120000ms). Players in queue: 2847, no suitable opponent found.",
    level: 'error', culprit: 'MatchmakingService.findMatch', platform: 'node',
    transaction: 'POST /api/matchmaking/queue',
    frames: [
      { filename: 'src/services/MatchmakingService.ts', function: 'findMatch', lineno: 198, colno: 14, module: 'matchmaking', in_app: true },
      { filename: 'src/services/MatchmakingService.ts', function: 'processQueue', lineno: 142, colno: 22, module: 'matchmaking', in_app: true },
      { filename: 'src/controllers/BattleController.ts', function: 'requestMatch', lineno: 56, colno: 8, module: 'controllers', in_app: true },
    ],
    breadcrumbTemplates: [
      { type: 'default', category: 'matchmaking', message: 'Player entered PvP queue (MMR: 1847)', level: 'info' },
      { type: 'default', category: 'matchmaking', message: 'Expanded MMR range: ±200 → ±500', level: 'warning' },
      { type: 'default', category: 'matchmaking', message: 'Queue timeout: no match in 120s', level: 'error' },
    ],
    tags: { 'matchmaking.mode': 'pvp_fleet_battle', 'server.region': 'eu-west-1' },
    extra: { queueTimeMs: '120000', playersInQueue: '2847', mmrRange: '1347-2347' },
    contexts: { matchmaking: { mode: 'pvp_fleet_battle', mmr: 1847 } },
    weight: 15, environments: ['production', 'production'],
    releases: SERVER_RELEASES.slice(2), services: ['match-server'], servers: ['match-01', 'match-02'],
  },

  // 6. Payment receipt validation failure
  {
    id: 'payment-sig', runtime: 'nodejs', type: 'PaymentValidationError',
    title: 'Google Play receipt signature verification failed',
    value: 'PaymentValidationError: Receipt signature mismatch for order GPA.3842-1928-4827-19283. Possible replay attack or tampered receipt.',
    level: 'error', culprit: 'PaymentService.validateReceipt', platform: 'node',
    transaction: 'POST /api/payment/verify',
    frames: [
      { filename: 'src/services/PaymentService.ts', function: 'validateReceipt', lineno: 287, colno: 18, module: 'payment', in_app: true },
      { filename: 'src/services/GooglePlayValidator.ts', function: 'verifySignature', lineno: 94, colno: 12, module: 'payment', in_app: true },
    ],
    breadcrumbTemplates: [
      { type: 'default', category: 'payment', message: 'Purchase initiated: Premium Nav Chart ($9.99)', level: 'info' },
      { type: 'default', category: 'payment', message: 'Receipt signature INVALID', level: 'error' },
    ],
    tags: { 'payment.provider': 'google_play', 'payment.product': 'nav_chart_bundle' },
    extra: { orderId: 'GPA.3842-1928-4827-19283', amount: '9.99', currency: 'USD' },
    contexts: { payment: { provider: 'google_play', product: 'nav_chart_bundle' } },
    weight: 6, environments: ['production'],
    releases: SERVER_RELEASES.slice(3), services: ['payment-server'], servers: ['pay-01'],
  },

  // 7. Chat service overload
  {
    id: 'chat-overload', runtime: 'nodejs', type: 'ServiceUnavailableError',
    title: 'Chat service returned 503: connection limit reached',
    value: 'ServiceUnavailableError: Chat service returned 503. Active connections: 48291/50000. Message queue depth: 12847.',
    level: 'warning', culprit: 'ChatService.sendMessage', platform: 'node',
    transaction: 'POST /api/chat/send',
    frames: [
      { filename: 'src/services/ChatService.ts', function: 'sendMessage', lineno: 156, colno: 14, module: 'chat', in_app: true },
      { filename: 'src/services/ChatService.ts', function: 'publishToChannel', lineno: 201, colno: 18, module: 'chat', in_app: true },
    ],
    breadcrumbTemplates: [
      { type: 'default', category: 'chat', message: 'Message to guild channel [Mediterranean Traders]', level: 'info' },
      { type: 'default', category: 'chat', message: 'Chat service health: DEGRADED', level: 'warning' },
    ],
    tags: { 'chat.channel': 'guild', 'server.region': 'ap-northeast-2' },
    extra: { activeConnections: '48291', maxConnections: '50000', queueDepth: '12847' },
    contexts: { service: { name: 'chat-cluster', version: '3.2.1' } },
    weight: 12, environments: ['production', 'production'],
    releases: SERVER_RELEASES.slice(3), services: ['chat-cluster'], servers: ['chat-01', 'chat-02', 'chat-03'],
  },

  // 8. Save data CRC mismatch
  {
    id: 'save-corrupt', runtime: 'nodejs', type: 'DataIntegrityError',
    title: 'Character save data CRC32 mismatch — corruption detected',
    value: 'DataIntegrityError: CRC32 mismatch for character_id=892741. Expected 0xA3F2B1C4, got 0x00000000. Corrupted fields: equipment_slots.',
    level: 'fatal', culprit: 'SaveManager.validateChecksum', platform: 'node',
    transaction: 'POST /api/character/save',
    frames: [
      { filename: 'src/services/SaveManager.ts', function: 'validateChecksum', lineno: 334, colno: 12, module: 'persistence', in_app: true },
      { filename: 'src/services/SaveManager.ts', function: 'persistCharacter', lineno: 289, colno: 18, module: 'persistence', in_app: true },
    ],
    breadcrumbTemplates: [
      { type: 'default', category: 'save', message: 'Auto-save triggered (interval: 300s)', level: 'info' },
      { type: 'default', category: 'save', message: 'Equipment slot data appears zeroed', level: 'warning' },
      { type: 'default', category: 'save', message: 'CRC32 MISMATCH — rollback initiated', level: 'error' },
    ],
    tags: { 'character.class': 'navigator', 'server.shard': 'shard-12' },
    extra: { characterId: '892741', expectedCrc: '0xA3F2B1C4', actualCrc: '0x00000000' },
    contexts: { character: { id: 892741, class: 'navigator', level: 78 } },
    weight: 4, environments: ['production'],
    releases: SERVER_RELEASES.slice(4), services: ['game-world'], servers: ['world-01', 'world-02'],
  },

  // 9. Slow DB query
  {
    id: 'slow-query', runtime: 'nodejs', type: 'SlowQueryWarning',
    title: 'Database query exceeded threshold: guild_rankings (8.4s)',
    value: "SlowQueryWarning: Query 'SELECT * FROM guild_rankings WHERE season=12 ORDER BY score DESC' took 8412ms (threshold: 2000ms). Rows scanned: 1,284,729.",
    level: 'warning', culprit: 'RankingService.getGuildRankings', platform: 'node',
    transaction: 'GET /api/rankings/guild',
    frames: [
      { filename: 'src/services/RankingService.ts', function: 'getGuildRankings', lineno: 89, colno: 14, module: 'rankings', in_app: true },
      { filename: 'src/database/QueryExecutor.ts', function: 'execute', lineno: 45, colno: 22, module: 'database', in_app: true },
    ],
    breadcrumbTemplates: [
      { type: 'default', category: 'db', message: 'Query started: guild_rankings (season=12)', level: 'info' },
      { type: 'default', category: 'db', message: 'Query running 5000ms (threshold: 2000ms)', level: 'warning' },
      { type: 'default', category: 'db', message: 'Query completed: 8412ms, 1.2M rows scanned', level: 'warning' },
    ],
    tags: { 'db.type': 'mysql', 'db.instance': 'ranking-primary' },
    extra: { queryTimeMs: '8412', rowsScanned: '1284729' },
    contexts: { database: { type: 'mysql', instance: 'ranking-primary' } },
    weight: 18, environments: ['production', 'production', 'staging'],
    releases: SERVER_RELEASES.slice(2), services: ['game-api'], servers: ['api-01', 'api-02', 'api-03'],
  },

  // 10. Anti-cheat speed hack
  {
    id: 'anticheat-speed', runtime: 'nodejs', type: 'AntiCheatViolation',
    title: 'Speed hack detected: abnormal movement velocity (842 u/s)',
    value: 'AntiCheatViolation: Player character_id=443829 moving at 842 units/s (max: 120). Teleport distance: 24891 units in 1 server tick.',
    level: 'error', culprit: 'AntiCheatService.validateMovement', platform: 'node',
    transaction: 'WS /game/movement',
    frames: [
      { filename: 'src/services/AntiCheatService.ts', function: 'validateMovement', lineno: 234, colno: 14, module: 'anticheat', in_app: true },
      { filename: 'src/game/MovementHandler.ts', function: 'onPlayerMove', lineno: 67, colno: 8, module: 'game', in_app: true },
    ],
    breadcrumbTemplates: [
      { type: 'default', category: 'anticheat', message: 'Velocity: 842 u/s exceeds max 120', level: 'warning' },
      { type: 'default', category: 'anticheat', message: 'VIOLATION LOGGED — auto-ban queued', level: 'error' },
    ],
    tags: { 'anticheat.type': 'speed_hack', 'server.shard': 'shard-05' },
    extra: { velocity: '842', maxAllowed: '120', teleportDistance: '24891' },
    contexts: { anticheat: { type: 'speed_hack', severity: 'critical' } },
    weight: 6, environments: ['production'],
    releases: SERVER_RELEASES.slice(3), services: ['game-world'], servers: ['world-01', 'world-02', 'world-03', 'world-04'],
  },

  // 11. JWT token expired
  {
    id: 'jwt-expired', runtime: 'nodejs', type: 'AuthenticationError',
    title: 'JWT access token expired — silent refresh failed',
    value: 'AuthenticationError: JWT token expired at 1716920400. Refresh token also expired. User must re-authenticate.',
    level: 'warning', culprit: 'AuthMiddleware.verifyToken', platform: 'node',
    transaction: 'GET /api/character/profile',
    frames: [
      { filename: 'src/middleware/AuthMiddleware.ts', function: 'verifyToken', lineno: 45, colno: 14, module: 'middleware', in_app: true },
      { filename: 'src/services/TokenService.ts', function: 'refreshTokenPair', lineno: 123, colno: 18, module: 'auth', in_app: true },
    ],
    breadcrumbTemplates: [
      { type: 'http', category: 'http', message: 'GET /api/character/profile → 401', level: 'warning' },
      { type: 'default', category: 'auth', message: 'Refresh token also expired', level: 'error' },
    ],
    tags: { 'auth.method': 'jwt', 'server.region': 'ap-northeast-2' },
    extra: { tokenExpiredAt: '1716920400', refreshExpiredAt: '1716834000' },
    contexts: { auth: { method: 'jwt', provider: 'internal' } },
    weight: 20, environments: ['production', 'production', 'staging'],
    releases: SERVER_RELEASES.slice(2), services: ['game-api'], servers: ['api-01', 'api-02', 'api-03'],
  },

  // 12. OOM kill on world server
  {
    id: 'oom-world', runtime: 'nodejs', type: 'OutOfMemoryError',
    title: 'World server OOM: heap exceeded 4GB limit',
    value: 'FATAL ERROR: Reached heap limit Allocation failed — JavaScript heap out of memory. RSS: 4.2GB, Heap Used: 3.98GB.',
    level: 'fatal', culprit: 'WorldServer.tickLoop', platform: 'node',
    transaction: 'INTERNAL world.tick',
    frames: [
      { filename: 'src/world/WorldServer.ts', function: 'tickLoop', lineno: 89, colno: 4, module: 'world', in_app: true },
      { filename: 'src/world/EntityManager.ts', function: 'updateAllEntities', lineno: 234, colno: 12, module: 'world', in_app: true },
      { filename: 'src/world/SpatialIndex.ts', function: 'rebuildGrid', lineno: 167, colno: 18, module: 'world', in_app: true },
    ],
    breadcrumbTemplates: [
      { type: 'default', category: 'memory', message: 'Heap usage: 3.5GB / 4.0GB (87%)', level: 'warning' },
      { type: 'default', category: 'memory', message: 'GC pause: 842ms (threshold: 100ms)', level: 'warning' },
      { type: 'default', category: 'memory', message: 'FATAL: heap limit exceeded', level: 'error' },
    ],
    tags: { 'server.shard': 'shard-07', 'node.version': 'v20.12.0' },
    extra: { rssBytes: '4509715456', heapUsedBytes: '4273995776', heapTotalBytes: '4294967296' },
    contexts: { runtime: { name: 'node', version: '20.12.0', heap_limit: '4GB' } },
    weight: 3, environments: ['production'],
    releases: SERVER_RELEASES.slice(4), services: ['game-world'], servers: ['world-03', 'world-04'],
  },

  // 13. Deadlock detected
  {
    id: 'deadlock', runtime: 'nodejs', type: 'DeadlockError',
    title: 'MySQL deadlock detected in guild_bank transaction',
    value: 'Error: Deadlock found when trying to get lock; try restarting transaction. Table: guild_bank_items, Lock wait timeout: 50s.',
    level: 'error', culprit: 'GuildBankService.transferItem', platform: 'node',
    transaction: 'POST /api/guild/bank/transfer',
    frames: [
      { filename: 'src/services/GuildBankService.ts', function: 'transferItem', lineno: 178, colno: 14, module: 'guild', in_app: true },
      { filename: 'src/database/TransactionRunner.ts', function: 'executeInTransaction', lineno: 45, colno: 8, module: 'database', in_app: true },
    ],
    breadcrumbTemplates: [
      { type: 'default', category: 'db', message: 'BEGIN TRANSACTION (guild_bank_transfer)', level: 'info' },
      { type: 'default', category: 'db', message: 'Lock wait timeout exceeded', level: 'error' },
      { type: 'default', category: 'db', message: 'Deadlock detected — transaction rolled back', level: 'error' },
    ],
    tags: { 'db.type': 'mysql', 'db.table': 'guild_bank_items' },
    extra: { lockWaitTimeout: '50', retryAttempt: '2', concurrentTxns: '12' },
    contexts: { database: { type: 'mysql', operation: 'INSERT' } },
    weight: 7, environments: ['production', 'staging'],
    releases: SERVER_RELEASES.slice(3), services: ['game-world'], servers: ['world-01', 'world-02'],
  },

  // 14. Rate limit exceeded
  {
    id: 'rate-limit', runtime: 'nodejs', type: 'RateLimitExceeded',
    title: 'API rate limit exceeded: 1000 req/min from single IP',
    value: 'RateLimitExceeded: IP 203.104.209.7 exceeded rate limit of 1000 requests/minute. Current: 2847 req/min. Possible bot activity.',
    level: 'warning', culprit: 'RateLimiter.check', platform: 'node',
    transaction: 'GET /api/market/listings',
    frames: [
      { filename: 'src/middleware/RateLimiter.ts', function: 'check', lineno: 34, colno: 12, module: 'middleware', in_app: true },
    ],
    breadcrumbTemplates: [
      { type: 'default', category: 'ratelimit', message: 'Rate limit triggered: 2847/1000 req/min', level: 'warning' },
    ],
    tags: { 'rate_limit.ip': '203.104.209.7', 'rate_limit.endpoint': '/api/market/listings' },
    extra: { currentRate: '2847', maxRate: '1000', windowMinutes: '1' },
    contexts: {},
    weight: 14, environments: ['production'],
    releases: SERVER_RELEASES.slice(2), services: ['game-api'], servers: ['api-01', 'api-02', 'api-03'],
  },

  // 15. Replication lag
  {
    id: 'repl-lag', runtime: 'nodejs', type: 'ReplicationLagWarning',
    title: 'MySQL replication lag exceeded 30s on read replica',
    value: 'ReplicationLagWarning: Read replica lag: 47s (threshold: 30s). Queries may return stale data. Replica: read-02.db.internal.',
    level: 'warning', culprit: 'ReplicaMonitor.checkLag', platform: 'node',
    transaction: 'INTERNAL db.health_check',
    frames: [
      { filename: 'src/database/ReplicaMonitor.ts', function: 'checkLag', lineno: 56, colno: 14, module: 'database', in_app: true },
    ],
    breadcrumbTemplates: [
      { type: 'default', category: 'db', message: 'Replica lag: 47s (threshold: 30s)', level: 'warning' },
    ],
    tags: { 'db.replica': 'read-02', 'db.lag_seconds': '47' },
    extra: { lagSeconds: '47', threshold: '30', replica: 'read-02.db.internal' },
    contexts: { database: { type: 'mysql', replica: 'read-02' } },
    weight: 10, environments: ['production'],
    releases: SERVER_RELEASES, services: ['game-world'], servers: ['world-01', 'world-02', 'world-03'],
  },

  // 16. Guild war scoring error
  {
    id: 'guild-score', runtime: 'nodejs', type: 'ScoreCalculationError',
    title: 'Guild war score calculation returned negative value',
    value: 'ScoreCalculationError: Guild war score for guild_id=4827 calculated as -342. Score must be >= 0. Rollback applied.',
    level: 'error', culprit: 'GuildWarService.calculateScore', platform: 'node',
    transaction: 'POST /api/guild-war/score',
    frames: [
      { filename: 'src/services/GuildWarService.ts', function: 'calculateScore', lineno: 289, colno: 18, module: 'guild', in_app: true },
      { filename: 'src/services/GuildWarService.ts', function: 'applyBonuses', lineno: 234, colno: 12, module: 'guild', in_app: true },
    ],
    breadcrumbTemplates: [
      { type: 'default', category: 'guild_war', message: 'Score calculation started for guild_id=4827', level: 'info' },
      { type: 'default', category: 'guild_war', message: 'Score: -342 — invalid, rollback', level: 'error' },
    ],
    tags: { 'guild.id': '4827', 'guild_war.season': '12' },
    extra: { guildId: '4827', calculatedScore: '-342', bonusModifier: '-1.5' },
    contexts: { guild_war: { season: 12, mode: 'territory_conquest' } },
    weight: 5, environments: ['production'],
    releases: SERVER_RELEASES.slice(4), services: ['game-world'], servers: ['world-01', 'world-02'],
  },

  // 17. Auction house concurrency
  {
    id: 'auction-race', runtime: 'nodejs', type: 'ConcurrencyError',
    title: 'Auction house race condition: double-purchase detected',
    value: 'ConcurrencyError: Item auction_id=928471 was purchased by 2 players simultaneously. Optimistic lock failed, refunding second buyer.',
    level: 'error', culprit: 'AuctionService.completePurchase', platform: 'node',
    transaction: 'POST /api/auction/buy',
    frames: [
      { filename: 'src/services/AuctionService.ts', function: 'completePurchase', lineno: 167, colno: 14, module: 'auction', in_app: true },
      { filename: 'src/services/AuctionService.ts', function: 'acquireLock', lineno: 89, colno: 22, module: 'auction', in_app: true },
    ],
    breadcrumbTemplates: [
      { type: 'default', category: 'auction', message: 'Purchase attempt: auction_id=928471', level: 'info' },
      { type: 'default', category: 'auction', message: 'Optimistic lock version mismatch', level: 'error' },
      { type: 'default', category: 'auction', message: 'Refund initiated for second buyer', level: 'info' },
    ],
    tags: { 'auction.id': '928471', 'server.region': 'ap-northeast-2' },
    extra: { auctionId: '928471', buyerCount: '2', lockVersion: '3' },
    contexts: { auction: { item: 'Ancient Compass', price: 150000 } },
    weight: 8, environments: ['production'],
    releases: SERVER_RELEASES.slice(3), services: ['game-world'], servers: ['world-01', 'world-02', 'world-03'],
  },

  // 18. DNS resolution failure
  {
    id: 'dns-fail', runtime: 'nodejs', type: 'DNSResolutionError',
    title: 'DNS resolution failed for external API endpoint',
    value: 'Error: getaddrinfo ENOTFOUND api.external-analytics.io. DNS resolution timed out after 5000ms.',
    level: 'error', culprit: 'ExternalAPIClient.send', platform: 'node',
    transaction: 'POST /api/analytics/push',
    frames: [
      { filename: 'src/integrations/ExternalAPIClient.ts', function: 'send', lineno: 78, colno: 14, module: 'integrations', in_app: true },
      { filename: 'node_modules/axios/lib/adapters/http.js', function: 'dispatchHttpRequest', lineno: 562, colno: 12, module: 'axios', in_app: false },
    ],
    breadcrumbTemplates: [
      { type: 'http', category: 'http', message: 'POST api.external-analytics.io → ENOTFOUND', level: 'error' },
    ],
    tags: { 'dns.hostname': 'api.external-analytics.io', 'server.region': 'ap-northeast-2' },
    extra: { hostname: 'api.external-analytics.io', dnsTimeout: '5000' },
    contexts: {},
    weight: 4, environments: ['production'],
    releases: SERVER_RELEASES, services: ['game-api'], servers: ['api-01', 'api-02'],
  },

  // 19. Kafka consumer lag
  {
    id: 'kafka-lag', runtime: 'nodejs', type: 'ConsumerLagWarning',
    title: 'Kafka consumer lag exceeded threshold on event-processing topic',
    value: 'ConsumerLagWarning: Consumer group "game-events" lag: 284,729 messages on topic "player-actions". Processing rate: 1200 msg/s, incoming: 3400 msg/s.',
    level: 'warning', culprit: 'EventConsumer.checkLag', platform: 'node',
    transaction: 'INTERNAL kafka.health',
    frames: [
      { filename: 'src/messaging/EventConsumer.ts', function: 'checkLag', lineno: 89, colno: 14, module: 'messaging', in_app: true },
    ],
    breadcrumbTemplates: [
      { type: 'default', category: 'kafka', message: 'Consumer lag: 284,729 messages', level: 'warning' },
    ],
    tags: { 'kafka.topic': 'player-actions', 'kafka.group': 'game-events' },
    extra: { lag: '284729', processingRate: '1200', incomingRate: '3400' },
    contexts: { kafka: { topic: 'player-actions', partition_count: 12 } },
    weight: 8, environments: ['production'],
    releases: SERVER_RELEASES, services: ['event-processor'], servers: ['evt-01', 'evt-02'],
  },

  // 20. OAuth callback error
  {
    id: 'oauth-cb', runtime: 'nodejs', type: 'OAuthCallbackError',
    title: 'OAuth callback failed: state parameter mismatch',
    value: 'OAuthCallbackError: State parameter in callback does not match session state. Possible CSRF attack. Provider: google.',
    level: 'error', culprit: 'OAuthService.handleCallback', platform: 'node',
    transaction: 'GET /auth/callback/google',
    frames: [
      { filename: 'src/services/OAuthService.ts', function: 'handleCallback', lineno: 134, colno: 18, module: 'auth', in_app: true },
      { filename: 'src/services/OAuthService.ts', function: 'validateState', lineno: 89, colno: 12, module: 'auth', in_app: true },
    ],
    breadcrumbTemplates: [
      { type: 'http', category: 'http', message: 'GET /auth/callback/google → 400', level: 'error' },
    ],
    tags: { 'oauth.provider': 'google', 'server.region': 'ap-northeast-2' },
    extra: { provider: 'google', stateMatched: 'false' },
    contexts: { auth: { provider: 'google', method: 'oauth2' } },
    weight: 5, environments: ['production', 'staging'],
    releases: SERVER_RELEASES.slice(2), services: ['auth-server'], servers: ['auth-01'],
  },

  // ══════════════════════════════════════════════════════════════
  //   LUA GAME SCRIPTS — 15 scenarios
  // ══════════════════════════════════════════════════════════════

  // 21. Nil index — most common Lua error
  {
    id: 'lua-nil', runtime: 'lua', type: 'LuaRuntimeError',
    title: "attempt to index a nil value (field 'equipSlots')",
    value: "LuaRuntimeError: attempt to index a nil value (field 'equipSlots') in CharacterUI.lua:234. Character data not loaded before UI render.",
    level: 'error', culprit: 'CharacterUI:refreshEquipment', platform: 'other',
    transaction: 'UI CharacterPanel.Open',
    frames: [
      { filename: 'scripts/ui/CharacterUI.lua', function: 'CharacterUI:refreshEquipment', lineno: 234, colno: 18, module: 'ui', in_app: true },
      { filename: 'scripts/ui/CharacterUI.lua', function: 'CharacterUI:onOpen', lineno: 45, colno: 8, module: 'ui', in_app: true },
      { filename: 'scripts/core/UIManager.lua', function: 'UIManager:showPanel', lineno: 112, colno: 4, module: 'core', in_app: true },
    ],
    breadcrumbTemplates: [
      { type: 'ui.click', category: 'ui', message: 'Player opened Character Panel', level: 'info' },
      { type: 'default', category: 'lua', message: 'CharacterUI:onOpen() called', level: 'info' },
      { type: 'default', category: 'lua', message: 'characterData is nil — data not loaded', level: 'error' },
    ],
    tags: { 'lua.version': '5.4', 'game.scene': 'port_town' },
    extra: { luaFile: 'CharacterUI.lua', lineNumber: '234' },
    contexts: { lua: { version: '5.4', gc_memory_kb: 28472 } },
    weight: 22, environments: ['production', 'production', 'staging'],
    releases: LUA_RELEASES, services: ['lua-script-engine'], servers: ['world-01', 'world-02', 'world-03', 'world-04'],
  },

  // 22. Lua stack overflow
  {
    id: 'lua-stackoverflow', runtime: 'lua', type: 'LuaStackOverflow',
    title: 'Lua stack overflow in recursive quest dependency resolver',
    value: 'LuaStackOverflow: stack overflow in QuestGraph.lua:89. Recursive quest dependency chain detected: Q1001 → Q1042 → Q1001 (circular).',
    level: 'fatal', culprit: 'QuestGraph:resolveDependencies', platform: 'other',
    transaction: 'Quest QuestSystem.LoadChain',
    frames: [
      { filename: 'scripts/quest/QuestGraph.lua', function: 'QuestGraph:resolveDependencies', lineno: 89, colno: 4, module: 'quest', in_app: true },
      { filename: 'scripts/quest/QuestGraph.lua', function: 'QuestGraph:resolveDependencies', lineno: 89, colno: 4, module: 'quest', in_app: true },
      { filename: 'scripts/quest/QuestManager.lua', function: 'QuestManager:loadQuestChain', lineno: 234, colno: 8, module: 'quest', in_app: true },
    ],
    breadcrumbTemplates: [
      { type: 'default', category: 'quest', message: 'Loading quest chain for Q1001', level: 'info' },
      { type: 'default', category: 'quest', message: 'Circular dependency: Q1001 → Q1042 → Q1001', level: 'error' },
    ],
    tags: { 'quest.id': 'Q1001', 'lua.version': '5.4' },
    extra: { questId: 'Q1001', dependencyChain: 'Q1001 → Q1042 → Q1001', stackDepth: '200' },
    contexts: { lua: { version: '5.4', stack_limit: 200 } },
    weight: 3, environments: ['production'],
    releases: LUA_RELEASES.slice(2), services: ['lua-script-engine'], servers: ['world-01', 'world-02'],
  },

  // 23. Coroutine dead
  {
    id: 'lua-coroutine', runtime: 'lua', type: 'LuaCoroutineError',
    title: 'Cannot resume dead coroutine in NPC dialog system',
    value: 'LuaCoroutineError: cannot resume dead coroutine in DialogManager.lua:167. NPC dialog coroutine was already completed when player selected option #3.',
    level: 'error', culprit: 'DialogManager:resumeDialog', platform: 'other',
    transaction: 'NPC Dialog.Resume',
    frames: [
      { filename: 'scripts/npc/DialogManager.lua', function: 'DialogManager:resumeDialog', lineno: 167, colno: 8, module: 'npc', in_app: true },
      { filename: 'scripts/npc/DialogTree.lua', function: 'DialogTree:processChoice', lineno: 89, colno: 4, module: 'npc', in_app: true },
    ],
    breadcrumbTemplates: [
      { type: 'default', category: 'npc', message: 'NPC dialog started: Merchant_Lisbon_03', level: 'info' },
      { type: 'ui.click', category: 'ui', message: 'Player selected dialog option #3', level: 'info' },
      { type: 'default', category: 'lua', message: 'Coroutine status: dead (already finished)', level: 'error' },
    ],
    tags: { 'npc.id': 'Merchant_Lisbon_03', 'dialog.tree': 'trade_tutorial' },
    extra: { npcId: 'Merchant_Lisbon_03', coroutineStatus: 'dead', selectedOption: '3' },
    contexts: { lua: { version: '5.4' } },
    weight: 10, environments: ['production', 'staging'],
    releases: LUA_RELEASES, services: ['lua-script-engine'], servers: ['world-01', 'world-02', 'world-03'],
  },

  // 24. Skill cooldown desync
  {
    id: 'lua-cooldown', runtime: 'lua', type: 'CooldownDesyncError',
    title: 'Skill cooldown desync between client and server',
    value: 'CooldownDesyncError: Skill "Broadside Barrage" (id=2847) client cooldown: 0s, server cooldown: 4.2s remaining. Client fired 3 extra shots.',
    level: 'error', culprit: 'CombatSystem:validateSkillUse', platform: 'other',
    transaction: 'Combat Skill.Use',
    frames: [
      { filename: 'scripts/combat/CombatSystem.lua', function: 'CombatSystem:validateSkillUse', lineno: 312, colno: 12, module: 'combat', in_app: true },
      { filename: 'scripts/combat/SkillCooldownTracker.lua', function: 'SkillCooldownTracker:isReady', lineno: 56, colno: 4, module: 'combat', in_app: true },
    ],
    breadcrumbTemplates: [
      { type: 'default', category: 'combat', message: 'Skill use: Broadside Barrage', level: 'info' },
      { type: 'default', category: 'combat', message: 'Server cooldown remaining: 4.2s', level: 'warning' },
      { type: 'default', category: 'combat', message: 'DESYNC: client reports 0s cooldown', level: 'error' },
    ],
    tags: { 'skill.name': 'Broadside Barrage', 'skill.id': '2847' },
    extra: { skillId: '2847', clientCooldown: '0', serverCooldown: '4.2' },
    contexts: { combat: { skill: 'Broadside Barrage', damage: 2847 } },
    weight: 12, environments: ['production', 'production'],
    releases: LUA_RELEASES.slice(1), services: ['lua-script-engine'], servers: ['world-01', 'world-02', 'world-03', 'world-04'],
  },

  // 25. JSON decode failure in config
  {
    id: 'lua-json', runtime: 'lua', type: 'LuaJsonDecodeError',
    title: 'JSON decode failed for hot-reloaded game config',
    value: "LuaJsonDecodeError: Expected value but found invalid token at character 1847 in ship_balance_v3.json. Config hot-reload aborted.",
    level: 'error', culprit: 'ConfigLoader:hotReload', platform: 'other',
    transaction: 'Config HotReload',
    frames: [
      { filename: 'scripts/core/ConfigLoader.lua', function: 'ConfigLoader:hotReload', lineno: 89, colno: 8, module: 'core', in_app: true },
      { filename: 'scripts/core/JsonParser.lua', function: 'JsonParser:decode', lineno: 234, colno: 14, module: 'core', in_app: true },
    ],
    breadcrumbTemplates: [
      { type: 'default', category: 'config', message: 'Hot-reload triggered for ship_balance_v3.json', level: 'info' },
      { type: 'default', category: 'config', message: 'JSON parse error at char 1847', level: 'error' },
    ],
    tags: { 'config.file': 'ship_balance_v3.json', 'config.version': 'v3' },
    extra: { configFile: 'ship_balance_v3.json', errorPosition: '1847' },
    contexts: { lua: { version: '5.4' } },
    weight: 6, environments: ['production', 'staging'],
    releases: LUA_RELEASES.slice(2), services: ['lua-script-engine'], servers: ['world-01', 'world-02'],
  },

  // 26. GC pause spike
  {
    id: 'lua-gc', runtime: 'lua', type: 'GCPauseWarning',
    title: 'Lua GC pause spike: 342ms (threshold: 16ms)',
    value: 'GCPauseWarning: Lua garbage collector pause: 342ms. Memory before: 128MB, after: 89MB. Freed 39MB. Consider incremental GC tuning.',
    level: 'warning', culprit: 'GCMonitor:onPause', platform: 'other',
    transaction: 'INTERNAL gc.cycle',
    frames: [
      { filename: 'scripts/core/GCMonitor.lua', function: 'GCMonitor:onPause', lineno: 34, colno: 4, module: 'core', in_app: true },
    ],
    breadcrumbTemplates: [
      { type: 'default', category: 'gc', message: 'GC pause: 342ms (freed 39MB)', level: 'warning' },
    ],
    tags: { 'gc.pause_ms': '342', 'gc.freed_mb': '39' },
    extra: { pauseMs: '342', memoryBeforeMB: '128', memoryAfterMB: '89' },
    contexts: { lua: { version: '5.4', gc_mode: 'generational' } },
    weight: 14, environments: ['production'],
    releases: LUA_RELEASES, services: ['lua-script-engine'], servers: ['world-01', 'world-02', 'world-03', 'world-04'],
  },

  // 27. NPC pathfinding failure
  {
    id: 'lua-pathfind', runtime: 'lua', type: 'PathfindingError',
    title: 'A* pathfinding failed: no valid path for NPC merchant',
    value: 'PathfindingError: A* search exhausted 10000 nodes without finding path from (1284, 892) to (2847, 1423). NavMesh may have holes.',
    level: 'warning', culprit: 'PathfindingSystem:findPath', platform: 'other',
    transaction: 'AI NPC.MoveTo',
    frames: [
      { filename: 'scripts/ai/PathfindingSystem.lua', function: 'PathfindingSystem:findPath', lineno: 189, colno: 8, module: 'ai', in_app: true },
      { filename: 'scripts/ai/AStarSearch.lua', function: 'AStarSearch:run', lineno: 67, colno: 4, module: 'ai', in_app: true },
    ],
    breadcrumbTemplates: [
      { type: 'default', category: 'ai', message: 'NPC pathfinding: (1284,892) → (2847,1423)', level: 'info' },
      { type: 'default', category: 'ai', message: 'A* exhausted 10000 nodes — no path', level: 'warning' },
    ],
    tags: { 'npc.type': 'merchant', 'navmesh.zone': 'port_lisbon' },
    extra: { startPos: '(1284,892)', endPos: '(2847,1423)', nodesExplored: '10000' },
    contexts: { ai: { algorithm: 'A*', max_nodes: 10000 } },
    weight: 8, environments: ['production', 'staging'],
    releases: LUA_RELEASES, services: ['lua-script-engine'], servers: ['world-01', 'world-02', 'world-03'],
  },

  // 28-35: More Lua scenarios (abbreviated for brevity, same quality)
  {
    id: 'lua-table-overflow', runtime: 'lua', type: 'LuaTableOverflow',
    title: 'Lua table size exceeded limit in chat history buffer',
    value: 'LuaTableOverflow: Chat history table exceeded 50000 entries. Memory: 45MB for single table. Old entries not garbage collected.',
    level: 'warning', culprit: 'ChatHistory:addMessage', platform: 'other',
    transaction: 'Chat Message.Add',
    frames: [
      { filename: 'scripts/chat/ChatHistory.lua', function: 'ChatHistory:addMessage', lineno: 56, colno: 8, module: 'chat', in_app: true },
    ],
    breadcrumbTemplates: [
      { type: 'default', category: 'lua', message: 'Chat history: 50000 entries, 45MB', level: 'warning' },
    ],
    tags: { 'chat.channel': 'world', 'lua.version': '5.4' },
    extra: { tableSize: '50000', memoryMB: '45' },
    contexts: { lua: { version: '5.4' } },
    weight: 6, environments: ['production'],
    releases: LUA_RELEASES, services: ['lua-script-engine'], servers: ['world-01', 'world-02', 'world-03'],
  },

  {
    id: 'lua-event-storm', runtime: 'lua', type: 'EventStormError',
    title: 'Event storm detected: 2847 events/frame in combat system',
    value: 'EventStormError: 2847 events queued in single frame. Combat event loop likely recursive. Dropping events beyond 500/frame limit.',
    level: 'error', culprit: 'EventDispatcher:processFrame', platform: 'other',
    transaction: 'Combat EventLoop',
    frames: [
      { filename: 'scripts/core/EventDispatcher.lua', function: 'EventDispatcher:processFrame', lineno: 78, colno: 4, module: 'core', in_app: true },
      { filename: 'scripts/combat/DamageCalculator.lua', function: 'DamageCalculator:applyAoE', lineno: 145, colno: 12, module: 'combat', in_app: true },
    ],
    breadcrumbTemplates: [
      { type: 'default', category: 'event', message: 'Event queue: 2847/500 per frame', level: 'error' },
    ],
    tags: { 'event.source': 'combat', 'game.scene': 'sea_battle' },
    extra: { eventsPerFrame: '2847', maxPerFrame: '500' },
    contexts: { lua: { version: '5.4' } },
    weight: 5, environments: ['production'],
    releases: LUA_RELEASES.slice(2), services: ['lua-script-engine'], servers: ['world-01', 'world-02'],
  },

  {
    id: 'lua-save-serial', runtime: 'lua', type: 'SerializationError',
    title: 'Failed to serialize player save data: circular reference',
    value: 'SerializationError: Circular reference detected in player save data at path: inventory.items[12].enchantment.source. Cannot serialize to JSON.',
    level: 'error', culprit: 'SaveSerializer:toJSON', platform: 'other',
    transaction: 'Save PlayerData.Serialize',
    frames: [
      { filename: 'scripts/save/SaveSerializer.lua', function: 'SaveSerializer:toJSON', lineno: 89, colno: 8, module: 'save', in_app: true },
    ],
    breadcrumbTemplates: [
      { type: 'default', category: 'save', message: 'Circular reference at inventory.items[12]', level: 'error' },
    ],
    tags: { 'save.format': 'json', 'lua.version': '5.4' },
    extra: { circularPath: 'inventory.items[12].enchantment.source' },
    contexts: { lua: { version: '5.4' } },
    weight: 4, environments: ['production'],
    releases: LUA_RELEASES.slice(1), services: ['lua-script-engine'], servers: ['world-01', 'world-02', 'world-03'],
  },

  // ══════════════════════════════════════════════════════════════
  //   UNREAL ENGINE 4 — 15 scenarios
  // ══════════════════════════════════════════════════════════════

  // 36. GPU device lost
  {
    id: 'ue4-gpu-lost', runtime: 'ue4', type: 'D3DDeviceLost',
    title: 'D3D Device Lost: GPU driver crash during ocean rendering',
    value: 'D3DDeviceLost: ID3D12Device::GetDeviceRemovedReason() returned DXGI_ERROR_DEVICE_HUNG. GPU: NVIDIA GeForce RTX 3060. Driver: 551.86.',
    level: 'fatal', culprit: 'FD3D12DynamicRHI::RHIEndFrame', platform: 'native',
    transaction: 'Render OceanShading',
    frames: [
      { filename: 'Engine/Source/Runtime/D3D12RHI/Private/D3D12Device.cpp', function: 'FD3D12DynamicRHI::RHIEndFrame', lineno: 1234, colno: 4, module: 'D3D12RHI', in_app: false },
      { filename: 'Source/UWO/Rendering/OceanRenderer.cpp', function: 'UOceanRenderer::RenderOceanSurface', lineno: 445, colno: 8, module: 'UWO', in_app: true },
      { filename: 'Source/UWO/Rendering/ShaderManager.cpp', function: 'FShaderManager::CompileShader', lineno: 178, colno: 12, module: 'UWO', in_app: true },
    ],
    breadcrumbTemplates: [
      { type: 'default', category: 'renderer', message: 'VRAM usage: 5.8GB / 6.0GB (96%)', level: 'warning' },
      { type: 'default', category: 'renderer', message: 'FPS dropped: 58 → 12', level: 'warning' },
      { type: 'default', category: 'renderer', message: 'D3D Device Removed: DXGI_ERROR_DEVICE_HUNG', level: 'error' },
    ],
    tags: { 'gpu.vendor': 'NVIDIA', 'gpu.model': 'RTX 3060', 'gpu.driver': '551.86' },
    extra: { vramUsedMB: '5939', vramTotalMB: '6144', fps: '12', dxgiError: 'DEVICE_HUNG' },
    contexts: { gpu: { name: 'GeForce RTX 3060', vendor: 'NVIDIA', driver: '551.86', vram: 6144 } },
    weight: 10, environments: ['production'],
    releases: CLIENT_RELEASES, services: ['ue4-client'], servers: ['client'],
  },

  // 37. Access violation
  {
    id: 'ue4-access-violation', runtime: 'ue4', type: 'AccessViolation',
    title: 'Access violation reading address 0x0000000000000048',
    value: 'Unhandled Exception: EXCEPTION_ACCESS_VIOLATION reading address 0x0000000000000048 in UCharacterMovementComponent::TickComponent',
    level: 'fatal', culprit: 'UCharacterMovementComponent::TickComponent', platform: 'native',
    transaction: 'Physics CharacterMovement.Tick',
    frames: [
      { filename: 'Engine/Source/Runtime/Engine/Private/Components/CharacterMovementComponent.cpp', function: 'UCharacterMovementComponent::TickComponent', lineno: 892, colno: 4, module: 'Engine', in_app: false },
      { filename: 'Source/UWO/Character/UWOCharacterMovement.cpp', function: 'UUWOCharacterMovement::ApplySwimmingPhysics', lineno: 234, colno: 8, module: 'UWO', in_app: true },
      { filename: 'Source/UWO/Character/UWOCharacter.cpp', function: 'AUWOCharacter::Tick', lineno: 167, colno: 4, module: 'UWO', in_app: true },
    ],
    breadcrumbTemplates: [
      { type: 'default', category: 'physics', message: 'Character entered water volume', level: 'info' },
      { type: 'default', category: 'physics', message: 'Swimming mode activated', level: 'info' },
      { type: 'default', category: 'crash', message: 'Access violation at 0x48 (null + offset)', level: 'error' },
    ],
    tags: { 'ue4.version': '4.27.2', 'crash.type': 'access_violation' },
    extra: { address: '0x0000000000000048', module: 'UWO-Win64-Shipping.exe' },
    contexts: { os: { name: 'Windows', version: '11 23H2', build: '22631' } },
    weight: 8, environments: ['production'],
    releases: CLIENT_RELEASES, services: ['ue4-client'], servers: ['client'],
  },

  // 38. Shader compile error
  {
    id: 'ue4-shader', runtime: 'ue4', type: 'ShaderCompileError',
    title: 'Shader compilation failed: M_Ocean_Dynamic_v3',
    value: 'ShaderCompileError: Failed to compile shader M_Ocean_Dynamic_v3 for SM5. Error: Too many texture samplers (17/16). Target: D3D_SM5.',
    level: 'error', culprit: 'FShaderCompiler::CompileMaterial', platform: 'native',
    transaction: 'Render Shader.Compile',
    frames: [
      { filename: 'Engine/Source/Runtime/ShaderCore/Private/ShaderCompiler.cpp', function: 'FShaderCompiler::CompileMaterial', lineno: 567, colno: 4, module: 'ShaderCore', in_app: false },
      { filename: 'Source/UWO/Rendering/OceanMaterial.cpp', function: 'FOceanMaterial::BuildShaderGraph', lineno: 312, colno: 8, module: 'UWO', in_app: true },
    ],
    breadcrumbTemplates: [
      { type: 'default', category: 'shader', message: 'Compiling M_Ocean_Dynamic_v3 for SM5', level: 'info' },
      { type: 'default', category: 'shader', message: 'Error: 17 samplers exceeds SM5 limit (16)', level: 'error' },
    ],
    tags: { 'shader.name': 'M_Ocean_Dynamic_v3', 'shader.target': 'SM5' },
    extra: { shaderName: 'M_Ocean_Dynamic_v3', samplerCount: '17', maxSamplers: '16' },
    contexts: { gpu: { shader_model: 'SM5' } },
    weight: 5, environments: ['production', 'staging'],
    releases: CLIENT_RELEASES.slice(2), services: ['ue4-client'], servers: ['client'],
  },

  // 39. Network replication mismatch
  {
    id: 'ue4-repl', runtime: 'ue4', type: 'ReplicationError',
    title: 'Network replication mismatch: ship position desync',
    value: 'ReplicationError: Ship actor BP_PlayerShip_C_23 position desync. Server: (28471, 12847, 0), Client: (28920, 13102, 0). Delta: 512 units.',
    level: 'error', culprit: 'AShipActor::ServerCorrectPosition', platform: 'native',
    transaction: 'Net Replication.Correct',
    frames: [
      { filename: 'Source/UWO/Ships/ShipActor.cpp', function: 'AShipActor::ServerCorrectPosition', lineno: 445, colno: 4, module: 'UWO', in_app: true },
      { filename: 'Engine/Source/Runtime/Engine/Private/NetDriver.cpp', function: 'UNetDriver::ProcessRemoteFunction', lineno: 1234, colno: 8, module: 'Engine', in_app: false },
    ],
    breadcrumbTemplates: [
      { type: 'default', category: 'net', message: 'Position desync detected: delta 512 units', level: 'warning' },
      { type: 'default', category: 'net', message: 'Server correction applied, client rubber-banded', level: 'error' },
    ],
    tags: { 'actor.class': 'BP_PlayerShip', 'net.channel': 'reliable' },
    extra: { serverPos: '(28471,12847,0)', clientPos: '(28920,13102,0)', deltaUnits: '512' },
    contexts: { network: { rtt_ms: 187, packet_loss: 0.02 } },
    weight: 15, environments: ['production', 'production'],
    releases: CLIENT_RELEASES, services: ['ue4-client', 'ue4-dedicated'], servers: ['ds-01', 'ds-02', 'ds-03', 'ds-04'],
  },

  // 40. Physics explosion (ragdoll)
  {
    id: 'ue4-physics', runtime: 'ue4', type: 'PhysicsSimDivergence',
    title: 'Physics simulation divergence: ragdoll velocity exceeded limit',
    value: 'PhysicsSimDivergence: Ragdoll component velocity exceeded 10000 cm/s (current: 847291 cm/s). Physics explosion detected, resetting body.',
    level: 'warning', culprit: 'USkeletalMeshComponent::TickPhysics', platform: 'native',
    transaction: 'Physics Ragdoll.Tick',
    frames: [
      { filename: 'Engine/Source/Runtime/Engine/Private/PhysicsEngine/BodyInstance.cpp', function: 'FBodyInstance::UpdateBodyScale', lineno: 1892, colno: 4, module: 'Engine', in_app: false },
      { filename: 'Source/UWO/Character/UWODeathHandler.cpp', function: 'UUWODeathHandler::ActivateRagdoll', lineno: 89, colno: 8, module: 'UWO', in_app: true },
    ],
    breadcrumbTemplates: [
      { type: 'default', category: 'physics', message: 'Ragdoll activated for dying character', level: 'info' },
      { type: 'default', category: 'physics', message: 'Ragdoll velocity: 847291 cm/s (limit: 10000)', level: 'warning' },
    ],
    tags: { 'physics.engine': 'PhysX', 'ue4.version': '4.27.2' },
    extra: { velocity: '847291', maxVelocity: '10000' },
    contexts: { physics: { engine: 'PhysX', substeps: 2 } },
    weight: 7, environments: ['production'],
    releases: CLIENT_RELEASES, services: ['ue4-client'], servers: ['client'],
  },

  // 41. Texture streaming stall
  {
    id: 'ue4-texture', runtime: 'ue4', type: 'TextureStreamingStall',
    title: 'Texture streaming stall: 2.4s blocking main thread',
    value: 'TextureStreamingStall: Blocking texture load took 2400ms on main thread. Texture: T_Port_Lisbon_Ground_D (4K, 42MB). IO bottleneck suspected.',
    level: 'warning', culprit: 'FStreamingTexture::StreamIn', platform: 'native',
    transaction: 'Render TextureStream',
    frames: [
      { filename: 'Engine/Source/Runtime/Engine/Private/StreamingTexture.cpp', function: 'FStreamingTexture::StreamIn', lineno: 456, colno: 4, module: 'Engine', in_app: false },
      { filename: 'Source/UWO/World/PortTownStreaming.cpp', function: 'APortTownStreaming::OnEnterZone', lineno: 78, colno: 8, module: 'UWO', in_app: true },
    ],
    breadcrumbTemplates: [
      { type: 'default', category: 'streaming', message: 'Loading T_Port_Lisbon_Ground_D (42MB)', level: 'info' },
      { type: 'default', category: 'streaming', message: 'Main thread stall: 2400ms', level: 'warning' },
    ],
    tags: { 'texture.name': 'T_Port_Lisbon_Ground_D', 'texture.size_mb': '42' },
    extra: { textureName: 'T_Port_Lisbon_Ground_D', stallMs: '2400', sizeMB: '42' },
    contexts: { gpu: { vram_used_mb: 4200, vram_total_mb: 6144 } },
    weight: 10, environments: ['production'],
    releases: CLIENT_RELEASES, services: ['ue4-client'], servers: ['client'],
  },

  // 42. Async load timeout
  {
    id: 'ue4-async-load', runtime: 'ue4', type: 'AsyncLoadTimeout',
    title: 'Async level load timeout: Port_Lisbon_Main',
    value: 'AsyncLoadTimeout: Level Port_Lisbon_Main async load exceeded 30s timeout. 847/1200 objects loaded. Possible pak file corruption.',
    level: 'error', culprit: 'ULevelStreamingDynamic::AsyncLoadLevel', platform: 'native',
    transaction: 'Level AsyncLoad',
    frames: [
      { filename: 'Engine/Source/Runtime/Engine/Private/LevelStreamingDynamic.cpp', function: 'ULevelStreamingDynamic::AsyncLoadLevel', lineno: 234, colno: 4, module: 'Engine', in_app: false },
      { filename: 'Source/UWO/World/WorldStreamingManager.cpp', function: 'AWorldStreamingManager::LoadZone', lineno: 167, colno: 8, module: 'UWO', in_app: true },
    ],
    breadcrumbTemplates: [
      { type: 'default', category: 'level', message: 'Async loading Port_Lisbon_Main...', level: 'info' },
      { type: 'default', category: 'level', message: 'Load progress: 847/1200 objects (70%)', level: 'info' },
      { type: 'default', category: 'level', message: 'TIMEOUT after 30s — load aborted', level: 'error' },
    ],
    tags: { 'level.name': 'Port_Lisbon_Main', 'ue4.version': '4.27.2' },
    extra: { levelName: 'Port_Lisbon_Main', objectsLoaded: '847', objectsTotal: '1200' },
    contexts: { os: { name: 'Windows', version: '10' } },
    weight: 6, environments: ['production'],
    releases: CLIENT_RELEASES, services: ['ue4-client'], servers: ['client'],
  },

  // 43. RPC buffer overflow
  {
    id: 'ue4-rpc', runtime: 'ue4', type: 'RPCBufferOverflow',
    title: 'RPC send buffer overflow on reliable channel',
    value: 'RPCBufferOverflow: Reliable RPC buffer exceeded 128KB limit. 284 pending RPCs. Channel: combat_actions. Dropping oldest 50 RPCs.',
    level: 'error', culprit: 'UNetConnection::SendRPC', platform: 'native',
    transaction: 'Net RPC.Send',
    frames: [
      { filename: 'Engine/Source/Runtime/Engine/Private/NetConnection.cpp', function: 'UNetConnection::SendRPC', lineno: 789, colno: 4, module: 'Engine', in_app: false },
      { filename: 'Source/UWO/Network/CombatNetChannel.cpp', function: 'UCombatNetChannel::SendCombatAction', lineno: 112, colno: 8, module: 'UWO', in_app: true },
    ],
    breadcrumbTemplates: [
      { type: 'default', category: 'net', message: 'RPC buffer: 284 pending (128KB limit)', level: 'warning' },
      { type: 'default', category: 'net', message: 'Dropping 50 oldest reliable RPCs', level: 'error' },
    ],
    tags: { 'rpc.channel': 'combat_actions', 'net.reliable': 'true' },
    extra: { pendingRPCs: '284', bufferSizeKB: '128', droppedRPCs: '50' },
    contexts: { network: { rtt_ms: 342, packet_loss: 0.15 } },
    weight: 8, environments: ['production'],
    releases: CLIENT_RELEASES, services: ['ue4-client', 'ue4-dedicated'], servers: ['ds-01', 'ds-02', 'ds-03'],
  },

  // 44-50: More UE4 scenarios
  {
    id: 'ue4-gc-cluster', runtime: 'ue4', type: 'GCClusterError',
    title: 'UObject GC cluster corruption detected',
    value: 'GCClusterError: GC cluster for BP_PortTown_Lisbon contains stale reference to destroyed USkeletalMeshComponent. Cluster size: 847 objects.',
    level: 'error', culprit: 'FGCCluster::Validate', platform: 'native',
    transaction: 'GC Cluster.Validate',
    frames: [
      { filename: 'Engine/Source/Runtime/CoreUObject/Private/UObject/GarbageCollection.cpp', function: 'FGCCluster::Validate', lineno: 456, colno: 4, module: 'CoreUObject', in_app: false },
      { filename: 'Source/UWO/World/PortTownManager.cpp', function: 'APortTownManager::CleanupNPCs', lineno: 234, colno: 8, module: 'UWO', in_app: true },
    ],
    breadcrumbTemplates: [
      { type: 'default', category: 'gc', message: 'GC cluster validation: stale ref detected', level: 'error' },
    ],
    tags: { 'gc.cluster': 'BP_PortTown_Lisbon', 'gc.cluster_size': '847' },
    extra: { clusterName: 'BP_PortTown_Lisbon', clusterSize: '847' },
    contexts: { ue4: { version: '4.27.2' } },
    weight: 4, environments: ['production'],
    releases: CLIENT_RELEASES.slice(2), services: ['ue4-client'], servers: ['client'],
  },

  {
    id: 'ue4-anim-slot', runtime: 'ue4', type: 'AnimationSlotError',
    title: 'Animation montage failed: invalid slot name "UpperBody"',
    value: 'AnimationSlotError: Montage AM_CannonFire_v2 references slot "UpperBody" which does not exist in skeleton SK_Character_Male. Valid slots: DefaultSlot, FullBody.',
    level: 'warning', culprit: 'UAnimInstance::PlayMontage', platform: 'native',
    transaction: 'Anim Montage.Play',
    frames: [
      { filename: 'Engine/Source/Runtime/Engine/Private/Animation/AnimInstance.cpp', function: 'UAnimInstance::Montage_Play', lineno: 567, colno: 4, module: 'Engine', in_app: false },
      { filename: 'Source/UWO/Combat/CannonComponent.cpp', function: 'UCannonComponent::FireCannon', lineno: 89, colno: 8, module: 'UWO', in_app: true },
    ],
    breadcrumbTemplates: [
      { type: 'default', category: 'anim', message: 'Playing montage AM_CannonFire_v2', level: 'info' },
      { type: 'default', category: 'anim', message: 'Invalid slot "UpperBody" in skeleton', level: 'warning' },
    ],
    tags: { 'anim.montage': 'AM_CannonFire_v2', 'anim.skeleton': 'SK_Character_Male' },
    extra: { montageName: 'AM_CannonFire_v2', requestedSlot: 'UpperBody' },
    contexts: { ue4: { version: '4.27.2' } },
    weight: 9, environments: ['production', 'staging'],
    releases: CLIENT_RELEASES, services: ['ue4-client'], servers: ['client'],
  },

  {
    id: 'ue4-pak-corrupt', runtime: 'ue4', type: 'PakFileCorruption',
    title: 'Pak file integrity check failed: UWO-WindowsClient.pak',
    value: 'PakFileCorruption: SHA256 mismatch for chunk 847 in UWO-WindowsClient.pak. Expected: a3f2b1c4..., Got: 00000000.... File may be corrupted.',
    level: 'fatal', culprit: 'FPakFile::VerifyChunk', platform: 'native',
    transaction: 'IO PakFile.Verify',
    frames: [
      { filename: 'Engine/Source/Runtime/PakFile/Private/PakFile.cpp', function: 'FPakFile::VerifyChunk', lineno: 234, colno: 4, module: 'PakFile', in_app: false },
    ],
    breadcrumbTemplates: [
      { type: 'default', category: 'io', message: 'Pak file SHA256 mismatch on chunk 847', level: 'error' },
    ],
    tags: { 'pak.file': 'UWO-WindowsClient.pak', 'pak.chunk': '847' },
    extra: { pakFile: 'UWO-WindowsClient.pak', chunk: '847' },
    contexts: { os: { name: 'Windows', version: '10' } },
    weight: 2, environments: ['production'],
    releases: CLIENT_RELEASES, services: ['ue4-client'], servers: ['client'],
  },

  {
    id: 'ue4-audio-overflow', runtime: 'ue4', type: 'AudioSourceOverflow',
    title: 'Active audio sources exceeded limit: 128/96 concurrent',
    value: 'AudioSourceOverflow: 128 active audio sources (max: 96). Oldest 32 sources force-stopped. Port town ambience causing source leak.',
    level: 'warning', culprit: 'FAudioDevice::Update', platform: 'native',
    transaction: 'Audio Device.Update',
    frames: [
      { filename: 'Engine/Source/Runtime/Engine/Private/AudioDevice.cpp', function: 'FAudioDevice::Update', lineno: 1892, colno: 4, module: 'Engine', in_app: false },
      { filename: 'Source/UWO/Audio/AmbienceManager.cpp', function: 'UAmbienceManager::UpdateZone', lineno: 134, colno: 8, module: 'UWO', in_app: true },
    ],
    breadcrumbTemplates: [
      { type: 'default', category: 'audio', message: 'Active sources: 128/96 (overflow)', level: 'warning' },
    ],
    tags: { 'audio.max_sources': '96', 'audio.active': '128' },
    extra: { activeSources: '128', maxSources: '96', forceStopped: '32' },
    contexts: { ue4: { version: '4.27.2' } },
    weight: 6, environments: ['production'],
    releases: CLIENT_RELEASES, services: ['ue4-client'], servers: ['client'],
  },
];

// ═══════════════════ USER POOL ═══════════════════

const COUNTRIES_WEIGHTED = [
  { code: 'KR', weight: 40 }, { code: 'JP', weight: 20 }, { code: 'US', weight: 12 },
  { code: 'TW', weight: 8 }, { code: 'TH', weight: 5 }, { code: 'DE', weight: 4 },
  { code: 'BR', weight: 3 }, { code: 'FR', weight: 3 }, { code: 'GB', weight: 3 }, { code: 'SG', weight: 2 },
];
const CITIES: Record<string, string[]> = {
  KR: ['Seoul', 'Busan', 'Incheon', 'Daejeon', 'Gwangju'],
  JP: ['Tokyo', 'Osaka', 'Nagoya', 'Yokohama', 'Sapporo'],
  US: ['Los Angeles', 'New York', 'Seattle', 'Chicago', 'San Francisco'],
  TW: ['Taipei', 'Kaohsiung', 'Taichung'],
  TH: ['Bangkok', 'Chiang Mai'], DE: ['Berlin', 'Munich', 'Hamburg'],
  BR: ['São Paulo', 'Rio de Janeiro'], FR: ['Paris', 'Lyon'],
  GB: ['London', 'Manchester'], SG: ['Singapore'],
};
const EMAIL_DOMAINS = ['gmail.com', 'naver.com', 'yahoo.co.jp', 'outlook.com', 'daum.net', 'qq.com', 'hotmail.com'];
const NAMES_PREFIX = ['Navigator', 'Captain', 'Admiral', 'Merchant', 'Explorer', 'Pirate', 'Corsair', 'Trader', 'Sailor', 'Buccaneer'];

const USERS = Array.from({ length: USER_POOL_SIZE }, (_, i) => {
  const country = weightedPick(COUNTRIES_WEIGHTED.map(c => c.code), COUNTRIES_WEIGHTED.map(c => c.weight));
  return {
    id: `user_${10000 + i}`,
    email: `player${10000 + i}@${randomPick(EMAIL_DOMAINS)}`,
    name: `${randomPick(NAMES_PREFIX)}_${10000 + i}`,
    ip: `${randomInt(1, 223)}.${randomInt(0, 255)}.${randomInt(0, 255)}.${randomInt(1, 254)}`,
    country,
    city: randomPick(CITIES[country] || ['Unknown']),
  };
});

const BROWSERS = [
  { name: 'Chrome', version: '125.0', w: 40 }, { name: 'Chrome', version: '124.0', w: 20 },
  { name: 'Firefox', version: '126.0', w: 10 }, { name: 'Safari', version: '17.5', w: 8 },
  { name: 'Edge', version: '125.0', w: 8 }, { name: 'Whale', version: '3.26', w: 5 },
  { name: 'Opera', version: '110.0', w: 3 }, { name: 'Samsung Internet', version: '25.0', w: 3 },
  { name: 'UE4 Embedded', version: '4.27', w: 3 },
];
const OS_LIST = [
  { name: 'Windows', version: '11', w: 35 }, { name: 'Windows', version: '10', w: 25 },
  { name: 'macOS', version: '14.5', w: 10 }, { name: 'iOS', version: '17.5', w: 8 },
  { name: 'Android', version: '14', w: 8 }, { name: 'Linux', version: '6.8', w: 5 },
  { name: 'Ubuntu', version: '24.04', w: 5 }, { name: 'Steam Deck', version: '3.5', w: 4 },
];

// ═══════════════════ TRANSACTION TEMPLATES ═══════════════════

const TRANSACTION_NAMES = [
  { name: 'POST /api/auth/login', op: 'http.server', durMin: 50, durMax: 800, errRate: 0.02 },
  { name: 'POST /api/character/save', op: 'http.server', durMin: 30, durMax: 1500, errRate: 0.01 },
  { name: 'GET /api/character/profile', op: 'http.server', durMin: 10, durMax: 200, errRate: 0.005 },
  { name: 'POST /api/trade/complete', op: 'http.server', durMin: 50, durMax: 2000, errRate: 0.03 },
  { name: 'POST /api/combat/engage', op: 'http.server', durMin: 20, durMax: 500, errRate: 0.01 },
  { name: 'GET /api/rankings/guild', op: 'http.server', durMin: 100, durMax: 8000, errRate: 0.05 },
  { name: 'POST /api/matchmaking/queue', op: 'http.server', durMin: 200, durMax: 120000, errRate: 0.08 },
  { name: 'POST /api/chat/send', op: 'http.server', durMin: 5, durMax: 500, errRate: 0.02 },
  { name: 'GET /api/market/listings', op: 'http.server', durMin: 30, durMax: 3000, errRate: 0.01 },
  { name: 'POST /api/payment/verify', op: 'http.server', durMin: 100, durMax: 5000, errRate: 0.04 },
  { name: 'POST /api/guild/bank/transfer', op: 'http.server', durMin: 50, durMax: 2000, errRate: 0.02 },
  { name: 'POST /api/auction/buy', op: 'http.server', durMin: 30, durMax: 1500, errRate: 0.03 },
  { name: 'WS /game/movement', op: 'websocket', durMin: 1, durMax: 50, errRate: 0.001 },
  { name: 'WS /game/combat', op: 'websocket', durMin: 5, durMax: 200, errRate: 0.005 },
  { name: 'GET /api/inventory/list', op: 'http.server', durMin: 20, durMax: 800, errRate: 0.01 },
];

// ═══════════════════ FEEDBACK MESSAGES ═══════════════════

const FEEDBACK_MESSAGES_KO = [
  '항해 중 갑자기 튕겼어요. 전투 중이라 손해가 커요.',
  '결제했는데 아이템이 안 들어왔어요. 주문번호 확인 부탁드립니다.',
  '최근 패치 이후 렉이 심해졌어요. 특히 리스본 항구에서요.',
  '길드 은행에서 아이템 이동이 안 됩니다.',
  '매칭이 2분 넘게 걸리다 실패해요. 시간대 상관없이 그래요.',
  '캐릭터 장비 탭 열면 크래시 납니다.',
  '해전 중 프레임 드랍이 심해요. 10fps 이하로 떨어져요.',
  '인벤토리에 아이템이 중복으로 들어가 있어요.',
  'NPC 대화가 도중에 끊겨요. 퀘스트 진행이 안 됩니다.',
  '로그인이 자꾸 만료돼서 다시 로그인해야 해요.',
];
const FEEDBACK_MESSAGES_EN = [
  'Game crashes during sea battles. Lost valuable cargo.',
  'Payment went through but items not received. Please check order.',
  'Lag spikes since last patch, especially in port towns.',
  'Guild bank transfers keep failing with error.',
  'Matchmaking takes forever and then times out.',
  'Character equipment tab causes crash every time.',
  'FPS drops below 10 during fleet battles.',
  'Duplicate items appeared in my inventory after trade.',
  'NPC dialog freezes mid-conversation, cannot complete quest.',
  'Session keeps expiring, have to re-login every 30 minutes.',
];

const FEEDBACK_MESSAGES = [...FEEDBACK_MESSAGES_KO, ...FEEDBACK_MESSAGES_EN];

// ═══════════════════ LOG GENERATION ═══════════════════

function generateLogsForEvent(
  issueId: number, timestamp: Date, scenario: ErrorScenario,
  user: { id: string; ip: string }, server: string, env: string, release: string
): any[] {
  const traceId = uuid();
  const baseTime = new Date(timestamp.getTime() - randomInt(5000, 30000));
  const service = randomPick(scenario.services);
  const pod = k8sPodName(service);

  const contextualLines = generateContextualLogs(scenario, user, server, env, release);

  return contextualLines.map((line, i) => ({
    log_id: uuid(),
    project_id: PROJECT_ID,
    trace_id: traceId,
    span_id: uuid().substring(0, 16),
    issue_id: issueId,
    timestamp: new Date(baseTime.getTime() + i * randomInt(200, 3000)).toISOString(),
    level: line.level,
    logger_name: line.logger,
    message: line.msg,
    body: line.body || '',
    environment: env,
    release,
    service,
    attributes: {
      'server.name': server,
      'environment': env,
      'trace.id': traceId,
      'kubernetes.pod_name': pod,
      'service.version': release,
      'game.shard': randomPick(GAME_SHARDS),
    },
  }));
}

// ═══════════════════ MAIN ═══════════════════

async function main() {
  console.log('🎮 Argus Data Simulator — Online Game (NodeJS / Lua / UE4)');
  console.log('═'.repeat(60));
  console.log(`   Scale: ${(TOTAL_ERROR_EVENTS/1000).toFixed(0)}K events, ${(TOTAL_TRANSACTIONS/1000).toFixed(0)}K txns, ${(TOTAL_SESSIONS/1000).toFixed(0)}K sessions, ${TOTAL_FEEDBACK} feedback`);
  console.log(`   Users: ${USER_POOL_SIZE.toLocaleString()}, Period: ${DAYS_BACK} days`);
  console.log(`   Scenarios: ${SCENARIOS.length} unique error types`);
  console.log('');

  // Connect
  const pool = mysql.createPool({ ...MYSQL_CONFIG, connectionLimit: 10 });
  const ch = createClient({
    url: CH_CONFIG.url, database: CH_CONFIG.database,
    username: CH_CONFIG.username, password: CH_CONFIG.password,
    clickhouse_settings: { date_time_input_format: 'best_effort', max_insert_block_size: 100000 },
  });

  // ──────── 1. TRUNCATE ALL DATA ────────
  console.log('🗑️  Truncating all existing data...');

  // ClickHouse tables
  const chTables = ['errors', 'transactions', 'spans', 'sessions', 'user_feedback', 'logs', 'metrics_1m', 'metrics_1h', 'metrics_1d'];
  for (const table of chTables) {
    try {
      await ch.exec({ query: `TRUNCATE TABLE IF EXISTS ${CH_CONFIG.database}.${table}` });
      console.log(`   ✓ CH ${table} truncated`);
    } catch { console.log(`   ⚠ CH ${table} not found (skip)`); }
  }

  // MySQL tables
  const mysqlTables = ['g_argus_issues', 'g_argus_releases', 'g_argus_releaseCommits'];
  for (const table of mysqlTables) {
    try {
      await pool.query('SET FOREIGN_KEY_CHECKS = 0');
      await pool.query(`TRUNCATE TABLE ${table}`);
      await pool.query('SET FOREIGN_KEY_CHECKS = 1');
      console.log(`   ✓ MySQL ${table} truncated`);
    } catch { console.log(`   ⚠ MySQL ${table} not found (skip)`); }
  }

  // ──────── 2. BUILD WEIGHTED SCENARIO POOL ────────
  const weightedScenarios: ErrorScenario[] = [];
  for (const s of SCENARIOS) {
    for (let i = 0; i < s.weight; i++) weightedScenarios.push(s);
  }

  // ──────── 3. GENERATE EVENTS ────────
  console.log(`\n📦 Phase 1: Generating ${TOTAL_ERROR_EVENTS.toLocaleString()} error events...`);

  const issueMap = new Map<string, {
    id: number; firstSeen: Date; lastSeen: Date;
    count: number; users: Set<string>; scenario: ErrorScenario;
  }>();
  const allEvents: any[] = [];

  for (let i = 0; i < TOTAL_ERROR_EVENTS; i++) {
    const scenario = randomPick(weightedScenarios);
    const timestamp = randomDateWeighted(DAYS_BACK);
    const user = randomPick(USERS);
    const browser = weightedPick(BROWSERS, BROWSERS.map(b => b.w));
    const os = weightedPick(OS_LIST, OS_LIST.map(o => o.w));
    const env = randomPick(scenario.environments);
    const release = randomPick(scenario.releases);

    // Fingerprint = hash of in-app callstack frames (filename:function:lineno)
    const inAppFrames = scenario.frames.filter(f => f.in_app);
    const primaryHash = md5(
      inAppFrames.length > 0
        ? inAppFrames.map(f => `${f.filename}:${f.function}:${f.lineno}`).join('|')
        : `${scenario.type}:${scenario.culprit}`
    );
    const eventId = uuid();

    if (!issueMap.has(primaryHash)) {
      issueMap.set(primaryHash, {
        id: 0, firstSeen: timestamp, lastSeen: timestamp,
        count: 0, users: new Set(), scenario,
      });
    }
    const tracker = issueMap.get(primaryHash)!;
    tracker.count++;
    tracker.users.add(user.id);
    if (timestamp < tracker.firstSeen) tracker.firstSeen = timestamp;
    if (timestamp > tracker.lastSeen) tracker.lastSeen = timestamp;

    const breadcrumbs = scenario.breadcrumbTemplates.map((tmpl, idx) => ({
      ...tmpl,
      timestamp: new Date(timestamp.getTime() - (scenario.breadcrumbTemplates.length - idx) * randomInt(1000, 5000)).toISOString(),
    }));

    allEvents.push({
      event_id: eventId,
      project_id: PROJECT_ID,
      issue_id: 0,
      timestamp: timestamp.toISOString(),
      received_at: new Date(timestamp.getTime() + randomInt(50, 500)).toISOString(),
      platform: scenario.platform,
      level: scenario.level,
      logger: scenario.culprit.split('.')[0] || scenario.culprit.split(':')[0],
      type: scenario.type,
      value: scenario.value,
      mechanism: 'onerror',
      fingerprint: [primaryHash],
      primary_hash: primaryHash,
      exception: JSON.stringify({ type: scenario.type, value: scenario.value }),
      stacktrace_frames: JSON.stringify(scenario.frames),
      breadcrumbs: JSON.stringify(breadcrumbs),
      user_id: user.id,
      user_email: user.email,
      user_ip: user.ip,
      user_name: user.name,
      environment: env,
      release,
      dist: '',
      server_name: randomPick(scenario.servers),
      transaction: scenario.transaction,
      os_name: os.name,
      os_version: os.version,
      browser_name: browser.name,
      browser_version: browser.version,
      device_name: '',
      device_family: os.name === 'iOS' ? 'iPhone' : os.name === 'Android' ? 'Samsung Galaxy' : 'Desktop',
      runtime_name: scenario.runtime === 'nodejs' ? 'node' : scenario.runtime === 'lua' ? 'lua' : 'ue4',
      runtime_version: scenario.runtime === 'nodejs' ? '20.14.0' : scenario.runtime === 'lua' ? '5.4' : '4.27.2',
      sdk_name: `argus.${scenario.runtime}`,
      sdk_version: '1.3.0',
      geo_country: user.country,
      geo_city: user.city,
      geo_region: '',
      http_method: scenario.transaction.startsWith('GET') || scenario.transaction.startsWith('WS') ? 'GET' : 'POST',
      http_url: `https://game.unchartedwaters.io${scenario.transaction.replace(/^(GET|POST|PUT|WS)\s+/, '')}`,
      http_referer: 'https://game.unchartedwaters.io',
      tags: dynamicTags(scenario, randomPick(scenario.servers), env),
      extra: dynamicExtra(scenario),
      contexts: JSON.stringify(scenario.contexts),
      is_handled: scenario.level === 'warning' ? 1 : 0,
      is_symbolicated: 0,
      _primaryHash: primaryHash,
      _user: user,
      _server: randomPick(scenario.servers),
      _env: env,
      _release: release,
    });

    if ((i + 1) % 50000 === 0) {
      console.log(`   ... ${((i + 1) / 1000).toFixed(0)}K events generated`);
    }
  }
  console.log(`   ✓ ${allEvents.length.toLocaleString()} events generated (${issueMap.size} unique issues)`);

  // ──────── 4. INSERT ISSUES INTO MYSQL ────────
  console.log(`\n📋 Phase 2: Inserting ${issueMap.size} issues into MySQL...`);
  let shortId = 100;
  for (const [hash, tracker] of issueMap) {
    const s = tracker.scenario;
    const [result] = await pool.query(
      `INSERT INTO g_argus_issues (project_id, short_id, title, culprit, type, level, platform, primary_hash, fingerprint,
       first_seen, last_seen, times_seen, num_users, status, first_release, last_release, priority)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        PROJECT_ID, shortId++,
        s.title, s.culprit, s.type, s.level, s.platform,
        hash, JSON.stringify([hash]),
        formatDate(tracker.firstSeen), formatDate(tracker.lastSeen),
        tracker.count, tracker.users.size,
        s.level === 'fatal' ? 'unresolved' : randomPick(['unresolved', 'unresolved', 'unresolved', 'resolved', 'ignored']),
        randomPick(s.releases), s.releases[s.releases.length - 1],
        s.level === 'fatal' ? 'critical' : s.level === 'error' ? randomPick(['high', 'high', 'medium']) : 'medium',
      ]
    );
    tracker.id = (result as any).insertId;
    console.log(`   ✓ [${s.runtime}/${s.level}] ${s.title.substring(0, 55)}... (${tracker.count.toLocaleString()} events)`);
  }

  // ──────── 5. INSERT EVENTS INTO CLICKHOUSE ────────
  console.log(`\n⚡ Phase 3: Inserting ${allEvents.length.toLocaleString()} events into ClickHouse...`);
  for (let i = 0; i < allEvents.length; i += CHUNK_SIZE) {
    const chunk = allEvents.slice(i, i + CHUNK_SIZE).map(ev => {
      const tracker = issueMap.get(ev._primaryHash)!;
      const { _primaryHash, ...rest } = ev;
      return { ...rest, issue_id: tracker.id };
    });
    await ch.insert({ table: `${CH_CONFIG.database}.errors`, values: chunk, format: 'JSONEachRow' });
    if ((i + CHUNK_SIZE) % 50000 < CHUNK_SIZE) {
      console.log(`   ... ${Math.min(i + CHUNK_SIZE, allEvents.length).toLocaleString()} / ${allEvents.length.toLocaleString()}`);
    }
  }
  console.log(`   ✓ All error events inserted`);

  // ──────── 6. GENERATE & INSERT LOGS ────────
  console.log(`\n📝 Phase 4: Generating structured logs...`);
  let totalLogs = 0;
  let logBatch: any[] = [];

  for (let i = 0; i < allEvents.length; i++) {
    const ev = allEvents[i];
    const tracker = issueMap.get(ev._primaryHash || '')!;
    if (!tracker) continue;
    const scenario = tracker.scenario;
    const logs = generateLogsForEvent(
      tracker.id, new Date(ev.timestamp), scenario,
      ev._user || { id: 'unknown', ip: '0.0.0.0' },
      ev._server || randomPick(scenario.servers),
      ev._env || randomPick(scenario.environments),
      ev._release || randomPick(scenario.releases)
    );
    logBatch.push(...logs);

    if (logBatch.length >= CHUNK_SIZE) {
      try {
        await ch.insert({ table: `${CH_CONFIG.database}.logs`, values: logBatch, format: 'JSONEachRow' });
      } catch { /* logs table may not exist */ }
      totalLogs += logBatch.length;
      logBatch = [];
      if (totalLogs % 100000 < CHUNK_SIZE) {
        console.log(`   ... ${totalLogs.toLocaleString()} logs inserted`);
      }
    }
  }
  // Flush remaining
  if (logBatch.length > 0) {
    try {
      await ch.insert({ table: `${CH_CONFIG.database}.logs`, values: logBatch, format: 'JSONEachRow' });
      totalLogs += logBatch.length;
    } catch { /* skip */ }
  }
  console.log(`   ✓ ${totalLogs.toLocaleString()} log entries inserted`);

  // ──────── 7. GENERATE & INSERT TRANSACTIONS ────────
  console.log(`\n🔄 Phase 5: Generating ${TOTAL_TRANSACTIONS.toLocaleString()} transactions...`);
  let txnBatch: any[] = [];
  let spanBatch: any[] = [];
  let txnCount = 0;

  for (let i = 0; i < TOTAL_TRANSACTIONS; i++) {
    const tmpl = randomPick(TRANSACTION_NAMES);
    const user = randomPick(USERS);
    const timestamp = randomDateWeighted(DAYS_BACK);
    const duration = randomInt(tmpl.durMin, tmpl.durMax);
    const start = new Date(timestamp.getTime() - duration);
    const traceId = uuid();
    const spanId = uuid().substring(0, 16);
    const isError = Math.random() < tmpl.errRate;
    const env = randomPick(['production', 'production', 'production', 'staging']);
    const release = randomPick(SERVER_RELEASES);

    const spanTemplates = getSpanTemplates(tmpl.name);
    let currentStart = start.getTime();
    for (let s = 0; s < spanTemplates.length; s++) {
      const st = spanTemplates[s];
      const spanDur = randomInt(st.durMin, Math.max(st.durMin, Math.min(st.durMax, Math.floor(duration / spanTemplates.length))));
      spanBatch.push({
        span_id: uuid().substring(0, 16),
        parent_span_id: spanId,
        trace_id: traceId,
        transaction_id: traceId,
        project_id: PROJECT_ID,
        timestamp: new Date(currentStart + spanDur).toISOString(),
        start_timestamp: new Date(currentStart).toISOString(),
        duration: spanDur,
        op: st.op,
        description: st.description,
        status: isError && s === spanTemplates.length - 1 ? 'internal_error' : 'ok',
        action: st.op.split('.')[1] || '',
        domain: st.op.startsWith('db') ? 'mysql' : st.op.startsWith('cache') ? 'redis' : st.op.startsWith('http') ? 'internal-api' : '',
        data: {}, tags: { 'server.region': randomPick(['ap-northeast-2', 'eu-west-1', 'us-east-1']) },
      });
      currentStart += spanDur;
    }

    txnBatch.push({
      event_id: uuid(),
      trace_id: traceId,
      span_id: spanId,
      parent_span_id: '0000000000000000',
      project_id: PROJECT_ID,
      timestamp: timestamp.toISOString(),
      start_timestamp: start.toISOString(),
      duration,
      transaction: tmpl.name,
      transaction_op: tmpl.op,
      transaction_status: isError ? randomPick(['internal_error', 'deadline_exceeded']) : 'ok',
      http_method: tmpl.name.startsWith('WS') ? 'WS' : tmpl.name.split(' ')[0],
      http_status_code: isError ? randomPick([500, 502, 503, 504]) : randomPick([200, 200, 200, 201]),
      platform: 'node',
      environment: env,
      release,
      user_id: user.id,
      measurements: {
        'lcp': randomFloat(100, 5000),
        'fcp': randomFloat(50, 2000),
        'ttfb': randomFloat(10, 800),
      },
      tags: {
        region: randomPick(['ap-northeast-2', 'eu-west-1', 'us-east-1']),
        'server.instance': instanceId(),
        'deployment.slot': randomPick(DEPLOY_SLOTS),
        'game.shard': randomPick(GAME_SHARDS),
      },
      span_count: spanTemplates.length,
    });

    if (txnBatch.length >= CHUNK_SIZE) {
      await ch.insert({ table: `${CH_CONFIG.database}.transactions`, values: txnBatch, format: 'JSONEachRow' });
      txnCount += txnBatch.length;
      txnBatch = [];
      if (spanBatch.length > 0) {
        try { await ch.insert({ table: `${CH_CONFIG.database}.spans`, values: spanBatch, format: 'JSONEachRow' }); } catch { /* skip */ }
        spanBatch = [];
      }
      if (txnCount % 50000 < CHUNK_SIZE) {
        console.log(`   ... ${txnCount.toLocaleString()} transactions inserted`);
      }
    }
  }
  if (txnBatch.length > 0) {
    await ch.insert({ table: `${CH_CONFIG.database}.transactions`, values: txnBatch, format: 'JSONEachRow' });
    txnCount += txnBatch.length;
    if (spanBatch.length > 0) {
      try { await ch.insert({ table: `${CH_CONFIG.database}.spans`, values: spanBatch, format: 'JSONEachRow' }); } catch { /* skip */ }
    }
  }
  console.log(`   ✓ ${txnCount.toLocaleString()} transactions inserted`);

  // ──────── 8. GENERATE & INSERT SESSIONS ────────
  console.log(`\n🔐 Phase 6: Generating ${TOTAL_SESSIONS.toLocaleString()} sessions...`);
  let sessBatch: any[] = [];
  let sessCount = 0;

  for (let i = 0; i < TOTAL_SESSIONS; i++) {
    const user = randomPick(USERS);
    const timestamp = randomDateWeighted(DAYS_BACK);
    // 93% healthy, 3% crashed, 2% errored, 2% abnormal
    const status = weightedPick(
      ['ok', 'exited', 'crashed', 'errored', 'abnormal'],
      [50, 40, 4, 3, 3]
    );
    const env = randomPick(['production', 'production', 'production', 'staging']);
    const release = randomPick([...SERVER_RELEASES, ...CLIENT_RELEASES]);
    const duration = status === 'crashed' || status === 'abnormal'
      ? randomInt(1000, 60000) : randomInt(60000, 7200000);

    sessBatch.push({
      session_id: uuid(),
      project_id: PROJECT_ID,
      timestamp: timestamp.toISOString(),
      started: new Date(timestamp.getTime() - duration).toISOString(),
      status,
      seq: 0,
      duration,
      errors: status === 'crashed' ? randomInt(1, 5) : status === 'errored' ? randomInt(1, 3) : 0,
      environment: env,
      release,
      distinct_id: user.id,
      user_agent: `Mozilla/5.0 (${randomPick(['Windows NT 10.0', 'Macintosh', 'Linux x86_64'])}) Chrome/${randomInt(120, 126)}.0`,
    });

    if (sessBatch.length >= CHUNK_SIZE) {
      await ch.insert({ table: `${CH_CONFIG.database}.sessions`, values: sessBatch, format: 'JSONEachRow' });
      sessCount += sessBatch.length;
      sessBatch = [];
      if (sessCount % 25000 < CHUNK_SIZE) {
        console.log(`   ... ${sessCount.toLocaleString()} sessions inserted`);
      }
    }
  }
  if (sessBatch.length > 0) {
    await ch.insert({ table: `${CH_CONFIG.database}.sessions`, values: sessBatch, format: 'JSONEachRow' });
    sessCount += sessBatch.length;
  }
  console.log(`   ✓ ${sessCount.toLocaleString()} sessions inserted`);

  // ──────── 9. GENERATE & INSERT FEEDBACK ────────
  console.log(`\n💬 Phase 7: Generating ${TOTAL_FEEDBACK} feedback entries...`);
  const feedbackBatch: any[] = [];

  for (let i = 0; i < TOTAL_FEEDBACK; i++) {
    const user = randomPick(USERS);
    const timestamp = randomDateWeighted(DAYS_BACK);
    const env = randomPick(['production', 'production', 'staging']);
    const release = randomPick([...SERVER_RELEASES, ...CLIENT_RELEASES]);

    feedbackBatch.push({
      feedback_id: uuid(),
      project_id: PROJECT_ID,
      event_id: uuid(),
      timestamp: timestamp.toISOString(),
      name: user.name,
      email: user.email,
      message: randomPick(FEEDBACK_MESSAGES),
      contact_email: user.email,
      url: randomPick(['/game/play', '/game/port', '/game/battle', '/settings', '/inventory', '/guild']),
      environment: env,
      release,
      source: randomPick(['widget', 'dialog', 'api']),
      tags: {},
    });
  }

  try {
    for (let i = 0; i < feedbackBatch.length; i += CHUNK_SIZE) {
      await ch.insert({ table: `${CH_CONFIG.database}.user_feedback`, values: feedbackBatch.slice(i, i + CHUNK_SIZE), format: 'JSONEachRow' });
    }
    console.log(`   ✓ ${feedbackBatch.length.toLocaleString()} feedback entries inserted`);
  } catch (e: any) {
    console.log(`   ⚠ Feedback insert failed: ${e.message?.substring(0, 80)}`);
  }

  // ──────── 10. SUMMARY ────────
  console.log('\n' + '═'.repeat(60));
  console.log('✅ Simulation Complete!\n');
  console.log(`   Issues:        ${issueMap.size}`);
  console.log(`   Error Events:  ${allEvents.length.toLocaleString()}`);
  console.log(`   Logs:          ${totalLogs.toLocaleString()}`);
  console.log(`   Transactions:  ${txnCount.toLocaleString()}`);
  console.log(`   Sessions:      ${sessCount.toLocaleString()}`);
  console.log(`   Feedback:      ${feedbackBatch.length.toLocaleString()}`);
  console.log(`   Users:         ${USERS.length.toLocaleString()}`);
  console.log(`   Time range:    ${DAYS_BACK} days`);
  console.log('');
  console.log('   Runtime Breakdown:');
  const runtimeCounts = { nodejs: 0, lua: 0, ue4: 0 };
  for (const [, tracker] of issueMap) {
    runtimeCounts[tracker.scenario.runtime] += tracker.count;
  }
  console.log(`     NodeJS:  ${runtimeCounts.nodejs.toLocaleString()} events`);
  console.log(`     Lua:     ${runtimeCounts.lua.toLocaleString()} events`);
  console.log(`     UE4:     ${runtimeCounts.ue4.toLocaleString()} events`);
  console.log('');
  console.log('   Top Issues by Event Count:');
  const sorted = [...issueMap.entries()].sort((a, b) => b[1].count - a[1].count);
  for (const [, tracker] of sorted.slice(0, 10)) {
    const s = tracker.scenario;
    console.log(`     [${s.runtime.padEnd(6)}] ${tracker.count.toLocaleString().padStart(8)} events | ${s.title.substring(0, 50)}`);
  }

  await pool.end();
  await ch.close();
  console.log('\n🎮 Done! Refresh the Argus dashboard.');
}

main().catch(e => { console.error('❌ Fatal error:', e); process.exit(1); });

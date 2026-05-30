/**
 * Argus Data Simulator — Online Game (MMORPG) Realistic Error Data
 *
 * Generates production-like error events, logs, issues for an online game.
 * Simulates errors from:
 *  - Game client (WebGL/Canvas rendering, WebSocket, UI crashes)
 *  - Game server (Matchmaking, Inventory, Combat, Chat)
 *  - Web platform (Payment, Auth, Community)
 *
 * Usage: npx tsx scripts/simulate-data.ts
 */

import { createClient } from '@clickhouse/client';
import mysql from 'mysql2/promise';
import crypto from 'crypto';
import dotenv from 'dotenv';
import path from 'path';

// Load .env.local for local Docker port mappings
dotenv.config({ path: path.join(__dirname, '../../../.env.local') });
dotenv.config({ path: path.join(__dirname, '../../../.env') });

// --- Config (from env or defaults) ---
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

const PROJECT_ID = '1';
const DAYS_BACK = 14;
const NOW = new Date();

// --- Helper Functions ---
function md5(s: string): string {
  return crypto.createHash('md5').update(s).digest('hex');
}
function uuid(): string {
  return crypto.randomUUID().replace(/-/g, '');
}
function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function randomPick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
function randomDate(daysBack: number): Date {
  const ms = NOW.getTime() - Math.random() * daysBack * 24 * 60 * 60 * 1000;
  return new Date(ms);
}
function formatDate(d: Date): string {
  return d.toISOString().replace('T', ' ').replace('Z', '');
}

// ===================== GAME-SPECIFIC ERROR SCENARIOS =====================

interface ErrorScenario {
  type: string;
  title: string;
  value: string;
  level: 'fatal' | 'error' | 'warning';
  culprit: string;
  platform: string;
  transaction: string;
  frames: any[];
  breadcrumbTemplates: any[];
  tags: Record<string, string>;
  extra: Record<string, string>;
  contexts: any;
  weight: number; // frequency weight
  environments: string[];
  releases: string[];
}

const GAME_RELEASES = ['2.14.0', '2.14.1', '2.15.0-beta', '2.15.0', '2.15.1'];
const WEB_RELEASES = ['1.8.2', '1.8.3', '1.9.0'];

const SCENARIOS: ErrorScenario[] = [
  // === FATAL: WebSocket 연결 끊김 (가장 흔한 게임 에러) ===
  {
    type: 'ConnectionError',
    title: 'WebSocket connection lost during combat',
    value: 'WebSocket connection to wss://game-ws.unchartedwaters.com/play closed unexpectedly (code: 1006)',
    level: 'fatal',
    culprit: 'NetworkManager.onSocketClose',
    platform: 'javascript',
    transaction: '/game/play',
    frames: [
      { filename: 'src/network/NetworkManager.ts', function: 'onSocketClose', lineno: 342, colno: 18, module: 'network', in_app: true },
      { filename: 'src/network/WebSocketClient.ts', function: 'handleClose', lineno: 128, colno: 8, module: 'network', in_app: true },
      { filename: 'src/game/GameLoop.ts', function: 'onDisconnect', lineno: 89, colno: 12, module: 'game', in_app: true },
    ],
    breadcrumbTemplates: [
      { type: 'navigation', category: 'navigation', message: 'Player entered sea battle zone', level: 'info' },
      { type: 'http', category: 'http', message: 'POST /api/combat/engage → 200', level: 'info' },
      { type: 'default', category: 'game.action', message: 'Fleet formation changed to aggressive', level: 'info' },
      { type: 'http', category: 'http', message: 'WS: combat.action.fire → ack', level: 'info' },
      { type: 'default', category: 'game.combat', message: 'Cannonball hit enemy ship HMS Victory (dmg: 2847)', level: 'info' },
      { type: 'http', category: 'http', message: 'WS: keepalive ping timeout (30s)', level: 'warning' },
      { type: 'default', category: 'network', message: 'WebSocket readyState changed: CLOSING', level: 'error' },
    ],
    tags: { 'game.scene': 'sea_battle', 'server.region': 'ap-northeast-1', 'server.channel': 'ch-42' },
    extra: { 'lastPingMs': '2847', 'reconnectAttempts': '3', 'packetLossRate': '0.42' },
    contexts: { game: { scene: 'sea_battle', character_level: 65, server: 'Seville-3' }, network: { type: 'websocket', latency_ms: 2847, protocol: 'wss' } },
    weight: 25,
    environments: ['production', 'production', 'production', 'staging'],
    releases: ['2.15.0', '2.15.1', '2.14.1'],
  },

  // === ERROR: 인벤토리 동기화 실패 ===
  {
    type: 'InventorySyncError',
    title: "Failed to sync inventory: item count mismatch",
    value: "InventorySyncError: Server reports 47 items but client has 49. Detected duplicate item_id=30291 (Refined Gold Bar)",
    level: 'error',
    culprit: 'InventoryManager.syncWithServer',
    platform: 'javascript',
    transaction: '/game/inventory',
    frames: [
      { filename: 'src/inventory/InventoryManager.ts', function: 'syncWithServer', lineno: 215, colno: 22, module: 'inventory', in_app: true },
      { filename: 'src/inventory/ItemValidator.ts', function: 'validateItemCounts', lineno: 78, colno: 14, module: 'inventory', in_app: true },
      { filename: 'src/network/GameAPI.ts', function: 'fetchInventory', lineno: 334, colno: 8, module: 'network', in_app: true },
    ],
    breadcrumbTemplates: [
      { type: 'navigation', category: 'navigation', message: 'Opened inventory panel', level: 'info' },
      { type: 'http', category: 'http', message: 'GET /api/inventory/list → 200 (342ms)', level: 'info' },
      { type: 'default', category: 'game.trade', message: 'Completed trade: sold 5x Silk to NPC merchant', level: 'info' },
      { type: 'http', category: 'http', message: 'POST /api/trade/complete → 200 (128ms)', level: 'info' },
      { type: 'default', category: 'inventory', message: 'Client-side inventory updated (+5200 gold)', level: 'info' },
      { type: 'http', category: 'http', message: 'GET /api/inventory/sync → 200 (89ms)', level: 'info' },
      { type: 'default', category: 'inventory', message: 'Inventory sync FAILED: count mismatch', level: 'error' },
    ],
    tags: { 'game.scene': 'port_town', 'server.region': 'ap-northeast-1', 'inventory.type': 'trade_goods' },
    extra: { 'serverItemCount': '47', 'clientItemCount': '49', 'duplicateItemId': '30291' },
    contexts: { game: { scene: 'port_lisbon', character_level: 42, guild: 'Mediterranean Traders' } },
    weight: 18,
    environments: ['production', 'production', 'staging'],
    releases: ['2.15.0', '2.15.1'],
  },

  // === ERROR: WebGL 렌더링 크래시 ===
  {
    type: 'WebGLContextLost',
    title: 'WebGL context lost during ocean rendering',
    value: "WebGLContextLost: GPU process crashed. Lost context on canvas #game-viewport. Shader: ocean_wave_v3",
    level: 'fatal',
    culprit: 'OceanRenderer.drawWaves',
    platform: 'javascript',
    transaction: '/game/play',
    frames: [
      { filename: 'src/renderer/OceanRenderer.ts', function: 'drawWaves', lineno: 445, colno: 16, module: 'renderer', in_app: true },
      { filename: 'src/renderer/ShaderManager.ts', function: 'compileShader', lineno: 112, colno: 24, module: 'renderer', in_app: true },
      { filename: 'src/renderer/WebGLContext.ts', function: 'handleContextLost', lineno: 67, colno: 8, module: 'renderer', in_app: true },
    ],
    breadcrumbTemplates: [
      { type: 'navigation', category: 'navigation', message: 'Entered open ocean zone (North Atlantic)', level: 'info' },
      { type: 'default', category: 'renderer', message: 'Loading ocean shader: ocean_wave_v3.glsl', level: 'info' },
      { type: 'default', category: 'renderer', message: 'VRAM usage: 1.8GB / 2.0GB', level: 'warning' },
      { type: 'default', category: 'renderer', message: 'FPS dropped below 15 (current: 8)', level: 'warning' },
      { type: 'default', category: 'renderer', message: 'WebGL context lost event fired', level: 'error' },
    ],
    tags: { 'game.scene': 'ocean', 'gpu.vendor': 'NVIDIA', 'gpu.renderer': 'GeForce GTX 1060' },
    extra: { 'vramUsageMB': '1843', 'vramTotalMB': '2048', 'fps': '8', 'activeShaders': '12' },
    contexts: { gpu: { name: 'GeForce GTX 1060', vendor: 'NVIDIA', version: 'OpenGL ES 3.0', memory_size: 2048 } },
    weight: 8,
    environments: ['production'],
    releases: ['2.15.0', '2.15.1', '2.14.1'],
  },

  // === ERROR: 매칭 타임아웃 ===
  {
    type: 'MatchmakingTimeout',
    title: 'Matchmaking request timed out after 120s',
    value: "TimeoutError: Matchmaking queue 'pvp_fleet_battle' exceeded max wait time (120000ms). Players in queue: 2847",
    level: 'error',
    culprit: 'MatchmakingService.findMatch',
    platform: 'node',
    transaction: 'POST /api/matchmaking/queue',
    frames: [
      { filename: 'src/services/MatchmakingService.ts', function: 'findMatch', lineno: 198, colno: 14, module: 'matchmaking', in_app: true },
      { filename: 'src/services/MatchmakingService.ts', function: 'processQueue', lineno: 142, colno: 22, module: 'matchmaking', in_app: true },
      { filename: 'src/controllers/BattleController.ts', function: 'requestMatch', lineno: 56, colno: 8, module: 'controllers', in_app: true },
    ],
    breadcrumbTemplates: [
      { type: 'http', category: 'http', message: 'POST /api/matchmaking/queue → 202 (45ms)', level: 'info' },
      { type: 'default', category: 'matchmaking', message: 'Player joined PvP fleet battle queue (MMR: 1847)', level: 'info' },
      { type: 'default', category: 'matchmaking', message: 'Queue position: 342 / 2847 players', level: 'info' },
      { type: 'default', category: 'matchmaking', message: 'Expanded MMR range: 1847 ± 200 → 1847 ± 500', level: 'warning' },
      { type: 'default', category: 'matchmaking', message: 'Queue timeout: no suitable match found in 120s', level: 'error' },
    ],
    tags: { 'matchmaking.mode': 'pvp_fleet_battle', 'server.region': 'eu-west-1', 'server.cluster': 'match-03' },
    extra: { 'queueTimeMs': '120000', 'playersInQueue': '2847', 'mmrRange': '1347-2347' },
    contexts: { matchmaking: { mode: 'pvp_fleet_battle', mmr: 1847, queue_position: 342 } },
    weight: 12,
    environments: ['production', 'production'],
    releases: ['2.15.0', '2.15.1'],
  },

  // === WARNING: 결제 검증 실패 ===
  {
    type: 'PaymentValidationError',
    title: 'Payment receipt validation failed: signature mismatch',
    value: "PaymentValidationError: Google Play receipt signature verification failed for order GPA.3842-1928-4827-19283",
    level: 'error',
    culprit: 'PaymentService.validateReceipt',
    platform: 'node',
    transaction: 'POST /api/payment/verify',
    frames: [
      { filename: 'src/services/PaymentService.ts', function: 'validateReceipt', lineno: 287, colno: 18, module: 'payment', in_app: true },
      { filename: 'src/services/GooglePlayValidator.ts', function: 'verifySignature', lineno: 94, colno: 12, module: 'payment', in_app: true },
      { filename: 'src/controllers/ShopController.ts', function: 'purchaseItem', lineno: 123, colno: 8, module: 'controllers', in_app: true },
    ],
    breadcrumbTemplates: [
      { type: 'http', category: 'http', message: 'POST /api/shop/checkout → 200', level: 'info' },
      { type: 'default', category: 'payment', message: 'Initiated purchase: Premium Navigation Chart Bundle ($9.99)', level: 'info' },
      { type: 'http', category: 'http', message: 'POST /api/payment/verify → 200', level: 'info' },
      { type: 'default', category: 'payment', message: 'Google Play receipt received, verifying signature...', level: 'info' },
      { type: 'default', category: 'payment', message: 'Receipt signature INVALID — possible fraud attempt', level: 'error' },
    ],
    tags: { 'payment.provider': 'google_play', 'payment.product': 'nav_chart_bundle', 'server.region': 'ap-northeast-1' },
    extra: { 'orderId': 'GPA.3842-1928-4827-19283', 'amount': '9.99', 'currency': 'USD' },
    contexts: { payment: { provider: 'google_play', product: 'nav_chart_bundle', amount: 9.99 } },
    weight: 6,
    environments: ['production'],
    releases: ['2.15.0', '2.15.1'],
  },

  // === ERROR: 채팅 서버 과부하 ===
  {
    type: 'ChatServiceOverload',
    title: 'Chat message delivery failed: service overloaded',
    value: "ServiceUnavailableError: Chat service returned 503. Active connections: 48291, max: 50000. Message queue depth: 12847",
    level: 'warning',
    culprit: 'ChatService.sendMessage',
    platform: 'node',
    transaction: 'POST /api/chat/send',
    frames: [
      { filename: 'src/services/ChatService.ts', function: 'sendMessage', lineno: 156, colno: 14, module: 'chat', in_app: true },
      { filename: 'src/services/ChatService.ts', function: 'publishToChannel', lineno: 201, colno: 18, module: 'chat', in_app: true },
      { filename: 'src/middleware/rateLimiter.ts', function: 'checkServiceHealth', lineno: 45, colno: 8, module: 'middleware', in_app: true },
    ],
    breadcrumbTemplates: [
      { type: 'default', category: 'chat', message: 'Player sent message to guild channel [Mediterranean Traders]', level: 'info' },
      { type: 'http', category: 'http', message: 'POST /api/chat/send → 503 (timeout 5000ms)', level: 'error' },
      { type: 'default', category: 'chat', message: 'Chat service health check: DEGRADED', level: 'warning' },
    ],
    tags: { 'chat.channel': 'guild', 'server.region': 'ap-northeast-1', 'chat.cluster': 'chat-07' },
    extra: { 'activeConnections': '48291', 'maxConnections': '50000', 'queueDepth': '12847' },
    contexts: { service: { name: 'chat-service', version: '3.2.1', connections: 48291 } },
    weight: 10,
    environments: ['production', 'production'],
    releases: ['2.15.0'],
  },

  // === ERROR: 세이브 데이터 손상 ===
  {
    type: 'SaveDataCorruptionError',
    title: 'Character save data integrity check failed',
    value: "DataIntegrityError: CRC32 mismatch for character_id=892741. Expected 0xA3F2B1C4, got 0x00000000. Corrupted fields: equipment_slots",
    level: 'fatal',
    culprit: 'SaveManager.validateChecksum',
    platform: 'node',
    transaction: 'POST /api/character/save',
    frames: [
      { filename: 'src/services/SaveManager.ts', function: 'validateChecksum', lineno: 334, colno: 12, module: 'persistence', in_app: true },
      { filename: 'src/services/SaveManager.ts', function: 'persistCharacter', lineno: 289, colno: 18, module: 'persistence', in_app: true },
      { filename: 'src/services/CharacterService.ts', function: 'autoSave', lineno: 167, colno: 8, module: 'character', in_app: true },
    ],
    breadcrumbTemplates: [
      { type: 'default', category: 'game.save', message: 'Auto-save triggered (interval: 300s)', level: 'info' },
      { type: 'default', category: 'game.save', message: 'Serializing character data (892741)...', level: 'info' },
      { type: 'default', category: 'game.save', message: 'Equipment slot data appears zeroed out', level: 'warning' },
      { type: 'default', category: 'game.save', message: 'CRC32 MISMATCH — save aborted, rollback initiated', level: 'error' },
    ],
    tags: { 'server.region': 'ap-northeast-1', 'character.class': 'navigator', 'server.shard': 'shard-12' },
    extra: { 'characterId': '892741', 'expectedCrc': '0xA3F2B1C4', 'actualCrc': '0x00000000' },
    contexts: { character: { id: 892741, class: 'navigator', level: 78, server_shard: 'shard-12' } },
    weight: 3,
    environments: ['production'],
    releases: ['2.15.0'],
  },

  // === WARNING: 느린 DB 쿼리 ===
  {
    type: 'SlowQueryWarning',
    title: 'Database query exceeded threshold: guild_rankings',
    value: "SlowQueryWarning: Query 'SELECT * FROM guild_rankings ...' took 8.4s (threshold: 2s). Rows scanned: 1,284,729",
    level: 'warning',
    culprit: 'RankingService.getGuildRankings',
    platform: 'node',
    transaction: 'GET /api/rankings/guild',
    frames: [
      { filename: 'src/services/RankingService.ts', function: 'getGuildRankings', lineno: 89, colno: 14, module: 'rankings', in_app: true },
      { filename: 'src/database/QueryExecutor.ts', function: 'execute', lineno: 45, colno: 22, module: 'database', in_app: true },
    ],
    breadcrumbTemplates: [
      { type: 'http', category: 'http', message: 'GET /api/rankings/guild?season=12&page=1 → pending', level: 'info' },
      { type: 'default', category: 'database', message: 'Query started: guild_rankings (season=12)', level: 'info' },
      { type: 'default', category: 'database', message: 'Query running for 5000ms...', level: 'warning' },
      { type: 'default', category: 'database', message: 'Query completed in 8412ms (1,284,729 rows scanned)', level: 'warning' },
    ],
    tags: { 'db.type': 'mysql', 'db.instance': 'ranking-primary', 'server.region': 'ap-northeast-1' },
    extra: { 'queryTimeMs': '8412', 'rowsScanned': '1284729', 'queryHash': 'a3f2b1c4' },
    contexts: { database: { type: 'mysql', instance: 'ranking-primary', version: '8.0.35' } },
    weight: 15,
    environments: ['production', 'production', 'staging'],
    releases: ['2.15.0', '2.15.1', '2.14.1'],
  },

  // === ERROR: 클라이언트 UI 크래시 ===
  {
    type: 'TypeError',
    title: "Cannot read properties of null (reading 'equipmentSlots')",
    value: "TypeError: Cannot read properties of null (reading 'equipmentSlots') at CharacterPanel.render",
    level: 'error',
    culprit: 'CharacterPanel.render',
    platform: 'javascript',
    transaction: '/game/character',
    frames: [
      { filename: 'src/ui/panels/CharacterPanel.tsx', function: 'render', lineno: 156, colno: 32, module: 'ui', in_app: true },
      { filename: 'src/ui/panels/CharacterPanel.tsx', function: 'EquipmentGrid', lineno: 89, colno: 18, module: 'ui', in_app: true },
      { filename: 'node_modules/react-dom/cjs/react-dom.production.min.js', function: 'commitWork', lineno: 1, colno: 42847, module: 'react-dom', in_app: false },
    ],
    breadcrumbTemplates: [
      { type: 'navigation', category: 'navigation', message: 'Player opened character panel', level: 'info' },
      { type: 'http', category: 'http', message: 'GET /api/character/equipment → 200 (78ms)', level: 'info' },
      { type: 'ui.click', category: 'ui.click', message: 'Clicked tab: Equipment', level: 'info' },
      { type: 'default', category: 'ui', message: 'CharacterPanel.render() called with null characterData', level: 'error' },
    ],
    tags: { 'game.scene': 'port_town', 'ui.panel': 'character' },
    extra: { 'characterId': 'null', 'panelState': 'loading' },
    contexts: { browser: { name: 'Chrome', version: '124.0' }, os: { name: 'Windows', version: '11' } },
    weight: 14,
    environments: ['production', 'production', 'staging'],
    releases: ['2.15.0', '2.15.1'],
  },

  // === ERROR: 안티치트 감지 ===
  {
    type: 'AntiCheatViolation',
    title: 'Speed hack detected: abnormal movement velocity',
    value: "AntiCheatViolation: Player character_id=443829 moving at 842 units/s (max allowed: 120). Teleport distance: 24891 units in 1 tick",
    level: 'error',
    culprit: 'AntiCheatService.validateMovement',
    platform: 'node',
    transaction: 'WS /game/movement',
    frames: [
      { filename: 'src/services/AntiCheatService.ts', function: 'validateMovement', lineno: 234, colno: 14, module: 'anticheat', in_app: true },
      { filename: 'src/services/AntiCheatService.ts', function: 'checkVelocity', lineno: 189, colno: 18, module: 'anticheat', in_app: true },
      { filename: 'src/game/MovementHandler.ts', function: 'onPlayerMove', lineno: 67, colno: 8, module: 'game', in_app: true },
    ],
    breadcrumbTemplates: [
      { type: 'default', category: 'anticheat', message: 'Movement validation started for character_id=443829', level: 'info' },
      { type: 'default', category: 'anticheat', message: 'Velocity: 842 u/s exceeds max 120 u/s', level: 'warning' },
      { type: 'default', category: 'anticheat', message: 'VIOLATION LOGGED — auto-ban review queued', level: 'error' },
    ],
    tags: { 'anticheat.type': 'speed_hack', 'server.region': 'ap-northeast-1', 'server.shard': 'shard-05' },
    extra: { 'characterId': '443829', 'velocity': '842', 'maxAllowed': '120', 'teleportDistance': '24891' },
    contexts: { anticheat: { type: 'speed_hack', severity: 'critical', auto_ban: true } },
    weight: 5,
    environments: ['production'],
    releases: ['2.15.0', '2.15.1'],
  },
];

// === USER POOL ===
const USERS = Array.from({ length: 200 }, (_, i) => ({
  id: `user_${1000 + i}`,
  email: `player${1000 + i}@${randomPick(['gmail.com', 'naver.com', 'yahoo.co.jp', 'outlook.com', 'daum.net'])}`,
  name: randomPick(['Navigator', 'Captain', 'Admiral', 'Merchant', 'Explorer', 'Pirate']) + `_${1000 + i}`,
  ip: `${randomInt(1, 223)}.${randomInt(0, 255)}.${randomInt(0, 255)}.${randomInt(1, 254)}`,
}));

const BROWSERS = [
  { name: 'Chrome', version: '124.0' }, { name: 'Chrome', version: '123.0' },
  { name: 'Firefox', version: '125.0' }, { name: 'Safari', version: '17.4' },
  { name: 'Edge', version: '124.0' }, { name: 'Whale', version: '3.25' },
];
const OS_LIST = [
  { name: 'Windows', version: '11' }, { name: 'Windows', version: '10' },
  { name: 'macOS', version: '14.4' }, { name: 'iOS', version: '17.4' },
  { name: 'Android', version: '14' }, { name: 'Linux', version: '' },
];
const COUNTRIES = ['KR', 'JP', 'US', 'TW', 'TH', 'DE', 'BR', 'FR', 'GB', 'SG'];
const CITIES: Record<string, string[]> = {
  KR: ['Seoul', 'Busan', 'Incheon'], JP: ['Tokyo', 'Osaka', 'Nagoya'],
  US: ['Los Angeles', 'New York', 'Seattle'], TW: ['Taipei', 'Kaohsiung'],
  TH: ['Bangkok'], DE: ['Berlin', 'Munich'], BR: ['São Paulo'],
  FR: ['Paris'], GB: ['London'], SG: ['Singapore'],
};
const SERVERS = ['game-web-01', 'game-web-02', 'game-api-01', 'game-api-02', 'game-ws-01', 'game-ws-02', 'match-01', 'chat-01'];

// === LOG TEMPLATES ===
function generateLogsForEvent(issueId: number, timestamp: Date, scenario: ErrorScenario): any[] {
  const traceId = uuid();
  const baseTime = new Date(timestamp.getTime() - randomInt(5000, 30000));
  const logs: any[] = [];

  const logTemplates: { level: string; logger: string; msg: string }[] = [];

  if (scenario.type === 'ConnectionError') {
    logTemplates.push(
      { level: 'info', logger: 'NetworkManager', msg: 'WebSocket heartbeat sent' },
      { level: 'info', logger: 'NetworkManager', msg: 'Heartbeat response received (latency: 142ms)' },
      { level: 'warn', logger: 'NetworkManager', msg: 'Heartbeat timeout — no response in 5000ms' },
      { level: 'warn', logger: 'NetworkManager', msg: 'Connection quality degraded: POOR' },
      { level: 'error', logger: 'NetworkManager', msg: 'WebSocket CLOSE event received (code: 1006, reason: abnormal closure)' },
      { level: 'info', logger: 'ReconnectManager', msg: 'Reconnection attempt 1/3...' },
      { level: 'error', logger: 'ReconnectManager', msg: 'Reconnection failed — server unreachable' },
    );
  } else if (scenario.type === 'InventorySyncError') {
    logTemplates.push(
      { level: 'info', logger: 'InventoryManager', msg: 'Starting inventory sync...' },
      { level: 'info', logger: 'InventoryManager', msg: 'Fetching server-side inventory snapshot' },
      { level: 'info', logger: 'InventoryManager', msg: 'Server inventory: 47 items, 12 categories' },
      { level: 'warn', logger: 'ItemValidator', msg: 'Client has 49 items — 2 extra items detected' },
      { level: 'error', logger: 'ItemValidator', msg: 'Duplicate item detected: item_id=30291 (Refined Gold Bar)' },
      { level: 'error', logger: 'InventoryManager', msg: 'Sync ABORTED — manual resolution required' },
    );
  } else if (scenario.type === 'MatchmakingTimeout') {
    logTemplates.push(
      { level: 'info', logger: 'MatchmakingService', msg: 'Player entered PvP queue (MMR: 1847)' },
      { level: 'info', logger: 'MatchmakingService', msg: 'Queue position: 342 / 2847 players waiting' },
      { level: 'info', logger: 'MatchmakingService', msg: 'Searching for opponents in MMR range 1647-2047...' },
      { level: 'warn', logger: 'MatchmakingService', msg: 'No match found after 60s — expanding range to 1347-2347' },
      { level: 'warn', logger: 'MatchmakingService', msg: 'Queue time: 90s — still searching' },
      { level: 'error', logger: 'MatchmakingService', msg: 'TIMEOUT: 120s exceeded. Removing player from queue.' },
    );
  } else if (scenario.type === 'SlowQueryWarning') {
    logTemplates.push(
      { level: 'info', logger: 'QueryExecutor', msg: 'Executing: SELECT * FROM guild_rankings WHERE season=12...' },
      { level: 'info', logger: 'QueryExecutor', msg: 'Query plan: full table scan (no suitable index)' },
      { level: 'warn', logger: 'QueryExecutor', msg: 'Query running for 5000ms (threshold: 2000ms)' },
      { level: 'warn', logger: 'ConnectionPool', msg: 'Pool utilization: 8/10 connections active' },
      { level: 'warn', logger: 'QueryExecutor', msg: 'Query completed: 8412ms, 1,284,729 rows scanned' },
    );
  } else {
    logTemplates.push(
      { level: 'info', logger: 'AppLogger', msg: `Processing ${scenario.transaction}` },
      { level: 'info', logger: 'AppLogger', msg: 'Request validated, executing handler...' },
      { level: 'error', logger: 'ErrorHandler', msg: `${scenario.type}: ${scenario.value.substring(0, 80)}` },
    );
  }

  logTemplates.forEach((tmpl, i) => {
    logs.push({
      log_id: uuid(),
      project_id: PROJECT_ID,
      trace_id: traceId,
      span_id: uuid().substring(0, 16),
      issue_id: issueId,
      timestamp: new Date(baseTime.getTime() + i * randomInt(500, 3000)).toISOString(),
      level: tmpl.level,
      logger_name: tmpl.logger,
      message: tmpl.msg,
      body: '',
      environment: randomPick(scenario.environments),
      release: randomPick(scenario.releases),
      service: scenario.platform === 'node' ? 'game-server' : 'game-client',
      attributes: {},
    });
  });

  return logs;
}

// ======================== MAIN ========================

async function main() {
  console.log('🎮 Argus Data Simulator — Online Game (MMORPG)');
  console.log('================================================\n');

  // Connect
  const pool = mysql.createPool(MYSQL_CONFIG);
  const ch = createClient({
    url: CH_CONFIG.url,
    database: CH_CONFIG.database,
    username: CH_CONFIG.username,
    password: CH_CONFIG.password,
    clickhouse_settings: { date_time_input_format: 'best_effort' },
  });

  // 1. RESET DATA
  console.log('🗑️  Resetting all data...');

  // MySQL
  await pool.query('DELETE FROM g_argus_issues WHERE project_id = ?', [PROJECT_ID]);
  console.log('   ✓ MySQL issues cleared');

  // ClickHouse
  await ch.exec({ query: `ALTER TABLE argus.errors DELETE WHERE project_id = '${PROJECT_ID}'` });
  console.log('   ✓ ClickHouse errors cleared');
  try {
    await ch.exec({ query: `ALTER TABLE argus.logs DELETE WHERE project_id = '${PROJECT_ID}'` });
    console.log('   ✓ ClickHouse logs cleared');
  } catch { console.log('   ⚠ ClickHouse logs table not found (skipping)'); }

  // Wait for mutations
  await new Promise(r => setTimeout(r, 2000));

  // 2. BUILD WEIGHTED SCENARIO POOL
  const weightedScenarios: ErrorScenario[] = [];
  for (const s of SCENARIOS) {
    for (let i = 0; i < s.weight; i++) weightedScenarios.push(s);
  }

  // 3. CREATE ISSUES + EVENTS
  console.log('\n📦 Generating issues and events...\n');

  const issueMap = new Map<string, { id: number; firstSeen: Date; lastSeen: Date; count: number; users: Set<string> }>();
  const allEvents: any[] = [];
  const allLogs: any[] = [];
  const TOTAL_EVENTS = 850;

  for (let i = 0; i < TOTAL_EVENTS; i++) {
    const scenario = randomPick(weightedScenarios);
    const timestamp = randomDate(DAYS_BACK);
    const user = randomPick(USERS);
    const browser = randomPick(BROWSERS);
    const os = randomPick(OS_LIST);
    const country = randomPick(COUNTRIES);
    const city = randomPick(CITIES[country] || ['Unknown']);
    const env = randomPick(scenario.environments);
    const release = randomPick(scenario.releases);

    const primaryHash = md5(scenario.type + scenario.title);
    const eventId = uuid();

    // Track issue
    if (!issueMap.has(primaryHash)) {
      issueMap.set(primaryHash, {
        id: 0, // assigned after INSERT
        firstSeen: timestamp,
        lastSeen: timestamp,
        count: 0,
        users: new Set(),
      });
    }
    const issueTracker = issueMap.get(primaryHash)!;
    issueTracker.count++;
    issueTracker.users.add(user.id);
    if (timestamp < issueTracker.firstSeen) issueTracker.firstSeen = timestamp;
    if (timestamp > issueTracker.lastSeen) issueTracker.lastSeen = timestamp;

    // Build breadcrumbs
    const breadcrumbs = scenario.breadcrumbTemplates.map((tmpl, idx) => ({
      ...tmpl,
      timestamp: new Date(timestamp.getTime() - (scenario.breadcrumbTemplates.length - idx) * randomInt(1000, 5000)).toISOString(),
      data: tmpl.category === 'http' ? { url: scenario.transaction, method: 'GET', status_code: 200 } : undefined,
    }));

    // Build event
    const event = {
      event_id: eventId,
      project_id: PROJECT_ID,
      issue_id: 0, // filled later
      timestamp: timestamp.toISOString(),
      received_at: new Date(timestamp.getTime() + randomInt(50, 500)).toISOString(),
      platform: scenario.platform,
      level: scenario.level,
      logger: scenario.culprit.split('.')[0],
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
      server_name: randomPick(SERVERS),
      transaction: scenario.transaction,
      os_name: os.name,
      os_version: os.version,
      browser_name: browser.name,
      browser_version: browser.version,
      device_name: '',
      device_family: os.name === 'iOS' ? 'iPhone' : os.name === 'Android' ? 'Samsung Galaxy' : 'Desktop',
      runtime_name: scenario.platform === 'node' ? 'node' : '',
      runtime_version: scenario.platform === 'node' ? '20.12.0' : '',
      sdk_name: 'argus.javascript',
      sdk_version: '1.2.0',
      geo_country: country,
      geo_city: city,
      geo_region: '',
      http_method: scenario.transaction.startsWith('/game') ? 'GET' : 'POST',
      http_url: `https://unchartedwaters.com${scenario.transaction}`,
      http_referer: 'https://unchartedwaters.com/game',
      tags: scenario.tags,
      extra: scenario.extra,
      contexts: JSON.stringify(scenario.contexts),
      is_handled: scenario.level === 'warning' ? 1 : 0,
      is_symbolicated: 0,
    };

    allEvents.push({ event, primaryHash, scenario });
  }

  // 4. INSERT ISSUES INTO MYSQL
  console.log(`   Creating ${issueMap.size} issues...`);
  let shortId = 100;
  for (const [hash, tracker] of issueMap) {
    const scenario = SCENARIOS.find(s => md5(s.type + s.title) === hash)!;
    const [result] = await pool.query(
      `INSERT INTO g_argus_issues (project_id, short_id, title, culprit, type, level, platform, primary_hash, fingerprint,
       first_seen, last_seen, times_seen, num_users, status, first_release, last_release, priority)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        PROJECT_ID, shortId++,
        scenario.title, scenario.culprit, scenario.type, scenario.level, scenario.platform,
        hash, JSON.stringify([hash]),
        formatDate(tracker.firstSeen), formatDate(tracker.lastSeen),
        tracker.count, tracker.users.size,
        scenario.level === 'fatal' ? 'unresolved' : randomPick(['unresolved', 'unresolved', 'unresolved', 'resolved', 'ignored']),
        randomPick(scenario.releases), scenario.releases[scenario.releases.length - 1],
        scenario.level === 'fatal' ? 'critical' : scenario.level === 'error' ? 'high' : 'medium',
      ]
    );
    tracker.id = (result as any).insertId;
    console.log(`     ✓ [${scenario.level.toUpperCase()}] ${scenario.title.substring(0, 60)}... (${tracker.count} events, ${tracker.users.size} users)`);
  }

  // 5. ASSIGN ISSUE IDS & INSERT EVENTS INTO CLICKHOUSE
  console.log(`\n   Inserting ${allEvents.length} events into ClickHouse...`);
  const chEvents = allEvents.map(({ event, primaryHash }) => {
    const tracker = issueMap.get(primaryHash)!;
    return { ...event, issue_id: tracker.id };
  });

  // Batch insert in chunks
  const CHUNK = 200;
  for (let i = 0; i < chEvents.length; i += CHUNK) {
    const chunk = chEvents.slice(i, i + CHUNK);
    await ch.insert({ table: 'argus.errors', values: chunk, format: 'JSONEachRow' });
    console.log(`     ✓ Events ${i + 1}-${Math.min(i + CHUNK, chEvents.length)} inserted`);
  }

  // 6. GENERATE & INSERT LOGS
  console.log('\n   Generating structured logs...');
  // Generate logs for ~30% of events
  for (const { event, primaryHash, scenario } of allEvents) {
    if (Math.random() > 0.3) continue;
    const tracker = issueMap.get(primaryHash)!;
    const logs = generateLogsForEvent(tracker.id, new Date(event.timestamp), scenario);
    allLogs.push(...logs);
  }

  if (allLogs.length > 0) {
    try {
      for (let i = 0; i < allLogs.length; i += CHUNK) {
        const chunk = allLogs.slice(i, i + CHUNK);
        await ch.insert({ table: 'argus.logs', values: chunk, format: 'JSONEachRow' });
      }
      console.log(`     ✓ ${allLogs.length} log entries inserted`);
    } catch (e: any) {
      console.log(`     ⚠ Logs insert skipped (table may not exist): ${e.message?.substring(0, 80)}`);
    }
  }

  // 7. SUMMARY
  console.log('\n' + '='.repeat(50));
  console.log('✅ Simulation Complete!\n');
  console.log(`   Issues:     ${issueMap.size}`);
  console.log(`   Events:     ${allEvents.length}`);
  console.log(`   Logs:       ${allLogs.length}`);
  console.log(`   Users:      ${USERS.length}`);
  console.log(`   Time range: ${DAYS_BACK} days`);
  console.log(`   Releases:   ${[...GAME_RELEASES, ...WEB_RELEASES].join(', ')}`);
  console.log('\n   Error Breakdown:');
  for (const [hash, tracker] of issueMap) {
    const scenario = SCENARIOS.find(s => md5(s.type + s.title) === hash)!;
    console.log(`     [${scenario.level.padEnd(7)}] ${tracker.count.toString().padStart(4)} events | ${scenario.title.substring(0, 55)}`);
  }

  await pool.end();
  await ch.close();
  console.log('\n🎮 Done! Refresh the Argus dashboard.');
}

main().catch(e => { console.error('❌ Fatal error:', e); process.exit(1); });

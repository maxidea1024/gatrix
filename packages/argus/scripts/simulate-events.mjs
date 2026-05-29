/**
 * Argus Event Simulator v2 — Realistic game server monitoring data
 * 
 * Generates correlated errors, transactions with spans, sessions, and feedback
 * that tell a coherent story of a live game service.
 *
 * Usage: node packages/argus/scripts/simulate-events.mjs
 */

const ARGUS_URL = process.env.ARGUS_URL || 'http://localhost:45300';
const PROJECT_ID = process.env.ARGUS_PROJECT_ID || '1';

// ============ Quantities ============
const ERROR_COUNT     = 80;
const TXN_COUNT       = 200;
const SESSION_COUNT   = 150;
const FEEDBACK_COUNT  = 25;

// ============ Helpers ============
function uuid() {
  return 'xxxxxxxxxxxx4xxxyxxxxxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}
function hex(n) { return [...Array(n)].map(() => Math.floor(Math.random()*16).toString(16)).join(''); }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function pickW(items) {
  // weighted random: [{v, w}]
  const total = items.reduce((s, i) => s + i.w, 0);
  let r = Math.random() * total;
  for (const item of items) { r -= item.w; if (r <= 0) return item.v; }
  return items[items.length - 1].v;
}
function randInt(a, b) { return Math.floor(Math.random() * (b - a + 1)) + a; }
function randFloat(a, b) { return a + Math.random() * (b - a); }
function pastMs(hoursAgo) { return Date.now() - Math.random() * hoursAgo * 3600000; }
function isoAt(ms) { return new Date(ms).toISOString(); }

// ============ Realistic Data Pools ============

const USERS = [
  { id: 'usr_a1f3e2', name: 'Kim Minjun', email: 'minjun.kim@naver.com' },
  { id: 'usr_b2d4c1', name: 'Park Soyeon', email: 'soyeon.park@gmail.com' },
  { id: 'usr_c3e5d8', name: 'Lee Jihoon', email: 'jihoon.lee@kakao.com' },
  { id: 'usr_d4f6e9', name: 'Choi Yuna', email: 'yuna.choi@naver.com' },
  { id: 'usr_e5a7f0', name: 'Jung Taehyung', email: 'taehyung.j@gmail.com' },
  { id: 'usr_f6b8a1', name: 'Kang Seulgi', email: 'seulgi.kang@daum.net' },
  { id: 'usr_a7c9b2', name: 'Han Woojin', email: 'woojin.han@naver.com' },
  { id: 'usr_b8d0c3', name: 'Yoon Chaeyoung', email: 'chae.yoon@gmail.com' },
  { id: 'usr_c9e1d4', name: 'Song Hyunwoo', email: 'hyunwoo.song@kakao.com' },
  { id: 'usr_d0f2e5', name: 'Oh Jiwon', email: 'jiwon.oh@naver.com' },
  { id: 'usr_e1a3f6', name: 'Shin Eunji', email: 'eunji.shin@gmail.com' },
  { id: 'usr_f2b4a7', name: 'Jang Donghyuk', email: 'donghyuk.j@kakao.com' },
  { id: 'usr_a3c5b8', name: 'Hwang Mirae', email: 'mirae.hwang@naver.com' },
  { id: 'usr_b4d6c9', name: 'Bae Sungjin', email: 'sungjin.bae@gmail.com' },
  { id: 'usr_c5e7d0', name: 'Lim Hayoung', email: 'hayoung.lim@daum.net' },
  { id: 'usr_d6f8e1', name: 'Ko Jaehyun', email: 'jaehyun.ko@naver.com' },
  { id: 'usr_e7a9f2', name: 'Kwon Nayeon', email: 'nayeon.kwon@gmail.com' },
  { id: 'usr_f8b0a3', name: 'Ryu Changmin', email: 'changmin.ryu@kakao.com' },
  { id: 'usr_a9c1b4', name: 'Moon Sooyoung', email: 'sooyoung.m@naver.com' },
  { id: 'usr_b0d2c5', name: 'Ahn Doyoon', email: 'doyoon.ahn@gmail.com' },
];

const ENVS = [
  { v: 'production', w: 70 },
  { v: 'staging', w: 20 },
  { v: 'development', w: 10 },
];
const RELEASES = [
  { v: '2.4.1', w: 40 },
  { v: '2.4.0', w: 30 },
  { v: '2.3.9-hotfix.2', w: 15 },
  { v: '2.5.0-beta.3', w: 10 },
  { v: '2.5.0-beta.4', w: 5 },
];
const REGIONS = ['ap-northeast-2', 'us-west-2', 'eu-central-1', 'ap-southeast-1'];
const PLATFORMS = [
  { v: 'javascript', w: 45 },
  { v: 'node', w: 35 },
  { v: 'java', w: 15 },
  { v: 'python', w: 5 },
];

// ============ Error Scenarios ============
const ERROR_SCENARIOS = [
  // --- High frequency production errors ---
  { type: 'TypeError', value: "Cannot read properties of undefined (reading 'inventory')", culprit: 'InventoryController.getItems', level: 'error', w: 15,
    frames: [
      { filename: 'src/controllers/InventoryController.ts', function: 'getItems', lineno: 47, colno: 23, in_app: true, context_line: "    const items = player.inventory.filter(i => i.equipped);" },
      { filename: 'src/routes/inventory.ts', function: 'handleGetInventory', lineno: 28, colno: 5, in_app: true },
      { filename: 'node_modules/fastify/lib/reply.js', function: 'Reply.send', lineno: 425, colno: 15, in_app: false },
    ]},
  { type: 'DatabaseError', value: "ER_LOCK_DEADLOCK: Deadlock found when trying to get lock; try restarting transaction", culprit: 'MatchmakingService.assignMatch', level: 'error', w: 12,
    frames: [
      { filename: 'src/services/MatchmakingService.ts', function: 'assignMatch', lineno: 189, colno: 11, in_app: true, context_line: "    await this.db.query('UPDATE match_queue SET status=? WHERE id=?', ['matched', queueId]);" },
      { filename: 'src/services/MatchmakingService.ts', function: 'processQueue', lineno: 142, colno: 7, in_app: true },
      { filename: 'node_modules/mysql2/promise.js', function: 'PromisePoolConnection.execute', lineno: 55, colno: 20, in_app: false },
    ]},
  { type: 'WebSocketError', value: "Connection closed abnormally (code: 1006) during game session", culprit: 'GameSessionHandler.onClose', level: 'error', w: 10,
    frames: [
      { filename: 'src/realtime/GameSessionHandler.ts', function: 'onClose', lineno: 78, colno: 5, in_app: true, context_line: "    this.saveSessionState(session.id, 'abnormal_disconnect');" },
      { filename: 'src/realtime/WebSocketManager.ts', function: 'handleDisconnect', lineno: 203, colno: 9, in_app: true },
      { filename: 'node_modules/ws/lib/websocket.js', function: 'WebSocket.close', lineno: 211, colno: 14, in_app: false },
    ]},
  { type: 'RedisError', value: "CLUSTERDOWN The cluster is down", culprit: 'CacheService.getPlayerProfile', level: 'fatal', w: 5,
    frames: [
      { filename: 'src/services/CacheService.ts', function: 'getPlayerProfile', lineno: 62, colno: 18, in_app: true, context_line: "    const cached = await this.redis.get(`player:${userId}:profile`);" },
      { filename: 'src/middleware/profileLoader.ts', function: 'loadProfile', lineno: 31, colno: 5, in_app: true },
      { filename: 'node_modules/ioredis/built/Redis.js', function: 'Redis.sendCommand', lineno: 512, colno: 24, in_app: false },
    ]},
  { type: 'ValidationError', value: "Invalid item_id: expected UUID format but received '0xDEAD'", culprit: 'TradeValidator.validateOffer', level: 'warning', w: 8,
    frames: [
      { filename: 'src/validators/TradeValidator.ts', function: 'validateOffer', lineno: 95, colno: 7, in_app: true, context_line: "    if (!UUID_REGEX.test(offer.item_id)) throw new ValidationError(...);" },
      { filename: 'src/controllers/TradeController.ts', function: 'createOffer', lineno: 44, colno: 3, in_app: true },
    ]},
  { type: 'RateLimitError', value: "Rate limit exceeded: 1000 requests/min from IP 203.0.113.42", culprit: 'RateLimiter.check', level: 'warning', w: 7,
    frames: [
      { filename: 'src/middleware/RateLimiter.ts', function: 'check', lineno: 38, colno: 9, in_app: true },
      { filename: 'src/middleware/index.ts', function: 'applyMiddleware', lineno: 15, colno: 5, in_app: true },
    ]},
  { type: 'PaymentError', value: "Payment gateway timeout: PG responded with 504 after 30s for order ORD-2026-48291", culprit: 'PaymentService.processPayment', level: 'error', w: 6,
    frames: [
      { filename: 'src/services/PaymentService.ts', function: 'processPayment', lineno: 167, colno: 14, in_app: true, context_line: "    const pgResponse = await this.pgClient.charge(order.amount, order.pg_token);" },
      { filename: 'src/controllers/ShopController.ts', function: 'purchaseItem', lineno: 89, colno: 7, in_app: true },
      { filename: 'src/services/PaymentService.ts', function: 'callPG', lineno: 231, colno: 11, in_app: true },
      { filename: 'node_modules/axios/lib/core/dispatchRequest.js', function: 'dispatchRequest', lineno: 52, colno: 10, in_app: false },
    ]},
  { type: 'AuthenticationError', value: "JWT signature verification failed: token issued by unknown key 'kid=old-key-2024'", culprit: 'AuthMiddleware.verifyToken', level: 'error', w: 8,
    frames: [
      { filename: 'src/middleware/AuthMiddleware.ts', function: 'verifyToken', lineno: 52, colno: 13, in_app: true, context_line: "    const decoded = jwt.verify(token, this.publicKey, { algorithms: ['RS256'] });" },
      { filename: 'src/middleware/AuthMiddleware.ts', function: 'authenticate', lineno: 28, colno: 5, in_app: true },
      { filename: 'node_modules/jsonwebtoken/verify.js', function: 'verify', lineno: 171, colno: 16, in_app: false },
    ]},
  { type: 'OutOfMemoryError', value: "Worker heap limit reached: 1536MB used of 1536MB max during leaderboard aggregation", culprit: 'LeaderboardAggregator.computeRankings', level: 'fatal', w: 3,
    frames: [
      { filename: 'src/workers/LeaderboardAggregator.ts', function: 'computeRankings', lineno: 134, colno: 5, in_app: true, context_line: "    const allScores = await this.db.query('SELECT * FROM player_scores WHERE season_id=?', [seasonId]);" },
      { filename: 'src/workers/LeaderboardAggregator.ts', function: 'run', lineno: 45, colno: 7, in_app: true },
    ]},
  { type: 'ConcurrencyError', value: "Optimistic lock failed: match state was modified by another process (version mismatch: expected 3, got 5)", culprit: 'MatchStateManager.updateState', level: 'error', w: 6,
    frames: [
      { filename: 'src/game/MatchStateManager.ts', function: 'updateState', lineno: 88, colno: 9, in_app: true, context_line: "    if (current.version !== expected) throw new ConcurrencyError(...);" },
      { filename: 'src/game/MatchEngine.ts', function: 'processAction', lineno: 212, colno: 7, in_app: true },
      { filename: 'src/game/MatchEngine.ts', function: 'tick', lineno: 67, colno: 5, in_app: true },
    ]},
];

// ============ Transaction Scenarios (with spans) ============
const TXN_SCENARIOS = [
  { transaction: 'POST /api/v2/auth/login', op: 'http.server', method: 'POST', w: 20,
    baseDuration: [80, 400], errorRate: 0.05,
    spans: [
      { op: 'db.query', desc: "SELECT * FROM users WHERE email = ? AND deleted_at IS NULL", dur: [5, 30] },
      { op: 'cache.get', desc: "GET user:session:{user_id}", dur: [1, 5] },
      { op: 'crypto', desc: "bcrypt.compare(password, hash)", dur: [40, 200] },
      { op: 'db.query', desc: "INSERT INTO login_history (user_id, ip, user_agent) VALUES (?, ?, ?)", dur: [3, 15] },
      { op: 'http.client', desc: "POST https://push.internal/api/notify", dur: [10, 50] },
      { op: 'function', desc: "jwt.sign(payload, privateKey)", dur: [2, 10] },
    ]},
  { transaction: 'GET /api/v2/game/matchmaking', op: 'http.server', method: 'GET', w: 25,
    baseDuration: [200, 3000], errorRate: 0.08,
    spans: [
      { op: 'cache.get', desc: "GET matchmaking:queue:ranked", dur: [1, 8] },
      { op: 'db.query', desc: "SELECT rating, rank_tier, region FROM player_stats WHERE user_id = ?", dur: [5, 25] },
      { op: 'function', desc: "MatchmakingAlgorithm.findMatch(player, queue)", dur: [50, 500] },
      { op: 'db.query', desc: "UPDATE match_queue SET status='matched', match_id=? WHERE id IN (?)", dur: [10, 50] },
      { op: 'message.publish', desc: "PUBLISH match:assigned:{match_id}", dur: [2, 10] },
      { op: 'http.client', desc: "POST https://game-server.internal/api/sessions/create", dur: [30, 200] },
    ]},
  { transaction: 'GET /api/v2/player/inventory', op: 'http.server', method: 'GET', w: 18,
    baseDuration: [40, 300], errorRate: 0.03,
    spans: [
      { op: 'cache.get', desc: "GET player:{user_id}:inventory", dur: [1, 5] },
      { op: 'db.query', desc: "SELECT i.*, it.name, it.rarity FROM inventory i JOIN item_types it ON i.type_id=it.id WHERE i.user_id=? ORDER BY i.updated_at DESC", dur: [15, 80] },
      { op: 'cache.set', desc: "SET player:{user_id}:inventory (TTL 300s)", dur: [1, 5] },
      { op: 'function', desc: "InventorySerializer.serialize(items, locale)", dur: [2, 15] },
    ]},
  { transaction: 'POST /api/v2/shop/purchase', op: 'http.server', method: 'POST', w: 10,
    baseDuration: [300, 2000], errorRate: 0.12,
    spans: [
      { op: 'db.query', desc: "SELECT balance, currency FROM wallets WHERE user_id = ? FOR UPDATE", dur: [5, 20] },
      { op: 'function', desc: "PriceCalculator.applyDiscounts(item, user)", dur: [1, 5] },
      { op: 'http.client', desc: "POST https://pg.example.com/api/v1/charge", dur: [100, 800] },
      { op: 'db.query', desc: "INSERT INTO transactions (user_id, item_id, amount, pg_txn_id) VALUES (?, ?, ?, ?)", dur: [5, 25] },
      { op: 'db.query', desc: "UPDATE wallets SET balance = balance - ? WHERE user_id = ?", dur: [3, 15] },
      { op: 'db.query', desc: "INSERT INTO inventory (user_id, item_type_id, quantity) VALUES (?, ?, ?)", dur: [3, 15] },
      { op: 'message.publish', desc: "PUBLISH analytics:purchase {user_id, item_id, amount}", dur: [1, 5] },
    ]},
  { transaction: 'GET /api/v2/leaderboard/season', op: 'http.server', method: 'GET', w: 12,
    baseDuration: [30, 200], errorRate: 0.02,
    spans: [
      { op: 'cache.get', desc: "GET leaderboard:season:current:top100", dur: [1, 3] },
      { op: 'db.query', desc: "SELECT u.nickname, ps.rating, ps.wins, ps.rank_tier FROM player_stats ps JOIN users u ON ps.user_id=u.id ORDER BY ps.rating DESC LIMIT 100", dur: [20, 150] },
      { op: 'cache.set', desc: "SET leaderboard:season:current:top100 (TTL 60s)", dur: [1, 5] },
    ]},
  { transaction: 'WS /realtime/game/{match_id}', op: 'websocket.server', method: 'GET', w: 15,
    baseDuration: [500, 5000], errorRate: 0.06,
    spans: [
      { op: 'db.query', desc: "SELECT state, players, round FROM matches WHERE id = ?", dur: [5, 20] },
      { op: 'function', desc: "GameEngine.processActions(actions, state)", dur: [10, 100] },
      { op: 'cache.set', desc: "SET match:{match_id}:state (serialized)", dur: [2, 10] },
      { op: 'message.publish', desc: "PUBLISH match:{match_id}:broadcast", dur: [1, 5] },
      { op: 'db.query', desc: "INSERT INTO match_events (match_id, round, action, player_id, data) VALUES ...", dur: [5, 30] },
    ]},
  { transaction: 'POST /api/v2/chat/send', op: 'http.server', method: 'POST', w: 8,
    baseDuration: [30, 150], errorRate: 0.01,
    spans: [
      { op: 'function', desc: "ContentFilter.checkProfanity(message)", dur: [2, 15] },
      { op: 'db.query', desc: "INSERT INTO chat_messages (channel_id, sender_id, content, type) VALUES (?, ?, ?, ?)", dur: [3, 15] },
      { op: 'message.publish', desc: "PUBLISH chat:{channel_id}:new_message", dur: [1, 5] },
    ]},
  { transaction: 'POST /api/v2/player/report', op: 'http.server', method: 'POST', w: 3,
    baseDuration: [50, 300], errorRate: 0.02,
    spans: [
      { op: 'db.query', desc: "SELECT count(*) FROM reports WHERE reporter_id=? AND created_at > NOW() - INTERVAL 1 HOUR", dur: [3, 10] },
      { op: 'db.query', desc: "INSERT INTO reports (reporter_id, reported_id, reason, match_id, evidence) VALUES (?, ?, ?, ?, ?)", dur: [5, 20] },
      { op: 'http.client', desc: "POST https://moderation.internal/api/queue", dur: [10, 50] },
    ]},
  { transaction: 'GET /api/v2/notifications', op: 'http.server', method: 'GET', w: 7,
    baseDuration: [20, 120], errorRate: 0.01,
    spans: [
      { op: 'cache.get', desc: "GET notifications:{user_id}:unread", dur: [1, 3] },
      { op: 'db.query', desc: "SELECT * FROM notifications WHERE user_id=? AND read_at IS NULL ORDER BY created_at DESC LIMIT 50", dur: [5, 40] },
    ]},
  { transaction: 'CRON /jobs/daily-rewards', op: 'cron', method: 'GET', w: 2,
    baseDuration: [5000, 30000], errorRate: 0.15,
    spans: [
      { op: 'db.query', desc: "SELECT user_id FROM users WHERE last_login_at > NOW() - INTERVAL 1 DAY", dur: [100, 500] },
      { op: 'function', desc: "RewardCalculator.computeDailyRewards(activeUsers)", dur: [500, 3000] },
      { op: 'db.query', desc: "INSERT INTO rewards (user_id, type, amount, expires_at) VALUES ... (batch 5000 rows)", dur: [200, 2000] },
      { op: 'http.client', desc: "POST https://push.internal/api/bulk-notify", dur: [300, 2000] },
      { op: 'message.publish', desc: "PUBLISH analytics:daily_rewards_completed", dur: [1, 5] },
    ]},
];

// ============ Feedback Messages ============
const FEEDBACKS = [
  { msg: "매칭이 너무 오래 걸려요. 5분 넘게 대기했는데 결국 타임아웃 났어요. 랭크 게임인데 이러면 곤란합니다.", rating: 2 },
  { msg: "2.4.1 업데이트 이후 인벤토리 페이지에서 가끔 아이템이 안 보여요. 새로고침하면 돌아오긴 하는데 불편합니다.", rating: 3 },
  { msg: "결제했는데 아이템이 안 들어왔어요! 크리스탈 100개 결제했는데 재화가 그대로입니다. 주문번호: ORD-2026-48291", rating: 1 },
  { msg: "게임 중간에 연결이 자꾸 끊겨요. WiFi 문제가 아닌 것 같은데... 다른 게임은 잘 됩니다. 특히 3라운드쯤에서 많이 끊겨요.", rating: 2 },
  { msg: "리더보드 로딩 속도가 확 빨라졌네요! 예전에는 3초 걸렸는데 지금은 거의 바로 나와요. 좋습니다 👍", rating: 5 },
  { msg: "채팅 필터가 너무 엄격해요. '공격'이라는 단어도 차단되는데, 게임 내에서 '공격하자'가 왜 금칙어인가요?", rating: 3 },
  { msg: "시즌 보상 정산이 안 됐습니다. 어제 시즌 끝났는데 보상 우편이 안 와요. 다이아 티어였는데...", rating: 1 },
  { msg: "모바일에서 상점 UI가 깨져요. 아이템 가격이 겹쳐서 보이고, 구매 버튼이 반응이 없을 때가 있어요.", rating: 2 },
  { msg: "정말 재밌게 하고 있습니다! 1v1 모드 추가해주세요! 친구랑 맞붙고 싶어요.", rating: 5 },
  { msg: "2.5.0 베타 참여 중인데, 새로운 캐릭터 밸런스가 좀 별로예요. 마법사 스킬 쿨타임이 너무 짧아요.", rating: 3 },
  { msg: "매칭 취소를 눌러도 취소가 안 돼요. 계속 매칭 중이라고 뜨다가 갑자기 게임에 들어가버려요.", rating: 2 },
  { msg: "오늘 서버 점검 이후로 랙이 심해요. 핑이 200ms 넘게 나옵니다. 서울 서버 맞나요?", rating: 1 },
  { msg: "길드 기능 좋아요! 근데 길드원 목록에서 온라인/오프라인 표시가 정확하지 않은 것 같아요.", rating: 4 },
  { msg: "신고 기능은 잘 되는데, 신고 결과를 알려주면 좋겠어요. 제가 신고한 유저가 처리됐는지 모르겠어요.", rating: 4 },
  { msg: "로그인할 때 '알 수 없는 오류'라고만 뜨고 자세한 내용이 없어요. 3번 시도하면 겨우 들어가집니다.", rating: 2 },
  { msg: "대전 리플레이 기능 너무 좋습니다! 복기할 때 정말 유용해요. 배속 기능도 있으면 좋겠어요.", rating: 5 },
  { msg: "아이템 거래 시 가끔 '거래 실패' 오류가 나요. 그런데 아이템은 없어지고 골드는 안 돌아와요 ㅜㅜ", rating: 1 },
  { msg: "푸시 알림이 너무 많아요. 알림 설정에서 카테고리별로 끌 수 있게 해주세요.", rating: 3 },
  { msg: "앱이 백그라운드에서 배터리를 너무 많이 먹어요. 게임 안 하는데도 배터리가 10% 이상 소모돼요.", rating: 2 },
  { msg: "이번 시즌 테마 정말 예뻐요! 아트팀 칭찬합니다. 배경음악도 분위기에 딱 맞아요.", rating: 5 },
  { msg: "친구 초대 보상이 안 들어왔어요. 친구가 레벨 10 달성했는데 초대 보상이 지급 안 됐습니다.", rating: 2 },
  { msg: "계정 연동 중에 앱이 크래시됐어요. Google 계정 연동하려고 하면 로딩 후 튕깁니다.", rating: 1 },
  { msg: "전체적으로 2.4.0보다 안정적이에요. 예전에 자주 끊기던 문제가 많이 나아졌습니다.", rating: 4 },
  { msg: "커스텀 매치 방 만들기 UI가 직관적이지 않아요. 설정 항목이 너무 많고 어떤 게 뭔지 모르겠어요.", rating: 3 },
  { msg: "듀얼 모니터에서 전체화면 하면 마우스 커서가 다른 모니터로 넘어가요. 커서 잠금 옵션 추가 부탁드려요.", rating: 3 },
];

// ============ Generators ============

function genError() {
  const scenario = pickW(ERROR_SCENARIOS.map(s => ({ v: s, w: s.w })));
  const user = pick(USERS);
  const env = pickW(ENVS);
  const rel = pickW(RELEASES);
  const t = pastMs(36);

  return {
    type: 'error', event_id: hex(32), timestamp: isoAt(t),
    platform: pickW(PLATFORMS), environment: env, release: rel,
    level: scenario.level,
    logger: pick(['game-server', 'api-gateway', 'matchmaker', 'payment-worker', 'ws-handler']),
    transaction: pick(TXN_SCENARIOS).transaction,
    fingerprint: [hex(32)],
    exception: {
      type: scenario.type, value: scenario.value,
      mechanism: pick(['onerror', 'onunhandledrejection', 'instrument', 'generic']),
      stacktrace: { frames: scenario.frames },
    },
    breadcrumbs: [
      { timestamp: isoAt(t - 5000), category: 'navigation', message: `User navigated to ${pick(['/lobby', '/match', '/shop', '/inventory'])}` },
      { timestamp: isoAt(t - 3000), category: 'http', message: `${pick(['GET', 'POST'])} ${pick(TXN_SCENARIOS).transaction}`, data: { status_code: pick([200, 200, 200, 500]) } },
      { timestamp: isoAt(t - 1000), category: 'ui.click', message: `button#${pick(['start-match', 'buy-item', 'open-inventory', 'send-chat', 'confirm-trade'])}` },
      { timestamp: isoAt(t - 200), category: 'console', level: 'warning', message: pick(['Memory usage: 78%', 'Slow query detected (>500ms)', 'Connection pool utilization: 95%']) },
    ],
    user: { id: user.id, email: user.email, ip_address: `${pick(['203.0.113', '198.51.100', '192.0.2'])}.${randInt(1, 254)}` },
    contexts: {
      os: { name: pick(['Windows', 'macOS', 'Android', 'iOS']), version: pick(['11', '14.2', '15.1', '13']) },
      browser: { name: pick(['Chrome', 'Firefox', 'Safari', 'Edge']), version: `${randInt(118, 126)}.0.${randInt(0, 99)}` },
    },
    tags: {
      server_region: pick(REGIONS),
      game_mode: pick(['ranked', 'casual', 'custom', 'tutorial']),
      client_version: rel,
    },
    sdk: { name: 'argus.javascript', version: '1.2.0' },
  };
}

function genTransaction() {
  const scenario = pickW(TXN_SCENARIOS.map(s => ({ v: s, w: s.w })));
  const user = pick(USERS);
  const env = pickW(ENVS);
  const rel = pickW(RELEASES);
  const isError = Math.random() < scenario.errorRate;

  const totalDur = randInt(scenario.baseDuration[0], scenario.baseDuration[1]) * (isError ? randFloat(1.5, 4) : 1);
  const now = pastMs(24);
  const startMs = now - totalDur;
  const traceId = hex(32);
  const rootSpanId = hex(16);

  // Build child spans with realistic timing
  const spans = [];
  let elapsed = randInt(1, 5); // initial overhead
  for (const spanDef of scenario.spans) {
    const spanDur = randInt(spanDef.dur[0], spanDef.dur[1]);
    const spanStart = startMs + elapsed;
    const spanEnd = spanStart + spanDur;
    spans.push({
      span_id: hex(16),
      parent_span_id: rootSpanId,
      trace_id: traceId,
      op: spanDef.op,
      description: spanDef.desc.replace('{user_id}', user.id).replace('{match_id}', hex(8)),
      status: (isError && spanDef.op === 'http.client' && Math.random() < 0.4) ? 'internal_error' : 'ok',
      start_timestamp: isoAt(spanStart),
      timestamp: isoAt(spanEnd),
      duration: spanDur,
      data: spanDef.op.startsWith('db') ? { 'db.system': 'mysql', 'db.rows_affected': String(randInt(0, 100)) } :
            spanDef.op.startsWith('cache') ? { 'cache.hit': String(Math.random() > 0.3) } :
            spanDef.op.startsWith('http') ? { 'http.response_content_length': String(randInt(200, 50000)) } : {},
      tags: { region: pick(REGIONS) },
    });
    elapsed += spanDur + randInt(0, 3); // gap between spans
  }

  const statusCode = isError ? pick([500, 502, 503, 504]) : pick([200, 200, 200, 201]);

  return {
    type: 'transaction', event_id: hex(32), timestamp: isoAt(now),
    platform: pickW(PLATFORMS), environment: env, release: rel,
    transaction: scenario.transaction, transaction_op: scenario.op,
    trace_id: traceId, span_id: rootSpanId,
    start_timestamp: isoAt(startMs), duration: Math.round(totalDur),
    transaction_status: isError ? pick(['internal_error', 'deadline_exceeded', 'unavailable']) : 'ok',
    http_method: scenario.method,
    http_status_code: statusCode,
    user: { id: user.id },
    tags: { region: pick(REGIONS), game_mode: pick(['ranked', 'casual', 'custom']) },
    measurements: {
      ttfb: randFloat(5, 100),
      fcp: randFloat(50, 500),
      memory_used_mb: randFloat(200, 1200),
    },
    spans,
  };
}

function genSession() {
  const user = pick(USERS);
  const env = pickW(ENVS);
  const rel = pickW(RELEASES);
  const status = pickW([
    { v: 'ok', w: 40 }, { v: 'exited', w: 35 },
    { v: 'crashed', w: 15 }, { v: 'abnormal', w: 10 },
  ]);
  const t = pastMs(24);
  const dur = status === 'crashed' ? randInt(5000, 120000)
            : status === 'abnormal' ? randInt(1000, 30000)
            : randInt(60000, 3600000);

  return {
    type: 'session', event_id: hex(32), timestamp: isoAt(t),
    platform: pickW(PLATFORMS), environment: env, release: rel,
    session_id: uuid(), started: isoAt(t - dur), status, seq: 0,
    duration: dur,
    errors: status === 'crashed' ? randInt(1, 8) : status === 'abnormal' ? randInt(0, 2) : 0,
    distinct_id: user.id,
    user_agent: `GatrixClient/${rel} (${pick(['Windows 11', 'macOS 14.5', 'Android 14', 'iOS 17.4'])}; ${pick(['x86_64', 'arm64'])})`,
  };
}

function genFeedback() {
  const user = pick(USERS);
  const fb = pick(FEEDBACKS);
  return {
    type: 'feedback', event_id: hex(32), timestamp: isoAt(pastMs(72)),
    platform: pickW(PLATFORMS), environment: pickW(ENVS), release: pickW(RELEASES),
    name: user.name, email: user.email,
    message: fb.msg,
    contact_email: user.email,
    url: pick(['/lobby', '/match/result', '/shop', '/inventory', '/settings', '/leaderboard', '/guild']),
    source: pickW([{ v: 'in-app-widget', w: 50 }, { v: 'post-match-survey', w: 30 }, { v: 'support-form', w: 20 }]),
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
  console.log('');
  console.log('╔══════════════════════════════════════╗');
  console.log('║   🎮  Argus Game Server Simulator    ║');
  console.log('╚══════════════════════════════════════╝');
  console.log(`  Target:     ${ARGUS_URL}`);
  console.log(`  Project ID: ${PROJECT_ID}`);
  console.log('');

  // Discover DSN key
  const projResp = await getJSON(`${ARGUS_URL}/argus/api/projects/${PROJECT_ID}`);
  if (projResp.status !== 200) { console.error(`❌ Project not found`); process.exit(1); }
  const dsnKey = projResp.data?.data?.dsn_keys?.[0]?.public_key;
  if (!dsnKey) { console.error('❌ No DSN key'); process.exit(1); }
  console.log(`  🔑 DSN: ${dsnKey.slice(0, 8)}...`);
  console.log('');

  const auth = { Authorization: `Bearer ${dsnKey}` };
  const batchUrl = `${ARGUS_URL}/argus/api/${PROJECT_ID}/ingest/batch`;

  // Generate
  console.log('📦 Generating realistic game server events...');
  const errors = Array.from({ length: ERROR_COUNT }, genError);
  const txns = Array.from({ length: TXN_COUNT }, genTransaction);
  const sessions = Array.from({ length: SESSION_COUNT }, genSession);
  const feedbacks = Array.from({ length: FEEDBACK_COUNT }, genFeedback);
  
  const totalSpans = txns.reduce((s, t) => s + (t.spans?.length || 0), 0);
  console.log(`  🐛 ${errors.length} errors (${new Set(errors.map(e=>e.exception.type)).size} unique types)`);
  console.log(`  ⚡ ${txns.length} transactions + ${totalSpans} spans`);
  console.log(`  📊 ${sessions.length} sessions`);
  console.log(`  💬 ${feedbacks.length} feedback entries`);
  console.log('');

  // Send
  console.log('📤 Ingesting...');
  let ok = 0, fail = 0;

  for (let i = 0; i < errors.length; i += 20) {
    const r = await postJSON(batchUrl, { events: errors.slice(i, i + 20) }, auth);
    r.status === 202 ? ok++ : fail++;
  }
  console.log(`  🐛 Errors:       ${ok} batches ok, ${fail} failed`);

  ok = 0; fail = 0;
  for (let i = 0; i < txns.length; i += 20) {
    const r = await postJSON(batchUrl, { events: txns.slice(i, i + 20) }, auth);
    r.status === 202 ? ok++ : fail++;
  }
  console.log(`  ⚡ Transactions: ${ok} batches ok, ${fail} failed`);

  ok = 0; fail = 0;
  for (let i = 0; i < sessions.length; i += 20) {
    const r = await postJSON(batchUrl, { events: sessions.slice(i, i + 20) }, auth);
    r.status === 202 ? ok++ : fail++;
  }
  console.log(`  📊 Sessions:     ${ok} batches ok, ${fail} failed`);

  const fr = await postJSON(batchUrl, { events: feedbacks }, auth);
  console.log(`  💬 Feedback:     ${fr.status === 202 ? 'ok' : 'FAILED'}`);

  console.log('');
  console.log('⏳ Waiting 8s for worker processing...');
  await new Promise(r => setTimeout(r, 8000));

  // Verify
  console.log('');
  console.log('🔎 Verification:');
  const checks = [
    { n: 'Overview',     u: `${ARGUS_URL}/argus/api/overview/${PROJECT_ID}?period=24h`, f: d => `errors=${d?.error_summary?.total_errors||0} txns=${d?.transaction_summary?.total_transactions||0} sessions=${d?.session_summary?.total_sessions||0}` },
    { n: 'Issues',       u: `${ARGUS_URL}/argus/api/${PROJECT_ID}/issues`, f: (_, r) => `total=${r?.total||0}` },
    { n: 'Performance',  u: `${ARGUS_URL}/argus/api/performance/${PROJECT_ID}/transactions?period=24h`, f: d => `${(Array.isArray(d)?d:[]).length} endpoints` },
    { n: 'Sessions',     u: `${ARGUS_URL}/argus/api/sessions/${PROJECT_ID}?period=24h`, f: d => `total=${d?.summary?.total_sessions||0} crash_free=${d?.summary?.crash_free_rate||0}%` },
    { n: 'Feedback',     u: `${ARGUS_URL}/argus/api/feedback/${PROJECT_ID}?period=7d`, f: d => `total=${d?.total||0}` },
  ];
  for (const c of checks) {
    try {
      const r = await getJSON(c.u);
      console.log(`  ✅ ${c.n.padEnd(12)} ${c.f(r.data?.data, r.data)}`);
    } catch (e) { console.error(`  ❌ ${c.n}: ${e.message}`); }
  }

  console.log('');
  console.log('🎉 Simulation complete!');
  console.log('');
}

main().catch(e => { console.error('💥', e.message); process.exit(1); });

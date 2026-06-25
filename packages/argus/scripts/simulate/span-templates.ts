/**
 * Simulate Data — Span Templates
 */
import { randomInt, randomPick } from './helpers';

export const SPAN_DB_QUERIES = [
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

export const SPAN_CACHE_KEYS = [
  'character:{userId}:profile',
  'character:{userId}:inventory',
  'character:{userId}:equipment',
  'guild:{guildId}:members',
  'market:listings:page:{page}',
  'session:{sessionId}:token',
  'rankings:guild:season:12',
  'matchmaking:queue:pvp_fleet',
  'config:ship_balance:v3',
  'npc:dialog:{npcId}:tree',
  'world:shard:{shardId}:population',
  'rate_limit:{ip}:counter',
  'auction:{auctionId}:lock',
  'combat:cooldown:{userId}:{skillId}',
];

export const SPAN_HTTP_CALLS = [
  'POST https://analytics.internal/v2/events',
  'GET https://cdn.internal/config/ship_balance_v3.json',
  'POST https://payment.internal/verify-receipt',
  'POST https://anticheat.internal/validate',
  'GET https://leaderboard.internal/api/rankings?season=12',
  'POST https://notification.internal/push',
  'POST https://matchmaking.internal/queue/join',
  'GET https://auth.internal/token/refresh',
  'POST https://audit.internal/log',
  'GET https://discovery.internal/services/lobbyd',
];

export interface SpanTemplate {
  op: string;
  description: string;
  durMin: number;
  durMax: number;
}

export const SPAN_TEMPLATES_BY_TXN: Record<string, SpanTemplate[]> = {
  'POST /api/auth/login': [
    {
      op: 'db.query',
      description: 'SELECT * FROM users WHERE email = ? LIMIT 1',
      durMin: 3,
      durMax: 30,
    },
    {
      op: 'function',
      description: 'bcrypt.compare(password, hash)',
      durMin: 80,
      durMax: 250,
    },
    {
      op: 'db.query',
      description: 'UPDATE users SET last_login = NOW() WHERE id = ?',
      durMin: 2,
      durMax: 15,
    },
    {
      op: 'cache.set',
      description: 'redis SET session:{sessionId}:token',
      durMin: 1,
      durMax: 5,
    },
    {
      op: 'http.client',
      description: 'POST https://analytics.internal/v2/events',
      durMin: 5,
      durMax: 50,
    },
  ],
  'POST /api/character/save': [
    {
      op: 'cache.get',
      description: 'redis GET character:{userId}:lock',
      durMin: 1,
      durMax: 3,
    },
    {
      op: 'function',
      description: 'CharacterSerializer.validate(saveData)',
      durMin: 2,
      durMax: 10,
    },
    {
      op: 'db.query',
      description:
        'UPDATE characters SET equipment = ?, gold = ?, position = ? WHERE id = ?',
      durMin: 5,
      durMax: 50,
    },
    {
      op: 'cache.set',
      description: 'redis SET character:{userId}:profile',
      durMin: 1,
      durMax: 5,
    },
    {
      op: 'function',
      description: 'CRC32.compute(saveBlob)',
      durMin: 1,
      durMax: 8,
    },
  ],
  'POST /api/trade/complete': [
    {
      op: 'cache.get',
      description: 'redis GET trade:{tradeId}:lock',
      durMin: 1,
      durMax: 5,
    },
    {
      op: 'db.query',
      description: 'SELECT * FROM inventory WHERE character_id = ? FOR UPDATE',
      durMin: 5,
      durMax: 40,
    },
    {
      op: 'db.query',
      description:
        'UPDATE inventory SET owner_id = ? WHERE id = ? AND owner_id = ?',
      durMin: 3,
      durMax: 30,
    },
    {
      op: 'db.query',
      description:
        'UPDATE characters SET gold = gold - ? WHERE id = ? AND gold >= ?',
      durMin: 3,
      durMax: 20,
    },
    {
      op: 'db.query',
      description:
        'INSERT INTO trade_logs (seller, buyer, item, price) VALUES (?, ?, ?, ?)',
      durMin: 2,
      durMax: 15,
    },
    {
      op: 'http.client',
      description: 'POST https://analytics.internal/v2/events',
      durMin: 5,
      durMax: 40,
    },
  ],
  'GET /api/rankings/guild': [
    {
      op: 'cache.get',
      description: 'redis GET rankings:guild:season:12',
      durMin: 1,
      durMax: 5,
    },
    {
      op: 'db.query',
      description:
        'SELECT g.*, SUM(s.score) FROM guilds g JOIN scores s ON g.id = s.guild_id WHERE s.season = 12 GROUP BY g.id ORDER BY SUM(s.score) DESC LIMIT 100',
      durMin: 200,
      durMax: 8000,
    },
    {
      op: 'cache.set',
      description: 'redis SET rankings:guild:season:12 EX 300',
      durMin: 1,
      durMax: 5,
    },
    {
      op: 'function',
      description: 'RankingFormatter.format(results)',
      durMin: 2,
      durMax: 15,
    },
  ],
  'POST /api/matchmaking/queue': [
    {
      op: 'cache.get',
      description: 'redis GET matchmaking:queue:pvp_fleet:size',
      durMin: 1,
      durMax: 3,
    },
    {
      op: 'function',
      description: 'MMRCalculator.computeRange(player)',
      durMin: 2,
      durMax: 10,
    },
    {
      op: 'cache.set',
      description: 'redis ZADD matchmaking:queue:pvp_fleet {mmr} {userId}',
      durMin: 1,
      durMax: 5,
    },
    {
      op: 'function',
      description: 'MatchmakingEngine.tryMatch(queue)',
      durMin: 100,
      durMax: 120000,
    },
  ],
  'POST /api/guild/bank/transfer': [
    {
      op: 'db.query',
      description:
        'SELECT * FROM guild_members WHERE user_id = ? AND guild_id = ?',
      durMin: 3,
      durMax: 15,
    },
    {
      op: 'function',
      description: 'PermissionChecker.hasPermission(member, "bank.transfer")',
      durMin: 1,
      durMax: 5,
    },
    { op: 'db.query', description: 'BEGIN TRANSACTION', durMin: 1, durMax: 3 },
    {
      op: 'db.query',
      description:
        'UPDATE guild_bank SET quantity = quantity - ? WHERE guild_id = ? AND item_id = ?',
      durMin: 5,
      durMax: 50,
    },
    {
      op: 'db.query',
      description:
        'INSERT INTO inventory (character_id, item_id, quantity) VALUES (?, ?, ?)',
      durMin: 3,
      durMax: 20,
    },
    { op: 'db.query', description: 'COMMIT', durMin: 1, durMax: 10 },
  ],
};

export function getSpanTemplates(txnName: string): SpanTemplate[] {
  if (SPAN_TEMPLATES_BY_TXN[txnName]) return SPAN_TEMPLATES_BY_TXN[txnName];
  // Generic fallback with realistic ops
  const numSpans = randomInt(2, 5);
  const spans: SpanTemplate[] = [];
  for (let i = 0; i < numSpans; i++) {
    const op = randomPick([
      'db.query',
      'db.query',
      'cache.get',
      'cache.set',
      'http.client',
      'function',
      'serialize',
    ]);
    let desc: string;
    switch (op) {
      case 'db.query':
        desc = randomPick(SPAN_DB_QUERIES);
        break;
      case 'cache.get':
      case 'cache.set':
        desc = `redis ${op === 'cache.get' ? 'GET' : 'SET'} ${randomPick(SPAN_CACHE_KEYS).replace(/{\w+}/g, String(randomInt(1000, 99999)))}`;
        break;
      case 'http.client':
        desc = randomPick(SPAN_HTTP_CALLS);
        break;
      case 'function':
        desc = randomPick([
          'JSON.parse(requestBody)',
          'Validator.validate(payload)',
          'Serializer.toProtobuf(response)',
          'CryptoUtil.hmacSign(data)',
          'Compressor.gzip(blob)',
        ]);
        break;
      default:
        desc = randomPick([
          'JSON.stringify(responsePayload)',
          'MessagePack.encode(event)',
          'ProtoBuf.serialize(packet)',
        ]);
        break;
    }
    spans.push({
      op,
      description: desc,
      durMin: 1,
      durMax: randomInt(20, 500),
    });
  }
  return spans;
}

// ═══════════════════ CONTEXTUAL LOG MESSAGES ═══════════════════


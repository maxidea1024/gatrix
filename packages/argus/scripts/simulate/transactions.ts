/**
 * Simulate Data — Transaction Templates
 */
import { PROJECT_ID, CHUNK_SIZE, DAYS_BACK } from './config';
import { randomInt, randomPick, randomFloat, uuid, randomDateWeighted, formatDate } from './helpers';
import { USERS } from './user-pool';
import { SERVER_RELEASES } from './releases';
import { getSpanTemplates } from './span-templates';

export const TXN_TEMPLATES = [
  {
    name: 'POST /api/auth/login',
    op: 'http.server',
    durMin: 50,
    durMax: 800,
    errRate: 0.02,
  },
  {
    name: 'POST /api/character/save',
    op: 'http.server',
    durMin: 30,
    durMax: 1500,
    errRate: 0.01,
  },
  {
    name: 'GET /api/character/profile',
    op: 'http.server',
    durMin: 10,
    durMax: 200,
    errRate: 0.005,
  },
  {
    name: 'POST /api/trade/complete',
    op: 'http.server',
    durMin: 50,
    durMax: 2000,
    errRate: 0.03,
  },
  {
    name: 'POST /api/combat/engage',
    op: 'http.server',
    durMin: 20,
    durMax: 500,
    errRate: 0.01,
  },
  {
    name: 'GET /api/rankings/guild',
    op: 'http.server',
    durMin: 100,
    durMax: 8000,
    errRate: 0.05,
  },
  {
    name: 'POST /api/matchmaking/queue',
    op: 'http.server',
    durMin: 200,
    durMax: 120000,
    errRate: 0.08,
  },
  {
    name: 'POST /api/chat/send',
    op: 'http.server',
    durMin: 5,
    durMax: 500,
    errRate: 0.02,
  },
  {
    name: 'GET /api/market/listings',
    op: 'http.server',
    durMin: 30,
    durMax: 3000,
    errRate: 0.01,
  },
  {
    name: 'POST /api/payment/verify',
    op: 'http.server',
    durMin: 100,
    durMax: 5000,
    errRate: 0.04,
  },
  {
    name: 'POST /api/guild/bank/transfer',
    op: 'http.server',
    durMin: 50,
    durMax: 2000,
    errRate: 0.02,
  },
  {
    name: 'POST /api/auction/buy',
    op: 'http.server',
    durMin: 30,
    durMax: 1500,
    errRate: 0.03,
  },
  {
    name: 'WS /game/movement',
    op: 'websocket',
    durMin: 1,
    durMax: 50,
    errRate: 0.001,
  },
  {
    name: 'WS /game/combat',
    op: 'websocket',
    durMin: 5,
    durMax: 200,
    errRate: 0.005,
  },
  {
    name: 'GET /api/inventory/list',
    op: 'http.server',
    durMin: 20,
    durMax: 800,
    errRate: 0.01,
  },
];

export async function generateAndInsertTransactions(
  ch: any,
  chDatabase: string,
  totalTransactions: number,
  activeDsnKeys: number[]
): Promise<number> {
  console.log('\n⚡ Generating transactions & spans...');
  let txnCount = 0;
  for (let i = 0; i < totalTransactions; i += CHUNK_SIZE) {
    const txnBatch: any[] = [];
    const spanBatch: any[] = [];
    const batchSize = Math.min(CHUNK_SIZE, totalTransactions - i);

    for (let j = 0; j < batchSize; j++) {
      const tpl = randomPick(TXN_TEMPLATES);
      const ts = randomDateWeighted(DAYS_BACK);
      const user = randomPick(USERS);
      const traceId = uuid();
      const spanId = uuid().substring(0, 16);
      const dur = randomFloat(tpl.durMin, tpl.durMax);
      const env = randomPick(['production', 'staging']);
      const release = randomPick(SERVER_RELEASES);
      const server = randomPick(['game-api-01', 'game-api-02', 'game-api-03']);
      const dsnKeyId = randomPick(activeDsnKeys);

      txnBatch.push({
        event_id: uuid(),
        project_id: PROJECT_ID,
        trace_id: traceId,
        span_id: spanId,
        timestamp: formatDate(ts),
        name: tpl.name,
        op: tpl.op,
        duration_ms: Math.round(dur),
        status: randomPick(['ok', 'ok', 'ok', 'ok', 'ok', 'internal_error', 'deadline_exceeded', 'not_found']),
        environment: env,
        release,
        server_name: server,
        user_id: user.id,
        user_email: user.email,
        user_ip: user.ip,
        browser_name: 'N/A',
        browser_version: 'N/A',
        os_name: 'Linux',
        os_version: '6.8',
        http_method: tpl.name.split(' ')[0] || 'GET',
        http_url: tpl.name.split(' ')[1] || '/',
        http_status_code: randomPick([200, 200, 200, 201, 400, 500]),
        tags: {},
        dsn_key_id: dsnKeyId,
      });

      // Spans
      const spanTemplates = getSpanTemplates(tpl.name);
      let offset = 0;
      for (const st of spanTemplates) {
        const sDur = randomFloat(st.durMin, st.durMax);
        spanBatch.push({
          span_id: uuid().substring(0, 16),
          trace_id: traceId,
          parent_span_id: spanId,
          project_id: PROJECT_ID,
          timestamp: formatDate(new Date(ts.getTime() + offset)),
          op: st.op,
          description: st.description,
          duration_ms: Math.round(sDur),
          status: 'ok',
          tags: {},
          dsn_key_id: dsnKeyId,
        });
        offset += Math.round(sDur);
      }
    }

    await ch.insert({ table: `${chDatabase}.transactions`, values: txnBatch, format: 'JSONEachRow' });
    if (spanBatch.length > 0) {
      await ch.insert({ table: `${chDatabase}.spans`, values: spanBatch, format: 'JSONEachRow' });
    }
    txnCount += txnBatch.length;
    process.stdout.write(`\r   ⏳ ${txnCount.toLocaleString()} txns...`);
  }
  console.log(`\n   ✓ ${txnCount.toLocaleString()} transactions inserted`);
  return txnCount;
}

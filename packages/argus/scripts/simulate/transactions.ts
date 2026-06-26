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
      const dur = randomFloat(tpl.durMin, tpl.durMax);
      const env = randomPick(['production', 'staging']);
      const release = randomPick(SERVER_RELEASES);

      const spanTemplates = getSpanTemplates(tpl.name);

      txnBatch.push({
        event_id: uuid().replace(/-/g, ''),
        trace_id: uuid().replace(/-/g, ''),
        span_id: uuid().replace(/-/g, '').substring(0, 16),
        parent_span_id: '0000000000000000',
        project_id: PROJECT_ID,
        timestamp: formatDate(new Date(ts.getTime() + Math.round(dur))),
        start_timestamp: formatDate(ts),
        duration: Math.round(dur),
        transaction: tpl.name,
        transaction_op: tpl.op,
        transaction_status: randomPick(['ok', 'ok', 'ok', 'ok', 'ok', 'internal_error', 'deadline_exceeded', 'not_found']),
        http_method: tpl.name.split(' ')[0] || 'GET',
        http_status_code: randomPick([200, 200, 200, 201, 400, 500]),
        platform: 'node',
        environment: env,
        release,
        user_id: user.id,
        measurements: {},
        tags: {},
        span_count: spanTemplates.length,
      });

      // Spans
      const txnEventId = txnBatch[txnBatch.length - 1].event_id;
      const txnSpanId = txnBatch[txnBatch.length - 1].span_id;
      const txnTraceId = txnBatch[txnBatch.length - 1].trace_id;
      let offset = 0;
      for (const st of spanTemplates) {
        const sDur = randomFloat(st.durMin, st.durMax);
        spanBatch.push({
          span_id: uuid().replace(/-/g, '').substring(0, 16),
          trace_id: txnTraceId,
          parent_span_id: txnSpanId,
          transaction_id: txnEventId,
          project_id: PROJECT_ID,
          timestamp: formatDate(new Date(ts.getTime() + offset + Math.round(sDur))),
          start_timestamp: formatDate(new Date(ts.getTime() + offset)),
          duration: Math.round(sDur),
          op: st.op,
          description: st.description,
          status: 'ok',
          action: '',
          domain: '',
          data: {},
          tags: {},
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

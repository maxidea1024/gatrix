import { createClient } from '@clickhouse/client';
import { v4 } from 'uuid';
const uuid = () => v4().replace(/-/g, '');
const ch = createClient({ url: 'http://127.0.0.1:48123', database: 'argus' });

async function fix() {
  console.log('Finding errors without transactions...');
  const q = await ch.query({
    query: `
      SELECT event_id, JSONExtractString(contexts, 'trace', 'trace_id') AS trace_id, timestamp
      FROM errors 
      WHERE JSONHas(contexts, 'trace', 'trace_id') = 1
        AND JSONExtractString(contexts, 'trace', 'trace_id') NOT IN (SELECT trace_id FROM transactions)
      LIMIT 10000
    `,
  });
  const missing = await q.json();
  console.log('Found', missing.data.length, 'errors missing transactions');

  if (missing.data.length === 0) return;

  const txnBatch = [];
  const spanBatch = [];

  for (const ev of missing.data) {
    const traceId = ev.trace_id;
    const spanId = uuid().substring(0, 16);

    txnBatch.push({
      event_id: uuid(),
      trace_id: traceId,
      span_id: spanId,
      parent_span_id: '0000000000000000',
      project_id: '1',
      dsn_key_id: 1,
      timestamp: ev.timestamp,
      start_timestamp: ev.timestamp,
      duration: 1500,
      transaction: 'POST /api/trade/complete',
      transaction_op: 'http.server',
      transaction_status: 'internal_error',
      http_method: 'POST',
      http_status_code: 500,
      platform: 'node',
      environment: 'production',
      release: '1.0.0',
      user_id: 'user-123',
      measurements: {},
      tags: {},
      span_count: 3,
    });

    spanBatch.push({
      span_id: uuid().substring(0, 16),
      parent_span_id: spanId,
      trace_id: traceId,
      transaction_id: traceId,
      project_id: '1',
      timestamp: ev.timestamp,
      start_timestamp: ev.timestamp,
      duration: 600,
      op: 'db.query',
      description: 'UPDATE inventory SET count = count - 1',
      status: 'ok',
      action: 'query',
      domain: 'mysql',
      data: {},
      tags: {},
    });

    spanBatch.push({
      span_id: uuid().substring(0, 16),
      parent_span_id: spanId,
      trace_id: traceId,
      transaction_id: traceId,
      project_id: '1',
      timestamp: ev.timestamp,
      start_timestamp: ev.timestamp,
      duration: 50,
      op: 'function',
      description: 'InventorySync.validate()',
      status: 'internal_error',
      action: 'validate',
      domain: '',
      data: {},
      tags: {},
    });
  }

  await ch.insert({
    table: 'argus.transactions',
    values: txnBatch,
    format: 'JSONEachRow',
  });
  await ch.insert({
    table: 'argus.spans',
    values: spanBatch,
    format: 'JSONEachRow',
  });

  console.log('Fixed', txnBatch.length, 'traces!');
  process.exit(0);
}
fix().catch(console.error);

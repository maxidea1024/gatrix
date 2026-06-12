import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from packages/argus/.env
dotenv.config({ path: path.join(__dirname, '.env') });

import { optic } from '@gatrix/argus-optic';
import { getBucketingConfig } from './src/utils/timeBucket';

async function test() {
  const projectId = '01KN8GSHBJ10JTQ9D0HD60RKFV';
  const txnName = 'POST /api/combat/engage';
  const period = '90d';

  const txnFilter = {
    field: 'transaction',
    op: '=' as const,
    value: txnName,
  };

  console.log('Testing connection...');
  await optic.initDatabase();
  const ok = await optic.testConnection();
  console.log('ClickHouse connection:', ok);

  console.log('\n--- 1. Testing queryBatch ---');
  try {
    const batch = await optic.queryBatch({
      trend: {
        dataset: 'transactions',
        projectId,
        timeRange: { period },
        select: [
          { field: '$bucket', alias: 'hour' },
          { field: 'count()', alias: 'count' },
          { field: 'avg(duration)', alias: 'avg_duration' },
          { field: 'p95(duration)', alias: 'p95' },
          {
            field: "countIf(transaction_status != 'ok') / count() * 100",
            alias: 'error_rate',
          },
        ],
        conditions: [txnFilter],
        groupBy: ['$bucket'],
        orderBy: [{ field: 'hour', direction: 'ASC' }],
        withFill: true,
      },

      summary: {
        dataset: 'transactions',
        projectId,
        timeRange: { period },
        select: [
          { field: 'count()', alias: 'count' },
          { field: 'avg(duration)', alias: 'avg_duration' },
          { field: 'p50(duration)', alias: 'p50' },
          { field: 'p95(duration)', alias: 'p95' },
          {
            field: "countIf(transaction_status != 'ok') / count() * 100",
            alias: 'error_rate',
          },
        ],
        conditions: [txnFilter],
      },

      recentTraces: {
        dataset: 'transactions',
        projectId,
        timeRange: { period },
        select: [
          { field: 'event_id' },
          { field: 'trace_id' },
          { field: 'timestamp' },
          { field: 'duration' },
          { field: 'transaction_status' },
          { field: 'http_status_code' },
          { field: 'span_count' },
          { field: 'user_id' },
        ],
        conditions: [txnFilter],
        orderBy: [{ field: 'timestamp', direction: 'DESC' }],
        limit: 20,
      },

      errors: {
        dataset: 'errors',
        projectId,
        timeRange: { period },
        select: [
          { field: 'issue_id' },
          { field: 'count()', alias: 'event_count' },
          { field: 'max(timestamp)', alias: 'last_seen' },
        ],
        conditions: [
          txnFilter,
          { field: 'toString(issue_id)', op: '!=', value: '' },
        ],
        groupBy: ['issue_id'],
        orderBy: [{ field: 'event_count', direction: 'DESC' }],
        limit: 5,
      },
    });
    console.log('queryBatch success, trend size:', batch.trend.data.length);
  } catch (err: any) {
    console.error('queryBatch FAILED:', err);
  }

  console.log('\n--- 2. Testing Histogram ---');
  try {
    const bucket = getBucketingConfig(period);
    const result = await optic.rawQuery({
      query: `SELECT
        multiIf(
          duration < 100, '<100ms',
          duration < 300, '100-300ms',
          duration < 500, '300-500ms',
          duration < 1000, '500ms-1s',
          duration < 3000, '1-3s',
          duration < 5000, '3-5s',
          '5s+'
        ) AS bucket,
        count() AS count
      FROM argus.transactions
      WHERE project_id = {projectId:String}
        AND transaction = {txnName:String}
        AND timestamp >= toDateTime({fillStart:UInt32})
        AND timestamp <= toDateTime({fillEnd:UInt32})
      GROUP BY bucket ORDER BY min(duration)`,
      params: { projectId, txnName, ...bucket.queryParams },
    });
    console.log('Histogram success, count:', result.data.length);
  } catch (err: any) {
    console.error('Histogram FAILED:', err);
  }

  console.log('\n--- 3. Testing Suspect Tags ---');
  try {
    const bucket = getBucketingConfig(period);
    const result = await optic.rawQuery({
      query: `
        SELECT 'browser' AS tag_key, tags['browser'] AS tag_value, count() AS count, avg(duration) AS avg_duration, p95(duration) AS p95
        FROM argus.transactions WHERE project_id = {projectId:String} AND transaction = {txnName:String} AND timestamp >= toDateTime({fillStart:UInt32}) AND timestamp <= toDateTime({fillEnd:UInt32}) AND tags['browser'] != '' GROUP BY tags['browser'] HAVING count > 0
        UNION ALL
        SELECT 'os' AS tag_key, tags['os'] AS tag_value, count() AS count, avg(duration) AS avg_duration, p95(duration) AS p95
        FROM argus.transactions WHERE project_id = {projectId:String} AND transaction = {txnName:String} AND timestamp >= toDateTime({fillStart:UInt32}) AND timestamp <= toDateTime({fillEnd:UInt32}) AND tags['os'] != '' GROUP BY tags['os'] HAVING count > 0
        UNION ALL
        SELECT 'environment' AS tag_key, environment AS tag_value, count() AS count, avg(duration) AS avg_duration, p95(duration) AS p95
        FROM argus.transactions WHERE project_id = {projectId:String} AND transaction = {txnName:String} AND timestamp >= toDateTime({fillStart:UInt32}) AND timestamp <= toDateTime({fillEnd:UInt32}) AND environment != '' GROUP BY environment HAVING count > 0
      `,
      params: { projectId, txnName, ...bucket.queryParams },
    });
    console.log('Suspect Tags success, count:', result.data.length);
  } catch (err: any) {
    console.error('Suspect Tags FAILED:', err);
  }

  process.exit(0);
}

test();

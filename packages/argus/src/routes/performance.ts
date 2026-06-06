import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { optic } from '@gatrix/argus-optic';
import { mysqlPool } from '../config/mysql';
import { getBucketingConfig } from '../utils/timeBucket';
import { createLogger } from '../utils/logger';

const logger = createLogger('performance-api');

export default async function performanceRoutes(app: FastifyInstance) {
  // ?€?€ Transaction list ??top transactions by count, avg duration, p95 ?€?€?€?€
  app.get(
    '/performance/:projectId/transactions',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId } = request.params as { projectId: string };
      const { period = '24h', sort = 'count', limit = '20', start, end } = request.query as {
        period?: string; sort?: string; limit?: string; start?: string; end?: string;
      };

      const sortMap: Record<string, { field: string; direction: 'ASC' | 'DESC' }> = {
        p95: { field: 'p95', direction: 'DESC' },
        avg: { field: 'avg_duration', direction: 'DESC' },
        error_rate: { field: 'error_rate', direction: 'DESC' },
        count: { field: 'count', direction: 'DESC' },
      };
      const orderBy = sortMap[sort] || sortMap.count;

      try {
        const result = await optic.query({
          dataset: 'transactions', projectId,
          timeRange: start && end ? { start, end } : { period },
          select: [
            { field: 'transaction', alias: 'name' },
            { field: 'count()', alias: 'count' },
            { field: 'avg(duration)', alias: 'avg_duration' },
            { field: 'p50(duration)', alias: 'p50' },
            { field: 'p75(duration)', alias: 'p75' },
            { field: 'p95(duration)', alias: 'p95' },
            { field: 'p99(duration)', alias: 'p99' },
            { field: "countIf(transaction_status != 'ok') / count() * 100", alias: 'error_rate' },
            { field: 'max(timestamp)', alias: 'last_seen' },
          ],
          groupBy: ['transaction'],
          orderBy: [orderBy],
          limit: parseInt(limit, 10),
        });

        return reply.send({ data: result.data });
      } catch (error) {
        logger.error('Failed to get transactions', {
          projectId, error: error instanceof Error ? error.message : String(error),
        });
        return reply.code(500).send({ error: 'Failed to get transactions' });
      }
    }
  );

  // ?€?€ Transaction detail ??all stats for a specific transaction ?€?€?€?€?€?€?€?€?€?€
  app.get(
    '/performance/:projectId/transactions/:txnName',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId, txnName } = request.params as { projectId: string; txnName: string };
      const { period = '24h' } = request.query as { period?: string };

      try {
        const txnFilter = { field: 'transaction', op: '=' as const, value: txnName };

        const [batch, histogram, relatedIssues] = await Promise.all([
          // Main queries via DSL
          optic.queryBatch({
            trend: {
              dataset: 'transactions', projectId, timeRange: { period },
              select: [
                { field: '$bucket', alias: 'hour' },
                { field: 'count()', alias: 'count' },
                { field: 'avg(duration)', alias: 'avg_duration' },
                { field: 'p95(duration)', alias: 'p95' },
                { field: "countIf(transaction_status != 'ok') / count() * 100", alias: 'error_rate' },
              ],
              conditions: [txnFilter],
              groupBy: ['$bucket'],
              orderBy: [{ field: 'hour', direction: 'ASC' }],
              withFill: true,
            },

            summary: {
              dataset: 'transactions', projectId, timeRange: { period },
              select: [
                { field: 'count()', alias: 'count' },
                { field: 'avg(duration)', alias: 'avg_duration' },
                { field: 'p50(duration)', alias: 'p50' },
                { field: 'p95(duration)', alias: 'p95' },
                { field: "countIf(transaction_status != 'ok') / count() * 100", alias: 'error_rate' },
              ],
              conditions: [txnFilter],
            },

            recentTraces: {
              dataset: 'transactions', projectId, timeRange: { period },
              select: [
                { field: 'event_id' }, { field: 'trace_id' }, { field: 'timestamp' },
                { field: 'duration' }, { field: 'transaction_status' },
                { field: 'http_status_code' }, { field: 'span_count' }, { field: 'user_id' },
              ],
              conditions: [txnFilter],
              orderBy: [{ field: 'timestamp', direction: 'DESC' }],
              limit: 20,
            },

            errors: {
              dataset: 'errors', projectId, timeRange: { period },
              select: [
                { field: 'issue_id' },
                { field: 'count()', alias: 'event_count' },
                { field: 'max(timestamp)', alias: 'last_seen' },
              ],
              conditions: [
                txnFilter,
                { field: "toString(issue_id)", op: '!=', value: '' },
              ],
              groupBy: ['issue_id'],
              orderBy: [{ field: 'event_count', direction: 'DESC' }],
              limit: 5,
            },
          }),

          // Duration histogram ??uses multiIf, needs rawQuery
          (() => {
            const bucket = getBucketingConfig(period);
            return optic.rawQuery({
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
          })(),

          // Suspect tags ??UNION ALL pattern, rawQuery
          (() => {
            const bucket = getBucketingConfig(period);
            return optic.rawQuery({
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
          })(),
        ]);

        // Enrich related issues with MySQL data
        let relatedIssuesList = batch.errors.data as any[];
        if (relatedIssuesList.length > 0) {
          const issueIds = relatedIssuesList.map((i: any) => i.issue_id);
          const [issueRows] = await mysqlPool.query(
            `SELECT id, title, level FROM g_argus_issues WHERE id IN (${issueIds.map(() => '?').join(',')})`,
            issueIds
          ) as any;

          relatedIssuesList = relatedIssuesList.map((r: any) => {
            const row = issueRows.find((i: any) => i.id === Number(r.issue_id));
            return {
              ...r,
              title: row?.title || `Issue #${r.issue_id}`,
              level: row?.level || 'error',
            };
          });
        }

        return reply.send({
          data: {
            summary: batch.summary.data[0] || {},
            trend: batch.trend.data,
            histogram: histogram.data,
            spans: [], // TODO: spans sub-query requires JOIN, handle separately
            recent_traces: batch.recentTraces.data,
            suspect_tags: relatedIssues.data,
            related_issues: relatedIssuesList,
          },
        });
      } catch (error) {
        logger.error('Failed to get transaction detail', {
          projectId, txnName,
          error: error instanceof Error ? error.message : String(error),
        });
        return reply.code(500).send({ error: 'Failed to get transaction detail' });
      }
    }
  );

  // ?€?€ Trace waterfall ??get all spans for a specific trace ?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€
  app.get(
    '/performance/:projectId/traces/:traceId',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId, traceId } = request.params as { projectId: string; traceId: string };

      try {
        const [txnResult, spansResult] = await Promise.all([
          optic.query({
            dataset: 'transactions', projectId,
            timeRange: { period: '30d' },
            select: [
              { field: 'event_id' }, { field: 'trace_id' }, { field: 'span_id' },
              { field: 'parent_span_id' }, { field: 'transaction' }, { field: 'transaction_op' },
              { field: 'transaction_status' }, { field: 'http_method' }, { field: 'http_status_code' },
              { field: 'timestamp' }, { field: 'start_timestamp' }, { field: 'duration' },
              { field: 'platform' }, { field: 'environment' }, { field: 'release' }, { field: 'user_id' },
            ],
            conditions: [{ field: 'trace_id', op: '=', value: traceId }],
            orderBy: [{ field: 'timestamp', direction: 'ASC' }],
            limit: 10,
          }),
          optic.query({
            dataset: 'spans', projectId,
            timeRange: { period: '30d' },
            select: [
              { field: 'span_id' }, { field: 'trace_id' }, { field: 'parent_span_id' },
              { field: 'transaction_id' }, { field: 'op' }, { field: 'description' },
              { field: 'status' }, { field: 'action' }, { field: 'domain' },
              { field: 'timestamp' }, { field: 'start_timestamp' }, { field: 'duration' },
              { field: 'data' }, { field: 'tags' },
            ],
            conditions: [{ field: 'trace_id', op: '=', value: traceId }],
            orderBy: [{ field: 'start_timestamp', direction: 'ASC' }],
          }),
        ]);

        const root = txnResult.data[0] || null;

        return reply.send({
          data: {
            trace_id: traceId,
            root,
            transactions: txnResult.data,
            spans: spansResult.data,
            total_spans: spansResult.data.length,
          },
        });
      } catch (error) {
        logger.error('Failed to get trace detail', {
          projectId, traceId,
          error: error instanceof Error ? error.message : String(error),
        });
        return reply.code(500).send({ error: 'Failed to get trace detail' });
      }
    }
  );
}

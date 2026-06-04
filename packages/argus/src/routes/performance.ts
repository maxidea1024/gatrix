import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { clickhouse } from '../config/clickhouse';
import { mysqlPool } from '../config/mysql';
import { getBucketingConfig } from '../utils/timeBucket';
import { createLogger } from '../utils/logger';

const logger = createLogger('performance-api');

export default async function performanceRoutes(app: FastifyInstance) {
  // Transaction list — top transactions by count, avg duration, p95
  app.get(
    '/performance/:projectId/transactions',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId } = request.params as { projectId: string };
      const { period = '24h', sort = 'count', limit = '20', start, end } = request.query as {
        period?: string;
        sort?: string;
        limit?: string;
        start?: string;
        end?: string;
      };
      const bucket = getBucketingConfig(period, start, end);
      const qp: Record<string, any> = { projectId: String(projectId), limit: parseInt(limit, 10), ...bucket.queryParams };
      const timeCond = `timestamp >= toDateTime({fillStart:UInt32}) AND timestamp <= toDateTime({fillEnd:UInt32})`;

      const orderBy = sort === 'p95' ? 'p95 DESC' : sort === 'avg' ? 'avg_duration DESC' : sort === 'error_rate' ? 'error_rate DESC' : 'count DESC';
      const timeFilter = timeCond;

      try {
        const result = await clickhouse.query({
          query: `
            SELECT
              transaction AS name,
              count() AS count,
              avg(duration) AS avg_duration,
              quantile(0.5)(duration) AS p50,
              quantile(0.75)(duration) AS p75,
              quantile(0.95)(duration) AS p95,
              quantile(0.99)(duration) AS p99,
              countIf(transaction_status != 'ok') / count() * 100 AS error_rate,
              max(timestamp) AS last_seen
            FROM argus.transactions
            WHERE project_id = {projectId:String}
              AND ${timeFilter}
            GROUP BY transaction
            ORDER BY ${orderBy}
            LIMIT {limit:UInt32}
          `,
          query_params: qp,
        });
        const data = await result.json();
        return reply.send({ data: data.data || [] });
      } catch (error) {
        logger.error('Failed to get transactions', {
          projectId,
          error: error instanceof Error ? error.message : String(error),
        });
        return reply.code(500).send({ error: 'Failed to get transactions' });
      }
    }
  );

  // Transaction detail — hourly trend for a specific transaction
  app.get(
    '/performance/:projectId/transactions/:txnName',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId, txnName } = request.params as { projectId: string; txnName: string };
      const { period = '24h' } = request.query as { period?: string };
      
      const bucket = getBucketingConfig(period);
      const qp = { projectId: String(projectId), txnName, ...bucket.queryParams };
      const timeCond = `timestamp >= toDateTime({fillStart:UInt32}) AND timestamp <= toDateTime({fillEnd:UInt32})`;

      try {
        // Hourly trend
        const trendResult = await clickhouse.query({
          query: `
            SELECT
              ${bucket.selectExpr} AS hour,
              count() AS count,
              avg(duration) AS avg_duration,
              quantile(0.95)(duration) AS p95,
              countIf(transaction_status != 'ok') / count() * 100 AS error_rate
            FROM argus.transactions
            WHERE project_id = {projectId:String}
              AND transaction = {txnName:String}
              AND ${timeCond}
            GROUP BY hour
            ORDER BY hour ${bucket.fillExpr}
          `,
          query_params: qp,
        });
        const trend = await trendResult.json();

        // Duration histogram (buckets)
        const histResult = await clickhouse.query({
          query: `
            SELECT
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
              AND ${timeCond}
            GROUP BY bucket
            ORDER BY min(duration)
          `,
          query_params: qp,
        });
        const histogram = await histResult.json();

        // Top spans — join spans with transactions via transaction_id
        const spansResult = await clickhouse.query({
          query: `
            SELECT
              s.description,
              s.op,
              count() AS count,
              avg(s.duration) AS avg_duration,
              quantile(0.95)(s.duration) AS p95
            FROM argus.spans s
            INNER JOIN (
              SELECT event_id
              FROM argus.transactions
              WHERE project_id = {projectId:String}
                AND transaction = {txnName:String}
                AND ${timeCond}
            ) t ON s.transaction_id = t.event_id
            WHERE s.project_id = {projectId:String}
              AND s.timestamp >= toDateTime({fillStart:UInt32}) AND s.timestamp <= toDateTime({fillEnd:UInt32})
            GROUP BY s.description, s.op
            ORDER BY avg_duration DESC
            LIMIT 20
          `,
          query_params: qp,
        });
        const spans = await spansResult.json();

        // Recent trace samples for this transaction
        const recentTracesResult = await clickhouse.query({
          query: `
            SELECT
              event_id,
              trace_id,
              timestamp,
              duration,
              transaction_status,
              http_status_code,
              span_count,
              user_id
            FROM argus.transactions
            WHERE project_id = {projectId:String}
              AND transaction = {txnName:String}
              AND ${timeCond}
            ORDER BY timestamp DESC
            LIMIT 20
          `,
          query_params: qp,
        });
        const recentTraces = await recentTracesResult.json();

        // Transaction Summary
        const summaryResult = await clickhouse.query({
          query: `
            SELECT
              count() AS count,
              avg(duration) AS avg_duration,
              quantile(0.5)(duration) AS p50,
              quantile(0.95)(duration) AS p95,
              countIf(transaction_status != 'ok') / count() * 100 AS error_rate
            FROM argus.transactions
            WHERE project_id = {projectId:String}
              AND transaction = {txnName:String}
              AND ${timeCond}
          `,
          query_params: qp,
        });
        const summaryData = await summaryResult.json();

        // Suspect Tags (Insights)
        const suspectTagsResult = await clickhouse.query({
          query: `
            SELECT 'browser' AS tag_key, tags['browser'] AS tag_value, count() AS count, avg(duration) AS avg_duration, quantile(0.95)(duration) AS p95
            FROM argus.transactions WHERE project_id = {projectId:String} AND transaction = {txnName:String} AND ${timeCond} AND tags['browser'] != '' GROUP BY tags['browser'] HAVING count > 0
            UNION ALL
            SELECT 'os' AS tag_key, tags['os'] AS tag_value, count() AS count, avg(duration) AS avg_duration, quantile(0.95)(duration) AS p95
            FROM argus.transactions WHERE project_id = {projectId:String} AND transaction = {txnName:String} AND ${timeCond} AND tags['os'] != '' GROUP BY tags['os'] HAVING count > 0
            UNION ALL
            SELECT 'environment' AS tag_key, environment AS tag_value, count() AS count, avg(duration) AS avg_duration, quantile(0.95)(duration) AS p95
            FROM argus.transactions WHERE project_id = {projectId:String} AND transaction = {txnName:String} AND ${timeCond} AND environment != '' GROUP BY environment HAVING count > 0
          `,
          query_params: qp,
        });
        const suspectTagsData = await suspectTagsResult.json();

        // Related Issues
        const errorsResult = await clickhouse.query({
          query: `
            SELECT
              issue_id,
              count() AS event_count,
              max(timestamp) AS last_seen
            FROM argus.errors
            WHERE project_id = {projectId:String}
              AND transaction = {txnName:String}
              AND ${timeCond}
              AND toString(issue_id) != ''
            GROUP BY issue_id
            ORDER BY event_count DESC
            LIMIT 5
          `,
          query_params: qp,
        });
        const errorsData = await errorsResult.json();
        let relatedIssues = (errorsData.data || []) as any[];

        if (relatedIssues.length > 0) {
          const issueIds = relatedIssues.map(i => i.issue_id);
          const [issueRows] = await mysqlPool.query(
            `SELECT id, title, level FROM g_argus_issues WHERE id IN (${issueIds.map(() => '?').join(',')})`,
            issueIds
          ) as any;
          
          relatedIssues = relatedIssues.map(r => {
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
            summary: (summaryData.data as any[])?.[0] || {},
            trend: trend.data || [],
            histogram: histogram.data || [],
            spans: spans.data || [],
            recent_traces: recentTraces.data || [],
            suspect_tags: suspectTagsData.data || [],
            related_issues: relatedIssues,
          },
        });
      } catch (error) {
        logger.error('Failed to get transaction detail', {
          projectId,
          txnName,
          error: error instanceof Error ? error.message : String(error),
        });
        return reply.code(500).send({ error: 'Failed to get transaction detail' });
      }
    }
  );

  // Trace waterfall — get all spans for a specific trace
  app.get(
    '/performance/:projectId/traces/:traceId',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId, traceId } = request.params as { projectId: string; traceId: string };

      try {
        // Get the root transaction
        const txnResult = await clickhouse.query({
          query: `
            SELECT
              event_id,
              trace_id,
              span_id,
              parent_span_id,
              transaction,
              transaction_op,
              transaction_status,
              http_method,
              http_status_code,
              timestamp,
              start_timestamp,
              duration,
              platform,
              environment,
              release,
              user_id
            FROM argus.transactions
            WHERE project_id = {projectId:String}
              AND trace_id = {traceId:String}
            ORDER BY timestamp
            LIMIT 10
          `,
          query_params: { projectId: String(projectId), traceId },
        });
        const txnData = await txnResult.json();

        // Get all spans for this trace
        const spansResult = await clickhouse.query({
          query: `
            SELECT
              span_id,
              trace_id,
              parent_span_id,
              transaction_id,
              op,
              description,
              status,
              action,
              domain,
              timestamp,
              start_timestamp,
              duration,
              data,
              tags
            FROM argus.spans
            WHERE project_id = {projectId:String}
              AND trace_id = {traceId:String}
            ORDER BY start_timestamp
          `,
          query_params: { projectId: String(projectId), traceId },
        });
        const spansData = await spansResult.json();

        const transactions = txnData.data || [];
        const spans = spansData.data || [];

        // Build the root info from the first transaction
        const root = transactions[0] || null;

        return reply.send({
          data: {
            trace_id: traceId,
            root,
            transactions,
            spans,
            total_spans: spans.length,
          },
        });
      } catch (error) {
        logger.error('Failed to get trace detail', {
          projectId,
          traceId,
          error: error instanceof Error ? error.message : String(error),
        });
        return reply.code(500).send({ error: 'Failed to get trace detail' });
      }
    }
  );
}

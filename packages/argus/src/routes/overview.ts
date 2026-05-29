import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { clickhouse } from '../config/clickhouse';
import { createLogger } from '../utils/logger';

const logger = createLogger('overview-api');

export default async function overviewRoutes(app: FastifyInstance) {
  // Overview stats for a project — aggregates errors, transactions, sessions
  app.get(
    '/overview/:projectId',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId } = request.params as { projectId: string };
      const { period = '24h' } = request.query as { period?: string };

      const periodMap: Record<string, string> = {
        '1h': '1 HOUR',
        '6h': '6 HOUR',
        '24h': '24 HOUR',
        '7d': '7 DAY',
        '30d': '30 DAY',
      };
      const interval = periodMap[period] || '24 HOUR';

      try {
        // Error trend (hourly)
        const errorTrendResult = await clickhouse.query({
          query: `
            SELECT
              toStartOfHour(timestamp) AS hour,
              count() AS count,
              uniq(user_id) AS users
            FROM argus.errors
            WHERE project_id = {projectId:String}
              AND timestamp >= now() - INTERVAL ${interval}
            GROUP BY hour
            ORDER BY hour
          `,
          query_params: { projectId: String(projectId) },
        });
        const errorTrend = await errorTrendResult.json();

        // Error summary
        const errorSummaryResult = await clickhouse.query({
          query: `
            SELECT
              count() AS total_errors,
              uniq(user_id) AS affected_users,
              uniq(fingerprint) AS unique_issues
            FROM argus.errors
            WHERE project_id = {projectId:String}
              AND timestamp >= now() - INTERVAL ${interval}
          `,
          query_params: { projectId: String(projectId) },
        });
        const errorSummary = await errorSummaryResult.json();

        // Transaction summary
        const txnSummaryResult = await clickhouse.query({
          query: `
            SELECT
              count() AS total_transactions,
              avg(duration) AS avg_duration,
              quantile(0.5)(duration) AS p50,
              quantile(0.95)(duration) AS p95,
              quantile(0.99)(duration) AS p99,
              countIf(status != 'ok') / count() * 100 AS error_rate
            FROM argus.transactions
            WHERE project_id = {projectId:String}
              AND timestamp >= now() - INTERVAL ${interval}
          `,
          query_params: { projectId: String(projectId) },
        });
        const txnSummary = await txnSummaryResult.json();

        // Transaction throughput (hourly)
        const txnTrendResult = await clickhouse.query({
          query: `
            SELECT
              toStartOfHour(timestamp) AS hour,
              count() AS count,
              avg(duration) AS avg_duration
            FROM argus.transactions
            WHERE project_id = {projectId:String}
              AND timestamp >= now() - INTERVAL ${interval}
            GROUP BY hour
            ORDER BY hour
          `,
          query_params: { projectId: String(projectId) },
        });
        const txnTrend = await txnTrendResult.json();

        // Session summary
        const sessionSummaryResult = await clickhouse.query({
          query: `
            SELECT
              count() AS total_sessions,
              countIf(status = 'crashed') AS crashed_sessions,
              countIf(status = 'errored') AS errored_sessions,
              if(count() > 0, (count() - countIf(status = 'crashed')) / count() * 100, 100) AS crash_free_rate
            FROM argus.sessions
            WHERE project_id = {projectId:String}
              AND timestamp >= now() - INTERVAL ${interval}
          `,
          query_params: { projectId: String(projectId) },
        });
        const sessionSummary = await sessionSummaryResult.json();

        // Top 5 issues
        const topIssuesResult = await clickhouse.query({
          query: `
            SELECT
              fingerprint,
              any(exception_type) AS title,
              any(exception_value) AS subtitle,
              count() AS event_count,
              uniq(user_id) AS user_count,
              max(timestamp) AS last_seen
            FROM argus.errors
            WHERE project_id = {projectId:String}
              AND timestamp >= now() - INTERVAL ${interval}
            GROUP BY fingerprint
            ORDER BY event_count DESC
            LIMIT 5
          `,
          query_params: { projectId: String(projectId) },
        });
        const topIssues = await topIssuesResult.json();

        return reply.send({
          data: {
            error_trend: errorTrend.data || [],
            error_summary: (errorSummary.data as any[])?.[0] || { total_errors: 0, affected_users: 0, unique_issues: 0 },
            transaction_summary: (txnSummary.data as any[])?.[0] || { total_transactions: 0, avg_duration: 0, p50: 0, p95: 0, p99: 0, error_rate: 0 },
            transaction_trend: txnTrend.data || [],
            session_summary: (sessionSummary.data as any[])?.[0] || { total_sessions: 0, crashed_sessions: 0, errored_sessions: 0, crash_free_rate: 100 },
            top_issues: topIssues.data || [],
          },
        });
      } catch (error) {
        logger.error('Failed to get overview stats', {
          projectId,
          error: error instanceof Error ? error.message : String(error),
        });
        return reply.code(500).send({ error: 'Failed to get overview stats' });
      }
    }
  );
}

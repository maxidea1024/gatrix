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
        const qp = { projectId: String(projectId) };

        // ---- Run all queries in parallel ----
        const [
          errorTrendResult,
          errorSummaryResult,
          txnSummaryResult,
          txnTrendResult,
          sessionSummaryResult,
          topIssuesResult,
          heatmapResult,
          envDistResult,
          browserDistResult,
          osDistResult,
          releaseDistResult,
          unhandledResult,
          prevErrorResult,
          prevTxnResult,
          prevSessionResult,
        ] = await Promise.all([
          // --- Existing queries ---
          clickhouse.query({
            query: `SELECT toStartOfHour(timestamp) AS hour, count() AS count, uniq(user_id) AS users
                    FROM argus.errors WHERE project_id = {projectId:String} AND timestamp >= now() - INTERVAL ${interval}
                    GROUP BY hour ORDER BY hour`,
            query_params: qp,
          }),
          clickhouse.query({
            query: `SELECT count() AS total_errors, uniq(user_id) AS affected_users, uniq(primary_hash) AS unique_issues
                    FROM argus.errors WHERE project_id = {projectId:String} AND timestamp >= now() - INTERVAL ${interval}`,
            query_params: qp,
          }),
          clickhouse.query({
            query: `SELECT count() AS total_transactions, avg(duration) AS avg_duration,
                    quantile(0.5)(duration) AS p50, quantile(0.95)(duration) AS p95, quantile(0.99)(duration) AS p99,
                    countIf(transaction_status != 'ok') / count() * 100 AS error_rate
                    FROM argus.transactions WHERE project_id = {projectId:String} AND timestamp >= now() - INTERVAL ${interval}`,
            query_params: qp,
          }),
          clickhouse.query({
            query: `SELECT toStartOfHour(timestamp) AS hour, count() AS count, avg(duration) AS avg_duration
                    FROM argus.transactions WHERE project_id = {projectId:String} AND timestamp >= now() - INTERVAL ${interval}
                    GROUP BY hour ORDER BY hour`,
            query_params: qp,
          }),
          clickhouse.query({
            query: `SELECT count() AS total_sessions, countIf(status = 'crashed') AS crashed_sessions,
                    countIf(status = 'errored') AS errored_sessions,
                    if(count() > 0, (count() - countIf(status = 'crashed')) / count() * 100, 100) AS crash_free_rate
                    FROM argus.sessions WHERE project_id = {projectId:String} AND timestamp >= now() - INTERVAL ${interval}`,
            query_params: qp,
          }),
          clickhouse.query({
            query: `SELECT primary_hash, any(type) AS title, any(value) AS subtitle, any(level) AS level,
                    count() AS event_count, uniq(user_id) AS user_count, max(timestamp) AS last_seen
                    FROM argus.errors WHERE project_id = {projectId:String} AND timestamp >= now() - INTERVAL ${interval}
                    GROUP BY primary_hash ORDER BY event_count DESC LIMIT 5`,
            query_params: qp,
          }),

          // --- NEW: Error heatmap (7d × 24h) ---
          clickhouse.query({
            query: `SELECT toDayOfWeek(timestamp) AS day, toHour(timestamp) AS hour, count() AS count
                    FROM argus.errors WHERE project_id = {projectId:String} AND timestamp >= now() - INTERVAL 7 DAY
                    GROUP BY day, hour ORDER BY day, hour`,
            query_params: qp,
          }),

          // --- NEW: Error by environment ---
          clickhouse.query({
            query: `SELECT if(environment = '', 'unknown', environment) AS environment, count() AS count
                    FROM argus.errors WHERE project_id = {projectId:String} AND timestamp >= now() - INTERVAL ${interval}
                    GROUP BY environment ORDER BY count DESC LIMIT 10`,
            query_params: qp,
          }),

          // --- NEW: Error by browser ---
          clickhouse.query({
            query: `SELECT if(browser_name = '', 'Unknown', browser_name) AS browser, count() AS count
                    FROM argus.errors WHERE project_id = {projectId:String} AND timestamp >= now() - INTERVAL ${interval}
                    GROUP BY browser ORDER BY count DESC LIMIT 8`,
            query_params: qp,
          }),

          // --- NEW: Error by OS ---
          clickhouse.query({
            query: `SELECT if(os_name = '', 'Unknown', os_name) AS os, count() AS count
                    FROM argus.errors WHERE project_id = {projectId:String} AND timestamp >= now() - INTERVAL ${interval}
                    GROUP BY os ORDER BY count DESC LIMIT 8`,
            query_params: qp,
          }),

          // --- NEW: Error by release ---
          clickhouse.query({
            query: `SELECT if(release = '', 'unknown', release) AS release, count() AS count,
                    uniq(user_id) AS users
                    FROM argus.errors WHERE project_id = {projectId:String} AND timestamp >= now() - INTERVAL ${interval}
                    GROUP BY release ORDER BY count DESC LIMIT 5`,
            query_params: qp,
          }),

          // --- NEW: Unhandled error rate ---
          clickhouse.query({
            query: `SELECT
                    countIf(is_handled = 0) AS unhandled,
                    count() AS total,
                    if(count() > 0, countIf(is_handled = 0) / count() * 100, 0) AS unhandled_rate
                    FROM argus.errors WHERE project_id = {projectId:String} AND timestamp >= now() - INTERVAL ${interval}`,
            query_params: qp,
          }),

          // --- NEW: Previous period — errors ---
          clickhouse.query({
            query: `SELECT count() AS total_errors, uniq(user_id) AS affected_users
                    FROM argus.errors WHERE project_id = {projectId:String}
                    AND timestamp >= now() - INTERVAL ${interval} - INTERVAL ${interval}
                    AND timestamp < now() - INTERVAL ${interval}`,
            query_params: qp,
          }),

          // --- NEW: Previous period — transactions ---
          clickhouse.query({
            query: `SELECT count() AS total_transactions
                    FROM argus.transactions WHERE project_id = {projectId:String}
                    AND timestamp >= now() - INTERVAL ${interval} - INTERVAL ${interval}
                    AND timestamp < now() - INTERVAL ${interval}`,
            query_params: qp,
          }),

          // --- NEW: Previous period — sessions ---
          clickhouse.query({
            query: `SELECT
                    if(count() > 0, (count() - countIf(status = 'crashed')) / count() * 100, 100) AS crash_free_rate
                    FROM argus.sessions WHERE project_id = {projectId:String}
                    AND timestamp >= now() - INTERVAL ${interval} - INTERVAL ${interval}
                    AND timestamp < now() - INTERVAL ${interval}`,
            query_params: qp,
          }),
        ]);

        // ---- Parse all results ----
        const [
          errorTrend, errorSummary, txnSummary, txnTrend,
          sessionSummary, topIssues,
          heatmap, envDist, browserDist, osDist, releaseDist, unhandled,
          prevError, prevTxn, prevSession,
        ] = await Promise.all([
          errorTrendResult.json(),
          errorSummaryResult.json(),
          txnSummaryResult.json(),
          txnTrendResult.json(),
          sessionSummaryResult.json(),
          topIssuesResult.json(),
          heatmapResult.json(),
          envDistResult.json(),
          browserDistResult.json(),
          osDistResult.json(),
          releaseDistResult.json(),
          unhandledResult.json(),
          prevErrorResult.json(),
          prevTxnResult.json(),
          prevSessionResult.json(),
        ]);

        const unhandledRow = (unhandled.data as any[])?.[0] || { unhandled_rate: 0 };
        const prevErrorRow = (prevError.data as any[])?.[0] || { total_errors: 0, affected_users: 0 };
        const prevTxnRow = (prevTxn.data as any[])?.[0] || { total_transactions: 0 };
        const prevSessionRow = (prevSession.data as any[])?.[0] || { crash_free_rate: 100 };

        return reply.send({
          data: {
            error_trend: errorTrend.data || [],
            error_summary: (errorSummary.data as any[])?.[0] || { total_errors: 0, affected_users: 0, unique_issues: 0 },
            transaction_summary: (txnSummary.data as any[])?.[0] || { total_transactions: 0, avg_duration: 0, p50: 0, p95: 0, p99: 0, error_rate: 0 },
            transaction_trend: txnTrend.data || [],
            session_summary: (sessionSummary.data as any[])?.[0] || { total_sessions: 0, crashed_sessions: 0, errored_sessions: 0, crash_free_rate: 100 },
            top_issues: topIssues.data || [],
            // NEW fields
            error_heatmap: heatmap.data || [],
            error_by_environment: envDist.data || [],
            error_by_browser: browserDist.data || [],
            error_by_os: osDist.data || [],
            error_by_release: releaseDist.data || [],
            unhandled_rate: Number(unhandledRow.unhandled_rate) || 0,
            previous_period: {
              total_errors: Number(prevErrorRow.total_errors) || 0,
              affected_users: Number(prevErrorRow.affected_users) || 0,
              total_transactions: Number(prevTxnRow.total_transactions) || 0,
              crash_free_rate: Number(prevSessionRow.crash_free_rate) || 100,
            },
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

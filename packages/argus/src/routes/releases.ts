import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { clickhouse } from '../config/clickhouse';
import { mysqlPool } from '../config/mysql';
import { createLogger } from '../utils/logger';

const logger = createLogger('releases-api');

export default async function releasesRoutes(app: FastifyInstance) {
  // List releases with enriched stats
  app.get(
    '/releases/:projectId',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId } = request.params as { projectId: string };
      const { period = '30d' } = request.query as { period?: string };
      const interval = periodToInterval(period);
      const qp = { projectId: String(projectId) };

      try {
        const [projectsRows] = await mysqlPool.query(
          'SELECT id FROM g_argus_projects WHERE gatrix_project_id = ?',
          [projectId]
        );
        const internalProjectId = (projectsRows as any[])[0]?.id;
        if (!internalProjectId) return reply.code(404).send({ error: 'Project not found' });
        const [errorResult, sessionResult, txnResult, trendResult, newIssuesResult] = await Promise.all([
          // Error stats per release
          clickhouse.query({
            query: `SELECT
              release,
              min(timestamp) AS first_seen,
              max(timestamp) AS last_seen,
              count() AS error_count,
              uniq(user_id) AS affected_users,
              uniqExact(fingerprint) AS issue_count,
              countIf(level = 'fatal') AS fatal_count,
              countIf(is_handled = 0) AS unhandled_count
            FROM argus.errors
            WHERE project_id = {projectId:String} AND timestamp >= now() - INTERVAL ${interval} AND release != ''
            GROUP BY release ORDER BY last_seen DESC`,
            query_params: qp,
          }),

          // Session crash-free per release
          clickhouse.query({
            query: `SELECT
              release,
              count() AS total_sessions,
              countIf(status = 'crashed') AS crashed,
              if(total_sessions > 0, (1 - crashed / total_sessions) * 100, 100) AS crash_free_rate,
              uniq(distinct_id) AS session_users,
              uniqIf(distinct_id, status = 'crashed') AS crashed_users,
              if(session_users > 0, (1 - crashed_users / session_users) * 100, 100) AS crash_free_users
            FROM argus.sessions
            WHERE project_id = {projectId:String} AND started >= now() - INTERVAL ${interval} AND release != ''
            GROUP BY release`,
            query_params: qp,
          }),

          // Transaction performance per release
          clickhouse.query({
            query: `SELECT
              release,
              count() AS transaction_count,
              avg(duration) AS avg_duration,
              quantile(0.95)(duration) AS p95,
              countIf(transaction_status != 'ok') / count() * 100 AS error_rate
            FROM argus.transactions
            WHERE project_id = {projectId:String} AND timestamp >= now() - INTERVAL ${interval} AND release != ''
            GROUP BY release`,
            query_params: qp,
          }),

          // NEW: Error trend per release (daily, for sparklines)
          clickhouse.query({
            query: `SELECT
              release,
              toStartOfDay(timestamp) AS day,
              count() AS count
            FROM argus.errors
            WHERE project_id = {projectId:String} AND timestamp >= now() - INTERVAL ${interval} AND release != ''
            GROUP BY release, day ORDER BY release, day`,
            query_params: qp,
          }),

          // New Issues from MySQL
          mysqlPool.query(
            `SELECT first_release as release_name, COUNT(*) as new_issues 
             FROM g_argus_issues 
             WHERE project_id = ? AND first_release IS NOT NULL 
             GROUP BY first_release`,
            [internalProjectId]
          ),
        ]);

        const [errorData, sessionData, txnData, trendData] = await Promise.all([
          errorResult.json(),
          sessionResult.json(),
          txnResult.json(),
          trendResult.json(),
        ]);
        const newIssuesRows = newIssuesResult[0] as any[];

        const sessionMap = new Map<string, any>();
        for (const s of (sessionData.data || []) as any[]) {
          sessionMap.set(s.release, s);
        }

        const txnMap = new Map<string, any>();
        for (const t of (txnData.data || []) as any[]) {
          txnMap.set(t.release, t);
        }

        // Build trend sparklines per release
        const trendMap = new Map<string, number[]>();
        for (const t of (trendData.data || []) as any[]) {
          if (!trendMap.has(t.release)) trendMap.set(t.release, []);
          trendMap.get(t.release)!.push(Number(t.count));
        }

        const newIssuesMap = new Map<string, number>();
        for (const row of newIssuesRows) {
          newIssuesMap.set(row.release_name, row.new_issues);
        }

        const releases = ((errorData.data || []) as any[]).map((r: any) => {
          const sess = sessionMap.get(r.release);
          const txn = txnMap.get(r.release);
          return {
            ...r,
            total_sessions: Number(sess?.total_sessions || 0),
            crash_free_rate: Number(sess?.crash_free_rate || 100),
            crash_free_users: Number(sess?.crash_free_users || 100), // Note: We need this from clickhouse if we add it
            session_users: Number(sess?.session_users || 0),
            transaction_count: Number(txn?.transaction_count || 0),
            avg_duration: Number(txn?.avg_duration || 0),
            p95: Number(txn?.p95 || 0),
            txn_error_rate: Number(txn?.error_rate || 0),
            error_trend: trendMap.get(r.release) || [],
            new_issues: newIssuesMap.get(r.release) || 0,
          };
        });

        return reply.send({ data: releases });
      } catch (error) {
        logger.error('Failed to get releases', {
          projectId,
          error: error instanceof Error ? error.message : String(error),
        });
        return reply.code(500).send({ error: 'Failed to get releases' });
      }
    }
  );
}

function periodToInterval(period: string): string {
  const map: Record<string, string> = {
    '7d': '7 DAY',
    '30d': '30 DAY',
    '90d': '90 DAY',
  };
  return map[period] || '30 DAY';
}

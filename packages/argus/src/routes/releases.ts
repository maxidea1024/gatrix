import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { clickhouse } from '../config/clickhouse';
import { mysqlPool } from '../config/mysql';
import { getBucketingConfig } from '../utils/timeBucket';
import { createLogger } from '../utils/logger';

const logger = createLogger('releases-api');

export default async function releasesRoutes(app: FastifyInstance) {
  // Release health time-series (for a specific release)
  app.get(
    '/releases/:projectId/health',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId } = request.params as { projectId: string };
      const { release, period = '30d' } = request.query as { release: string; period?: string };

      if (!release) {
        return reply.code(400).send({ error: 'release query param is required' });
      }

      const bucket = getBucketingConfig(period, undefined, undefined, 'started');
      const qp = { projectId: String(projectId), release, ...bucket.queryParams };
      const startedTimeCond = `started >= toDateTime({fillStart:UInt32}) AND started <= toDateTime({fillEnd:UInt32})`;

      try {
        const result = await clickhouse.query({
          query: `SELECT
            ${bucket.selectExpr} AS timestamp,
            count() AS total_sessions,
            countIf(status = 'crashed') AS crashed_sessions,
            countIf(status = 'errored') AS errored_sessions,
            countIf(status = 'abnormal') AS abnormal_sessions,
            countIf(status IN ('ok', 'exited')) AS healthy_sessions,
            if(count() > 0, (1 - countIf(status = 'crashed') / count()) * 100, 100) AS crash_free_rate,
            uniq(distinct_id) AS total_users,
            uniqIf(distinct_id, status = 'crashed') AS crashed_users,
            if(uniq(distinct_id) > 0, (1 - uniqIf(distinct_id, status = 'crashed') / uniq(distinct_id)) * 100, 100) AS crash_free_users
          FROM argus.sessions
          WHERE project_id = {projectId:String} AND release = {release:String} AND ${startedTimeCond}
          GROUP BY timestamp ORDER BY timestamp ${bucket.fillExpr}`,
          query_params: qp,
        });

        const data = await result.json();
        return reply.send({ data: data.data || [] });
      } catch (error) {
        logger.error('Failed to get release health', {
          projectId,
          release,
          error: error instanceof Error ? error.message : String(error),
        });
        return reply.code(500).send({ error: 'Failed to get release health' });
      }
    }
  );

  // List releases with enriched stats
  app.get(
    '/releases/:projectId',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId } = request.params as { projectId: string };
      const { period = '30d' } = request.query as { period?: string };
      
      const bucket = getBucketingConfig(period);
      const qp = { projectId: String(projectId), ...bucket.queryParams };
      const timeCond = `timestamp >= toDateTime({fillStart:UInt32}) AND timestamp <= toDateTime({fillEnd:UInt32})`;
      const startedTimeCond = `started >= toDateTime({fillStart:UInt32}) AND started <= toDateTime({fillEnd:UInt32})`;

      try {
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
            WHERE project_id = {projectId:String} AND ${timeCond} AND release != ''
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
            WHERE project_id = {projectId:String} AND ${startedTimeCond} AND release != ''
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
            WHERE project_id = {projectId:String} AND ${timeCond} AND release != ''
            GROUP BY release`,
            query_params: qp,
          }),

          // NEW: Error trend per release (daily, for sparklines)
          clickhouse.query({
            query: `SELECT
              release,
              ${bucket.selectExpr} AS day,
              count() AS count
            FROM argus.errors
            WHERE project_id = {projectId:String} AND ${timeCond} AND release != ''
            GROUP BY release, day ORDER BY release, day`,
            query_params: qp,
          }),

          // New Issues from MySQL
          mysqlPool.query(
            `SELECT first_release as release_name, COUNT(*) as new_issues 
             FROM g_argus_issues 
             WHERE project_id = ? AND first_release IS NOT NULL 
             GROUP BY first_release`,
            [projectId]
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

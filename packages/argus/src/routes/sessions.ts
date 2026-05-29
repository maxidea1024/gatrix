import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { clickhouse } from '../config/clickhouse';
import { createLogger } from '../utils/logger';

const logger = createLogger('sessions-api');

export default async function sessionsRoutes(app: FastifyInstance) {
  // Session health overview
  app.get(
    '/sessions/:projectId',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId } = request.params as { projectId: string };
      const { period = '24h' } = request.query as { period?: string };
      const interval = periodToInterval(period);
      const qp = { projectId: String(projectId) };

      try {
        const [
          summaryResult,
          trendResult,
          releaseResult,
          durationDistResult,
          statusTimelineResult,
          crashByBrowserResult,
          crashByOsResult,
          prevPeriodResult,
        ] = await Promise.all([
          // Summary stats
          clickhouse.query({
            query: `SELECT
              count() AS total_sessions,
              countIf(status = 'crashed') AS crashed,
              countIf(status = 'errored') AS errored,
              countIf(status IN ('ok', 'exited')) AS healthy,
              countIf(status = 'abnormal') AS abnormal,
              if(total_sessions > 0, (1 - crashed / total_sessions) * 100, 100) AS crash_free_rate,
              uniq(distinct_id) AS unique_users,
              avg(duration) AS avg_duration
            FROM argus.sessions
            WHERE project_id = {projectId:String} AND started >= now() - INTERVAL ${interval}`,
            query_params: qp,
          }),

          // Hourly trend
          clickhouse.query({
            query: `SELECT
              toStartOfHour(started) AS hour,
              count() AS total,
              countIf(status = 'crashed') AS crashed,
              countIf(status IN ('ok', 'exited')) AS healthy,
              if(total > 0, (1 - crashed / total) * 100, 100) AS crash_free_rate
            FROM argus.sessions
            WHERE project_id = {projectId:String} AND started >= now() - INTERVAL ${interval}
            GROUP BY hour ORDER BY hour`,
            query_params: qp,
          }),

          // By release
          clickhouse.query({
            query: `SELECT
              release,
              count() AS total,
              countIf(status = 'crashed') AS crashed,
              if(total > 0, (1 - crashed / total) * 100, 100) AS crash_free_rate,
              uniq(distinct_id) AS users
            FROM argus.sessions
            WHERE project_id = {projectId:String} AND started >= now() - INTERVAL ${interval} AND release != ''
            GROUP BY release ORDER BY total DESC LIMIT 10`,
            query_params: qp,
          }),

          // NEW: Duration distribution
          clickhouse.query({
            query: `SELECT
              multiIf(
                duration < 5000, '<5s',
                duration < 15000, '5-15s',
                duration < 30000, '15-30s',
                duration < 60000, '30-60s',
                duration < 300000, '1-5m',
                duration < 600000, '5-10m',
                '10m+'
              ) AS bucket,
              count() AS count
            FROM argus.sessions
            WHERE project_id = {projectId:String} AND started >= now() - INTERVAL ${interval}
            GROUP BY bucket ORDER BY min(duration)`,
            query_params: qp,
          }),

          // NEW: Status timeline (stacked area data)
          clickhouse.query({
            query: `SELECT
              toStartOfHour(started) AS hour,
              countIf(status IN ('ok', 'exited')) AS healthy,
              countIf(status = 'errored') AS errored,
              countIf(status = 'crashed') AS crashed,
              countIf(status = 'abnormal') AS abnormal
            FROM argus.sessions
            WHERE project_id = {projectId:String} AND started >= now() - INTERVAL ${interval}
            GROUP BY hour ORDER BY hour`,
            query_params: qp,
          }),

          // NEW: Crashes by browser
          clickhouse.query({
            query: `SELECT
              if(browser = '', 'Unknown', browser) AS browser,
              count() AS total,
              countIf(status = 'crashed') AS crashed,
              if(total > 0, crashed / total * 100, 0) AS crash_rate
            FROM argus.sessions
            WHERE project_id = {projectId:String} AND started >= now() - INTERVAL ${interval}
            GROUP BY browser ORDER BY total DESC LIMIT 8`,
            query_params: qp,
          }),

          // NEW: Crashes by OS
          clickhouse.query({
            query: `SELECT
              if(os = '', 'Unknown', os) AS os,
              count() AS total,
              countIf(status = 'crashed') AS crashed,
              if(total > 0, crashed / total * 100, 0) AS crash_rate
            FROM argus.sessions
            WHERE project_id = {projectId:String} AND started >= now() - INTERVAL ${interval}
            GROUP BY os ORDER BY total DESC LIMIT 8`,
            query_params: qp,
          }),

          // NEW: Previous period comparison
          clickhouse.query({
            query: `SELECT
              count() AS total_sessions,
              countIf(status = 'crashed') AS crashed,
              if(total_sessions > 0, (1 - crashed / total_sessions) * 100, 100) AS crash_free_rate,
              uniq(distinct_id) AS unique_users
            FROM argus.sessions
            WHERE project_id = {projectId:String}
              AND started >= now() - INTERVAL ${interval} - INTERVAL ${interval}
              AND started < now() - INTERVAL ${interval}`,
            query_params: qp,
          }),
        ]);

        const [summary, trend, byRelease, durationDist, statusTimeline, crashByBrowser, crashByOs, prevPeriod] =
          await Promise.all([
            summaryResult.json(),
            trendResult.json(),
            releaseResult.json(),
            durationDistResult.json(),
            statusTimelineResult.json(),
            crashByBrowserResult.json(),
            crashByOsResult.json(),
            prevPeriodResult.json(),
          ]);

        return reply.send({
          data: {
            summary: (summary.data as any[])?.[0] || {},
            trend: trend.data || [],
            by_release: byRelease.data || [],
            duration_distribution: durationDist.data || [],
            status_timeline: statusTimeline.data || [],
            crash_by_browser: crashByBrowser.data || [],
            crash_by_os: crashByOs.data || [],
            previous_period: (prevPeriod.data as any[])?.[0] || { total_sessions: 0, crashed: 0, crash_free_rate: 100, unique_users: 0 },
          },
        });
      } catch (error) {
        logger.error('Failed to get session health', {
          projectId,
          error: error instanceof Error ? error.message : String(error),
        });
        return reply.code(500).send({ error: 'Failed to get session health' });
      }
    }
  );
}

function periodToInterval(period: string): string {
  const map: Record<string, string> = {
    '1h': '1 HOUR',
    '6h': '6 HOUR',
    '24h': '24 HOUR',
    '7d': '7 DAY',
    '30d': '30 DAY',
  };
  return map[period] || '24 HOUR';
}

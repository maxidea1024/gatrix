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

      try {
        // Summary stats
        const summaryResult = await clickhouse.query({
          query: `
            SELECT
              count() AS total_sessions,
              countIf(status = 'crashed') AS crashed,
              countIf(status = 'errored') AS errored,
              countIf(status = 'healthy') AS healthy,
              countIf(status = 'abnormal') AS abnormal,
              if(total_sessions > 0, (1 - crashed / total_sessions) * 100, 100) AS crash_free_rate,
              uniq(distinct_id) AS unique_users,
              avg(duration) AS avg_duration
            FROM argus.sessions
            WHERE project_id = {projectId:String}
              AND started >= now() - INTERVAL ${interval}
          `,
          query_params: { projectId: String(projectId) },
        });
        const summary = await summaryResult.json();

        // Hourly trend
        const trendResult = await clickhouse.query({
          query: `
            SELECT
              toStartOfHour(started) AS hour,
              count() AS total,
              countIf(status = 'crashed') AS crashed,
              countIf(status = 'healthy') AS healthy,
              if(total > 0, (1 - crashed / total) * 100, 100) AS crash_free_rate
            FROM argus.sessions
            WHERE project_id = {projectId:String}
              AND started >= now() - INTERVAL ${interval}
            GROUP BY hour
            ORDER BY hour
          `,
          query_params: { projectId: String(projectId) },
        });
        const trend = await trendResult.json();

        // By release
        const releaseResult = await clickhouse.query({
          query: `
            SELECT
              release,
              count() AS total,
              countIf(status = 'crashed') AS crashed,
              if(total > 0, (1 - crashed / total) * 100, 100) AS crash_free_rate,
              uniq(distinct_id) AS users
            FROM argus.sessions
            WHERE project_id = {projectId:String}
              AND started >= now() - INTERVAL ${interval}
              AND release != ''
            GROUP BY release
            ORDER BY total DESC
            LIMIT 10
          `,
          query_params: { projectId: String(projectId) },
        });
        const byRelease = await releaseResult.json();

        return reply.send({
          data: {
            summary: (summary.data as any[])?.[0] || {},
            trend: trend.data || [],
            by_release: byRelease.data || [],
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

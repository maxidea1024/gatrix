import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { optic } from '@gatrix/argus-optic';
import { getBucketingConfig } from '../utils/timeBucket';
import { createLogger } from '../utils/logger';

const logger = createLogger('sessions-api');

/** Shared session query defaults */
const SESSION_DEFAULTS = {
  dataset: 'sessions' as const,
  timestampField: 'started',
};

export default async function sessionsRoutes(app: FastifyInstance) {
  // ?�?� Session health overview ?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�
  app.get(
    '/sessions/:projectId',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId } = request.params as { projectId: string };
      const { period = '24h' } = request.query as { period?: string };

      try {
        // Compute previous period range
        const ms: Record<string, number> = {
          '1h': 3_600_000,
          '6h': 21_600_000,
          '24h': 86_400_000,
          '7d': 604_800_000,
          '30d': 2_592_000_000,
        };
        const periodMs = ms[period] || 86_400_000;
        const now = Date.now();
        const prevRange = {
          start: new Date(now - 2 * periodMs).toISOString(),
          end: new Date(now - periodMs).toISOString(),
        };

        const [batch, prevPeriod] = await Promise.all([
          optic.queryBatch({
            summary: {
              ...SESSION_DEFAULTS,
              projectId,
              timeRange: { period },
              select: [
                { field: 'count()', alias: 'total_sessions' },
                { field: "countIf(status = 'crashed')", alias: 'crashed' },
                { field: "countIf(status = 'errored')", alias: 'errored' },
                {
                  field: "countIf(status IN ('ok', 'exited'))",
                  alias: 'healthy',
                },
                { field: "countIf(status = 'abnormal')", alias: 'abnormal' },
                {
                  field:
                    "if(count() > 0, (1 - countIf(status = 'crashed') / count()) * 100, 100)",
                  alias: 'crash_free_rate',
                },
                { field: 'uniq(distinct_id)', alias: 'unique_users' },
                { field: 'avg(duration)', alias: 'avg_duration' },
              ],
            },

            trend: {
              ...SESSION_DEFAULTS,
              projectId,
              timeRange: { period },
              select: [
                { field: '$bucket', alias: 'hour' },
                { field: 'count()', alias: 'total' },
                { field: "countIf(status = 'crashed')", alias: 'crashed' },
                {
                  field: "countIf(status IN ('ok', 'exited'))",
                  alias: 'healthy',
                },
                {
                  field:
                    "if(count() > 0, (1 - countIf(status = 'crashed') / count()) * 100, 100)",
                  alias: 'crash_free_rate',
                },
              ],
              groupBy: ['$bucket'],
              orderBy: [{ field: 'hour', direction: 'ASC' }],
              withFill: true,
            },

            byRelease: {
              ...SESSION_DEFAULTS,
              projectId,
              timeRange: { period },
              select: [
                { field: 'release' },
                { field: 'count()', alias: 'total' },
                { field: "countIf(status = 'crashed')", alias: 'crashed' },
                {
                  field:
                    "if(count() > 0, (1 - countIf(status = 'crashed') / count()) * 100, 100)",
                  alias: 'crash_free_rate',
                },
                { field: 'uniq(distinct_id)', alias: 'users' },
              ],
              conditions: [{ field: 'release', op: '!=', value: '' }],
              groupBy: ['release'],
              orderBy: [{ field: 'total', direction: 'DESC' }],
              limit: 10,
            },

            statusTimeline: {
              ...SESSION_DEFAULTS,
              projectId,
              timeRange: { period },
              select: [
                { field: '$bucket', alias: 'hour' },
                {
                  field: "countIf(status IN ('ok', 'exited'))",
                  alias: 'healthy',
                },
                { field: "countIf(status = 'errored')", alias: 'errored' },
                { field: "countIf(status = 'crashed')", alias: 'crashed' },
                { field: "countIf(status = 'abnormal')", alias: 'abnormal' },
              ],
              groupBy: ['$bucket'],
              orderBy: [{ field: 'hour', direction: 'ASC' }],
              withFill: true,
            },
          }),

          // Previous period for comparison
          optic.query({
            ...SESSION_DEFAULTS,
            projectId,
            timeRange: prevRange,
            select: [
              { field: 'count()', alias: 'total_sessions' },
              { field: "countIf(status = 'crashed')", alias: 'crashed' },
              {
                field:
                  "if(count() > 0, (1 - countIf(status = 'crashed') / count()) * 100, 100)",
                alias: 'crash_free_rate',
              },
              { field: 'uniq(distinct_id)', alias: 'unique_users' },
            ],
          }),
        ]);

        // Duration distribution & browser/OS breakdown require complex multiIf ??        // these are best expressed as rawQuery since multiIf isn't part of the DSL
        const bucket = getBucketingConfig(
          period,
          undefined,
          undefined,
          'started'
        );
        const rawParams = {
          projectId,
          fillStart: bucket.queryParams.fillStart,
          fillEnd: bucket.queryParams.fillEnd,
        };

        const [durationDist, crashByBrowser, crashByOs] = await Promise.all([
          optic.rawQuery({
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
            WHERE project_id = {projectId:String}
              AND started >= toDateTime({fillStart:UInt32})
              AND started <= toDateTime({fillEnd:UInt32})
            GROUP BY bucket ORDER BY min(duration)`,
            params: rawParams,
          }),

          optic.rawQuery({
            query: `SELECT
              multiIf(
                user_agent ILIKE '%Chrome%' AND user_agent NOT ILIKE '%Edg%', 'Chrome',
                user_agent ILIKE '%Firefox%', 'Firefox',
                user_agent ILIKE '%Safari%' AND user_agent NOT ILIKE '%Chrome%', 'Safari',
                user_agent ILIKE '%Edg%', 'Edge',
                user_agent ILIKE '%Opera%' OR user_agent ILIKE '%OPR%', 'Opera',
                user_agent = '', 'Unknown',
                'Other'
              ) AS browser,
              count() AS total,
              countIf(status = 'crashed') AS crashed,
              if(total > 0, crashed / total * 100, 0) AS crash_rate
            FROM argus.sessions
            WHERE project_id = {projectId:String}
              AND started >= toDateTime({fillStart:UInt32})
              AND started <= toDateTime({fillEnd:UInt32})
            GROUP BY browser ORDER BY total DESC LIMIT 8`,
            params: rawParams,
          }),

          optic.rawQuery({
            query: `SELECT
              multiIf(
                user_agent ILIKE '%Windows%', 'Windows',
                user_agent ILIKE '%Mac OS%' OR user_agent ILIKE '%Macintosh%', 'macOS',
                user_agent ILIKE '%Linux%' AND user_agent NOT ILIKE '%Android%', 'Linux',
                user_agent ILIKE '%Android%', 'Android',
                user_agent ILIKE '%iPhone%' OR user_agent ILIKE '%iPad%', 'iOS',
                user_agent = '', 'Unknown',
                'Other'
              ) AS os,
              count() AS total,
              countIf(status = 'crashed') AS crashed,
              if(total > 0, crashed / total * 100, 0) AS crash_rate
            FROM argus.sessions
            WHERE project_id = {projectId:String}
              AND started >= toDateTime({fillStart:UInt32})
              AND started <= toDateTime({fillEnd:UInt32})
            GROUP BY os ORDER BY total DESC LIMIT 8`,
            params: rawParams,
          }),
        ]);

        return reply.send({
          data: {
            summary: batch.summary.data[0] || {},
            trend: batch.trend.data,
            by_release: batch.byRelease.data,
            duration_distribution: durationDist.data,
            status_timeline: batch.statusTimeline.data,
            crash_by_browser: crashByBrowser.data,
            crash_by_os: crashByOs.data,
            previous_period: prevPeriod.data[0] || {
              total_sessions: 0,
              crashed: 0,
              crash_free_rate: 100,
              unique_users: 0,
            },
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

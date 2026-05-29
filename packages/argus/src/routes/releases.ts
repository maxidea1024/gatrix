import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { clickhouse } from '../config/clickhouse';
import { createLogger } from '../utils/logger';

const logger = createLogger('releases-api');

export default async function releasesRoutes(app: FastifyInstance) {
  // List releases with stats
  app.get(
    '/releases/:projectId',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId } = request.params as { projectId: string };
      const { period = '30d' } = request.query as { period?: string };
      const interval = periodToInterval(period);

      try {
        const result = await clickhouse.query({
          query: `
            SELECT
              release,
              min(timestamp) AS first_seen,
              max(timestamp) AS last_seen,
              count() AS error_count,
              uniq(user_id) AS affected_users,
              uniqExact(fingerprint) AS issue_count
            FROM argus.errors
            WHERE project_id = {projectId:String}
              AND timestamp >= now() - INTERVAL ${interval}
              AND release != ''
            GROUP BY release
            ORDER BY last_seen DESC
          `,
          query_params: { projectId: String(projectId) },
        });
        const data = await result.json();

        // Session crash-free per release
        const sessionResult = await clickhouse.query({
          query: `
            SELECT
              release,
              count() AS total_sessions,
              countIf(status = 'crashed') AS crashed,
              if(total_sessions > 0, (1 - crashed / total_sessions) * 100, 100) AS crash_free_rate
            FROM argus.sessions
            WHERE project_id = {projectId:String}
              AND started >= now() - INTERVAL ${interval}
              AND release != ''
            GROUP BY release
          `,
          query_params: { projectId: String(projectId) },
        });
        const sessionData = await sessionResult.json();

        const sessionMap = new Map<string, any>();
        for (const s of (sessionData.data || []) as any[]) {
          sessionMap.set(s.release, s);
        }

        const releases = ((data.data || []) as any[]).map((r: any) => {
          const sess = sessionMap.get(r.release);
          return {
            ...r,
            total_sessions: sess?.total_sessions || 0,
            crash_free_rate: sess?.crash_free_rate || 100,
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

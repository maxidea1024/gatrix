import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { clickhouse } from '../config/clickhouse';
import { createLogger } from '../utils/logger';

const logger = createLogger('feedback-api');

export default async function feedbackRoutes(app: FastifyInstance) {
  // List user feedback
  app.get(
    '/feedback/:projectId',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId } = request.params as { projectId: string };
      const { period = '7d', page = '1', limit = '20' } = request.query as {
        period?: string;
        page?: string;
        limit?: string;
      };

      const interval = periodToInterval(period);
      const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);

      try {
        const countResult = await clickhouse.query({
          query: `
            SELECT count() AS total
            FROM argus.user_feedback
            WHERE project_id = {projectId:String}
              AND submitted_at >= now() - INTERVAL ${interval}
          `,
          query_params: { projectId: String(projectId) },
        });
        const countData = await countResult.json();
        const total = (countData.data as any[])?.[0]?.total || 0;

        const result = await clickhouse.query({
          query: `
            SELECT
              event_id,
              user_email,
              user_name,
              comments,
              contact_email,
              submitted_at,
              url
            FROM argus.user_feedback
            WHERE project_id = {projectId:String}
              AND submitted_at >= now() - INTERVAL ${interval}
            ORDER BY submitted_at DESC
            LIMIT {limit:UInt32} OFFSET {offset:UInt32}
          `,
          query_params: {
            projectId: String(projectId),
            limit: parseInt(limit, 10),
            offset,
          },
        });
        const data = await result.json();

        return reply.send({
          data: {
            items: data.data || [],
            total: Number(total),
          },
        });
      } catch (error) {
        logger.error('Failed to get feedback', {
          projectId,
          error: error instanceof Error ? error.message : String(error),
        });
        return reply.code(500).send({ error: 'Failed to get feedback' });
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
  return map[period] || '7 DAY';
}

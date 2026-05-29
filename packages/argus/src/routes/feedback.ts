import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { clickhouse } from '../config/clickhouse';
import { createLogger } from '../utils/logger';

const logger = createLogger('feedback-api');

export default async function feedbackRoutes(app: FastifyInstance) {
  // List user feedback with enriched stats
  app.get(
    '/feedback/:projectId',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId } = request.params as { projectId: string };
      const { period = '7d', page = '1', limit = '20', search = '' } = request.query as {
        period?: string;
        page?: string;
        limit?: string;
        search?: string;
      };

      const interval = periodToInterval(period);
      const limitNum = parseInt(limit, 10);
      const offset = (parseInt(page, 10) - 1) * limitNum;
      const qp: Record<string, any> = { projectId: String(projectId), limit: limitNum, offset };

      const searchClause = search
        ? `AND (message ILIKE {search:String} OR name ILIKE {search:String} OR email ILIKE {search:String})`
        : '';
      if (search) qp.search = `%${search}%`;

      try {
        const [countResult, itemsResult, trendResult, summaryResult] = await Promise.all([
          // Total count
          clickhouse.query({
            query: `SELECT count() AS total
              FROM argus.user_feedback
              WHERE project_id = {projectId:String} AND timestamp >= now() - INTERVAL ${interval} ${searchClause}`,
            query_params: qp,
          }),

          // Paginated items
          clickhouse.query({
            query: `SELECT
              event_id, email, name, message, contact_email,
              timestamp AS submitted_at, url
            FROM argus.user_feedback
            WHERE project_id = {projectId:String} AND timestamp >= now() - INTERVAL ${interval} ${searchClause}
            ORDER BY timestamp DESC
            LIMIT {limit:UInt32} OFFSET {offset:UInt32}`,
            query_params: qp,
          }),

          // NEW: Feedback trend (daily count)
          clickhouse.query({
            query: `SELECT
              toStartOfDay(timestamp) AS day,
              count() AS count
            FROM argus.user_feedback
            WHERE project_id = {projectId:String} AND timestamp >= now() - INTERVAL ${interval}
            GROUP BY day ORDER BY day`,
            query_params: qp,
          }),

          // NEW: Summary stats
          clickhouse.query({
            query: `SELECT
              count() AS total_feedback,
              uniq(email) AS unique_users,
              countIf(contact_email != '') AS with_contact,
              avg(length(message)) AS avg_message_length
            FROM argus.user_feedback
            WHERE project_id = {projectId:String} AND timestamp >= now() - INTERVAL ${interval}`,
            query_params: qp,
          }),
        ]);

        const [countData, itemsData, trendData, summaryData] = await Promise.all([
          countResult.json(),
          itemsResult.json(),
          trendResult.json(),
          summaryResult.json(),
        ]);

        return reply.send({
          data: {
            items: itemsData.data || [],
            total: Number((countData.data as any[])?.[0]?.total || 0),
            trend: trendData.data || [],
            summary: (summaryData.data as any[])?.[0] || { total_feedback: 0, unique_users: 0, with_contact: 0, avg_message_length: 0 },
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

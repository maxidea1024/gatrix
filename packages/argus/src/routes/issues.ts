import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { mysqlPool } from '../config/mysql';
import { clickhouse } from '../config/clickhouse';
import { createLogger } from '../utils/logger';

const logger = createLogger('issues-api');

export default async function issuesRoutes(app: FastifyInstance) {
  // List issues for a project
  app.get(
    '/:projectId/issues',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId } = request.params as { projectId: string };
      const {
        status = 'unresolved',
        sort = 'last_seen',
        limit = '25',
        offset = '0',
        query,
      } = request.query as Record<string, string>;

      try {
        let sql = `
          SELECT * FROM g_argus_issues
          WHERE project_id = ?
        `;
        const params: any[] = [projectId];

        if (status && status !== 'all') {
          sql += ' AND status = ?';
          params.push(status);
        }

        if (query) {
          sql += ' AND (title LIKE ? OR culprit LIKE ?)';
          params.push(`%${query}%`, `%${query}%`);
        }

        // Sort
        const sortMap: Record<string, string> = {
          last_seen: 'last_seen DESC',
          first_seen: 'first_seen DESC',
          times_seen: 'times_seen DESC',
          priority: "FIELD(priority, 'critical', 'high', 'medium', 'low')",
        };
        sql += ` ORDER BY ${sortMap[sort] || 'last_seen DESC'}`;
        sql += ' LIMIT ? OFFSET ?';
        params.push(parseInt(limit, 10), parseInt(offset, 10));

        const [rows] = await mysqlPool.query(sql, params);

        // Total count
        let countSql = `SELECT COUNT(*) as total FROM g_argus_issues WHERE project_id = ?`;
        const countParams: any[] = [projectId];
        if (status && status !== 'all') {
          countSql += ' AND status = ?';
          countParams.push(status);
        }
        const [countRows] = await mysqlPool.query(countSql, countParams);
        const total = (countRows as any[])[0]?.total || 0;

        return reply.send({
          data: rows,
          total,
          limit: parseInt(limit, 10),
          offset: parseInt(offset, 10),
        });
      } catch (error) {
        logger.error('Failed to list issues', {
          projectId,
          error: error instanceof Error ? error.message : String(error),
        });
        return reply.code(500).send({ error: 'Failed to list issues' });
      }
    }
  );

  // Get single issue detail
  app.get(
    '/:projectId/issues/:issueId',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId, issueId } = request.params as {
        projectId: string;
        issueId: string;
      };

      try {
        const [rows] = await mysqlPool.query(
          'SELECT * FROM g_argus_issues WHERE id = ? AND project_id = ?',
          [issueId, projectId]
        );

        const results = rows as any[];
        if (results.length === 0) {
          return reply.code(404).send({ error: 'Issue not found' });
        }

        return reply.send({ data: results[0] });
      } catch (error) {
        logger.error('Failed to get issue', {
          projectId,
          issueId,
          error: error instanceof Error ? error.message : String(error),
        });
        return reply.code(500).send({ error: 'Failed to get issue' });
      }
    }
  );

  // Get events for an issue from ClickHouse
  app.get(
    '/:projectId/issues/:issueId/events',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId, issueId } = request.params as {
        projectId: string;
        issueId: string;
      };
      const { limit = '20', offset = '0' } = request.query as Record<string, string>;

      try {
        const result = await clickhouse.query({
          query: `
            SELECT *
            FROM argus.errors
            WHERE project_id = {projectId:String}
              AND issue_id = {issueId:UInt64}
            ORDER BY timestamp DESC
            LIMIT {limit:UInt32}
            OFFSET {offset:UInt32}
          `,
          query_params: {
            projectId: String(projectId),
            issueId: parseInt(issueId, 10),
            limit: parseInt(limit, 10),
            offset: parseInt(offset, 10),
          },
        });

        const events = await result.json();

        return reply.send({ data: events.data });
      } catch (error) {
        logger.error('Failed to get issue events', {
          projectId,
          issueId,
          error: error instanceof Error ? error.message : String(error),
        });
        return reply.code(500).send({ error: 'Failed to get issue events' });
      }
    }
  );

  // Update issue status
  app.patch(
    '/:projectId/issues/:issueId',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId, issueId } = request.params as {
        projectId: string;
        issueId: string;
      };
      const body = request.body as {
        status?: string;
        assigned_to?: number;
        priority?: string;
      };

      try {
        const updates: string[] = [];
        const params: any[] = [];

        if (body.status) {
          updates.push('status = ?');
          params.push(body.status);
          if (body.status === 'resolved') {
            updates.push('resolved_at = NOW()');
          }
        }
        if (body.assigned_to !== undefined) {
          updates.push('assigned_to = ?');
          params.push(body.assigned_to);
        }
        if (body.priority) {
          updates.push('priority = ?');
          params.push(body.priority);
        }

        if (updates.length === 0) {
          return reply.code(400).send({ error: 'No fields to update' });
        }

        params.push(issueId, projectId);

        await mysqlPool.query(
          `UPDATE g_argus_issues SET ${updates.join(', ')} WHERE id = ? AND project_id = ?`,
          params
        );

        return reply.send({ success: true });
      } catch (error) {
        logger.error('Failed to update issue', {
          projectId,
          issueId,
          error: error instanceof Error ? error.message : String(error),
        });
        return reply.code(500).send({ error: 'Failed to update issue' });
      }
    }
  );
}

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { clickhouse } from '../config/clickhouse';
import { createLogger } from '../utils/logger';

const logger = createLogger('logs-api');

export default async function logsRoutes(app: FastifyInstance) {
  // Get logs by trace_id (linked to an error event)
  app.get(
    '/:projectId/logs',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId } = request.params as { projectId: string };
      const {
        trace_id,
        issue_id,
        level,
        search,
        limit = '100',
        order = 'ASC',
      } = request.query as Record<string, string>;

      if (!trace_id && !issue_id) {
        return reply.code(400).send({ error: 'Either trace_id or issue_id is required' });
      }

      try {
        const conditions: string[] = ['project_id = {projectId:String}'];
        const params: Record<string, string> = { projectId: String(projectId) };

        if (trace_id) {
          conditions.push('trace_id = {traceId:String}');
          params.traceId = trace_id;
        }
        if (issue_id) {
          conditions.push('issue_id = {issueId:UInt64}');
          params.issueId = issue_id;
        }
        if (level) {
          conditions.push('level = {level:String}');
          params.level = level;
        }
        if (search) {
          conditions.push('message LIKE {search:String}');
          params.search = `%${search}%`;
        }

        const sql = `
          SELECT
            log_id,
            trace_id,
            span_id,
            timestamp,
            level,
            logger_name,
            message,
            body,
            service,
            environment,
            release,
            attributes
          FROM argus.logs
          WHERE ${conditions.join(' AND ')}
          ORDER BY timestamp ${order === 'DESC' ? 'DESC' : 'ASC'}
          LIMIT {limit:UInt32}
        `;

        params.limit = String(parseInt(limit, 10));

        const result = await clickhouse.query({
          query: sql,
          query_params: params,
          format: 'JSONEachRow',
        });

        const rows = await result.json();
        return reply.send({ data: rows });
      } catch (error) {
        logger.error('Failed to query logs', {
          projectId,
          error: error instanceof Error ? error.message : String(error),
        });
        return reply.code(500).send({ error: 'Failed to query logs' });
      }
    }
  );

  // Ingest logs (from SDK)
  app.post(
    '/:projectId/logs',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId } = request.params as { projectId: string };
      const logs = request.body as any[];

      if (!Array.isArray(logs) || logs.length === 0) {
        return reply.code(400).send({ error: 'Logs array is required' });
      }

      try {
        const rows = logs.map(log => ({
          log_id: log.log_id || crypto.randomUUID().replace(/-/g, ''),
          project_id: String(projectId),
          trace_id: log.trace_id || '',
          span_id: log.span_id || '',
          issue_id: log.issue_id || 0,
          timestamp: log.timestamp || new Date().toISOString(),
          level: log.level || 'info',
          logger_name: log.logger_name || '',
          message: log.message || '',
          body: log.body || '',
          environment: log.environment || '',
          release: log.release || '',
          service: log.service || '',
          attributes: log.attributes || {},
        }));

        await clickhouse.insert({
          table: 'argus.logs',
          values: rows,
          format: 'JSONEachRow',
        });

        return reply.code(202).send({ inserted: rows.length });
      } catch (error) {
        logger.error('Failed to ingest logs', {
          projectId,
          error: error instanceof Error ? error.message : String(error),
        });
        return reply.code(500).send({ error: 'Failed to ingest logs' });
      }
    }
  );
}

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { clickhouse } from '../config/clickhouse';
import { createLogger } from '../utils/logger';
import { QueryParser } from '../utils/queryParser';

const logger = createLogger('logs-api');

const LOGS_ALLOWED_COLUMNS = new Set([
  'log_id', 'trace_id', 'span_id', 'issue_id', 'timestamp', 'level', 
  'logger_name', 'message', 'body', 'service', 'environment', 'release'
]);

export default async function logsRoutes(app: FastifyInstance) {

  // ─── Browse Logs (independent explorer — no trace_id required) ───
  app.get(
    '/:projectId/logs/browse',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId } = request.params as { projectId: string };
      const {
        level,
        search,
        service,
        environment,
        logger_name,
        limit = '200',
        order = 'DESC',
        period = '24h',
        cursor,
      } = request.query as Record<string, string>;

      const periodMap: Record<string, string> = {
        '1h': '1 HOUR', '6h': '6 HOUR', '12h': '12 HOUR', '24h': '24 HOUR',
        '7d': '7 DAY', '14d': '14 DAY', '30d': '30 DAY',
      };
      const interval = periodMap[period] || '24 HOUR';

      try {
        const conditions: string[] = ['project_id = {projectId:String}'];
        const params: Record<string, string> = { projectId: String(projectId) };

        conditions.push(`timestamp >= now() - INTERVAL ${interval}`);

        if (cursor) {
          const op = order === 'DESC' ? '<' : '>';
          conditions.push(`timestamp ${op} {cursor:DateTime64(3)}`);
          params.cursor = cursor;
        }
        if (level) {
          const levels = level.split(',');
          conditions.push(`level IN (${levels.map((_, i) => `{level_${i}:String}`).join(', ')})`);
          levels.forEach((l, i) => { params[`level_${i}`] = l.trim(); });
        }
        if (service) { conditions.push('service = {service:String}'); params.service = service; }
        if (environment) { conditions.push('environment = {environment:String}'); params.environment = environment; }
        if (logger_name) { conditions.push('logger_name = {loggerName:String}'); params.loggerName = logger_name; }

        if (search && typeof search === 'string' && search.trim()) {
          const parser = new QueryParser(LOGS_ALLOWED_COLUMNS, new Set());
          const ast = parser.parse(search);
          if (ast) {
            const { where } = parser.generateSQL(ast, params);
            if (where) conditions.push(`(${where})`);
          }
        }

        const sql = `
          SELECT log_id, trace_id, span_id, timestamp, level, logger_name, message, body, service, environment, release, attributes
          FROM argus.logs
          WHERE ${conditions.join(' AND ')}
          ORDER BY timestamp ${order === 'ASC' ? 'ASC' : 'DESC'}
          LIMIT {limit:UInt32}
        `;
        params.limit = String(Math.min(parseInt(limit, 10), 1000));

        const result = await clickhouse.query({ query: sql, query_params: params, format: 'JSONEachRow' });
        const rows = await result.json();

        return reply.send({
          data: rows,
          meta: { count: (rows as any[]).length, hasMore: (rows as any[]).length >= parseInt(limit, 10) },
        });
      } catch (error) {
        logger.error('Failed to browse logs', { projectId, error: String(error) });
        return reply.code(500).send({ error: 'Failed to browse logs' });
      }
    }
  );

  // ─── Log Volume (histogram for chart) ───
  app.get(
    '/:projectId/logs/volume',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId } = request.params as { projectId: string };
      const { period = '24h', level } = request.query as Record<string, string>;

      const periodMap: Record<string, string> = {
        '1h': '1 HOUR', '6h': '6 HOUR', '12h': '12 HOUR', '24h': '24 HOUR',
        '7d': '7 DAY', '14d': '14 DAY', '30d': '30 DAY',
      };
      const interval = periodMap[period] || '24 HOUR';

      // Bucket size based on period
      const bucketFn = ['1h', '6h', '12h'].includes(period) ? 'toStartOfFiveMinutes' : 'toStartOfHour';

      try {
        const conditions = ['project_id = {projectId:String}', `timestamp >= now() - INTERVAL ${interval}`];
        const params: Record<string, string> = { projectId: String(projectId) };

        if (level) {
          conditions.push('level = {level:String}');
          params.level = level;
        }

        const sql = `
          SELECT ${bucketFn}(timestamp) AS bucket, level, count() AS count
          FROM argus.logs
          WHERE ${conditions.join(' AND ')}
          GROUP BY bucket, level
          ORDER BY bucket ASC
        `;

        const result = await clickhouse.query({ query: sql, query_params: params, format: 'JSONEachRow' });
        const rows = await result.json();
        return reply.send({ data: rows });
      } catch (error) {
        logger.error('Failed to get log volume', { projectId, error: String(error) });
        return reply.code(500).send({ error: 'Failed to get log volume' });
      }
    }
  );

  // ─── Log Facets (distinct values for filters) ───
  app.get(
    '/:projectId/logs/facets',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId } = request.params as { projectId: string };
      const { period = '24h' } = request.query as Record<string, string>;

      const periodMap: Record<string, string> = {
        '1h': '1 HOUR', '6h': '6 HOUR', '24h': '24 HOUR', '7d': '7 DAY', '30d': '30 DAY',
      };
      const interval = periodMap[period] || '24 HOUR';
      const qp = { projectId: String(projectId) };

      try {
        const [levelsRes, servicesRes, envsRes, loggersRes] = await Promise.all([
          clickhouse.query({
            query: `SELECT level, count() AS count FROM argus.logs WHERE project_id = {projectId:String} AND timestamp >= now() - INTERVAL ${interval} GROUP BY level ORDER BY count DESC`,
            query_params: qp,
          }),
          clickhouse.query({
            query: `SELECT service, count() AS count FROM argus.logs WHERE project_id = {projectId:String} AND timestamp >= now() - INTERVAL ${interval} AND service != '' GROUP BY service ORDER BY count DESC LIMIT 20`,
            query_params: qp,
          }),
          clickhouse.query({
            query: `SELECT environment, count() AS count FROM argus.logs WHERE project_id = {projectId:String} AND timestamp >= now() - INTERVAL ${interval} AND environment != '' GROUP BY environment ORDER BY count DESC LIMIT 10`,
            query_params: qp,
          }),
          clickhouse.query({
            query: `SELECT logger_name, count() AS count FROM argus.logs WHERE project_id = {projectId:String} AND timestamp >= now() - INTERVAL ${interval} AND logger_name != '' GROUP BY logger_name ORDER BY count DESC LIMIT 20`,
            query_params: qp,
          }),
        ]);

        const [levels, services, envs, loggers] = await Promise.all([
          levelsRes.json(), servicesRes.json(), envsRes.json(), loggersRes.json(),
        ]);

        return reply.send({
          data: {
            levels: (levels as any).data || [],
            services: (services as any).data || [],
            environments: (envs as any).data || [],
            loggers: (loggers as any).data || [],
          },
        });
      } catch (error) {
        logger.error('Failed to get log facets', { projectId, error: String(error) });
        return reply.code(500).send({ error: 'Failed to get log facets' });
      }
    }
  );

  // ─── Log Aggregation (group by attribute) ───
  app.get(
    '/:projectId/logs/aggregate',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId } = request.params as { projectId: string };
      const {
        period = '24h',
        groupBy = 'level',
        search,
        service,
        environment,
      } = request.query as Record<string, string>;

      const periodMap: Record<string, string> = {
        '1h': '1 HOUR', '6h': '6 HOUR', '12h': '12 HOUR', '24h': '24 HOUR',
        '7d': '7 DAY', '14d': '14 DAY', '30d': '30 DAY',
      };
      const interval = periodMap[period] || '24 HOUR';

      // Only allow safe column names
      const ALLOWED_GROUP = new Set(['level', 'service', 'environment', 'logger_name', 'release']);
      const safeGroup = ALLOWED_GROUP.has(groupBy) ? groupBy : 'level';

      try {
        const conditions: string[] = ['project_id = {projectId:String}'];
        const params: Record<string, string> = { projectId: String(projectId) };
        conditions.push(`timestamp >= now() - INTERVAL ${interval}`);

        if (service) { conditions.push('service = {service:String}'); params.service = service; }
        if (environment) { conditions.push('environment = {environment:String}'); params.environment = environment; }

        if (search && typeof search === 'string' && search.trim()) {
          const parser = new QueryParser(LOGS_ALLOWED_COLUMNS, new Set());
          const ast = parser.parse(search);
          if (ast) {
            const { where } = parser.generateSQL(ast, params);
            if (where) conditions.push(`(${where})`);
          }
        }

        // 1) Top values by count
        const topSql = `
          SELECT ${safeGroup} AS group_value, count() AS count
          FROM argus.logs
          WHERE ${conditions.join(' AND ')}
          GROUP BY group_value
          ORDER BY count DESC
          LIMIT 20
        `;
        const topResult = await clickhouse.query({ query: topSql, query_params: params, format: 'JSONEachRow' });
        const topValues = await topResult.json() as any[];

        // 2) Time series per group value (top 5)
        const bucketFn = ['1h', '6h', '12h'].includes(period) ? 'toStartOfFiveMinutes' : 'toStartOfHour';
        const top5 = topValues.slice(0, 5).map((r: any) => r.group_value);

        let timeSeries: any[] = [];
        if (top5.length > 0) {
          const inList = top5.map((_: any, i: number) => `{g${i}:String}`).join(', ');
          top5.forEach((v: string, i: number) => { params[`g${i}`] = v; });

          const tsSql = `
            SELECT ${bucketFn}(timestamp) AS bucket, ${safeGroup} AS group_value, count() AS count
            FROM argus.logs
            WHERE ${conditions.join(' AND ')} AND ${safeGroup} IN (${inList})
            GROUP BY bucket, group_value
            ORDER BY bucket ASC
          `;
          const tsResult = await clickhouse.query({ query: tsSql, query_params: params, format: 'JSONEachRow' });
          timeSeries = await tsResult.json() as any[];
        }

        return reply.send({
          data: {
            groupBy: safeGroup,
            topValues,
            timeSeries,
          },
        });
      } catch (error) {
        logger.error('Failed to aggregate logs', { projectId, error: String(error) });
        return reply.code(500).send({ error: 'Failed to aggregate logs' });
      }
    }
  );

  // ─── Get logs by trace_id (existing — kept for issue detail) ───
  app.get(
    '/:projectId/logs',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId } = request.params as { projectId: string };
      const { trace_id, issue_id, level, search, limit = '100', order = 'ASC', cursor } = request.query as Record<string, string>;

      if (!trace_id && !issue_id) {
        return reply.code(400).send({ error: 'Either trace_id or issue_id is required' });
      }

      try {
        const conditions: string[] = ['project_id = {projectId:String}'];
        const params: Record<string, string> = { projectId: String(projectId) };

        if (trace_id) { conditions.push('trace_id = {traceId:String}'); params.traceId = trace_id; }
        if (issue_id) { conditions.push('issue_id = {issueId:UInt64}'); params.issueId = issue_id; }
        if (level) { conditions.push('level = {level:String}'); params.level = level; }
        
        if (search && typeof search === 'string' && search.trim()) {
          const parser = new QueryParser(LOGS_ALLOWED_COLUMNS, new Set());
          const ast = parser.parse(search);
          if (ast) {
            const { where } = parser.generateSQL(ast, params);
            if (where) conditions.push(`(${where})`);
          }
        }
        if (cursor) {
          const op = order === 'DESC' ? '<' : '>';
          conditions.push(`timestamp ${op} {cursor:DateTime64(3)}`);
          params.cursor = cursor;
        }

        const parsedLimit = Math.min(parseInt(limit, 10) || 100, 1000);

        const sql = `
          SELECT log_id, trace_id, span_id, timestamp, level, logger_name, message, body, service, environment, release, attributes
          FROM argus.logs WHERE ${conditions.join(' AND ')}
          ORDER BY timestamp ${order === 'DESC' ? 'DESC' : 'ASC'} LIMIT {limit:UInt32}
        `;
        params.limit = String(parsedLimit);

        const result = await clickhouse.query({ query: sql, query_params: params, format: 'JSONEachRow' });
        const rows = await result.json() as any[];
        return reply.send({ data: rows, meta: { count: rows.length, hasMore: rows.length >= parsedLimit } });
      } catch (error) {
        logger.error('Failed to query logs', { projectId, error: String(error) });
        return reply.code(500).send({ error: 'Failed to query logs' });
      }
    }
  );

  // ─── Ingest logs (from SDK) ───
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

        await clickhouse.insert({ table: 'argus.logs', values: rows, format: 'JSONEachRow' });
        return reply.code(202).send({ inserted: rows.length });
      } catch (error) {
        logger.error('Failed to ingest logs', { projectId, error: String(error) });
        return reply.code(500).send({ error: 'Failed to ingest logs' });
      }
    }
  );
}

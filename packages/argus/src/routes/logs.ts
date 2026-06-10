import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { optic } from '@gatrix/argus-optic';
import { redis } from '../config/redis';
import { createLogger } from '../utils/logger';
import { QueryParser } from '../utils/queryParser';
import { getBucketingConfig } from '../utils/timeBucket';
import { CACHE, STREAMS, KNOWN_STREAMS } from '../config/redis-keys';

const logger = createLogger('logs-api');

const LOGS_ALLOWED_COLUMNS = new Set([
  'log_id',
  'trace_id',
  'span_id',
  'issue_id',
  'timestamp',
  'level',
  'logger_name',
  'message',
  'body',
  'service',
  'environment',
  'release',
]);

// User-friendly aliases ??actual DB column names.
// The UI displays "severity" but the DB column is "level".
const LOGS_COLUMN_ALIASES: Record<string, string> = {
  severity: 'level',
  logger: 'logger_name',
};

export default async function logsRoutes(app: FastifyInstance) {
  // ?�?�?� Browse Logs (independent explorer ??no trace_id required) ?�?�?�
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
        start,
        end,
      } = request.query as Record<string, string>;

      const bucket = getBucketingConfig(period, start, end);
      const timeCond = `timestamp >= toDateTime({fillStart:UInt32}) AND timestamp <= toDateTime({fillEnd:UInt32})`;

      try {
        const conditions: string[] = [
          'project_id = {projectId:String}',
          timeCond,
        ];
        const params: Record<string, string> = {
          projectId: String(projectId),
          fillStart: String(bucket.queryParams.fillStart),
          fillEnd: String(bucket.queryParams.fillEnd),
        };

        if (cursor) {
          const op = order === 'DESC' ? '<' : '>';
          conditions.push(`timestamp ${op} {cursor:DateTime64(3)}`);
          params.cursor = cursor;
        }
        if (level) {
          const levels = level.split(',');
          conditions.push(
            `level IN (${levels.map((_, i) => `{level_${i}:String}`).join(', ')})`
          );
          levels.forEach((l, i) => {
            params[`level_${i}`] = l.trim();
          });
        }
        if (service) {
          conditions.push('service = {service:String}');
          params.service = service;
        }
        if (environment) {
          conditions.push('environment = {environment:String}');
          params.environment = environment;
        }
        if (logger_name) {
          conditions.push('logger_name = {loggerName:String}');
          params.loggerName = logger_name;
        }

        if (search && typeof search === 'string' && search.trim()) {
          const parser = new QueryParser(
            LOGS_ALLOWED_COLUMNS,
            new Set(),
            LOGS_COLUMN_ALIASES
          );
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

        const result = await optic.rawQuery({ query: sql, params });

        return reply.send({
          data: result.data,
          meta: {
            count: (result.data as any[]).length,
            hasMore: (result.data as any[]).length >= parseInt(limit, 10),
          },
        });
      } catch (error) {
        logger.error('Failed to browse logs', {
          projectId,
          error: String(error),
        });
        return reply.code(500).send({ error: 'Failed to browse logs' });
      }
    }
  );

  // ?�?�?� Log Volume (histogram for chart) ?�?�?�
  app.get(
    '/:projectId/logs/volume',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId } = request.params as { projectId: string };
      const {
        period = '24h',
        level,
        start,
        end,
        search,
      } = request.query as Record<string, string>;

      const bucket = getBucketingConfig(period, start, end);
      const timeCond = `timestamp >= toDateTime({fillStart:UInt32}) AND timestamp <= toDateTime({fillEnd:UInt32})`;
      const conditions: string[] = [
        'project_id = {projectId:String}',
        timeCond,
      ];
      const params: Record<string, string> = {
        projectId: String(projectId),
        fillStart: String(bucket.queryParams.fillStart),
        fillEnd: String(bucket.queryParams.fillEnd),
      };

      try {
        if (level) {
          conditions.push('level = {level:String}');
          params.level = level;
        }

        if (search && typeof search === 'string' && search.trim()) {
          const parser = new QueryParser(
            LOGS_ALLOWED_COLUMNS,
            new Set(),
            LOGS_COLUMN_ALIASES
          );
          const ast = parser.parse(search);
          if (ast) {
            const { where } = parser.generateSQL(ast, params);
            if (where) conditions.push(`(${where})`);
          }
        }

        const sql = `
          SELECT ${bucket.selectExpr} AS bucket, level, count() AS count
          FROM argus.logs
          WHERE ${conditions.join(' AND ')}
          GROUP BY bucket, level
          ORDER BY bucket ASC
        `;

        const result = await optic.rawQuery({ query: sql, params });
        return reply.send({ data: result.data });
      } catch (error) {
        logger.error('Failed to get log volume', {
          projectId,
          error: String(error),
        });
        return reply.code(500).send({ error: 'Failed to get log volume' });
      }
    }
  );

  // ?�?�?� Log Facets (distinct values for filters) ?�?�?�
  app.get(
    '/:projectId/logs/facets',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId } = request.params as { projectId: string };
      const {
        period = '24h',
        start,
        end,
      } = request.query as Record<string, string>;

      // Use a cache key based on period (custom start/end bypass cache)
      const cacheKey =
        !start && !end ? CACHE.LOG_FACETS(String(projectId), period) : null;

      // Check Redis cache first
      if (cacheKey) {
        try {
          const cached = await redis.get(cacheKey);
          if (cached) {
            return reply.send({ data: JSON.parse(cached) });
          }
        } catch {
          /* cache miss, proceed to ClickHouse */
        }
      }

      const bucket = getBucketingConfig(period, start, end);
      const qp: Record<string, any> = {
        projectId: String(projectId),
        fillStart: bucket.queryParams.fillStart,
        fillEnd: bucket.queryParams.fillEnd,
      };
      const timeFilter = `timestamp >= toDateTime({fillStart:UInt32}) AND timestamp <= toDateTime({fillEnd:UInt32})`;

      try {
        const [levelsRes, servicesRes, envsRes, loggersRes, releasesRes] =
          await Promise.all([
            optic.rawQuery({
              query: `SELECT level, count() AS count FROM argus.logs WHERE project_id = {projectId:String} AND ${timeFilter} GROUP BY level ORDER BY count DESC`,
              params: qp,
            }),
            optic.rawQuery({
              query: `SELECT service, count() AS count FROM argus.logs WHERE project_id = {projectId:String} AND ${timeFilter} AND service != '' GROUP BY service ORDER BY count DESC LIMIT 20`,
              params: qp,
            }),
            optic.rawQuery({
              query: `SELECT environment, count() AS count FROM argus.logs WHERE project_id = {projectId:String} AND ${timeFilter} AND environment != '' GROUP BY environment ORDER BY count DESC LIMIT 10`,
              params: qp,
            }),
            optic.rawQuery({
              query: `SELECT logger_name, count() AS count FROM argus.logs WHERE project_id = {projectId:String} AND ${timeFilter} AND logger_name != '' GROUP BY logger_name ORDER BY count DESC LIMIT 20`,
              params: qp,
            }),
            optic.rawQuery({
              query: `SELECT release, count() AS count FROM argus.logs WHERE project_id = {projectId:String} AND ${timeFilter} AND release != '' GROUP BY release ORDER BY count DESC LIMIT 20`,
              params: qp,
            }),
          ]);

        const facetData = {
          levels: levelsRes.data || [],
          services: servicesRes.data || [],
          environments: envsRes.data || [],
          loggers: loggersRes.data || [],
          releases: releasesRes.data || [],
        };

        // Cache for 5 minutes (non-blocking)
        if (cacheKey) {
          redis
            .set(cacheKey, JSON.stringify(facetData), 'EX', 300)
            .catch(() => {});
        }

        return reply.send({ data: facetData });
      } catch (error) {
        logger.error('Failed to get log facets', {
          projectId,
          error: String(error),
        });
        return reply.code(500).send({ error: 'Failed to get log facets' });
      }
    }
  );

  // ?�?�?� Log Aggregation (group by attribute) ?�?�?�
  app.get(
    '/:projectId/logs/aggregate',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId } = request.params as { projectId: string };
      const {
        period = '24h',
        start,
        end,
        groupBy = 'level',
        search,
        service,
        environment,
      } = request.query as Record<string, string>;

      const bucket = getBucketingConfig(period, start, end);
      const timeCond = `timestamp >= toDateTime({fillStart:UInt32}) AND timestamp <= toDateTime({fillEnd:UInt32})`;

      // Only allow safe column names
      const ALLOWED_GROUP = new Set([
        'level',
        'service',
        'environment',
        'logger_name',
        'release',
      ]);
      const safeGroup = ALLOWED_GROUP.has(groupBy) ? groupBy : 'level';

      try {
        const conditions: string[] = [
          'project_id = {projectId:String}',
          timeCond,
        ];
        const params: Record<string, string> = {
          projectId: String(projectId),
          fillStart: String(bucket.queryParams.fillStart),
          fillEnd: String(bucket.queryParams.fillEnd),
        };

        if (service) {
          conditions.push('service = {service:String}');
          params.service = service;
        }
        if (environment) {
          conditions.push('environment = {environment:String}');
          params.environment = environment;
        }

        if (search && typeof search === 'string' && search.trim()) {
          const parser = new QueryParser(
            LOGS_ALLOWED_COLUMNS,
            new Set(),
            LOGS_COLUMN_ALIASES
          );
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
        const topResult = await optic.rawQuery({ query: topSql, params });
        const topValues = topResult.data as any[];

        // 2) Time series per group value (top 5)
        const top5 = topValues.slice(0, 5).map((r: any) => r.group_value);

        let timeSeries: any[] = [];
        if (top5.length > 0) {
          const inList = top5
            .map((_: any, i: number) => `{g${i}:String}`)
            .join(', ');
          top5.forEach((v: string, i: number) => {
            params[`g${i}`] = v;
          });

          const tsSql = `
            SELECT ${bucket.selectExpr} AS bucket, ${safeGroup} AS group_value, count() AS count
            FROM argus.logs
            WHERE ${conditions.join(' AND ')} AND ${safeGroup} IN (${inList})
            GROUP BY bucket, group_value
            ORDER BY bucket ASC
          `;
          const tsResult = await optic.rawQuery({ query: tsSql, params });
          timeSeries = tsResult.data as any[];
        }

        return reply.send({
          data: {
            groupBy: safeGroup,
            topValues,
            timeSeries,
          },
        });
      } catch (error) {
        logger.error('Failed to aggregate logs', {
          projectId,
          error: String(error),
        });
        return reply.code(500).send({ error: 'Failed to aggregate logs' });
      }
    }
  );

  // ?�?�?� Get logs by trace_id (existing ??kept for issue detail) ?�?�?�
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
        cursor,
      } = request.query as Record<string, string>;

      if (!trace_id && !issue_id) {
        return reply
          .code(400)
          .send({ error: 'Either trace_id or issue_id is required' });
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

        if (search && typeof search === 'string' && search.trim()) {
          const parser = new QueryParser(
            LOGS_ALLOWED_COLUMNS,
            new Set(),
            LOGS_COLUMN_ALIASES
          );
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

        const result = await optic.rawQuery({ query: sql, params });
        const rows = result.data as any[];
        return reply.send({
          data: rows,
          meta: { count: rows.length, hasMore: rows.length >= parsedLimit },
        });
      } catch (error) {
        logger.error('Failed to query logs', {
          projectId,
          error: String(error),
        });
        return reply.code(500).send({ error: 'Failed to query logs' });
      }
    }
  );

  // ?�?�?� Ingest logs (from SDK) ?�?�?�
  app.post(
    '/:projectId/logs',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId } = request.params as { projectId: string };
      const logs = request.body as any[];

      if (!Array.isArray(logs) || logs.length === 0) {
        return reply.code(400).send({ error: 'Logs array is required' });
      }

      try {
        const streamKey = STREAMS.streamKey(STREAMS.LOGS, String(projectId));
        const pipeline = redis.pipeline();

        // Register this stream in the known-streams set
        pipeline.sadd(KNOWN_STREAMS.LOGS, streamKey);

        for (const log of logs) {
          const row = {
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
          };
          pipeline.xadd(
            streamKey,
            'MAXLEN',
            '~',
            '500000',
            '*',
            'data',
            JSON.stringify(row)
          );
        }

        await pipeline.exec();
        return reply.code(202).send({ inserted: logs.length });
      } catch (error) {
        logger.error('Failed to ingest logs', {
          projectId,
          error: String(error),
        });
        return reply.code(500).send({ error: 'Failed to ingest logs' });
      }
    }
  );

  // ─── Get single log detail by ID (lazy loading) ───
  app.get(
    '/:projectId/logs/detail/:logId',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId, logId } = request.params as {
        projectId: string;
        logId: string;
      };

      try {
        const sql = `
          SELECT log_id, trace_id, span_id, issue_id, timestamp, level, logger_name,
                 message, body, service, environment, release, attributes
          FROM argus.logs
          WHERE project_id = {projectId:String} AND log_id = {logId:String}
          LIMIT 1
        `;
        const params = {
          projectId: String(projectId),
          logId: String(logId),
        };

        const result = await optic.rawQuery({ query: sql, params });
        const rows = result.data as any[];

        if (rows.length === 0) {
          return reply.code(404).send({ error: 'Log not found' });
        }

        return reply.send({ data: rows[0] });
      } catch (error) {
        logger.error('Failed to get log detail', {
          projectId,
          logId,
          error: String(error),
        });
        return reply.code(500).send({ error: 'Failed to get log detail' });
      }
    }
  );

  // ─── Log Patterns (cluster similar log messages) ───
  app.get(
    '/:projectId/logs/patterns',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId } = request.params as { projectId: string };
      const {
        period = '24h',
        start,
        end,
        level,
        service,
        environment,
        search,
        limit = '50',
      } = request.query as Record<string, string>;

      const bucket = getBucketingConfig(period, start, end);
      const timeCond = `timestamp >= toDateTime({fillStart:UInt32}) AND timestamp <= toDateTime({fillEnd:UInt32})`;

      try {
        const conditions: string[] = [
          'project_id = {projectId:String}',
          timeCond,
        ];
        const params: Record<string, string> = {
          projectId: String(projectId),
          fillStart: String(bucket.queryParams.fillStart),
          fillEnd: String(bucket.queryParams.fillEnd),
        };

        if (level) {
          const levels = level.split(',');
          conditions.push(
            `level IN (${levels.map((_, i) => `{plvl_${i}:String}`).join(', ')})`
          );
          levels.forEach((l, i) => {
            params[`plvl_${i}`] = l.trim();
          });
        }
        if (service) {
          conditions.push('service = {pservice:String}');
          params.pservice = service;
        }
        if (environment) {
          conditions.push('environment = {penvironment:String}');
          params.penvironment = environment;
        }

        if (search && typeof search === 'string' && search.trim()) {
          const parser = new QueryParser(
            LOGS_ALLOWED_COLUMNS,
            new Set(),
            LOGS_COLUMN_ALIASES
          );
          const ast = parser.parse(search);
          if (ast) {
            const { where } = parser.generateSQL(ast, params);
            if (where) conditions.push(`(${where})`);
          }
        }

        // Use ClickHouse to extract patterns by normalizing messages:
        // Replace numbers, UUIDs, hex strings, IPs, quoted strings with placeholders
        const patternExpr = `replaceRegexpAll(
          replaceRegexpAll(
            replaceRegexpAll(
              replaceRegexpAll(
                replaceRegexpAll(message,
                  '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}', '<UUID>'),
                '[0-9a-f]{24,}', '<HEX>'),
              '\\\\b\\\\d{1,3}\\\\.\\\\d{1,3}\\\\.\\\\d{1,3}\\\\.\\\\d{1,3}\\\\b', '<IP>'),
            '\\\\b\\\\d+\\\\b', '<N>'),
          '"[^"]*"', '<STR>')`;

        const sql = `
          SELECT
            ${patternExpr} AS pattern,
            count() AS count,
            any(level) AS level,
            any(service) AS service,
            min(timestamp) AS first_seen,
            max(timestamp) AS last_seen,
            any(message) AS sample_message
          FROM argus.logs
          WHERE ${conditions.join(' AND ')}
          GROUP BY pattern
          ORDER BY count DESC
          LIMIT {patternLimit:UInt32}
        `;
        params.patternLimit = String(Math.min(parseInt(limit, 10), 200));

        const result = await optic.rawQuery({ query: sql, params });
        return reply.send({ data: result.data });
      } catch (error) {
        logger.error('Failed to get log patterns', {
          projectId,
          error: String(error),
        });
        return reply.code(500).send({ error: 'Failed to get log patterns' });
      }
    }
  );

  // ─── Custom Attribute Facet (distinct values for a given attribute key) ───
  app.get(
    '/:projectId/logs/attribute-facet',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId } = request.params as { projectId: string };
      const {
        key,
        period = '24h',
        start,
        end,
      } = request.query as Record<string, string>;

      if (!key) {
        return reply.code(400).send({ error: 'key parameter is required' });
      }

      const bucket = getBucketingConfig(period, start, end);
      const timeCond = `timestamp >= toDateTime({fillStart:UInt32}) AND timestamp <= toDateTime({fillEnd:UInt32})`;

      try {
        const params: Record<string, string> = {
          projectId: String(projectId),
          fillStart: String(bucket.queryParams.fillStart),
          fillEnd: String(bucket.queryParams.fillEnd),
        };

        // Top-level columns can be queried directly (not from attributes Map)
        const TOP_LEVEL_COLUMNS = new Set([
          'message',
          'body',
          'level',
          'service',
          'environment',
          'release',
          'logger_name',
          'trace_id',
          'span_id',
        ]);

        let sql: string;
        if (TOP_LEVEL_COLUMNS.has(key)) {
          sql = `
            SELECT
              ${key} AS attr_value,
              count() AS count
            FROM argus.logs
            WHERE project_id = {projectId:String}
              AND ${timeCond}
              AND ${key} != ''
            GROUP BY attr_value
            ORDER BY count DESC
            LIMIT 30
          `;
        } else {
          params.attrKey = key;
          sql = `
            SELECT
              attributes[{attrKey:String}] AS attr_value,
              count() AS count
            FROM argus.logs
            WHERE project_id = {projectId:String}
              AND ${timeCond}
              AND mapContains(attributes, {attrKey:String})
              AND attr_value != ''
            GROUP BY attr_value
            ORDER BY count DESC
            LIMIT 30
          `;
        }

        const result = await optic.rawQuery({ query: sql, params });
        return reply.send({ data: result.data });
      } catch (error) {
        logger.error('Failed to get attribute facet', {
          projectId,
          key,
          error: String(error),
        });
        return reply.code(500).send({ error: 'Failed to get attribute facet' });
      }
    }
  );

  // ─── Attribute Keys Discovery (all attribute facets, time-period only) ───
  app.get(
    '/:projectId/logs/attribute-keys',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId } = request.params as { projectId: string };
      const {
        period = '24h',
        start,
        end,
        limit = '20',
      } = request.query as Record<string, string>;

      const bucket = getBucketingConfig(period, start, end);
      const timeCond = `timestamp >= toDateTime({fillStart:UInt32}) AND timestamp <= toDateTime({fillEnd:UInt32})`;

      try {
        const params: Record<string, string> = {
          projectId: String(projectId),
          fillStart: String(bucket.queryParams.fillStart),
          fillEnd: String(bucket.queryParams.fillEnd),
        };

        // Step 1: Discover all attribute keys with their occurrence count
        // Sample up to 10000 recent logs to extract attribute keys
        const keysSql = `
          SELECT
            arrayJoin(mapKeys(attributes)) AS attr_key,
            count() AS key_count
          FROM (
            SELECT attributes
            FROM argus.logs
            WHERE project_id = {projectId:String}
              AND ${timeCond}
              AND length(mapKeys(attributes)) > 0
            ORDER BY timestamp DESC
            LIMIT 10000
          )
          GROUP BY attr_key
          ORDER BY key_count DESC
          LIMIT {keyLimit:UInt32}
        `;
        params.keyLimit = String(Math.min(parseInt(limit, 10), 50));

        const keysResult = await optic.rawQuery({ query: keysSql, params });
        const keys =
          (keysResult.data as { attr_key: string; key_count: string }[]) || [];

        if (keys.length === 0) {
          return reply.send({ data: [] });
        }

        // Step 2: For each discovered key, get top values
        const facetPromises = keys.map(async ({ attr_key, key_count }) => {
          const valParams: Record<string, string> = {
            projectId: String(projectId),
            fillStart: String(bucket.queryParams.fillStart),
            fillEnd: String(bucket.queryParams.fillEnd),
            attrKey: attr_key,
          };

          const valSql = `
            SELECT
              attributes[{attrKey:String}] AS attr_value,
              count() AS count
            FROM argus.logs
            WHERE project_id = {projectId:String}
              AND ${timeCond}
              AND mapContains(attributes, {attrKey:String})
              AND attr_value != ''
            GROUP BY attr_value
            ORDER BY count DESC
            LIMIT 20
          `;

          const valResult = await optic.rawQuery({
            query: valSql,
            params: valParams,
          });
          return {
            key: attr_key,
            count: Number(key_count),
            values:
              (valResult.data as { attr_value: string; count: string }[]) || [],
          };
        });

        const facets = await Promise.all(facetPromises);
        return reply.send({ data: facets });
      } catch (error) {
        logger.error('Failed to discover attribute keys', {
          projectId,
          error: String(error),
        });
        return reply
          .code(500)
          .send({ error: 'Failed to discover attribute keys' });
      }
    }
  );

  // ─── Live Tail (SSE — stream new logs in real-time) ───
  app.get(
    '/:projectId/logs/live-tail',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId } = request.params as { projectId: string };
      const { level, service, environment, search } = request.query as Record<
        string,
        string
      >;

      reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      });

      let lastTimestamp = new Date().toISOString();
      let closed = false;

      request.raw.on('close', () => {
        closed = true;
      });

      const poll = async () => {
        if (closed) return;

        try {
          const conditions: string[] = [
            'project_id = {projectId:String}',
            'timestamp > {lastTs:DateTime64(3)}',
          ];
          const params: Record<string, string> = {
            projectId: String(projectId),
            lastTs: String(lastTimestamp).replace('Z', '').replace('T', ' '),
          };

          if (level) {
            const levels = level.split(',');
            conditions.push(
              `level IN (${levels.map((_, i) => `{llvl_${i}:String}`).join(', ')})`
            );
            levels.forEach((l, i) => {
              params[`llvl_${i}`] = l.trim();
            });
          }
          if (service) {
            conditions.push('service = {lservice:String}');
            params.lservice = service;
          }
          if (environment) {
            conditions.push('environment = {lenvironment:String}');
            params.lenvironment = environment;
          }

          if (search && typeof search === 'string' && search.trim()) {
            const parser = new QueryParser(
              LOGS_ALLOWED_COLUMNS,
              new Set(),
              LOGS_COLUMN_ALIASES
            );
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
            ORDER BY timestamp ASC
            LIMIT 50
          `;

          const result = await optic.rawQuery({ query: sql, params });
          const rows = result.data as any[];

          if (rows.length > 0) {
            lastTimestamp = rows[rows.length - 1].timestamp;
            reply.raw.write(`data: ${JSON.stringify(rows)}\n\n`);
          } else {
            reply.raw.write(': heartbeat\n\n');
          }
        } catch (err) {
          logger.error('Live tail poll error', { error: String(err) });
        }

        if (!closed) {
          setTimeout(poll, 2000);
        }
      };

      poll();
    }
  );
}

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { clickhouse } from '../config/clickhouse';
import { mysqlPool } from '../config/mysql';
import { createLogger } from '../utils/logger';
import { QueryParser } from '../utils/queryParser';
import { getBucketingConfig } from '../utils/timeBucket';

const logger = createLogger('argus-discover');

// Allowed columns for query safety
const ALLOWED_COLUMNS = new Set([
  'event_id', 'timestamp', 'platform', 'level', 'type', 'value',
  'logger', 'transaction', 'server_name', 'release', 'dist',
  'environment', 'http_url', 'browser_name', 'browser_version', 'os_name',
  'os_version', 'device_name', 'device_family', 'issue_id', 'project_id',
  'user_id', 'user_email', 'sdk_name', 'sdk_version',
  'runtime_name', 'runtime_version', 'geo_country', 'http_method',
]);

const ALLOWED_AGGREGATES = new Set([
  'count', 'uniq', 'min', 'max', 'avg', 'sum', 'p50', 'p75', 'p95', 'p99',
]);

interface DiscoverQuery {
  fields: string[];
  conditions?: string;
  groupBy?: string[];
  orderBy?: string;
  limit?: number;
  offset?: number;
  period?: string;
  start?: string;
  end?: string;
}

/**
 * Parse a Discover field like "count()" or "uniq(user_id)" or plain "level"
 */
function parseField(field: string): { sql: string; alias: string } {
  let expr = field.trim();
  let customAlias = '';

  // Extract ' AS alias' if present (case insensitive)
  const asMatch = expr.match(/^(.*?)\s+AS\s+([a-zA-Z0-9_]+)$/i);
  if (asMatch) {
    expr = asMatch[1].trim();
    customAlias = asMatch[2].trim();
  }

  // Equation pattern: equation|count() / uniq(user_id)
  if (expr.startsWith('equation|')) {
    const eq = expr.replace('equation|', '').trim();
    
    // VERY simple sanitization: allow only numbers, basic math, allowed aggregates and parens
    // Sentry supports complex equations, we start with simple math.
    // e.g. count() / p50()
    // Let's validate the tokens
    let sqlEq = eq;
    const tokens = eq.split(/([\s\+\-\*\/\(\)])/);
    for (const t of tokens) {
      const trimmed = t.trim();
      if (!trimmed || ['+', '-', '*', '/', '(', ')'].includes(trimmed)) continue;
      if (!isNaN(Number(trimmed))) continue;
      
      const aggMatch = trimmed.match(/^(\w+)\((\w*)\)$/);
      if (aggMatch) {
        const [, func, col] = aggMatch;
        if (!ALLOWED_AGGREGATES.has(func.toLowerCase())) {
          throw new Error(`Disallowed aggregate in equation: ${func}`);
        }
        if (col && !ALLOWED_COLUMNS.has(col)) {
          throw new Error(`Disallowed column in equation: ${col}`);
        }
        // Transform uniq/p95 exactly as we do for normal aggregates
        if (func.toLowerCase() === 'uniq') {
          sqlEq = sqlEq.replace(trimmed, `uniq(${col || '*'})`);
        } else if (['p50', 'p75', 'p95', 'p99'].includes(func.toLowerCase())) {
          const pct = parseInt(func.replace(/p/i, ''), 10);
          sqlEq = sqlEq.replace(trimmed, `quantile(${pct / 100})(${col || 'timestamp'})`);
        }
        continue;
      }
      throw new Error(`Invalid token in equation: ${trimmed}`);
    }
    
    return { sql: `(${sqlEq})`, alias: customAlias || `eq_${Math.random().toString(36).substring(7)}` };
  }

  // Aggregate function pattern: func(column)
  const aggMatch = expr.match(/^(\w+)\((\w*)\)$/);
  if (aggMatch) {
    const [, func, col] = aggMatch;
    if (!ALLOWED_AGGREGATES.has(func.toLowerCase())) {
      throw new Error(`Disallowed aggregate: ${func}`);
    }
    const fn = func.toLowerCase();
    
    let sql = '';
    let defaultAlias = '';

    if (fn === 'count' && !col) {
      sql = 'count()';
      defaultAlias = 'count';
    } else if (fn === 'uniq') {
      const safeCol = col && ALLOWED_COLUMNS.has(col) ? col : '*';
      sql = `uniq(${safeCol})`;
      defaultAlias = `uniq_${col || 'all'}`;
    } else if (['p50', 'p75', 'p95', 'p99'].includes(fn)) {
      const pct = parseInt(fn.replace('p', ''), 10);
      const safeCol = col && ALLOWED_COLUMNS.has(col) ? col : 'timestamp';
      sql = `quantile(${pct / 100})(${safeCol})`;
      defaultAlias = `${fn}_${col || 'timestamp'}`;
    } else {
      const safeCol = col && ALLOWED_COLUMNS.has(col) ? col : '*';
      sql = `${fn}(${safeCol})`;
      defaultAlias = `${fn}_${col || 'all'}`;
    }
    
    return { sql, alias: customAlias || defaultAlias };
  }

  // Plain column
  if (!ALLOWED_COLUMNS.has(expr)) {
    throw new Error(`Disallowed column: ${expr}`);
  }
  return { sql: expr, alias: customAlias || expr };
}

function buildTimeFilter(period?: string, start?: string, end?: string): string {
  if (start && end) {
    return `timestamp >= '${start}' AND timestamp <= '${end}'`;
  }
  const periodMap: Record<string, string> = {
    '1h': '1 HOUR',
    '6h': '6 HOUR',
    '12h': '12 HOUR',
    '24h': '24 HOUR',
    '7d': '7 DAY',
    '14d': '14 DAY',
    '30d': '30 DAY',
    '90d': '90 DAY',
  };
  const interval = periodMap[period || '24h'] || '24 HOUR';
  return `timestamp >= now() - INTERVAL ${interval}`;
}

export default async function discoverRoutes(app: FastifyInstance) {
  // Discover query endpoint
  app.post(
    '/:projectId/discover',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId } = request.params as { projectId: string };
      const body = request.body as DiscoverQuery;

      try {
        const { fields = ['count()'], groupBy, orderBy, limit = 50, offset = 0, period, start, end, conditions } = body;

        // Parse fields
        const parsedFields = fields.map(parseField);
        const selectClause = parsedFields.map(f => `${f.sql} AS ${f.alias}`).join(', ');

        const queryParams: Record<string, string> = { projectId };
        
        // Build query
        let query = `SELECT ${selectClause} FROM argus.errors WHERE project_id = {projectId:String}`;
        query += ` AND ${buildTimeFilter(period, start, end)}`;

        let havingClause = '';

        // Advanced conditions using QueryParser
        if (conditions && conditions.trim()) {
          const parser = new QueryParser(ALLOWED_COLUMNS, ALLOWED_AGGREGATES);
          const ast = parser.parse(conditions);
          if (ast) {
            const { where, having } = parser.generateSQL(ast, queryParams);
            if (where) query += ` AND (${where})`;
            if (having) havingClause = `HAVING ${having}`;
          }
        }

        // Group by — auto-include non-aggregate fields
        const nonAggFields = parsedFields.filter(f => f.sql === f.alias).map(f => f.alias);
        const requestedGroup = (groupBy && groupBy.length > 0) ? groupBy.filter(c => ALLOWED_COLUMNS.has(c)) : [];
        // If there are aggregate fields AND plain columns, we must group by the plain columns
        const hasAggregates = parsedFields.some(f => f.sql !== f.alias);
        const effectiveGroupBy = [...new Set([...requestedGroup, ...(hasAggregates ? nonAggFields : [])])];
        if (effectiveGroupBy.length > 0) {
          query += ` GROUP BY ${effectiveGroupBy.join(', ')}`;
        }

        if (havingClause) {
          query += ` ${havingClause}`;
        }

        // Order by
        if (orderBy) {
          const orderMatch = orderBy.match(/^(-?)(\w+)$/);
          if (orderMatch) {
            const [, desc, col] = orderMatch;
            // Allow ordering by alias or column
            const validAlias = parsedFields.find(f => f.alias === col);
            if (validAlias || ALLOWED_COLUMNS.has(col)) {
              query += ` ORDER BY ${col} ${desc === '-' ? 'DESC' : 'ASC'}`;
            }
          }
        } else if (groupBy && groupBy.length > 0) {
          // Default: order by first aggregate DESC
          const firstAgg = parsedFields.find(f => f.alias !== f.sql);
          if (firstAgg) {
            query += ` ORDER BY ${firstAgg.alias} DESC`;
          }
        }

        query += ` LIMIT ${Math.min(Number(limit), 1000)}`;
        if (offset > 0) {
          query += ` OFFSET ${Number(offset)}`;
        }

        logger.info('Discover query', { projectId, query: query.slice(0, 200) });

        const result = await clickhouse.query({
          query,
          query_params: queryParams,
          format: 'JSONEachRow',
        });
        const data = await result.json();

        return reply.send({
          data: data as any[],
          meta: {
            fields: parsedFields.map(f => ({ name: f.alias, type: f.sql === f.alias ? 'column' : 'aggregate' })),
          },
        });
      } catch (error) {
        logger.error('Discover query failed', {
          projectId,
          error: error instanceof Error ? error.message : String(error),
        });
        return reply.code(400).send({
          error: error instanceof Error ? error.message : 'Query failed',
        });
      }
    }
  );

  // Get available tags/columns for Discover UI
  app.get(
    '/:projectId/discover/tags',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId } = request.params as { projectId: string };

      try {
        // Get distinct values for key columns
        const result = await clickhouse.query({
          query: `
            SELECT
              uniq(level) as level_count,
              uniq(platform) as platform_count,
              uniq(environment) as env_count,
              uniq(browser_name) as browser_count,
              uniq(os_name) as os_count,
              uniq(release) as release_count
            FROM argus.errors
            WHERE project_id = {projectId:String}
              AND timestamp >= now() - INTERVAL 30 DAY
          `,
          query_params: { projectId },
          format: 'JSONEachRow',
        });
        const stats = (await result.json() as any[])?.[0] || {};

        // Get distinct values for each tag
        const tagsResult = await clickhouse.query({
          query: `
            SELECT 'level' AS tag, level AS value, count() AS cnt
            FROM argus.errors
            WHERE project_id = {projectId:String} AND timestamp >= now() - INTERVAL 30 DAY
            GROUP BY level ORDER BY cnt DESC LIMIT 20

            UNION ALL

            SELECT 'platform' AS tag, platform AS value, count() AS cnt
            FROM argus.errors
            WHERE project_id = {projectId:String} AND timestamp >= now() - INTERVAL 30 DAY
            GROUP BY platform ORDER BY cnt DESC LIMIT 20

            UNION ALL

            SELECT 'environment' AS tag, environment AS value, count() AS cnt
            FROM argus.errors
            WHERE project_id = {projectId:String} AND timestamp >= now() - INTERVAL 30 DAY AND environment != ''
            GROUP BY environment ORDER BY cnt DESC LIMIT 20

            UNION ALL

            SELECT 'browser_name' AS tag, browser_name AS value, count() AS cnt
            FROM argus.errors
            WHERE project_id = {projectId:String} AND timestamp >= now() - INTERVAL 30 DAY AND browser_name != ''
            GROUP BY browser_name ORDER BY cnt DESC LIMIT 20

            UNION ALL

            SELECT 'os_name' AS tag, os_name AS value, count() AS cnt
            FROM argus.errors
            WHERE project_id = {projectId:String} AND timestamp >= now() - INTERVAL 30 DAY AND os_name != ''
            GROUP BY os_name ORDER BY cnt DESC LIMIT 20

            UNION ALL

            SELECT 'release' AS tag, release AS value, count() AS cnt
            FROM argus.errors
            WHERE project_id = {projectId:String} AND timestamp >= now() - INTERVAL 30 DAY AND release != ''
            GROUP BY release ORDER BY cnt DESC LIMIT 20

            UNION ALL

            SELECT 'transaction' AS tag, transaction AS value, count() AS cnt
            FROM argus.errors
            WHERE project_id = {projectId:String} AND timestamp >= now() - INTERVAL 30 DAY AND transaction != ''
            GROUP BY transaction ORDER BY cnt DESC LIMIT 20

            UNION ALL

            SELECT 'server_name' AS tag, server_name AS value, count() AS cnt
            FROM argus.errors
            WHERE project_id = {projectId:String} AND timestamp >= now() - INTERVAL 30 DAY AND server_name != ''
            GROUP BY server_name ORDER BY cnt DESC LIMIT 20

            UNION ALL

            SELECT 'type' AS tag, type AS value, count() AS cnt
            FROM argus.errors
            WHERE project_id = {projectId:String} AND timestamp >= now() - INTERVAL 30 DAY AND type != ''
            GROUP BY type ORDER BY cnt DESC LIMIT 20

            UNION ALL

            SELECT 'device_name' AS tag, device_name AS value, count() AS cnt
            FROM argus.errors
            WHERE project_id = {projectId:String} AND timestamp >= now() - INTERVAL 30 DAY AND device_name != ''
            GROUP BY device_name ORDER BY cnt DESC LIMIT 20
          `,
          query_params: { projectId },
          format: 'JSONEachRow',
        });
        const tagValues = await tagsResult.json() as any[];

        // Group by tag
        const tagMap: Record<string, { value: string; count: number }[]> = {};
        for (const row of tagValues) {
          if (!tagMap[row.tag]) tagMap[row.tag] = [];
          tagMap[row.tag].push({ value: row.value, count: Number(row.cnt) });
        }

        return reply.send({
          data: {
            columns: Array.from(ALLOWED_COLUMNS),
            aggregates: Array.from(ALLOWED_AGGREGATES),
            stats,
            tags: tagMap,
          },
        });
      } catch (error) {
        logger.error('Failed to get discover tags', {
          projectId,
          error: error instanceof Error ? error.message : String(error),
        });
        return reply.code(500).send({ error: 'Failed to get tags' });
      }
    }
  );

  // Get discover volume
  app.get(
    '/:projectId/discover/volume',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId } = request.params as { projectId: string };
      const { period, start, end, search } = request.query as any;

      try {
        const bucket = getBucketingConfig(period, start, end);
        const timeFilter = start && end
          ? `timestamp >= '${start}' AND timestamp <= '${end}'`
          : `timestamp >= toDateTime(${bucket.queryParams.fillStart})`;

        let query = `
          SELECT
            ${bucket.selectExpr} AS hour,
            level,
            count() as count
          FROM argus.errors
          WHERE project_id = {projectId:String}
        `;
        
        query += ` AND ${timeFilter}`;

        const queryParams: Record<string, string> = { projectId };

        // Parse conditions from search param using QueryParser
        if (search && typeof search === 'string' && search.trim()) {
          const parser = new QueryParser(ALLOWED_COLUMNS, ALLOWED_AGGREGATES);
          const ast = parser.parse(search);
          if (ast) {
            const { where } = parser.generateSQL(ast, queryParams);
            if (where) query += ` AND (${where})`;
          }
        }

        query += `
          GROUP BY hour, level
          ORDER BY hour ASC
        `;

        const result = await clickhouse.query({
          query,
          query_params: queryParams,
          format: 'JSONEachRow',
        });
        const data = await result.json();

        return reply.send({ data });
      } catch (error) {
        logger.error('Failed to get discover volume', {
          projectId,
          error: error instanceof Error ? error.message : String(error),
        });
        return reply.code(500).send({ error: 'Failed to get discover volume' });
      }
    }
  );

  // === Saved Queries (shared across Discover, Logs, Traces, Metrics) ===

  // List saved queries (optional query_type filter)
  app.get(
    '/:projectId/discover/saved',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId } = request.params as { projectId: string };
      const { query_type } = request.query as { query_type?: string };
      try {
        let sql = 'SELECT * FROM g_argus_saved_queries WHERE project_id = ?';
        const params: any[] = [projectId];

        if (query_type) {
          sql += ' AND query_type = ?';
          params.push(query_type);
        }

        sql += ' ORDER BY updated_at DESC';

        const [rows] = await mysqlPool.execute(sql, params);
        return reply.send({ data: rows });
      } catch (error: any) {
        // Table might not exist yet — return empty gracefully
        if (error?.code === 'ER_NO_SUCH_TABLE' || String(error?.message || '').includes("doesn't exist")) {
          logger.warn('g_argus_saved_queries table not found, returning empty');
          return reply.send({ data: [] });
        }
        logger.error('Failed to list saved queries', {
          projectId,
          error: error instanceof Error ? error.message : String(error),
        });
        return reply.code(500).send({ error: 'Failed to list saved queries' });
      }
    }
  );

  // Create saved query
  app.post(
    '/:projectId/discover/saved',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId } = request.params as { projectId: string };
      const { name, description, query_config, display_type, is_global, query_type } = request.body as {
        name: string;
        description?: string;
        query_config: Record<string, any>;
        display_type?: string;
        is_global?: boolean;
        query_type?: 'discover' | 'logs' | 'traces' | 'metrics';
      };
      const createdBy = (request.headers['x-user-name'] as string) || 'system';

      try {
        const [result] = await mysqlPool.execute(
          `INSERT INTO g_argus_saved_queries (project_id, name, description, query_type, query_config, display_type, is_global, created_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [projectId, name, description || null, query_type || 'discover', JSON.stringify(query_config), display_type || 'table', is_global ? 1 : 0, createdBy]
        );
        const insertId = (result as any).insertId;
        return reply.code(201).send({ data: { id: insertId, name, query_type: query_type || 'discover' } });
      } catch (error) {
        logger.error('Failed to save query', {
          projectId,
          error: error instanceof Error ? error.message : String(error),
        });
        return reply.code(500).send({ error: 'Failed to save query' });
      }
    }
  );

  // Update saved query
  app.put(
    '/:projectId/discover/saved/:queryId',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId, queryId } = request.params as { projectId: string; queryId: string };
      const { name, description, query_config, display_type, is_favorite } = request.body as {
        name?: string;
        description?: string;
        query_config?: Record<string, any>;
        display_type?: string;
        is_favorite?: boolean;
      };

      try {
        const updates: string[] = [];
        const values: any[] = [];

        if (name !== undefined) { updates.push('name = ?'); values.push(name); }
        if (description !== undefined) { updates.push('description = ?'); values.push(description); }
        if (query_config !== undefined) { updates.push('query_config = ?'); values.push(JSON.stringify(query_config)); }
        if (display_type !== undefined) { updates.push('display_type = ?'); values.push(display_type); }
        if (is_favorite !== undefined) { updates.push('is_favorite = ?'); values.push(is_favorite ? 1 : 0); }

        if (updates.length === 0) return reply.code(400).send({ error: 'Nothing to update' });

        values.push(queryId, projectId);
        await mysqlPool.execute(
          `UPDATE g_argus_saved_queries SET ${updates.join(', ')} WHERE id = ? AND project_id = ?`,
          values
        );
        return reply.send({ success: true });
      } catch (error) {
        logger.error('Failed to update saved query', {
          projectId,
          queryId,
          error: error instanceof Error ? error.message : String(error),
        });
        return reply.code(500).send({ error: 'Failed to update saved query' });
      }
    }
  );

  // Delete saved query
  app.delete(
    '/:projectId/discover/saved/:queryId',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId, queryId } = request.params as { projectId: string; queryId: string };
      try {
        await mysqlPool.execute(
          'DELETE FROM g_argus_saved_queries WHERE id = ? AND project_id = ?',
          [queryId, projectId]
        );
        return reply.send({ success: true });
      } catch (error) {
        logger.error('Failed to delete saved query', {
          projectId,
          error: error instanceof Error ? error.message : String(error),
        });
        return reply.code(500).send({ error: 'Failed to delete saved query' });
      }
    }
  );
}

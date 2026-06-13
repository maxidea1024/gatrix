import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { optic, parseSearchToSQL, getDataset } from '@gatrix/argus-optic';
import db from '../config/knex';
import { createLogger } from '../utils/logger';
import { getBucketingConfig, buildTimeFilter } from '../utils/timeBucket';

const logger = createLogger('argus-discover');

// Allowed columns for field validation (derived from dataset schema, excluding Map columns)
const errorsDataset = getDataset('errors');
const ALLOWED_COLUMNS = new Set(
  [...errorsDataset.columns.entries()]
    .filter(([, def]) => !def.type.startsWith('Map('))
    .map(([name]) => name)
);

const ALLOWED_AGGREGATES = new Set([
  'count',
  'uniq',
  'min',
  'max',
  'avg',
  'sum',
  'p50',
  'p75',
  'p95',
  'p99',
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
      if (!trimmed || ['+', '-', '*', '/', '(', ')'].includes(trimmed))
        continue;
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
          sqlEq = sqlEq.replace(
            trimmed,
            `quantile(${pct / 100})(${col || 'timestamp'})`
          );
        }
        continue;
      }
      throw new Error(`Invalid token in equation: ${trimmed}`);
    }

    return {
      sql: `(${sqlEq})`,
      alias: customAlias || `eq_${Math.random().toString(36).substring(7)}`,
    };
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

export default async function discoverRoutes(app: FastifyInstance) {
  // Discover query endpoint
  app.post(
    '/:projectId/discover',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId } = request.params as { projectId: string };
      const body = request.body as DiscoverQuery;

      try {
        const {
          fields = ['count()'],
          groupBy,
          orderBy,
          limit = 50,
          offset = 0,
          period,
          start,
          end,
          conditions,
        } = body;

        // Parse fields
        const parsedFields = fields.map(parseField);
        const selectClause = parsedFields
          .map((f) => `${f.sql} AS ${f.alias}`)
          .join(', ');

        const queryParams: Record<string, string> = { projectId };

        // Build query
        let query = `SELECT ${selectClause} FROM argus.errors WHERE project_id = {projectId:String}`;
        query += ` AND ${buildTimeFilter(period, start, end)}`;

        let havingClause = '';

        // Advanced conditions using parseSearchToSQL
        if (conditions && conditions.trim()) {
          const { where, having } = parseSearchToSQL('errors', conditions, queryParams);
          if (where) query += ` AND (${where})`;
          if (having) havingClause = `HAVING ${having}`;
        }

        // Group by ??auto-include non-aggregate fields
        const nonAggFields = parsedFields
          .filter((f) => f.sql === f.alias)
          .map((f) => f.alias);
        const requestedGroup =
          groupBy && groupBy.length > 0
            ? groupBy.filter((c) => ALLOWED_COLUMNS.has(c))
            : [];
        // If there are aggregate fields AND plain columns, we must group by the plain columns
        const hasAggregates = parsedFields.some((f) => f.sql !== f.alias);
        const effectiveGroupBy = [
          ...new Set([
            ...requestedGroup,
            ...(hasAggregates ? nonAggFields : []),
          ]),
        ];
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
            const validAlias = parsedFields.find((f) => f.alias === col);
            if (validAlias || ALLOWED_COLUMNS.has(col)) {
              query += ` ORDER BY ${col} ${desc === '-' ? 'DESC' : 'ASC'}`;
            }
          }
        } else if (groupBy && groupBy.length > 0) {
          // Default: order by first aggregate DESC
          const firstAgg = parsedFields.find((f) => f.alias !== f.sql);
          if (firstAgg) {
            query += ` ORDER BY ${firstAgg.alias} DESC`;
          }
        }

        query += ` LIMIT ${Math.min(Number(limit), 1000)}`;
        if (offset > 0) {
          query += ` OFFSET ${Number(offset)}`;
        }

        logger.info('Discover query', {
          projectId,
          query: query.slice(0, 200),
        });

        const result = await optic.rawQuery({
          query,
          params: queryParams,
        });

        return reply.send({
          data: result.data as any[],
          meta: {
            fields: parsedFields.map((f) => ({
              name: f.alias,
              type: f.sql === f.alias ? 'column' : 'aggregate',
            })),
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
      const {
        period = '30d',
        start,
        end,
      } = request.query as { period?: string; start?: string; end?: string };
      const timeFilter = buildTimeFilter(period, start, end, '30d');

      try {
        // Get distinct values for key columns
        const result = await optic.rawQuery({
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
              AND ${timeFilter}
          `,
          params: { projectId },
        });
        const stats = (result.data as any[])?.[0] || {};

        const tagsResult = await optic.rawQuery({
          query: `
            SELECT 'level' AS tag, level AS value, count() AS cnt
            FROM argus.errors
            WHERE project_id = {projectId:String} AND ${timeFilter}
            GROUP BY level ORDER BY cnt DESC LIMIT 20

            UNION ALL

            SELECT 'platform' AS tag, platform AS value, count() AS cnt
            FROM argus.errors
            WHERE project_id = {projectId:String} AND ${timeFilter}
            GROUP BY platform ORDER BY cnt DESC LIMIT 20

            UNION ALL

            SELECT 'environment' AS tag, environment AS value, count() AS cnt
            FROM argus.errors
            WHERE project_id = {projectId:String} AND ${timeFilter} AND environment != ''
            GROUP BY environment ORDER BY cnt DESC LIMIT 20

            UNION ALL

            SELECT 'browser_name' AS tag, browser_name AS value, count() AS cnt
            FROM argus.errors
            WHERE project_id = {projectId:String} AND ${timeFilter} AND browser_name != ''
            GROUP BY browser_name ORDER BY cnt DESC LIMIT 20

            UNION ALL

            SELECT 'os_name' AS tag, os_name AS value, count() AS cnt
            FROM argus.errors
            WHERE project_id = {projectId:String} AND ${timeFilter} AND os_name != ''
            GROUP BY os_name ORDER BY cnt DESC LIMIT 20

            UNION ALL

            SELECT 'release' AS tag, release AS value, count() AS cnt
            FROM argus.errors
            WHERE project_id = {projectId:String} AND ${timeFilter} AND release != ''
            GROUP BY release ORDER BY cnt DESC LIMIT 20

            UNION ALL

            SELECT 'transaction' AS tag, transaction AS value, count() AS cnt
            FROM argus.errors
            WHERE project_id = {projectId:String} AND ${timeFilter} AND transaction != ''
            GROUP BY transaction ORDER BY cnt DESC LIMIT 20

            UNION ALL

            SELECT 'server_name' AS tag, server_name AS value, count() AS cnt
            FROM argus.errors
            WHERE project_id = {projectId:String} AND ${timeFilter} AND server_name != ''
            GROUP BY server_name ORDER BY cnt DESC LIMIT 20

            UNION ALL

            SELECT 'type' AS tag, type AS value, count() AS cnt
            FROM argus.errors
            WHERE project_id = {projectId:String} AND ${timeFilter} AND type != ''
            GROUP BY type ORDER BY cnt DESC LIMIT 20

            UNION ALL

            SELECT 'device_name' AS tag, device_name AS value, count() AS cnt
            FROM argus.errors
            WHERE project_id = {projectId:String} AND ${timeFilter} AND device_name != ''
            GROUP BY device_name ORDER BY cnt DESC LIMIT 20
          `,
          params: { projectId },
        });
        const tagValues = tagsResult.data as any[];

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
        const timeFilter =
          start && end
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

        // Parse conditions from search param using parseSearchToSQL
        if (search && typeof search === 'string' && search.trim()) {
          const { where: searchWhere } = parseSearchToSQL('errors', search, queryParams);
          if (searchWhere) query += ` AND (${searchWhere})`;
        }

        query += `
          GROUP BY hour, level
          ORDER BY hour ASC
        `;

        const result = await optic.rawQuery({
          query,
          params: queryParams,
        });

        return reply.send({ data: result.data });
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
        const query = db('g_argus_saved_queries').where(
          'project_id',
          projectId
        );
        if (query_type) {
          query.where('query_type', query_type);
        }
        const rows = await query.orderBy('updated_at', 'desc');
        return reply.send({ data: rows });
      } catch (error: any) {
        // Table might not exist yet ??return empty gracefully
        if (
          error?.code === 'ER_NO_SUCH_TABLE' ||
          String(error?.message || '').includes("doesn't exist")
        ) {
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
      const {
        name,
        description,
        query_config,
        display_type,
        is_global,
        query_type,
      } = request.body as {
        name: string;
        description?: string;
        query_config: Record<string, any>;
        display_type?: string;
        is_global?: boolean;
        query_type?: 'discover' | 'logs' | 'traces' | 'metrics';
      };
      const createdBy = (request.headers['x-user-name'] as string) || 'system';

      try {
        const [insertId] = await db('g_argus_saved_queries').insert({
          project_id: projectId,
          name,
          description: description || null,
          query_type: query_type || 'discover',
          query_config: JSON.stringify(query_config),
          display_type: display_type || 'table',
          is_global: is_global ? 1 : 0,
          created_by: createdBy,
        });
        return reply.code(201).send({
          data: { id: insertId, name, query_type: query_type || 'discover' },
        });
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
      const { projectId, queryId } = request.params as {
        projectId: string;
        queryId: string;
      };
      const { name, description, query_config, display_type, is_favorite } =
        request.body as {
          name?: string;
          description?: string;
          query_config?: Record<string, any>;
          display_type?: string;
          is_favorite?: boolean;
        };

      try {
        const updateObj: any = {};
        if (name !== undefined) updateObj.name = name;
        if (description !== undefined) updateObj.description = description;
        if (query_config !== undefined)
          updateObj.query_config = JSON.stringify(query_config);
        if (display_type !== undefined) updateObj.display_type = display_type;
        if (is_favorite !== undefined)
          updateObj.is_favorite = is_favorite ? 1 : 0;

        if (Object.keys(updateObj).length === 0)
          return reply.code(400).send({ error: 'Nothing to update' });

        await db('g_argus_saved_queries')
          .where({ id: queryId, project_id: projectId })
          .update(updateObj);
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
      const { projectId, queryId } = request.params as {
        projectId: string;
        queryId: string;
      };
      try {
        await db('g_argus_saved_queries')
          .where({ id: queryId, project_id: projectId })
          .del();
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

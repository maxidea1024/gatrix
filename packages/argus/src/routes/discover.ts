import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { optic, parseSearchToSQL, getDataset } from '@gatrix/argus-optic';
import db from '../config/knex';
import { createLogger } from '../utils/logger';
import { getBucketingConfig, buildTimeFilter } from '../utils/timeBucket';

const logger = createLogger('argus-discover');

// Supported datasets for Discover
const DISCOVER_DATASETS = new Set([
  'errors',
  'feedback',
  'spans',
  'logs',
  'transactions',
  'sessions',
  'activities',
]);

/**
 * Resolve dataset config, columns and aggregates dynamically.
 * Falls back to 'errors' if invalid dataset provided.
 */
function getDiscoverDataset(name?: string) {
  const dsName = name && DISCOVER_DATASETS.has(name) ? name : 'errors';
  const ds = getDataset(dsName);
  const allowedColumns = new Set(
    [...ds.columns.entries()]
      .filter(([, def]) => !def.type.startsWith('Map('))
      .map(([n]) => n)
  );
  const allowedAggregates = new Set([
    ...ds.aggregates,
    // Always include these common ones
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
  return { ds, allowedColumns, allowedAggregates, table: ds.table };
}

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
  dataset?: string;
}

/**
 * Parse a Discover field like "count()" or "uniq(user_id)" or plain "level"
 */
function parseField(
  field: string,
  ALLOWED_COLUMNS: Set<string>,
  ALLOWED_AGGREGATES: Set<string>
): { sql: string; alias: string } {
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

  // Plain column — allow even if not in ALLOWED_COLUMNS for flexibility
  // The DB will error if the column truly doesn't exist
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
          dataset: datasetName,
        } = body;

        const {
          allowedColumns: ALLOWED_COLUMNS,
          allowedAggregates: ALLOWED_AGGREGATES,
          table,
        } = getDiscoverDataset(datasetName);
        const dsName =
          datasetName && DISCOVER_DATASETS.has(datasetName)
            ? datasetName
            : 'errors';

        // Parse fields — filter out plain columns not in this dataset
        const parsedFields = fields
          .filter((f) => {
            const trimmed = f
              .trim()
              .replace(/\s+AS\s+\w+$/i, '')
              .trim();
            // Keep aggregates and equations
            if (trimmed.includes('(') || trimmed.startsWith('equation|'))
              return true;
            // Keep plain columns only if in dataset
            return ALLOWED_COLUMNS.has(trimmed);
          })
          .map((f) => parseField(f, ALLOWED_COLUMNS, ALLOWED_AGGREGATES));

        if (parsedFields.length === 0) {
          parsedFields.push({ sql: 'count()', alias: 'count' });
        }
        const selectClause = parsedFields
          .map((f) => `${f.sql} AS ${f.alias}`)
          .join(', ');

        const queryParams: Record<string, string> = { projectId };

        // Build query
        let query = `SELECT ${selectClause} FROM ${table} WHERE project_id = {projectId:String}`;
        query += ` AND ${buildTimeFilter(period, start, end)}`;

        let havingClause = '';

        // Advanced conditions using parseSearchToSQL
        if (conditions && conditions.trim()) {
          const { where, having } = parseSearchToSQL(
            dsName,
            conditions,
            queryParams
          );
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
        dataset: datasetName,
      } = request.query as {
        period?: string;
        start?: string;
        end?: string;
        dataset?: string;
      };
      const {
        allowedColumns: ALLOWED_COLUMNS,
        allowedAggregates: ALLOWED_AGGREGATES,
        table,
      } = getDiscoverDataset(datasetName as string);
      const timeFilter = buildTimeFilter(period, start, end, '30d');

      try {
        // Build dynamic stats from dataset columns
        const dsObj = getDataset((datasetName as string) || 'errors');
        const statsCols = [...dsObj.columns.entries()]
          .filter(
            ([, def]) => def.lowCardinality && !def.type.startsWith('Map(')
          )
          .slice(0, 5)
          .map(([name]) => name);

        let stats: Record<string, any> = {};
        if (statsCols.length > 0) {
          const statsSelect = statsCols
            .map((c) => `uniq(${c}) as ${c}_count`)
            .join(', ');
          const result = await optic.rawQuery({
            query: `
              SELECT ${statsSelect}
              FROM ${table}
              WHERE project_id = {projectId:String}
                AND ${timeFilter}
            `,
            params: { projectId },
          });
          stats = (result.data as any[])?.[0] || {};
        }

        // Dynamically build tag queries from lowCardinality string columns
        const NUMERIC_TYPES = new Set([
          'UInt8',
          'UInt16',
          'UInt32',
          'UInt64',
          'Float32',
          'Float64',
          'Int8',
          'Int16',
          'Int32',
          'Int64',
        ]);
        const lowCardCols = [...dsObj.columns.entries()]
          .filter(
            ([, def]) =>
              def.lowCardinality &&
              !def.type.startsWith('Map(') &&
              !NUMERIC_TYPES.has(def.type)
          )
          .map(([name]) => name)
          .slice(0, 10);

        const tagUnionParts = lowCardCols.map(
          (col) =>
            `SELECT '${col}' AS tag, ${col} AS value, count() AS cnt FROM ${table} WHERE project_id = {projectId:String} AND ${timeFilter} AND ${col} != '' GROUP BY ${col} ORDER BY cnt DESC LIMIT 20`
        );

        let tagMap: Record<string, { value: string; count: number }[]> = {};
        if (tagUnionParts.length > 0) {
          const tagsResult = await optic.rawQuery({
            query: tagUnionParts.join(' UNION ALL '),
            params: { projectId },
          });
          const tagValues = tagsResult.data as any[];
          for (const row of tagValues) {
            if (!tagMap[row.tag]) tagMap[row.tag] = [];
            tagMap[row.tag].push({ value: row.value, count: Number(row.cnt) });
          }
        }

        // Discover dynamic tag keys from Map columns (e.g. tags Map(String,String))
        // Filter out useless facets:
        //   - unique_cnt >= 2: at least 2 distinct values (single-value = no filtering utility)
        //   - unique_cnt <= 50: at most 50 distinct values (high cardinality = meaningless)
        //   - unique_cnt < cnt * 0.5: unique ratio below 50% (near-unique = IDs, numeric)
        const mapCols = [...dsObj.columns.entries()]
          .filter(([, def]) => def.type === 'Map(String,String)')
          .map(([name]) => name);

        for (const mapCol of mapCols) {
          try {
            // Discover low-cardinality tag keys
            const keysResult = await optic.rawQuery({
              query: `
                SELECT
                  arrayJoin(mapKeys(${mapCol})) AS tag_key,
                  count() AS cnt,
                  uniq(${mapCol}[tag_key]) AS unique_cnt
                FROM ${table}
                WHERE project_id = {projectId:String} AND ${timeFilter}
                GROUP BY tag_key
                HAVING unique_cnt >= 2 AND unique_cnt <= 50 AND unique_cnt < cnt * 0.5
                ORDER BY cnt DESC
                LIMIT 20
              `,
              params: { projectId },
            });
            const discoveredKeys = (keysResult.data as any[])
              .map((r: any) => r.tag_key)
              .filter((k: string) => k && !tagMap[k]); // skip if already covered by a real column

            if (discoveredKeys.length > 0) {
              // Fetch top values for each discovered key
              const mapTagParts = discoveredKeys.map(
                (key: string) =>
                  `SELECT '${key.replace(/'/g, "\\'")}' AS tag, ${mapCol}['${key.replace(/'/g, "\\'")}'] AS value, count() AS cnt FROM ${table} WHERE project_id = {projectId:String} AND ${timeFilter} AND mapContains(${mapCol}, '${key.replace(/'/g, "\\'")}') AND value != '' GROUP BY value ORDER BY cnt DESC LIMIT 15`
              );
              const mapTagsResult = await optic.rawQuery({
                query: mapTagParts.join(' UNION ALL '),
                params: { projectId },
              });
              for (const row of mapTagsResult.data as any[]) {
                if (!tagMap[row.tag]) tagMap[row.tag] = [];
                tagMap[row.tag].push({
                  value: row.value,
                  count: Number(row.cnt),
                });
              }
            }
          } catch (e) {
            // Ignore map discovery errors — some tables may not have data
          }
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
      const {
        period,
        start,
        end,
        search,
        dataset: datasetName,
      } = request.query as any;

      try {
        const { table } = getDiscoverDataset(datasetName as string);
        const dsName =
          datasetName && DISCOVER_DATASETS.has(datasetName)
            ? datasetName
            : 'errors';
        const bucket = getBucketingConfig(period, start, end);
        const timestampCol = getDataset(dsName).timestampColumn;
        const timeFilter =
          start && end
            ? `${timestampCol} >= '${start}' AND ${timestampCol} <= '${end}'`
            : `${timestampCol} >= toDateTime(${bucket.queryParams.fillStart})`;

        // For non-errors datasets, we don't have a 'level' column, use 'all' as placeholder
        const hasLevel = getDataset(dsName).columns.has('level');
        const levelSelect = hasLevel ? 'level' : "'all' AS level";
        const groupByLevel = hasLevel ? ', level' : '';

        let query = `
          SELECT
            ${bucket.selectExpr} AS bucket,
            ${levelSelect},
            count() as count
          FROM ${table}
          WHERE project_id = {projectId:String}
        `;

        query += ` AND ${timeFilter}`;

        const queryParams: Record<string, string> = { projectId };

        // Parse conditions from search param using parseSearchToSQL
        if (search && typeof search === 'string' && search.trim()) {
          const { where: searchWhere } = parseSearchToSQL(
            dsName,
            search,
            queryParams
          );
          if (searchWhere) query += ` AND (${searchWhere})`;
        }

        query += `
          GROUP BY bucket${groupByLevel}
          ORDER BY bucket ASC
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
          error?.code === 'SQLITE_ERROR' ||
          String(error?.message || '').includes("doesn't exist") ||
          String(error?.message || '').includes('no such table') ||
          String(error?.message || '').includes('does not exist') ||
          String(error?.message || '').includes('relation')
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
        query_type?:
          | 'discover'
          | 'logs'
          | 'traces'
          | 'metrics'
          | 'issues'
          | 'analytics-insights'
          | 'analytics-funnels'
          | 'analytics-retention'
          | 'analytics-flows';
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

  // Toggle saved query favorite
  app.patch(
    '/:projectId/discover/saved/:queryId/favorite',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId, queryId } = request.params as {
        projectId: string;
        queryId: string;
      };
      const { is_favorite } = request.body as { is_favorite: boolean };

      try {
        await db('g_argus_saved_queries')
          .where({ id: queryId, project_id: projectId })
          .update({ is_favorite: is_favorite ? 1 : 0 });
        return reply.send({ success: true });
      } catch (error: any) {
        // Auto-add is_favorite column if it doesn't exist
        if (
          String(error?.message || '').includes('is_favorite') &&
          (error?.code === 'ER_BAD_FIELD_ERROR' ||
            String(error?.message || '').includes('Unknown column'))
        ) {
          try {
            await db.schema.alterTable('g_argus_saved_queries', (table) => {
              table.boolean('is_favorite').defaultTo(false);
            });
            await db('g_argus_saved_queries')
              .where({ id: queryId, project_id: projectId })
              .update({ is_favorite: is_favorite ? 1 : 0 });
            return reply.send({ success: true });
          } catch (retryError) {
            logger.error('Failed to add is_favorite column', {
              error:
                retryError instanceof Error
                  ? retryError.message
                  : String(retryError),
            });
          }
        }
        logger.error('Failed to toggle saved query favorite', {
          projectId,
          queryId,
          error: error instanceof Error ? error.message : String(error),
        });
        return reply.code(500).send({ error: 'Failed to toggle favorite' });
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

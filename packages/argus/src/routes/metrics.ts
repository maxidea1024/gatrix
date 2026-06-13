import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { optic } from '@gatrix/argus-optic';
import { createLogger } from '../utils/logger';
import { Condition } from '@gatrix/argus-optic';

const logger = createLogger('metrics-api');

// ─── Constants ────────────────────────────────────────────────────────────────

/** Columns that can be used directly for groupBy */
const KNOWN_GROUPBY_COLUMNS = new Set([
  'environment',
  'release',
  'metric_type',
  'unit',
  'name',
]);

/** Default top-N limit for multi-group-by series */
const DEFAULT_GROUP_LIMIT = 10;



// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Look up the metric_type for a given metric name.
 * Returns 'counter' | 'gauge' | 'distribution' or 'counter' as fallback.
 */
async function getMetricType(
  projectId: string,
  name: string
): Promise<string> {
  try {
    const result = await optic.query<{ metric_type: string }>({
      dataset: 'metrics',
      projectId,
      timeRange: { period: '90d' },
      select: [{ field: 'metric_type' }],
      conditions: [{ field: 'name', op: '=', value: name }],
      groupBy: ['metric_type'],
      limit: 1,
    });
    return result.data[0]?.metric_type || 'counter';
  } catch {
    return 'counter';
  }
}

/**
 * Determine the correct value column based on metric_type.
 */
function getValueColumn(metricType: string): string {
  switch (metricType) {
    case 'gauge':
      return 'value_gauge';
    case 'distribution':
      return 'value_distribution';
    default:
      return 'value_counter';
  }
}

/**
 * Build the aggregation expression based on metric type and requested agg.
 * Distribution metrics use arrayJoin to explode the array before aggregating.
 */
function buildAggExpr(
  agg: string,
  metricType: string,
  valueCol: string
): string {
  if (agg === 'count') return 'count()';

  // For distribution, we need different handling
  if (metricType === 'distribution') {
    // Distribution uses Array(Float64) — for most aggs we use arrayAvg/arraySum etc.
    switch (agg) {
      case 'avg':
        return `avgArray(${valueCol})`;
      case 'sum':
        return `sumArray(${valueCol})`;
      case 'min':
        return `arrayMin(${valueCol})`;
      case 'max':
        return `arrayMax(${valueCol})`;
      case 'p50':
        return `quantile(0.5)(arrayJoin(${valueCol}))`;
      case 'p75':
        return `quantile(0.75)(arrayJoin(${valueCol}))`;
      case 'p90':
        return `quantile(0.9)(arrayJoin(${valueCol}))`;
      case 'p95':
        return `quantile(0.95)(arrayJoin(${valueCol}))`;
      case 'p99':
        return `quantile(0.99)(arrayJoin(${valueCol}))`;
      case 'per_second':
        return `sumArray(${valueCol}) / dateDiff('second', min(timestamp), max(timestamp))`;
      case 'per_minute':
        return `sumArray(${valueCol}) / (dateDiff('second', min(timestamp), max(timestamp)) / 60)`;
      default:
        return `avgArray(${valueCol})`;
    }
  }

  // For counter and gauge (scalar Float64)
  const VALID_SCALAR_AGGS: Record<string, string> = {
    avg: `avg(${valueCol})`,
    sum: `sum(${valueCol})`,
    min: `min(${valueCol})`,
    max: `max(${valueCol})`,
    p50: `quantile(0.5)(${valueCol})`,
    p75: `quantile(0.75)(${valueCol})`,
    p90: `quantile(0.9)(${valueCol})`,
    p95: `quantile(0.95)(${valueCol})`,
    p99: `quantile(0.99)(${valueCol})`,
    per_second: `sum(${valueCol}) / dateDiff('second', min(timestamp), max(timestamp))`,
    per_minute: `sum(${valueCol}) / (dateDiff('second', min(timestamp), max(timestamp)) / 60)`,
  };

  return VALID_SCALAR_AGGS[agg] || `avg(${valueCol})`;
}

/**
 * Resolve a groupBy key to a ClickHouse expression.
 * Known columns pass through; unknown keys are treated as tags Map keys.
 */
function resolveGroupByExpr(key: string): string {
  if (KNOWN_GROUPBY_COLUMNS.has(key)) return key;
  // Tag-based groupBy: access tags Map
  return `tags['${key}']`;
}

export default async function metricsRoutes(app: FastifyInstance) {
  // ── List available metric names with summary stats ─────────────────────
  app.get(
    '/metrics/:projectId/names',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId } = request.params as { projectId: string };
      const { period = '24h' } = request.query as { period?: string };

      try {
        const result = await optic.query({
          dataset: 'metrics',
          projectId,
          timeRange: { period },
          select: [
            { field: 'name' },
            { field: 'metric_type' },
            { field: 'unit' },
            { field: 'count()', alias: 'total_points' },
            { field: 'min(timestamp)', alias: 'first_seen' },
            { field: 'max(timestamp)', alias: 'last_seen' },
          ],
          groupBy: ['name', 'metric_type', 'unit'],
          orderBy: [{ field: 'total_points', direction: 'DESC' }],
          limit: 100,
        });

        return reply.send({ data: result.data });
      } catch (error) {
        logger.error('Failed to list metric names', {
          projectId,
          error: error instanceof Error ? error.message : String(error),
        });
        return reply.code(500).send({ error: 'Failed to list metric names' });
      }
    }
  );

  // ── Query a specific metric — time series + summary ────────────────────
  app.get(
    '/metrics/:projectId/query',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId } = request.params as { projectId: string };
      const {
        name,
        period = '24h',
        groupBy,
        agg = 'avg',
        start,
        end,
        filter,
        groupLimit,
        interval,
      } = request.query as {
        name?: string;
        period?: string;
        groupBy?: string; // comma-separated for multiple: "environment,region"
        agg?: string;
        start?: string;
        end?: string;
        filter?: string; // AQL-style filter conditions
        groupLimit?: string; // top-N limit for grouped series
        interval?: string;
      };

      if (!name) {
        return reply.code(400).send({ error: 'name is required' });
      }

      try {
        // 1. Determine metric type and value column
        const metricType = await getMetricType(projectId, name);
        const valueCol = getValueColumn(metricType);
        const aggExpr = buildAggExpr(agg, metricType, valueCol);

        const timeRange = start && end ? { start, end } : { period };
        const conditions: Condition[] = [
          { field: 'name', op: '=', value: name },
        ];

        // Parse filter conditions if provided (simple key:value format)
        if (filter) {
          const filterParts = filter.split(',').map((f) => f.trim());
          for (const part of filterParts) {
            const match = part.match(/^(.+?)\s*(=|!=|>|<|>=|<=)\s*(.+)$/);
            if (match) {
              const [, key, op, val] = match;
              const field = KNOWN_GROUPBY_COLUMNS.has(key)
                ? key
                : `tags['${key}']`;
              conditions.push({
                field,
                op: op as Condition['op'],
                value: val,
              });
            }
          }
        }

        // 2. Resolve groupBy columns
        const groupByKeys = groupBy
          ? groupBy
              .split(',')
              .map((g) => g.trim())
              .filter(Boolean)
          : [];
        const topN = parseInt(groupLimit || '', 10) || DEFAULT_GROUP_LIMIT;

        // Build select fields for time series
        const tsSelect: { field: string; alias?: string }[] = [
          { field: '$bucket', alias: 'bucket' },
          { field: aggExpr, alias: 'value' },
        ];
        const tsGroupBy = ['$bucket'];

        for (const gKey of groupByKeys) {
          const expr = resolveGroupByExpr(gKey);
          tsSelect.push({ field: expr, alias: `group_${gKey}` });
          tsGroupBy.push(expr);
        }

        // Build summary select
        const summarySelect: { field: string; alias: string }[] = [
          { field: 'count()', alias: 'total_points' },
        ];
        // For distribution, summary uses array functions
        if (metricType === 'distribution') {
          summarySelect.push(
            { field: `avgArray(${valueCol})`, alias: 'avg_value' },
            { field: `arrayMin(${valueCol})`, alias: 'min_value' },
            { field: `arrayMax(${valueCol})`, alias: 'max_value' },
            {
              field: `quantile(0.5)(arrayJoin(${valueCol}))`,
              alias: 'p50',
            },
            {
              field: `quantile(0.95)(arrayJoin(${valueCol}))`,
              alias: 'p95',
            },
            {
              field: `quantile(0.99)(arrayJoin(${valueCol}))`,
              alias: 'p99',
            }
          );
        } else {
          summarySelect.push(
            { field: `avg(${valueCol})`, alias: 'avg_value' },
            { field: `min(${valueCol})`, alias: 'min_value' },
            { field: `max(${valueCol})`, alias: 'max_value' },
            { field: `quantile(0.5)(${valueCol})`, alias: 'p50' },
            { field: `quantile(0.95)(${valueCol})`, alias: 'p95' },
            { field: `quantile(0.99)(${valueCol})`, alias: 'p99' }
          );
        }

        const batch = await optic.queryBatch({
          timeSeries: {
            dataset: 'metrics',
            projectId,
            timeRange,
            select: tsSelect,
            conditions,
            groupBy: tsGroupBy,
            orderBy: [{ field: 'bucket', direction: 'ASC' }],
            limit: topN * 500, // enough rows for topN groups × bucket count
            interval,
          },

          summary: {
            dataset: 'metrics',
            projectId,
            timeRange,
            select: summarySelect,
            conditions,
          },
        });

        return reply.send({
          data: {
            timeSeries: batch.timeSeries.data,
            summary: batch.summary.data[0] || {},
            metricType,
            unit:
              (
                await optic.query({
                  dataset: 'metrics',
                  projectId,
                  timeRange: { period: '90d' },
                  select: [{ field: 'unit' }],
                  conditions: [{ field: 'name', op: '=', value: name }],
                  groupBy: ['unit'],
                  limit: 1,
                })
              ).data[0]?.unit || '',
          },
        });
      } catch (error) {
        logger.error('Failed to query metric', {
          projectId,
          name,
          error: error instanceof Error ? error.message : String(error),
        });
        return reply.code(500).send({ error: 'Failed to query metric' });
      }
    }
  );

  // ── Metric tags — facets for filtering ─────────────────────────────────
  app.get(
    '/metrics/:projectId/tags',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId } = request.params as { projectId: string };
      const { period = '24h', name } = request.query as {
        period?: string;
        name?: string;
      };

      const conditions: Condition[] = [];
      if (name) conditions.push({ field: 'name', op: '=', value: name });

      try {
        const batch = await optic.queryBatch({
          environments: {
            dataset: 'metrics',
            projectId,
            timeRange: { period },
            select: [
              { field: 'environment', alias: 'value' },
              { field: 'count()', alias: 'count' },
            ],
            conditions: [
              ...conditions,
              { field: 'environment', op: '!=', value: '' },
            ],
            groupBy: ['environment'],
            orderBy: [{ field: 'count', direction: 'DESC' }],
            limit: 20,
          },

          releases: {
            dataset: 'metrics',
            projectId,
            timeRange: { period },
            select: [
              { field: 'release', alias: 'value' },
              { field: 'count()', alias: 'count' },
            ],
            conditions: [
              ...conditions,
              { field: 'release', op: '!=', value: '' },
            ],
            groupBy: ['release'],
            orderBy: [{ field: 'count', direction: 'DESC' }],
            limit: 20,
          },

          metricTypes: {
            dataset: 'metrics',
            projectId,
            timeRange: { period },
            select: [
              { field: 'metric_type', alias: 'value' },
              { field: 'count()', alias: 'count' },
            ],
            conditions,
            groupBy: ['metric_type'],
            orderBy: [{ field: 'count', direction: 'DESC' }],
          },
        });

        return reply.send({
          data: {
            environment: batch.environments.data,
            release: batch.releases.data,
            metric_type: batch.metricTypes.data,
          },
        });
      } catch (error) {
        logger.error('Failed to get metric tags', {
          projectId,
          error: error instanceof Error ? error.message : String(error),
        });
        return reply.code(500).send({ error: 'Failed to get metric tags' });
      }
    }
  );

  // ── GroupBy options — dynamic list of available groupBy keys ────────────
  app.get(
    '/metrics/:projectId/groupby-options',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId } = request.params as { projectId: string };
      const { name } = request.query as {
        name?: string;
      };

      try {
        // Fixed columns always available
        const fixedOptions = ['environment', 'release', 'metric_type', 'unit'];

        // Extract dynamic tag keys from the tags Map column
        const conditions: Condition[] = [];
        if (name) conditions.push({ field: 'name', op: '=', value: name });

        const tagKeysResult = await optic.rawQuery<{ tag_key: string }>({
          query: `
            SELECT DISTINCT arrayJoin(mapKeys(tags)) AS tag_key
            FROM argus.metrics
            WHERE project_id = {projectId:String}
              ${name ? "AND name = {name:String}" : ""}
              AND timestamp >= now() - INTERVAL 1 DAY
            ORDER BY tag_key
            LIMIT 50
          `,
          params: { projectId, ...(name ? { name } : {}) },
        });

        const tagKeys = tagKeysResult.data.map((r) => r.tag_key);
        const allOptions = [
          ...fixedOptions.map((col) => ({ key: col, source: 'column' })),
          ...tagKeys.map((key) => ({ key, source: 'tag' })),
        ];

        return reply.send({ data: allOptions });
      } catch (error) {
        logger.error('Failed to get groupBy options', {
          projectId,
          error: error instanceof Error ? error.message : String(error),
        });
        return reply
          .code(500)
          .send({ error: 'Failed to get groupBy options' });
      }
    }
  );

  // ── Metric samples — individual events ─────────────────────────────────
  app.get(
    '/metrics/:projectId/samples',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId } = request.params as { projectId: string };
      const {
        name,
        period = '24h',
        start,
        end,
        limit = '50',
        offset = '0',
        filter,
      } = request.query as {
        name?: string;
        period?: string;
        start?: string;
        end?: string;
        limit?: string;
        offset?: string;
        filter?: string;
      };

      if (!name) {
        return reply.code(400).send({ error: 'name is required' });
      }

      try {
        const metricType = await getMetricType(projectId, name);
        const valueCol = getValueColumn(metricType);
        const timeRange = start && end ? { start, end } : { period };
        const conditions: Condition[] = [
          { field: 'name', op: '=', value: name },
        ];

        if (filter) {
          const filterParts = filter.split(',').map((f) => f.trim());
          for (const part of filterParts) {
            const match = part.match(/^(.+?)\s*(=|!=|>|<|>=|<=)\s*(.+)$/);
            if (match) {
              const [, key, op, val] = match;
              const field = KNOWN_GROUPBY_COLUMNS.has(key)
                ? key
                : `tags['${key}']`;
              conditions.push({
                field,
                op: op as Condition['op'],
                value: val,
              });
            }
          }
        }

        const safeLimit = Math.min(parseInt(limit, 10) || 50, 200);
        const safeOffset = parseInt(offset, 10) || 0;

        const result = await optic.query({
          dataset: 'metrics',
          projectId,
          timeRange,
          select: [
            { field: 'timestamp' },
            { field: 'name' },
            { field: 'metric_type' },
            { field: valueCol, alias: 'value' },
            { field: 'unit' },
            { field: 'environment' },
            { field: 'release' },
            { field: 'tags' },
          ],
          conditions,
          orderBy: [{ field: 'timestamp', direction: 'DESC' }],
          limit: safeLimit,
          offset: safeOffset,
        });

        return reply.send({
          data: result.data,
          metricType,
        });
      } catch (error) {
        logger.error('Failed to get metric samples', {
          projectId,
          error: error instanceof Error ? error.message : String(error),
        });
        return reply
          .code(500)
          .send({ error: 'Failed to get metric samples' });
      }
    }
  );

  // ── Metric volume — overall ingestion time series ──────────────────────
  app.get(
    '/metrics/:projectId/volume',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId } = request.params as { projectId: string };
      const {
        period = '24h',
        start,
        end,
      } = request.query as {
        period?: string;
        start?: string;
        end?: string;
      };

      try {
        const result = await optic.query({
          dataset: 'metrics',
          projectId,
          timeRange: start && end ? { start, end } : { period },
          select: [
            { field: '$bucket', alias: 'bucket' },
            { field: 'metric_type' },
            { field: 'count()', alias: 'count' },
          ],
          groupBy: ['$bucket', 'metric_type'],
          orderBy: [{ field: 'bucket', direction: 'ASC' }],
        });

        return reply.send({ data: result.data });
      } catch (error) {
        logger.error('Failed to get metric volume', {
          projectId,
          error: error instanceof Error ? error.message : String(error),
        });
        return reply
          .code(500)
          .send({ error: 'Failed to get metric volume' });
      }
    }
  );
}

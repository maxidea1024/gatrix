import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { clickhouse } from '../config/clickhouse';
import { createLogger } from '../utils/logger';
import { getDynamicBucketFn } from '../utils/timeBucket';

const logger = createLogger('metrics-api');

function periodToInterval(period: string): string {
  const map: Record<string, string> = {
    '1h': '1 HOUR',
    '6h': '6 HOUR',
    '24h': '24 HOUR',
    '7d': '7 DAY',
    '14d': '14 DAY',
    '30d': '30 DAY',
    '90d': '90 DAY',
  };
  return map[period] || '24 HOUR';
}

export default async function metricsRoutes(app: FastifyInstance) {
  // ────────────────────────────────────────────────
  // List available metric names with summary stats
  // ────────────────────────────────────────────────
  app.get(
    '/metrics/:projectId/names',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId } = request.params as { projectId: string };
      const { period = '24h' } = request.query as { period?: string };
      const interval = periodToInterval(period);

      try {
        const result = await clickhouse.query({
          query: `
            SELECT
              name,
              metric_type,
              unit,
              count() AS total_points,
              min(timestamp) AS first_seen,
              max(timestamp) AS last_seen
            FROM argus.metrics
            WHERE project_id = {projectId:String}
              AND timestamp >= now() - INTERVAL ${interval}
            GROUP BY name, metric_type, unit
            ORDER BY total_points DESC
            LIMIT 100
          `,
          query_params: { projectId: String(projectId) },
        });
        const data = await result.json();
        return reply.send({ data: data.data || [] });
      } catch (error) {
        logger.error('Failed to list metric names', {
          projectId,
          error: error instanceof Error ? error.message : String(error),
        });
        return reply.code(500).send({ error: 'Failed to list metric names' });
      }
    }
  );

  // ────────────────────────────────────────────────
  // Query a specific metric — time series + summary
  // ────────────────────────────────────────────────
  app.get(
    '/metrics/:projectId/query',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId } = request.params as { projectId: string };
      const {
        name, period = '24h', groupBy, agg = 'avg',
        start, end,
      } = request.query as {
        name?: string; period?: string; groupBy?: string;
        agg?: string; start?: string; end?: string;
      };

      if (!name) {
        return reply.code(400).send({ error: 'name is required' });
      }

      const timeFilter = start && end
        ? `timestamp >= {start:String} AND timestamp <= {end:String}`
        : `timestamp >= now() - INTERVAL ${periodToInterval(period)}`;

      const safeAgg = ['avg', 'sum', 'min', 'max', 'count'].includes(agg) ? agg : 'avg';
      const valueCol = 'value_counter'; // default; could branch by metric_type
      const aggExpr = safeAgg === 'count' ? 'count()' : `${safeAgg}(${valueCol})`;

      // Determine groupBy column
      const safeGroupBy = groupBy && ['environment', 'release'].includes(groupBy)
        ? groupBy : null;

      try {
        // Time series
        const groupBySelect = safeGroupBy ? `, ${safeGroupBy} AS group_value` : '';
        const groupByClause = safeGroupBy ? `, ${safeGroupBy}` : '';
        const orderByGroup = safeGroupBy ? ', group_value' : '';
        const bucketFn = getDynamicBucketFn(period, start, end);

        const tsResult = await clickhouse.query({
          query: `
            SELECT
              ${bucketFn}(timestamp) AS bucket,
              ${aggExpr} AS value
              ${groupBySelect}
            FROM argus.metrics
            WHERE project_id = {projectId:String}
              AND name = {name:String}
              AND ${timeFilter}
            GROUP BY bucket ${groupByClause}
            ORDER BY bucket ${orderByGroup}
          `,
          query_params: {
            projectId: String(projectId),
            name,
            ...(start && end ? { start, end } : {}),
          },
        });
        const tsData = await tsResult.json();

        // Summary stats
        const summaryResult = await clickhouse.query({
          query: `
            SELECT
              count() AS total_points,
              avg(${valueCol}) AS avg_value,
              min(${valueCol}) AS min_value,
              max(${valueCol}) AS max_value,
              quantile(0.5)(${valueCol}) AS p50,
              quantile(0.95)(${valueCol}) AS p95,
              quantile(0.99)(${valueCol}) AS p99
            FROM argus.metrics
            WHERE project_id = {projectId:String}
              AND name = {name:String}
              AND ${timeFilter}
          `,
          query_params: {
            projectId: String(projectId),
            name,
            ...(start && end ? { start, end } : {}),
          },
        });
        const summaryData = await summaryResult.json();

        return reply.send({
          data: {
            timeSeries: tsData.data || [],
            summary: (summaryData.data as any[])?.[0] || {},
          },
        });
      } catch (error) {
        logger.error('Failed to query metric', {
          projectId, name,
          error: error instanceof Error ? error.message : String(error),
        });
        return reply.code(500).send({ error: 'Failed to query metric' });
      }
    }
  );

  // ────────────────────────────────────────────────
  // Metric tags — facets for filtering
  // ────────────────────────────────────────────────
  app.get(
    '/metrics/:projectId/tags',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId } = request.params as { projectId: string };
      const { period = '24h', name } = request.query as { period?: string; name?: string };
      const interval = periodToInterval(period);

      const nameFilter = name ? `AND name = {name:String}` : '';

      try {
        // Environments
        const envResult = await clickhouse.query({
          query: `
            SELECT environment AS value, count() AS count
            FROM argus.metrics
            WHERE project_id = {projectId:String}
              AND timestamp >= now() - INTERVAL ${interval}
              AND environment != ''
              ${nameFilter}
            GROUP BY environment
            ORDER BY count DESC
            LIMIT 20
          `,
          query_params: { projectId: String(projectId), ...(name ? { name } : {}) },
        });
        const envData = await envResult.json();

        // Releases
        const relResult = await clickhouse.query({
          query: `
            SELECT release AS value, count() AS count
            FROM argus.metrics
            WHERE project_id = {projectId:String}
              AND timestamp >= now() - INTERVAL ${interval}
              AND release != ''
              ${nameFilter}
            GROUP BY release
            ORDER BY count DESC
            LIMIT 20
          `,
          query_params: { projectId: String(projectId), ...(name ? { name } : {}) },
        });
        const relData = await relResult.json();

        // Metric types
        const typeResult = await clickhouse.query({
          query: `
            SELECT metric_type AS value, count() AS count
            FROM argus.metrics
            WHERE project_id = {projectId:String}
              AND timestamp >= now() - INTERVAL ${interval}
              ${nameFilter}
            GROUP BY metric_type
            ORDER BY count DESC
          `,
          query_params: { projectId: String(projectId), ...(name ? { name } : {}) },
        });
        const typeData = await typeResult.json();

        return reply.send({
          data: {
            environment: envData.data || [],
            release: relData.data || [],
            metric_type: typeData.data || [],
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

  // ────────────────────────────────────────────────
  // Metric volume — overall ingestion time series
  // ────────────────────────────────────────────────
  app.get(
    '/metrics/:projectId/volume',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId } = request.params as { projectId: string };
      const { period = '24h', start, end } = request.query as {
        period?: string; start?: string; end?: string;
      };

      const timeFilter = start && end
        ? `timestamp >= {start:String} AND timestamp <= {end:String}`
        : `timestamp >= now() - INTERVAL ${periodToInterval(period)}`;

      try {
        const bucketFn = getDynamicBucketFn(period, start, end);
        const result = await clickhouse.query({
          query: `
            SELECT
              ${bucketFn}(timestamp) AS bucket,
              metric_type,
              count() AS count
            FROM argus.metrics
            WHERE project_id = {projectId:String}
              AND ${timeFilter}
            GROUP BY bucket, metric_type
            ORDER BY bucket
          `,
          query_params: {
            projectId: String(projectId),
            ...(start && end ? { start, end } : {}),
          },
        });
        const data = await result.json();
        return reply.send({ data: data.data || [] });
      } catch (error) {
        logger.error('Failed to get metric volume', {
          projectId,
          error: error instanceof Error ? error.message : String(error),
        });
        return reply.code(500).send({ error: 'Failed to get metric volume' });
      }
    }
  );
}

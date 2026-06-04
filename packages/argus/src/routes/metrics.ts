import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { clickhouse } from '../config/clickhouse';
import { createLogger } from '../utils/logger';
import { getBucketingConfig } from '../utils/timeBucket';

const logger = createLogger('metrics-api');



export default async function metricsRoutes(app: FastifyInstance) {
  // ────────────────────────────────────────────────
  // List available metric names with summary stats
  // ────────────────────────────────────────────────
  app.get(
    '/metrics/:projectId/names',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId } = request.params as { projectId: string };
      const { period = '24h' } = request.query as { period?: string };
      const bucket = getBucketingConfig(period);

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
              AND timestamp >= toDateTime({fillStart:UInt32})
            GROUP BY name, metric_type, unit
            ORDER BY total_points DESC
            LIMIT 100
          `,
          query_params: { projectId: String(projectId), ...bucket.queryParams },
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

      const bucket = getBucketingConfig(period, start, end);
      const timeFilter = start && end
        ? `timestamp >= {start:String} AND timestamp <= {end:String}`
        : `timestamp >= toDateTime({fillStart:UInt32})`;

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
        const bucketFn = bucket.selectExpr;

        const tsResult = await clickhouse.query({
          query: `
            SELECT
              ${bucketFn} AS hour,
              ${aggExpr} AS value
              ${groupBySelect}
            FROM argus.metrics
            WHERE project_id = {projectId:String}
              AND name = {name:String}
              AND ${timeFilter}
            GROUP BY hour ${groupByClause}
            ORDER BY hour ${orderByGroup}
          `,
          query_params: {
            projectId: String(projectId),
            name,
            ...(start && end ? { start, end } : {}),
            ...bucket.queryParams,
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
            ...bucket.queryParams,
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
      const bucket = getBucketingConfig(period);

      const nameFilter = name ? `AND name = {name:String}` : '';

      try {
        // Environments
        const envResult = await clickhouse.query({
          query: `
            SELECT environment AS value, count() AS count
            FROM argus.metrics
            WHERE project_id = {projectId:String}
              AND timestamp >= toDateTime({fillStart:UInt32})
              AND environment != ''
              ${nameFilter}
            GROUP BY environment
            ORDER BY count DESC
            LIMIT 20
          `,
          query_params: { projectId: String(projectId), ...bucket.queryParams, ...(name ? { name } : {}) },
        });
        const envData = await envResult.json();

        // Releases
        const relResult = await clickhouse.query({
          query: `
            SELECT release AS value, count() AS count
            FROM argus.metrics
            WHERE project_id = {projectId:String}
              AND timestamp >= toDateTime({fillStart:UInt32})
              AND release != ''
              ${nameFilter}
            GROUP BY release
            ORDER BY count DESC
            LIMIT 20
          `,
          query_params: { projectId: String(projectId), ...bucket.queryParams, ...(name ? { name } : {}) },
        });
        const relData = await relResult.json();

        // Metric types
        const typeResult = await clickhouse.query({
          query: `
            SELECT metric_type AS value, count() AS count
            FROM argus.metrics
            WHERE project_id = {projectId:String}
              AND timestamp >= toDateTime({fillStart:UInt32})
              ${nameFilter}
            GROUP BY metric_type
            ORDER BY count DESC
          `,
          query_params: { projectId: String(projectId), ...bucket.queryParams, ...(name ? { name } : {}) },
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

      const bucket = getBucketingConfig(period, start, end);
      const timeFilter = start && end
        ? `timestamp >= {start:String} AND timestamp <= {end:String}`
        : `timestamp >= toDateTime({fillStart:UInt32})`;

      try {
        const result = await clickhouse.query({
          query: `
            SELECT
              ${bucket.selectExpr} AS hour,
              metric_type,
              count() AS count
            FROM argus.metrics
            WHERE project_id = {projectId:String}
              AND ${timeFilter}
            GROUP BY hour, metric_type
            ORDER BY hour
          `,
          query_params: {
            projectId: String(projectId),
            ...(start && end ? { start, end } : {}),
            ...bucket.queryParams,
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

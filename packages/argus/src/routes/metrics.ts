import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { optic } from '@gatrix/argus-optic';
import { createLogger } from '../utils/logger';
import { Condition } from '@gatrix/argus-optic';

const logger = createLogger('metrics-api');

export default async function metricsRoutes(app: FastifyInstance) {
  // ?�?� List available metric names with summary stats ?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�
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

  // ?�?� Query a specific metric ??time series + summary ?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�
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
      } = request.query as {
        name?: string;
        period?: string;
        groupBy?: string;
        agg?: string;
        start?: string;
        end?: string;
      };

      if (!name) {
        return reply.code(400).send({ error: 'name is required' });
      }

      const safeAgg = ['avg', 'sum', 'min', 'max', 'count'].includes(agg)
        ? agg
        : 'avg';
      const valueCol = 'value_counter';
      const aggField =
        safeAgg === 'count' ? 'count()' : `${safeAgg}(${valueCol})`;

      const timeRange = start && end ? { start, end } : { period };
      const conditions: Condition[] = [{ field: 'name', op: '=', value: name }];

      // Determine groupBy column
      const safeGroupBy =
        groupBy && ['environment', 'release'].includes(groupBy)
          ? groupBy
          : null;

      try {
        // Build select fields for time series
        const tsSelect = [
          { field: '$bucket', alias: 'hour' },
          { field: aggField, alias: 'value' },
        ];
        const tsGroupBy = ['$bucket'];

        if (safeGroupBy) {
          tsSelect.push({ field: safeGroupBy, alias: 'group_value' });
          tsGroupBy.push(safeGroupBy);
        }

        const batch = await optic.queryBatch({
          timeSeries: {
            dataset: 'metrics',
            projectId,
            timeRange,
            select: tsSelect,
            conditions,
            groupBy: tsGroupBy,
            orderBy: [{ field: 'hour', direction: 'ASC' }],
          },

          summary: {
            dataset: 'metrics',
            projectId,
            timeRange,
            select: [
              { field: 'count()', alias: 'total_points' },
              { field: `avg(${valueCol})`, alias: 'avg_value' },
              { field: `min(${valueCol})`, alias: 'min_value' },
              { field: `max(${valueCol})`, alias: 'max_value' },
              { field: `p50(${valueCol})`, alias: 'p50' },
              { field: `p95(${valueCol})`, alias: 'p95' },
              { field: `p99(${valueCol})`, alias: 'p99' },
            ],
            conditions,
          },
        });

        return reply.send({
          data: {
            timeSeries: batch.timeSeries.data,
            summary: batch.summary.data[0] || {},
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

  // ?�?� Metric tags ??facets for filtering ?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�
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

  // ?�?� Metric volume ??overall ingestion time series ?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�
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
            { field: '$bucket', alias: 'hour' },
            { field: 'metric_type' },
            { field: 'count()', alias: 'count' },
          ],
          groupBy: ['$bucket', 'metric_type'],
          orderBy: [{ field: 'hour', direction: 'ASC' }],
        });

        return reply.send({ data: result.data });
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

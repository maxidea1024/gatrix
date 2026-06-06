import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { optic } from '@gatrix/argus-optic';
import { createLogger } from '../utils/logger';
import { Condition } from '@gatrix/argus-optic';

const logger = createLogger('traces-api');

export default async function tracesRoutes(app: FastifyInstance) {
  // ?�?� Span search ??query individual spans ?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�
  app.get(
    '/traces/:projectId/spans',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId } = request.params as { projectId: string };
      const {
        period = '24h',
        search,
        op,
        status,
        limit = '50',
        orderBy = '-duration',
        start,
        end,
      } = request.query as {
        period?: string;
        search?: string;
        op?: string;
        status?: string;
        limit?: string;
        orderBy?: string;
        start?: string;
        end?: string;
      };

      const conditions: Condition[] = [];
      if (search)
        conditions.push({
          field: 'description',
          op: 'ILIKE',
          value: `%${search}%`,
        });
      if (op) conditions.push({ field: 'op', op: '=', value: op });
      if (status) conditions.push({ field: 'status', op: '=', value: status });

      const orderDir = orderBy.startsWith('-')
        ? ('DESC' as const)
        : ('ASC' as const);
      const orderCol = orderBy.replace(/^-/, '');
      const safeOrderCol = ['duration', 'timestamp', 'op', 'status'].includes(
        orderCol
      )
        ? orderCol
        : 'duration';

      try {
        const result = await optic.query({
          dataset: 'spans',
          projectId,
          timeRange: start && end ? { start, end } : { period },
          select: [
            { field: 'span_id' },
            { field: 'trace_id' },
            { field: 'parent_span_id' },
            { field: 'transaction_id' },
            { field: 'op' },
            { field: 'description' },
            { field: 'status' },
            { field: 'action' },
            { field: 'domain' },
            { field: 'timestamp' },
            { field: 'start_timestamp' },
            { field: 'duration' },
            { field: 'tags' },
          ],
          conditions,
          orderBy: [{ field: safeOrderCol, direction: orderDir }],
          limit: parseInt(limit, 10),
        });

        return reply.send({ data: result.data });
      } catch (error) {
        logger.error('Failed to search spans', {
          projectId,
          error: error instanceof Error ? error.message : String(error),
        });
        return reply.code(500).send({ error: 'Failed to search spans' });
      }
    }
  );

  // ?�?� Trace samples ??group by trace_id ?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�
  app.get(
    '/traces/:projectId/samples',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId } = request.params as { projectId: string };
      const {
        period = '24h',
        search,
        limit = '25',
        start,
        end,
      } = request.query as {
        period?: string;
        search?: string;
        limit?: string;
        start?: string;
        end?: string;
      };

      const conditions: Condition[] = [];
      if (search)
        conditions.push({
          field: 'description',
          op: 'ILIKE',
          value: `%${search}%`,
        });

      try {
        const result = await optic.query({
          dataset: 'spans',
          projectId,
          timeRange: start && end ? { start, end } : { period },
          select: [
            { field: 'trace_id' },
            { field: 'min(timestamp)', alias: 'start_time' },
            { field: 'max(timestamp)', alias: 'end_time' },
            { field: 'count()', alias: 'span_count' },
            { field: 'sum(duration)', alias: 'total_duration' },
            { field: 'max(duration)', alias: 'max_span_duration' },
            { field: 'groupArray(DISTINCT op)', alias: 'operations' },
            { field: 'any(description)', alias: 'root_description' },
            {
              field: "countIf(status != 'ok' AND status != '')",
              alias: 'error_count',
            },
          ],
          conditions,
          groupBy: ['trace_id'],
          orderBy: [{ field: 'start_time', direction: 'DESC' }],
          limit: parseInt(limit, 10),
        });

        return reply.send({ data: result.data });
      } catch (error) {
        logger.error('Failed to get trace samples', {
          projectId,
          error: error instanceof Error ? error.message : String(error),
        });
        return reply.code(500).send({ error: 'Failed to get trace samples' });
      }
    }
  );

  // ?�?� Span aggregation ??group by op/status/domain ?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�
  app.get(
    '/traces/:projectId/aggregate',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId } = request.params as { projectId: string };
      const {
        period = '24h',
        groupBy = 'op',
        start,
        end,
      } = request.query as {
        period?: string;
        groupBy?: string;
        start?: string;
        end?: string;
      };

      const safeGroupBy = ['op', 'status', 'domain', 'action'].includes(groupBy)
        ? groupBy
        : 'op';
      const timeRange = start && end ? { start, end } : { period };

      try {
        const batch = await optic.queryBatch({
          topValues: {
            dataset: 'spans',
            projectId,
            timeRange,
            select: [
              { field: safeGroupBy, alias: 'group_value' },
              { field: 'count()', alias: 'count' },
              { field: 'avg(duration)', alias: 'avg_duration' },
              { field: 'p95(duration)', alias: 'p95_duration' },
            ],
            groupBy: [safeGroupBy],
            orderBy: [{ field: 'count', direction: 'DESC' }],
            limit: 20,
          },

          timeSeries: {
            dataset: 'spans',
            projectId,
            timeRange,
            select: [
              { field: '$bucket', alias: 'hour' },
              { field: safeGroupBy, alias: 'group_value' },
              { field: 'count()', alias: 'count' },
            ],
            groupBy: ['$bucket', safeGroupBy],
            orderBy: [
              { field: 'hour', direction: 'ASC' },
              { field: 'count', direction: 'DESC' },
            ],
          },
        });

        return reply.send({
          data: {
            groupBy: safeGroupBy,
            topValues: batch.topValues.data,
            timeSeries: batch.timeSeries.data,
          },
        });
      } catch (error) {
        logger.error('Failed to get span aggregates', {
          projectId,
          error: error instanceof Error ? error.message : String(error),
        });
        return reply.code(500).send({ error: 'Failed to get span aggregates' });
      }
    }
  );

  // ?�?� Span tags ??available filter facets ?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�
  app.get(
    '/traces/:projectId/tags',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId } = request.params as { projectId: string };
      const { period = '24h' } = request.query as { period?: string };

      try {
        const batch = await optic.queryBatch({
          ops: {
            dataset: 'spans',
            projectId,
            timeRange: { period },
            select: [
              { field: 'op', alias: 'value' },
              { field: 'count()', alias: 'count' },
            ],
            groupBy: ['op'],
            orderBy: [{ field: 'count', direction: 'DESC' }],
            limit: 30,
          },
          statuses: {
            dataset: 'spans',
            projectId,
            timeRange: { period },
            select: [
              { field: 'status', alias: 'value' },
              { field: 'count()', alias: 'count' },
            ],
            conditions: [{ field: 'status', op: '!=', value: '' }],
            groupBy: ['status'],
            orderBy: [{ field: 'count', direction: 'DESC' }],
            limit: 20,
          },
          domains: {
            dataset: 'spans',
            projectId,
            timeRange: { period },
            select: [
              { field: 'domain', alias: 'value' },
              { field: 'count()', alias: 'count' },
            ],
            conditions: [{ field: 'domain', op: '!=', value: '' }],
            groupBy: ['domain'],
            orderBy: [{ field: 'count', direction: 'DESC' }],
            limit: 20,
          },
        });

        return reply.send({
          data: {
            op: batch.ops.data,
            status: batch.statuses.data,
            domain: batch.domains.data,
          },
        });
      } catch (error) {
        logger.error('Failed to get span tags', {
          projectId,
          error: error instanceof Error ? error.message : String(error),
        });
        return reply.code(500).send({ error: 'Failed to get span tags' });
      }
    }
  );

  // ?�?� Span volume ??time series for chart ?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�
  app.get(
    '/traces/:projectId/volume',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId } = request.params as { projectId: string };
      const {
        period = '24h',
        search,
        start,
        end,
      } = request.query as {
        period?: string;
        search?: string;
        start?: string;
        end?: string;
      };

      const conditions: Condition[] = [];
      if (search)
        conditions.push({
          field: 'description',
          op: 'ILIKE',
          value: `%${search}%`,
        });

      try {
        const result = await optic.query({
          dataset: 'spans',
          projectId,
          timeRange: start && end ? { start, end } : { period },
          select: [
            { field: '$bucket', alias: 'hour' },
            { field: 'op' },
            { field: 'count()', alias: 'count' },
          ],
          conditions,
          groupBy: ['$bucket', 'op'],
          orderBy: [{ field: 'hour', direction: 'ASC' }],
        });

        return reply.send({ data: result.data });
      } catch (error) {
        logger.error('Failed to get span volume', {
          projectId,
          error: error instanceof Error ? error.message : String(error),
        });
        return reply.code(500).send({ error: 'Failed to get span volume' });
      }
    }
  );
}

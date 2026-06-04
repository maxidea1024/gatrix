import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { clickhouse } from '../config/clickhouse';
import { createLogger } from '../utils/logger';
import { getBucketingConfig } from '../utils/timeBucket';

const logger = createLogger('traces-api');



export default async function tracesRoutes(app: FastifyInstance) {
  // ────────────────────────────────────────────────
  // Span search — query individual spans (Explore → Spans tab)
  // ────────────────────────────────────────────────
  app.get(
    '/traces/:projectId/spans',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId } = request.params as { projectId: string };
      const {
        period = '24h', search, op, status, limit = '50',
        orderBy = '-duration', start, end,
      } = request.query as {
        period?: string; search?: string; op?: string; status?: string;
        limit?: string; orderBy?: string; start?: string; end?: string;
      };

      const bucket = getBucketingConfig(period, start, end);
      const timeFilter = start && end
        ? `timestamp >= {start:String} AND timestamp <= {end:String}`
        : `timestamp >= toDateTime({fillStart:UInt32})`;

      const conditions: string[] = [
        `project_id = {projectId:String}`,
        timeFilter,
      ];
      if (search) conditions.push(`description ILIKE {search:String}`);
      if (op) conditions.push(`op = {op:String}`);
      if (status) conditions.push(`status = {status:String}`);

      const orderDir = orderBy.startsWith('-') ? 'DESC' : 'ASC';
      const orderCol = orderBy.replace(/^-/, '');
      const safeOrderCol = ['duration', 'timestamp', 'op', 'status'].includes(orderCol)
        ? orderCol : 'duration';

      try {
        const result = await clickhouse.query({
          query: `
            SELECT
              span_id,
              trace_id,
              parent_span_id,
              transaction_id,
              op,
              description,
              status,
              action,
              domain,
              timestamp,
              start_timestamp,
              duration,
              tags
            FROM argus.spans
            WHERE ${conditions.join(' AND ')}
            ORDER BY ${safeOrderCol} ${orderDir}
            LIMIT {limit:UInt32}
          `,
          query_params: {
            projectId: String(projectId),
            limit: parseInt(limit, 10),
            ...(search ? { search: `%${search}%` } : {}),
            ...(op ? { op } : {}),
            ...(status ? { status } : {}),
            ...(start && end ? { start, end } : {}),
            ...bucket.queryParams,
          },
        });
        const data = await result.json();
        return reply.send({ data: data.data || [] });
      } catch (error) {
        logger.error('Failed to search spans', {
          projectId,
          error: error instanceof Error ? error.message : String(error),
        });
        return reply.code(500).send({ error: 'Failed to search spans' });
      }
    }
  );

  // ────────────────────────────────────────────────
  // Trace samples — group by trace_id, show root span info
  // ────────────────────────────────────────────────
  app.get(
    '/traces/:projectId/samples',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId } = request.params as { projectId: string };
      const {
        period = '24h', search, limit = '25', start, end,
      } = request.query as {
        period?: string; search?: string; limit?: string;
        start?: string; end?: string;
      };

      const bucket = getBucketingConfig(period, start, end);
      const timeFilter = start && end
        ? `timestamp >= {start:String} AND timestamp <= {end:String}`
        : `timestamp >= toDateTime({fillStart:UInt32})`;

      const conditions: string[] = [
        `project_id = {projectId:String}`,
        timeFilter,
      ];
      if (search) conditions.push(`description ILIKE {search:String}`);

      try {
        const result = await clickhouse.query({
          query: `
            SELECT
              trace_id,
              min(timestamp) AS start_time,
              max(timestamp) AS end_time,
              count() AS span_count,
              sum(duration) AS total_duration,
              max(duration) AS max_span_duration,
              groupArray(DISTINCT op) AS operations,
              any(description) AS root_description,
              countIf(status != 'ok' AND status != '') AS error_count
            FROM argus.spans
            WHERE ${conditions.join(' AND ')}
            GROUP BY trace_id
            ORDER BY start_time DESC
            LIMIT {limit:UInt32}
          `,
          query_params: {
            projectId: String(projectId),
            limit: parseInt(limit, 10),
            ...(search ? { search: `%${search}%` } : {}),
            ...(start && end ? { start, end } : {}),
            ...bucket.queryParams,
          },
        });
        const data = await result.json();
        return reply.send({ data: data.data || [] });
      } catch (error) {
        logger.error('Failed to get trace samples', {
          projectId,
          error: error instanceof Error ? error.message : String(error),
        });
        return reply.code(500).send({ error: 'Failed to get trace samples' });
      }
    }
  );

  // ────────────────────────────────────────────────
  // Span aggregation — group by op/status/domain
  // ────────────────────────────────────────────────
  app.get(
    '/traces/:projectId/aggregate',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId } = request.params as { projectId: string };
      const {
        period = '24h', groupBy = 'op', start, end,
      } = request.query as {
        period?: string; groupBy?: string; start?: string; end?: string;
      };

      const safeGroupBy = ['op', 'status', 'domain', 'action'].includes(groupBy)
        ? groupBy : 'op';

      const bucket = getBucketingConfig(period, start, end);
      const timeFilter = start && end
        ? `timestamp >= {start:String} AND timestamp <= {end:String}`
        : `timestamp >= toDateTime({fillStart:UInt32})`;

      try {
        // Top values
        const topResult = await clickhouse.query({
          query: `
            SELECT
              ${safeGroupBy} AS group_value,
              count() AS count,
              avg(duration) AS avg_duration,
              quantile(0.95)(duration) AS p95_duration
            FROM argus.spans
            WHERE project_id = {projectId:String}
              AND ${timeFilter}
            GROUP BY ${safeGroupBy}
            ORDER BY count DESC
            LIMIT 20
          `,
          query_params: {
            projectId: String(projectId),
            ...(start && end ? { start, end } : {}),
            ...bucket.queryParams,
          },
        });
        const topData = await topResult.json();

        const tsResult = await clickhouse.query({
          query: `
            SELECT
              ${bucket.selectExpr} AS hour,
              ${safeGroupBy} AS group_value,
              count() AS count
            FROM argus.spans
            WHERE project_id = {projectId:String}
              AND ${timeFilter}
            GROUP BY hour, ${safeGroupBy}
            ORDER BY hour, count DESC
          `,
          query_params: {
            projectId: String(projectId),
            ...(start && end ? { start, end } : {}),
            ...bucket.queryParams,
          },
        });
        const tsData = await tsResult.json();

        return reply.send({
          data: {
            groupBy: safeGroupBy,
            topValues: topData.data || [],
            timeSeries: tsData.data || [],
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

  // ────────────────────────────────────────────────
  // Span tags — available filter facets
  // ────────────────────────────────────────────────
  app.get(
    '/traces/:projectId/tags',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId } = request.params as { projectId: string };
      const { period = '24h' } = request.query as { period?: string };
      const bucket = getBucketingConfig(period);

      try {
        // Get distinct op values
        const opsResult = await clickhouse.query({
          query: `
            SELECT op AS value, count() AS count
            FROM argus.spans
            WHERE project_id = {projectId:String}
              AND timestamp >= toDateTime({fillStart:UInt32})
            GROUP BY op
            ORDER BY count DESC
            LIMIT 30
          `,
          query_params: { projectId: String(projectId), ...bucket.queryParams },
        });
        const opsData = await opsResult.json();

        // Get distinct status values
        const statusResult = await clickhouse.query({
          query: `
            SELECT status AS value, count() AS count
            FROM argus.spans
            WHERE project_id = {projectId:String}
              AND timestamp >= toDateTime({fillStart:UInt32})
              AND status != ''
            GROUP BY status
            ORDER BY count DESC
            LIMIT 20
          `,
          query_params: { projectId: String(projectId), ...bucket.queryParams },
        });
        const statusData = await statusResult.json();

        // Get distinct domain values
        const domainResult = await clickhouse.query({
          query: `
            SELECT domain AS value, count() AS count
            FROM argus.spans
            WHERE project_id = {projectId:String}
              AND timestamp >= toDateTime({fillStart:UInt32})
              AND domain != ''
            GROUP BY domain
            ORDER BY count DESC
            LIMIT 20
          `,
          query_params: { projectId: String(projectId), ...bucket.queryParams },
        });
        const domainData = await domainResult.json();

        return reply.send({
          data: {
            op: opsData.data || [],
            status: statusData.data || [],
            domain: domainData.data || [],
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

  // ────────────────────────────────────────────────
  // Span volume — time series for chart
  // ────────────────────────────────────────────────
  app.get(
    '/traces/:projectId/volume',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId } = request.params as { projectId: string };
      const {
        period = '24h', search, start, end,
      } = request.query as {
        period?: string; search?: string; start?: string; end?: string;
      };

      const bucket = getBucketingConfig(period, start, end);
      const timeFilter = start && end
        ? `timestamp >= {start:String} AND timestamp <= {end:String}`
        : `timestamp >= toDateTime({fillStart:UInt32})`;

      const conditions: string[] = [
        `project_id = {projectId:String}`,
        timeFilter,
      ];
      if (search) conditions.push(`description ILIKE {search:String}`);

      try {
        const result = await clickhouse.query({
          query: `
            SELECT
              ${bucket.selectExpr} AS hour,
              op,
              count() AS count
            FROM argus.spans
            WHERE ${conditions.join(' AND ')}
            GROUP BY hour, op
            ORDER BY hour
          `,
          query_params: {
            projectId: String(projectId),
            ...(search ? { search: `%${search}%` } : {}),
            ...(start && end ? { start, end } : {}),
            ...bucket.queryParams,
          },
        });
        const data = await result.json();
        return reply.send({ data: data.data || [] });
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

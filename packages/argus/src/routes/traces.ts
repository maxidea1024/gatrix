import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { optic, parseSearchToSQL } from '@gatrix/argus-optic';
import { createLogger } from '../utils/logger';
import { getBucketingConfig } from '../utils/timeBucket';

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
        offset = '0',
      } = request.query as {
        period?: string;
        search?: string;
        op?: string;
        status?: string;
        limit?: string;
        orderBy?: string;
        start?: string;
        end?: string;
        offset?: string;
      };

      const bucket = getBucketingConfig(period, start, end);
      const timeCond = `timestamp >= toDateTime({fillStart:UInt32}) AND timestamp <= toDateTime({fillEnd:UInt32})`;

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
        const conditions: string[] = [
          'project_id = {projectId:String}',
          timeCond,
        ];
        const params: Record<string, string> = {
          projectId: String(projectId),
          fillStart: String(bucket.queryParams.fillStart),
          fillEnd: String(bucket.queryParams.fillEnd),
        };

        if (op) {
          conditions.push('op = {op:String}');
          params.op = op;
        }
        if (status) {
          conditions.push('status = {status:String}');
          params.status = status;
        }

        const { where: searchCond } = parseSearchToSQL('spans', search, params);
        if (searchCond) conditions.push(`(${searchCond})`);

        const parsedLimit = Math.min(parseInt(limit, 10) || 50, 1000);
        const parsedOffset = parseInt(offset, 10) || 0;
        params.limit = String(parsedLimit);
        params.offset = String(parsedOffset);

        const sql = `
          SELECT span_id, trace_id, parent_span_id, transaction_id,
                 op, description, status, action, domain,
                 timestamp, start_timestamp, duration, tags, data
          FROM argus.spans
          WHERE ${conditions.join(' AND ')}
          ORDER BY ${safeOrderCol} ${orderDir}
          LIMIT {limit:UInt32} OFFSET {offset:UInt32}
        `;

        const result = await optic.rawQuery({ query: sql, params });
        const rows = result.data as any[];

        return reply.send({
          data: rows,
          hasMore: rows.length >= parsedLimit,
        });
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
        offset = '0',
      } = request.query as {
        period?: string;
        search?: string;
        limit?: string;
        start?: string;
        end?: string;
        offset?: string;
      };

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

        const { where: searchCond } = parseSearchToSQL('spans', search, params);
        if (searchCond) conditions.push(`(${searchCond})`);

        const parsedLimit = Math.min(parseInt(limit, 10) || 25, 1000);
        const parsedOffset = parseInt(offset, 10) || 0;
        params.limit = String(parsedLimit);
        params.offset = String(parsedOffset);

        const sql = `
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
          LIMIT {limit:UInt32} OFFSET {offset:UInt32}
        `;

        const result = await optic.rawQuery({ query: sql, params });
        const rows = result.data as any[];

        return reply.send({
          data: rows,
          hasMore: rows.length >= parsedLimit,
        });
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
              { field: '$bucket', alias: 'bucket' },
              { field: safeGroupBy, alias: 'group_value' },
              { field: 'count()', alias: 'count' },
            ],
            groupBy: ['$bucket', safeGroupBy],
            orderBy: [
              { field: 'bucket', direction: 'ASC' },
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

  // ?? Span tags ??available filter facets ???????????????????????????????
  app.get(
    '/traces/:projectId/tags',
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

      const timeRange = start && end ? { start, end } : { period };

      try {
        // 1. Fixed facets (op, status, domain) + discover tag keys in parallel
        const [batch, discoveredKeys] = await Promise.all([
          optic.queryBatch({
            ops: {
              dataset: 'spans',
              projectId,
              timeRange,
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
              timeRange,
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
              timeRange,
              select: [
                { field: 'domain', alias: 'value' },
                { field: 'count()', alias: 'count' },
              ],
              conditions: [{ field: 'domain', op: '!=', value: '' }],
              groupBy: ['domain'],
              orderBy: [{ field: 'count', direction: 'DESC' }],
              limit: 20,
            },
          }),
          // Discover top tag keys from the Map(String,String) tags column
          optic.query<{ key: string; cnt: string }>({
            dataset: 'spans',
            projectId,
            timeRange,
            select: [
              { field: 'arrayJoin(mapKeys(tags))', alias: 'key' },
              { field: 'count()', alias: 'cnt' },
            ],
            groupBy: ['key'],
            orderBy: [{ field: 'cnt', direction: 'DESC' }],
            limit: 20,
          }),
        ]);

        // 2. For each discovered tag key, fetch top values
        const tagKeys = discoveredKeys.data
          .map((r) => r.key)
          .filter((k) => k && k.trim() !== '');

        let discovered: Record<string, { value: string; count: number }[]> = {};

        if (tagKeys.length > 0) {
          // Build per-key queries in parallel (max 10 to avoid overloading)
          const topKeys = tagKeys.slice(0, 10);
          const keyResults = await Promise.all(
            topKeys.map((key) =>
              optic
                .query<{ value: string; count: string }>({
                  dataset: 'spans',
                  projectId,
                  timeRange,
                  select: [
                    { field: `tags['${key.replace(/'/g, "\\'")}']`, alias: 'value' },
                    { field: 'count()', alias: 'count' },
                  ],
                  conditions: [
                    {
                      field: `tags['${key.replace(/'/g, "\\'")}']`,
                      op: '!=',
                      value: '',
                    },
                  ],
                  groupBy: ['value'],
                  orderBy: [{ field: 'count', direction: 'DESC' }],
                  limit: 15,
                })
                .then((res) => ({
                  key,
                  values: res.data.map((r) => ({
                    value: r.value,
                    count: Number(r.count) || 0,
                  })),
                }))
                .catch(() => ({ key, values: [] as { value: string; count: number }[] }))
            )
          );

          for (const kr of keyResults) {
            if (kr.values.length > 0) {
              discovered[kr.key] = kr.values;
            }
          }
        }

        return reply.send({
          data: {
            op: batch.ops.data,
            status: batch.statuses.data,
            domain: batch.domains.data,
            discovered,
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

  // ?? Span volume ??time series for chart ???????????????????????????????
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

        const { where: searchCond } = parseSearchToSQL('spans', search, params);
        if (searchCond) conditions.push(`(${searchCond})`);

        const sql = `
          SELECT ${bucket.selectExpr} AS hour, op, count() AS count
          FROM argus.spans
          WHERE ${conditions.join(' AND ')}
          GROUP BY hour, op
          ORDER BY hour ASC
        `;

        const result = await optic.rawQuery({ query: sql, params });
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

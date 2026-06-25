import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { optic } from '@gatrix/argus-optic';
import { createLogger } from '../utils/logger';
import { buildTimeRangeConditions } from '../utils/timeBucket';

const TABLE = 'argus.activities';
const logger = createLogger('impact-api');

export default async function impactRoutes(app: FastifyInstance) {
  // ─── POST /projects/:projectId/analytics/impact ─────────────────────────
  // Analyze how event A impacts event B
  app.post(
    '/projects/:projectId/analytics/impact',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId } = request.params as { projectId: string };
      const {
        causeEvent,
        effectEvent,
        period,
        start,
        end,
        windowDays = 7,
      } = request.body as {
        causeEvent: string;
        effectEvent: string;
        period?: string;
        start?: string;
        end?: string;
        windowDays?: number;
      };

      if (!causeEvent || !effectEvent) {
        return reply
          .code(400)
          .send({ error: 'causeEvent and effectEvent are required' });
      }

      try {
        const { conditions: timeConds, params: timeParams } = buildTimeRangeConditions(period, start, end);
        const timeWhere = timeConds.join(' AND ');
        const params: Record<string, any> = {
          projectId,
          causeEvent,
          effectEvent,
          windowDays,
          ...timeParams,
        };

        // Users who did cause event
        const causeUsersSql = `
          SELECT DISTINCT user_id
          FROM ${TABLE}
          WHERE project_id = {projectId:String}
            AND event_name = {causeEvent:String}
            AND user_id != ''
            AND ${timeWhere}
        `;

        // Users who did effect event AFTER doing cause event (within window)
        const convertedSql = `
          SELECT count(DISTINCT a.user_id) AS converted,
                 count(DISTINCT b.user_id) AS cause_total
          FROM (
            SELECT user_id, min(timestamp) AS first_cause
            FROM ${TABLE}
            WHERE project_id = {projectId:String}
              AND event_name = {causeEvent:String}
              AND user_id != ''
              AND ${timeWhere}
            GROUP BY user_id
          ) b
          LEFT JOIN ${TABLE} a
            ON a.user_id = b.user_id
            AND a.project_id = {projectId:String}
            AND a.event_name = {effectEvent:String}
            AND a.timestamp > b.first_cause
            AND a.timestamp <= b.first_cause + INTERVAL {windowDays:UInt32} DAY
        `;

        // Users who did NOT do cause event but did effect event
        const baselineSql = `
          SELECT
            countIf(did_effect = 1) AS baseline_converted,
            count() AS baseline_total
          FROM (
            SELECT
              user_id,
              max(event_name = {effectEvent:String}) AS did_effect
            FROM ${TABLE}
            WHERE project_id = {projectId:String}
              AND user_id != ''
              AND user_id NOT IN (${causeUsersSql})
              AND ${timeWhere}
            GROUP BY user_id
          )
        `;

        const [convertedResult, baselineResult] = await Promise.all([
          optic.rawQuery({ query: convertedSql, params }),
          optic.rawQuery({ query: baselineSql, params }),
        ]);

        const converted =
          Number((convertedResult.data as any[])?.[0]?.converted) || 0;
        const causeTotal =
          Number((convertedResult.data as any[])?.[0]?.cause_total) || 0;
        const baselineConverted =
          Number((baselineResult.data as any[])?.[0]?.baseline_converted) || 0;
        const baselineTotal =
          Number((baselineResult.data as any[])?.[0]?.baseline_total) || 0;

        const conversionRate = causeTotal > 0 ? converted / causeTotal : 0;
        const baselineRate =
          baselineTotal > 0 ? baselineConverted / baselineTotal : 0;
        const lift =
          baselineRate > 0
            ? ((conversionRate - baselineRate) / baselineRate) * 100
            : 0;

        return reply.send({
          success: true,
          data: {
            cause_event: causeEvent,
            effect_event: effectEvent,
            window_days: windowDays,
            cause_users: causeTotal,
            converted_users: converted,
            conversion_rate: Math.round(conversionRate * 10000) / 100,
            baseline_users: baselineTotal,
            baseline_converted: baselineConverted,
            baseline_rate: Math.round(baselineRate * 10000) / 100,
            lift: Math.round(lift * 100) / 100,
          },
        });
      } catch (err) {
        logger.error('Impact analysis failed', {
          error: err instanceof Error ? err.message : String(err),
        });
        return reply.code(500).send({ error: 'Impact analysis failed' });
      }
    }
  );
}

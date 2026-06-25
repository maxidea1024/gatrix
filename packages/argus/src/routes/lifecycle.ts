import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { optic } from '@gatrix/argus-optic';
import { createLogger } from '../utils/logger';
import { buildTimeRangeConditions } from '../utils/timeBucket';

const TABLE = 'argus.activities';
const logger = createLogger('lifecycle-api');

export default async function lifecycleRoutes(app: FastifyInstance) {
  // ─── GET /projects/:projectId/analytics/lifecycle ───────────────────────
  // Classify users into lifecycle stages: New, Active, Returning, Dormant, Resurrected
  app.get(
    '/projects/:projectId/analytics/lifecycle',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId } = request.params as { projectId: string };
      const { period, start, end, granularity } = request.query as {
        period?: string;
        start?: string;
        end?: string;
        granularity?: string;
      };

      try {
        const { conditions: timeConds, params: timeParams } = buildTimeRangeConditions(period, start, end);
        const timeWhere = timeConds.join(' AND ');
        const params: Record<string, any> = {
          projectId,
          ...timeParams,
        };

        const grain =
          granularity === 'week'
            ? 'toStartOfWeek'
            : granularity === 'month'
              ? 'toStartOfMonth'
              : 'toDate';

        // For lifecycle, we need to classify users by their activity patterns.
        // We use a simplified approach based on first_seen and activity windows.

        // 1) Lifecycle stage breakdown (current period)
        const lifecycleSql = `
          WITH user_activity AS (
            SELECT
              user_id,
              min(timestamp) AS first_seen,
              max(timestamp) AS last_seen,
              count() AS event_count
            FROM ${TABLE}
            WHERE project_id = {projectId:String}
              AND user_id != ''
            GROUP BY user_id
          )
          SELECT
            multiIf(
              first_seen >= now() - INTERVAL 7 DAY, 'new',
              last_seen >= now() - INTERVAL 1 DAY, 'active',
              last_seen >= now() - INTERVAL 7 DAY, 'returning',
              last_seen >= now() - INTERVAL 30 DAY, 'dormant',
              'churned'
            ) AS stage,
            count() AS user_count,
            avg(event_count) AS avg_events
          FROM user_activity
          GROUP BY stage
          ORDER BY
            CASE stage
              WHEN 'new' THEN 1
              WHEN 'active' THEN 2
              WHEN 'returning' THEN 3
              WHEN 'dormant' THEN 4
              ELSE 5
            END
        `;
        const lifecycleResult = await optic.rawQuery({
          query: lifecycleSql,
          params,
        });
        const stages = ((lifecycleResult.data as any[]) || []).map(
          (r: any) => ({
            stage: r.stage,
            user_count: Number(r.user_count) || 0,
            avg_events: Math.round((Number(r.avg_events) || 0) * 10) / 10,
          })
        );

        // 2) New users over time
        const newUsersSql = `
          SELECT
            ${grain}(first_seen) AS period,
            count() AS new_users
          FROM (
            SELECT user_id, min(timestamp) AS first_seen
            FROM ${TABLE}
            WHERE project_id = {projectId:String}
              AND user_id != ''
              AND ${timeWhere}
            GROUP BY user_id
          )
          GROUP BY period
          ORDER BY period ASC
        `;
        const newUsersResult = await optic.rawQuery({
          query: newUsersSql,
          params,
        });
        const newUsersOverTime = ((newUsersResult.data as any[]) || []).map(
          (r: any) => ({
            period: r.period,
            new_users: Number(r.new_users) || 0,
          })
        );

        // 3) DAU/WAU/MAU
        const dauSql = `
          SELECT uniqExact(user_id) AS dau
          FROM ${TABLE}
          WHERE project_id = {projectId:String}
            AND user_id != ''
            AND timestamp >= now() - INTERVAL 1 DAY
        `;
        const wauSql = `
          SELECT uniqExact(user_id) AS wau
          FROM ${TABLE}
          WHERE project_id = {projectId:String}
            AND user_id != ''
            AND timestamp >= now() - INTERVAL 7 DAY
        `;
        const mauSql = `
          SELECT uniqExact(user_id) AS mau
          FROM ${TABLE}
          WHERE project_id = {projectId:String}
            AND user_id != ''
            AND timestamp >= now() - INTERVAL 30 DAY
        `;

        const [dauResult, wauResult, mauResult] = await Promise.all([
          optic.rawQuery({ query: dauSql, params }),
          optic.rawQuery({ query: wauSql, params }),
          optic.rawQuery({ query: mauSql, params }),
        ]);

        const dau = Number((dauResult.data as any[])?.[0]?.dau) || 0;
        const wau = Number((wauResult.data as any[])?.[0]?.wau) || 0;
        const mau = Number((mauResult.data as any[])?.[0]?.mau) || 0;
        const stickiness = mau > 0 ? Math.round((dau / mau) * 10000) / 100 : 0;

        return reply.send({
          success: true,
          data: {
            stages,
            new_users_over_time: newUsersOverTime,
            dau,
            wau,
            mau,
            stickiness,
          },
        });
      } catch (err) {
        logger.error('Lifecycle query failed', {
          error: err instanceof Error ? err.message : String(err),
        });
        return reply.code(500).send({ error: 'Lifecycle query failed' });
      }
    }
  );
}

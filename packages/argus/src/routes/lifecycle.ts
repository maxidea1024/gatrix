import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { optic } from '@gatrix/argus-optic';
import { createLogger } from '../utils/logger';
import {
  buildTimeRangeConditions,
  PERIOD_TO_SECONDS,
} from '../utils/timeBucket';

const TABLE = 'argus.activities';
const logger = createLogger('lifecycle-api');

export default async function lifecycleRoutes(app: FastifyInstance) {
  // ─── GET /projects/:projectId/analytics/lifecycle ───────────────────────
  // Classify users into lifecycle stages: New, Active, Returning, Dormant, Churned
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
        const { conditions: timeConds, params: timeParams } =
          buildTimeRangeConditions(period, start, end);
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

        // ── Period duration (seconds) for prev-period calculations ─────────
        const periodSeconds = start && end
          ? (new Date(end).getTime() - new Date(start).getTime()) / 1000
          : (PERIOD_TO_SECONDS[period || '30d'] || 2592000);
        const numDays = Math.ceil(periodSeconds / 86400);
        const useWeekly = numDays > 21;
        const grainFn = useWeekly ? 'toStartOfWeek' : 'toDate';

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

        // 2) New users over time (current period)
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

        // 3) New users over time (previous period)
        const prevNewUsersSql = `
          SELECT
            ${grain}(first_seen) AS period,
            count() AS new_users
          FROM (
            SELECT user_id, min(timestamp) AS first_seen
            FROM ${TABLE}
            WHERE project_id = {projectId:String}
              AND user_id != ''
              AND timestamp >= now() - INTERVAL ${numDays * 2} DAY
              AND timestamp < now() - INTERVAL ${numDays} DAY
            GROUP BY user_id
          )
          GROUP BY period
          ORDER BY period ASC
        `;

        // 4) DAU/WAU/MAU (current + previous)
        const dauSql = `SELECT uniqExact(user_id) AS v FROM ${TABLE} WHERE project_id = {projectId:String} AND user_id != '' AND timestamp >= now() - INTERVAL 1 DAY`;
        const wauSql = `SELECT uniqExact(user_id) AS v FROM ${TABLE} WHERE project_id = {projectId:String} AND user_id != '' AND timestamp >= now() - INTERVAL 7 DAY`;
        const mauSql = `SELECT uniqExact(user_id) AS v FROM ${TABLE} WHERE project_id = {projectId:String} AND user_id != '' AND timestamp >= now() - INTERVAL 30 DAY`;
        const prevDauSql = `SELECT uniqExact(user_id) AS v FROM ${TABLE} WHERE project_id = {projectId:String} AND user_id != '' AND timestamp >= now() - INTERVAL 2 DAY AND timestamp < now() - INTERVAL 1 DAY`;
        const prevWauSql = `SELECT uniqExact(user_id) AS v FROM ${TABLE} WHERE project_id = {projectId:String} AND user_id != '' AND timestamp >= now() - INTERVAL 14 DAY AND timestamp < now() - INTERVAL 7 DAY`;
        const prevMauSql = `SELECT uniqExact(user_id) AS v FROM ${TABLE} WHERE project_id = {projectId:String} AND user_id != '' AND timestamp >= now() - INTERVAL 60 DAY AND timestamp < now() - INTERVAL 30 DAY`;

        // 5) Lifecycle stages over time (current period)
        const stagesOverTimeSql = `
          WITH
            user_summary AS (
              SELECT
                user_id,
                toDate(min(timestamp)) AS first_seen,
                toDate(max(timestamp)) AS last_seen
              FROM ${TABLE}
              WHERE project_id = {projectId:String}
                AND user_id != ''
              GROUP BY user_id
            ),
            date_series AS (
              SELECT DISTINCT ${grainFn}(
                toDate(now()) - ${numDays} + number
              ) AS ref_date
              FROM numbers(${numDays + 1})
            )
          SELECT
            toString(ds.ref_date) AS period,
            multiIf(
              us.first_seen >= ds.ref_date - 6, 'new',
              us.last_seen >= ds.ref_date, 'active',
              us.last_seen >= ds.ref_date - 6, 'returning',
              us.last_seen >= ds.ref_date - 29, 'dormant',
              'churned'
            ) AS stage,
            count() AS user_count
          FROM date_series ds
          CROSS JOIN user_summary us
          WHERE us.first_seen <= ds.ref_date
          GROUP BY period, stage
          ORDER BY period ASC,
            CASE stage
              WHEN 'new' THEN 1
              WHEN 'active' THEN 2
              WHEN 'returning' THEN 3
              WHEN 'dormant' THEN 4
              ELSE 5
            END
        `;

        // 6) Lifecycle stages over time (previous period)
        const prevStagesOverTimeSql = `
          WITH
            user_summary AS (
              SELECT
                user_id,
                toDate(min(timestamp)) AS first_seen,
                toDate(max(timestamp)) AS last_seen
              FROM ${TABLE}
              WHERE project_id = {projectId:String}
                AND user_id != ''
              GROUP BY user_id
            ),
            date_series AS (
              SELECT DISTINCT ${grainFn}(
                toDate(now()) - ${numDays * 2} + number
              ) AS ref_date
              FROM numbers(${numDays + 1})
            )
          SELECT
            toString(ds.ref_date) AS period,
            multiIf(
              us.first_seen >= ds.ref_date - 6, 'new',
              us.last_seen >= ds.ref_date, 'active',
              us.last_seen >= ds.ref_date - 6, 'returning',
              us.last_seen >= ds.ref_date - 29, 'dormant',
              'churned'
            ) AS stage,
            count() AS user_count
          FROM date_series ds
          CROSS JOIN user_summary us
          WHERE us.first_seen <= ds.ref_date
          GROUP BY period, stage
          ORDER BY period ASC,
            CASE stage
              WHEN 'new' THEN 1
              WHEN 'active' THEN 2
              WHEN 'returning' THEN 3
              WHEN 'dormant' THEN 4
              ELSE 5
            END
        `;

        // 7) DAU/WAU/MAU over time (daily rolling window)
        const dauOverTimeSql = `
          WITH
            date_series AS (
              SELECT toDate(now()) - ${numDays} + number AS ref_date
              FROM numbers(${numDays + 1})
            )
          SELECT
            toString(ds.ref_date) AS period,
            uniqExactIf(a.user_id, toDate(a.timestamp) = ds.ref_date) AS dau,
            uniqExactIf(a.user_id, toDate(a.timestamp) >= ds.ref_date - 6) AS wau,
            uniqExactIf(a.user_id, toDate(a.timestamp) >= ds.ref_date - 29) AS mau
          FROM date_series ds
          CROSS JOIN ${TABLE} a
          WHERE a.project_id = {projectId:String}
            AND a.user_id != ''
            AND toDate(a.timestamp) >= ds.ref_date - 29
            AND toDate(a.timestamp) <= ds.ref_date
          GROUP BY period
          ORDER BY period ASC
        `;

        // ── Execute all queries in parallel ────────────────────────────────
        const [
          lifecycleResult,
          newUsersResult,
          prevNewUsersResult,
          dauResult, wauResult, mauResult,
          prevDauResult, prevWauResult, prevMauResult,
          stagesOverTimeResult,
          prevStagesOverTimeResult,
          dauOverTimeResult,
        ] = await Promise.all([
          optic.rawQuery({ query: lifecycleSql, params }),
          optic.rawQuery({ query: newUsersSql, params }),
          optic.rawQuery({ query: prevNewUsersSql, params }),
          optic.rawQuery({ query: dauSql, params }),
          optic.rawQuery({ query: wauSql, params }),
          optic.rawQuery({ query: mauSql, params }),
          optic.rawQuery({ query: prevDauSql, params }),
          optic.rawQuery({ query: prevWauSql, params }),
          optic.rawQuery({ query: prevMauSql, params }),
          optic.rawQuery({ query: stagesOverTimeSql, params }),
          optic.rawQuery({ query: prevStagesOverTimeSql, params }),
          optic.rawQuery({ query: dauOverTimeSql, params }),
        ]);

        // ── Parse results ──────────────────────────────────────────────────
        const stages = ((lifecycleResult.data as any[]) || []).map(
          (r: any) => ({
            stage: r.stage,
            user_count: Number(r.user_count) || 0,
            avg_events: Math.round((Number(r.avg_events) || 0) * 10) / 10,
          })
        );

        const mapTimeSeries = (data: any[]) =>
          (data || []).map((r: any) => ({
            period: r.period,
            new_users: Number(r.new_users) || 0,
          }));
        const newUsersOverTime = mapTimeSeries(newUsersResult.data as any[]);
        const prevNewUsersOverTime = mapTimeSeries(prevNewUsersResult.data as any[]);

        const val = (r: any) => Number((r.data as any[])?.[0]?.v) || 0;
        const dau = val(dauResult);
        const wau = val(wauResult);
        const mau = val(mauResult);
        const prevDau = val(prevDauResult);
        const prevWau = val(prevWauResult);
        const prevMau = val(prevMauResult);
        const stickiness = mau > 0 ? Math.round((dau / mau) * 10000) / 100 : 0;
        const prevStickiness = prevMau > 0 ? Math.round((prevDau / prevMau) * 10000) / 100 : 0;

        const mapStageSeries = (data: any[]) =>
          (data || []).map((r: any) => ({
            period: r.period,
            stage: r.stage,
            user_count: Number(r.user_count) || 0,
          }));
        const stagesOverTime = mapStageSeries(stagesOverTimeResult.data as any[]);
        const prevStagesOverTime = mapStageSeries(prevStagesOverTimeResult.data as any[]);

        const dauOverTime = ((dauOverTimeResult.data as any[]) || []).map(
          (r: any) => ({
            period: r.period,
            dau: Number(r.dau) || 0,
            wau: Number(r.wau) || 0,
            mau: Number(r.mau) || 0,
          })
        );

        return reply.send({
          success: true,
          data: {
            stages,
            new_users_over_time: newUsersOverTime,
            prev_new_users_over_time: prevNewUsersOverTime,
            stages_over_time: stagesOverTime,
            prev_stages_over_time: prevStagesOverTime,
            dau_over_time: dauOverTime,
            dau,
            wau,
            mau,
            stickiness,
            prev_dau: prevDau,
            prev_wau: prevWau,
            prev_mau: prevMau,
            prev_stickiness: prevStickiness,
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

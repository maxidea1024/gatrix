import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { optic } from '@gatrix/argus-optic';
import {
  buildTimeRangeConditions,
  getBucketingConfig,
} from '../utils/timeBucket';

const TABLE = 'argus.activities';

// ─────────────────────────────────────────────────────────────────────────────
// Route Registration
// ─────────────────────────────────────────────────────────────────────────────

export default async function analyticsRoutes(app: FastifyInstance) {
  // GET /:projectId/analytics/event-names
  app.get(
    '/projects/:projectId/analytics/event-names',
    async (
      request: FastifyRequest<{
        Params: { projectId: string };
        Querystring: { period?: string; start?: string; end?: string };
      }>,
      reply: FastifyReply
    ) => {
      const { projectId } = request.params;
      const { period, start, end } = request.query;
      const { conditions, params } = buildTimeRangeConditions(
        period || '30d',
        start,
        end
      );
      conditions.push('project_id = {projectId:String}');
      params.projectId = projectId;

      const sql = `
        SELECT
          event_name AS name,
          count() AS count
        FROM ${TABLE}
        WHERE ${conditions.join(' AND ')}
        GROUP BY event_name
        ORDER BY count DESC
        LIMIT 200
      `;

      const result = await optic.rawQuery({ query: sql, params });
      return reply.send({ success: true, data: result.data });
    }
  );

  // GET /:projectId/analytics/event-properties
  app.get(
    '/projects/:projectId/analytics/event-properties',
    async (
      request: FastifyRequest<{
        Params: { projectId: string };
        Querystring: {
          event_name?: string;
          period?: string;
          start?: string;
          end?: string;
        };
      }>,
      reply: FastifyReply
    ) => {
      const { projectId } = request.params;
      const { event_name, period, start, end } = request.query;

      const { conditions, params } = buildTimeRangeConditions(
        period || '30d',
        start,
        end
      );
      conditions.push('project_id = {projectId:String}');
      params.projectId = projectId;

      // Only filter by event_name when provided
      if (event_name) {
        conditions.push('event_name = {eventName:String}');
        params.eventName = event_name;
      }

      // Get string property keys
      const stringKeysSql = `
        SELECT DISTINCT arrayJoin(mapKeys(properties)) AS key
        FROM ${TABLE}
        WHERE ${conditions.join(' AND ')}
        ORDER BY key
        LIMIT 100
      `;

      // Get numeric property keys
      const numericKeysSql = `
        SELECT DISTINCT arrayJoin(mapKeys(numeric_properties)) AS key
        FROM ${TABLE}
        WHERE ${conditions.join(' AND ')}
        ORDER BY key
        LIMIT 100
      `;

      const [stringKeys, numericKeys] = await Promise.all([
        optic.rawQuery({ query: stringKeysSql, params }),
        optic.rawQuery({ query: numericKeysSql, params }),
      ]);

      return reply.send({
        success: true,
        data: {
          string_keys: (stringKeys.data as any[]).map((r: any) => r.key),
          numeric_keys: (numericKeys.data as any[]).map((r: any) => r.key),
          // Also return built-in columns usable for breakdowns
          builtin_columns: [
            'platform',
            'environment',
            'release',
            'country',
            'city',
            'os',
            'app_version',
          ],
        },
      });
    }
  );

  // POST /:projectId/analytics/insights
  app.post(
    '/projects/:projectId/analytics/insights',
    async (
      request: FastifyRequest<{
        Params: { projectId: string };
        Body: InsightsRequest;
      }>,
      reply: FastifyReply
    ) => {
      const { projectId } = request.params;
      const body = request.body;

      if (!body.events || body.events.length === 0) {
        return reply
          .code(400)
          .send({ success: false, message: 'At least one event is required' });
      }

      const { conditions: timeConditions, params: timeParams } =
        buildTimeRangeConditions(body.period || '14d', body.start, body.end);
      const bucketing = getBucketingConfig(
        body.period || '14d',
        body.start,
        body.end
      );

      const series: any[] = [];

      for (const event of body.events) {
        const params: Record<string, any> = {
          ...timeParams,
          ...bucketing.queryParams,
          projectId,
          eventName: event.name,
        };

        const propConditions = buildPropertyConditions(
          event.conditions,
          params,
          `ev_${event.name.replace(/[^a-zA-Z0-9]/g, '')}`
        );
        const conditions = [
          ...timeConditions,
          'project_id = {projectId:String}',
          'event_name = {eventName:String}',
          ...propConditions,
        ];

        // Aggregation expression
        let aggExpr: string;
        switch (event.aggregation) {
          case 'unique':
            aggExpr = 'uniq(user_id)';
            break;
          case 'frequency':
            // Events per user: total events / unique users
            aggExpr = 'count() / greatest(uniq(user_id), 1)';
            break;
          case 'avg':
            if (!event.property) {
              aggExpr = 'count()';
            } else {
              aggExpr = `avg(numeric_properties[{aggProp:String}])`;
              params.aggProp = event.property;
            }
            break;
          case 'median':
            if (!event.property) {
              aggExpr = 'count()';
            } else {
              aggExpr = `quantile(0.5)(numeric_properties[{aggProp:String}])`;
              params.aggProp = event.property;
            }
            break;
          case 'p25':
            if (!event.property) {
              aggExpr = 'count()';
            } else {
              aggExpr = `quantile(0.25)(numeric_properties[{aggProp:String}])`;
              params.aggProp = event.property;
            }
            break;
          case 'p75':
            if (!event.property) {
              aggExpr = 'count()';
            } else {
              aggExpr = `quantile(0.75)(numeric_properties[{aggProp:String}])`;
              params.aggProp = event.property;
            }
            break;
          case 'p90':
            if (!event.property) {
              aggExpr = 'count()';
            } else {
              aggExpr = `quantile(0.9)(numeric_properties[{aggProp:String}])`;
              params.aggProp = event.property;
            }
            break;
          case 'sum':
            if (!event.property) {
              aggExpr = 'count()';
            } else {
              aggExpr = `sum(numeric_properties[{aggProp:String}])`;
              params.aggProp = event.property;
            }
            break;
          default:
            // 'total'
            aggExpr = 'count()';
        }

        if (body.breakdown) {
          // Breakdown query
          const breakdownCol = resolveBreakdownColumn(body.breakdown.property);
          const sql = `
            SELECT
              ${bucketing.selectExpr} AS bucket,
              ${breakdownCol} AS breakdown_value,
              ${aggExpr} AS value
            FROM ${TABLE}
            WHERE ${conditions.join(' AND ')}
            GROUP BY bucket, breakdown_value
            ORDER BY bucket ASC ${bucketing.fillExpr}
          `;

          const { data: rows } = (await optic.rawQuery({
            query: sql,
            params,
          })) as { data: any[] };

          // Group by breakdown_value
          const grouped = new Map<string, any[]>();
          for (const row of rows) {
            const key = String(row.breakdown_value || '(empty)');
            if (!grouped.has(key)) grouped.set(key, []);
            grouped.get(key)!.push({
              bucket: row.bucket,
              value: Number(row.value),
            });
          }

          for (const [breakdownValue, data] of grouped) {
            series.push({
              event: event.name,
              breakdown_value: breakdownValue,
              data,
            });
          }
        } else {
          // Simple time-series
          const sql = `
            SELECT
              ${bucketing.selectExpr} AS bucket,
              ${aggExpr} AS value
            FROM ${TABLE}
            WHERE ${conditions.join(' AND ')}
            GROUP BY bucket
            ORDER BY bucket ASC ${bucketing.fillExpr}
          `;

          const { data: rows } = (await optic.rawQuery({
            query: sql,
            params,
          })) as { data: any[] };
          series.push({
            event: event.name,
            data: rows.map((r: any) => ({
              bucket: r.bucket,
              value: Number(r.value),
            })),
          });
        }
      }

      // Compare period support
      let compareSeries: any[] | undefined;
      if (body.compare_period) {
        compareSeries = [];
        // Calculate offset based on compare_period
        const offsetMs = getCompareOffsetMs(
          body.compare_period,
          body.period || '14d',
          body.start,
          body.end
        );
        if (offsetMs > 0) {
          const compareStart = body.start
            ? new Date(new Date(body.start).getTime() - offsetMs).toISOString()
            : undefined;
          const compareEnd = body.end
            ? new Date(new Date(body.end).getTime() - offsetMs).toISOString()
            : undefined;

          // Re-run the same queries with offset time range
          const {
            conditions: compareTimeConditions,
            params: compareTimeParams,
          } = buildTimeRangeConditions(
            body.period || '14d',
            compareStart,
            compareEnd
          );
          const compareBucketing = getBucketingConfig(
            body.period || '14d',
            compareStart,
            compareEnd
          );

          for (const event of body.events) {
            const cParams: Record<string, any> = {
              ...compareTimeParams,
              ...compareBucketing.queryParams,
              projectId,
              eventName: event.name,
            };
            const cPropConditions = buildPropertyConditions(
              event.conditions,
              cParams,
              `cev_${event.name.replace(/[^a-zA-Z0-9]/g, '')}`
            );
            const cConditions = [
              ...compareTimeConditions,
              'project_id = {projectId:String}',
              'event_name = {eventName:String}',
              ...cPropConditions,
            ];
            let cAggExpr = 'count()';
            switch (event.aggregation) {
              case 'unique':
                cAggExpr = 'uniq(user_id)';
                break;
              case 'frequency':
                cAggExpr = 'count() / greatest(uniq(user_id), 1)';
                break;
              case 'sum':
                if (event.property) {
                  cAggExpr = `sum(numeric_properties[{aggProp:String}])`;
                  cParams.aggProp = event.property;
                }
                break;
              case 'avg':
                if (event.property) {
                  cAggExpr = `avg(numeric_properties[{aggProp:String}])`;
                  cParams.aggProp = event.property;
                }
                break;
              default:
                break;
            }
            const cSql = `
              SELECT ${compareBucketing.selectExpr} AS bucket, ${cAggExpr} AS value
              FROM ${TABLE}
              WHERE ${cConditions.join(' AND ')}
              GROUP BY bucket
              ORDER BY bucket ASC ${compareBucketing.fillExpr}
            `;
            const { data: cRows } = (await optic.rawQuery({
              query: cSql,
              params: cParams,
            })) as { data: any[] };
            compareSeries.push({
              event: event.name,
              data: cRows.map((r: any) => ({
                bucket: r.bucket,
                value: Number(r.value),
              })),
            });
          }
        }
      }

      return reply.send({
        success: true,
        data: {
          series,
          ...(compareSeries ? { compare_series: compareSeries } : {}),
        },
      });
    }
  );

  // POST /:projectId/analytics/funnels
  app.post(
    '/projects/:projectId/analytics/funnels',
    async (
      request: FastifyRequest<{
        Params: { projectId: string };
        Body: FunnelsRequest;
      }>,
      reply: FastifyReply
    ) => {
      const { projectId } = request.params;
      const body = request.body;

      if (!body.steps || body.steps.length < 2) {
        return reply.code(400).send({
          success: false,
          message: 'At least 2 funnel steps are required',
        });
      }

      if (body.steps.length > 10) {
        return reply.code(400).send({
          success: false,
          message: 'Maximum 10 funnel steps allowed',
        });
      }

      const { conditions, params } = buildTimeRangeConditions(
        body.period || '14d',
        body.start,
        body.end
      );
      conditions.push('project_id = {projectId:String}');
      params.projectId = projectId;

      // Build windowFunnel conditions
      const windowSeconds = body.conversion_window || 86400;
      const eventNames = body.steps.map((s) => s.event_name);
      const totalSteps = eventNames.length;
      const funnelConditions = body.steps
        .map((step, i) => {
          const paramKey = `funnelEvent${i}`;
          params[paramKey] = step.event_name;

          const propConditions = buildPropertyConditions(
            step.conditions,
            params,
            `funnelCond${i}`
          );

          if (propConditions.length > 0) {
            return `(event_name = {${paramKey}:String} AND ${propConditions.join(' AND ')})`;
          }
          return `event_name = {${paramKey}:String}`;
        })
        .join(', ');

      // Only include events that are in the funnel
      conditions.push(
        `event_name IN (${eventNames.map((_, i) => `{funnelEvent${i}:String}`).join(', ')})`
      );

      // Exclude events without user_id (funnel is user-based)
      conditions.push("user_id != ''");

      const whereClause = conditions.join(' AND ');

      // ── Always compute steps result ──
      const stepsSql = `
        SELECT
          level,
          count() AS cnt
        FROM (
          SELECT
            user_id,
            windowFunnel(${windowSeconds})(toDateTime(timestamp), ${funnelConditions}) AS level
          FROM ${TABLE}
          WHERE ${whereClause}
          GROUP BY user_id
        )
        WHERE level > 0
        GROUP BY level
        ORDER BY level ASC
      `;

      const { data: stepsRows } = (await optic.rawQuery({
        query: stepsSql,
        params,
      })) as { data: any[] };

      const levelCounts = new Array(totalSteps + 1).fill(0);
      for (const row of stepsRows) {
        levelCounts[Number(row.level)] = Number(row.cnt);
      }

      const stepCounts = new Array(totalSteps).fill(0);
      for (let step = totalSteps; step >= 1; step--) {
        stepCounts[step - 1] = levelCounts[step];
        if (step < totalSteps) {
          stepCounts[step - 1] += stepCounts[step];
        }
      }

      const firstStepCount = stepCounts[0] || 1;
      const steps = eventNames.map((name, i) => ({
        name,
        count: stepCounts[i],
        conversion_rate:
          Math.round((stepCounts[i] / firstStepCount) * 1000) / 10,
      }));

      const overallConversion =
        firstStepCount > 0
          ? Math.round((stepCounts[totalSteps - 1] / firstStepCount) * 1000) /
            10
          : 0;

      const baseResult: Record<string, any> = {
        steps,
        overall_conversion: overallConversion,
      };

      // ── mode = 'trending': daily conversion rate over time ──
      if (body.mode === 'trending') {
        try {
          const bucketing = getBucketingConfig(
            body.period || '14d',
            body.start,
            body.end
          );
          // Use daily minimum for funnel trending (hourly is too noisy)
          const trendingSql = `
            SELECT
              toDate(min_ts) AS bucket,
              count() AS total_users,
              countIf(level >= ${totalSteps}) AS converted_users
            FROM (
              SELECT
                user_id,
                min(timestamp) AS min_ts,
                windowFunnel(${windowSeconds})(toDateTime(timestamp), ${funnelConditions}) AS level
              FROM ${TABLE}
              WHERE ${whereClause}
              GROUP BY user_id
            )
            WHERE level > 0
            GROUP BY bucket
            ORDER BY bucket ASC
            WITH FILL
              FROM toDate(toDateTime({fillStart:UInt32}))
              TO toDate(toDateTime({fillEnd:UInt32}))
              STEP INTERVAL 1 DAY
          `;

          const trendingParams = { ...params, ...bucketing.queryParams };
          const { data: trendingRows } = (await optic.rawQuery({
            query: trendingSql,
            params: trendingParams,
          })) as { data: any[] };

          baseResult.trending = trendingRows.map((r: any) => ({
            date: String(r.bucket),
            conversion_rate:
              Number(r.total_users) > 0
                ? Math.round(
                    (Number(r.converted_users) / Number(r.total_users)) * 1000
                  ) / 10
                : 0,
            total_users: Number(r.total_users) || 0,
            converted_users: Number(r.converted_users) || 0,
          }));
        } catch (err: any) {
          // Trending is supplementary — don't fail the whole request
          baseResult.trending = [];
        }
      }

      // ── mode = 'time_to_convert': conversion time statistics ──
      if (body.mode === 'time_to_convert') {
        try {
          // Get per-user first step timestamp and last completed step timestamp
          // for users who completed the entire funnel
          const ttcStatsSql = `
            SELECT
              quantile(0.5)(convert_seconds) AS median_seconds,
              avg(convert_seconds) AS avg_seconds,
              quantile(0.25)(convert_seconds) AS p25_seconds,
              quantile(0.75)(convert_seconds) AS p75_seconds
            FROM (
              SELECT
                user_id,
                dateDiff('second', min(timestamp), max(timestamp)) AS convert_seconds
              FROM (
                SELECT
                  user_id,
                  timestamp,
                  windowFunnel(${windowSeconds})(toDateTime(timestamp), ${funnelConditions}) OVER (PARTITION BY user_id) AS level
                FROM ${TABLE}
                WHERE ${whereClause}
              )
              WHERE level >= ${totalSteps}
              GROUP BY user_id
              HAVING convert_seconds >= 0
            )
          `;

          let ttcStats: any;
          try {
            const { data: statsRows } = (await optic.rawQuery({
              query: ttcStatsSql,
              params,
            })) as { data: any[] };
            ttcStats = statsRows[0] || {};
          } catch {
            // Fallback: window functions may not be supported in older ClickHouse
            // Use a simpler subquery approach
            const ttcFallbackSql = `
              SELECT
                quantile(0.5)(convert_seconds) AS median_seconds,
                avg(convert_seconds) AS avg_seconds,
                quantile(0.25)(convert_seconds) AS p25_seconds,
                quantile(0.75)(convert_seconds) AS p75_seconds
              FROM (
                SELECT
                  user_id,
                  dateDiff('second',
                    min(if(event_name = {funnelEvent0:String}, timestamp, toDateTime64('2099-01-01', 3))),
                    max(if(event_name = {funnelEvent${totalSteps - 1}:String}, timestamp, toDateTime64('1970-01-01', 3)))
                  ) AS convert_seconds
                FROM ${TABLE}
                WHERE ${whereClause}
                GROUP BY user_id
                HAVING convert_seconds > 0 AND convert_seconds < 999999999
              )
            `;
            const { data: fallbackRows } = (await optic.rawQuery({
              query: ttcFallbackSql,
              params,
            })) as { data: any[] };
            ttcStats = fallbackRows[0] || {};
          }

          // Histogram distribution
          const ttcDistSql = `
            SELECT
              multiIf(
                convert_seconds < 60, '< 1m',
                convert_seconds < 300, '1-5m',
                convert_seconds < 900, '5-15m',
                convert_seconds < 3600, '15m-1h',
                convert_seconds < 86400, '1-24h',
                '> 24h'
              ) AS bucket,
              count() AS count,
              min(convert_seconds) AS sort_key
            FROM (
              SELECT
                user_id,
                dateDiff('second',
                  min(if(event_name = {funnelEvent0:String}, timestamp, toDateTime64('2099-01-01', 3))),
                  max(if(event_name = {funnelEvent${totalSteps - 1}:String}, timestamp, toDateTime64('1970-01-01', 3)))
                ) AS convert_seconds
              FROM ${TABLE}
              WHERE ${whereClause}
              GROUP BY user_id
              HAVING convert_seconds > 0 AND convert_seconds < 999999999
            )
            GROUP BY bucket
            ORDER BY sort_key ASC
          `;

          const { data: distRows } = (await optic.rawQuery({
            query: ttcDistSql,
            params,
          })) as { data: any[] };

          baseResult.time_to_convert = {
            median_seconds: Math.round(Number(ttcStats.median_seconds) || 0),
            avg_seconds: Math.round(Number(ttcStats.avg_seconds) || 0),
            p25_seconds: Math.round(Number(ttcStats.p25_seconds) || 0),
            p75_seconds: Math.round(Number(ttcStats.p75_seconds) || 0),
            distribution: distRows.map((r: any) => ({
              bucket: String(r.bucket),
              count: Number(r.count),
            })),
          };
        } catch (err: any) {
          // TTC is supplementary — don't fail the whole request
          baseResult.time_to_convert = {
            median_seconds: 0,
            avg_seconds: 0,
            p25_seconds: 0,
            p75_seconds: 0,
            distribution: [],
          };
        }
      }

      return reply.send({
        success: true,
        data: baseResult,
      });
    }
  );

  // POST /:projectId/analytics/retention
  app.post(
    '/projects/:projectId/analytics/retention',
    async (
      request: FastifyRequest<{
        Params: { projectId: string };
        Body: RetentionRequest;
      }>,
      reply: FastifyReply
    ) => {
      const { projectId } = request.params;
      const body = request.body;

      if (!body.first_event?.name || !body.return_event?.name) {
        return reply.code(400).send({
          success: false,
          message: 'first_event and return_event are required',
        });
      }

      const numPeriods = Math.min(body.num_periods || 14, 90);
      const retentionType = body.retention_type || 'day';
      const dateDiffUnit =
        retentionType === 'week'
          ? 'week'
          : retentionType === 'month'
            ? 'month'
            : 'day';
      const intervalUnit =
        retentionType === 'week'
          ? 'WEEK'
          : retentionType === 'month'
            ? 'MONTH'
            : 'DAY';
      const truncFunc =
        retentionType === 'week'
          ? 'toMonday'
          : retentionType === 'month'
            ? 'toStartOfMonth'
            : 'toDate';

      const { conditions: timeConditions, params } = buildTimeRangeConditions(
        body.period || '30d',
        body.start,
        body.end
      );

      params.projectId = projectId;
      params.firstEvent = body.first_event.name;
      params.returnEvent = body.return_event.name;
      params.numPeriods = numPeriods;

      // Build dynamic period columns
      const periodSelects: string[] = [];
      for (let i = 0; i <= numPeriods; i++) {
        periodSelects.push(`countIf(return_period = ${i}) AS p${i}`);
      }

      const firstEventConds = buildPropertyConditions(
        body.first_event.conditions,
        params,
        'fCond'
      );
      const returnEventConds = buildPropertyConditions(
        body.return_event.conditions,
        params,
        'rCond'
      );

      const firstEventWhere =
        firstEventConds.length > 0
          ? `AND ${firstEventConds.join(' AND ')}`
          : '';
      const returnEventWhere =
        returnEventConds.length > 0
          ? `AND ${returnEventConds.join(' AND ')}`
          : '';

      const sql = `
        SELECT
          cohort_date,
          count(DISTINCT user_id) AS cohort_size,
          ${periodSelects.join(',\n          ')}
        FROM (
          SELECT
            f.user_id,
            ${truncFunc}(f.first_ts) AS cohort_date,
            dateDiff('${dateDiffUnit}', ${truncFunc}(f.first_ts), ${truncFunc}(r.timestamp)) AS return_period
          FROM (
            SELECT user_id, min(timestamp) AS first_ts
            FROM ${TABLE}
            WHERE event_name = {firstEvent:String}
              AND project_id = {projectId:String}
              AND user_id != ''
              ${firstEventWhere}
              AND ${timeConditions.join(' AND ')}
            GROUP BY user_id
          ) f
          INNER JOIN ${TABLE} r
            ON r.user_id = f.user_id
            AND r.event_name = {returnEvent:String}
            AND r.project_id = {projectId:String}
            ${returnEventWhere}
            AND r.timestamp >= f.first_ts
            AND r.timestamp <= f.first_ts + INTERVAL {numPeriods:UInt32} ${intervalUnit}
        )
        WHERE return_period >= 0 AND return_period <= {numPeriods:UInt32}
        GROUP BY cohort_date
        ORDER BY cohort_date ASC
      `;

      const { data: rows } = (await optic.rawQuery({ query: sql, params })) as {
        data: any[];
      };

      const cohorts = rows.map((row: any) => {
        const cohortSize = Number(row.cohort_size) || 1;
        const retention: number[] = [];
        for (let i = 0; i <= numPeriods; i++) {
          const periodCount = Number(row[`p${i}`]) || 0;
          retention.push(Math.round((periodCount / cohortSize) * 1000) / 10);
        }
        return {
          cohort_date: row.cohort_date,
          cohort_size: Number(row.cohort_size),
          retention,
        };
      });

      return reply.send({ success: true, data: { cohorts } });
    }
  );

  // POST /:projectId/analytics/flows
  app.post(
    '/projects/:projectId/analytics/flows',
    async (
      request: FastifyRequest<{
        Params: { projectId: string };
        Body: FlowsRequest;
      }>,
      reply: FastifyReply
    ) => {
      const { projectId } = request.params;
      const body = request.body;

      if (!body.anchor_event?.name) {
        return reply.code(400).send({
          success: false,
          message: 'anchor_event is required',
        });
      }

      const depth = Math.min(Math.max(body.depth || 3, 1), 5);
      const direction = body.direction || 'after';
      const minFrequency = body.min_frequency || 0.01; // 1%

      const { conditions, params } = buildTimeRangeConditions(
        body.period || '14d',
        body.start,
        body.end
      );
      conditions.push('project_id = {projectId:String}');
      conditions.push("user_id != ''");
      params.projectId = projectId;
      params.anchorEvent = body.anchor_event.name;
      params.seqLimit = depth + 1;

      // Get event sequences per user
      const orderDir = direction === 'before' ? 'DESC' : 'ASC';

      const sql = `
        SELECT
          source_event,
          target_event,
          count() AS value
        FROM (
          SELECT
            user_id,
            groupArray(${depth + 1})(event_name) AS seq
          FROM (
            SELECT
              user_id,
              event_name,
              timestamp,
              row_number() OVER (
                PARTITION BY user_id
                ORDER BY timestamp ${orderDir}
              ) AS rn
            FROM ${TABLE}
            WHERE ${conditions.join(' AND ')}
          )
          WHERE rn <= {seqLimit:UInt32}
          GROUP BY user_id
          HAVING has(seq, {anchorEvent:String})
          LIMIT 10000
        )
        ARRAY JOIN
          arraySlice(seq, 1, length(seq) - 1) AS source_event,
          arraySlice(seq, 2) AS target_event
        GROUP BY source_event, target_event
        ORDER BY value DESC
        LIMIT 500
      `;

      const { data: rows } = (await optic.rawQuery({ query: sql, params })) as {
        data: any[];
      };

      // Build nodes and links
      const nodeMap = new Map<string, number>();
      const links: { source: string; target: string; value: number }[] = [];

      const totalUsers = rows.reduce(
        (sum: number, r: any) => sum + Number(r.value),
        0
      );
      const threshold = totalUsers * minFrequency;

      for (const row of rows) {
        const value = Number(row.value);
        if (value < threshold) continue;

        const source = String(row.source_event);
        const target = String(row.target_event);

        nodeMap.set(source, (nodeMap.get(source) || 0) + value);
        nodeMap.set(target, (nodeMap.get(target) || 0) + value);

        links.push({ source, target, value });
      }

      const nodes = Array.from(nodeMap.entries()).map(([id, count]) => ({
        id,
        count,
      }));

      return reply.send({ success: true, data: { nodes, links } });
    }
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Calculate the time offset in ms for compare-to-past feature */
function getCompareOffsetMs(
  comparePeriod: string,
  period: string,
  start?: string,
  end?: string
): number {
  const DAY = 86400000;
  switch (comparePeriod) {
    case 'previous_week':
      return 7 * DAY;
    case 'previous_month':
      return 30 * DAY;
    case 'previous_year':
      return 365 * DAY;
    case 'previous_period': {
      // Match the current period duration
      if (start && end) {
        return new Date(end).getTime() - new Date(start).getTime();
      }
      const match = period.match(/^(\d+)([dhwm])$/);
      if (match) {
        const n = parseInt(match[1], 10);
        switch (match[2]) {
          case 'd':
            return n * DAY;
          case 'h':
            return n * 3600000;
          case 'w':
            return n * 7 * DAY;
          case 'm':
            return n * 30 * DAY;
        }
      }
      return 14 * DAY; // fallback
    }
    default:
      return 0;
  }
}

/** Resolve a breakdown property to a ClickHouse column expression */
function resolveBreakdownColumn(property: string): string {
  const BUILTIN_COLUMNS = new Set([
    'platform',
    'environment',
    'release',
    'country',
    'city',
    'os',
    'app_version',
  ]);

  if (BUILTIN_COLUMNS.has(property)) {
    return property;
  }
  // Map property access: properties['key']
  return `properties['${property.replace(/'/g, "\\'")}']`;
}

/** Build SQL conditions for an array of Property Conditions */
export function buildPropertyConditions(
  conditions: Condition[] | undefined,
  params: Record<string, any>,
  paramPrefix: string = 'prop'
): string[] {
  if (!conditions || conditions.length === 0) return [];

  const sqlConditions: string[] = [];

  conditions.forEach((cond, index) => {
    const col = resolveBreakdownColumn(cond.property);
    const pKey = `${paramPrefix}_${index}`;
    params[pKey] = cond.value;

    switch (cond.operator) {
      case 'is':
      case 'equals':
        sqlConditions.push(`${col} = {${pKey}:String}`);
        break;
      case 'is_not':
      case 'not_equals':
        sqlConditions.push(`${col} != {${pKey}:String}`);
        break;
      case 'contains':
        sqlConditions.push(`${col} LIKE {${pKey}Like:String}`);
        params[`${pKey}Like`] = `%${cond.value}%`;
        break;
      case 'not_contains':
        sqlConditions.push(`${col} NOT LIKE {${pKey}Like:String}`);
        params[`${pKey}Like`] = `%${cond.value}%`;
        break;
      case 'gt':
        // For gt, lt we should ideally cast to numeric if possible, but fallback to string comparison
        sqlConditions.push(
          `toFloat64OrNull(${col}) > toFloat64OrNull({${pKey}:String})`
        );
        break;
      case 'lt':
        sqlConditions.push(
          `toFloat64OrNull(${col}) < toFloat64OrNull({${pKey}:String})`
        );
        break;
      case 'gte':
        sqlConditions.push(
          `toFloat64OrNull(${col}) >= toFloat64OrNull({${pKey}:String})`
        );
        break;
      case 'lte':
        sqlConditions.push(
          `toFloat64OrNull(${col}) <= toFloat64OrNull({${pKey}:String})`
        );
        break;
      case 'set':
        sqlConditions.push(`${col} != ''`);
        break;
      case 'not_set':
        sqlConditions.push(`${col} = ''`);
        break;
      default:
        // fallback
        sqlConditions.push(`${col} = {${pKey}:String}`);
    }
  });

  return sqlConditions;
}

// ─────────────────────────────────────────────────────────────────────────────
// Request Types
// ─────────────────────────────────────────────────────────────────────────────

interface Condition {
  property: string;
  operator: string;
  value: string | number;
}

interface InsightsRequest {
  events: {
    name: string;
    aggregation?:
      | 'total'
      | 'unique'
      | 'avg'
      | 'median'
      | 'sum'
      | 'frequency'
      | 'p25'
      | 'p75'
      | 'p90';
    property?: string;
    conditions?: Condition[];
  }[];
  breakdown?: { property: string; type?: 'string' | 'numeric' };
  interval?: '1h' | '1d' | '1w';
  period?: string;
  start?: string;
  end?: string;
  compare_period?:
    | 'previous_period'
    | 'previous_week'
    | 'previous_month'
    | 'previous_year';
}

interface FunnelsRequest {
  steps: { event_name: string; conditions?: Condition[] }[];
  conversion_window?: number;
  ordering?: 'specific' | 'any';
  hold_constant?: string[];
  counting?: 'uniques' | 'totals';
  breakdown?: { property: string };
  mode?: 'steps' | 'trending' | 'time_to_convert';
  period?: string;
  start?: string;
  end?: string;
}

interface RetentionRequest {
  first_event: { name: string; conditions?: Condition[] };
  return_event: { name: string; conditions?: Condition[] };
  retention_type?: 'day' | 'week' | 'month';
  num_periods?: number;
  criteria?: 'on' | 'on_or_after';
  measurement?:
    | 'retention_rate'
    | 'unique_users'
    | 'property_sum'
    | 'property_avg';
  measurement_property?: string;
  breakdown?: { property: string };
  min_frequency?: number;
  period?: string;
  start?: string;
  end?: string;
}

interface FlowsRequest {
  // Support both legacy single anchor and new multi-anchor
  anchor_event?: { name: string };
  anchor_events?: { name: string }[];
  direction?: 'after' | 'before' | 'between';
  steps_before?: number;
  steps_after?: number;
  depth?: number;
  view?: 'sankey' | 'top_paths';
  breakdown?: { property: string };
  exclude_events?: string[];
  period?: string;
  start?: string;
  end?: string;
  min_frequency?: number;
}

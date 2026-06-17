import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { optic } from '@gatrix/argus-optic';
import db from '../config/knex';
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

      let chData: any[] = [];
      try {
        const result = await optic.rawQuery({ query: sql, params });
        chData = result.data || [];
      } catch (err) {
        // Table activities might not exist yet in clickhouse
        chData = [];
      }

      const eventNames = chData.map((r: any) => r.name);

      // Fetch lexicon events (defensive — tables may not exist yet)
      let lexiconMap = new Map<string, any>();
      let allLexiconEvents: any[] = [];
      try {
        const lexiconRows = await db('g_argus_lexicon_events')
          .where('project_id', projectId)
          .whereIn('event_name', eventNames);

        for (const row of lexiconRows) {
          lexiconMap.set(row.event_name, row);
        }

        allLexiconEvents = await db('g_argus_lexicon_events')
          .where('project_id', projectId);
      } catch {
        // Lexicon tables may not exist — continue without enrichment
      }

      const responseData = chData.map((r: any) => {
        const lex = lexiconMap.get(r.name);
        return {
          name: r.name,
          count: Number(r.count),
          display_name: lex?.display_name || null,
          icon: lex?.icon || null,
          icon_color: lex?.icon_color || null,
          description: lex?.description || null,
          status: lex?.status || 'active',
          is_reserved: !!lex?.is_reserved,
          category: lex?.category || null,
        };
      });

      // Hide events marked as hidden in Lexicon from dropdowns
      const filteredResponseData = responseData.filter(d => d.status !== 'hidden');

      // Append reserved events with 0 counts if not captured yet
      const existingNames = new Set(filteredResponseData.map(d => d.name));
      for (const lex of allLexiconEvents) {
        if (lex.is_reserved && !existingNames.has(lex.event_name) && lex.status !== 'hidden') {
          filteredResponseData.push({
            name: lex.event_name,
            count: 0,
            display_name: lex.display_name,
            icon: lex.icon || null,
            icon_color: lex.icon_color || null,
            description: lex.description || null,
            status: lex.status,
            is_reserved: true,
            category: lex.category,
          });
        }
      }

      return reply.send({ success: true, data: filteredResponseData });
    }
  );

  // GET /:projectId/analytics/summary
  app.get(
    '/projects/:projectId/analytics/summary',
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
        period || '14d',
        start,
        end
      );
      conditions.push('project_id = {projectId:String}');
      params.projectId = projectId;
      const whereClause = conditions.join(' AND ');

      try {
        // 1) KPI metrics: total events, unique users, sessions
        const kpiSql = `
          SELECT
            count() AS total_events,
            uniqExact(user_id) AS unique_users,
            uniqExact(session_id) AS total_sessions
          FROM ${TABLE}
          WHERE ${whereClause}
        `;
        const kpiResult = await optic.rawQuery({ query: kpiSql, params });
        const kpiRow = (kpiResult.data as any[])?.[0] || {};

        // 2) DAU today & yesterday
        const dauSql = `
          SELECT
            uniqExactIf(user_id, toDate(timestamp) = today()) AS dau_today,
            uniqExactIf(user_id, toDate(timestamp) = yesterday()) AS dau_yesterday
          FROM ${TABLE}
          WHERE project_id = {projectId:String}
            AND timestamp >= now() - INTERVAL 2 DAY
        `;
        const dauResult = await optic.rawQuery({ query: dauSql, params: { projectId } });
        const dauRow = (dauResult.data as any[])?.[0] || {};

        // 3) Daily trend (events + users per day)
        const trendSql = `
          SELECT
            toDate(timestamp) AS date,
            count() AS events,
            uniqExact(user_id) AS users
          FROM ${TABLE}
          WHERE ${whereClause}
          GROUP BY date
          ORDER BY date ASC
          WITH FILL
            FROM toDate(now() - INTERVAL ${period === '30d' ? '30' : period === '90d' ? '90' : period === '7d' ? '7' : '14'} DAY)
            TO toDate(now()) + 1
            STEP INTERVAL 1 DAY
        `;
        const trendResult = await optic.rawQuery({ query: trendSql, params });
        const dailyTrend = ((trendResult.data as any[]) || []).map((r: any) => ({
          date: r.date,
          events: Number(r.events) || 0,
          users: Number(r.users) || 0,
        }));

        // 4) Hourly heatmap (dayOfWeek × hourOfDay)
        const heatmapSql = `
          SELECT
            toDayOfWeek(timestamp) AS dow,
            toHour(timestamp) AS hour,
            count() AS count
          FROM ${TABLE}
          WHERE ${whereClause}
          GROUP BY dow, hour
          ORDER BY dow, hour
        `;
        const heatmapResult = await optic.rawQuery({ query: heatmapSql, params });
        const hourlyHeatmap = ((heatmapResult.data as any[]) || []).map((r: any) => ({
          dow: Number(r.dow),
          hour: Number(r.hour),
          count: Number(r.count) || 0,
        }));

        return reply.send({
          success: true,
          data: {
            total_events: Number(kpiRow.total_events) || 0,
            unique_users: Number(kpiRow.unique_users) || 0,
            total_sessions: Number(kpiRow.total_sessions) || 0,
            dau_today: Number(dauRow.dau_today) || 0,
            dau_yesterday: Number(dauRow.dau_yesterday) || 0,
            daily_trend: dailyTrend,
            hourly_heatmap: hourlyHeatmap,
          },
        });
      } catch (err) {
        return reply.send({
          success: true,
          data: {
            total_events: 0,
            unique_users: 0,
            total_sessions: 0,
            dau_today: 0,
            dau_yesterday: 0,
            daily_trend: [],
            hourly_heatmap: [],
          },
        });
      }
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

  // GET /:projectId/analytics/property-values
  app.get(
    '/projects/:projectId/analytics/property-values',
    async (
      request: FastifyRequest<{
        Params: { projectId: string };
        Querystring: {
          property: string;
          period?: string;
          start?: string;
          end?: string;
          search?: string;
        };
      }>,
      reply: FastifyReply
    ) => {
      const { projectId } = request.params;
      const { property, period, start, end, search } = request.query;

      if (!property) {
        return reply
          .code(400)
          .send({ success: false, message: 'property is required' });
      }

      const { conditions, params } = buildTimeRangeConditions(
        period || '30d',
        start,
        end
      );
      conditions.push('project_id = {projectId:String}');
      params.projectId = projectId;

      // Resolve column: builtin or custom property
      const builtinColumns = [
        'platform',
        'environment',
        'release',
        'country',
        'city',
        'os',
        'app_version',
      ];
      let valueExpr: string;
      if (builtinColumns.includes(property)) {
        valueExpr = property;
      } else {
        // Try string properties first (most common)
        valueExpr = `properties[{propKey:String}]`;
        params.propKey = property;
      }

      if (search) {
        conditions.push(`${valueExpr} ILIKE {searchPattern:String}`);
        params.searchPattern = `%${search}%`;
      }

      const sql = `
        SELECT
          ${valueExpr} AS value,
          count() AS count
        FROM ${TABLE}
        WHERE ${conditions.join(' AND ')}
          AND ${valueExpr} != ''
        GROUP BY value
        ORDER BY count DESC
        LIMIT 50
      `;

      const result = await optic.rawQuery({ query: sql, params });
      return reply.send({ success: true, data: result.data });
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

      for (let eventIdx = 0; eventIdx < body.events.length; eventIdx++) {
        const event = body.events[eventIdx];
        const params: Record<string, any> = {
          ...timeParams,
          ...bucketing.queryParams,
          projectId,
          eventName: event.name,
        };

        const propConditions = buildPropertyConditions(
          event.conditions,
          params,
          `ev_e${eventIdx}_`
        );
        const globalConditions = buildGlobalFilterConditions(
          body.global_filters,
          params,
          `gf_e${eventIdx}_`
        );
        const conditions = [
          ...timeConditions,
          'project_id = {projectId:String}',
          'event_name = {eventName:String}',
          ...propConditions,
          ...globalConditions,
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

        const bdProps = getBreakdownProperties(body.breakdown);
        if (bdProps.length > 0) {
          // Breakdown query (supports multiple properties)
          const breakdownCol = buildBreakdownExpression(bdProps);
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
            const cGlobalConditions = buildGlobalFilterConditions(
              body.global_filters,
              cParams,
              `cgf_${event.name.replace(/[^a-zA-Z0-9]/g, '')}`
            );
            const cConditions = [
              ...compareTimeConditions,
              'project_id = {projectId:String}',
              'event_name = {eventName:String}',
              ...cPropConditions,
              ...cGlobalConditions,
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
          ...(getBreakdownProperties(body.breakdown).length > 0
            ? { breakdown_properties: getBreakdownProperties(body.breakdown) }
            : {}),
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

      // Only include events that are in the funnel (+ exclusion events)
      const exclusionEventNames = (body.exclusion_steps || []).map((es, i) => {
        const pKey = `exclusionEvent${i}`;
        params[pKey] = es.event_name;
        return es.event_name;
      });
      const allRelevantEvents = [
        ...eventNames.map((_, i) => `{funnelEvent${i}:String}`),
        ...exclusionEventNames.map((_, i) => `{exclusionEvent${i}:String}`),
      ];
      conditions.push(`event_name IN (${allRelevantEvents.join(', ')})`);

      // Exclude events without user_id (funnel is user-based)
      conditions.push("user_id != ''");

      // Apply global filters
      const globalConditions = buildGlobalFilterConditions(
        body.global_filters,
        params,
        'gf_funnel'
      );
      conditions.push(...globalConditions);

      const whereClause = conditions.join(' AND ');

      // ── Build exclusion subquery if needed ──
      let exclusionFilter = '';
      if (body.exclusion_steps && body.exclusion_steps.length > 0) {
        // Validate indices and filter out invalid exclusion steps
        const validExclusions = body.exclusion_steps.filter(
          (es) =>
            es.event_name &&
            es.between[0] >= 0 &&
            es.between[1] > es.between[0] &&
            es.between[0] < totalSteps &&
            es.between[1] < totalSteps
        );
        if (validExclusions.length > 0) {
          const exclusionSubqueries = validExclusions.map((es, i) => {
            const afterStep = es.between[0];
            const beforeStep = es.between[1];
            return `
              SELECT DISTINCT excl.user_id
              FROM ${TABLE} AS excl
              INNER JOIN (
                SELECT user_id,
                  min(if(event_name = {funnelEvent${afterStep}:String}, timestamp, toDateTime64('2099-01-01', 3))) AS step_after_ts,
                  min(if(event_name = {funnelEvent${beforeStep}:String}, timestamp, toDateTime64('2099-01-01', 3))) AS step_before_ts
                FROM ${TABLE}
                WHERE ${whereClause}
                GROUP BY user_id
              ) AS funnel_ts ON excl.user_id = funnel_ts.user_id
              WHERE excl.event_name = {exclusionEvent${i}:String}
                AND excl.project_id = {projectId:String}
                AND excl.timestamp > funnel_ts.step_after_ts
                AND excl.timestamp < funnel_ts.step_before_ts
            `;
          });
          exclusionFilter = `AND user_id NOT IN (${exclusionSubqueries.join(' UNION ALL ')})`;
        }
      }

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
          ${exclusionFilter}
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

      const firstStepCount = stepCounts[0];
      const steps = eventNames.map((name, i) => ({
        name,
        count: stepCounts[i],
        conversion_rate:
          firstStepCount > 0
            ? Math.round((stepCounts[i] / firstStepCount) * 1000) / 10
            : 0,
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
              ${exclusionFilter}
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

      // ── Segment comparison: run separate funnel per segment ──
      if (body.segments && body.segments.length > 0) {
        const segmentResults: any[] = [];
        for (const seg of body.segments) {
          // Clone params and add segment filter conditions
          const segParams = { ...params };
          const segFilterConds = buildGlobalFilterConditions(
            seg.filters,
            segParams,
            `seg_${seg.id.replace(/[^a-zA-Z0-9]/g, '')}`
          );
          const segWhereClause =
            segFilterConds.length > 0
              ? `${whereClause} AND ${segFilterConds.join(' AND ')}`
              : whereClause;

          const segSql = `
            SELECT
              level,
              count() AS cnt
            FROM (
              SELECT
                user_id,
                windowFunnel(${windowSeconds})(toDateTime(timestamp), ${funnelConditions}) AS level
              FROM ${TABLE}
              WHERE ${segWhereClause}
              ${exclusionFilter}
              GROUP BY user_id
            )
            WHERE level > 0
            GROUP BY level
            ORDER BY level ASC
          `;

          const { data: segRows } = (await optic.rawQuery({
            query: segSql,
            params: segParams,
          })) as { data: any[] };

          const segLevelCounts = new Array(totalSteps + 1).fill(0);
          for (const row of segRows) {
            segLevelCounts[Number(row.level)] = Number(row.cnt);
          }
          const segStepCounts = new Array(totalSteps).fill(0);
          for (let step = totalSteps; step >= 1; step--) {
            segStepCounts[step - 1] = segLevelCounts[step];
            if (step < totalSteps) {
              segStepCounts[step - 1] += segStepCounts[step];
            }
          }
          const segFirstCount = segStepCounts[0];
          segmentResults.push({
            id: seg.id,
            name: seg.name,
            color: seg.color,
            steps: eventNames.map((name, i) => ({
              name,
              count: segStepCounts[i],
              conversion_rate:
                segFirstCount > 0
                  ? Math.round((segStepCounts[i] / segFirstCount) * 1000) / 10
                  : 0,
            })),
            overall_conversion:
              segFirstCount > 0
                ? Math.round(
                    (segStepCounts[totalSteps - 1] / segFirstCount) * 1000
                  ) / 10
                : 0,
          });
        }
        baseResult.segments = segmentResults;
      }

      // ── Breakdown: run separate funnel per breakdown value ──
      const funnelBdProps = getBreakdownProperties(body.breakdown);
      if (funnelBdProps.length > 0) {
        try {
          const bdCol = buildBreakdownExpression(funnelBdProps);

          // Get top 10 breakdown values
          const topValuesSql = `
            SELECT ${bdCol} AS bd, count() AS cnt
            FROM ${TABLE}
            WHERE ${whereClause} AND ${bdCol} != ''
            GROUP BY bd
            ORDER BY cnt DESC
            LIMIT 10
          `;
          const { data: topRows } = (await optic.rawQuery({
            query: topValuesSql,
            params,
          })) as { data: any[] };

          const breakdownResults: Record<string, any> = {};

          for (const tvRow of topRows) {
            const bv = String(tvRow.bd);
            const bdParams = { ...params };
            const bdParamKey = `bdVal_${Object.keys(breakdownResults).length}`;
            bdParams[bdParamKey] = bv;

            const bdWhereClause = `${whereClause} AND ${bdCol} = {${bdParamKey}:String}`;

            const bdSql = `
              SELECT
                level,
                count() AS cnt
              FROM (
                SELECT
                  user_id,
                  windowFunnel(${windowSeconds})(toDateTime(timestamp), ${funnelConditions}) AS level
                FROM ${TABLE}
                WHERE ${bdWhereClause}
                ${exclusionFilter}
                GROUP BY user_id
              )
              WHERE level > 0
              GROUP BY level
              ORDER BY level ASC
            `;

            const { data: bdRows } = (await optic.rawQuery({
              query: bdSql,
              params: bdParams,
            })) as { data: any[] };

            const bdLevelCounts = new Array(totalSteps + 1).fill(0);
            for (const row of bdRows) {
              bdLevelCounts[Number(row.level)] = Number(row.cnt);
            }
            const bdStepCounts = new Array(totalSteps).fill(0);
            for (let step = totalSteps; step >= 1; step--) {
              bdStepCounts[step - 1] = bdLevelCounts[step];
              if (step < totalSteps) {
                bdStepCounts[step - 1] += bdStepCounts[step];
              }
            }
            const bdFirstCount = bdStepCounts[0];
            breakdownResults[bv] = {
              steps: eventNames.map((name, i) => ({
                name,
                count: bdStepCounts[i],
                conversion_rate:
                  bdFirstCount > 0
                    ? Math.round((bdStepCounts[i] / bdFirstCount) * 1000) / 10
                    : 0,
              })),
              overall_conversion:
                bdFirstCount > 0
                  ? Math.round(
                      (bdStepCounts[totalSteps - 1] / bdFirstCount) * 1000
                    ) / 10
                  : 0,
            };
          }

          baseResult.breakdowns = breakdownResults;
        } catch (err: any) {
          // Breakdown is supplementary — don't fail the whole request
          baseResult.breakdowns = {};
        }
      }

      if (funnelBdProps.length > 0) {
        baseResult.breakdown_properties = funnelBdProps;
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

      const criteria = body.criteria || 'on';
      const measurement = body.measurement || 'retention_rate';

      // Build dynamic period columns based on measurement type
      // 'on' = user returned exactly on that period
      // 'on_or_after' = user returned on that period or any later period
      const periodSelects: string[] = [];
      const periodOp = criteria === 'on_or_after' ? '>=' : '=';

      if (measurement === 'property_sum' && body.measurement_property) {
        params.measProp = body.measurement_property;
        for (let i = 0; i <= numPeriods; i++) {
          periodSelects.push(`sumIf(prop_value, return_period ${periodOp} ${i}) AS p${i}`);
        }
      } else if (measurement === 'property_avg' && body.measurement_property) {
        params.measProp = body.measurement_property;
        for (let i = 0; i <= numPeriods; i++) {
          periodSelects.push(`avgIf(prop_value, return_period ${periodOp} ${i}) AS p${i}`);
        }
      } else {
        // retention_rate or unique_users — both count distinct users
        for (let i = 0; i <= numPeriods; i++) {
          periodSelects.push(`uniqIf(user_id, return_period ${periodOp} ${i}) AS p${i}`);
        }
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

      // Global filters for retention
      const globalRetentionConds = buildGlobalFilterConditions(
        body.global_filters,
        params,
        'gf_ret'
      );
      const globalRetentionWhere =
        globalRetentionConds.length > 0
          ? `AND ${globalRetentionConds.join(' AND ')}`
          : '';
      // Add property value column for property-based measurements
      const propValueCol = (measurement === 'property_sum' || measurement === 'property_avg')
        ? `,\n            r.numeric_properties[{measProp:String}] AS prop_value`
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
            dateDiff('${dateDiffUnit}', ${truncFunc}(f.first_ts), ${truncFunc}(r.timestamp)) AS return_period${propValueCol}
          FROM (
            SELECT user_id, min(timestamp) AS first_ts
            FROM ${TABLE}
            WHERE event_name = {firstEvent:String}
              AND project_id = {projectId:String}
              AND user_id != ''
              ${firstEventWhere}
              ${globalRetentionWhere}
              AND ${timeConditions.join(' AND ')}
            GROUP BY user_id
          ) f
          INNER JOIN ${TABLE} r
            ON r.user_id = f.user_id
            AND r.event_name = {returnEvent:String}
            AND r.project_id = {projectId:String}
            ${returnEventWhere}
            ${globalRetentionWhere}
            AND r.timestamp >= f.first_ts
            AND ${truncFunc}(r.timestamp) <= ${truncFunc}(f.first_ts) + INTERVAL {numPeriods:UInt32} ${intervalUnit}
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
          const periodValue = Number(row[`p${i}`]) || 0;
          switch (measurement) {
            case 'unique_users':
              // Absolute user count per period
              retention.push(periodValue);
              break;
            case 'property_sum':
            case 'property_avg':
              // Raw numeric value (sum or avg already computed in SQL)
              retention.push(Math.round(periodValue * 100) / 100);
              break;
            default:
              // retention_rate: percentage capped at 100
              retention.push(Math.min(Math.round((periodValue / cohortSize) * 1000) / 10, 100));
          }
        }
        return {
          cohort_date: row.cohort_date,
          cohort_size: Number(row.cohort_size),
          retention,
        };
      });

      // ── Breakdown query: per-breakdown-value cohorts ──
      let breakdowns: Record<string, typeof cohorts> | undefined;
      const retBdProps = getBreakdownProperties(body.breakdown);
      if (retBdProps.length > 0) {
        const bdCol = buildBreakdownExpression(retBdProps);
        const bdSql = `
          SELECT
            bd AS breakdown_value,
            cohort_date,
            count(DISTINCT user_id) AS cohort_size,
            ${periodSelects.join(',\n            ')}
          FROM (
            SELECT
              f.user_id,
              ${bdCol} AS bd,
              ${truncFunc}(f.first_ts) AS cohort_date,
              dateDiff('${dateDiffUnit}', ${truncFunc}(f.first_ts), ${truncFunc}(r.timestamp)) AS return_period${propValueCol}
            FROM (
              SELECT user_id, min(timestamp) AS first_ts
              FROM ${TABLE}
              WHERE event_name = {firstEvent:String}
                AND project_id = {projectId:String}
                AND user_id != ''
                ${firstEventWhere}
                ${globalRetentionWhere}
                AND ${timeConditions.join(' AND ')}
              GROUP BY user_id
            ) f
            INNER JOIN ${TABLE} r
              ON r.user_id = f.user_id
              AND r.event_name = {returnEvent:String}
              AND r.project_id = {projectId:String}
              ${returnEventWhere}
              ${globalRetentionWhere}
              AND r.timestamp >= f.first_ts
              AND ${truncFunc}(r.timestamp) <= ${truncFunc}(f.first_ts) + INTERVAL {numPeriods:UInt32} ${intervalUnit}
          )
          WHERE return_period >= 0 AND return_period <= {numPeriods:UInt32}
          GROUP BY breakdown_value, cohort_date
          ORDER BY breakdown_value, cohort_date ASC
        `;

        const { data: bdRows } = (await optic.rawQuery({
          query: bdSql,
          params,
        })) as {
          data: any[];
        };

        breakdowns = {};
        for (const row of bdRows) {
          const bv = String(row.breakdown_value || '(none)');
          if (!breakdowns[bv]) breakdowns[bv] = [];
          const cohortSize = Number(row.cohort_size) || 1;
          const retention: number[] = [];
          for (let i = 0; i <= numPeriods; i++) {
            const periodValue = Number(row[`p${i}`]) || 0;
            switch (measurement) {
              case 'unique_users':
                retention.push(periodValue);
                break;
              case 'property_sum':
              case 'property_avg':
                retention.push(Math.round(periodValue * 100) / 100);
                break;
              default:
                retention.push(Math.min(Math.round((periodValue / cohortSize) * 1000) / 10, 100));
            }
          }
          breakdowns[bv].push({
            cohort_date: row.cohort_date,
            cohort_size: Number(row.cohort_size),
            retention,
          });
        }
      }

      return reply.send({
        success: true,
        data: {
          cohorts,
          breakdowns,
          ...(retBdProps.length > 0
            ? { breakdown_properties: retBdProps }
            : {}),
        },
      });
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

      // Apply global filters
      const globalFlowsConds = buildGlobalFilterConditions(
        body.global_filters,
        params,
        'gf_flows'
      );
      conditions.push(...globalFlowsConds);

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

      // Compute Top Paths (frequent user journey sequences)
      const topPathsSql = `
        SELECT
          seq,
          count() AS cnt
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
        GROUP BY seq
        ORDER BY cnt DESC
        LIMIT 30
      `;

      let top_paths: { path: string[]; count: number; percentage: number }[] =
        [];
      try {
        const { data: topPathsRows } = (await optic.rawQuery({
          query: topPathsSql,
          params,
        })) as { data: any[] };

        const totalPathsCount =
          topPathsRows.reduce(
            (sum: number, r: any) => sum + Number(r.cnt),
            0
          ) || 1;
        top_paths = topPathsRows.map((r: any) => ({
          path: r.seq || [],
          count: Number(r.cnt),
          percentage: Math.round((Number(r.cnt) / totalPathsCount) * 1000) / 10,
        }));
      } catch (err) {
        // Fallback to empty top paths
        top_paths = [];
      }

      // ── Breakdown: separate flow per breakdown value ──
      let breakdowns:
        | Record<string, { nodes: any[]; links: any[] }>
        | undefined;
      const flowBdProps = getBreakdownProperties(body.breakdown);
      if (flowBdProps.length > 0) {
        try {
          const bdCol = buildBreakdownExpression(flowBdProps);

          // Get top 5 breakdown values
          const topBdSql = `
            SELECT ${bdCol} AS bd, count() AS cnt
            FROM ${TABLE}
            WHERE ${conditions.join(' AND ')} AND ${bdCol} != ''
            GROUP BY bd
            ORDER BY cnt DESC
            LIMIT 5
          `;
          const { data: topBdRows } = (await optic.rawQuery({
            query: topBdSql,
            params,
          })) as { data: any[] };

          breakdowns = {};

          for (const tvRow of topBdRows) {
            const bv = String(tvRow.bd);
            const bdParams = { ...params };
            const bdParamKey = `bdFlowVal_${Object.keys(breakdowns).length}`;
            bdParams[bdParamKey] = bv;

            const bdConditions = [
              ...conditions,
              `${bdCol} = {${bdParamKey}:String}`,
            ];

            const bdSql = `
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
                  WHERE ${bdConditions.join(' AND ')}
                )
                WHERE rn <= {seqLimit:UInt32}
                GROUP BY user_id
                HAVING has(seq, {anchorEvent:String})
                LIMIT 5000
              )
              ARRAY JOIN
                arraySlice(seq, 1, length(seq) - 1) AS source_event,
                arraySlice(seq, 2) AS target_event
              GROUP BY source_event, target_event
              ORDER BY value DESC
              LIMIT 200
            `;

            const { data: bdRows } = (await optic.rawQuery({
              query: bdSql,
              params: bdParams,
            })) as { data: any[] };

            const bdNodeMap = new Map<string, number>();
            const bdLinks: { source: string; target: string; value: number }[] =
              [];
            const bdTotal = bdRows.reduce(
              (s: number, r: any) => s + Number(r.value),
              0
            );
            const bdThreshold = bdTotal * minFrequency;

            for (const row of bdRows) {
              const v = Number(row.value);
              if (v < bdThreshold) continue;
              const src = String(row.source_event);
              const tgt = String(row.target_event);
              bdNodeMap.set(src, (bdNodeMap.get(src) || 0) + v);
              bdNodeMap.set(tgt, (bdNodeMap.get(tgt) || 0) + v);
              bdLinks.push({ source: src, target: tgt, value: v });
            }

            breakdowns[bv] = {
              nodes: Array.from(bdNodeMap.entries()).map(([id, count]) => ({
                id,
                count,
              })),
              links: bdLinks,
            };
          }
        } catch {
          breakdowns = {};
        }
      }

      return reply.send({
        success: true,
        data: {
          nodes,
          links,
          breakdowns,
          top_paths,
          ...(flowBdProps.length > 0
            ? { breakdown_properties: flowBdProps }
            : {}),
        },
      });
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

/** Build a composite breakdown expression from multiple properties */
function buildBreakdownExpression(properties: string[]): string {
  if (properties.length === 0) return "''";
  if (properties.length === 1) return resolveBreakdownColumn(properties[0]);
  return `concat(${properties.map((p) => resolveBreakdownColumn(p)).join(", '|||', ")})`;
}

/** Extract breakdown properties array from request body */
function getBreakdownProperties(breakdown?: {
  properties?: string[];
}): string[] {
  return breakdown?.properties?.filter(Boolean) ?? [];
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

interface GlobalFilterEntry {
  property: string;
  operator: string; // 'is' | 'is_not' | 'contains' | 'not_contains'
  value: string;
}

/**
 * Build SQL conditions from global filters.
 * Global filters apply to built-in columns (platform, country, os, etc.)
 * and custom properties (properties map).
 */
function buildGlobalFilterConditions(
  globalFilters: GlobalFilterEntry[] | undefined,
  params: Record<string, any>,
  prefix: string = 'gf'
): string[] {
  if (!globalFilters || globalFilters.length === 0) return [];

  return globalFilters
    .filter(
      (f) =>
        f.property &&
        (f.value || f.operator === 'set' || f.operator === 'not_set')
    )
    .map((f, i) => {
      const pKey = `${prefix}${i}`;
      params[pKey] = f.value;
      const col = resolveBreakdownColumn(f.property);

      switch (f.operator) {
        case 'is':
          return `${col} = {${pKey}:String}`;
        case 'is_not':
          return `${col} != {${pKey}:String}`;
        case 'contains':
          return `${col} LIKE concat('%', {${pKey}:String}, '%')`;
        case 'not_contains':
          return `${col} NOT LIKE concat('%', {${pKey}:String}, '%')`;
        case 'set':
          return `${col} != ''`;
        case 'not_set':
          return `${col} = ''`;
        default:
          return `${col} = {${pKey}:String}`;
      }
    });
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
  breakdown?: { properties: string[] };
  interval?: '1h' | '1d' | '1w';
  period?: string;
  start?: string;
  end?: string;
  compare_period?:
    | 'previous_period'
    | 'previous_week'
    | 'previous_month'
    | 'previous_year';
  global_filters?: GlobalFilterEntry[];
}

interface FunnelsRequest {
  steps: { event_name: string; conditions?: Condition[] }[];
  conversion_window?: number;
  ordering?: 'specific' | 'any';
  hold_constant?: string[];
  counting?: 'uniques' | 'totals';
  breakdown?: { properties: string[] };
  exclusion_steps?: {
    event_name: string;
    between: [number, number]; // [afterStepIdx, beforeStepIdx] 0-indexed
  }[];
  mode?: 'steps' | 'trending' | 'time_to_convert';
  period?: string;
  start?: string;
  end?: string;
  global_filters?: GlobalFilterEntry[];
  segments?: {
    id: string;
    name: string;
    filters: GlobalFilterEntry[];
    color: string;
  }[];
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
  breakdown?: { properties: string[] };
  min_frequency?: number;
  period?: string;
  start?: string;
  end?: string;
  global_filters?: GlobalFilterEntry[];
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
  breakdown?: { properties: string[] };
  exclude_events?: string[];
  period?: string;
  start?: string;
  end?: string;
  min_frequency?: number;
  global_filters?: GlobalFilterEntry[];
}

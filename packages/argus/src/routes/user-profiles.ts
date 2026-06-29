import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { optic, QueryParser, getDataset, parseSearchToSQL } from '@gatrix/argus-optic';
import type { ASTNode } from '@gatrix/argus-optic';
import db from '../config/knex';
import { buildTimeRangeConditions, getBucketingConfig } from '../utils/timeBucket';
import { buildCohortQuery, CohortDefinition } from './cohorts';

const TABLE = 'argus.activities';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const VALID_SORT_COLUMNS = [
  'last_seen',
  'first_seen',
  'total_events',
  'total_sessions',
  'net_revenue',
  'purchase_count',
  'days_inactive',
] as const;

type SortColumn = (typeof VALID_SORT_COLUMNS)[number];

function parseSortParam(sort: string): { column: SortColumn; dir: 'ASC' | 'DESC' } {
  const raw = sort.replace('-', '');
  const column = (VALID_SORT_COLUMNS as readonly string[]).includes(raw)
    ? (raw as SortColumn)
    : 'last_seen';
  const dir = sort.startsWith('-') ? 'ASC' : 'DESC';
  return { column, dir };
}

function computeChurnRisk(
  daysInactive: number,
  avgGapDays: number
): 'none' | 'low' | 'medium' | 'high' | 'churned' {
  const effectiveGap = Math.max(avgGapDays, 1);
  if (daysInactive >= 60)                                    return 'churned';
  if (daysInactive >= Math.max(effectiveGap * 3, 21))       return 'high';
  if (daysInactive >= Math.max(effectiveGap * 2, 10))       return 'medium';
  if (daysInactive >= Math.max(effectiveGap * 1.5, 3))      return 'low';
  return 'none';
}

const CHURN_RISK_SQL_EXPR = `
  multiIf(
    dateDiff('day', toDateTime(toInt64(max(a.timestamp))), now()) >= 60, 'churned',
    dateDiff('day', toDateTime(toInt64(max(a.timestamp))), now()) >= greatest(greatest(if(uniqExact(a.session_id) > 1, toFloat32(dateDiff('day', min(a.timestamp), max(a.timestamp))) / greatest(toInt32(uniqExact(a.session_id)) - 1, 1), 0), 1) * 3, 21), 'high',
    dateDiff('day', toDateTime(toInt64(max(a.timestamp))), now()) >= greatest(greatest(if(uniqExact(a.session_id) > 1, toFloat32(dateDiff('day', min(a.timestamp), max(a.timestamp))) / greatest(toInt32(uniqExact(a.session_id)) - 1, 1), 0), 1) * 2, 10), 'medium',
    dateDiff('day', toDateTime(toInt64(max(a.timestamp))), now()) >= greatest(greatest(if(uniqExact(a.session_id) > 1, toFloat32(dateDiff('day', min(a.timestamp), max(a.timestamp))) / greatest(toInt32(uniqExact(a.session_id)) - 1, 1), 0), 1) * 1.5, 3), 'low',
    'none'
  )
`;

/** Build ClickHouse IN filter from comma-separated string */
function buildInFilter(
  values: string,
  prefix: string,
  column: string,
  conditions: string[],
  params: Record<string, any>
): void {
  const vals = values.split(',').map((v) => v.trim()).filter(Boolean);
  if (vals.length === 0) return;
  const placeholders = vals.map((_, i) => `{${prefix}${i}:String}`);
  conditions.push(`${column} IN (${placeholders.join(',')})`);
  vals.forEach((v, i) => { params[`${prefix}${i}`] = v; });
}

function hasHavingField(node: ASTNode): boolean {
  if (node.type === 'CONDITION') {
    const key = node.key.toLowerCase();
    const havingKeys = ['net_revenue', 'purchase_count', 'days_inactive', 'total_events', 'total_sessions', 'churn_risk', 'cohort'];
    return havingKeys.includes(key);
  }
  if (node.type === 'AND' || node.type === 'OR') {
    return hasHavingField(node.left) || hasHavingField(node.right);
  }
  if (node.type === 'NOT') {
    return hasHavingField(node.expr);
  }
  return false;
}

function splitAST(node: ASTNode | null): { where: ASTNode | null; having: ASTNode | null } {
  if (!node) return { where: null, having: null };
  if (node.type === 'AND') {
    const left = splitAST(node.left);
    const right = splitAST(node.right);
    const where = left.where && right.where ? { type: 'AND' as const, left: left.where, right: right.where } : (left.where || right.where);
    const having = left.having && right.having ? { type: 'AND' as const, left: left.having, right: right.having } : (left.having || right.having);
    return { where, having };
  }
  if (node.type === 'OR') {
    const isHaving = hasHavingField(node);
    if (isHaving) {
      return { where: null, having: node };
    } else {
      return { where: node, having: null };
    }
  }
  if (node.type === 'NOT') {
    const inner = splitAST(node.expr);
    const where = inner.where ? { type: 'NOT' as const, expr: inner.where } : null;
    const having = inner.having ? { type: 'NOT' as const, expr: inner.having } : null;
    return { where, having };
  }
  if (node.type === 'CONDITION') {
    const key = node.key.toLowerCase();
    const havingKeys = ['net_revenue', 'purchase_count', 'days_inactive', 'total_events', 'total_sessions', 'churn_risk', 'cohort'];
    if (havingKeys.includes(key)) {
      return { where: null, having: node };
    } else {
      return { where: node, having: null };
    }
  }
  if (node.type === 'RAW_SEARCH') {
    return { where: node, having: null };
  }
  return { where: null, having: null };
}

// ─────────────────────────────────────────────────────────────────────────────
// Route Registration
// ─────────────────────────────────────────────────────────────────────────────


export default async function userProfileRoutes(app: FastifyInstance) {

  // ─── GET /projects/:projectId/analytics/users/facets ──────────────────────
  // Returns aggregated facet counts for sidebar (backend ClickHouse-based)
  app.get(
    '/projects/:projectId/analytics/users/facets',
    async (
      request: FastifyRequest<{
        Params: { projectId: string };
        Querystring: { period?: string; start?: string; end?: string };
      }>,
      reply: FastifyReply
    ) => {
      const { projectId } = request.params;
      const { period, start, end } = request.query;

      const baseConditions: string[] = [
        'project_id = {projectId:String}',
        "user_id != ''",
      ];
      const baseParams: Record<string, any> = { projectId };

      if (period || (start && end)) {
        const tr = buildTimeRangeConditions(period || '30d', start, end);
        baseConditions.push(...tr.conditions);
        Object.assign(baseParams, tr.params);
      }
      const whereClause = baseConditions.join(' AND ');

      try {
        const runFacet = async (column: string, limit = 30) => {
          const sql = `
            SELECT ${column} AS value, uniqExact(user_id) AS count
            FROM ${TABLE}
            WHERE ${whereClause} AND ${column} != ''
            GROUP BY ${column}
            ORDER BY count DESC
            LIMIT ${limit}
          `;
          const result = await optic.rawQuery({ query: sql, params: baseParams });
          return ((result.data as any[]) || []).map((r: any) => ({
            value: String(r.value),
            count: Number(r.count),
          }));
        };

        // churn_risk is computed from per-user activity cadence
        const churnSql = `
          SELECT
            user_id,
            dateDiff('day', toDateTime(toInt64(max(timestamp))), now()) AS days_inactive,
            if(
              uniqExact(session_id) > 1,
              toFloat32(dateDiff('day', min(timestamp), max(timestamp)))
                / greatest(toInt32(uniqExact(session_id)) - 1, 1),
              0
            ) AS avg_session_gap_days
          FROM ${TABLE}
          WHERE ${whereClause}
          GROUP BY user_id
        `;
        const churnResult = await optic.rawQuery({ query: churnSql, params: baseParams });
        const churnCounts: Record<string, number> = {
          none: 0, low: 0, medium: 0, high: 0, churned: 0,
        };
        for (const r of (churnResult.data as any[]) || []) {
          const risk = computeChurnRisk(
            Number(r.days_inactive) || 0,
            Number(r.avg_session_gap_days) || 0
          );
          churnCounts[risk]++;
        }
        const churnFacet = Object.entries(churnCounts)
          .filter(([, c]) => c > 0)
          .map(([value, count]) => ({ value, count }))
          .sort((a, b) => b.count - a.count);

        const [platform, country, browser] = await Promise.all([
          runFacet('platform'),
          runFacet('country'),
          runFacet("properties['browser']"),
        ]);

        // Cohort names from MySQL (count is best-effort: 0)
        let cohortFacet: { value: string; count: number }[] = [];
        try {
          const [cohortRows] = await db.raw(
            'SELECT id, name FROM g_argus_cohorts WHERE project_id = ? ORDER BY name LIMIT 30',
            [projectId]
          );
          cohortFacet = (cohortRows as any[]).map((c: any) => ({
            value: c.name,
            count: 0,
          }));
        } catch { /* table may not exist */ }

        return reply.send({
          success: true,
          data: { platform, country, browser, churn_risk: churnFacet, cohort: cohortFacet },
        });
      } catch (err) {
        return reply.send({ success: true, data: {} });
      }
    }
  );

  // ─── GET /projects/:projectId/analytics/users ──────────────────────────────
  // User list — pagination, sorting, AQL search, facet filters
  app.get(
    '/projects/:projectId/analytics/users',
    async (
      request: FastifyRequest<{
        Params: { projectId: string };
        Querystring: {
          limit?: string;
          offset?: string;
          sort?: string;
          search?: string;
          period?: string;
          start?: string;
          end?: string;
          // Facet filter params (comma-separated multi-value)
          platform?: string;
          country?: string;
          churn_risk?: string;
          aql?: string;
        };
      }>,
      reply: FastifyReply
    ) => {
      const { projectId } = request.params;
      const {
        limit: limitStr,
        offset: offsetStr,
        sort = 'last_seen',
        search,
        period,
        start,
        end,
        platform,
        country,
        churn_risk,
        aql,
      } = request.query;

      const limit = Math.min(parseInt(limitStr || '50', 10), 200);
      const offset = parseInt(offsetStr || '0', 10);
      const { column: sortColumn, dir: sortDir } = parseSortParam(sort);

      const conditions: string[] = [
        'a.project_id = {projectId:String}',
        "a.user_id != ''",
      ];
      const params: Record<string, any> = { projectId };

      if (period || (start && end)) {
        const tr = buildTimeRangeConditions(period || '30d', start, end);
        conditions.push(...tr.conditions.map((c) => c.replace(/\btimestamp\b/g, 'a.timestamp')));
        Object.assign(params, tr.params);
      }
      if (search) {
        conditions.push('a.user_id LIKE {search:String}');
        params.search = `%${search}%`;
      }
      if (platform) buildInFilter(platform, 'plt', 'a.platform', conditions, params);
      if (country)  buildInFilter(country,  'cty', 'a.country',  conditions, params);

      // Parse AQL
      let aqlWhere = '';
      let aqlHaving = '';
      if (aql) {
        try {
          const dataset = getDataset('user_profiles');
          const schema = {
            columns: {
              user_id: 'string' as const,
              platform: 'string' as const,
              country: 'string' as const,
              browser: 'string' as const,
              os: 'string' as const,
              app_version: 'string' as const,
              net_revenue: 'number' as const,
              days_inactive: 'number' as const,
              purchase_count: 'number' as const,
              total_events: 'number' as const,
              total_sessions: 'number' as const,
              churn_risk: 'string' as const,
              cohort: 'string' as const,
            },
            mapColumns: [],
            aliases: {
              browser: "properties['browser']",
            },
          };
          const parser = new QueryParser(schema, dataset.aggregates);
          const ast = parser.parse(aql);
          if (ast) {
            const { where: whereAST, having: havingAST } = splitAST(ast);
            const searchParams: Record<string, string> = {};
            if (whereAST) {
              const gen = parser.generateSQL(whereAST, searchParams);
              aqlWhere = gen.where.replace(
                /\b(user_id|platform|country|os|app_version|session_id|device_id|event_name|timestamp|properties|numeric_properties)\b/g,
                'a.$1'
              );
            }
            if (havingAST) {
              const gen = parser.generateSQL(havingAST, searchParams);
              aqlHaving = gen.where;
            }
            Object.assign(params, searchParams);
          }
        } catch (err) {
          // ignore or log
        }
      }

      if (aqlWhere) {
        conditions.push(aqlWhere);
      }

      const whereClause = conditions.join(' AND ');

      // Revenue is computed inline from activities.amount_usd (purchase events)
      const revenueSelect =
        "sumIf(a.amount_usd, a.event_name = 'purchase') AS net_revenue, " +
        "countIf(a.event_name = 'purchase') AS purchase_count";

      // Build HAVING clause
      const havingConditions: string[] = [];
      if (churn_risk) {
        const allowed = churn_risk.split(',').map((v) => v.trim()).filter(Boolean);
        if (allowed.length > 0) {
          const placeholders = allowed.map((_, i) => `{churn_risk_${i}:String}`);
          havingConditions.push(`churn_risk IN (${placeholders.join(',')})`);
          allowed.forEach((v, i) => { params[`churn_risk_${i}`] = v; });
        }
      }
      if (aqlHaving) {
        havingConditions.push(aqlHaving);
      }
      const havingClause = havingConditions.length > 0 ? `HAVING ${havingConditions.join(' AND ')}` : '';

      const orderBy = `${sortColumn} ${sortDir}`;

      try {
        const countSql = `
          SELECT count() AS total
          FROM (
            SELECT a.user_id, ${CHURN_RISK_SQL_EXPR} AS churn_risk, ${revenueSelect}
            FROM ${TABLE} a
            WHERE ${whereClause}
            GROUP BY a.user_id
            ${havingClause}
          )
        `;
        const countResult = await optic.rawQuery({ query: countSql, params });
        let total = Number((countResult.data as any[])?.[0]?.total) || 0;

        const sql = `
          SELECT
            a.user_id                                AS user_id,
            min(a.timestamp)                         AS first_seen,
            max(a.timestamp)                         AS last_seen,
            count()                                  AS total_events,
            uniqExact(a.session_id)                  AS total_sessions,
            anyLast(a.platform)                      AS platform,
            anyLast(a.country)                       AS country,
            anyLast(a.os)                            AS os,
            anyLast(a.app_version)                   AS app_version,
            anyLast(a.properties['browser'])         AS browser,
            dateDiff('day', toDateTime(toInt64(max(a.timestamp))), now()) AS days_inactive,
            if(
              uniqExact(a.session_id) > 1,
              toFloat32(dateDiff('day', min(a.timestamp), max(a.timestamp)))
                / greatest(toInt32(uniqExact(a.session_id)) - 1, 1),
              0
            ) AS avg_session_gap_days,
            ${CHURN_RISK_SQL_EXPR}                   AS churn_risk,
            ${revenueSelect}
          FROM ${TABLE} a
          WHERE ${whereClause}
          GROUP BY a.user_id
          ${havingClause}
          ORDER BY ${orderBy}
          LIMIT ${limit}
          OFFSET ${offset}
        `;
        const result = await optic.rawQuery({ query: sql, params });

        let users = ((result.data as any[]) || []).map((r: any) => {
          const daysInactive = Number(r.days_inactive) || 0;
          const avgGapDays   = Number(r.avg_session_gap_days) || 0;
          return {
            user_id:             r.user_id,
            first_seen:          r.first_seen,
            last_seen:           r.last_seen,
            total_events:        Number(r.total_events) || 0,
            total_sessions:      Number(r.total_sessions) || 0,
            platform:            r.platform || null,
            country:             r.country || null,
            os:                  r.os || null,
            app_version:         r.app_version || null,
            avatar_url:          null as string | null,
            email:               null as string | null,
            browser:             r.browser || null,
            activity_sparkline:  null as number[] | null,
            days_inactive:       daysInactive,
            avg_session_gap_days: avgGapDays,
            churn_risk:          r.churn_risk || 'none',
            net_revenue:         Number(r.net_revenue) || 0,
            purchase_count:      Number(r.purchase_count) || 0,
          };
        });

        // Profile enrichment (avatar, email)
        if (users.length > 0) {
          const profileResult = await optic.rawQuery({
            query: `
              SELECT user_id, avatar_url, email
              FROM argus.profiles FINAL
              WHERE project_id = {projectId:String}
                AND user_id IN (${users.map((_, i) => `{uid${i}:String}`).join(',')})
            `,
            params: {
              projectId: params.projectId,
              ...Object.fromEntries(users.map((u, i) => [`uid${i}`, u.user_id])),
            },
          });
          const profileMap = new Map<string, { avatar_url: string; email: string }>();
          for (const r of (profileResult.data as any[]) || []) {
            profileMap.set(r.user_id, { avatar_url: r.avatar_url || '', email: r.email || '' });
          }
          for (const u of users) {
            const p = profileMap.get(u.user_id);
            if (p) { u.avatar_url = p.avatar_url || null; u.email = p.email || null; }
          }
        }

        // Batch sparkline
        if (users.length > 0) {
          const spParams: Record<string, any> = {
            projectId: params.projectId,
            ...Object.fromEntries(users.map((u, i) => [`sp${i}`, u.user_id])),
          };
          // Time conditions without table alias for sparkline sub-query
          const timeConditions = conditions
            .filter((c) => !c.includes('a.project_id') && !c.includes("a.user_id != ''") && !c.includes('a.user_id LIKE') && !c.includes('a.platform') && !c.includes('a.country'))
            .map((c) => c.replace(/a\./g, ''))
            .join(' AND ');
          const spSql = `
            SELECT user_id, toDate(timestamp) AS day, count() AS cnt
            FROM ${TABLE}
            WHERE project_id = {projectId:String}
              AND user_id IN (${users.map((_, i) => `{sp${i}:String}`).join(',')})
              ${timeConditions ? `AND ${timeConditions}` : ''}
            GROUP BY user_id, day
            ORDER BY user_id, day
          `;
          try {
            const spResult = await optic.rawQuery({ query: spSql, params: spParams });
            const spMap = new Map<string, { day: string; cnt: number }[]>();
            for (const r of (spResult.data as any[]) || []) {
              const uid = r.user_id as string;
              if (!spMap.has(uid)) spMap.set(uid, []);
              spMap.get(uid)!.push({ day: String(r.day), cnt: Number(r.cnt) });
            }
            for (const u of users) {
              const rows = spMap.get(u.user_id);
              if (rows && rows.length > 0) {
                rows.sort((a, b) => a.day.localeCompare(b.day));
                u.activity_sparkline = rows.map((r) => r.cnt);
              } else {
                u.activity_sparkline = [];
              }
            }
          } catch { /* sparkline best-effort */ }
        }

        return reply.send({ success: true, data: users, total });
      } catch (err) {
        console.error('Error fetching user profiles:', err);
        return reply.send({ success: true, data: [], total: 0 });
      }
    }
  );

  // ─── GET /projects/:projectId/analytics/users/:userId ─────────────────────
  app.get(
    '/projects/:projectId/analytics/users/:userId',
    async (
      request: FastifyRequest<{
        Params: { projectId: string; userId: string };
      }>,
      reply: FastifyReply
    ) => {
      const { projectId, userId } = request.params;

      try {
        const sql = `
          SELECT
            user_id,
            min(timestamp)           AS first_seen,
            max(timestamp)           AS last_seen,
            count()                  AS total_events,
            uniqExact(event_name)    AS unique_events,
            uniqExact(session_id)    AS total_sessions,
            anyLast(platform)        AS platform,
            anyLast(country)         AS country,
            anyLast(city)            AS city,
            anyLast(os)              AS os,
            anyLast(app_version)     AS app_version,
            anyLast(device_id)       AS device_id,
            anyLast(properties['browser']) AS browser
          FROM ${TABLE}
          WHERE project_id = {projectId:String}
            AND user_id = {userId:String}
          GROUP BY user_id
        `;
        const result = await optic.rawQuery({ query: sql, params: { projectId, userId } });
        const row = (result.data as any[])?.[0];

        if (!row) {
          return reply.code(404).send({ success: false, message: 'User not found' });
        }

        const profileResult = await optic.rawQuery({
          query: `
            SELECT avatar_url, email, first_name, last_name
            FROM argus.profiles FINAL
            WHERE project_id = {projectId:String} AND user_id = {userId:String}
          `,
          params: { projectId, userId },
        });
        const profileRow = (profileResult.data as any[])?.[0];

        const topEventsResult = await optic.rawQuery({
          query: `
            SELECT event_name, count() AS count
            FROM ${TABLE}
            WHERE project_id = {projectId:String} AND user_id = {userId:String}
            GROUP BY event_name ORDER BY count DESC LIMIT 20
          `,
          params: { projectId, userId },
        });
        const topEvents = ((topEventsResult.data as any[]) || []).map((r: any) => ({
          event_name: r.event_name,
          count: Number(r.count) || 0,
        }));

        return reply.send({
          success: true,
          data: {
            user_id:       row.user_id,
            first_seen:    row.first_seen,
            last_seen:     row.last_seen,
            total_events:  Number(row.total_events) || 0,
            unique_events: Number(row.unique_events) || 0,
            total_sessions: Number(row.total_sessions) || 0,
            platform:      row.platform || null,
            country:       row.country || null,
            city:          row.city || null,
            os:            row.os || null,
            app_version:   row.app_version || null,
            device_id:     row.device_id || null,
            avatar_url:    profileRow?.avatar_url || null,
            email:         profileRow?.email || null,
            first_name:    profileRow?.first_name || null,
            last_name:     profileRow?.last_name || null,
            browser:       row.browser || null,
            top_events:    topEvents,
          },
        });
      } catch (err) {
        return reply.code(500).send({ success: false, message: 'Failed to fetch user profile' });
      }
    }
  );

  // ─── GET /projects/:projectId/analytics/users/:userId/events ──────────────
  app.get(
    '/projects/:projectId/analytics/users/:userId/events',
    async (
      request: FastifyRequest<{
        Params: { projectId: string; userId: string };
        Querystring: { limit?: string; offset?: string; period?: string; start?: string; end?: string; search?: string };
      }>,
      reply: FastifyReply
    ) => {
      const { projectId, userId } = request.params;
      const { limit: limitStr, offset: offsetStr, period, start, end, search } = request.query;

      const limit = Math.min(parseInt(limitStr || '50', 10), 200);
      const offset = parseInt(offsetStr || '0', 10);

      const conditions: string[] = [
        'project_id = {projectId:String}',
        'user_id = {userId:String}',
      ];
      const params: Record<string, any> = { projectId, userId };

      if (period || (start && end)) {
        const tr = buildTimeRangeConditions(period || '30d', start, end);
        conditions.push(...tr.conditions);
        Object.assign(params, tr.params);
      }

      // AQL search filter
      if (search) {
        const { where: searchCond } = parseSearchToSQL('activities', search, params);
        if (searchCond) conditions.push(`(${searchCond})`);
      }

      const whereClause = conditions.join(' AND ');

      try {
        const sql = `
          SELECT event_id, event_name, timestamp, session_id,
                 platform, country, os, properties, numeric_properties
          FROM ${TABLE}
          WHERE ${whereClause}
          ORDER BY timestamp DESC
          LIMIT ${limit} OFFSET ${offset}
        `;
        const result = await optic.rawQuery({ query: sql, params });
        const events = ((result.data as any[]) || []).map((r: any) => ({
          event_id:           r.event_id,
          event_name:         r.event_name,
          timestamp:          r.timestamp,
          session_id:         r.session_id,
          platform:           r.platform || null,
          country:            r.country || null,
          os:                 r.os || null,
          properties:         r.properties || {},
          numeric_properties: r.numeric_properties || {},
        }));

        const countResult = await optic.rawQuery({
          query: `SELECT count() AS total FROM ${TABLE} WHERE ${whereClause}`,
          params,
        });
        const total = Number((countResult.data as any[])?.[0]?.total) || events.length;

        return reply.send({ success: true, data: events, total, hasMore: offset + limit < total });
      } catch {
        return reply.send({ success: true, data: [], total: 0, hasMore: false });
      }
    }
  );

  // ─── GET /projects/:projectId/analytics/users/:userId/events/volume ────────
  app.get(
    '/projects/:projectId/analytics/users/:userId/events/volume',
    async (
      request: FastifyRequest<{
        Params: { projectId: string; userId: string };
        Querystring: { period?: string; start?: string; end?: string; search?: string };
      }>,
      reply: FastifyReply
    ) => {
      const { projectId, userId } = request.params;
      const { period, start, end, search } = request.query;

      const conditions: string[] = [
        'project_id = {projectId:String}',
        'user_id = {userId:String}',
      ];
      const params: Record<string, any> = { projectId, userId };

      if (period || (start && end)) {
        const tr = buildTimeRangeConditions(period || '30d', start, end);
        conditions.push(...tr.conditions);
        Object.assign(params, tr.params);
      }

      if (search) {
        const { where: searchCond } = parseSearchToSQL('activities', search, params);
        if (searchCond) conditions.push(`(${searchCond})`);
      }

      const whereClause = conditions.join(' AND ');
      const bucket = getBucketingConfig(period || '30d', start, end);
      Object.assign(params, bucket.queryParams);

      try {
        const sql = `
          SELECT ${bucket.selectExpr} AS bucket, count() AS cnt
          FROM ${TABLE}
          WHERE ${whereClause}
          GROUP BY bucket
          ORDER BY bucket ASC ${bucket.fillExpr}
        `;
        const result = await optic.rawQuery({ query: sql, params });
        const rows = (result.data as any[]) || [];
        const buckets = rows.map((r: any) => r.bucket);
        const counts = rows.map((r: any) => Number(r.cnt) || 0);

        return reply.send({ success: true, data: { buckets, counts } });
      } catch {
        return reply.send({ success: true, data: { buckets: [], counts: [] } });
      }
    }
  );

  // ─── GET /projects/:projectId/analytics/users/:userId/sessions ────────────
  app.get(
    '/projects/:projectId/analytics/users/:userId/sessions',
    async (
      request: FastifyRequest<{
        Params: { projectId: string; userId: string };
        Querystring: { limit?: string; offset?: string };
      }>,
      reply: FastifyReply
    ) => {
      const { projectId, userId } = request.params;
      const limit = Math.min(parseInt(request.query.limit || '20', 10), 100);
      const offset = parseInt(request.query.offset || '0', 10);

      try {
        const baseWhere = `project_id = {projectId:String} AND user_id = {userId:String} AND session_id != ''`;
        const baseParams = { projectId, userId };

        const [result, countResult] = await Promise.all([
          optic.rawQuery({
            query: `
              SELECT
                session_id,
                min(timestamp)        AS start_time,
                max(timestamp)        AS end_time,
                count()               AS event_count,
                uniqExact(event_name) AS unique_events,
                anyLast(platform)     AS platform,
                anyLast(country)      AS country,
                anyLast(os)           AS os,
                anyLast(properties['browser']) AS browser,
                dateDiff('second', min(timestamp), max(timestamp)) AS duration_seconds
              FROM ${TABLE}
              WHERE ${baseWhere}
              GROUP BY session_id
              ORDER BY start_time DESC
              LIMIT ${limit} OFFSET ${offset}
            `,
            params: baseParams,
          }),
          optic.rawQuery({
            query: `SELECT uniqExact(session_id) AS total FROM ${TABLE} WHERE ${baseWhere}`,
            params: baseParams,
          }),
        ]);

        const sessions = ((result.data as any[]) || []).map((r: any) => ({
          session_id:      r.session_id,
          start_time:      r.start_time,
          end_time:        r.end_time,
          event_count:     Number(r.event_count) || 0,
          unique_events:   Number(r.unique_events) || 0,
          platform:        r.platform || null,
          country:         r.country || null,
          os:              r.os || null,
          browser:         r.browser || null,
          duration_seconds: Number(r.duration_seconds) || 0,
        }));

        const total = Number((countResult.data as any[])?.[0]?.total) || sessions.length;

        return reply.send({ success: true, data: sessions, total });
      } catch {
        return reply.send({ success: true, data: [], total: 0 });
      }
    }
  );

  // ─── GET /projects/:projectId/analytics/users/:userId/properties ──────────
  app.get(
    '/projects/:projectId/analytics/users/:userId/properties',
    async (
      request: FastifyRequest<{
        Params: { projectId: string; userId: string };
      }>,
      reply: FastifyReply
    ) => {
      const { projectId, userId } = request.params;

      try {
        const sql = `
          SELECT properties, numeric_properties
          FROM ${TABLE}
          WHERE project_id = {projectId:String} AND user_id = {userId:String}
          ORDER BY timestamp DESC LIMIT 1
        `;
        const result = await optic.rawQuery({ query: sql, params: { projectId, userId } });
        const row = (result.data as any[])?.[0];

        const allProperties: { key: string; value: string; type: string }[] = [];
        for (const [k, v] of Object.entries(row?.properties || {})) {
          allProperties.push({ key: k, value: String(v), type: 'string' });
        }
        for (const [k, v] of Object.entries(row?.numeric_properties || {})) {
          allProperties.push({ key: k, value: String(v), type: 'number' });
        }

        return reply.send({ success: true, data: allProperties });
      } catch {
        return reply.send({ success: true, data: [] });
      }
    }
  );

  // ─── POST /projects/:projectId/analytics/users/cohort-memberships ──────────
  app.post(
    '/projects/:projectId/analytics/users/cohort-memberships',
    async (
      request: FastifyRequest<{
        Params: { projectId: string };
        Body: { userIds: string[] };
      }>,
      reply: FastifyReply
    ) => {
      const { projectId } = request.params;
      const { userIds } = request.body || {};

      if (!userIds || userIds.length === 0) {
        return reply.send({ success: true, data: {} });
      }

      try {
        let cohortRows: any[] = [];
        try {
          const [rows] = await db.raw(
            'SELECT id, name, description, definition FROM g_argus_cohorts WHERE project_id = ?',
            [projectId]
          );
          cohortRows = rows as any[];
        } catch (err: any) {
          if (err?.code === 'ER_NO_SUCH_TABLE') {
            return reply.send({ success: true, data: {} });
          }
          throw err;
        }

        if (cohortRows.length === 0) {
          return reply.send({ success: true, data: {} });
        }

        const memberships: Record<
          string,
          { id: number; name: string; description: string | null }[]
        > = {};

        for (const cohort of cohortRows) {
          const definition: CohortDefinition =
            typeof cohort.definition === 'string'
              ? JSON.parse(cohort.definition)
              : cohort.definition;

          if (!definition.rules || definition.rules.length === 0) continue;

          const { sql, params } = buildCohortQuery(definition, projectId);
          const wrappedSql = `
            SELECT user_id FROM (${sql}) AS cohort_users
            WHERE user_id IN ({filterUserIds:Array(String)})
          `;
          const result = await optic.rawQuery({
            query: wrappedSql,
            params: { ...params, filterUserIds: userIds },
          });

          for (const r of (result.data as any[]) || []) {
            const uid: string = r.user_id;
            if (!memberships[uid]) memberships[uid] = [];
            memberships[uid].push({
              id: cohort.id,
              name: cohort.name,
              description: cohort.description || null,
            });
          }
        }

        return reply.send({ success: true, data: memberships });
      } catch {
        return reply.send({ success: true, data: {} });
      }
    }
  );
}



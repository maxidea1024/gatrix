import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { optic } from '@gatrix/argus-optic';
import db from '../config/knex';
import {
  buildTimeRangeConditions,
} from '../utils/timeBucket';
import { buildCohortQuery, CohortDefinition } from './cohorts';

const TABLE = 'argus.activities';

// ─────────────────────────────────────────────────────────────────────────────
// Route Registration
// ─────────────────────────────────────────────────────────────────────────────

export default async function userProfileRoutes(app: FastifyInstance) {
  // ─── GET /projects/:projectId/analytics/users ──────────────────────────────
  // User list with pagination, sorting, and search
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
      } = request.query;

      const limit = Math.min(parseInt(limitStr || '50', 10), 200);
      const offset = parseInt(offsetStr || '0', 10);

      const sortColumn =
        ['last_seen', 'first_seen', 'total_events', 'total_sessions'].includes(
          sort.replace('-', '')
        )
          ? sort.replace('-', '')
          : 'last_seen';
      const sortDir = sort.startsWith('-') ? 'ASC' : 'DESC';

      const conditions: string[] = ['project_id = {projectId:String}'];
      const params: Record<string, any> = { projectId };

      // Optional time-range filter
      if (period || (start && end)) {
        const tr = buildTimeRangeConditions(period || '30d', start, end);
        conditions.push(...tr.conditions);
        Object.assign(params, tr.params);
      }

      // Search by user_id prefix
      if (search) {
        conditions.push("user_id LIKE {search:String}");
        params.search = `%${search}%`;
      }

      const whereClause = conditions.join(' AND ');

      try {
        // Count
        const countSql = `
          SELECT uniqExact(user_id) AS total
          FROM ${TABLE}
          WHERE ${whereClause}
            AND user_id != ''
        `;
        const countResult = await optic.rawQuery({ query: countSql, params });
        const total = Number((countResult.data as any[])?.[0]?.total) || 0;

        // User list — aggregate from activities (no profile fields here)
        const sql = `
          SELECT
            user_id,
            min(timestamp)           AS first_seen,
            max(timestamp)           AS last_seen,
            count()                  AS total_events,
            uniqExact(session_id)    AS total_sessions,
            anyLast(platform)        AS platform,
            anyLast(country)         AS country,
            anyLast(os)              AS os,
            anyLast(app_version)     AS app_version,
            anyLast(properties['browser']) AS browser
          FROM ${TABLE}
          WHERE ${whereClause}
            AND user_id != ''
          GROUP BY user_id
          ORDER BY ${sortColumn} ${sortDir}
          LIMIT ${limit}
          OFFSET ${offset}
        `;
        const result = await optic.rawQuery({ query: sql, params });
        const users = ((result.data as any[]) || []).map((r: any) => ({
          user_id: r.user_id,
          first_seen: r.first_seen,
          last_seen: r.last_seen,
          total_events: Number(r.total_events) || 0,
          total_sessions: Number(r.total_sessions) || 0,
          platform: r.platform || null,
          country: r.country || null,
          os: r.os || null,
          app_version: r.app_version || null,
          avatar_url: null as string | null,
          email: null as string | null,
          browser: r.browser || null,
        }));

        // Enrich with profile data from argus.profiles (efficient lookup)
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
            const profile = profileMap.get(u.user_id);
            if (profile) {
              u.avatar_url = profile.avatar_url || null;
              u.email = profile.email || null;
            }
          }
        }

        return reply.send({ success: true, data: users, total });
      } catch (err) {
        return reply.send({ success: true, data: [], total: 0 });
      }
    }
  );

  // ─── GET /projects/:projectId/analytics/users/:userId ─────────────────────
  // Single user profile summary
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

        const result = await optic.rawQuery({
          query: sql,
          params: { projectId, userId },
        });
        const row = (result.data as any[])?.[0];

        if (!row) {
          return reply.code(404).send({
            success: false,
            message: 'User not found',
          });
        }

        // Fetch profile data from argus.profiles
        const profileResult = await optic.rawQuery({
          query: `
            SELECT avatar_url, email, first_name, last_name
            FROM argus.profiles FINAL
            WHERE project_id = {projectId:String}
              AND user_id = {userId:String}
          `,
          params: { projectId, userId },
        });
        const profileRow = (profileResult.data as any[])?.[0];

        // Top events for this user
        const topEventsSql = `
          SELECT event_name, count() AS count
          FROM ${TABLE}
          WHERE project_id = {projectId:String}
            AND user_id = {userId:String}
          GROUP BY event_name
          ORDER BY count DESC
          LIMIT 20
        `;
        const topEventsResult = await optic.rawQuery({
          query: topEventsSql,
          params: { projectId, userId },
        });
        const topEvents = ((topEventsResult.data as any[]) || []).map(
          (r: any) => ({
            event_name: r.event_name,
            count: Number(r.count) || 0,
          })
        );

        return reply.send({
          success: true,
          data: {
            user_id: row.user_id,
            first_seen: row.first_seen,
            last_seen: row.last_seen,
            total_events: Number(row.total_events) || 0,
            unique_events: Number(row.unique_events) || 0,
            total_sessions: Number(row.total_sessions) || 0,
            platform: row.platform || null,
            country: row.country || null,
            city: row.city || null,
            os: row.os || null,
            app_version: row.app_version || null,
            device_id: row.device_id || null,
            avatar_url: profileRow?.avatar_url || null,
            email: profileRow?.email || null,
            first_name: profileRow?.first_name || null,
            last_name: profileRow?.last_name || null,
            browser: row.browser || null,
            top_events: topEvents,
          },
        });
      } catch (err) {
        return reply.code(500).send({
          success: false,
          message: 'Failed to fetch user profile',
        });
      }
    }
  );

  // ─── GET /projects/:projectId/analytics/users/:userId/events ──────────────
  // User event history (timeline)
  app.get(
    '/projects/:projectId/analytics/users/:userId/events',
    async (
      request: FastifyRequest<{
        Params: { projectId: string; userId: string };
        Querystring: {
          limit?: string;
          offset?: string;
          period?: string;
          start?: string;
          end?: string;
        };
      }>,
      reply: FastifyReply
    ) => {
      const { projectId, userId } = request.params;
      const { limit: limitStr, offset: offsetStr, period, start, end } =
        request.query;

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

      const whereClause = conditions.join(' AND ');

      try {
        const sql = `
          SELECT
            event_id,
            event_name,
            timestamp,
            session_id,
            platform,
            country,
            os,
            properties,
            numeric_properties
          FROM ${TABLE}
          WHERE ${whereClause}
          ORDER BY timestamp DESC
          LIMIT ${limit}
          OFFSET ${offset}
        `;
        const result = await optic.rawQuery({ query: sql, params });
        const events = ((result.data as any[]) || []).map((r: any) => ({
          event_id: r.event_id,
          event_name: r.event_name,
          timestamp: r.timestamp,
          session_id: r.session_id,
          platform: r.platform || null,
          country: r.country || null,
          os: r.os || null,
          properties: r.properties || {},
          numeric_properties: r.numeric_properties || {},
        }));

        // Total count for pagination
        const countSql = `
          SELECT count() AS total
          FROM ${TABLE}
          WHERE ${whereClause}
        `;
        const countResult = await optic.rawQuery({ query: countSql, params });
        const total =
          Number((countResult.data as any[])?.[0]?.total) || events.length;

        return reply.send({
          success: true,
          data: events,
          total,
          hasMore: offset + limit < total,
        });
      } catch (err) {
        return reply.send({
          success: true,
          data: [],
          total: 0,
          hasMore: false,
        });
      }
    }
  );

  // ─── GET /projects/:projectId/analytics/users/:userId/sessions ────────────
  // User session list
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
      const limit = Math.min(
        parseInt(request.query.limit || '20', 10),
        100
      );
      const offset = parseInt(request.query.offset || '0', 10);

      try {
        const sql = `
          SELECT
            session_id,
            min(timestamp)       AS start_time,
            max(timestamp)       AS end_time,
            count()              AS event_count,
            uniqExact(event_name) AS unique_events,
            anyLast(platform)    AS platform,
            anyLast(country)     AS country,
            anyLast(os)          AS os,
            anyLast(properties['browser']) AS browser,
            dateDiff('second', min(timestamp), max(timestamp)) AS duration_seconds
          FROM ${TABLE}
          WHERE project_id = {projectId:String}
            AND user_id = {userId:String}
            AND session_id != ''
          GROUP BY session_id
          ORDER BY start_time DESC
          LIMIT ${limit}
          OFFSET ${offset}
        `;
        const result = await optic.rawQuery({
          query: sql,
          params: { projectId, userId },
        });
        const sessions = ((result.data as any[]) || []).map((r: any) => ({
          session_id: r.session_id,
          start_time: r.start_time,
          end_time: r.end_time,
          event_count: Number(r.event_count) || 0,
          unique_events: Number(r.unique_events) || 0,
          platform: r.platform || null,
          country: r.country || null,
          os: r.os || null,
          browser: r.browser || null,
          duration_seconds: Number(r.duration_seconds) || 0,
        }));

        return reply.send({ success: true, data: sessions });
      } catch (err) {
        return reply.send({ success: true, data: [] });
      }
    }
  );

  // ─── GET /projects/:projectId/analytics/users/:userId/properties ──────────
  // User property aggregation (from Map columns)
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
        // Get latest properties Map for this user
        const sql = `
          SELECT
            properties,
            numeric_properties
          FROM ${TABLE}
          WHERE project_id = {projectId:String}
            AND user_id = {userId:String}
          ORDER BY timestamp DESC
          LIMIT 1
        `;
        const result = await optic.rawQuery({
          query: sql,
          params: { projectId, userId },
        });
        const row = (result.data as any[])?.[0];

        // Merge string and numeric properties
        const stringProps = row?.properties || {};
        const numericProps = row?.numeric_properties || {};

        const allProperties: { key: string; value: string; type: string }[] =
          [];
        for (const [k, v] of Object.entries(stringProps)) {
          allProperties.push({ key: k, value: String(v), type: 'string' });
        }
        for (const [k, v] of Object.entries(numericProps)) {
          allProperties.push({ key: k, value: String(v), type: 'number' });
        }

        return reply.send({ success: true, data: allProperties });
      } catch (err) {
        return reply.send({ success: true, data: [] });
      }
    }
  );

  // ─── POST /projects/:projectId/analytics/users/cohort-memberships ──────────
  // Given a list of user IDs, return which cohorts each user belongs to
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
        // 1. Get all cohorts for this project from MySQL
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

        // 2. For each cohort, run query filtered to the given userIds
        const memberships: Record<string, { id: number; name: string; description: string | null }[]> = {};

        for (const cohort of cohortRows) {
          const definition: CohortDefinition =
            typeof cohort.definition === 'string'
              ? JSON.parse(cohort.definition)
              : cohort.definition;

          if (!definition.rules || definition.rules.length === 0) continue;

          const { sql, params } = buildCohortQuery(definition, projectId);
          // Wrap cohort query to filter only the requested userIds
          const wrappedSql = `
            SELECT user_id FROM (
              ${sql}
            ) AS cohort_users
            WHERE user_id IN ({filterUserIds:Array(String)})
          `;
          const result = await optic.rawQuery({
            query: wrappedSql,
            params: { ...params, filterUserIds: userIds },
          });

          const matchedUsers = ((result.data as any[]) || []).map((r: any) => r.user_id);
          for (const uid of matchedUsers) {
            if (!memberships[uid]) memberships[uid] = [];
            memberships[uid].push({ id: cohort.id, name: cohort.name, description: cohort.description || null });
          }
        }

        return reply.send({ success: true, data: memberships });
      } catch (err) {
        return reply.send({ success: true, data: {} });
      }
    }
  );
}

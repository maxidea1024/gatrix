import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { optic } from '@gatrix/argus-optic';
import { createLogger } from '../utils/logger';

const TABLE = 'argus.activities';
const logger = createLogger('realtime-api');

// ─────────────────────────────────────────────────────────────────────────────
// Route Registration
// ─────────────────────────────────────────────────────────────────────────────

export default async function realtimeRoutes(app: FastifyInstance) {
  // ─── GET /projects/:projectId/analytics/realtime ───────────────────────
  // Snapshot of the last 30 minutes (polled by frontend every 5s)
  app.get(
    '/projects/:projectId/analytics/realtime',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId } = request.params as { projectId: string };

      try {
        const params = { projectId };

        // 1) Active users (last 30 min)
        const activeUsersSql = `
          SELECT uniqExact(user_id) AS active_users
          FROM ${TABLE}
          WHERE project_id = {projectId:String}
            AND timestamp >= now() - INTERVAL 30 MINUTE
            AND user_id != ''
        `;
        const activeResult = await optic.rawQuery({
          query: activeUsersSql,
          params,
        });
        const activeUsers =
          Number((activeResult.data as any[])?.[0]?.active_users) || 0;

        // 2) Events per minute (last 30 minutes, 1-min buckets)
        const epmSql = `
          SELECT
            toStartOfMinute(timestamp) AS minute,
            count() AS count
          FROM ${TABLE}
          WHERE project_id = {projectId:String}
            AND timestamp >= now() - INTERVAL 30 MINUTE
          GROUP BY minute
          ORDER BY minute ASC
          WITH FILL
            FROM toStartOfMinute(now() - INTERVAL 30 MINUTE)
            TO toStartOfMinute(now()) + INTERVAL 1 MINUTE
            STEP INTERVAL 1 MINUTE
        `;
        const epmResult = await optic.rawQuery({ query: epmSql, params });
        const eventsPerMinute = ((epmResult.data as any[]) || []).map(
          (r: any) => ({
            minute: r.minute,
            count: Number(r.count) || 0,
          })
        );

        // 3) Top events (last 30 min)
        const topEventsSql = `
          SELECT event_name, count() AS count
          FROM ${TABLE}
          WHERE project_id = {projectId:String}
            AND timestamp >= now() - INTERVAL 30 MINUTE
          GROUP BY event_name
          ORDER BY count DESC
          LIMIT 10
        `;
        const topEventsResult = await optic.rawQuery({
          query: topEventsSql,
          params,
        });
        const topEvents = ((topEventsResult.data as any[]) || []).map(
          (r: any) => ({
            name: r.event_name,
            count: Number(r.count) || 0,
          })
        );

        // 4) Top countries (last 30 min)
        const topCountriesSql = `
          SELECT country, count() AS count
          FROM ${TABLE}
          WHERE project_id = {projectId:String}
            AND timestamp >= now() - INTERVAL 30 MINUTE
            AND country != ''
          GROUP BY country
          ORDER BY count DESC
          LIMIT 10
        `;
        const topCountriesResult = await optic.rawQuery({
          query: topCountriesSql,
          params,
        });
        const topCountries = ((topCountriesResult.data as any[]) || []).map(
          (r: any) => ({
            country: r.country,
            count: Number(r.count) || 0,
          })
        );

        // 5) Recent events (last 50)
        const recentSql = `
          SELECT
            event_name, user_id, timestamp, country, platform, session_id
          FROM ${TABLE}
          WHERE project_id = {projectId:String}
            AND timestamp >= now() - INTERVAL 30 MINUTE
          ORDER BY timestamp DESC
          LIMIT 50
        `;
        const recentResult = await optic.rawQuery({
          query: recentSql,
          params,
        });
        const recentEvents = ((recentResult.data as any[]) || []).map(
          (r: any) => ({
            event_name: r.event_name,
            user_id: r.user_id || null,
            timestamp: r.timestamp,
            country: r.country || null,
            platform: r.platform || null,
          })
        );

        // 6) Total events in window
        const totalEvents = eventsPerMinute.reduce(
          (sum, e) => sum + e.count,
          0
        );

        return reply.send({
          success: true,
          data: {
            active_users: activeUsers,
            total_events: totalEvents,
            events_per_minute: eventsPerMinute,
            top_events: topEvents,
            top_countries: topCountries,
            recent_events: recentEvents,
          },
        });
      } catch (err) {
        logger.error('Realtime query failed', {
          error: err instanceof Error ? err.message : String(err),
        });
        return reply.send({
          success: true,
          data: {
            active_users: 0,
            total_events: 0,
            events_per_minute: [],
            top_events: [],
            top_countries: [],
            recent_events: [],
          },
        });
      }
    }
  );
}

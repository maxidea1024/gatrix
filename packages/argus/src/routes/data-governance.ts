import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { optic } from '@gatrix/argus-optic';
import { createLogger } from '../utils/logger';

const ACTIVITIES_TABLE = 'argus.activities';
const logger = createLogger('data-governance-api');

export default async function dataGovernanceRoutes(app: FastifyInstance) {
  // ─── GET /projects/:projectId/analytics/data-governance ─────────────────
  // Returns data quality overview
  app.get(
    '/projects/:projectId/analytics/data-governance',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId } = request.params as { projectId: string };

      try {
        const params = { projectId };

        // 1) All events with volume + first/last seen
        const eventsSql = `
          SELECT
            event_name,
            count() AS total_count,
            uniqExact(user_id) AS unique_users,
            min(timestamp) AS first_seen,
            max(timestamp) AS last_seen,
            count(DISTINCT toDate(timestamp)) AS active_days
          FROM ${ACTIVITIES_TABLE}
          WHERE project_id = {projectId:String}
            AND timestamp >= now() - INTERVAL 30 DAY
          GROUP BY event_name
          ORDER BY total_count DESC
        `;
        const eventsResult = await optic.rawQuery({
          query: eventsSql,
          params,
        });
        const events = ((eventsResult.data as any[]) || []).map((r: any) => ({
          name: r.event_name,
          total_count: Number(r.total_count) || 0,
          unique_users: Number(r.unique_users) || 0,
          first_seen: r.first_seen,
          last_seen: r.last_seen,
          active_days: Number(r.active_days) || 0,
        }));

        // 2) Event volume per day (last 7 days, per event, top 10)
        const volumeSql = `
          SELECT
            event_name,
            toDate(timestamp) AS day,
            count() AS count
          FROM ${ACTIVITIES_TABLE}
          WHERE project_id = {projectId:String}
            AND timestamp >= now() - INTERVAL 7 DAY
            AND event_name IN (
              SELECT event_name
              FROM ${ACTIVITIES_TABLE}
              WHERE project_id = {projectId:String}
                AND timestamp >= now() - INTERVAL 7 DAY
              GROUP BY event_name
              ORDER BY count() DESC
              LIMIT 10
            )
          GROUP BY event_name, day
          ORDER BY event_name, day ASC
        `;
        const volumeResult = await optic.rawQuery({
          query: volumeSql,
          params,
        });
        // Group by event_name
        const volumeByEvent: Record<string, { day: string; count: number }[]> =
          {};
        for (const r of (volumeResult.data as any[]) || []) {
          const name = r.event_name;
          if (!volumeByEvent[name]) volumeByEvent[name] = [];
          volumeByEvent[name].push({
            day: r.day,
            count: Number(r.count) || 0,
          });
        }

        // 3) Properties per event (sample top 5 events)
        const topEventNames = events.slice(0, 5).map((e) => e.name);
        const propertyCoverage: Record<
          string,
          { property: string; coverage: number }[]
        > = {};

        for (const evtName of topEventNames) {
          const propSql = `
            SELECT
              key,
              count() AS filled,
              (SELECT count() FROM ${ACTIVITIES_TABLE}
               WHERE project_id = {projectId:String}
                 AND event_name = {evtName:String}
                 AND timestamp >= now() - INTERVAL 7 DAY) AS total
            FROM ${ACTIVITIES_TABLE}
            ARRAY JOIN mapKeys(string_properties) AS key
            WHERE project_id = {projectId:String}
              AND event_name = {evtName:String}
              AND timestamp >= now() - INTERVAL 7 DAY
            GROUP BY key
            ORDER BY filled DESC
            LIMIT 10
          `;
          const propResult = await optic.rawQuery({
            query: propSql,
            params: { ...params, evtName },
          });
          propertyCoverage[evtName] = ((propResult.data as any[]) || []).map(
            (r: any) => ({
              property: r.key,
              coverage:
                Number(r.total) > 0
                  ? Math.round((Number(r.filled) / Number(r.total)) * 10000) /
                    100
                  : 0,
            })
          );
        }

        // 4) Duplicate event detection (Levenshtein-like: similar prefixes)
        const duplicates: { group: string[]; suggestion: string }[] = [];
        const sortedNames = events.map((e) => e.name).sort();
        for (let i = 0; i < sortedNames.length - 1; i++) {
          const a = sortedNames[i];
          const b = sortedNames[i + 1];
          // Simple heuristic: shared prefix >= 60% of shorter name
          const minLen = Math.min(a.length, b.length);
          let shared = 0;
          for (let j = 0; j < minLen; j++) {
            if (a[j] === b[j]) shared++;
            else break;
          }
          if (shared >= minLen * 0.6 && shared >= 3 && a !== b) {
            duplicates.push({
              group: [a, b],
              suggestion: `Consider merging "${a}" and "${b}"`,
            });
          }
        }

        // 5) Quality score
        const totalEvents = events.length;
        // Estimate: events with > 0 active_days in last 7
        const activeEvents = events.filter((e) => e.active_days >= 3).length;
        const qualityScore =
          totalEvents > 0 ? Math.round((activeEvents / totalEvents) * 100) : 0;

        return reply.send({
          success: true,
          data: {
            events,
            volume_trends: volumeByEvent,
            property_coverage: propertyCoverage,
            duplicates,
            quality_score: qualityScore,
            total_events: totalEvents,
            active_events: activeEvents,
          },
        });
      } catch (err) {
        logger.error('Data governance query failed', {
          error: err instanceof Error ? err.message : String(err),
        });
        return reply.code(500).send({ error: 'Data governance query failed' });
      }
    }
  );
}

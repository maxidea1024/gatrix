import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { mysqlPool } from '../config/mysql';
import { clickhouse } from '../config/clickhouse';
import { createLogger } from '../utils/logger';

const logger = createLogger('issues-api');

export default async function issuesRoutes(app: FastifyInstance) {
  // List issues for a project
  app.get(
    '/:projectId/issues',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId } = request.params as { projectId: string };
      const {
        status = 'unresolved',
        sort = 'last_seen',
        limit = '25',
        offset = '0',
        query,
        environment,
        browser,
        os,
        period,
        start,
        end,
      } = request.query as Record<string, string>;

      try {
        // Resolve issue_ids from ClickHouse when contextual or time filters are set
        let issueIdFilter: number[] | null = null;
        const hasContextFilter = !!(environment || browser || os);
        const hasTimeFilter = !!((start && end) || period);

        if (hasContextFilter || hasTimeFilter) {
          const conditions: string[] = [`project_id = {projectId:String}`];
          const qp: Record<string, string> = { projectId: String(projectId) };

          if (environment) {
            conditions.push(`environment = {env:String}`);
            qp.env = environment;
          }
          if (browser) {
            conditions.push(`browser_name = {browser:String}`);
            qp.browser = browser;
          }
          if (os) {
            conditions.push(`os_name = {os:String}`);
            qp.os = os;
          }

          // Time range filter on ClickHouse events
          if (start && end) {
            conditions.push(`timestamp >= {start:String}`);
            conditions.push(`timestamp <= {end:String}`);
            qp.start = start;
            qp.end = end;
          } else if (period) {
            const periodMap: Record<string, string> = {
              '1h': '1 HOUR', '6h': '6 HOUR', '24h': '24 HOUR',
              '7d': '7 DAY', '14d': '14 DAY', '30d': '30 DAY', '90d': '90 DAY',
            };
            const interval = periodMap[period];
            if (interval) {
              conditions.push(`timestamp >= now() - INTERVAL ${interval}`);
            }
          }

          const chResult = await clickhouse.query({
            query: `SELECT DISTINCT issue_id FROM argus.errors WHERE ${conditions.join(' AND ')} LIMIT 10000`,
            query_params: qp,
          });
          const chRows = await chResult.json<{ data: { issue_id: string }[] }>();
          issueIdFilter = (chRows.data || []).map((r: any) => Number(r.issue_id));

          // If no matching issues found, return empty
          if (issueIdFilter.length === 0) {
            return reply.send({ data: [], total: 0, limit: parseInt(limit, 10), offset: parseInt(offset, 10) });
          }
        }

        let sql = `
          SELECT * FROM g_argus_issues
          WHERE project_id = ?
        `;
        const params: any[] = [projectId];

        if (status && status !== 'all') {
          sql += ' AND status = ?';
          params.push(status);
        }

        if (query) {
          sql += ' AND (title LIKE ? OR culprit LIKE ?)';
          params.push(`%${query}%`, `%${query}%`);
        }

        // Apply ClickHouse-resolved issue_id filter (covers context + time filters)
        if (issueIdFilter && issueIdFilter.length > 0) {
          sql += ` AND id IN (${issueIdFilter.map(() => '?').join(',')})`;
          params.push(...issueIdFilter);
        }

        // Sort
        const sortMap: Record<string, string> = {
          last_seen: 'last_seen DESC',
          first_seen: 'first_seen DESC',
          times_seen: 'times_seen DESC',
          priority: "FIELD(priority, 'critical', 'high', 'medium', 'low')",
        };
        sql += ` ORDER BY ${sortMap[sort] || 'last_seen DESC'}`;
        sql += ' LIMIT ? OFFSET ?';
        params.push(parseInt(limit, 10), parseInt(offset, 10));

        const [rows] = await mysqlPool.query(sql, params);

        // Total count
        let countSql = `SELECT COUNT(*) as total FROM g_argus_issues WHERE project_id = ?`;
        const countParams: any[] = [projectId];
        if (status && status !== 'all') {
          countSql += ' AND status = ?';
          countParams.push(status);
        }
        if (issueIdFilter && issueIdFilter.length > 0) {
          countSql += ` AND id IN (${issueIdFilter.map(() => '?').join(',')})`;
          countParams.push(...issueIdFilter);
        }
        const [countRows] = await mysqlPool.query(countSql, countParams);
        const total = (countRows as any[])[0]?.total || 0;

        return reply.send({
          data: rows,
          total,
          limit: parseInt(limit, 10),
          offset: parseInt(offset, 10),
        });
      } catch (error) {
        logger.error('Failed to list issues', {
          projectId,
          error: error instanceof Error ? error.message : String(error),
        });
        return reply.code(500).send({ error: 'Failed to list issues' });
      }
    }
  );

  // Get single issue detail
  app.get(
    '/:projectId/issues/:issueId',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId, issueId } = request.params as {
        projectId: string;
        issueId: string;
      };

      try {
        const [rows] = await mysqlPool.query(
          'SELECT * FROM g_argus_issues WHERE id = ? AND project_id = ?',
          [issueId, projectId]
        );

        const results = rows as any[];
        if (results.length === 0) {
          return reply.code(404).send({ error: 'Issue not found' });
        }

        const issue = results[0];

        // Fetch latest event from ClickHouse for stacktrace / breadcrumbs
        try {
          const latestEventResult = await clickhouse.query({
            query: `
              SELECT
                event_id, timestamp, platform, level, type, value, mechanism,
                exception, stacktrace_frames, breadcrumbs,
                user_id, user_email, user_ip, user_name,
                environment, release, transaction,
                os_name, os_version, browser_name, browser_version,
                device_name, device_family, runtime_name, runtime_version,
                sdk_name, sdk_version, tags, extra, contexts,
                http_method, http_url
              FROM argus.errors
              WHERE project_id = {projectId:String}
                AND issue_id = {issueId:UInt64}
              ORDER BY timestamp DESC
              LIMIT 1
            `,
            query_params: {
              projectId: String(projectId),
              issueId: parseInt(issueId, 10),
            },
          });
          const eventData = await latestEventResult.json();
          const latestEvent = (eventData.data as any[])?.[0];

          if (latestEvent) {
            // Parse JSON strings back to objects for the frontend
            let breadcrumbs: any[] = [];
            try {
              breadcrumbs = typeof latestEvent.breadcrumbs === 'string'
                ? JSON.parse(latestEvent.breadcrumbs || '[]')
                : (latestEvent.breadcrumbs || []);
            } catch { breadcrumbs = []; }

            let contexts: any = {};
            try {
              contexts = typeof latestEvent.contexts === 'string'
                ? JSON.parse(latestEvent.contexts || '{}')
                : (latestEvent.contexts || {});
            } catch { contexts = {}; }

            issue.latest_event = {
              ...latestEvent,
              exception_type: latestEvent.type,
              exception_value: latestEvent.value,
              stacktrace_raw: latestEvent.stacktrace_frames,
              os: latestEvent.os_name,
              browser: latestEvent.browser_name,
              breadcrumbs,
              contexts,
              tags: latestEvent.tags || {},
              extra: latestEvent.extra || {},
            };
          }

          // Fetch event count and user count
          const countResult = await clickhouse.query({
            query: `
              SELECT count() as event_count, uniq(user_id) as user_count
              FROM argus.errors
              WHERE project_id = {projectId:String}
                AND issue_id = {issueId:UInt64}
            `,
            query_params: {
              projectId: String(projectId),
              issueId: parseInt(issueId, 10),
            },
          });
          const countData = await countResult.json();
          const counts = (countData.data as any[])?.[0];
          if (counts) {
            issue.event_count = parseInt(counts.event_count, 10);
            issue.user_count = parseInt(counts.user_count, 10);
          }
        } catch (chError) {
          logger.warn('Failed to fetch latest event from ClickHouse', {
            issueId,
            error: chError instanceof Error ? chError.message : String(chError),
          });
          // Continue without latest_event — MySQL data is still returned
        }

        return reply.send({ data: issue });
      } catch (error) {
        logger.error('Failed to get issue', {
          projectId,
          issueId,
          error: error instanceof Error ? error.message : String(error),
        });
        return reply.code(500).send({ error: 'Failed to get issue' });
      }
    }
  );

  // Get events for an issue from ClickHouse
  app.get(
    '/:projectId/issues/:issueId/events',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId, issueId } = request.params as {
        projectId: string;
        issueId: string;
      };
      const { limit = '20', offset = '0' } = request.query as Record<string, string>;

      try {
        const result = await clickhouse.query({
          query: `
            SELECT *
            FROM argus.errors
            WHERE project_id = {projectId:String}
              AND issue_id = {issueId:UInt64}
            ORDER BY timestamp DESC
            LIMIT {limit:UInt32}
            OFFSET {offset:UInt32}
          `,
          query_params: {
            projectId: String(projectId),
            issueId: parseInt(issueId, 10),
            limit: parseInt(limit, 10),
            offset: parseInt(offset, 10),
          },
        });

        const events = await result.json();

        return reply.send({ data: events.data });
      } catch (error) {
        logger.error('Failed to get issue events', {
          projectId,
          issueId,
          error: error instanceof Error ? error.message : String(error),
        });
        return reply.code(500).send({ error: 'Failed to get issue events' });
      }
    }
  );

  // Update issue status
  app.patch(
    '/:projectId/issues/:issueId',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId, issueId } = request.params as {
        projectId: string;
        issueId: string;
      };
      const body = request.body as {
        status?: string;
        assigned_to?: number;
        priority?: string;
      };

      try {
        const updates: string[] = [];
        const params: any[] = [];

        if (body.status) {
          updates.push('status = ?');
          params.push(body.status);
          if (body.status === 'resolved') {
            updates.push('resolved_at = NOW()');
          }
        }
        if (body.assigned_to !== undefined) {
          updates.push('assigned_to = ?');
          params.push(body.assigned_to);
        }
        if (body.priority) {
          updates.push('priority = ?');
          params.push(body.priority);
        }

        if (updates.length === 0) {
          return reply.code(400).send({ error: 'No fields to update' });
        }

        params.push(issueId, projectId);

        await mysqlPool.query(
          `UPDATE g_argus_issues SET ${updates.join(', ')} WHERE id = ? AND project_id = ?`,
          params
        );

        return reply.send({ success: true });
      } catch (error) {
        logger.error('Failed to update issue', {
          projectId,
          issueId,
          error: error instanceof Error ? error.message : String(error),
        });
        return reply.code(500).send({ error: 'Failed to update issue' });
      }
    }
  );

  // Merge multiple issues into one
  app.post(
    '/:projectId/issues/merge',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId } = request.params as { projectId: string };
      const { issue_ids } = request.body as { issue_ids: number[] };

      if (!issue_ids || issue_ids.length < 2) {
        return reply.code(400).send({ error: 'At least 2 issue IDs are required to merge' });
      }

      const connection = await mysqlPool.getConnection();
      try {
        await connection.beginTransaction();

        // Get all issues sorted by times_seen DESC — the most seen one becomes primary
        const [rows] = await connection.query(
          `SELECT id, times_seen, first_seen, last_seen, primary_hash
           FROM g_argus_issues
           WHERE project_id = ? AND id IN (${issue_ids.map(() => '?').join(',')})
           ORDER BY times_seen DESC`,
          [projectId, ...issue_ids]
        );
        const issues = rows as any[];

        if (issues.length < 2) {
          await connection.rollback();
          return reply.code(404).send({ error: 'Not enough matching issues found' });
        }

        const primary = issues[0];
        const mergedIds = issues.slice(1).map((i: any) => i.id);

        // Aggregate stats into primary
        const totalTimesSeen = issues.reduce((sum: number, i: any) => sum + i.times_seen, 0);
        const earliestFirstSeen = issues.reduce((earliest: string, i: any) => i.first_seen < earliest ? i.first_seen : earliest, issues[0].first_seen);
        const latestLastSeen = issues.reduce((latest: string, i: any) => i.last_seen > latest ? i.last_seen : latest, issues[0].last_seen);

        // Update primary issue
        await connection.query(
          `UPDATE g_argus_issues SET times_seen = ?, first_seen = ?, last_seen = ? WHERE id = ?`,
          [totalTimesSeen, earliestFirstSeen, latestLastSeen, primary.id]
        );

        // Update ClickHouse events to point to primary issue
        // Note: ClickHouse does not support UPDATE, so we store merge mapping in MySQL
        // Mark merged issues as "merged" status with a reference to primary
        await connection.query(
          `UPDATE g_argus_issues
           SET status = 'merged', substatus = ?, times_seen = 0
           WHERE id IN (${mergedIds.map(() => '?').join(',')}) AND project_id = ?`,
          [String(primary.id), ...mergedIds, projectId]
        );

        await connection.commit();

        logger.info('Issues merged', {
          projectId,
          primaryId: primary.id,
          mergedIds,
          totalTimesSeen,
        });

        return reply.send({
          success: true,
          data: {
            primary_id: primary.id,
            merged_count: mergedIds.length,
          },
        });
      } catch (error) {
        await connection.rollback();
        logger.error('Failed to merge issues', {
          projectId,
          error: error instanceof Error ? error.message : String(error),
        });
        return reply.code(500).send({ error: 'Failed to merge issues' });
      } finally {
        connection.release();
      }
    }
  );
}

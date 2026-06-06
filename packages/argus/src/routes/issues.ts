import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { mysqlPool } from '../config/mysql';
import { optic } from '@gatrix/argus-optic';
import { redis } from '../config/redis';
import { createLogger } from '../utils/logger';
import { ConfigBroadcaster } from '../utils/config-broadcaster';
import { CONFIG_TYPES } from '../config/redis-keys';

const logger = createLogger('issues-api');
const broadcaster = new ConfigBroadcaster(redis);

export default async function issuesRoutes(app: FastifyInstance) {
  // Issue volume chart data (daily error counts)
  app.get(
    '/:projectId/issues/volume',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId } = request.params as { projectId: string };
      const { period = '24h', status, level, start, end, query, environment, browser, os } = request.query as Record<string, string>;

      try {
        let startDt: Date;
        let endDt: Date;

        if (start && end) {
          startDt = new Date(start);
          endDt = new Date(end);
        } else {
          const periodMap: Record<string, number> = {
            '1h': 3600, '6h': 21600, '24h': 86400, '7d': 604800, '14d': 1209600, '30d': 2592000, '90d': 7776000,
          };
          const deltaSecs = periodMap[period] || 86400;
          endDt = new Date();
          startDt = new Date(endDt.getTime() - deltaSecs * 1000);
        }

        if (isNaN(startDt.getTime()) || isNaN(endDt.getTime())) {
          return reply.code(400).send({ error: 'Invalid start or end date' });
        }

        const deltaSeconds = Math.max(1, (endDt.getTime() - startDt.getTime()) / 1000);
        let interval = '1 DAY';
        if (deltaSeconds <= 3600) interval = '1 MINUTE';
        else if (deltaSeconds <= 6 * 3600) interval = '5 MINUTE';
        else if (deltaSeconds <= 24 * 3600) interval = '30 MINUTE';
        else if (deltaSeconds <= 7 * 86400) interval = '4 HOUR';
        else if (deltaSeconds <= 14 * 86400) interval = '8 HOUR';

        const qp: Record<string, any> = {
          projectId: String(projectId),
          fillStart: Math.floor(startDt.getTime() / 1000),
          fillEnd: Math.floor(endDt.getTime() / 1000),
        };

        const conditions = [
          `project_id = {projectId:String}`,
          `timestamp >= toDateTime({fillStart:UInt32})`,
          `timestamp <= toDateTime({fillEnd:UInt32})`
        ];

        if (level) {
          conditions.push(`level = {level:String}`);
          qp.level = level;
        }

        // Optional: filter by issue status from MySQL
        if (status && status !== 'all') {
          const [issueRows] = await mysqlPool.query(
            'SELECT id FROM g_argus_issues WHERE project_id = ? AND status = ?',
            [projectId, status]
          );
          const issueIds = (issueRows as any[]).map((r: any) => r.id);
          if (issueIds.length === 0) {
            return reply.send({ data: [] });
          }
          conditions.push(`issue_id IN (${issueIds.join(',')})`);
        }

        // Context filters (environment, browser, os) on ClickHouse errors
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

        // Text query filter ??search in title/culprit by matching issue_ids from MySQL
        if (query) {
          try {
            const [queryRows] = await mysqlPool.query(
              'SELECT id FROM g_argus_issues WHERE project_id = ? AND (title LIKE ? OR culprit LIKE ?)',
              [projectId, `%${query}%`, `%${query}%`]
            );
            const queryIssueIds = (queryRows as any[]).map((r: any) => r.id);
            if (queryIssueIds.length === 0) {
              return reply.send({ data: [] });
            }
            conditions.push(`issue_id IN (${queryIssueIds.join(',')})`);
          } catch { /* ignore query filter errors */ }
        }

        const result = await optic.rawQuery({
          query: `
            SELECT
              toStartOfInterval(timestamp, INTERVAL ${interval}) AS day,
              count() AS count,
              uniqExact(issue_id) AS issue_count
            FROM argus.errors
            WHERE ${conditions.join(' AND ')}
            GROUP BY day
            ORDER BY day
            WITH FILL 
              FROM toStartOfInterval(toDateTime({fillStart:UInt32}), INTERVAL ${interval})
              TO toDateTime({fillEnd:UInt32})
              STEP INTERVAL ${interval}
          `,
          params: qp,
        });
        return reply.send({ data: result.data || [] });
      } catch (error) {
        logger.error('Failed to get issue volume', { projectId, error: String(error) });
        return reply.code(500).send({ error: 'Failed to get issue volume' });
      }
    }
  );

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
        substatus,
        assigned_to,
        level,
      } = request.query as Record<string, string>;

      try {
        // Resolve issue_ids from ClickHouse when contextual or time filters are set
        let issueIdFilter: number[] | null = null;
        const hasContextFilter = !!(environment || browser || os);
        const hasTimeFilter = !!((start && end) || period);

        if (hasContextFilter || hasTimeFilter) {
          const conditions: string[] = [`project_id = {projectId:String}`];
          const qp: Record<string, any> = { projectId: String(projectId) };

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
            conditions.push(`timestamp >= toDateTime({startTs:UInt32})`);
            conditions.push(`timestamp <= toDateTime({endTs:UInt32})`);
            qp.startTs = Math.floor(new Date(start).getTime() / 1000);
            qp.endTs = Math.floor(new Date(end).getTime() / 1000);
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

          const chResult = await optic.rawQuery({
            query: `SELECT DISTINCT issue_id FROM argus.errors WHERE ${conditions.join(' AND ')} LIMIT 10000`,
            params: qp,
          });
          issueIdFilter = (chResult.data || []).map((r: any) => Number(r.issue_id));

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

        if (substatus) {
          sql += ' AND substatus = ?';
          params.push(substatus);
        }

        if (assigned_to) {
          sql += ' AND assigned_to = ?';
          params.push(assigned_to);
        }

        if (level) {
          sql += ' AND level = ?';
          params.push(level);
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
        const issues = rows as any[];

        // Fetch 24h sparkline data for these issues from ClickHouse
        const issueIds = issues.map((r: any) => r.id);
        let sparklineMap = new Map<number, number[]>();
        if (issueIds.length > 0) {
          try {
            const sparkResult = await optic.rawQuery({
              query: `
                SELECT issue_id, toStartOfHour(timestamp) as hour, count() as cnt
                FROM argus.errors
                WHERE project_id = {projectId:String}
                  AND issue_id IN (${issueIds.join(',')})
                  AND timestamp >= now() - INTERVAL 24 HOUR
                GROUP BY issue_id, hour
                ORDER BY issue_id, hour
              `,
              params: { projectId: String(projectId) },
            });
            // Build 24-slot arrays (one per hour)
            for (const row of (sparkResult.data || []) as any[]) {
              const id = Number(row.issue_id);
              if (!sparklineMap.has(id)) sparklineMap.set(id, new Array(24).fill(0));
              const hourDate = new Date(row.hour);
              const hoursAgo = Math.floor((Date.now() - hourDate.getTime()) / 3600000);
              const slotIdx = 23 - Math.min(hoursAgo, 23);
              sparklineMap.get(id)![slotIdx] = Number(row.cnt);
            }
          } catch (e) {
            logger.warn('Failed to fetch sparkline data', { error: e instanceof Error ? e.message : String(e) });
          }
        }

        // Enrich issues with sparkline
        const enrichedIssues = issues.map((issue: any) => ({
          ...issue,
          stats_24h: sparklineMap.get(issue.id) || [],
          event_count: issue.times_seen,
          user_count: issue.num_users,
        }));

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
          data: enrichedIssues,
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

  // Create a new issue manually (e.g. from user feedback)
  app.post(
    '/:projectId/issues',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId } = request.params as { projectId: string };
      const body = request.body as {
        title: string;
        level?: string;
        message?: string;
        culprit?: string;
        tracker_id?: number;
      };

      if (!body.title?.trim()) {
        return reply.code(400).send({ error: 'Title is required' });
      }

      try {
        // Generate a fingerprint from title
        const crypto = require('crypto');
        const fingerprint = crypto.createHash('md5').update(body.title).digest('hex');

        // Ensure external columns exist (idempotent)
        try {
          await mysqlPool.query(`ALTER TABLE g_argus_issues ADD COLUMN IF NOT EXISTS external_url VARCHAR(512) DEFAULT NULL`);
          await mysqlPool.query(`ALTER TABLE g_argus_issues ADD COLUMN IF NOT EXISTS external_key VARCHAR(100) DEFAULT NULL`);
        } catch { /* columns may already exist */ }

        const [result] = await mysqlPool.query(
          `INSERT INTO g_argus_issues
            (project_id, title, culprit, level, status, priority, primary_hash, times_seen, first_seen, last_seen)
           VALUES (?, ?, ?, ?, 'unresolved', 'medium', ?, 0, UTC_TIMESTAMP(), UTC_TIMESTAMP())`,
          [
            projectId,
            body.title.trim(),
            body.culprit || '',
            body.level || 'info',
            fingerprint,
          ]
        );

        const insertId = (result as any).insertId;
        logger.info('Issue created manually', { projectId, issueId: insertId, title: body.title });

        // Create on external tracker if tracker_id is provided
        let externalUrl: string | null = null;
        let externalKey: string | null = null;

        if (body.tracker_id) {
          try {
            const { createExternalIssue } = require('../services/trackerAdapter');
            const [trackerRows] = await mysqlPool.query(
              'SELECT * FROM g_argus_issue_trackers WHERE id = ? AND project_id = ?',
              [body.tracker_id, projectId]
            );
            const tracker = (trackerRows as any[])[0];

            if (tracker && tracker.enabled) {
              const trackerConfig = {
                provider: tracker.provider,
                apiUrl: tracker.api_url,
                apiToken: tracker.api_token,
                config: typeof tracker.config === 'string' ? JSON.parse(tracker.config) : (tracker.config || {}),
              };

              const externalResult = await createExternalIssue(trackerConfig, {
                title: body.title,
                description: body.message || '',
                level: body.level,
              });

              externalUrl = externalResult.url;
              externalKey = externalResult.key;

              // Store external link on the issue
              await mysqlPool.query(
                'UPDATE g_argus_issues SET external_url = ?, external_key = ? WHERE id = ?',
                [externalUrl, externalKey, insertId]
              );

              logger.info('External issue created', {
                issueId: insertId, provider: tracker.provider,
                externalUrl, externalKey,
              });
            }
          } catch (trackerError) {
            logger.warn('Failed to create external issue', {
              trackerId: body.tracker_id,
              error: (trackerError as Error).message,
            });
            // Don't fail the whole request ??internal issue was already created
          }
        }

        return reply.code(201).send({
          data: {
            id: insertId,
            external_url: externalUrl,
            external_key: externalKey,
          },
        });
      } catch (error) {
        logger.error('Failed to create issue', {
          projectId,
          error: error instanceof Error ? error.message : String(error),
        });
        return reply.code(500).send({ error: 'Failed to create issue' });
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

        // Fetch latest event and counts from ClickHouse in parallel
        try {
          const chParams = {
            projectId: String(projectId),
            issueId: parseInt(issueId, 10),
          };

          const [latestEventResult, countResult] = await Promise.all([
            optic.rawQuery({
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
              params: chParams,
            }),
            optic.rawQuery({
              query: `
                SELECT count() as event_count, uniq(user_id) as user_count
                FROM argus.errors
                WHERE project_id = {projectId:String}
                  AND issue_id = {issueId:UInt64}
              `,
              params: chParams,
            }),
          ]);

          const latestEvent = (latestEventResult.data as any[])?.[0];

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

          const counts = (countResult.data as any[])?.[0];
          if (counts) {
            issue.event_count = parseInt(counts.event_count, 10);
            issue.user_count = parseInt(counts.user_count, 10);
          }
        } catch (chError) {
          logger.warn('Failed to fetch latest event from ClickHouse', {
            issueId,
            error: chError instanceof Error ? chError.message : String(chError),
          });
          // Continue without latest_event ??MySQL data is still returned
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
        const result = await optic.query({
          dataset: 'errors', projectId,
          timeRange: { period: '90d' },
          select: [
            { field: 'event_id' }, { field: 'timestamp' }, { field: 'platform' },
            { field: 'level' }, { field: 'type' }, { field: 'value' },
            { field: 'mechanism' }, { field: 'exception' }, { field: 'stacktrace_frames' },
            { field: 'breadcrumbs' }, { field: 'user_id' }, { field: 'user_email' },
            { field: 'user_ip' }, { field: 'user_name' }, { field: 'environment' },
            { field: 'release' }, { field: 'transaction' }, { field: 'os_name' },
            { field: 'os_version' }, { field: 'browser_name' }, { field: 'browser_version' },
            { field: 'device_name' }, { field: 'device_family' }, { field: 'runtime_name' },
            { field: 'runtime_version' }, { field: 'sdk_name' }, { field: 'sdk_version' },
            { field: 'tags' }, { field: 'extra' }, { field: 'contexts' },
            { field: 'http_method' }, { field: 'http_url' }, { field: 'is_handled' },
            { field: 'fingerprint' }, { field: 'issue_id' },
          ],
          conditions: [{ field: 'issue_id', op: '=', value: parseInt(issueId, 10) }],
          orderBy: [{ field: 'timestamp', direction: 'DESC' }],
          limit: parseInt(limit, 10),
          offset: parseInt(offset, 10),
        });

        return reply.send({ data: result.data });
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

  // Get stats for an issue from ClickHouse
  app.get(
    '/:projectId/issues/:issueId/stats',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId, issueId } = request.params as {
        projectId: string;
        issueId: string;
      };
      const { period = '14d' } = request.query as { period?: string };

      const periodMap: Record<string, number> = {
        '1h': 3600, '6h': 21600, '24h': 86400, '7d': 604800, '14d': 1209600, '30d': 2592000, '90d': 7776000
      };
      const deltaSeconds = periodMap[period] || 1209600;
      const endDt = new Date();
      const startDt = new Date(endDt.getTime() - deltaSeconds * 1000);

      let interval = '1 DAY';
      if (deltaSeconds <= 3600) interval = '1 MINUTE';
      else if (deltaSeconds <= 6 * 3600) interval = '5 MINUTE';
      else if (deltaSeconds <= 24 * 3600) interval = '30 MINUTE';
      else if (deltaSeconds <= 7 * 86400) interval = '4 HOUR';
      else if (deltaSeconds <= 14 * 86400) interval = '8 HOUR';

      try {
        const result = await optic.rawQuery({
          query: `
            SELECT
              toStartOfInterval(timestamp, INTERVAL ${interval}) AS timestamp,
              count() AS event_count,
              uniq(user_id) AS user_count
            FROM argus.errors
            WHERE project_id = {projectId:String}
              AND issue_id = {issueId:UInt64}
              AND timestamp >= toDateTime({fillStart:UInt32})
              AND timestamp <= toDateTime({fillEnd:UInt32})
            GROUP BY timestamp
            ORDER BY timestamp
            WITH FILL 
              FROM toStartOfInterval(toDateTime({fillStart:UInt32}), INTERVAL ${interval})
              TO toDateTime({fillEnd:UInt32})
              STEP INTERVAL ${interval}
          `,
          params: {
            projectId: String(projectId),
            issueId: parseInt(issueId, 10),
            fillStart: Math.floor(startDt.getTime() / 1000),
            fillEnd: Math.floor(endDt.getTime() / 1000),
          },
        });

        return reply.send({ data: result.data });
      } catch (error) {
        logger.error('Failed to get issue stats', {
          projectId,
          issueId,
          error: error instanceof Error ? error.message : String(error),
        });
        return reply.code(500).send({ error: 'Failed to get issue stats' });
      }
    }
  );

  // Get tag distribution for an issue
  app.get(
    '/:projectId/issues/:issueId/tags',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId, issueId } = request.params as {
        projectId: string;
        issueId: string;
      };

      try {
        // Single UNION ALL query instead of 6 individual queries
        const chParams = { projectId: String(projectId), issueId: parseInt(issueId, 10) };
        const result = await optic.rawQuery({
          query: `
            SELECT 'browser' AS key, browser_name AS value, count() AS cnt
            FROM argus.errors WHERE project_id = {projectId:String} AND issue_id = {issueId:UInt64} AND browser_name != ''
            GROUP BY browser_name ORDER BY cnt DESC LIMIT 10
            UNION ALL
            SELECT 'os' AS key, os_name AS value, count() AS cnt
            FROM argus.errors WHERE project_id = {projectId:String} AND issue_id = {issueId:UInt64} AND os_name != ''
            GROUP BY os_name ORDER BY cnt DESC LIMIT 10
            UNION ALL
            SELECT 'level' AS key, level AS value, count() AS cnt
            FROM argus.errors WHERE project_id = {projectId:String} AND issue_id = {issueId:UInt64} AND level != ''
            GROUP BY level ORDER BY cnt DESC LIMIT 10
            UNION ALL
            SELECT 'environment' AS key, environment AS value, count() AS cnt
            FROM argus.errors WHERE project_id = {projectId:String} AND issue_id = {issueId:UInt64} AND environment != ''
            GROUP BY environment ORDER BY cnt DESC LIMIT 10
            UNION ALL
            SELECT 'release' AS key, release AS value, count() AS cnt
            FROM argus.errors WHERE project_id = {projectId:String} AND issue_id = {issueId:UInt64} AND release != ''
            GROUP BY release ORDER BY cnt DESC LIMIT 10
            UNION ALL
            SELECT 'url' AS key, http_url AS value, count() AS cnt
            FROM argus.errors WHERE project_id = {projectId:String} AND issue_id = {issueId:UInt64} AND http_url != ''
            GROUP BY http_url ORDER BY cnt DESC LIMIT 10
          `,
          params: chParams,
        });
        const rows = result.data as any[];

        // Group results by key
        const tagMap = new Map<string, { value: string; count: number }[]>();
        for (const row of rows) {
          if (!tagMap.has(row.key)) tagMap.set(row.key, []);
          tagMap.get(row.key)!.push({ value: row.value, count: Number(row.cnt) });
        }

        const filtered = Array.from(tagMap.entries())
          .filter(([, values]) => values.length > 0)
          .map(([key, topValues]) => ({
            key,
            totalValues: topValues.length,
            topValues,
          }));

        return reply.send({ data: filtered });
      } catch (error) {
        logger.error('Failed to get issue tags', {
          projectId, issueId,
          error: error instanceof Error ? error.message : String(error),
        });
        return reply.code(500).send({ error: 'Failed to get issue tags' });
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
        assigned_to?: string | null;
        priority?: string;
        external_url?: string | null;
        external_key?: string | null;
      };

      try {
        const updates: string[] = [];
        const params: any[] = [];

        if (body.status) {
          updates.push('status = ?');
          params.push(body.status);
          if (body.status === 'resolved') {
            updates.push('resolved_at = UTC_TIMESTAMP()');
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
        if (body.external_url !== undefined) {
          updates.push('external_url = ?');
          params.push(body.external_url);
        }
        if (body.external_key !== undefined) {
          updates.push('external_key = ?');
          params.push(body.external_key);
        }

        if (updates.length === 0) {
          return reply.code(400).send({ error: 'No fields to update' });
        }

        params.push(issueId, projectId);

        await mysqlPool.query(
          `UPDATE g_argus_issues SET ${updates.join(', ')} WHERE id = ? AND project_id = ?`,
          params
        );

        // Record activity
        const userName = (request.headers['x-user-name'] as string) || null;
        try {
          if (body.status) {
            await mysqlPool.query(
              `INSERT INTO g_argus_issue_activity (project_id, issue_id, user_name, action, data) VALUES (?, ?, ?, 'status_change', ?)`,
              [projectId, issueId, userName, JSON.stringify({ to: body.status })]
            );
          }
          if (body.assigned_to !== undefined) {
            await mysqlPool.query(
              `INSERT INTO g_argus_issue_activity (project_id, issue_id, user_name, action, data) VALUES (?, ?, ?, 'assign', ?)`,
              [projectId, issueId, userName, JSON.stringify({ to: body.assigned_to })]
            );
          }
          if (body.priority) {
            await mysqlPool.query(
              `INSERT INTO g_argus_issue_activity (project_id, issue_id, user_name, action, data) VALUES (?, ?, ?, 'priority_change', ?)`,
              [projectId, issueId, userName, JSON.stringify({ to: body.priority })]
            );
          }
        } catch (actErr) {
          logger.warn('Failed to record activity', { error: actErr instanceof Error ? actErr.message : String(actErr) });
        }

        // Notify workers to invalidate issue cache if status changed
        if (body.status) {
          await broadcaster.publish({
            type: CONFIG_TYPES.ISSUE_STATUS,
            issueId: parseInt(issueId, 10),
          });
        }

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

  // Bulk update issues (status, assigned_to)
  app.put(
    '/:projectId/issues/bulk',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId } = request.params as { projectId: string };
      const body = request.body as {
        issue_ids: number[];
        status?: string;
        assigned_to?: string | null;
      };

      if (!body.issue_ids || body.issue_ids.length === 0) {
        return reply.code(400).send({ error: 'issue_ids is required' });
      }

      try {
        const updates: string[] = [];
        const params: any[] = [];

        if (body.status) {
          updates.push('status = ?');
          params.push(body.status);
          if (body.status === 'resolved') {
            updates.push('resolved_at = UTC_TIMESTAMP()');
          }
        }
        if (body.assigned_to !== undefined) {
          updates.push('assigned_to = ?');
          params.push(body.assigned_to);
        }

        if (updates.length === 0) {
          return reply.code(400).send({ error: 'No fields to update' });
        }

        const placeholders = body.issue_ids.map(() => '?').join(',');
        params.push(...body.issue_ids, projectId);

        const [result] = await mysqlPool.query(
          `UPDATE g_argus_issues SET ${updates.join(', ')} WHERE id IN (${placeholders}) AND project_id = ?`,
          params
        );

        logger.info('Bulk updated issues', {
          projectId,
          count: body.issue_ids.length,
          status: body.status,
        });

        // Notify workers to invalidate issue cache for each updated issue
        if (body.status) {
          for (const id of body.issue_ids) {
            await broadcaster.publish({
              type: CONFIG_TYPES.ISSUE_STATUS,
              issueId: id,
            });
          }
        }

        return reply.send({
          success: true,
          data: { updated: (result as any).affectedRows || body.issue_ids.length },
        });
      } catch (error) {
        logger.error('Failed to bulk update issues', {
          projectId,
          error: error instanceof Error ? error.message : String(error),
        });
        return reply.code(500).send({ error: 'Failed to bulk update issues' });
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

        // Get all issues sorted by times_seen DESC ??the most seen one becomes primary
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

  // Get issue activity timeline
  app.get(
    '/:projectId/issues/:issueId/activity',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId, issueId } = request.params as {
        projectId: string;
        issueId: string;
      };

      try {
        const { limit, offset } = request.query as Record<string, string>;
        const limitVal = limit ? parseInt(limit, 10) : 50;
        const offsetVal = offset ? parseInt(offset, 10) : 0;

        const [rows] = await mysqlPool.query(
          `SELECT * FROM g_argus_issue_activity
           WHERE project_id = ? AND issue_id = ?
           ORDER BY created_at DESC
           LIMIT ? OFFSET ?`,
          [projectId, issueId, limitVal, offsetVal]
        );
        return reply.send({ data: rows });
      } catch (error) {
        logger.error('Failed to fetch activity', {
          projectId, issueId,
          error: error instanceof Error ? error.message : String(error),
        });
        return reply.code(500).send({ error: 'Failed to fetch activity' });
      }
    }
  );

  // Add comment to issue
  app.post(
    '/:projectId/issues/:issueId/comments',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId, issueId } = request.params as {
        projectId: string;
        issueId: string;
      };
      const { text } = request.body as { text: string };
      const userName = (request.headers['x-user-name'] as string) || 'Unknown';

      if (!text?.trim()) {
        return reply.code(400).send({ error: 'Comment text is required' });
      }

      try {
        await mysqlPool.query(
          `INSERT INTO g_argus_issue_activity (project_id, issue_id, user_name, action, data) VALUES (?, ?, ?, 'comment', ?)`,
          [projectId, issueId, userName, JSON.stringify({ text: text.trim() })]
        );
        return reply.send({ success: true });
      } catch (error) {
        logger.error('Failed to add comment', {
          projectId, issueId,
          error: error instanceof Error ? error.message : String(error),
        });
        return reply.code(500).send({ error: 'Failed to add comment' });
      }
    }
  );
}

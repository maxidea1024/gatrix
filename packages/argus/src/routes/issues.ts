import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import db from '../config/knex';
import { optic, parseSearchToSQL } from '@gatrix/argus-optic';
import { redis } from '../config/redis';
import { createLogger } from '../utils/logger';
import { ConfigBroadcaster } from '../utils/config-broadcaster';
import { CONFIG_TYPES, COUNTERS } from '../config/redis-keys';
import {
  PERIOD_TO_SQL_INTERVAL,
  buildTimeRangeConditions,
  getBucketingConfig,
} from '../utils/timeBucket';

const logger = createLogger('issues-api');
const broadcaster = new ConfigBroadcaster(redis);

/**
 * Extract MySQL-only fields (status, substatus, assigned_to, level) from an AQL query string.
 * These fields exist in the MySQL issues table but NOT in the ClickHouse errors table,
 * so they must be separated before passing the query to parseSearchToSQL.
 *
 * Returns extracted field values and the remaining query for ClickHouse.
 */
function extractMySQLFields(query: string): {
  fields: Record<string, string>;
  remaining: string;
} {
  const mysqlFieldNames = [
    'status',
    'substatus',
    'assigned_to',
    'level',
    'priority',
  ];
  const fields: Record<string, string> = {};
  let remaining = query;

  for (const field of mysqlFieldNames) {
    // Match field:"quoted value" or field:unquoted_value
    const regex = new RegExp(`\\b${field}:(?:"([^"]*)"|([^\\s)]+))`, 'g');
    remaining = remaining.replace(regex, (_match, quoted, unquoted) => {
      fields[field] = quoted ?? unquoted;
      return '';
    });
  }

  return { fields, remaining: remaining.replace(/\s+/g, ' ').trim() };
}

export default async function issuesRoutes(app: FastifyInstance) {
  // Issue volume chart data (daily error counts)
  app.get(
    '/:projectId/issues/volume',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId } = request.params as { projectId: string };
      const {
        period = '24h',
        start,
        end,
        query,
      } = request.query as Record<string, string>;

      try {
        const bucket = getBucketingConfig(period, start, end);
        const { interval, queryParams } = bucket;

        const qp: Record<string, any> = {
          projectId: String(projectId),
          fillStart: queryParams.fillStart,
          fillEnd: queryParams.fillEnd,
        };

        const conditions = [
          `project_id = {projectId:String}`,
          `timestamp >= toDateTime({fillStart:UInt32})`,
          `timestamp <= toDateTime({fillEnd:UInt32})`,
        ];

        // Extract MySQL fields from AQL query, pass remainder to ClickHouse
        let mysqlFields: Record<string, string> = {};
        let chQuery = query;
        if (query && typeof query === 'string' && query.trim()) {
          const extracted = extractMySQLFields(query);
          mysqlFields = extracted.fields;
          chQuery = extracted.remaining;
        }

        // level is also a ClickHouse column, apply directly
        if (mysqlFields.level) {
          conditions.push(`level = {level:String}`);
          qp.level = mysqlFields.level;
        }

        // Resolve matching issue_ids from MySQL if any MySQL-only filters are active
        const mysqlFilters: Record<string, any> = { project_id: projectId };
        let hasMysqlFilters = false;

        if (mysqlFields.status && mysqlFields.status !== 'all') {
          mysqlFilters.status = mysqlFields.status;
          hasMysqlFilters = true;
        }
        if (mysqlFields.substatus) {
          mysqlFilters.substatus = mysqlFields.substatus;
          hasMysqlFilters = true;
        }
        if (mysqlFields.assigned_to) {
          mysqlFilters.assigned_to = mysqlFields.assigned_to;
          hasMysqlFilters = true;
        }
        if (mysqlFields.priority) {
          mysqlFilters.priority = mysqlFields.priority;
          hasMysqlFilters = true;
        }

        if (hasMysqlFilters) {
          const issueRows = await db('g_argus_issues')
            .select('id')
            .where(mysqlFilters);
          const issueIds = issueRows.map((r: any) => r.id);
          if (issueIds.length === 0) {
            return reply.send({ data: [] });
          }
          conditions.push(`issue_id IN (${issueIds.join(',')})`);
        }

        // AQL query filter — parse remaining structured query into ClickHouse conditions
        if (chQuery && chQuery.trim()) {
          const { where: searchCond } = parseSearchToSQL('errors', chQuery, qp);
          if (searchCond) conditions.push(`(${searchCond})`);
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
        logger.error('Failed to get issue volume', {
          projectId,
          error: String(error),
        });
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
        sort = 'last_seen',
        limit = '25',
        offset = '0',
        query,
        period,
        start,
        end,
        status: statusParam,
        level: levelParam,
        substatus: substatusParam,
        assigned_to: assignedToParam,
      } = request.query as Record<string, string>;

      try {
        // Extract MySQL-only fields from AQL query
        let mysqlFields: Record<string, string> = {};
        let chQuery = query;
        if (query && typeof query === 'string' && query.trim()) {
          const extracted = extractMySQLFields(query);
          mysqlFields = extracted.fields;
          chQuery = extracted.remaining;
        }

        // Merge: AQL-extracted fields take precedence, then explicit params
        const status = mysqlFields.status || statusParam || '';
        const level = mysqlFields.level || levelParam || '';
        const substatus = substatusParam || mysqlFields.substatus || '';
        const assigned_to = assignedToParam || mysqlFields.assigned_to || '';
        const priority = mysqlFields.priority || '';

        // Resolve issue_ids from ClickHouse when time or AQL filters are set
        let issueIdFilter: number[] | null = null;
        const hasTimeFilter = !!((start && end) || period);
        const hasQueryFilter = !!(chQuery && chQuery.trim());

        if (hasTimeFilter || hasQueryFilter) {
          const conditions: string[] = [`project_id = {projectId:String}`];
          const qp: Record<string, any> = { projectId: String(projectId) };

          // Time range filter on ClickHouse events
          if (start && end) {
            conditions.push(`timestamp >= toDateTime({startTs:UInt32})`);
            conditions.push(`timestamp <= toDateTime({endTs:UInt32})`);
            qp.startTs = Math.floor(new Date(start).getTime() / 1000);
            qp.endTs = Math.floor(new Date(end).getTime() / 1000);
          } else if (period) {
            const interval = PERIOD_TO_SQL_INTERVAL[period];
            if (interval) {
              conditions.push(`timestamp >= now() - INTERVAL ${interval}`);
            }
          }

          // AQL query filter — parse remaining structured query into ClickHouse SQL
          if (hasQueryFilter) {
            const { where: searchCond } = parseSearchToSQL(
              'errors',
              chQuery!,
              qp
            );
            if (searchCond) conditions.push(`(${searchCond})`);
          }

          const chResult = await optic.rawQuery({
            query: `SELECT DISTINCT issue_id FROM argus.errors WHERE ${conditions.join(' AND ')} LIMIT 10000`,
            params: qp,
          });
          issueIdFilter = (chResult.data || []).map((r: any) =>
            Number(r.issue_id)
          );

          // If no matching issues found, return empty
          if (issueIdFilter.length === 0) {
            return reply.send({
              data: [],
              total: 0,
              limit: parseInt(limit, 10),
              offset: parseInt(offset, 10),
            });
          }
        }

        // Build dynamic WHERE clause for MySQL
        let whereSql = '';
        const whereParams: any[] = [];

        if (status && status !== 'all') {
          whereSql += ' AND status = ?';
          whereParams.push(status);
        }
        if (substatus) {
          whereSql += ' AND substatus = ?';
          whereParams.push(substatus);
        }
        if (assigned_to) {
          whereSql += ' AND assigned_to = ?';
          whereParams.push(assigned_to);
        }
        if (level) {
          whereSql += ' AND level = ?';
          whereParams.push(level);
        }
        if (priority) {
          whereSql += ' AND priority = ?';
          whereParams.push(priority);
        }
        if (issueIdFilter && issueIdFilter.length > 0) {
          whereSql += ` AND id IN (${issueIdFilter.map(() => '?').join(',')})`;
          whereParams.push(...issueIdFilter);
        }

        let sql = `
          SELECT * FROM g_argus_issues
          WHERE project_id = ?
          ${whereSql}
        `;
        const params: any[] = [projectId, ...whereParams];

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

        const rawResult = await db.raw(sql, params);
        const issues = rawResult[0] as any[];

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
              if (!sparklineMap.has(id))
                sparklineMap.set(id, new Array(24).fill(0));
              const hourDate = new Date(row.hour);
              const hoursAgo = Math.floor(
                (Date.now() - hourDate.getTime()) / 3600000
              );
              const slotIdx = 23 - Math.min(hoursAgo, 23);
              sparklineMap.get(id)![slotIdx] = Number(row.cnt);
            }
          } catch (e) {
            logger.warn('Failed to fetch sparkline data', {
              error: e instanceof Error ? e.message : String(e),
            });
          }
        }

        // Enrich issues with sparkline
        const enrichedIssues = issues.map((issue: any) => ({
          ...issue,
          stats_24h: sparklineMap.get(issue.id) || [],
          event_count: issue.times_seen,
          user_count: issue.num_users,
        }));

        // Total count (using the same WHERE clause as list query)
        let countSql = `SELECT COUNT(*) as total FROM g_argus_issues WHERE project_id = ? ${whereSql}`;
        const countParams: any[] = [projectId, ...whereParams];
        const countRaw = await db.raw(countSql, countParams);
        const total = (countRaw[0] as any[])[0]?.total || 0;

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
        // Generate a unique fingerprint for manual issues (title + timestamp to avoid dedup conflicts)
        const crypto = require('crypto');
        const fingerprint = crypto
          .createHash('md5')
          .update(`${body.title}::manual::${Date.now()}`)
          .digest('hex');

        // Atomic short_id via Redis (consistent with issue-grouper)
        const nextShortId = await redis.hincrby(
          COUNTERS.ISSUE_SHORT_ID(String(projectId)),
          'seq',
          1
        );

        const [insertId] = await db('g_argus_issues').insert({
          project_id: projectId,
          short_id: nextShortId,
          title: body.title.trim(),
          culprit: body.culprit || '',
          level: body.level || 'info',
          status: 'unresolved',
          priority: 'medium',
          primary_hash: fingerprint,
          times_seen: 0,
          first_seen: db.fn.now(),
          last_seen: db.fn.now(),
        });
        logger.info('Issue created manually', {
          projectId,
          issueId: insertId,
          title: body.title,
        });

        // Create on external tracker if tracker_id is provided
        let externalUrl: string | null = null;
        let externalKey: string | null = null;

        if (body.tracker_id) {
          try {
            const {
              createExternalIssue,
            } = require('../services/trackerAdapter');
            const trackerRows = await db('g_argus_issue_trackers').where({
              id: body.tracker_id,
              project_id: projectId,
            });
            const tracker = trackerRows[0];

            if (tracker && tracker.enabled) {
              const trackerConfig = {
                provider: tracker.provider,
                apiUrl: tracker.api_url,
                apiToken: tracker.api_token,
                config:
                  typeof tracker.config === 'string'
                    ? JSON.parse(tracker.config)
                    : tracker.config || {},
              };

              const externalResult = await createExternalIssue(trackerConfig, {
                title: body.title,
                description: body.message || '',
                level: body.level,
              });

              externalUrl = externalResult.url;
              externalKey = externalResult.key;

              // Store external link on the issue
              await db('g_argus_issues').where('id', insertId).update({
                external_url: externalUrl,
                external_key: externalKey,
              });

              logger.info('External issue created', {
                issueId: insertId,
                provider: tracker.provider,
                externalUrl,
                externalKey,
              });

              // Record activity
              const userName = (request.headers['x-user-name'] as string) || null;
              await db('g_argus_issue_activity').insert({
                project_id: projectId,
                issue_id: insertId,
                user_name: userName,
                action: 'external_link',
                data: JSON.stringify({
                  url: externalUrl,
                  key: externalKey,
                  provider: tracker.provider,
                }),
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
        const results = await db('g_argus_issues').where({
          id: issueId,
          project_id: projectId,
        });
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
              breadcrumbs =
                typeof latestEvent.breadcrumbs === 'string'
                  ? JSON.parse(latestEvent.breadcrumbs || '[]')
                  : latestEvent.breadcrumbs || [];
            } catch {
              breadcrumbs = [];
            }

            let contexts: any = {};
            try {
              contexts =
                typeof latestEvent.contexts === 'string'
                  ? JSON.parse(latestEvent.contexts || '{}')
                  : latestEvent.contexts || {};
            } catch {
              contexts = {};
            }

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

  // Check external issue status (e.g. is the GitHub issue closed?)
  app.get(
    '/:projectId/issues/:issueId/external-status',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId, issueId } = request.params as {
        projectId: string;
        issueId: string;
      };
      const { sync } = request.query as { sync?: string };

      try {
        const [issue] = await db('g_argus_issues').where({
          id: issueId,
          project_id: projectId,
        });
        if (!issue || !issue.external_url) {
          return reply.send({ data: { state: 'unknown', message: 'No external issue linked' } });
        }

        // Find a matching tracker config to get the API token
        const trackers = await db('g_argus_issue_trackers')
          .where({ project_id: projectId, enabled: true });

        // Determine provider from URL
        let trackerConfig = null;
        if (issue.external_url.includes('github.com')) {
          const ghTracker = trackers.find((t: any) => t.provider === 'github');
          if (ghTracker) {
            trackerConfig = {
              provider: ghTracker.provider,
              apiUrl: ghTracker.api_url,
              apiToken: ghTracker.api_token,
              config: typeof ghTracker.config === 'string'
                ? JSON.parse(ghTracker.config)
                : ghTracker.config || {},
            };
          }
        }

        if (!trackerConfig) {
          return reply.send({ data: { state: 'unknown', message: 'No matching tracker config found' } });
        }

        const { fetchExternalIssueStatus } = require('../services/trackerAdapter');
        const status = await fetchExternalIssueStatus(issue.external_url, trackerConfig);

        // Auto-sync: bidirectional status mapping
        if (sync === 'true' && (status.state === 'closed' || status.state === 'open')) {
          const targetStatus = status.state === 'closed' ? 'resolved' : 'unresolved';
          const needsStatusUpdate = issue.status !== targetStatus;

          // Update Argus issue status if different
          if (needsStatusUpdate) {
            const updateData: Record<string, any> = { status: targetStatus };
            if (targetStatus === 'resolved') {
              updateData.resolved_at = db.fn.now();
            }
            await db('g_argus_issues').where({ id: issueId, project_id: projectId }).update(updateData);
          }

          // Record activity (deduplicate by comparing last external_state)
          try {
            const [lastSync] = await db('g_argus_issue_activity')
              .where({ project_id: projectId, issue_id: issueId, action: 'external_sync' })
              .orderBy('created_at', 'desc')
              .limit(1);

            const lastState = lastSync?.data?.external_state;
            if (lastState !== status.state) {
              const userName = (request.headers['x-user-name'] as string) || null;
              await db('g_argus_issue_activity').insert({
                project_id: projectId,
                issue_id: issueId,
                user_name: userName,
                action: 'external_sync',
                data: JSON.stringify({
                  from: issue.status,
                  to: targetStatus,
                  source: 'external_tracker',
                  external_state: status.state,
                  url: issue.external_url,
                }),
              });
            }
          } catch (actErr) {
            logger.warn('Failed to record sync activity', {
              error: actErr instanceof Error ? actErr.message : String(actErr),
            });
          }

          logger.info('Auto-synced issue status from external tracker', {
            issueId,
            externalState: status.state,
            targetStatus,
          });
          status.synced = true;
        }

        return reply.send({ data: status });
      } catch (error) {
        logger.error('Failed to check external status', {
          issueId,
          error: error instanceof Error ? error.message : String(error),
        });
        return reply.code(500).send({ error: 'Failed to check external status' });
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
      const { limit = '20', offset = '0' } = request.query as Record<
        string,
        string
      >;

      try {
        const result = await optic.query({
          dataset: 'errors',
          projectId,
          timeRange: { period: '90d' },
          select: [
            { field: 'event_id' },
            { field: 'timestamp' },
            { field: 'platform' },
            { field: 'level' },
            { field: 'type' },
            { field: 'value' },
            { field: 'mechanism' },
            { field: 'exception' },
            { field: 'stacktrace_frames' },
            { field: 'breadcrumbs' },
            { field: 'user_id' },
            { field: 'user_email' },
            { field: 'user_ip' },
            { field: 'user_name' },
            { field: 'environment' },
            { field: 'release' },
            { field: 'transaction' },
            { field: 'os_name' },
            { field: 'os_version' },
            { field: 'browser_name' },
            { field: 'browser_version' },
            { field: 'device_name' },
            { field: 'device_family' },
            { field: 'runtime_name' },
            { field: 'runtime_version' },
            { field: 'sdk_name' },
            { field: 'sdk_version' },
            { field: 'tags' },
            { field: 'extra' },
            { field: 'contexts' },
            { field: 'http_method' },
            { field: 'http_url' },
            { field: 'is_handled' },
            { field: 'fingerprint' },
            { field: 'issue_id' },
          ],
          conditions: [
            { field: 'issue_id', op: '=', value: parseInt(issueId, 10) },
          ],
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

      const bucket = getBucketingConfig(period);
      const { interval, queryParams } = bucket;

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
            fillStart: queryParams.fillStart,
            fillEnd: queryParams.fillEnd,
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
        const chParams = {
          projectId: String(projectId),
          issueId: parseInt(issueId, 10),
        };
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
          tagMap
            .get(row.key)!
            .push({ value: row.value, count: Number(row.cnt) });
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
          projectId,
          issueId,
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

        await db.raw(
          `UPDATE g_argus_issues SET ${updates.join(', ')} WHERE id = ? AND project_id = ?`,
          params
        );

        // Record activity
        const userName = (request.headers['x-user-name'] as string) || null;
        try {
          if (body.status) {
            await db('g_argus_issue_activity').insert({
              project_id: projectId,
              issue_id: issueId,
              user_name: userName,
              action: 'status_change',
              data: JSON.stringify({ to: body.status }),
            });
          }
          if (body.assigned_to !== undefined) {
            await db('g_argus_issue_activity').insert({
              project_id: projectId,
              issue_id: issueId,
              user_name: userName,
              action: 'assign',
              data: JSON.stringify({ to: body.assigned_to }),
            });
          }
          if (body.priority) {
            await db('g_argus_issue_activity').insert({
              project_id: projectId,
              issue_id: issueId,
              user_name: userName,
              action: 'priority_change',
              data: JSON.stringify({ to: body.priority }),
            });
          }
          if (body.external_url !== undefined) {
            await db('g_argus_issue_activity').insert({
              project_id: projectId,
              issue_id: issueId,
              user_name: userName,
              action: body.external_url ? 'external_link' : 'external_unlink',
              data: JSON.stringify({
                url: body.external_url,
                key: body.external_key,
              }),
            });
          }
        } catch (actErr) {
          logger.warn('Failed to record activity', {
            error: actErr instanceof Error ? actErr.message : String(actErr),
          });
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

        await db.raw(
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
          data: { updated: body.issue_ids.length },
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
        return reply
          .code(400)
          .send({ error: 'At least 2 issue IDs are required to merge' });
      }

      try {
        const mergeResult = await db.transaction(async (trx) => {
          // Get all issues sorted by times_seen DESC - the most seen one becomes primary
          const issues = await trx('g_argus_issues')
            .select(
              'id',
              'times_seen',
              'first_seen',
              'last_seen',
              'primary_hash'
            )
            .where('project_id', projectId)
            .whereIn('id', issue_ids)
            .orderBy('times_seen', 'desc');

          if (issues.length < 2) {
            return null; // signal not enough issues
          }

          const primary = issues[0];
          const mergedIds = issues.slice(1).map((i: any) => i.id);

          // Aggregate stats into primary
          const totalTimesSeen = issues.reduce(
            (sum: number, i: any) => sum + i.times_seen,
            0
          );
          const earliestFirstSeen = issues.reduce(
            (earliest: string, i: any) =>
              i.first_seen < earliest ? i.first_seen : earliest,
            issues[0].first_seen
          );
          const latestLastSeen = issues.reduce(
            (latest: string, i: any) =>
              i.last_seen > latest ? i.last_seen : latest,
            issues[0].last_seen
          );

          // Update primary issue
          await trx('g_argus_issues').where('id', primary.id).update({
            times_seen: totalTimesSeen,
            first_seen: earliestFirstSeen,
            last_seen: latestLastSeen,
          });

          // Mark merged issues as "merged" status with reference to primary
          await trx('g_argus_issues')
            .whereIn('id', mergedIds)
            .where('project_id', projectId)
            .update({
              status: 'merged',
              substatus: String(primary.id),
              times_seen: 0,
            });

          return { primary, mergedIds, totalTimesSeen };
        });

        if (!mergeResult) {
          return reply
            .code(404)
            .send({ error: 'Not enough matching issues found' });
        }

        const { primary, mergedIds, totalTimesSeen } = mergeResult;

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
        logger.error('Failed to merge issues', {
          projectId,
          error: error instanceof Error ? error.message : String(error),
        });
        return reply.code(500).send({ error: 'Failed to merge issues' });
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

        const rows = await db('g_argus_issue_activity')
          .where({ project_id: projectId, issue_id: issueId })
          .orderBy('created_at', 'desc')
          .limit(limitVal)
          .offset(offsetVal);
        return reply.send({ data: rows });
      } catch (error) {
        logger.error('Failed to fetch activity', {
          projectId,
          issueId,
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
        await db('g_argus_issue_activity').insert({
          project_id: projectId,
          issue_id: issueId,
          user_name: userName,
          action: 'comment',
          data: JSON.stringify({ text: text.trim() }),
        });
        return reply.send({ success: true });
      } catch (error) {
        logger.error('Failed to add comment', {
          projectId,
          issueId,
          error: error instanceof Error ? error.message : String(error),
        });
        return reply.code(500).send({ error: 'Failed to add comment' });
      }
    }
  );

  // ─── Issues Facets (ClickHouse-based, for sidebar) ───
  // Returns aggregated counts for key dimensions from the errors table.
  // Unlike the per-issue /tags endpoint, this covers ALL issues within
  // the time range, providing facets for the issues list sidebar.
  app.get(
    '/:projectId/issues/facets',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId } = request.params as { projectId: string };
      const {
        period = '14d',
        start,
        end,
      } = request.query as Record<string, string>;

      try {
        const qp: Record<string, any> = {
          projectId: String(projectId),
        };

        const conditions = ['project_id = {projectId:String}'];

        // Time range
        const timeRange = buildTimeRangeConditions(period, start, end);
        conditions.push(...timeRange.conditions);
        Object.assign(qp, timeRange.params);

        const whereClause = conditions.join(' AND ');

        // Query all facet dimensions in parallel
        const facetQueries = [
          { key: 'release', column: 'release' },
          { key: 'environment', column: 'environment' },
          { key: 'browser_name', column: 'browser_name' },
          { key: 'os_name', column: 'os_name' },
        ];

        const results: Record<string, { value: string; count: number }[]> = {};

        await Promise.all(
          facetQueries.map(async ({ key, column }) => {
            try {
              const sql = `
                SELECT ${column} AS value, count() AS count
                FROM argus.errors
                WHERE ${whereClause} AND ${column} != ''
                GROUP BY value
                ORDER BY count DESC
                LIMIT 30
              `;
              const result = await optic.rawQuery({ query: sql, params: qp });
              results[key] = (result.data as any[]).map((r) => ({
                value: String(r.value),
                count: Number(r.count),
              }));
            } catch {
              results[key] = [];
            }
          })
        );

        return reply.send({ data: results });
      } catch (error) {
        logger.error('Failed to get issue facets', {
          projectId,
          error: error instanceof Error ? error.message : String(error),
        });
        return reply.code(500).send({ error: 'Failed to get issue facets' });
      }
    }
  );

  // ─── Issues Attribute Facet (single field value lookup from errors) ───
  // Same pattern as /logs/attribute-facet but queries the errors table.
  // Used by the AQL editor to suggest values for fields like release, environment, etc.
  app.get(
    '/:projectId/issues/attribute-facet',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId } = request.params as { projectId: string };
      const {
        key,
        period = '14d',
        start,
        end,
      } = request.query as Record<string, string>;

      if (!key) {
        return reply.code(400).send({ error: 'key parameter is required' });
      }

      try {
        const qp: Record<string, any> = {
          projectId: String(projectId),
        };

        const conditions = ['project_id = {projectId:String}'];

        const timeRange = buildTimeRangeConditions(period, start, end);
        conditions.push(...timeRange.conditions);
        Object.assign(qp, timeRange.params);

        // Top-level columns that can be queried directly
        const TOP_LEVEL_COLUMNS = new Set([
          'level',
          'type',
          'value',
          'platform',
          'environment',
          'release',
          'transaction',
          'browser_name',
          'os_name',
          'device_name',
          'device_family',
          'runtime_name',
          'sdk_name',
          'server_name',
          'http_method',
          'http_url',
          'user_id',
          'user_email',
        ]);

        const whereClause = conditions.join(' AND ');
        let sql: string;

        if (TOP_LEVEL_COLUMNS.has(key)) {
          sql = `
            SELECT ${key} AS attr_value, count() AS count
            FROM argus.errors
            WHERE ${whereClause} AND ${key} != ''
            GROUP BY attr_value
            ORDER BY count DESC
            LIMIT 30
          `;
        } else {
          // Try tags Map column
          qp.attrKey = key;
          sql = `
            SELECT tags[{attrKey:String}] AS attr_value, count() AS count
            FROM argus.errors
            WHERE ${whereClause}
              AND mapContains(tags, {attrKey:String})
              AND attr_value != ''
            GROUP BY attr_value
            ORDER BY count DESC
            LIMIT 30
          `;
        }

        const result = await optic.rawQuery({ query: sql, params: qp });
        return reply.send({ data: result.data });
      } catch (error) {
        logger.error('Failed to get issue attribute facet', {
          projectId,
          key,
          error: error instanceof Error ? error.message : String(error),
        });
        return reply
          .code(500)
          .send({ error: 'Failed to get issue attribute facet' });
      }
    }
  );
}

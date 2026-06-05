import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { clickhouse } from '../config/clickhouse';
import { mysqlPool } from '../config/mysql';
import { getBucketingConfig } from '../utils/timeBucket';
import { createLogger } from '../utils/logger';

const logger = createLogger('feedback-api');

export default async function feedbackRoutes(app: FastifyInstance) {
  // List user feedback with enriched stats + issue linking
  app.get(
    '/feedback/:projectId',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId } = request.params as { projectId: string };
      const {
        period = '7d', page = '1', limit = '20', search = '', status = '',
        start, end, sort = 'newest',
        filterUrl, filterAssigned, filterEnvironment, filterBrowser, filterOs,
      } = request.query as {
        period?: string; page?: string; limit?: string;
        search?: string; status?: string;
        start?: string; end?: string;
        sort?: string;
        filterUrl?: string; filterAssigned?: string; filterEnvironment?: string;
        filterBrowser?: string; filterOs?: string;
      };

      const bucket = getBucketingConfig(period, start, end);
      const limitNum = parseInt(limit, 10);
      const offset = (parseInt(page, 10) - 1) * limitNum;
      const qp: Record<string, any> = { 
        projectId: String(projectId), 
        limit: limitNum, 
        offset,
        fillStart: bucket.queryParams.fillStart,
        fillEnd: bucket.queryParams.fillEnd
      };

      // Date filter
      const dateClause = `timestamp >= toDateTime({fillStart:UInt32}) AND timestamp <= toDateTime({fillEnd:UInt32})`;

      // Search filter
      const searchClause = search
        ? `AND (message ILIKE {search:String} OR name ILIKE {search:String} OR email ILIKE {search:String})`
        : '';
      if (search) qp.search = `%${search}%`;

      // Status filter
      let statusClause = '';
      if (status === 'unresolved') {
        statusClause = `AND status = 'unresolved' AND is_spam = 0`;
      } else if (status === 'resolved') {
        statusClause = `AND status = 'resolved'`;
      } else if (status === 'spam') {
        statusClause = `AND is_spam = 1`;
      }

      // Structured filters
      let structuredClause = '';
      if (filterUrl) {
        structuredClause += ` AND url ILIKE {filterUrl:String}`;
        qp.filterUrl = `%${filterUrl}%`;
      }
      if (filterAssigned) {
        if (filterAssigned === 'none') {
          structuredClause += ` AND assigned_to = ''`;
        } else {
          structuredClause += ` AND assigned_to = {filterAssigned:String}`;
          qp.filterAssigned = filterAssigned;
        }
      }
      if (filterEnvironment) {
        structuredClause += ` AND environment = {filterEnvironment:String}`;
        qp.filterEnvironment = filterEnvironment;
      }
      if (filterBrowser) {
        structuredClause += ` AND browser = {filterBrowser:String}`;
        qp.filterBrowser = filterBrowser;
      }
      if (filterOs) {
        structuredClause += ` AND os = {filterOs:String}`;
        qp.filterOs = filterOs;
      }

      // Sort
      const orderBy = sort === 'oldest' ? 'timestamp ASC' : 'timestamp DESC';

      try {
        const baseConditionNoStatus = `project_id = {projectId:String} AND ${dateClause} ${searchClause} ${structuredClause}`;
        const whereBase = `${baseConditionNoStatus} ${statusClause}`;

        const [countResult, itemsResult, trendResult, summaryResult] = await Promise.all([
          // Total count
          clickhouse.query({
            query: `SELECT count() AS total FROM argus.user_feedback WHERE ${whereBase}`,
            query_params: qp,
          }),

          // Paginated items
          clickhouse.query({
            query: `SELECT
              feedback_id, event_id, email, name, message, contact_email,
              timestamp AS submitted_at, url,
              status, assigned_to, is_spam, attachments,
              environment, release, source, tags,
              browser, browser_version, os, os_version, device,
              user_id, locale, is_read, category, sentiment
            FROM argus.user_feedback
            WHERE ${whereBase}
            ORDER BY ${orderBy}
            LIMIT {limit:UInt32} OFFSET {offset:UInt32}`,
            query_params: qp,
          }),

          // Trend (daily count)
          clickhouse.query({
            query: `SELECT
              ${bucket.selectExpr} AS day,
              count() AS count
            FROM argus.user_feedback
            WHERE ${whereBase}
            GROUP BY day ORDER BY day ${bucket.fillExpr}`,
            query_params: qp,
          }),

          // Summary stats
          clickhouse.query({
            query: `SELECT
              count() AS total_feedback,
              uniq(email) AS unique_users,
              countIf(contact_email != '') AS with_contact,
              avg(length(message)) AS avg_message_length,
              countIf(status = 'unresolved' AND is_spam = 0) AS unresolved_count,
              countIf(status = 'resolved') AS resolved_count,
              countIf(is_spam = 1) AS spam_count,
              countIf(sentiment = 'positive') AS sentiment_positive,
              countIf(sentiment = 'negative') AS sentiment_negative,
              countIf(sentiment = 'neutral') AS sentiment_neutral,
              countIf(category = 'bug') AS category_bug,
              countIf(category = 'feature_request') AS category_feature,
              countIf(category = 'complaint') AS category_complaint,
              countIf(category = 'praise') AS category_praise,
              countIf(category = 'question') AS category_question
            FROM argus.user_feedback
            WHERE ${baseConditionNoStatus}`,
            query_params: qp,
          }),
        ]);

        const [countData, itemsData, trendData, summaryData] = await Promise.all([
          countResult.json(),
          itemsResult.json(),
          trendResult.json(),
          summaryResult.json(),
        ]);

        // Enrich items with issue info via event_id + manual links
        const items = (itemsData.data || []) as any[];
        const feedbackIds = items.map((i: any) => i.feedback_id).filter(Boolean);
        const eventIds = [...new Set(items.map((i: any) => i.event_id).filter(Boolean))];

        let eventToIssue: Record<string, { id: number; title: string; status: string }> = {};
        let manualLinks: Record<string, number> = {};

        // Manual links from MySQL (take priority)
        if (feedbackIds.length > 0) {
          try {
            await ensureIssueLinkTable();
            const [linkRows] = await mysqlPool.query(
              `SELECT feedback_id, issue_id FROM g_argus_feedback_issue_links WHERE project_id = ? AND feedback_id IN (${feedbackIds.map(() => '?').join(',')})`,
              [projectId, ...feedbackIds]
            );
            for (const row of (linkRows as any[])) {
              manualLinks[row.feedback_id] = row.issue_id;
            }
          } catch (e) {
            logger.warn('Failed to get manual issue links', { error: (e as Error).message });
          }
        }

        // Auto-detected links via event_id
        if (eventIds.length > 0) {
          try {
            const issueResultCH = await clickhouse.query({
              query: `SELECT event_id, issue_id FROM argus.errors
                WHERE project_id = {projectId:String} AND event_id IN ({eventIds:Array(String)})`,
              query_params: { projectId: String(projectId), eventIds },
            });
            const issueDataCH = await issueResultCH.json();
            const eventToIssueId: Record<string, number> = {};
            for (const row of (issueDataCH.data || []) as any[]) {
              eventToIssueId[row.event_id] = Number(row.issue_id);
            }

            // Collect all issue IDs (auto + manual)
            const allIssueIds = [...new Set([
              ...Object.values(eventToIssueId).filter(Boolean),
              ...Object.values(manualLinks).filter(Boolean),
            ])];

            if (allIssueIds.length > 0) {
              const [issueRows] = await mysqlPool.query(
                `SELECT id, title, status FROM g_argus_issues WHERE id IN (${allIssueIds.map(() => '?').join(',')})`,
                [...allIssueIds]
              );
              const issueMap: Record<number, { id: number; title: string; status: string }> = {};
              for (const row of (issueRows as any[])) {
                issueMap[row.id] = { id: row.id, title: row.title, status: row.status };
              }
              for (const [eid, issueId] of Object.entries(eventToIssueId)) {
                if (issueMap[issueId]) {
                  eventToIssue[eid] = issueMap[issueId];
                }
              }
            }
          } catch (e) {
            logger.warn('Failed to enrich feedback with issue data', { error: (e as Error).message });
          }
        }

        // Build issueMap for manual links that weren't fetched yet
        const manualIssueIdsNotFetched = Object.values(manualLinks).filter(id => {
          return id && !Object.values(eventToIssue).some(i => i.id === id);
        });
        let extraIssueMap: Record<number, { id: number; title: string; status: string }> = {};
        if (manualIssueIdsNotFetched.length > 0) {
          try {
            const [rows] = await mysqlPool.query(
              `SELECT id, title, status FROM g_argus_issues WHERE id IN (${manualIssueIdsNotFetched.map(() => '?').join(',')})`,
              [...manualIssueIdsNotFetched]
            );
            for (const row of (rows as any[])) {
              extraIssueMap[row.id] = { id: row.id, title: row.title, status: row.status };
            }
          } catch { /* ok */ }
        }

        const enrichedItems = items.map((item: any) => {
          // Manual link takes priority
          const manualIssueId = manualLinks[item.feedback_id];
          if (manualIssueId) {
            const issue = Object.values(eventToIssue).find(i => i.id === manualIssueId) || extraIssueMap[manualIssueId];
            return {
              ...item,
              issue_id: issue?.id || manualIssueId,
              issue_title: issue?.title || null,
              issue_status: issue?.status || null,
              attachments: item.attachments || [],
            };
          }
          // Auto link via event_id
          const issue = item.event_id ? eventToIssue[item.event_id] : null;
          return {
            ...item,
            issue_id: issue?.id || null,
            issue_title: issue?.title || null,
            issue_status: issue?.status || null,
            attachments: item.attachments || [],
          };
        });

        return reply.send({
          data: {
            items: enrichedItems,
            total: Number((countData.data as any[])?.[0]?.total || 0),
            trend: trendData.data || [],
            summary: (summaryData.data as any[])?.[0] || {},
          },
        });
      } catch (error) {
        logger.error('Failed to get feedback', {
          projectId,
          error: error instanceof Error ? error.message : String(error),
        });
        return reply.code(500).send({ error: 'Failed to get feedback' });
      }
    }
  );

  // Get feedbacks linked to a specific issue
  app.get(
    '/feedback/:projectId/by-issue/:issueId',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId, issueId } = request.params as { projectId: string; issueId: string };
      try {
        await ensureIssueLinkTable();

        // 1) Get manually linked feedback IDs from MySQL
        const [linkRows] = await mysqlPool.query(
          'SELECT feedback_id FROM g_argus_feedback_issue_links WHERE project_id = ? AND issue_id = ?',
          [projectId, Number(issueId)]
        );
        const feedbackIds = (linkRows as any[]).map(r => r.feedback_id);

        if (feedbackIds.length === 0) {
          return reply.send({ data: [] });
        }

        // 2) Fetch feedback details from ClickHouse
        const result = await clickhouse.query({
          query: `SELECT * FROM argus.user_feedback
            WHERE project_id = {projectId:String}
              AND feedback_id IN ({feedbackIds:Array(String)})
            ORDER BY timestamp DESC`,
          query_params: { projectId: String(projectId), feedbackIds },
        });
        const data = await result.json();

        return reply.send({ data: data.data || [] });
      } catch (error) {
        logger.error('Failed to get feedbacks by issue', {
          projectId, issueId,
          error: error instanceof Error ? error.message : String(error),
        });
        return reply.code(500).send({ error: 'Failed to get feedbacks by issue' });
      }
    }
  );

  // Update feedback status / assignee
  app.patch(
    '/feedback/:projectId/:feedbackId',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId, feedbackId } = request.params as { projectId: string; feedbackId: string };
      const body = request.body as { status?: string; assigned_to?: string; is_spam?: boolean };

      try {
        const setClauses: string[] = [];
        const params: Record<string, any> = { projectId: String(projectId), feedbackId };

        if (body.status) {
          setClauses.push('status = {status:String}');
          params.status = body.status;
          if (body.status === 'resolved') {
            setClauses.push('resolved_at = now()');
          }
        }
        if (body.assigned_to !== undefined) {
          setClauses.push('assigned_to = {assigned_to:String}');
          params.assigned_to = body.assigned_to;
        }
        if (body.is_spam !== undefined) {
          setClauses.push('is_spam = {is_spam:UInt8}');
          params.is_spam = body.is_spam ? 1 : 0;
          if (body.is_spam) {
            setClauses.push("status = 'spam'");
          }
        }

        if (setClauses.length === 0) {
          return reply.code(400).send({ error: 'No fields to update' });
        }

        await clickhouse.command({
          query: `ALTER TABLE argus.user_feedback UPDATE ${setClauses.join(', ')}
            WHERE project_id = {projectId:String} AND feedback_id = {feedbackId:String}`,
          query_params: params,
        });

        // Record activity
        try {
          await ensureActivityTable();
          if (body.status) {
            await mysqlPool.query(
              'INSERT INTO g_argus_feedback_activity (project_id, feedback_id, action, data, created_at) VALUES (?, ?, ?, ?, UTC_TIMESTAMP())',
              [projectId, feedbackId, 'status_change', JSON.stringify({ from: '', to: body.status })]
            );
          }
          if (body.assigned_to !== undefined) {
            await mysqlPool.query(
              'INSERT INTO g_argus_feedback_activity (project_id, feedback_id, action, data, created_at) VALUES (?, ?, ?, ?, UTC_TIMESTAMP())',
              [projectId, feedbackId, 'assign', JSON.stringify({ assigned_to: body.assigned_to })]
            );
          }
          if (body.is_spam !== undefined) {
            await mysqlPool.query(
              'INSERT INTO g_argus_feedback_activity (project_id, feedback_id, action, data, created_at) VALUES (?, ?, ?, ?, UTC_TIMESTAMP())',
              [projectId, feedbackId, body.is_spam ? 'mark_spam' : 'unmark_spam', null]
            );
          }
        } catch (e) {
          logger.warn('Failed to record feedback activity', { error: (e as Error).message });
        }

        return reply.send({ success: true });
      } catch (error) {
        logger.error('Failed to update feedback', { projectId, feedbackId, error: (error as Error).message });
        return reply.code(500).send({ error: 'Failed to update feedback' });
      }
    }
  );

  // Bulk action (resolve / spam / assign)
  app.post(
    '/feedback/:projectId/bulk',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId } = request.params as { projectId: string };
      const body = request.body as {
        feedback_ids: string[];
        action: 'resolve' | 'unresolve' | 'spam' | 'not_spam' | 'assign';
        assigned_to?: string;
      };

      if (!body.feedback_ids?.length) {
        return reply.code(400).send({ error: 'No feedback IDs provided' });
      }

      try {
        let setClauses: string;
        const params: Record<string, any> = {
          projectId: String(projectId),
          ids: body.feedback_ids,
        };

        switch (body.action) {
          case 'resolve':
            setClauses = "status = 'resolved', resolved_at = now()";
            break;
          case 'unresolve':
            setClauses = "status = 'unresolved', resolved_at = NULL";
            break;
          case 'spam':
            setClauses = "is_spam = 1, status = 'spam'";
            break;
          case 'not_spam':
            setClauses = "is_spam = 0, status = 'unresolved'";
            break;
          case 'assign':
            setClauses = 'assigned_to = {assigned_to:String}';
            params.assigned_to = body.assigned_to || '';
            break;
          default:
            return reply.code(400).send({ error: 'Invalid action' });
        }

        await clickhouse.command({
          query: `ALTER TABLE argus.user_feedback UPDATE ${setClauses}
            WHERE project_id = {projectId:String} AND feedback_id IN ({ids:Array(String)})`,
          query_params: params,
        });

        return reply.send({ success: true, affected: body.feedback_ids.length });
      } catch (error) {
        logger.error('Failed to bulk update feedback', { projectId, error: (error as Error).message });
        return reply.code(500).send({ error: 'Failed to bulk update feedback' });
      }
    }
  );

  // Upload attachments for feedback
  app.post(
    '/feedback/:projectId/:feedbackId/attachments',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId, feedbackId } = request.params as { projectId: string; feedbackId: string };

      try {
        const parts = await request.files();
        const urls: string[] = [];

        const fs = require('fs');
        const path = require('path');
        const uploadDir = path.join(process.cwd(), 'uploads', 'feedback', projectId);

        if (!fs.existsSync(uploadDir)) {
          fs.mkdirSync(uploadDir, { recursive: true });
        }

        for await (const part of parts) {
          const filename = `${feedbackId}_${Date.now()}_${part.filename}`;
          const filepath = path.join(uploadDir, filename);
          const buffer = await part.toBuffer();
          fs.writeFileSync(filepath, buffer);
          urls.push(`/uploads/feedback/${projectId}/${filename}`);
        }

        if (urls.length > 0) {
          // Append to existing attachments array
          const urlValues = urls.map(u => `'${u}'`).join(', ');
          await clickhouse.command({
            query: `ALTER TABLE argus.user_feedback UPDATE
              attachments = arrayConcat(attachments, [${urlValues}])
              WHERE project_id = {projectId:String} AND feedback_id = {feedbackId:String}`,
            query_params: { projectId: String(projectId), feedbackId },
          });
        }

        return reply.send({ success: true, urls });
      } catch (error) {
        logger.error('Failed to upload attachments', { projectId, feedbackId, error: (error as Error).message });
        return reply.code(500).send({ error: 'Failed to upload attachments' });
      }
    }
  );

  // ─── Spam Filter Keywords CRUD ───

  // Get spam keywords for a project
  app.get(
    '/feedback/:projectId/spam-keywords',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId } = request.params as { projectId: string };
      try {
        const [rows] = await mysqlPool.query(
          'SELECT * FROM g_argus_spam_keywords WHERE project_id = ? ORDER BY created_at DESC',
          [projectId]
        );
        return reply.send({ data: rows });
      } catch (error: any) {
        if (error?.code === 'ER_NO_SUCH_TABLE') {
          // Auto-create the table if it doesn't exist
          await mysqlPool.query(`
            CREATE TABLE IF NOT EXISTS g_argus_spam_keywords (
              id INT AUTO_INCREMENT PRIMARY KEY,
              project_id VARCHAR(64) NOT NULL,
              keyword VARCHAR(255) NOT NULL,
              is_regex TINYINT(1) DEFAULT 0,
              created_at DATETIME DEFAULT (UTC_TIMESTAMP()),
              INDEX idx_project (project_id)
            )
          `);
          return reply.send({ data: [] });
        }
        logger.error('Failed to get spam keywords', { projectId, error: (error as Error).message });
        return reply.code(500).send({ error: 'Failed to get spam keywords' });
      }
    }
  );

  // Add spam keyword
  app.post(
    '/feedback/:projectId/spam-keywords',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId } = request.params as { projectId: string };
      const { keyword, is_regex } = request.body as { keyword: string; is_regex?: boolean };

      if (!keyword?.trim()) {
        return reply.code(400).send({ error: 'keyword is required' });
      }

      try {
        // Ensure table exists
        await mysqlPool.query(`
          CREATE TABLE IF NOT EXISTS g_argus_spam_keywords (
            id INT AUTO_INCREMENT PRIMARY KEY,
            project_id VARCHAR(64) NOT NULL,
            keyword VARCHAR(255) NOT NULL,
            is_regex TINYINT(1) DEFAULT 0,
            created_at DATETIME DEFAULT (UTC_TIMESTAMP()),
            INDEX idx_project (project_id)
          )
        `);

        const [result] = await mysqlPool.query(
          'INSERT INTO g_argus_spam_keywords (project_id, keyword, is_regex) VALUES (?, ?, ?)',
          [projectId, keyword.trim(), is_regex ? 1 : 0]
        );

        return reply.code(201).send({ data: { id: (result as any).insertId } });
      } catch (error) {
        logger.error('Failed to add spam keyword', { projectId, error: (error as Error).message });
        return reply.code(500).send({ error: 'Failed to add spam keyword' });
      }
    }
  );

  // Delete spam keyword
  app.delete(
    '/feedback/:projectId/spam-keywords/:keywordId',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId, keywordId } = request.params as { projectId: string; keywordId: string };

      try {
        await mysqlPool.query(
          'DELETE FROM g_argus_spam_keywords WHERE id = ? AND project_id = ?',
          [keywordId, projectId]
        );
        return reply.send({ success: true });
      } catch (error) {
        logger.error('Failed to delete spam keyword', { error: (error as Error).message });
        return reply.code(500).send({ error: 'Failed to delete spam keyword' });
      }
    }
  );

  // Run auto-spam scan: mark matching feedback as spam
  app.post(
    '/feedback/:projectId/auto-spam',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId } = request.params as { projectId: string };

      try {
        // Get keywords
        const [keywords] = await mysqlPool.query(
          'SELECT keyword, is_regex FROM g_argus_spam_keywords WHERE project_id = ?',
          [projectId]
        );
        const kws = keywords as any[];
        if (kws.length === 0) {
          return reply.send({ matched: 0, message: 'No spam keywords configured' });
        }

        // Build ClickHouse conditions
        const conditions = kws.map(k => {
          if (k.is_regex) {
            return `match(message, '${k.keyword.replace(/'/g, "\\'")}')`;
          }
          return `positionCaseInsensitive(message, '${k.keyword.replace(/'/g, "\\'")}') > 0`;
        });
        const whereClause = conditions.join(' OR ');

        // Count matches first
        const countResult = await clickhouse.query({
          query: `SELECT count() as cnt FROM argus.user_feedback
                  WHERE project_id = {projectId:String}
                  AND status = 'unresolved'
                  AND (${whereClause})`,
          query_params: { projectId: String(projectId) },
          format: 'JSONEachRow',
        });
        const countRows = await countResult.json() as any[];
        const matchedCount = Number(countRows[0]?.cnt || 0);

        if (matchedCount > 0) {
          // Update matched feedback to spam
          await clickhouse.command({
            query: `ALTER TABLE argus.user_feedback UPDATE
                    status = 'spam', is_spam = 1
                    WHERE project_id = {projectId:String}
                    AND status = 'unresolved'
                    AND (${whereClause})`,
            query_params: { projectId: String(projectId) },
          });
        }

        logger.info('Auto-spam scan completed', { projectId, matched: matchedCount });
        return reply.send({ matched: matchedCount });
      } catch (error) {
        logger.error('Auto-spam scan failed', { projectId, error: (error as Error).message });
        return reply.code(500).send({ error: 'Auto-spam scan failed' });
      }
    }
  );

  // ─── Feedback Filter Options ───

  // Get distinct filter values for feedback
  app.get(
    '/feedback/:projectId/filter-options',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId } = request.params as { projectId: string };
      const { period = '30d' } = request.query as { period?: string };

      const bucket = getBucketingConfig(period);
      const qp: Record<string, any> = { 
        projectId: String(projectId),
        fillStart: bucket.queryParams.fillStart,
        fillEnd: bucket.queryParams.fillEnd
      };
      const timeCond = `timestamp >= toDateTime({fillStart:UInt32}) AND timestamp <= toDateTime({fillEnd:UInt32})`;

      try {
        const [envResult, browserResult, osResult, assignedResult] = await Promise.all([
          clickhouse.query({
            query: `SELECT DISTINCT environment FROM argus.user_feedback
              WHERE project_id = {projectId:String} AND ${timeCond}
              AND environment != '' ORDER BY environment`,
            query_params: qp,
          }),
          clickhouse.query({
            query: `SELECT DISTINCT browser FROM argus.user_feedback
              WHERE project_id = {projectId:String} AND ${timeCond}
              AND browser != '' ORDER BY browser`,
            query_params: qp,
          }),
          clickhouse.query({
            query: `SELECT DISTINCT os FROM argus.user_feedback
              WHERE project_id = {projectId:String} AND ${timeCond}
              AND os != '' ORDER BY os`,
            query_params: qp,
          }),
          clickhouse.query({
            query: `SELECT DISTINCT assigned_to FROM argus.user_feedback
              WHERE project_id = {projectId:String} AND ${timeCond}
              AND assigned_to != '' ORDER BY assigned_to`,
            query_params: qp,
          }),
        ]);

        const [envData, browserData, osData, assignedData] = await Promise.all([
          envResult.json(), browserResult.json(), osResult.json(), assignedResult.json(),
        ]);

        return reply.send({
          data: {
            environments: ((envData.data || []) as any[]).map((r: any) => r.environment),
            browsers: ((browserData.data || []) as any[]).map((r: any) => r.browser),
            os: ((osData.data || []) as any[]).map((r: any) => r.os),
            assigned: ((assignedData.data || []) as any[]).map((r: any) => r.assigned_to),
          },
        });
      } catch (error) {
        logger.error('Failed to get feedback filter options', {
          projectId,
          error: error instanceof Error ? error.message : String(error),
        });
        return reply.code(500).send({ error: 'Failed to get feedback filter options' });
      }
    }
  );

  // ─── Mark Feedback as Read ───

  app.post(
    '/feedback/:projectId/mark-read',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId } = request.params as { projectId: string };
      const { feedback_ids } = request.body as { feedback_ids: string[] };

      if (!feedback_ids?.length) {
        return reply.code(400).send({ error: 'No feedback IDs provided' });
      }

      try {
        await clickhouse.command({
          query: `ALTER TABLE argus.user_feedback UPDATE is_read = 1
            WHERE project_id = {projectId:String} AND feedback_id IN ({ids:Array(String)})`,
          query_params: { projectId: String(projectId), ids: feedback_ids },
        });
        return reply.send({ success: true });
      } catch (error) {
        logger.error('Failed to mark feedback as read', {
          projectId,
          error: (error as Error).message,
        });
        return reply.code(500).send({ error: 'Failed to mark feedback as read' });
      }
    }
  );

  // ─── Feedback Activity History ───

  app.get(
    '/feedback/:projectId/:feedbackId/activity',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId, feedbackId } = request.params as { projectId: string; feedbackId: string };

      try {
        await ensureActivityTable();
        const { limit, offset } = request.query as Record<string, string>;
        const limitVal = limit ? parseInt(limit, 10) : 50;
        const offsetVal = offset ? parseInt(offset, 10) : 0;

        const [rows] = await mysqlPool.query(
          `SELECT * FROM g_argus_feedback_activity
           WHERE project_id = ? AND feedback_id = ?
           ORDER BY created_at DESC LIMIT ? OFFSET ?`,
          [projectId, feedbackId, limitVal, offsetVal]
        );
        return reply.send({ data: rows });
      } catch (error) {
        logger.error('Failed to get feedback activity', {
          projectId, feedbackId,
          error: (error as Error).message,
        });
        return reply.code(500).send({ error: 'Failed to get feedback activity' });
      }
    }
  );

  // ─── Add Comment to Feedback ───

  app.post(
    '/feedback/:projectId/:feedbackId/comment',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId, feedbackId } = request.params as { projectId: string; feedbackId: string };
      const { text, user_name } = request.body as { text: string; user_name?: string };

      if (!text?.trim()) {
        return reply.code(400).send({ error: 'Comment text is required' });
      }

      try {
        await ensureActivityTable();
        const [result] = await mysqlPool.query(
          'INSERT INTO g_argus_feedback_activity (project_id, feedback_id, user_name, action, data, created_at) VALUES (?, ?, ?, ?, ?, UTC_TIMESTAMP())',
          [projectId, feedbackId, user_name || null, 'comment', JSON.stringify({ text: text.trim() })]
        );
        return reply.code(201).send({ data: { id: (result as any).insertId } });
      } catch (error) {
        logger.error('Failed to add feedback comment', {
          projectId, feedbackId,
          error: (error as Error).message,
        });
        return reply.code(500).send({ error: 'Failed to add feedback comment' });
      }
    }
  );

  // ─── Link / Unlink Issue to Feedback ───

  app.patch(
    '/feedback/:projectId/:feedbackId/link-issue',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId, feedbackId } = request.params as { projectId: string; feedbackId: string };
      const { issue_id } = request.body as { issue_id: number | null };

      try {
        await ensureIssueLinkTable();

        if (issue_id) {
          // Upsert link
          await mysqlPool.query(
            `INSERT INTO g_argus_feedback_issue_links (project_id, feedback_id, issue_id)
             VALUES (?, ?, ?)
             ON DUPLICATE KEY UPDATE issue_id = VALUES(issue_id), updated_at = UTC_TIMESTAMP()`,
            [projectId, feedbackId, issue_id]
          );
          logger.info('Linked feedback to issue', { projectId, feedbackId, issueId: issue_id });
        } else {
          // Unlink
          await mysqlPool.query(
            'DELETE FROM g_argus_feedback_issue_links WHERE project_id = ? AND feedback_id = ?',
            [projectId, feedbackId]
          );
          logger.info('Unlinked feedback from issue', { projectId, feedbackId });
        }

        return reply.send({ success: true });
      } catch (error) {
        logger.error('Failed to link/unlink feedback issue', {
          projectId, feedbackId,
          error: (error as Error).message,
        });
        return reply.code(500).send({ error: 'Failed to link/unlink issue' });
      }
    }
  );
}

let activityTableChecked = false;
async function ensureActivityTable(): Promise<void> {
  if (activityTableChecked) return;
  try {
    await mysqlPool.query(`
      CREATE TABLE IF NOT EXISTS g_argus_feedback_activity (
        id INT AUTO_INCREMENT PRIMARY KEY,
        project_id VARCHAR(64) NOT NULL,
        feedback_id VARCHAR(64) NOT NULL,
        user_name VARCHAR(255) DEFAULT NULL,
        action ENUM('status_change','assign','comment','mark_spam','unmark_spam') NOT NULL,
        data JSON DEFAULT NULL,
        created_at DATETIME DEFAULT (UTC_TIMESTAMP()),
        INDEX idx_feedback (project_id, feedback_id),
        INDEX idx_created (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    activityTableChecked = true;
  } catch (e) {
    logger.warn('Failed to ensure activity table', { error: (e as Error).message });
  }
}

let issueLinkTableChecked = false;
async function ensureIssueLinkTable(): Promise<void> {
  if (issueLinkTableChecked) return;
  try {
    await mysqlPool.query(`
      CREATE TABLE IF NOT EXISTS g_argus_feedback_issue_links (
        id INT AUTO_INCREMENT PRIMARY KEY,
        project_id VARCHAR(64) NOT NULL,
        feedback_id VARCHAR(64) NOT NULL,
        issue_id INT NOT NULL,
        created_at DATETIME DEFAULT (UTC_TIMESTAMP()),
        updated_at DATETIME DEFAULT (UTC_TIMESTAMP()) ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_feedback (project_id, feedback_id),
        INDEX idx_issue (issue_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    issueLinkTableChecked = true;
  } catch (e) {
    logger.warn('Failed to ensure issue link table', { error: (e as Error).message });
  }
}

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { clickhouse } from '../config/clickhouse';
import { mysqlPool } from '../config/mysql';
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
        filterUrl, filterAssigned, filterEnvironment,
      } = request.query as {
        period?: string; page?: string; limit?: string;
        search?: string; status?: string;
        start?: string; end?: string;
        sort?: string;
        filterUrl?: string; filterAssigned?: string; filterEnvironment?: string;
      };

      const limitNum = parseInt(limit, 10);
      const offset = (parseInt(page, 10) - 1) * limitNum;
      const qp: Record<string, any> = { projectId: String(projectId), limit: limitNum, offset };

      // Date filter
      let dateClause: string;
      if (start && end) {
        dateClause = `timestamp >= {startDate:String} AND timestamp <= {endDate:String}`;
        qp.startDate = start;
        qp.endDate = end;
      } else {
        const interval = periodToInterval(period);
        dateClause = `timestamp >= now() - INTERVAL ${interval}`;
      }

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

      // Sort
      const orderBy = sort === 'oldest' ? 'timestamp ASC' : 'timestamp DESC';

      try {
        const whereBase = `project_id = {projectId:String} AND ${dateClause} ${searchClause} ${statusClause} ${structuredClause}`;

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
              environment, release, source, tags
            FROM argus.user_feedback
            WHERE ${whereBase}
            ORDER BY ${orderBy}
            LIMIT {limit:UInt32} OFFSET {offset:UInt32}`,
            query_params: qp,
          }),

          // Trend (daily count)
          clickhouse.query({
            query: `SELECT
              toStartOfDay(timestamp) AS day,
              count() AS count
            FROM argus.user_feedback
            WHERE ${whereBase}
            GROUP BY day ORDER BY day`,
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
              countIf(is_spam = 1) AS spam_count
            FROM argus.user_feedback
            WHERE project_id = {projectId:String} AND ${dateClause}`,
            query_params: qp,
          }),
        ]);

        const [countData, itemsData, trendData, summaryData] = await Promise.all([
          countResult.json(),
          itemsResult.json(),
          trendResult.json(),
          summaryResult.json(),
        ]);

        // Enrich items with issue info via event_id
        const items = (itemsData.data || []) as any[];
        const eventIds = [...new Set(items.map((i: any) => i.event_id).filter(Boolean))];

        let eventToIssue: Record<string, { id: number; title: string; status: string }> = {};
        if (eventIds.length > 0) {
          try {
            // Step 1: Get issue_ids for event_ids from ClickHouse (argus.errors)
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

            // Step 2: Get issue details from MySQL (g_argus_issues)
            const issueIds = [...new Set(Object.values(eventToIssueId).filter(Boolean))];
            if (issueIds.length > 0) {
              const [issueRows] = await mysqlPool.query(
                `SELECT id, title, status FROM g_argus_issues WHERE id IN (${issueIds.map(() => '?').join(',')})`,
                [...issueIds]
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

        const enrichedItems = items.map((item: any) => {
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
              project_id INT NOT NULL,
              keyword VARCHAR(255) NOT NULL,
              is_regex TINYINT(1) DEFAULT 0,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
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
            project_id INT NOT NULL,
            keyword VARCHAR(255) NOT NULL,
            is_regex TINYINT(1) DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
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
}

function periodToInterval(period: string): string {
  const map: Record<string, string> = {
    '1h': '1 HOUR',
    '6h': '6 HOUR',
    '24h': '24 HOUR',
    '7d': '7 DAY',
    '14d': '14 DAY',
    '30d': '30 DAY',
    '90d': '90 DAY',
  };
  return map[period] || '7 DAY';
}

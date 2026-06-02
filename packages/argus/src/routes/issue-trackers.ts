import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { mysqlPool } from '../config/mysql';
import { createLogger } from '../utils/logger';
import { createExternalIssue, testTrackerConnection, type TrackerConfig, type IssuePayload } from '../services/trackerAdapter';

const logger = createLogger('issue-trackers-api');

export default async function issueTrackersRoutes(app: FastifyInstance) {
  // Ensure table exists
  const ensureTable = async () => {
    await mysqlPool.query(`
      CREATE TABLE IF NOT EXISTS g_argus_issue_trackers (
        id INT AUTO_INCREMENT PRIMARY KEY,
        project_id VARCHAR(64) NOT NULL,
        provider ENUM('jira', 'github', 'linear') NOT NULL,
        name VARCHAR(255) NOT NULL,
        api_url VARCHAR(512) NOT NULL,
        api_token VARCHAR(512) NOT NULL,
        config JSON DEFAULT NULL,
        enabled TINYINT(1) DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_project (project_id)
      )
    `);
  };

  // List issue trackers for a project
  app.get(
    '/:projectId/issue-trackers',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId } = request.params as { projectId: string };
      try {
        await ensureTable();
        const [rows] = await mysqlPool.query(
          'SELECT id, project_id, provider, name, api_url, config, enabled, created_at, updated_at FROM g_argus_issue_trackers WHERE project_id = ? ORDER BY created_at DESC',
          [projectId]
        );
        // Mask tokens - never send to frontend
        const masked = (rows as any[]).map(r => ({
          ...r,
          config: typeof r.config === 'string' ? JSON.parse(r.config) : r.config,
        }));
        return reply.send({ data: masked });
      } catch (error) {
        logger.error('Failed to list issue trackers', { projectId, error: (error as Error).message });
        return reply.code(500).send({ error: 'Failed to list issue trackers' });
      }
    }
  );

  // Create issue tracker
  app.post(
    '/:projectId/issue-trackers',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId } = request.params as { projectId: string };
      const body = request.body as {
        provider: 'jira' | 'github' | 'linear';
        name: string;
        api_url: string;
        api_token: string;
        config?: Record<string, any>;
      };

      if (!body.provider || !body.name || !body.api_url || !body.api_token) {
        return reply.code(400).send({ error: 'provider, name, api_url, and api_token are required' });
      }

      try {
        await ensureTable();
        const [result] = await mysqlPool.query(
          `INSERT INTO g_argus_issue_trackers (project_id, provider, name, api_url, api_token, config)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            projectId,
            body.provider,
            body.name,
            body.api_url,
            body.api_token,
            body.config ? JSON.stringify(body.config) : null,
          ]
        );
        const insertId = (result as any).insertId;
        logger.info('Issue tracker created', { projectId, id: insertId, provider: body.provider });
        return reply.code(201).send({ data: { id: insertId } });
      } catch (error) {
        logger.error('Failed to create issue tracker', { projectId, error: (error as Error).message });
        return reply.code(500).send({ error: 'Failed to create issue tracker' });
      }
    }
  );

  // Update issue tracker
  app.put(
    '/:projectId/issue-trackers/:trackerId',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId, trackerId } = request.params as { projectId: string; trackerId: string };
      const body = request.body as {
        name?: string;
        api_url?: string;
        api_token?: string;
        config?: Record<string, any>;
        enabled?: boolean;
      };

      try {
        const updates: string[] = [];
        const params: any[] = [];

        if (body.name !== undefined) { updates.push('name = ?'); params.push(body.name); }
        if (body.api_url !== undefined) { updates.push('api_url = ?'); params.push(body.api_url); }
        if (body.api_token !== undefined) { updates.push('api_token = ?'); params.push(body.api_token); }
        if (body.config !== undefined) { updates.push('config = ?'); params.push(JSON.stringify(body.config)); }
        if (body.enabled !== undefined) { updates.push('enabled = ?'); params.push(body.enabled ? 1 : 0); }

        if (updates.length === 0) {
          return reply.code(400).send({ error: 'No fields to update' });
        }

        params.push(trackerId, projectId);
        await mysqlPool.query(
          `UPDATE g_argus_issue_trackers SET ${updates.join(', ')} WHERE id = ? AND project_id = ?`,
          params
        );

        return reply.send({ success: true });
      } catch (error) {
        logger.error('Failed to update issue tracker', { trackerId, error: (error as Error).message });
        return reply.code(500).send({ error: 'Failed to update issue tracker' });
      }
    }
  );

  // Delete issue tracker
  app.delete(
    '/:projectId/issue-trackers/:trackerId',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId, trackerId } = request.params as { projectId: string; trackerId: string };
      try {
        await mysqlPool.query(
          'DELETE FROM g_argus_issue_trackers WHERE id = ? AND project_id = ?',
          [trackerId, projectId]
        );
        return reply.send({ success: true });
      } catch (error) {
        logger.error('Failed to delete issue tracker', { trackerId, error: (error as Error).message });
        return reply.code(500).send({ error: 'Failed to delete issue tracker' });
      }
    }
  );

  // Test connection
  app.post(
    '/:projectId/issue-trackers/:trackerId/test',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId, trackerId } = request.params as { projectId: string; trackerId: string };
      try {
        const [rows] = await mysqlPool.query(
          'SELECT * FROM g_argus_issue_trackers WHERE id = ? AND project_id = ?',
          [trackerId, projectId]
        );
        const tracker = (rows as any[])[0];
        if (!tracker) {
          return reply.code(404).send({ error: 'Tracker not found' });
        }

        const config: TrackerConfig = {
          provider: tracker.provider,
          apiUrl: tracker.api_url,
          apiToken: tracker.api_token,
          config: typeof tracker.config === 'string' ? JSON.parse(tracker.config) : (tracker.config || {}),
        };

        const result = await testTrackerConnection(config);
        return reply.send({ data: result });
      } catch (error) {
        logger.error('Failed to test tracker connection', { trackerId, error: (error as Error).message });
        return reply.code(500).send({ error: 'Connection test failed' });
      }
    }
  );

  // Create issue on external tracker (called from issues route)
  app.post(
    '/:projectId/issue-trackers/:trackerId/create-issue',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId, trackerId } = request.params as { projectId: string; trackerId: string };
      const body = request.body as IssuePayload;

      try {
        const [rows] = await mysqlPool.query(
          'SELECT * FROM g_argus_issue_trackers WHERE id = ? AND project_id = ?',
          [trackerId, projectId]
        );
        const tracker = (rows as any[])[0];
        if (!tracker) {
          return reply.code(404).send({ error: 'Tracker not found' });
        }
        if (!tracker.enabled) {
          return reply.code(400).send({ error: 'Tracker is disabled' });
        }

        const config: TrackerConfig = {
          provider: tracker.provider,
          apiUrl: tracker.api_url,
          apiToken: tracker.api_token,
          config: typeof tracker.config === 'string' ? JSON.parse(tracker.config) : (tracker.config || {}),
        };

        const result = await createExternalIssue(config, body);
        logger.info('External issue created', { trackerId, provider: tracker.provider, url: result.url, key: result.key });
        return reply.send({ data: result });
      } catch (error) {
        logger.error('Failed to create external issue', { trackerId, error: (error as Error).message });
        return reply.code(500).send({ error: `Failed to create issue: ${(error as Error).message}` });
      }
    }
  );
}

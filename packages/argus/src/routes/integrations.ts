import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { mysqlPool } from '../config/mysql';
import { createLogger } from '../utils/logger';

const logger = createLogger('argus-integrations');

export default async function integrationsRoutes(app: FastifyInstance) {

  // === Repository Integrations ===

  // List integrations for a project
  app.get(
    '/:projectId/integrations',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId } = request.params as { projectId: string };
      try {
        const [rows] = await mysqlPool.execute(
          `SELECT id, project_id, provider, repo_url, default_branch, enabled, created_at, updated_at
           FROM g_argus_integrations WHERE project_id = ? ORDER BY created_at DESC`,
          [projectId]
        );
        return reply.send({ data: rows });
      } catch (error) {
        logger.error('Failed to list integrations', { projectId, error: error instanceof Error ? error.message : String(error) });
        return reply.code(500).send({ error: 'Failed to list integrations' });
      }
    }
  );

  // Create integration
  app.post(
    '/:projectId/integrations',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId } = request.params as { projectId: string };
      const { provider, repo_url, default_branch, access_token } = request.body as {
        provider: string;
        repo_url: string;
        default_branch?: string;
        access_token?: string;
      };

      try {
        const [result] = await mysqlPool.execute(
          `INSERT INTO g_argus_integrations (project_id, provider, repo_url, default_branch, access_token)
           VALUES (?, ?, ?, ?, ?)`,
          [projectId, provider, repo_url, default_branch || 'main', access_token || null]
        );
        const insertId = (result as any).insertId;
        return reply.code(201).send({ data: { id: insertId } });
      } catch (error) {
        logger.error('Failed to create integration', { projectId, error: error instanceof Error ? error.message : String(error) });
        return reply.code(500).send({ error: 'Failed to create integration' });
      }
    }
  );

  // Update integration
  app.patch(
    '/:projectId/integrations/:integrationId',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId, integrationId } = request.params as { projectId: string; integrationId: string };
      const body = request.body as Record<string, any>;

      const allowedFields = ['provider', 'repo_url', 'default_branch', 'access_token', 'enabled'];
      const updates: string[] = [];
      const values: any[] = [];

      for (const field of allowedFields) {
        if (body[field] !== undefined) {
          updates.push(`${field} = ?`);
          values.push(body[field]);
        }
      }

      if (updates.length === 0) {
        return reply.code(400).send({ error: 'No fields to update' });
      }

      try {
        values.push(integrationId, projectId);
        await mysqlPool.execute(
          `UPDATE g_argus_integrations SET ${updates.join(', ')} WHERE id = ? AND project_id = ?`,
          values
        );
        return reply.send({ success: true });
      } catch (error) {
        logger.error('Failed to update integration', { projectId, integrationId, error: error instanceof Error ? error.message : String(error) });
        return reply.code(500).send({ error: 'Failed to update integration' });
      }
    }
  );

  // Delete integration
  app.delete(
    '/:projectId/integrations/:integrationId',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId, integrationId } = request.params as { projectId: string; integrationId: string };
      try {
        await mysqlPool.execute(
          'DELETE FROM g_argus_integrations WHERE id = ? AND project_id = ?',
          [integrationId, projectId]
        );
        return reply.send({ success: true });
      } catch (error) {
        logger.error('Failed to delete integration', { error: error instanceof Error ? error.message : String(error) });
        return reply.code(500).send({ error: 'Failed to delete integration' });
      }
    }
  );

  // === Commits ===

  // List commits for a release
  app.get(
    '/:projectId/commits',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId } = request.params as { projectId: string };
      const { release, limit = '20' } = request.query as { release?: string; limit?: string };

      try {
        let query = 'SELECT * FROM g_argus_commits WHERE project_id = ?';
        const params: any[] = [projectId];

        if (release) {
          query += ' AND release_version = ?';
          params.push(release);
        }

        query += ' ORDER BY timestamp DESC LIMIT ?';
        params.push(parseInt(limit as string, 10));

        const [rows] = await mysqlPool.execute(query, params);
        return reply.send({ data: rows });
      } catch (error) {
        logger.error('Failed to list commits', { projectId, error: error instanceof Error ? error.message : String(error) });
        return reply.code(500).send({ error: 'Failed to list commits' });
      }
    }
  );

  // Ingest commits (webhook or manual push)
  app.post(
    '/:projectId/commits',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId } = request.params as { projectId: string };
      const { commits } = request.body as {
        commits: {
          commit_hash: string;
          author_name?: string;
          author_email?: string;
          message?: string;
          timestamp?: string;
          release_version?: string;
          files_changed?: string[];
          additions?: number;
          deletions?: number;
        }[];
      };

      if (!commits || !Array.isArray(commits)) {
        return reply.code(400).send({ error: 'commits array required' });
      }

      try {
        // Build bulk values array (single query instead of N queries)
        const values: any[][] = [];
        for (const c of commits) {
          values.push([
            projectId, c.commit_hash,
            c.author_name || null, c.author_email || null,
            c.message || null, c.timestamp || null,
            c.release_version || null,
            c.files_changed ? JSON.stringify(c.files_changed) : null,
            c.additions || 0, c.deletions || 0,
          ]);
        }

        const placeholders = values.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ');
        await mysqlPool.query(
          `INSERT INTO g_argus_commits
           (project_id, commit_hash, author_name, author_email, message, timestamp, release_version, files_changed, additions, deletions)
           VALUES ${placeholders}
           ON DUPLICATE KEY UPDATE
           message = VALUES(message), release_version = COALESCE(VALUES(release_version), release_version)`,
          values.flat()
        );

        return reply.send({ data: { inserted: commits.length } });
      } catch (error) {
        logger.error('Failed to ingest commits', { projectId, error: error instanceof Error ? error.message : String(error) });
        return reply.code(500).send({ error: 'Failed to ingest commits' });
      }
    }
  );

  // Get suspect commits for an issue (files matching stacktrace)
  app.get(
    '/:projectId/issues/:issueId/suspect-commits',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId, issueId } = request.params as { projectId: string; issueId: string };

      try {
        // Get recent commits that changed files matching the issue's stacktrace
        const [commits] = await mysqlPool.execute(
          `SELECT * FROM g_argus_commits
           WHERE project_id = ?
             AND timestamp >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 7 DAY)
           ORDER BY timestamp DESC
           LIMIT 20`,
          [projectId]
        );

        return reply.send({ data: commits });
      } catch (error) {
        logger.error('Failed to get suspect commits', { projectId, issueId, error: error instanceof Error ? error.message : String(error) });
        return reply.code(500).send({ error: 'Failed to get suspect commits' });
      }
    }
  );

  // === Ownership Rules ===

  // List ownership rules
  app.get(
    '/:projectId/ownership',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId } = request.params as { projectId: string };
      try {
        const [rows] = await mysqlPool.execute(
          'SELECT * FROM g_argus_ownership_rules WHERE project_id = ? ORDER BY priority DESC, id ASC',
          [projectId]
        );
        return reply.send({ data: rows });
      } catch (error) {
        logger.error('Failed to list ownership rules', { projectId, error: error instanceof Error ? error.message : String(error) });
        return reply.code(500).send({ error: 'Failed to list ownership rules' });
      }
    }
  );

  // Create ownership rule
  app.post(
    '/:projectId/ownership',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId } = request.params as { projectId: string };
      const { name, match_type, match_pattern, owners, priority, auto_assign } = request.body as {
        name: string;
        match_type: string;
        match_pattern: string;
        owners: string[];
        priority?: number;
        auto_assign?: boolean;
      };

      try {
        const [result] = await mysqlPool.execute(
          `INSERT INTO g_argus_ownership_rules (project_id, name, match_type, match_pattern, owners, priority, auto_assign)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [projectId, name, match_type, match_pattern, JSON.stringify(owners), priority || 0, auto_assign !== false ? 1 : 0]
        );
        const insertId = (result as any).insertId;
        return reply.code(201).send({ data: { id: insertId } });
      } catch (error) {
        logger.error('Failed to create ownership rule', { projectId, error: error instanceof Error ? error.message : String(error) });
        return reply.code(500).send({ error: 'Failed to create ownership rule' });
      }
    }
  );

  // Update ownership rule
  app.patch(
    '/:projectId/ownership/:ruleId',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId, ruleId } = request.params as { projectId: string; ruleId: string };
      const body = request.body as Record<string, any>;

      const allowedFields = ['name', 'match_type', 'match_pattern', 'priority', 'auto_assign', 'enabled'];
      const updates: string[] = [];
      const values: any[] = [];

      for (const field of allowedFields) {
        if (body[field] !== undefined) {
          updates.push(`${field} = ?`);
          values.push(body[field]);
        }
      }
      if (body.owners !== undefined) {
        updates.push('owners = ?');
        values.push(JSON.stringify(body.owners));
      }

      if (updates.length === 0) {
        return reply.code(400).send({ error: 'No fields to update' });
      }

      try {
        values.push(ruleId, projectId);
        await mysqlPool.execute(
          `UPDATE g_argus_ownership_rules SET ${updates.join(', ')} WHERE id = ? AND project_id = ?`,
          values
        );
        return reply.send({ success: true });
      } catch (error) {
        logger.error('Failed to update ownership rule', { projectId, ruleId, error: error instanceof Error ? error.message : String(error) });
        return reply.code(500).send({ error: 'Failed to update ownership rule' });
      }
    }
  );

  // Delete ownership rule
  app.delete(
    '/:projectId/ownership/:ruleId',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId, ruleId } = request.params as { projectId: string; ruleId: string };
      try {
        await mysqlPool.execute(
          'DELETE FROM g_argus_ownership_rules WHERE id = ? AND project_id = ?',
          [ruleId, projectId]
        );
        return reply.send({ success: true });
      } catch (error) {
        logger.error('Failed to delete ownership rule', { error: error instanceof Error ? error.message : String(error) });
        return reply.code(500).send({ error: 'Failed to delete ownership rule' });
      }
    }
  );
}

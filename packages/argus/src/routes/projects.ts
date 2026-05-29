import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import * as crypto from 'crypto';
import { mysqlPool } from '../config/mysql';
import { createLogger } from '../utils/logger';

const logger = createLogger('projects-api');

export default async function projectsRoutes(app: FastifyInstance) {
  // List all Argus projects
  app.get(
    '/projects',
    async (_request: FastifyRequest, reply: FastifyReply) => {
      try {
        const [rows] = await mysqlPool.query(
          `SELECT p.*, 
            (SELECT COUNT(*) FROM g_argus_issues WHERE project_id = p.id AND status = 'unresolved') as unresolved_issues,
            (SELECT COUNT(*) FROM g_argus_dsnKeys WHERE project_id = p.id AND is_active = 1) as active_dsn_count
           FROM g_argus_projects p
           ORDER BY p.updated_at DESC`
        );
        return reply.send({ data: rows });
      } catch (error) {
        logger.error('Failed to list projects', {
          error: error instanceof Error ? error.message : String(error),
        });
        return reply.code(500).send({ error: 'Failed to list projects' });
      }
    }
  );

  // Create a new Argus project
  app.post(
    '/projects',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const body = request.body as {
        gatrix_project_id: string;
        name: string;
        slug: string;
        platform?: string;
      };

      if (!body.gatrix_project_id || !body.name || !body.slug) {
        return reply.code(400).send({
          error: 'Bad Request',
          message: 'gatrix_project_id, name, and slug are required',
        });
      }

      const connection = await mysqlPool.getConnection();
      try {
        await connection.beginTransaction();

        // Create project
        const [result] = await connection.query(
          `INSERT INTO g_argus_projects (gatrix_project_id, name, slug, platform)
           VALUES (?, ?, ?, ?)`,
          [body.gatrix_project_id, body.name, body.slug, body.platform || 'javascript']
        );
        const projectId = (result as any).insertId;

        // Auto-generate default DSN key
        const publicKey = generateKey(32);
        const secretKey = generateKey(32);

        await connection.query(
          `INSERT INTO g_argus_dsnKeys (project_id, label, public_key, secret_key)
           VALUES (?, 'Default', ?, ?)`,
          [projectId, publicKey, secretKey]
        );

        await connection.commit();

        // Fetch the created project with DSN
        const [rows] = await mysqlPool.query(
          `SELECT p.*, d.public_key, d.secret_key
           FROM g_argus_projects p
           JOIN g_argus_dsnKeys d ON d.project_id = p.id
           WHERE p.id = ?`,
          [projectId]
        );

        const project = (rows as any[])[0];

        logger.info('Project created', {
          projectId,
          slug: body.slug,
        });

        return reply.code(201).send({
          data: {
            ...project,
            dsn: buildDsnUrl(project.public_key, projectId),
          },
        });
      } catch (error: any) {
        await connection.rollback();
        if (error.code === 'ER_DUP_ENTRY') {
          return reply.code(409).send({
            error: 'Conflict',
            message: 'Project with this gatrix_project_id or slug already exists',
          });
        }
        logger.error('Failed to create project', {
          error: error instanceof Error ? error.message : String(error),
        });
        return reply.code(500).send({ error: 'Failed to create project' });
      } finally {
        connection.release();
      }
    }
  );

  // Get project detail
  app.get(
    '/projects/:projectId',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId } = request.params as { projectId: string };

      try {
        const [rows] = await mysqlPool.query(
          'SELECT * FROM g_argus_projects WHERE id = ?',
          [projectId]
        );
        const results = rows as any[];
        if (results.length === 0) {
          return reply.code(404).send({ error: 'Project not found' });
        }

        // Get DSN keys
        const [dsnRows] = await mysqlPool.query(
          'SELECT id, label, public_key, is_active, rate_limit_window, rate_limit_count, created_at FROM g_argus_dsnKeys WHERE project_id = ?',
          [projectId]
        );

        const project = results[0];
        project.dsn_keys = (dsnRows as any[]).map((d: any) => ({
          ...d,
          dsn: buildDsnUrl(d.public_key, parseInt(projectId, 10)),
        }));

        return reply.send({ data: project });
      } catch (error) {
        logger.error('Failed to get project', {
          projectId,
          error: error instanceof Error ? error.message : String(error),
        });
        return reply.code(500).send({ error: 'Failed to get project' });
      }
    }
  );

  // Update project settings
  app.patch(
    '/projects/:projectId',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId } = request.params as { projectId: string };
      const body = request.body as {
        name?: string;
        platform?: string;
        error_quota_daily?: number;
        transaction_sample_rate?: number;
        session_sample_rate?: number;
        retention_days?: number;
      };

      const updates: string[] = [];
      const params: any[] = [];

      if (body.name) { updates.push('name = ?'); params.push(body.name); }
      if (body.platform) { updates.push('platform = ?'); params.push(body.platform); }
      if (body.error_quota_daily !== undefined) { updates.push('error_quota_daily = ?'); params.push(body.error_quota_daily); }
      if (body.transaction_sample_rate !== undefined) { updates.push('transaction_sample_rate = ?'); params.push(body.transaction_sample_rate); }
      if (body.session_sample_rate !== undefined) { updates.push('session_sample_rate = ?'); params.push(body.session_sample_rate); }
      if (body.retention_days !== undefined) { updates.push('retention_days = ?'); params.push(body.retention_days); }

      if (updates.length === 0) {
        return reply.code(400).send({ error: 'No fields to update' });
      }

      params.push(projectId);

      try {
        await mysqlPool.query(
          `UPDATE g_argus_projects SET ${updates.join(', ')} WHERE id = ?`,
          params
        );
        return reply.send({ success: true });
      } catch (error) {
        logger.error('Failed to update project', {
          projectId,
          error: error instanceof Error ? error.message : String(error),
        });
        return reply.code(500).send({ error: 'Failed to update project' });
      }
    }
  );

  // --- DSN Key Management ---

  // Create new DSN key for a project
  app.post(
    '/projects/:projectId/dsn-keys',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId } = request.params as { projectId: string };
      const body = request.body as { label?: string };

      const publicKey = generateKey(32);
      const secretKey = generateKey(32);

      try {
        const [result] = await mysqlPool.query(
          `INSERT INTO g_argus_dsnKeys (project_id, label, public_key, secret_key)
           VALUES (?, ?, ?, ?)`,
          [projectId, body.label || 'Default', publicKey, secretKey]
        );

        const dsnKeyId = (result as any).insertId;

        return reply.code(201).send({
          data: {
            id: dsnKeyId,
            label: body.label || 'Default',
            public_key: publicKey,
            secret_key: secretKey,
            dsn: buildDsnUrl(publicKey, parseInt(projectId, 10)),
          },
        });
      } catch (error) {
        logger.error('Failed to create DSN key', {
          projectId,
          error: error instanceof Error ? error.message : String(error),
        });
        return reply.code(500).send({ error: 'Failed to create DSN key' });
      }
    }
  );

  // Revoke DSN key
  app.delete(
    '/projects/:projectId/dsn-keys/:keyId',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId, keyId } = request.params as {
        projectId: string;
        keyId: string;
      };

      try {
        await mysqlPool.query(
          'UPDATE g_argus_dsnKeys SET is_active = 0 WHERE id = ? AND project_id = ?',
          [keyId, projectId]
        );
        return reply.send({ success: true });
      } catch (error) {
        logger.error('Failed to revoke DSN key', {
          projectId,
          keyId,
          error: error instanceof Error ? error.message : String(error),
        });
        return reply.code(500).send({ error: 'Failed to revoke DSN key' });
      }
    }
  );

  // --- Stats ---

  // Get project error stats from ClickHouse
  app.get(
    '/projects/:projectId/stats',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId } = request.params as { projectId: string };
      const { period = '24h' } = request.query as { period?: string };

      const periodMap: Record<string, string> = {
        '1h': '1 HOUR',
        '24h': '24 HOUR',
        '7d': '7 DAY',
        '30d': '30 DAY',
      };
      const interval = periodMap[period] || '24 HOUR';

      try {
        const { clickhouse } = await import('../config/clickhouse');

        const result = await clickhouse.query({
          query: `
            SELECT
              toStartOfHour(timestamp) AS hour,
              count() AS event_count,
              uniq(user_id) AS affected_users
            FROM argus.errors
            WHERE project_id = {projectId:String}
              AND timestamp >= now() - INTERVAL ${interval}
            GROUP BY hour
            ORDER BY hour
          `,
          query_params: { projectId: String(projectId) },
        });

        const stats = await result.json();
        return reply.send({ data: stats.data });
      } catch (error) {
        logger.error('Failed to get project stats', {
          projectId,
          error: error instanceof Error ? error.message : String(error),
        });
        return reply.code(500).send({ error: 'Failed to get stats' });
      }
    }
  );
}

function generateKey(length: number): string {
  return crypto.randomBytes(length).toString('hex').slice(0, length);
}

function buildDsnUrl(publicKey: string, projectId: number): string {
  // DSN format: https://<publicKey>@<host>/argus/<projectId>
  const host = process.env.ARGUS_PUBLIC_HOST || 'localhost:45300';
  const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';
  return `${protocol}://${publicKey}@${host}/argus/${projectId}`;
}

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import * as crypto from 'crypto';
import { mysqlPool } from '../config/mysql';
import { clickhouse } from '../config/clickhouse';
import { createLogger } from '../utils/logger';
import { getBucketingConfig } from '../utils/timeBucket';

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
            dsn: buildDsnUrl(project.public_key, project.gatrix_project_id),
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
        const isNumeric = /^\d+$/.test(projectId);
        const [rows] = await mysqlPool.query(
          isNumeric
            ? 'SELECT * FROM g_argus_projects WHERE id = ?'
            : 'SELECT * FROM g_argus_projects WHERE gatrix_project_id = ?',
          [projectId]
        );
        const results = rows as any[];
        if (results.length === 0) {
          return reply.code(404).send({ error: 'Project not found' });
        }

        // Get DSN keys
        const [dsnRows] = await mysqlPool.query(
          'SELECT id, label, public_key, is_active, rate_limit_window, rate_limit_count, first_seen, last_seen, created_at FROM g_argus_dsnKeys WHERE project_id = ?',
          [projectId]
        );

        const project = results[0];
        project.dsn_keys = (dsnRows as any[]).map((d: any) => ({
          ...d,
          dsn: buildDsnUrl(d.public_key, project.gatrix_project_id),
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
      const isNumeric = /^\d+$/.test(projectId);
      const whereCol = isNumeric ? 'id' : 'gatrix_project_id';

      try {
        await mysqlPool.query(
          `UPDATE g_argus_projects SET ${updates.join(', ')} WHERE ${whereCol} = ?`,
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
      const body = request.body as { 
        label?: string;
        rate_limit_count?: number;
        rate_limit_window?: number;
      };

      const publicKey = generateKey(32);
      const secretKey = generateKey(32);

      try {
        const [result] = await mysqlPool.query(
          `INSERT INTO g_argus_dsnKeys (project_id, label, public_key, secret_key, rate_limit_count, rate_limit_window)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [projectId, body.label || 'Default', publicKey, secretKey, body.rate_limit_count ?? 0, body.rate_limit_window ?? 0]
        );

        const dsnKeyId = (result as any).insertId;

        const [projRows] = await mysqlPool.query('SELECT gatrix_project_id FROM g_argus_projects WHERE id = ?', [projectId]);
        const gatrixProjectId = (projRows as any[])[0]?.gatrix_project_id || projectId;

        return reply.code(201).send({
          data: {
            id: dsnKeyId,
            label: body.label || 'Default',
            public_key: publicKey,
            secret_key: secretKey,
            rate_limit_count: body.rate_limit_count ?? 0,
            rate_limit_window: body.rate_limit_window ?? 0,
            dsn: buildDsnUrl(publicKey, gatrixProjectId),
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

  // Hard Delete DSN key
  app.delete(
    '/projects/:projectId/dsn-keys/:keyId/hard',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId, keyId } = request.params as {
        projectId: string;
        keyId: string;
      };

      try {
        await mysqlPool.query(
          'DELETE FROM g_argus_dsnKeys WHERE id = ? AND project_id = ?',
          [keyId, projectId]
        );
        return reply.send({ success: true });
      } catch (error) {
        logger.error('Failed to hard delete DSN key', {
          projectId,
          keyId,
          error: error instanceof Error ? error.message : String(error),
        });
        return reply.code(500).send({ error: 'Failed to delete DSN key' });
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

  // Update DSN key
  app.patch(
    '/projects/:projectId/dsn-keys/:keyId',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId, keyId } = request.params as {
        projectId: string;
        keyId: string;
      };
      const body = request.body as { 
        label?: string;
        rate_limit_count?: number;
        rate_limit_window?: number;
      };

      if (!body.label || !body.label.trim()) {
        return reply.code(400).send({ error: 'Bad Request', message: 'Label is required' });
      }

      try {
        const updates: string[] = ['label = ?'];
        const params: any[] = [body.label.trim()];

        if (body.rate_limit_count !== undefined) {
          updates.push('rate_limit_count = ?');
          params.push(body.rate_limit_count);
        }
        if (body.rate_limit_window !== undefined) {
          updates.push('rate_limit_window = ?');
          params.push(body.rate_limit_window);
        }

        params.push(keyId, projectId);

        await mysqlPool.query(
          `UPDATE g_argus_dsnKeys SET ${updates.join(', ')} WHERE id = ? AND project_id = ?`,
          params
        );
        return reply.send({ success: true });
      } catch (error) {
        logger.error('Failed to update DSN key', {
          projectId,
          keyId,
          error: error instanceof Error ? error.message : String(error),
        });
        return reply.code(500).send({ error: 'Failed to rename DSN key' });
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

      const bucket = getBucketingConfig(period);

      try {
        const result = await clickhouse.query({
          query: `
            SELECT
              ${bucket.selectExpr} AS hour,
              count() AS event_count,
              uniq(user_id) AS affected_users
            FROM argus.errors
            WHERE project_id = {projectId:String}
              AND timestamp >= toDateTime({fillStart:UInt32}) AND timestamp <= toDateTime({fillEnd:UInt32})
            GROUP BY hour
            ORDER BY hour ${bucket.fillExpr}
          `,
          query_params: { projectId: String(projectId), fillStart: bucket.queryParams.fillStart, fillEnd: bucket.queryParams.fillEnd },
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

  // Get DSN key usage stats from ClickHouse
  app.get(
    '/projects/:projectId/dsn-keys/:keyId/stats',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId, keyId } = request.params as {
        projectId: string;
        keyId: string;
      };
      const { period = '7d' } = request.query as { period?: string };

      const bucket = getBucketingConfig(period);

      try {
        // Query errors
        const errorsResult = await clickhouse.query({
          query: `
            SELECT
              ${bucket.selectExpr} AS ts,
              count() AS accepted
            FROM argus.errors
            WHERE project_id = {projectId:String}
              AND dsn_key_id = {dsnKeyId:UInt32}
              AND timestamp >= toDateTime({fillStart:UInt32}) AND timestamp <= toDateTime({fillEnd:UInt32})
            GROUP BY ts
            ORDER BY ts ${bucket.fillExpr}
          `,
          query_params: { projectId: String(projectId), dsnKeyId: Number(keyId), fillStart: bucket.queryParams.fillStart, fillEnd: bucket.queryParams.fillEnd },
        });

        // Query transactions
        const txnResult = await clickhouse.query({
          query: `
            SELECT
              ${bucket.selectExpr} AS ts,
              count() AS accepted
            FROM argus.transactions
            WHERE project_id = {projectId:String}
              AND dsn_key_id = {dsnKeyId:UInt32}
              AND timestamp >= toDateTime({fillStart:UInt32}) AND timestamp <= toDateTime({fillEnd:UInt32})
            GROUP BY ts
            ORDER BY ts ${bucket.fillExpr}
          `,
          query_params: { projectId: String(projectId), dsnKeyId: Number(keyId), fillStart: bucket.queryParams.fillStart, fillEnd: bucket.queryParams.fillEnd },
        });

        const errors = (await errorsResult.json()).data as { ts: string; accepted: string }[];
        const transactions = (await txnResult.json()).data as { ts: string; accepted: string }[];

        // Merge into unified timeline
        const timeMap = new Map<string, { errors: number; transactions: number }>();
        for (const row of errors) {
          const entry = timeMap.get(row.ts) || { errors: 0, transactions: 0 };
          entry.errors = Number(row.accepted);
          timeMap.set(row.ts, entry);
        }
        for (const row of transactions) {
          const entry = timeMap.get(row.ts) || { errors: 0, transactions: 0 };
          entry.transactions = Number(row.accepted);
          timeMap.set(row.ts, entry);
        }

        const data = Array.from(timeMap.entries())
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([ts, counts]) => ({ timestamp: ts, ...counts }));

        const totals = data.reduce(
          (acc, d) => ({ errors: acc.errors + d.errors, transactions: acc.transactions + d.transactions }),
          { errors: 0, transactions: 0 }
        );

        return reply.send({ data, totals });
      } catch (error) {
        logger.error('Failed to get DSN key stats', {
          projectId,
          keyId,
          error: error instanceof Error ? error.message : String(error),
        });
        return reply.code(500).send({ error: 'Failed to get DSN key stats' });
      }
    }
  );
}

function generateKey(length: number): string {
  return crypto.randomBytes(length).toString('hex').slice(0, length);
}

function buildDsnUrl(publicKey: string, projectId: string | number): string {
  // DSN format: https://<publicKey>@<host>/argus/<projectId>
  const host = process.env.ARGUS_PUBLIC_HOST || 'localhost:45300';
  const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';
  return `${protocol}://${publicKey}@${host}/argus/${projectId}`;
}

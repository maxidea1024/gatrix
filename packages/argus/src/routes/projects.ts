import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import * as crypto from 'crypto';
import db from '../config/knex';
import { redis } from '../config/redis';
import { optic } from '@gatrix/argus-optic';
import { getBucketingConfig } from '../utils/timeBucket';
import { createLogger } from '../utils/logger';
import { ConfigBroadcaster } from '../utils/config-broadcaster';
import { CONFIG_TYPES } from '../config/redis-keys';

const logger = createLogger('projects-api');
const broadcaster = new ConfigBroadcaster(redis);

export default async function projectsRoutes(app: FastifyInstance) {
  // List all Argus projects
  app.get(
    '/projects',
    async (_request: FastifyRequest, reply: FastifyReply) => {
      try {
        const rows = await db('g_argus_projects as p')
          .select(
            'p.*',
            db.raw(
              "(SELECT COUNT(*) FROM g_argus_issues WHERE project_id = p.id AND status = 'unresolved') as unresolved_issues"
            ),
            db.raw(
              '(SELECT COUNT(*) FROM g_argus_dsnKeys WHERE project_id = p.id AND is_active = 1) as active_dsn_count'
            )
          )
          .orderBy('p.updated_at', 'desc');
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

      let projectId: string = '';
      let publicKey: string;
      let secretKey: string;

      try {
        // Auto-generate default DSN key
        publicKey = generateKey(32);
        secretKey = generateKey(32);

        await db.transaction(async (trx) => {
          const [id] = await trx('g_argus_projects').insert({
            gatrix_project_id: body.gatrix_project_id,
            name: body.name,
            slug: body.slug,
            platform: body.platform || 'javascript',
          });
          projectId = String(id);

          await trx('g_argus_dsnKeys').insert({
            project_id: projectId,
            label: 'Default',
            public_key: publicKey,
            secret_key: secretKey,
          });
        });

        const rows = await db('g_argus_projects as p')
          .select('p.*', 'd.public_key', 'd.secret_key')
          .join('g_argus_dsnKeys as d', 'd.project_id', 'p.id')
          .where('p.id', projectId!);

        const project = rows[0];

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
        if (error.code === 'ER_DUP_ENTRY') {
          return reply.code(409).send({
            error: 'Conflict',
            message:
              'Project with this gatrix_project_id or slug already exists',
          });
        }
        logger.error('Failed to create project', {
          error: error instanceof Error ? error.message : String(error),
        });
        return reply.code(500).send({ error: 'Failed to create project' });
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
        const results = await db('g_argus_projects').where(
          isNumeric ? 'id' : 'gatrix_project_id',
          projectId
        );
        if (results.length === 0) {
          return reply.code(404).send({ error: 'Project not found' });
        }

        // Get DSN keys
        const dsnRows = await db('g_argus_dsnKeys')
          .select(
            'id',
            'label',
            'public_key',
            'is_active',
            'rate_limit_window',
            'rate_limit_count',
            'first_seen',
            'last_seen',
            'created_at'
          )
          .where('project_id', projectId);

        const project = results[0];
        project.dsn_keys = dsnRows.map((d: any) => ({
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
        metrics_group_limit?: number;
        analytics_breakdown_limit?: number;
      };

      const updates: string[] = [];
      const params: any[] = [];

      if (body.name) {
        updates.push('name = ?');
        params.push(body.name);
      }
      if (body.platform) {
        updates.push('platform = ?');
        params.push(body.platform);
      }
      if (body.error_quota_daily !== undefined) {
        updates.push('error_quota_daily = ?');
        params.push(body.error_quota_daily);
      }
      if (body.transaction_sample_rate !== undefined) {
        updates.push('transaction_sample_rate = ?');
        params.push(body.transaction_sample_rate);
      }
      if (body.session_sample_rate !== undefined) {
        updates.push('session_sample_rate = ?');
        params.push(body.session_sample_rate);
      }
      if (body.retention_days !== undefined) {
        updates.push('retention_days = ?');
        params.push(body.retention_days);
      }
      if (body.metrics_group_limit !== undefined) {
        updates.push('metrics_group_limit = ?');
        params.push(body.metrics_group_limit);
      }
      if (body.analytics_breakdown_limit !== undefined) {
        updates.push('analytics_breakdown_limit = ?');
        params.push(body.analytics_breakdown_limit);
      }

      if (updates.length === 0) {
        return reply.code(400).send({ error: 'No fields to update' });
      }

      const isNumeric = /^\d+$/.test(projectId);
      const whereCol = isNumeric ? 'id' : 'gatrix_project_id';
      const updateObj: any = {};
      if (body.name) updateObj.name = body.name;
      if (body.platform) updateObj.platform = body.platform;
      if (body.error_quota_daily !== undefined)
        updateObj.error_quota_daily = body.error_quota_daily;
      if (body.transaction_sample_rate !== undefined)
        updateObj.transaction_sample_rate = body.transaction_sample_rate;
      if (body.session_sample_rate !== undefined)
        updateObj.session_sample_rate = body.session_sample_rate;
      if (body.retention_days !== undefined)
        updateObj.retention_days = body.retention_days;
      if (body.metrics_group_limit !== undefined)
        updateObj.metrics_group_limit = body.metrics_group_limit;
      if (body.analytics_breakdown_limit !== undefined)
        updateObj.analytics_breakdown_limit = body.analytics_breakdown_limit;

      try {
        await db('g_argus_projects')
          .where(whereCol, projectId)
          .update(updateObj);

        // Notify workers of project settings change
        await broadcaster.publish({
          type: CONFIG_TYPES.PROJECT_SETTINGS,
          projectId,
        });

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
        const [dsnKeyId] = await db('g_argus_dsnKeys').insert({
          project_id: projectId,
          label: body.label || 'Default',
          public_key: publicKey,
          secret_key: secretKey,
          rate_limit_count: body.rate_limit_count ?? 0,
          rate_limit_window: body.rate_limit_window ?? 0,
        });

        const projRows = await db('g_argus_projects')
          .select('gatrix_project_id')
          .where('id', projectId);
        const gatrixProjectId = projRows[0]?.gatrix_project_id || projectId;

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

        // Notify workers to reload DSN cache (after response)
        broadcaster
          .publish({ type: CONFIG_TYPES.DSN_KEYS, projectId })
          .catch(() => {});
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
        await db('g_argus_dsnKeys')
          .where({ id: keyId, project_id: projectId })
          .del();

        // Notify workers to reload DSN cache
        await broadcaster.publish({ type: CONFIG_TYPES.DSN_KEYS, projectId });

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
        await db('g_argus_dsnKeys')
          .where({ id: keyId, project_id: projectId })
          .update({ is_active: 0 });

        // Notify workers to reload DSN cache
        await broadcaster.publish({ type: CONFIG_TYPES.DSN_KEYS, projectId });

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
        return reply
          .code(400)
          .send({ error: 'Bad Request', message: 'Label is required' });
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

        const dsnUpdateObj: any = { label: body.label!.trim() };
        if (body.rate_limit_count !== undefined)
          dsnUpdateObj.rate_limit_count = body.rate_limit_count;
        if (body.rate_limit_window !== undefined)
          dsnUpdateObj.rate_limit_window = body.rate_limit_window;

        await db('g_argus_dsnKeys')
          .where({ id: keyId, project_id: projectId })
          .update(dsnUpdateObj);

        // Notify workers to reload DSN cache
        await broadcaster.publish({ type: CONFIG_TYPES.DSN_KEYS, projectId });

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

      try {
        const result = await optic.query({
          dataset: 'errors',
          projectId,
          timeRange: { period },
          select: [
            { field: '$bucket', alias: 'hour' },
            { field: 'count()', alias: 'event_count' },
            { field: 'uniq(user_id)', alias: 'affected_users' },
          ],
          groupBy: ['$bucket'],
          orderBy: [{ field: 'hour', direction: 'ASC' }],
          withFill: true,
        });

        return reply.send({ data: result.data });
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
      const {
        period = '7d',
        start,
        end,
      } = request.query as { period?: string; start?: string; end?: string };

      const bucket = getBucketingConfig(period, start, end);
      const rawParams = {
        projectId: String(projectId),
        dsnKeyId: Number(keyId),
        fillStart: bucket.queryParams.fillStart,
        fillEnd: bucket.queryParams.fillEnd,
      };

      try {
        // dsn_key_id filter is not a standard AQL field, use rawQuery
        const [errorsResult, txnResult] = await Promise.all([
          optic.rawQuery({
            query: `SELECT ${bucket.selectExpr} AS ts, count() AS accepted
              FROM argus.errors
              WHERE project_id = {projectId:String}
                AND dsn_key_id = {dsnKeyId:UInt32}
                AND timestamp >= toDateTime({fillStart:UInt32}) AND timestamp <= toDateTime({fillEnd:UInt32})
              GROUP BY ts ORDER BY ts ${bucket.fillExpr}`,
            params: rawParams,
          }),
          optic.rawQuery({
            query: `SELECT ${bucket.selectExpr} AS ts, count() AS accepted
              FROM argus.transactions
              WHERE project_id = {projectId:String}
                AND dsn_key_id = {dsnKeyId:UInt32}
                AND timestamp >= toDateTime({fillStart:UInt32}) AND timestamp <= toDateTime({fillEnd:UInt32})
              GROUP BY ts ORDER BY ts ${bucket.fillExpr}`,
            params: rawParams,
          }),
        ]);

        const errors = errorsResult.data as { ts: string; accepted: string }[];
        const transactions = txnResult.data as {
          ts: string;
          accepted: string;
        }[];

        // Merge into unified timeline
        const timeMap = new Map<
          string,
          { errors: number; transactions: number }
        >();
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
          (acc, d) => ({
            errors: acc.errors + d.errors,
            transactions: acc.transactions + d.transactions,
          }),
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

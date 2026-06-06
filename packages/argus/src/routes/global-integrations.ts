import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import db from '../config/knex';
import { createLogger } from '../utils/logger';

const logger = createLogger('argus-global-integrations');

export default async function globalIntegrationsRoutes(app: FastifyInstance) {
  // Initialize table
  try {
    await db.raw(`
      CREATE TABLE IF NOT EXISTS g_argus_global_integrations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        provider VARCHAR(50) NOT NULL,
        name VARCHAR(100) DEFAULT NULL,
        url VARCHAR(255) DEFAULT NULL,
        credentials JSON DEFAULT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY idx_provider_url (provider, url)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    logger.info('g_argus_global_integrations table ensured');
  } catch (error) {
    logger.error('Failed to ensure g_argus_global_integrations table', {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  // Check if provider is configured
  app.get(
    '/global-integrations/:provider/config',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { provider } = request.params as { provider: string };
      try {
        const rows = await db('g_argus_global_integrations')
          .select('id', 'name', 'url', 'is_active', 'created_at', 'updated_at')
          .where({ provider, is_active: 1 })
          .limit(1);
        const configured = rows.length > 0;
        return reply.send({ data: { configured, config: rows[0] || null } });
      } catch (error) {
        logger.error('Failed to check global integration config', {
          provider,
          error: error instanceof Error ? error.message : String(error),
        });
        return reply.code(500).send({ error: 'Failed to check config' });
      }
    }
  );

  // Save provider configuration
  app.post(
    '/global-integrations/:provider/config',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { provider } = request.params as { provider: string };
      const body = request.body as {
        name?: string;
        url?: string;
        credentials: any;
      };

      if (!body.credentials) {
        return reply.code(400).send({ error: 'credentials are required' });
      }

      try {
        await db.raw(
          `INSERT INTO g_argus_global_integrations (provider, name, url, credentials)
           VALUES (?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
           name = VALUES(name), credentials = VALUES(credentials), is_active = 1`,
          [
            provider,
            body.name || null,
            body.url || null,
            JSON.stringify(body.credentials),
          ]
        );
        return reply.code(200).send({ success: true });
      } catch (error) {
        logger.error('Failed to save global integration config', {
          provider,
          error: error instanceof Error ? error.message : String(error),
        });
        return reply.code(500).send({ error: 'Failed to save config' });
      }
    }
  );

  // Test Slack connection
  app.post(
    '/global-integrations/slack/test',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const body = request.body as { bot_token: string };
      if (!body.bot_token) {
        return reply.code(400).send({ error: 'bot_token is required' });
      }
      try {
        const response = await fetch('https://slack.com/api/auth.test', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${body.bot_token}`,
            'Content-Type': 'application/json',
          },
        });
        const result = (await response.json()) as {
          ok: boolean;
          team?: string;
          user?: string;
          bot_id?: string;
          error?: string;
        };
        if (result.ok) {
          return reply.send({
            data: {
              ok: true,
              team: result.team,
              user: result.user,
              bot_id: result.bot_id,
            },
          });
        } else {
          return reply.send({ data: { ok: false, error: result.error } });
        }
      } catch (error) {
        logger.error('Slack auth.test failed', {
          error: error instanceof Error ? error.message : String(error),
        });
        return reply
          .code(500)
          .send({ error: 'Failed to test Slack connection' });
      }
    }
  );

  // Test GitHub connection
  app.post(
    '/global-integrations/github/test',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const body = request.body as { app_id: string; private_key: string };
      if (!body.app_id || !body.private_key) {
        return reply
          .code(400)
          .send({ error: 'app_id and private_key are required' });
      }
      try {
        const jwt = require('jsonwebtoken');
        const payload = {
          iat: Math.floor(Date.now() / 1000) - 60,
          exp: Math.floor(Date.now() / 1000) + 10 * 60,
          iss: body.app_id,
        };
        const token = jwt.sign(payload, body.private_key, {
          algorithm: 'RS256',
        });
        const response = await fetch('https://api.github.com/app', {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/vnd.github.v3+json',
            'User-Agent': 'Gatrix-Argus',
          },
        });
        const result: any = await response.json();
        if (response.ok) {
          return reply.send({
            data: { ok: true, name: result.name, html_url: result.html_url },
          });
        } else {
          return reply.send({
            data: { ok: false, error: result.message || 'Unauthorized' },
          });
        }
      } catch (error) {
        logger.error('GitHub app test failed', {
          error: error instanceof Error ? error.message : String(error),
        });
        return reply
          .code(500)
          .send({
            error: 'Failed to test GitHub App (invalid private key format?)',
          });
      }
    }
  );

  // Test Bitbucket connection
  app.post(
    '/global-integrations/bitbucket/test',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const body = request.body as { username: string; app_password: string };
      if (!body.username || !body.app_password) {
        return reply
          .code(400)
          .send({ error: 'username and app_password are required' });
      }
      try {
        const auth = Buffer.from(
          `${body.username}:${body.app_password}`
        ).toString('base64');
        const response = await fetch('https://api.bitbucket.org/2.0/user', {
          headers: {
            Authorization: `Basic ${auth}`,
          },
        });
        const result: any = await response.json();
        if (response.ok) {
          return reply.send({
            data: {
              ok: true,
              display_name: result.display_name,
              account_id: result.account_id,
            },
          });
        } else {
          return reply.send({
            data: { ok: false, error: result.error?.message || 'Unauthorized' },
          });
        }
      } catch (error) {
        logger.error('Bitbucket test failed', {
          error: error instanceof Error ? error.message : String(error),
        });
        return reply
          .code(500)
          .send({ error: 'Failed to test Bitbucket connection' });
      }
    }
  );

  // Test GitLab connection
  app.post(
    '/global-integrations/gitlab/test',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const body = request.body as {
        instance_url: string;
        application_id: string;
        application_secret: string;
      };
      if (!body.instance_url) {
        return reply.code(400).send({ error: 'instance_url is required' });
      }
      try {
        // Test if the instance is reachable. Full OAuth test requires browser redirect.
        const response = await fetch(
          `${body.instance_url.replace(/\/$/, '')}/api/v4/version`
        );
        if (response.ok || response.status === 401 || response.status === 403) {
          return reply.send({
            data: {
              ok: true,
              message:
                'Instance reachable. Client ID/Secret will be verified upon first use.',
            },
          });
        } else {
          return reply.send({
            data: {
              ok: false,
              error: 'Invalid GitLab instance URL or instance is not reachable',
            },
          });
        }
      } catch (error) {
        logger.error('GitLab test failed', {
          error: error instanceof Error ? error.message : String(error),
        });
        return reply
          .code(500)
          .send({ error: 'Failed to reach GitLab instance' });
      }
    }
  );

  // Delete (deactivate) integration
  app.delete(
    '/global-integrations/:provider/config',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { provider } = request.params as { provider: string };
      try {
        await db('g_argus_global_integrations')
          .where('provider', provider)
          .update({ is_active: 0 });
        return reply.send({ success: true });
      } catch (error) {
        logger.error('Failed to delete global integration', {
          provider,
          error: error instanceof Error ? error.message : String(error),
        });
        return reply.code(500).send({ error: 'Failed to delete' });
      }
    }
  );
}

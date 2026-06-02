import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { mysqlPool } from '../config/mysql';
import { createLogger } from '../utils/logger';

const logger = createLogger('argus-global-integrations');

export default async function globalIntegrationsRoutes(app: FastifyInstance) {
  // Initialize table
  try {
    await mysqlPool.query(`
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
    logger.error('Failed to ensure g_argus_global_integrations table', { error: error instanceof Error ? error.message : String(error) });
  }

  // Check if provider is configured
  app.get(
    '/global-integrations/:provider/config',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { provider } = request.params as { provider: string };
      try {
        const [rows] = await mysqlPool.execute(
          'SELECT id, name, url, is_active, created_at, updated_at FROM g_argus_global_integrations WHERE provider = ? AND is_active = 1 LIMIT 1',
          [provider]
        );
        const configured = (rows as any[]).length > 0;
        return reply.send({ data: { configured, config: (rows as any[])[0] || null } });
      } catch (error) {
        logger.error('Failed to check global integration config', { provider, error: error instanceof Error ? error.message : String(error) });
        return reply.code(500).send({ error: 'Failed to check config' });
      }
    }
  );

  // Save provider configuration
  app.post(
    '/global-integrations/:provider/config',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { provider } = request.params as { provider: string };
      const body = request.body as { name?: string; url?: string; credentials: any };

      if (!body.credentials) {
        return reply.code(400).send({ error: 'credentials are required' });
      }

      try {
        await mysqlPool.execute(
          `INSERT INTO g_argus_global_integrations (provider, name, url, credentials)
           VALUES (?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
           name = VALUES(name), credentials = VALUES(credentials), is_active = 1`,
          [provider, body.name || null, body.url || null, JSON.stringify(body.credentials)]
        );
        return reply.code(200).send({ success: true });
      } catch (error) {
        logger.error('Failed to save global integration config', { provider, error: error instanceof Error ? error.message : String(error) });
        return reply.code(500).send({ error: 'Failed to save config' });
      }
    }
  );
}

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { mysqlPool } from '../config/mysql';
import { createLogger } from '../utils/logger';

const logger = createLogger('argus-notification-channels');

export default async function notificationChannelsRoutes(app: FastifyInstance) {

  // Ensure table exists
  try {
    await mysqlPool.query(`
      CREATE TABLE IF NOT EXISTS g_argus_notification_channels (
        id INT AUTO_INCREMENT PRIMARY KEY,
        project_id VARCHAR(64) NOT NULL,
        provider VARCHAR(50) NOT NULL,
        name VARCHAR(100) DEFAULT NULL,
        config JSON DEFAULT NULL,
        enabled BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_project (project_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    logger.info('g_argus_notification_channels table ensured');
  } catch (error) {
    logger.error('Failed to ensure notification_channels table', { error: error instanceof Error ? error.message : String(error) });
  }

  // List notification channels for a project
  app.get(
    '/:projectId/notification-channels',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId } = request.params as { projectId: string };
      try {
        const [rows] = await mysqlPool.execute(
          `SELECT id, project_id, provider, name, config, enabled, created_at, updated_at
           FROM g_argus_notification_channels WHERE project_id = ? ORDER BY created_at DESC`,
          [projectId]
        );
        // Parse JSON config
        const channels = (rows as any[]).map(row => ({
          ...row,
          config: typeof row.config === 'string' ? JSON.parse(row.config) : row.config,
        }));
        return reply.send({ data: channels });
      } catch (error) {
        logger.error('Failed to list notification channels', { projectId, error: error instanceof Error ? error.message : String(error) });
        return reply.code(500).send({ error: 'Failed to list notification channels' });
      }
    }
  );

  // Create notification channel
  app.post(
    '/:projectId/notification-channels',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId } = request.params as { projectId: string };
      const { provider, name, config } = request.body as {
        provider: string;
        name?: string;
        config: Record<string, any>;
      };

      if (!provider) {
        return reply.code(400).send({ error: 'provider is required' });
      }

      try {
        const [result] = await mysqlPool.execute(
          `INSERT INTO g_argus_notification_channels (project_id, provider, name, config)
           VALUES (?, ?, ?, ?)`,
          [projectId, provider, name || null, JSON.stringify(config || {})]
        );
        const insertId = (result as any).insertId;
        return reply.code(201).send({ data: { id: insertId } });
      } catch (error) {
        logger.error('Failed to create notification channel', { projectId, error: error instanceof Error ? error.message : String(error) });
        return reply.code(500).send({ error: 'Failed to create notification channel' });
      }
    }
  );

  // Update notification channel
  app.patch(
    '/:projectId/notification-channels/:channelId',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId, channelId } = request.params as { projectId: string; channelId: string };
      const body = request.body as Record<string, any>;

      const updates: string[] = [];
      const values: any[] = [];

      if (body.name !== undefined) { updates.push('name = ?'); values.push(body.name); }
      if (body.enabled !== undefined) { updates.push('enabled = ?'); values.push(body.enabled ? 1 : 0); }
      if (body.config !== undefined) { updates.push('config = ?'); values.push(JSON.stringify(body.config)); }

      if (updates.length === 0) {
        return reply.code(400).send({ error: 'No fields to update' });
      }

      try {
        values.push(channelId, projectId);
        await mysqlPool.execute(
          `UPDATE g_argus_notification_channels SET ${updates.join(', ')} WHERE id = ? AND project_id = ?`,
          values
        );
        return reply.send({ success: true });
      } catch (error) {
        logger.error('Failed to update notification channel', { projectId, channelId, error: error instanceof Error ? error.message : String(error) });
        return reply.code(500).send({ error: 'Failed to update notification channel' });
      }
    }
  );

  // Delete notification channel
  app.delete(
    '/:projectId/notification-channels/:channelId',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId, channelId } = request.params as { projectId: string; channelId: string };
      try {
        await mysqlPool.execute(
          'DELETE FROM g_argus_notification_channels WHERE id = ? AND project_id = ?',
          [channelId, projectId]
        );
        return reply.send({ success: true });
      } catch (error) {
        logger.error('Failed to delete notification channel', { error: error instanceof Error ? error.message : String(error) });
        return reply.code(500).send({ error: 'Failed to delete notification channel' });
      }
    }
  );

  // Pre-save connection test (no DB record required)
  app.post(
    '/:projectId/notification-channels/test-connection',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { provider, config } = request.body as {
        provider: string;
        config: Record<string, any>;
      };

      if (!provider) {
        return reply.code(400).send({ error: 'provider is required' });
      }

      try {
        let result: { ok: boolean; message: string };

        switch (provider) {
          case 'slack': {
            // Slack: test via webhook URL ping
            const webhookUrl = config?.webhook_url;
            if (!webhookUrl) {
              result = { ok: false, message: 'Webhook URL is required' };
              break;
            }
            if (!webhookUrl.startsWith('https://hooks.slack.com/services/')) {
              result = { ok: false, message: 'Invalid Slack Webhook URL format' };
              break;
            }
            try {
              const res = await fetch(webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: '[Argus] Connection test — this channel is now connected.' }),
              });
              result = res.ok
                ? { ok: true, message: 'Test message sent successfully' }
                : { ok: false, message: `Slack returned HTTP ${res.status}` };
            } catch (e) {
              result = { ok: false, message: `Failed to reach Slack: ${(e as Error).message}` };
            }
            break;
          }
          case 'discord': {
            const webhookUrl = config?.webhook_url;
            if (!webhookUrl) {
              result = { ok: false, message: 'Webhook URL is required' };
              break;
            }
            if (!webhookUrl.startsWith('https://discord.com/api/webhooks/') && !webhookUrl.startsWith('https://discordapp.com/api/webhooks/')) {
              result = { ok: false, message: 'Invalid Discord Webhook URL format' };
              break;
            }
            try {
              const res = await fetch(webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: '[Argus] Connection test — this channel is now connected.' }),
              });
              result = res.ok || res.status === 204
                ? { ok: true, message: 'Test message sent successfully' }
                : { ok: false, message: `Discord returned HTTP ${res.status}` };
            } catch (e) {
              result = { ok: false, message: `Failed to reach Discord: ${(e as Error).message}` };
            }
            break;
          }
          case 'msteams': {
            const webhookUrl = config?.webhook_url;
            if (!webhookUrl) {
              result = { ok: false, message: 'Webhook URL is required' };
              break;
            }
            if (!webhookUrl.startsWith('https://outlook.office.com/webhook/')) {
              result = { ok: false, message: 'Invalid MSTeams Webhook URL format' };
              break;
            }
            try {
              const res = await fetch(webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: '[Argus] Connection test — this channel is now connected.' }),
              });
              result = res.ok
                ? { ok: true, message: 'Test message sent to Teams' }
                : { ok: false, message: `Teams returned HTTP ${res.status}` };
            } catch (e) {
              result = { ok: false, message: `Failed to reach Teams: ${(e as Error).message}` };
            }
            break;
          }
          case 'webhook': {
            const webhookUrl = config?.webhook_url;
            if (!webhookUrl) {
              result = { ok: false, message: 'Webhook URL is required' };
              break;
            }
            if (!webhookUrl.startsWith('http://') && !webhookUrl.startsWith('https://')) {
              result = { ok: false, message: 'Invalid Webhook URL format' };
              break;
            }
            try {
              const res = await fetch(webhookUrl, { method: 'HEAD', signal: AbortSignal.timeout(5000) });
              result = { ok: true, message: `Endpoint reachable (HTTP ${res.status})` };
            } catch (e) {
              // HEAD failed, try GET
              try {
                const res = await fetch(webhookUrl, { method: 'GET', signal: AbortSignal.timeout(5000) });
                result = { ok: true, message: `Endpoint reachable (HTTP ${res.status})` };
              } catch {
                result = { ok: false, message: `Endpoint unreachable: ${(e as Error).message}` };
              }
            }
            break;
          }
          case 'pagerduty': {
            const apiToken = config?.api_token;
            if (!apiToken) {
              result = { ok: false, message: 'API Token (Integration Key) is required' };
              break;
            }
            // PagerDuty abilities check
            try {
              const res = await fetch('https://api.pagerduty.com/abilities', {
                headers: { 'Authorization': `Token token=${apiToken}`, 'Content-Type': 'application/json' },
              });
              result = res.ok
                ? { ok: true, message: 'PagerDuty API key is valid' }
                : { ok: false, message: `PagerDuty returned HTTP ${res.status}` };
            } catch (e) {
              result = { ok: false, message: `Failed to reach PagerDuty: ${(e as Error).message}` };
            }
            break;
          }
          case 'email':
            result = { ok: true, message: 'Email channel does not require connection test' };
            break;
          default:
            result = { ok: false, message: `Unknown provider: ${provider}` };
        }

        return reply.send({ data: result });
      } catch (error) {
        logger.error('Pre-save notification channel test failed', { error: error instanceof Error ? error.message : String(error) });
        return reply.send({ data: { ok: false, message: (error as Error).message } });
      }
    }
  );
}

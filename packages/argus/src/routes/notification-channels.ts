import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import db from '../config/knex';
import { createLogger } from '../utils/logger';

const logger = createLogger('argus-notification-channels');

export default async function notificationChannelsRoutes(app: FastifyInstance) {
  // List notification channels for a project
  app.get(
    '/:projectId/notification-channels',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId } = request.params as { projectId: string };
      try {
        const rows = await db('g_argus_notification_channels')
          .select(
            'id',
            'project_id',
            'provider',
            'name',
            'config',
            'enabled',
            'created_at',
            'updated_at'
          )
          .where('project_id', projectId)
          .orderBy('created_at', 'desc');
        // Parse JSON config
        const channels = rows.map((row: any) => ({
          ...row,
          config:
            typeof row.config === 'string'
              ? JSON.parse(row.config)
              : row.config,
        }));
        return reply.send({ data: channels });
      } catch (error) {
        logger.error('Failed to list notification channels', {
          projectId,
          error: error instanceof Error ? error.message : String(error),
        });
        return reply
          .code(500)
          .send({ error: 'Failed to list notification channels' });
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
        const [insertId] = await db('g_argus_notification_channels').insert({
          project_id: projectId,
          provider,
          name: name || null,
          config: JSON.stringify(config || {}),
        });
        return reply.code(201).send({ data: { id: insertId } });
      } catch (error) {
        logger.error('Failed to create notification channel', {
          projectId,
          error: error instanceof Error ? error.message : String(error),
        });
        return reply
          .code(500)
          .send({ error: 'Failed to create notification channel' });
      }
    }
  );

  // Update notification channel
  app.patch(
    '/:projectId/notification-channels/:channelId',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId, channelId } = request.params as {
        projectId: string;
        channelId: string;
      };
      const body = request.body as Record<string, any>;

      const updates: string[] = [];
      const values: any[] = [];

      if (body.name !== undefined) {
        updates.push('name = ?');
        values.push(body.name);
      }
      if (body.enabled !== undefined) {
        updates.push('enabled = ?');
        values.push(body.enabled ? 1 : 0);
      }
      if (body.config !== undefined) {
        updates.push('config = ?');
        values.push(JSON.stringify(body.config));
      }

      if (updates.length === 0) {
        return reply.code(400).send({ error: 'No fields to update' });
      }

      try {
        const updateObj: any = {};
        if (body.name !== undefined) updateObj.name = body.name;
        if (body.enabled !== undefined)
          updateObj.enabled = body.enabled ? 1 : 0;
        if (body.config !== undefined)
          updateObj.config = JSON.stringify(body.config);
        await db('g_argus_notification_channels')
          .where({ id: channelId, project_id: projectId })
          .update(updateObj);
        return reply.send({ success: true });
      } catch (error) {
        logger.error('Failed to update notification channel', {
          projectId,
          channelId,
          error: error instanceof Error ? error.message : String(error),
        });
        return reply
          .code(500)
          .send({ error: 'Failed to update notification channel' });
      }
    }
  );

  // Delete notification channel
  app.delete(
    '/:projectId/notification-channels/:channelId',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId, channelId } = request.params as {
        projectId: string;
        channelId: string;
      };
      try {
        await db('g_argus_notification_channels')
          .where({ id: channelId, project_id: projectId })
          .del();
        return reply.send({ success: true });
      } catch (error) {
        logger.error('Failed to delete notification channel', {
          error: error instanceof Error ? error.message : String(error),
        });
        return reply
          .code(500)
          .send({ error: 'Failed to delete notification channel' });
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
              result = {
                ok: false,
                message: 'Invalid Slack Webhook URL format',
              };
              break;
            }
            try {
              const res = await fetch(webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  text: '[Argus] Connection test — this channel is now connected.',
                }),
              });
              result = res.ok
                ? { ok: true, message: 'Test message sent successfully' }
                : { ok: false, message: `Slack returned HTTP ${res.status}` };
            } catch (e) {
              result = {
                ok: false,
                message: `Failed to reach Slack: ${(e as Error).message}`,
              };
            }
            break;
          }
          case 'discord': {
            const webhookUrl = config?.webhook_url;
            if (!webhookUrl) {
              result = { ok: false, message: 'Webhook URL is required' };
              break;
            }
            if (
              !webhookUrl.startsWith('https://discord.com/api/webhooks/') &&
              !webhookUrl.startsWith('https://discordapp.com/api/webhooks/')
            ) {
              result = {
                ok: false,
                message: 'Invalid Discord Webhook URL format',
              };
              break;
            }
            try {
              const res = await fetch(webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  content:
                    '[Argus] Connection test — this channel is now connected.',
                }),
              });
              result =
                res.ok || res.status === 204
                  ? { ok: true, message: 'Test message sent successfully' }
                  : {
                      ok: false,
                      message: `Discord returned HTTP ${res.status}`,
                    };
            } catch (e) {
              result = {
                ok: false,
                message: `Failed to reach Discord: ${(e as Error).message}`,
              };
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
              result = {
                ok: false,
                message: 'Invalid MSTeams Webhook URL format',
              };
              break;
            }
            try {
              const res = await fetch(webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  text: '[Argus] Connection test — this channel is now connected.',
                }),
              });
              result = res.ok
                ? { ok: true, message: 'Test message sent to Teams' }
                : { ok: false, message: `Teams returned HTTP ${res.status}` };
            } catch (e) {
              result = {
                ok: false,
                message: `Failed to reach Teams: ${(e as Error).message}`,
              };
            }
            break;
          }
          case 'webhook': {
            const webhookUrl = config?.webhook_url;
            if (!webhookUrl) {
              result = { ok: false, message: 'Webhook URL is required' };
              break;
            }
            if (
              !webhookUrl.startsWith('http://') &&
              !webhookUrl.startsWith('https://')
            ) {
              result = { ok: false, message: 'Invalid Webhook URL format' };
              break;
            }
            try {
              const res = await fetch(webhookUrl, {
                method: 'HEAD',
                signal: AbortSignal.timeout(5000),
              });
              result = {
                ok: true,
                message: `Endpoint reachable (HTTP ${res.status})`,
              };
            } catch (e) {
              // HEAD failed, try GET
              try {
                const res = await fetch(webhookUrl, {
                  method: 'GET',
                  signal: AbortSignal.timeout(5000),
                });
                result = {
                  ok: true,
                  message: `Endpoint reachable (HTTP ${res.status})`,
                };
              } catch {
                result = {
                  ok: false,
                  message: `Endpoint unreachable: ${(e as Error).message}`,
                };
              }
            }
            break;
          }
          case 'pagerduty': {
            const apiToken = config?.api_token;
            if (!apiToken) {
              result = {
                ok: false,
                message: 'API Token (Integration Key) is required',
              };
              break;
            }
            // PagerDuty abilities check
            try {
              const res = await fetch('https://api.pagerduty.com/abilities', {
                headers: {
                  Authorization: `Token token=${apiToken}`,
                  'Content-Type': 'application/json',
                },
              });
              result = res.ok
                ? { ok: true, message: 'PagerDuty API key is valid' }
                : {
                    ok: false,
                    message: `PagerDuty returned HTTP ${res.status}`,
                  };
            } catch (e) {
              result = {
                ok: false,
                message: `Failed to reach PagerDuty: ${(e as Error).message}`,
              };
            }
            break;
          }
          case 'email':
            result = {
              ok: true,
              message: 'Email channel does not require connection test',
            };
            break;
          default:
            result = { ok: false, message: `Unknown provider: ${provider}` };
        }

        return reply.send({ data: result });
      } catch (error) {
        logger.error('Pre-save notification channel test failed', {
          error: error instanceof Error ? error.message : String(error),
        });
        return reply.send({
          data: { ok: false, message: (error as Error).message },
        });
      }
    }
  );
}

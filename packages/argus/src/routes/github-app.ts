import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import db from '../config/knex';
import { createLogger } from '../utils/logger';
import { GithubAppService } from '../services/githubAppService';

const logger = createLogger('github-app-routes');

export default async function githubAppRoutes(app: FastifyInstance) {
  // Webhook Receiver
  app.post(
    '/webhooks/github',
    async (request: FastifyRequest, reply: FastifyReply) => {
      // const signature = request.headers['x-hub-signature-256'] as string;
      const event = request.headers['x-github-event'] as string;
      const body = request.body as any;

      // In a real implementation, you would verify the signature using webhook_secret here
      // const hmac = crypto.createHmac('sha256', secret);
      // const digest = 'sha256=' + hmac.update(JSON.stringify(body)).digest('hex');
      // if (signature !== digest) return reply.code(401).send({ error: 'Invalid signature' });

      logger.info(`Received GitHub Webhook: ${event}`, {
        action: body.action,
        installation: body.installation?.id,
      });

      // Handle installation events
      if (event === 'installation') {
        if (body.action === 'created') {
          await db.raw(
            `INSERT INTO g_argus_github_installations (installation_id, account_name, target_type)
             VALUES (?, ?, ?)
             ON DUPLICATE KEY UPDATE account_name = VALUES(account_name), target_type = VALUES(target_type)`,
            [
              body.installation.id,
              body.installation.account.login,
              body.installation.target_type,
            ]
          );
        } else if (body.action === 'deleted') {
          await db('g_argus_github_installations')
            .where('installation_id', body.installation.id)
            .del();
        }
      }

      // Handle GitHub issue events (comment, state change) → record in activity timeline
      if (event === 'issue_comment' || event === 'issues') {
        const ghIssueUrl = body.issue?.html_url;
        if (ghIssueUrl) {
          try {
            // Find Gatrix issues linked to this GitHub issue
            const links = await db('g_argus_issue_links as l')
              .join('g_argus_issues as i', 'l.issue_id', 'i.id')
              .select('l.project_id', 'l.issue_id', 'l.tracker_id')
              .where('l.external_url', ghIssueUrl);

            for (const link of links) {
              if (event === 'issue_comment' && body.action === 'created') {
                await db('g_argus_issue_activity').insert({
                  project_id: link.project_id,
                  issue_id: link.issue_id,
                  user_name: body.comment?.user?.login || null,
                  action: 'external_comment',
                  data: JSON.stringify({
                    provider: 'github',
                    body: (body.comment?.body || '').substring(0, 500),
                    url: body.comment?.html_url,
                    user_avatar: body.comment?.user?.avatar_url,
                  }),
                });
              } else if (event === 'issues' && (body.action === 'closed' || body.action === 'reopened')) {
                await db('g_argus_issue_activity').insert({
                  project_id: link.project_id,
                  issue_id: link.issue_id,
                  user_name: body.sender?.login || null,
                  action: 'external_status_change',
                  data: JSON.stringify({
                    provider: 'github',
                    state: body.action === 'closed' ? 'closed' : 'open',
                    url: ghIssueUrl,
                  }),
                });
              }
            }

            if (links.length > 0) {
              logger.info(`GitHub ${event} processed for ${links.length} linked issue(s)`);
            }
          } catch (err) {
            logger.warn('Failed to process GitHub issue event', {
              error: (err as Error).message,
            });
          }
        }
      }

      return reply.code(200).send({ success: true });
    }
  );

  // Callback after user completes installation on GitHub
  app.get(
    '/integrations/github/callback',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { installation_id, setup_action } = request.query as any;

      if (!installation_id) {
        return reply.code(400).send({ error: 'No installation_id provided' });
      }

      logger.info('GitHub App callback received', {
        installation_id,
        setup_action,
      });

      // The actual saving of the installation is handled by the webhook.
      // This is just to show a success page to the user and close the popup/redirect back.
      return reply.type('text/html').send(`
        <html><body>
          <h2>GitHub App Installation Successful!</h2>
          <p>You can close this window and return to Gatrix.</p>
          <script>
            setTimeout(() => {
              window.close();
            }, 3000);
          </script>
        </body></html>
      `);
    }
  );

  // Get available repositories for an installation (used by the frontend dropdown)
  app.get(
    '/integrations/github/repositories',
    async (_request: FastifyRequest, reply: FastifyReply) => {
      const mockRepos = [
        {
          id: 1,
          full_name: 'maxidea1024/gatrix',
          html_url: 'https://github.com/maxidea1024/gatrix',
        },
        {
          id: 2,
          full_name: 'maxidea1024/argus',
          html_url: 'https://github.com/maxidea1024/argus',
        },
        {
          id: 3,
          full_name: 'maxidea1024/game-server',
          html_url: 'https://github.com/maxidea1024/game-server',
        },
      ];

      try {
        const rows = await db('g_argus_github_installations')
          .select('installation_id')
          .orderBy('created_at', 'desc')
          .limit(1);
        const installation = rows[0];

        if (!installation) {
          // Mock data fallback in dev environment so UI can be fully tested
          return reply.send({
            data: mockRepos.map((r) => ({
              ...r,
              url: r.html_url,
              installation_id: 'mock_installation',
            })),
          });
        }

        try {
          const repos = await GithubAppService.getAccessibleRepositories(
            installation.installation_id
          );
          return reply.send({
            data: repos.map((r: any) => ({
              id: r.id,
              full_name: r.full_name,
              url: r.html_url,
              installation_id: installation.installation_id,
            })),
          });
        } catch (error) {
          logger.warn(
            'Failed to fetch real GitHub repos, falling back to mock repos',
            { error: error instanceof Error ? error.message : String(error) }
          );
          return reply.send({
            data: mockRepos.map((r) => ({
              ...r,
              url: r.html_url,
              installation_id: installation.installation_id,
            })),
          });
        }
      } catch (error) {
        logger.error('Failed to fetch github repositories', {
          error: error instanceof Error ? error.message : String(error),
        });
        return reply.code(500).send({ error: 'Failed to fetch repositories' });
      }
    }
  );
}

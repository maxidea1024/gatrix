import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { mysqlPool } from '../config/mysql';
import { createLogger } from '../utils/logger';

const logger = createLogger('alerts-api');

export default async function alertsRoutes(app: FastifyInstance) {
  // List alert rules for a project
  app.get(
    '/:projectId/alerts',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId } = request.params as { projectId: string };

      try {
        const [rows] = await mysqlPool.query(
          'SELECT * FROM g_argus_alert_rules WHERE project_id = ? ORDER BY created_at DESC',
          [projectId]
        );
        return reply.send({ data: rows });
      } catch (error) {
        logger.error('Failed to list alert rules', {
          projectId,
          error: error instanceof Error ? error.message : String(error),
        });
        return reply.code(500).send({ error: 'Failed to list alert rules' });
      }
    }
  );

  // Create alert rule
  app.post(
    '/:projectId/alerts',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId } = request.params as { projectId: string };
      const { name, conditions, actions, frequency, environment, level } = request.body as {
        name: string;
        conditions: any[];
        actions: any[];
        frequency?: number;
        environment?: string;
        level?: string;
      };

      if (!name || !conditions || !actions) {
        return reply.code(400).send({ error: 'name, conditions, and actions are required' });
      }

      try {
        const [result] = await mysqlPool.query(
          `INSERT INTO g_argus_alert_rules (project_id, name, conditions, actions, frequency, environment, level)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            projectId,
            name,
            JSON.stringify(conditions),
            JSON.stringify(actions),
            frequency || 60,
            environment || null,
            level || null,
          ]
        );
        const insertId = (result as any).insertId;
        return reply.code(201).send({ data: { id: insertId } });
      } catch (error) {
        logger.error('Failed to create alert rule', {
          projectId,
          error: error instanceof Error ? error.message : String(error),
        });
        return reply.code(500).send({ error: 'Failed to create alert rule' });
      }
    }
  );

  // Update alert rule
  app.put(
    '/:projectId/alerts/:ruleId',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId, ruleId } = request.params as { projectId: string; ruleId: string };
      const { name, conditions, actions, frequency, environment, level, enabled } = request.body as {
        name?: string;
        conditions?: any[];
        actions?: any[];
        frequency?: number;
        environment?: string;
        level?: string;
        enabled?: boolean;
      };

      try {
        const updates: string[] = [];
        const params: any[] = [];

        if (name !== undefined) { updates.push('name = ?'); params.push(name); }
        if (conditions !== undefined) { updates.push('conditions = ?'); params.push(JSON.stringify(conditions)); }
        if (actions !== undefined) { updates.push('actions = ?'); params.push(JSON.stringify(actions)); }
        if (frequency !== undefined) { updates.push('frequency = ?'); params.push(frequency); }
        if (environment !== undefined) { updates.push('environment = ?'); params.push(environment || null); }
        if (level !== undefined) { updates.push('level = ?'); params.push(level || null); }
        if (enabled !== undefined) { updates.push('enabled = ?'); params.push(enabled ? 1 : 0); }

        if (updates.length === 0) {
          return reply.code(400).send({ error: 'No fields to update' });
        }

        params.push(ruleId, projectId);
        await mysqlPool.query(
          `UPDATE g_argus_alert_rules SET ${updates.join(', ')} WHERE id = ? AND project_id = ?`,
          params
        );
        return reply.send({ success: true });
      } catch (error) {
        logger.error('Failed to update alert rule', {
          ruleId,
          error: error instanceof Error ? error.message : String(error),
        });
        return reply.code(500).send({ error: 'Failed to update alert rule' });
      }
    }
  );

  // Delete alert rule
  app.delete(
    '/:projectId/alerts/:ruleId',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId, ruleId } = request.params as { projectId: string; ruleId: string };

      try {
        await mysqlPool.query(
          'DELETE FROM g_argus_alert_rules WHERE id = ? AND project_id = ?',
          [ruleId, projectId]
        );
        return reply.send({ success: true });
      } catch (error) {
        logger.error('Failed to delete alert rule', {
          ruleId,
          error: error instanceof Error ? error.message : String(error),
        });
        return reply.code(500).send({ error: 'Failed to delete alert rule' });
      }
    }
  );

  // Get alert history
  app.get(
    '/:projectId/alerts/history',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId } = request.params as { projectId: string };
      const { limit = '50', ruleId } = request.query as Record<string, string>;

      try {
        let sql = `
          SELECT h.*, r.name as rule_name
          FROM g_argus_alert_history h
          LEFT JOIN g_argus_alert_rules r ON h.rule_id = r.id
          WHERE h.project_id = ?
        `;
        const params: any[] = [projectId];

        if (ruleId) {
          sql += ' AND h.rule_id = ?';
          params.push(ruleId);
        }

        sql += ' ORDER BY h.triggered_at DESC LIMIT ?';
        params.push(parseInt(limit, 10));

        const [rows] = await mysqlPool.query(sql, params);
        return reply.send({ data: rows });
      } catch (error) {
        logger.error('Failed to get alert history', {
          projectId,
          error: error instanceof Error ? error.message : String(error),
        });
        return reply.code(500).send({ error: 'Failed to get alert history' });
      }
    }
  );

  // Test alert rule (send test notification)
  app.post(
    '/:projectId/alerts/:ruleId/test',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId, ruleId } = request.params as { projectId: string; ruleId: string };

      try {
        const [rows] = await mysqlPool.query(
          'SELECT * FROM g_argus_alert_rules WHERE id = ? AND project_id = ?',
          [ruleId, projectId]
        );
        const rules = rows as any[];
        if (rules.length === 0) {
          return reply.code(404).send({ error: 'Rule not found' });
        }

        const rule = rules[0];
        const actions = typeof rule.actions === 'string' ? JSON.parse(rule.actions) : rule.actions;

        // Execute each action
        for (const action of actions) {
          if (action.type === 'webhook') {
            try {
              await fetch(action.target_url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  text: `[Argus Test] Alert rule "${rule.name}" test notification`,
                  rule_name: rule.name,
                  project_id: projectId,
                  is_test: true,
                }),
              });
            } catch (e) {
              logger.warn('Test webhook failed', { url: action.target_url, error: String(e) });
            }
          }
        }

        return reply.send({ success: true, message: 'Test notification sent' });
      } catch (error) {
        logger.error('Failed to test alert rule', {
          ruleId,
          error: error instanceof Error ? error.message : String(error),
        });
        return reply.code(500).send({ error: 'Failed to test alert rule' });
      }
    }
  );
}

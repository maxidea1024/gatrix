import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { mysqlPool } from '../config/mysql';
import { redis } from '../config/redis';
import { createLogger } from '../utils/logger';
import { ConfigBroadcaster } from '../utils/config-broadcaster';
import { CONFIG_TYPES } from '../config/redis-keys';

const logger = createLogger('alerts-api');
const broadcaster = new ConfigBroadcaster(redis);

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
      } catch (error: any) {
        if (error?.code === 'ER_NO_SUCH_TABLE') {
          return reply.send({ data: [] });
        }
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
      const { name, description, conditions, actions, frequency, environment, level, tags, dataset, query_config, condition_logic } = request.body as {
        name: string;
        description?: string;
        conditions: any[];
        actions: any[];
        frequency?: number;
        environment?: string;
        level?: string;
        tags?: Record<string, string>;
        dataset?: string;
        query_config?: any;
        condition_logic?: 'any' | 'all';
      };

      if (!name || !conditions || !actions) {
        return reply.code(400).send({ error: 'name, conditions, and actions are required' });
      }

      try {
        // Ensure new columns exist
        try { await mysqlPool.query(`ALTER TABLE g_argus_alert_rules ADD COLUMN IF NOT EXISTS description TEXT DEFAULT NULL AFTER name`); } catch { /* may already exist */ }
        try { await mysqlPool.query(`ALTER TABLE g_argus_alert_rules ADD COLUMN IF NOT EXISTS condition_logic VARCHAR(10) DEFAULT 'any' AFTER name`); } catch { /* may already exist */ }
        try { await mysqlPool.query(`ALTER TABLE g_argus_alert_rules ADD COLUMN IF NOT EXISTS muted_until DATETIME DEFAULT NULL`); } catch { /* may already exist */ }
        try { await mysqlPool.query(`ALTER TABLE g_argus_alert_rules ADD COLUMN IF NOT EXISTS tags JSON DEFAULT NULL`); } catch { /* may already exist */ }
        try { await mysqlPool.query(`ALTER TABLE g_argus_alert_rules ADD COLUMN IF NOT EXISTS dataset VARCHAR(50) DEFAULT 'errors'`); } catch { /* may already exist */ }
        try { await mysqlPool.query(`ALTER TABLE g_argus_alert_rules ADD COLUMN IF NOT EXISTS query_config JSON DEFAULT NULL`); } catch { /* may already exist */ }
        try { await mysqlPool.query(`ALTER TABLE g_argus_alert_history ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'success'`); } catch { /* may already exist */ }
        try { await mysqlPool.query(`ALTER TABLE g_argus_alert_history ADD COLUMN IF NOT EXISTS response_body TEXT DEFAULT NULL`); } catch { /* may already exist */ }

        const [result] = await mysqlPool.query(
          `INSERT INTO g_argus_alert_rules (project_id, name, description, conditions, actions, frequency, environment, level, tags, condition_logic, dataset, query_config)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            projectId,
            name,
            description || null,
            JSON.stringify(conditions),
            JSON.stringify(actions),
            frequency || 60,
            environment || null,
            level || null,
            tags ? JSON.stringify(tags) : null,
            condition_logic || 'any',
            dataset || 'errors',
            query_config ? JSON.stringify(query_config) : null,
          ]
        );
        const insertId = (result as any).insertId;

        // Notify workers to reload alert rules for this project
        await broadcaster.publish({ type: CONFIG_TYPES.ALERT_RULES, projectId: parseInt(projectId, 10) });

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
      const { name, description, conditions, actions, frequency, environment, level, enabled, tags, dataset, query_config, condition_logic } = request.body as {
        name?: string;
        description?: string;
        conditions?: any[];
        actions?: any[];
        frequency?: number;
        environment?: string;
        level?: string;
        enabled?: boolean;
        tags?: Record<string, string>;
        dataset?: string;
        query_config?: any;
        condition_logic?: 'any' | 'all';
        muted_until?: string;
      };

      try {
        const updates: string[] = [];
        const params: any[] = [];

        if (name !== undefined) { updates.push('name = ?'); params.push(name); }
        if (description !== undefined) { updates.push('description = ?'); params.push(description || null); }
        if (conditions !== undefined) { updates.push('conditions = ?'); params.push(JSON.stringify(conditions)); }
        if (actions !== undefined) { updates.push('actions = ?'); params.push(JSON.stringify(actions)); }
        if (frequency !== undefined) { updates.push('frequency = ?'); params.push(frequency); }
        if (environment !== undefined) { updates.push('environment = ?'); params.push(environment || null); }
        if (level !== undefined) { updates.push('level = ?'); params.push(level || null); }
        if (enabled !== undefined) { updates.push('enabled = ?'); params.push(enabled ? 1 : 0); }
        if (tags !== undefined) { updates.push('tags = ?'); params.push(tags ? JSON.stringify(tags) : null); }
        if (dataset !== undefined) { updates.push('dataset = ?'); params.push(dataset); }
        if (query_config !== undefined) { updates.push('query_config = ?'); params.push(query_config ? JSON.stringify(query_config) : null); }
        if (condition_logic !== undefined) { updates.push('condition_logic = ?'); params.push(condition_logic); }
        if ((request.body as any).muted_until !== undefined) { updates.push('muted_until = ?'); params.push((request.body as any).muted_until || null); }

        if (updates.length === 0) {
          return reply.code(400).send({ error: 'No fields to update' });
        }

        params.push(ruleId, projectId);
        await mysqlPool.query(
          `UPDATE g_argus_alert_rules SET ${updates.join(', ')} WHERE id = ? AND project_id = ?`,
          params
        );

        // Notify workers to reload alert rules for this project
        await broadcaster.publish({ type: CONFIG_TYPES.ALERT_RULES, projectId: parseInt(projectId, 10) });

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

        // Notify workers to reload alert rules for this project
        await broadcaster.publish({ type: CONFIG_TYPES.ALERT_RULES, projectId: parseInt(projectId, 10) });

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

  // Get alert stats (for mini charts & timeline)
  app.get(
    '/:projectId/alerts/stats',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId } = request.params as { projectId: string };
      const { days = '7' } = request.query as Record<string, string>;
      try {
        const daysInt = parseInt(days, 10);
        const formatStr = daysInt > 14 ? '%Y-%m-%d 00:00:00' : '%Y-%m-%d %H:00:00';
        
        const sql = `
          SELECT rule_id, DATE_FORMAT(triggered_at, ?) as bucket, COUNT(*) as count
          FROM g_argus_alert_history
          WHERE project_id = ? AND triggered_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
          GROUP BY rule_id, bucket
          ORDER BY bucket ASC
        `;
        const [rows] = await mysqlPool.query(sql, [formatStr, projectId, daysInt]);
        return reply.send({ success: true, data: rows });
      } catch (error) {
        logger.error('Failed to get alert stats', { projectId, error: String(error) });
        return reply.code(500).send({ error: 'Failed to get alert stats' });
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

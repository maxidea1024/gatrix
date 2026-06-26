import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import db from '../config/knex';
import { optic } from '@gatrix/argus-optic';
import { createLogger } from '../utils/logger';

const logger = createLogger('kpi-alerts-api');
const TABLE = 'g_argus_kpi_alerts';
const ACTIVITIES = 'argus.activities';

export default async function kpiAlertsRoutes(app: FastifyInstance) {
  // ─── GET /projects/:projectId/analytics/kpi-alerts ──────────────────────
  app.get(
    '/projects/:projectId/analytics/kpi-alerts',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId } = request.params as { projectId: string };

      try {
        const [rows] = await db.raw(
          `SELECT * FROM ${TABLE} WHERE project_id = ? ORDER BY created_at DESC`,
          [projectId]
        );
        // Parse JSON columns
        const alerts = (rows as any[]).map((r: any) => ({
          ...r,
          metric_config:
            typeof r.metric_config === 'string'
              ? JSON.parse(r.metric_config)
              : r.metric_config,
          notification_channels:
            typeof r.notification_channels === 'string'
              ? JSON.parse(r.notification_channels)
              : r.notification_channels,
        }));
        return reply.send({ success: true, data: alerts });
      } catch (error: any) {
        if (error?.code === 'ER_NO_SUCH_TABLE') {
          return reply.send({ success: true, data: [] });
        }
        logger.error('Failed to list KPI alerts', { error: String(error) });
        return reply.code(500).send({ error: 'Failed to list KPI alerts' });
      }
    }
  );

  // ─── POST /projects/:projectId/analytics/kpi-alerts ─────────────────────
  app.post(
    '/projects/:projectId/analytics/kpi-alerts',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId } = request.params as { projectId: string };
      const {
        name,
        metric_config,
        operator,
        threshold,
        check_interval,
        notification_channels,
      } = request.body as {
        name: string;
        metric_config: {
          type: 'event_count' | 'unique_users' | 'dau' | 'revenue';
          event_name?: string;
          interval_seconds: number;
        };
        operator: 'less_than' | 'greater_than' | 'equals';
        threshold: number;
        check_interval?: number;
        notification_channels?: { type: string; target: string }[];
      };

      if (!name || !metric_config || !operator || threshold == null) {
        return reply
          .code(400)
          .send({ error: 'name, metric_config, operator, threshold required' });
      }

      try {
        const [result] = await db.raw(
          `INSERT INTO ${TABLE} (project_id, name, metric_config, operator, threshold, check_interval, notification_channels)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            projectId,
            name,
            JSON.stringify(metric_config),
            operator,
            threshold,
            check_interval || 3600,
            JSON.stringify(notification_channels || []),
          ]
        );
        return reply.code(201).send({
          success: true,
          data: { id: (result as any).insertId },
        });
      } catch (error: any) {
        logger.error('Failed to create KPI alert', { error: String(error) });
        return reply.code(500).send({ error: 'Failed to create KPI alert' });
      }
    }
  );

  // ─── DELETE /projects/:projectId/analytics/kpi-alerts/:alertId ──────────
  app.delete(
    '/projects/:projectId/analytics/kpi-alerts/:alertId',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId, alertId } = request.params as {
        projectId: string;
        alertId: string;
      };
      try {
        await db.raw(`DELETE FROM ${TABLE} WHERE id = ? AND project_id = ?`, [
          alertId,
          projectId,
        ]);
        return reply.send({ success: true });
      } catch (error: any) {
        logger.error('Failed to delete KPI alert', { error: String(error) });
        return reply.code(500).send({ error: 'Failed to delete KPI alert' });
      }
    }
  );

  // ─── POST /projects/:projectId/analytics/kpi-alerts/:alertId/check ──────
  // Manually check a KPI alert
  app.post(
    '/projects/:projectId/analytics/kpi-alerts/:alertId/check',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { projectId, alertId } = request.params as {
        projectId: string;
        alertId: string;
      };

      try {
        const [rows] = await db.raw(
          `SELECT * FROM ${TABLE} WHERE id = ? AND project_id = ?`,
          [alertId, projectId]
        );
        const alert = (rows as any[])?.[0];
        if (!alert) {
          return reply.code(404).send({ error: 'Alert not found' });
        }

        const config =
          typeof alert.metric_config === 'string'
            ? JSON.parse(alert.metric_config)
            : alert.metric_config;

        const intervalSec = config.interval_seconds || 86400;
        let metricValue = 0;

        if (config.type === 'event_count') {
          const sql = `
            SELECT count() AS val
            FROM ${ACTIVITIES}
            WHERE project_id = {projectId:String}
              AND event_name = {eventName:String}
              AND timestamp >= now() - INTERVAL {interval:UInt32} SECOND
          `;
          const result = await optic.rawQuery({
            query: sql,
            params: {
              projectId,
              eventName: config.event_name || '',
              interval: intervalSec,
            },
          });
          metricValue = Number((result.data as any[])?.[0]?.val) || 0;
        } else if (config.type === 'unique_users') {
          const sql = `
            SELECT uniqExact(user_id) AS val
            FROM ${ACTIVITIES}
            WHERE project_id = {projectId:String}
              AND event_name = {eventName:String}
              AND timestamp >= now() - INTERVAL {interval:UInt32} SECOND
          `;
          const result = await optic.rawQuery({
            query: sql,
            params: {
              projectId,
              eventName: config.event_name || '',
              interval: intervalSec,
            },
          });
          metricValue = Number((result.data as any[])?.[0]?.val) || 0;
        } else if (config.type === 'dau') {
          const sql = `
            SELECT uniqExact(user_id) AS val
            FROM ${ACTIVITIES}
            WHERE project_id = {projectId:String}
              AND user_id != ''
              AND timestamp >= now() - INTERVAL 1 DAY
          `;
          const result = await optic.rawQuery({
            query: sql,
            params: { projectId },
          });
          metricValue = Number((result.data as any[])?.[0]?.val) || 0;
        } else if (config.type === 'revenue') {
          const sql = `
            SELECT sum(toFloat64OrZero(numeric_properties['amount'])) AS val
            FROM ${ACTIVITIES}
            WHERE project_id = {projectId:String}
              AND event_name = 'purchase'
              AND timestamp >= now() - INTERVAL {interval:UInt32} SECOND
          `;
          const result = await optic.rawQuery({
            query: sql,
            params: { projectId, interval: intervalSec },
          });
          metricValue = Number((result.data as any[])?.[0]?.val) || 0;
        }

        const op = alert.operator;
        const thresh = Number(alert.threshold);
        const triggered =
          op === 'less_than'
            ? metricValue < thresh
            : op === 'greater_than'
              ? metricValue > thresh
              : metricValue === thresh;

        // Update last_checked
        await db.raw(
          `UPDATE ${TABLE} SET last_checked = UTC_TIMESTAMP(), \`last_value\` = ?, \`status\` = ? WHERE id = ?`,
          [metricValue, triggered ? 'triggered' : 'ok', alertId]
        );

        return reply.send({
          success: true,
          data: {
            metric_value: metricValue,
            threshold: thresh,
            operator: op,
            triggered,
            status: triggered ? 'triggered' : 'ok',
          },
        });
      } catch (err) {
        logger.error('KPI alert check failed', {
          error: err instanceof Error ? err.message : String(err),
        });
        return reply.code(500).send({ error: 'KPI alert check failed' });
      }
    }
  );
}

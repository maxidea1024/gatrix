import { FastifyInstance } from 'fastify';
import db from '../config/knex';
import { createLogger } from '../utils/logger';

const logger = createLogger('uptime-api');

/**
 * Allowed interval values (mirrors Sentry's UptimeSubscription.IntervalSeconds).
 */
const ALLOWED_INTERVALS = [60, 300, 600, 1200, 1800, 3600];

export default async function uptimeRoutes(app: FastifyInstance) {
  // 1. List Uptime Monitors
  app.get<{ Params: { projectId: string } }>(
    '/:projectId/uptime',
    async (request, reply) => {
      try {
        const { projectId } = request.params;
        const [rows] = await db.raw(
          `SELECT * FROM g_argus_uptimeMonitors WHERE project_id = ? ORDER BY created_at DESC`,
          [projectId]
        );
        return reply.send({ success: true, data: rows });
      } catch (error) {
        logger.error('Failed to list uptime monitors', { error });
        return reply.code(500).send({ success: false, error: 'Internal Server Error' });
      }
    }
  );

  // 2. Create Uptime Monitor
  app.post<{
    Params: { projectId: string };
    Body: {
      name: string;
      url: string;
      method?: string;
      interval_seconds?: number;
      environment?: string;
      timeout_ms?: number;
      headers?: Record<string, string>;
      body?: string;
      expected_status_codes?: number[];
      downtime_threshold?: number;
      recovery_threshold?: number;
    }
  }>(
    '/:projectId/uptime',
    async (request, reply) => {
      try {
        const { projectId } = request.params;
        const {
          name, url, method = 'GET', interval_seconds = 60, environment = 'production',
          timeout_ms = 10000, headers, body: requestBody,
          expected_status_codes, downtime_threshold = 3, recovery_threshold = 1
        } = request.body;

        if (!name || !url) {
          return reply.code(400).send({ success: false, error: 'Missing required fields (name, url)' });
        }

        // Validate interval
        if (!ALLOWED_INTERVALS.includes(interval_seconds)) {
          return reply.code(400).send({
            success: false,
            error: `Invalid interval. Allowed values: ${ALLOWED_INTERVALS.join(', ')} seconds`,
          });
        }

        const [result]: any = await db.raw(
          `INSERT INTO g_argus_uptimeMonitors 
            (project_id, name, url, method, interval_seconds, environment,
             timeout_ms, headers, body, expected_status_codes,
             downtime_threshold, recovery_threshold)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            projectId, name, url, method, interval_seconds, environment,
            timeout_ms,
            headers ? JSON.stringify(headers) : null,
            requestBody || null,
            expected_status_codes ? JSON.stringify(expected_status_codes) : null,
            downtime_threshold, recovery_threshold
          ]
        );

        const [newMonitor] = await db.raw(
          `SELECT * FROM g_argus_uptimeMonitors WHERE id = ?`,
          [result.insertId]
        );

        return reply.code(201).send({ success: true, data: (newMonitor as any[])[0] });
      } catch (error) {
        logger.error('Failed to create uptime monitor', { error });
        return reply.code(500).send({ success: false, error: 'Internal Server Error' });
      }
    }
  );

  // 3. Update Uptime Monitor
  app.put<{
    Params: { projectId: string; monitorId: string };
    Body: {
      name?: string;
      url?: string;
      method?: string;
      interval_seconds?: number;
      environment?: string;
      status?: string;
      timeout_ms?: number;
      headers?: Record<string, string>;
      body?: string;
      expected_status_codes?: number[];
      downtime_threshold?: number;
      recovery_threshold?: number;
      is_muted?: boolean;
    }
  }>(
    '/:projectId/uptime/:monitorId',
    async (request, reply) => {
      try {
        const { projectId, monitorId } = request.params;
        const body = request.body;

        // Validate interval if provided
        if (body.interval_seconds !== undefined && !ALLOWED_INTERVALS.includes(body.interval_seconds)) {
          return reply.code(400).send({
            success: false,
            error: `Invalid interval. Allowed values: ${ALLOWED_INTERVALS.join(', ')} seconds`,
          });
        }
        
        // Whitelist allowed fields
        const allowedFields = [
          'name', 'url', 'method', 'interval_seconds', 'environment', 'status',
          'timeout_ms', 'headers', 'body', 'expected_status_codes',
          'downtime_threshold', 'recovery_threshold', 'is_muted'
        ];
        const jsonFields = ['headers', 'expected_status_codes'];
        const updates: string[] = [];
        const values: any[] = [];
        
        for (const [key, val] of Object.entries(body)) {
          if (val !== undefined && allowedFields.includes(key)) {
            updates.push(`${key} = ?`);
            values.push(jsonFields.includes(key) ? JSON.stringify(val) : val);
          }
        }
        
        if (updates.length === 0) {
          return reply.code(400).send({ success: false, error: 'No fields to update' });
        }
        
        values.push(monitorId, projectId);
        
        const [result]: any = await db.raw(
          `UPDATE g_argus_uptimeMonitors SET ${updates.join(', ')} WHERE id = ? AND project_id = ?`,
          values
        );
        
        if (result.affectedRows === 0) {
          return reply.code(404).send({ success: false, error: 'Monitor not found' });
        }
        
        return reply.send({ success: true, message: 'Monitor updated' });
      } catch (error) {
        logger.error('Failed to update uptime monitor', { error });
        return reply.code(500).send({ success: false, error: 'Internal Server Error' });
      }
    }
  );

  // 4. Delete Uptime Monitor
  app.delete<{ Params: { projectId: string; monitorId: string } }>(
    '/:projectId/uptime/:monitorId',
    async (request, reply) => {
      try {
        const { projectId, monitorId } = request.params;
        
        const [result]: any = await db.raw(
          `DELETE FROM g_argus_uptimeMonitors WHERE id = ? AND project_id = ?`,
          [monitorId, projectId]
        );
        
        if (result.affectedRows === 0) {
          return reply.code(404).send({ success: false, error: 'Monitor not found' });
        }
        
        return reply.send({ success: true, message: 'Monitor deleted' });
      } catch (error) {
        logger.error('Failed to delete uptime monitor', { error });
        return reply.code(500).send({ success: false, error: 'Internal Server Error' });
      }
    }
  );

  // 5. Get Checkin History for a monitor
  app.get<{
    Params: { projectId: string; monitorId: string };
    Querystring: { limit?: string; offset?: string };
  }>(
    '/:projectId/uptime/:monitorId/checkins',
    async (request, reply) => {
      try {
        const { projectId, monitorId } = request.params;
        const limit = Math.min(parseInt(request.query.limit || '50', 10), 200);
        const offset = parseInt(request.query.offset || '0', 10);

        // Verify monitor belongs to project
        const [monitors]: any = await db.raw(
          `SELECT id FROM g_argus_uptimeMonitors WHERE id = ? AND project_id = ?`,
          [monitorId, projectId]
        );
        if (monitors.length === 0) {
          return reply.code(404).send({ success: false, error: 'Monitor not found' });
        }

        const [rows] = await db.raw(
          `SELECT * FROM g_argus_uptimeCheckins
           WHERE monitor_id = ?
           ORDER BY checked_at DESC
           LIMIT ? OFFSET ?`,
          [monitorId, limit, offset]
        );

        const [countResult]: any = await db.raw(
          `SELECT COUNT(*) as total FROM g_argus_uptimeCheckins WHERE monitor_id = ?`,
          [monitorId]
        );

        return reply.send({
          success: true,
          data: rows,
          total: countResult[0].total,
        });
      } catch (error) {
        logger.error('Failed to get uptime checkins', { error });
        return reply.code(500).send({ success: false, error: 'Internal Server Error' });
      }
    }
  );

  // 6. Get Response Capture for debugging
  app.get<{
    Params: { projectId: string; monitorId: string; captureId: string };
  }>(
    '/:projectId/uptime/:monitorId/captures/:captureId',
    async (request, reply) => {
      try {
        const { projectId, monitorId, captureId } = request.params;

        // Verify monitor belongs to project
        const [monitors]: any = await db.raw(
          `SELECT id FROM g_argus_uptimeMonitors WHERE id = ? AND project_id = ?`,
          [monitorId, projectId]
        );
        if (monitors.length === 0) {
          return reply.code(404).send({ success: false, error: 'Monitor not found' });
        }

        const [captures]: any = await db.raw(
          `SELECT * FROM g_argus_uptimeResponseCaptures WHERE id = ? AND monitor_id = ?`,
          [captureId, monitorId]
        );

        if (captures.length === 0) {
          return reply.code(404).send({ success: false, error: 'Capture not found' });
        }

        return reply.send({ success: true, data: captures[0] });
      } catch (error) {
        logger.error('Failed to get response capture', { error });
        return reply.code(500).send({ success: false, error: 'Internal Server Error' });
      }
    }
  );
}
